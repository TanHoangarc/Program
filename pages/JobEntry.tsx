
import React, { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, FileDown, Copy, FileSpreadsheet, Filter, X, Upload, MoreVertical, DollarSign, CreditCard, Clock, Ship } from 'lucide-react';
import { JobData, Customer, BookingSummary, BookingCostDetails } from '../types';
import { JobModal } from '../components/JobModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { calculateBookingSummary } from '../utils';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';

interface JobEntryProps {
  jobs: JobData[];
  onAddJob: (job: JobData) => void;
  onEditJob: (job: JobData) => void;
  onDeleteJob: (id: string) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  lines: string[];
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
  
  // Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Quick Receive Modal State
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('local');
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);

  // Filters
  const [filterJobCode, setFilterJobCode] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBooking, setFilterBooking] = useState('');
  const [filterLine, setFilterLine] = useState('');

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  const handleAddNew = () => {
    setEditingJob(null);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (job: JobData) => {
    setEditingJob(job);
    setIsViewMode(false);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleRowClick = (job: JobData, e: React.MouseEvent) => {
    // Prevent opening View Mode if clicking on Action column or Checkboxes (if any)
    if ((e.target as Element).closest('.action-menu-container')) return;
    
    setEditingJob(job);
    setIsViewMode(true);
    setIsModalOpen(true);
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

  // --- IMPORT EXCEL ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
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
      
      let addedCount = 0;
      let updatedCount = 0;

      data.forEach((row: any) => {
        const rowJobCode = row['Job'] || row['Job Code'];
        
        // Basic mapping
        const mappedData: Partial<JobData> = {
          month: row['Tháng']?.toString() || '1',
          jobCode: rowJobCode || `IMP-${Date.now()}`,
          booking: row['Booking'] || '',
          consol: row['Consol'] || '',
          line: row['Line'] || '',
          customerId: '', // Needs lookup in real world, skipping for simple import
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

          // Fixed mapping keys here to match Export headers
          localChargeTotal: Number(row['Thu Payment (Local Charge)']) || Number(row['Thu Payment']) || 0,
          localChargeInvoice: row['Invoice Thu'] || row['Invoice'] || '',
          
          bank: row['Ngân hàng'] || '',
          localChargeDate: '', 
          localChargeNet: 0,
          localChargeVat: 0,

          maKhCuocId: '',
          thuCuoc: Number(row['Thu Cược']) || 0,
          ngayThuCuoc: row['Ngày Thu Cược'] || '',
          ngayThuHoan: row['Ngày Thu Hoàn'] || '',
          
          extensions: []
        };

        // Check if Job already exists
        const existingJob = jobs.find(j => j.jobCode === mappedData.jobCode);

        if (existingJob) {
          // Update existing job
          const updatedJob: JobData = {
            ...existingJob,
            ...mappedData,
            id: existingJob.id, // Keep existing ID
            // Preserve deeper structures if import doesn't have them
            extensions: existingJob.extensions,
            bookingCostDetails: existingJob.bookingCostDetails
          };
          onEditJob(updatedJob);
          updatedCount++;
        } else {
          // Add new job
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

  // --- EXPORT EXCEL (.XLSX) ---
  const handleExportExcel = () => {
    // Map data to simpler object structure for Excel
    const dataToExport = filteredJobs.map(job => ({
      "Tháng": job.month,
      "Job Code": job.jobCode,
      "Booking": job.booking,
      "Consol": job.consol,
      "Line": job.line,
      "Customer": job.customerName,
      "HBL": job.hbl,
      "Transit": job.transit,
      "Cost": job.cost,
      "Sell": job.sell,
      "Profit": job.profit,
      "Cont 20": job.cont20,
      "Cont 40": job.cont40,
      "Chi Payment": job.chiPayment,
      "Chi Cược": job.chiCuoc,
      "Ngày Chi Cược": job.ngayChiCuoc,
      "Ngày Chi Hoàn": job.ngayChiHoan,
      "Thu Payment (Local Charge)": job.localChargeTotal,
      "Invoice Thu": job.localChargeInvoice,
      "Ngân hàng": job.bank,
      "Mã KH Cược": customers.find(c => c.id === job.maKhCuocId)?.code || '',
      "Thu Cược": job.thuCuoc,
      "Ngày Thu Cược": job.ngayThuCuoc,
      "Ngày Thu Hoàn": job.ngayThuHoan
    }));

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-width for columns (Basic estimation)
    const wscols = Object.keys(dataToExport[0] || {}).map(k => ({ wch: k.length + 5 }));
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh Sach Job");

    // Write file
    XLSX.writeFile(wb, `Logistics_Job_Data_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesJobCode = filterJobCode ? job.jobCode.toLowerCase().includes(filterJobCode.toLowerCase()) : true;
    const matchesLine = filterLine ? job.line === filterLine : true;
    const matchesMonth = filterMonth ? job.month === filterMonth : true;
    const matchesCustomer = filterCustomer ? job.customerId === filterCustomer : true;
    const matchesBooking = filterBooking ? job.booking.toLowerCase().includes(filterBooking.toLowerCase()) : true;
    return matchesJobCode && matchesLine && matchesMonth && matchesCustomer && matchesBooking;
  });

  const clearFilters = () => {
    setFilterJobCode('');
    setFilterLine('');
    setFilterMonth('');
    setFilterCustomer('');
    setFilterBooking('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="p-8 max-w-full min-h-screen">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      {/* Header Actions */}
      <div className="flex flex-col mb-8 gap-4">
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-bold text-slate-800">Quản lý Job</h1>
              <p className="text-slate-500 mt-1">Nhập liệu và theo dõi chi tiết các lô hàng</p>
           </div>
           <div className="flex space-x-2">
             <button onClick={handleImportClick} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                <Upload className="w-5 h-5" />
                <span>Import Excel</span>
             </button>
             <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Xuất Excel (.xlsx)</span>
             </button>
             <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                <Plus className="w-5 h-5" />
                <span>Thêm Job</span>
             </button>
           </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
            <div className="flex items-center text-slate-500 font-medium border-b border-gray-100 pb-2">
              <Filter className="w-4 h-4 mr-2" />
              Bộ lọc nâng cao:
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
               <select 
                 value={filterMonth} 
                 onChange={(e) => setFilterMonth(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>

               <select 
                 value={filterCustomer} 
                 onChange={(e) => setFilterCustomer(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               >
                 <option value="">Tất cả khách hàng</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>

               <div className="relative">
                  <Ship className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select 
                    value={filterLine} 
                    onChange={(e) => setFilterLine(e.target.value)}
                    className="w-full pl-10 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  >
                    <option value="">Tất cả Line</option>
                    {lines.map((line, idx) => <option key={idx} value={line}>{line}</option>)}
                  </select>
               </div>

               <input 
                 type="text" 
                 placeholder="Lọc theo Booking..." 
                 value={filterBooking}
                 onChange={(e) => setFilterBooking(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               />

               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Tìm chính xác Job Code..." 
                    className="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30 font-medium"
                    value={filterJobCode}
                    onChange={(e) => setFilterJobCode(e.target.value)}
                  />
               </div>
            </div>

            {(filterMonth || filterCustomer || filterBooking || filterJobCode || filterLine) && (
              <div className="flex justify-end">
                <button onClick={clearFilters} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition-colors text-sm flex items-center">
                  <X className="w-4 h-4 mr-1" /> Xóa bộ lọc
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
        <div className="overflow-visible">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Tháng</th>
                <th className="px-6 py-4">Job Code</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Booking</th>
                <th className="px-6 py-4">Line</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Sell</th>
                <th className="px-6 py-4 text-right">Profit</th>
                <th className="px-6 py-4 text-center">Cont</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-blue-50/50 transition-colors group relative cursor-pointer"
                    onClick={(e) => handleRowClick(job, e)}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">Tháng {job.month}</td>
                    <td className="px-6 py-4 text-blue-600 font-medium">{job.jobCode}</td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-medium">{job.customerName}</div>
                      {job.hbl && <div className="text-xs text-orange-600">HBL: {job.hbl}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{job.booking}</td>
                    <td className="px-6 py-4 text-slate-500">{job.line}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.cost)}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.sell)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(job.profit)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex space-x-1 flex-col gap-1">
                        {job.cont20 > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{job.cont20}x20'</span>}
                        {job.cont40 > 0 && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">{job.cont40}x40'</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center action-menu-container">
                      <div className="relative inline-block text-left">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setActiveMenuId(activeMenuId === job.id ? null : job.id);
                           }}
                           className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
                         >
                           <MoreVertical className="w-5 h-5" />
                         </button>

                         {/* Dropdown Menu */}
                         {activeMenuId === job.id && (
                           <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                             <div className="py-1">
                               <button onClick={() => handleDuplicate(job)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                 <Copy className="w-4 h-4 mr-2" /> Nhân bản
                               </button>
                               <button onClick={() => handleEdit(job)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                                 <Edit2 className="w-4 h-4 mr-2" /> Chỉnh sửa
                               </button>
                               <div className="border-t border-gray-100 my-1"></div>
                               <button onClick={() => handleQuickReceive(job, 'local')} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center font-medium">
                                 <DollarSign className="w-4 h-4 mr-2" /> Thu tiền (Local)
                               </button>
                               <button onClick={() => handleQuickReceive(job, 'deposit')} className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center font-medium">
                                 <CreditCard className="w-4 h-4 mr-2" /> Thu cược
                               </button>
                               <button onClick={() => handleQuickReceive(job, 'extension')} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center font-medium">
                                 <Clock className="w-4 h-4 mr-2" /> Thu gia hạn
                               </button>
                               <div className="border-t border-gray-100 my-1"></div>
                               <button onClick={() => handleDelete(job.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                                 <Trash2 className="w-4 h-4 mr-2" /> Xóa Job
                               </button>
                             </div>
                           </div>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileDown className="w-12 h-12 mb-3 text-gray-300" />
                      <p>Không tìm thấy dữ liệu phù hợp</p>
                      <button onClick={clearFilters} className="mt-2 text-blue-600 hover:underline text-sm">Xóa bộ lọc</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
           <span>Hiển thị {filteredJobs.length} kết quả</span>
           <span>Tổng Profit: {formatCurrency(filteredJobs.reduce((sum, j) => sum + j.profit, 0))}</span>
        </div>
      </div>

      {/* MODALS */}
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
