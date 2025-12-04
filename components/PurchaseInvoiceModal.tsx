
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, ShoppingBag, Building2 } from 'lucide-react';
import { BookingSummary, ShippingLine } from '../types';
import { formatDateVN, parseDateVN } from '../utils';

interface PurchaseInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  booking: BookingSummary;
  lines?: ShippingLine[];
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
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
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

export const PurchaseInvoiceModal: React.FC<PurchaseInvoiceModalProps> = ({
  isOpen, onClose, onSave, booking, lines, initialData
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    docNo: '',
    invoiceNo: '',
    supplierCode: '',
    supplierName: '', 
    description: '',
    itemName: 'Phí Local Charge',
    netAmount: 0,
    vatAmount: 0,
    purchaseType: 'Mua hàng trong nước không qua kho',
    paymentMethod: 'Chưa thanh toán',
    invoiceIncluded: 'Nhận kèm hóa đơn',
    importSlipNo: '1',
    currency: 'VND',
    itemCode: 'LCC',
    isNote: 'Không',
    tkCost: '63211',
    tkPayable: '3311',
    quantity: 1,
    vatRate: '5%',
    tkVat: '1331' 
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(prev => ({ ...prev, ...initialData }));
      } else if (booking) {
        const lcDetails = booking.costDetails.localCharge;
        const date = lcDetails.date || new Date().toISOString().split('T')[0];
        
        const mainNet = lcDetails.net || 0;
        const mainVat = lcDetails.vat || 0;
        const addNet = (booking.costDetails.additionalLocalCharges || []).reduce((s, i) => s + (i.net || 0), 0);
        const addVat = (booking.costDetails.additionalLocalCharges || []).reduce((s, i) => s + (i.vat || 0), 0);
        
        const totalNet = mainNet + addNet;
        const totalVat = mainVat + addVat;

        const lineObj = (lines || []).find(l => l.code === booking.line);
        const supplierName = lineObj ? lineObj.name : booking.line;
        const defaultItemName = lineObj?.itemName || 'Phí Local Charge';

        const docNo = `PMH-${booking.bookingId}`;
        const description = `Mua hàng của ${supplierName} BILL ${booking.bookingId}`;

        setFormData(prev => ({
          ...prev,
          date,
          docNo,
          invoiceNo: lcDetails.invoice || '',
          supplierCode: booking.line,
          supplierName: supplierName,
          description,
          itemName: defaultItemName,
          netAmount: totalNet,
          vatAmount: totalVat
        }));
      }
    }
  }, [isOpen, booking, initialData, lines]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (val: string) => {
    setFormData(prev => ({ ...prev, date: val }));
  };

  const handleAmountChange = (name: 'netAmount' | 'vatAmount', val: number) => {
    setFormData(prev => ({ ...prev, [name]: val }));
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
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-teal-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg shadow-sm border border-teal-200">
                <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">Phiếu Mua Hàng</h2>
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
                       <Calendar className="w-4 h-4 mr-2 text-teal-500" /> Thông tin chứng từ & Hóa đơn
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                         <Label>Ngày Hạch toán / HĐ</Label>
                         <DateInput value={formData.date} onChange={handleDateChange} />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Số chứng từ</Label>
                         <input type="text" name="docNo" value={formData.docNo} onChange={handleChange} className="w-full px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm font-bold text-teal-700 outline-none" required />
                      </div>
                      <div className="space-y-1.5">
                         <Label>Số hóa đơn</Label>
                         <input type="text" name="invoiceNo" value={formData.invoiceNo} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <Building2 className="w-4 h-4 mr-2 text-teal-500" /> Nhà cung cấp & Nội dung
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                      <div className="space-y-1.5">
                         <Label>Mã Nhà cung cấp</Label>
                         <input type="text" name="supplierCode" value={formData.supplierCode} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                         <Label>Diễn giải</Label>
                         <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                         <Label>Tên hàng</Label>
                         <input type="text" name="itemName" value={formData.itemName} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center">
                       <DollarSign className="w-4 h-4 mr-2 text-teal-500" /> Giá trị (VND)
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                           <Label>Đơn giá (Net)</Label>
                           <input 
                               type="text" 
                               value={new Intl.NumberFormat('en-US').format(formData.netAmount)} 
                               onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleAmountChange('netAmount', val);
                               }}
                               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                           />
                      </div>
                      <div className="space-y-1.5">
                           <Label>Tiền thuế GTGT</Label>
                           <input 
                               type="text" 
                               value={new Intl.NumberFormat('en-US').format(formData.vatAmount)} 
                               onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleAmountChange('vatAmount', val);
                               }}
                               className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                           />
                      </div>
                   </div>
                </div>

                <div className="text-xs text-slate-500 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm italic">
                   * Mặc định: LCC, TK 63211/3311, VAT 5%, Mua hàng trong nước không qua kho, 1331.
                </div>

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
