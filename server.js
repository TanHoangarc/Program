

//------------------------------------------------------
// KIMBERRY BACKEND – FINAL REALTIME (FULL FUNCTION – NO LOSS)
// RAM-first | Anti-duplicate | Multi-user lock
// Realtime notify | Pending | NFC | Upload
// + HISTORY BACKUP (KEEP LAST 3 FILES)
// + ROLE BASED STORAGE (Payment.json, Staff.json)
// + MERGE STRATEGY (Fix data loss)
// + ADMIN PRIORITY DELETE (Fix Zombie Data)
// + ROBUST WRITE QUEUE (Fix Race Conditions)
//------------------------------------------------------

const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = 3001;

// ======================================================
// GLOBAL MIDDLEWARE
// ======================================================
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cors({ origin: "*" }));

// ======================================================
// PATH CONFIG
// ======================================================
const ROOT_DIR = "E:/ServerData";

const DATA_PATH = path.join(ROOT_DIR, "backup.json");       // Main Data (Jobs, Customers, etc.)
const AMIS_PATH = path.join(ROOT_DIR, "amis.json");         // Amis Accounting Data (Admin Only) - Renamed to lowercase
const PAYMENT_PATH = path.join(ROOT_DIR, "payment.json");   // Payment Requests Only
const STAFF_PATH = path.join(ROOT_DIR, "staff.json");       // Staff Changes (Pending/Draft)
const NFC_PATH = path.join(ROOT_DIR, "NFC.json");
const PENDING_PATH = path.join(ROOT_DIR, "pending.json");   // Legacy Pending
const HISTORY_ROOT = path.join(ROOT_DIR, "history");

const INVOICE_ROOT = path.join(ROOT_DIR, "Invoice");
const INV_DIR = path.join(ROOT_DIR, "INV");
const UNC_DIR = path.join(ROOT_DIR, "UNC");
const CVHC_ROOT = path.join(ROOT_DIR, "CVHC");
const SIGN_DIR = path.join(ROOT_DIR, "Sign");

// ======================================================
// INIT DIRECTORIES & FILES
// ======================================================
[
    ROOT_DIR,
    HISTORY_ROOT,
    INVOICE_ROOT,
    INV_DIR,
    UNC_DIR,
    CVHC_ROOT,
    SIGN_DIR
].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Initialize files if not exist
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, "{}");
if (!fs.existsSync(AMIS_PATH)) fs.writeFileSync(AMIS_PATH, "{}");
if (!fs.existsSync(PAYMENT_PATH)) fs.writeFileSync(PAYMENT_PATH, "[]");
if (!fs.existsSync(STAFF_PATH)) fs.writeFileSync(STAFF_PATH, "[]");
if (!fs.existsSync(NFC_PATH)) fs.writeFileSync(NFC_PATH, "[]");
if (!fs.existsSync(PENDING_PATH)) fs.writeFileSync(PENDING_PATH, "[]");

// ======================================================
// MEMORY + LOCK STATE
// ======================================================
let memoryData = {};        // Stores Jobs, Customers, Lines...
let memoryPayments = [];    // Stores Payment Requests
let nfcMemoryData = [];
const editingMap = {};

// ======================================================
// HELPER: DEDUPLICATE & MERGE DATA
// ======================================================
function sanitizePayload(data) {
    if (!data) return {};
    const clean = { ...data };

    const configs = {
        jobs: "id",
        customers: "id",
        lines: "id",
        users: "username"
    };

    Object.entries(configs).forEach(([key, idField]) => {
        if (Array.isArray(clean[key])) {
            const map = new Map();
            clean[key].forEach(item => {
                if (item && item[idField]) map.set(item[idField], item);
            });
            clean[key] = Array.from(map.values());
        }
    });

    return clean;
}

// Merge lists but respect deleted items logic later
function mergeLists(currentList, incomingList, idField = "id") {
    if (!Array.isArray(incomingList)) return currentList || [];
    if (!Array.isArray(currentList)) return incomingList;

    const dataMap = new Map(currentList.map(item => [item[idField], item]));

    incomingList.forEach(item => {
        if (item && item[idField]) {
            dataMap.set(item[idField], item);
        }
    });

    return Array.from(dataMap.values());
}

