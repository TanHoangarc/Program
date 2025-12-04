
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, FileText, ShoppingCart } from 'lucide-react';
import { JobData } from '../types';
import { formatDateVN, parseDateVN } from '../utils';

interface SalesInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  job: JobData;
  initialData?: any;
}

// Consistent DateInput
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
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
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

export const SalesInvoiceModal: React.FC<SalesInvoiceModalProps> = ({
  isOpen, onClose, onSave, job, initialData
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], 
    docDate: new Date().toISOString().split('T')[0], 
    docNo: '',
    customerCode: 'LONGHOANGKIMBERRY',
    description: '',
    amount: 0,
    salesType: 'Bán hàng hóa trong nước',
    paymentMethod: 'Chưa thu tiền',
    isDeliveryVoucher: 'Không',
    isInvoiceIncluded: 'Không',
    currency: 'VND',
    itemCode: 'AGENT FEE',
    isNote: 'Không',
    tkNo: '13112',
    tkCo: '51111',
    quantity: 1,
    vatRate: '0%',
    tkVat: '33311',
    projectCode: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(prev => ({ ...prev, ...initialData }));
      } else {
        const year = new Date().getFullYear().toString().slice(-2); 
        const month = (job.month || '01').padStart(2, '0'); 
        const projectCode = `K${year}${month}${job.jobCode}`;
        
        const docNo = `PBH-${job.jobCode}`;
        const description = `Bán hàng LONG HOÀNG - KIMBERRY BILL ${job.booking || ''} là cost ${job.hbl || ''} (không xuất hóa đơn)`;

        setFormData(prev => ({
          ...prev,
          docNo,
          description,
          amount: job.sell || 0,
          projectCode
        }));
      }
    }
  }, [isOpen, job, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: 'date' | 'docDate', val: string) => {
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleAmountChange = (val: number) => {
    setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-purple-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shadow-sm border border-purple-200">
                <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">Phiếu Bán Hàng</h2>
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
                       <Calendar className="w-4 h-4 mr-2 text-purple-500" /> Thông tin chứng từ
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                         <Label>Ngày hạch toán</Label>
                         <DateInput value={formData.date} onChange={(val) => handleDateChange('date', val)} />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Ngày chứng từ</Label>
                         <DateInput value={formData.docDate} onChange={(val) => handleDateChange('docDate', val)} />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Số chứng từ</Label>
                         <input 
                            type="text" 
                            name="docNo" 
                            value={formData.docNo} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500" 
                            required 
                         />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Mã khách hàng</Label>
                         <input 
                            type="text" 
                            name="customerCode" 
                            value={formData.customerCode} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <FileText className="w-4 h-4 mr-2 text-purple-500" /> Chi tiết hàng hóa
                   </h3>
                   
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <Label>Diễn giải</Label>
                         <textarea 
                            name="description" 
                            rows={2}
                            value={formData.description} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" 
                        />
                      </div>

                      <div className="space-y-1.5">
                         <Label>Mã công trình</Label>
                         <input 
                            type="text" 
                            name="projectCode" 
                            value={formData.projectCode} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                         />
                      </div>

                      <div className="space-y-1.5">
                           <Label>Đơn giá (Sell)</Label>
                           <div className="relative">
                              <input 
                                  type="text" 
                                  value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                                  onChange={(e) => {
                                      const val = Number(e.target.value.replace(/,/g, ''));
                                      if (!isNaN(val)) handleAmountChange(val);
                                  }}
                                  className="w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-lg text-xl font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-right"
                              />
                              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                           </div>
                      </div>
                   </div>
                </div>

                <div className="text-xs text-slate-500 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm italic">
                   * Mặc định: AGENT FEE, TK 13112/51111, VND, SL: 1, Thuế 0% (33311), Bán hàng trong nước, Chưa thu tiền.
                </div>

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
