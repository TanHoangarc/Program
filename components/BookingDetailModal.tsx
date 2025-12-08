import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JobData, BookingSummary, BookingCostDetails, BookingExtensionCost, BookingDeposit } from '../types';
import { Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid, FileText, Anchor, Copy, Check, Calendar, Upload, FileUp, HardDrive } from 'lucide-react';
import { formatDateVN, parseDateVN } from '../utils';

// ... (Input, DateInput, Label components remain unchanged) ...
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

  // ... (Existing calculation logic remains the same) ...
  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => 
    sum + (job.extensions || []).reduce((s, ext) => s + ext.total, 0), 0
  );
  const totalLocalChargeRevenue = booking.jobs.reduce((sum, job) => sum + job.localChargeTotal, 0);
  const totalAdditionalLocalChargeNet = additionalLocalCharges.reduce((sum, item) => sum + (item.net || 0), 0);
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

  // ... (Other handler functions remain unchanged) ...
  const handleAddAdditionalLC = () => {
    setAdditionalLocalCharges(prev => [...prev, { id: Date.now().toString(), invoice: '', date: '', net: 0, vat: 0, total: 0 }]);
  };
  const handleUpdateAdditionalLC = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setAdditionalLocalCharges(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        if (field === 'net' || field === 'vat') updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
        return updated;
      }
      return item;
    }));
  };
  const handleRemoveAdditionalLC = (id: string) => setAdditionalLocalCharges(prev => prev.filter(i => i.id !== id));
  const handleAddExtensionCost = () => {
    setExtensionCosts(prev => [...prev, { id: Date.now().toString(), invoice: '', date: '', net: 0, vat: 0, total: 0 }]);
  };
  const handleUpdateExtensionCost = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setExtensionCosts(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        if (field === 'net' || field === 'vat') updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
        return updated;
      }
      return item;
    }));
  };
  const handleRemoveExtensionCost = (id: string) => setExtensionCosts(prev => prev.filter(i => i.id !== id));
  const handleAddDeposit = () => setDeposits(prev => [...prev, { id: Date.now().toString(), amount: 0, dateOut: '', dateIn: '' }]);
  const handleUpdateDeposit = (id: string, field: keyof BookingDeposit, val: any) => setDeposits(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  const handleRemoveDeposit = (id: string) => setDeposits(prev => prev.filter(d => d.id !== id));

  const handleSave = () => {
    onSave({ localCharge, additionalLocalCharges, extensionCosts, deposits });
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
      const dateStr = localCharge.date || new Date().toISOString(); 
      const dateObj = new Date(dateStr);
      let year = dateObj.getFullYear().toString().slice(-2);
      let month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      
      if (isNaN(dateObj.getTime())) {
         const now = new Date();
         year = now.getFullYear().toString().slice(-2);
         month = (now.getMonth() + 1).toString().padStart(2, '0');
      }

      const folderName = `${year}.${month}`; 

      const originalName = selectedFile.name;
      const extension = originalName.substring(originalName.lastIndexOf('.'));
      const safeLine = (booking.line || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const safeBooking = (booking.bookingId || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const safeInvoice = (localCharge.invoice || 'NoInvoice').replace(/[^a-zA-Z0-9]/g, '');
      const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
      const dd = validDate.getDate().toString().padStart(2, '0');
      const mm = (validDate.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = validDate.getFullYear();
      const dateFileStr = `${dd}.${mm}.${yyyy}`;

      const newFileName = `${safeLine}.${safeBooking}.${safeInvoice}.${dateFileStr}${extension}`;

      const formData = new FormData();
      // FIX: Append Text fields BEFORE File
      formData.append('folderPath', folderName);
      formData.append('fileName', newFileName);
      formData.append("file", selectedFile);

      // FIX: Use correct backend URL
      const res = await fetch("http://127.0.0.1:3001/upload-invoice", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        alert(`Đã lưu file thành công!\n\nĐường dẫn: E:\\ServerData\\Uploads\\${folderName}\\${newFileName}`);
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
          {/* ... (System Table, Thu Theo Hoa Don, Local Charge Input UI remain largely unchanged) ... */}
          
          {/* Simplified view for context: Just showing the file upload section logic which was updated above */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                 <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide">Local Charge (Hóa đơn Chi)</h3>
                 {/* ... buttons ... */}
             </div>
             
             {/* ... Inputs for Invoice ... */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end mb-6">
                <div className="space-y-1"><Label>Số hóa đơn</Label><Input type="text" value={localCharge.invoice} onChange={(e) => handleLocalChargeChange('invoice', e.target.value)} /></div>
                <div className="space-y-1"><Label>Ngày hóa đơn</Label><DateInput value={localCharge.date} onChange={(e) => handleLocalChargeChange('date', e.target.value)} /></div>
                <div className="space-y-1"><Label>Giá Net</Label><Input type="number" value={localCharge.net || ''} onChange={(e) => handleLocalChargeChange('net', Number(e.target.value))} className="text-right font-bold" /></div>
                <div className="space-y-1"><Label>VAT</Label><Input type="number" value={localCharge.vat || ''} onChange={(e) => handleLocalChargeChange('vat', Number(e.target.value))} className="text-right" /></div>
             </div>

             {/* ... Additional LC List ... */}

             {/* File Upload Section - Updated Logic Used Here */}
             <div className="mt-6 pt-4 border-t border-dashed border-slate-200">
                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center shadow-sm">
                           <FileUp className="w-3.5 h-3.5 mr-2 text-blue-500" /> Chọn File HĐ
                        </button>
                        {selectedFile ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">{selectedFile.name}</span> : <span className="text-xs text-slate-400 italic">Chưa chọn file</span>}
                    </div>
                    {selectedFile && (
                        <button type="button" onClick={handleUploadFile} disabled={isUploading} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center shadow-md disabled:opacity-50">
                           {isUploading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> : <HardDrive className="w-3.5 h-3.5 mr-2" />}
                           Lưu vào Server (Ổ E)
                        </button>
                    )}
                </div>
             </div>
          </div>

          {/* ... Rest of the modal content (Deposits, Extensions, Summary) ... */}
          {/* Rendered to preserve context but code omitted for brevity as logic didn't change */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
             {/* Summary Table */}
             <table className="w-full text-sm text-left">
                {/* ... */}
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="bg-slate-800/50 font-bold">
                    <td className="py-4 text-white pl-2 uppercase tracking-wide">TỔNG CỘNG ({booking.jobCount} Jobs)</td>
                    <td className="py-4 text-right text-green-400 text-lg">{formatMoney(summaryGrandTotalRevenue)}</td>
                    <td className="py-4 text-right text-red-400 text-lg">{formatMoney(summaryGrandTotalExpense)}</td>
                    <td className={`py-4 text-right text-lg ${summaryGrandTotalProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>{formatMoney(summaryGrandTotalProfit)}</td>
                  </tr>
                </tbody>
             </table>
          </div>
        </div>

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