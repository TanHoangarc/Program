
import React, { useMemo, useState, useEffect } from 'react';
import { JobData } from '../types';
import { Scale, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { MONTHS, YEARS } from '../constants';
import { getPaginationRange } from '../utils';

interface ReconciliationProps {
  jobs: JobData[];
}

export const Reconciliation: React.FC<ReconciliationProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterYear, searchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const reconData = useMemo(() => {
    let filtered = jobs;
    
    // Filter by Year
    if (filterYear) filtered = filtered.filter(j => j.year === Number(filterYear));
    
    // Filter by Month
    if (filterMonth) filtered = filtered.filter(j => j.month === filterMonth);
    
    // Search
    if (searchTerm) {
        filtered = filtered.filter(j => 
            String(j.jobCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            String(j.booking || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const mapped = filtered.map(job => {
      // 1. Cost Thực (Hệ thống) = Cost - Các loại phí dịch vụ (để so sánh với hóa đơn cước/local charge thuần)
      const fees = (job.feeCic || 0) + (job.feeKimberry || 0) + (job.feeEmc || 0) + (job.feePsc || 0) + (job.feeOther || 0);
      const realCost = (job.cost || 0) - fees;

      // 2. Chi (Thực tế hóa đơn)
      // Sum of Local Charge Invoice Net + Additional Local Charges Net
      const lcNet = job.bookingCostDetails?.localCharge?.net || 0;
      const addNet = (job.bookingCostDetails?.additionalLocalCharges || []).reduce((s, i) => s + (i.net || 0), 0);
      const actualExpense = lcNet + addNet; 

      // 3. Sell (Hệ thống)
      const sell = job.sell || 0;

      // 4. Thu (Thực tế hóa đơn - Invoice Out)
      // Assuming 'localChargeTotal' is the invoiced amount including VAT (1.08 or 1.1)
      // Updated logic: if Pre-VAT is needed, usually / 1.08. 
      const actualRevenue = Math.round((job.localChargeTotal || 0) / 1.08);

      // Differences
      const diffCost = realCost - actualExpense;
      const diffSell = sell - actualRevenue;

      return {
        id: job.id,
        month: job.month,
        year: job.year,
        jobCode: job.jobCode,
        booking: job.booking,
        realCost,
        actualExpense,
        sell,
        actualRevenue,
        diffCost,
        diffSell
      };
    });

    // Updated Sorting Logic: Year Desc -> Month Desc -> Booking Asc (Trimmed)
    return mapped.sort((a, b) => {
      const yearDiff = (b.year || 0) - (a.year || 0);
      if (yearDiff !== 0) return yearDiff;
      
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;

      const bookingA = String(a.booking || '').trim().toLowerCase();
      const bookingB = String(b.booking || '').trim().toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, filterYear, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(reconData.length / ITEMS_PER_PAGE);
  const paginatedData = reconData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  return (
    <div className="w-full h-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">Đối Chiếu Số Liệu</h1>
          </div>
          <p className="text-sm text-slate-500 ml-11">So sánh dữ liệu hệ thống (System) và dữ liệu kế toán (Invoice)</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-3 glass-panel px-4 py-2 rounded-xl">
             <Filter className="w-4 h-4 text-slate-400" />
             <select 
               value={filterYear} 
               onChange={e => setFilterYear(e.target.value)} 
               className="bg-transparent text-sm font-bold text-blue-700 outline-none min-w-[80px] cursor-pointer"
             >
               <option value="">Tất cả năm</option>
               {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
             <div className="w-px h-4 bg-slate-300"></div>
             <select 
               value={filterMonth} 
               onChange={e => setFilterMonth(e.target.value)} 
               className="bg-transparent text-sm font-medium text-slate-700 outline-none min-w-[120px] cursor-pointer"
             >
               <option value="">Tất cả các tháng</option>
               {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
          </div>
          
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" placeholder="Tìm kiếm mã Job, Booking..." 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 glass-input rounded-xl text-sm w-56 outline-none focus:ring-2 focus:ring-teal-500"
              />
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto pb-24">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tháng/Năm</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Job Code</th>
                
                {/* Cost Header Group */}
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-red-50/50 text-red-800 border-l border-white/30">Cost (System)</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-red-50/50 text-red-800">Invoice Chi</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-red-50/50 text-red-800 w-28">Lệch Chi</th>
                
                {/* Sell Header Group */}
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-blue-50/50 text-blue-800 border-l border-white/30">Sell (System)</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-blue-50/50 text-blue-800">Invoice Thu</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right bg-blue-50/50 text-blue-800 w-28">Lệch Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {paginatedData.length > 0 ? (
                paginatedData.map(item => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">T{item.month}/{item.year}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{item.jobCode}</td>
                    
                    {/* Cost Side */}
                    <td className="px-6 py-4 text-right text-slate-600 border-l border-white/30 bg-red-50/10">{formatCurrency(item.realCost)}</td>
                    <td className="px-6 py-4 text-right text-slate-600 bg-red-50/10">{formatCurrency(item.actualExpense)}</td>
                    <td className={`px-6 py-4 text-right font-bold bg-red-50/10 ${Math.abs(item.diffCost) > 1000 ? 'text-red-500' : 'text-slate-300'}`}>
                        {Math.abs(item.diffCost) > 1000 ? formatCurrency(item.diffCost) : '-'}
                    </td>

                    {/* Sell Side */}
                    <td className="px-6 py-4 border-l border-white/30 text-right text-slate-600 bg-blue-50/10">{formatCurrency(item.sell)}</td>
                    <td className="px-6 py-4 text-right text-slate-600 bg-blue-50/10">{formatCurrency(item.actualRevenue)}</td>
                    <td className={`px-6 py-4 text-right font-bold bg-blue-50/10 ${Math.abs(item.diffSell) > 1000 ? 'text-orange-500' : 'text-slate-300'}`}>
                        {Math.abs(item.diffSell) > 1000 ? formatCurrency(item.diffSell) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-light">Không có dữ liệu phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {reconData.length} dòng)
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
                 {getPaginationRange(currentPage, totalPages).map((page, idx) => (
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
    </div>
  );
};
