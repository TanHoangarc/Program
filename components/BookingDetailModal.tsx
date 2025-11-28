
import React, { useState } from 'react';
import { JobData, BookingSummary, BookingCostDetails, BookingExtensionCost, BookingDeposit } from '../types';
import { Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid, FileText, Anchor, Calculator } from 'lucide-react';
import { formatDateVN } from '../utils';

interface BookingDetailModalProps {
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails, updatedJobs?: JobData[]) => void;
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
  const [deposits, setDeposits] = useState<BookingDeposit[]>(booking.costDetails.deposits || []);
  const [vatMode, setVatMode] = useState<'pre' | 'post'>('post');

  // Calculations
  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => 
    sum + job.extensions.reduce((s, ext) => s + ext.total, 0), 0
  );
  
  const totalLocalChargeRevenue = booking.jobs.reduce((sum, job) => sum + job.localChargeTotal, 0);

  // Extension Costs
  const totalExtensionCost = extensionCosts.reduce((sum, ext) => sum + ext.total, 0);
  const totalExtensionNetCost = extensionCosts.reduce((sum, ext) => sum + (ext.net || 0), 0);
  
  const totalDepositCost = deposits.reduce((sum, d) => sum + d.amount, 0);

  // --- SYSTEM TABLE TOTALS ---
  const systemTotalSell = booking.jobs.reduce((sum, j) => sum + j.sell, 0);
  const systemTotalAdjustedCost = booking.jobs.reduce((sum, j) => {
    const costDeduction = (j.cont20 * 250000) + (j.cont40 * 500000);
    return sum + (j.cost - costDeduction);
  }, 0);
  const systemTotalVat = booking.jobs.reduce((sum, j) => sum + (j.cost * 0.05263), 0);


  // --- SUMMARY CALCULATIONS ---
  
  // Revenue Logic
  // Post VAT: Display Value
  // Pre VAT: Display Value / 1.08
  const getRevenueValue = (val: number) => vatMode === 'post' ? val : (val / 1.08);

  const summaryLocalChargeRevenue = getRevenueValue(totalLocalChargeRevenue);
  const summaryExtensionRevenue = getRevenueValue(totalExtensionRevenue);
  const summaryGrandTotalRevenue = summaryLocalChargeRevenue + summaryExtensionRevenue;

  // Expense Logic
  // Post VAT: Job Payment (Sum of Costs)
  // Pre VAT: Local Charge Invoice Net
  const totalJobPayment = booking.jobs.reduce((sum, j) => sum + (j.cost || 0), 0);
  
  const summaryAmountExpense = vatMode === 'post' 
    ? totalJobPayment 
    : (localCharge.net || 0);

  const summaryExtensionExpense = vatMode === 'post'
    ? totalExtensionCost
    : totalExtensionNetCost;

  // Grand Totals
  const summaryGrandTotalExpense = summaryAmountExpense + summaryExtensionExpense + totalDepositCost;
  const summaryGrandTotalProfit = summaryGrandTotalRevenue - summaryGrandTotalExpense;

  // Sub-profits
  const baseProfit = summaryLocalChargeRevenue - summaryAmountExpense;
  const extensionProfit = summaryExtensionRevenue - summaryExtensionExpense;


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

  // Extension Handlers
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

  // Deposit Handlers
  const handleAddDeposit = () => {
    setDeposits(prev => [...prev, {
        id: Date.now().toString(),
        amount: 0,
        dateOut: '',
        dateIn: ''
    }]);
  };

  const handleUpdateDeposit = (id: string, field: keyof BookingDeposit, val: any) => {
      setDeposits(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleRemoveDeposit = (id: string) => {
      setDeposits(prev => prev.filter(d => d.id !== id));
  };

  const handleSave = () => {
    onSave({
      localCharge,
      extensionCosts,
      deposits
    });
    onClose();
  };

  const getProjectCode = (job: JobData) => {
    let year = new Date().getFullYear();
    if (job.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    const yearSuffix = year.toString().slice(-2);
    const monthPad = job.month.padStart(2, '0');
    return `K${yearSuffix}${monthPad}${job.jobCode}`;
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className={`fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] ${zIndex} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              Chi tiết Booking: <span className="ml-2 text-blue-200">{booking.bookingId}</span>
            </h2>
            <p className="text-sm text-blue-100 mt-1 flex space-x-4">
              <span>Line: <strong className="text-white">{booking.line}</strong></span>
              <span>Tháng: <strong className="text-white">{booking.month}</strong></span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-blue-800 text-blue-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 space-y-8">
          
          {/* Section 1: SYSTEM Table */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2 flex items-center">
              <Ship className="w-4 h-4 mr-2 text-brand-DEFAULT" /> SYSTEM
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b">
                    <th className="px-4 py-3 border-r font-medium">Job Code</th>
                    <th className="px-4 py-3 border-r text-right font-medium">Sell</th>
                    <th className="px-4 py-3 border-r text-right font-medium">Cost (Adjusted)</th>
                    <th className="px-4 py-3 border-r text-right font-medium">VAT (5.263%)</th>
                    <th className="px-4 py-3 text-center font-medium">Công trình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {booking.jobs.map(job => {
                    const costDeduction = (job.cont20 * 250000) + (job.cont40 * 500000);
                    const adjustedCost = job.cost - costDeduction;
                    const vatCalc = job.cost * 0.05263;
                    return (
                      <tr key={job.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3 border-r font-semibold text-brand-DEFAULT">{job.jobCode}</td>
                        <td className="px-4 py-3 border-r text-right text-gray-600 font-medium">
                          {formatMoney(job.sell)}
                        </td>
                        <td className="px-4 py-3 border-r text-right text-gray-600">
                          {formatMoney(adjustedCost)}
                        </td>
                        <td className="px-4 py-3 border-r text-right text-gray-500">{formatMoney(vatCalc)}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-gray-600">
                          {getProjectCode(job)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-bold text-gray-800 border-t border-gray-200">
                   <tr>
                     <td className="px-4 py-3 text-right border-r">Tổng:</td>
                     <td className="px-4 py-3 text-right border-r text-green-700">{formatMoney(systemTotalSell)}</td>
                     <td className="px-4 py-3 text-right border-r text-red-700">{formatMoney(systemTotalAdjustedCost)}</td>
                     <td className="px-4 py-3 text-right border-r text-gray-600">{formatMoney(systemTotalVat)}</td>
                     <td></td>
                   </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 1.5: THU THEO HÓA ĐƠN */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-5 border-b pb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2" /> THU THEO HÓA ĐƠN
             </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                   <thead>
                      <tr className="bg-blue-50 text-blue-900 border-b border-blue-100">
                         <th className="px-4 py-3 border-r border-blue-100 font-medium">Job Code</th>
                         <th className="px-4 py-3 border-r border-blue-100 font-medium text-right">Amount (Local Charge)</th>
                         <th className="px-4 py-3 font-medium text-right">Gia Hạn (Thu)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {booking.jobs.map(job => {
                         const extTotal = job.extensions.reduce((sum, e) => sum + e.total, 0);
                         return (
                            <tr key={job.id} className="hover:bg-gray-50">
                               <td className="px-4 py-3 border-r font-medium text-gray-700">{job.jobCode}</td>
                               <td className="px-4 py-3 border-r text-right text-blue-600 font-medium">
                                  {formatMoney(job.localChargeTotal)}
                               </td>
                               <td className="px-4 py-3 text-right text-orange-600 font-medium">
                                  {extTotal > 0 ? formatMoney(extTotal) : '-'}
                               </td>
                            </tr>
                         )
                      })}
                      {/* Subtotal Row */}
                      <tr className="bg-gray-50 font-bold border-t border-gray-200">
                         <td className="px-4 py-3 text-right border-r">Tổng cộng:</td>
                         <td className="px-4 py-3 text-right text-blue-700">{formatMoney(totalLocalChargeRevenue)}</td>
                         <td className="px-4 py-3 text-right text-orange-700">{formatMoney(totalExtensionRevenue)}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>

          {/* Section 2: Local Charge (Horizontal) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-5 border-b pb-2">
                 <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">Local Charge (Hóa đơn Chi)</h3>
                 <div className="text-xs font-medium bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100">
                   Target (Tổng Chi Payment): <strong>{formatMoney(totalJobPayment)}</strong>
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
             {localCharge.total !== totalJobPayment && (
               <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mt-4 animate-pulse">
                 <AlertCircle className="w-5 h-5" />
                 <span>Lưu ý: Tổng hóa đơn ({formatMoney(localCharge.total)}) lệch với Tổng Chi Payment ({formatMoney(totalJobPayment)})</span>
               </div>
             )}
          </div>

          {/* Section 2.5: CƯỢC CONT (BOOKING LEVEL DEPOSIT) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-5 border-b pb-2">
                 <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide flex items-center">
                    <Anchor className="w-4 h-4 mr-2" /> CƯỢC CONT (DEPOSIT)
                 </h3>
                 <button onClick={handleAddDeposit} className="flex items-center space-x-1 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-100 transition-colors">
                    <Plus className="w-3 h-3" />
                    <span>Thêm Cược</span>
                 </button>
             </div>
             
             <div className="overflow-x-auto rounded border border-gray-200">
               <table className="w-full text-sm text-left">
                  <thead className="bg-red-50/50 text-red-800 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 w-10"></th>
                      <th className="px-4 py-2 text-right">Tiền Cược</th>
                      <th className="px-4 py-2">Ngày Cược</th>
                      <th className="px-4 py-2">Ngày Hoàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deposits.length === 0 ? (
                       <tr><td colSpan={4} className="text-center py-4 text-gray-400 italic">Chưa có thông tin cược cho booking này</td></tr>
                    ) : (
                       deposits.map((item) => (
                        <tr key={item.id} className="hover:bg-red-50/20 group">
                           <td className="px-4 py-2 text-center">
                              <button onClick={() => handleRemoveDeposit(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </td>
                           <td className="px-4 py-2">
                              <Input 
                                type="text"
                                value={item.amount ? new Intl.NumberFormat('en-US').format(item.amount) : ''}
                                onChange={(e) => {
                                   const val = Number(e.target.value.replace(/,/g, ''));
                                   if (!isNaN(val)) handleUpdateDeposit(item.id, 'amount', val);
                                }}
                                className="text-right h-8"
                                placeholder="0"
                              />
                           </td>
                           <td className="px-4 py-2">
                              <Input 
                                type="date"
                                value={item.dateOut}
                                onChange={(e) => handleUpdateDeposit(item.id, 'dateOut', e.target.value)}
                                className="h-8"
                              />
                           </td>
                           <td className="px-4 py-2">
                              <Input 
                                type="date"
                                value={item.dateIn}
                                onChange={(e) => handleUpdateDeposit(item.id, 'dateIn', e.target.value)}
                                className="h-8"
                              />
                           </td>
                        </tr>
                       ))
                    )}
                  </tbody>
               </table>
             </div>
             <div className="mt-4 text-right text-sm">
               <span className="font-semibold text-gray-500 mr-2">Tổng Cược:</span>
               <span className="text-red-700 font-bold text-lg">{formatMoney(totalDepositCost)}</span>
             </div>
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
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-sm font-bold text-blue-200 uppercase flex items-center">
                 <LayoutGrid className="w-4 h-4 mr-2" /> Tổng Hợp Booking
               </h3>
               
               {/* VAT TOGGLE */}
               <div className="flex bg-blue-800 rounded-md p-0.5 border border-blue-700">
                  <button 
                    onClick={() => setVatMode('pre')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      vatMode === 'pre' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-blue-300 hover:text-white'
                    }`}
                  >
                    Trước VAT
                  </button>
                  <button 
                    onClick={() => setVatMode('post')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      vatMode === 'post' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-blue-300 hover:text-white'
                    }`}
                  >
                    Sau VAT
                  </button>
               </div>
             </div>
             
             <table className="w-full text-sm text-left">
                <thead className="text-blue-300 border-b border-blue-800/50">
                  <tr>
                    <th className="pb-3">Khoản Mục</th>
                    <th className="pb-3 text-right">Tổng Thu {vatMode === 'pre' && '(Chia 1.08)'}</th>
                    <th className="pb-3 text-right">Tổng Chi {vatMode === 'pre' && '(Net)'}</th>
                    <th className="pb-3 text-right">Lợi Nhuận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-900/50">
                  {/* Row 1: Amount (Local Charge) */}
                  <tr>
                    <td className="py-3 text-blue-100">Amount</td>
                    <td className="py-3 text-right text-green-300 font-medium">{formatMoney(summaryLocalChargeRevenue)}</td>
                    <td className="py-3 text-right text-red-300 font-medium">{formatMoney(summaryAmountExpense)}</td>
                    <td className={`py-3 text-right font-medium ${baseProfit >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {formatMoney(baseProfit)}
                    </td>
                  </tr>

                  {/* Row 2: Gia Hạn */}
                  <tr>
                    <td className="py-3 text-blue-100">Gia Hạn</td>
                    <td className="py-3 text-right text-green-300 font-medium">{formatMoney(summaryExtensionRevenue)}</td>
                    <td className="py-3 text-right text-red-300 font-medium">{formatMoney(summaryExtensionExpense)}</td>
                    <td className={`py-3 text-right font-medium ${extensionProfit >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {formatMoney(extensionProfit)}
                    </td>
                  </tr>
                  
                   {/* Row 2.5: Deposit */}
                   <tr>
                    <td className="py-3 text-blue-100">Booking Deposit (Cược)</td>
                    <td className="py-3 text-right text-gray-400">-</td>
                    <td className="py-3 text-right text-red-300 font-medium">{formatMoney(totalDepositCost)}</td>
                    <td className="py-3 text-right text-gray-400">-</td>
                  </tr>

                  {/* Row 3: Grand Total */}
                  <tr className="bg-blue-900/30 font-bold">
                    <td className="py-3 text-white pl-2 uppercase">TỔNG CỘNG ({booking.jobCount} Jobs)</td>
                    <td className="py-3 text-right text-green-400">{formatMoney(summaryGrandTotalRevenue)}</td>
                    <td className="py-3 text-right text-red-300">{formatMoney(summaryGrandTotalExpense)}</td>
                    <td className={`py-3 text-right ${summaryGrandTotalProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(summaryGrandTotalProfit)}
                    </td>
                  </tr>
                </tbody>
             </table>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 rounded text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">Đóng</button>
          <button onClick={handleSave} className="px-5 py-2.5 rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 transition-colors flex items-center space-x-2 shadow-sm">
            <Save className="w-4 h-4" /> <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
