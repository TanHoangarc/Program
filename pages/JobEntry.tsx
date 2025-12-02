import React, { useState, useMemo, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine, BookingSummary, BookingCostDetails } from '../types';
import { JobModal } from '../components/JobModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { MONTHS } from '../constants';
import { formatDateVN, getPaginationRange, calculateBookingSummary } from '../utils';
import * as XLSX from 'xlsx';
import { 
  Plus, Search, Filter, Upload, Download, Edit2, Trash2, Eye, 
  MoreHorizontal, ChevronLeft, ChevronRight, DollarSign, FileSpreadsheet, Briefcase
} from 'lucide-react';

interface JobEntryProps {
  jobs: JobData[];
  onAddJob: (job: JobData) => void;
  onEditJob: (job: JobData) => void;
  onDeleteJob: (id: string) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  lines: ShippingLine[];
  onAddLine: (line: string) => void;
  initialJobId: string | null;
  onClearTargetJob: () => void;
}

export const JobEntry: React.FC<JobEntryProps> = ({ 
  jobs, onAddJob, onEditJob, onDeleteJob, customers, onAddCustomer, lines, onAddLine,
  initialJobId, onClearTargetJob
}) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  const [viewingBooking, setViewingBooking] = useState<BookingSummary | null>(null);

  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('local');

  // Dropdown menu state for specific job row
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-open job if ID provided (e.g. from Dashboard)
  useEffect(() => {
    if (initialJobId) {
      const found = jobs.find(j => j.id === initialJobId);
      if (found) {
        setEditingJob(found);
        setIsViewMode(true);
        setIsModalOpen(true);
      }
      onClearTargetJob();
    }
  }, [initialJobId, jobs, onClearTargetJob]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, searchTerm]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchMonth = filterMonth ? job.month === filterMonth : true;
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || 
        (job.jobCode || '').toLowerCase().includes(term) ||
        (job.booking || '').toLowerCase().includes(term) ||
        (job.customerName || '').toLowerCase().includes(term) ||
        (job.line || '').toLowerCase().includes(term);
      
      return matchMonth && matchSearch;
    }).sort((a, b) => {
       // Sort by Month Desc, then Job Code Desc
       // Changed to: Month Desc -> Booking Asc (Trimmed) as per requirement
       const mDiff = Number(b.month) - Number(a.month);
       if (mDiff !== 0) return mDiff;
       
       const bookingA = String(a.booking || '').trim().toLowerCase();
       const bookingB = String(b.booking || '').trim().toLowerCase();
       return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const handleAddNew = () => {
    setEditingJob(null);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (job: JobData) => {
    setEditingJob(job);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleView = (job: JobData) => {
    setEditingJob(job);
    setIsViewMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    onDeleteJob(id);
  };

  const handleSave = (job: JobData, newCust?: Customer) => {
    if (newCust) {
      onAddCustomer(newCust);
    }
    
    if (editingJob && editingJob.id) {
      onEditJob(job);
    } else {
      onAddJob(job);
    }
    setIsModalOpen(false);
  };

  const handleViewBookingDetails = (bookingId: string) => {
     const summary = calculateBookingSummary(jobs, bookingId);
     if (summary) {
        setViewingBooking(summary);
     }
  };

  const handleSaveBookingDetails = (updatedDetails: BookingCostDetails) => {
      if (viewingBooking) {
          // Update all jobs with this booking
          const jobsToUpdate = jobs.filter(j => j.booking === viewingBooking.bookingId);
          jobsToUpdate.forEach(job => {
              onEditJob({ ...job, bookingCostDetails: updatedDetails });
          });
          setViewingBooking(prev => prev ? ({ ...prev, costDetails: updatedDetails }) : null);
      }
  };

  const handleQuickReceive = (job: JobData, mode: ReceiveMode) => {
      setQuickReceiveJob(job);
      setQuickReceiveMode(mode);
      setIsQuickReceiveOpen(true);
  };

  const handleSaveQuickReceive = (updatedJob: JobData) => {
      onEditJob(updatedJob);
      setIsQuickReceiveOpen(false);
      setQuickReceiveJob(null);
  };

  // --- EXCEL ---
  const handleExportExcel = () => {
      const headers = [
          'Tháng', 'Job Code', 'Booking', 'Khách Hàng', 'Line', 'Cont 20', 'Cont 40', 
          'Cost', 'Sell', 'Profit', 
          'Số HĐ (Thu)', 'Ngày HĐ', 'Số Tiền (Thu Local)',
          'Mã KH Cược', 'Thu Cược', 'Ngày Thu Cược', 'Ngày Thu Hoàn',
          'Thu Gia Hạn', 'Invoice Gia Hạn'
      ];
      
      const rows = filteredJobs.map(j => {
          const extTotal = (j.extensions || []).reduce((sum, ext) => sum + ext.total, 0);
          const extInvoices = (j.extensions || []).map(ext => ext.invoice).filter(Boolean).join(', ');
          // Safe customer code lookup
          const customerCode = customers.find(c => c?.id === j.maKhCuocId)?.code || '';

          return [
            j.month, j.jobCode, j.booking, j.customerName, j.line, j.cont20, j.cont40,
            j.cost, j.sell, j.profit,
            j.localChargeInvoice, j.localChargeDate, j.localChargeTotal,
            customerCode, j.thuCuoc, formatDateVN(j.ngayThuCuoc), formatDateVN(j.ngayThuHoan),
            extTotal, extInvoices
          ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Job_Data");
      XLSX.writeFile(wb, `Job_List_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          let count = 0;
          data.forEach((row: any) => {
             // Basic mapping logic - customize based on actual excel format
             const newJob: any = {
                 id: Date.now().toString() + Math.random().toString().slice(2,5),
                 month: row['Tháng']?.toString() || '1',
                 jobCode: row['Job Code'] || '',
                 booking: row['Booking'] || '',
                 customerName: row['Khách Hàng'] || '',
                 line: row['Line'] || '',
                 cont20: Number(row['Cont 20']) || 0,
                 cont40: Number(row['Cont 40']) || 0,
                 cost: Number(row['Cost']) || 0,
                 sell: Number(row['Sell']) || 0,
                 // ... other fields default
                 profit: (Number(row['Sell']) || 0) - (Number(row['Cost']) || 0),
                 extensions: []
             };
             
             // Try to match customer
             const cust = customers.find(c => c.name.toLowerCase() === newJob.customerName.toLowerCase());
             if (cust) {
                 newJob.customerId = cust.id;
             }

             if (newJob.jobCode) {
                 onAddJob(newJob);
                 count++;
             }
          });
          alert(`Đã nhập ${count} jobs thành công!`);
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsBinaryString(file);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full h-full pb-10">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />

      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-blue-600" />
            Quản Lý Job
          </h1>
          <p className="text-slate-500 mt-1">Quản lý danh sách Job, doanh thu và chi phí</p>
        </div>
        
        <div className="flex space-x-2">
           <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm">
             <Upload className="w-4 h-4 mr-2" /> Import
           </button>
           <button onClick={handleExportExcel} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm">
             <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Export
           </button>
           <button onClick={handleAddNew} className="bg-blue-900 text-white hover:bg-blue-800 px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-md transition-colors">
             <Plus className="w-4 h-4 mr-2" /> Thêm Job Mới
           </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
         <div className="flex items-center space-x-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
               value={filterMonth} 
               onChange={(e) => setFilterMonth(e.target.value)}
               className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48"
            >
               <option value="">Tất cả các tháng</option>
               {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
         </div>
         <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
               type="text" 
               placeholder="Tìm kiếm Job Code, Booking, Khách hàng..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible min-h-[400px]">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
                  <tr>
                     <th className="px-6 py-4">Tháng</th>
                     <th className="px-6 py-4">Job Code</th>
                     <th className="px-6 py-4">Booking</th>
                     <th className="px-6 py-4">Khách Hàng</th>
                     <th className="px-6 py-4 text-center">Cont</th>
                     <th className="px-6 py-4 text-right">Cost</th>
                     <th className="px-6 py-4 text-right">Sell</th>
                     <th className="px-6 py-4 text-right">Profit</th>
                     <th className="px-6 py-4 text-center">Thao Tác</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {paginatedJobs.length > 0 ? (
                     paginatedJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-blue-50/30 transition-colors group">
                           <td className="px-6 py-4 text-gray-500 font-medium">T{job.month}</td>
                           <td className="px-6 py-4 font-bold text-blue-700 cursor-pointer hover:underline" onClick={() => handleView(job)}>
                              {job.jobCode}
                           </td>
                           <td className="px-6 py-4 text-gray-600 font-mono">
                              {job.booking ? (
                                 <span 
                                    className="cursor-pointer hover:text-blue-600 border-b border-dashed border-gray-400 hover:border-blue-600"
                                    onClick={(e) => { e.stopPropagation(); handleViewBookingDetails(job.booking); }}
                                    title="Xem chi tiết Booking"
                                 >
                                    {job.booking}
                                 </span>
                              ) : '-'}
                           </td>
                           <td className="px-6 py-4 text-gray-800 font-medium max-w-xs truncate" title={job.customerName}>
                              {job.customerName}
                           </td>
                           <td className="px-6 py-4 text-center text-xs">
                              {job.cont20 > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">20': {job.cont20}</span>}
                              {job.cont40 > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">40': {job.cont40}</span>}
                              {job.cont20 === 0 && job.cont40 === 0 && <span className="text-gray-300">-</span>}
                           </td>
                           <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(job.cost)}</td>
                           <td className="px-6 py-4 text-right text-blue-600 font-medium">{formatCurrency(job.sell)}</td>
                           <td className={`px-6 py-4 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(job.profit)}
                           </td>
                           <td className="px-6 py-4 text-center relative">
                              <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                 <button 
                                    onClick={() => setOpenActionMenuId(openActionMenuId === job.id ? null : job.id)}
                                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                 >
                                    <MoreHorizontal className="w-5 h-5" />
                                 </button>
                                 
                                 {openActionMenuId === job.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10 py-1 text-left animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                       <button onClick={() => { handleView(job); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                          <Eye className="w-4 h-4 mr-2 text-gray-400" /> Xem chi tiết
                                       </button>
                                       <button onClick={() => { handleEdit(job); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                          <Edit2 className="w-4 h-4 mr-2 text-blue-500" /> Chỉnh sửa
                                       </button>
                                       <div className="border-t border-gray-100 my-1"></div>
                                       <button onClick={() => { handleQuickReceive(job, 'local'); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                          <DollarSign className="w-4 h-4 mr-2 text-green-500" /> Thu Local Charge
                                       </button>
                                       <button onClick={() => { handleQuickReceive(job, 'deposit'); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                          <DollarSign className="w-4 h-4 mr-2 text-orange-500" /> Thu Cược
                                       </button>
                                       <button onClick={() => { handleQuickReceive(job, 'extension'); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                          <DollarSign className="w-4 h-4 mr-2 text-purple-500" /> Thu Gia Hạn
                                       </button>
                                       <div className="border-t border-gray-100 my-1"></div>
                                       <button onClick={() => { handleDelete(job.id); setOpenActionMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                                          <Trash2 className="w-4 h-4 mr-2" /> Xóa Job
                                       </button>
                                    </div>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ))
                  ) : (
                     <tr>
                        <td colSpan={9} className="text-center py-12 text-gray-400">
                           {searchTerm ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu Job'}
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>

         {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
               <div>
                  Trang {currentPage} / {totalPages} (Tổng {filteredJobs.length} jobs)
               </div>
               <div className="flex space-x-2 items-center">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex space-x-1">
                     {paginationRange.map((page, idx) => (
                        page === '...' ? (
                           <span key={`dots-${idx}`} className="px-2 py-1.5 text-gray-400">...</span>
                        ) : (
                           <button
                              key={page}
                              onClick={() => setCurrentPage(page as number)}
                              className={`px-3 py-1.5 rounded border text-xs font-medium ${
                                 currentPage === page
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                     className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
         )}
      </div>

      {isModalOpen && (
        <JobModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
          initialData={editingJob} 
          customers={customers} 
          lines={lines} 
          onAddLine={onAddLine} 
          onViewBookingDetails={handleViewBookingDetails} 
          isViewMode={isViewMode} 
          onSwitchToEdit={() => setIsViewMode(false)} 
          jobs={jobs} // Passed here for duplicate check
        />
      )}
      
      {viewingBooking && (
         <BookingDetailModal 
            booking={viewingBooking} 
            onClose={() => setViewingBooking(null)} 
            onSave={handleSaveBookingDetails} 
            zIndex="z-[60]" 
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
         />
      )}
    </div>
  );
};
