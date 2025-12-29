
import React, { useMemo, useState, useEffect } from 'react';
import { JobData, SalaryRecord } from '../types';
import { BadgeDollarSign, Search, ExternalLink, ChevronLeft, ChevronRight, Filter, Coins, Calculator, Receipt } from 'lucide-react';
import { MONTHS, YEARS } from '../constants';
import { getPaginationRange } from '../utils';

interface ProfitReportProps {
  jobs: JobData[];
  salaries?: SalaryRecord[];
  onViewJob?: (jobId: string) => void;
}

export const ProfitReport: React.FC<ProfitReportProps> = ({ jobs, salaries = [], onViewJob }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterYear, searchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Filter logic shared between stats and table
  const { filteredJobs, filteredSalaries } = useMemo(() => {
    let fJobs = jobs;
    if (filterYear) fJobs = fJobs.filter(j => j.year === Number(filterYear));
    if (filterMonth) fJobs = fJobs.filter(j => j.month === filterMonth);
    
    let fSalaries = salaries;
    if (filterYear) fSalaries = fSalaries.filter(s => s.year === Number(filterYear));
    if (filterMonth) fSalaries = fSalaries.filter(s => s.month === filterMonth);

    return { filteredJobs: fJobs, filteredSalaries: fSalaries };
  }, [jobs, salaries, filterMonth, filterYear]);

  const profitData = useMemo(() => {
    let data = filteredJobs;
    if (searchTerm) {
        data = data.filter(j => 
            String(j.jobCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            String(j.booking || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const mapped = data.map(job => {
      const totalFees = (job.feeCic || 0) + 
                       (job.feeKimberry || 0) + 
                       (job.feeEmc || 0) + 
                       (job.feePsc || 0) + 
                       (job.feeOther || 0);

      return {
        id: job.id,
        month: job.month,
        year: job.year,
        jobCode: job.jobCode,
        booking: job.booking,
        totalProfit: job.profit,
        totalSell: job.sell || 0,
        fees: totalFees
      };
    });

    return mapped.sort((a, b) => {
      const yearDiff = (b.year || 0) - (a.year || 0);
      if (yearDiff !== 0) return yearDiff;
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;
      const bookingA = String(a.booking || '').trim().toLowerCase();
      const bookingB = String(b.booking || '').trim().toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [filteredJobs, searchTerm]);

  const stats = useMemo(() => {
    // 1. Profit & Fees & Sell (Include ALL filtered jobs)
    const totalNetProfit = profitData.reduce((acc, p) => acc + p.totalProfit, 0);
    const totalFees = profitData.reduce((acc, p) => acc + p.fees, 0);
    const totalSell = profitData.reduce((acc, p) => acc + p.totalSell, 0);

    // Helper: Check for Long Hoang Logistics
    const isLhk = (name?: string) => {
        const n = (name || '').toLowerCase();
        return n.includes('long hoàng') || n.includes('lhk') || n.includes('long hoang') || n.includes('longhoang');
    };

    // 2. Output VAT (Thuế đầu ra)
    // Formula: 8% of Taxable Sell + 8% of Taxable Extension Revenue
    // EXCLUDE Long Hoang Logistics from VAT calculation
    
    const taxableJobs = filteredJobs.filter(j => !isLhk(j.customerName));

    const taxableSell = taxableJobs.reduce((acc, job) => acc + (job.sell || 0), 0);
    
    const taxableExtRevenue = taxableJobs.reduce((acc, job) => 
        acc + (job.extensions || []).reduce((s, ext) => s + (ext.total || 0), 0)
    , 0);
    
    const outputVatFromSell = taxableSell * 0.08;
    const outputVatFromExt = taxableExtRevenue > 0 ? (taxableExtRevenue / 1.08 * 0.08) : 0;
    const totalOutputVat = outputVatFromSell + outputVatFromExt;

    // 3. Input VAT (Thuế đầu vào - Local Charge + Extension Cost)
    const bookingVatMap = new Map<string, number>();
    filteredJobs.forEach(job => {
        if (job.booking && !bookingVatMap.has(job.booking)) {
            const details = job.bookingCostDetails;
            let bookingVatInput = 0;
            if (details) {
                // VAT from main Local Charge
                bookingVatInput += (details.localCharge?.vat || 0);
                // VAT from Additional Local Charges
                bookingVatInput += (details.additionalLocalCharges || []).reduce((s, i) => s + (i.vat || 0), 0);
                // VAT from Extension Costs (Chi phí gia hạn đầu vào)
                bookingVatInput += (details.extensionCosts || []).reduce((s, i) => s + (i.vat || 0), 0);
            }
            bookingVatMap.set(job.booking, bookingVatInput);
        }
    });
    
    const totalInputVat = Array.from(bookingVatMap.values()).reduce((sum, v) => sum + v, 0);
    const vatPayable = totalOutputVat - totalInputVat;

    // 4. Salaries
    const totalSalary = filteredSalaries.reduce((sum, s) => sum + s.amount, 0);

    return { 
        totalNetProfit, 
        totalFees, 
        totalSalary, 
        outputVat: totalOutputVat, 
        inputVat: totalInputVat, 
        vatPayable 
    };
  }, [profitData, filteredJobs, filteredSalaries]);

  // Pagination Logic
  const totalPages = Math.ceil(profitData.length / ITEMS_PER_PAGE);
  const paginatedData = profitData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const StatCard = ({ icon: Icon, title, value, colorClass, gradient, subValue }: { icon: any, title: string, value: string, colorClass: string, gradient: string, subValue?: string }) => (
    <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 hover:translate-y-[-2px]">
      <div className={`absolute top-0 right-0 w-20 h-20 ${gradient} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{title}</p>
          <h3 className="text-xl font-bold text-slate-800">{value}</h3>
          {subValue && <p className="text-[10px] text-slate-400 mt-1 font-medium">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-xl ${colorClass} shadow-md`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-full">
       <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <BadgeDollarSign className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Báo Cáo Lợi Nhuận</h1>
          </div>
          <p className="text-slate-500 ml-11">Phân tích lợi nhuận, chi phí lương và thuế VAT (Đã loại trừ LHK khỏi VAT ra)</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex items-center space-x-2 glass-panel px-3 py-1.5 rounded-xl">
               <Filter className="w-4 h-4 text-slate-400" />
               <select 
                 value={filterYear} 
                 onChange={e => setFilterYear(e.target.value)} 
                 className="bg-transparent border-none text-sm font-bold text-blue-700 focus:ring-0 outline-none cursor-pointer min-w-[80px]"
               >
                 <option value="">Tất cả năm</option>
                 {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
               <select 
                 value={filterMonth} 
                 onChange={e => setFilterMonth(e.target.value)} 
                 className="bg-transparent border-none text-sm font-medium text-slate-600 focus:ring-0 outline-none cursor-pointer min-w-[120px]"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
           </div>
           
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" placeholder="Tìm kiếm Job, Booking..." 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 p-2.5 glass-input rounded-xl text-sm w-56 outline-none focus:ring-2 focus:ring-green-500"
              />
           </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
         <StatCard 
            icon={BadgeDollarSign} 
            title="Tổng Lợi Nhuận Ròng" 
            value={formatCurrency(stats.totalNetProfit)} 
            colorClass="bg-teal-500" 
            gradient="bg-teal-500" 
         />
         <StatCard 
            icon={Calculator} 
            title="Tổng Các Khoản Phí" 
            value={formatCurrency(stats.totalFees)} 
            colorClass="bg-indigo-500" 
            gradient="bg-indigo-500" 
         />
         <StatCard 
            icon={Coins} 
            title="Tổng Chi Phí Lương" 
            value={formatCurrency(stats.totalSalary)} 
            colorClass="bg-yellow-500" 
            gradient="bg-yellow-500" 
         />
         <StatCard 
            icon={Receipt} 
            title="Thuế VAT Phải Nộp" 
            value={formatCurrency(stats.vatPayable)} 
            colorClass="bg-purple-500" 
            gradient="bg-purple-500"
            subValue={`Ra (8%): ${formatCurrency(stats.outputVat)} - Vào: ${formatCurrency(stats.inputVat)}`}
         />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Tháng/Năm</th>
                <th className="px-6 py-4">Job Code</th>
                <th className="px-6 py-4">Booking</th>
                <th className="px-6 py-4 text-right">Doanh Thu (Sell)</th>
                <th className="px-6 py-4 text-right">Tổng Phí (Fees)</th>
                <th className="px-6 py-4 text-right">Lợi Nhuận (Profit)</th>
                <th className="px-6 py-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
             {paginatedData.length > 0 ? (
                paginatedData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4 text-slate-400 font-medium">T{item.month}/{item.year}</td>
                     <td 
                        className="px-6 py-4 font-bold text-blue-700 cursor-pointer hover:underline"
                        onClick={() => onViewJob && onViewJob(item.id)}
                        title="Click để xem chi tiết Job"
                     >
                        {item.jobCode}
                     </td>
                     <td className="px-6 py-4 text-slate-600 font-mono text-xs">{item.booking}</td>
                     <td className="px-6 py-4 text-right text-blue-600 font-medium">{formatCurrency(item.totalSell)}</td>
                     <td className="px-6 py-4 text-right text-indigo-500 font-medium">{formatCurrency(item.fees)}</td>
                     <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(item.totalProfit)}</td>
                     <td className="px-6 py-4 text-center">
                       {onViewJob && (
                          <button onClick={() => onViewJob(item.id)} className="text-slate-300 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all">
                             <ExternalLink className="w-4 h-4" />
                          </button>
                       )}
                     </td>
                  </tr>
                ))
             ) : (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-light">Không tìm thấy dữ liệu báo cáo</td></tr>
             )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white/50 flex justify-between items-center text-xs text-slate-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {profitData.length} dòng)
            </div>
            <div className="flex space-x-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
                        className={`px-3 py-1.5 rounded-lg border border-slate-200 font-bold transition-colors ${
                          currentPage === page
                            ? 'bg-green-600 text-white border-green-600 shadow-md'
                            : 'bg-white hover:bg-slate-50 text-slate-700'
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
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
