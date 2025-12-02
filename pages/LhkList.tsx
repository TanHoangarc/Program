<change>
    <file>pages/LhkList.tsx</file>
    <description>Rename Profit column to Sell, update totals to sum Sell, and add Export Excel feature</description>
    <content><![CDATA[
import React, { useMemo, useState, useEffect } from 'react';
import { JobData } from '../types';
import { Search, Briefcase, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { MONTHS } from '../constants';
import { getPaginationRange } from '../utils';
import * as XLSX from 'xlsx';

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

    // Updated Sorting Logic: Month Desc -> Booking Asc (Trimmed)
    return filtered.sort((a, b) => {
        // 1. Month Descending
        const monthDiff = Number(b.month) - Number(a.month);
        if (monthDiff !== 0) return monthDiff;

        // 2. Booking Ascending
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

  // Export Excel Function
  const handleExportExcel = () => {
    const headers = ['Tháng', 'Job Code', 'Booking', 'HBL', 'Line', 'Cont 20', 'Cont 40', 'Sell'];
    const rows = lhkJobs.map(job => [
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
    <div className="p-8 max-w-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Quản Lý Job Long Hoàng (LHK)</h1>
          </div>
          <p className="text-slate-500 ml-11">Danh sách riêng cho khách hàng Long Hoàng Logistics</p>
        </div>
        
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
           {/* Export Button */}
           <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center shadow-sm transition-colors">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Xuất Excel
           </button>

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
                <th className="px-6 py-4 text-right">Sell</th> {/* Renamed Header */}
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
                    {/* Display Sell instead of Profit */}
                    <td className="px-6 py-4 text-right font-medium text-blue-700">{formatCurrency(job.sell)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Không tìm thấy Job LHK nào</td></tr>
              )}
            </tbody>
            {/* Added Footer */}
            {lhkJobs.length > 0 && (
                <tfoot className="bg-gray-50 font-bold text-slate-800 text-xs uppercase border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-right">Tổng Cộng:</td>
                    <td className="px-6 py-4 text-center">{totals.cont20}</td>
                    <td className="px-6 py-4 text-center">{totals.cont40}</td>
                    {/* Total Sell */}
                    <td className="px-6 py-4 text-right text-blue-700 font-bold text-sm">{formatCurrency(totals.sell)}</td>
                  </tr>
                </tfoot>
            )}
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
]]></content>
</change>