// ======================================================
// AMIS DATA HANDLERS (SEPARATION LOGIC)
// ======================================================
const AMIS_JOB_FIELDS = [
    "amisPaymentDocNo", "amisPaymentDesc", "amisPaymentDate",
    "amisDepositOutDocNo", "amisDepositOutDesc", "amisDepositOutDate",
    "amisExtensionPaymentDocNo", "amisExtensionPaymentDesc", "amisExtensionPaymentDate", "amisExtensionPaymentAmount",
    "amisLcDocNo", "amisLcDesc", "amisLcAmount",
    "amisDepositDocNo", "amisDepositDesc", "amisDepositAmount",
    "amisDepositRefundDocNo", "amisDepositRefundDesc", "amisDepositRefundDate", "amisDepositRefundAmount"
];
const AMIS_EXT_FIELDS = ["amisDocNo", "amisDesc", "amisAmount", "amisDate"];

// Helper to restore Amis fields from memory if missing in incoming update
function preserveAmisData(currentList, incomingList) {
    if (!currentList || !incomingList) return incomingList;
    
    const currentMap = new Map(currentList.map(j => [j.id, j]));
    
    return incomingList.map(incomingJob => {
        const existingJob = currentMap.get(incomingJob.id);
        if (!existingJob) return incomingJob;

        // Clone incoming to avoid mutation side effects
        const mergedJob = { ...incomingJob };

        // Restore Job-level Amis fields if missing in incoming
        AMIS_JOB_FIELDS.forEach(field => {
            if (mergedJob[field] === undefined && existingJob[field] !== undefined) {
                mergedJob[field] = existingJob[field];
            }
        });

        // Restore Extension-level Amis fields
        if (Array.isArray(mergedJob.extensions) && Array.isArray(existingJob.extensions)) {
            const existingExtMap = new Map(existingJob.extensions.map(e => [e.id, e]));
            
            mergedJob.extensions = mergedJob.extensions.map(incExt => {
                const existExt = existingExtMap.get(incExt.id);
                if (!existExt) return incExt;
                
                const mergedExt = { ...incExt };
                AMIS_EXT_FIELDS.forEach(field => {
                    if (mergedExt[field] === undefined && existExt[field] !== undefined) {
                        mergedExt[field] = existExt[field];
                    }
                });
                return mergedExt;
            });
        }
        
        return mergedJob;
    });
}

function splitAmisData(sourceData) {
    // Deep clone to avoid mutating source
    const cleanData = JSON.parse(JSON.stringify(sourceData));
    const amisData = { jobs: {} };
    let hasAmisData = false;
    let extractedCount = 0;

    if (Array.isArray(cleanData.jobs)) {
        cleanData.jobs.forEach(job => {
            const jobAmis = {};
            let jobHasAmis = false;

            // Extract Job-level Amis fields
            AMIS_JOB_FIELDS.forEach(field => {
                if (job[field] !== undefined) {
                    jobAmis[field] = job[field];
                    delete job[field]; // Remove from clean data
                    jobHasAmis = true;
                    extractedCount++;
                }
            });

            // Extract Extension-level Amis fields
            if (Array.isArray(job.extensions)) {
                const extAmisMap = {};
                let extHasAmis = false;
                
                job.extensions.forEach(ext => {
                    const singleExtAmis = {};
                    let singleExtHas = false;
                    AMIS_EXT_FIELDS.forEach(field => {
                        if (ext[field] !== undefined) {
                            singleExtAmis[field] = ext[field];
                            delete ext[field]; // Remove from clean data
                            singleExtHas = true;
                            extractedCount++;
                        }
                    });

                    if (singleExtHas) {
                        extAmisMap[ext.id] = singleExtAmis;
                        extHasAmis = true;
                    }
                });

                if (extHasAmis) {
                    jobAmis.extensions = extAmisMap;
                    jobHasAmis = true;
                }
            }

            if (jobHasAmis) {
                amisData.jobs[job.id] = jobAmis;
                hasAmisData = true;
            }
        });
    }
    
    console.log(`[splitAmisData] Extracted ${extractedCount} Amis fields from ${cleanData.jobs ? cleanData.jobs.length : 0} jobs.`);
    return { cleanData, amisData, hasAmisData };
}

