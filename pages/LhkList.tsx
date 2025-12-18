
import React, { useMemo, useState, useEffect } from 'react';
import { JobData } from '../types';
import { Search, Briefcase, ChevronLeft, ChevronRight, FileSpreadsheet, MoreVertical, ShoppingCart, Filter } from 'lucide-react';
import { MONTHS } from '../constants';
import { getPaginationRange } from '../utils';
import * as XLSX from 'xlsx';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';

interface LhkListProps {
  jobs: JobData[];
}

export const LhkList: React.FC<LhkListProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Sales Invoice State
  const [salesInvoiceJob, setSalesInvoiceJob] = useState<JobData | null>(null);
  const [isSalesInvoiceOpen, setIsSalesInvoiceOpen] = useState(false);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const lhkJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      // Logic for LHK jobs: Check customer name
      // Match "Long Hoàng", "LHK", "LONG HOANG" (unaccented)
      const name = (job.customerName || '').toLowerCase();
      const isLhk = name.includes('long hoàng') || name.includes('lhk') || name.includes('long hoang') || name.includes('longhoang');
      
      const matchesMonth = filterMonth ? job.month === filterMonth : true;
      const matchesSearch = searchTerm ? (
        String(job.jobCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        String(job.booking || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(job.hbl || '').toLowerCase().includes(searchTerm.toLowerCase())
      ) : true;

      return isLhk && matchesMonth && matchesSearch;
    });

    // Updated Sorting Logic: Year Desc -> Month Desc -> Booking Asc (Trimmed)
    return filtered.sort((a, b) => {
        // 1. Year Descending
        const yearDiff = (b.year || new Date().getFullYear()) - (a.year || new Date().getFullYear());
        if (yearDiff !== 0) return yearDiff;

        // 2. Month Descending
        const monthDiff = Number(b.month) - Number(a.month);
        if (monthDiff !== 0) return monthDiff;

        // 3. Booking Ascending
        const bookingA = String(a.booking || '').trim().toLowerCase();
        const bookingB = String(b.booking || '').trim().toLowerCase();
        return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(lhkJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = lhkJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  // Totals - UPDATED to sum SELL instead of PROFIT
  const totals = useMemo(() => {
    return lhkJobs.reduce((acc, job) => ({
      sell: acc.sell + job.sell, // Changed from profit
      cont20: acc.cont20 + job.cont20,
      cont40: acc.cont40 + job.cont40
    }), { sell: 0, cont20: 0, cont40: 0 });
  }, [lhkJobs]);

  // Handlers
  const handleSalesInvoice = (job: JobData) => {
    setSalesInvoiceJob(job);
    setIsSalesInvoiceOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveSalesInvoice = (data: any) => {
    console.log("Sales Invoice Saved", data);
    alert("Đã lưu thông tin Phiếu Bán Hàng tạm thời.");
  };

  // Export Excel Function
  const handleExportExcel = () => {
    const headers = ['Năm', 'Tháng', 'Job Code', 'Booking', 'HBL', 'Line', 'Cont 20', 'Cont 40', 'Sell'];
    const rows = lhkJobs.map(job => [
        job.year,
        job.month,
        job.jobCode,
        job.booking,
        job.hbl,
        job.line,
        job.cont20,
        job.cont40,
        job.sell // Export Sell
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LHK_Jobs");
    XLSX.writeFile(wb, `LHK_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="w-full h-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">Quản Lý Job Long Hoàng (LHK)</h1>
          </div>
          <p className="text-sm text-slate-500 ml-11">Danh sách riêng cho khách hàng Long Hoàng Logistics</p>
        </div>
        
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3">
           <button onClick={handleExportExcel} className="glass-panel text-green-700 font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center transition-colors hover:bg-white/80">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Xuất Excel
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl mb-6 mx-2 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-wide">
              <Filter className="w-4 h-4 mr-2" />
              Bộ lọc
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
             <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Tất cả các tháng</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" placeholder="Tìm kiếm Job, Booking, HBL..." 
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
             </div>
          </div>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm border border-white/40 overflow-hidden mx-2">
        <div className="overflow-x-auto pb-24">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider w-16">Năm</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tháng</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Job Code</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Booking</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">HBL</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Line</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Cont 20'</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Cont 40'</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Sell</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {paginatedJobs.length > 0 ? (
                paginatedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-500">{job.year}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">T{job.month}</td>
                    <td className="px-6 py-4 font-bold text-blue-700">{job.jobCode}</td>
                    <td className="px-6 py-4 font-mono text-slate-600 text-xs">{job.booking}</td>
                    <td className="px-6 py-4 text-center">
                        {job.hbl ? (
                            <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 font-bold rounded-md text-xs border border-orange-200">
                                {job.hbl}
                            </span>
                        ) : (
                            <span className="text-slate-300">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{job.line}</td>
                    <td className="px-6 py-4 text-center font-medium">{job.cont20 > 0 ? job.cont20 : '-'}</td>
                    <td className="px-6 py-4 text-center font-medium">{job.cont40 > 0 ? job.cont40 : '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-700">{formatCurrency(job.sell)}</td>
                    <td className="px-6 py-4 text-center action-menu-container relative">
                       <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === job.id ? null : job.id); }} className={`p-1.5 rounded-full hover:bg-white/50 transition-all ${activeMenuId === job.id ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>
                         <MoreVertical className="w-4 h-4" />
                       </button>
                       {activeMenuId === job.id && (
                         <div className="absolute right-8 top-0 mt-0 w-48 glass-panel bg-white/95 rounded-xl shadow-xl border border-white/20 z-[60] py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                           <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chức năng</div>
                           <button onClick={() => handleSalesInvoice(job)} className="w-full text-left px-4 py-2.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center transition-colors font-bold rounded-b-xl">
                              <ShoppingCart className="w-4 h-4 mr-2.5" /> Phiếu bán hàng
                           </button>
                         </div>
                       )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 font-light">Không tìm thấy Job LHK nào</td></tr>
              )}
            </tbody>
            {/* Added Footer */}
            {lhkJobs.length > 0 && (
                <tfoot className="bg-white/30 font-bold text-slate-800 text-xs uppercase border-t border-white/40">
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-right">Tổng Cộng:</td>
                    <td className="px-6 py-4 text-center">{totals.cont20}</td>
                    <td className="px-6 py-4 text-center">{totals.cont40}</td>
                    <td className="px-6 py-4 text-right text-blue-700 text-sm">{formatCurrency(totals.sell)}</td>
                    <td></td>
                  </tr>
                </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {lhkJobs.length} jobs)
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

      {isSalesInvoiceOpen && salesInvoiceJob && (
          <SalesInvoiceModal 
             isOpen={isSalesInvoiceOpen} 
             onClose={() => setIsSalesInvoiceOpen(false)} 
             onSave={handleSaveSalesInvoice} 
             job={salesInvoiceJob} 
          />
      )}
    </div>
  );
};
