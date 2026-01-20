
//------------------------------------------------------
// KIMBERRY BACKEND – FINAL REALTIME (FULL FUNCTION – NO LOSS)
// RAM-first | Anti-duplicate | Multi-user lock
// Realtime notify | Pending | NFC | Upload
// + HISTORY BACKUP (KEEP LAST 3 FILES)
// + ROLE BASED STORAGE (Payment.json, Staff.json)
// + MERGE STRATEGY (Fix data loss)
// + ADMIN PRIORITY DELETE (Fix Zombie Data)
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
const PAYMENT_PATH = path.join(ROOT_DIR, "payment.json");   // Payment Requests Only
const STAFF_PATH = path.join(ROOT_DIR, "staff.json");       // Staff Changes (Pending/Draft)
const NFC_PATH = path.join(ROOT_DIR, "NFC.json");
const PENDING_PATH = path.join(ROOT_DIR, "pending.json");   // Legacy Pending (kept for compatibility or specific approval flows)
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
if (!fs.existsSync(PAYMENT_PATH)) fs.writeFileSync(PAYMENT_PATH, "[]"); // Payments are array
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

    // Map existing data by ID
    const dataMap = new Map(currentList.map(item => [item[idField], item]));

    // Update or Add incoming data
    incomingList.forEach(item => {
        if (item && item[idField]) {
            dataMap.set(item[idField], item);
        }
    });

    return Array.from(dataMap.values());
}

// ======================================================
// BACKGROUND WRITE QUEUE
// ======================================================
let isWriting = false;
let pendingWrite = false;

// Unified writer for Main Data and Payment Data
async function processWriteQueue(role, fullDataToSave) {
    if (isWriting) {
        pendingWrite = true;
        return; 
    }

    isWriting = true;
    pendingWrite = false;

    try {
        // ADMIN: Update Everything
        if (role === 'Admin' || role === 'Manager') {
            // 1. Separate Payments
            const payments = fullDataToSave.paymentRequests || [];
            const mainData = { ...fullDataToSave };
            delete mainData.paymentRequests; 

            // 2. Write backup.json
            await fsp.writeFile(DATA_PATH, JSON.stringify(mainData, null, 2), "utf8");
            
            // 3. Write payment.json
            await fsp.writeFile(PAYMENT_PATH, JSON.stringify(payments, null, 2), "utf8");

            // 4. Write History (Full Snapshot)
            await writeHistoryBackup(fullDataToSave);
        } 
        // DOCS: Update Payments Only
        else if (role === 'Docs') {
            const payments = fullDataToSave.paymentRequests || [];
            await fsp.writeFile(PAYMENT_PATH, JSON.stringify(payments, null, 2), "utf8");
        }
        // STAFF: Save to staff.json (No merge needed for staff specific file usually, but safer to keep as is)
        else if (role === 'Staff') {
            await fsp.writeFile(STAFF_PATH, JSON.stringify(fullDataToSave, null, 2), "utf8");
        }

    } catch (err) {
        console.error("Write error:", err);
    } finally {
        isWriting = false;
    }
}