function mergeAmisData(mainData, amisData) {
    if (!mainData.jobs || !Array.isArray(mainData.jobs)) return;
    if (!amisData || !amisData.jobs) return;

    mainData.jobs.forEach(job => {
        const amisEntry = amisData.jobs[job.id];
        if (amisEntry) {
            // Merge Job-level fields
            Object.keys(amisEntry).forEach(key => {
                if (key !== 'extensions') {
                    job[key] = amisEntry[key];
                }
            });

            // Merge Extension-level fields
            if (amisEntry.extensions && Array.isArray(job.extensions)) {
                job.extensions.forEach(ext => {
                    const extAmis = amisEntry.extensions[ext.id];
                    if (extAmis) {
                        Object.assign(ext, extAmis);
                    }
                });
            }
        }
    });
}

// ======================================================
// ROBUST WRITE QUEUE (SERIALIZED)
// ======================================================
let writeLock = false;    // Is a write currently happening?
let writePending = false; // Is a new request waiting?
let pendingWriteIsAdmin = false; // Tracks if any pending write is from Admin

/**
 * Serializes writes to disk.
 * If a write is in progress, it sets a flag.
 * Once the current write finishes, if the flag is set, it runs again with the LATEST RAM state.
 * This ensures no updates are lost and the file eventually matches RAM perfectly.
 */
async function triggerDiskSave(isAdmin = false) {
    // 1. If we are already writing, just mark that we need to write again once finished.
    if (writeLock) {
        writePending = true;
        if (isAdmin) pendingWriteIsAdmin = true; // Upgrade pending write to Admin
        return;
    }

    writeLock = true;
    if (isAdmin) pendingWriteIsAdmin = true;

    try {
        do {
            // Reset pending flag at the start of the cycle
            writePending = false;
            
            // Capture if this cycle should write Amis data
            const shouldWriteAmis = pendingWriteIsAdmin;
            pendingWriteIsAdmin = false; // Reset for next cycle

            // 2. Snapshot the current RAM state (The Source of Truth)
            const dataSnapshot = { ...memoryData };
            const paymentSnapshot = [...memoryPayments];

            // 3. Split Data for Storage
            // We separate Amis data to save to amis.json (Admin only).
            // BUT we now KEEP the full data in backup.json as requested (redundancy).
            const { amisData } = splitAmisData(dataSnapshot);

            // 4. Perform I/O operations (Wait for them to finish)
            const writePromises = [
                // Save FULL data (including Amis) to backup.json
                fsp.writeFile(DATA_PATH, JSON.stringify(dataSnapshot, null, 2), "utf8"),
                fsp.writeFile(PAYMENT_PATH, JSON.stringify(paymentSnapshot, null, 2), "utf8")
            ];

            if (shouldWriteAmis) {
                writePromises.push(fsp.writeFile(AMIS_PATH, JSON.stringify(amisData, null, 2), "utf8"));
            }

            await Promise.all(writePromises);

            // 5. Write History Backup (Full Snapshot - Merged)
            // We combine them for the history file logic
            await writeHistoryBackup({
                ...dataSnapshot, // This is the original merged snapshot from RAM
                paymentRequests: paymentSnapshot
            });

            console.log(`💾 Disk save completed. (Amis Saved: ${shouldWriteAmis})`);

            // 6. Loop condition:
            // If `writePending` became true while we were awaiting the writes above,
            // the loop runs again immediately with the NEW latest RAM state.
        } while (writePending);
        
    } catch (err) {
        console.error("❌ Disk Write Error:", err);
    } finally {
        // Release lock only when queue is empty
        writeLock = false;
    }
}

