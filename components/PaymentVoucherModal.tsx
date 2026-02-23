import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, User, FileText, Check, Lock, AlertCircle } from 'lucide-react';
import { JobData, BookingSummary, BookingExtensionCost } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo, calculateBookingSummary } from '../utils';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  job?: JobData;
  booking?: BookingSummary;
  type: 'local' | 'deposit' | 'extension' | 'refund';
  allJobs?: JobData[];
  initialDocNo?: string; // Critical: The specific DocNo being edited (if any)
  extraDocNos?: string[];
}

const DateInput = ({ 
  value, 
  onChange, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  className?: string;
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const handleBlur = () => {
    if (!displayValue) {
      if (value) onChange('');
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) {
      if (parsed !== value) onChange(parsed);
    } else {
      setDisplayValue(formatDateVN(value));
    }
  };

  const handleDateIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative w-full ${className || ''}`}>
      <input 
        type="text" 
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-4 h-4 text-slate-500" />
      </div>
    </div>
  );
};

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
);

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  isOpen, onClose, onSave, job, booking, type, allJobs, initialDocNo, extraDocNos
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    docNo: '',
    receiverName: '',
    reason: 'Chi khác',
    paymentContent: '',
    amount: 0,
    tkNo: '3311',
    tkCo: '1121'
  });

  const [selectedExtensionIds, setSelectedExtensionIds] = useState<Set<string>>(new Set());

  // RE-CALCULATE EXTENSIONS FROM ALLJOBS TO ENSURE FRESHNESS
  // This fixes the issue where 'booking' prop might be stale when opening from lists
  const allExtensions = useMemo(() => {
      if (type !== 'extension') return [];
      
      // Try to get fresh data from allJobs if available
      if (allJobs && allJobs.length > 0) {
          if (booking) {
              const freshSummary = calculateBookingSummary(allJobs, booking.bookingId);
              return freshSummary?.costDetails.extensionCosts || [];
          }
          if (job) {
              const freshJob = allJobs.find(j => j.id === job.id);
              return freshJob?.bookingCostDetails?.extensionCosts || [];
          }
      }

      // Fallback to props
      if (booking) return booking.costDetails.extensionCosts || [];
      if (job) return job.bookingCostDetails?.extensionCosts || [];
      return [];
  }, [booking, job, type, allJobs]);

  // Generate default description
  const generateDescription = (prefix: string, bookingLabel: string = "BL") => {
      let jobCodes = '';
      let bkNumber = '';

      if (booking) {
          let targetJobs = booking.jobs;

          // Filter: For Extension payment, only list jobs that have Extension Revenue
          if (type === 'extension') {
              targetJobs = targetJobs.filter(j => {
                  const extTotal = (j.extensions || []).reduce((sum, e) => sum + e.total, 0);
                  return extTotal > 0;
              });
          }

          jobCodes = targetJobs.map(j => j.jobCode).filter(Boolean).join('+');
          bkNumber = booking.bookingId;
      } else if (job) {
          bkNumber = job.booking;
          if (allJobs && job.booking) {
              let siblings = allJobs.filter(j => j.booking === job.booking);
              
              // Filter siblings for Extension as well
              if (type === 'extension') {
                  siblings = siblings.filter(j => {
                      const extTotal = (j.extensions || []).reduce((sum, e) => sum + e.total, 0);
                      return extTotal > 0;
                  });
              }

              jobCodes = siblings.length > 0 ? siblings.map(j => j.jobCode).filter(Boolean).join('+') : job.jobCode;
          } else {
              jobCodes = job.jobCode;
          }
      }
      return `${prefix} ${jobCodes} ${bookingLabel} ${bkNumber} (kimberry)`;
  };

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      const jobsForCalc = allJobs || [];
      
      let initialData = {
        date: today,
        docNo: '',
        receiverName: '',
        reason: 'Chi khác',
        paymentContent: '',
        amount: 0,
        tkNo: '3311', 
        tkCo: '1121'
      };

      if (type === 'local') {
          initialData.tkNo = '3311'; 
          const targetDoc = initialDocNo || job?.amisPaymentDocNo;

          if (targetDoc) {
              // EDIT/VIEW MODE
              initialData.docNo = targetDoc;
              
              // Find representative job for metadata (Desc, Date, Receiver)
              const refJob = job || (allJobs ? allJobs.find(j => j.amisPaymentDocNo === targetDoc) : undefined);
              
              initialData.paymentContent = refJob?.amisPaymentDesc || '';
              initialData.date = refJob?.amisPaymentDate || today;
              initialData.receiverName = refJob?.line || booking?.line || '';

              // CALCULATE AMOUNT FROM BOOKING COST DETAILS IF AVAILABLE
              if (booking) {
                  const lc = booking.costDetails.localCharge;
                  // Use Net+Vat if invoice exists, else Total
                  const main = (lc.hasInvoice === false) ? (lc.total || 0) : ((lc.net || 0) + (lc.vat || 0));
                  const add = (booking.costDetails.additionalLocalCharges || []).reduce((s, a) => {
                      const val = (a.hasInvoice === false) ? (a.total || 0) : ((a.net || 0) + (a.vat || 0));
                      return s + val;
                  }, 0);
                  initialData.amount = main + add;
              } else if (allJobs) {
                  // Fallback: Sum from all jobs sharing this DocNo
                  const groupJobs = allJobs.filter(j => j.amisPaymentDocNo === targetDoc);
                  initialData.amount = groupJobs.reduce((s, j) => s + (j.chiPayment || 0), 0);
              } else {
                  initialData.amount = job?.chiPayment || 0;
              }
          } else {
              // CREATE MODE
              initialData.docNo = generateNextDocNo(jobsForCalc, 'UNC', 5);
              if (booking) {
                const summary = booking.costDetails.localCharge;
                const main = (summary.hasInvoice === false) ? (summary.total || 0) : ((summary.net || 0) + (summary.vat || 0));
                const add = (booking.costDetails.additionalLocalCharges || []).reduce((s, a) => {
                    const val = (a.hasInvoice === false) ? (a.total || 0) : ((a.net || 0) + (a.vat || 0));
                    return s + val;
                }, 0);
                initialData.amount = main + add;
                
                initialData.paymentContent = generateDescription("Chi tiền cho ncc lô");
                initialData.receiverName = booking.line;
              } else if (job) {
                initialData.amount = job.chiPayment || 0; 
                initialData.receiverName = job.line;
                initialData.paymentContent = generateDescription("Chi tiền cho ncc lô");
              }
          }
      } 
      else if (type === 'deposit') {
          initialData.tkNo = '3311';
          const targetDoc = initialDocNo || job?.amisDepositOutDocNo;

          if (targetDoc) {
              // EDIT/VIEW MODE
              initialData.docNo = targetDoc;
              
              const refJob = job || (allJobs ? allJobs.find(j => j.amisDepositOutDocNo === targetDoc) : undefined);

              initialData.paymentContent = refJob?.amisDepositOutDesc || '';
              initialData.date = refJob?.amisDepositOutDate || today;
              initialData.receiverName = refJob?.line || booking?.line || '';

              // CALCULATE AMOUNT FROM BOOKING COST DETAILS
              if (booking) {
                  const depTotal = (booking.costDetails.deposits || []).reduce((s,d) => s + (d.amount || 0), 0);
                  initialData.amount = depTotal;
              } else if (allJobs) {
                  const groupJobs = allJobs.filter(j => j.amisDepositOutDocNo === targetDoc);
                  initialData.amount = groupJobs.reduce((s, j) => s + (j.chiCuoc || 0), 0);
              } else {
                  initialData.amount = job?.chiCuoc || 0;
              }
          } else {
              // CREATE MODE
              initialData.docNo = generateNextDocNo(jobsForCalc, 'UNC', 5);
              if (booking) {
                  const depTotal = (booking.costDetails.deposits || []).reduce((s,d) => s + (d.amount || 0), 0);
                  initialData.amount = depTotal;
                  initialData.paymentContent = generateDescription("Chi tiền cược lô");
                  initialData.receiverName = booking.line;
                  
                  const firstDepositDate = booking.costDetails.deposits.find(d => d.dateOut)?.dateOut;
                  if (firstDepositDate) initialData.date = firstDepositDate;

              } else if (job) {
                  initialData.amount = job.chiCuoc || 0;
                  initialData.receiverName = job.line;
                  initialData.paymentContent = generateDescription("Chi tiền cược lô");
                  
                  const deposits = job.bookingCostDetails?.deposits || [];
                  const firstDepositDate = deposits.find(d => d.dateOut)?.dateOut;
                  if (firstDepositDate) {
                      initialData.date = firstDepositDate;
                  } else if (job.ngayChiCuoc) {
                      initialData.date = job.ngayChiCuoc;
                  }
              }
          }
      }
      else if (type === 'refund') {
          initialData.tkNo = '1121';
          initialData.tkCo = '3311';
          initialData.reason = 'Thu hoàn cược';
          
          const targetDoc = initialDocNo || job?.amisDepositRefundDocNo; // Reusing field or we might need a new one?
          // Actually, let's check if there's a specific field for Thu Hoàn from Line.
          // In JobData, we have ngayThuHoan.
          
          if (targetDoc) {
              initialData.docNo = targetDoc;
              const refJob = job || (allJobs ? allJobs.find(j => j.amisDepositRefundDocNo === targetDoc) : undefined);
              initialData.paymentContent = refJob?.amisDepositRefundDesc || '';
              initialData.date = refJob?.amisDepositRefundDate || today;
              initialData.receiverName = refJob?.line || booking?.line || '';
              
              if (booking) {
                  initialData.amount = (booking.costDetails.deposits || []).reduce((s,d) => s + (d.amount || 0), 0);
              } else {
                  initialData.amount = job?.thuCuoc || 0;
              }
          } else {
              initialData.docNo = generateNextDocNo(jobsForCalc, 'NTTK', 5, extraDocNos);
              if (booking) {
                  initialData.amount = (booking.costDetails.deposits || []).reduce((s,d) => s + (d.amount || 0), 0);
                  initialData.paymentContent = generateDescription("Thu tiền của ncc HOÀN CƯỢC CONT lô", "BILL");
                  initialData.receiverName = booking.line;
                  const firstDepositDate = booking.costDetails.deposits.find(d => d.dateIn)?.dateIn;
                  if (firstDepositDate) initialData.date = firstDepositDate;
              } else if (job) {
                  initialData.amount = job.thuCuoc || 0;
                  initialData.receiverName = job.line;
                  initialData.paymentContent = generateDescription("Thu tiền của ncc HOÀN CƯỢC CONT lô", "BILL");
                  if (job.ngayThuHoan) initialData.date = job.ngayThuHoan;
              }
          }
      }

      setFormData(initialData);
    }
  }, [isOpen, job, booking, type, allJobs, initialDocNo, allExtensions]);

  const handleToggleExtension = (extId: string, isChecked: boolean) => {
      const newSet = new Set(selectedExtensionIds);
      if (isChecked) newSet.add(extId);
      else newSet.delete(extId);
      
      setSelectedExtensionIds(newSet);

      const total = allExtensions.reduce((sum, ext) => {
          if (newSet.has(ext.id)) return sum + ext.total;
          return sum;
      }, 0);
      setFormData(prev => ({ ...prev, amount: total }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (val: string) => {
    setFormData(prev => ({ ...prev, date: val }));
  };

  const handleAmountChange = (val: number) => {
    // For extension, amount is calculated from checkboxes, don't allow manual override via this handler if caught here
    if (type === 'extension') return; 
    setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
        ...formData,
        selectedExtensionIds: Array.from(selectedExtensionIds),
        originalDocNo: initialDocNo // Pass this to identify what we are editing
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center ${type === 'refund' ? 'bg-emerald-50' : 'bg-red-50'} rounded-t-2xl shrink-0`}>
            <div className="flex items-center space-x-3">
            <div className={`p-2 ${type === 'refund' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'} rounded-lg shadow-sm border`}>
                <CreditCard className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">{type === 'refund' ? 'Phiếu Thu Tiền' : 'Phiếu Chi Tiền'}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {type === 'local' ? 'Local Charge' : type === 'deposit' ? 'Cược (Deposit)' : type === 'extension' ? 'Gia Hạn (Extension)' : 'Thu Hoàn (Deposit)'}
                </p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
               <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* LIST OF EXTENSIONS WITH CHECKBOXES */}
                {type === 'extension' && allExtensions.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center">
                            <Check className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Chọn các khoản phí gia hạn để chi
                        </h3>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                            {allExtensions.map((ext, idx) => {
                                // STRICT LOCKING LOGIC:
                                const ownerDocNo = ext.amisDocNo;
                                
                                // Determine if this specific item is locked
                                // If initialDocNo is set (Edit Mode): Locked if it belongs to ANOTHER DocNo.
                                // If initialDocNo is undefined (Create Mode): Locked if it belongs to ANY DocNo.
                                const isLocked = !!ownerDocNo && (initialDocNo ? ownerDocNo !== initialDocNo : true);
                                
                                // Determine if this item is currently part of THIS voucher (for styling)
                                const isCurrentVoucher = !!ownerDocNo && ownerDocNo === initialDocNo;

                                return (
                                    <label 
                                        key={ext.id} 
                                        className={`flex items-center p-2.5 rounded-lg border transition-all ${
                                            isLocked 
                                                ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                                                : selectedExtensionIds.has(ext.id) 
                                                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                                    : 'bg-white border-slate-100 hover:border-blue-200 cursor-pointer'
                                        }`}
                                    >
                                        <div className="flex items-center h-5">
                                            {isLocked ? (
                                                <Lock className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedExtensionIds.has(ext.id)} 
                                                    onChange={(e) => handleToggleExtension(ext.id, e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                            )}
                                        </div>
                                        <div className="ml-3 flex-1 flex justify-between items-center text-sm">
                                            <div className="flex flex-col">
                                                <span className={`font-bold ${isLocked ? 'text-slate-500' : 'text-slate-700'}`}>
                                                    HĐ: {ext.invoice || 'N/A'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    Ngày: {formatDateVN(ext.date)}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${isLocked ? 'text-slate-500' : 'text-blue-700'}`}>
                                                    {new Intl.NumberFormat('en-US').format(ext.total)} VND
                                                </div>
                                                {isLocked && (
                                                    <div className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 inline-block mt-0.5" title={`Đã chi ở phiếu ${ownerDocNo}`}>
                                                        Đã lập: {ownerDocNo}
                                                    </div>
                                                )}
                                                {isCurrentVoucher && !isLocked && (
                                                    <div className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100 inline-block mt-0.5">
                                                        Đang sửa
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {type === 'extension' && allExtensions.length === 0 && (
                    <div className="p-4 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl text-sm flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" /> Booking/Job này chưa có phí gia hạn nào.
                    </div>
                )}

                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Thông tin chung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-1.5">
                          <Label>Ngày Hạch toán</Label>
                          <DateInput value={formData.date} onChange={handleDateChange} />
                       </div>
                       <div className="space-y-1.5">
                          <Label>Số chứng từ</Label>
                          <input 
                             type="text" 
                             name="docNo" 
                             value={formData.docNo} 
                             onChange={handleChange}
                             className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 ${type === 'refund' ? 'text-emerald-600 focus:ring-emerald-500' : 'text-red-600 focus:ring-red-500'}`} 
                          />
                       </div>
                    </div>
                 </div>
 
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                        <User className="w-4 h-4 mr-2 text-blue-500" /> Đối tượng & Nội dung
                    </h3>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <Label>{type === 'refund' ? 'Người nộp' : 'Người nhận'}</Label>
                          <input 
                             type="text" 
                             name="receiverName" 
                             value={formData.receiverName} 
                             onChange={handleChange}
                             className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          />
                       </div>
                       <div className="space-y-1.5">
                          <Label>{type === 'refund' ? 'Lý do thu' : 'Lý do chi'}</Label>
                          <input 
                             type="text" 
                             name="reason" 
                             value={formData.reason} 
                             onChange={handleChange}
                             className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          />
                       </div>
                      <div className="space-y-1.5">
                         <Label>Diễn giải chi tiết</Label>
                         <textarea 
                            name="paymentContent" 
                            rows={3}
                            value={formData.paymentContent} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" 
                         />
                      </div>
                   </div>
                </div>

                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                        <DollarSign className="w-4 h-4 mr-2 text-blue-500" /> Hạch toán (VND)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                       <div className="space-y-1.5">
                          <Label>TK Nợ</Label>
                          <input 
                             type="text" 
                             name="tkNo" 
                             value={formData.tkNo} 
                             onChange={handleChange}
                             className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 ${type === 'refund' ? 'text-blue-700 focus:ring-emerald-500' : 'text-slate-700 focus:ring-red-500'}`} 
                          />
                       </div>
                       <div className="space-y-1.5">
                          <Label>TK Có</Label>
                          <input 
                             type="text" 
                             name="tkCo" 
                             value={formData.tkCo} 
                             onChange={handleChange}
                             className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 ${type === 'refund' ? 'text-slate-700 focus:ring-emerald-500' : 'text-blue-700 focus:ring-red-500'}`} 
                          />
                       </div>
                       <div className="space-y-1.5">
                            <Label>Số Tiền</Label>
                            <input 
                                type="text" 
                                value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                                onChange={(e) => {
                                    const val = Number(e.target.value.replace(/,/g, ''));
                                    if (!isNaN(val)) handleAmountChange(val);
                                }}
                                // Lock amount input for extension type to force calculation from checkboxes
                                readOnly={type === 'extension'}
                                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 ${type === 'refund' ? 'text-emerald-600 focus:ring-emerald-500' : 'text-red-600 focus:ring-red-500'} ${type === 'extension' ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'}`}
                            />
                       </div>
                    </div>
                 </div>

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3 shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100 ${type === 'refund' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>,
    document.body // Add this
  );
};