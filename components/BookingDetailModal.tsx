import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JobData, BookingSummary, BookingCostDetails, BookingExtensionCost, BookingDeposit } from '../types';
import { Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid, FileText, Anchor, Copy, Check, Calendar, FileUp, HardDrive } from 'lucide-react';
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
    className={`w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
      disabled:bg-slate-50 disabled:text-slate-500 transition-all ${props.className || 'h-10'}`}
  />
);

const DateInput = ({ value, name, onChange, className }:{
  value: string;
  name?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => {

  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const triggerChange = (newVal: string) => {
    const e = { target: { name, value: newVal } } as React.ChangeEvent<HTMLInputElement>;
    onChange(e);
  };

  const handleBlur = () => {
    if (!displayValue) { 
      if (value) triggerChange(''); 
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) triggerChange(parsed);
    else setDisplayValue(formatDateVN(value));
  };

  return (
    <div className={`relative w-full ${className || 'h-10'}`}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 h-full"
      />

      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
        <input 
          type="date"
          value={value || ''}
          onChange={(e) => triggerChange(e.target.value)}
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

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onSave }) => {

  const [localCharge, setLocalCharge] = useState(booking.costDetails.localCharge || {
    invoice: '', date: '', net: 0, vat: 0, total: 0
  });

  const [additionalLocalCharges, setAdditionalLocalCharges] = useState<BookingExtensionCost[]>(
    booking.costDetails.additionalLocalCharges || []
  );

  const [extensionCosts, setExtensionCosts] = useState<BookingExtensionCost[]>(
    booking.costDetails.extensionCosts || []
  );

  const [deposits, setDeposits] = useState<BookingDeposit[]>(booking.costDetails.deposits || []);

  const [vatMode, setVatMode] = useState<'pre' | 'post'>('post');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // FILE UPLOAD
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------
  // CALCULATIONS
  // -----------------------------

  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => {
    const ext = (job.extensions || []).reduce((s, x) => s + x.total, 0);
    return sum + ext;
  }, 0);

  const totalLocalChargeRevenue = booking.jobs.reduce((s, j) => s + j.localChargeTotal, 0);

  const totalAdditionalLocalChargeNet = additionalLocalCharges.reduce((s, i) => s + (i.net || 0), 0);

  const totalExtensionCost = extensionCosts.reduce((s, i) => s + i.total, 0);
  const totalExtensionNetCost = extensionCosts.reduce((s, i) => s + (i.net || 0), 0);

  const totalDepositCost = deposits.reduce((s, d) => s + d.amount, 0);

  const systemTotalSell = booking.jobs.reduce((s, j) => s + j.sell, 0);

  const systemTotalAdjustedCost = booking.jobs.reduce((s, j) => {
    const kimberry = (j.cont20 * 250000) + (j.cont40 * 500000);
    const otherFees = (j.feeCic || 0) + (j.feePsc || 0) + (j.feeEmc || 0) + (j.feeOther || 0);
    return s + (j.cost - kimberry - otherFees);
  }, 0);

  const systemTotalVat = booking.jobs.reduce((s, j) => s + (j.cost * 0.05263), 0);

  const getRevenue = (v: number) => vatMode === 'post' ? v : Math.round(v / 1.08);

  const summaryLocalChargeRevenue = getRevenue(totalLocalChargeRevenue);
  const summaryExtensionRevenue = getRevenue(totalExtensionRevenue);

  const summaryGrandTotalRevenue = summaryLocalChargeRevenue + summaryExtensionRevenue;

  const totalJobPayment = booking.jobs.reduce((s, j) => s + (j.cost || 0), 0);

  const summaryAmountExpense = vatMode === 'post'
    ? totalJobPayment
    : ((localCharge.net || 0) + totalAdditionalLocalChargeNet);

  const summaryExtensionExpense = vatMode === 'post'
    ? totalExtensionCost
    : totalExtensionNetCost;

  const summaryGrandTotalExpense = summaryAmountExpense + summaryExtensionExpense + totalDepositCost;

  const summaryProfit = summaryGrandTotalRevenue - summaryGrandTotalExpense;

  const baseProfit = summaryLocalChargeRevenue - summaryAmountExpense;
  const extensionProfit = summaryExtensionRevenue - summaryExtensionExpense;

  const totalActualNet = (localCharge.net || 0) + totalAdditionalLocalChargeNet;

  // -----------------------------
  // UPDATE HANDLERS
  // -----------------------------

  const handleLocalChargeChange = (field: keyof typeof localCharge, val: any) => {
    setLocalCharge(prev => {
      const up = { ...prev, [field]: val };
      if (field === 'net' || field === 'vat') {
        up.total = (Number(up.net) || 0) + (Number(up.vat) || 0);
      }
      return up;
    });
  };

  const handleAddAdditionalLC = () => {
    setAdditionalLocalCharges(prev => [...prev, {
      id: Date.now().toString(),
      invoice: '', date: '', net: 0, vat: 0, total: 0
    }]);
  };

  const handleUpdateAdditionalLC = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setAdditionalLocalCharges(prev => prev.map(item => {
      if (item.id === id) {
        const up = { ...item, [field]: val };
        if (field === 'net' || field === 'vat')
          up.total = (Number(up.net) || 0) + (Number(up.vat) || 0);
        return up;
      }
      return item;
    }));
  };

  const handleRemoveAdditionalLC = (id: string) => {
    setAdditionalLocalCharges(prev => prev.filter(i => i.id !== id));
  };

  const handleAddExtensionCost = () => {
    setExtensionCosts(prev => [...prev, {
      id: Date.now().toString(), invoice: '', date: '', net: 0, vat: 0, total: 0
    }]);
  };

  const handleUpdateExtensionCost = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setExtensionCosts(prev => prev.map(item => {
      if (item.id === id) {
        const up = { ...item, [field]: val };
        if (field === 'net' || field === 'vat')
          up.total = (Number(up.net) || 0) + (Number(up.vat) || 0);
        return up;
      }
      return item;
    }));
  };

  const handleRemoveExtensionCost = (id: string) => {
    setExtensionCosts(prev => prev.filter(i => i.id !== id));
  };

  const handleAddDeposit = () => {
    setDeposits(prev => [...prev, {
      id: Date.now().toString(), amount: 0, dateOut: '', dateIn: ''
    }]);
  };

  const handleUpdateDeposit = (id: string, field: keyof BookingDeposit, val: any) => {
    setDeposits(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleRemoveDeposit = (id: string) => {
    setDeposits(prev => prev.filter(d => d.id !== id));
  };

  // -----------------------------
  // FILE UPLOAD (INVOICE CHI)
  // -----------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

// Thay thế toàn bộ function handleUploadFile bằng cái này
const handleUploadFile = async () => {
  if (!selectedFile) {
    alert("Vui lòng chọn file hóa đơn trước.");
    return;
  }
  if (!localCharge.invoice) {
    alert("Vui lòng nhập SỐ HÓA ĐƠN trước khi upload file.");
    return;
  }

  setIsUploading(true);

  try {
    const rawDate = localCharge.date || new Date().toISOString();
    const dateObj = new Date(rawDate);

    let year = dateObj.getFullYear().toString().slice(-2);
    let month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    if (isNaN(dateObj.getTime())) {
      const now = new Date();
      year = now.getFullYear().toString().slice(-2);
      month = (now.getMonth() + 1).toString().padStart(2, "0");
    }
    const folderName = `${year}.${month}`;

    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf("."));
    const safeLine = ((booking as any).line || "Line").toString().replace(/[^a-zA-Z0-9]/g, "");
    const safeBooking = ((booking as any).booking || (booking as any).bookingId || (booking as any).bookingNo || "Booking").toString().replace(/[^a-zA-Z0-9]/g, "");
    const safeInvoice = (localCharge.invoice || "INV").toString().replace(/[^a-zA-Z0-9]/g, "");

    const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    const dd = validDate.getDate().toString().padStart(2, "0");
    const mm = (validDate.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = validDate.getFullYear().toString();
    const dateStr = `${dd}.${mm}.${yyyy}`;

    const newFileName = `${safeLine}.${safeBooking}.${safeInvoice}.${dateStr}${ext}`;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("folderPath", folderName);
    formData.append("fileName", newFileName);
    formData.append("type", "invoice");
    formData.append("bookingId", (booking as any).booking || (booking as any).bookingId || (booking as any).bookingNo || "");
    formData.append("line", ((booking as any).line || "").toString());

    // DEBUG: log payload summary
    console.log("[upload] uploading", {
      to: "https://api.kimberry.id.vn/upload-file",
      folderName,
      newFileName,
      file: selectedFile.name,
      booking: (booking as any).booking
    });

    const res = await fetch("https://api.kimberry.id.vn/upload-file", {
      method: "POST",
      body: formData,
    });

    // Read response text/JSON
    const contentType = res.headers.get("content-type") || "";
    let body: any = null;
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    if (res.ok) {
      // server should return { success: true, serverPath, ... }
      const serverPath = (body && body.serverPath) ? body.serverPath : `E:\\ServerData\\Invoice\\${folderName}\\${newFileName}`;
      alert(`Đã lưu file thành công!\n\nĐường dẫn:\n${serverPath}`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      console.error("Upload failed", res.status, body);
      // show server message if available
      const msg = (body && (body.message || body.error)) ? (body.message || body.error) : `Server responded ${res.status}`;
      alert(`Upload thất bại: ${msg}`);
    }

  } catch (err: any) {
    console.error("Upload failed (exception)", err);
    alert(`Không thể kết nối đến server.\nChi tiết: ${err?.message || err}`);
  } finally {
    setIsUploading(false);
  }
};

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const getProjectCode = (job: JobData) => {
    let year = new Date().getFullYear();
    if (job.localChargeDate) year = new Date(job.localChargeDate).getFullYear();

    const yy = year.toString().slice(-2);
    const mm = job.month.padStart(2, "0");

    return `K${yy}${mm}${job.jobCode}`;
  };

  const copyColumn = (type: 'sell' | 'cost' | 'vat' | 'project') => {
    const values = booking.jobs.map(job => {
      if (type === "sell") return job.sell;

      if (type === "cost") {
        const kimberry = job.cont20 * 250000 + job.cont40 * 500000;
        const other = (job.feeCic || 0) + (job.feePsc || 0) + (job.feeEmc || 0) + (job.feeOther || 0);
        return job.cost - kimberry - other;
      }

      if (type === "vat") return job.cost * 0.05263;

      if (type === "project") return getProjectCode(job);

      return "";
    });

    navigator.clipboard.writeText(values.join("\n"));
    setCopiedId(`col-${type}`);
    setTimeout(() => setCopiedId(null), 1300);
  };

  const formatMoney = (v: number) => new Intl.NumberFormat("en-US").format(v);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-white/50">

        {/* ================= HEADER ================= */}
        <div className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-white/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              Chi tiết Booking:
              <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-xl">
                {(booking as any).booking || (booking as any).bookingId || (booking as any).bookingNo}
              </span>
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

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar space-y-8">

          {/* ========== SECTION 1: SYSTEM TABLE ========== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-5 border-b border-slate-100 pb-3 flex items-center">
              <Ship className="w-4 h-4 mr-2 text-teal-600" />
              SYSTEM
            </h3>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">

                    <th className="px-4 py-3 border-r border-slate-200 font-bold uppercase text-xs">Job Code</th>

                    {/* SELL */}
                    <th className="px-4 py-3 border-r text-right font-bold uppercase text-xs group w-40">
                      <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600"
                           onClick={() => copyColumn("sell")}>
                        Sell
                        {copiedId === "col-sell"
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                      </div>
                    </th>

                    {/* COST */}
                    <th className="px-4 py-3 border-r text-right font-bold uppercase text-xs group w-40">
                      <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600"
                           onClick={() => copyColumn("cost")}>
                        Cost (Adj)
                        {copiedId === "col-cost"
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                      </div>
                    </th>

                    {/* VAT */}
                    <th className="px-4 py-3 border-r text-right font-bold uppercase text-xs group w-40">
                      <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600"
                           onClick={() => copyColumn("vat")}>
                        VAT (5.263%)
                        {copiedId === "col-vat"
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                      </div>
                    </th>

                    {/* PROJECT */}
                    <th className="px-4 py-3 text-center font-bold uppercase text-xs group">
                      <div className="flex items-center justify-center gap-2 cursor-pointer hover:text-blue-600"
                           onClick={() => copyColumn("project")}>
                        Công trình
                        {copiedId === "col-project"
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {booking.jobs.map(job => {
                    const kimberry = job.cont20 * 250000 + job.cont40 * 500000;
                    const other = (job.feeCic || 0) + (job.feePsc || 0) + (job.feeEmc || 0) + (job.feeOther || 0);
                    const adjusted = job.cost - kimberry - other;
                    const vat = job.cost * 0.05263;

                    return (
                      <tr key={job.id} className="hover:bg-blue-50/50">
                        <td className="px-4 py-3 border-r font-bold text-teal-700">{job.jobCode}</td>
                        <td className="px-4 py-3 border-r text-right text-slate-600 font-medium">{formatMoney(job.sell)}</td>
                        <td className="px-4 py-3 border-r text-right text-slate-600">{formatMoney(adjusted)}</td>
                        <td className="px-4 py-3 border-r text-right text-slate-500">{formatMoney(vat)}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">
                          {getProjectCode(job)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="bg-slate-50 font-bold text-slate-800 border-t">
                  <tr>
                    <td className="px-4 py-3 text-right border-r">Tổng:</td>
                    <td className="px-4 py-3 text-right text-green-600 border-r">{formatMoney(systemTotalSell)}</td>
                    <td className="px-4 py-3 text-right text-red-600 border-r">{formatMoney(systemTotalAdjustedCost)}</td>
                    <td className="px-4 py-3 text-right border-r">{formatMoney(systemTotalVat)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* =====================================================
               SECTION 1.5 — THU THEO HÓA ĐƠN
          ===================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-blue-700 uppercase mb-5 border-b pb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2" /> THU THEO HÓA ĐƠN
            </h3>

            <div className="overflow-x-auto rounded-lg border border-blue-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 text-blue-800 border-b border-blue-100">
                    <th className="px-4 py-3 border-r font-bold uppercase text-xs">Job Code</th>
                    <th className="px-4 py-3 border-r text-right font-bold uppercase text-xs">
                      Amount (Local Charge)
                    </th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-xs">Gia Hạn (Thu)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {booking.jobs.map(job => {
                    const extTotal = (job.extensions || []).reduce((s, e) => s + e.total, 0);

                    return (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 border-r text-slate-700">{job.jobCode}</td>
                        <td className="px-4 py-3 border-r text-right text-blue-600 font-medium">
                          {formatMoney(job.localChargeTotal)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600 font-medium">
                          {extTotal > 0 ? formatMoney(extTotal) : "-"}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-slate-50 font-bold border-t">
                    <td className="px-4 py-3 text-right border-r">Tổng cộng:</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatMoney(totalLocalChargeRevenue)}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{formatMoney(totalExtensionRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* =====================================================
               SECTION 2 — LOCAL CHARGE (INVOICE CHI)
          ===================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">

            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="text-sm font-bold text-red-600 uppercase">Local Charge (Hóa Đơn Chi)</h3>

              <div className="flex items-center space-x-3">
                <div className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
                  Target (Tổng Chi Payment): <strong>{formatMoney(systemTotalAdjustedCost)}</strong>
                </div>

                <button
                  onClick={handleAddAdditionalLC}
                  className="flex items-center space-x-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm HĐ</span>
                </button>
              </div>
            </div>

            {/* Main Invoice Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

              <div>
                <Label>Số hóa đơn</Label>
                <Input
                  value={localCharge.invoice}
                  onChange={(e) => handleLocalChargeChange("invoice", e.target.value)}
                  className="font-medium"
                />
              </div>

              <div>
                <Label>Ngày hóa đơn</Label>
                <DateInput
                  value={localCharge.date}
                  onChange={(e) => handleLocalChargeChange("date", e.target.value)}
                />
              </div>

              <div>
                <Label>Giá Net</Label>
                <Input
                  type="number"
                  value={localCharge.net}
                  onChange={(e) => handleLocalChargeChange("net", Number(e.target.value))}
                  className="text-right font-bold"
                />
              </div>

              <div>
                <Label>VAT</Label>
                <Input
                  type="number"
                  value={localCharge.vat}
                  onChange={(e) => handleLocalChargeChange("vat", Number(e.target.value))}
                  className="text-right"
                />
              </div>
            </div>

            {/* Additional LocalCharge */}
            {additionalLocalCharges.length > 0 && (
              <div className="border-t border-dashed mt-6 pt-6 space-y-4">
                {additionalLocalCharges.map(item => (
                  <div key={item.id} className="relative group bg-slate-50 p-4 rounded-xl border hover:shadow-sm">

                    {/* delete */}
                    <button
                      onClick={() => handleRemoveAdditionalLC(item.id)}
                      className="absolute -top-3 -right-3 bg-white p-1.5 border rounded-full text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 shadow-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                      <div>
                        <Label>Số hóa đơn</Label>
                        <Input
                          value={item.invoice}
                          onChange={(e) => handleUpdateAdditionalLC(item.id, "invoice", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div>
                        <Label>Ngày hóa đơn</Label>
                        <DateInput
                          value={item.date}
                          onChange={(e) => handleUpdateAdditionalLC(item.id, "date", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div>
                        <Label>Giá Net</Label>
                        <Input
                          type="number"
                          value={item.net}
                          onChange={(e) => handleUpdateAdditionalLC(item.id, "net", Number(e.target.value))}
                          className="h-9 text-right text-xs"
                        />
                      </div>

                      <div>
                        <Label>VAT</Label>
                        <Input
                          type="number"
                          value={item.vat}
                          onChange={(e) => handleUpdateAdditionalLC(item.id, "vat", Number(e.target.value))}
                          className="h-9 text-xs text-right"
                        />
                      </div>

                    </div>
                  </div>
                ))}

                <div className="mt-2 text-right text-xs text-slate-500">
                  Tổng Net: <strong className="text-red-600 text-sm">{formatMoney(totalActualNet)}</strong>
                </div>
              </div>
            )}

            {/* =====================================================
                FILE UPLOAD (INVOICE CHI)
            ===================================================== */}
            <div className="mt-6 border-t border-dashed pt-6">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border">

                <div className="flex items-center space-x-3">

                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-50"
                  >
                    <FileUp className="w-3.5 h-3.5 mr-2 text-blue-500" />
                    Chọn File HĐ
                  </button>

                  {selectedFile ? (
                    <span className="text-xs bg-blue-50 px-2 py-1 rounded text-blue-600 font-medium">
                      {selectedFile.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa chọn file</span>
                  )}
                </div>

                {selectedFile && (
                  <div className="flex items-center space-x-2">

                    <button
                      disabled={isUploading}
                      onClick={handleUploadFile}
                      className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isUploading
                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        : <HardDrive className="w-3.5 h-3.5 mr-2" />}
                      Lưu vào Server
                    </button>

                    <button
                      onClick={() => { 
                        setSelectedFile(null); 
                        if (fileInputRef.current) fileInputRef.current.value = ''; 
                      }}
                      className="bg-white border px-3 py-2 rounded-lg text-xs hover:bg-slate-50"
                    >
                      Hủy
                    </button>

                  </div>
                )}

              </div>
            </div>

            {/* WARNING MISMATCH */}
            {totalActualNet !== systemTotalAdjustedCost && (
              <div className="flex items-center mt-6 text-sm text-red-700 bg-red-50 p-3 rounded-xl border border-red-100">
                <AlertCircle className="w-5 h-5 mr-2" />
                Lưu ý: Tổng Net ({formatMoney(totalActualNet)}) lệch Target ({formatMoney(systemTotalAdjustedCost)})
              </div>
            )}
          </div>

          {/* =====================================================
               SECTION 2.5 — CƯỢC CONT (DEPOSIT)
          ===================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">

            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="text-sm font-bold text-red-600 uppercase flex items-center">
                <Anchor className="w-4 h-4 mr-2" /> CƯỢC CONT (DEPOSIT)
              </h3>

              <button
                onClick={handleAddDeposit}
                className="flex items-center text-xs bg-red-50 text-red-600 border px-3 py-1.5 rounded-lg hover:bg-red-100"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm Cược
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-red-50 text-red-800 border-b">
                  <tr>
                    <th className="px-4 py-2 w-10"></th>
                    <th className="px-4 py-2 text-right font-bold uppercase text-xs">Tiền Cược</th>
                    <th className="px-4 py-2 font-bold uppercase text-xs">Ngày Cược</th>
                    <th className="px-4 py-2 font-bold uppercase text-xs">Ngày Hoàn</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {deposits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                        Chưa có thông tin cược
                      </td>
                    </tr>
                  ) : (
                    deposits.map(item => (
                      <tr key={item.id} className="hover:bg-red-50/10">

                        {/* delete */}
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveDeposit(item.id)}
                            className="text-slate-300 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            value={item.amount ? formatMoney(item.amount) : ""}
                            onChange={(e) => {
                              const val = Number(e.target.value.replace(/,/g, ""));
                              if (!isNaN(val)) handleUpdateDeposit(item.id, "amount", val);
                            }}
                            className="text-right h-9 font-medium text-red-700"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <DateInput
                            value={item.dateOut}
                            onChange={(e) => handleUpdateDeposit(item.id, "dateOut", e.target.value)}
                            className="h-9"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <DateInput
                            value={item.dateIn}
                            onChange={(e) => handleUpdateDeposit(item.id, "dateIn", e.target.value)}
                            className="h-9"
                          />
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-right text-sm border-t pt-3">
              <span className="font-bold text-slate-500 mr-2 uppercase text-xs">Tổng Cược:</span>
              <span className="text-red-700 font-bold text-lg">{formatMoney(totalDepositCost)}</span>
            </div>
          </div>

          {/* =====================================================
               SECTION 3 — HÓA ĐƠN GIA HẠN (EXTENSION)
          ===================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">

            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="text-sm font-bold text-orange-600 uppercase">Danh Sách Hóa Đơn Gia Hạn</h3>

              <button
                onClick={handleAddExtensionCost}
                className="flex items-center text-xs bg-orange-50 text-orange-600 border px-3 py-1.5 rounded-lg hover:bg-orange-100"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm HĐ
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 text-orange-800 border-b">
                  <tr>
                    <th className="px-4 py-2 w-10"></th>
                    <th className="px-4 py-2 font-bold uppercase text-xs">Số HĐ</th>
                    <th className="px-4 py-2 font-bold uppercase text-xs">Ngày HĐ</th>
                    <th className="px-4 py-2 text-right font-bold uppercase text-xs">Net</th>
                    <th className="px-4 py-2 text-right font-bold uppercase text-xs">VAT</th>
                    <th className="px-4 py-2 text-right font-bold uppercase text-xs">Tổng</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {extensionCosts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                        Chưa có hóa đơn gia hạn
                      </td>
                    </tr>
                  ) : (
                    extensionCosts.map(ext => (
                      <tr key={ext.id} className="hover:bg-orange-50/10">

                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveExtensionCost(ext.id)}
                            className="text-slate-300 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            value={ext.invoice}
                            onChange={(e) => handleUpdateExtensionCost(ext.id, "invoice", e.target.value)}
                            className="h-9"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <DateInput
                            value={ext.date}
                            onChange={(e) => handleUpdateExtensionCost(ext.id, "date", e.target.value)}
                            className="h-9"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={ext.net}
                            onChange={(e) => handleUpdateExtensionCost(ext.id, "net", Number(e.target.value))}
                            className="h-9 text-right"
                          />
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={ext.vat}
                            onChange={(e) => handleUpdateExtensionCost(ext.id, "vat", Number(e.target.value))}
                            className="h-9 text-right"
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

            <div className="mt-4 text-right border-t pt-3 text-sm">
              <span className="font-bold text-slate-500 mr-2 uppercase text-xs">Tổng Chi Gia Hạn:</span>
              <span className="text-orange-700 font-bold text-lg">{formatMoney(totalExtensionCost)}</span>
            </div>

          </div>

          {/* =====================================================
               SECTION 4 — SUMMARY TABLE
          ===================================================== */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">

            <div className="flex justify-between items-center mb-6">

              <h3 className="text-sm font-bold text-blue-200 uppercase flex items-center">
                <LayoutGrid className="w-4 h-4 mr-2" /> Tổng Hợp Booking
              </h3>

              {/* VAT Toggle */}
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={() => setVatMode("pre")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${
                    vatMode === "pre" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Trước VAT
                </button>

                <button
                  onClick={() => setVatMode("post")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md ${
                    vatMode === "post" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sau VAT
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 uppercase text-xs tracking-wider">Khoản Mục</th>
                  <th className="pb-3 text-right uppercase text-xs tracking-wider">
                    Tổng Thu {vatMode === "pre" && "(Chia 1.08)"}
                  </th>
                  <th className="pb-3 text-right uppercase text-xs tracking-wider">
                    Tổng Chi {vatMode === "pre" && "(Net)"}
                  </th>
                  <th className="pb-3 text-right uppercase text-xs tracking-wider">Lợi Nhuận</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/50">

                {/* Local Charge */}
                <tr>
                  <td className="py-4 text-slate-300">Amount (Local Charge)</td>
                  <td className="py-4 text-right text-green-400">{formatMoney(summaryLocalChargeRevenue)}</td>
                  <td className="py-4 text-right text-red-400">{formatMoney(summaryAmountExpense)}</td>
                  <td className={`py-4 text-right font-bold ${baseProfit >= 0 ? "text-yellow-400" : "text-red-500"}`}>
                    {formatMoney(baseProfit)}
                  </td>
                </tr>

                {/* Gia hạn */}
                <tr>
                  <td className="py-4 text-slate-300">Gia Hạn</td>
                  <td className="py-4 text-right text-green-400">{formatMoney(summaryExtensionRevenue)}</td>
                  <td className="py-4 text-right text-red-400">{formatMoney(summaryExtensionExpense)}</td>
                  <td className={`py-4 text-right font-bold ${extensionProfit >= 0 ? "text-yellow-400" : "text-red-500"}`}>
                    {formatMoney(extensionProfit)}
                  </td>
                </tr>

                {/* Deposit */}
                <tr>
                  <td className="py-4 text-slate-300">Booking Deposit (Cược)</td>
                  <td className="py-4 text-right text-slate-500">-</td>
                  <td className="py-4 text-right text-red-400">{formatMoney(totalDepositCost)}</td>
                  <td className="py-4 text-right text-slate-500">-</td>
                </tr>

                {/* Tổng cộng */}
                <tr className="bg-slate-800/40 font-bold">
                  <td className="py-4 text-white uppercase tracking-wide">
                    TỔNG CỘNG ({booking.jobCount} Jobs)
                  </td>
                  <td className="py-4 text-right text-green-400 text-lg">
                    {formatMoney(summaryGrandTotalRevenue)}
                  </td>
                  <td className="py-4 text-right text-red-400 text-lg">
                    {formatMoney(summaryGrandTotalExpense)}
                  </td>
                  <td className={`py-4 text-right text-lg ${
                    summaryProfit >= 0 ? "text-yellow-400" : "text-red-500"
                  }`}>
                    {formatMoney(summaryProfit)}
                  </td>
                </tr>

              </tbody>
            </table>

          </div>

        </div>

        {/* ================= FOOTER ================= */}
        <div className="p-4 border-t flex justify-end bg-white/95 space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white 
                       border border-slate-300 hover:bg-slate-50 shadow-sm"
          >
            Đóng
          </button>

          <button
            onClick={() => onSave({ localCharge, additionalLocalCharges, extensionCosts, deposits })}
            className="bg-blue-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 
                       flex items-center space-x-2 shadow-lg hover:shadow-blue-900/30"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Thay Đổi</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
