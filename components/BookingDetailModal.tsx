
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JobData, BookingSummary, BookingCostDetails, BookingExtensionCost, BookingDeposit } from '../types';
import { Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid, FileText, Anchor, Copy, Check, Calendar, Upload, FileUp, HardDrive } from 'lucide-react';
import { formatDateVN, parseDateVN } from '../utils';

interface BookingDetailModalProps {
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails, updatedJobs?: JobData[]) => void;
  zIndex?: string;
}

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    value={props.value ?? ''}
    className={`w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-all ${props.className || 'h-10'}`}
  />
);

const DateInput = ({ 
  value, 
  name, 
  onChange, 
  className 
}: { 
  value: string; 
  name?: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  className?: string;
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const handleBlur = () => {
    if (!displayValue) {
      if (value) triggerChange('');
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) {
      if (parsed !== value) triggerChange(parsed);
    } else {
      setDisplayValue(formatDateVN(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const triggerChange = (newVal: string) => {
    const e = {
      target: { name, value: newVal }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(e);
  };

  const handleDateIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerChange(e.target.value);
  };

  return (
    <div className={`relative w-full ${className || 'h-10'}`}>
      <input 
        type="text" 
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 h-full transition-all"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-500 mb-1.5">{children}</label>
);

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onSave, zIndex = 'z-50' }) => {
  const [localCharge, setLocalCharge] = useState(booking.costDetails.localCharge || { invoice: '', date: '', net: 0, vat: 0, total: 0 });
  const [additionalLocalCharges, setAdditionalLocalCharges] = useState<BookingExtensionCost[]>(booking.costDetails.additionalLocalCharges || []);
  const [extensionCosts, setExtensionCosts] = useState<BookingExtensionCost[]>(booking.costDetails.extensionCosts || []);
  const [deposits, setDeposits] = useState<BookingDeposit[]>(booking.costDetails.deposits || []);
  const [vatMode, setVatMode] = useState<'pre' | 'post'>('post');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => 
    sum + (job.extensions || []).reduce((s, ext) => s + ext.total, 0), 0
  );
  
  const totalLocalChargeRevenue = booking.jobs.reduce((sum, job) => sum + job.localChargeTotal, 0);

  const totalAdditionalLocalChargeNet = additionalLocalCharges.reduce((sum, item) => sum + (item.net || 0), 0);
  const totalAdditionalLocalChargeTotal = additionalLocalCharges.reduce((sum, item) => sum + item.total, 0);

  const totalExtensionCost = extensionCosts.reduce((sum, ext) => sum + ext.total, 0);
  const totalExtensionNetCost = extensionCosts.reduce((sum, ext) => sum + (ext.net || 0), 0);
  
  const totalDepositCost = deposits.reduce((sum, d) => sum + d.amount, 0);

  const systemTotalSell = booking.jobs.reduce((sum, j) => sum + j.sell, 0);
  
  const systemTotalAdjustedCost = booking.jobs.reduce((sum, j) => {
    const kimberry = (j.cont20 * 250000) + (j.cont40 * 500000);
    const otherFees = (j.feeCic || 0) + (j.feePsc || 0) + (j.feeEmc || 0) + (j.feeOther || 0);
    return sum + (j.cost - kimberry - otherFees);
  }, 0);
  
  const systemTotalVat = booking.jobs.reduce((sum, j) => sum + (j.cost * 0.05263), 0);

  const getRevenueValue = (val: number) => vatMode === 'post' ? val : Math.round(val / 1.08);

  const summaryLocalChargeRevenue = getRevenueValue(totalLocalChargeRevenue);
  const summaryExtensionRevenue = getRevenueValue(totalExtensionRevenue);
  const summaryGrandTotalRevenue = summaryLocalChargeRevenue + summaryExtensionRevenue;

  const totalJobPayment = booking.jobs.reduce((sum, j) => sum + (j.cost || 0), 0); 
  
  const summaryAmountExpense = vatMode === 'post' 
    ? totalJobPayment 
    : ((localCharge.net || 0) + totalAdditionalLocalChargeNet);

  const summaryExtensionExpense = vatMode === 'post'
    ? totalExtensionCost
    : totalExtensionNetCost;

  const summaryGrandTotalExpense = summaryAmountExpense + summaryExtensionExpense + totalDepositCost;
  const summaryGrandTotalProfit = summaryGrandTotalRevenue - summaryGrandTotalExpense;

  const baseProfit = summaryLocalChargeRevenue - summaryAmountExpense;
  const extensionProfit = summaryExtensionRevenue - summaryExtensionExpense;

  const totalActualNet = (localCharge.net || 0) + totalAdditionalLocalChargeNet;

  const handleLocalChargeChange = (field: keyof typeof localCharge, val: any) => {
    setLocalCharge(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'net' || field === 'vat') {
        updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
      }
      return updated;
    });
  };

  const handleAddAdditionalLC = () => {
    setAdditionalLocalCharges(prev => [...prev, {
      id: Date.now().toString(),
      invoice: '',
      date: '',
      net: 0,
      vat: 0,
      total: 0
    }]);
  };

  const handleUpdateAdditionalLC = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setAdditionalLocalCharges(prev => prev.map(item => {
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

  const handleRemoveAdditionalLC = (id: string) => {
    setAdditionalLocalCharges(prev => prev.filter(i => i.id !== id));
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
      additionalLocalCharges,
      extensionCosts,
      deposits
    });
    onClose();
  };

  // --- FILE UPLOAD LOGIC ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      alert("Vui lòng chọn file hóa đơn trước.");
      return;
    }

    setIsUploading(true);

    try {
      // 1. Determine Date for Filename (DD.MM.YYYY)
      const dateStr = localCharge.date || new Date().toISOString(); 
      const dateObj = new Date(dateStr);
      
      // Fallback if parsing fails
      const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

      // NO SUBFOLDER: Save directly to E:\ServerData\Invoice
      const folderName = ""; 

      // 2. Generate New Filename: Line.Booking.Invoice.dd.mm.yyyy.ext
      const originalName = selectedFile.name;
      const extension = originalName.substring(originalName.lastIndexOf('.'));
      
      // Get safe strings for filename
      const safeLine = (booking.line || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const safeBooking = (booking.bookingId || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const safeInvoice = (localCharge.invoice || 'NoInvoice').replace(/[^a-zA-Z0-9]/g, '');
      
      // Format date for filename: dd.mm.yyyy
      const dd = validDate.getDate().toString().padStart(2, '0');
      const mm = (validDate.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = validDate.getFullYear();
      const dateFileStr = `${dd}.${mm}.${yyyy}`;

      const newFileName = `${safeLine}.${safeBooking}.${safeInvoice}.${dateFileStr}${extension}`;

      // 3. Prepare Form Data
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append('folderPath', folderName); // Empty string = root of Invoice folder
      formData.append('bookingId', booking.bookingId);
      formData.append('fileName', newFileName);

      // 4. Send to Server
      const res = await fetch("https://api.kimberry.id.vn/upload-file", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        alert(`Đã lưu file thành công!\n\nĐường dẫn: E:\\ServerData\\Invoice\\${newFileName}`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        alert("Lỗi khi tải file lên server. Vui lòng kiểm tra lại kết nối.");
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Không thể kết nối với máy chủ để lưu file.");
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getProjectCode = (job: JobData) => {
    let year = new Date().getFullYear();
    if (job.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    const yearSuffix = year.toString().slice(-2);
    const monthPad = job.month.padStart(2, '0');
    return `K${yearSuffix}${monthPad}${job.jobCode}`;
  };

  const copyColumn = (type: 'sell' | 'cost' | 'vat' | 'project') => {
    const values = booking.jobs.map(job => {
      if (type === 'sell') return job.sell;
      if (type === 'cost') {
        const kimberry = (job.cont20 * 250000) + (job.cont40 * 500000);
        const otherFees = (job.feeCic || 0) + (job.feePsc || 0) + (job.feeEmc || 0) + (job.feeOther || 0);
        return job.cost - kimberry - otherFees;
      }
      if (type === 'vat') return job.cost * 0.05263;
      if (type === 'project') return getProjectCode(job);
      return '';
    });
    
    navigator.clipboard.writeText(values.join('\n'));
    setCopiedId(`col-${type}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return createPortal(
    <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4`}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-white/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              Chi tiết Booking: <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-xl">{booking.bookingId}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex space-x-4 font-medium">
              <span>Line: <strong className="text-slate-700">{booking.line}</strong></span>
              <span>Tháng: <strong className="text-slate-700">{booking.month}</strong></span>
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar space-y-8">
          
          {/* Section 1: SYSTEM Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-5 border-b border-slate-100 pb-3 flex items-center">
              <Ship className="w-4 h-4 mr-2 text-teal-600" /> SYSTEM
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="px-4 py-3 border-r border-slate-200 font-bold uppercase text-xs">Job Code</th>
                    <th className="px-4 py-3 border-r border-slate-200 text-right font-bold uppercase text-xs group w-40">
                      <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => copyColumn('sell')}>
                        Sell
                        {copiedId === 'col-sell' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                    <th className="px-4 py-3 border-r border-slate-200 text-right font-bold uppercase text-xs group w-40">
                       <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => copyColumn('cost')}>
                        Cost (Adj)
                        {copiedId === 'col-cost' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                    <th className="px-4 py-3 border-r border-slate-200 text-right font-bold uppercase text-xs group w-40">
                       <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => copyColumn('vat')}>
                        VAT (5.263%)
                        {copiedId === 'col-vat' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-bold uppercase text-xs group">
                       <div className="flex items-center justify-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => copyColumn('project')}>
                        Công trình
                        {copiedId === 'col-project' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.jobs.map(job => {
                    const kimberry = (job.cont20 * 250000) + (job.cont40 * 500000);
                    const otherFees = (job.feeCic || 0) + (job.feePsc || 0) + (job.feeEmc || 0) + (job.feeOther || 0);
                    const adjustedCost = job.cost - kimberry - otherFees;
                    const vatCalc = job.cost * 0.05263;
                    const projectCode = getProjectCode(job);
                    
                    return (
                      <tr key={job.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3 border-r border-slate-100 font-bold text-teal-700">{job.jobCode}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-600 font-medium">{formatMoney(job.sell)}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-600">{formatMoney(adjustedCost)}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-500">{formatMoney(vatCalc)}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">{projectCode}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                   <tr>
                     <td className="px-4 py-3 text-right border-r border-slate-200">Tổng:</td>
                     <td className="px-4 py-3 text-right border-r border-slate-200 text-green-600">{formatMoney(systemTotalSell)}</td>
                     <td className="px-4 py-3 text-right border-r border-slate-200 text-red-600">{formatMoney(systemTotalAdjustedCost)}</td>
                     <td className="px-4 py-3 text-right border-r border-slate-200 text-slate-600">{formatMoney(systemTotalVat)}</td>
                     <td></td>
                   </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 1.5: THU THEO HÓA ĐƠN */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-5 border-b border-slate-100 pb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" /> THU THEO HÓA ĐƠN
             </h3>
             <div className="overflow-x-auto rounded-lg border border-blue-100">
                <table className="w-full text-sm text-left border-collapse">
                   <thead>
                      <tr className="bg-blue-50/50 text-blue-800 border-b border-blue-100">
                         <th className="px-4 py-3 border-r border-blue-100 font-bold uppercase text-xs">Job Code</th>
                         <th className="px-4 py-3 border-r border-blue-100 font-bold uppercase text-xs text-right">Amount (Local Charge)</th>
                         <th className="px-4 py-3 font-bold uppercase text-xs text-right">Gia Hạn (Thu)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {booking.jobs.map(job => {
                         const extTotal = (job.extensions || []).reduce((sum, e) => sum + e.total, 0);
                         return (
                            <tr key={job.id} className="hover:bg-slate-50">
                               <td className="px-4 py-3 border-r border-slate-100 font-medium text-slate-700">{job.jobCode}</td>
                               <td className="px-4 py-3 border-r border-slate-100 text-right text-blue-600 font-medium">
                                  {formatMoney(job.localChargeTotal)}
                               </td>
                               <td className="px-4 py-3 text-right text-orange-600 font-medium">
                                  {extTotal > 0 ? formatMoney(extTotal) : '-'}
                               </td>
                            </tr>
                         )
                      })}
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                         <td className="px-4 py-3 text-right border-r border-slate-200">Tổng cộng:</td>
                         <td className="px-4 py-3 text-right text-blue-700">{formatMoney(totalLocalChargeRevenue)}</td>
                         <td className="px-4 py-3 text-right text-orange-700">{formatMoney(totalExtensionRevenue)}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>

          {/* Section 2: Local Charge (Horizontal) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                 <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide">Local Charge (Hóa đơn Chi)</h3>
                 <div className="flex items-center space-x-3">
                    <div className="text-xs font-medium bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
                        Target (Tổng Chi Payment): <strong>{formatMoney(systemTotalAdjustedCost)}</strong>
                    </div>
                    <button onClick={handleAddAdditionalLC} className="flex items-center space-x-1.5 text-xs bg-red-600 text-white border border-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-sm font-bold">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm HĐ</span>
                    </button>
                 </div>
             </div>
             
             {/* Main Invoice Input */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end mb-6">
                <div className="space-y-1">
                  <Label>Số hóa đơn</Label>
                  <Input 
                    type="text" 
                    value={localCharge.invoice} 
                    onChange={(e) => handleLocalChargeChange('invoice', e.target.value)}
                    className="h-10 font-medium text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ngày hóa đơn</Label>
                  <DateInput 
                    value={localCharge.date} 
                    onChange={(e) => handleLocalChargeChange('date', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Giá Net</Label>
                  <Input 
                    type="number" 
                    value={localCharge.net || ''} 
                    onChange={(e) => handleLocalChargeChange('net', Number(e.target.value))}
                    className="text-right h-10 font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <Label>VAT</Label>
                  <Input 
                    type="number" 
                    value={localCharge.vat || ''} 
                    onChange={(e) => handleLocalChargeChange('vat', Number(e.target.value))}
                    className="text-right h-10 text-slate-600"
                  />
                </div>
             </div>

             {/* Additional Local Charge Invoices */}
             {additionalLocalCharges.length > 0 && (
                 <div className="border-t border-dashed border-slate-200 pt-6 mb-4">
                    <div className="space-y-4">
                        {additionalLocalCharges.map(item => (
                           <div key={item.id} className="group relative bg-slate-50 p-4 rounded-xl border border-slate-200 hover:shadow-sm transition-all">
                              <button onClick={() => handleRemoveAdditionalLC(item.id)} className="absolute -top-3 -right-3 bg-white text-slate-400 hover:text-red-500 rounded-full p-1.5 shadow-md border border-slate-100 opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                  <div className="space-y-1">
                                     <Label>Số hóa đơn</Label>
                                     <Input value={item.invoice} onChange={e => handleUpdateAdditionalLC(item.id, 'invoice', e.target.value)} className="h-9 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                     <Label>Ngày hóa đơn</Label>
                                     <DateInput value={item.date} onChange={e => handleUpdateAdditionalLC(item.id, 'date', e.target.value)} className="h-9 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                     <Label>Giá Net</Label>
                                     <Input type="number" value={item.net || ''} onChange={e => handleUpdateAdditionalLC(item.id, 'net', Number(e.target.value))} className="h-9 text-xs text-right font-medium" placeholder="0" />
                                  </div>
                                  <div className="space-y-1">
                                     <Label>VAT</Label>
                                     <Input type="number" value={item.vat || ''} onChange={e => handleUpdateAdditionalLC(item.id, 'vat', Number(e.target.value))} className="h-9 text-xs text-right" placeholder="0" />
                                  </div>
                              </div>
                           </div>
                        ))}
                    </div>
                    <div className="mt-4 text-right text-xs text-slate-500">
                       Tổng: <strong className="text-red-600 text-sm ml-1">{formatMoney(totalActualNet)}</strong>
                    </div>
                 </div>
             )}

             {/* File Upload Section - NEW */}
             <div className="mt-6 pt-4 border-t border-dashed border-slate-200">
                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()} 
                            className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center shadow-sm transition-colors"
                        >
                           <FileUp className="w-3.5 h-3.5 mr-2 text-blue-500" /> Chọn File HĐ
                        </button>
                        {selectedFile ? (
                            <span className="text-xs font-medium text-blue-600 flex items-center bg-blue-50 px-2 py-1 rounded">
                                {selectedFile.name}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Chưa chọn file</span>
                        )}
                    </div>
                    {selectedFile && (
                        <button 
                            type="button"
                            onClick={handleUploadFile} 
                            disabled={isUploading}
                            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center shadow-md transition-colors disabled:opacity-50"
                        >
                           {isUploading ? (
                               <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                           ) : (
                               <HardDrive className="w-3.5 h-3.5 mr-2" />
                           )}
                           Lưu vào Server (Ổ E)
                        </button>
                    )}
                </div>
             </div>

             {/* Mismatch Warning */}
             {totalActualNet !== systemTotalAdjustedCost && (
               <div className="flex items-center space-x-3 text-sm text-red-700 bg-red-50 p-3.5 rounded-xl border border-red-100 mt-6 animate-pulse">
                 <AlertCircle className="w-5 h-5 flex-shrink-0" />
                 <span>Lưu ý: Tổng Giá Net ({formatMoney(totalActualNet)}) lệch với Target ({formatMoney(systemTotalAdjustedCost)})</span>
               </div>
             )}
          </div>

          {/* Section 2.5: CƯỢC CONT (BOOKING LEVEL DEPOSIT) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                 <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide flex items-center">
                    <Anchor className="w-4 h-4 mr-2" /> CƯỢC CONT (DEPOSIT)
                 </h3>
                 <button onClick={handleAddDeposit} className="flex items-center space-x-1.5 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-bold">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Cược</span>
                 </button>
             </div>
             
             <div className="overflow-x-auto rounded-lg border border-slate-200">
               <table className="w-full text-sm text-left">
                  <thead className="bg-red-50/50 text-red-800 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 w-10"></th>
                      <th className="px-4 py-2.5 text-right font-bold uppercase text-xs">Tiền Cược</th>
                      <th className="px-4 py-2.5 font-bold uppercase text-xs">Ngày Cược</th>
                      <th className="px-4 py-2.5 font-bold uppercase text-xs">Ngày Hoàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deposits.length === 0 ? (
                       <tr><td colSpan={4} className="text-center py-6 text-slate-400 italic">Chưa có thông tin cược cho booking này</td></tr>
                    ) : (
                       deposits.map((item) => (
                        <tr key={item.id} className="hover:bg-red-50/10 group">
                           <td className="px-4 py-2 text-center">
                              <button onClick={() => handleRemoveDeposit(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
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
                                className="text-right h-9 font-medium text-red-700"
                                placeholder="0"
                              />
                           </td>
                           <td className="px-4 py-2">
                              <DateInput 
                                value={item.dateOut}
                                onChange={(e) => handleUpdateDeposit(item.id, 'dateOut', e.target.value)}
                                className="h-9"
                              />
                           </td>
                           <td className="px-4 py-2">
                              <DateInput 
                                value={item.dateIn}
                                onChange={(e) => handleUpdateDeposit(item.id, 'dateIn', e.target.value)}
                                className="h-9"
                              />
                           </td>
                        </tr>
                       ))
                    )}
                  </tbody>
               </table>
             </div>
             <div className="mt-4 text-right text-sm border-t border-slate-100 pt-3">
               <span className="font-bold text-slate-500 mr-2 uppercase text-xs">Tổng Cược:</span>
               <span className="text-red-700 font-bold text-lg">{formatMoney(totalDepositCost)}</span>
             </div>
          </div>

          {/* Section 3: Extensions Invoices */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
               <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide">Danh Sách Hóa Đơn Gia Hạn</h3>
               <button onClick={handleAddExtensionCost} className="flex items-center space-x-1.5 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors font-bold">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm HĐ</span>
               </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
               <table className="w-full text-sm text-left">
                  <thead className="bg-orange-50/50 text-orange-800 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 w-10"></th>
                      <th className="px-4 py-2.5 font-bold uppercase text-xs">Số HĐ</th>
                      <th className="px-4 py-2.5 font-bold uppercase text-xs">Ngày HĐ</th>
                      <th className="px-4 py-2.5 text-right font-bold uppercase text-xs">Net</th>
                      <th className="px-4 py-2.5 text-right font-bold uppercase text-xs">VAT</th>
                      <th className="px-4 py-2.5 text-right font-bold uppercase text-xs">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extensionCosts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-400 py-6 text-sm italic">Chưa có hóa đơn gia hạn</td>
                      </tr>
                    ) : (
                      extensionCosts.map((ext) => (
                        <tr key={ext.id} className="hover:bg-orange-50/10 group">
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => handleRemoveExtensionCost(ext.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <Input 
                              value={ext.invoice} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'invoice', e.target.value)}
                              className="h-9"
                              placeholder="Số HĐ"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <DateInput 
                              value={ext.date} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'date', e.target.value)}
                              className="h-9"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <Input 
                              type="number" 
                              value={ext.net || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'net', Number(e.target.value))}
                              className="h-9 text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2">
                             <Input 
                              type="number" 
                              value={ext.vat || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'vat', Number(e.target.value))}
                              className="h-9 text-right"
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
            
            <div className="mt-4 text-right text-sm border-t border-slate-100 pt-3">
               <span className="font-bold text-slate-500 mr-2 uppercase text-xs">Tổng Chi Gia Hạn:</span>
               <span className="text-orange-700 font-bold text-lg">{formatMoney(totalExtensionCost)}</span>
            </div>
          </div>

          {/* Section 4: Summary Table */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-sm font-bold text-blue-200 uppercase flex items-center tracking-wide">
                 <LayoutGrid className="w-4 h-4 mr-2" /> Tổng Hợp Booking
               </h3>
               
               {/* VAT TOGGLE */}
               <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                  <button 
                    onClick={() => setVatMode('pre')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      vatMode === 'pre' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Trước VAT
                  </button>
                  <button 
                    onClick={() => setVatMode('post')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      vatMode === 'post' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sau VAT
                  </button>
               </div>
             </div>
             
             <table className="w-full text-sm text-left">
                <thead className="text-slate-400 border-b border-slate-700/50">
                  <tr>
                    <th className="pb-3 uppercase text-xs tracking-wider">Khoản Mục</th>
                    <th className="pb-3 text-right uppercase text-xs tracking-wider">Tổng Thu {vatMode === 'pre' && '(Chia 1.08)'}</th>
                    <th className="pb-3 text-right uppercase text-xs tracking-wider">Tổng Chi {vatMode === 'pre' && '(Net)'}</th>
                    <th className="pb-3 text-right uppercase text-xs tracking-wider">Lợi Nhuận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Row 1: Amount (Local Charge) */}
                  <tr>
                    <td className="py-4 text-slate-300">Amount (Local Charge)</td>
                    <td className="py-4 text-right text-green-400 font-medium">{formatMoney(summaryLocalChargeRevenue)}</td>
                    <td className="py-4 text-right text-red-400 font-medium">{formatMoney(summaryAmountExpense)}</td>
                    <td className={`py-4 text-right font-bold ${baseProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(baseProfit)}
                    </td>
                  </tr>

                  {/* Row 2: Gia Hạn */}
                  <tr>
                    <td className="py-4 text-slate-300">Gia Hạn</td>
                    <td className="py-4 text-right text-green-400 font-medium">{formatMoney(summaryExtensionRevenue)}</td>
                    <td className="py-4 text-right text-red-400 font-medium">{formatMoney(summaryExtensionExpense)}</td>
                    <td className={`py-4 text-right font-bold ${extensionProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(extensionProfit)}
                    </td>
                  </tr>
                  
                   {/* Row 2.5: Deposit */}
                   <tr>
                    <td className="py-4 text-slate-300">Booking Deposit (Cược)</td>
                    <td className="py-4 text-right text-slate-600">-</td>
                    <td className="py-4 text-right text-red-400 font-medium">{formatMoney(totalDepositCost)}</td>
                    <td className="py-4 text-right text-slate-600">-</td>
                  </tr>

                  {/* Row 3: Grand Total */}
                  <tr className="bg-slate-800/50 font-bold">
                    <td className="py-4 text-white pl-2 uppercase tracking-wide">TỔNG CỘNG ({booking.jobCount} Jobs)</td>
                    <td className="py-4 text-right text-green-400 text-lg">{formatMoney(summaryGrandTotalRevenue)}</td>
                    <td className="py-4 text-right text-red-400 text-lg">{formatMoney(summaryGrandTotalExpense)}</td>
                    <td className={`py-4 text-right text-lg ${summaryGrandTotalProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(summaryGrandTotalProfit)}
                    </td>
                  </tr>
                </tbody>
             </table>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 flex justify-end space-x-3 bg-white/95 backdrop-blur-md rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">Đóng</button>
          <button onClick={handleSave} className="bg-blue-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-blue-900/30 transform active:scale-95 duration-100">
            <Save className="w-4 h-4" /> <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
