const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const REPLACEMENT_1 = `
    function splitAmisData(sourceData: any) {`;
const startCut = content.indexOf(REPLACEMENT_1);
const endCutRegex = /let clients: any\[\] = \[\];\s*app\.get\("\/api\/events"/;
const match = endCutRegex.exec(content);

if (startCut !== -1 && match) {
    const replacement = `    let clients: any[] = [];\n\n    app.get("/api/events"`;
    content = content.substring(0, startCut) + replacement + content.substring(match.index + match[0].length);
}

const memoryLoadStart = content.indexOf('    // Load Initial Data');
const memoryLoadMatch = content.lastIndexOf('    // ======================================================', content.indexOf('app.get("/api/health"'));

if (memoryLoadStart !== -1 && memoryLoadMatch !== -1) {
    const contentToReplace = content.substring(memoryLoadStart, memoryLoadMatch);
    content = content.replace(contentToReplace, `\n`);
}

content = content.replace(/    app\.get\("\/api\/data", \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.get("/api/data", async (req, res) => {
        const data = await loadFullDatabase();
        res.json(data);
    });\n`);

content = content.replace(/    app\.get\("\/api\/export\/long-hoang-jobs", \(req, res\) => {[\s\S]*?res\.json\(\{ success: true, count: result\.length, data: result \}\);\s*\}\);\n/g,
`    app.get("/api/export/long-hoang-jobs", async (req, res) => {
        const data = await loadFullDatabase();
        const jobs = data.jobs || [];
        const lhJobs = jobs.filter((j: any) => 
            j.customerName && (
                j.customerName.toUpperCase().includes('LONG HOANG LOGISTICS') || 
                j.customerName.toUpperCase() === 'LONG HOANG'
            )
        );
        const result = lhJobs.map((j: any) => ({
            monthYear: \`\${j.month}/\${j.year}\`,
            jobCode: j.jobCode || '',
            booking: j.booking || '',
            hbl: j.hbl || '',
            line: j.line || '',
            cont20: j.cont20 || 0,
            cont40: j.cont40 || 0,
            sell: j.sell || 0
        }));
        res.json({ success: true, count: result.length, data: result });
    });\n`);

const endpointSaveRegex = /    app\.post\("\/api\/data\/save", async \(req, res\) => {[\s\S]*?\} else \{\s*res\.json\(\{ success: false, message: "No permission to save" \}\);\s*\}\s*\}\);\n/g;
content = content.replace(endpointSaveRegex, 
`    app.post("/api/data/save", async (req, res) => {
        const { role, ...data } = req.body; 
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
                    dbState.paymentRequests = mergeLists(dbState.paymentRequests || [], safeData.paymentRequests);
                    if (dbState.deletedPaymentIds) {
                        dbState.paymentRequests = (dbState.paymentRequests || []).filter((p:any) => !dbState.deletedPaymentIds.includes(p.id));
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
                    dbState.paymentRequests = mergeLists(dbState.paymentRequests || [], validRequests);
                }
                if (safeData.longHoangOrders) {
                    dbState.longHoangOrders = mergeLists(dbState.longHoangOrders || [], safeData.longHoangOrders);
                }
            }
        });

        broadcast("data-updated", { time: Date.now(), source: role, type: isAdmin ? 'FULL_SYNC' : 'DOCS_SYNC' });
        res.json({ success: true, saved: isAdmin ? "full_merged_admin" : "payment_and_lh", requireReload });
    });\n`);

content = content.replace(/    app\.get\("\/api\/header-data", \(req, res\) => {[\s\S]*?}\);\n/g,
`    app.get("/api/header-data", async (req, res) => {
        const data = await loadFullDatabase();
        res.json({
            messages: data.headerMessages || [],
            notifications: data.headerNotifications || [],
            updates: data.headerUpdates || []
        });
    });\n`);

content = content.replace(/    app\.post\("\/api\/header-data", \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.post("/api/header-data", async (req, res) => {
        const { messages, notifications, updates } = req.body;
        await withDBLock(async (dbState) => {
            if (messages) dbState.headerMessages = messages;
            if (notifications) dbState.headerNotifications = notifications;
            if (updates) dbState.headerUpdates = updates;
        });
        broadcast("header-updated", { time: Date.now() });
        res.json({ success: true });
    });\n`);

content = content.replace(/    app\.get\("\/api\/history\/latest", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.get("/api/history/latest", (req, res) => {
        res.json({ found: false });
    });\n`);

content = content.replace(/    app\.get\("\/api\/nfc", \(req, res\) => res\.json\(nfcMemoryData\)\);\n/g, 
`    app.get("/api/nfc", async (req, res) => {
        const data = await loadFullDatabase();
        res.json(data.nfc || []);
    });\n`);

content = content.replace(/    app\.post\("\/api\/nfc\/save", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.post("/api/nfc/save", async (req, res) => {
        try {
            await withDBLock(async (dbState) => {
                dbState.nfc = req.body;
            });
            res.json({ success: true });
        } catch {
            res.status(500).json({ success: false });
        }
    });\n`);

content = content.replace(/    app\.get\("\/api\/pending", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.get("/api/pending", async (req, res) => {
        try {
            const data = await loadFullDatabase();
            res.json(Array.isArray(data.pending) ? data.pending : []);
        } catch { res.json([]); }
    });\n`);

content = content.replace(/    app\.post\("\/api\/pending", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.post("/api/pending", async (req, res) => {
        const item = { id: Date.now().toString(), time: new Date().toISOString(), data: req.body, status: "pending" };
        await withDBLock(async (dbState) => {
            if(!dbState.pending) dbState.pending = [];
            dbState.pending.push(item);
        });
        res.json({ success: true, id: item.id });
    });\n`);

content = content.replace(/    app\.post\("\/api\/approve", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.post("/api/approve", async (req, res) => {
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
                dbState.paymentRequests = mergeLists(dbState.paymentRequests || [], fullData.paymentRequests);
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
    });\n`);

content = content.replace(/    app\.delete\("\/api\/pending\/:id", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.delete("/api/pending/:id", async (req, res) => {
        await withDBLock(async (dbState) => {
            if(!dbState.pending) dbState.pending = [];
            dbState.pending = dbState.pending.filter((i: any) => i.id !== req.params.id);
        });
        res.json({ success: true });
    });\n`);

content = content.replace(/    app\.post\("\/api\/long-hoang\/backup", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.post("/api/long-hoang/backup", async (req, res) => {
        try {
            const { orders } = req.body;
            await withDBLock(async (dbState) => {
                dbState.longHoangOrders = orders;
            });
            res.json({ success: true, message: "Backup saved successfully" });
        } catch (err: any) {
            res.status(500).json({ success: false, message: err.message });
        }
    });\n`);

content = content.replace(/    app\.get\("\/api\/long-hoang\/restore", async \(req, res\) => {[\s\S]*?}\);\n/g, 
`    app.get("/api/long-hoang/restore", async (req, res) => {
        try {
            const data = await loadFullDatabase();
            if (!data.longHoangOrders) {
                return res.status(404).json({ success: false, message: "Backup not found" });
            }
            res.json({ success: true, orders: data.longHoangOrders });
        } catch (err: any) {
            res.status(500).json({ success: false, message: err.message });
        }
    });\n`);


fs.writeFileSync('server.ts', content, 'utf8');

