// ============================================================
// PAYMENT PAGE – FULL FIXED VERSION (NO MORE UNKNOWN)
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
}

// Cloudflare backend
const BACKEND_URL = "https://api.kimberry.id.vn";

export const PaymentPage: React.FC<PaymentPageProps> = ({ lines, requests, onUpdateRequests }) => {

  // ----------------- FORM STATE -----------------
  const [line, setLine] = useState('');
  const [pod, setPod] = useState<'HCM' | 'HPH'>('HCM');
  const [booking, setBooking] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  // Modal upload UNC
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncFile, setUncFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uncInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // UPLOAD FUNCTION – FIXED FOR UNC BOOKING
  // ============================================================

  const uploadToServer = async (
    file: File,
    type: "INVOICE" | "UNC",
    bookingFromReq: string = ""
  ) => {
    const formData = new FormData();
    const ext = file.name.split(".").pop() || "pdf";

    const safeBooking = 
      (bookingFromReq || "")
        .replace(/[^a-zA-Z0-9]/g, "") || "UNKNOWN";

    let safeName = "";

    if (type === "UNC") {
      safeName = `UNC BL ${safeBooking}.${ext}`;
    } else {
      safeName = `INV_${safeBooking}_${Date.now()}.${ext}`;
    }

    formData.append("fileName", safeName);
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
  // TẠO YÊU CẦU THANH TOÁN
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
      invoiceBlobUrl: invoiceFile ? URL.createObjectURL(invoiceFile) : "",
    };

    onUpdateRequests([newReq, ...requests]);

    // Reset form
    setLine('');
    setBooking('');
    setAmount(0);
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(false);
  };

  // ============================================================
  // DELETE REQUEST
  // ============================================================

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn chắc chắn muốn xóa?")) {
      onUpdateRequests(requests.filter(r => r.id !== id));
    }
  };

  // ============================================================
  // HOÀN TẤT – UPLOAD UNC
  // ============================================================

  const initiateComplete = (id: string) => {
    setCompletingId(id);
    setUncFile(null);
  };

  const confirmComplete = async () => {
    if (!completingId) return;
    if (!uncFile) {
      alert("Vui lòng chọn file UNC.");
      return;
    }

    setIsUploading(true);

    const req = requests.find(r => r.id === completingId);

    const uploaded = await uploadToServer(
      uncFile,
      "UNC",
      req?.booking || "" // <-- FIXED: always use booking of item, not form
    );

    if (!uploaded) {
      setIsUploading(false);
      return;
    }

    const updated = requests.map(r => {
      if (r.id === completingId) {
        return {
          ...r,
          status: "completed",
          uncFileName: uploaded.fileName,
          uncPath: uploaded.serverPath,
          uncUrl: `${BACKEND_URL}${uploaded.url}`,
          uncBlobUrl: URL.createObjectURL(uncFile),
          completedAt: new Date().toISOString()
        };
      }
      return r;
    });

    onUpdateRequests(updated);
    setCompletingId(null);
    setIsUploading(false);
  };

  // ============================================================
  // FILE VIEW + DOWNLOAD
  // ============================================================

  const openFile = (req: PaymentRequest, type: "invoice" | "unc") => {
    const url = type === "invoice" ? req.invoiceUrl : req.uncUrl;

    if (!url) {
      alert("Không tìm thấy file!");
      return;
    }
    window.open(url, "_blank");
  };

  // Always download UNC
  const downloadUNC = async (req: PaymentRequest) => {
    if (!req.uncUrl) {
      alert("Không tìm thấy file UNC!");
      return;
    }
  
    try {
      const response = await axios.get(req.uncUrl, {
        responseType: "blob"
      });
  
      const fileBlob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(fileBlob);
  
      const link = document.createElement("a");
      link.href = url;
      link.download = `UNC BL ${req.booking}.pdf`;
  
      document.body.appendChild(link);
      link.click();
  
      URL.revokeObjectURL(url);
      link.remove();
    } catch (e) {
      alert("Không thể tải UNC. Kiểm tra server hoặc Cloudflare Tunnel.");
    }
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  const pendingList = requests.filter(r => r.status === "pending");
  const completedList = requests.filter(r => r.status === "completed");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

  const getLineDisplay = (req: PaymentRequest) => {
    if (req.lineCode === "MSC") {
      return (
        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
          MSC-{req.pod}
        </span>
      );
    }
    return <span className="font-bold">{req.lineCode}</span>;
  };

  // =================================================================================
  // UI RENDER
  // =================================================================================

  return (
    <div className="p-8 w-full h-full flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center mb-6 space-x-3">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
          <CreditCard className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Thanh Toán MBL</h1>
      </div>

      {/* CONTENT SCROLL */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 space-y-10">

        {/* FORM */}
        <div className="glass-panel p-6 rounded-2xl border relative">

          {isUploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          )}

          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
            <Plus className="w-4 h-4 mr-2 text-emerald-600" /> Tạo yêu cầu thanh toán
          </h2>

          <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-5 gap-6">

            {/* Line */}
            <div>
              <label className="text-[10px] font-bold text-slate-500">Mã Line</label>
              <select 
                value={line} 
                onChange={e => setLine(e.target.value)}
                className="glass-input w-full p-2.5 rounded-xl"
              >
                <option value="">-- Chọn Line --</option>
                {lines.map(l => (
                  <option key={l.id} value={l.code}>{l.code}</option>
                ))}
              </select>
            </div>

            {/* MSC POD */}
            {line === "MSC" ? (
              <div>
                <label className="text-[10px] font-bold text-blue-500">POD (MSC)</label>
                <div className="flex bg-white rounded-xl border p-1">
                  <button 
                    type="button"
                    onClick={() => setPod("HCM")}
                    className={`flex-1 py-1.5 rounded-lg ${pod === "HCM"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600"}`}
                  >
                    HCM
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPod("HPH")}
                    className={`flex-1 py-1.5 rounded-lg ${pod === "HPH"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600"}`}
                  >
                    HPH
                  </button>
                </div>
              </div>
            ) : <div />}

            {/* Booking */}
            <div>
              <label className="text-[10px] font-bold text-slate-500">Booking</label>
              <input
                value={booking}
                onChange={e => setBooking(e.target.value)}
                className="glass-input w-full p-2.5 rounded-xl"
                placeholder="Nhập Booking..."
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] font-bold text-slate-500">Số tiền</label>
              <input
                value={amount ? new Intl.NumberFormat().format(amount) : ""}
                onChange={e => {
                  const v = Number(e.target.value.replace(/,/g, ""));
                  if (!isNaN(v)) setAmount(v);
                }}
                className="glass-input w-full p-2.5 rounded-xl text-right text-red-600 font-bold"
                placeholder="0"
              />
            </div>

            {/* Upload Invoice */}
            <div className="flex space-x-2 items-center">
              <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                if (e.target.files && e.target.files[0]) setInvoiceFile(e.target.files[0]);
              }} />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center
                  ${invoiceFile ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300"}`}
              >
                {invoiceFile ? <CheckCircle className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {invoiceFile ? "Đã chọn HĐ" : "Up Hóa Đơn"}
              </button>

              <button 
                type="submit"
                disabled={isUploading}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tạo"}
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
            <span className="bg-orange-100 px-2 py-0.5 rounded text-orange-700 text-xs font-bold">
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
                  <td className="px-6 py-4 text-right text-red-600 font-bold">
                    {formatCurrency(req.amount)}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => openFile(req, "invoice")} 
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border"
                    >
                      <Eye className="w-3 h-3 inline mr-1" /> Xem
                    </button>
                    <div className="text-[9px] text-slate-400 mt-1">{req.invoiceFileName}</div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center space-x-2">
                      <button 
                        onClick={() => initiateComplete(req.id)}
                        className="bg-emerald-100 text-emerald-700 p-2 rounded-lg"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleDelete(req.id)}
                        className="bg-red-50 text-red-600 p-2 rounded-lg border"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            <span className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 text-xs font-bold">
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
                      className="cursor-pointer bg-slate-50 border px-2 py-1 rounded flex items-center justify-center"
                    >
                      <HardDrive className="w-4 h-4 text-purple-600 mr-1" />
                      <span className="text-xs font-mono">Xem UNC</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1">{req.uncFileName}</div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center space-x-2">
                      <button 
                        onClick={() => openFile(req, "invoice")}
                        className="text-blue-600 p-2"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Always download UNC */}
                      <button 
                        onClick={() => downloadUNC(req)}
                        className="text-purple-700 p-2 bg-purple-50 rounded border"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleDelete(req.id)}
                        className="text-red-500 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>

      </div>

      {/* MODAL: UPLOAD UNC */}
      {completingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">

            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
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
              className="border-dashed border-2 border-slate-300 rounded-xl p-8 text-center cursor-pointer"
              onClick={() => uncInputRef.current?.click()}
            >
              <input type="file" ref={uncInputRef} className="hidden" onChange={e => {
                if (e.target.files) setUncFile(e.target.files[0]);
              }} />

              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />

              <p className="font-bold">{uncFile ? uncFile.name : "Chọn file UNC"}</p>
              <p className="text-xs text-slate-400">File sẽ được lưu vào Server Storage</p>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={() => setCompletingId(null)}
                className="px-4 py-2 bg-slate-200 rounded-xl font-bold"
              >
                Hủy
              </button>

              <button 
                onClick={confirmComplete}
                disabled={isUploading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold"
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
