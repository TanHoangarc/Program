
import React, { useState, useRef } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { FileCheck, Upload, Save, Plus, Trash2, FileText, Layers, FileStack, CheckCircle, AlertCircle, Loader2, Eye, Edit3, Banknote, Sparkles } from 'lucide-react';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import { JobModal } from '../components/JobModal';
import { GoogleGenAI } from "@google/genai";
import { useNotification } from '../contexts/NotificationContext';

interface CVHCPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  onUpdateJob: (job: JobData) => void;
  onAddLine?: (line: string) => void;
  onAddCustomer?: (customer: Customer) => void;
}

interface CVHCRow {
  id: string;
  jobCode: string; // Số BL
  customerName: string;
  customerId: string;
  amount: number;
  accountNumber?: string; // New field: Số tài khoản
  jobId?: string; // Link to actual job if found
  previewUrl?: string; // Preview URL for PDF page
}

const BACKEND_URL = "https://api.kimberry.id.vn";

export const CVHCPage: React.FC<CVHCPageProps> = ({ 
  jobs, customers, lines, onUpdateJob, onAddLine, onAddCustomer 
}) => {
  const { alert, confirm } = useNotification();
  const [mode, setMode] = useState<'single' | 'multi' | 'combined'>('single');
  const [rows, setRows] = useState<CVHCRow[]>([
    { id: '1', jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '' }
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pageCount, setPageCount] = useState<number>(1); // For combined mode
  const [isScanning, setIsScanning] = useState(false); // For AI Scan

  // Modal State
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format currency
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Helper to find job by code
  const findJob = (code: string) => jobs.find(j => j.jobCode.toLowerCase().trim() === code.toLowerCase().trim());

  // Helper to find customer by ID
  const findCustomer = (id: string) => customers.find(c => c.id === id);

  const handleModeChange = (newMode: 'single' | 'multi' | 'combined') => {
    setMode(newMode);
    setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '' }]);
    setFile(null);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleJobCodeChange = (id: string, code: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const job = findJob(code);
        if (job) {
          // Found Job -> Auto-fill
          const custId = job.maKhCuocId || job.customerId;
          const custName = findCustomer(custId)?.name || job.customerName;
          return {
            ...row,
            jobCode: code,
            jobId: job.id,
            amount: job.thuCuoc,
            customerId: custId,
            customerName: custName
          };
        } else {
          // Not found -> just update code, clear others
          return { ...row, jobCode: code, jobId: undefined, amount: 0, customerName: '', customerId: '', previewUrl: row.previewUrl };
        }
      }
      return row;
    }));
  };

  const handleRowChange = (id: string, field: keyof CVHCRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      // If only 1 row, just clear it
      setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '' }]);
    }
  };

  const handlePageCountChange = (count: number) => {
      setPageCount(count);
      // Generate rows based on count
      const newRows: CVHCRow[] = [];
      for(let i=0; i<count; i++) {
          newRows.push({ id: `page-${i}`, jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '' });
      }
      setRows(newRows);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // AUTO SPLIT PREVIEW FOR COMBINED MODE
      if (mode === 'combined' && selectedFile.type === 'application/pdf') {
          setIsUploading(true);
          setUploadProgress('Đang phân tích và tách trang...');
          
          try {
              const arrayBuffer = await selectedFile.arrayBuffer();
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              const totalPages = pdfDoc.getPageCount();
              
              setPageCount(totalPages); // Auto update page count input

              const newRows: CVHCRow[] = [];
              
              for (let i = 0; i < totalPages; i++) {
                  // Create single page PDF for preview
                  const subDoc = await PDFDocument.create();
                  const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
                  subDoc.addPage(copiedPage);
                  const pdfBytes = await subDoc.save();
                  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);

                  newRows.push({
                      id: `page-${i}-${Date.now()}`,
                      jobCode: '',
                      customerName: '',
                      customerId: '',
                      amount: 0,
                      accountNumber: '',
                      previewUrl: url // Attach blob URL
                  });
              }
              setRows(newRows);
          } catch (error) {
              console.error("Error splitting PDF preview:", error);
              alert("Không thể đọc file PDF. Vui lòng kiểm tra lại file.", "Lỗi");
          } finally {
              setIsUploading(false);
              setUploadProgress('');
          }
      }
    }
  };

  // --- AI SCAN LOGIC ---
  const handleAutoScan = async () => {
      if (mode !== 'combined') return;
      
      const rowsToScan = rows.filter(r => r.previewUrl);
      if (rowsToScan.length === 0) {
          alert("Không có trang nào để quét (Cần file PDF ở chế độ Tổng Hợp).", "Thông báo");
          return;
      }

      setIsScanning(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = "gemini-3-flash-preview";

      let successCount = 0;

      for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.previewUrl) continue;

          try {
              // 1. Fetch Blob
              const response = await fetch(row.previewUrl);
              const blob = await response.blob();
              
              // 2. Convert to Base64
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                  reader.onloadend = () => {
                      const base64String = reader.result as string;
                      // Remove data URL prefix (e.g. "data:application/pdf;base64,")
                      const base64Data = base64String.split(',')[1]; 
                      resolve(base64Data);
                  };
                  reader.onerror = reject;
              });
              reader.readAsDataURL(blob);
              const base64Data = await base64Promise;

              // 3. Call AI
              const result = await ai.models.generateContent({
                  model: model,
                  contents: {
                      parts: [
                          { inlineData: { mimeType: "application/pdf", data: base64Data } },
                          { text: "Extract the Bill of Lading Number (B/L No, Job No) and the Beneficiary Account Number (Số tài khoản). If multiple, take the most prominent one. Return ONLY valid JSON: { \"jobCode\": string, \"accountNumber\": string }. If not found, return empty strings." }
                      ]
                  }
              });

              const jsonText = result.text || "";
              const jsonStr = jsonText.replace(/```json|```/g, '').trim();
              const data = JSON.parse(jsonStr);

              // 4. Update Row
              if (data.jobCode || data.accountNumber) {
                  // If jobCode found, verify against database using existing handleJobCodeChange logic
                  if (data.jobCode) {
                      // We can't call handleJobCodeChange directly easily inside loop due to state closure
                      // So we replicate the logic: find job in 'jobs'
                      const foundJob = findJob(data.jobCode);
                      
                      setRows(currentRows => currentRows.map(r => {
                          if (r.id === row.id) {
                              if (foundJob) {
                                  const custId = foundJob.maKhCuocId || foundJob.customerId;
                                  const custName = findCustomer(custId)?.name || foundJob.customerName;
                                  return {
                                      ...r,
                                      jobCode: data.jobCode,
                                      jobId: foundJob.id,
                                      amount: foundJob.thuCuoc,
                                      customerId: custId,
                                      customerName: custName,
                                      accountNumber: data.accountNumber || r.accountNumber
                                  };
                              } else {
                                  return {
                                      ...r,
                                      jobCode: data.jobCode,
                                      accountNumber: data.accountNumber || r.accountNumber
                                  };
                              }
                          }
                          return r;
                      }));
                  } else {
                      // Only update account number
                      setRows(currentRows => currentRows.map(r => 
                          r.id === row.id ? { ...r, accountNumber: data.accountNumber } : r
                      ));
                  }
                  successCount++;
              }

          } catch (e) {
              console.error(`AI Scan Error at page ${i+1}:`, e);
          }
      }

      setIsScanning(false);
      if (successCount > 0) {
          alert(`Đã quét xong! Cập nhật dữ liệu cho ${successCount} dòng.`, "Thành công");
      } else {
          alert("Quét xong nhưng không tìm thấy thông tin phù hợp.", "Thông báo");
      }
  };

  const uploadSingleFile = async (fileToUpload: File, fileName: string): Promise<{ url: string, name: string }> => {
      const formData = new FormData();
      formData.append("fileName", fileName); 
      formData.append("file", fileToUpload);

      const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
          const finalFileName = res.data.fileName || fileName;
          let uploadedUrl = res.data.cvhcUrl;
          if (uploadedUrl && !uploadedUrl.startsWith('http')) {
              uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
          }
          return { url: uploadedUrl, name: finalFileName };
      }
      throw new Error(res.data?.message || "Upload failed");
  };

  // --- BATCH PAYMENT CREATION ---
  const handleBatchCreatePayment = async () => {
      const validRows = rows.filter(r => r.jobId);
      if (validRows.length === 0) {
          alert("Chưa có Job nào được nhận diện (Có số BL hợp lệ) để tạo phiếu chi.", "Thông báo");
          return;
      }

      if (!await confirm(`Bạn có chắc chắn muốn tạo ${validRows.length} phiếu chi hoàn cược nối tiếp cho danh sách này không?`, "Xác nhận tạo phiếu")) return;

      // 1. Calculate base Max Number from existing jobs to ensure sequence
      let maxNum = 0;
      const regex = /^UNC(\d+)$/i;
      
      const checkVal = (val?: string) => {
          if (!val) return;
          const match = val.match(regex);
          if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n) && n > maxNum) maxNum = n;
          }
      };

      jobs.forEach(j => {
          checkVal(j.amisPaymentDocNo);
          checkVal(j.amisDepositOutDocNo);
          checkVal(j.amisExtensionPaymentDocNo);
          checkVal(j.amisDepositRefundDocNo);
          (j.extensions || []).forEach(e => checkVal(e.amisDocNo));
          (j.refunds || []).forEach(r => checkVal(r.docNo));
          (j.additionalReceipts || []).forEach(r => checkVal(r.docNo));
      });

      // 2. Loop and Update
      let count = 0;
      const today = new Date().toISOString().split('T')[0];

      validRows.forEach((row, index) => {
          const job = jobs.find(j => j.id === row.jobId);
          if (job) {
              const nextVal = maxNum + 1 + index;
              const docNo = `UNC${String(nextVal).padStart(5, '0')}`;
              
              const accountDesc = row.accountNumber ? ` - STK: ${row.accountNumber}` : '';

              const updatedJob = {
                  ...job,
                  amisDepositRefundDocNo: docNo,
                  amisDepositRefundDate: today,
                  amisDepositRefundDesc: `Chi hoàn cược BL ${job.jobCode}${accountDesc}`,
                  // Update amount/customer if changed in table
                  thuCuoc: row.amount || job.thuCuoc,
                  maKhCuocId: row.customerId || job.maKhCuocId
              };
              
              onUpdateJob(updatedJob);
              count++;
          }
      });

      alert(`Đã tạo thành công ${count} phiếu chi hoàn cược.\n(Từ UNC${String(maxNum + 1).padStart(5, '0')} đến UNC${String(maxNum + count).padStart(5, '0')})`, "Thành công");
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (!file) {
      alert("Vui lòng chọn file đính kèm!", "Thông báo");
      return;
    }
    const invalidRows = rows.filter(r => !r.jobCode || !r.jobId);
    if (invalidRows.length > 0) {
      alert("Vui lòng nhập đúng Số BL (Job Code) cho tất cả các dòng. Hệ thống cần tìm thấy Job tương ứng.", "Cảnh báo");
      return;
    }

    setIsUploading(true);
    setUploadProgress('Đang xử lý...');

    try {
      // MODE COMBINED: SPLIT PDF
      if (mode === 'combined') {
          if (file.type !== 'application/pdf') {
              throw new Error("Chế độ 'Nộp Tổng Hợp' (Tách trang) chỉ hỗ trợ file PDF.");
          }

          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pageCount = pdfDoc.getPages().length;

          if (pageCount !== rows.length) {
              throw new Error(`Số trang PDF (${pageCount}) không khớp với số dòng dữ liệu (${rows.length}). Vui lòng kiểm tra lại.`);
          }

          let successCount = 0;

          // Loop through rows and split
          for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              setUploadProgress(`Đang tách và upload trang ${i + 1}/${pageCount}...`);

              // Split Page
              const subDoc = await PDFDocument.create();
              const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
              subDoc.addPage(copiedPage);
              const subPdfBytes = await subDoc.save();
              
              // Create File
              const safeJobCode = row.jobCode.replace(/[^a-zA-Z0-9-_]/g, ''); 
              const subFileName = `CVHC BL ${safeJobCode}.pdf`;
              const subFile = new File([subPdfBytes], subFileName, { type: 'application/pdf' });

              // Upload
              const result = await uploadSingleFile(subFile, subFileName);

              // Update Job
              const job = jobs.find(j => j.id === row.jobId);
              if (job) {
                  const updatedJob: JobData = {
                      ...job,
                      thuCuoc: row.amount,
                      maKhCuocId: row.customerId || job.maKhCuocId,
                      cvhcUrl: result.url,
                      cvhcFileName: result.name
                  };
                  onUpdateJob(updatedJob);
                  successCount++;
              }
          }
          
          alert(`Hoàn tất! Đã tách file và cập nhật CVHC cho ${successCount} Job.`, "Thành công");

      } else {
          // MODE SINGLE / MULTI (One file for all)
          const ext = file.name.split('.').pop() || 'pdf';
          let svFileName = '';
          
          if (mode === 'single' || mode === 'multi') {
              const mainJobCode = rows[0]?.jobCode || 'Unknown';
              const safeJobCode = mainJobCode.replace(/[^a-zA-Z0-9-_]/g, ''); 
              svFileName = `CVHC BL ${safeJobCode}.${ext}`;
          }

          setUploadProgress('Đang upload file...');
          const result = await uploadSingleFile(file, svFileName);

          // Update All Rows with SAME File
          let updatedCount = 0;
          rows.forEach(row => {
             const job = jobs.find(j => j.id === row.jobId);
             if (job) {
                 const updatedJob: JobData = {
                     ...job,
                     thuCuoc: row.amount, 
                     maKhCuocId: row.customerId || job.maKhCuocId,
                     cvhcUrl: result.url,
                     cvhcFileName: result.name
                 };
                 onUpdateJob(updatedJob);
                 updatedCount++;
             }
          });
          
          alert(`Đã nộp CVHC thành công cho ${updatedCount} Job! File: ${result.name}`, "Thành công");
      }

      // Reset form
      handleModeChange(mode); 

    } catch (err: any) {
      console.error("Submit Error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      alert(`Có lỗi xảy ra: ${msg}`, "Lỗi");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleEditJobClick = (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
          setEditingJob(JSON.parse(JSON.stringify(job)));
          setIsJobModalOpen(true);
      }
  };

  const handleSaveJobModal = (updatedJob: JobData, newCustomer?: Customer) => {
      onUpdateJob(updatedJob);
      if (newCustomer && onAddCustomer) onAddCustomer(newCustomer);
      setIsJobModalOpen(false);
      
      // Auto refresh the row data based on new job info
      setRows(prev => prev.map(row => {
          if (row.jobId === updatedJob.id) {
              const custId = updatedJob.maKhCuocId || updatedJob.customerId;
              const custName = findCustomer(custId)?.name || updatedJob.customerName;
              return {
                  ...row,
                  jobCode: updatedJob.jobCode,
                  amount: updatedJob.thuCuoc,
                  customerId: custId,
                  customerName: custName
              };
          }
          return row;
      }));
  };

  return (
    <div className="p-8 w-full h-full flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
             <FileCheck className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Nộp CVHC (Công Văn Hoàn Cược)</h1>
        </div>
        <p className="text-slate-500 ml-11">Cập nhật chứng từ hoàn cược cho các lô hàng</p>
      </div>

      {/* Mode Selection */}
      <div className="flex space-x-4 mb-8">
          <button 
            onClick={() => handleModeChange('single')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${mode === 'single' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}
          >
              <FileText className="w-6 h-6" />
              <span className="font-bold">Nộp Từng Job</span>
          </button>
          <button 
            onClick={() => handleModeChange('multi')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${mode === 'multi' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}
          >
              <Layers className="w-6 h-6" />
              <span className="font-bold">Nộp Nhiều Job</span>
          </button>
          <button 
            onClick={() => handleModeChange('combined')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${mode === 'combined' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}
          >
              <FileStack className="w-6 h-6" />
              <span className="font-bold">Nộp Tổng Hợp (Tách trang)</span>
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          
          {/* File Upload Section */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400">
                      <Upload className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-700">File đính kèm (PDF/Image)</h3>
                      <p className="text-xs text-slate-500">
                          {mode === 'combined' ? 'Vui lòng chọn file PDF nhiều trang. Hệ thống sẽ tự động tách và tạo dòng.' : 'File sẽ được lưu vào hệ thống (E:\\ServerData\\CVHC)'}
                      </p>
                  </div>
              </div>
              <div className="flex items-center space-x-3">
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden" 
                      accept={mode === 'combined' ? "application/pdf" : "*/*"}
                  />
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                      {file ? "Đổi File" : "Chọn File"}
                  </button>
                  {file && <span className="text-sm font-medium text-indigo-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> {file.name}</span>}
              </div>
          </div>

          {/* COMBINED MODE: Page Count Input & AI SCAN */}
          {mode === 'combined' && (
              <div className="mb-6 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-blue-500" />
                      <label className="font-bold text-slate-700">Số lượng trang PDF (Số Job):</label>
                      <input 
                          type="number" 
                          min="1" 
                          value={pageCount} 
                          onChange={(e) => handlePageCountChange(Number(e.target.value))}
                          className="w-24 px-3 py-2 border border-blue-300 rounded-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 italic">
                          (Đã tự động đếm số trang từ file PDF của bạn)
                      </span>
                  </div>
                  
                  {/* AI SCAN BUTTON */}
                  <button 
                      onClick={handleAutoScan}
                      disabled={isScanning || !file}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Tự Điền (Quét Bill & STK)
                  </button>
              </div>
          )}

          {/* Data Entry Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 mb-6">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-4 py-3 w-16 text-center">
                              {mode === 'combined' ? 'Trang' : '#'}
                          </th>
                          <th className="px-4 py-3 w-64">Số BL (Job Code)</th>
                          <th className="px-4 py-3">Khách hàng (Cược)</th>
                          <th className="px-4 py-3 w-48 text-right">Số tiền cược</th>
                          {mode === 'combined' && <th className="px-4 py-3 w-48">Số tài khoản</th>}
                          {mode === 'combined' && <th className="px-4 py-3 w-16 text-center">Xem</th>}
                          {(mode === 'multi' || mode === 'single') && <th className="px-4 py-3 w-16 text-center"></th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-center font-bold text-slate-500">
                                  {mode === 'combined' ? `Trang ${idx + 1}` : idx + 1}
                              </td>
                              <td className="px-4 py-3">
                                  <div className="relative flex items-center gap-2">
                                      <div className="relative flex-1">
                                          <input 
                                              type="text" 
                                              value={row.jobCode}
                                              onChange={(e) => handleJobCodeChange(row.id, e.target.value)}
                                              placeholder="Nhập số Job..."
                                              className={`w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 ${row.jobId ? 'border-green-300 focus:ring-green-500 bg-green-50 text-green-800' : 'border-slate-300 focus:ring-indigo-500'}`}
                                          />
                                          {row.jobId && <CheckCircle className="w-4 h-4 text-green-600 absolute right-3 top-2.5" />}
                                      </div>
                                      {row.jobId && (
                                          <button 
                                              onClick={() => handleEditJobClick(row.jobId!)}
                                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                                              title="Xem/Sửa Job"
                                          >
                                              <Edit3 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-4 py-3">
                                  <input 
                                      type="text" 
                                      value={row.customerName}
                                      onChange={(e) => handleRowChange(row.id, 'customerName', e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent"
                                      placeholder="Tên khách hàng"
                                  />
                              </td>
                              <td className="px-4 py-3">
                                  <input 
                                      type="text" 
                                      value={row.amount > 0 ? new Intl.NumberFormat('en-US').format(row.amount) : ''}
                                      onChange={(e) => {
                                          const val = Number(e.target.value.replace(/,/g, ''));
                                          if(!isNaN(val)) handleRowChange(row.id, 'amount', val);
                                      }}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right font-bold text-slate-700"
                                      placeholder="0"
                                  />
                              </td>
                              {mode === 'combined' && (
                                  <td className="px-4 py-3">
                                      <input 
                                          type="text" 
                                          value={row.accountNumber || ''}
                                          onChange={(e) => handleRowChange(row.id, 'accountNumber', e.target.value)}
                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                                          placeholder="STK Ngân hàng"
                                      />
                                  </td>
                              )}
                              {mode === 'combined' && (
                                  <td className="px-4 py-3 text-center">
                                      {row.previewUrl ? (
                                          <a 
                                            href={row.previewUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                            title="Xem trước trang này"
                                          >
                                              <Eye className="w-4 h-4" />
                                          </a>
                                      ) : (
                                          <span className="text-slate-300">-</span>
                                      )}
                                  </td>
                              )}
                              {(mode === 'multi' || mode === 'single') && (
                                  <td className="px-4 py-3 text-center">
                                      {mode === 'multi' && (
                                          <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </td>
                              )}
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <div>
                  {mode === 'multi' && (
                      <button onClick={addRow} className="flex items-center text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
                          <Plus className="w-4 h-4 mr-2" /> Thêm dòng
                      </button>
                  )}
                  {isUploading && <span className="text-sm font-bold text-indigo-600 animate-pulse flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin"/> {uploadProgress}</span>}
              </div>
              <div className="flex space-x-3">
                  <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-sm">
                      Tổng tiền: <span className="text-indigo-600 ml-2 text-lg">{formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>
                  
                  {/* NEW: Batch Payment Button for Combined Mode */}
                  {mode === 'combined' && (
                      <button 
                          onClick={handleBatchCreatePayment}
                          className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 rounded-lg font-bold shadow-sm transition-all flex items-center"
                          title="Tạo phiếu chi hoàn cược cho tất cả các Job trong danh sách"
                      >
                          <Banknote className="w-4 h-4 mr-2" /> Tạo Phiếu Chi
                      </button>
                  )}

                  <button 
                      onClick={handleSubmit}
                      disabled={isUploading}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      <Save className="w-4 h-4 mr-2" /> {isUploading ? 'Đang xử lý...' : 'Lưu & Cập nhật'}
                  </button>
              </div>
          </div>

      </div>

      {isJobModalOpen && editingJob && (
          <JobModal
              isOpen={isJobModalOpen}
              onClose={() => setIsJobModalOpen(false)}
              onSave={handleSaveJobModal}
              initialData={editingJob}
              customers={customers}
              lines={lines}
              onAddLine={onAddLine || (() => {})}
              onAddCustomer={onAddCustomer || (() => {})}
              onViewBookingDetails={() => {}}
              isViewMode={false}
              existingJobs={jobs}
          />
      )}
    </div>
  );
};
