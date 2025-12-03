import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, FileText, ShoppingCart, CheckCircle } from 'lucide-react';
import { JobData } from '../types';

interface SalesInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  job: JobData;
  initialData?: any;
}

export const SalesInvoiceModal: React.FC<SalesInvoiceModalProps> = ({
  isOpen, onClose, onSave, job, initialData
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Ngày hạch toán
    docDate: new Date().toISOString().split('T')[0], // Ngày chứng từ
    docNo: '',
    customerCode: 'LONGHOANGKIMBERRY',
    description: '',
    amount: 0,
    
    // Default Hidden Fields
    salesType: 'Bán hàng hóa trong nước',
    paymentMethod: 'Chưa thu tiền',
    isDeliveryVoucher: 'Không', // Kiêm phiếu xuất kho
    isInvoiceIncluded: 'Không', // Lập kèm hóa đơn
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
        // Auto-generate logic
        const year = new Date().getFullYear().toString().slice(-2); // 25
        const month = (job.month || '01').padStart(2, '0'); // 07
        const projectCode = `K${year}${month}${job.jobCode}`;
        
        const docNo = `PBH-${job.jobCode}`;
        // "Bán hàng LONG HOÀNG - KIMBERRY BILL xx là cost a (không xuất hóa đơn)"
        // xx là booking, a là HBL
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
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Phiếu Bán Hàng</h2>
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
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Ngày hạch toán</label>
                         <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Ngày chứng từ</label>
                         <input type="date" name="docDate" value={formData.docDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Số chứng từ</label>
                         <input type="text" name="docNo" value={formData.docNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-purple-700 bg-purple-50/30" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Mã khách hàng</label>
                         <input type="text" name="customerCode" value={formData.customerCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                   </div>
                </div>

                {/* 2. Details */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <FileText className="w-3 h-3 mr-1.5" /> Chi tiết hàng hóa
                   </h3>
                   
                   <div className="space-y-4">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Diễn giải</label>
                         <textarea 
                            name="description" 
                            rows={2}
                            value={formData.description} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                      </div>

                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Mã công trình</label>
                         <input type="text" name="projectCode" value={formData.projectCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>

                      <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-gray-500 flex items-center">
                              <DollarSign className="w-3 h-3 mr-1" /> Đơn giá (Sell)
                           </label>
                           <div className="relative">
                              <input 
                                  type="text" 
                                  value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                                  onChange={(e) => {
                                      const val = Number(e.target.value.replace(/,/g, ''));
                                      if (!isNaN(val)) handleAmountChange(val);
                                  }}
                                  className="w-full pl-3 pr-12 py-3 border border-purple-200 rounded-lg text-xl font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/30 text-right"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-purple-300">VND</span>
                           </div>
                      </div>
                   </div>
                </div>

                {/* Default Hidden Info */}
                <div className="text-xs text-gray-400 px-2 italic">
                   * Mặc định: AGENT FEE, TK 13112/51111, VND, SL: 1, Thuế 0% (33311), Bán hàng trong nước, Chưa thu tiền.
                </div>

            </form>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all flex items-center">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>
  );
};