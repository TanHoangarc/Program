
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import multer from "multer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, "data");
  const BACKUP_PATH = path.join(STORAGE_PATH, "backups");
  const UPLOAD_PATH = path.join(STORAGE_PATH, "uploads");

  // Ensure directories exist
  [STORAGE_PATH, BACKUP_PATH, UPLOAD_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Multer config for uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
      const fileName = req.body.fileName || `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    }
  });
  const upload = multer({ storage });

  console.log(`Storage path: ${STORAGE_PATH}`);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", storage: STORAGE_PATH });
  });

  // Upload endpoint
  app.post("/api/upload-cvhc", upload.single('file'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      
      res.json({ 
        success: true, 
        cvhcUrl: `/api/files/${req.file.filename}`, 
        fileName: req.file.filename 
      });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Serve uploaded files
  app.get("/api/files/:name", (req, res) => {
    const filePath = path.join(UPLOAD_PATH, req.params.name);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Endpoints for saving data and creating backups
  const saveData = (type: string, data: any) => {
    const fileName = `${type}.json`;
    const filePath = path.join(STORAGE_PATH, fileName);

    // Save primary data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // Immediate Backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `${type}_backup_${timestamp}.json`;
    const backupFilePath = path.join(BACKUP_PATH, backupFileName);
    
    fs.writeFileSync(backupFilePath, JSON.stringify(data, null, 2));

    // Keep only last 10 backups for each type to save space
    const files = fs.readdirSync(BACKUP_PATH)
      .filter(f => f.startsWith(`${type}_backup_`))
      .sort((a, b) => {
          const statA = fs.statSync(path.join(BACKUP_PATH, a));
          const statB = fs.statSync(path.join(BACKUP_PATH, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
      });

    if (files.length > 10) {
      files.slice(10).forEach(f => fs.unlinkSync(path.join(BACKUP_PATH, f)));
    }
    return filePath;
  };

  // Compatibility with existing frontend logic
  app.post("/api/data/save", (req, res) => {
    try {
      saveData("full_data", req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Save failed" });
    }
  });

  app.get("/api/data", (req, res) => {
    const filePath = path.join(STORAGE_PATH, "full_data.json");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.json({});
    }
  });

  app.get("/api/header-data", (req, res) => {
    const filePath = path.join(STORAGE_PATH, "header_data.json");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.json({ messages: [], notifications: [], updates: [] });
    }
  });

  app.post("/api/header-data", (req, res) => {
    try {
      saveData("header_data", req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Save failed" });
    }
  });

  // Simple stub for other endpoints to prevent 404s
  app.get("/api/nfc", (req, res) => res.json([]));
  app.post("/api/nfc/save", (req, res) => {
    saveData("nfc", req.body);
    res.json({ success: true });
  });
  app.get("/api/history/latest", (req, res) => res.json({ found: false }));
  app.get("/api/pending", (req, res) => res.json([]));
  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"status": "connected"}\n\n');
  });

  app.post("/api/sync-data", (req, res) => {
    try {
      const { type, data } = req.body;
      if (!type || !data) {
        return res.status(400).json({ error: "Missing type or data" });
      }
      const filePath = saveData(type, data);
      res.json({ success: true, message: `Data ${type} saved and backed up.`, path: filePath });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/load-data/:type", (req, res) => {
    try {
      const { type } = req.params;
      const filePath = path.join(STORAGE_PATH, `${type}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        res.json(JSON.parse(data));
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to load data" });
    }
  });

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
