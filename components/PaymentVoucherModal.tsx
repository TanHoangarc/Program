import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, User, Banknote, CheckCircle } from 'lucide-react';
import { JobData, BookingSummary } from '../types';
import { formatDateVN, parseDateVN } from '../utils';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any; 
  job?: JobData;
  booking?: BookingSummary;
  type?: 'local' | 'deposit' | 'extension';
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
    <div className={`relative w-full ${className}`}>
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

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
);

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  isOpen, onClose, onSave, initialData, job, booking, type
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], 
    docNo: '',
    reason: 'Chi khác',
    paymentContent: '',
    paymentAccount: '345673979999',
    paymentBank: 'Ngân hàng TMCP Quân đội',
    objCode: '',
    objName: '',
    address: '',
    currency: 'VND',
    rate: '',
    description: '',
    tkNo: '3311',
    tkCo: '1121',
    amount: 0,
    objCodeAccounting: '',
    loanContract: ''
  });

  // Generate random UNC number
  const generateUNC = () => {
      const random = Math.floor(10000 + Math.random() * 90000);
      return `UNC${random}`;
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(prev => ({ ...prev, ...initialData }));
      } else if (booking || job) {
        let amount = 0;
        let content = '';
        let docNo = '';
        
        // Try to check if existing AMIS data is present in the first job of the booking
        const firstJob = booking?.jobs[0] || job;
        
        const lineCode = booking ? booking.line : (job?.line || '');
        const date = new Date().toISOString().split('T')[0];
        
        const jobListStr = booking 
            ? booking.jobs.map(j => j.jobCode).join('+') 
            : (job?.jobCode || '');
        const bookingNo = booking ? booking.bookingId : (job?.booking || '');

        if (type === 'local') {
           // Check if already created
           if (firstJob?.amisPaymentDocNo) {
               docNo = firstJob.amisPaymentDocNo;
               content = firstJob.amisPaymentDesc || '';
               // Ensure we don't overwrite date if it exists, otherwise default
               // date = firstJob.amisPaymentDate || date; 
           } else {
               docNo = generateUNC();
               content = `Chi tiền cho ncc ${lineCode} lô ${jobListStr} BL ${bookingNo}`;
           }
           amount = booking ? booking.totalCost : (job?.chiPayment || 0);
           
        } else if (type === 'deposit') {
           // Check if already created
           if (firstJob?.amisDepositOutDocNo) {
               docNo = firstJob.amisDepositOutDocNo;
               content = firstJob.amisDepositOutDesc || '';
           } else {
               docNo = generateUNC();
               content = `Chi tiền cược cho ncc ${lineCode} lô ${jobListStr}`;
           }
           // Calc deposit amount from booking details if available
           const depositAmt = booking?.costDetails.deposits.reduce((s,d) => s + d.amount, 0) || job?.chiCuoc || 0;
           amount = depositAmt;

        } else if (type === 'extension') {
           docNo = generateUNC();
           content = `Chi tiền gia hạn cho ncc ${lineCode} BL ${bookingNo}`;
           // Extension logic might vary, usually simple
        }

        setFormData(prev => ({
            ...prev,
            date,
            docNo,
            paymentContent: content,
            description: content,
            amount: amount,
            objCode: lineCode,
            objName: '',
            objCodeAccounting: lineCode
        }));
      }
    }
  }, [isOpen, initialData, job, booking, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const updated = { ...prev, [name]: value };
        if (name === 'paymentContent') {
            updated.description = value;
        }
        return updated;
    });
  };

  const handleDateChange = (val: string) => {
    setFormData(prev => ({ ...prev, date: val }));
  };

  const handleAmountChange = (val: number) => {
    setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shadow-sm border border-red-200">
                <Banknote className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">Phiếu Chi Tiền</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{formData.docNo}</p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
               <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-5">
                
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
                         <Label>Số chứng từ (Auto)</Label>
                         <input 
                            type="text" 
                            name="docNo" 
                            value={formData.docNo} 
                            readOnly 
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-red-600 cursor-not-allowed" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <User className="w-4 h-4 mr-2 text-red-500" /> Đối tượng
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                      <div className="space-y-1.5">
                         <Label>Mã Đối tượng</Label>
                         <input 
                            type="text" 
                            name="objCode" 
                            value={formData.objCode} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Tên Đối tượng</Label>
                         <input 
                            type="text" 
                            name="objName" 
                            value={formData.objName} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <DollarSign className="w-4 h-4 mr-2 text-red-500" /> Chi tiết thanh toán
                   </h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                      <div className="col-span-1 space-y-1.5">
                           <Label>Số tiền</Label>
                           <input 
                               type="text" 
                               value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                               onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleAmountChange(val);
                               }}
                               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-red-600 text-right focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                           />
                      </div>
                      <div className="space-y-1.5">
                           <Label>TK Nợ</Label>
                           <input 
                                type="text" 
                                name="tkNo" 
                                value={formData.tkNo} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-center font-medium focus:ring-2 focus:ring-red-500 outline-none"
                           />
                      </div>
                      <div className="space-y-1.5">
                           <Label>TK Có</Label>
                           <input 
                                type="text" 
                                name="tkCo" 
                                value={formData.tkCo} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-center font-medium focus:ring-2 focus:ring-red-500 outline-none"
                           />
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <Label>Nội dung thanh toán</Label>
                      <textarea 
                        name="paymentContent" 
                        rows={2}
                        value={formData.paymentContent} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none" 
                      />
                   </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-600 px-3 py-2 font-medium bg-white rounded-lg border border-slate-200 shadow-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>TK Chi: 345673979999 (MB Bank) - Lý do: Chi khác</span>
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