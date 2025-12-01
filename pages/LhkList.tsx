
import React, { useMemo, useState, useEffect } from 'react';
import { JobData } from '../types';
import { Search, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS } from '../constants';
import { getPaginationRange } from '../utils';

interface LhkListProps {
  jobs: JobData[];
}

export const LhkList: React.FC<LhkListProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, searchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

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

    return filtered.sort((a, b) => {
        const monthDiff = Number(b.month) - Number(a.month);
        if (monthDiff !== 0) return monthDiff;

        const bookingA = String(a.booking || '').toLowerCase();
        const bookingB = String(b.booking || '').toLowerCase();
        return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(lhkJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = lhkJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Quản Lý Job Long Hoàng (LHK)</h1>
          </div>
          <p className="text-slate-500 ml-11">Danh sách riêng cho khách hàng Long Hoàng Logistics</p>
        </div>
        
        <div className="flex space-x-4">
           <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-2 border rounded text-sm min-w-[150px]">
             <option value="">Tất cả tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
           <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Tìm Job/Booking/HBL..." 
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
                <th className="px-6 py-4">Tháng</th>
                <th className="px-6 py-4">Job Code</th>
                <th className="px-6 py-4">Booking</th>
                <th className="px-6 py-4">HBL</th>
                <th className="px-6 py-4">Line</th>
                <th className="px-6 py-4 text-center">Cont 20'</th>
                <th className="px-6 py-4 text-center">Cont 40'</th>
                <th className="px-6 py-4 text-right">Lợi Nhuận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedJobs.length > 0 ? (
                paginatedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-blue-50/30">
                    <td className="px-6 py-4">T{job.month}</td>
                    <td className="px-6 py-4 font-bold text-blue-700">{job.jobCode}</td>
                    <td className="px-6 py-4 font-mono">{job.booking}</td>
                    <td className="px-6 py-4 font-bold text-orange-600 bg-orange-50 w-32 text-center rounded-lg">{job.hbl || '-'}</td>
                    <td className="px-6 py-4">{job.line}</td>
                    <td className="px-6 py-4 text-center">{job.cont20}</td>
                    <td className="px-6 py-4 text-center">{job.cont40}</td>
                    <td className="px-6 py-4 text-right font-medium text-green-700">{formatCurrency(job.profit)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Không tìm thấy Job LHK nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {lhkJobs.length} jobs)
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
