
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle } from 'lucide-react';
import { JobData, Customer } from '../types';
import { formatDateVN, parseDateVN } from '../utils';

export type ReceiveMode = 'local' | 'deposit' | 'extension';

interface QuickReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobData) => void;
  job: JobData;
  mode: ReceiveMode;
  customers: Customer[];
}

// Reusable DateInput Component (High Contrast)
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
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
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

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers
}) => {
  const [formData, setFormData] = useState<JobData>(job);
  
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0],
    total: 0
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(JSON.parse(JSON.stringify(job)));
      if (mode === 'extension') {
          setNewExtension({ 
            customerId: job.customerId || '', 
            invoice: '', 
            date: new Date().toISOString().split('T')[0],
            total: 0 
          });
      }
    }
  }, [isOpen, job, mode]);

  const getDisplayValues = () => {
      let docNo = '';
      let desc = '';
      let tkNo = '1121';
      let tkCo = '';
      let currentDate = '';
      let currentAmount = 0;
      let currentCustomer = '';
      let currentInvoice = '';

      if (mode === 'local') {
          docNo = `PT-LC-${job.jobCode}`;
          currentInvoice = formData.localChargeInvoice || '';
          desc = `Thu tiền khách hàng theo hoá đơn ${currentInvoice} (KIM)`;
          tkCo = '13111';
          currentDate = formData.localChargeDate || '';
          currentAmount = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit') {
          docNo = `PT-C-${job.jobCode}`;
          desc = `Thu tiền khách hàng CƯỢC BL ${job.jobCode}`;
          tkCo = '1388';
          currentDate = formData.ngayThuCuoc || '';
          currentAmount = formData.thuCuoc || 0;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A'; 
      } else if (mode === 'extension') {
          const nextIdx = (job.extensions || []).length + 1;
          docNo = `PT-GH-${job.jobCode}-${nextIdx}`;
          currentInvoice = newExtension.invoice;
          desc = `Thu tiền khách hàng theo hoá đơn GH ${currentInvoice}`;
          tkCo = '13111';
          currentDate = newExtension.date;
          currentAmount = newExtension.total;
          currentCustomer = newExtension.customerId;
      }

      const customerName = customers.find(c => c.id === currentCustomer)?.name || '';

      return { docNo, desc, tkNo, tkCo, currentDate, currentAmount, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();

  const handleAmountChange = (val: number) => {
      if (mode === 'local') setFormData(prev => ({ ...prev, localChargeTotal: val }));
      else if (mode === 'deposit') setFormData(prev => ({ ...prev, thuCuoc: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, total: val }));
  };

  const handleDateChange = (val: string) => {
      if (mode === 'local') setFormData(prev => ({ ...prev, localChargeDate: val }));
      else if (mode === 'deposit') setFormData(prev => ({ ...prev, ngayThuCuoc: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, date: val }));
  };

  const handleCustomerChange = (val: string) => {
      if (mode === 'local') setFormData(prev => ({ ...prev, customerId: val }));
      else if (mode === 'deposit') setFormData(prev => ({ ...prev, maKhCuocId: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, customerId: val }));
  };

  const handleInvoiceChange = (val: string) => {
      if (mode === 'local') setFormData(prev => ({ ...prev, localChargeInvoice: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, invoice: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'extension') {
      const updatedExtensions = [
        ...(formData.extensions || []),
        {
          id: Date.now().toString(),
          customerId: newExtension.customerId,
          invoice: newExtension.invoice,
          invoiceDate: newExtension.date,
          net: 0, 
          vat: 0,
          total: newExtension.total
        }
      ];
      onSave({ ...formData, extensions: updatedExtensions });
    } else {
      onSave(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (mode) {
        case 'local': return 'Phiếu Thu Tiền (Local Charge)';
        case 'deposit': return 'Phiếu Thu Tiền (Cược)';
        case 'extension': return 'Phiếu Thu Tiền (Gia Hạn)';
    }
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
  );

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shadow-sm border border-blue-200">
                <FileText className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Job: <span className="font-bold text-blue-700">{job.jobCode}</span></p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
            <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                    Thông tin chung
                </h3>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <Label>Ngày Chứng Từ</Label>
                        <DateInput 
                            value={display.currentDate} 
                            onChange={handleDateChange}
                        />
                    </div>
                    <div>
                        <Label>Số Chứng Từ (Auto)</Label>
                        <input 
                            type="text" 
                            value={display.docNo} 
                            readOnly
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-blue-800 cursor-not-allowed"
                        />
                    </div>
                </div>

                {mode !== 'deposit' && (
                     <div className="mt-4">
                        <Label>Số Hóa Đơn (Invoice)</Label>
                        <input 
                            type="text" 
                            required
                            value={display.currentInvoice} 
                            onChange={(e) => handleInvoiceChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
                            placeholder="Nhập số hóa đơn..."
                        />
                    </div>
                )}
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <User className="w-4 h-4 text-green-600 mr-2" />
                    Đối tượng & Số tiền
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <div>
                        <Label>Mã Đối Tượng</Label>
                         <div className="relative">
                            <select
                                value={display.currentCustomer}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none font-medium text-slate-900"
                            >
                                <option value="">-- Chọn khách hàng --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                         </div>
                        </div>
                        <div>
                            <Label>Tên Đối Tượng</Label>
                            <input 
                                type="text" 
                                value={display.customerName} 
                                readOnly
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-600 font-medium"
                            />
                        </div>
                </div>
                
                <div>
                        <Label>Số Tiền Thu</Label>
                        <div className="relative">
                        <input 
                            type="text" 
                            required
                            value={display.currentAmount ? new Intl.NumberFormat('en-US').format(display.currentAmount) : ''} 
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) handleAmountChange(val);
                            }}
                            className="w-full pl-4 pr-14 py-3 bg-white border border-slate-300 rounded-xl text-2xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                            placeholder="0"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                        </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <CreditCard className="w-4 h-4 text-purple-600 mr-2" />
                    Hạch toán & Diễn giải
                </h3>
                
                <div className="grid grid-cols-2 gap-5 mb-4">
                    <div>
                        <Label>TK Nợ</Label>
                        <input 
                            type="text" 
                            value={display.tkNo} 
                            readOnly
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-slate-700"
                        />
                    </div>
                    <div>
                        <Label>TK Có</Label>
                        <input 
                            type="text" 
                            value={display.tkCo} 
                            readOnly
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-blue-700"
                        />
                    </div>
                </div>

                <div>
                    <Label>Diễn giải lý do thu (Auto)</Label>
                    <textarea 
                        value={display.desc} 
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 resize-none focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-600 px-3 py-2 font-medium bg-white rounded-lg border border-slate-200 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Mặc định: Ngân hàng TMCP Quân đội (MB) - TK: 345673979999</span>
            </div>

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