// ======================================================
// HISTORY BACKUP – KEEP LAST 3 FILES
// ======================================================
async function writeHistoryBackup(data, maxFiles = 3) {
    try {
        const fileName =
            "history-" +
            new Date().toISOString().replace(/[:.]/g, "-") +
            ".json";

        const filePath = path.join(HISTORY_ROOT, fileName);

        // Write snapshot
        await fsp.writeFile(
            filePath,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        // Read history files
        let files = await fsp.readdir(HISTORY_ROOT);
        files = files
            .filter(f => f.startsWith("history-") && f.endsWith(".json"))
            .map(f => ({
                name: f,
                path: path.join(HISTORY_ROOT, f)
            }));

        if (files.length <= maxFiles) return;

        // Sort by modified time (old → new)
        const filesWithTime = await Promise.all(
            files.map(async f => ({
                ...f,
                time: (await fsp.stat(f.path)).mtimeMs
            }))
        );

        filesWithTime.sort((a, b) => a.time - b.time);

        // Remove old files
        const removeCount = filesWithTime.length - maxFiles;
        for (let i = 0; i < removeCount; i++) {
            await fsp.unlink(filesWithTime[i].path);
            console.log("🗑️ Deleted old history:", filesWithTime[i].name);
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
        
        // Ensure deletedPaymentIds exists
        if (!memoryData.deletedPaymentIds) {
            memoryData.deletedPaymentIds = [];
        }

        // 2. Load Payment Data
        const rawPayment = await fsp.readFile(PAYMENT_PATH, "utf8");
        memoryPayments = JSON.parse(rawPayment || "[]");

        // 3. Load NFC
        nfcMemoryData = JSON.parse(await fsp.readFile(NFC_PATH, "utf8") || "[]");

        console.log("✅ Database (Main + Payment + NFC) loaded into RAM");
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
    const { role, ...data } = req.body; // Extract Role
    
    // Sanitize incoming data
    const safeData = sanitizePayload(data);
    
    // Logic Branching based on Role
    if (role === 'Admin' || role === 'Manager') {
        // --- ADMIN PRIORITY LOGIC ---
        // Admin is the source of truth for Deletions.
        
        // 1. Merge Main Data Entities - UPDATED: OVERWRITE FOR ADMIN TO ALLOW DELETIONS
        // We overwrite memory with the incoming list. This effectively processes deletions
        // (missing items are gone) while adding/updating other items.
        if (safeData.jobs) memoryData.jobs = safeData.jobs;
        if (safeData.customers) memoryData.customers = safeData.customers;
        if (safeData.lines) memoryData.lines = safeData.lines;
        if (safeData.customReceipts) memoryData.customReceipts = safeData.customReceipts;
        
        // 2. Handle Payment Requests (With Deletion Tracking)
        if (safeData.paymentRequests) {
            // Check what Admin has that Server doesn't, AND what Server has that Admin doesn't.
            // If Server has ID 'A' but Admin (current payload) DOES NOT have ID 'A', 
            // it means Admin DELETED 'A'. We must respect this.
            
            const adminIds = new Set(safeData.paymentRequests.map(r => r.id));
            
            // Identify deletions: Items in memory that are NOT in Admin's list
            memoryPayments.forEach(existing => {
                if (!adminIds.has(existing.id)) {
                    // This item was deleted by Admin. Add to Tombstone list.
                    if (!memoryData.deletedPaymentIds) memoryData.deletedPaymentIds = [];
                    if (!memoryData.deletedPaymentIds.includes(existing.id)) {
                        memoryData.deletedPaymentIds.push(existing.id);
                        console.log(`[Admin Delete] Marked payment ${existing.id} as deleted.`);
                    }
                }
            });

            // Update Memory:
            // - Merge updated/new items from Admin
            // - Filter out items that are in the deleted list (Tombstones)
            memoryPayments = mergeLists(memoryPayments, safeData.paymentRequests);
            memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
        }

        // 3. Other simple arrays
        if (safeData.lockedIds) memoryData.lockedIds = safeData.lockedIds;
        if (safeData.processedRequestIds) memoryData.processedRequestIds = safeData.processedRequestIds;
        if (safeData.salaries) memoryData.salaries = mergeLists(memoryData.salaries || [], safeData.salaries);

        // Response success
        res.json({ success: true, saved: "full_merged_admin" });
        
        // Construct Full Data for Disk Write
        const fullDataToWrite = {
            ...memoryData,
            paymentRequests: memoryPayments
        };

        // Background Write
        processWriteQueue(role, fullDataToWrite);
        broadcast("data-updated", { time: Date.now(), source: 'Admin', type: 'FULL_SYNC' });

    } else if (role === 'Docs') {
        // --- DOCS LIMITED LOGIC ---
        // Docs can update payments, but cannot resurrect Admin-deleted items.
        
        let requireReload = false;

        if (safeData.paymentRequests) {
            // Filter incoming requests against the Tombstone list
            const validRequests = safeData.paymentRequests.filter(req => {
                const isDeleted = memoryData.deletedPaymentIds && memoryData.deletedPaymentIds.includes(req.id);
                if (isDeleted) {
                    console.log(`[Docs Sync] Blocked resurrection of deleted payment ${req.id}`);
                    requireReload = true; // Signal client to refresh
                    return false;
                }
                return true;
            });

            // Merge only valid requests
            memoryPayments = mergeLists(memoryPayments, validRequests);
        }
        
        res.json({ success: true, saved: "payment_only", requireReload });
        
        const fullConstruct = { ...memoryData, paymentRequests: memoryPayments };
        processWriteQueue(role, fullConstruct);
        
        // Only broadcast if successful updates occurred
        broadcast("data-updated", { time: Date.now(), source: 'Docs' });

    } else if (role === 'Staff') {
        // Staff logic remains same (File based)
        res.json({ success: true, saved: "staff_file" });
        processWriteQueue(role, safeData);
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

        // Sort by time descending (newest first)
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

        res.json({ 
            found: true, 
            fileName: latestFile.name, 
            timestamp: latestFile.time, 
            data: data 
        });
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

    // When approving, act as Admin
    const fullData = sanitizePayload(item.data);
    
    // Merge Logic for Approval too
    memoryData.jobs = mergeLists(memoryData.jobs || [], fullData.jobs || []);
    memoryData.customers = mergeLists(memoryData.customers || [], fullData.customers || []);
    memoryData.lines = mergeLists(memoryData.lines || [], fullData.lines || []);
    if (fullData.paymentRequests) {
        memoryPayments = mergeLists(memoryPayments, fullData.paymentRequests);
        // Clean up deletions just in case
        if (memoryData.deletedPaymentIds) {
            memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
        }
    }

    // Construct merged state for writing
    const dataToWrite = { ...memoryData, paymentRequests: memoryPayments };
    processWriteQueue('Admin', dataToWrite);

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
    // IMPORTANT: Return cvhcUrl so frontend can link it
    res.json({ success: true, fileName: req.file.filename, cvhcUrl: `/cvhc/${req.file.filename}` });
});

app.post("/upload-stamp", createUpload(SIGN_DIR), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileName: req.file.filename, url: `/sign/${req.file.filename}` });
});

