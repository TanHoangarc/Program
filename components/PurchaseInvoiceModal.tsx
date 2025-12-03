import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, ShoppingBag, Building2 } from 'lucide-react';
import { BookingSummary, ShippingLine } from '../types';

interface PurchaseInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  booking: BookingSummary;
  lines?: ShippingLine[]; // To lookup Supplier Name
  initialData?: any;
}

export const PurchaseInvoiceModal: React.FC<PurchaseInvoiceModalProps> = ({
  isOpen, onClose, onSave, booking, lines, initialData
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Ngày hạch toán / CT / HĐ
    docNo: '',
    invoiceNo: '',
    supplierCode: '',
    supplierName: '', // Tên công ty Line
    description: '',
    itemName: 'Phí Local Charge',
    netAmount: 0,
    vatAmount: 0,
    
    // Default Hidden Fields (Excel Config)
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
        // Auto-fill logic
        const lcDetails = booking.costDetails.localCharge;
        
        // Date priority: Invoice Date > Today
        const date = lcDetails.date || new Date().toISOString().split('T')[0];
        
        // Calculate Total Net and VAT from all Cost Invoices (Main + Additional)
        const mainNet = lcDetails.net || 0;
        const mainVat = lcDetails.vat || 0;
        const addNet = (booking.costDetails.additionalLocalCharges || []).reduce((s, i) => s + (i.net || 0), 0);
        const addVat = (booking.costDetails.additionalLocalCharges || []).reduce((s, i) => s + (i.vat || 0), 0);
        
        const totalNet = mainNet + addNet;
        const totalVat = mainVat + addVat;

        // Lookup Supplier Name
        // Try to find matching line by code. If not found, use the booking line string.
        const lineObj = (lines || []).find(l => l.code === booking.line);
        const supplierName = lineObj ? lineObj.name : booking.line;
        
        // Lookup Item Name from Line Config
        const defaultItemName = lineObj?.itemName || 'Phí Local Charge';

        const docNo = `PMH-${booking.bookingId}`;
        const description = `Mua hàng của ${supplierName} BILL ${booking.bookingId}`;

        setFormData(prev => ({
          ...prev,
          date,
          docNo,
          invoiceNo: lcDetails.invoice || '',
          supplierCode: booking.line, // Assuming Line Code is Supplier Code
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

  const handleAmountChange = (name: 'netAmount' | 'vatAmount', val: number) => {
    setFormData(prev => ({ ...prev, [name]: val }));
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
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Phiếu Mua Hàng</h2>
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
                       <Calendar className="w-3 h-3 mr-1.5" /> Thông tin chứng từ & Hóa đơn
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Ngày Hạch toán / HĐ</label>
                         <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Số chứng từ</label>
                         <input type="text" name="docNo" value={formData.docNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-teal-700 bg-teal-50/30" required />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Số hóa đơn</label>
                         <input type="text" name="invoiceNo" value={formData.invoiceNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                   </div>
                </div>

                {/* 2. Supplier & Content */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <Building2 className="w-3 h-3 mr-1.5" /> Nhà cung cấp & Nội dung
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Mã Nhà cung cấp</label>
                         <input type="text" name="supplierCode" value={formData.supplierCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Diễn giải</label>
                         <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                         <label className="text-xs font-semibold text-gray-500">Tên hàng</label>
                         <input type="text" name="itemName" value={formData.itemName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                   </div>
                </div>

                {/* 3. Amounts */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                       <DollarSign className="w-3 h-3 mr-1.5" /> Giá trị (VND)
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-gray-500">Đơn giá (Net)</label>
                           <input 
                               type="text" 
                               value={new Intl.NumberFormat('en-US').format(formData.netAmount)} 
                               onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleAmountChange('netAmount', val);
                               }}
                               className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 text-right"
                           />
                      </div>
                      <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-gray-500">Tiền thuế GTGT</label>
                           <input 
                               type="text" 
                               value={new Intl.NumberFormat('en-US').format(formData.vatAmount)} 
                               onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleAmountChange('vatAmount', val);
                               }}
                               className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 text-right"
                           />
                      </div>
                   </div>
                </div>

                {/* Default Info */}
                <div className="text-xs text-gray-400 px-2 italic">
                   * Mặc định: LCC, TK 63211/3311, VAT 5%, Mua hàng trong nước không qua kho, 1331.
                </div>

            </form>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Hủy bỏ
            </button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg transition-all flex items-center">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>

      </div>
    </div>
  );
};