// Separate handler for Staff file to avoid blocking main thread unnecessarily
async function saveStaffData(data) {
    try {
        await fsp.writeFile(STAFF_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
        console.error("Staff write error", e);
    }
}

// ======================================================
// HISTORY BACKUP – KEEP LAST 3 FILES
// ======================================================
async function writeHistoryBackup(data, maxFiles = 3) {
    try {
        const fileName = "history-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
        const filePath = path.join(HISTORY_ROOT, fileName);

        await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

        // Clean up old files
        let files = await fsp.readdir(HISTORY_ROOT);
        files = files
            .filter(f => f.startsWith("history-") && f.endsWith(".json"))
            .map(f => ({ name: f, path: path.join(HISTORY_ROOT, f) }));

        if (files.length <= maxFiles) return;

        // Sort: Oldest to Newest
        const filesWithTime = await Promise.all(
            files.map(async f => ({ ...f, time: (await fsp.stat(f.path)).mtimeMs }))
        );
        filesWithTime.sort((a, b) => a.time - b.time);

        // Delete oldest
        const removeCount = filesWithTime.length - maxFiles;
        for (let i = 0; i < removeCount; i++) {
            await fsp.unlink(filesWithTime[i].path);
        }

    } catch (err) {
        console.error("History backup error:", err);
    }
}

// ======================================================
// REALTIME CLIENTS (SSE)
// ======================================================
let clients = [];

app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const clientId = Date.now().toString();
    clients.push({ id: clientId, res });

    res.write(`event: connected\ndata: ${clientId}\n\n`);

    req.on("close", () => {
        clients = clients.filter(c => c.id !== clientId);
        Object.keys(editingMap).forEach(k => {
            if (editingMap[k] === clientId) delete editingMap[k];
        });
    });
});

