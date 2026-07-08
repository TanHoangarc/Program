
import express from "express";
import fs from "fs";
const fsp = fs.promises;
import path from "path";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configStr = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
const firebaseConfig = JSON.parse(configStr);

// Use Admin SDK with the correct project
admin.initializeApp({
  projectId: firebaseConfig.projectId
});
const db = admin.firestore();

async function saveToFirestore(docId: string, dataObj: any) {
    const jsonStr = JSON.stringify(dataObj);
    const CHUNK_SIZE = 900000;
    const numChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);
    await db.collection('backups').doc(docId).set({ chunks: numChunks, updatedAt: Date.now() });
    for (let i = 0; i < numChunks; i++) {
        const chunk = jsonStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await db.collection('backups').doc(`${docId}_chunk_${i}`).set({ data: chunk });
    }
}

async function loadFromFirestore(docId: string, defaultData: any) {
    try {
        const metaDoc = await db.collection('backups').doc(docId).get();
        if (!metaDoc.exists) return defaultData;
        const { chunks } = metaDoc.data() || {};
        let jsonStr = "";
        for (let i = 0; i < (chunks || 0); i++) {
            const chunkDoc = await db.collection('backups').doc(`${docId}_chunk_${i}`).get();
            jsonStr += chunkDoc.data()?.data || "";
        }
        return JSON.parse(jsonStr || "null") || defaultData;
    } catch(e) {
        console.error("Firebase read error", e);
        return defaultData;
    }
}

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

    const INVOICE_ROOT = path.join(ROOT_DIR, "Invoice");
    const INV_DIR = path.join(ROOT_DIR, "INV");
    const UNC_DIR = path.join(ROOT_DIR, "UNC");
    const CVHC_ROOT = path.join(ROOT_DIR, "CVHC");
    const SIGN_DIR = path.join(ROOT_DIR, "Sign");
    const GUQ_DIR = path.join(ROOT_DIR, "GUQ");

    // ======================================================
    // INIT DIRECTORIES & FILES
    // ======================================================
    [
        ROOT_DIR,
        INVOICE_ROOT,
        INV_DIR,
        UNC_DIR,
        CVHC_ROOT,
        SIGN_DIR,
        GUQ_DIR
    ].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // ======================================================
    // DATABASE STATE
    // ======================================================
    const editingMap: Record<string, string> = {};

    let dbLock = Promise.resolve();

    async function loadFullDatabase() {
        const defaults = {
            jobs: [], customers: [], lines: [], deletedJobIds: [],
            paymentRequests: [], deletedPaymentIds: [], nfc: [], 
            pending: [], staff: [], longHoangOrders: [],
            headerMessages: [], headerNotifications: [], headerUpdates: [],
            customReceipts: [], salaries: [], yearlyConfigs: {},
            lockedIds: [], processedRequestIds: [], authorizations: [],
            deletedAuthIds: []
        };
        const loaded = await loadFromFirestore('mainDatabase', defaults);
        return { ...defaults, ...loaded };
    }

    async function saveFullDatabase(data: any) {
        await saveToFirestore('mainDatabase', data);
    }

    function withDBLock(action: (dbState: any) => Promise<any> | any) {
        return db.runTransaction(async (transaction) => {
            const metaRef = db.collection('backups').doc('mainDatabase');
            const metaDoc = await transaction.get(metaRef);
            
            let chunksCount = 0;
            let currentMeta: any = null;
            if (metaDoc.exists) {
                currentMeta = metaDoc.data();
                chunksCount = currentMeta.chunks || 0;
            }
            
            let jsonStr = "";
            const chunkRefs = [];
            for (let i = 0; i < chunksCount; i++) {
                const chunkRef = db.collection('backups').doc(`mainDatabase_chunk_${i}`);
                chunkRefs.push(chunkRef);
            }
            
            if (chunkRefs.length > 0) {
                const chunkDocs = await Promise.all(chunkRefs.map(ref => transaction.get(ref)));
                for (const chunkDoc of chunkDocs) {
                    jsonStr += (chunkDoc as any).data()?.data || "";
                }
            }
            
            const defaults = {
                jobs: [], customers: [], lines: [], deletedJobIds: [],
                paymentRequests: [], deletedPaymentIds: [], nfc: [], 
                pending: [], staff: [], longHoangOrders: [],
                headerMessages: [], headerNotifications: [], headerUpdates: [],
                customReceipts: [], salaries: [], yearlyConfigs: {},
                lockedIds: [], processedRequestIds: [], authorizations: [],
                deletedAuthIds: []
            };
            const parsed = JSON.parse(jsonStr || "null") || {};
            const dbState = { ...defaults, ...parsed };
            
            const result = await action(dbState);
            
            if (result !== false) {
                const newJsonStr = JSON.stringify(dbState);
                const CHUNK_SIZE = 900000;
                const numChunks = Math.ceil(newJsonStr.length / CHUNK_SIZE);
                
                transaction.set(metaRef, { chunks: numChunks, updatedAt: Date.now() });
                
                for (let i = 0; i < numChunks; i++) {
                    const chunkRef = db.collection('backups').doc(`mainDatabase_chunk_${i}`);
                    const chunkData = newJsonStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                    transaction.set(chunkRef, { data: chunkData });
                }
                
                if (chunksCount > numChunks) {
                    for (let i = numChunks; i < chunksCount; i++) {
                        const oldChunkRef = db.collection('backups').doc(`mainDatabase_chunk_${i}`);
                        transaction.delete(oldChunkRef);
                    }
                }
            }
            
            return result;
        });
    }

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
            users: "username",
            authorizations: "id"
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

    function mergePaymentRequests(currentList: any[], incomingList: any[]) {
        if (!Array.isArray(incomingList)) return currentList || [];
        if (!Array.isArray(currentList)) return incomingList;

        const dataMap = new Map(currentList.map(item => [item.id, item]));

        incomingList.forEach(incomingItem => {
            if (incomingItem && incomingItem.id) {
                const currentItem = dataMap.get(incomingItem.id);
                if (!currentItem) {
                    dataMap.set(incomingItem.id, incomingItem);
                } else {
                    const merged = { ...currentItem };
                    
                    if (incomingItem.status === 'completed' || currentItem.status === 'completed') {
                        merged.status = 'completed';
                    } else {
                        merged.status = incomingItem.status || currentItem.status || 'pending';
                    }
                    
                    if (incomingItem.uncUrl) merged.uncUrl = incomingItem.uncUrl;
                    if (incomingItem.uncFileName) merged.uncFileName = incomingItem.uncFileName;
                    if (incomingItem.uncPath) merged.uncPath = incomingItem.uncPath;
                    if (incomingItem.uncBlobUrl) merged.uncBlobUrl = incomingItem.uncBlobUrl;
                    if (incomingItem.completedAt) merged.completedAt = incomingItem.completedAt;

                    if (incomingItem.invoiceUrl) merged.invoiceUrl = incomingItem.invoiceUrl;
                    if (incomingItem.invoiceFileName) merged.invoiceFileName = incomingItem.invoiceFileName;
                    if (incomingItem.invoicePath) merged.invoicePath = incomingItem.invoicePath;
                    if (incomingItem.invoiceBlobUrl) merged.invoiceBlobUrl = incomingItem.invoiceBlobUrl;

                    if (incomingItem.isOrderCreated || currentItem.isOrderCreated) {
                        merged.isOrderCreated = true;
                    } else {
                        merged.isOrderCreated = false;
                    }

                    merged.lineCode = incomingItem.lineCode || currentItem.lineCode;
                    merged.pod = incomingItem.pod || currentItem.pod;
                    merged.booking = incomingItem.booking || currentItem.booking;
                    merged.amount = incomingItem.amount || currentItem.amount;
                    merged.type = incomingItem.type || currentItem.type;
                    merged.createdAt = incomingItem.createdAt || currentItem.createdAt;

                    dataMap.set(incomingItem.id, merged);
                }
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


    // ======================================================
    app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

    app.get("/api/data", async (req, res) => {
        const data = await loadFullDatabase();
        res.json(data);
    });

    app.get("/api/export/long-hoang-jobs", async (req, res) => {
        const data = await loadFullDatabase();
        const jobs = data.jobs || [];
        const lhJobs = jobs.filter((j: any) => 
            j.customerName && (
                j.customerName.toUpperCase().includes('LONG HOANG LOGISTICS') || 
                j.customerName.toUpperCase() === 'LONG HOANG'
            )
        );
        const result = lhJobs.map((j: any) => ({
            monthYear: `${j.month}/${j.year}`,
            jobCode: j.jobCode || '',
            booking: j.booking || '',
            hbl: j.hbl || '',
            line: j.line || '',
            cont20: j.cont20 || 0,
            cont40: j.cont40 || 0,
            sell: j.sell || 0
        }));
        res.json({ success: true, count: result.length, data: result });
    });

    app.post("/api/data/save", async (req, res) => {
        const { role, clientId, ...data } = req.body; 
        const safeData = sanitizePayload(data);
        const userRole = (role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isDocs = userRole === 'docs';

        if (!isAdmin && !isDocs) {
            return res.json({ success: false, message: "No permission to save" });
        }

        let requireReload = false;

        await withDBLock(async (dbState) => {
            if (isAdmin) {
                if (safeData.jobs) {
                    const enrichedJobs = preserveAmisData(dbState.jobs || [], safeData.jobs);
                    dbState.jobs = mergeLists(dbState.jobs || [], enrichedJobs);
                }
                if (safeData.customers) dbState.customers = mergeLists(dbState.customers || [], safeData.customers);
                if (safeData.lines) dbState.lines = mergeLists(dbState.lines || [], safeData.lines);
                if (safeData.customReceipts) dbState.customReceipts = mergeLists(dbState.customReceipts || [], safeData.customReceipts);
                
                if (safeData.deletedJobIds && Array.isArray(safeData.deletedJobIds)) {
                    if (!dbState.deletedJobIds) dbState.deletedJobIds = [];
                    safeData.deletedJobIds.forEach((id: string) => {
                        if (!dbState.deletedJobIds.includes(id)) dbState.deletedJobIds.push(id);
                    });
                    dbState.jobs = (dbState.jobs || []).filter((j: any) => !dbState.deletedJobIds.includes(j.id));
                }

                if (safeData.paymentRequests) {
                    if (Array.isArray(safeData.deletedPaymentIds)) {
                        if (!dbState.deletedPaymentIds) dbState.deletedPaymentIds = [];
                        safeData.deletedPaymentIds.forEach((id: string) => {
                            if (!dbState.deletedPaymentIds.includes(id)) dbState.deletedPaymentIds.push(id);
                        });
                    }
                    dbState.paymentRequests = mergePaymentRequests(dbState.paymentRequests || [], safeData.paymentRequests);
                    if (dbState.deletedPaymentIds) {
                        dbState.paymentRequests = (dbState.paymentRequests || []).filter((p:any) => !dbState.deletedPaymentIds.includes(p.id));
                    }
                }

                if (safeData.lockedIds) dbState.lockedIds = safeData.lockedIds;
                if (safeData.processedRequestIds) dbState.processedRequestIds = safeData.processedRequestIds;
                if (safeData.salaries) dbState.salaries = mergeLists(dbState.salaries || [], safeData.salaries);
                if (safeData.yearlyConfigs) dbState.yearlyConfigs = safeData.yearlyConfigs; 
                if (safeData.longHoangOrders) dbState.longHoangOrders = mergeLists(dbState.longHoangOrders || [], safeData.longHoangOrders);
                if (safeData.deletedAuthIds && Array.isArray(safeData.deletedAuthIds)) {
                    if (!dbState.deletedAuthIds) dbState.deletedAuthIds = [];
                    safeData.deletedAuthIds.forEach((id: string) => {
                        if (!dbState.deletedAuthIds.includes(id)) dbState.deletedAuthIds.push(id);
                    });
                }
                if (safeData.authorizations) {
                    dbState.authorizations = mergeLists(dbState.authorizations || [], safeData.authorizations);
                }
                if (dbState.deletedAuthIds && dbState.authorizations) {
                    dbState.authorizations = dbState.authorizations.filter((a: any) => !dbState.deletedAuthIds.includes(a.id));
                }

            } else if (isDocs) {
                if (safeData.paymentRequests) {
                    const validRequests = safeData.paymentRequests.filter((req: any) => {
                        const isDeleted = dbState.deletedPaymentIds && dbState.deletedPaymentIds.includes(req.id);
                        if (isDeleted) {
                            requireReload = true;
                            return false;
                        }
                        return true;
                    });
                    dbState.paymentRequests = mergePaymentRequests(dbState.paymentRequests || [], validRequests);
                }
                if (safeData.longHoangOrders) {
                    dbState.longHoangOrders = mergeLists(dbState.longHoangOrders || [], safeData.longHoangOrders);
                }
            }
        });

        broadcast("data-updated", { time: Date.now(), source: role, clientId: clientId || '', type: isAdmin ? 'FULL_SYNC' : 'DOCS_SYNC' });
        res.json({ success: true, saved: isAdmin ? "full_merged_admin" : "payment_and_lh", requireReload });
    });

    app.get("/api/header-data", async (req, res) => {
        const data = await loadFullDatabase();
        res.json({
            messages: data.headerMessages || [],
            notifications: data.headerNotifications || [],
            updates: data.headerUpdates || []
        });
    });

    app.post("/api/header-data", async (req, res) => {
        const { messages, notifications, updates } = req.body;
        await withDBLock(async (dbState) => {
            if (messages) dbState.headerMessages = messages;
            if (notifications) dbState.headerNotifications = notifications;
            if (updates) dbState.headerUpdates = updates;
        });
        broadcast("header-updated", { time: Date.now() });
        res.json({ success: true });
    });

    app.get("/api/history/latest", (req, res) => {
        res.json({ found: false });
    });

    app.get("/api/nfc", async (req, res) => {
        const data = await loadFullDatabase();
        res.json(data.nfc || []);
    });
    app.post("/api/nfc/save", async (req, res) => {
        try {
            await withDBLock(async (dbState) => {
                dbState.nfc = req.body;
            });
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
            const data = await loadFullDatabase();
            res.json(Array.isArray(data.pending) ? data.pending : []);
        } catch { res.json([]); }
    });

    app.post("/api/pending", async (req, res) => {
        const item = { id: Date.now().toString(), time: new Date().toISOString(), data: req.body, status: "pending" };
        await withDBLock(async (dbState) => {
            if(!dbState.pending) dbState.pending = [];
            dbState.pending.push(item);
        });
        broadcast("data-updated", { time: Date.now(), source: "Docs", type: "PENDING_SYNC" });
        res.json({ success: true, id: item.id });
    });

    app.post("/api/approve", async (req, res) => {
        let success = false;
        await withDBLock(async (dbState) => {
            if(!dbState.pending) dbState.pending = [];
            const item = dbState.pending.find((i: any) => i.id === req.body.id);
            if (!item) return false;

            const fullData = sanitizePayload(item.data);
            dbState.jobs = mergeLists(dbState.jobs || [], fullData.jobs || []);
            dbState.customers = mergeLists(dbState.customers || [], fullData.customers || []);
            dbState.lines = mergeLists(dbState.lines || [], fullData.lines || []);
            
            if (fullData.yearlyConfigs) dbState.yearlyConfigs = fullData.yearlyConfigs;
            if (fullData.paymentRequests) {
                dbState.paymentRequests = mergePaymentRequests(dbState.paymentRequests || [], fullData.paymentRequests);
                if (dbState.deletedPaymentIds) {
                    dbState.paymentRequests = (dbState.paymentRequests || []).filter((p:any) => !dbState.deletedPaymentIds.includes(p.id));
                }
            }
            
            item.status = "approved";
            item.approvedTime = new Date().toISOString();
            success = true;
        });

        if (success) {
            broadcast("data-updated", { approved: true });
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false });
        }
    });

    app.delete("/api/pending/:id", async (req, res) => {
        await withDBLock(async (dbState) => {
            if(!dbState.pending) dbState.pending = [];
            dbState.pending = dbState.pending.filter((i: any) => i.id !== req.params.id);
        });
        broadcast("data-updated", { time: Date.now(), source: "Admin", type: "PENDING_SYNC" });
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

    app.post("/api/long-hoang/backup", async (req, res) => {
        try {
            const { orders } = req.body;
            await withDBLock(async (dbState) => {
                dbState.longHoangOrders = orders;
            });
            res.json({ success: true, message: "Backup saved successfully" });
        } catch (err: any) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    app.get("/api/long-hoang/restore", async (req, res) => {
        try {
            const data = await loadFullDatabase();
            if (!data.longHoangOrders) {
                return res.status(404).json({ success: false, message: "Backup not found" });
            }
            res.json({ success: true, orders: data.longHoangOrders });
        } catch (err: any) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    app.post("/api/export-long-hoang", async (req, res) => {
        try {
            const { orders } = req.body;
            if (!orders || !Array.isArray(orders) || orders.length === 0) {
                return res.status(400).json({ success: false, message: "No orders provided" });
            }

            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const templatePath = path.join(ROOT_DIR, "Invoice", "Phieu_chi_LH.xlsx");

            let worksheet;
            if (fs.existsSync(templatePath)) {
                await workbook.xlsx.readFile(templatePath);
                worksheet = workbook.worksheets[0];
            } else {
                worksheet = workbook.addWorksheet('Phieu_chi_LH');
                // Add basic headers if template is missing
                const headerRow = worksheet.getRow(8);
                headerRow.getCell('A').value = "Loại chứng từ";
                headerRow.getCell('B').value = "Ngày chứng từ";
                headerRow.getCell('C').value = "Ngày hạch toán";
                headerRow.getCell('D').value = "Số chứng từ";
                headerRow.getCell('E').value = "Lý do chi";
                headerRow.getCell('F').value = "Diễn giải";
                headerRow.getCell('G').value = "Tài khoản ngân hàng";
                headerRow.getCell('H').value = "Tên ngân hàng";
                headerRow.getCell('I').value = "Đối tượng";
                headerRow.getCell('S').value = "Loại tiền";
                headerRow.getCell('U').value = "Diễn giải chi tiết";
                headerRow.getCell('V').value = "TK Nợ";
                headerRow.getCell('W').value = "TK Có";
                headerRow.getCell('X').value = "Số tiền";
                headerRow.getCell('Z').value = "Đối tượng chi tiết";
                headerRow.commit();
            }

            let currentRow = 9;
            let uncCounter = 1;

            orders.forEach(order => {
                const row = worksheet.getRow(currentRow);
                
                // Format date from YYYY-MM-DD to DD/MM/YYYY
                let formattedDate = order.paymentDate;
                if (formattedDate) {
                    const parts = formattedDate.split('-');
                    if (parts.length === 3) {
                        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                }

                const uncNumber = `UNC${String(uncCounter).padStart(5, '0')}`;
                const description = `Chi tiền cho ncc lô ${order.note || ''} BILL ${order.mbl || ''}`;

                row.getCell('A').value = "Ủy nhiệm chi";
                row.getCell('B').value = formattedDate;
                row.getCell('C').value = formattedDate;
                row.getCell('D').value = uncNumber;
                row.getCell('E').value = "Chi khác";
                row.getCell('F').value = description;
                row.getCell('G').value = "19135447033015";
                row.getCell('H').value = "Ngân hàng TMCP Kỹ thương Việt Nam - Gia Định";
                row.getCell('I').value = order.line || '';
                row.getCell('S').value = "VND";
                row.getCell('U').value = description;
                row.getCell('V').value = "3311";
                row.getCell('W').value = "1121";
                row.getCell('X').value = order.amount || 0;
                row.getCell('Z').value = order.line || '';

                row.commit();
                currentRow++;
                uncCounter++;
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Phieu_chi_LH_Export.xlsx');
            
            await workbook.xlsx.write(res);
            res.end();
        } catch (error: any) {
            console.error("Export error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
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
