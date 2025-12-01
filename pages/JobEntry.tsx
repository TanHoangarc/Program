import React, { useState, useMemo, useEffect } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { JobModal } from '../components/JobModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { Plus, Search, Trash2, Edit2, MoreVertical, DollarSign, FileText, Anchor } from 'lucide-react';
import { MONTHS } from '../constants';
import { getPaginationRange } from '../utils';

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
  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterJobCode, setFilterJobCode] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterLine, setFilterLine] = useState('');
  const [filterBooking, setFilterBooking] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveJob, setReceiveJob] = useState<JobData | null>(null);
  const [receiveMode, setReceiveMode] = useState<ReceiveMode>('local');

  // Handle Initial Job Focus
  useEffect(() => {
    if (initialJobId) {
      const job = jobs.find(j => j.id === initialJobId);
      if (job) {
        setEditingJob(job);
        setIsModalOpen(true);
      }
      if (onClearTargetJob) onClearTargetJob();
    }
  }, [initialJobId, jobs, onClearTargetJob]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterJobCode, filterCustomer, filterLine, filterBooking]);

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

  const handleOpenReceive = (job: JobData, mode: ReceiveMode) => {
    setReceiveJob(job);
    setReceiveMode(mode);
    setIsReceiveModalOpen(true);
  };

  const handleSaveJob = (job: JobData, newCust?: Customer) => {
    if (newCust) onAddCustomer(newCust);
    if (editingJob) {
      onEditJob(job);
    } else {
      onAddJob(job);
    }
    setIsModalOpen(false);
  };

  const handleSaveReceive = (updatedJob: JobData) => {
    onEditJob(updatedJob);
    setIsReceiveModalOpen(false);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-800">Quản Lý Job</h1>
           <p className="text-slate-500 mt-1">Nhập liệu và quản lý thông tin lô hàng</p>
        </div>
        <button 
          onClick={() => { setEditingJob(null); setIsModalOpen(true); }}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" /> Thêm Job Mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
         <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-2 border rounded text-sm">
           <option value="">Tất cả tháng</option>
           {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
         </select>
         <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            <input 
               type="text" placeholder="Tìm Job Code..." 
               value={filterJobCode} onChange={e => setFilterJobCode(e.target.value)}
               className="w-full pl-8 p-2 border rounded text-sm" 
            />
         </div>
         <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            <input 
               type="text" placeholder="Tìm Booking..." 
               value={filterBooking} onChange={e => setFilterBooking(e.target.value)}
               className="w-full pl-8 p-2 border rounded text-sm" 
            />
         </div>
         <select value={filterLine} onChange={e => setFilterLine(e.target.value)} className="p-2 border rounded text-sm">
           <option value="">Tất cả Line</option>
           {Array.from(new Set(jobs.map(j => j.line).filter(Boolean))).map(l => <option key={l} value={l}>{l}</option>)}
         </select>
         <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="p-2 border rounded text-sm">
           <option value="">Tất cả Khách Hàng</option>
           {customers.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
         </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
               <tr>
                 <th className="px-4 py-3">Tháng</th>
                 <th className="px-4 py-3">Job Code</th>
                 <th className="px-4 py-3">Booking</th>
                 <th className="px-4 py-3">Khách Hàng</th>
                 <th className="px-4 py-3">Line</th>
                 <th className="px-4 py-3 text-right">Cost</th>
                 <th className="px-4 py-3 text-right">Sell</th>
                 <th className="px-4 py-3 text-right">Profit</th>
                 <th className="px-4 py-3 text-center w-24">Thao tác</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {paginatedJobs.length > 0 ? (
                 paginatedJobs.map((job) => (
                   <tr key={job.id} className="hover:bg-blue-50/50 transition-colors group">
                     <td className="px-4 py-3">T{job.month}</td>
                     <td className="px-4 py-3 font-bold text-blue-700">{job.jobCode}</td>
                     <td className="px-4 py-3 font-mono text-gray-600">{job.booking}</td>
                     <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-[150px]" title={job.customerName}>{job.customerName}</td>
                     <td className="px-4 py-3 text-gray-600">{job.line}</td>
                     <td className="px-4 py-3 text-right text-red-600">{formatCurrency(job.cost)}</td>
                     <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(job.sell)}</td>
                     <td className={`px-4 py-3 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(job.profit)}</td>
                     <td className="px-4 py-3">
                       <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditingJob(job); setIsModalOpen(true); }} className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sửa">
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <div className="relative group/more">
                            <button className="p-1 text-gray-500 hover:text-gray-700 rounded"><MoreVertical className="w-4 h-4" /></button>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 hidden group-hover/more:block z-20">
                              <div onClick={() => handleOpenReceive(job, 'local')} className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center text-xs">
                                <FileText className="w-3 h-3 mr-2" /> Thu Local Charge
                              </div>
                              <div onClick={() => handleOpenReceive(job, 'deposit')} className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center text-xs">
                                <Anchor className="w-3 h-3 mr-2" /> Thu Cược
                              </div>
                              <div onClick={() => handleOpenReceive(job, 'extension')} className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center text-xs">
                                <DollarSign className="w-3 h-3 mr-2" /> Thu Gia Hạn
                              </div>
                            </div>
                         </div>
                         <button onClick={() => onDeleteJob(job.id)} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Xóa">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </td>
                   </tr>
                 ))
               ) : (
                 <tr><td colSpan={9} className="text-center py-12 text-gray-400">Không có dữ liệu job</td></tr>
               )}
             </tbody>
           </table>
         </div>
         {/* Pagination Controls */}
         {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
               <span>Trang {currentPage} / {totalPages}</span>
               <div className="flex space-x-1">
                  {paginationRange.map((page, i) => (
                     typeof page === 'number' ? 
                     <button key={i} onClick={() => setCurrentPage(page)} className={`px-3 py-1 rounded border ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white'}`}>{page}</button>
                     : <span key={i} className="px-2">...</span>
                  ))}
               </div>
            </div>
         )}
      </div>

      <JobModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveJob} 
        initialData={editingJob} 
        customers={customers} 
        lines={lines} 
        onAddLine={onAddLine} 
        onViewBookingDetails={() => {}} 
      />

      {receiveJob && (
        <QuickReceiveModal 
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          onSave={handleSaveReceive}
          job={receiveJob}
          mode={receiveMode}
          customers={customers}
        />
      )}
    </div>
  );
};