function broadcast(event, data) {
    clients.forEach(c => {
        c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

// ======================================================
// LOAD INITIAL DATA
// ======================================================
(async () => {
    try {
        // 1. Load Main Data
        const rawData = await fsp.readFile(DATA_PATH, "utf8");
        memoryData = sanitizePayload(JSON.parse(rawData || "{}"));
        
        // Check Amis count in Backup
        let backupAmisCount = 0;
        const backupAmisCheck = splitAmisData(memoryData);
        if (backupAmisCheck.hasAmisData) {
             backupAmisCount = Object.keys(backupAmisCheck.amisData.jobs || {}).length;
        }

        // 1b. Load Amis Data (Admin Only File) & Merge
        let amisFileCount = 0;
        try {
            const rawAmis = await fsp.readFile(AMIS_PATH, "utf8");
            const amisData = JSON.parse(rawAmis || "{}");
            amisFileCount = Object.keys(amisData.jobs || {}).length;

            mergeAmisData(memoryData, amisData);
            console.log(`✅ Loaded: Backup has ${backupAmisCount} Amis jobs | Amis.json has ${amisFileCount} Amis jobs`);
        } catch (e) {
            console.warn("⚠️ Amis Data load failed or empty:", e.message);
        }
        
        if (!memoryData.deletedPaymentIds) {
            memoryData.deletedPaymentIds = [];
        }

        // 2. Load Payment Data
        const rawPayment = await fsp.readFile(PAYMENT_PATH, "utf8");
        memoryPayments = JSON.parse(rawPayment || "[]");

        // 3. Load NFC
        nfcMemoryData = JSON.parse(await fsp.readFile(NFC_PATH, "utf8") || "[]");

        console.log("✅ Database (Main + Payment + NFC) loaded into RAM");

        // 4. Auto-Sync: Compare and Sync
        const { hasAmisData, amisData: mergedAmis } = splitAmisData(memoryData);
        const mergedCount = Object.keys(mergedAmis.jobs || {}).length;

        if (hasAmisData) {
            // If counts differ, it means one had more or different data than the other.
            // We sync the merged result to BOTH files.
            if (backupAmisCount !== mergedCount || amisFileCount !== mergedCount) {
                console.log(`🔄 Syncing Amis Data: Merged total is ${mergedCount}. Updating files to match...`);
                await triggerDiskSave(true);
            } else {
                console.log("✅ Amis data is already synchronized across files.");
            }
        }

    } catch (err) {
        console.error("Startup load error:", err);
        memoryData = { deletedPaymentIds: [] };
        memoryPayments = [];
        nfcMemoryData = [];
    }
})();

// ======================================================
// AI ROUTE
// ======================================================
app.post("/ai/generate", async (req, res) => {
    try {
        const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

        const { prompt, contents, model } = req.body;
        const modelName = model || "gemini-1.5-flash-latest";
        const payload = contents
            ? { contents }
            : { contents: [{ parts: [{ text: prompt }] }] };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        res.json(
            contents
                ? data
                : { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// DATA API
// ======================================================

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// GET: Combine Main Data + Payments
app.get("/data", (req, res) => {
    const combinedData = {
        ...memoryData,
        paymentRequests: memoryPayments
    };
    res.json(combinedData);
});

// POST: Save based on Role
app.post("/data/save", async (req, res) => {
    const { role, ...data } = req.body; 
    const safeData = sanitizePayload(data);
    
    // Normalize role for checking
    const userRole = (role || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isAccount = userRole === 'account';
    const isDocs = userRole === 'docs';
    const isStaff = userRole === 'staff';

    if (isAdmin || isManager || isAccount) {
        // --- ADMIN/MANAGER/ACCOUNT UPDATE (SOURCE OF TRUTH) ---
        
        // 1. Update Global RAM for Main Entities with MERGE to prevent data loss
        // We use mergeLists to ensure that if a client has stale data (missing some items), 
        // those items are NOT deleted from the server unless explicitly requested.
        
        if (safeData.jobs) {
            // CRITICAL: Preserve Amis fields if missing in incoming update (e.g. from Docs/Staff)
            const enrichedJobs = preserveAmisData(memoryData.jobs || [], safeData.jobs);
            memoryData.jobs = mergeLists(memoryData.jobs || [], enrichedJobs);
        }
        if (safeData.customers) {
            memoryData.customers = mergeLists(memoryData.customers || [], safeData.customers);
        }
        if (safeData.lines) {
            memoryData.lines = mergeLists(memoryData.lines || [], safeData.lines);
        }
        if (safeData.customReceipts) {
            memoryData.customReceipts = mergeLists(memoryData.customReceipts || [], safeData.customReceipts);
        }
        
        // 2. Handle Deletions (Explicitly requested by client)
        if (safeData.deletedJobIds && Array.isArray(safeData.deletedJobIds)) {
            if (!memoryData.deletedJobIds) memoryData.deletedJobIds = [];
            safeData.deletedJobIds.forEach(id => {
                if (!memoryData.deletedJobIds.includes(id)) memoryData.deletedJobIds.push(id);
            });
            memoryData.jobs = (memoryData.jobs || []).filter(j => !memoryData.deletedJobIds.includes(j.id));
        }

        if (safeData.paymentRequests) {
            const adminIds = new Set(safeData.paymentRequests.map(r => r.id));
            
            // Mark items missing from Admin's list as Deleted
            memoryPayments.forEach(existing => {
                if (!adminIds.has(existing.id)) {
                    if (!memoryData.deletedPaymentIds) memoryData.deletedPaymentIds = [];
                    if (!memoryData.deletedPaymentIds.includes(existing.id)) {
                        memoryData.deletedPaymentIds.push(existing.id);
                    }
                }
            });

            // Update Payments
            memoryPayments = mergeLists(memoryPayments, safeData.paymentRequests);
            memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
        }

        // 3. Update Misc Arrays
        if (safeData.lockedIds) memoryData.lockedIds = safeData.lockedIds;
        if (safeData.processedRequestIds) memoryData.processedRequestIds = safeData.processedRequestIds;
        if (safeData.salaries) memoryData.salaries = mergeLists(memoryData.salaries || [], safeData.salaries);
        if (safeData.yearlyConfigs) memoryData.yearlyConfigs = safeData.yearlyConfigs; 

        // 4. Trigger Async Disk Write
        triggerDiskSave(isAdmin || isAccount || isManager); 
        broadcast("data-updated", { time: Date.now(), source: role, type: 'FULL_SYNC' });

        res.json({ success: true, saved: "full_merged_admin" });

    } else if (isDocs) {
        // --- DOCS UPDATE (PARTIAL) ---
        let requireReload = false;

        if (safeData.paymentRequests) {
            // Check against tombstone list to prevent resurrection
            const validRequests = safeData.paymentRequests.filter(req => {
                const isDeleted = memoryData.deletedPaymentIds && memoryData.deletedPaymentIds.includes(req.id);
                if (isDeleted) {
                    requireReload = true;
                    return false;
                }
                return true;
            });

            memoryPayments = mergeLists(memoryPayments, validRequests);
        }
        
        // Trigger Disk Write for consistency (Docs cannot save Amis)
        triggerDiskSave(false); 
        broadcast("data-updated", { time: Date.now(), source: 'Docs' });

        res.json({ success: true, saved: "payment_only", requireReload });

    } else if (isStaff) {
        // Staff writes to separate file, no merge needed into main memory
        saveStaffData(safeData);
        res.json({ success: true, saved: "staff_file" });
    } else {
        res.json({ success: false, message: "No permission to save" });
    }
});

// --- GET LATEST HISTORY ---
app.get("/history/latest", async (req, res) => {
    try {
        let files = await fsp.readdir(HISTORY_ROOT);
        files = files.filter(f => f.startsWith("history-") && f.endsWith(".json"));

        if (files.length === 0) {
            return res.json({ found: false, message: "No history files found." });
        }

        // Sort by time descending
        const filesWithTime = await Promise.all(
            files.map(async f => ({
                name: f,
                time: (await fsp.stat(path.join(HISTORY_ROOT, f))).mtimeMs,
                path: path.join(HISTORY_ROOT, f)
            }))
        );
        filesWithTime.sort((a, b) => b.time - a.time);

        const latestFile = filesWithTime[0];
        const raw = await fsp.readFile(latestFile.path, "utf8");
        const data = JSON.parse(raw || "{}");

        res.json({ found: true, fileName: latestFile.name, timestamp: latestFile.time, data: data });
    } catch (err) {
        console.error("Error reading latest history:", err);
        res.status(500).json({ error: "Failed to read history" });
    }
});

// ======================================================
// NFC API
// ======================================================
app.get("/nfc", (req, res) => res.json(nfcMemoryData));

app.post("/nfc/save", async (req, res) => {
    try {
        nfcMemoryData = req.body;
        await fsp.writeFile(NFC_PATH, JSON.stringify(nfcMemoryData, null, 2));
        res.json({ success: true, saved: true });
    } catch {
        res.status(500).json({ success: false });
    }
});

// ======================================================
// MULTI USER LOCK
// ======================================================
app.post("/edit/start", (req, res) => {
    const { key, clientId } = req.body;
    if (editingMap[key] && editingMap[key] !== clientId)
        return res.status(409).json({ locked: true, by: editingMap[key] });

    editingMap[key] = clientId;
    broadcast("lock", { key, clientId });
    res.json({ locked: false });
});

app.post("/edit/end", (req, res) => {
    const { key, clientId } = req.body;
    if (editingMap[key] === clientId) {
        delete editingMap[key];
        broadcast("unlock", { key });
    }
    res.json({ success: true });
});

// ======================================================
// PENDING SYSTEM
// ======================================================
app.get("/pending", async (req, res) => {
    try {
        const json = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]");
        res.json(Array.isArray(json) ? json : []);
    } catch {
        res.json([]);
    }
});

app.post("/pending", async (req, res) => {
    let list = [];
    try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}

    const item = {
        id: Date.now().toString(),
        time: new Date().toISOString(),
        data: req.body,
        status: "pending"
    };

    list.push(item);
    await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));
    res.json({ success: true, id: item.id });
});

app.post("/approve", async (req, res) => {
    let list = [];
    try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}

    const item = list.find(i => i.id === req.body.id);
    if (!item) return res.status(404).json({ success: false });

    // When approving, update RAM
    const fullData = sanitizePayload(item.data);
    
    memoryData.jobs = mergeLists(memoryData.jobs || [], fullData.jobs || []);
    memoryData.customers = mergeLists(memoryData.customers || [], fullData.customers || []);
    memoryData.lines = mergeLists(memoryData.lines || [], fullData.lines || []);
    if (fullData.yearlyConfigs) memoryData.yearlyConfigs = fullData.yearlyConfigs; // Merge yearly configs
    
    if (fullData.paymentRequests) {
        memoryPayments = mergeLists(memoryPayments, fullData.paymentRequests);
        if (memoryData.deletedPaymentIds) {
            memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
        }
    }

    // Trigger Disk Save
    triggerDiskSave();

    item.status = "approved";
    item.approvedTime = new Date().toISOString();
    await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));

    broadcast("data-updated", { approved: true });
    res.json({ success: true });
});

app.delete("/pending/:id", async (req, res) => {
    let list = [];
    try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}
    list = list.filter(i => i.id !== req.params.id);
    await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));
    res.json({ success: true });
});

