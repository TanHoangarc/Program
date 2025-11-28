import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { Scale, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { MONTHS } from '../constants';

interface ReconciliationProps {
  jobs: JobData[];
}

export const Reconciliation: React.FC<ReconciliationProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const reconciliationData = useMemo(() => {
    let filtered = jobs;
    
    if (filterMonth) {
      filtered = filtered.filter(j => j.month === filterMonth);
    }
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.jobCode.toLowerCase().includes(lower) || 
        j.booking.toLowerCase().includes(lower)
      );
    }

    return filtered.map(job => {
      // 1. Cost Thực = Job Cost - (All Fees)
      const fees = (job.feeCic || 0) + (job.feeKimberry || 0) + (job.feeEmc || 0) + (job.feePsc || 0) + (job.feeOther || 0);
      const realCost = (job.cost || 0) - fees;

      // 2. Chi = Local Charge Invoice Net from Booking Details
      // Note: This maps to the Net Price of the Booking Invoice.
      const actualExpense = job.bookingCostDetails?.localCharge?.net || 0;

      // 3. Sell = Job Sell
      const sell = job.sell || 0;

      // 4. Thu = Revenue In Amount (Local Charge Total) divided by 1.08 (Net)
      // Updated as per request: Divide by 1.08 and take integer (round)
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
  }, [jobs, filterMonth, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    return reconciliationData.reduce((acc, item) => ({
        realCost: acc.realCost + item.realCost,
        actualExpense: acc.actualExpense + item.actualExpense,
        sell: acc.sell + item.sell,
        actualRevenue: acc.actualRevenue + item.actualRevenue,
        diffCost: acc.diffCost + item.diffCost,
        diffSell: acc.diffSell + item.diffSell
    }), { realCost: 0, actualExpense: 0, sell: 0, actualRevenue: 0, diffCost: 0, diffSell: 0 });
  }, [reconciliationData]);

  // Pagination
  const totalPages = Math.ceil(reconciliationData.length / ITEMS_PER_PAGE);
  const paginatedData = reconciliationData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
               <Scale className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Đối Chiếu (Reconciliation)</h1>
         </div>
         <p className="text-slate-500 ml-11">So sánh Cost/Sell dự kiến với Hóa đơn Thực tế (Thu/Chi)</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 mb-6">
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tháng</label>
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tìm kiếm</label>
             <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo Job Code, Booking..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
                <tr>
                   <th className="px-6 py-4">Tháng</th>
                   <th className="px-6 py-4">Job Code</th>
                   <th className="px-6 py-4 text-right bg-blue-50/50 border-l border-blue-100">Cost Thực</th>
                   <th className="px-6 py-4 text-right bg-blue-50/50">Chi (HĐ)</th>
                   <th className="px-6 py-4 text-right bg-blue-50/50 font-bold border-r border-blue-100">Chênh lệch</th>
                   
                   <th className="px-6 py-4 text-right bg-green-50/50 border-l border-green-100">Sell</th>
                   <th className="px-6 py-4 text-right bg-green-50/50">Thu (HĐ) / 1.08</th>
                   <th className="px-6 py-4 text-right bg-green-50/50 font-bold border-r border-green-100">Chênh lệch</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {paginatedData.length > 0 ? (
                   paginatedData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 text-gray-500">T{item.month}</td>
                         <td className="px-6 py-4 font-medium text-blue-700">{item.jobCode}</td>
                         
                         {/* COST GROUP */}
                         <td className="px-6 py-4 text-right text-gray-600 bg-blue-50/10 border-l border-gray-100">{formatCurrency(item.realCost)}</td>
                         <td className="px-6 py-4 text-right text-red-600 bg-blue-50/10">{formatCurrency(item.actualExpense)}</td>
                         <td className={`px-6 py-4 text-right font-bold bg-blue-50/10 border-r border-gray-100 ${item.diffCost !== 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {formatCurrency(item.diffCost)}
                         </td>

                         {/* SELL GROUP */}
                         <td className="px-6 py-4 text-right text-gray-600 bg-green-50/10 border-l border-gray-100">{formatCurrency(item.sell)}</td>
                         <td className="px-6 py-4 text-right text-green-600 bg-green-50/10">{formatCurrency(item.actualRevenue)}</td>
                         <td className={`px-6 py-4 text-right font-bold bg-green-50/10 border-r border-gray-100 ${item.diffSell !== 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {formatCurrency(item.diffSell)}
                         </td>
                      </tr>
                   ))
                ) : (
                   <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">Không tìm thấy dữ liệu</td></tr>
                )}
             </tbody>
             
             {/* FOOTER */}
             {reconciliationData.length > 0 && (
                <tfoot className="bg-slate-100 font-bold text-slate-800 text-xs uppercase border-t border-gray-300">
                   <tr>
                      <td colSpan={2} className="px-6 py-4 text-right">Tổng Cộng:</td>
                      <td className="px-6 py-4 text-right text-gray-800 bg-blue-100/30 border-l border-gray-200">{formatCurrency(totals.realCost)}</td>
                      <td className="px-6 py-4 text-right text-red-700 bg-blue-100/30">{formatCurrency(totals.actualExpense)}</td>
                      <td className={`px-6 py-4 text-right bg-blue-100/30 border-r border-gray-200 ${totals.diffCost !== 0 ? 'text-orange-600' : 'text-gray-500'}`}>{formatCurrency(totals.diffCost)}</td>
                      
                      <td className="px-6 py-4 text-right text-gray-800 bg-green-100/30 border-l border-gray-200">{formatCurrency(totals.sell)}</td>
                      <td className="px-6 py-4 text-right text-green-700 bg-green-100/30">{formatCurrency(totals.actualRevenue)}</td>
                      <td className={`px-6 py-4 text-right bg-green-100/30 border-r border-gray-200 ${totals.diffSell !== 0 ? 'text-orange-600' : 'text-gray-500'}`}>{formatCurrency(totals.diffSell)}</td>
                   </tr>
                </tfoot>
             )}
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {reconciliationData.length} dòng)
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
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