
import express from "express";
import fs from "fs";
const fsp = fs.promises;
import path from "path";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { GoogleGenAI, Type } from "@google/genai";

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

const getGeminiClient = (customKey?: string) => {
    const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY or API_KEY environment variable on server");
    }
    return new GoogleGenAI({
        apiKey,
        httpOptions: {
            headers: {
                'User-Agent': 'aistudio-build',
            }
        }
    });
};

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

    // ======================================================
    // INIT DIRECTORIES & FILES
    // ======================================================
    [
        ROOT_DIR,
        INVOICE_ROOT,
        INV_DIR,
        UNC_DIR,
        CVHC_ROOT,
        SIGN_DIR
    ].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // ======================================================
    // DATABASE STATE
    // ======================================================
    const editingMap: Record<string, string> = {};

    let dbLock = Promise.resolve();

    async function loadFullDatabase() {
        return await loadFromFirestore('mainDatabase', {
            jobs: [], customers: [], lines: [], deletedJobIds: [],
            paymentRequests: [], deletedPaymentIds: [], nfc: [], 
            pending: [], staff: [], longHoangOrders: [],
            headerMessages: [], headerNotifications: [], headerUpdates: [],
            customReceipts: [], deletedCustomReceiptIds: [], salaries: [], yearlyConfigs: {},
            lockedIds: [], processedRequestIds: []
        });
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
            
            const dbState = JSON.parse(jsonStr || "null") || {
                jobs: [], customers: [], lines: [], deletedJobIds: [],
                paymentRequests: [], deletedPaymentIds: [], nfc: [], 
                pending: [], staff: [], longHoangOrders: [],
                headerMessages: [], headerNotifications: [], headerUpdates: [],
                customReceipts: [], deletedCustomReceiptIds: [], salaries: [], yearlyConfigs: {},
                lockedIds: [], processedRequestIds: []
            };
            
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
                    const merged = { ...currentItem, ...incomingItem };
                    
                    if (incomingItem.isOrderCreated !== undefined) {
                        merged.isOrderCreated = incomingItem.isOrderCreated;
                    }
                    if (incomingItem.status) {
                        merged.status = incomingItem.status;
                    }
                    if (!incomingItem.uncUrl && currentItem.uncUrl) merged.uncUrl = currentItem.uncUrl;
                    if (!incomingItem.uncFileName && currentItem.uncFileName) merged.uncFileName = currentItem.uncFileName;
                    if (!incomingItem.invoiceUrl && currentItem.invoiceUrl) merged.invoiceUrl = currentItem.invoiceUrl;
                    if (!incomingItem.invoiceFileName && currentItem.invoiceFileName) merged.invoiceFileName = currentItem.invoiceFileName;

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

    const handleEvents = (req: express.Request, res: express.Response) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const clientId = Date.now().toString();
        clients.push({ id: clientId, res });

        res.write(`event: connected\ndata: ${clientId}\n\n`);

        // Periodic keep-alive comment every 15 seconds to prevent Cloudflare/proxy timeouts
        const keepAliveTimer = setInterval(() => {
            try {
                res.write(": ping\n\n");
            } catch (err) {
                clearInterval(keepAliveTimer);
            }
        }, 15000);

        req.on("close", () => {
            clearInterval(keepAliveTimer);
            clients = clients.filter(c => c.id !== clientId);
            Object.keys(editingMap).forEach(k => {
                if (editingMap[k] === clientId) delete editingMap[k];
            });
        });
    };

    app.get(["/api/events", "/events"], handleEvents);

    function broadcast(event: string, data: any) {
        const deadClientIds: string[] = [];
        clients.forEach(c => {
            try {
                c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (err) {
                deadClientIds.push(c.id);
            }
        });
        if (deadClientIds.length > 0) {
            clients = clients.filter(c => !deadClientIds.includes(c.id));
        }
    }


    // ======================================================
    app.get(["/api/health", "/health"], (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

    // Lightweight endpoint for fast real-time payment requests sync
    app.get(["/api/payment-requests", "/payment-requests"], async (req, res) => {
        const data = await loadFullDatabase();
        let requests = data?.paymentRequests || [];
        if (data?.deletedPaymentIds && Array.isArray(data.deletedPaymentIds)) {
            const deletedSet = new Set(data.deletedPaymentIds.map((id: any) => String(id).trim()));
            requests = requests.filter((p: any) => !deletedSet.has(String(p.id).trim()));
        }
        res.json({ success: true, paymentRequests: requests });
    });

    app.get(["/api/data", "/data"], async (req, res) => {
        const data = await loadFullDatabase();
        if (data) {
            if (data.deletedCustomReceiptIds && Array.isArray(data.deletedCustomReceiptIds)) {
                const deletedSet = new Set(data.deletedCustomReceiptIds.map((id: any) => String(id).trim()));
                if (data.customReceipts && Array.isArray(data.customReceipts)) {
                    data.customReceipts = data.customReceipts.filter((r: any) => !deletedSet.has(String(r.id).trim()));
                }
            }
            if (data.deletedJobIds && Array.isArray(data.deletedJobIds)) {
                const deletedJobSet = new Set(data.deletedJobIds.map((id: any) => String(id).trim()));
                if (data.jobs && Array.isArray(data.jobs)) {
                    data.jobs = data.jobs.filter((j: any) => !deletedJobSet.has(String(j.id).trim()));
                }
            }
            if (data.deletedPaymentIds && Array.isArray(data.deletedPaymentIds)) {
                const deletedPaymentSet = new Set(data.deletedPaymentIds.map((id: any) => String(id).trim()));
                if (data.paymentRequests && Array.isArray(data.paymentRequests)) {
                    data.paymentRequests = data.paymentRequests.filter((p: any) => !deletedPaymentSet.has(String(p.id).trim()));
                }
            }
        }
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

    app.post(["/api/data/save", "/data/save"], async (req, res) => {
        const { role, ...data } = req.body; 
        const safeData = sanitizePayload(data);
        const userRole = (role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isDocs = userRole === 'docs';

        if (!isAdmin && !isDocs) {
            return res.json({ success: false, message: "No permission to save" });
        }

        let requireReload = false;
        let latestPaymentRequests: any[] | null = null;

        await withDBLock(async (dbState) => {
            if (safeData.deletedJobIds && Array.isArray(safeData.deletedJobIds)) {
                if (!dbState.deletedJobIds) dbState.deletedJobIds = [];
                safeData.deletedJobIds.forEach((id: any) => {
                    const idStr = String(id).trim();
                    if (!dbState.deletedJobIds.some((x: any) => String(x).trim() === idStr)) dbState.deletedJobIds.push(idStr);
                });
            }

            if (safeData.deletedCustomReceiptIds && Array.isArray(safeData.deletedCustomReceiptIds)) {
                if (!dbState.deletedCustomReceiptIds) dbState.deletedCustomReceiptIds = [];
                safeData.deletedCustomReceiptIds.forEach((id: any) => {
                    const idStr = String(id).trim();
                    if (!dbState.deletedCustomReceiptIds.some((x: any) => String(x).trim() === idStr)) dbState.deletedCustomReceiptIds.push(idStr);
                });
            }

            if (safeData.deletedPaymentIds && Array.isArray(safeData.deletedPaymentIds)) {
                if (!dbState.deletedPaymentIds) dbState.deletedPaymentIds = [];
                safeData.deletedPaymentIds.forEach((id: any) => {
                    const idStr = String(id).trim();
                    if (!dbState.deletedPaymentIds.some((x: any) => String(x).trim() === idStr)) dbState.deletedPaymentIds.push(idStr);
                });
            }

            if (isAdmin) {
                if (safeData.jobs) {
                    const enrichedJobs = preserveAmisData(dbState.jobs || [], safeData.jobs);
                    dbState.jobs = mergeLists(dbState.jobs || [], enrichedJobs);
                }
                if (safeData.customers) dbState.customers = mergeLists(dbState.customers || [], safeData.customers);
                if (safeData.lines) dbState.lines = mergeLists(dbState.lines || [], safeData.lines);
                
                if (safeData.customReceipts) {
                    const delCustSet = new Set((dbState.deletedCustomReceiptIds || []).map((x: any) => String(x).trim()));
                    dbState.customReceipts = (safeData.customReceipts || []).filter((r: any) => !delCustSet.has(String(r.id).trim()));
                }
                
                if (dbState.deletedJobIds) {
                    const delJobSet = new Set((dbState.deletedJobIds || []).map((x: any) => String(x).trim()));
                    dbState.jobs = (dbState.jobs || []).filter((j: any) => !delJobSet.has(String(j.id).trim()));
                }

                if (dbState.deletedCustomReceiptIds) {
                    const delCustSet = new Set((dbState.deletedCustomReceiptIds || []).map((x: any) => String(x).trim()));
                    dbState.customReceipts = (dbState.customReceipts || []).filter((r: any) => !delCustSet.has(String(r.id).trim()));
                }

                if (safeData.paymentRequests) {
                    dbState.paymentRequests = mergePaymentRequests(dbState.paymentRequests || [], safeData.paymentRequests);
                    if (dbState.deletedPaymentIds) {
                        const delPaySet = new Set((dbState.deletedPaymentIds || []).map((x: any) => String(x).trim()));
                        dbState.paymentRequests = (dbState.paymentRequests || []).filter((p: any) => !delPaySet.has(String(p.id).trim()));
                    }
                }

                if (safeData.lockedIds) dbState.lockedIds = safeData.lockedIds;
                if (safeData.processedRequestIds) dbState.processedRequestIds = safeData.processedRequestIds;
                if (safeData.salaries) dbState.salaries = mergeLists(dbState.salaries || [], safeData.salaries);
                if (safeData.yearlyConfigs) dbState.yearlyConfigs = safeData.yearlyConfigs; 
                if (safeData.longHoangOrders) dbState.longHoangOrders = mergeLists(dbState.longHoangOrders || [], safeData.longHoangOrders);
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
                    if (dbState.deletedPaymentIds) {
                        const delPaySet = new Set((dbState.deletedPaymentIds || []).map((x: any) => String(x).trim()));
                        dbState.paymentRequests = (dbState.paymentRequests || []).filter((p: any) => !delPaySet.has(String(p.id).trim()));
                    }
                }
                if (safeData.longHoangOrders) {
                    dbState.longHoangOrders = mergeLists(dbState.longHoangOrders || [], safeData.longHoangOrders);
                }
            }

            if (safeData.paymentRequests) {
                latestPaymentRequests = dbState.paymentRequests || [];
            }
        });

        broadcast("data-updated", { time: Date.now(), source: role, type: isAdmin ? 'FULL_SYNC' : 'DOCS_SYNC' });
        if (latestPaymentRequests) {
            broadcast("payment-updated", { time: Date.now(), source: role, paymentRequests: latestPaymentRequests });
        }
        res.json({ 
            success: true, 
            saved: isAdmin ? "full_merged_admin" : "payment_and_lh", 
            requireReload, 
            paymentRequests: latestPaymentRequests 
        });
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
                    // Overwrite/replace duplicate files cleanly
                    try {
                        const targetPath = path.join(dir, safe);
                        if (fs.existsSync(targetPath)) {
                            fs.unlinkSync(targetPath);
                        }
                        const dotIdx = safe.lastIndexOf(".");
                        const baseName = dotIdx !== -1 ? safe.substring(0, dotIdx) : safe;
                        if (baseName && fs.existsSync(dir)) {
                            const files = fs.readdirSync(dir);
                            for (const f of files) {
                                if (f.startsWith(baseName + ".")) {
                                    try {
                                        fs.unlinkSync(path.join(dir, f));
                                    } catch (e) {}
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Error replacing duplicate file:", e);
                    }
                    cb(null, safe);
                }
            }),
            limits: { fileSize: max }
        }).single("file");
    }

    app.post(["/api/upload-invoice", "/upload-invoice"], createUpload(INV_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, url: `/files/inv/${req.file.filename}` });
    });

    app.post(["/api/upload-unc", "/upload-unc"], createUpload(UNC_DIR), (req, res) => {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, fileName: req.file.filename, url: `/files/unc/${req.file.filename}` });
    });

    app.post(["/api/upload-cvhc", "/upload-cvhc"], createUpload(CVHC_ROOT), (req, res) => {
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
            const apiKey = req.body.apiKey || (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY || process.env.API_KEY;
            if (!apiKey) return res.status(500).json({ error: "Missing API Key" });
            const { prompt, contents, model } = req.body;
            let modelName = model || "gemini-3.8-flash";
            // Map deprecated or unsupported models to supported Gemini models
            if (
                !modelName ||
                modelName.includes("1.5") ||
                modelName.includes("2.0") ||
                modelName.includes("2.5") ||
                modelName === "gemini-pro"
            ) {
                modelName = "gemini-3.8-flash";
            }
            const payload = contents ? { contents } : { contents: [{ parts: [{ text: prompt }] }] };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data: any = await response.json();
            if (data.error) {
                console.error("Gemini API Error in /api/ai/generate:", data.error);
                return res.status(response.status || 500).json({ error: data.error.message || JSON.stringify(data.error) });
            }
            res.json(contents ? data : { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" });
        } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    const handleCVHCScan = async (req: express.Request, res: express.Response) => {
        try {
            const { base64Data, mimeType } = req.body;
            let customApiKey = ((req.headers['x-gemini-api-key'] as string) || req.body.apiKey || '').trim();
            if (customApiKey === "null" || customApiKey === "undefined" || customApiKey === "") {
                customApiKey = undefined;
            }
            if (!base64Data) {
                return res.status(400).json({ success: false, error: "Missing base64Data" });
            }

            const effectiveKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
            if (!effectiveKey) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Chưa cấu hình Gemini API Key. Vui lòng bấm vào nút 'Cài Key API' trên thanh công cụ để nhập và kích hoạt API Key cá nhân của bạn." 
                });
            }

            const ai = getGeminiClient(effectiveKey);
            const modelsToTry = [
                "gemini-3.1-flash-lite",
                "gemini-flash-lite-latest",
                "gemini-flash-latest",
                "gemini-3.8-flash",
                "gemini-3.1-pro-preview"
            ];
            let lastError: any = null;
            let resultData = null;

            const cvhcReaderPrompt = `Bạn là một nhân viên chứng từ/kế toán logistics xuất nhập khẩu chuyên nghiệp, cẩn trọng và tỉ mỉ. Bạn đang đóng vai trò là: "1 NGƯỜI ĐỌC TỪNG TRANG FILE ĐÍNH KÈM VÀ GHI LẠI DỮ LIỆU CHÍNH XÁC VÀO CÁC DÒNG".

Nhiệm vụ của bạn: Hãy quan sát và đọc kỹ toàn bộ trang tài liệu này (Công văn hoàn cược - CVHC, Giấy đề nghị thanh toán/hoàn tiền cược container, Biên bản bàn giao cont, Giấy báo thu hoặc Vận đơn B/L). Trích xuất thật chính xác các thông tin sau để điền vào dòng tương ứng:

1. "jobCode" (Số BL / Số Job / Mã Vận Đơn):
   - Tìm kiếm số B/L No, Bill of Lading, Booking No, MBL, HBL, Mã Job, Số vận đơn.
   - Thường nằm ở tiêu đề công văn ("V/v: Hoàn trả tiền cược cont lô hàng theo B/L số..."), hoặc bảng kê cont/seal.
   - Nếu trên trang này có nhiều số BL được kê khai, hãy lấy tất cả và ngăn cách nhau bằng dấu phẩy (Ví dụ: "SGN2405012, SGN2405013").

2. "customerName" (Tên Khách Hàng / Đơn Vị Đề Nghị Hoàn Cược):
   - Đọc tên công ty/doanh nghiệp làm công văn xin hoàn cược (Ví dụ: "CÔNG TY TNHH THƯƠNG MẠI XNK ĐẠI DƯƠNG", "CÔNG TY CP TIẾP VẬN VÀ TIẾP VẬN SAO BIỂN"...).
   - Thường nằm ở góc trái trên cùng (Đơn vị gửi) hoặc phần mở đầu: "Kính gửi Hãng tàu... Tên công ty chúng tôi là...".

3. "amount" (Số Tiền Cược / Tiền Đề Nghị Hoàn Trả):
   - Số tiền đề nghị hoàn trả lại bằng số nguyên (VNĐ).
   - Tìm ở các dòng: "Số tiền:", "Số tiền cược:", "Số tiền đề nghị hoàn cược:", "Bằng số:".
   - Ví dụ: 2.000.000 đ -> 2000000; 5,000,000 VND -> 5000000. Bỏ dấu chấm, dấu phẩy, chữ đ/VND.
   - Nếu trên văn bản không ghi số tiền hoặc không tìm thấy, trả về 0.

4. "accountNumber" (Số Tài Khoản Ngân Hàng Thụ Hưởng):
   - Dãy số tài khoản ngân hàng để chuyển trả tiền cược.
   - Chỉ lấy các chữ số liên tục (Ví dụ: "0071001234567", "19034567890123"). Bỏ qua dấu cách, dấu gạch ngang.
   - Tìm ở mục: "Số tài khoản:", "STK:", "A/C:", "Tài khoản thụ hưởng:".

5. "bankName" (Tên Ngân Hàng Thụ Hưởng):
   - Chỉ lấy tên thương hiệu ngân hàng chính ngắn gọn (Ví dụ: "Vietcombank", "Vietinbank", "Techcombank", "BIDV", "Agribank", "ACB", "MB Bank", "VPBank", "TPBank", "Sacombank", "VIB", "HDBank", "MSB", "OCB", "Eximbank", "SHB"...).
   - TUYỆT ĐỐI KHÔNG ghi chi nhánh (như "CN Tân Bình", "Chi nhánh Ba Đình", "Hội sở", "PGD..."). Chỉ ghi đúng tên ngân hàng cho ngắn gọn.

6. "accountHolder" (Tên Chủ Tài Khoản / Người Thụ Hưởng):
   - Tên cá nhân hoặc công ty đứng tên tài khoản ngân hàng thụ hưởng.
   - Chú ý quan sát kỹ nếu người thụ hưởng là cá nhân (ví dụ: "Nguyễn Văn A", "Trần Thị B"), hãy ghi rõ họ và tên đầy đủ của cá nhân đó.

7. "notes" (Ghi Chú):
   - Ghi chú vắn tắt nếu có thông tin đặc biệt.

Yêu cầu chất lượng:
- Đọc kỹ, chính xác từng ký tự như một người kiểm chứng thực tế, không bịa đặt hoặc suy đoán.
- Trả về JSON đúng cấu trúc.`;

            for (const model of modelsToTry) {
                try {
                    const result = await ai.models.generateContent({
                        model,
                        contents: {
                            parts: [
                                { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
                                { text: cvhcReaderPrompt }
                            ]
                        },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    jobCode: {
                                        type: Type.STRING,
                                        description: "Số Vận đơn, B/L No, Booking No, Mã Job. Nếu nhiều số thì cách nhau bằng dấu phẩy."
                                    },
                                    customerName: {
                                        type: Type.STRING,
                                        description: "Tên công ty hoặc khách hàng đề nghị hoàn cược."
                                    },
                                    amount: {
                                        type: Type.NUMBER,
                                        description: "Số tiền cược đề nghị hoàn trả (số nguyên VNĐ). Ví dụ: 2000000, 5000000; nếu không có thì trả về 0."
                                    },
                                    accountNumber: {
                                        type: Type.STRING,
                                        description: "Số tài khoản ngân hàng thụ hưởng (chỉ chứa các chữ số)."
                                    },
                                    bankName: {
                                        type: Type.STRING,
                                        description: "Tên ngân hàng thụ hưởng ngắn gọn, không ghi chi nhánh (Ví dụ: Vietcombank, Vietinbank, Techcombank, BIDV, Agribank, ACB, MB Bank...)."
                                    },
                                    accountHolder: {
                                        type: Type.STRING,
                                        description: "Tên chủ tài khoản hoặc người thụ hưởng. Nếu là cá nhân thì ghi rõ họ và tên (Ví dụ: NGUYỄN VĂN A)."
                                    },
                                    notes: {
                                        type: Type.STRING,
                                        description: "Ghi chú ngắn về nội dung trang."
                                    }
                                },
                                required: ["jobCode", "customerName", "amount", "accountNumber"]
                            }
                        }
                    });

                    let jsonText = "";
                    try {
                        jsonText = result.text || "{}";
                    } catch (textErr: any) {
                        console.error("Failed to get result.text (safety block?):", textErr);
                        jsonText = "{}";
                    }
                    jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
                    resultData = JSON.parse(jsonText);
                    
                    if (resultData) {
                        // Normalize amount if string
                        if (typeof resultData.amount === 'string') {
                            const num = parseInt(resultData.amount.replace(/[^0-9]/g, ''), 10);
                            resultData.amount = isNaN(num) ? 0 : num;
                        }
                        // Clean account number
                        if (typeof resultData.accountNumber === 'string') {
                            resultData.accountNumber = resultData.accountNumber.replace(/[^0-9]/g, '');
                        }
                    }

                    console.log(`CVHC Reader Success with model ${model}. Data:`, resultData);
                    
                    if (!resultData.jobCode && !resultData.accountNumber && !resultData.customerName && (!resultData.amount || resultData.amount === 0)) {
                        if (model === modelsToTry[modelsToTry.length - 1]) {
                            break; // Last model, accept the empty result
                        }
                        throw new Error("Model returned empty results for all fields. Forcing retry with next model.");
                    }
                    
                    break; // Success!
                } catch (err: any) {
                    lastError = err;
                    // If error is invalid API key or permission denied, break immediately
                    if (err.message?.includes("API_KEY_INVALID") || err.message?.includes("API key not valid") || err.message?.includes("PERMISSION_DENIED")) {
                        break;
                    }
                    // If error is quota/billing related, all models under this API key are affected; break immediately
                    if (err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("429") || err.message?.includes("prepayment") || err.message?.includes("quota")) {
                        break;
                    }
                    console.warn(`CVHC scan failed with model ${model}:`, err.message);
                    // Continue to try the next model
                }
            }

            if (resultData) {
                return res.json({ success: true, data: resultData });
            } else {
                const isKeyInvalid = lastError?.message?.includes("API_KEY_INVALID") || lastError?.message?.includes("API key not valid") || lastError?.message?.includes("PERMISSION_DENIED");
                const isQuotaError = lastError?.message?.includes("RESOURCE_EXHAUSTED") || lastError?.message?.includes("prepayment") || lastError?.message?.includes("429");
                const statusCode = isKeyInvalid ? 401 : (isQuotaError ? 429 : 500);
                return res.status(statusCode).json({
                    success: false,
                    error: isKeyInvalid
                        ? "Gemini API Key đang áp dụng không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại Key tại Google AI Studio."
                        : (isQuotaError 
                            ? "Hạn mức Gemini API (Credits/Quota) của Key này đã hết hoặc bị giới hạn. Vui lòng kiểm tra lại cấu hình hoặc chọn Key khác."
                            : (lastError?.message || "Không thể phân tích tài liệu bằng AI."))
                });
            }
        } catch (err: any) {
            console.error("Error during CVHC scanning on server:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    };

    app.post("/api/cvhc/scan-page", handleCVHCScan);
    app.post("/cvhc/scan-page", handleCVHCScan);

    // Static files
    app.use(["/api/files/invoice", "/files/invoice"], express.static(INVOICE_ROOT));
    app.use(["/api/files/inv", "/files/inv"], express.static(INV_DIR));
    app.use(["/api/files/unc", "/files/unc"], express.static(UNC_DIR));
    app.use(["/api/cvhc", "/cvhc"], express.static(CVHC_ROOT));
    app.use(["/api/sign", "/sign"], express.static(SIGN_DIR));
    app.use(["/api/uploads", "/uploads"], express.static(ROOT_DIR));

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
