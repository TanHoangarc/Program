import React, { useMemo, useState, useEffect } from 'react';
import { JobData, BookingSummary, BookingCostDetails } from '../types';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { calculateBookingSummary } from '../utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BookingListProps {
  jobs: JobData[];
  onEditJob: (job: JobData) => void;
  initialBookingId?: string | null;
  onClearTargetBooking?: () => void;
}

export const BookingList: React.FC<BookingListProps> = ({ jobs, onEditJob, initialBookingId, onClearTargetBooking }) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Group jobs by Booking
  const bookingData = useMemo(() => {
    // Get unique booking IDs
    const bookingIds = Array.from(new Set(jobs.map(j => j.booking).filter((b): b is string => !!b)));
    
    // Calculate summaries
    const summaries = bookingIds.map((id: string) => calculateBookingSummary(jobs, id)).filter(Boolean) as BookingSummary[];

    return summaries.sort((a, b) => b.month.localeCompare(a.month));
  }, [jobs]);

  // Pagination Logic
  const totalPages = Math.ceil(bookingData.length / ITEMS_PER_PAGE);
  const paginatedData = bookingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Quản lý Booking</h1>
        <p className="text-slate-500 mt-1">Danh sách tổng hợp Booking và chi tiết hóa đơn chi phí</p>
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