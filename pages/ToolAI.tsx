
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, Minimize2, Merge, Image as ImageIcon, Unlock, Edit, 
  Stamp, Upload, Download, Trash2, MoveUp, MoveDown, 
  Plus, Check, X, Loader, ChevronLeft, ChevronRight, MousePointer,
  Crop, Layers, Wand2, RefreshCw, Eraser, Palette, Droplets, Split,
  Files, Pencil, Save, Cloud, FolderOpen, AlertTriangle, HelpCircle,
  ArrowLeft, ShieldCheck, Cpu, MessageSquare, Eraser as EraserIcon,
  ZoomIn, ZoomOut, FileText, Sparkles, CheckCircle, Hand, Move,
  Settings, Grid, Layout, Sun, Monitor, Type, Eye, RotateCw,
  Stamp as StampIcon, ScanLine, RotateCcw, Target, Pipette
} from 'lucide-react';
import { PDFDocument, rgb, degrees, StandardFonts, PageSizes } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsMod from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

// --- CONFIGURATION ---
const BACKEND_URL = "https://api.kimberry.id.vn";

// Fix for pdfjs-dist import structure to ensure compatibility
const pdfjsLib = (pdfjsMod as any).default || pdfjsMod;

// Set worker for PDF rendering using esm.sh for consistency
if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
}

// --- TYPES ---
type ToolType = 'split' | 'compress' | 'merge' | 'images_to_pdf' | 'unlock' | 'stamp' | 'edit_content' | 'extract_stamp' | null;

interface StampItem {
    id: string;
    url: string;
    name: string;
}

interface PdfPageThumbnail {
    pageIndex: number;
    url: string; // Blob URL
    selected: boolean;
    width: number;
    height: number;
}

// --- UTILS ---
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// --- SHARED COMPONENTS ---

const ToolHeader = ({ icon: Icon, title, description, onBack }: { icon: any, title: string, description: string, onBack: () => void }) => (
    <div className="mb-6 border-b border-slate-200 pb-4 flex items-start gap-4">
        <button 
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mt-1"
            title="Quay lại danh sách"
        >
            <ArrowLeft size={24} />
        </button>
        <div>
            <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Icon size={24} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            </div>
            <p className="text-slate-500">{description}</p>
        </div>
    </div>
);

const FileUploader = ({ onFileSelect, accept = ".pdf", multiple = false, label = "Chọn file PDF" }: { onFileSelect: (files: FileList | null) => void, accept?: string, multiple?: boolean, label?: string }) => (
    <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer group text-center flex flex-col items-center justify-center h-full min-h-[300px]">
        <input 
            type="file" 
            accept={accept} 
            multiple={multiple} 
            onChange={(e) => onFileSelect(e.target.files)} 
            className="hidden" 
            id="file-upload-input" 
        />
        <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-indigo-500 border border-slate-100">
                <Upload size={36} />
            </div>
            <span className="text-xl font-bold text-slate-700">{label}</span>
            <span className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Kéo thả file vào đây hoặc nhấn để tải lên từ máy tính</span>
            {multiple && <span className="mt-4 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">Hỗ trợ nhiều file</span>}
        </label>
    </div>
);

