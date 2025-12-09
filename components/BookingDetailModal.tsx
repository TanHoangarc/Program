import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  JobData,
  BookingSummary,
  BookingCostDetails,
  BookingExtensionCost,
  BookingDeposit
} from '../types';

import {
  Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid,
  FileText, Anchor, Copy, Check, Calendar, Upload,
  FileUp, HardDrive
} from 'lucide-react';

import { formatDateVN, parseDateVN } from '../utils';

// ======================================================
// SMALL COMPONENTS
// ======================================================

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    value={props.value ?? ""}
    className={`w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
      disabled:bg-slate-50 disabled:text-slate-500 transition-all ${props.className || "h-10"}`}
  />
);

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-500 mb-1.5">{children}</label>
);

// ------------------------------------------------------
// DATE INPUT (dd/mm/yyyy <-> yyyy-mm-dd)
// ------------------------------------------------------

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
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const triggerChange = (newVal: string) => {
    const e = { target: { name, value: newVal } } as React.ChangeEvent<HTMLInputElement>;
    onChange(e);
  };

  const handleBlur = () => {
    if (!displayValue) {
      if (value) triggerChange("");
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) triggerChange(parsed);
    else setDisplayValue(formatDateVN(value));
  };

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerChange(e.target.value);
  };

  return (
    <div className={`relative w-full ${className || "h-10"}`}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 bg-white border border-slate-200 rounded-lg text-sm 
          text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 
          pr-10 h-full transition-all"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
        <input
          type="date"
          value={value || ""}
          onChange={handleIconSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Calendar className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export const BookingDetailModal: React.FC<{
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails, updatedJobs?: JobData[]) => void;
}> = ({ booking, onClose, onSave }) => {

  // ---------------------------------------------------
  // STATE
  // ---------------------------------------------------
  const [localCharge, setLocalCharge] = useState(
    booking.costDetails.localCharge || {
      invoice: "",
      date: "",
      net: 0,
      vat: 0,
      total: 0
    }
  );

  const [additionalLocalCharges, setAdditionalLocalCharges] = useState<BookingExtensionCost[]>(
    booking.costDetails.additionalLocalCharges || []
  );

  const [extensionCosts, setExtensionCosts] = useState<BookingExtensionCost[]>(
    booking.costDetails.extensionCosts || []
  );

  const [deposits, setDeposits] = useState<BookingDeposit[]>(
    booking.costDetails.deposits || []
  );

  const [vatMode, setVatMode] = useState<'pre' | 'post'>('post');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ---------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------

  const handleLocalChargeChange = (field: keyof typeof localCharge, value: any) => {
    setLocalCharge(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "net" || field === "vat") {
        updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
      }
      return updated;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // ======================================================
  // FILE UPLOAD — FULLY FIXED
  // ======================================================

  const handleUploadFile = async () => {
    if (!selectedFile) {
      alert("Vui lòng chọn file hóa đơn.");
      return;
    }

    if (!localCharge.invoice) {
      alert("Vui lòng nhập số hóa đơn trước khi upload.");
      return;
    }

    try {
      setIsUploading(true);

      // -------------------------
      // 1. Determine folderName YY.MM
      // -------------------------
      const rawDate = localCharge.date || new Date().toISOString();
      const dateObj = new Date(rawDate);

      let year = dateObj.getFullYear().toString().slice(-2);
      let month = String(dateObj.getMonth() + 1).padStart(2, "0");

      if (isNaN(dateObj.getTime())) {
        const now = new Date();
        year = now.getFullYear().toString().slice(-2);
        month = String(now.getMonth() + 1).padStart(2, "0");
      }

      const folder = `${year}.${month}`;

      // -------------------------
      // 2. Construct filename
      // -------------------------
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf("."));
      const safeLine = booking.line.replace(/[^a-zA-Z0-9]/g, "");
      const safeBooking =
        (booking.booking || booking.bookingId || booking.bookingNo || "")
          .toString()
          .replace(/[^a-zA-Z0-9]/g, "");

      const safeInvoice = String(localCharge.invoice).replace(/[^a-zA-Z0-9]/g, "");

      const dd = String(dateObj.getDate()).padStart(2, "0");
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const yyyy = dateObj.getFullYear();

      const dateStr = `${dd}.${mm}.${yyyy}`;

      const finalName = `${safeLine}.${safeBooking}.${safeInvoice}.${dateStr}${ext}`;

      // -------------------------
      // 3. Prepare FormData
      // -------------------------
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folderPath", folder);
      formData.append("fileName", finalName);

      // -------------------------
      // 4. Upload to server
      // -------------------------
      const res = await fetch("https://api.kimberry.id.vn/upload-file", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("Upload thất bại. Kiểm tra server hoặc Cloudflare.");
        return;
      }

      alert(`✔ Upload thành công!\nĐường dẫn: E:/ServerData/Invoice/${folder}/${finalName}`);

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err) {
      console.error("UPLOAD FAILED:", err);
      alert("Không kết nối được đến server.");
    } finally {
      setIsUploading(false);
    }
  };

  // ---------------------------------------------------
  // COPY TO CLIPBOARD
  // ---------------------------------------------------
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  // ---------------------------------------------------
  // UTILS
  // ---------------------------------------------------

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("en-US").format(v || 0);

  const getProjectCode = (job: JobData) => {
    const year = (job.localChargeDate ? new Date(job.localChargeDate) : new Date()).getFullYear();
    return `K${String(year).slice(-2)}${job.month.padStart(2, "0")}${job.jobCode}`;
  };

  // ---------------------------------------------------
  // TOTAL CALCULATIONS
  // ---------------------------------------------------

  const systemTotalSell = booking.jobs.reduce((s, j) => s + j.sell, 0);

  const systemTotalAdjustedCost = booking.jobs.reduce((s, j) => {
    const kimberry = j.cont20 * 250000 + j.cont40 * 500000;
    const fees = (j.feeCic || 0) + (j.feePsc || 0) + (j.feeEmc || 0) + (j.feeOther || 0);
    return s + (j.cost - kimberry - fees);
  }, 0);

  const systemTotalVat = booking.jobs.reduce((s, j) => s + j.cost * 0.05263, 0);

  const totalLocalChargeRevenue = booking.jobs.reduce(
    (s, j) => s + j.localChargeTotal,
    0
  );

  const totalExtensionRevenue = booking.jobs.reduce(
    (sum, j) => sum + (j.extensions || []).reduce((a, x) => a + x.total, 0),
    0
  );

  const totalAdditionalNet = additionalLocalCharges.reduce((s, x) => s + (x.net || 0), 0);
  const totalDeposit = deposits.reduce((s, x) => s + (x.amount || 0), 0);

  const summaryLocalChargeRevenue =
    vatMode === "post" ? totalLocalChargeRevenue : Math.round(totalLocalChargeRevenue / 1.08);

  const summaryExtensionRevenue =
    vatMode === "post" ? totalExtensionRevenue : Math.round(totalExtensionRevenue / 1.08);

  const summaryAmountExpense =
    vatMode === "post"
      ? systemTotalAdjustedCost
      : localCharge.net + totalAdditionalNet;

  const summaryExtensionExpense =
    vatMode === "post"
      ? extensionCosts.reduce((s, x) => s + x.total, 0)
      : extensionCosts.reduce((s, x) => s + (x.net || 0), 0);

  const totalRevenue = summaryLocalChargeRevenue + summaryExtensionRevenue;
  const totalCost = summaryAmountExpense + summaryExtensionExpense + totalDeposit;
  const totalProfit = totalRevenue - totalCost;

  const baseProfit = summaryLocalChargeRevenue - summaryAmountExpense;
  const extProfit = summaryExtensionRevenue - summaryExtensionExpense;

  // ---------------------------------------------------
  // SAVE FUNCTION
  // ---------------------------------------------------
  const handleSave = () => {
    onSave(
      {
        localCharge,
        additionalLocalCharges,
        extensionCosts,
        deposits
      }
    );
    onClose();
  };
// ======================================================
// RENDER UI — PART 2
// ======================================================

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-fadeIn border border-slate-200">

        {/* ------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------ */}
        <div className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-white/70">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              Chi tiết Booking:
              <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                {(booking as any).booking || booking.bookingId}
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
              <span>Line: <strong className="text-slate-700">{booking.line}</strong></span>
              <span>Tháng: <strong className="text-slate-700">{booking.month}</strong></span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ------------------------------------------------ */}
        {/* SCROLL CONTENT */}
        {/* ------------------------------------------------ */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-8">

          {/* ===================================================== */}
          {/* SECTION 1 — SYSTEM TABLE */}
          {/* ===================================================== */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
              <Ship className="w-4 h-4 text-teal-600 mr-2" />
              SYSTEM
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 border-r">Job</th>
                    <th className="px-4 py-2 border-r text-right">Sell</th>
                    <th className="px-4 py-2 border-r text-right">Cost (Adj)</th>
                    <th className="px-4 py-2 border-r text-right">VAT</th>
                    <th className="px-4 py-2 text-center">Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.jobs.map(job => {
                    const kimberry = job.cont20 * 250000 + job.cont40 * 500000;
                    const fees = (job.feeCic || 0) + (job.feePsc || 0) +
                                 (job.feeEmc || 0) + (job.feeOther || 0);
                    const adjusted = job.cost - kimberry - fees;
                    const vat = job.cost * 0.05263;

                    return (
                      <tr key={job.id} className="hover:bg-blue-50/40">
                        <td className="px-4 py-2 border-r font-semibold text-slate-700">{job.jobCode}</td>
                        <td className="px-4 py-2 border-r text-right text-blue-700">{formatMoney(job.sell)}</td>
                        <td className="px-4 py-2 border-r text-right text-red-600">{formatMoney(adjusted)}</td>
                        <td className="px-4 py-2 border-r text-right text-slate-500">{formatMoney(vat)}</td>
                        <td className="px-4 py-2 text-center text-xs text-slate-500 font-mono">
                          {getProjectCode(job)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t font-bold text-slate-700">
                  <tr>
                    <td className="px-4 py-2 text-right border-r">Tổng:</td>
                    <td className="px-4 py-2 text-right text-green-700 border-r">{formatMoney(systemTotalSell)}</td>
                    <td className="px-4 py-2 text-right text-red-700 border-r">{formatMoney(systemTotalAdjustedCost)}</td>
                    <td className="px-4 py-2 text-right border-r">{formatMoney(systemTotalVat)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ===================================================== */}
          {/* SECTION 2 — LOCAL CHARGE (HÓA ĐƠN CHI) */}
          {/* ===================================================== */}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-red-600 flex items-center">
                Local Charge (Hóa Đơn Chi)
              </h3>
              <div className="text-xs px-3 py-1 bg-red-50 border border-red-200 rounded-lg">
                Target: <strong>{formatMoney(systemTotalAdjustedCost)}</strong>
              </div>
            </div>

            {/* MAIN INVOICE INPUTS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <Label>Số Hóa Đơn</Label>
                <Input
                  value={localCharge.invoice}
                  onChange={(e) => handleLocalChargeChange("invoice", e.target.value)}
                />
              </div>

              <div>
                <Label>Ngày Hóa Đơn</Label>
                <DateInput
                  value={localCharge.date}
                  onChange={(e) => handleLocalChargeChange("date", e.target.value)}
                />
              </div>

              <div>
                <Label>Net</Label>
                <Input
                  type="number"
                  value={localCharge.net}
                  onChange={(e) => handleLocalChargeChange("net", Number(e.target.value))}
                  className="text-right font-semibold"
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

            {/* ===================================================== */}
            {/* FILE UPLOAD — ALREADY FIXED */}
            {/* ===================================================== */}
            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border">

                <div className="flex items-center gap-3">
                  <input type="file"
                         ref={fileInputRef}
                         className="hidden"
                         onChange={handleFileSelect}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border px-3 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2"
                  >
                    <FileUp className="w-4 h-4 text-blue-500" />
                    Chọn File HĐ
                  </button>

                  {selectedFile ? (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {selectedFile.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa chọn file</span>
                  )}
                </div>

                {/* BUTTON UPLOAD */}
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUploadFile}
                      disabled={isUploading}
                      className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <HardDrive className="w-4 h-4" />
                      )}
                      Lưu vào Server
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="bg-white border px-3 py-2 rounded-lg text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>

              {/* WARNING TARGET */}
              {(localCharge.net + totalAdditionalNet) !== systemTotalAdjustedCost && (
                <div className="mt-4 bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  Tổng Net khác Target!
                </div>
              )}
            </div>
          </div>


          {/* ===================================================== */}
          {/* SECTION 3 — DEPOSIT (CƯỢC CONT) */}
          {/* ===================================================== */}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-red-600 flex items-center">
                <Anchor className="w-4 h-4 mr-2" />
                Cược Cont (Deposit)
              </h3>

              <button
                onClick={() => setDeposits(prev => [...prev, {
                  id: Date.now().toString(),
                  amount: 0,
                  dateOut: "",
                  dateIn: ""
                }])}
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Thêm Cược
              </button>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b text-red-700">
                  <tr>
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2 text-right">Tiền Cược</th>
                    <th className="px-3 py-2">Ngày Cược</th>
                    <th className="px-3 py-2">Ngày Hoàn</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {deposits.map(dp => (
                    <tr key={dp.id} className="hover:bg-red-50/50">
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setDeposits(prev => prev.filter(x => x.id !== dp.id))}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>

                      <td className="px-3 py-2">
                        <Input
                          value={dp.amount}
                          type="number"
                          onChange={(e) =>
                            setDeposits(prev =>
                              prev.map(x => x.id === dp.id ? { ...x, amount: Number(e.target.value) } : x)
                            )
                          }
                          className="text-right font-semibold"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <DateInput
                          value={dp.dateOut}
                          onChange={(e) =>
                            setDeposits(prev =>
                              prev.map(x => x.id === dp.id ? { ...x, dateOut: e.target.value } : x)
                            )
                          }
                        />
                      </td>

                      <td className="px-3 py-2">
                        <DateInput
                          value={dp.dateIn}
                          onChange={(e) =>
                            setDeposits(prev =>
                              prev.map(x => x.id === dp.id ? { ...x, dateIn: e.target.value } : x)
                            )
                          }
                        />
                      </td>

                    </tr>
                  ))}

                  {deposits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                        Chưa có cược cho booking này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-right text-sm font-bold text-red-600">
              Tổng Cược: {formatMoney(totalDeposit)}
            </div>
          </div>


          {/* ===================================================== */}
          {/* SECTION 4 — SUMMARY */}
          {/* ===================================================== */}

          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">

            {/* VAT Toggle */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-blue-200 flex items-center">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Tổng Hợp Booking
              </h3>

              <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setVatMode("pre")}
                  className={`px-3 py-1 text-xs rounded-md font-bold ${
                    vatMode === "pre"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Trước VAT
                </button>

                <button
                  onClick={() => setVatMode("post")}
                  className={`px-3 py-1 text-xs rounded-md font-bold ${
                    vatMode === "post"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sau VAT
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2 text-left">Khoản Mục</th>
                  <th className="py-2 text-right">Tổng Thu</th>
                  <th className="py-2 text-right">Tổng Chi</th>
                  <th className="py-2 text-right">Lợi Nhuận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">

                {/* Local Charge */}
                <tr>
                  <td className="py-3">Local Charge</td>
                  <td className="py-3 text-right text-green-400">{formatMoney(summaryLocalChargeRevenue)}</td>
                  <td className="py-3 text-right text-red-400">{formatMoney(summaryAmountExpense)}</td>
                  <td className="py-3 text-right font-bold">{formatMoney(baseProfit)}</td>
                </tr>

                {/* Extension */}
                <tr>
                  <td className="py-3">Gia Hạn</td>
                  <td className="py-3 text-right text-green-400">{formatMoney(summaryExtensionRevenue)}</td>
                  <td className="py-3 text-right text-red-400">{formatMoney(summaryExtensionExpense)}</td>
                  <td className="py-3 text-right font-bold">{formatMoney(extProfit)}</td>
                </tr>

                {/* Deposit */}
                <tr>
                  <td className="py-3">Cược Cont</td>
                  <td className="py-3 text-right text-slate-500">-</td>
                  <td className="py-3 text-right text-red-400">{formatMoney(totalDeposit)}</td>
                  <td className="py-3 text-right text-slate-500">-</td>
                </tr>

                {/* TOTAL */}
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="py-4 pl-2 uppercase">Tổng Cộng ({booking.jobCount} Jobs)</td>
                  <td className="py-4 text-right text-green-400 text-lg">{formatMoney(totalRevenue)}</td>
                  <td className="py-4 text-right text-red-400 text-lg">{formatMoney(totalCost)}</td>
                  <td className="py-4 text-right text-lg">{formatMoney(totalProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================== */}
        {/* FOOTER */}
        {/* ===================================================== */}
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-xl text-sm font-bold hover:bg-slate-50"
          >
            Đóng
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-900 text-white rounded-xl text-sm font-bold hover:bg-blue-800 shadow"
          >
            <Save className="w-4 h-4 inline mr-2" />
            Lưu Thay Đổi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
