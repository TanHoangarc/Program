
import React, { useState, useRef } from 'react';
import { JobData, Customer } from '../types';
import { FileCheck, Upload, Save, Plus, Trash2, FileText, Layers, FileStack, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface CVHCPageProps {
  jobs: JobData[];
  customers: Customer[];
  onUpdateJob: (job: JobData) => void;
}

interface CVHCRow {
  id: string;
  jobCode: string; // Số BL
  customerName: string;
  customerId: string;
  amount: number;
  jobId?: string; // Link to actual job if found
}

const BACKEND_URL = "https://api.kimberry.id.vn";

export const CVHCPage: React.FC<CVHCPageProps> = ({ jobs, customers, onUpdateJob }) => {
  const [mode, setMode] = useState<'single' | 'multi' | 'combined'>('single');
  const [rows, setRows] = useState<CVHCRow[]>([
    { id: '1', jobCode: '', customerName: '', customerId: '', amount: 0 }
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pageCount, setPageCount] = useState<number>(1); // For combined mode

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format currency
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Helper to find job by code
  const findJob = (code: string) => jobs.find(j => j.jobCode.toLowerCase().trim() === code.toLowerCase().trim());

  // Helper to find customer by ID
  const findCustomer = (id: string) => customers.find(c => c.id === id);

  const handleModeChange = (newMode: 'single' | 'multi' | 'combined') => {
    setMode(newMode);
    setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0 }]);
    setFile(null);
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
          return { ...row, jobCode: code, jobId: undefined, amount: 0, customerName: '', customerId: '' };
        }
      }
      return row;
    }));
  };

  const handleRowChange = (id: string, field: keyof CVHCRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0 }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      // If only 1 row, just clear it
      setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0 }]);
    }
  };

  const handlePageCountChange = (count: number) => {
      setPageCount(count);
      // Generate rows based on count
      const newRows: CVHCRow[] = [];
      for(let i=0; i<count; i++) {
          newRows.push({ id: `page-${i}`, jobCode: '', customerName: '', customerId: '', amount: 0 });
      }
      setRows(newRows);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (!file) {
      alert("Vui lòng chọn file đính kèm!");
      return;
    }
    const invalidRows = rows.filter(r => !r.jobCode || !r.jobId);
    if (invalidRows.length > 0) {
      alert("Vui lòng nhập đúng Số BL (Job Code) cho tất cả các dòng. Hệ thống cần tìm thấy Job tương ứng.");
      return;
    }

    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'pdf';
      let svFileName = '';
      
      // Determine filename based on mode
      if (mode === 'single' || mode === 'multi') {
          // Use the first job code as the file identifier
          // Filename format: CVHC BL [JobCode].[ext]
          const mainJobCode = rows[0]?.jobCode || 'Unknown';
          // Sanitize job code to be safe for filenames
          const safeJobCode = mainJobCode.replace(/[^a-zA-Z0-9-_]/g, ''); 
          svFileName = `CVHC BL ${safeJobCode}.${ext}`;
      } else {
          svFileName = `CVHC_TongHop_${Date.now()}.${ext}`;
      }

      // 2. Upload File using specific /upload-cvhc endpoint
      const formData = new FormData();
      // CRITICAL: Append text fields BEFORE file so multer diskStorage can access req.body.fileName
      formData.append("fileName", svFileName); 
      formData.append("file", file);

      // Use the specific endpoint for CVHC
      const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data && res.data.success) {
         // Server returns { success: true, fileName: "...", cvhcUrl: "..." }
         const finalFileName = res.data.fileName || svFileName;
         let uploadedUrl = res.data.cvhcUrl;
         
         // Construct absolute URL if relative
         if (uploadedUrl && !uploadedUrl.startsWith('http')) {
             uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
         }
         
         // 3. Update Jobs
         let updatedCount = 0;
         rows.forEach(row => {
             const job = jobs.find(j => j.id === row.jobId);
             if (job) {
                 const updatedJob: JobData = {
                     ...job,
                     thuCuoc: row.amount, // Update amount if edited
                     // Update customer if needed
                     maKhCuocId: row.customerId || job.maKhCuocId,
                     
                     // LINK FILE
                     cvhcUrl: uploadedUrl,
                     cvhcFileName: finalFileName
                 };
                 onUpdateJob(updatedJob);
                 updatedCount++;
             }
         });

         alert(`Đã nộp CVHC thành công cho ${updatedCount} Job! File: ${finalFileName}`);
         
         // Reset form
         handleModeChange(mode); 

      } else {
          throw new Error(res.data?.message || "Upload failed without success flag");
      }

    } catch (err: any) {
      console.error("Submit Error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      alert(`Có lỗi khi nộp CVHC: ${msg}\n(Kiểm tra lại kết nối mạng hoặc endpoint /upload-cvhc)`);
    } finally {
      setIsUploading(false);
    }
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
              <span className="font-bold">Nộp Tổng Hợp</span>
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          
          {/* File Upload Section (Top for Combined, Bottom for others? Standardizing to Top for consistency) */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400">
                      <Upload className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-700">File đính kèm (PDF/Image)</h3>
                      <p className="text-xs text-slate-500">File sẽ được lưu vào hệ thống (E:\ServerData\CVHC)</p>
                  </div>
              </div>
              <div className="flex items-center space-x-3">
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden" 
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

          {/* COMBINED MODE: Page Count Input */}
          {mode === 'combined' && (
              <div className="mb-6 flex items-center space-x-3">
                  <label className="font-bold text-slate-700">Số lượng trang / dòng:</label>
                  <input 
                      type="number" 
                      min="1" 
                      value={pageCount} 
                      onChange={(e) => handlePageCountChange(Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 italic">(Nhập số lượng dòng cần điền thông tin)</span>
              </div>
          )}

          {/* Data Entry Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 mb-6">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-4 py-3 w-12 text-center">#</th>
                          <th className="px-4 py-3 w-64">Số BL (Job Code)</th>
                          <th className="px-4 py-3">Khách hàng (Cược)</th>
                          <th className="px-4 py-3 w-48 text-right">Số tiền cược</th>
                          {(mode === 'multi' || mode === 'single') && <th className="px-4 py-3 w-16 text-center"></th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3">
                                  <div className="relative">
                                      <input 
                                          type="text" 
                                          value={row.jobCode}
                                          onChange={(e) => handleJobCodeChange(row.id, e.target.value)}
                                          placeholder="Nhập số Job..."
                                          className={`w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 ${row.jobId ? 'border-green-300 focus:ring-green-500 bg-green-50 text-green-800' : 'border-slate-300 focus:ring-indigo-500'}`}
                                      />
                                      {row.jobId && <CheckCircle className="w-4 h-4 text-green-600 absolute right-3 top-2.5" />}
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
              </div>
              <div className="flex space-x-3">
                  <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-sm">
                      Tổng tiền: <span className="text-indigo-600 ml-2 text-lg">{formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>
                  <button 
                      onClick={handleSubmit}
                      disabled={isUploading}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95 flex items-center"
                  >
                      <Save className="w-4 h-4 mr-2" /> {isUploading ? 'Đang lưu...' : 'Lưu & Cập nhật'}
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
};
