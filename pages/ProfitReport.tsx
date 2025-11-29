import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { BadgeDollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS } from '../constants';

interface ProfitReportProps {
  jobs: JobData[];
}

export const ProfitReport: React.FC<ProfitReportProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const profitData = useMemo(() => {
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

    const mapped = filtered.map(job => {
      // Kimberry = Job Profit (as per user request)
      const kimberry = job.profit || 0;

      // Cá nhân = Sum of specific fees
      const personal = (job.feeCic || 0) + 
                       (job.feeKimberry || 0) + 
                       (job.feeEmc || 0) + 
                       (job.feePsc || 0) + 
                       (job.feeOther || 0);

      return {
        id: job.id,
        month: job.month,
        jobCode: job.jobCode,
        booking: job.booking,
        kimberry,
        personal
      };
    });

    return mapped.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, filterMonth, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    return profitData.reduce((acc, item) => ({
        kimberry: acc.kimberry + item.kimberry,
        personal: acc.personal + item.personal
    }), { kimberry: 0, personal: 0 });
  }, [profitData]);

  // Pagination
  const totalPages = Math.ceil(profitData.length / ITEMS_PER_PAGE);
  const paginatedData = profitData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
               <BadgeDollarSign className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Báo Cáo Lợi Nhuận</h1>
         </div>
         <p className="text-slate-500 ml-11">Phân tích lợi nhuận Kimberry và Phí Cá nhân</p>
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
                   <th className="px-6 py-4">Job</th>
                   <th className="px-6 py-4">Booking</th>
                   <th className="px-6 py-4 text-right">Kimberry</th>
                   <th className="px-6 py-4 text-right">Cá nhân</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {paginatedData.length > 0 ? (
                   paginatedData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 text-gray-500">T{item.month}</td>
                         <td className="px-6 py-4 font-medium text-blue-700">{item.jobCode}</td>
                         <td className="px-6 py-4 text-gray-600">{item.booking}</td>
                         
                         <td className="px-6 py-4 text-right font-medium text-green-700">{formatCurrency(item.kimberry)}</td>
                         <td className="px-6 py-4 text-right font-medium text-blue-700">{formatCurrency(item.personal)}</td>
                      </tr>
                   ))
                ) : (
                   <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Không tìm thấy dữ liệu</td></tr>
                )}
             </tbody>
             
             {/* FOOTER */}
             {profitData.length > 0 && (
                <tfoot className="bg-slate-100 font-bold text-slate-800 text-xs uppercase border-t border-gray-300">
                   <tr>
                      <td colSpan={3} className="px-6 py-4 text-right">Tổng Cộng:</td>
                      <td className="px-6 py-4 text-right text-green-800 text-sm">{formatCurrency(totals.kimberry)}</td>
                      <td className="px-6 py-4 text-right text-blue-800 text-sm">{formatCurrency(totals.personal)}</td>
                   </tr>
                </tfoot>
             )}
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {profitData.length} dòng)
            </div>
            <div className="flex space-x-2 items-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex space-x-1 overflow-x-auto max-w-[200px] md:max-w-none no-scrollbar">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded border text-xs font-medium ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
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