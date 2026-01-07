
import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, Minimize2, Merge, Image, Unlock, Edit, 
  Stamp, Upload, Download, Trash2, MoveUp, MoveDown, 
  Plus, Check, X, Loader, ChevronLeft, ChevronRight, MousePointer,
  Crop, Layers, Wand2, RefreshCw, Eraser, Palette, Droplets, Split,
  Files, Pencil, Save, Cloud, FolderOpen, AlertTriangle, HelpCircle,
  ArrowLeft, ShieldCheck, Key
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsMod from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

// Fix for pdfjs-dist import structure
const pdfjsLib = (pdfjsMod as any).default || pdfjsMod;

// Set worker for PDF rendering using cdnjs for better stability
if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
}

const BACKEND_URL = "https://api.kimberry.id.vn";

type ToolType = 'split' | 'compress' | 'merge' | 'images_to_pdf' | 'unlock' | 'edit' | 'stamp' | 'extract';

interface StampItem {
    id: string;
    url: string; // URL from server
    name: string;
    created?: number;
}

// --- Helper: Trim Whitespace/Transparency ---
const trimCanvas = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;
    
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    // Scan all pixels
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3];

            // Define "Content" vs "Background"
            // Background is White or Transparent
            // White threshold: > 240
            const isWhite = r > 240 && g > 240 && b > 240;
            const isTransparent = a < 20;
            
            if (!isWhite && !isTransparent) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) return sourceCanvas;

    // Add a small padding
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const trimW = maxX - minX;
    const trimH = maxY - minY;

    if (trimW <= 0 || trimH <= 0) return sourceCanvas;

    const trimmed = document.createElement('canvas');
    trimmed.width = trimW;
    trimmed.height = trimH;
    const tCtx = trimmed.getContext('2d');
    if (tCtx) {
        tCtx.drawImage(sourceCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    }
    return trimmed;
};

// --- Helper: Resize Image for Storage Optimization ---
const resizeImage = (file: File, maxWidth: number = 250): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if image is wider than maxWidth
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Use PNG to preserve transparency
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    // Fallback to original if canvas fails
                    resolve(e.target?.result as string);
                }
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

// --- Helper: Convert Base64 to File ---
const base64ToFile = async (dataUrl: string, fileName: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: 'image/png' });
};

// --- Helper: Remove White Background ---
const removeWhiteBackground = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dataUrl); return; }
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Threshold for white/near-white
                if (r > 230 && g > 230 && b > 230) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// --- Helper: Crop Image Slice (For Fanfold Stamp) ---
const cropImageSlice = (dataUrl: string, partIndex: number, totalParts: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "Anonymous"; // Enable CORS for server images
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = img.width;
            const h = img.height;
            const sliceW = Math.floor(w / totalParts);
            
            canvas.width = sliceW;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(dataUrl); return; }

            const sx = sliceW * partIndex;
            ctx.drawImage(img, sx, 0, sliceW, h, 0, 0, sliceW, h);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => {
            console.error("Error loading image for slicing", e);
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
};

// --- Helper: Format Bytes ---
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// --- Helper Component: PDF Viewer with Canvas ---
interface PdfViewerProps {
    file: File | null;
    page: number; // 1-based
    onPageChange: (newPage: number) => void;
    onClick?: (x: number, y: number, viewportWidth: number, viewportHeight: number) => void;
    overlayContent?: React.ReactNode;
    containerRef?: React.RefObject<HTMLDivElement>;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, page, onPageChange, onClick, overlayContent,
    containerRef, onMouseDown, onMouseMove, onMouseUp, onMouseLeave 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const renderTaskRef = useRef<any>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);

    useEffect(() => {
        if (!file) return;

        const loadPdf = async () => {
            setLoading(true);
            setPdfDoc(null);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/cmaps/',
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
        return () => {
             if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [file]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pdfDoc, page);
        }
    }, [pdfDoc, page]);

    const renderPage = async (pdf: any, pageNum: number) => {
        if (renderTaskRef.current) {
            await renderTaskRef.current.cancel();
        }
        
        setLoading(true);
        try {
            const page = await pdf.getPage(pageNum);
            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: 1.5 }); // High quality

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
                 console.error("Page render error", error);
                 setLoading(false);
             }
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onClick || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        onClick(x, y, rect.width, rect.height);
    };

    if (!file) return null;

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-full shadow-sm">
                <button 
                    disabled={page <= 1} 
                    onClick={() => onPageChange(page - 1)}
                    className="p-1 hover:bg-white rounded-full disabled:opacity-30"
                >
                    <ChevronLeft size={20}/>
                </button>
                <span className="font-medium text-sm text-slate-700">Page {page} of {numPages}</span>
                <button 
                    disabled={page >= numPages} 
                    onClick={() => onPageChange(page + 1)}
                    className="p-1 hover:bg-white rounded-full disabled:opacity-30"
                >
                    <ChevronRight size={20}/>
                </button>
            </div>

            <div 
                ref={containerRef}
                className="relative border shadow-lg bg-slate-500 inline-block"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <Loader className="animate-spin text-indigo-600" size={32} />
                    </div>
                )}
                <canvas 
                    ref={canvasRef} 
                    onClick={handleCanvasClick}
                    className="max-w-full h-auto cursor-crosshair block"
                    style={{ maxHeight: '70vh' }}
                />
                {overlayContent}
            </div>
        </div>
    );
};

// --- TOOL COMPONENTS ---

