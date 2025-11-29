import React, { useMemo, useState, useEffect } from 'react';
import { JobData, BookingSummary, BookingCostDetails } from '../types';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { calculateBookingSummary, getPaginationRange } from '../utils';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { MONTHS } from '../constants';

interface BookingListProps {
  jobs: JobData[];
  onEditJob: (job: JobData) => void;
  initialBookingId?: string | null;
  onClearTargetBooking?: () => void;
}

export const BookingList: React.FC<BookingListProps> = ({ jobs, onEditJob, initialBookingId, onClearTargetBooking }) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState('');
  const ITEMS_PER_PAGE = 10;

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth]);

  // Group jobs by Booking
  const bookingData = useMemo(() => {
    // Get unique booking IDs
    const bookingIds = Array.from(new Set(jobs.map(j => j.booking).filter((b): b is string => !!b)));
    
    // Calculate summaries
    let summaries = bookingIds.map((id: string) => calculateBookingSummary(jobs, id)).filter((b): b is BookingSummary => !!b);

    // Apply Filters
    if (filterMonth) {
      summaries = summaries.filter(s => s.month === filterMonth);
    }

    return summaries.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, filterMonth]);

  // Pagination Logic
  const totalPages = Math.ceil(bookingData.length / ITEMS_PER_PAGE);
  const paginatedData = bookingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  // Totals
  const totals = useMemo(() => {
    return bookingData.reduce((acc, b) => ({
      sell: acc.sell + b.totalSell,
      cost: acc.cost + b.totalCost,
      profit: acc.profit + b.totalProfit,
      cont20: acc.cont20 + b.totalCont20,
      cont40: acc.cont40 + b.totalCont40,
    }), { sell: 0, cost: 0, profit: 0, cont20: 0, cont40: 0 });
  }, [bookingData]);

  // Auto-open modal if initialBookingId matches
  useEffect(() => {
    if (initialBookingId && bookingData.length > 0) {
      const found = bookingData.find(b => b.bookingId === initialBookingId);
      if (found) {
        setSelectedBooking(found);
      }
      // Clear the target so it doesn't reopen if we close and stay on page
      if (onClearTargetBooking) {
        onClearTargetBooking();
      }
    }
  }, [initialBookingId, bookingData, onClearTargetBooking]);

  const handleSaveDetails = (updatedDetails: BookingCostDetails, updatedJobs?: JobData[]) => {
    if (!selectedBooking) return;
    
    selectedBooking.jobs.forEach(job => {
        const updatedJob = { 
            ...job, 
            bookingCostDetails: updatedDetails 
        };
        onEditJob(updatedJob);
    });

    setSelectedBooking(prev => prev ? { ...prev, costDetails: updatedDetails } : null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Quản lý Booking</h1>
          <p className="text-slate-500 mt-1">Danh sách tổng hợp Booking và chi tiết hóa đơn chi phí</p>
        </div>
        
        {/* Filter */}
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
           <Filter className="w-4 h-4 text-gray-500" />
           <select 
             value={filterMonth} 
             onChange={(e) => setFilterMonth(e.target.value)}
             className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent outline-none cursor-pointer min-w-[120px]"
           >
             <option value="">Tất cả các tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
        </div>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4">Line</th>
              <th className="px-6 py-4 text-center">Số Job</th>
              <th className="px-6 py-4 text-right">Tổng Thu</th>
              <th className="px-6 py-4 text-right">Tổng Chi (Payment)</th>
              <th className="px-6 py-4 text-right">Profit</th>
              <th className="px-6 py-4 text-center">Cont 20'</th>
              <th className="px-6 py-4 text-center">Cont 40'</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((booking) => (
              <tr 
                key={booking.bookingId} 
                onClick={() => setSelectedBooking(booking)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 font-medium text-slate-900">Tháng {booking.month}</td>
                <td className="px-6 py-4 text-blue-600 font-bold">{booking.bookingId}</td>
                <td className="px-6 py-4 text-slate-600">{booking.line}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{booking.jobCount}</span>
                </td>
                <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(booking.totalSell)}</td>
                <td className="px-6 py-4 text-right text-red-600 font-medium">{formatCurrency(booking.totalCost)}</td>
                <td className={`px-6 py-4 text-right font-bold ${booking.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(booking.totalProfit)}
                </td>
                <td className="px-6 py-4 text-center text-gray-500">{booking.totalCont20}</td>
                <td className="px-6 py-4 text-center text-gray-500">{booking.totalCont40}</td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">Không có dữ liệu booking</td>
              </tr>
            )}
          </tbody>
          {/* Footer Totals */}
          {bookingData.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-300 font-bold text-gray-800 text-xs uppercase">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right">Tổng cộng (Tất cả):</td>
                <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(totals.sell)}</td>
                <td className="px-6 py-4 text-right text-red-600">{formatCurrency(totals.cost)}</td>
                <td className={`px-6 py-4 text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                <td className="px-6 py-4 text-center text-gray-600">{totals.cont20}</td>
                <td className="px-6 py-4 text-center text-gray-600">{totals.cont40}</td>
              </tr>
            </tfoot>
          )}
        </table>

         {/* Pagination Controls */}
         {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {bookingData.length} bookings)
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

      {/* Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)} 
          onSave={handleSaveDetails}
        />
      )}
    </div>
  );
};