// ======================================================
// STAMPS API (SIGN)
// ======================================================
app.get("/stamps", async (req, res) => {
    try {
        const files = await fsp.readdir(SIGN_DIR);
        const stamps = files.map(file => ({
            name: file,
            url: `/sign/${file}`
        }));
        res.json(stamps);
    } catch {
        res.json([]);
    }
});

app.delete("/stamps/:id", async (req, res) => {
    try {
        const filePath = path.join(SIGN_DIR, req.params.id);
        if (fs.existsSync(filePath)) {
            await fsp.unlink(filePath);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Not found" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// FILE UPLOAD HANDLERS
// ======================================================
function createUpload(dir, max = 100 * 1024 * 1024) {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, dir),
            filename: (req, file, cb) => {
                const safe = (req.body.fileName || file.originalname)
                    .replace(/[/\\?%*:|"<>]/g, "-");
                cb(null, safe);
            }
        }),
        limits: { fileSize: max }
    }).single("file");
}

app.post("/upload-invoice", createUpload(INV_DIR), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileName: req.file.filename, url: `/files/inv/${req.file.filename}` });
});

app.post("/upload-unc", createUpload(UNC_DIR), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileName: req.file.filename, url: `/files/unc/${req.file.filename}` });
});

app.post("/upload-cvhc", createUpload(CVHC_ROOT), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileName: req.file.filename, cvhcUrl: `/cvhc/${req.file.filename}` });
});