// --- 1. PDF VIEWER COMPONENT (Advanced Fit-To-Page Logic) ---
interface PdfViewerProps {
    file: File | Blob | null;
    page: number;
    onPageChange: (newPage: number) => void;
    scale: number;
    setScale: (s: number) => void;
    tool: 'select' | 'pan';
    onSelectionStart?: (x: number, y: number) => void;
    onSelectionMove?: (x: number, y: number) => void;
    onSelectionEnd?: () => void;
    overlayContent?: React.ReactNode;
    canvasRef?: React.RefObject<HTMLCanvasElement>;
    fitToPage?: boolean; // New prop: if true, 1.0 scale = Fit Page
    onBaseScaleChange?: (baseScale: number) => void; // Prop to inform parent of the base ratio
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, page, onPageChange, 
    scale, setScale, tool,
    onSelectionStart, onSelectionMove, onSelectionEnd,
    overlayContent, canvasRef: externalCanvasRef,
    fitToPage = false, onBaseScaleChange
}) => {
    const internalCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = externalCanvasRef || internalCanvasRef;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [baseScale, setBaseScale] = useState(1.0); // The scale factor to make the page fit the container
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!file) return;
        const loadPdf = async () => {
            setLoading(true);
            setPdfDoc(null);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    cMapUrl: 'https://esm.sh/pdfjs-dist@5.4.530/cmaps/',
                    cMapPacked: true,
                });
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                setNumPages(pdf.numPages);
            } catch (err) {
                console.error("Error loading PDF", err);
                setLoading(false);
            }
        };
        loadPdf();
        return () => { if (renderTaskRef.current) renderTaskRef.current.cancel(); };
    }, [file]);

    // Calculate Base Scale (Fit Scale) when doc/page changes or container resizes
    useEffect(() => {
        if (!pdfDoc || !fitToPage || !scrollContainerRef.current) {
            setBaseScale(1.0);
            if(onBaseScaleChange) onBaseScaleChange(1.0);
            return;
        }

        const calculateBaseScale = async () => {
            try {
                const pageProxy = await pdfDoc.getPage(page);
                const viewport = pageProxy.getViewport({ scale: 1.0 });
                const container = scrollContainerRef.current;
                
                if (container) {
                    const padding = 60; // Padding for aesthetics
                    const widthRatio = (container.clientWidth - padding) / viewport.width;
                    const heightRatio = (container.clientHeight - padding) / viewport.height;
                    const newBaseScale = Math.min(widthRatio, heightRatio); // Scale to fit entirely
                    
                    setBaseScale(newBaseScale);
                    if(onBaseScaleChange) onBaseScaleChange(newBaseScale);
                }
            } catch (e) {
                console.error("Error calc scale", e);
            }
        };

        calculateBaseScale();
        
        // Add ResizeObserver to auto-adjust when window resizes
        const resizeObserver = new ResizeObserver(() => calculateBaseScale());
        resizeObserver.observe(scrollContainerRef.current);
        return () => resizeObserver.disconnect();

    }, [pdfDoc, page, fitToPage]);

    useEffect(() => {
        if (pdfDoc) renderPage(pdfDoc, page, scale * baseScale);
    }, [pdfDoc, page, scale, baseScale]);

    const renderPage = async (pdf: any, pageNum: number, effectiveScale: number) => {
        if (renderTaskRef.current) {
            await renderTaskRef.current.cancel();
        }
        setLoading(true);
        try {
            const page = await pdf.getPage(pageNum);
            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: effectiveScale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            
            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            
            await renderTask.promise;
            setLoading(false);
        } catch (error: any) {
             if (error?.name !== 'RenderingCancelledException') {
                 console.error("Render error", error);
                 setLoading(false);
             }
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (tool === 'pan') {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else if (tool === 'select' && onSelectionStart && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            onSelectionStart(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tool === 'pan' && isPanning && scrollContainerRef.current) {
            e.preventDefault();
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            scrollContainerRef.current.scrollLeft -= dx;
            scrollContainerRef.current.scrollTop -= dy;
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else if (tool === 'select' && onSelectionMove && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            onSelectionMove(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    const handleMouseUp = () => {
        if (isPanning) setIsPanning(false);
        if (tool === 'select' && onSelectionEnd) onSelectionEnd();
    };

    if (!file) return null;

    return (
        <div className="flex flex-col items-center h-full w-full relative bg-slate-200/50 rounded-xl overflow-hidden border border-slate-200">
            {/* Control Bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full px-4 py-1.5 flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="p-1.5 hover:bg-slate-100 rounded-full disabled:opacity-30 transition-colors"><ChevronLeft size={16}/></button>
                    <span className="font-mono text-sm font-bold min-w-[50px] text-center">{page} / {numPages}</span>
                    <button disabled={page >= numPages} onClick={() => onPageChange(page + 1)} className="p-1.5 hover:bg-slate-100 rounded-full disabled:opacity-30 transition-colors"><ChevronRight size={16}/></button>
                </div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setScale(Math.max(0.5, scale - 0.25))} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ZoomOut size={16}/></button>
                    <span className="text-xs font-bold w-10 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(Math.min(4.0, scale + 0.25))} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><ZoomIn size={16}/></button>
                </div>
            </div>

            {/* SCROLL CONTAINER WITH FLEX CENTER + MARGIN AUTO FIX */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 w-full h-full overflow-auto custom-scrollbar relative flex"
                style={{ cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair' }}
            >
                {/* 
                    CONTENT WRAPPER with m-auto
                    This ensures the canvas is centered when smaller than viewport (flex default),
                    but correctly expands (top-left aligned via m-auto) when larger, allowing native scrolling.
                */}
                <div 
                    className="relative bg-white shadow-2xl m-auto"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                            <Loader className="animate-spin text-indigo-600" size={32} />
                        </div>
                    )}
                    <canvas ref={canvasRef} className="block" />
                    {overlayContent}
                </div>
            </div>
        </div>
    );
};

// --- 2. SPLIT TOOL ---
const SplitTool = ({ onBack }: { onBack: () => void }) => {
    // ... (No changes here)
    const [file, setFile] = useState<File | null>(null);
    const [thumbnails, setThumbnails] = useState<PdfPageThumbnail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const handleFileSelect = async (files: FileList | null) => {
        if (!files || !files[0]) return;
        const f = files[0];
        setFile(f);
        setThumbnails([]); 
        setIsLoading(true);
        try {
            const ab = await f.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ 
                data: ab, 
                cMapUrl: 'https://esm.sh/pdfjs-dist@5.4.530/cmaps/', 
                cMapPacked: true 
            }).promise;
            const thumbs: PdfPageThumbnail[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.3 }); 
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
                thumbs.push({ pageIndex: i - 1, url: canvas.toDataURL(), selected: true, width: viewport.width, height: viewport.height });
            }
            setThumbnails(thumbs);
        } catch (e) { console.error(e); alert("Lỗi đọc file PDF."); } finally { setIsLoading(false); }
    };
    const togglePage = (idx: number) => { setThumbnails(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t)); };
    const handleSplit = async () => {
        if (!file) return;
        setIsLoading(true);
        try {
            const ab = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
            const zip = new JSZip();
            const selectedIndices = thumbnails.filter(t => t.selected).map(t => t.pageIndex);
            for (const idx of selectedIndices) {
                const newDoc = await PDFDocument.create();
                const [copiedPage] = await newDoc.copyPages(pdfDoc, [idx]);
                newDoc.addPage(copiedPage);
                const pdfBytes = await newDoc.save();
                zip.file(`page_${idx + 1}.pdf`, pdfBytes);
            }
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `split_${file.name.replace('.pdf', '')}.zip`;
            link.click();
        } catch (e) { alert("Lỗi tách file: " + e); } finally { setIsLoading(false); }
    };
    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={Split} title="Tách PDF" description="Chọn các trang cần giữ lại và tách chúng thành các file riêng lẻ hoặc file mới." onBack={onBack} />
            {!file ? (<div className="flex-1 flex flex-col justify-center pb-20"><FileUploader onFileSelect={handleFileSelect} /></div>) : (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
                        <div className="flex items-center gap-3"><span className="text-sm font-bold text-slate-700">{file.name}</span><span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">{thumbnails.length} trang</span></div>
                        <div className="flex gap-2">
                            <button onClick={() => setThumbnails(prev => prev.map(t => ({...t, selected: true})))} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors">Chọn tất cả</button>
                            <button onClick={() => setThumbnails(prev => prev.map(t => ({...t, selected: false})))} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition-colors">Bỏ chọn</button>
                            <button onClick={() => {setFile(null); setThumbnails([])}} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center"><Trash2 size={12} className="mr-1"/> Hủy</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 rounded-xl border border-slate-200 mb-4 custom-scrollbar">
                        {isLoading && thumbnails.length === 0 ? (<div className="flex h-full items-center justify-center flex-col"><Loader className="animate-spin text-indigo-500 mb-2" size={32}/><span className="text-sm text-slate-500 font-medium">Đang xử lý trang...</span></div>) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                {thumbnails.map((thumb, idx) => (
                                    <div key={idx} onClick={() => togglePage(idx)} className={`relative cursor-pointer rounded-lg overflow-hidden group transition-all duration-200 select-none ${thumb.selected ? 'ring-2 ring-indigo-500 shadow-lg scale-95' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                                        <div className="aspect-[3/4] bg-white flex items-center justify-center relative"><img src={thumb.url} className="max-w-full max-h-full object-contain shadow-sm" loading="lazy" />{thumb.selected && (<div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center"><div className="bg-indigo-600 text-white rounded-full p-1 shadow-sm"><Check size={16} strokeWidth={3} /></div></div>)}</div>
                                        <div className={`absolute bottom-0 inset-x-0 text-center text-[10px] font-bold py-1 ${thumb.selected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>Trang {idx + 1}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="shrink-0 pt-2"><button onClick={handleSplit} disabled={!thumbnails.some(t => t.selected) || isLoading} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg transition-all transform active:scale-95">{isLoading ? <Loader className="animate-spin"/> : <Download />} Tách & Tải Xuống (ZIP)</button></div>
                </div>
            )}
        </div>
    );
};

// --- 3. MERGE TOOL ---
const MergeTool = ({ onBack }: { onBack: () => void }) => {
    // ... (No changes here)
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const handleFiles = (fileList: FileList | null) => { if (fileList) setFiles(prev => [...prev, ...Array.from(fileList)]); };
    const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));
    const moveFile = (idx: number, dir: -1 | 1) => { const newFiles = [...files]; const temp = newFiles[idx]; newFiles[idx] = newFiles[idx + dir]; newFiles[idx + dir] = temp; setFiles(newFiles); };
    const handleMerge = async () => {
        setIsProcessing(true);
        try {
            const mergedPdf = await PDFDocument.create();
            for (const file of files) { const ab = await file.arrayBuffer(); const pdf = await PDFDocument.load(ab, { ignoreEncryption: true }); const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices()); copiedPages.forEach(p => mergedPdf.addPage(p)); }
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `merged_${Date.now()}.pdf`; link.click();
        } catch (e) { alert("Lỗi ghép file: " + e); } finally { setIsProcessing(false); }
    };
    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={Merge} title="Ghép PDF" description="Kết hợp nhiều file PDF thành một tài liệu duy nhất theo thứ tự mong muốn." onBack={onBack} />
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
                    <div className="h-full flex flex-col"><FileUploader onFileSelect={handleFiles} multiple={true} label="Thêm file PDF" /></div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-hidden flex flex-col shadow-sm">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100"><h3 className="font-bold text-slate-700 flex items-center"><Layers className="w-4 h-4 mr-2 text-indigo-500"/> Danh sách file ({files.length})</h3>{files.length > 0 && <button onClick={() => setFiles([])} className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded font-medium">Xóa tất cả</button>}</div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">{files.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-400 italic"><FileText size={48} className="mb-2 opacity-20"/><p className="text-sm">Chưa có file nào được chọn</p></div>) : (files.map((file, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-indigo-200 transition-all group hover:shadow-sm"><div className="flex items-center gap-3 overflow-hidden"><div className="bg-red-100 p-2 rounded-lg text-red-600 font-bold text-xs shadow-sm w-8 h-8 flex items-center justify-center">{idx + 1}</div><div className="flex flex-col overflow-hidden"><span className="text-sm font-medium text-slate-700 truncate" title={file.name}>{file.name}</span><span className="text-[10px] text-slate-400">{formatBytes(file.size)}</span></div></div><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button disabled={idx === 0} onClick={() => moveFile(idx, -1)} className="p-1.5 hover:bg-white rounded-lg disabled:opacity-30 text-slate-500 hover:text-indigo-600 hover:shadow-sm"><MoveUp size={14}/></button><button disabled={idx === files.length - 1} onClick={() => moveFile(idx, 1)} className="p-1.5 hover:bg-white rounded-lg disabled:opacity-30 text-slate-500 hover:text-indigo-600 hover:shadow-sm"><MoveDown size={14}/></button><div className="w-px h-4 bg-slate-300 mx-1"></div><button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button></div></div>)))}</div>
                        <div className="mt-4 pt-4 border-t border-slate-100"><button onClick={handleMerge} disabled={files.length < 2 || isProcessing} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-95">{isProcessing ? <Loader className="animate-spin"/> : <Merge />} Ghép {files.length} Files</button></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 4. IMAGES TO PDF TOOL ---
const ImagesToPdfTool = ({ onBack }: { onBack: () => void }) => {
    // ... (No changes here)
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pageSize, setPageSize] = useState<'A4' | 'Fit'>('A4');
    const [orientation, setOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
    const [margin, setMargin] = useState(20);
    const handleFiles = (fileList: FileList | null) => { if (fileList) setFiles(prev => [...prev, ...Array.from(fileList)]); };
    const handleConvert = async () => {
        if(files.length === 0) return;
        setIsProcessing(true);
        try {
            const pdfDoc = await PDFDocument.create();
            for (const file of files) {
                const buffer = await file.arrayBuffer();
                let img;
                try { if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg')) img = await pdfDoc.embedJpg(buffer); else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) img = await pdfDoc.embedPng(buffer); else continue; } catch { continue; }
                let page;
                if (pageSize === 'A4') {
                    const dims = orientation === 'Portrait' ? [595.28, 841.89] : [841.89, 595.28];
                    page = pdfDoc.addPage([dims[0], dims[1]]); 
                    const maxWidth = dims[0] - (margin * 2);
                    const maxHeight = dims[1] - (margin * 2);
                    const { width, height } = img.scaleToFit(maxWidth, maxHeight);
                    page.drawImage(img, { x: (dims[0] - width) / 2, y: (dims[1] - height) / 2, width, height });
                } else {
                    page = pdfDoc.addPage([img.width + (margin*2), img.height + (margin*2)]);
                    page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
                }
            }
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `images_converted_${Date.now()}.pdf`; link.click();
        } catch (e) { alert("Lỗi chuyển đổi: " + e); } finally { setIsProcessing(false); }
    };
    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={ImageIcon} title="Ảnh sang PDF" description="Chuyển đổi hình ảnh (JPG, PNG) thành tài liệu PDF chất lượng cao." onBack={onBack} />
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                <div className="flex-1 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 overflow-y-auto custom-scrollbar relative">{files.length === 0 ? (<label className="flex flex-col items-center justify-center h-full cursor-pointer absolute inset-0"><input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} /><div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-indigo-400"><ImageIcon size={32}/></div><span className="text-slate-500 font-bold text-lg">Nhấn để chọn ảnh</span><span className="text-slate-400 text-xs mt-1">Hỗ trợ JPG, PNG</span></label>) : (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{files.map((f, i) => (<div key={i} className="relative aspect-[3/4] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group"><img src={URL.createObjectURL(f)} className="w-full h-full object-cover" /><div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="bg-red-500 text-white p-1.5 rounded-lg shadow-md hover:bg-red-600 transition-colors"><X size={14}/></button></div><div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur text-slate-700 text-[10px] p-2 truncate font-medium border-t border-slate-100">{f.name}</div></div>))}<label className="flex flex-col items-center justify-center aspect-[3/4] bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors"><input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} /><Plus size={32} className="text-slate-400"/><span className="text-xs font-bold text-slate-500 mt-2">Thêm ảnh</span></label></div>)}</div>
                <div className="w-full md:w-80 bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-6 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center"><Settings className="w-5 h-5 mr-2 text-slate-500"/> Cấu hình</h3>
                    <div><label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wide">Khổ giấy</label><div className="grid grid-cols-2 gap-2"><button onClick={() => setPageSize('A4')} className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${pageSize === 'A4' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>A4</button><button onClick={() => setPageSize('Fit')} className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${pageSize === 'Fit' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>Vừa Ảnh</button></div></div>
                    {pageSize === 'A4' && (<div className="animate-in fade-in slide-in-from-top-2"><label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wide">Hướng giấy</label><div className="grid grid-cols-2 gap-2"><button onClick={() => setOrientation('Portrait')} className={`py-2.5 rounded-lg text-sm font-bold border transition-all flex items-center justify-center ${orientation === 'Portrait' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}><Layout className="w-4 h-4 mr-2 rotate-0"/> Dọc</button><button onClick={() => setOrientation('Landscape')} className={`py-2.5 rounded-lg text-sm font-bold border transition-all flex items-center justify-center ${orientation === 'Landscape' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}><Layout className="w-4 h-4 mr-2 rotate-90"/> Ngang</button></div></div>)}
                    <div><div className="flex justify-between mb-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lề trang</label><span className="text-xs font-bold text-indigo-600">{margin}px</span></div><input type="range" min="0" max="100" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"/></div>
                    <div className="pt-4 border-t border-slate-100 mt-auto"><button onClick={handleConvert} disabled={files.length === 0 || isProcessing} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-95">{isProcessing ? <Loader className="animate-spin"/> : <RefreshCw />} Chuyển đổi PDF</button></div>
                </div>
            </div>
        </div>
    );
};

