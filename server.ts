
import express from "express";
import fs from "fs";
const fsp = fs.promises;
import path from "path";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const PORT = 3000;

    // ======================================================
    // GLOBAL MIDDLEWARE
    // ======================================================
    app.use(express.json({ limit: "100mb" }));
    app.use(express.urlencoded({ extended: true, limit: "100mb" }));
    app.use(cors({ origin: "*" }));

    // ======================================================
    // PATH CONFIG
    // ======================================================
    const ROOT_DIR = process.platform === "win32" || fs.existsSync("E:\\ServerData")
        ? "E:\\ServerData" 
        : path.join(process.cwd(), "ServerData");

    const DATA_PATH = path.join(ROOT_DIR, "backup.json");       // Main Data (Jobs, Customers, etc.)
    const AMIS_PATH = path.join(ROOT_DIR, "amis.json");         // Amis Accounting Data (Admin Only)
    const PAYMENT_PATH = path.join(ROOT_DIR, "payment.json");   // Payment Requests Only
    const STAFF_PATH = path.join(ROOT_DIR, "staff.json");       // Staff Changes (Pending/Draft)
    const NFC_PATH = path.join(ROOT_DIR, "NFC.json");
    const NOTIFICATION_PATH = path.join(ROOT_DIR, "notification.json");
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
    if (!fs.existsSync(NOTIFICATION_PATH)) fs.writeFileSync(NOTIFICATION_PATH, JSON.stringify({ messages: [], notifications: [], updates: [] }, null, 2));
    if (!fs.existsSync(PENDING_PATH)) fs.writeFileSync(PENDING_PATH, "[]");

    // ======================================================
    // MEMORY + LOCK STATE
    // ======================================================
    let memoryData: any = {};        // Stores Jobs, Customers, Lines...
    let memoryPayments: any[] = [];    // Stores Payment Requests
    let nfcMemoryData: any[] = [];
    const editingMap: Record<string, string> = {};

    // ======================================================
    // HELPER: DEDUPLICATE & MERGE DATA
    // ======================================================
    function sanitizePayload(data: any) {
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
                clean[key].forEach((item: any) => {
                    if (item && item[idField]) map.set(item[idField], item);
                });
                clean[key] = Array.from(map.values());
            }
        });

        return clean;
    }

    function mergeLists(currentList: any[], incomingList: any[], idField = "id") {
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

    const AMIS_JOB_FIELDS = [
        "amisPaymentDocNo", "amisPaymentDesc", "amisPaymentDate",
        "amisDepositOutDocNo", "amisDepositOutDesc", "amisDepositOutDate",
        "amisExtensionPaymentDocNo", "amisExtensionPaymentDesc", "amisExtensionPaymentDate", "amisExtensionPaymentAmount",
        "amisLcDocNo", "amisLcDesc", "amisLcAmount",
        "amisDepositDocNo", "amisDepositDesc", "amisDepositAmount",
        "amisDepositRefundDocNo", "amisDepositRefundDesc", "amisDepositRefundDate", "amisDepositRefundAmount"
    ];
    const AMIS_EXT_FIELDS = ["amisDocNo", "amisDesc", "amisAmount", "amisDate"];

    function preserveAmisData(currentList: any[], incomingList: any[]) {
        if (!currentList || !incomingList) return incomingList;
        
        const currentMap = new Map(currentList.map(j => [j.id, j]));
        
        return incomingList.map(incomingJob => {
            const existingJob = currentMap.get(incomingJob.id);
            if (!existingJob) return incomingJob;

            const mergedJob = { ...incomingJob };

            AMIS_JOB_FIELDS.forEach(field => {
                if (mergedJob[field] === undefined && existingJob[field] !== undefined) {
                    mergedJob[field] = existingJob[field];
                }
            });

            if (Array.isArray(mergedJob.extensions) && Array.isArray(existingJob.extensions)) {
                const existingExtMap = new Map(existingJob.extensions.map((e: any) => [e.id, e]));
                
                mergedJob.extensions = mergedJob.extensions.map((incExt: any) => {
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

    function splitAmisData(sourceData: any) {
        const cleanData = JSON.parse(JSON.stringify(sourceData));
        const amisData: any = { jobs: {} };
        let hasAmisData = false;
        let extractedCount = 0;

        if (Array.isArray(cleanData.jobs)) {
            cleanData.jobs.forEach((job: any) => {
                const jobAmis: any = {};
                let jobHasAmis = false;

                AMIS_JOB_FIELDS.forEach(field => {
                    if (job[field] !== undefined) {
                        jobAmis[field] = job[field];
                        delete job[field];
                        jobHasAmis = true;
                        extractedCount++;
                    }
                });

                if (Array.isArray(job.extensions)) {
                    const extAmisMap: any = {};
                    let extHasAmis = false;
                    
                    job.extensions.forEach((ext: any) => {
                        const singleExtAmis: any = {};
                        let singleExtHas = false;
                        AMIS_EXT_FIELDS.forEach(field => {
                            if (ext[field] !== undefined) {
                                singleExtAmis[field] = ext[field];
                                delete ext[field];
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
        
        return { cleanData, amisData, hasAmisData };
    }

    function mergeAmisData(mainData: any, amisData: any) {
        if (!mainData.jobs || !Array.isArray(mainData.jobs)) return;
        if (!amisData || !amisData.jobs) return;

        mainData.jobs.forEach((job: any) => {
            const amisEntry = amisData.jobs[job.id];
            if (amisEntry) {
                Object.keys(amisEntry).forEach(key => {
                    if (key !== 'extensions') {
                        job[key] = amisEntry[key];
                    }
                });

                if (amisEntry.extensions && Array.isArray(job.extensions)) {
                    job.extensions.forEach((ext: any) => {
                        const extAmis = amisEntry.extensions[ext.id];
                        if (extAmis) {
                            Object.assign(ext, extAmis);
                        }
                    });
                }
            }
        });
    }

    let writeLock = false;
    let writePending = false;
    let pendingWriteIsAdmin = false;

    async function triggerDiskSave(isAdmin = false) {
        if (writeLock) {
            writePending = true;
            if (isAdmin) pendingWriteIsAdmin = true;
            return;
        }

        writeLock = true;
        if (isAdmin) pendingWriteIsAdmin = true;

        try {
            do {
                writePending = false;
                const shouldWriteAmis = pendingWriteIsAdmin;
                pendingWriteIsAdmin = false;

                const dataSnapshot = { ...memoryData };
                const paymentSnapshot = [...memoryPayments];

                const { amisData } = splitAmisData(dataSnapshot);

                const writePromises = [
                    fsp.writeFile(DATA_PATH, JSON.stringify(dataSnapshot, null, 2), "utf8"),
                    fsp.writeFile(PAYMENT_PATH, JSON.stringify(paymentSnapshot, null, 2), "utf8"),
                    fsp.writeFile(NOTIFICATION_PATH, JSON.stringify({
                        messages: dataSnapshot.headerMessages || [],
                        notifications: dataSnapshot.headerNotifications || [],
                        updates: dataSnapshot.headerUpdates || []
                    }, null, 2), "utf8")
                ];

                if (shouldWriteAmis) {
                    writePromises.push(fsp.writeFile(AMIS_PATH, JSON.stringify(amisData, null, 2), "utf8"));
                }

                await Promise.all(writePromises);

                await writeHistoryBackup({
                    ...dataSnapshot,
                    paymentRequests: paymentSnapshot
                });

                console.log(`💾 Disk save completed. (Amis Saved: ${shouldWriteAmis})`);
            } while (writePending);
            
        } catch (err) {
            console.error("❌ Disk Write Error:", err);
        } finally {
            writeLock = false;
        }
    }

    async function saveStaffData(data: any) {
        try {
            await fsp.writeFile(STAFF_PATH, JSON.stringify(data, null, 2), "utf8");
        } catch (e) {
            console.error("Staff write error", e);
        }
    }

    async function writeHistoryBackup(data: any, maxFiles = 3) {
        try {
            const fileName = "history-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
            const filePath = path.join(HISTORY_ROOT, fileName);

            await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

            let files = await fsp.readdir(HISTORY_ROOT);
            files = files
                .filter(f => f.startsWith("history-") && f.endsWith(".json"));
            
            const fileInfos = await Promise.all(
                files.map(async f => ({ name: f, path: path.join(HISTORY_ROOT, f), time: (await fsp.stat(path.join(HISTORY_ROOT, f))).mtimeMs }))
            );

            if (fileInfos.length <= maxFiles) return;

            fileInfos.sort((a, b) => a.time - b.time);

            const removeCount = fileInfos.length - maxFiles;
            for (let i = 0; i < removeCount; i++) {
                await fsp.unlink(fileInfos[i].path);
            }

        } catch (err) {
            console.error("History backup error:", err);
        }
    }

    let clients: any[] = [];

    app.get("/api/events", (req, res) => {
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

    function broadcast(event: string, data: any) {
        clients.forEach(c => {
            c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        });
    }

    // Load Initial Data
    try {
        const rawData = await fsp.readFile(DATA_PATH, "utf8");
        memoryData = sanitizePayload(JSON.parse(rawData || "{}"));
        
        try {
            const rawAmis = await fsp.readFile(AMIS_PATH, "utf8");
            const amisData = JSON.parse(rawAmis || "{}");
            mergeAmisData(memoryData, amisData);
        } catch (e) {}
        
        if (!memoryData.deletedPaymentIds) memoryData.deletedPaymentIds = [];
        try {
            const rawNotif = await fsp.readFile(NOTIFICATION_PATH, "utf8");
            const notifData = JSON.parse(rawNotif || "{}");
            memoryData.headerMessages = notifData.messages || [];
            memoryData.headerNotifications = notifData.notifications || [];
            memoryData.headerUpdates = notifData.updates || [];
        } catch (e) {
            if (!memoryData.headerMessages) memoryData.headerMessages = [];
            if (!memoryData.headerNotifications) memoryData.headerNotifications = [];
            if (!memoryData.headerUpdates) memoryData.headerUpdates = [];
        }

        const rawPayment = await fsp.readFile(PAYMENT_PATH, "utf8");
        memoryPayments = JSON.parse(rawPayment || "[]");

        nfcMemoryData = JSON.parse(await fsp.readFile(NFC_PATH, "utf8") || "[]");

        console.log("✅ Database loaded into RAM");
    } catch (err) {
        console.error("Startup load error:", err);
        memoryData = { deletedPaymentIds: [] };
        memoryPayments = [];
        nfcMemoryData = [];
    }

    // ======================================================
    // API ROUTES
    // ======================================================
    app.get("/api/health", (req, res) => {
        console.log("Health check requested");
        res.json({ status: "ok", uptime: process.uptime() });
    });

    app.get("/api/data", (req, res) => {
        res.json({ ...memoryData, paymentRequests: memoryPayments });
    });

    app.post("/api/data/save", async (req, res) => {
        const { role, ...data } = req.body; 
        const safeData = sanitizePayload(data);
        const userRole = (role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isManager = userRole === 'manager';
        const isAccount = userRole === 'account';
        const isDocs = userRole === 'docs';
        const isStaff = userRole === 'staff';

        if (isAdmin || isManager || isAccount) {
            if (safeData.jobs) {
                const enrichedJobs = preserveAmisData(memoryData.jobs || [], safeData.jobs);
                memoryData.jobs = mergeLists(memoryData.jobs || [], enrichedJobs);
            }
            if (safeData.customers) memoryData.customers = mergeLists(memoryData.customers || [], safeData.customers);
            if (safeData.lines) memoryData.lines = mergeLists(memoryData.lines || [], safeData.lines);
            if (safeData.customReceipts) memoryData.customReceipts = mergeLists(memoryData.customReceipts || [], safeData.customReceipts);
            
            if (safeData.deletedJobIds && Array.isArray(safeData.deletedJobIds)) {
                if (!memoryData.deletedJobIds) memoryData.deletedJobIds = [];
                safeData.deletedJobIds.forEach((id: string) => {
                    if (!memoryData.deletedJobIds.includes(id)) memoryData.deletedJobIds.push(id);
                });
                memoryData.jobs = (memoryData.jobs || []).filter((j: any) => !memoryData.deletedJobIds.includes(j.id));
            }

            if (safeData.paymentRequests) {
                const adminIds = new Set(safeData.paymentRequests.map((r: any) => r.id));
                memoryPayments.forEach(existing => {
                    if (!adminIds.has(existing.id)) {
                        if (!memoryData.deletedPaymentIds) memoryData.deletedPaymentIds = [];
                        if (!memoryData.deletedPaymentIds.includes(existing.id)) memoryData.deletedPaymentIds.push(existing.id);
                    }
                });
                memoryPayments = mergeLists(memoryPayments, safeData.paymentRequests);
                memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
            }

            if (safeData.lockedIds) memoryData.lockedIds = safeData.lockedIds;
            if (safeData.processedRequestIds) memoryData.processedRequestIds = safeData.processedRequestIds;
            if (safeData.salaries) memoryData.salaries = mergeLists(memoryData.salaries || [], safeData.salaries);
            if (safeData.yearlyConfigs) memoryData.yearlyConfigs = safeData.yearlyConfigs; 

            triggerDiskSave(isAdmin || isAccount || isManager); 
            broadcast("data-updated", { time: Date.now(), source: role, type: 'FULL_SYNC' });
            res.json({ success: true, saved: "full_merged_admin" });

        } else if (isDocs) {
            let requireReload = false;
            if (safeData.paymentRequests) {
                const validRequests = safeData.paymentRequests.filter((req: any) => {
                    const isDeleted = memoryData.deletedPaymentIds && memoryData.deletedPaymentIds.includes(req.id);
                    if (isDeleted) {
                        requireReload = true;
                        return false;
                    }
                    return true;
                });
                memoryPayments = mergeLists(memoryPayments, validRequests);
            }
            triggerDiskSave(false); 
            broadcast("data-updated", { time: Date.now(), source: 'Docs' });
            res.json({ success: true, saved: "payment_only", requireReload });

        } else if (isStaff) {
            saveStaffData(safeData);
            res.json({ success: true, saved: "staff_file" });
        } else {
            res.json({ success: false, message: "No permission to save" });
        }
    });

    app.get("/api/header-data", (req, res) => {
        res.json({
            messages: memoryData.headerMessages || [],
            notifications: memoryData.headerNotifications || [],
            updates: memoryData.headerUpdates || []
        });
    });

    app.post("/api/header-data", (req, res) => {
        const { messages, notifications, updates } = req.body;
        if (messages) memoryData.headerMessages = messages;
        if (notifications) memoryData.headerNotifications = notifications;
        if (updates) memoryData.headerUpdates = updates;
        triggerDiskSave(false);
        broadcast("header-updated", { time: Date.now() });
        res.json({ success: true });
    });

    app.get("/api/history/latest", async (req, res) => {
        try {
            let files = await fsp.readdir(HISTORY_ROOT);
            files = files.filter(f => f.startsWith("history-") && f.endsWith(".json"));
            if (files.length === 0) return res.json({ found: false });
            const fileInfos = await Promise.all(files.map(async f => ({ name: f, time: (await fsp.stat(path.join(HISTORY_ROOT, f))).mtimeMs, path: path.join(HISTORY_ROOT, f) })));
            fileInfos.sort((a, b) => b.time - a.time);
            const latestFile = fileInfos[0];
            const data = JSON.parse(await fsp.readFile(latestFile.path, "utf8") || "{}");
            res.json({ found: true, fileName: latestFile.name, timestamp: latestFile.time, data });
        } catch (err) {
            res.status(500).json({ error: "Failed to read history" });
        }
    });

    app.get("/api/nfc", (req, res) => res.json(nfcMemoryData));
    app.post("/api/nfc/save", async (req, res) => {
        try {
            nfcMemoryData = req.body;
            await fsp.writeFile(NFC_PATH, JSON.stringify(nfcMemoryData, null, 2));
            res.json({ success: true });
        } catch {
            res.status(500).json({ success: false });
        }
    });

    app.post("/api/edit/start", (req, res) => {
        const { key, clientId } = req.body;
        if (editingMap[key] && editingMap[key] !== clientId) return res.status(409).json({ locked: true, by: editingMap[key] });
        editingMap[key] = clientId;
        broadcast("lock", { key, clientId });
        res.json({ locked: false });
    });

    app.post("/api/edit/end", (req, res) => {
        const { key, clientId } = req.body;
        if (editingMap[key] === clientId) {
            delete editingMap[key];
            broadcast("unlock", { key });
        }
        res.json({ success: true });
    });

    app.get("/api/pending", async (req, res) => {
        try {
            const json = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]");
            res.json(Array.isArray(json) ? json : []);
        } catch { res.json([]); }
    });

    app.post("/api/pending", async (req, res) => {
        let list = [];
        try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}
        const item = { id: Date.now().toString(), time: new Date().toISOString(), data: req.body, status: "pending" };
        list.push(item);
        await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));
        res.json({ success: true, id: item.id });
    });

    app.post("/api/approve", async (req, res) => {
        let list = [];
        try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}
        const item = list.find(i => i.id === req.body.id);
        if (!item) return res.status(404).json({ success: false });
        const fullData = sanitizePayload(item.data);
        memoryData.jobs = mergeLists(memoryData.jobs || [], fullData.jobs || []);
        memoryData.customers = mergeLists(memoryData.customers || [], fullData.customers || []);
        memoryData.lines = mergeLists(memoryData.lines || [], fullData.lines || []);
        if (fullData.yearlyConfigs) memoryData.yearlyConfigs = fullData.yearlyConfigs;
        if (fullData.paymentRequests) {
            memoryPayments = mergeLists(memoryPayments, fullData.paymentRequests);
            if (memoryData.deletedPaymentIds) memoryPayments = memoryPayments.filter(p => !memoryData.deletedPaymentIds.includes(p.id));
        }
        triggerDiskSave();
        item.status = "approved";
        item.approvedTime = new Date().toISOString();
        await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));
        broadcast("data-updated", { approved: true });
        res.json({ success: true });
    });

    app.delete("/api/pending/:id", async (req, res) => {
        let list = [];
        try { list = JSON.parse(await fsp.readFile(PENDING_PATH, "utf8") || "[]"); } catch {}
        list = list.filter(i => i.id !== req.params.id);
        await fsp.writeFile(PENDING_PATH, JSON.stringify(list, null, 2));
        res.json({ success: true });
    });

    app.get("/api/stamps", async (req, res) => {
        try {
            const files = await fsp.readdir(SIGN_DIR);
            res.json(files.map(file => ({ name: file, url: `/sign/${file}` })));
        } catch { res.json([]); }
    });

    app.delete("/api/stamps/:id", async (req, res) => {
        try {
            const filePath = path.join(SIGN_DIR, req.params.id);
            if (fs.existsSync(filePath)) { await fsp.unlink(filePath); res.json({ success: true }); }
            else res.status(404).json({ success: false });
        } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
    });

    function createUpload(dir: string, max = 100 * 1024 * 1024) {
        return multer({
            storage: multer.diskStorage({
                destination: (req, file, cb) => cb(null, dir),
                filename: (req, file, cb) => {
                    const safe = (req.body.fileName || file.originalname).replace(/[/\\?%*:|"<>]/g, "-");
                    cb(null, safe);
                }
            }),
            limits: { fileSize: max }
        }).single("file");
    }

    app.post("/api/upload-invoice", createUpload(INV_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, url: `/files/inv/${req.file.filename}` });
    });

    app.post("/api/upload-unc", createUpload(UNC_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, url: `/files/unc/${req.file.filename}` });
    });

    app.post("/api/upload-cvhc", createUpload(CVHC_ROOT), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, cvhcUrl: `/cvhc/${req.file.filename}` });
    });

    app.post("/api/upload-stamp", createUpload(SIGN_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, url: `/sign/${req.file.filename}` });
    });

    app.post("/api/upload-file", (req, res) => {
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
            res.json({ success: true, fileName: req.file.filename, url: `/uploads/${relativePath}` });
        });
    });

    app.post("/api/save-excel", createUpload(ROOT_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, message: "Saved to ServerData root" });
    });

    app.post("/api/ai/generate", async (req, res) => {
        try {
            const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "Missing API Key" });
            const { prompt, contents, model } = req.body;
            const modelName = model || "gemini-1.5-flash-latest";
            const payload = contents ? { contents } : { contents: [{ parts: [{ text: prompt }] }] };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data: any = await response.json();
            res.json(contents ? data : { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" });
        } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    // Static files
    app.use("/api/files/invoice", express.static(INVOICE_ROOT));
    app.use("/api/files/inv", express.static(INV_DIR));
    app.use("/api/files/unc", express.static(UNC_DIR));
    app.use("/api/cvhc", express.static(CVHC_ROOT));
    app.use("/api/sign", express.static(SIGN_DIR));
    app.use("/api/uploads", express.static(ROOT_DIR));

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

startServer();