app.post("/upload-stamp", createUpload(SIGN_DIR), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileName: req.file.filename, url: `/sign/${req.file.filename}` });
});

// ======================================================
// GENERAL UPLOAD
// ======================================================
app.post("/upload-file", (req, res) => {
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const folder = req.body.folderPath ? path.join(ROOT_DIR, req.body.folderPath) : ROOT_DIR;
                if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
                cb(null, folder);
            },
            filename: (req, file, cb) => {
                const safe = (req.body.fileName || file.originalname).replace(/[/\\?%*:|"<>]/g, "-");
                cb(null, safe);
            }
        })
    }).single("file");

    upload(req, res, (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
        
        const relativePath = req.body.folderPath ? `${req.body.folderPath}/${req.file.filename}` : req.file.filename;
        const fullUrl = `/uploads/${relativePath}`;
        
        res.json({ success: true, fileName: req.file.filename, url: fullUrl });
    });
});

app.post("/save-excel", createUpload(ROOT_DIR), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, message: "Saved to ServerData root" });
});

// ======================================================
// STATIC SERVERS & START
// ======================================================
app.use("/files/invoice", express.static(INVOICE_ROOT));
app.use("/files/inv", express.static(INV_DIR));
app.use("/files/unc", express.static(UNC_DIR));
app.use("/cvhc", express.static(CVHC_ROOT));
app.use("/sign", express.static(SIGN_DIR));
app.use("/uploads", express.static(ROOT_DIR));

app.listen(PORT, () => {
    console.log("🚀 KIMBERRY BACKEND FINAL running at http://localhost:" + PORT);
});
