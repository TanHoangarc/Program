
// ============================================================
// PAYMENT PAGE – FULL VERSION (UPDATED PATHS FOR INV & UNC)
// ============================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShippingLine, PaymentRequest, JobData, BookingExtensionCost, Customer, INITIAL_JOB } from '../types';
import { 
  CreditCard, Upload, Plus, CheckCircle, Trash2, 
  Eye, Download, AlertCircle, X, HardDrive, Loader2, Copy, Send, RefreshCw, Banknote, Anchor, Container, FileInput, Save, Search, Check
} from 'lucide-react';
import axios from 'axios';
import { MONTHS, TRANSIT_PORTS } from '../constants';
import { formatDateVN } from '../utils';
import { CustomerModal } from '../components/CustomerModal';

interface PaymentPageProps {
  lines: ShippingLine[];
  requests: PaymentRequest[];
  onUpdateRequests: (reqs: PaymentRequest[]) => void;
  currentUser: { username: string, role: string } | null;
  onSendPending?: (payload?: any) => Promise<void>; 
  jobs?: JobData[];
  onUpdateJob?: (job: JobData) => void;
  onAddJob?: (job: JobData) => void; 
  customers?: Customer[];
  onAddCustomer?: (customer: Customer) => void;
}

// BACKEND API (Cloudflare Tunnel)
const BACKEND_URL = "https://api.kimberry.id.vn";

// Internal Interface for Convert Modal State
interface ConvertJobData {
    month: string;
    booking: string;
    line: string;
    consol: string;
    transit: string;
    
    // Dynamic List of Jobs
    jobRows: {
        id: string;
        jobCode: string;
        customerId: string;   // Moved to Row
        customerName: string; // Moved to Row
        cont20: number;
        cont40: number;
        sell: number;
        cost: number;
        amount: number; // NEW FIELD: Amount (Thực thu / Local Charge Total)
    }[];
}

