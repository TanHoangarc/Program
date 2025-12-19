
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, User, FileText, ChevronDown } from 'lucide-react';
import { JobData, BookingSummary, BookingExtensionCost } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo } from '../utils';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  job?: JobData;
  booking?: BookingSummary;
  type: 'local' | 'deposit' | 'extension';
  allJobs?: JobData[];
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
  isOpen, onClose, onSave, job, booking, type, allJobs
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

  const [selectedExtensionId, setSelectedExtensionId] = useState<string>('');

  // Get list of available extensions based on input (Job or Booking)
  const availableExtensions = useMemo(() => {
      if (type !== 'extension') return [];
      
      let list: BookingExtensionCost[] = [];
      if (booking) {
          list = booking.costDetails.extensionCosts || [];
      } else if (job) {
          // If viewing a single job, try to get extensions from its booking details first
          // fallback to job specific extensions if structure differs
          list = job.bookingCostDetails?.extensionCosts || [];
      }
      return list;
  }, [booking, job, type]);

  // Helper to generate description
  const generateDescription = (prefix: string, specificInvoice?: string) => {
      let jobCodes = '';
      let bkNumber = '';

      if (booking) {
          jobCodes = booking.jobs.map(j => j.jobCode).filter(Boolean).join('+');
          bkNumber = booking.bookingId;
      } else if (job) {
          bkNumber = job.booking;
          if (allJobs && job.booking) {
              const siblings = allJobs.filter(j => j.booking === job.booking);
              if (siblings.length > 0) {
                  jobCodes = siblings.map(j => j.jobCode).filter(Boolean).join('+');
              } else {
                  jobCodes = job.jobCode;
              }
          } else {
              jobCodes = job.jobCode;
          }
      }
      
      const invoicePart = specificInvoice ? ` hóa đơn ${specificInvoice}` : '';
      return `${prefix} ${jobCodes} BL ${bkNumber}${invoicePart} (kimberry)`;
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
          // Local Charge Payment
          initialData.tkNo = '3311'; 
          initialData.docNo = generateNextDocNo(jobsForCalc, 'UNC');
          
          if (booking) {
             const summary = booking.costDetails.localCharge;
             initialData.amount = summary.hasInvoice ? (summary.net + summary.vat) : summary.total;
             initialData.paymentContent = generateDescription("Chi tiền cho ncc lô");
             initialData.receiverName = booking.line;
          } else if (job) {
             initialData.amount = job.chiPayment || 0; 
             initialData.receiverName = job.line;
             
             if (job.amisPaymentDocNo) {
                 initialData.docNo = job.amisPaymentDocNo;
                 initialData.paymentContent = job.amisPaymentDesc || '';
                 initialData.date = job.amisPaymentDate || today;
             } else {
                 initialData.paymentContent = generateDescription("Chi tiền cho ncc lô");
             }
          }
      } 
      else if (type === 'deposit') {
          // Chi Cược (Deposit Out)
          initialData.tkNo = '1388';
          initialData.docNo = generateNextDocNo(jobsForCalc, 'UNC');
          
          if (booking) {
              const depTotal = booking.costDetails.deposits.reduce((s,d) => s+d.amount, 0);
              initialData.amount = depTotal;
              initialData.paymentContent = generateDescription("Chi tiền cược lô");
              initialData.receiverName = booking.line;
          } else if (job) {
              initialData.amount = job.chiCuoc || 0;
              initialData.receiverName = job.line;
              
              if (job.amisDepositOutDocNo) {
                  initialData.docNo = job.amisDepositOutDocNo;
                  initialData.paymentContent = job.amisDepositOutDesc || '';
                  initialData.date = job.amisDepositOutDate || today;
              } else {
                  initialData.paymentContent = generateDescription("Chi tiền cược lô");
              }
          }
      }
      else if (type === 'extension') {
          // Chi Gia Hạn (Extension Out)
          initialData.tkNo = '13111';
          initialData.docNo = generateNextDocNo(jobsForCalc, 'UNC');
          
          // Check if previous payment exists
          const existingDoc = booking 
            ? booking.jobs[0]?.amisExtensionPaymentDocNo
            : job?.amisExtensionPaymentDocNo;
            
          const existingDesc = booking
            ? booking.jobs[0]?.amisExtensionPaymentDesc
            : job?.amisExtensionPaymentDesc;
            
          const existingDate = booking
            ? booking.jobs[0]?.amisExtensionPaymentDate
            : job?.amisExtensionPaymentDate;
            
          // PREFER SAVED AMOUNT if available, otherwise calculate total
          const savedAmount = booking
            ? booking.jobs.reduce((s, j) => s + (j.amisExtensionPaymentAmount || 0), 0) // Sum of parts if split, but usually it's one
            : job?.amisExtensionPaymentAmount;

          if (existingDoc) {
              initialData.docNo = existingDoc;
              initialData.paymentContent = existingDesc || '';
              initialData.date = existingDate || today;
          } else {
              initialData.paymentContent = generateDescription("Chi tiền cho ncc GH lô");
          }

          if (savedAmount && savedAmount > 0) {
              initialData.amount = savedAmount;
          } else {
              // Fallback to total cost
              if (booking) {
                  const extTotal = booking.costDetails.extensionCosts.reduce((s,e) => s+e.total, 0);
                  initialData.amount = extTotal;
                  initialData.receiverName = booking.line;
              } else if (job) {
                  const extTotal = (job.bookingCostDetails?.extensionCosts || []).reduce((s,e) => s+e.total, 0);
                  initialData.amount = extTotal;
                  initialData.receiverName = job.line;
              }
          }
      }

      setFormData(initialData);
      setSelectedExtensionId(''); // Reset selection on open
    }
  }, [isOpen, job, booking, type, allJobs]);

  // Handle Extension Selection
  const handleSelectExtension = (extId: string) => {
      setSelectedExtensionId(extId);
      
      if (!extId) {
          // Revert to Total
          if (booking) {
              const total = booking.costDetails.extensionCosts.reduce((s,e) => s+e.total, 0);
              setFormData(prev => ({ 
                  ...prev, 
                  amount: total,
                  paymentContent: generateDescription("Chi tiền cho ncc GH lô")
              }));
          } else if (job) {
              const total = (job.bookingCostDetails?.extensionCosts || []).reduce((s,e) => s+e.total, 0);
              setFormData(prev => ({ 
                  ...prev, 
                  amount: total,
                  paymentContent: generateDescription("Chi tiền cho ncc GH lô")
              }));
          }
          return;
      }

      // Pick Specific Extension
      const targetExt = availableExtensions.find(e => e.id === extId);
      if (targetExt) {
          setFormData(prev => ({
              ...prev,
              amount: targetExt.total,
              paymentContent: generateDescription("Chi tiền cho ncc GH lô", targetExt.invoice)
          }));
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (val: string) => {
    setFormData(prev => ({ ...prev, date: val }));
  };

  const handleAmountChange = (val: number) => {
    setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Include selectedExtensionId in the payload
    onSave({
        ...formData,
        selectedExtensionId: selectedExtensionId || undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shadow-sm border border-red-200">
                <CreditCard className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">Phiếu Chi Tiền</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{type === 'local' ? 'Local Charge' : type === 'deposit' ? 'Cược (Deposit)' : 'Gia Hạn (Extension)'}</p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
               <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Extension Selector - Only visible for 'extension' type */}
                {type === 'extension' && availableExtensions.length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold text-sm">
                            <ChevronDown className="w-4 h-4" />
                            Chọn phiếu gia hạn để chi
                        </div>
                        <select
                            className="w-full p-2.5 bg-white border border-orange-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none text-slate-700"
                            value={selectedExtensionId}
                            onChange={(e) => handleSelectExtension(e.target.value)}
                        >
                            <option value="">-- Chi gộp tất cả ({new Intl.NumberFormat('en-US').format(availableExtensions.reduce((s,e)=>s+e.total, 0))} VND) --</option>
                            {availableExtensions.map(ext => (
                                <option key={ext.id} value={ext.id}>
                                    [HĐ: {ext.invoice || 'Chưa có số'}] - {new Intl.NumberFormat('en-US').format(ext.total)} VND (Ngày: {formatDateVN(ext.date)})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <Calendar className="w-4 h-4 mr-2 text-red-500" /> Thông tin chung
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
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <User className="w-4 h-4 mr-2 text-red-500" /> Đối tượng & Nội dung
                   </h3>
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <Label>Người nhận</Label>
                         <input 
                            type="text" 
                            name="receiverName" 
                            value={formData.receiverName} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Lý do chi</Label>
                         <input 
                            type="text" 
                            name="reason" 
                            value={formData.reason} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Diễn giải chi tiết</Label>
                         <textarea 
                            name="paymentContent" 
                            rows={2}
                            value={formData.paymentContent} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <DollarSign className="w-4 h-4 mr-2 text-red-500" /> Hạch toán (VND)
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                      <div className="space-y-1.5">
                         <Label>TK Nợ</Label>
                         <input 
                            type="text" 
                            name="tkNo" 
                            value={formData.tkNo} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500" 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <Label>TK Có</Label>
                         <input 
                            type="text" 
                            name="tkCo" 
                            value={formData.tkCo} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center text-blue-700 focus:outline-none focus:ring-2 focus:ring-red-500" 
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
                               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-red-600 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                           />
                      </div>
                   </div>
                </div>

                <div className="text-xs text-slate-500 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm italic">
                   * Mặc định: TK Nợ {formData.tkNo}, TK Có 1121, Ngân hàng TMCP Quân đội.
                </div>

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
