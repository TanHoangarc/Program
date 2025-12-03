
import React, { useMemo, useState, useEffect } from 'react';
import { JobData, BookingSummary, BookingCostDetails } from '../types';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { calculateBookingSummary, getPaginationRange } from '../utils';
import { ChevronLeft, ChevronRight, Filter, MoreVertical, Eye, Edit, FileText, Anchor, DollarSign } from 'lucide-react';
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // State for dropdown menu
  const ITEMS_PER_PAGE = 10;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

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
    return bookingData.reduce((acc, b) => {
      // Calculate Target for this booking to derive diff
      const target = b.jobs.reduce((sum, j) => {
        const deduction = (j.cont20 * 250000) + (j.cont40 * 500000);
        return sum + (j.cost - deduction);
      }, 0);
      
      const addNet = (b.costDetails.additionalLocalCharges || []).reduce((s, e) => s + (e.net || 0), 0);
      const actualNet = (b.costDetails.localCharge.net || 0) + addNet;
      const diff = actualNet - target;

      return {
        sell: acc.sell + b.totalSell,
        cost: acc.cost + b.totalCost,
        profit: acc.profit + b.totalProfit,
        cont20: acc.cont20 + b.totalCont20,
        cont40: acc.cont40 + b.totalCont40,
        diff: acc.diff + diff
      };
    }, { sell: 0, cost: 0, profit: 0, cont20: 0, cont40: 0, diff: 0 });
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

  // Helper to open modal from menu
  const handleMenuAction = (booking: BookingSummary, action: string) => {
    setActiveMenuId(null);
    setSelectedBooking(booking);
    // Note: All actions currently open the main BookingDetailModal. 
    // You can extend functionality here to pre-scroll to specific sections in the modal if needed.
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden pb-32"> {/* Added pb-32 for dropdown space */}
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4">Line</th>
              <th className="px-6 py-4 text-center">Số Job</th>
              <th className="px-6 py-4 text-right">Tổng Thu</th>
              <th className="px-6 py-4 text-right">Tổng Chi (Payment)</th>
              <th className="px-6 py-4 text-right">Chênh lệch</th>
              <th className="px-6 py-4 text-right">Profit</th>
              <th className="px-6 py-4 text-center">Cont</th>
              <th className="px-6 py-4 text-center w-16">Chức năng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((booking) => {
              // CALCULATION FOR MISMATCH CHECK
              const target = booking.jobs.reduce((sum, j) => {
                const deduction = (j.cont20 * 250000) + (j.cont40 * 500000);
                return sum + (j.cost - deduction);
              }, 0);
              
              const addNet = (booking.costDetails.additionalLocalCharges || []).reduce((s, e) => s + (e.net || 0), 0);
              const actualNet = (booking.costDetails.localCharge.net || 0) + addNet;
              const diff = actualNet - target;

              return (
                <tr 
                  key={booking.bookingId} 
                  className="hover:bg-blue-50 transition-colors group"
                >
                  <td className="px-6 py-4 font-medium text-slate-900" onClick={() => setSelectedBooking(booking)}>Tháng {booking.month}</td>
                  <td className="px-6 py-4 text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => setSelectedBooking(booking)}>{booking.bookingId}</td>
                  <td className="px-6 py-4 text-slate-600">{booking.line}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{booking.jobCount}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(booking.totalSell)}</td>
                  
                  {/* Total Cost Column */}
                  <td className="px-6 py-4 text-right font-medium text-red-600">
                     {formatCurrency(booking.totalCost)}
                  </td>

                  {/* DIFFERENCE COLUMN */}
                  <td className={`px-6 py-4 text-right font-bold ${diff !== 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                    {formatCurrency(diff)}
                  </td>

                  <td className={`px-6 py-4 text-right font-bold ${booking.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(booking.totalProfit)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-500">
                     <div className="flex flex-col text-xs">
                        {booking.totalCont20 > 0 && <span>{booking.totalCont20} x 20'</span>}
                        {booking.totalCont40 > 0 && <span>{booking.totalCont40} x 40'</span>}
                        {booking.totalCont20 === 0 && booking.totalCont40 === 0 && <span>-</span>}
                     </div>
                  </td>
                  
                  {/* ACTION COLUMN */}
                  <td className="px-6 py-4 text-center relative action-menu-container">
                     <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === booking.bookingId ? null : booking.bookingId); }} 
                        className={`p-1.5 rounded-full hover:bg-white hover:shadow-md transition-all ${activeMenuId === booking.bookingId ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                     >
                       <MoreVertical className="w-4 h-4" />
                     </button>

                     {/* Dropdown Menu */}
                     {activeMenuId === booking.bookingId && (
                       <div className="absolute right-8 top-0 mt-0 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-[60] py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                         <div className="px-3 py-2 border-b border-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Thao tác Booking
                         </div>
                         
                         <button onClick={() => handleMenuAction(booking, 'view')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center transition-colors">
                            <Eye className="w-4 h-4 mr-2.5 text-gray-400" /> Xem chi tiết
                         </button>
                         <button onClick={() => handleMenuAction(booking, 'edit')} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center transition-colors">
                            <Edit className="w-4 h-4 mr-2.5 text-gray-400" /> Chỉnh sửa
                         </button>
                         
                         <div className="border-t border-gray-100 my-1"></div>
                         
                         <button onClick={() => handleMenuAction(booking, 'payment-lc')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium">
                            <FileText className="w-4 h-4 mr-2.5" /> Phiếu chi Local Charge
                         </button>
                         <button onClick={() => handleMenuAction(booking, 'payment-deposit')} className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center transition-colors font-medium">
                            <Anchor className="w-4 h-4 mr-2.5" /> Chi Cược (Deposit)
                         </button>
                         <button onClick={() => handleMenuAction(booking, 'payment-ext')} className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 flex items-center transition-colors font-medium">
                            <DollarSign className="w-4 h-4 mr-2.5" /> Chi Gia Hạn
                         </button>
                       </div>
                     )}
                  </td>
                </tr>
              );
            })}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-400">Không có dữ liệu booking</td>
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
                <td className={`px-6 py-4 text-right ${totals.diff !== 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatCurrency(totals.diff)}</td>
                <td className={`px-6 py-4 text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                <td className="px-6 py-4 text-center text-gray-600">
                    <div className="flex flex-col text-[10px]">
                        <span>{totals.cont20} x 20'</span>
                        <span>{totals.cont40} x 40'</span>
                     </div>
                </td>
                <td></td>
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
