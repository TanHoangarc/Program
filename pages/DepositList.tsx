
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { JobData, Customer, ShippingLine, BookingSummary, BookingCostDetails } from '../types';
import { Search, Building2, UserCircle, Filter, X, ChevronLeft, ChevronRight, FileCheck, Upload, Loader2, Sparkles, FolderOpen } from 'lucide-react';
import { MONTHS, YEARS } from '../constants';
import { formatDateVN, getPaginationRange, calculateBookingSummary } from '../utils';
import { JobModal } from '../components/JobModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import axios from 'axios';

interface DepositListProps {
  mode: 'line' | 'customer';
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  onEditJob: (job: JobData) => void;
  onAddLine: (line: string) => void;
  onAddCustomer: (customer: Customer) => void;
}

const BACKEND_URL = "https://api.kimberry.id.vn";

export const DepositList: React.FC<DepositListProps> = ({ 
    mode, jobs, customers, lines, onEditJob, onAddLine, onAddCustomer 
}) => {
  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterEntity, setFilterEntity] = useState(''); // Stores Line Name or Job Code Search Text
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString()); 
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals State
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<BookingSummary | null>(null);

  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [targetJobIdForUpload, setTargetJobIdForUpload] = useState<string | null>(null);

  // AI Auto Upload State
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isAutoUploading, setIsAutoUploading] = useState(false);
  const [autoUploadProgress, setAutoUploadProgress] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterEntity, filterMonth, filterYear, mode]);

  // Derived Lists for Dropdowns
  const uniqueLines = useMemo(() => {
    const lines = new Set<string>();
    jobs.forEach(j => {
      if (j.line) lines.add(j.line);
    });
    return Array.from(lines);
  }, [jobs]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterEntity('');
    setFilterMonth('');
    setFilterYear(new Date().getFullYear().toString());
  };

  const hasActiveFilters = filterStatus !== 'all' || filterEntity !== '' || filterMonth !== '' || filterYear !== new Date().getFullYear().toString();

  // --- UPLOAD HANDLERS ---
  const handleUploadClick = (jobId: string) => {
      setTargetJobIdForUpload(jobId);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !targetJobIdForUpload) return;

      const job = jobs.find(j => j.id === targetJobIdForUpload);
      if (!job) return;

      setUploadingId(targetJobIdForUpload);

      try {
          const safeJobCode = job.jobCode.replace(/[^a-zA-Z0-9-_]/g, '');
          const ext = file.name.split('.').pop();
          const fileName = `CVHC_BL_${safeJobCode}_${Date.now()}.${ext}`;

          const formData = new FormData();
          formData.append("fileName", fileName); 
          formData.append("file", file);

          const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data && res.data.success) {
              let uploadedUrl = res.data.cvhcUrl;
              if (uploadedUrl && !uploadedUrl.startsWith('http')) {
                  uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
              }

              const updatedJob = { 
                  ...job, 
                  cvhcUrl: uploadedUrl,
                  cvhcFileName: res.data.fileName || fileName
              };
              
              onEditJob(updatedJob);
              alert("Upload CVHC thành công!");
          } else {
              throw new Error(res.data?.message || "Upload failed");
          }
      } catch (err) {
          console.error("Upload Error:", err);
          alert("Có lỗi xảy ra khi upload file. Vui lòng thử lại.");
      } finally {
          setUploadingId(null);
          setTargetJobIdForUpload(null);
      }
  };

  // --- LOGIC FOR LINE DEPOSIT (HÃNG TÀU) ---
  const lineDeposits = useMemo(() => {
    if (mode !== 'line') return [];
    
    // Filter Jobs by Year First
    const filteredJobs = filterYear ? jobs.filter(j => j.year === Number(filterYear)) : jobs;

    const processedBookings = new Set<string>();
    const depositsList: any[] = [];

    filteredJobs.forEach(job => {
      if (job.booking && !processedBookings.has(job.booking)) {
        processedBookings.add(job.booking);
        
        const details = job.bookingCostDetails;
        if (details && details.deposits && details.deposits.length > 0) {
            let totalAmt = 0;
            let lastDateOut = '';
            let lastDateIn = '';

            details.deposits.forEach(d => {
                totalAmt += d.amount;
                if (d.dateOut) lastDateOut = d.dateOut;
                if (d.dateIn) lastDateIn = d.dateIn;
            });

            const allCompleted = details.deposits.every(d => !!d.dateIn);

            const item = {
                month: job.month,
                year: job.year,
                booking: job.booking,
                line: job.line,
                amount: totalAmt,
                dateOut: lastDateOut,
                dateIn: allCompleted ? lastDateIn : '',
                isCompleted: allCompleted
            };

            depositsList.push(item);
        }
      }
    });

    let result = depositsList.filter(item => {
      const matchMonth = filterMonth ? item.month === filterMonth : true;
      const matchLine = filterEntity ? item.line === filterEntity : true;
      
      let matchStatus = true;
      if (filterStatus === 'pending') matchStatus = !item.isCompleted;
      if (filterStatus === 'completed') matchStatus = item.isCompleted;

      return matchMonth && matchLine && matchStatus;
    });

    return result.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, mode, filterMonth, filterYear, filterEntity, filterStatus]);

  // --- LOGIC FOR CUSTOMER DEPOSIT (KHÁCH HÀNG) ---
  const customerDeposits = useMemo(() => {
    if (mode !== 'customer') return [];
    
    let result = jobs.filter(job => job.thuCuoc > 0);

    result = result.filter(job => {
      const matchYear = filterYear ? job.year === Number(filterYear) : true;
      const matchMonth = filterMonth ? job.month === filterMonth : true;
      
      // SEARCH BY JOB CODE
      const matchJob = filterEntity ? job.jobCode.toLowerCase().includes(filterEntity.toLowerCase()) : true;
      
      let matchStatus = true;
      if (filterStatus === 'pending') matchStatus = !job.ngayThuHoan;
      if (filterStatus === 'completed') matchStatus = !!job.ngayThuHoan;

      return matchYear && matchMonth && matchJob && matchStatus;
    });

    return result.map(job => {
        const customer = customers.find(c => c.id === job.maKhCuocId);
        return {
          id: job.id,
          month: job.month,
          year: job.year,
          jobCode: job.jobCode,
          customerCode: customer ? customer.code : 'N/A',
          customerName: customer ? customer.name : 'Unknown',
          amount: job.thuCuoc,
          dateIn: job.ngayThuCuoc, 
          dateOut: job.ngayThuHoan,
          // NEW: File Link
          cvhcUrl: job.cvhcUrl,
          cvhcFileName: job.cvhcFileName
        };
      })
      .sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, customers, mode, filterMonth, filterYear, filterEntity, filterStatus]);

  // --- AUTO UPLOAD FOLDER ---
  const handleAutoUploadFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsAutoUploading(true);
      let successCount = 0;
      const fileList = Array.from(files);
      
      // Use customerDeposits to target currently filtered/visible jobs that need CVHC
      // FILTER: Only jobs that are Completed (dateOut) AND missing CVHC file
      const targetList = customerDeposits.filter(item => item.dateOut && !item.cvhcUrl); 

      for (let i = 0; i < targetList.length; i++) {
          const item = targetList[i];
          const searchKey = item.jobCode.trim().toLowerCase();
          if (!searchKey) continue;

          // Find file containing job code
          const matchedFile = fileList.find(f => f.name.toLowerCase().includes(searchKey));
          
          if (matchedFile) {
              setAutoUploadProgress(`Đang upload cho Job ${item.jobCode}...`);
              
              try {
                  const safeJobCode = item.jobCode.replace(/[^a-zA-Z0-9-_]/g, '');
                  const ext = matchedFile.name.split('.').pop();
                  const fileName = `CVHC_BL_${safeJobCode}_AUTO_${Date.now()}.${ext}`;

                  const formData = new FormData();
                  formData.append("fileName", fileName);
                  formData.append("file", matchedFile);

                  const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                  });

                  if (res.data && res.data.success) {
                      let uploadedUrl = res.data.cvhcUrl;
                      if (uploadedUrl && !uploadedUrl.startsWith('http')) {
                          uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
                      }

                      // Find original job to update in the main state
                      const originalJob = jobs.find(j => j.id === item.id);
                      if (originalJob) {
                          const updatedJob = { 
                              ...originalJob, 
                              cvhcUrl: uploadedUrl,
                              cvhcFileName: res.data.fileName || fileName
                          };
                          onEditJob(updatedJob);
                          successCount++;
                      }
                  }
              } catch (err) {
                  console.error(`Failed to upload for job ${item.jobCode}`, err);
              }
          }
      }

      alert(`Hoàn tất quét thư mục! Đã cập nhật CVHC cho ${successCount} Job.`);
      setIsAutoUploading(false);
      setAutoUploadProgress('');
      if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const currentList = mode === 'line' ? lineDeposits : customerDeposits;
  const totalAmount = currentList.reduce((sum, item) => sum + item.amount, 0);

  // Pagination Logic
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const paginatedList = currentList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  // --- CLICK HANDLERS ---
  const handleRowClick = (item: any) => {
    if (mode === 'line') {
        const summary = calculateBookingSummary(jobs, item.booking);
        if (summary) setViewingBooking(summary);
    } else {
         const job = jobs.find(j => j.id === item.id);
         if (job) {
             setEditingJob(JSON.parse(JSON.stringify(job)));
             setIsJobModalOpen(true);
         }
    }
  };

  const handleSaveJob = (job: JobData, newCustomer?: Customer) => {
    if (newCustomer) onAddCustomer(newCustomer);
    onEditJob(job);
    setIsJobModalOpen(false);
  };

  const handleSaveBooking = (details: BookingCostDetails, shouldClose: boolean = true) => {
    if (!viewingBooking) return;
    viewingBooking.jobs.forEach(job => {
        const updatedJob = { ...job, bookingCostDetails: details };
        onEditJob(updatedJob);
    });
    
    if (shouldClose) {
       setViewingBooking(null);
    }
  };

  const handleViewBookingFromJob = (bookingId: string) => {
      const summary = calculateBookingSummary(jobs, bookingId);
      if (summary) {
           setViewingBooking(summary);
      }
  };

  return (
    <div className="w-full h-full pb-10">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="*/*" />
      <input 
          type="file" 
          ref={folderInputRef} 
          onChange={handleAutoUploadFolder} 
          className="hidden" 
          {...({ webkitdirectory: "", directory: "" } as any)} 
      />

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div className="flex items-center space-x-3 text-slate-800">
          {mode === 'line' ? (
             <div className="p-2 bg-red-100 text-red-600 rounded-lg shadow-sm">
               <Building2 className="w-6 h-6" />
             </div>
          ) : (
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
               <UserCircle className="w-6 h-6" />
             </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
                {mode === 'line' ? 'Quản lý Cược Hãng Tàu' : 'Quản lý Cược Khách Hàng'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
                {mode === 'line' 
                    ? 'Theo dõi tiền cược đã chi cho hãng tàu theo Booking' 
                    : 'Theo dõi tiền cược đã thu từ khách hàng theo Job'}
            </p>
          </div>
        </div>

        {mode === 'customer' && (
            <div className="flex items-center gap-3">
                {isAutoUploading ? (
                    <span className="text-sm font-bold text-indigo-600 animate-pulse flex items-center bg-white px-3 py-2 rounded-lg shadow-sm border border-indigo-100">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin"/> {autoUploadProgress}
                    </span>
                ) : (
                    <button 
                        onClick={() => folderInputRef.current?.click()}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95"
                    >
                        <FolderOpen className="w-4 h-4" /> <Sparkles className="w-3 h-3 text-yellow-300" /> AI Auto-Match CVHC
                    </button>
                )}
            </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-5 rounded-2xl mb-6 mx-2 flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-wide">
              <Filter className="w-4 h-4 mr-2" />
              Bộ lọc
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 w-full">
               <select 
                 value={filterYear} 
                 onChange={(e) => setFilterYear(e.target.value)}
                 className="glass-input w-full p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
               >
                 <option value="">Tất cả năm</option>
                 {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
               </select>

               <select 
                 value={filterMonth} 
                 onChange={(e) => setFilterMonth(e.target.value)}
                 className="glass-input w-full p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>

               {mode === 'line' ? (
                 <select 
                   value={filterEntity} 
                   onChange={(e) => setFilterEntity(e.target.value)}
                   className="glass-input w-full p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                 >
                   <option value="">Tất cả Hãng Tàu</option>
                   {uniqueLines.map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
               ) : (
                  // Search by Job Code for Customer Mode
                  <div className="relative w-full">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                     <input 
                        type="text"
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        placeholder="Tìm số Job..."
                        className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     />
                  </div>
               )}

               <select 
                 value={filterStatus} 
                 onChange={(e) => setFilterStatus(e.target.value as any)}
                 className={`glass-input w-full p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold
                    ${filterStatus === 'pending' ? 'text-orange-600' : ''}
                    ${filterStatus === 'completed' ? 'text-green-600' : ''}
                 `}
               >
                 <option value="all" className="text-slate-800">Tất cả trạng thái</option>
                 <option value="pending" className="text-orange-600">Chưa hoàn (Pending)</option>
                 <option value="completed" className="text-green-600">Đã hoàn (Completed)</option>
               </select>
            </div>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-1" title="Xóa bộ lọc">
                <X className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Xóa lọc</span>
              </button>
            )}
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto pb-24">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tháng/Năm</th>
                {mode === 'line' ? (
                  <>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Booking</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Line</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Job Code</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Mã KH</th>
                    <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tên Khách Hàng</th>
                  </>
                )}
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Tiền Cược</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Ngày Cược</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Ngày Hoàn</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Trạng Thái</th>
                {mode === 'customer' && <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">File CVHC</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {mode === 'line' ? (
                paginatedList.length > 0 ? (
                  paginatedList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/40 transition-colors cursor-pointer" onClick={() => handleRowClick(item)}>
                      <td className="px-6 py-4 font-medium text-slate-500">T{item.month}/{item.year}</td>
                      <td className="px-6 py-4 text-blue-700 font-bold">{item.booking}</td>
                      <td className="px-6 py-4 text-slate-600">{item.line}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateOut)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateIn)}</td>
                      <td className="px-6 py-4 text-center">
                        {item.isCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100/80 text-green-700 border border-green-200">
                            Đã hoàn
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100/80 text-orange-700 border border-orange-200">
                            Chưa hoàn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-light">Không có dữ liệu phù hợp</td></tr>
                )
              ) : (
                paginatedList.length > 0 ? (
                  paginatedList.map((item) => (
                    <tr key={item.id} className="hover:bg-white/40 transition-colors cursor-pointer" onClick={() => handleRowClick(item)}>
                      <td className="px-6 py-4 font-medium text-slate-500">T{item.month}/{item.year}</td>
                      <td className="px-6 py-4 text-blue-700 font-bold">{item.jobCode}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{item.customerCode}</td>
                      <td className="px-6 py-4 text-slate-700 font-medium truncate max-w-xs" title={item.customerName}>{item.customerName}</td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-600">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateIn)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateOut)}</td>
                      <td className="px-6 py-4 text-center">
                        {item.dateOut ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100/80 text-green-700 border border-green-200">
                            Đã hoàn
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100/80 text-orange-700 border border-orange-200">
                            Chưa hoàn
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                          {uploadingId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mx-auto" />
                          ) : item.cvhcUrl ? (
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.cvhcUrl, '_blank');
                                }}
                                className="text-indigo-600 hover:text-indigo-800 p-1 rounded-md hover:bg-indigo-50 transition-colors flex items-center justify-center mx-auto"
                                title={item.cvhcFileName || "Xem CVHC"}
                              >
                                  <FileCheck className="w-4 h-4" />
                              </button>
                          ) : (
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleUploadClick(item.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors flex items-center justify-center mx-auto border border-red-200"
                                  title="Upload CVHC"
                              >
                                  <Upload className="w-4 h-4" />
                              </button>
                          )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 font-light">Không có dữ liệu phù hợp</td></tr>
                )
              )}
            </tbody>
            {currentList.length > 0 && (
                <tfoot className="bg-white/30 font-bold text-slate-800 uppercase text-xs border-t border-white/40">
                <tr>
                    <td colSpan={mode === 'line' ? 3 : 4} className="px-6 py-4 text-right">Tổng Cộng:</td>
                    <td className="px-6 py-4 text-right text-base text-red-600">{formatCurrency(totalAmount)}</td>
                    <td colSpan={4}></td>
                </tr>
                </tfoot>
            )}
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {currentList.length} items)
            </div>
            <div className="flex space-x-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex space-x-1">
                 {paginationRange.map((page, idx) => (
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 py-1.5 text-slate-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-1.5 rounded-lg border border-white/60 font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                            : 'bg-white/40 hover:bg-white/80 text-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                 ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isJobModalOpen && (
        <JobModal 
          isOpen={isJobModalOpen} 
          onClose={() => setIsJobModalOpen(false)} 
          onSave={handleSaveJob} 
          initialData={editingJob} 
          customers={customers} 
          lines={lines} 
          onAddLine={onAddLine} 
          onViewBookingDetails={handleViewBookingFromJob}
          onAddCustomer={onAddCustomer} // Added
        />
      )}
      
      {viewingBooking && (
        <BookingDetailModal 
            booking={viewingBooking} 
            onClose={() => setViewingBooking(null)} 
            onSave={handleSaveBooking} 
            zIndex="z-[60]" 
        />
      )}

    </div>
  );
};