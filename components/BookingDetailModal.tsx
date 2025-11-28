
import React, { useState } from 'react';
import { JobData, BookingSummary, BookingCostDetails, BookingExtensionCost } from '../types';
import { Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid } from 'lucide-react';

interface BookingDetailModalProps {
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails) => void;
  zIndex?: string;
}

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT focus:border-brand-DEFAULT disabled:bg-gray-50 disabled:text-gray-500 transition-shadow ${props.className || ''}`}
  />
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>
);

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onSave, zIndex = 'z-50' }) => {
  const [localCharge, setLocalCharge] = useState(booking.costDetails.localCharge);
  const [extensionCosts, setExtensionCosts] = useState<BookingExtensionCost[]>(booking.costDetails.extensionCosts);

  // Calculations
  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => 
    sum + job.extensions.reduce((s, ext) => s + ext.total, 0), 0
  );

  const totalExtensionCost = extensionCosts.reduce((sum, ext) => sum + ext.total, 0);

  // Totals for Summary Table
  const grandTotalRevenue = booking.totalSell + totalExtensionRevenue;
  const grandTotalExpense = booking.totalCost + totalExtensionCost;
  const grandTotalProfit = grandTotalRevenue - grandTotalExpense;

  // Sync helpers
  const handleLocalChargeChange = (field: keyof typeof localCharge, val: any) => {
    setLocalCharge(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'net' || field === 'vat') {
        updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
      }
      return updated;
    });
  };

  const handleAddExtensionCost = () => {
    setExtensionCosts(prev => [...prev, {
      id: Date.now().toString(),
      invoice: '',
      date: '',
      net: 0,
      vat: 0,
      total: 0
    }]);
  };

  const handleUpdateExtensionCost = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setExtensionCosts(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        if (field === 'net' || field === 'vat') {
          updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveExtensionCost = (id: string) => {
    setExtensionCosts(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = () => {
    onSave({
      localCharge,
      extensionCosts
    });
    onClose();
  };

  const getProjectCode = (job: JobData) => {
    let year = new Date().getFullYear();
    // Prioritize Invoice Date if available, else use current year
    if (job.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    const yearSuffix = year.toString().slice(-2);
    const monthPad = job.month.padStart(2, '0');
    return `K${yearSuffix}${monthPad}&${job.jobCode}`;
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className={`fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] ${zIndex} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              Chi tiết Booking: <span className="ml-2 text-brand-DEFAULT">{booking.bookingId}</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1 flex space-x-4">
              <span>Line: <strong className="text-gray-700">{booking.line}</strong></span>
              <span>Tháng: <strong className="text-gray-700">{booking.month}</strong></span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 space-y-8">
          
          {/* Section 1: Job List Table */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2 flex items-center">
              <Ship className="w-4 h-4 mr-2 text-brand-DEFAULT" /> Danh sách Job trong Booking
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b">
                    <th className="px-4 py-3 border-r font-medium">Job Code</th>
                    <th className="px-4 py-3 border-r font-medium">Khách hàng</th>
                    <th className="px-4 py-3 border-r text-right font-medium">Cost</th>
                    <th className="px-4 py-3 border-r text-right font-medium">VAT (5.263%)</th>
                    <th className="px-4 py-3 border-r text-right font-medium">Thu Gia Hạn</th>
                    <th className="px-4 py-3 text-center font-medium">Công trình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {booking.jobs.map(job => {
                    const vatCalc = job.cost * 0.05263;
                    const extensionRev = job.extensions.reduce((s, e) => s + e.total, 0);
                    return (
                      <tr key={job.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3 border-r font-semibold text-brand-DEFAULT">{job.jobCode}</td>
                        <td className="px-4 py-3 border-r text-gray-700">{job.customerName}</td>
                        <td className="px-4 py-3 border-r text-right text-gray-600">{formatMoney(job.cost)}</td>
                        <td className="px-4 py-3 border-r text-right text-gray-500">{formatMoney(vatCalc)}</td>
                        <td className="px-4 py-3 border-r text-right text-orange-600 font-medium">{extensionRev > 0 ? formatMoney(extensionRev) : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-gray-600">
                          {getProjectCode(job)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Local Charge (Horizontal) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-5 border-b pb-2">
                 <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">Local Charge (Hóa đơn Chi)</h3>
                 <div className="text-xs font-medium bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100">
                   Target (Tổng Chi Payment): <strong>{formatMoney(booking.totalCost)}</strong>
                 </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                <div className="space-y-1">
                  <Label>Số hóa đơn</Label>
                  <Input 
                    type="text" 
                    value={localCharge.invoice} 
                    onChange={(e) => handleLocalChargeChange('invoice', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ngày hóa đơn</Label>
                  <Input 
                    type="date" 
                    value={localCharge.date} 
                    onChange={(e) => handleLocalChargeChange('date', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Giá Net</Label>
                  <Input 
                    type="number" 
                    value={localCharge.net || ''} 
                    onChange={(e) => handleLocalChargeChange('net', Number(e.target.value))}
                    className="text-right"
                  />
                </div>
                <div className="space-y-1">
                  <Label>VAT</Label>
                  <Input 
                    type="number" 
                    value={localCharge.vat || ''} 
                    onChange={(e) => handleLocalChargeChange('vat', Number(e.target.value))}
                    className="text-right"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tổng</Label>
                  <input 
                    type="text" 
                    value={formatMoney(localCharge.total)} 
                    readOnly
                    className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded text-sm font-bold text-red-700 text-right outline-none" 
                  />
                </div>
             </div>

             {/* Validation Message */}
             {localCharge.total !== booking.totalCost && (
               <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mt-4 animate-pulse">
                 <AlertCircle className="w-5 h-5" />
                 <span>Lưu ý: Tổng hóa đơn ({formatMoney(localCharge.total)}) lệch với Tổng Chi Payment ({formatMoney(booking.totalCost)})</span>
               </div>
             )}
          </div>

          {/* Section 3: Extensions Cost (Horizontal Table) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b pb-2">
               <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide">Chi Phí Gia Hạn</h3>
               <button onClick={handleAddExtensionCost} className="flex items-center space-x-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded hover:bg-orange-100 transition-colors">
                  <Plus className="w-3 h-3" />
                  <span>Thêm HĐ</span>
               </button>
            </div>

            <div className="overflow-x-auto rounded border border-gray-200">
               <table className="w-full text-sm text-left">
                  <thead className="bg-orange-50/50 text-orange-800 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 w-10"></th>
                      <th className="px-4 py-2">Số HĐ</th>
                      <th className="px-4 py-2">Ngày HĐ</th>
                      <th className="px-4 py-2 text-right">Net</th>
                      <th className="px-4 py-2 text-right">VAT</th>
                      <th className="px-4 py-2 text-right">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extensionCosts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-400 py-6 text-sm italic">Chưa có hóa đơn chi gia hạn</td>
                      </tr>
                    ) : (
                      extensionCosts.map((ext) => (
                        <tr key={ext.id} className="hover:bg-orange-50/20 group">
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => handleRemoveExtensionCost(ext.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <Input 
                              value={ext.invoice} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'invoice', e.target.value)}
                              className="py-1"
                              placeholder="Số HĐ"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <Input 
                              type="date" 
                              value={ext.date} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'date', e.target.value)}
                              className="py-1"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <Input 
                              type="number" 
                              value={ext.net || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'net', Number(e.target.value))}
                              className="py-1 text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <Input 
                              type="number" 
                              value={ext.vat || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'vat', Number(e.target.value))}
                              className="py-1 text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-orange-700">
                             {formatMoney(ext.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
            
            <div className="mt-4 text-right text-sm">
               <span className="font-semibold text-gray-500 mr-2">Tổng Chi Gia Hạn:</span>
               <span className="text-orange-700 font-bold text-lg">{formatMoney(totalExtensionCost)}</span>
            </div>
          </div>

          {/* Section 4: Summary Table */}
          <div className="bg-brand-dark text-white p-6 rounded-lg shadow-md border border-brand-dark">
             <h3 className="text-sm font-bold text-blue-200 uppercase mb-4 flex items-center">
               <LayoutGrid className="w-4 h-4 mr-2" /> Tổng Hợp Booking
             </h3>
             <table className="w-full text-sm text-left">
                <thead className="text-blue-300 border-b border-blue-800/50">
                  <tr>
                    <th className="pb-3 text-center">Tổng Job</th>
                    <th className="pb-3 text-right">Tổng Thu (Sell + GH)</th>
                    <th className="pb-3 text-right">Tổng Chi (Payment + GH)</th>
                    <th className="pb-3 text-right">Tổng Profit</th>
                  </tr>
                </thead>
                <tbody className="text-xl font-bold">
                  <tr>
                    <td className="pt-3 text-center text-white">{booking.jobs.length}</td>
                    <td className="pt-3 text-right text-green-400">{formatMoney(grandTotalRevenue)}</td>
                    <td className="pt-3 text-right text-red-300">{formatMoney(grandTotalExpense)}</td>
                    <td className={`pt-3 text-right ${grandTotalProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(grandTotalProfit)}
                    </td>
                  </tr>
                </tbody>
             </table>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 rounded text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">Đóng</button>
          <button onClick={handleSave} className="px-5 py-2.5 rounded text-sm font-medium text-white bg-brand-DEFAULT hover:bg-brand-dark transition-colors flex items-center space-x-2 shadow-sm">
            <Save className="w-4 h-4" /> <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
