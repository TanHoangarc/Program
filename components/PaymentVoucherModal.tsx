
import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, CreditCard, User, Building2, Banknote } from 'lucide-react';
import { JobData, BookingSummary } from '../types';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any; // Can be row data from AmisExport
  job?: JobData; // Context from JobEntry/BookingList
  booking?: BookingSummary; // Context from BookingList
  type?: 'local' | 'deposit' | 'extension'; // Payment type
}

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  isOpen, onClose, onSave, initialData, job, booking, type
}) => {
  // Default State matching Excel Template
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Ngày hạch toán/chứng từ
    docNo: '',
    reason: 'Chi khác',
    paymentContent: '',
    
    // Payer Info (Defaults - Hidden from UI but kept for data structure)
    paymentAccount: '345673979999',
    paymentBank: 'Ngân hàng TMCP Quân đội',
    
    // Payee Info
    objCode: '',
    objName: '',
    address: '',
    receiverAccount: '',
    receiverBank: '',
    receiverName: '',
    
    // Metadata
    currency: 'VND',
    rate: '',
    
    // Accounting
    description: '',
    tkNo: '3311',
    tkCo: '1121',
    amount: 0,
    
    // Extra
    objCodeAccounting: '',
    loanContract: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Load from existing row (AmisExport)
        setFormData(prev => ({ ...prev, ...initialData }));
      } else if (booking || job) {
        // Auto-fill from Booking/Job Context
        let amount = 0;
        let content = '';
        let docNo = '';
        const lineCode = booking ? booking.line : (job?.line || '');
        const date = new Date().toISOString().split('T')[0];
        
        // Generate Job String "JOB1+JOB2..."
        const jobListStr = booking 
            ? booking.jobs.map(j => j.jobCode).join('+') 
            : (job?.jobCode || '');
        const bookingNo = booking ? booking.bookingId : (job?.booking || '');

        if (type === 'local') {
           // Chi Local Charge
           amount = booking ? booking.totalCost : (job?.chiPayment || 0);
           // Format: "Chi tiền cho ncc lô a+b+c BL xx (Kimberry)"
           content = `Chi tiền cho ncc lô ${jobListStr} BL ${bookingNo} (Kimberry)`;
           docNo = `UNC-${bookingNo || jobListStr}-L`;
        } else if (type === 'deposit') {
           // Chi Cược
           // Format: "Chi tiền cho ncc CƯỢC lô a+b+c BL xx (Kimberry)"
           content = `Chi tiền cho ncc CƯỢC lô ${jobListStr} BL ${bookingNo} (Kimberry)`;
           docNo = `UNC-${bookingNo || jobListStr}-C`;
        } else if (type === 'extension') {
           // Chi Gia Hạn
           // Format: "Chi tiền cho ncc GH BL xx (Kimberry)"
           content = `Chi tiền cho ncc GH BL ${bookingNo} (Kimberry)`;
           docNo = `UNC-${bookingNo || jobListStr}-GH`;
        }

        setFormData(prev => ({
            ...prev,
            date,
            docNo,
            paymentContent: content,
            description: content, // Description matches Content
            amount: amount,
            objCode: lineCode,
            objName: '', // User to fill or lookup
            objCodeAccounting: lineCode
        }));
      }
    }
  }, [isOpen, initialData, job, booking, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const updated = { ...prev, [name]: value };
        // Sync description with paymentContent if paymentContent changes
        if (name === 'paymentContent') {
            updated.description = value;
        }
        return updated;
    });
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

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 border border-gray-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Banknote className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Phiếu Chi Tiền (Ủy Nhiệm Chi)</h2>
                <p className="text-xs text-slate-400 font-medium">{formData.docNo}</p>
            </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
               <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-8 bg-slate-50/50">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. General Info */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <Calendar className="w-3 h-3 mr-1.5" /> Thông tin chứng từ
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Ngày chứng từ (*)</label>
                         <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Số chứng từ (*)</label>
                         <input type="text" name="docNo" value={formData.docNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-blue-700 bg-blue-50/30" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Lý do chi</label>
                         <input type="text" name="reason" value={formData.reason} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </div>
                   </div>
                   <div className="mt-4 space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">Nội dung thanh toán</label>
                      <input type="text" name="paymentContent" value={formData.paymentContent} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" placeholder="VD: Chi tiền cho ncc..." />
                   </div>
                </div>

                {/* 2. Receiver Info (Simplified) */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <User className="w-3 h-3 mr-1.5" /> Thông tin đối tượng nhận tiền
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Mã đối tượng</label>
                         <input type="text" name="objCode" value={formData.objCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Tên đối tượng</label>
                         <input type="text" name="objName" value={formData.objName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                   </div>
                </div>

                {/* 3. Amount (Simplified - Hidden Accounting) */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <DollarSign className="w-3 h-3 mr-1.5" /> Số tiền
                   </h3>
                   <div className="relative">
                      <input 
                          type="text" 
                          value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                          onChange={(e) => {
                              const val = Number(e.target.value.replace(/,/g, ''));
                              if (!isNaN(val)) handleAmountChange(val);
                          }}
                          className="w-full pl-3 pr-12 py-3 border border-red-200 rounded-lg text-2xl font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50/30 text-right"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-red-300">VND</span>
                   </div>
                   <div className="mt-3 text-xs text-gray-400 text-right italic">
                      Hạch toán ngầm định: Nợ {formData.tkNo} / Có {formData.tkCo}
                   </div>
                </div>

            </form>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg transition-all flex items-center">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>
  );
};
