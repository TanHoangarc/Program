
import React, { useMemo, useState, useEffect } from 'react';
import { JobData, BookingSummary, BookingCostDetails, Customer, ShippingLine } from '../types';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { calculateBookingSummary, getPaginationRange } from '../utils';
import { ChevronLeft, ChevronRight, Filter, MoreVertical, Eye, Edit, Anchor, DollarSign, Banknote, ShoppingBag, Search, AlertCircle } from 'lucide-react';
import { MONTHS } from '../constants';
import { PaymentVoucherModal } from '../components/PaymentVoucherModal';
import { PurchaseInvoiceModal } from '../components/PurchaseInvoiceModal';
import { JobModal } from '../components/JobModal';

interface BookingListProps {
  jobs: JobData[];
  onEditJob: (job: JobData) => void;
  initialBookingId?: string | null;
  onClearTargetBooking?: () => void;
  customers: Customer[];
  lines: ShippingLine[];
  onAddCustomer: (c: Customer) => void;
  onAddLine: (l: string) => void;
}

export const BookingList: React.FC<BookingListProps> = ({ 
    jobs, onEditJob, initialBookingId, onClearTargetBooking, 
    customers, lines, onAddCustomer, onAddLine 
}) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterBooking, setFilterBooking] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Job Modal State
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

  // Payment Voucher State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'local' | 'deposit' | 'extension'>('local');
  const [targetBookingForPayment, setTargetBookingForPayment] = useState<BookingSummary | null>(null);

  // Purchase Invoice State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [targetBookingForPurchase, setTargetBookingForPurchase] = useState<BookingSummary | null>(null);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterBooking]);

  const bookingData = useMemo(() => {
    const bookingIds = Array.from(new Set(jobs.map(j => j.booking).filter((b): b is string => !!b)));
    let summaries = bookingIds.map((id: string) => calculateBookingSummary(jobs, id)).filter((b): b is BookingSummary => !!b);
    
    if (filterMonth) {
      summaries = summaries.filter(s => s.month === filterMonth);
    }
    
    if (filterBooking) {
      const searchLower = filterBooking.toLowerCase();
      // Ensure safe string handling to prevent crashes
      summaries = summaries.filter(s => String(s.bookingId || '').toLowerCase().includes(searchLower));
    }

    return summaries.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, filterMonth, filterBooking]);

  const totalPages = Math.ceil(bookingData.length / ITEMS_PER_PAGE);
  const paginatedData = bookingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const totals = useMemo(() => {
    return bookingData.reduce((acc, b) => {
      // Formula: Target = Cost - (Kimberry + CIC + PSC + EMC + Other)
      const target = b.jobs.reduce((sum, j) => {
         const kimberry = (j.cont20 * 250000) + (j.cont40 * 500000);
         const otherFees = (j.feeCic || 0) + (j.feePsc || 0) + (j.feeEmc || 0) + (j.feeOther || 0);
         return sum + (j.cost - kimberry - otherFees);
      }, 0);

      const addNet = (b.costDetails.additionalLocalCharges || []).reduce((s, e) => s + (e.net || 0), 0);
      const actualNet = (b.costDetails.localCharge.net || 0) + addNet;
      const diff = actualNet - target;

      return {
        sell: acc.sell + b.totalSell,
        cost: acc.cost + b.totalCost, // Note: totalCost in summary is basically sum of job.cost
        profit: acc.profit + b.totalProfit,
        cont20: acc.cont20 + b.totalCont20,
        cont40: acc.cont40 + b.totalCont40,
        diff: acc.diff + diff
      };
    }, { sell: 0, cost: 0, profit: 0, cont20: 0, cont40: 0, diff: 0 });
  }, [bookingData]);

  useEffect(() => {
    if (initialBookingId && bookingData.length > 0) {
      const found = bookingData.find(b => b.bookingId === initialBookingId);
      if (found) setSelectedBooking(found);
      if (onClearTargetBooking) onClearTargetBooking();
    }
  }, [initialBookingId, bookingData, onClearTargetBooking]);

  const handleSaveDetails = (updatedDetails: BookingCostDetails, shouldClose: boolean = true) => {
    if (!selectedBooking) return;
    selectedBooking.jobs.forEach(job => {
        const updatedJob = { ...job, bookingCostDetails: updatedDetails };
        onEditJob(updatedJob);
    });
    
    // Update local state to reflect changes even if modal stays open
    setSelectedBooking(prev => prev ? { ...prev, costDetails: updatedDetails } : null);
    
    if (shouldClose) {
       setSelectedBooking(null);
    }
  };

  const handleMenuAction = (booking: BookingSummary, action: string) => {
    setActiveMenuId(null);
    
    if (action === 'view' || action === 'edit') {
        setSelectedBooking(booking);
    } 
    else if (action === 'payment-lc') {
        setTargetBookingForPayment(booking);
        setPaymentType('local');
        setPaymentModalOpen(true);
    } 
    else if (action === 'payment-deposit') {
        // Validation: Check if deposits exist
        const hasDeposits = booking.costDetails.deposits && booking.costDetails.deposits.length > 0;
        
        if (!hasDeposits) {
            if (window.confirm("Booking này chưa có thông tin Cược (Deposit). Bạn có muốn mở chi tiết Booking để cập nhật không?")) {
                setSelectedBooking(booking);
            }
            return;
        }

        setTargetBookingForPayment(booking);
        setPaymentType('deposit');
        setPaymentModalOpen(true);
    } 
    else if (action === 'payment-ext') {
        // Validation: Check if extension costs exist and total > 0
        const extensionCosts = booking.costDetails.extensionCosts || [];
        const totalExtAmount = extensionCosts.reduce((sum, item) => sum + item.total, 0);
        
        if (extensionCosts.length === 0 || totalExtAmount === 0) {
            if (window.confirm("Booking này chưa có thông tin Gia Hạn (hoặc tổng tiền = 0). Bạn có muốn mở chi tiết Booking để cập nhật không?")) {
                setSelectedBooking(booking);
            }
            return;
        }

        setTargetBookingForPayment(booking);
        setPaymentType('extension');
        setPaymentModalOpen(true);
    } 
    else if (action === 'purchase') {
        setTargetBookingForPurchase(booking);
        setPurchaseModalOpen(true);
    }
  };
  
  const handleSavePayment = (data: any) => {
      // Save data back to jobs in the booking
      if (targetBookingForPayment) {
          targetBookingForPayment.jobs.forEach(job => {
              const updatedJob = { ...job };
              
              if (paymentType === 'local') {
                  updatedJob.amisPaymentDocNo = data.docNo;
                  updatedJob.amisPaymentDesc = data.paymentContent;
                  updatedJob.amisPaymentDate = data.date;
              } else if (paymentType === 'deposit') {
                  updatedJob.amisDepositOutDocNo = data.docNo;
                  updatedJob.amisDepositOutDesc = data.paymentContent;
                  updatedJob.amisDepositOutDate = data.date;
              } else if (paymentType === 'extension') {
                  updatedJob.amisExtensionPaymentDocNo = data.docNo;
                  updatedJob.amisExtensionPaymentDesc = data.paymentContent;
                  updatedJob.amisExtensionPaymentDate = data.date;
                  if (data.amount > 0) {
                      updatedJob.amisExtensionPaymentAmount = data.amount;
                  }
              }
              onEditJob(updatedJob);
          });
          alert("Đã lưu thông tin phiếu chi thành công!");
      }
  };

  const handleSavePurchase = (data: any) => {
      console.log("Saved Purchase Invoice Data:", data);
      alert("Đã lưu thông tin phiếu mua hàng (Dữ liệu tạm thời).");
  };

  // --- JOB MODAL HANDLERS ---
  const handleViewJob = (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
          // Deep copy to avoid reference issues
          setEditingJob(JSON.parse(JSON.stringify(job)));
          setIsJobModalOpen(true);
      }
  };

  const handleSaveJob = (updatedJob: JobData, newCustomer?: Customer) => {
      if (newCustomer) onAddCustomer(newCustomer);
      
      // 1. Update Global State
      onEditJob(updatedJob);
      
      // 2. Update Local Booking View if open to reflect changes immediately
      if (selectedBooking) {
          setSelectedBooking(prev => {
              if (!prev) return null;
              
              const updatedJobs = prev.jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
              
              // Recalculate totals for the modal view
              return {
                  ...prev,
                  jobs: updatedJobs,
                  totalSell: updatedJobs.reduce((s, j) => s + j.sell, 0),
                  totalCost: updatedJobs.reduce((s, j) => s + j.cost, 0),
                  totalProfit: updatedJobs.reduce((s, j) => s + j.profit, 0),
                  totalCont20: updatedJobs.reduce((s, j) => s + j.cont20, 0),
                  totalCont40: updatedJobs.reduce((s, j) => s + j.cont40, 0),
              };
          });
      }
      
      setIsJobModalOpen(false);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full h-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Booking</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách tổng hợp Booking và chi tiết hóa đơn chi phí</p>
        </div>
        <div className="flex items-center space-x-3">
           <div className="glass-panel px-4 py-2 flex items-center space-x-2 rounded-lg text-slate-700">
               <Search className="w-4 h-4 text-slate-500" />
               <input 
                  type="text"
                  placeholder="Tìm Booking..."
                  value={filterBooking}
                  onChange={(e) => setFilterBooking(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none w-32 md:w-48 placeholder-slate-400 text-slate-700"
               />
           </div>

           <div className="glass-panel px-4 py-2 flex items-center space-x-2 rounded-lg text-slate-700">
               <Filter className="w-4 h-4 text-slate-500" />
               <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer min-w-[120px] text-slate-700"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
           </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto pb-32">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tháng</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Booking</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Line</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Số Job</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Tổng Thu</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Tổng Chi</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Chênh lệch</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Profit</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Cont</th>
                <th className="px-2 py-4 w-12"></th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center w-16">Chức năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {paginatedData.map((booking) => {
                const target = booking.jobs.reduce((sum, j) => {
                   const kimberry = (j.cont20 * 250000) + (j.cont40 * 500000);
                   const otherFees = (j.feeCic || 0) + (j.feePsc || 0) + (j.feeEmc || 0) + (j.feeOther || 0);
                   return sum + (j.cost - kimberry - otherFees);
                }, 0);

                const addNet = (booking.costDetails.additionalLocalCharges || []).reduce((s, e) => s + (e.net || 0), 0);
                const actualNet = (booking.costDetails.localCharge.net || 0) + addNet;
                const diff = actualNet - target;
                
                // Logic: 
                // 1. Check if invoice is required (hasInvoice !== false) AND file is missing.
                // 2. OR check if "No Invoice" mode is enabled (hasInvoice === false).
                const hasInvoice = booking.costDetails.localCharge.hasInvoice !== false;
                const hasFile = !!booking.costDetails.localCharge.fileUrl;
                const isNoInvoice = booking.costDetails.localCharge.hasInvoice === false;

                const showAlert = (hasInvoice && !hasFile) || isNoInvoice;
                let alertTitle = "";
                if (isNoInvoice) alertTitle = "Đang ở chế độ 'Chưa HĐ'";
                else if (!hasFile) alertTitle = "Thiếu file đính kèm hóa đơn";

                return (
                  <tr key={booking.bookingId} className="hover:bg-white/40 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-500" onClick={() => setSelectedBooking(booking)}>Tháng {booking.month}</td>
                    <td className="px-6 py-4 text-blue-700 font-bold cursor-pointer hover:underline" onClick={() => setSelectedBooking(booking)}>{booking.bookingId}</td>
                    <td className="px-6 py-4 text-slate-600">{booking.line}</td>
                    <td className="px-6 py-4 text-center"><span className="bg-slate-100/80 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200/50">{booking.jobCount}</span></td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(booking.totalSell)}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-600">{formatCurrency(booking.totalCost)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${diff !== 0 ? 'text-orange-600' : 'text-slate-300'}`}>{formatCurrency(diff)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${booking.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(booking.totalProfit)}</td>
                    <td className="px-6 py-4 text-center text-slate-500">
                       <div className="flex flex-col text-[10px] items-center gap-1">
                          {booking.totalCont20 > 0 && <span className="px-1.5 py-0.5 bg-blue-100/50 text-blue-700 rounded border border-blue-200/50">{booking.totalCont20} x 20'</span>}
                          {booking.totalCont40 > 0 && <span className="px-1.5 py-0.5 bg-purple-100/50 text-purple-700 rounded border border-purple-200/50">{booking.totalCont40} x 40'</span>}
                          {booking.totalCont20 === 0 && booking.totalCont40 === 0 && <span>-</span>}
                       </div>
                    </td>
                    <td className="px-2 py-4 text-center">
                        {showAlert && (
                            <div title={alertTitle} className="flex justify-center cursor-help">
                                <AlertCircle className="w-4 h-4 text-purple-600" />
                            </div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-center relative action-menu-container">
                       <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === booking.bookingId ? null : booking.bookingId); }} className={`p-1.5 rounded-full hover:bg-white/50 transition-all ${activeMenuId === booking.bookingId ? 'bg-white shadow-md text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>
                         <MoreVertical className="w-4 h-4" />
                       </button>
                       {activeMenuId === booking.bookingId && (
                         <div className="absolute right-8 top-0 mt-0 w-60 glass-panel bg-white/95 rounded-xl shadow-xl border border-white/20 z-[60] py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                           <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thao tác Booking</div>
                           <button onClick={() => handleMenuAction(booking, 'view')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-teal-50 flex items-center transition-colors"><Eye className="w-4 h-4 mr-2.5 text-teal-500" /> Xem chi tiết</button>
                           <button onClick={() => handleMenuAction(booking, 'edit')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 flex items-center transition-colors"><Edit className="w-4 h-4 mr-2.5 text-blue-500" /> Chỉnh sửa</button>
                           <div className="border-t border-slate-100 my-1"></div>
                           <button onClick={() => handleMenuAction(booking, 'payment-lc')} className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium"><Banknote className="w-4 h-4 mr-2.5" /> Phiếu chi Local Charge</button>
                           <button onClick={() => handleMenuAction(booking, 'payment-deposit')} className="w-full text-left px-4 py-2.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center transition-colors font-medium"><Anchor className="w-4 h-4 mr-2.5" /> Chi Cược (Deposit)</button>
                           <button onClick={() => handleMenuAction(booking, 'payment-ext')} className="w-full text-left px-4 py-2.5 text-xs text-orange-600 hover:bg-orange-50 flex items-center transition-colors font-medium"><DollarSign className="w-4 h-4 mr-2.5" /> Chi Gia Hạn</button>
                           <button onClick={() => handleMenuAction(booking, 'purchase')} className="w-full text-left px-4 py-2.5 text-xs text-teal-600 hover:bg-teal-50 flex items-center transition-colors font-medium rounded-b-xl"><ShoppingBag className="w-4 h-4 mr-2.5" /> Phiếu mua hàng</button>
                         </div>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {bookingData.length > 0 && (
              <tfoot className="bg-white/30 border-t border-white/40 font-bold text-slate-800 text-xs uppercase">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right">Tổng cộng (Tất cả):</td>
                  <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(totals.sell)}</td>
                  <td className="px-6 py-4 text-right text-red-600">{formatCurrency(totals.cost)}</td>
                  <td className={`px-6 py-4 text-right ${totals.diff !== 0 ? 'text-orange-600' : 'text-slate-400'}`}>{formatCurrency(totals.diff)}</td>
                  <td className={`px-6 py-4 text-right ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
         {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>Trang {currentPage} / {totalPages} (Tổng {bookingData.length} bookings)</div>
            <div className="flex space-x-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              {paginationRange.map((page, idx) => (
                 page === '...' ? <span key={`dots-${idx}`} className="px-2 py-1.5">...</span> : 
                 <button key={page} onClick={() => setCurrentPage(page as number)} className={`px-3 py-1.5 rounded-lg border border-white/60 font-medium transition-colors ${currentPage === page ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white/40 hover:bg-white/80 text-slate-700'}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {selectedBooking && (
        <BookingDetailModal 
            booking={selectedBooking} 
            onClose={() => setSelectedBooking(null)} 
            onSave={handleSaveDetails} 
            onViewJob={handleViewJob} 
        />
      )}

      {/* Payment Voucher Modal */}
      {paymentModalOpen && targetBookingForPayment && (
          <PaymentVoucherModal 
             isOpen={paymentModalOpen}
             onClose={() => setPaymentModalOpen(false)}
             booking={targetBookingForPayment}
             type={paymentType}
             onSave={handleSavePayment}
             allJobs={jobs}
          />
      )}

      {/* Purchase Invoice Modal */}
      {purchaseModalOpen && targetBookingForPurchase && (
          <PurchaseInvoiceModal 
             isOpen={purchaseModalOpen}
             onClose={() => setPurchaseModalOpen(false)}
             onSave={handleSavePurchase}
             booking={targetBookingForPurchase}
             lines={lines}
          />
      )}

      {/* Job Modal */}
      {isJobModalOpen && (
          <JobModal 
              isOpen={isJobModalOpen}
              onClose={() => setIsJobModalOpen(false)}
              onSave={handleSaveJob}
              initialData={editingJob}
              customers={customers}
              lines={lines}
              onAddLine={onAddLine}
              onViewBookingDetails={() => {}}
              onAddCustomer={onAddCustomer}
          />
      )}
    </div>
  );
};

