
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { FileCheck, Upload, Save, CheckCircle, AlertCircle, Loader2, Eye, Edit3, Banknote, Sparkles, X, RotateCcw, FileText, Mail, Copy, Check, Lock, Unlock } from 'lucide-react';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import { JobModal } from '../components/JobModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
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
  jobId?: string; // Link to actual job if found (can be comma-separated list of IDs)
  previewUrl?: string; // Preview URL for PDF page
  isLocked?: boolean; // Lock status
}

const BACKEND_URL = "https://api.kimberry.id.vn";

export const CVHCPage: React.FC<CVHCPageProps> = ({ 
  jobs, customers, lines, onUpdateJob, onAddLine, onAddCustomer 
}) => {
  const { alert, confirm } = useNotification();
  
  // Load rows from localStorage cache on mount
  const [rows, setRows] = useState<CVHCRow[]>(() => {
    try {
      const cached = localStorage.getItem('cvhc_rows_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(r => ({ ...r, isLocked: !!r.isLocked }));
        }
      }
    } catch (e) {
      console.error("Failed to load CVHC rows cache:", e);
    }
    return [{ id: '1', jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }];
  });

  // Load pageCount from localStorage cache on mount
  const [pageCount, setPageCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('cvhc_page_count_cache');
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 1;
  });

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isScanning, setIsScanning] = useState(false); // For AI Scan
  const [iframePreviewUrl, setIframePreviewUrl] = useState<string | null>(null); // Embedded preview modal
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('cvhc_is_locked_cache');
      return cached === 'true';
    } catch {
      return false;
    }
  });

  // Persist rows and pageCount to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('cvhc_rows_cache', JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save CVHC rows cache:", e);
    }
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem('cvhc_page_count_cache', pageCount.toString());
    } catch {}
  }, [pageCount]);

  useEffect(() => {
    try {
      localStorage.setItem('cvhc_is_locked_cache', isLocked.toString());
    } catch {}
  }, [isLocked]);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedState(prev => ({ ...prev, [key]: false }));
    }, 1500);
  };

  // Modal State
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);

  // Quick Receive (Chi Hoàn Cược) state
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('deposit_refund');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize used document numbers to pass into the modal
  const usedDocNos = useMemo(() => {
    const list: string[] = [];
    jobs.forEach(j => {
      if (j.amisPaymentDocNo) list.push(j.amisPaymentDocNo);
      if (j.amisDepositOutDocNo) list.push(j.amisDepositOutDocNo);
      if (j.amisExtensionPaymentDocNo) list.push(j.amisExtensionPaymentDocNo);
      if (j.amisDepositRefundDocNo) list.push(j.amisDepositRefundDocNo);
      (j.extensions || []).forEach(e => { if (e.amisDocNo) list.push(e.amisDocNo); });
      (j.refunds || []).forEach(r => { if (r.docNo) list.push(r.docNo); });
      (j.additionalReceipts || []).forEach(r => { if (r.docNo) list.push(r.docNo); });
    });
    return list;
  }, [jobs]);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<'edit' | 'refund' | null>(null);

  const handleRowRefundSingle = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setQuickReceiveJob(job);
      setQuickReceiveMode('deposit_refund');
      setIsQuickReceiveOpen(true);
    } else {
      alert("Không tìm thấy dữ liệu Job tương ứng để chi hoàn cược.", "Lỗi");
    }
  };

  const onRowActionClick = (row: CVHCRow, action: 'edit' | 'refund') => {
    if (!row.jobId) return;
    const ids = row.jobId.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 1) {
        if (action === 'edit') {
            handleEditJobClick(ids[0]);
        } else {
            handleRowRefundSingle(ids[0]);
        }
    } else if (ids.length > 1) {
        if (expandedRowId === row.id && expandedAction === action) {
            setExpandedRowId(null);
            setExpandedAction(null);
        } else {
            setExpandedRowId(row.id);
            setExpandedAction(action);
        }
    }
  };

  const handleSaveQuickReceive = (updatedJob: JobData) => {
    onUpdateJob(updatedJob);
    // Auto-refresh coordinates in table
    setRows(prev => prev.map(row => {
      const rowIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
      if (rowIds.includes(updatedJob.id)) {
        const isMain = rowIds[0] === updatedJob.id;
        const updatedRow = { ...row };
        if (isMain) {
          const custId = updatedJob.maKhCuocId || updatedJob.customerId;
          const custName = findCustomer(custId)?.name || updatedJob.customerName;
          updatedRow.customerName = custName;
          updatedRow.customerId = custId;
        }
        return updatedRow;
      }
      return row;
    }));
  };

  // Helper to format currency
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Helper to find job by code
  const findJob = (code: string) => jobs.find(j => j.jobCode.toLowerCase().trim() === code.toLowerCase().trim());

  // Helper to find customer by ID
  const findCustomer = (id: string) => customers.find(c => c.id === id);

  const resetForm = () => {
    setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
    setFile(null);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    try {
      localStorage.removeItem('cvhc_rows_cache');
      localStorage.removeItem('cvhc_page_count_cache');
    } catch {}
  };

  const handleJobCodeChange = (id: string, code: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const codes = code.split(',').map(s => s.trim()).filter(Boolean);
        const matchedJobs = codes.map(c => findJob(c)).filter((j): j is JobData => !!j);

        if (matchedJobs.length > 0) {
          // Found Job(s) -> Auto-fill
          const firstJob = matchedJobs[0];
          const custId = firstJob.maKhCuocId || firstJob.customerId;
          const custName = findCustomer(custId)?.name || firstJob.customerName;
          
          // Sum up the amounts of all found jobs
          const totalAmount = matchedJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
          const jobIds = matchedJobs.map(j => j.id).join(',');

          return {
            ...row,
            jobCode: code,
            jobId: jobIds,
            amount: totalAmount,
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
    setRows(prev => [...prev, { id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      // If only 1 row, just clear it
      setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
    }
  };

  const handlePageCountChange = (count: number) => {
      setPageCount(count);
      setRows(prev => {
          const newRows: CVHCRow[] = [...prev];
          if (count > prev.length) {
              // Add new rows
              for (let i = prev.length; i < count; i++) {
                  newRows.push({ 
                      id: `page-${i}-${Date.now()}`, 
                      jobCode: '', 
                      customerName: '', 
                      customerId: '', 
                      amount: 0, 
                      accountNumber: '',
                      isLocked: false
                  });
              }
          } else if (count < prev.length) {
              // Truncate rows
              return newRows.slice(0, count);
          }
          return newRows;
      });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // AUTO SPLIT PREVIEW FOR PDF
      if (selectedFile.type === 'application/pdf') {
          setIsUploading(true);
          setUploadProgress('Đang phân tích và tách trang...');
          
          try {
              const arrayBuffer = await selectedFile.arrayBuffer();
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              const totalPages = pdfDoc.getPageCount();
              
              setPageCount(totalPages); // Auto update page count input

              const newPreviewUrls: string[] = [];
              for (let i = 0; i < totalPages; i++) {
                  // Create single page PDF for preview
                  const subDoc = await PDFDocument.create();
                  const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
                  subDoc.addPage(copiedPage);
                  const pdfBytes = await subDoc.save();
                  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  newPreviewUrls.push(url);
              }

              // Check if we can merge with existing rows (e.g. on page reload, user selects the same file again)
              if (rows.length === totalPages) {
                  setRows(prev => prev.map((row, i) => ({
                      ...row,
                      previewUrl: newPreviewUrls[i]
                  })));
              } else {
                  const newRows: CVHCRow[] = [];
                  for (let i = 0; i < totalPages; i++) {
                      newRows.push({
                          id: `page-${i}-${Date.now()}`,
                          jobCode: '',
                          customerName: '',
                          customerId: '',
                          amount: 0,
                          accountNumber: '',
                          previewUrl: newPreviewUrls[i],
                          isLocked: false
                      });
                  }
                  setRows(newRows);
              }
          } catch (error) {
              console.error("Error splitting PDF preview:", error);
              alert("Không thể đọc file PDF. Vui lòng kiểm tra lại file.", "Lỗi");
          } finally {
              setIsUploading(false);
              setUploadProgress('');
          }
      } else {
          // Non-PDF (Image, etc.) -> Single row
          setPageCount(1);
          const newPreviewUrl = URL.createObjectURL(selectedFile);
          if (rows.length === 1) {
              setRows(prev => [{
                  ...prev[0],
                  previewUrl: newPreviewUrl
              }]);
          } else {
              setRows([{ 
                  id: Date.now().toString(), 
                  jobCode: '', 
                  customerName: '', 
                  customerId: '', 
                  amount: 0, 
                  accountNumber: '', 
                  previewUrl: newPreviewUrl,
                  isLocked: false
              }]);
          }
      }
    }
  };

  // --- AI SCAN LOGIC ---
  const handleAutoScan = async () => {
      if (isLocked) {
          alert("Bảng dữ liệu đang bị khóa. Vui lòng mở khóa để quét tự điền.", "Thông báo");
          return;
      }
      const rowsToScan = rows.filter(r => r.previewUrl && !r.jobCode.trim());
      if (rowsToScan.length === 0) {
          alert("Không có trang nào có số BL trống và có file đính kèm để quét.", "Thông báo");
          return;
      }

      setIsScanning(true);
      let successCount = 0;

      for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.previewUrl || row.jobCode.trim()) continue;

          try {
              // 1. Fetch Blob
              const response = await fetch(row.previewUrl);
              const blob = await response.blob();
              const mimeType = blob.type || "application/pdf";
              
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

              // 3. Call server-side scan API
              const scanRes = await axios.post(`${BACKEND_URL}/api/cvhc/scan-page`, {
                  base64Data,
                  mimeType
              });

              if (scanRes.data && scanRes.data.success && scanRes.data.data) {
                  const data = scanRes.data.data;

                  // 4. Update Row
                  if (data.jobCode || data.accountNumber) {
                      // If jobCode found, verify against database using existing handleJobCodeChange logic
                      if (data.jobCode) {
                          const codes = data.jobCode.split(',').map((s: string) => s.trim()).filter(Boolean);
                          const matchedJobs = codes.map((c: string) => findJob(c)).filter((j): j is JobData => !!j);
                          
                          setRows(currentRows => currentRows.map(r => {
                              if (r.id === row.id) {
                                  if (matchedJobs.length > 0) {
                                      const firstJob = matchedJobs[0];
                                      const custId = firstJob.maKhCuocId || firstJob.customerId;
                                      const custName = findCustomer(custId)?.name || firstJob.customerName;
                                      const totalAmount = matchedJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
                                      const jobIds = matchedJobs.map(j => j.id).join(',');

                                      return {
                                          ...r,
                                          jobCode: data.jobCode,
                                          jobId: jobIds,
                                          amount: totalAmount,
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
              } else {
                  console.error(`AI Scan API error at page ${i+1}:`, scanRes.data?.error || "Unknown error");
              }

          } catch (e: any) {
              console.error(`AI Scan Error at page ${i+1}:`, e);
              const errMsg = e.response?.data?.error || e.message || "";
              if (errMsg.includes("Missing GEMINI_API_KEY") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("Key")) {
                  alert(`Lỗi máy chủ: Cấu hình API Key của hệ thống chưa chính xác. Chi tiết: ${errMsg}`, "Lỗi cấu hình");
                  break; // stop scanning if configuration is wrong
              }
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
      // IF PDF AND MULTIPLE ROWS: SPLIT PDF
      if (file.type === 'application/pdf' && rows.length > 1) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const actualPageCount = pdfDoc.getPages().length;

          if (actualPageCount !== rows.length) {
              throw new Error(`Số trang PDF (${actualPageCount}) không khớp với số dòng dữ liệu (${rows.length}). Vui lòng kiểm tra lại.`);
          }

          let successCount = 0;

          // Loop through rows and split
          for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              setUploadProgress(`Đang tách và upload trang ${i + 1}/${actualPageCount}...`);

              // Split Page
              const subDoc = await PDFDocument.create();
              const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
              subDoc.addPage(copiedPage);
              const subPdfBytes = await subDoc.save();
              
              // Create File
              const safeJobCode = String(row.jobCode).replace(/[^a-zA-Z0-9-_]/g, ''); 
              const subFileName = `CVHC BL ${safeJobCode}.pdf`;
              const subFile = new File([subPdfBytes], subFileName, { type: 'application/pdf' });

              // Upload
              const result = await uploadSingleFile(subFile, subFileName);

              // Update Jobs mapped to this row
              const jobIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
              const isMulti = jobIds.length > 1;

              for (const jId of jobIds) {
                  const job = jobs.find(j => j.id === jId);
                  if (job) {
                      const finalAmount = isMulti ? job.thuCuoc : row.amount;
                      const updatedJob: JobData = {
                          ...job,
                          thuCuoc: finalAmount,
                          maKhCuocId: row.customerId || job.maKhCuocId,
                          cvhcUrl: result.url,
                          cvhcFileName: result.name
                      };
                      onUpdateJob(updatedJob);
                      successCount++;
                  }
              }
          }
          
          alert(`Hoàn tất! Đã tách file và cập nhật CVHC cho ${successCount} Job.`, "Thành công");

      } else {
          // SINGLE FILE (Image or 1-page PDF or just one row)
          const ext = file.name.split('.').pop() || 'pdf';
          
          const mainJobCode = rows[0]?.jobCode || 'Unknown';
          const safeJobCode = String(mainJobCode).replace(/[^a-zA-Z0-9-_]/g, ''); 
          const svFileName = `CVHC BL ${safeJobCode}.${ext}`;

          setUploadProgress('Đang upload file...');
          const result = await uploadSingleFile(file, svFileName);

          // Update All Rows with SAME File (usually just 1 row now)
          let updatedCount = 0;
          rows.forEach(row => {
              const jobIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
              const isMulti = jobIds.length > 1;

              jobIds.forEach(jId => {
                  const job = jobs.find(j => j.id === jId);
                  if (job) {
                      const finalAmount = isMulti ? job.thuCuoc : row.amount;
                      const updatedJob: JobData = {
                          ...job,
                          thuCuoc: finalAmount, 
                          maKhCuocId: row.customerId || job.maKhCuocId,
                          cvhcUrl: result.url,
                          cvhcFileName: result.name
                      };
                      onUpdateJob(updatedJob);
                      updatedCount++;
                  }
              });
          });
          
          alert(`Đã nộp CVHC thành công cho ${updatedCount} Job! File: ${result.name}`, "Thành công");
      }

      // Reset form
      resetForm(); 

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
                          Vui lòng chọn file PDF nhiều trang hoặc file ảnh đơn lẻ. Hệ thống sẽ tự động nhận diện.
                      </p>
                  </div>
              </div>
              <div className="flex items-center space-x-3">
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden" 
                      accept="*/*"
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

          {!file && rows.some(r => r.previewUrl) && (
              <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start space-x-3 text-amber-800 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                      <span className="font-bold">Đã khôi phục dữ liệu nháp:</span> Hệ thống đã tự động phục hồi dữ liệu từ phiên làm việc trước. Vui lòng <strong className="underline cursor-pointer hover:text-amber-950" onClick={() => fileInputRef.current?.click()}>chọn lại file gốc</strong> để khôi phục ảnh xem trước (Preview) hoặc thực hiện lưu/nộp thành công.
                  </div>
              </div>
          )}

          {/* Page Count Input & AI SCAN */}
          <div className="mb-6 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                  <label className="font-bold text-slate-700">Số lượng trang/Job:</label>
                  <input 
                      type="number" 
                      min="1" 
                      value={pageCount} 
                      disabled={isLocked}
                      onChange={(e) => handlePageCountChange(Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-blue-300 rounded-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs text-slate-500 italic">
                      (Tự động cập nhật khi chọn file PDF)
                  </span>
              </div>
              
              <div className="flex items-center space-x-3">
                  {/* GLOBAL LOCK BUTTON */}
                  <button 
                      type="button"
                      onClick={() => setIsLocked(!isLocked)}
                      className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${isLocked ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                      title={isLocked ? "Mở khóa tất cả các dòng" : "Khóa tất cả các dòng tránh bị thay đổi"}
                  >
                      {isLocked ? <Lock className="w-4 h-4 text-amber-600 animate-pulse" /> : <Unlock className="w-4 h-4 text-slate-500" />}
                      {isLocked ? "Đang Khóa" : "Mở Khóa"}
                  </button>

                  {/* AI SCAN BUTTON */}
                  <button 
                      onClick={handleAutoScan}
                      disabled={isScanning || !file || isLocked}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Tự Điền (Quét Bill & STK)
                  </button>
              </div>
          </div>

          {/* Data Entry Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 mb-6">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-4 py-3 w-16 text-center">Trang</th>
                          <th className="px-4 py-3 w-[360px]">
                              <div className="flex items-center justify-between">
                                  <span>Số BL (Job Code)</span>
                                  {rows.some(r => r.jobCode) && (
                                      <button
                                          type="button"
                                          onClick={() => {
                                              const allCodes = rows.map(r => r.jobCode.trim()).filter(Boolean).join('\n');
                                              if (allCodes) {
                                                  handleCopyText(allCodes, 'col-jobCode');
                                              }
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-all shrink-0"
                                          title="Copy toàn bộ cột Số BL (Job Code) (mỗi dòng một hàng)"
                                      >
                                          {copiedState['col-jobCode'] ? <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                  )}
                              </div>
                          </th>
                          <th className="px-4 py-3">Khách hàng (Cược)</th>
                          <th className="px-4 py-3 w-52 text-right">Số tiền cược</th>
                          <th className="px-4 py-3 w-52">
                              <div className="flex items-center justify-between">
                                  <span>Số tài khoản</span>
                                  {rows.some(r => r.accountNumber) && (
                                      <button
                                          type="button"
                                          onClick={() => {
                                              const allAccounts = rows.map(r => r.accountNumber?.trim()).filter(Boolean).join('\n');
                                              if (allAccounts) {
                                                  handleCopyText(allAccounts, 'col-account');
                                              }
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-all shrink-0"
                                          title="Copy toàn bộ cột Số tài khoản (mỗi dòng một hàng)"
                                      >
                                          {copiedState['col-account'] ? <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                  )}
                              </div>
                          </th>
                          <th className="px-4 py-3 w-16 text-center">Xem</th>
                          <th className="px-4 py-3 w-28 text-center">Chi hoàn</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                          <React.Fragment key={row.id}>
                          <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-center font-bold text-slate-500">
                                  {`Trang ${idx + 1}`}
                              </td>
                              <td className="px-4 py-3">
                                  <div className="relative flex items-center gap-1.5">
                                      <div className="relative flex-1">
                                          <input 
                                              type="text" 
                                              value={row.jobCode}
                                              disabled={isLocked}
                                              onChange={(e) => handleJobCodeChange(row.id, e.target.value)}
                                              placeholder={isLocked ? "Đã khóa" : "Nhập số Job..."}
                                              className={`w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${row.jobId ? 'border-green-300 focus:ring-green-500 bg-green-50 text-green-800' : 'border-slate-300 focus:ring-indigo-500'}`}
                                          />
                                          {row.jobId && <CheckCircle className="w-4 h-4 text-green-600 absolute right-3 top-2.5" />}
                                      </div>
                                      {row.jobCode && (
                                          <>
                                              <button 
                                                  type="button"
                                                  onClick={() => handleCopyText(`PAYMENT HOAN CUOC BL ${row.jobCode} MST 0316113070`, `${row.id}-desc`)}
                                                  className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0"
                                                  title="Copy nội dung chuyển khoản"
                                              >
                                                  {copiedState[`${row.id}-desc`] ? <Check className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4" />}
                                              </button>
                                              <button 
                                                  type="button"
                                                  onClick={() => handleCopyText("doc_hph@kimberryline.com", `${row.id}-email`)}
                                                  className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0"
                                                  title="Copy Email: doc_hph@kimberryline.com"
                                              >
                                                  {copiedState[`${row.id}-email`] ? <Check className="w-4 h-4 text-green-500" /> : <Mail className="w-4 h-4" />}
                                              </button>
                                          </>
                                      )}
                                      {row.jobId && (
                                          <button 
                                              onClick={() => onRowActionClick(row, 'edit')}
                                              disabled={isLocked}
                                              className={`p-2 rounded-lg transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${expandedRowId === row.id && expandedAction === 'edit' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-200'}`}
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
                                      disabled={isLocked}
                                      onChange={(e) => handleRowChange(row.id, 'customerName', e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                      placeholder="Tên khách hàng"
                                  />
                              </td>
                              <td className="px-4 py-3">
                                  <div className="relative flex items-center">
                                      <input 
                                          type="text" 
                                          value={row.amount > 0 ? new Intl.NumberFormat('en-US').format(row.amount) : ''}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                              const val = Number(e.target.value.replace(/,/g, ''));
                                              if(!isNaN(val)) handleRowChange(row.id, 'amount', val);
                                          }}
                                          className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                          placeholder="0"
                                      />
                                      {row.amount > 0 && (
                                          <button
                                              type="button"
                                              onClick={() => handleCopyText(row.amount.toString(), `${row.id}-amount`)}
                                              className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                              title="Copy số tiền cược"
                                          >
                                              {copiedState[`${row.id}-amount`] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-4 py-3">
                                  <div className="relative flex items-center">
                                      <input 
                                          type="text" 
                                          value={row.accountNumber || ''}
                                          disabled={isLocked}
                                          onChange={(e) => handleRowChange(row.id, 'accountNumber', e.target.value)}
                                          className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                          placeholder="STK Ngân hàng"
                                      />
                                      {row.accountNumber && (
                                          <button
                                              type="button"
                                              onClick={() => handleCopyText(row.accountNumber || '', `${row.id}-account`)}
                                              className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                              title="Copy số tài khoản"
                                          >
                                              {copiedState[`${row.id}-account`] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                  {row.previewUrl ? (
                                      <button 
                                        type="button"
                                        onClick={() => setIframePreviewUrl(row.previewUrl || null)}
                                        className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                        title="Xem trực tiếp tài liệu"
                                      >
                                          <Eye className="w-4 h-4" />
                                      </button>
                                  ) : (
                                      <span className="text-slate-300">-</span>
                                  )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                  {row.jobId ? (() => {
                                      const ids = row.jobId.split(',').map(id => id.trim()).filter(Boolean);
                                      const hasUnrefunded = ids.some(id => {
                                          const j = jobs.find(x => x.id === id);
                                          return j && !j.amisDepositRefundDocNo;
                                      });
                                      if (!hasUnrefunded) {
                                          return <span className="text-slate-300">-</span>;
                                      }
                                      return (
                                          <button 
                                            type="button"
                                            onClick={() => onRowActionClick(row, 'refund')}
                                            disabled={isLocked}
                                            className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${expandedRowId === row.id && expandedAction === 'refund' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 border-orange-200/50'}`}
                                            title="Chi hoàn cược cho Job này"
                                          >
                                              <RotateCcw className="w-4 h-4" />
                                          </button>
                                      );
                                  })() : (
                                      <span className="text-slate-300">-</span>
                                  )}
                              </td>
                          </tr>
                          {expandedRowId === row.id && (
                              <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner">
                                  <td colSpan={7} className="p-4">
                                      <div className="flex flex-col gap-2">
                                          <div className="text-sm font-bold text-slate-700 mb-1">
                                              {expandedAction === 'edit' ? 'Chọn Job để Xem/Sửa:' : 'Chọn Job để Chi hoàn cược:'}
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                              {row.jobId!.split(',').map(id => id.trim()).filter(Boolean).map(jId => {
                                                  const job = jobs.find(j => j.id === jId);
                                                  if (!job) return null;
                                                  
                                                  const isRefunded = !!job.amisDepositRefundDocNo;
                                                  if (expandedAction === 'refund' && isRefunded) return null;
                                                  
                                                  return (
                                                      <button
                                                          key={jId}
                                                          onClick={() => {
                                                              if (expandedAction === 'edit') {
                                                                  handleEditJobClick(jId);
                                                              } else {
                                                                  handleRowRefundSingle(jId);
                                                              }
                                                              setExpandedRowId(null);
                                                              setExpandedAction(null);
                                                          }}
                                                          className={`p-3 border rounded-xl text-left hover:bg-white shadow-sm transition-all flex justify-between items-center ${expandedAction === 'edit' ? 'border-blue-200 hover:border-blue-400' : 'border-orange-200 hover:border-orange-400'}`}
                                                      >
                                                          <div>
                                                              <div className="font-bold text-slate-800">{job.jobCode}</div>
                                                              <div className="text-xs text-slate-500 mt-0.5">Tiền cược: {formatCurrency(job.thuCuoc || 0)}</div>
                                                          </div>
                                                          {expandedAction === 'edit' ? <Edit3 className="w-4 h-4 text-blue-500" /> : <RotateCcw className="w-4 h-4 text-orange-500" />}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          )}
                          </React.Fragment>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-3">
                  {isUploading && <span className="text-sm font-bold text-indigo-600 animate-pulse flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin"/> {uploadProgress}</span>}
                  
                  {!isUploading && rows.some(r => r.jobCode || r.accountNumber || r.previewUrl) && (
                      <button 
                          onClick={async () => {
                              if (await confirm("Bạn có chắc chắn muốn xóa toàn bộ dữ liệu nháp hiện tại và đặt lại bảng?", "Xác nhận xóa nháp")) {
                                  resetForm();
                              }
                          }}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-sm transition-all transform active:scale-95 flex items-center"
                      >
                          Xóa nháp
                      </button>
                  )}
              </div>
              <div className="flex space-x-3">
                  <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-sm flex items-center">
                      Tổng tiền: <span className="text-indigo-600 ml-2 text-lg">{formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>

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

      {isQuickReceiveOpen && quickReceiveJob && (
          <QuickReceiveModal 
              isOpen={isQuickReceiveOpen}
              onClose={() => setIsQuickReceiveOpen(false)}
              onSave={handleSaveQuickReceive}
              job={quickReceiveJob}
              mode={quickReceiveMode}
              customers={customers}
              allJobs={jobs}
              usedDocNos={usedDocNos}
              onAddCustomer={onAddCustomer}
          />
      )}

      {/* Embedded Iframe Document Preview Modal */}
      {iframePreviewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                          <Eye className="w-5 h-5 text-indigo-600" />
                          <span className="font-bold text-slate-800 text-lg">Xem trước tài liệu</span>
                      </div>
                      <button 
                          onClick={() => setIframePreviewUrl(null)}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          title="Đóng xem trước"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="flex-1 bg-slate-100 p-2">
                      <iframe 
                          src={iframePreviewUrl} 
                          className="w-full h-full border-0 rounded-lg"
                          title="Document Page Preview"
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
