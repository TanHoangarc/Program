
import React, { useMemo, useState, useEffect } from 'react';
import { JobData } from '../types';
import { Scale, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS } from '../constants';
import { getPaginationRange } from '../utils';

interface ReconciliationProps {
  jobs: JobData[];
}

export const Reconciliation: React.FC<ReconciliationProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, searchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const reconData = useMemo(() => {
    let filtered = jobs;
    if (filterMonth) filtered = filtered.filter(j => j.month === filterMonth);
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

    // Updated Sorting Logic: Month Desc -> Booking Asc (Trimmed)
    return mapped.sort((a, b) => {
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;

      const bookingA = String(a.booking || '').trim().toLowerCase();
      const bookingB = String(b.booking || '').trim().toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(reconData.length / ITEMS_PER_PAGE);
  const paginatedData = reconData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
              <Scale className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Đối Chiếu Số Liệu</h1>
          </div>
          <p className="text-slate-500 ml-11">So sánh dữ liệu hệ thống (System) và dữ liệu kế toán (Invoice)</p>
        </div>
        
        <div className="flex space-x-4">
           <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-2 border rounded text-sm min-w-[150px]">
             <option value="">Tất cả tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
           <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Tìm kiếm..." 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 p-2 border rounded text-sm w-64"
              />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Job Code</th>
                <th className="px-4 py-3 text-right text-red-700 bg-red-50">Cost (System)</th>
                <th className="px-4 py-3 text-right text-red-700 bg-red-50">Invoice Chi</th>
                <th className="px-4 py-3 text-right text-gray-500 w-24">Lệch Chi</th>
                
                <th className="px-4 py-3 border-l border-gray-200 text-right text-blue-700 bg-blue-50">Sell (System)</th>
                <th className="px-4 py-3 text-right text-blue-700 bg-blue-50">Invoice Thu</th>
                <th className="px-4 py-3 text-right text-gray-500 w-24">Lệch Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.length > 0 ? (
                paginatedData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-800">{item.jobCode}</td>
                    
                    {/* Cost Side */}
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.realCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.actualExpense)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${Math.abs(item.diffCost) > 1000 ? 'text-red-500' : 'text-gray-300'}`}>
                        {Math.abs(item.diffCost) > 1000 ? formatCurrency(item.diffCost) : '-'}
                    </td>

                    {/* Sell Side */}
                    <td className="px-4 py-3 border-l border-gray-200 text-right text-gray-700">{formatCurrency(item.sell)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.actualRevenue)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${Math.abs(item.diffSell) > 1000 ? 'text-orange-500' : 'text-gray-300'}`}>
                        {Math.abs(item.diffSell) > 1000 ? formatCurrency(item.diffSell) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Không có dữ liệu phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {reconData.length} dòng)
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
    </div>
  );
};
