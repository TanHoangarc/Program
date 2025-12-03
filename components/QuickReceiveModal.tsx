
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle } from 'lucide-react';
import { JobData, Customer } from '../types';

export type ReceiveMode = 'local' | 'deposit' | 'extension';

interface QuickReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobData) => void;
  job: JobData;
  mode: ReceiveMode;
  customers: Customer[];
}

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers
}) => {
  // Base Job Data state
  const [formData, setFormData] = useState<JobData>(job);
  
  // Extension specific state (for adding NEW extension)
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0],
    total: 0
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(JSON.parse(JSON.stringify(job)));
      // Reset extension form if opening in extension mode
      if (mode === 'extension') {
          // Default customer to Job's customer
          setNewExtension({ 
            customerId: job.customerId || '', 
            invoice: '', 
            date: new Date().toISOString().split('T')[0],
            total: 0 
          });
      }
    }
  }, [isOpen, job, mode]);

  // --- LOGIC: GENERATE DISPLAY VALUES ---
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
          currentInvoice = 'N/A'; // Deposit doesn't have invoice
      } else if (mode === 'extension') {
          // Generate a temporary ID for display
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

  // --- HANDLERS ---
  
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
      // Deposit has no invoice field
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

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 border border-gray-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <FileText className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">{getTitle()}</h2>
                <p className="text-xs text-slate-400 font-medium">Job: {job.jobCode} - {mode === 'deposit' ? '1388' : '13111'}</p>
            </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
            <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-8 bg-slate-50/50">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: General Info */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                    <Calendar className="w-3 h-3 mr-1.5" /> Thông tin chung
                </h3>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Ngày Chứng Từ / Hạch Toán</label>
                        <input 
                            type="date" 
                            required
                            value={display.currentDate} 
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Số Chứng Từ (Auto)</label>
                        <input 
                            type="text" 
                            value={display.docNo} 
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-blue-700 bg-blue-50/30 cursor-not-allowed"
                        />
                    </div>
                </div>

                {/* Only Show Invoice Input for Local Charge & Extension */}
                {mode !== 'deposit' && (
                     <div className="mt-4 space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Số Hóa Đơn (Invoice)</label>
                        <input 
                            type="text" 
                            required
                            value={display.currentInvoice} 
                            onChange={(e) => handleInvoiceChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                            placeholder="Nhập số hóa đơn..."
                        />
                    </div>
                )}
            </div>

            {/* Section 2: Customer & Amount */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                    <User className="w-3 h-3 mr-1.5" /> Đối tượng & Số tiền
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Mã Đối Tượng</label>
                         <select
                            value={display.currentCustomer}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                        >
                            <option value="">-- Chọn khách hàng --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                        </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Tên Đối Tượng</label>
                            <input 
                                type="text" 
                                value={display.customerName} 
                                readOnly
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                            />
                        </div>
                </div>
                
                <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 flex items-center">
                        <DollarSign className="w-3 h-3 mr-1" /> Số Tiền Thu
                        </label>
                        <div className="relative">
                        <input 
                            type="text" 
                            required
                            value={display.currentAmount ? new Intl.NumberFormat('en-US').format(display.currentAmount) : ''} 
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) handleAmountChange(val);
                            }}
                            className="w-full pl-3 pr-12 py-3 border border-blue-200 rounded-lg text-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30 focus:bg-white transition-colors text-right"
                            placeholder="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-300">VND</span>
                        </div>
                </div>
            </div>

            {/* Section 3: Accounting & Description */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                    <CreditCard className="w-3 h-3 mr-1.5" /> Hạch toán & Diễn giải
                </h3>
                
                <div className="grid grid-cols-2 gap-6 mb-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">TK Nợ</label>
                        <input 
                            type="text" 
                            value={display.tkNo} 
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-center bg-gray-50"
                        />
                    </div>
                        <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">TK Có</label>
                        <input 
                            type="text" 
                            value={display.tkCo} 
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-center bg-gray-50 text-blue-700"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">Diễn giải lý do thu (Auto)</label>
                    <textarea 
                        value={display.desc} 
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 resize-none focus:outline-none"
                    />
                </div>
            </div>

            {/* Default Info */}
            <div className="flex items-center space-x-2 text-xs text-gray-400 px-2">
                <CheckCircle className="w-3 h-3" />
                <span>Mặc định: Ngân hàng TMCP Quân đội (MB) - TK: 345673979999</span>
            </div>

            </form>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>
  );
};
    