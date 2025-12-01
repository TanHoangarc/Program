
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, FileDown, Copy, FileSpreadsheet, Filter, X, Upload, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { JobData, Customer, BookingSummary, BookingCostDetails, ShippingLine } from '../types';
import { JobModal } from '../components/JobModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { calculateBookingSummary, getPaginationRange, formatDateVN } from '../utils';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';

interface JobEntryProps {
  jobs: JobData[];
  onAddJob: (job: JobData) => void;
  onEditJob: (job: JobData) => void;
  onDeleteJob: (id: string) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  lines: ShippingLine[];
  onAddLine: (line: string) => void;
}

export const JobEntry: React.FC<JobEntryProps> = ({ 
  jobs, onAddJob, onEditJob, onDeleteJob, customers, onAddCustomer, lines, onAddLine
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<BookingSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('local');
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);

  // Filters
  const [filterJobCode, setFilterJobCode] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBooking, setFilterBooking] = useState('');
  const [filterLine, setFilterLine] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterJobCode, filterMonth, filterCustomer, filterBooking, filterLine]);

  const handleAddNew = () => {
    setEditingJob(null);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (job: JobData) => {
    // Deep copy to ensure clean state
    setEditingJob(JSON.parse(JSON.stringify(job)));
    setIsViewMode(false);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleRowClick = (job: JobData, e: React.MouseEvent) => {
    if ((e.target as Element).closest('.action-menu-container')) return;
    
    // CRITICAL FIX: Deep copy job data to prevent "readonly" issues or reference bugs
    // This ensures the Modal gets a completely fresh object
    try {
      const safeJob = JSON.parse(JSON.stringify(job));
      setEditingJob(safeJob);
      setIsViewMode(true);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error parsing job data", err);
      alert("Có lỗi khi mở Job này. Vui lòng kiểm tra lại dữ liệu.");
    }
  };

  const handleDuplicate = (job: JobData) => {
    const newJob: JobData = {
      ...job,
      id: Date.now().toString(),
      jobCode: `${job.jobCode} (Copy)`,
      booking: job.booking ? `${job.booking}` : '',
    };
    onAddJob(newJob);
    setActiveMenuId(null);
  };

  const handleDelete = (id: string) => {
    onDeleteJob(id);
    setActiveMenuId(null);
  };

  const handleQuickReceive = (job: JobData, mode: ReceiveMode) => {
    setQuickReceiveJob(job);
    setQuickReceiveMode(mode);
    setIsQuickReceiveOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveQuickReceive = (updatedJob: JobData) => {
    onEditJob(updatedJob);
  };

  const handleSave = (job: JobData, newCustomer?: Customer) => {
    if (newCustomer) {
      onAddCustomer(newCustomer);
    }
    if (editingJob) {
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
     if (!viewingBooking) return;
     viewingBooking.jobs.forEach(job => {
         const updatedJob = { ...job, bookingCostDetails: updatedDetails };
         onEditJob(updatedJob);
     });
     if (editingJob && editingJob.booking === viewingBooking.bookingId) {
         setEditingJob(prev => prev ? ({ ...prev, bookingCostDetails: updatedDetails }) : null);
     }
     setViewingBooking(null);
  };

  const handleImportClick = () => fileInputRef.current?.click();

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
      
      let addedCount = 0;
      let updatedCount = 0;

      data.forEach((row: any) => {
        const rowJobCode = row['Job'] || row['Job Code'];
        
        const mappedData: Partial<JobData> = {
          month: row['Tháng']?.toString() || '1',
          jobCode: rowJobCode || `IMP-${Date.now()}`,
          booking: row['Booking'] || '',
          consol: row['Consol'] || '',
          line: row['Line'] || '',
          customerName: row['Customer'] || '',
          hbl: row['HBL'] || '',
          transit: row['Transit'] || 'HCM',
          cost: Number(row['Cost']) || 0,
          sell: Number(row['Sell']) || 0,
          profit: Number(row['Profit']) || 0,
          cont20: Number(row['Cont 20']) || 0,
          cont40: Number(row['Cont 40']) || 0,
          chiPayment: Number(row['Chi Payment']) || 0,
          chiCuoc: Number(row['Chi Cược']) || 0,
          ngayChiCuoc: row['Ngày Chi Cược'] || '',
          ngayChiHoan: row['Ngày Chi Hoàn'] || '',
          localChargeTotal: Number(row['Thu Payment (Local Charge)']) || Number(row['Thu Payment']) || 0,
          localChargeInvoice: row['Invoice Thu'] || row['Invoice'] || '',
          bank: row['Ngân hàng'] || '',
          thuCuoc: Number(row['Thu Cược']) || 0,
          ngayThuCuoc: row['Ngày Thu Cược'] || '',
          ngayThuHoan: row['Ngày Thu Hoàn'] || '',
          extensions: []
        };

        const existingJob = jobs.find(j => j.jobCode === mappedData.jobCode);

        if (existingJob) {
          const updatedJob: JobData = {
            ...existingJob,
            ...mappedData,
            id: existingJob.id,
            extensions: existingJob.extensions || [], // FIX: Ensure extensions is an array
            bookingCostDetails: existingJob.bookingCostDetails
          };
          onEditJob(updatedJob);
          updatedCount++;
        } else {
          const newJob: JobData = {
            ...mappedData as JobData,
            id: Date.now().toString() + Math.random().toString().slice(2,5),
          };
          onAddJob(newJob);
          addedCount++;
        }
      });
      alert(`Hoàn tất nhập dữ liệu:\n- Thêm mới: ${addedCount}\n- Cập nhật: ${updatedCount}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredJobs.map(job => {
      const extTotal = (job.extensions || []).reduce((sum, ext) => sum + ext.total, 0);
      const extInvoices = (job.extensions || []).map(ext => ext.invoice).filter(Boolean).join(', ');
      return {
        "Tháng": job.month, "Job Code": job.jobCode, "Booking": job.booking, "Consol": job.consol,
        "Line": job.line, "Customer": job.customerName, "HBL": job.hbl, "Transit": job.transit,
        "Cost": job.cost, "Sell": job.sell, "Profit": job.profit, "Cont 20": job.cont20, "Cont 40": job.cont40,
        "Thu Payment (Local Charge)": job.localChargeTotal, "Invoice Thu": job.localChargeInvoice, "Ngân hàng": job.bank,
        "Mã KH Cược": customers.find(c => c?.id === job.maKhCuocId)?.code || '', // SAFE CHECK
        "Thu Cược": job.thuCuoc,
        "Ngày Thu Cược": formatDateVN(job.ngayThuCuoc),
        "Ngày Thu Hoàn": formatDateVN(job.ngayThuHoan),
        "Thu Gia Hạn": extTotal, "Invoice Gia Hạn": extInvoices
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh Sach Job");
    XLSX.writeFile(wb, `Logistics_Job_Data.xlsx`);
  };

  const filteredJobs = useMemo(() => {
    let matches = jobs.filter(job => {
      // Safe access to properties using String()
      const jCode = String(job.jobCode || '');
      const jBooking = String(job.booking || '');
      
      const matchesJobCode = filterJobCode ? jCode.toLowerCase().includes(filterJobCode.toLowerCase()) : true;
      const matchesLine = filterLine ? job.line === filterLine : true;
      const matchesMonth = filterMonth ? job.month === filterMonth : true;
      const matchesCustomer = filterCustomer ? job.customerId === filterCustomer : true;
      const matchesBooking = filterBooking ? jBooking.toLowerCase().includes(filterBooking.toLowerCase()) : true;
      return matchesJobCode && matchesLine && matchesMonth && matchesCustomer && matchesBooking;
    });

    // Default Sort: Month Descending
    return matches.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, filterJobCode, filterLine, filterMonth, filterCustomer, filterBooking]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  // Totals Calculation (Based on Filtered Data)
  const totals = useMemo(() => {
    return filteredJobs.reduce((acc, job) => ({
      cost: acc.cost + job.cost,
      sell: acc.sell + job.sell,
      profit: acc.profit + job.profit,
      cont20: acc.cont20 + job.cont20,
      cont40: acc.cont40 + job.cont40,
    }), { cost: 0, sell: 0, profit: 0, cont20: 0, cont40: 0 });
  }, [filteredJobs]);

  const clearFilters = () => {
    setFilterJobCode(''); setFilterLine(''); setFilterMonth(''); setFilterCustomer(''); setFilterBooking('');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full h-full pb-10">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
         <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Job</h1>
            <p className="text-sm text-gray-500 mt-1">Danh sách tất cả các lô hàng và trạng thái</p>
         </div>
         <div className="flex space-x-2 mt-4 md:mt-0">
           <button onClick={handleImportClick} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center shadow-sm">
              <Upload className="w-4 h-4 mr-2" /> Import Excel
           </button>
           <button onClick={handleExportExcel} className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Xuất Excel
           </button>
           <button onClick={handleAddNew} className="px-4 py-2 bg-blue-900 text-white rounded-md text-sm font-medium hover:bg-blue-800 flex items-center shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Thêm Job
           </button>
         </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Tháng</label>
               <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none">
                 <option value="">Tất cả</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Khách hàng</label>
               <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none">
                 <option value="">Tất cả</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Line</label>
               <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none">
                 <option value="">Tất cả</option>
                 {lines.map((line, idx) => <option key={idx} value={line.code}>{line.code} - {line.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Booking</label>
               <input type="text" placeholder="Tìm Booking..." value={filterBooking} onChange={(e) => setFilterBooking(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none" />
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1">Job Code</label>
               <div className="relative">
                  <input type="text" placeholder="Tìm Job Code..." className="w-full p-2 pl-8 bg-blue-50/50 border border-blue-200 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none font-medium" value={filterJobCode} onChange={(e) => setFilterJobCode(e.target.value)} />
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-blue-400" />
               </div>
             </div>
          </div>
          {(filterMonth || filterCustomer || filterBooking || filterJobCode || filterLine) && (
            <div className="mt-3 flex justify-end">
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center"><X className="w-3 h-3 mr-1" /> Xóa bộ lọc</button>
            </div>
          )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Tháng</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Job Code</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Customer</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Booking</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Line</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-right">Cost</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-right">Sell</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-right">Profit</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-center">Cont</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-center w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedJobs.length > 0 ? (
              paginatedJobs.map((job) => (
                <tr key={job.id} className="hover:bg-blue-50/30 cursor-pointer group" onClick={(e) => handleRowClick(job, e)}>
                  <td className="px-6 py-3 text-gray-600">T{job.month}</td>
                  <td className="px-6 py-3 font-semibold text-blue-700">{job.jobCode}</td>
                  <td className="px-6 py-3 text-gray-700">
                    <div>{job.customerName}</div>
                    {job.hbl && <div className="text-[10px] text-orange-600 font-medium bg-orange-50 inline-block px-1 rounded border border-orange-100 mt-0.5">{job.hbl}</div>}
                  </td>
                  <td className="px-6 py-3 text-gray-500">{job.booking}</td>
                  <td className="px-6 py-3 text-gray-500">{job.line}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(job.cost)}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(job.sell)}</td>
                  <td className={`px-6 py-3 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(job.profit)}</td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {job.cont20 > 0 && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">{job.cont20} x 20'</span>}
                      {job.cont40 > 0 && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">{job.cont40} x 40'</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center action-menu-container relative">
                     <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === job.id ? null : job.id); }} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                       <MoreVertical className="w-4 h-4" />
                     </button>
                     {activeMenuId === job.id && (
                       <div className="absolute right-8 top-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50 py-1">
                         <button onClick={() => handleDuplicate(job)} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center"><Copy className="w-3 h-3 mr-2" /> Nhân bản</button>
                         <button onClick={() => handleEdit(job)} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center"><Edit2 className="w-3 h-3 mr-2" /> Chỉnh sửa</button>
                         <div className="border-t my-1"></div>
                         <button onClick={() => handleQuickReceive(job, 'local')} className="w-full text-left px-4 py-2 text-xs text-blue-700 hover:bg-gray-50 font-medium">Thu Local Charge</button>
                         <button onClick={() => handleQuickReceive(job, 'deposit')} className="w-full text-left px-4 py-2 text-xs text-blue-700 hover:bg-gray-50 font-medium">Thu Cược</button>
                         <button onClick={() => handleQuickReceive(job, 'extension')} className="w-full text-left px-4 py-2 text-xs text-blue-700 hover:bg-gray-50 font-medium">Thu Gia Hạn</button>
                         <div className="border-t my-1"></div>
                         <button onClick={() => handleDelete(job.id)} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center"><Trash2 className="w-3 h-3 mr-2" /> Xóa</button>
                       </div>
                     )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không tìm thấy dữ liệu</td></tr>
            )}
          </tbody>
          {/* Footer Totals */}
          {filteredJobs.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-300 font-bold text-gray-800 text-xs uppercase">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-right">Tổng cộng (Tất cả kết quả lọc):</td>
                <td className="px-6 py-4 text-right text-red-600">{formatCurrency(totals.cost)}</td>
                <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(totals.sell)}</td>
                <td className={`px-6 py-4 text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[10px]">{totals.cont20} x 20'</span>
                    <span className="text-[10px]">{totals.cont40} x 40'</span>
                  </div>
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Pagination Controls */}
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
        />
      )}
      
      {viewingBooking && <BookingDetailModal booking={viewingBooking} onClose={() => setViewingBooking(null)} onSave={handleSaveBookingDetails} zIndex="z-[60]" />}
      {isQuickReceiveOpen && quickReceiveJob && <QuickReceiveModal isOpen={isQuickReceiveOpen} onClose={() => setIsQuickReceiveOpen(false)} onSave={handleSaveQuickReceive} job={quickReceiveJob} mode={quickReceiveMode} customers={customers} />}
    </div>
  );
};