// --- 5. STAMP TOOL (RESTORED & UPDATED FOR FIT-TO-PAGE) ---
const StampTool = ({ stamps, setStamps, fetchStamps, onBack }: { stamps: StampItem[], setStamps: any, fetchStamps: () => void, onBack: () => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
    const [stampScale, setStampScale] = useState(0.5);
    const [opacity, setOpacity] = useState(0.9);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [baseScale, setBaseScale] = useState(1.0); // For correct overlay positioning
    
    // Upload stamp ref
    const stampInputRef = useRef<HTMLInputElement>(null);

    const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folderPath", "Stamps");
            try {
                await axios.post(`${BACKEND_URL}/upload-file`, formData);
                fetchStamps();
            } catch (err) {
                alert("Lỗi upload con dấu");
            }
        }
    };

    const applyStamp = async () => {
        if (!file || !selectedStamp) return;
        setIsProcessing(true);
        try {
            const ab = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
            
            // Get stamp image
            const stampUrl = stamps.find(s => s.id === selectedStamp)?.url;
            if (!stampUrl) throw new Error("Stamp not found");
            
            // Fetch blob from stamp URL to embed
            const stampRes = await fetch(stampUrl);
            const stampBlob = await stampRes.blob();
            const stampArrayBuffer = await stampBlob.arrayBuffer();
            
            // Try PNG then JPG
            let stampImage;
            try {
                stampImage = await pdfDoc.embedPng(stampArrayBuffer);
            } catch {
                stampImage = await pdfDoc.embedJpg(stampArrayBuffer);
            }
            
            const pages = pdfDoc.getPages();
            const currentPage = pages[page - 1]; // 0-based
            const { height } = currentPage.getSize();
            
            const dims = stampImage.scale(stampScale);
            
            // Calculate PDF coordinates (Bottom-Left origin)
            currentPage.drawImage(stampImage, {
                x: position.x,
                y: height - position.y - dims.height, // Flip Y axis
                width: dims.width,
                height: dims.height,
                opacity: opacity,
                rotate: degrees(rotation),
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `stamped_${file.name}`;
            link.click();
        } catch (e: any) {
            console.error(e);
            alert("Lỗi đóng dấu: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteStamp = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if(!window.confirm("Xóa con dấu này?")) return;
        try {
            // Mock delete on UI side, implement actual delete if backend supports
            setStamps((prev: any) => prev.filter((s:any) => s.id !== id));
        } catch {}
    };

    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={Stamp} title="Đóng Dấu PDF" description="Chèn con dấu, logo hoặc chữ ký vào file PDF. Hỗ trợ điều chỉnh độ mờ và xoay." onBack={onBack} />
            
            {!file ? (
                <FileUploader onFileSelect={(files) => files && setFile(files[0])} />
            ) : (
                <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
                    <div className="flex-1 bg-slate-200/50 rounded-xl overflow-hidden flex flex-col border border-slate-200 relative">
                        <PdfViewer 
                            file={file} page={page} onPageChange={setPage}
                            scale={scale} setScale={setScale} tool="pan"
                            fitToPage={true} // Enable fit to page for easier viewing
                            onBaseScaleChange={setBaseScale} // Capture base scale to adjust overlay position
                            overlayContent={
                                selectedStamp && (
                                    <div 
                                        className="absolute border-2 border-dashed border-blue-500 cursor-move z-20 hover:border-blue-700 transition-colors"
                                        style={{ 
                                            // Adjusted position based on effective scale
                                            left: position.x * scale * baseScale, 
                                            top: position.y * scale * baseScale, 
                                            width: 150 * stampScale * scale * baseScale, 
                                            height: 150 * stampScale * scale * baseScale,
                                            opacity: opacity,
                                            transform: `rotate(${rotation}deg)`
                                        }}
                                    >
                                        <img 
                                            src={stamps.find(s => s.id === selectedStamp)?.url} 
                                            className="w-full h-full object-contain pointer-events-none"
                                        />
                                        <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                                            Preview
                                        </div>
                                    </div>
                                )
                            }
                        />
                    </div>

                    <div className="w-full lg:w-80 bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-5 overflow-y-auto shadow-sm shrink-0">
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center justify-between">
                                <span>Thư Viện Dấu</span>
                                <button onClick={() => stampInputRef.current?.click()} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-2 py-1 rounded">+ Thêm</button>
                            </h3>
                            <input type="file" className="hidden" ref={stampInputRef} onChange={handleStampUpload} accept="image/*" />
                            
                            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                                {stamps.map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => setSelectedStamp(s.id)}
                                        className={`aspect-square border rounded-lg p-1 cursor-pointer flex items-center justify-center relative group bg-white ${selectedStamp === s.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        <img src={s.url} className="max-w-full max-h-full object-contain" />
                                        <button 
                                            onClick={(e) => handleDeleteStamp(e, s.id, s.name)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={10}/>
                                        </button>
                                    </div>
                                ))}
                                {stamps.length === 0 && <div className="col-span-3 text-center text-xs text-slate-400 py-4 italic">Chưa có con dấu</div>}
                            </div>
                        </div>

                        {selectedStamp && (
                            <div className="space-y-4 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-right-4">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500">Độ mờ</label><span className="text-xs font-bold text-indigo-600">{Math.round(opacity * 100)}%</span></div>
                                    <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-100 rounded"/>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500">Kích thước</label><span className="text-xs font-bold text-indigo-600">{Math.round(stampScale * 100)}%</span></div>
                                    <input type="range" min="0.1" max="2" step="0.1" value={stampScale} onChange={(e) => setStampScale(Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-100 rounded"/>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500">Xoay</label><span className="text-xs font-bold text-indigo-600">{rotation}°</span></div>
                                    <div className="flex items-center gap-2">
                                        <RotateCw size={14} className="text-slate-400"/>
                                        <input type="range" min="0" max="360" step="90" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-100 rounded"/>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Vị trí X</label><input type="number" value={position.x} onChange={e => setPosition({...position, x: Number(e.target.value)})} className="w-full border rounded p-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Vị trí Y</label><input type="number" value={position.y} onChange={e => setPosition({...position, y: Number(e.target.value)})} className="w-full border rounded p-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                                </div>
                            </div>
                        )}

                        <div className="mt-auto">
                            <button onClick={applyStamp} disabled={!selectedStamp || isProcessing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                                {isProcessing ? <Loader className="animate-spin" /> : <Stamp size={18} />}
                                Đóng Dấu PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 6. UNLOCK & COMPRESS (Simplified for UI consistency) ---
const FeaturePlaceholderTool = ({ title, icon: Icon, desc, onBack }: { title: string, icon: any, desc: string, onBack: () => void }) => {
    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={Icon} title={title} description={desc} onBack={onBack} />
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="bg-slate-50 p-8 rounded-full mb-6 ring-8 ring-slate-50/50"><Icon size={64} className="text-slate-300" strokeWidth={1.5} /></div>
                <h2 className="text-3xl font-bold text-slate-700 mb-3">{title}</h2>
                <p className="text-slate-500 max-w-md mb-8 text-lg">{desc}</p>
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200 flex items-center gap-3 max-w-md text-left"><AlertTriangle className="w-6 h-6 flex-shrink-0" /><span className="text-sm font-medium">Tính năng này đang được phát triển và sẽ sớm ra mắt trong bản cập nhật tiếp theo.</span></div>
            </div>
        </div>
    )
}

// --- 7. EXTRACT STAMP TOOL (AI POWERED) ---
const ExtractStampTool = ({ onBack, fetchStamps }: { onBack: () => void, fetchStamps: () => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.0); // Reset to 1.0 default (Will be scaled by FitToPage)
    const [selection, setSelection] = useState<{x:number, y:number, w:number, h:number} | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const startPos = useRef<{x:number, y:number} | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [extractedImage, setExtractedImage] = useState<string | null>(null);
    const [stampName, setStampName] = useState('');

    const onFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            setFile(files[0]);
            setSelection(null);
            setExtractedImage(null);
            setPage(1);
        }
    };

    const handleSelectionStart = (x: number, y: number) => {
        setIsSelecting(true);
        startPos.current = { x, y };
        setSelection({ x, y, w: 0, h: 0 });
    };

    const handleSelectionMove = (x: number, y: number) => {
        if (!isSelecting || !startPos.current) return;
        const boxX = Math.min(startPos.current.x, x);
        const boxY = Math.min(startPos.current.y, y);
        const boxW = Math.abs(x - startPos.current.x);
        const boxH = Math.abs(y - startPos.current.y);
        setSelection({ x: boxX, y: boxY, w: boxW, h: boxH });
    };

    const handleSelectionEnd = () => {
        setIsSelecting(false);
        startPos.current = null;
    };

    const handleExtract = async () => {
        if (!selection || !canvasRef.current || !file) return;
        if (selection.w < 20 || selection.h < 20) return alert("Vùng chọn quá nhỏ.");

        setIsProcessing(true);
        setStatusMsg("Đang chuẩn bị ảnh...");

        try {
            // Crop Image
            const scaleMultiplier = 2; // High res for better extraction
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = selection.w * scaleMultiplier;
            tempCanvas.height = selection.h * scaleMultiplier;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error("Canvas Error");
            
            tempCtx.drawImage(canvasRef.current, selection.x, selection.y, selection.w, selection.h, 0, 0, tempCanvas.width, tempCanvas.height);
            const base64Image = tempCanvas.toDataURL('image/png').split(',')[1];

            setStatusMsg("AI đang phân tích & tách nền...");
            
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("Chưa cấu hình API Key");

            const ai = new GoogleGenAI({ apiKey });
            
            // PROMPT UPDATED: ASK FOR SIGNATURE AND STAMP
            const prompt = `You are an expert image processor.
            Task: Extract the official stamp (red/blue) AND any handwritten signatures (black/blue ink) from this image.
            1. Identify the stamp and any overlapping or nearby handwritten signatures.
            2. Remove the paper background (texture, noise, white/grey areas).
            3. Keep the stamp ink and signature ink clearly visible.
            4. Return the result as a transparent PNG image.`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: { parts: [{ inlineData: { mimeType: "image/png", data: base64Image } }, { text: prompt }] }
            });

            let aiImageBase64: string | null = null;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData?.data) {
                        aiImageBase64 = part.inlineData.data;
                        break;
                    }
                }
            }

            if (!aiImageBase64) throw new Error("AI không trả về hình ảnh.");
            
            setExtractedImage(`data:image/png;base64,${aiImageBase64}`);
            setStatusMsg("");

        } catch (err: any) {
            console.error(err);
            alert("Lỗi: " + (err.message || "Unknown"));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToLibrary = async () => {
        if (!extractedImage || !stampName.trim()) return alert("Vui lòng nhập tên con dấu!");
        
        try {
            // Convert base64 to File
            const res = await fetch(extractedImage);
            const blob = await res.blob();
            const safeName = stampName.replace(/[^a-zA-Z0-9-_]/g, '');
            const fileName = `STAMP_${safeName}_${Date.now()}.png`;
            const fileObj = new File([blob], fileName, { type: 'image/png' });

            const formData = new FormData();
            formData.append("file", fileObj);
            formData.append("folderPath", "Stamps");

            await axios.post(`${BACKEND_URL}/upload-file`, formData);
            fetchStamps(); // Refresh main list
            alert("Đã lưu con dấu vào thư viện thành công!");
            setExtractedImage(null); // Reset
            setStampName("");
            setSelection(null);

        } catch (err) {
            console.error(err);
            alert("Lỗi lưu con dấu.");
        }
    };

    return (
        <div className="h-full flex flex-col">
            <ToolHeader icon={ScanLine} title="Tách Con Dấu (AI)" description="Dùng AI để tách lấy con dấu từ văn bản scan, loại bỏ nền và chữ đè." onBack={onBack} />
            
            {!file ? (
                <FileUploader onFileSelect={onFileChange} label="Tải lên tài liệu chứa con dấu" />
            ) : (
                <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
                    <div className="flex-1 bg-slate-200/50 rounded-xl overflow-hidden flex flex-col border border-slate-200 relative">
                        <PdfViewer 
                            file={file} page={page} onPageChange={setPage} scale={scale} setScale={setScale} tool="select"
                            onSelectionStart={handleSelectionStart} onSelectionMove={handleSelectionMove} onSelectionEnd={handleSelectionEnd}
                            canvasRef={canvasRef}
                            fitToPage={true} // Enabled Fit-To-Page
                            overlayContent={selection && (
                                <div className="absolute border-2 border-dashed border-red-500 bg-red-500/20 pointer-events-none z-10 box-border" style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}>
                                    <div className="absolute -top-7 left-0 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg font-bold flex items-center whitespace-nowrap">Vùng Cắt</div>
                                </div>
                            )}
                        />
                    </div>

                    <div className="w-full lg:w-80 bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-5 overflow-y-auto shadow-sm shrink-0">
                        <div>
                            <h3 className="font-bold text-slate-800 mb-2">Kết quả Tách</h3>
                            <div className="aspect-square bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
                                {isProcessing ? (
                                    <div className="flex flex-col items-center">
                                        <Loader className="animate-spin text-indigo-600 mb-2" size={32} />
                                        <span className="text-xs text-slate-500 font-medium text-center px-4">{statusMsg}</span>
                                    </div>
                                ) : extractedImage ? (
                                    <img src={extractedImage} className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-slate-400 text-xs text-center px-4">Chọn vùng chứa con dấu và nhấn "Tách Dấu"</span>
                                )}
                            </div>
                        </div>

                        {extractedImage && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Tên con dấu</label>
                                    <input 
                                        type="text" 
                                        value={stampName} 
                                        onChange={(e) => setStampName(e.target.value)} 
                                        placeholder="VD: Mộc tròn công ty ABC"
                                        className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <button onClick={handleSaveToLibrary} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={16} /> Lưu vào Thư Viện
                                </button>
                            </div>
                        )}

                        <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                            <button onClick={handleExtract} disabled={!selection || isProcessing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                                <Sparkles size={18} /> Tách Dấu (AI)
                            </button>
                            <button onClick={() => {setFile(null); setExtractedImage(null); setSelection(null)}} className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-bold">
                                Chọn file khác
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 8. EDIT CONTENT TOOL (The Original Powerful One) ---
const EditContentTool = ({ onBack }: { onBack: () => void }) => {
    // ... (No logic change needed, just enabling fitToPage)
    const [file, setFile] = useState<File | null>(null);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.0); // Default scale 100%
    const [tool, setTool] = useState<'select' | 'pan'>('select');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [useAI, setUseAI] = useState(true);
    const [replacementText, setReplacementText] = useState('');
    const [selection, setSelection] = useState<{x:number, y:number, w:number, h:number} | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const startPos = useRef<{x:number, y:number} | null>(null);
    const [modifiedPdf, setModifiedPdf] = useState<Blob | null>(null);
    const [previewFile, setPreviewFile] = useState<File | Blob | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [history, setHistory] = useState<Blob[]>([]);
    const [selectionMode, setSelectionMode] = useState<'target' | 'sample'>('target'); 
    const [sampleSelection, setSampleSelection] = useState<{x:number, y:number, w:number, h:number} | null>(null);

    const onFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            const f = files[0];
            setFile(f);
            setPreviewFile(f);
            setModifiedPdf(null);
            setSelection(null);
            setSampleSelection(null);
            setPage(1);
            setHistory([]);
        }
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setModifiedPdf(prev);
        setPreviewFile(prev);
        setHistory(prevHist => prevHist.slice(0, -1));
        setSelection(null);
    };

    const handleSelectionStart = (x: number, y: number) => {
        if (tool !== 'select') return;
        setIsSelecting(true);
        startPos.current = { x, y };
        
        if (selectionMode === 'target') {
            setSelection({ x, y, w: 0, h: 0 });
        } else {
            setSampleSelection({ x, y, w: 0, h: 0 });
        }
    };

    const handleSelectionMove = (x: number, y: number) => {
        if (!isSelecting || !startPos.current) return;
        const boxX = Math.min(startPos.current.x, x);
        const boxY = Math.min(startPos.current.y, y);
        const boxW = Math.abs(x - startPos.current.x);
        const boxH = Math.abs(y - startPos.current.y);
        
        if (selectionMode === 'target') {
            setSelection({ x: boxX, y: boxY, w: boxW, h: boxH });
        } else {
            setSampleSelection({ x: boxX, y: boxY, w: boxW, h: boxH });
        }
    };

    const handleSelectionEnd = () => {
        setIsSelecting(false);
        startPos.current = null;
        if (selectionMode === 'sample') {
            setSelectionMode('target');
        }
    };

    const applyEdit = async () => {
        if (!selection || !canvasRef.current || !file) return;
        if (selection.w < 5 || selection.h < 5) return alert("Vùng chọn quá nhỏ.");

        setHistory(prev => [...prev, modifiedPdf || file]);

        setIsProcessing(true);
        setStatusMsg("Chuẩn bị dữ liệu...");

        try {
            const arrayBuffer = await (modifiedPdf || file).arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            const currentPage = pdfDoc.getPages()[page - 1];
            const { width: pdfPageWidth, height: pdfPageHeight } = currentPage.getSize();
            const canvas = canvasRef.current;
            const pdfScaleFactor = pdfPageWidth / canvas.width;
            
            const pdfX = selection.x * pdfScaleFactor;
            const pdfW = selection.w * pdfScaleFactor;
            const pdfH = selection.h * pdfScaleFactor;
            const pdfY = pdfPageHeight - ((selection.y + selection.h) * pdfScaleFactor);

            if (useAI) {
                const scaleMultiplier = 3; 
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = selection.w * scaleMultiplier;
                targetCanvas.height = selection.h * scaleMultiplier;
                const targetCtx = targetCanvas.getContext('2d');
                if (!targetCtx) throw new Error("Canvas Error");
                
                targetCtx.drawImage(canvas, selection.x, selection.y, selection.w, selection.h, 0, 0, targetCanvas.width, targetCanvas.height);
                const base64Target = targetCanvas.toDataURL('image/png').split(',')[1];

                const promptParts: any[] = [];
                promptParts.push({ inlineData: { mimeType: "image/png", data: base64Target } });

                let promptText = "";

                if (sampleSelection && sampleSelection.w > 5) {
                    const sampleCanvas = document.createElement('canvas');
                    sampleCanvas.width = sampleSelection.w * scaleMultiplier;
                    sampleCanvas.height = sampleSelection.h * scaleMultiplier;
                    const sampleCtx = sampleCanvas.getContext('2d');
                    if(sampleCtx) {
                        sampleCtx.drawImage(canvas, sampleSelection.x, sampleSelection.y, sampleSelection.w, sampleSelection.h, 0, 0, sampleCanvas.width, sampleCanvas.height);
                        const base64Sample = sampleCanvas.toDataURL('image/png').split(',')[1];
                        promptParts.push({ inlineData: { mimeType: "image/png", data: base64Sample } });
                        
                        promptText = replacementText 
                            ? `CONTEXT: You are a Forensic Document Expert.
                               INPUTS:
                               - Image 1: Target area (Canvas to edit).
                               - Image 2: Style Reference (Source of Truth for Font & Texture).

                               TASK: Erase the text in Image 1 and replace it with "${replacementText}".

                               CRITICAL INSTRUCTION ON SCALING:
                               - **IGNORE DIMENSION MISMATCH**: The size of Image 2 is unrelated to Image 1. Do NOT scale the text to fit the box ratio.
                               - **ABSOLUTE CLONING**: Extract the EXACT font size (in pixels), font weight, and font style from Image 2 and apply it directly to Image 1.
                               - Do NOT resize the font. If the text in Image 2 is small, the new text must be small.

                               STRICT VISUAL EXECUTION:
                               1. **BACKGROUND TEXTURE**: 
                                  - Analyze the "salt & pepper" noise, compression artifacts, and paper grain in Image 2.
                                  - Synthesize a **new** background for Image 1 that fills the erased area with this EXACT texture pattern.
                                  - **NO SOLID COLORS**. The background must look like a noisy, scanned raster image.
                               
                               2. **INK & RENDER SIMULATION**:
                                  - **Blur/Softness**: Analyze the edge blur (anti-aliasing radius) in Image 2. The new text must be exactly as blurry/soft. Do NOT generate sharp vector text.
                                  - **Opacity**: Use the exact ink density (e.g., #333333 or 90% opacity) found in Image 2. It should look "baked" into the paper.
                                  - **Imperfections**: If Image 2 has jpeg artifacts around the text, replicate them.

                               3. **ALIGNMENT**: Align the baseline with any remaining text in Image 1.

                               OUTPUT: Return ONLY the modified Image 1 as a PNG.`
                            : `CONTEXT: You are a Forensic Document Expert.
                               INPUTS:
                               - Image 1: Target area to clear.
                               - Image 2: Reference background texture.

                               TASK: Completely remove all text/content from Image 1.

                               STRICT VISUAL EXECUTION:
                               1. **TEXTURE SYNTHESIS**: Fill the void in Image 1 by generating the exact paper grain, noise pattern, and compression artifacts found in Image 2.
                               2. **NO SOLID COLORS**: The result must look like a raw, dirty, scanned piece of paper. 
                               3. **SEAMLESSNESS**: The filled area must differ indistinguishably from the surrounding pixels.

                               OUTPUT: Return ONLY the modified Image 1 as a PNG.`;
                    }
                } else {
                    promptText = replacementText
                    ? `The input is a crop from a scanned document.
                       ACTION: Remove existing text and replace with "${replacementText}".
                       
                       VISUAL RULES:
                       1. **BACKGROUND**: Synthesize the exact noise, grain, and paper texture of the source image to fill the background. NO SOLID COLORS.
                       2. **TEXT**: Match the font family, size, and weight of the original text exactly.
                       3. **SCAN SIMULATION**: The new text must NOT be sharp. It must have the same blur, soft edges, and dark grey opacity (not pure black) as the original scanned text.
                       
                       Return ONLY the modified image.`
                    : `The input is a crop from a scanned document.
                       ACTION: Remove all text/content from this area.
                       
                       VISUAL RULES:
                       1. **BACKGROUND**: Recreate the exact scanned paper texture, noise, and grain found in the input image.
                       2. **NO SOLID COLORS**: The result must look like a blank part of the original scanned page.
                       
                       Return ONLY the modified image.`;
                }

                promptParts.push({ text: promptText });

                setStatusMsg("AI đang xử lý (Gemini)...");
                const apiKey = process.env.API_KEY;
                if (!apiKey) throw new Error("Chưa cấu hình API Key");

                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: { parts: promptParts }
                });

                let aiImageBytes: Uint8Array | null = null;
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData?.data) {
                            const binaryString = atob(part.inlineData.data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                            aiImageBytes = bytes;
                            break;
                        }
                    }
                }

                if (!aiImageBytes) throw new Error("AI không trả về hình ảnh.");

                setStatusMsg("Đang cập nhật PDF...");
                const embeddedImage = await pdfDoc.embedPng(aiImageBytes);
                
                currentPage.drawImage(embeddedImage, { 
                    x: pdfX, 
                    y: pdfY, 
                    width: pdfW, 
                    height: pdfH
                });

            } else {
                currentPage.drawRectangle({ x: pdfX, y: pdfY, width: pdfW, height: pdfH, color: rgb(1, 1, 1), opacity: 1 });
                if (replacementText) {
                    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                    currentPage.drawText(replacementText, { x: pdfX + 2, y: pdfY + (pdfH/2) - 5, size: 10, font, color: rgb(0, 0, 0) });
                }
            }

            const pdfBytes = await pdfDoc.save();
            const newBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            setModifiedPdf(newBlob);
            setPreviewFile(newBlob);
            setSelection(null); 

        } catch (err: any) {
            console.error(err);
            alert("Lỗi: " + (err.message || "Unknown"));
            setHistory(prev => prev.slice(0, -1));
        } finally {
            setIsProcessing(false);
            setStatusMsg("");
        }
    };

    const handleDownload = () => {
        if (!modifiedPdf) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(modifiedPdf);
        link.download = `edited_${file?.name || 'doc.pdf'}`;
        link.click();
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-4 mb-4 border-b pb-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={20}/></button>
                <div className="flex-1 flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Pencil className="text-indigo-600"/> Sửa Nội Dung (AI Scan)</h3>
                    <div className="flex items-center gap-2">
                        {/* Undo Button */}
                        <button 
                            onClick={handleUndo} 
                            disabled={history.length === 0 || isProcessing}
                            className="px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Quay lại thao tác trước"
                        >
                            <RotateCcw size={14} /> Hoàn tác
                        </button>
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button onClick={() => setTool('select')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tool === 'select' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MousePointer size={14} /> Chọn vùng</button>
                            <button onClick={() => setTool('pan')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tool === 'pan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Hand size={14} /> Di chuyển</button>
                        </div>
                    </div>
                </div>
            </div>

            {!file ? (
                <div className="flex-1 pb-20">
                    <FileUploader onFileSelect={onFileChange} label="Tải lên PDF để sửa" />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                    <div className="flex-1 min-h-0 bg-slate-200/50 rounded-xl border border-slate-200 overflow-hidden flex flex-col relative">
                        <PdfViewer 
                            file={previewFile} page={page} onPageChange={setPage} scale={scale} setScale={setScale} tool={tool}
                            onSelectionStart={handleSelectionStart} onSelectionMove={handleSelectionMove} onSelectionEnd={handleSelectionEnd}
                            canvasRef={canvasRef}
                            fitToPage={true} // Enable fit to page here too
                            overlayContent={
                                <>
                                    {/* Render Edit Selection (Blue) */}
                                    {selection && (
                                        <div className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10 pointer-events-none z-10 box-border" style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}>
                                            <div className="absolute -top-7 left-0 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded shadow-lg font-bold flex items-center whitespace-nowrap"><Target size={10} className="mr-1"/> Vùng Sửa</div>
                                        </div>
                                    )}
                                    {/* Render Sample Selection (Orange/Green) */}
                                    {sampleSelection && (
                                        <div className="absolute border-2 border-dashed border-orange-500 bg-orange-500/10 pointer-events-none z-10 box-border" style={{ left: sampleSelection.x, top: sampleSelection.y, width: sampleSelection.w, height: sampleSelection.h }}>
                                            <div className="absolute -top-7 left-0 bg-orange-600 text-white text-[10px] px-2 py-1 rounded shadow-lg font-bold flex items-center whitespace-nowrap"><Pipette size={10} className="mr-1"/> Vùng Mẫu</div>
                                        </div>
                                    )}
                                </>
                            }
                        />
                    </div>

                    <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 h-full overflow-y-auto">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h4 className="font-bold text-slate-800 border-b pb-2 flex items-center justify-between">
                                <span>Công cụ AI</span>
                                {selection && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Đã chọn vùng</span>}
                            </h4>

                            <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                                <span className="text-sm font-medium text-slate-700 flex items-center"><Sparkles size={16} className={`mr-2 ${useAI ? 'text-purple-500' : 'text-slate-400'}`}/> Gemini AI Magic</span>
                                <div className="relative"><input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} className="sr-only peer"/><div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div></div>
                            </label>

                            {/* SELECTION MODE TOGGLE */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => { setSelectionMode('target'); setTool('select'); }}
                                    className={`py-2 px-1 text-xs font-bold rounded-md flex items-center justify-center transition-all ${selectionMode === 'target' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Target size={14} className="mr-1"/> Chọn Vùng Sửa
                                </button>
                                <button 
                                    onClick={() => { setSelectionMode('sample'); setTool('select'); }}
                                    className={`py-2 px-1 text-xs font-bold rounded-md flex items-center justify-center transition-all ${selectionMode === 'sample' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Pipette size={14} className="mr-1"/> Chọn Vùng Mẫu
                                </button>
                            </div>
                            
                            {/* SAMPLE STATUS INFO */}
                            {sampleSelection ? (
                                <div className="text-[10px] bg-orange-50 text-orange-700 px-3 py-2 rounded-lg border border-orange-100 flex items-center">
                                    <CheckCircle size={12} className="mr-1.5"/> Đã có mẫu tham chiếu (Font, Nền)
                                </div>
                            ) : (
                                <div className="text-[10px] bg-slate-50 text-slate-500 px-3 py-2 rounded-lg border border-slate-100 italic">
                                    Chưa chọn vùng mẫu (Dùng mặc định)
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nội dung thay thế</label>
                                <textarea value={replacementText} onChange={(e) => setReplacementText(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-28" placeholder="Nhập văn bản mới... (Để trống để xóa vùng chọn)" />
                                <p className="text-[10px] text-slate-400 mt-2 italic leading-tight bg-blue-50 p-2 rounded text-blue-600">
                                    <span className="font-bold">Mẹo:</span> Chọn "Vùng Mẫu" chứa nền giấy và font chữ tương tự để AI bắt chước chính xác nhất.
                                </p>
                            </div>

                            <button onClick={applyEdit} disabled={!selection || isProcessing} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center shadow-lg transition-all active:scale-95 ${!selection ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : isProcessing ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                {isProcessing ? <><Loader className="animate-spin w-4 h-4 mr-2"/> {statusMsg}</> : <><Wand2 className="w-4 h-4 mr-2"/> {replacementText ? 'Thay Thế' : 'Xóa Vùng Chọn'}</>}
                            </button>
                        </div>

                        {modifiedPdf && (
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-bottom-4 shadow-sm">
                                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-2 text-sm"><CheckCircle size={16}/> Đã chỉnh sửa xong!</div>
                                <button onClick={handleDownload} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"><Download size={16}/> Tải xuống PDF Mới</button>
                            </div>
                        )}

                        <button onClick={() => {setFile(null); setModifiedPdf(null);}} className="text-xs text-slate-400 hover:text-red-500 hover:underline text-center w-full py-2">Hủy bỏ / Chọn file khác</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DASHBOARD COMPONENT ---
const Dashboard = ({ onSelectTool }: { onSelectTool: (t: ToolType) => void }) => {
    // ... (unchanged)
    const tools = [
        { id: 'split', title: 'Tách PDF', desc: 'Tách file PDF thành nhiều trang nhỏ, hoặc theo range.', icon: Split, color: 'bg-indigo-50 text-indigo-600' },
        { id: 'merge', title: 'Ghép PDF', desc: 'Gộp nhiều file PDF thành một file duy nhất.', icon: Merge, color: 'bg-blue-50 text-blue-600' },
        { id: 'compress', title: 'Nén PDF', desc: 'Giảm dung lượng file PDF để dễ chia sẻ.', icon: Minimize2, color: 'bg-teal-50 text-teal-600' },
        { id: 'images_to_pdf', title: 'Ảnh sang PDF', desc: 'Chuyển đổi file ảnh (JPG, PNG) sang PDF.', icon: ImageIcon, color: 'bg-purple-50 text-purple-600' },
        { id: 'unlock', title: 'Mở Khóa PDF', desc: 'Xóa mật khẩu bảo vệ khỏi file PDF (nếu biết pass).', icon: Unlock, color: 'bg-orange-50 text-orange-600' },
        { id: 'edit_content', title: 'Chỉnh Sửa PDF', desc: 'Thêm văn bản, chú thích vào trang PDF.', icon: Pencil, color: 'bg-sky-50 text-sky-600' },
        { id: 'stamp', title: 'Đóng Dấu (SignLH)', desc: 'Chèn chữ ký, mộc, logo hoặc giáp lai nhiều trang.', icon: StampIcon, color: 'bg-rose-50 text-rose-600' },
        { id: 'extract_stamp', title: 'Tách Con Dấu (AI)', desc: 'Dùng AI để tách và phục hồi con dấu từ văn bản scan.', icon: ScanLine, color: 'bg-cyan-50 text-cyan-600' },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">PDF Tools</h1>
                <p className="text-slate-500">Bộ công cụ xử lý PDF tiện lợi - Xử lý ngay trên trình duyệt, bảo mật tuyệt đối.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => onSelectTool(tool.id as ToolType)}
                        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left flex flex-col gap-4 group hover:border-slate-200"
                    >
                        <div className={`p-3 rounded-xl w-fit ${tool.color} transition-transform group-hover:scale-110`}>
                            <tool.icon size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 mb-2">{tool.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{tool.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- MAIN LAYOUT ---
export const ToolAI = () => {
    // ... (unchanged)
    const [activeTool, setActiveTool] = useState<ToolType>(null);
    const [stamps, setStamps] = useState<StampItem[]>([]);

    const fetchStamps = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/stamps`);
            if (res.data) setStamps(res.data.map((s: any) => ({ ...s, id: s.id || s.name })));
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchStamps(); }, []);

    const renderTool = () => {
        switch (activeTool) {
            case 'split': return <SplitTool onBack={() => setActiveTool(null)} />;
            case 'compress': return <FeaturePlaceholderTool title="Nén PDF" icon={Minimize2} desc="Giảm dung lượng file PDF mà không làm giảm chất lượng đáng kể." onBack={() => setActiveTool(null)} />;
            case 'merge': return <MergeTool onBack={() => setActiveTool(null)} />;
            case 'images_to_pdf': return <ImagesToPdfTool onBack={() => setActiveTool(null)} />;
            case 'unlock': return <FeaturePlaceholderTool title="Mở Khóa PDF" icon={Unlock} desc="Gỡ bỏ mật khẩu bảo vệ file PDF (Decryption)." onBack={() => setActiveTool(null)} />;
            case 'edit_content': return <EditContentTool onBack={() => setActiveTool(null)} />;
            case 'stamp': return <StampTool stamps={stamps} setStamps={setStamps} fetchStamps={fetchStamps} onBack={() => setActiveTool(null)} />;
            case 'extract_stamp': return <ExtractStampTool onBack={() => setActiveTool(null)} fetchStamps={fetchStamps} />;
            default: return <Dashboard onSelectTool={setActiveTool} />;
        }
    };

    return (
        <div className="flex h-full bg-slate-50/50 overflow-hidden">
            {/* Main Workspace */}
            <div className="flex-1 bg-white shadow-sm border-l border-slate-200 overflow-hidden relative flex flex-col">
                {activeTool === null ? (
                    <div className="h-full overflow-y-auto">
                        <Dashboard onSelectTool={setActiveTool} />
                    </div>
                ) : (
                    <div className="h-full p-6 lg:p-8 flex flex-col">
                        {renderTool()}
                    </div>
                )}
            </div>
        </div>
    );
};