const SplitTool = () => {
    const [file, setFile] = useState<File | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [splitMode, setSplitMode] = useState<'all' | 'range'>('all');
    const [ranges, setRanges] = useState('');
    const [pageNames, setPageNames] = useState<{[key: number]: string}>({});
    const [isProcessing, setIsProcessing] = useState(false);

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            const arrayBuffer = await f.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            setNumPages(pdfDoc.getPageCount());
            setPageNames({}); 
        }
    };

    const handleNameChange = (idx: number, name: string) => {
        setPageNames(prev => ({...prev, [idx]: name}));
    };

    const splitAndDownload = async (pageIndices: number[], customName?: string) => {
        if (!file) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const srcDoc = await PDFDocument.load(arrayBuffer);
            const newDoc = await PDFDocument.create();
            const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
            copiedPages.forEach(page => newDoc.addPage(page));
            const pdfBytes = await newDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = customName || `split_${pageIndices[0] + 1}.pdf`;
            link.click();
        } catch (err) {
            console.error(err);
            alert("Lỗi khi tách file");
        }
        setIsProcessing(false);
    };

    const handleSplitAll = async () => {
        if (!file) return;
        setIsProcessing(true);
        const zip = new JSZip();
        const arrayBuffer = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        
        for (let i = 0; i < srcDoc.getPageCount(); i++) {
             const newDoc = await PDFDocument.create();
             const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
             newDoc.addPage(copiedPage);
             const pdfBytes = await newDoc.save();
             const name = pageNames[i] ? `${pageNames[i]}.pdf` : `page_${i + 1}.pdf`;
             zip.file(name, pdfBytes);
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = "split_files.zip";
        link.click();
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Scissors className="text-indigo-600"/> Tách File PDF</h3>
            <input type="file" accept="application/pdf" onChange={onFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
            {file && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-sm text-slate-600 mb-4">File: <strong>{file.name}</strong> ({numPages} trang)</p>
                    <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={splitMode === 'all'} onChange={() => setSplitMode('all')} className="text-indigo-600" /><span>Tách từng trang</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={splitMode === 'range'} onChange={() => setSplitMode('range')} className="text-indigo-600" /><span>Tách theo cụm (Range)</span></label>
                    </div>
                    {splitMode === 'all' && (
                        <div className="space-y-4">
                            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2">
                                {Array.from({length: numPages}).map((_, idx) => (
                                    <div key={idx} className="flex items-center gap-3 py-2 px-2 border-b border-slate-100 last:border-0">
                                        <span className="text-sm font-mono w-16">Page {idx + 1}</span>
                                        <input type="text" placeholder={`page_${idx+1}`} value={pageNames[idx] || ''} onChange={(e) => handleNameChange(idx, e.target.value)} className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm" />
                                        <button onClick={() => splitAndDownload([idx], (pageNames[idx] ? pageNames[idx] + '.pdf' : undefined))} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Download size={16} /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleSplitAll} disabled={isProcessing} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex justify-center gap-2">{isProcessing ? <Loader className="animate-spin" /> : <Download size={20} />} Tải xuống tất cả (ZIP)</button>
                        </div>
                    )}
                    {splitMode === 'range' && (
                        <div className="space-y-4">
                            <input type="text" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            <button onClick={() => {
                                const parts = ranges.split(',').map(p => p.trim());
                                const indices: number[] = [];
                                parts.forEach(p => {
                                    if (p.includes('-')) {
                                        const [start, end] = p.split('-').map(Number);
                                        for(let i=start; i<=end; i++) indices.push(i-1);
                                    } else { indices.push(Number(p)-1); }
                                });
                                const validIndices = indices.filter(i => i >= 0 && i < numPages);
                                if(validIndices.length > 0) splitAndDownload(validIndices, 'split_range.pdf');
                                else alert("Trang không hợp lệ");
                            }} disabled={isProcessing || !ranges} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex justify-center gap-2">{isProcessing ? <Loader className="animate-spin" /> : <Download size={20} />} Tải xuống File đã tách</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const CompressTool = () => {
    const [file, setFile] = useState<File | null>(null);
    const [compressedPdf, setCompressedPdf] = useState<Uint8Array | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const handleCompress = async () => {
        if (!file) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            // PDF-Lib does not have strong compression, but saving sometimes optimizes structure.
            const pdfBytes = await pdfDoc.save(); 
            setCompressedPdf(pdfBytes);
        } catch (e) { alert("Lỗi xử lý file."); }
        setIsProcessing(false);
    };
    const handleDownload = () => {
        if (!compressedPdf || !file) return;
        const blob = new Blob([compressedPdf], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `compressed_${file.name}`;
        link.click();
    };
    return (
         <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Minimize2 className="text-indigo-600"/> Giảm Dung Lượng PDF</h3>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0] || null); setCompressedPdf(null); }} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {file && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="font-medium text-slate-700 mb-2">File gốc: {file.name}</p>
                    <p className="text-sm text-slate-500 mb-4">Kích thước: <span className="font-bold text-slate-800">{formatBytes(file.size)}</span></p>
                    {!compressedPdf ? (
                        <button onClick={handleCompress} disabled={isProcessing} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2">{isProcessing ? <Loader className="animate-spin" size={16} /> : <Minimize2 size={16} />} Nén Ngay</button>
                    ) : (
                        <div className="animate-in fade-in">
                            <div className="flex items-center gap-2 text-emerald-600 mb-4 font-medium"><Check size={20} /> Đã nén thành công!</div>
                            <p className="text-sm text-slate-500 mb-4">Kích thước mới: <span className="font-bold text-emerald-700">{formatBytes(compressedPdf.byteLength)}</span></p>
                            <button onClick={handleDownload} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2"><Download size={16} /> Tải Xuống</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const MergeTool = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); };
    const moveFile = (index: number, direction: 'up' | 'down') => {
        const newFiles = [...files];
        if (direction === 'up' && index > 0) [newFiles[index], newFiles[index-1]] = [newFiles[index-1], newFiles[index]];
        else if (direction === 'down' && index < newFiles.length - 1) [newFiles[index], newFiles[index+1]] = [newFiles[index+1], newFiles[index]];
        setFiles(newFiles);
    };
    const removeFile = (index: number) => setFiles(files.filter((_, i) => i !== index));
    const handleMerge = async () => {
        if (files.length < 2) return alert("Chọn ít nhất 2 file để ghép.");
        setIsProcessing(true);
        try {
            const mergedPdf = await PDFDocument.create();
            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `merged_${Date.now()}.pdf`;
            link.click();
        } catch (err) { alert("Lỗi khi ghép file."); }
        setIsProcessing(false);
    };
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Merge className="text-indigo-600"/> Ghép File PDF</h3>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-indigo-50 transition-colors">
                <input type="file" multiple accept="application/pdf" onChange={handleFiles} className="hidden" id="merge-upload" />
                <label htmlFor="merge-upload" className="cursor-pointer flex flex-col items-center"><Upload size={32} className="text-slate-400 mb-2"/><span className="text-indigo-600 font-medium">Chọn file PDF</span></label>
            </div>
            {files.length > 0 && (
                <div className="space-y-2">
                    <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {files.map((file, idx) => (
                            <li key={idx} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden"><span className="bg-slate-100 text-slate-500 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{idx + 1}</span><span className="truncate max-w-[200px] md:max-w-md text-sm font-medium">{file.name}</span></div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => moveFile(idx, 'up')} disabled={idx === 0} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"><MoveUp size={16}/></button>
                                    <button onClick={() => moveFile(idx, 'down')} disabled={idx === files.length - 1} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30"><MoveDown size={16}/></button>
                                    <button onClick={() => removeFile(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-2"><Trash2 size={16}/></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <button onClick={handleMerge} disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md flex justify-center gap-2 mt-4">{isProcessing ? <Loader className="animate-spin" /> : <Merge size={20} />} Ghép File PDF</button>
                </div>
            )}
        </div>
    );
};

const ImagesToPdfTool = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    useEffect(() => { const newPreviews: string[] = []; files.forEach(file => newPreviews.push(URL.createObjectURL(file))); setPreviews(newPreviews); return () => newPreviews.forEach(url => URL.revokeObjectURL(url)); }, [files]);
    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); };
    const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));
    const moveFile = (index: number, direction: 'left' | 'right') => { const newFiles = [...files]; if (direction === 'left' && index > 0) [newFiles[index], newFiles[index-1]] = [newFiles[index-1], newFiles[index]]; else if (direction === 'right' && index < newFiles.length - 1) [newFiles[index], newFiles[index+1]] = [newFiles[index+1], newFiles[index]]; setFiles(newFiles); };
    const handleMerge = async () => { if (files.length === 0) return; setIsProcessing(true); try { const pdfDoc = await PDFDocument.create(); for (const file of files) { const buffer = await file.arrayBuffer(); let image; if (file.type === 'image/jpeg') image = await pdfDoc.embedJpg(buffer); else if (file.type === 'image/png') image = await pdfDoc.embedPng(buffer); else continue; const page = pdfDoc.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height, }); } const pdfBytes = await pdfDoc.save(); const blob = new Blob([pdfBytes], { type: 'application/pdf' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `images_combined.pdf`; link.click(); } catch (err) { alert("Lỗi khi tạo PDF."); } setIsProcessing(false); };
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Image className="text-indigo-600"/> Ảnh sang PDF</h3>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50"><input type="file" multiple accept="image/png, image/jpeg" onChange={handleFilesChange} className="hidden" id="img-upload" /><label htmlFor="img-upload" className="cursor-pointer flex flex-col items-center"><Image size={32} className="text-slate-400 mb-2"/><span className="text-indigo-600 font-medium">Chọn ảnh (JPG, PNG)</span></label></div>
            {files.length > 0 && (<div><p className="mb-4 text-xs text-slate-600">Đã chọn {files.length} ảnh.</p><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">{files.map((file, idx) => (<div key={idx} className="relative group bg-slate-100 rounded-lg border border-slate-200 aspect-square flex flex-col items-center justify-center overflow-hidden"><img src={previews[idx]} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><button onClick={() => moveFile(idx, 'left')} disabled={idx === 0} className="p-1.5 bg-white text-slate-800 rounded-full hover:bg-slate-200 disabled:opacity-50"><ChevronLeft size={16}/></button><button onClick={() => removeFile(idx)} className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><X size={16}/></button><button onClick={() => moveFile(idx, 'right')} disabled={idx === files.length - 1} className="p-1.5 bg-white text-slate-800 rounded-full hover:bg-slate-200 disabled:opacity-50"><ChevronRight size={16}/></button></div></div>))}</div><button onClick={handleMerge} disabled={isProcessing} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">{isProcessing ? "Đang xử lý..." : "Tạo & Tải PDF"}</button></div>)}
        </div>
    );
};

const UnlockTool = () => {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const handleUnlock = async () => { if (!file) return; setIsProcessing(true); try { const buffer = await file.arrayBuffer(); const pdfDoc = await PDFDocument.load(buffer, { password, ignoreEncryption: false } as any); const pdfBytes = await pdfDoc.save(); const blob = new Blob([pdfBytes], { type: 'application/pdf' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `unlocked_${file.name}`; link.click(); } catch (err) { alert("Mật khẩu không đúng hoặc lỗi file."); } setIsProcessing(false); };
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Unlock className="text-indigo-600"/> Mở Khóa PDF</h3>
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 mb-4"/><input type="password" placeholder="Nhập mật khẩu file" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded-lg mb-4"/><button onClick={handleUnlock} disabled={!file || !password || isProcessing} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">Mở Khóa & Tải</button>
        </div>
    );
};

const EditTool = () => {
    const [file, setFile] = useState<File | null>(null);
    const [text, setText] = useState('');
    const [position, setPosition] = useState({ x: 50, y: 500 });
    const [page, setPage] = useState(1);
    const [color, setColor] = useState('#000000');
    const [size, setSize] = useState(24);
    const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
    const handleCanvasClick = (x: number, y: number, viewW: number, viewH: number) => { setPosition({ x, y }); setViewSize({ width: viewW, height: viewH }); };
    const handleEdit = async () => { if (!file) return; try { const buffer = await file.arrayBuffer(); const pdfDoc = await PDFDocument.load(buffer); const pages = pdfDoc.getPages(); const targetPage = pages[page - 1]; if (targetPage) { const r = parseInt(color.slice(1,3), 16) / 255; const g = parseInt(color.slice(3,5), 16) / 255; const b = parseInt(color.slice(5,7), 16) / 255; const { width, height } = targetPage.getSize(); let pdfX = position.x; let pdfY = position.y; if (viewSize.width > 0) { pdfX = (position.x / viewSize.width) * width; pdfY = height - ((position.y / viewSize.height) * height); } targetPage.drawText(text, { x: pdfX, y: pdfY, size: Number(size), color: rgb(r, g, b), }); const pdfBytes = await pdfDoc.save(); const blob = new Blob([pdfBytes], { type: 'application/pdf' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `edited_${file.name}`; link.click(); } else { alert("Trang không tồn tại"); } } catch (err) { alert("Lỗi chỉnh sửa"); } };
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Edit className="text-indigo-600"/> Thêm Chữ vào PDF</h3>
            {!file ? (
                 <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50"><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="edit-upload" /><label htmlFor="edit-upload" className="cursor-pointer flex flex-col items-center"><Upload size={32} className="text-slate-400 mb-2"/><span className="text-indigo-600 font-medium">Chọn file PDF để sửa</span></label></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 bg-slate-100 p-4 rounded-xl flex justify-center"><PdfViewer file={file} page={page} onPageChange={setPage} onClick={handleCanvasClick} overlayContent={text && (<div style={{ position: 'absolute', left: position.x, top: position.y, color: color, fontSize: `${size}px`, lineHeight: 1, transform: 'translateY(-100%)', pointerEvents: 'none', whiteSpace: 'nowrap', textShadow: '0 0 2px white' }}>{text}<div className="absolute -bottom-1 -left-1 w-2 h-2 bg-indigo-500 rounded-full"></div></div>)} /></div>
                     <div className="space-y-4"><div><p className="text-xs text-slate-500 mb-2">Click vào trang PDF để chọn vị trí.</p><label className="block text-sm font-medium mb-1">Nội dung văn bản</label><input type="text" value={text} onChange={e => setText(e.target.value)} className="w-full border p-2 rounded" placeholder="Nhập nội dung..."/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-sm font-medium mb-1">Cỡ chữ</label><input type="number" value={size} onChange={e => setSize(Number(e.target.value))} className="w-full border p-2 rounded"/></div><div><label className="block text-sm font-medium mb-1">Màu sắc</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 border rounded"/></div></div><div className="pt-4"><button onClick={handleEdit} disabled={!text} className="bg-indigo-600 text-white px-6 py-2 rounded-lg w-full font-bold hover:bg-indigo-700">Áp dụng & Tải xuống</button><button onClick={() => setFile(null)} className="mt-2 text-slate-500 text-sm w-full hover:underline">Chọn file khác</button></div></div>
                </div>
            )}
        </div>
    );
};

const StampTool = ({ stamps, setStamps }: { stamps: StampItem[], setStamps: any }) => {
    const [file, setFile] = useState<File | null>(null);
    const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [page, setPage] = useState(1);
    const [position, setPosition] = useState({ x: 100, y: 100 }); 
    const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(0.5);
    const [opacity, setOpacity] = useState(1);
    const [stampType, setStampType] = useState<'normal' | 'fanfold'>('normal');
    const [fanfoldStart, setFanfoldStart] = useState(1);
    const [fanfoldEnd, setFanfoldEnd] = useState(2);

    useEffect(() => {
        fetchStamps();
    }, []);

    const fetchStamps = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/stamps`);
            // Map server response to StampItem
            const mapped: StampItem[] = res.data.map((s: any) => ({
                id: s.name,
                name: s.name.split('.')[0], // Display name
                url: `${BACKEND_URL}${s.url}`,
                created: Date.now()
            }));
            setStamps(mapped);
        } catch (e) {
            console.error("Error fetching stamps:", e);
        }
    };

    const handleCanvasClick = (x: number, y: number, viewW: number, viewH: number) => {
        setPosition({ x, y });
        setViewSize({ width: viewW, height: viewH });
    };

    const handleAddStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsAdding(true);
            try {
                const files = Array.from(e.target.files);
                
                // Upload each file to server
                for (const file of files) {
                    // Resize before upload to save space (optional, but good)
                    const resizedDataUrl = await resizeImage(file);
                    const resizedFile = await base64ToFile(resizedDataUrl, file.name);

                    const formData = new FormData();
                    formData.append('file', resizedFile);
                    
                    await axios.post(`${BACKEND_URL}/upload-stamp`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
                // Refresh list from server
                await fetchStamps();
            } catch (error) {
                console.error("Error processing stamps", error);
                alert("Lỗi khi upload con dấu. Vui lòng thử lại.");
            } finally {
                setIsAdding(false);
            }
        }
    };

    const handleDeleteStamp = async (id: string) => {
        if(window.confirm("Bạn có chắc chắn muốn xóa con dấu này khỏi thư viện?")) {
            try {
                // id in stamps state is actually the filename (mapped from s.name)
                await axios.delete(`${BACKEND_URL}/stamps/${id}`);
                await fetchStamps(); // Refresh
                if (selectedStamp === id) setSelectedStamp(null);
            } catch (err) {
                console.error("Error deleting stamp", err);
                alert("Không thể xóa file trên server.");
            }
        }
    };

    const handleRenameStamp = (id: string, currentName: string) => {
        // Renaming on server might require a new API or just re-upload. 
        // For simplicity, we just update local display name or disable rename for now 
        // as file system based storage uses filename as ID.
        alert("Tính năng đổi tên file trên server chưa được hỗ trợ. Vui lòng xóa và upload lại với tên mới.");
    };

    const applyStamp = async () => {
        if (!file || !selectedStamp) return;
        try {
            const stampItem = stamps.find(s => s.id === selectedStamp);
            if (!stampItem) return;
            const pdfBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const totalPdfPages = pdfDoc.getPageCount();
            
            // Define visual base width matching the preview CSS (200px)
            const BASE_VISUAL_WIDTH = 200; 

            if (stampType === 'normal') {
                let imageToEmbed = stampItem.url;
                let stampImage;
                
                // Fetch the image data because PDF-lib needs bytes, not URL (unless browser)
                // stampItem.url is absolute URL to backend
                const imgBytes = await fetch(imageToEmbed).then(res => res.arrayBuffer());
                
                // Detect type from extension or header (simple check)
                if (imageToEmbed.toLowerCase().endsWith('.png')) {
                    stampImage = await pdfDoc.embedPng(imgBytes);
                } else {
                    stampImage = await pdfDoc.embedJpg(imgBytes);
                }
                
                const targetPage = pdfDoc.getPages()[page - 1];
                if (!targetPage) return;
                
                const { width, height } = targetPage.getSize();
                const imgAspect = stampImage.width / stampImage.height;
                
                // Calculate Size based on WYSIWYG
                let pdfW, pdfH;
                const visualWidth = BASE_VISUAL_WIDTH * scale;
                
                if (viewSize.width > 0) {
                    // WYSIWYG: Scale based on ratio of page width to view width
                    pdfW = visualWidth * (width / viewSize.width);
                } else {
                    // Fallback: 1px = 1pt (if no user interaction)
                    pdfW = visualWidth; 
                }
                pdfH = pdfW / imgAspect;

                // Calculate Position
                let pdfX = 0, pdfY = 0;
                if (viewSize.width > 0) {
                    const clickX = (position.x / viewSize.width) * width;
                    const clickY = height - ((position.y / viewSize.height) * height);
                    pdfX = clickX - (pdfW / 2);
                    pdfY = clickY - (pdfH / 2);
                } else {
                    pdfX = width - pdfW - 20;
                    pdfY = 20;
                }
                
                targetPage.drawImage(stampImage, { x: pdfX, y: pdfY, width: pdfW, height: pdfH, opacity: opacity });
            } else {
                // Fanfold logic
                const start = Math.max(1, fanfoldStart);
                const end = Math.min(totalPdfPages, fanfoldEnd);
                const totalParts = end - start + 1;
                if (totalParts < 2) { alert("Chế độ giáp lai cần ít nhất 2 trang."); return; }
                
                for (let i = 0; i < totalParts; i++) {
                    const pageIndex = start + i - 1;
                    const targetPage = pdfDoc.getPages()[pageIndex];
                    
                    // cropImageSlice needs to handle CORS image loaded from server
                    const sliceDataUrl = await cropImageSlice(stampItem.url, i, totalParts);
                    let sliceImage;
                    if (sliceDataUrl.startsWith('data:image/png')) sliceImage = await pdfDoc.embedPng(sliceDataUrl);
                    else sliceImage = await pdfDoc.embedJpg(sliceDataUrl);
                    
                    const { width, height } = targetPage.getSize();
                    const sliceAspect = sliceImage.width / sliceImage.height;

                    // Calculate Size
                    let pdfW, pdfH;
                    const visualSliceWidth = (BASE_VISUAL_WIDTH * scale) / totalParts;
                    
                    if (viewSize.width > 0) {
                        pdfW = visualSliceWidth * (width / viewSize.width);
                    } else {
                        pdfW = visualSliceWidth;
                    }
                    pdfH = pdfW / sliceAspect;

                    let pdfX = 0, pdfY = 0;
                    if (viewSize.width > 0) {
                        const clickX = (position.x / viewSize.width) * width;
                        const clickY = height - ((position.y / viewSize.height) * height);
                        pdfX = clickX - (pdfW / 2);
                        pdfY = clickY - (pdfH / 2);
                    } else {
                        pdfX = width - pdfW;
                        pdfY = height / 2 - (pdfH / 2);
                    }
                    
                    targetPage.drawImage(sliceImage, { x: pdfX, y: pdfY, width: pdfW, height: pdfH, opacity: opacity });
                }
            }
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `stamped_${file.name}`;
            link.click();
        } catch (err) { alert("Lỗi đóng dấu."); console.error(err); }
    };
    const selectedStampUrl = stamps.find(s => s.id === selectedStamp)?.url;
    const getPreviewSliceStyle = () => {
        if (stampType === 'normal') return { width: '100%', left: '0' };
        if (page < fanfoldStart || page > fanfoldEnd) return { display: 'none' };
        const totalParts = fanfoldEnd - fanfoldStart + 1;
        const partIndex = page - fanfoldStart;
        return { width: `${totalParts * 100}%`, marginLeft: `-${partIndex * 100}%`, maxWidth: 'none' };
    };
    const getPreviewContainerWidth = () => {
        const BASE_WIDTH = 200; // Increased base width for better default size
        if (stampType === 'normal') return `${BASE_WIDTH * scale}px`;
        const totalParts = fanfoldEnd - fanfoldStart + 1;
        return `${(BASE_WIDTH * scale) / totalParts}px`;
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Stamp className="text-indigo-600"/> Đóng Dấu (Watermark)</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-sm uppercase text-slate-500 flex items-center gap-2"><Cloud size={16} className="text-indigo-500" /> Thư viện</h4><button onClick={() => setIsAdding(!isAdding)} className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1"><Plus size={16}/> Thêm mới</button></div>
                {isAdding && (
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 mb-4 animate-in fade-in">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-indigo-300 border-dashed rounded-lg cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Cloud className="w-8 h-8 text-indigo-500 mb-2" />
                                <p className="mb-2 text-sm text-indigo-600"><span className="font-semibold">Click để chọn ảnh</span> (Chọn nhiều ảnh cùng lúc)</p>
                                <p className="text-xs text-indigo-400">PNG, JPG</p>
                            </div>
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg" 
                                multiple 
                                onChange={handleAddStamp} 
                                className="hidden" 
                            />
                        </label>
                        <p className="text-[10px] text-slate-400 mt-2 italic text-center">Đang upload lên E:\ServerData\Sign...</p>
                    </div>
                )}
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                        {stamps.map(stamp => (
                            <div key={stamp.id} onClick={() => setSelectedStamp(stamp.id)} className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all hover:bg-white group ${selectedStamp === stamp.id ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-white shadow-sm'}`}>
                                <img src={stamp.url} className="w-full h-16 object-contain mb-1" />
                                <p className="text-[10px] text-center font-medium truncate">{stamp.name}</p>
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-md p-0.5 backdrop-blur-sm shadow-sm">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteStamp(stamp.id); }} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition" title="Xóa"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        ))}
                        {stamps.length === 0 && <p className="col-span-3 md:col-span-5 text-center text-sm text-slate-400 py-4 flex flex-col items-center gap-2"><FolderOpen size={24}/> Thư mục Sign rỗng.</p>}
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-100 pt-6">
                {!file ? (
                     <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50"><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="stamp-upload" /><label htmlFor="stamp-upload" className="cursor-pointer flex flex-col items-center"><Upload size={32} className="text-slate-400 mb-2"/><span className="text-indigo-600 font-medium">Chọn file PDF</span></label></div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-slate-100 p-4 rounded-xl flex justify-center"><PdfViewer file={file} page={page} onPageChange={setPage} onClick={handleCanvasClick} overlayContent={selectedStampUrl && (<div style={{ position: 'absolute', left: position.x, top: position.y, width: getPreviewContainerWidth(), opacity: opacity, transform: 'translate(-50%, -50%)', pointerEvents: 'none', overflow: 'hidden' }}><img src={selectedStampUrl} style={{ height: 'auto', ...getPreviewSliceStyle() as any }} /><div className="absolute top-0 left-0 w-full h-full border border-dashed border-indigo-500"></div></div>)} /></div>
                        <div className="bg-slate-50 p-4 rounded-xl h-fit"><p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-wider">Cấu hình con dấu</p>{!selectedStamp ? (<p className="text-red-500 text-sm mb-4">Vui lòng chọn con dấu từ thư viện trên.</p>) : (<div className="space-y-4"><div className="flex items-center gap-2 text-sm text-slate-600 mb-2"><MousePointer size={14}/> Click vào trang để chọn vị trí</div><div><label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1 mb-2"><Split size={12}/> Chế độ đóng dấu</label><div className="flex gap-2 mb-3"><button onClick={() => setStampType('normal')} className={`flex-1 py-1.5 text-xs rounded border transition-all ${stampType === 'normal' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Bình thường</button><button onClick={() => setStampType('fanfold')} className={`flex-1 py-1.5 text-xs rounded border transition-all ${stampType === 'fanfold' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Giáp lai (Nhiều trang)</button></div>{stampType === 'fanfold' && (<div className="bg-white p-3 rounded-lg border border-slate-200 mb-3 animate-in fade-in"><p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Files size={12}/> Phạm vi trang (Range)</p><div className="flex items-center gap-2"><div><label className="text-[10px] text-slate-400 block">Từ trang</label><input type="number" min="1" value={fanfoldStart} onChange={e => setFanfoldStart(Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center"/></div><span className="text-slate-400">-</span><div><label className="text-[10px] text-slate-400 block">Đến trang</label><input type="number" min={fanfoldStart} value={fanfoldEnd} onChange={e => setFanfoldEnd(Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center"/></div></div><p className="text-[10px] text-slate-400 mt-2 text-center">Sẽ chia con dấu thành <strong className="text-indigo-600">{Math.max(1, fanfoldEnd - fanfoldStart + 1)}</strong> phần.</p></div>)}</div><div><label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Độ lớn (Scale): {scale}x</label><input type="range" min="0.1" max="2" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))} className="w-full accent-indigo-600" /></div><div><label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Độ mờ (Opacity): {Math.round(opacity * 100)}%</label><input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="w-full accent-indigo-600" /></div><div className="pt-2"><button onClick={applyStamp} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md">Đóng dấu & Tải xuống</button><button onClick={() => setFile(null)} className="mt-2 text-slate-500 text-sm w-full hover:underline">Chọn file khác</button></div></div>)}</div></div>
                )}
            </div>
        </div>
    );
};

const ExtractStampTool = ({ setStamps }: { setStamps: any }) => {
    const [file, setFile] = useState<File | null>(null);
    const [page, setPage] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selection, setSelection] = useState<{x:number, y:number, w:number, h:number} | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const startPos = useRef<{x:number, y:number} | null>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const [baseImage, setBaseImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [colorMode, setColorMode] = useState<'original'|'red'|'blue'>('original');
    const [saturation, setSaturation] = useState(1);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [customApiKey, setCustomApiKey] = useState('');

    useEffect(() => { setSelection(null); setBaseImage(null); setResultImage(null); setErrorMsg(null); }, [page, file]);

    useEffect(() => {
        if (!baseImage) return;
        const apply = async () => {
            const img = new window.Image();
            img.src = baseImage;
            await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if(!ctx) return;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0,0, canvas.width, canvas.height);
            const data = imageData.data;
            for(let i=0; i<data.length; i+=4) {
                let r = data[i];
                let g = data[i+1];
                let b = data[i+2];
                if (saturation !== 1) { const gray = 0.2989*r + 0.5870*g + 0.1140*b; r = gray + (r - gray) * saturation; g = gray + (g - gray) * saturation; b = gray + (b - gray) * saturation; }
                if (colorMode === 'red') { g = g * 0.2; b = b * 0.2; } else if (colorMode === 'blue') { r = r * 0.2; g = g * 0.2; }
                data[i] = r; data[i+1] = g; data[i+2] = b;
            }
            ctx.putImageData(imageData, 0, 0);
            setResultImage(canvas.toDataURL('image/png'));
        };
        apply();
    }, [baseImage, colorMode, saturation]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsSelecting(true);
        startPos.current = { x, y };
        setSelection({ x, y, w: 0, h: 0 });
        setErrorMsg(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !startPos.current) return;
        const target = e.currentTarget as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        
        const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        
        const width = currentX - startPos.current.x;
        const height = currentY - startPos.current.y;

        setSelection({
            x: width > 0 ? startPos.current.x : currentX,
            y: height > 0 ? startPos.current.y : currentY,
            w: Math.abs(width),
            h: Math.abs(height)
        });
    };

    const handleMouseUp = () => {
        setIsSelecting(false);
        startPos.current = null;
    };

    const processCrop = async (type: 'original' | 'filter' | 'ai') => {
        if (!selection || !canvasWrapperRef.current) return;
        setIsProcessing(true);
        setErrorMsg(null);

        const canvas = canvasWrapperRef.current.querySelector('canvas');
        if (!canvas) return;

        const scaleX = canvas.width / canvasWrapperRef.current.clientWidth;
        const scaleY = canvas.height / canvasWrapperRef.current.clientHeight;

        const cropX = selection.x * scaleX;
        const cropY = selection.y * scaleY;
        const cropW = selection.w * scaleX;
        const cropH = selection.h * scaleY;

        if (cropW < 5 || cropH < 5) {
             setErrorMsg("Vùng chọn quá nhỏ.");
             setIsProcessing(false);
             return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        let finalUrl = '';

        if (type === 'filter') {
            const imageData = ctx.getImageData(0, 0, cropW, cropH);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const isRed = r > g + 30 && r > b + 30;
                const isBlue = b > r + 30 && b > g + 30;
                if (!isRed && !isBlue) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            const trimmed = trimCanvas(tempCanvas);
            finalUrl = trimmed.toDataURL('image/png');
        } 
        else if (type === 'ai') {
             try {
                // PRIORITIZE Custom Key entered by user, then Env Key
                const apiKey = customApiKey || process.env.API_KEY;
                
                if (!apiKey) {
                    throw new Error("KEY_MISSING");
                }

                const base64Image = tempCanvas.toDataURL('image/png').split(',')[1];
                const ai = new GoogleGenAI({ apiKey: apiKey });
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: {
                        parts: [
                            { inlineData: { mimeType: "image/png", data: base64Image } },
                            { text: "Restore the stamp and handwritten signature in this image. Remove any machine-printed text overlaying them. Do NOT remove handwritten signatures. Keep the white background. Do not make the background transparent. Return the image of the restored stamp and signature." }
                        ]
                    }
                });
                
                let foundImage = false;
                if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const img = new window.Image();
                            img.src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            await new Promise((resolve) => { img.onload = resolve; });
                            
                            const resCanvas = document.createElement('canvas');
                            resCanvas.width = img.width;
                            resCanvas.height = img.height;
                            const rCtx = resCanvas.getContext('2d');
                            if (rCtx) {
                                rCtx.drawImage(img, 0, 0);
                                const trimmed = trimCanvas(resCanvas);
                                finalUrl = trimmed.toDataURL('image/png');
                            }
                            foundImage = true;
                            break;
                        }
                    }
                }
                
                if (!foundImage) throw new Error("AI response did not contain an image.");
             } catch (e: any) {
                 console.error("AI Error:", e);
                 setIsProcessing(false); // Ensure loading stops
                 
                 if (e.message === 'KEY_MISSING') {
                     setErrorMsg("API Key Missing");
                 } else {
                     let msg = e.message || e.toString();
                     
                     // Check for 429 specifically in the string
                     if (msg.includes("429") || (msg.includes("quota") && msg.includes("exceeded"))) {
                         msg = "Hết hạn mức sử dụng (429). Key mặc định đã hết quota. Vui lòng nhập Key riêng của bạn vào ô bên dưới.";
                     }
                     else if (msg.includes("403")) {
                         msg = "API Key không hợp lệ (403). Kiểm tra lại key trong Vercel Settings.";
                     }
                     else if (msg.includes("404")) {
                         msg = "Model không tồn tại (404).";
                     }
                     // Try to parse cleaner message from JSON if it looks like JSON
                     else if (msg.includes('{"error":')) {
                         try {
                             // Attempt to extract json object
                             const match = msg.match(/\{"error":.*\}/);
                             if (match) {
                                 const parsed = JSON.parse(match[0]);
                                 if (parsed.error?.message) {
                                     msg = parsed.error.message;
                                 }
                             }
                         } catch (err) {
                             // ignore parsing error
                         }
                     }

                     setErrorMsg(`Lỗi AI: ${msg}`);
                 }
             }
        }
        else {
            const trimmed = trimCanvas(tempCanvas);
            finalUrl = trimmed.toDataURL('image/png');
        }

        if (finalUrl) {
            setBaseImage(finalUrl);
            setResultImage(finalUrl); 
            setColorMode('original');
            setSaturation(1);
        }
        setIsProcessing(false);
    };

    const handleRemoveBg = async () => { const src = baseImage || resultImage; if (!src) return; setIsProcessing(true); const newImage = await removeWhiteBackground(src); setBaseImage(newImage); setIsProcessing(false); };
    const downloadResult = () => { if (!resultImage) return; const link = document.createElement('a'); link.href = resultImage; link.download = `extracted_stamp_${Date.now()}.png`; link.click(); };
    
    // NEW: Save to Library (Upload to Server)
    const saveToLibrary = async () => {
        if (!resultImage) return;
        const name = window.prompt("Nhập tên con dấu để lưu vào thư viện:", "Stamp_" + Date.now());
        if (name) {
            try {
                // Convert base64 to File
                const file = await base64ToFile(resultImage, `${name}.png`);
                const formData = new FormData();
                formData.append('file', file);
                
                await axios.post(`${BACKEND_URL}/upload-stamp`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                // Better: Fetch and update setStamps immediately
                const res = await axios.get(`${BACKEND_URL}/stamps`);
                const mapped = res.data.map((s: any) => ({
                    id: s.name,
                    name: s.name.split('.')[0],
                    url: `${BACKEND_URL}${s.url}`,
                    created: Date.now()
                }));
                setStamps(mapped);

                alert("Đã lưu con dấu vào thư viện! Bạn có thể dùng nó trong mục 'Đóng Dấu'.");
            } catch (err) {
                console.error("Error saving stamp", err);
                alert("Lỗi khi lưu con dấu lên server.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Crop className="text-indigo-600"/> Tách Con Dấu (Crop & AI)</h3>
            
            {!file ? (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
                    <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="extract-upload-2" />
                    <label htmlFor="extract-upload-2" className="cursor-pointer flex flex-col items-center">
                        <Upload size={32} className="text-slate-400 mb-2"/>
                        <span className="text-indigo-600 font-medium">Chọn file PDF</span>
                    </label>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                        <div className="bg-slate-100 p-4 rounded-xl flex justify-center overflow-auto relative select-none">
                            <PdfViewer 
                                file={file} 
                                page={page} 
                                onPageChange={setPage} 
                                onClick={() => {}} 
                                containerRef={canvasWrapperRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                overlayContent={
                                    selection && (
                                        <div 
                                            className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none"
                                            style={{
                                                left: selection.x,
                                                top: selection.y,
                                                width: selection.w,
                                                height: selection.h
                                            }}
                                        ></div>
                                    )
                                }
                            />
                        </div>
                        <p className="text-xs text-center text-slate-500 mt-2">Kéo chuột để khoanh vùng con dấu cần tách</p>
                    </div>

                    <div className="w-full lg:w-80 space-y-6">
                         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                             <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Layers size={18}/> Xử lý vùng chọn
                             </h4>
                             
                             {errorMsg && (
                                 <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 animate-in fade-in">
                                     <div className="flex items-center gap-2 font-bold mb-1">
                                         <AlertTriangle size={16} /> Lỗi xử lý
                                     </div>
                                     <p className="mb-2">{errorMsg}</p>
                                     {errorMsg.includes("429") && (
                                         <div className="bg-white p-2 rounded border border-red-100 text-xs text-slate-600 mt-2">
                                             <strong>Mẹo:</strong> Hãy nhập API Key riêng của bạn vào ô bên dưới để tiếp tục sử dụng mà không bị giới hạn.
                                         </div>
                                     )}
                                 </div>
                             )}

                             {/* CUSTOM API KEY INPUT */}
                             <div className="mb-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                    <Key size={10} /> API Key (Tùy chọn)
                                </label>
                                <input
                                    type="password"
                                    value={customApiKey}
                                    onChange={(e) => setCustomApiKey(e.target.value)}
                                    placeholder="Dán Google Gemini API Key vào đây..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder-slate-400"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 italic">
                                    Nếu gặp lỗi 429 (Hết hạn mức), hãy nhập Key riêng để dùng tiếp.
                                </p>
                             </div>

                             <div className="space-y-3">
                                 <button 
                                    onClick={() => processCrop('original')}
                                    disabled={!selection || isProcessing}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                 >
                                    <Crop size={16}/> Cắt Nguyên Bản
                                 </button>
                                 <button 
                                    onClick={() => processCrop('filter')}
                                    disabled={!selection || isProcessing}
                                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border border-emerald-200"
                                 >
                                    <RefreshCw size={16}/> Lọc Nền (Thuật toán)
                                 </button>
                                 <button 
                                    onClick={() => processCrop('ai')}
                                    disabled={!selection || isProcessing}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                                 >
                                    {isProcessing ? <Loader className="animate-spin" size={16}/> : <Wand2 size={16}/>} 
                                    AI Phục Hồi & Gỡ Chữ
                                 </button>
                             </div>
                         </div>

                         {resultImage && (
                             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
                                 <h4 className="font-bold text-slate-800 mb-4">Kết quả</h4>
                                 <div className="bg-[url('https://border-image.com/images/transparent-background-pattern.png')] bg-cover border rounded-lg overflow-hidden mb-4 flex items-center justify-center min-h-[150px] relative">
                                     <img src={resultImage} className="max-w-full max-h-[300px] object-contain" />
                                 </div>
                                 
                                 <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1"><Palette size={12}/> Chế độ màu</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setColorMode('original')}
                                                className={`flex-1 py-1 text-xs rounded border ${colorMode === 'original' ? 'bg-slate-100 border-slate-400 font-bold' : 'border-slate-200 hover:bg-slate-50'}`}
                                            >Gốc</button>
                                            <button 
                                                onClick={() => setColorMode('red')}
                                                className={`flex-1 py-1 text-xs rounded border text-red-600 ${colorMode === 'red' ? 'bg-red-50 border-red-400 font-bold' : 'border-slate-200 hover:bg-red-50'}`}
                                            >Đỏ</button>
                                            <button 
                                                onClick={() => setColorMode('blue')}
                                                className={`flex-1 py-1 text-xs rounded border text-blue-600 ${colorMode === 'blue' ? 'bg-blue-50 border-blue-400 font-bold' : 'border-slate-200 hover:bg-blue-50'}`}
                                            >Xanh</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="flex justify-between text-xs font-semibold text-slate-500 uppercase mb-1">
                                            <span className="flex items-center gap-1"><Droplets size={12}/> Độ tươi (Saturation)</span>
                                            <span>{saturation}x</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            min="0" max="3" step="0.1" 
                                            value={saturation}
                                            onChange={(e) => setSaturation(Number(e.target.value))}
                                            className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div className="pt-2 flex flex-col gap-2">
                                        <button 
                                            onClick={handleRemoveBg}
                                            disabled={isProcessing}
                                            className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <Eraser size={16}/> Tách nền trắng
                                        </button>
                                        <button 
                                            onClick={saveToLibrary}
                                            className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <Save size={16}/> Lưu vào thư viện
                                        </button>
                                        <button 
                                            onClick={downloadResult}
                                            className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <Download size={16}/> Tải xuống PNG
                                        </button>
                                    </div>
                                 </div>
                             </div>
                         )}

                         <button onClick={() => setFile(null)} className="w-full text-slate-400 text-xs hover:text-slate-600 underline">Chọn file khác</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ToolAI: React.FC = () => {
    const [activeTool, setActiveTool] = useState<ToolType | null>(null);
    const [stamps, setStamps] = useState<StampItem[]>([]);

    const renderTool = () => {
        switch (activeTool) {
            case 'split': return <SplitTool />;
            case 'compress': return <CompressTool />;
            case 'merge': return <MergeTool />;
            case 'images_to_pdf': return <ImagesToPdfTool />;
            case 'unlock': return <UnlockTool />;
            case 'edit': return <EditTool />;
            case 'stamp': return <StampTool stamps={stamps} setStamps={setStamps} />;
            case 'extract': return <ExtractStampTool setStamps={setStamps} />;
            default: return null;
        }
    };

    if (activeTool) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                    onClick={() => setActiveTool(null)}
                    className="mb-4 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                >
                    <ArrowLeft size={20} /> Quay lại danh sách công cụ
                </button>
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm min-h-[600px]">
                    {renderTool()}
                </div>
            </div>
        );
    }

    const tools = [
        { id: 'split', name: 'Tách PDF', icon: Scissors, desc: 'Tách file PDF thành nhiều trang nhỏ, hoặc theo range.' },
        { id: 'merge', name: 'Ghép PDF', icon: Merge, desc: 'Gộp nhiều file PDF thành một file duy nhất.' },
        { id: 'compress', name: 'Nén PDF', icon: Minimize2, desc: 'Giảm dung lượng file PDF để dễ chia sẻ.' },
        { id: 'images_to_pdf', name: 'Ảnh sang PDF', icon: Image, desc: 'Chuyển đổi file ảnh (JPG, PNG) sang PDF.' },
        { id: 'unlock', name: 'Mở Khóa PDF', icon: Unlock, desc: 'Xóa mật khẩu bảo vệ khỏi file PDF (nếu biết pass).' },
        { id: 'edit', name: 'Chỉnh Sửa PDF', icon: Edit, desc: 'Thêm văn bản, chú thích vào trang PDF.' },
        { id: 'stamp', name: 'Đóng Dấu (SignLH)', icon: Stamp, desc: 'Chèn chữ ký, mộc, logo hoặc giáp lai nhiều trang.' },
        { id: 'extract', name: 'Tách Con Dấu (AI)', icon: Crop, desc: 'Dùng AI để tách và phục hồi con dấu từ văn bản scan.' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">PDF Tools</h2>
                <p className="text-slate-500">Bộ công cụ xử lý PDF tiện lợi - Xử lý ngay trên trình duyệt, bảo mật tuyệt đối.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id as ToolType)}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left group h-full flex flex-col"
                    >
                        <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                            <tool.icon size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{tool.name}</h3>
                        <p className="text-slate-500 text-sm flex-1">{tool.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};