// ======================================================
// GENERAL UPLOAD (FOR INVOICE/DATA MANAGEMENT EXCEL)
// ======================================================
app.post("/upload-file", (req, res) => {
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                // req.body might not be populated yet if multer is not configured with any fields
                // We use a custom storage or middleware order.
                // But for simplicity with 'createUpload', we usually specific dir.
                // Here we need dynamic dir based on body `folderPath`.
                // Multer's destination function gives access to req.
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
        
        // Construct URL based on folderPath
        // Note: We static serve 'uploads' -> ROOT_DIR
        // If folderPath is 'Invoice/2023.10', then URL is /uploads/Invoice/2023.10/filename
        const relativePath = req.body.folderPath ? `${req.body.folderPath}/${req.file.filename}` : req.file.filename;
        const fullUrl = `/uploads/${relativePath}`;
        
        res.json({ success: true, fileName: req.file.filename, url: fullUrl });
    });
});

// ======================================================
// EXCEL SAVE (EXPORT)
// ======================================================
app.post("/save-excel", createUpload(ROOT_DIR), (req, res) => {
    // Just saves the file to ROOT_DIR
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, message: "Saved to ServerData root" });
});

// ======================================================
// STATIC FILE SERVERS
// ======================================================
app.use("/files/invoice", express.static(INVOICE_ROOT));
app.use("/files/inv", express.static(INV_DIR));
app.use("/files/unc", express.static(UNC_DIR));
app.use("/cvhc", express.static(CVHC_ROOT));
app.use("/sign", express.static(SIGN_DIR));
app.use("/uploads", express.static(ROOT_DIR));

// ======================================================
// START SERVER
// ======================================================
app.listen(PORT, () => {
    console.log("🚀 KIMBERRY BACKEND FINAL running at http://localhost:" + PORT);
});