// --- OPTIMIZED CUSTOMER INPUT COMPONENT ---
const CustomerRowInput = ({ 
    value, 
    customers, 
    onSelect, 
    onChange,
    onAdd
}: { 
    value: string; 
    customers: Customer[]; 
    onSelect: (id: string, name: string) => void;
    onChange: (text: string) => void;
    onAdd?: () => void;
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Efficient Filtering: only slice top 50 matches to prevent rendering lag
    const filtered = useMemo(() => {
        if (!showDropdown) return [];
        const lower = (value || '').toLowerCase();
        return customers
            .filter(c => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower))
            .slice(0, 50); // LIMIT RESULTS
    }, [value, customers, showDropdown]);

    return (
        <div className="relative flex gap-1">
            <input 
                type="text" 
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Chọn KH"
                className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm font-medium text-slate-700"
            />
            {onAdd && (
                <button 
                    type="button"
                    onClick={onAdd}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                    title="Thêm khách hàng mới"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            )}
            
            {showDropdown && (
                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded shadow-xl max-h-60 overflow-y-auto mt-8 left-0">
                    {filtered.length > 0 ? (
                        filtered.map(c => (
                            <li 
                                key={c.id} 
                                onMouseDown={() => {
                                    onSelect(c.id, c.name);
                                    setShowDropdown(false);
                                }}
                                className="px-3 py-2 text-xs cursor-pointer hover:bg-orange-50 border-b border-slate-50 last:border-0"
                            >
                                <div className="font-bold text-orange-700">{c.code}</div>
                                <div className="text-slate-600 truncate">{c.name}</div>
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-xs text-slate-400 italic">Không tìm thấy</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export const PaymentPage: React.FC<PaymentPageProps> = ({
  lines,
  requests,
  onUpdateRequests,
  currentUser,
  onSendPending,
  jobs,
  onUpdateJob,
  onAddJob,
  customers = [],
  onAddCustomer
}) => {

  // ----------------- STATES -----------------
  const [line, setLine] = useState("");
  const [pod, setPod] = useState<'HCM' | 'HPH'>("HCM");
  const [booking, setBooking] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState<'Local Charge' | 'Deposit' | 'Demurrage'>('Local Charge');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncFile, setUncFile] = useState<File | null>(null);
  
  // State for copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- CONVERT MODAL STATE ---
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertData, setConvertData] = useState<ConvertJobData>({
      month: '1', booking: '', line: '', consol: '', transit: 'HCM', jobRows: []
  });
  
  // --- QUICK ADD CUSTOMER IN CONVERT MODAL ---
  const [quickAddRowId, setQuickAddRowId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uncInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // UPLOAD FUNCTION – UPDATED PATHS
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
      const data = res.data;

      // FIX: Ensure URL is valid if backend forgets to send it
      if (!data.url) {
          if (type === "INVOICE") {
             // Correct path for Invoices: E:\ServerData\INV maps to /files/inv
             data.url = `/files/inv/${data.fileName}`;
          } else {
             // Correct path for UNC: E:\ServerData\UNC maps to /files/unc
             data.url = `/files/unc/${data.fileName}`;
          }
      } else if (!data.url.startsWith('/')) {
          data.url = `/${data.url}`;
      }

      return data;
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
      type, // Selected Type
      createdAt: new Date().toISOString(),
      status: "pending",

      invoiceFileName: uploaded?.fileName ?? "",
      invoicePath: uploaded?.serverPath ?? "",
      invoiceUrl: uploaded ? `${BACKEND_URL}${uploaded.url}` : "",
      invoiceBlobUrl: invoiceFile ? URL.createObjectURL(invoiceFile) : ""
    };

    const updatedRequests = [newReq, ...requests];
    onUpdateRequests(updatedRequests);

    // --- AUTO SYNC FOR DOCS ---
    if (currentUser?.role === 'Docs' && onSendPending) {
        const payload = {
            user: currentUser.username,
            timestamp: new Date().toISOString(),
            autoApprove: true, 
            paymentRequests: updatedRequests, 
            jobs: [],
            customers: [],
            lines: []
        };
        onSendPending(payload).catch(err => console.error("Auto-sync failed", err));
    }

    // Reset Form
    setLine("");
    setBooking("");
    setAmount(0);
    setType('Local Charge'); 
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsUploading(false);
  };

  // ============================================================
  // DELETE REQUEST
  // ============================================================

  const handleDelete = (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa?")) return;
    const updatedRequests = requests.filter(r => r.id !== id);
    onUpdateRequests(updatedRequests);
    
    // Auto sync deletion for Docs, Admin, and Manager
    if (['Docs', 'Admin', 'Manager'].includes(currentUser?.role || '') && onSendPending) {
        const payload = {
            user: currentUser.username,
            timestamp: new Date().toISOString(),
            autoApprove: true,
            paymentRequests: updatedRequests,
            jobs: [], customers: [], lines: []
        };
        onSendPending(payload).catch(err => console.error("Delete sync failed", err));
    }
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
      req?.booking || "" 
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
    
    // Auto sync completion for Docs, Admin, and Manager
    if (['Docs', 'Admin', 'Manager'].includes(currentUser?.role || '') && onSendPending) {
        const payload = {
            user: currentUser.username,
            timestamp: new Date().toISOString(),
            autoApprove: true,
            paymentRequests: updated,
            jobs: [], customers: [], lines: []
        };
        onSendPending(payload).catch(err => console.error("Complete sync failed", err));
    }

    setCompletingId(null);
    setIsUploading(false);
  };

  // ============================================================
  // SYNC PAYMENT TO BOOKING (ADMIN ONLY)
  // ============================================================
  
  const handleSyncPayment = (req: PaymentRequest) => {
      if (!jobs || !onUpdateJob) {
          alert("Dữ liệu Job chưa được tải.");
          return;
      }

      // Find jobs associated with this booking
      const associatedJobs = jobs.filter(j => j.booking === req.booking);
      
      if (associatedJobs.length === 0) {
          alert(`Không tìm thấy Job nào có số Booking: ${req.booking}`);
          return;
      }

      const syncType = req.type || 'Local Charge';
      const confirmMsg = `Bạn có muốn đồng bộ số tiền ${formatCurrency(req.amount)} (${syncType}) vào ${associatedJobs.length} Job của Booking ${req.booking}?`;
      
      if (!window.confirm(confirmMsg)) return;

      // Update logic
      associatedJobs.forEach(job => {
          const updatedJob = JSON.parse(JSON.stringify(job)); // Deep copy
          
          if (!updatedJob.bookingCostDetails) {
              updatedJob.bookingCostDetails = {
                  localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0, hasInvoice: false },
                  additionalLocalCharges: [],
                  extensionCosts: [],
                  deposits: []
              };
          }

          if (syncType === 'Local Charge') {
              updatedJob.bookingCostDetails.localCharge.total = req.amount;
              updatedJob.bookingCostDetails.localCharge.hasInvoice = false; 
          } 
          else if (syncType === 'Deposit') {
              updatedJob.bookingCostDetails.deposits.push({
                  id: `dep-${Date.now()}`,
                  amount: req.amount,
                  dateOut: req.completedAt ? new Date(req.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  dateIn: ''
              });
          }
          else if (syncType === 'Demurrage') {
              updatedJob.bookingCostDetails.additionalLocalCharges.push({
                  id: `dem-${Date.now()}`,
                  invoice: '',
                  date: req.completedAt ? new Date(req.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  net: req.amount,
                  vat: 0,
                  total: req.amount,
                  hasInvoice: false 
              });
          }

          onUpdateJob(updatedJob);
      });

      alert("Đã đồng bộ thành công!");
  };

  // ============================================================
  // CONVERT TO JOB MODAL HANDLERS
  // ============================================================

  // Helper check Long Hoang
  const isLongHoang = (name: string) => {
      const n = (name || '').toLowerCase();
      return n.includes('long hoàng') || n.includes('long hoang') || n.includes('lhk') || n.includes('longhoang');
  };

  const handleOpenConvert = (req: PaymentRequest) => {
      setConvertData({
          month: new Date().getMonth() + 1 + '',
          booking: req.booking || '',
          line: req.lineCode || '',
          consol: '',
          transit: req.pod || 'HCM',
          jobRows: [{ 
              id: Date.now().toString(), 
              jobCode: '', 
              customerId: '', 
              customerName: '', 
              cont20: 0, 
              cont40: 0, 
              sell: 0, 
              cost: 0,
              amount: 0 
          }]
      });
      setIsConvertModalOpen(true);
  };

  const handleAddJobRow = () => {
      setConvertData(prev => ({
          ...prev,
          jobRows: [...prev.jobRows, { 
              id: Date.now().toString(), 
              jobCode: '', 
              customerId: '', 
              customerName: '', 
              cont20: 0, 
              cont40: 0, 
              sell: 0, 
              cost: 0,
              amount: 0
          }]
      }));
  };

  const handleRemoveJobRow = (id: string) => {
      setConvertData(prev => ({
          ...prev,
          jobRows: prev.jobRows.filter(r => r.id !== id)
      }));
  };

  const handleJobRowChange = (id: string, field: string, value: any) => {
      setConvertData(prev => ({
          ...prev,
          jobRows: prev.jobRows.map(r => {
              if (r.id !== id) return r;
              
              const updatedRow = { ...r, [field]: value };

              // LOGIC: Long Hoang Auto-fill
              if (field === 'customerName' || field === 'customerId') {
                  // If customer becomes Long Hoang, set amount = sell
                  if (isLongHoang(updatedRow.customerName)) {
                      updatedRow.amount = updatedRow.sell;
                  }
              }
              
              if (field === 'sell') {
                  // If selling price changes AND it is Long Hoang, update amount
                  if (isLongHoang(updatedRow.customerName)) {
                      updatedRow.amount = value;
                  }
              }

              return updatedRow;
          })
      }));
  };

  // --- QUICK CUSTOMER ADD ---
  const handleOpenQuickAddCustomer = (rowId: string) => {
      setQuickAddRowId(rowId);
  };

  const handleSaveQuickCustomer = (newCustomer: Customer) => {
      if (onAddCustomer) onAddCustomer(newCustomer);
      
      if (quickAddRowId) {
          handleJobRowChange(quickAddRowId, 'customerId', newCustomer.id);
          handleJobRowChange(quickAddRowId, 'customerName', newCustomer.name);
      }
      setQuickAddRowId(null);
  };

  const handleSaveConvert = () => {
      if (!onAddJob) return;
      if (!convertData.booking || !convertData.line || convertData.jobRows.length === 0) {
          alert("Vui lòng nhập đầy đủ thông tin bắt buộc (Booking, Line, ít nhất 1 Job).");
          return;
      }

      // Loop and Add Jobs
      let createdCount = 0;
      convertData.jobRows.forEach(row => {
          if (!row.jobCode) return; // Skip empty rows

          const newJob: JobData = {
              ...INITIAL_JOB,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              month: convertData.month,
              jobCode: row.jobCode,
              booking: convertData.booking,
              line: convertData.line,
              customerId: row.customerId,
              customerName: row.customerName,
              consol: convertData.consol,
              transit: convertData.transit,
              cont20: row.cont20,
              cont40: row.cont40,
              sell: row.sell,
              cost: row.cost,
              profit: row.sell - row.cost,
              localChargeTotal: row.amount, // Map Amount to Local Charge Total
          };
          
          // Auto set bank if Long Hoang
          if (isLongHoang(row.customerName)) {
              newJob.bank = 'MB Bank';
          }

          onAddJob(newJob);
          createdCount++;
      });

      setIsConvertModalOpen(false);
      alert(`Đã nhập ${createdCount} Job vào hệ thống thành công!`);
  };

  // ============================================================
  // FILE VIEW + DOWNLOAD - FIXED PATHS
  // ============================================================

  const openFile = (req: PaymentRequest, type: "invoice" | "unc") => {
    let url = type === "invoice" ? req.invoiceUrl : req.uncUrl;
    const fileName = type === "invoice" ? req.invoiceFileName : req.uncFileName;
    
    // Auto-fix broken URLs on the fly using updated paths
    if (url && (url.includes('undefined') || !url.includes('http')) && fileName) {
        if (type === "invoice") {
            // Path: E:\ServerData\INV -> /files/inv
            url = `${BACKEND_URL}/files/inv/${fileName}`;
        } else {
            // Path: E:\ServerData\UNC -> /files/unc
            url = `${BACKEND_URL}/files/unc/${fileName}`;
        }
    }

    if (!url) return alert("Không tìm thấy file!");
    window.open(url, "_blank");
  };

  // Always force download UNC with correct path
  const downloadUNC = async (req: PaymentRequest) => {
    let url = req.uncUrl;
    
    // Fix broken URL on the fly using E:\ServerData\UNC -> /files/unc
    if (url && url.includes('undefined') && req.uncFileName) {
        url = `${BACKEND_URL}/files/unc/${req.uncFileName}`;
    }

    if (!url) {
      alert("Không tìm thấy file UNC!");
      return;
    }

    try {
      const response = await axios.get(url, { responseType: "blob" });

      const finalBlobUrl = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
      );

      const link = document.createElement("a");
      link.href = finalBlobUrl;
      link.download = `UNC BL ${req.booking}.pdf`;

      document.body.appendChild(link);
      link.click();

      URL.revokeObjectURL(finalBlobUrl);
      link.remove();
    } catch {
      alert("Không thể tải UNC. Kiểm tra Server hoặc Cloudflare.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1000);
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  const pendingList = requests.filter(r => r.status === "pending");
  
  // SORT COMPLETED LIST BY DATE DESCENDING
  const completedList = requests
    .filter(r => r.status === "completed")
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

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

  const getTypeBadge = (type?: string) => {
      switch(type) {
          case 'Deposit': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200">Deposit</span>;
          case 'Demurrage': return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200">Demurrage</span>;
          default: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">Local Charge</span>;
      }
  };

  // ============================================================
  // RENDER
  // ============================================================

  // Dynamic grid configuration based on selected Line
  const gridConfig = line === "MSC" ? "md:grid-cols-6" : "md:grid-cols-5";

  return (
    <div className="p-8 w-full h-full flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <CreditCard className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Thanh Toán MBL</h1>
        </div>
        {/* Only show Manual Sync for NON-Docs AND NON-Admin users. Docs sync automatically. Admin doesn't sync upwards. */}
        {currentUser?.role !== 'Docs' && currentUser?.role !== 'Admin' && onSendPending && (
             <button 
                onClick={() => onSendPending()} 
                className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-200 transition-colors flex items-center"
             >
                 <Send className="w-4 h-4 mr-2" /> Đồng bộ Admin
             </button>
        )}
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

          <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold text-slate-700 flex items-center">
                <Plus className="w-4 h-4 mr-2 text-emerald-600" />
                Tạo yêu cầu thanh toán
             </h2>
             <div className="flex space-x-2">
                 <button onClick={() => setType('Local Charge')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${type === 'Local Charge' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}>Local Charge</button>
                 <button onClick={() => setType('Deposit')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${type === 'Deposit' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}>Deposit</button>
                 <button onClick={() => setType('Demurrage')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${type === 'Demurrage' ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}>Demurrage</button>
             </div>
          </div>

          <form onSubmit={handleCreateRequest} className={`grid grid-cols-1 ${gridConfig} gap-4 items-end`}>

            {/* Line */}
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

            {/* MSC POD - Conditional */}
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

            {/* Booking */}
            <div className="w-full">
              <label className="block text-[10px] font-bold mb-1.5 text-slate-600">Booking</label>
              <input
                value={booking}
                onChange={e => setBooking(e.target.value)}
                className="glass-input w-full px-3 rounded-xl h-11 text-sm font-medium focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                placeholder="Nhập Booking..."
              />
            </div>

            {/* Amount */}
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
            
            {/* Type Display (Readonly visual) */}
            <div className="w-full hidden md:block">
                <label className="block text-[10px] font-bold mb-1.5 text-slate-600">Loại chi</label>
                <div className="flex items-center h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">
                    {type === 'Local Charge' && <Banknote className="w-4 h-4 mr-2 text-blue-500" />}
                    {type === 'Deposit' && <Anchor className="w-4 h-4 mr-2 text-purple-500" />}
                    {type === 'Demurrage' && <Container className="w-4 h-4 mr-2 text-orange-500" />}
                    {type}
                </div>
            </div>

            {/* Buttons */}
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
                <th className="px-6 py-3 text-center">Loại chi</th>
                <th className="px-6 py-3 text-center">File</th>
                <th className="px-6 py-3 text-center">Chức năng</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {pendingList.map(req => (
                <tr key={req.id} className="hover:bg-white/40 group">

                  <td className="px-6 py-4">{getLineDisplay(req)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span>{req.booking}</span>
                      {currentUser?.role === 'Admin' && (
                        <button 
                          onClick={() => {
                              const typeStr = req.type === 'Deposit' ? 'CUOC' : req.type === 'Demurrage' ? 'GH' : 'PAYMENT';
                              copyToClipboard(`LONG HOANG ${typeStr} BL ${req.booking} MST 0316113070`, `bk-${req.id}`);
                          }}
                          className={`p-1 rounded-full transition-colors ${copiedId === `bk-${req.id}` ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                          title="Copy nội dung chuyển khoản"
                        >
                          {copiedId === `bk-${req.id}` ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right font-bold text-red-600">
                    <div className="flex items-center justify-end space-x-2">
                        <span>{formatCurrency(req.amount)}</span>
                        {currentUser?.role === 'Admin' && (
                            <button 
                                onClick={() => copyToClipboard(String(req.amount), `amt-${req.id}`)}
                                className={`p-1 rounded-full transition-colors ${copiedId === `amt-${req.id}` ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                                title="Copy số tiền (không dấu)"
                            >
                                {copiedId === `amt-${req.id}` ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-center">
                      {getTypeBadge(req.type)}
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

                      <button
                        onClick={() => handleDelete(req.id)}
                        className="bg-red-50 text-red-600 p-2 rounded-lg border hover:bg-red-100 transition-colors"
                        title="Xóa yêu cầu"
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
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
              {completedList.length}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-white/40 text-slate-600 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-3">Mã Line</th>
                <th className="px-6 py-3">Booking</th>
                <th className="px-6 py-3">Ngày TT</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                <th className="px-6 py-3 text-center">Loại chi</th>
                <th className="px-6 py-3 text-center">UNC File</th>
                <th className="px-6 py-3 text-center">Chức năng</th>
              </tr>
            </thead>

            <tbody className="divide-y">

              {completedList.map(req => (
                <tr key={req.id} className="hover:bg-white/40">

                  <td className="px-6 py-4">{getLineDisplay(req)}</td>
                  <td className="px-6 py-4">{req.booking}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                      {req.completedAt ? formatDateVN(req.completedAt.split('T')[0]) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">{formatCurrency(req.amount)}</td>
                  
                  <td className="px-6 py-4 text-center">
                      {getTypeBadge(req.type)}
                  </td>

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
                      
                      {/* Convert to Job Button */}
                      <button
                        onClick={() => handleOpenConvert(req)}
                        className="text-orange-600 p-2 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 transition-colors"
                        title="Nhập vào Job"
                      >
                        <FileInput className="w-4 h-4" />
                      </button>

                      {/* Sync Button */}
                      <button
                        onClick={() => handleSyncPayment(req)}
                        className="text-teal-600 p-2 bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100 transition-colors"
                        title="Đồng bộ vào Booking (Cũ)"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

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

                      <button
                        onClick={() => handleDelete(req.id)}
                        className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
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
                File sẽ được lưu vào Server Storage (E:\ServerData\UNC)
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

      {/* MODAL: CONVERT PAYMENT TO JOB */}
      {isConvertModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col border border-white/50 animate-in zoom-in-95">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-orange-50 rounded-t-2xl">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shadow-sm border border-orange-200">
                            <Container className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Nhập Job từ Thanh toán</h2>
                            <p className="text-xs text-slate-500 font-medium">Tạo Job mới dựa trên thông tin Booking</p>
                        </div>
                    </div>
                    <button onClick={() => setIsConvertModalOpen(false)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {/* Common Info Section */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-5">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Thông tin chung (Booking)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Tháng</label>
                                <select 
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    value={convertData.month}
                                    onChange={(e) => setConvertData(prev => ({...prev, month: e.target.value}))}
                                >
                                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Booking</label>
                                <input 
                                    type="text" 
                                    value={convertData.booking}
                                    onChange={(e) => setConvertData(prev => ({...prev, booking: e.target.value}))}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Line</label>
                                <select
                                    value={convertData.line}
                                    onChange={e => setConvertData(prev => ({...prev, line: e.target.value}))}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">-- Chọn Line --</option>
                                    {lines.map(l => (
                                        <option key={l.id} value={l.code}>{l.code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Consol</label>
                                <input 
                                    type="text" 
                                    value={convertData.consol}
                                    onChange={(e) => setConvertData(prev => ({...prev, consol: e.target.value}))}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Transit</label>
                                <select
                                    value={convertData.transit}
                                    onChange={e => setConvertData(prev => ({...prev, transit: e.target.value}))}
                                    className="w-full p-2 bg-slate-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Job List Section */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết Job (Container)</h3>
                            <button onClick={handleAddJobRow} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 transition-colors flex items-center">
                                <Plus className="w-3 h-3 mr-1" /> Thêm dòng
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto min-h-[200px]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2 w-48">Job Code</th>
                                        <th className="px-3 py-2 flex-1">Khách hàng</th>
                                        <th className="px-3 py-2 w-20 text-center">20'</th>
                                        <th className="px-3 py-2 w-20 text-center">40'</th>
                                        <th className="px-3 py-2 w-32 text-right">Sell</th>
                                        <th className="px-3 py-2 w-32 text-right">Cost</th>
                                        <th className="px-3 py-2 w-32 text-right">Amount</th>
                                        <th className="px-3 py-2 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {convertData.jobRows.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td className="px-3 py-2">
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={row.jobCode}
                                                        onChange={(e) => handleJobRowChange(row.id, 'jobCode', e.target.value)}
                                                        placeholder="Nhập Job Code"
                                                        className="w-full p-1.5 pr-8 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm font-bold text-slate-700"
                                                    />
                                                    <button 
                                                        onClick={() => copyToClipboard(row.jobCode, `jobcode-${row.id}`)}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Copy Job Code"
                                                    >
                                                        {copiedId === `jobcode-${row.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <CustomerRowInput 
                                                    value={row.customerName}
                                                    customers={customers}
                                                    onChange={(text) => {
                                                        handleJobRowChange(row.id, 'customerId', '');
                                                        handleJobRowChange(row.id, 'customerName', text);
                                                    }}
                                                    onSelect={(id, name) => {
                                                        handleJobRowChange(row.id, 'customerId', id);
                                                        handleJobRowChange(row.id, 'customerName', name);
                                                    }}
                                                    onAdd={() => handleOpenQuickAddCustomer(row.id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="number" min="0"
                                                    value={row.cont20}
                                                    onChange={(e) => handleJobRowChange(row.id, 'cont20', Number(e.target.value))}
                                                    className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-center text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="number" min="0"
                                                    value={row.cont40}
                                                    onChange={(e) => handleJobRowChange(row.id, 'cont40', Number(e.target.value))}
                                                    className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-center text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="text" 
                                                    value={new Intl.NumberFormat('en-US').format(row.sell)}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value.replace(/,/g, ''));
                                                        if(!isNaN(val)) handleJobRowChange(row.id, 'sell', val);
                                                    }}
                                                    className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-right text-sm font-medium text-blue-600"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="text" 
                                                    value={new Intl.NumberFormat('en-US').format(row.cost)}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value.replace(/,/g, ''));
                                                        if(!isNaN(val)) handleJobRowChange(row.id, 'cost', val);
                                                    }}
                                                    className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-right text-sm font-medium text-red-600"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="text" 
                                                    value={new Intl.NumberFormat('en-US').format(row.amount)}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value.replace(/,/g, ''));
                                                        if(!isNaN(val)) handleJobRowChange(row.id, 'amount', val);
                                                    }}
                                                    className="w-full p-1.5 border rounded focus:ring-1 focus:ring-orange-500 outline-none text-right text-sm font-bold text-green-600"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {convertData.jobRows.length > 1 && (
                                                    <button onClick={() => handleRemoveJobRow(row.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
                    <button onClick={() => setIsConvertModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSaveConvert} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
                        <Save className="w-4 h-4 mr-2" /> Lưu / Nhập Job
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Customer Modal for Quick Add */}
      <CustomerModal 
          isOpen={!!quickAddRowId} 
          onClose={() => setQuickAddRowId(null)} 
          onSave={handleSaveQuickCustomer} 
      />

    </div>
  );
};
