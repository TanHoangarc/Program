import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import { Plus, Edit2, Trash2, Search, FileDown, Copy, FileSpreadsheet, Filter, X, Upload, MoreVertical, ChevronLeft, ChevronRight, DollarSign, FileText, Anchor, Box, Wallet } from 'lucide-react';
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
  initialJobId?: string | null;
  onClearTargetJob?: () => void;
}

export const JobEntry: React.FC<JobEntryProps> = ({ 
  jobs, onAddJob, onEditJob, onDeleteJob, customers, onAddCustomer, lines, onAddLine,
  initialJobId, onClearTargetJob
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<BookingSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Menu State with Positioning
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

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
      const target = event.target as Element;
      // Close menu if clicking outside of the menu portal and the trigger button
      if (activeMenuId && 
          !target.closest('.action-menu-portal') && 
          !target.closest('.menu-trigger-btn')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  // ... (Keep existing logic for filters, pagination, etc.) ...
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterJobCode, filterMonth, filterCustomer, filterBooking, filterLine]);

  // Auto-open Job if ID provided
  useEffect(() => {
    if (initialJobId && jobs.length > 0) {
      const jobToView = jobs.find(j => j.id === initialJobId);
      if (jobToView) {
        try {
          const safeJob = JSON.parse(JSON.stringify(jobToView));
          setEditingJob(safeJob);
          setIsViewMode(true);
          setIsModalOpen(true);
        } catch (err) {
          console.error("Error parsing job for view", err);
        }
      }
      if (onClearTargetJob) {
        onClearTargetJob();
      }
    }
  }, [initialJobId, jobs, onClearTargetJob]);

  const handleAddNew = () => {
    setEditingJob(null);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (job: JobData) => {
    setEditingJob(JSON.parse(JSON.stringify(job)));
    setIsViewMode(false);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleRowClick = (job: JobData, e: React.MouseEvent) => {
    // Prevent opening if clicking on menu or buttons
    if ((e.target as Element).closest('.action-menu-container') || (e.target as Element).closest('.menu-trigger-btn')) return;
    
    try {
      const safeJob = JSON.parse(JSON.stringify(job));
      setEditingJob(safeJob);
      setIsViewMode(true);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error parsing job data", err);
    }
  };

  // --- NEW MENU HANDLER WITH POSITIONING ---
  const handleMenuClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeMenuId === id) {
      setActiveMenuId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeightEstimate = 280; // Approximate max height of menu
    
    // Calculate position: Align right edge of menu with right edge of button
    // Menu width is w-48 (12rem = 192px)
    const leftPos = rect.right - 192;

    let style: React.CSSProperties = {
        position: 'fixed',
        left: `${leftPos}px`,
        zIndex: 9999,
        width: '12rem' // w-48
    };

    if (spaceBelow < menuHeightEstimate) {
        // Not enough space below, open UPWARDS
        style.bottom = `${window.innerHeight - rect.top + 5}px`;
        style.transformOrigin = 'bottom right';
    } else {
        // Open DOWNWARDS
        style.top = `${rect.bottom + 5}px`;
        style.transformOrigin = 'top right';
    }

    setMenuStyle(style);
    setActiveMenuId(id);
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
    // ... (Existing import logic) ...
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      let addedCount = 0; let updatedCount = 0;
      data.forEach((row: any) => {
        // ... (Mapping logic same as before) ...
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
          onEditJob({ ...existingJob, ...mappedData, id: existingJob.id, extensions: existingJob.extensions || [], bookingCostDetails: existingJob.bookingCostDetails });
          updatedCount++;
        } else {
          onAddJob({ ...mappedData as JobData, id: Date.now().toString() + Math.random().toString().slice(2,5) });
          addedCount++;
        }
      });
      alert(`Hoàn tất nhập dữ liệu:\n- Thêm mới: ${addedCount}\n- Cập nhật: ${updatedCount}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    // ... (Existing export logic) ...
    const dataToExport = filteredJobs.map(job => {
      const extTotal = (job.extensions || []).reduce((sum, ext) => sum + ext.total, 0);
      const extInvoices = (job.extensions || []).map(ext => ext.invoice).filter(Boolean).join(', ');
      return {
        "Tháng": job.month, "Job Code": job.jobCode, "Booking": job.booking, "Consol": job.consol,
        "Line": job.line, "Customer": job.customerName, "HBL": job.hbl, "Transit": job.transit,
        "Cost": job.cost, "Sell": job.sell, "Profit": job.profit, "Cont 20": job.cont20, "Cont 40": job.cont40,
        "Thu Payment (Local Charge)": job.localChargeTotal, "Invoice Thu": job.localChargeInvoice, "Ngân hàng": job.bank,
        "Mã KH Cược": customers.find(c => c?.id === job.maKhCuocId)?.code || '',
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

  // ... (Filtering & Pagination logic unchanged) ...
  const filteredJobs = useMemo(() => {
    let matches = jobs.filter(job => {
      const jCode = String(job.jobCode || '');
      const jBooking = String(job.booking || '');
      const matchesJobCode = filterJobCode ? jCode.toLowerCase().includes(filterJobCode.toLowerCase()) : true;
      const matchesLine = filterLine ? job.line === filterLine : true;
      const matchesMonth = filterMonth ? job.month === filterMonth : true;
      const matchesCustomer = filterCustomer ? job.customerId === filterCustomer : true;
      const matchesBooking = filterBooking ? jBooking.toLowerCase().includes(filterBooking.toLowerCase()) : true;
      return matchesJobCode && matchesLine && matchesMonth && matchesCustomer && matchesBooking;
    });
    return matches.sort((a, b) => {
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;
      const bookingA = String(a.booking || '').toLowerCase();
      const bookingB = String(b.booking || '').toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterJobCode, filterLine, filterMonth, filterCustomer, filterBooking]);

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const totals = useMemo(() => {
    return filteredJobs.reduce((acc, job) => ({
      cost: acc.cost + job.cost,
      sell: acc.sell + job.sell,
      profit: acc.profit + job.profit,
      cont20: acc.cont20 + job.cont20,
      cont40: acc.cont40 + job.cont40,
    }), { cost: 0, sell: 0, profit: 0, cont20: 0, cont40: 0 });
  }, [filteredJobs]);

  const clearFilters = () => { setFilterJobCode(''); setFilterLine(''); setFilterMonth(''); setFilterCustomer(''); setFilterBooking(''); };
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full h-full pb-10">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 px-2">
         <div>
            <h1 className="text-2xl font-bold text-slate-800">Quản lý Job</h1>
            <p className="text-sm text-slate-500 mt-1">Danh sách tất cả các lô hàng và trạng thái</p>
         </div>
         <div className="flex space-x-3 mt-4 md:mt-0">
           <button onClick={handleImportClick} className="glass-panel px-4 py-2 text-slate-700 rounded-lg text-sm font-medium hover:bg-white/80 flex items-center transition-colors">
              <Upload className="w-4 h-4 mr-2" /> Import
           </button>
           <button onClick={handleExportExcel} className="glass-panel px-4 py-2 text-green-700 rounded-lg text-sm font-bold hover:bg-white/80 flex items-center transition-colors">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
           </button>
           <button onClick={handleAddNew} className="bg-gradient-to-r from-teal-600 to-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:shadow-lg hover:brightness-110 flex items-center transition-all">
              <Plus className="w-4 h-4 mr-2" /> Thêm Job
           </button>
         </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl mb-6 mx-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             {/* ... Filters UI ... */}
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tháng</label>
               <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                 <option value="">Tất cả</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Khách hàng</label>
               <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                 <option value="">Tất cả</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Line</label>
               <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                 <option value="">Tất cả</option>
                 {lines.map((line, idx) => <option key={idx} value={line.code}>{line.code} - {line.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Booking</label>
               <input type="text" placeholder="Tìm Booking..." value={filterBooking} onChange={(e) => setFilterBooking(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Job Code</label>
               <div className="relative">
                  <input type="text" placeholder="Tìm Job..." className="glass-input w-full p-2 pl-9 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-teal-800" value={filterJobCode} onChange={(e) => setFilterJobCode(e.target.value)} />
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
               </div>
             </div>
          </div>
          {(filterMonth || filterCustomer || filterBooking || filterJobCode || filterLine) && (
            <div className="mt-4 flex justify-end">
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-600 flex items-center bg-red-50 px-3 py-1.5 rounded-full border border-red-100"><X className="w-3 h-3 mr-1" /> Xóa bộ lọc</button>
            </div>
          )}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tháng</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Job Code</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Customer</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Booking</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Line</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Cost</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Sell</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Profit</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Cont</th>
                <th className="px-6 py-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {paginatedJobs.length > 0 ? (
                paginatedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/40 cursor-pointer group transition-colors" onClick={(e) => handleRowClick(job, e)}>
                    <td className="px-6 py-4 text-slate-500">T{job.month}</td>
                    <td className="px-6 py-4 font-bold text-teal-700">{job.jobCode}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      <div>{job.customerName}</div>
                      {job.hbl && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100/50 text-orange-700 mt-1 border border-orange-200/50">{job.hbl}</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{job.booking}</td>
                    <td className="px-6 py-4 text-slate-500">{job.line}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.cost)}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.sell)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${job.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(job.profit)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {job.cont20 > 0 && <span className="px-2 py-0.5 bg-blue-100/50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200/50">{job.cont20} x 20'</span>}
                        {job.cont40 > 0 && <span className="px-2 py-0.5 bg-purple-100/50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200/50">{job.cont40} x 40'</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center action-menu-container">
                       <button 
                          onClick={(e) => handleMenuClick(e, job.id)} 
                          className={`p-1.5 rounded-full hover:bg-white/50 text-slate-400 hover:text-slate-600 transition-colors menu-trigger-btn ${activeMenuId === job.id ? 'bg-white shadow-sm text-teal-600' : ''}`}
                        >
                         <MoreVertical className="w-4 h-4" />
                       </button>
                       
                       {/* PORTAL MENU RENDER - FIXED POSITION */}
                       {activeMenuId === job.id && createPortal(
                         <div 
                            className="fixed z-[9999] glass-panel bg-white/95 rounded-xl shadow-2xl border border-white/20 py-1 text-left animate-in fade-in zoom-in-95 duration-100 action-menu-portal"
                            style={menuStyle}
                            onClick={(e) => e.stopPropagation()} // Prevent close on inside click
                         >
                           <button onClick={() => handleDuplicate(job)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-teal-50 flex items-center transition-colors"><Copy className="w-3 h-3 mr-2 text-teal-500" /> Nhân bản</button>
                           <button onClick={() => handleEdit(job)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 flex items-center transition-colors"><Edit2 className="w-3 h-3 mr-2 text-blue-500" /> Chỉnh sửa</button>
                           <div className="border-t border-slate-100 my-1"></div>
                           <button onClick={() => handleQuickReceive(job, 'local')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 font-medium flex items-center transition-colors"><FileText className="w-3 h-3 mr-2 text-indigo-500" /> Thu Local Charge</button>
                           <button onClick={() => handleQuickReceive(job, 'deposit')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-purple-50 font-medium flex items-center transition-colors"><Anchor className="w-3 h-3 mr-2 text-purple-500" /> Thu Cược</button>
                           <button onClick={() => handleQuickReceive(job, 'extension')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-orange-50 font-medium flex items-center transition-colors"><DollarSign className="w-3 h-3 mr-2 text-orange-500" /> Thu Gia Hạn</button>
                           <button onClick={() => handleQuickReceive(job, 'other')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-emerald-50 font-medium flex items-center transition-colors"><Wallet className="w-3 h-3 mr-2 text-emerald-500" /> Thu Khác</button>
                           <div className="border-t border-slate-100 my-1"></div>
                           <button onClick={() => handleDelete(job.id)} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center transition-colors rounded-b-xl"><Trash2 className="w-3 h-3 mr-2" /> Xóa</button>
                         </div>,
                         document.body
                       )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-light">Không tìm thấy dữ liệu phù hợp</td></tr>
              )}
            </tbody>
            {/* Footer Totals */}
            {filteredJobs.length > 0 && (
              <tfoot className="bg-white/30 border-t border-white/40 font-bold text-slate-800 text-xs uppercase">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right">Tổng cộng:</td>
                  <td className="px-6 py-4 text-right text-red-600">{formatCurrency(totals.cost)}</td>
                  <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(totals.sell)}</td>
                  <td className={`px-6 py-4 text-right ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>Trang {currentPage} / {totalPages}</div>
            <div className="flex space-x-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              {paginationRange.map((page, idx) => (
                 page === '...' ? <span key={`dots-${idx}`} className="px-2 py-1.5">...</span> : 
                 <button key={page} onClick={() => setCurrentPage(page as number)} className={`px-3 py-1.5 rounded-lg border border-white/60 font-medium transition-colors ${currentPage === page ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white/40 hover:bg-white/80 text-slate-700'}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && <JobModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingJob} customers={customers} lines={lines} onAddLine={onAddLine} onViewBookingDetails={handleViewBookingDetails} isViewMode={isViewMode} onSwitchToEdit={() => setIsViewMode(false)} existingJobs={jobs} />}
      {viewingBooking && <BookingDetailModal booking={viewingBooking} onClose={() => setViewingBooking(null)} onSave={handleSaveBookingDetails} zIndex="z-[60]" />}
      {isQuickReceiveOpen && quickReceiveJob && <QuickReceiveModal isOpen={isQuickReceiveOpen} onClose={() => setIsQuickReceiveOpen(false)} onSave={handleSaveQuickReceive} job={quickReceiveJob} mode={quickReceiveMode} customers={customers} />}
    </div>
  );
};