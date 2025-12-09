// ============================================================
// PAYMENT PAGE – FINAL FULL VERSION (FIX UNKNOWN + NEW PATHS)
// ============================================================

import React, { useState, useRef } from 'react';
import { ShippingLine, PaymentRequest } from '../types';
import { 
  CreditCard, Upload, Plus, CheckCircle, Trash2, 
  Eye, Download, AlertCircle, X, HardDrive, Loader2 
} from 'lucide-react';
import axios from 'axios';

interface PaymentPageProps {
  lines: ShippingLine[];
  requests: PaymentRequest[];
  onUpdateRequests: (reqs: PaymentRequest[]) => void;
  currentUser: { username: string, role: string } | null;
}

// BACKEND API (Cloudflare Tunnel)
const BACKEND_URL = "https://api.kimberry.id.vn";

export const PaymentPage: React.FC<PaymentPageProps> = ({
  lines,
  requests,
  onUpdateRequests,
  currentUser
}) => {

  // ----------------- STATES -----------------
  const [line, setLine] = useState("");
  const [pod, setPod] = useState<'HCM' | 'HPH'>("HCM");
  const [booking, setBooking] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncFile, setUncFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uncInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // UPLOAD FUNCTION – FIXED (always uses bookingFromRequest)
  // ============================================================

  const uploadToServer = async (
    file: File,
    type: "INVOICE" | "UNC",
    bookingFromReq: string
  ) => {
    const formData = new FormData();
    const ext = file.name.split(".").pop() || "pdf";

    const safeBooking =
      (bookingFromReq || "").replace(/[^a-zA-Z0-9]/g, "") || "UNKNOWN";

    // NEW FILE NAMING
    const fileName =
      type === "UNC"
        ? `UNC BL ${safeBooking}.${ext}`
        : `INV_${safeBooking}_${Date.now()}.${ext}`;

    formData.append("fileName", fileName);
    formData.append("file", file);

    const endpoint = type === "INVOICE" ? "/upload-invoice" : "/upload-unc";

    try {
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, formData);
      return res.data;
    } catch (err) {
      alert("Không thể upload file. Kiểm tra server.");
      return null;
    }
  };

  // ============================================================
  // CREATE PAYMENT REQUEST
  // ============================================================

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!line || !booking || !amount) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    setIsUploading(true);

    let uploaded = null;
    if (invoiceFile) {
      uploaded = await uploadToServer(invoiceFile, "INVOICE", booking);
      if (!uploaded) {
        setIsUploading(false);
        return;
      }
    }

    const newReq: PaymentRequest = {
      id: Date.now().toString(),
      lineCode: line,
      pod: line === "MSC" ? pod : undefined,
      booking,
      amount,
      createdAt: new Date().toISOString(),
      status: "pending",

      invoiceFileName: uploaded?.fileName ?? "",
      invoicePath: uploaded?.serverPath ?? "",
      invoiceUrl: uploaded ? `${BACKEND_URL}${uploaded.url}` : "",
      invoiceBlobUrl: invoiceFile ? URL.createObjectURL(invoiceFile) : ""
    };

    onUpdateRequests([newReq, ...requests]);

    // Reset Form
    setLine("");
    setBooking("");
    setAmount(0);
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsUploading(false);
  };

  // ============================================================
  // DELETE REQUEST
  // ============================================================

  const handleDelete = (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa?")) return;
    onUpdateRequests(requests.filter(r => r.id !== id));
  };

  // ============================================================
  // COMPLETE → UPLOAD UNC
  // ============================================================

  const initiateComplete = (id: string) => {
    setCompletingId(id);
    setUncFile(null);
  };

  const confirmComplete = async () => {
    if (!completingId || !uncFile) {
      alert("Vui lòng chọn file UNC.");
      return;
    }

    setIsUploading(true);

    const req = requests.find(r => r.id === completingId);
    const uploaded = await uploadToServer(
      uncFile,
      "UNC",
      req?.booking || "" // 🔥 FIX: always correct booking
    );

    if (!uploaded) {
      setIsUploading(false);
      return;
    }

    const updated = requests.map(r =>
      r.id === completingId
        ? ({
            ...r,
            status: "completed",
            uncFileName: uploaded.fileName,
            uncPath: uploaded.serverPath,
            uncUrl: `${BACKEND_URL}${uploaded.url}`,
            uncBlobUrl: URL.createObjectURL(uncFile),
            completedAt: new Date().toISOString()
          } as PaymentRequest)
        : r
    );

    onUpdateRequests(updated);
    setCompletingId(null);
    setIsUploading(false);
  };

  // ============================================================
  // FILE VIEW + DOWNLOAD
  // ============================================================

  const openFile = (req: PaymentRequest, type: "invoice" | "unc") => {
    const url = type === "invoice" ? req.invoiceUrl : req.uncUrl;
    if (!url) return alert("Không tìm thấy file!");
    window.open(url, "_blank");
  };

  // Always force download UNC
  const downloadUNC = async (req: PaymentRequest) => {
    if (!req.uncUrl) {
      alert("Không tìm thấy file UNC!");
      return;
    }

    try {
      const response = await axios.get(req.uncUrl, { responseType: "blob" });

      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = `UNC BL ${req.booking}.pdf`;

      document.body.appendChild(link);
      link.click();

      URL.revokeObjectURL(url);
      link.remove();
    } catch {
      alert("Không thể tải UNC. Kiểm tra Server hoặc Cloudflare.");
    }
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  const pendingList = requests.filter(r => r.status === "pending");
  const completedList = requests.filter(r => r.status === "completed");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(v);

  const getLineDisplay = (req: PaymentRequest) =>
    req.lineCode === "MSC" ? (
      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
        MSC-{req.pod}
      </span>
    ) : (
      <span className="font-bold">{req.lineCode}</span>
    );

  // ============================================================
  // RENDER
  // ============================================================

  // Dynamic grid configuration based on selected Line
  const gridConfig = line === "MSC" ? "md:grid-cols-5" : "md:grid-cols-4";

  return (
    <div className="p-8 w-full h-full flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center mb-6 space-x-3">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
          <CreditCard className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Thanh Toán MBL</h1>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 space-y-10">

        {/* FORM */}
        <div className="glass-panel p-6 rounded-2xl border relative">

          {isUploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl z-20">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          )}

          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
            <Plus className="w-4 h-4 mr-2 text-emerald-600" />
            Tạo yêu cầu thanh toán
          </h2>

          <form onSubmit={handleCreateRequest} className={`grid grid-cols-1 ${gridConfig} gap-4 items-end`}>

            {/* Line - Column 1 */}
            <div className="w-full">
              <label className="block text-[10px] font-bold mb-1.5 text-slate-600">Mã Line</label>
              <select
                value={line}
                onChange={e => setLine(e.target.value)}
                className="glass-input w-full px-3 rounded-xl h-11 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Chọn Line --</option>
                {lines.map(l => (
                  <option key={l.id} value={l.code}>{l.code}</option>
                ))}
              </select>
            </div>

            {/* MSC POD - Column 2 (Conditional) */}
            {line === "MSC" && (
              <div className="w-full animate-in fade-in zoom-in-95 duration-200">
                <label className="block text-[10px] font-bold mb-1.5 text-blue-600">POD (MSC)</label>
                <div className="flex bg-white rounded-xl border p-1 h-11 items-center">
                  <button
                    type="button"
                    onClick={() => setPod("HCM")}
                    className={`flex-1 h-full rounded-lg text-xs font-bold transition-all ${
                      pod === "HCM" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    HCM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPod("HPH")}
                    className={`flex-1 h-full rounded-lg text-xs font-bold transition-all ${
                      pod === "HPH" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    HPH
                  </button>
                </div>
              </div>
            )}

            {/* Booking - Column 2 or 3 */}
            <div className="w-full">
              <label className="block text-[10px] font-bold mb-1.5 text-slate-600">Booking</label>
              <input
                value={booking}
                onChange={e => setBooking(e.target.value)}
                className="glass-input w-full px-3 rounded-xl h-11 text-sm font-medium focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                placeholder="Nhập Booking..."
              />
            </div>

            {/* Amount - Column 3 or 4 */}
            <div className="w-full">
              <label className="block text-[10px] font-bold mb-1.5 text-slate-600">Số tiền</label>
              <input
                value={amount ? new Intl.NumberFormat().format(amount) : ""}
                onChange={e => {
                  const v = Number(e.target.value.replace(/,/g, ""));
                  if (!isNaN(v)) setAmount(v);
                }}
                className="glass-input w-full px-3 rounded-xl h-11 text-sm text-right font-bold text-red-600 focus:ring-2 focus:ring-emerald-500 placeholder-slate-300"
                placeholder="0"
              />
            </div>

            {/* Buttons - Column 4 or 5 */}
            <div className="flex items-center space-x-2 h-11">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setInvoiceFile(e.target.files[0]);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 h-full rounded-xl border text-xs font-bold transition-colors flex items-center justify-center
                  ${invoiceFile 
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {invoiceFile ? (
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                {invoiceFile ? "Đã chọn" : "Up HĐ"}
              </button>

              <button
                type="submit"
                disabled={isUploading}
                className="h-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center min-w-[80px]"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Tạo"
                )}
              </button>
            </div>

          </form>
        </div>

        {/* PENDING LIST */}
        <div className="glass-panel rounded-2xl overflow-hidden border">

          <div className="bg-orange-50 px-6 py-4 flex justify-between items-center">
            <h3 className="font-bold uppercase text-orange-800 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" /> Danh sách chờ thanh toán
            </h3>
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">
              {pendingList.length}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-white/40 text-slate-600 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-3">Mã Line</th>
                <th className="px-6 py-3">Booking</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                <th className="px-6 py-3 text-center">File</th>
                <th className="px-6 py-3 text-center">Chức năng</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {pendingList.map(req => (
                <tr key={req.id} className="hover:bg-white/40">

                  <td className="px-6 py-4">{getLineDisplay(req)}</td>
                  <td className="px-6 py-4">{req.booking}</td>

                  <td className="px-6 py-4 text-right font-bold text-red-600">
                    {formatCurrency(req.amount)}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => openFile(req, "invoice")}
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border text-xs hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-3 h-3 inline mr-1" /> Xem
                    </button>
                    <div className="text-[9px] text-slate-400 mt-1 max-w-[150px] mx-auto truncate">
                      {req.invoiceFileName}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => initiateComplete(req.id)}
                        className="bg-emerald-100 text-emerald-700 p-2 rounded-lg hover:bg-emerald-200 transition-colors"
                        title="Hoàn tất & Up UNC"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>

                      {currentUser?.role !== 'Docs' && (
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="bg-red-50 text-red-600 p-2 rounded-lg border hover:bg-red-100 transition-colors"
                          title="Xóa yêu cầu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>

        </div>

        {/* COMPLETED LIST */}
        <div className="glass-panel rounded-2xl overflow-hidden border">

          <div className="bg-emerald-50 px-6 py-4 flex justify-between items-center">
            <h3 className="font-bold uppercase text-emerald-800 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" /> Danh sách đã thanh toán
            </h3>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
              {completedList.length}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-white/40 text-slate-600 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-3">Mã Line</th>
                <th className="px-6 py-3">Booking</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                <th className="px-6 py-3 text-center">UNC File</th>
                <th className="px-6 py-3 text-center">Chức năng</th>
              </tr>
            </thead>

            <tbody className="divide-y">

              {completedList.map(req => (
                <tr key={req.id} className="hover:bg-white/40">

                  <td className="px-6 py-4">{getLineDisplay(req)}</td>
                  <td className="px-6 py-4">{req.booking}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(req.amount)}</td>

                  <td className="px-6 py-4 text-center">
                    <div
                      onClick={() => openFile(req, "unc")}
                      className="cursor-pointer bg-slate-50 border px-2 py-1 rounded flex items-center justify-center hover:bg-slate-100 transition-colors"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-purple-600 mr-1" />
                      <span className="text-xs font-mono">Xem UNC</span>
                    </div>

                    <div className="text-[9px] text-slate-400 mt-1 max-w-[150px] mx-auto truncate">
                      {req.uncFileName}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center space-x-2">

                      <button
                        onClick={() => openFile(req, "invoice")}
                        className="text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Xem Hóa Đơn"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => downloadUNC(req)}
                        className="text-purple-700 p-2 bg-purple-50 rounded-lg border hover:bg-purple-100 transition-colors"
                        title="Tải về UNC"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {currentUser?.role !== 'Docs' && (
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>
                  </td>

                </tr>
              ))}

            </tbody>
          </table>

        </div>

      </div>

      {/* MODAL UPLOAD UNC */}
      {completingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">

            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl z-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            )}

            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Hoàn tất thanh toán</h3>
              <button onClick={() => setCompletingId(null)}>
                <X className="w-6 h-6 text-slate-500 hover:text-red-500" />
              </button>
            </div>

            <div
              className="border-dashed border-2 border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => uncInputRef.current?.click()}
            >
              <input
                type="file"
                ref={uncInputRef}
                className="hidden"
                onChange={e => {
                  if (e.target.files) setUncFile(e.target.files[0]);
                }}
              />

              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />

              <p className="font-bold text-slate-700">
                {uncFile ? uncFile.name : "Chọn file UNC"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                File sẽ được lưu vào Server Storage
              </p>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setCompletingId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>

              <button
                onClick={confirmComplete}
                disabled={isUploading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg"
              >
                Xác nhận
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};