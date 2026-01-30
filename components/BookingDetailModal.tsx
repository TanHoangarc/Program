
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BookingSummary, BookingCostDetails, BookingExtensionCost, BookingDeposit } from '../types';
import { Ship, X, Save, Plus, Trash2, LayoutGrid, FileText, Anchor, Copy, Check, Calendar, FileUp, Eye, ExternalLink, Calculator, RefreshCw, Paperclip, Loader2, Sparkles } from 'lucide-react';
import { formatDateVN, parseDateVN } from '../utils';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";

interface BookingDetailModalProps {
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails, shouldClose?: boolean) => void;
  zIndex?: string;
  onViewJob?: (jobId: string) => void;
}

const BACKEND_URL = "https://api.kimberry.id.vn";

// --- COMPACT COMPONENTS ---

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    value={props.value ?? ''}
    className={`w-full px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 
      focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
      disabled:bg-slate-50 disabled:text-slate-400 transition-all h-8 placeholder-slate-300 ${props.className || ''}`}
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
    <div className={`relative w-full h-8 ${className || ''}`}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 
        focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 pr-8 h-full"
      />
      <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center pointer-events-none">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <input 
          type="date"
          value={value || ''}
          onChange={(e) => triggerChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
    </div>
  );
};

const MoneyInput: React.FC<{
  value: number;
  name?: string;
  onChange: (name: string, val: number) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}> = ({ value, name, onChange, readOnly, className, placeholder }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(raw))) {
      onChange(name || '', Number(raw));
    }
  };

  return (
    <input
      type="text"
      value={value === 0 && !readOnly ? '' : new Intl.NumberFormat('en-US').format(value || 0)}
      onChange={handleChange}
      readOnly={readOnly}
      placeholder={placeholder || "0"}
      className={`w-full px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-semibold h-8 ${readOnly ? 'bg-slate-50 text-slate-500' : 'bg-white text-blue-700'} ${className || ''}`}
    />
  );
};

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 ml-0.5 tracking-wide">{children}</label>
);

const SectionHeader = ({ icon: Icon, title, rightContent, color = "text-slate-700" }: any) => (
  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
    <h3 className={`text-xs font-bold uppercase flex items-center ${color}`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" /> {title}
    </h3>
    {rightContent}
  </div>
);

// --- ATTACHMENT ROW COMPONENT ---
const AttachmentRow = ({ 
    hasInvoice, 
    fileUrl, 
    fileName, 
    onUpload, 
    onDelete, 
    isUploading 
}: { 
    hasInvoice?: boolean, 
    fileUrl?: string, 
    fileName?: string, 
    onUpload: () => void, 
    onDelete: () => void,
    isUploading: boolean
}) => {
    if (hasInvoice === false) return null; // Don't show if "Chưa HĐ"

    return (
        <div className="col-span-12 mt-1 px-3 py-1.5 bg-slate-50/50 rounded border border-slate-200 border-dashed flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
                <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                {fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium flex items-center truncate">
                        {fileName || "Xem file đính kèm"}
                    </a>
                ) : (
                    <span className="text-[10px] text-slate-400 italic">Chưa có file đính kèm</span>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {!fileUrl && (
                    <button 
                        type="button"
                        onClick={onUpload}
                        disabled={isUploading}
                        className="text-[10px] bg-white border border-slate-300 px-2 py-0.5 rounded hover:bg-blue-50 text-slate-600 flex items-center transition-colors disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3 mr-1" />}
                        {isUploading ? "Uploading..." : "Đính kèm"}
                    </button>
                )}
                {fileUrl && (
                    <button 
                        type="button" 
                        onClick={onDelete} 
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white"
                        title="Xóa file"
                    >
                        <Trash2 className="w-3 h-3"/>
                    </button>
                )}
            </div>
        </div>
    );
};

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onSave, onViewJob, zIndex }) => {

  const [localCharge, setLocalCharge] = useState({
    ...booking.costDetails.localCharge,
    hasInvoice: booking.costDetails.localCharge.hasInvoice ?? true
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

  // FILE UPLOAD STATE
  const [uploadTarget, setUploadTarget] = useState<{ type: 'MAIN' | 'ADDITIONAL' | 'EXTENSION', id?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // -----------------------------
  // BALANCING LOGIC (DISTRIBUTION)
  // -----------------------------
  
  // 1. Calculate Weights based on estimated Job Costs
  const jobWeights = useMemo(() => {
      return booking.jobs.map(job => {
          const kimberry = (job.cont20 * 250000) + (job.cont40 * 500000);
          const other = (job.feeCic||0) + (job.feePsc||0) + (job.feeEmc||0) + (job.feeOther||0);
          const rawAdj = job.cost - kimberry - other;
          return Math.max(0, rawAdj); 
      });
  }, [booking.jobs]);

  const totalWeight = jobWeights.reduce((a, b) => a + b, 0);
  const systemTotalVatEst = booking.jobs.reduce((s, j) => s + (j.cost * 0.05263), 0);

  // 2. Determine Targets from Form State
  const formNet = localCharge.hasInvoice ? (localCharge.net || 0) : (localCharge.total || 0);
  const formVat = localCharge.hasInvoice ? (localCharge.vat || 0) : 0;

  // Use Form values if present (user entered data), else fallback to System Sums
  // This ensures that when user types in Invoice Net/VAT, the table updates to match exactly.
  const targetNet = formNet > 0 ? formNet : totalWeight;
  const targetVat = (formNet > 0 || formVat > 0) ? formVat : systemTotalVatEst;

  // 3. Distribute Targets to Jobs (Largest Remainder Method)
  const distributedData = useMemo(() => {
      const count = booking.jobs.length;
      if (count === 0) return [];

      const distribute = (total: number, weights: number[], totalW: number) => {
          if (totalW === 0) {
              // If weights are 0, distribute equally (or 0 if total is 0)
              if (total === 0) return Array(count).fill(0);
              const base = Math.floor(total / count);
              const remainder = total - (base * count);
              return Array(count).fill(0).map((_, i) => base + (i < remainder ? 1 : 0));
          }

          const rawShares = weights.map(w => (total * w) / totalW);
          const intShares = rawShares.map(s => Math.floor(s));
          const currentSum = intShares.reduce((a, b) => a + b, 0);
          const diff = total - currentSum;
          
          const decimals = rawShares.map((s, i) => ({ val: s - Math.floor(s), idx: i }));
          decimals.sort((a, b) => b.val - a.val); // Descending decimal parts
          
          for(let i=0; i<diff; i++) {
              intShares[decimals[i].idx]++;
          }
          return intShares;
      };

      const allocatedNet = distribute(targetNet, jobWeights, totalWeight);
      // For VAT, we use the same weights (Cost Adj) because VAT is proportional to Cost
      const allocatedVat = distribute(targetVat, jobWeights, totalWeight);

      return booking.jobs.map((job, i) => ({
          id: job.id,
          costAdj: allocatedNet[i],
          vat: allocatedVat[i]
      }));
  }, [booking.jobs, jobWeights, totalWeight, targetNet, targetVat]);

  const distMap = useMemo(() => new Map(distributedData.map(d => [d.id, d])), [distributedData]);

  // -----------------------------
  // CALCULATIONS (Others)
  // -----------------------------
  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => sum + (job.extensions || []).reduce((s, x) => s + x.total, 0), 0);
  const totalLocalChargeRevenue = booking.jobs.reduce((s, j) => s + j.localChargeTotal, 0);
  const totalAdditionalLocalChargeNet = additionalLocalCharges.reduce((s, i) => s + (i.net || 0), 0);
  const totalAdditionalLocalChargeTotalAmount = additionalLocalCharges.reduce((s, i) => s + (i.net || 0) + (i.vat || 0), 0);

  const totalExtensionCost = extensionCosts.reduce((s, i) => s + i.total, 0);
  const totalExtensionNetCost = extensionCosts.reduce((s, i) => s + (i.net || 0), 0);
  const totalDepositCost = deposits.reduce((s, d) => s + d.amount, 0);
  
  // --- NEW FEES CALCULATIONS ---
  const totalFeeCic = booking.jobs.reduce((s, j) => s + (j.feeCic || 0), 0);
  const totalFeeKimberry = booking.jobs.reduce((s, j) => s + (j.feeKimberry || 0), 0);
  const totalFeePsc = booking.jobs.reduce((s, j) => s + (j.feePsc || 0), 0);
  const totalFeeEmc = booking.jobs.reduce((s, j) => s + (j.feeEmc || 0), 0);
  const totalFeeOther = booking.jobs.reduce((s, j) => s + (j.feeOther || 0), 0);
  const totalSystemFees = totalFeeCic + totalFeeKimberry + totalFeePsc + totalFeeEmc + totalFeeOther;

  const systemTotalSell = booking.jobs.reduce((s, j) => s + j.sell, 0);
  
  // Use Targets for System Sums display to match Table Sums
  const systemTotalAdjustedCost = targetNet;
  const systemTotalVat = targetVat;

  const getRevenue = (v: number) => vatMode === 'post' ? v : Math.round(v / 1.08);
  const summaryLocalChargeRevenue = getRevenue(totalLocalChargeRevenue);
  const summaryExtensionRevenue = getRevenue(totalExtensionRevenue);
  const summaryGrandTotalRevenue = summaryLocalChargeRevenue + summaryExtensionRevenue;
  const totalJobPayment = booking.jobs.reduce((s, j) => s + (j.cost || 0), 0);
  const summaryAmountExpense = vatMode === 'post' ? totalJobPayment : ((localCharge.net || 0) + totalAdditionalLocalChargeNet);
  const summaryExtensionExpense = vatMode === 'post' ? totalExtensionCost : totalExtensionNetCost;
  const summaryGrandTotalExpense = summaryAmountExpense + summaryExtensionExpense + totalDepositCost;
  const summaryProfit = summaryGrandTotalRevenue - summaryGrandTotalExpense;
  
  const totalActualNet = localCharge.hasInvoice
      ? (localCharge.net || 0) + totalAdditionalLocalChargeNet
      : (localCharge.total || 0) + totalAdditionalLocalChargeNet;

  const totalActualTotal = localCharge.hasInvoice
      ? (localCharge.net || 0) + (localCharge.vat || 0) + totalAdditionalLocalChargeTotalAmount
      : (localCharge.total || 0) + totalAdditionalLocalChargeTotalAmount;

  // -----------------------------
  // HELPER: GET PAYMENT REQUESTS FROM LOCALSTORAGE
  // -----------------------------
  const getPaymentRequests = () => {
      try {
          return JSON.parse(localStorage.getItem("payment_requests_v1") || "[]");
      } catch { return []; }
  };

  const normalize = (str: any) => String(str || '').trim().toLowerCase();

  // -----------------------------
  // UPDATE HANDLERS
  // -----------------------------
  const handleLocalChargeChange = (field: keyof typeof localCharge, val: any) => {
    setLocalCharge(prev => {
      const up = { ...prev, [field]: val };
      if (prev.hasInvoice) {
          if (field === 'net' || field === 'vat') up.total = (Number(up.net) || 0) + (Number(up.vat) || 0);
      } else {
          if (field === 'total') { up.net = 0; up.vat = 0; }
      }
      return up;
    });
  };

  // SYNC FROM PAYMENT REQUEST (LOCAL CHARGE)
  const handleSyncLocalCharge = () => {
      const reqs = getPaymentRequests();
      const targetBk = normalize(booking.bookingId);

      const relevant = reqs.filter((r: any) => {
          const rBk = normalize(r.booking);
          const rType = r.type || 'Local Charge';
          return rBk === targetBk && rType === 'Local Charge';
      });

      const total = relevant.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      
      if (total > 0) {
          setLocalCharge(prev => ({
              ...prev,
              total: total,
              hasInvoice: false,
              net: 0,
              vat: 0
          }));
          alert(`Đã đồng bộ ${new Intl.NumberFormat('en-US').format(total)} VND từ Payment Requests. Chuyển sang chế độ "Chưa HĐ".`);
      } else {
          alert(`Không tìm thấy yêu cầu thanh toán Local Charge nào cho Booking "${booking.bookingId}".`);
      }
  };

  // VIEW INVOICE FROM PAYMENT REQUEST
  const handleViewPaymentInvoice = () => {
      const reqs = getPaymentRequests();
      const targetBk = normalize(booking.bookingId);

      const relevant = reqs
          .filter((r: any) => {
              const rBk = normalize(r.booking);
              const rType = r.type || 'Local Charge';
              return rBk === targetBk && rType === 'Local Charge' && r.invoiceUrl;
          })
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (relevant.length > 0) {
          const match = relevant[0];
          if (match.invoiceUrl) {
              window.open(match.invoiceUrl, '_blank');
          } else {
              alert("Tìm thấy yêu cầu thanh toán nhưng không có đường dẫn file.");
          }
      } else {
          alert(`Không tìm thấy file hóa đơn trong các yêu cầu thanh toán của Booking "${booking.bookingId}".`);
      }
  };

  // --- AI ANALYSIS HANDLER ---
  const handleAnalyzeInvoice = async () => {
      // 1. Determine File URL (Local or Payment Request)
      let targetUrl = localCharge.fileUrl;

      // If no local file, try to find in Payment Requests
      if (!targetUrl) {
          const reqs = getPaymentRequests();
          const targetBk = normalize(booking.bookingId);
          const relevant = reqs
              .filter((r: any) => {
                  const rBk = normalize(r.booking);
                  const rType = r.type || 'Local Charge';
                  return rBk === targetBk && rType === 'Local Charge' && r.invoiceUrl;
              })
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (relevant.length > 0) {
              targetUrl = relevant[0].invoiceUrl;
          }
      }

      if (!targetUrl) {
          alert("Không tìm thấy file hóa đơn (Đính kèm hoặc Payment Request).");
          return;
      }

      setIsAnalyzing(true);
      try {
          // 2. Fetch file
          const response = await fetch(targetUrl);
          const blob = await response.blob();
          
          // 3. Convert to Base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          await new Promise(resolve => reader.onload = resolve);
          const base64Data = (reader.result as string).split(',')[1];
          
          const mimeType = blob.type.startsWith('image/') ? blob.type : 'application/pdf';

          // 4. AI Call
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const model = 'gemini-3-flash-preview'; 
          
          const result = await ai.models.generateContent({
              model: model,
              contents: {
                  parts: [
                      { inlineData: { mimeType, data: base64Data } },
                      { text: "Extract the Invoice Number, Invoice Date (DD/MM/YYYY), Total Net Amount (pre-tax), and Total VAT Amount. Return ONLY valid JSON: { \"invoice\": string, \"date\": string, \"net\": number, \"vat\": number }. Return 0 or empty string if not found." }
                  ]
              }
          });

          const jsonText = result.text || "";
          const jsonStr = jsonText.replace(/```json|```/g, '').trim();
          const data = JSON.parse(jsonStr);

          if (data) {
              setLocalCharge(prev => {
                  const newNet = data.net !== undefined ? Number(data.net) : prev.net;
                  const newVat = data.vat !== undefined ? Number(data.vat) : prev.vat;
                  // Handle Date: AI returns DD/MM/YYYY, parseDateVN handles that to YYYY-MM-DD
                  const newDate = data.date ? (parseDateVN(data.date) || prev.date) : prev.date;
                  
                  return {
                      ...prev,
                      invoice: data.invoice || prev.invoice,
                      date: newDate,
                      net: newNet,
                      vat: newVat,
                      total: newNet + newVat
                  };
              });
              alert(`Đã cập nhật từ hóa đơn!\nSố HĐ: ${data.invoice}\nNgày: ${data.date}\nNet: ${new Intl.NumberFormat('en-US').format(data.net)}\nVAT: ${new Intl.NumberFormat('en-US').format(data.vat)}`);
          }

      } catch (error) {
          console.error("AI Error", error);
          alert("Không thể trích xuất thông tin. Vui lòng kiểm tra file hoặc thử lại.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  // SYNC FROM PAYMENT REQUEST (DEPOSIT)
  const handleSyncDeposit = () => {
      const reqs = getPaymentRequests();
      const targetBk = normalize(booking.bookingId);

      const relevant = reqs.filter((r: any) => {
          const rBk = normalize(r.booking);
          return rBk === targetBk && r.type === 'Deposit';
      });

      const total = relevant.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

      if (total > 0) {
           if (deposits.length > 0) {
              handleUpdateDeposit(deposits[0].id, 'amount', total);
           } else {
              setDeposits([{ id: Date.now().toString(), amount: total, dateOut: '', dateIn: '' }]);
           }
           alert(`Đã cập nhật số tiền Cược: ${new Intl.NumberFormat('en-US').format(total)} VND từ Payment.`);
      } else {
           alert("Không tìm thấy yêu cầu thanh toán Deposit nào cho Booking này.");
      }
  };

  const handleAddAdditionalLC = () => setAdditionalLocalCharges(prev => [...prev, { id: Date.now().toString(), invoice: '', date: '', net: 0, vat: 0, total: 0 }]);
  const handleUpdateAdditionalLC = (id: string, field: keyof BookingExtensionCost, val: any) => setAdditionalLocalCharges(prev => prev.map(item => item.id === id ? { ...item, [field]: val, total: (field === 'net' || field === 'vat') ? (field === 'net' ? val : item.net) + (field === 'vat' ? val : item.vat) : item.total } : item));
  const handleRemoveAdditionalLC = (id: string) => setAdditionalLocalCharges(prev => prev.filter(i => i.id !== id));
  
  const handleAddExtensionCost = () => setExtensionCosts(prev => [...prev, { id: Date.now().toString(), invoice: '', date: '', net: 0, vat: 0, total: 0 }]);
  const handleUpdateExtensionCost = (id: string, field: keyof BookingExtensionCost, val: any) => setExtensionCosts(prev => prev.map(item => item.id === id ? { ...item, [field]: val, total: (field === 'net' || field === 'vat') ? (field === 'net' ? val : item.net) + (field === 'vat' ? val : item.vat) : item.total } : item));
  const handleRemoveExtensionCost = (id: string) => setExtensionCosts(prev => prev.filter(i => i.id !== id));

  const handleAddDeposit = () => setDeposits(prev => [...prev, { id: Date.now().toString(), amount: 0, dateOut: '', dateIn: '' }]);
  const handleUpdateDeposit = (id: string, field: keyof BookingDeposit, val: any) => setDeposits(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  const handleRemoveDeposit = (id: string) => setDeposits(prev => prev.filter(d => d.id !== id));

  // --- FILE UPLOAD HANDLERS ---
  const handleUploadClick = (target: { type: 'MAIN' | 'ADDITIONAL' | 'EXTENSION', id?: string }) => {
      setUploadTarget(target);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadTarget) return;

      // VALIDATE IF INVOICE EXISTS
      let invoiceNo = '';
      let dateStr = '';

      if (uploadTarget.type === 'MAIN') {
          invoiceNo = localCharge.invoice;
          dateStr = localCharge.date;
      } else if (uploadTarget.type === 'ADDITIONAL') {
          const item = additionalLocalCharges.find(i => i.id === uploadTarget.id);
          invoiceNo = item?.invoice || '';
          dateStr = item?.date || '';
      } else if (uploadTarget.type === 'EXTENSION') {
          const item = extensionCosts.find(i => i.id === uploadTarget.id);
          invoiceNo = item?.invoice || '';
          dateStr = item?.date || '';
      }

      if (!invoiceNo) {
          alert("Vui lòng nhập số Hóa đơn cho dòng này trước khi upload file.");
          return;
      }

      setIsUploading(true);

      try {
          const date = dateStr || new Date().toISOString().split('T')[0];
          const [year, month, day] = date.split('-'); 
          const folderPath = `Invoice/${year}.${month}`;
          
          const ext = file.name.split('.').pop();
          const safeLine = (booking.line || 'UNK').replace(/[^a-zA-Z0-9]/g, '');
          const safeBooking = (booking.bookingId || 'UNK').replace(/[^a-zA-Z0-9]/g, '');
          const safeInvoice = invoiceNo.replace(/[^a-zA-Z0-9]/g, '');
          
          const fileName = `${safeLine}.${safeBooking}.${safeInvoice}.${day}.${month}.${year}.${ext}`;

          const formData = new FormData();
          formData.append("folderPath", folderPath);
          formData.append("fileName", fileName);
          formData.append("file", file);

          const response = await axios.post(`${BACKEND_URL}/upload-file`, formData);
          
          if (response.data && response.data.success) {
              const fileUrl = `${BACKEND_URL}/uploads/${folderPath}/${fileName}`;
              
              if (uploadTarget.type === 'MAIN') {
                  setLocalCharge(prev => ({ ...prev, fileUrl: fileUrl, fileName: fileName }));
              } else if (uploadTarget.type === 'ADDITIONAL') {
                  setAdditionalLocalCharges(prev => prev.map(i => i.id === uploadTarget.id ? { ...i, fileUrl: fileUrl, fileName: fileName } : i));
              } else if (uploadTarget.type === 'EXTENSION') {
                  setExtensionCosts(prev => prev.map(i => i.id === uploadTarget.id ? { ...i, fileUrl: fileUrl, fileName: fileName } : i));
              }
              alert("Upload thành công!");
          } else {
              throw new Error(response.data?.message || "Upload failed");
          }

      } catch (err) {
          console.error("Upload error:", err);
          alert("Có lỗi khi upload file. Vui lòng thử lại.");
      } finally {
          setIsUploading(false);
          setUploadTarget(null);
      }
  };

  const handleDeleteFile = (target: { type: 'MAIN' | 'ADDITIONAL' | 'EXTENSION', id?: string }) => { 
      if(!window.confirm("Xóa file đính kèm?")) return;
      
      if (target.type === 'MAIN') {
          setLocalCharge(prev => ({ ...prev, fileUrl: '', fileName: '' }));
      } else if (target.type === 'ADDITIONAL') {
          setAdditionalLocalCharges(prev => prev.map(i => i.id === target.id ? { ...i, fileUrl: '', fileName: '' } : i));
      } else if (target.type === 'EXTENSION') {
          setExtensionCosts(prev => prev.map(i => i.id === target.id ? { ...i, fileUrl: '', fileName: '' } : i));
      }
  };

  const copyColumn = (type: 'sell' | 'cost' | 'vat' | 'project') => {
    const values = booking.jobs.map(job => {
        if (type === "sell") return job.sell;
        // Use balanced values from distMap
        const dist = distMap.get(job.id);
        if (type === "cost") return dist ? dist.costAdj : 0;
        if (type === "vat") return dist ? dist.vat : 0;
        const jobYear = job.year || booking.year || new Date().getFullYear();
        const yy = jobYear.toString().slice(-2);
        const mm = job.month.padStart(2, "0");
        return `K${yy}${mm}${job.jobCode}`;
    });
    navigator.clipboard.writeText(values.join("\n"));
    setCopiedId(`col-${type}`);
    setTimeout(() => setCopiedId(null), 1000);
  };

  const formatMoney = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

  return createPortal(
    <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 ${zIndex || 'z-[100]'}`}>
      {/* Hidden File Input used by all attachment rows */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden border border-white/50 animate-in zoom-in-95 duration-200">

        {/* ================= HEADER ================= */}
        <div className="px-5 py-3 border-b border-slate-200/60 flex justify-between items-center bg-white/50 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              Booking <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-base border border-blue-100 font-mono">
                {booking.bookingId}
              </span>
            </h2>
            <div className="h-4 w-px bg-slate-300"></div>
            <div className="flex space-x-3 text-xs font-medium text-slate-500">
              <span className="flex items-center"><Ship className="w-3.5 h-3.5 mr-1" /> {booking.line}</span>
              <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> Tháng {booking.month}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/50">
            
            {/* LEFT COLUMN: SYSTEM DATA & COSTS (65%) */}
            <div className="w-full md:w-[65%] flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar border-r border-slate-200">
                
                {/* 1. SYSTEM TABLE - FIXED: Shrink 0 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
                    <div className="overflow-auto max-h-[400px] custom-scrollbar relative">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 border-r bg-slate-50">Job Code</th>
                                    <th className="px-3 py-2 text-right border-r w-24 cursor-pointer hover:text-blue-600 bg-slate-50" onClick={() => copyColumn('sell')}>Sell {copiedId === 'col-sell' && <Check className="inline w-3 h-3 text-green-500"/>}</th>
                                    <th className="px-3 py-2 text-right border-r bg-slate-50">Thu LC (Inv)</th>
                                    <th className="px-3 py-2 text-right border-r bg-slate-50">Thu Ext (Inv)</th>
                                    <th className="px-3 py-2 text-right border-r w-24 cursor-pointer hover:text-blue-600 bg-slate-50" onClick={() => copyColumn('cost')}>Cost (Adj) {copiedId === 'col-cost' && <Check className="inline w-3 h-3 text-green-500"/>}</th>
                                    <th className="px-3 py-2 text-right border-r w-24 cursor-pointer hover:text-blue-600 bg-slate-50" onClick={() => copyColumn('vat')}>VAT {copiedId === 'col-vat' && <Check className="inline w-3 h-3 text-green-500"/>}</th>
                                    <th className="px-3 py-2 text-center w-28 cursor-pointer hover:text-blue-600 bg-slate-50" onClick={() => copyColumn('project')}>Project {copiedId === 'col-project' && <Check className="inline w-3 h-3 text-green-500"/>}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {booking.jobs.map(job => {
                                    const dist = distMap.get(job.id);
                                    const displayCost = dist ? dist.costAdj : 0;
                                    const displayVat = dist ? dist.vat : 0;

                                    const lcTotal = job.localChargeTotal || 0;
                                    const lcInv = job.localChargeInvoice || '';
                                    const extTotal = (job.extensions || []).reduce((s, e) => s + e.total, 0);
                                    const extInv = (job.extensions || []).map(e => e.invoice).filter(Boolean).join(', ');

                                    return (
                                        <tr key={job.id} className="hover:bg-blue-50/30 group">
                                            <td className="px-3 py-1.5 font-bold text-teal-700 border-r flex justify-between items-center">
                                                {job.jobCode}
                                                {onViewJob && <button onClick={() => onViewJob(job.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600"><ExternalLink className="w-3 h-3" /></button>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right border-r text-slate-600">{formatMoney(job.sell)}</td>
                                            <td className="px-3 py-1.5 text-right border-r text-blue-600">
                                                <div>{formatMoney(lcTotal)}</div>
                                                {lcInv && <div className="text-[9px] text-slate-400 truncate max-w-[80px] ml-auto">{lcInv}</div>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right border-r text-orange-600">
                                                <div>{formatMoney(extTotal)}</div>
                                                {extInv && <div className="text-[9px] text-slate-400 truncate max-w-[80px] ml-auto">{extInv}</div>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right border-r text-slate-600 font-medium">{formatMoney(displayCost)}</td>
                                            <td className="px-3 py-1.5 text-right border-r text-slate-400">{formatMoney(displayVat)}</td>
                                            <td className="px-3 py-1.5 text-center text-[10px] font-mono text-slate-400">K..{job.jobCode.slice(-4)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-700 border-t sticky bottom-0 z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                                <tr>
                                    <td className="px-3 py-2 text-right border-r bg-slate-50">Tổng:</td>
                                    <td className="px-3 py-2 text-right text-green-600 border-r bg-slate-50">{formatMoney(systemTotalSell)}</td>
                                    <td className="px-3 py-2 text-right text-blue-600 border-r bg-slate-50">
                                        {formatMoney(booking.jobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-orange-600 border-r bg-slate-50">
                                        {formatMoney(booking.jobs.reduce((s, j) => s + (j.extensions || []).reduce((sum, e) => sum + e.total, 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600 border-r bg-slate-50">{formatMoney(systemTotalAdjustedCost)}</td>
                                    <td className="px-3 py-2 text-right border-r text-slate-500 bg-slate-50">{formatMoney(systemTotalVat)}</td>
                                    <td className="bg-slate-50"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 2. LOCAL CHARGE (Input) - FIXED: Shrink 0 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative shrink-0">
                    <SectionHeader 
                        icon={FileText} 
                        title="Local Charge (Invoice Chi)" 
                        color="text-red-600" 
                        rightContent={
                            <div className="flex items-center gap-3">
                                {/* AI Extraction Button - MODIFIED CONDITION */}
                                {localCharge.hasInvoice && (
                                    <button
                                        onClick={handleAnalyzeInvoice}
                                        disabled={isAnalyzing}
                                        className="text-purple-600 p-1.5 bg-purple-50 border border-purple-100 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1"
                                        title="AI Trích xuất thông tin hóa đơn (File đính kèm hoặc Payment Request)"
                                    >
                                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    </button>
                                )}

                                {/* SYNC BUTTON */}
                                {!localCharge.hasInvoice && (
                                    <button 
                                        onClick={handleSyncLocalCharge}
                                        className="text-teal-600 p-1.5 bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100 transition-colors"
                                        title="Đồng bộ số tiền từ Payment Requests"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}
                                {/* VIEW BUTTON */}
                                {localCharge.hasInvoice && (
                                    <button 
                                        onClick={handleViewPaymentInvoice}
                                        className="text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                        title="Xem hóa đơn chi từ Payment"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                )}

                                <label className="flex items-center cursor-pointer select-none">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={localCharge.hasInvoice} onChange={(e) => handleLocalChargeChange("hasInvoice", e.target.checked)} />
                                        <div className={`block w-8 h-4 rounded-full transition-colors ${localCharge.hasInvoice ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                        <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${localCharge.hasInvoice ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="ml-2 text-[10px] font-bold text-slate-600">{localCharge.hasInvoice ? 'Có HĐ' : 'Chưa HĐ'}</span>
                                </label>
                                <button onClick={handleAddAdditionalLC} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 flex items-center"><Plus className="w-3 h-3 mr-1"/>Thêm</button>
                            </div>
                        }
                    />
                    
                    {/* MAIN LOCAL CHARGE ROW */}
                    <div className="grid grid-cols-12 gap-3 mb-2">
                        <div className="col-span-3"><Label>Số HĐ</Label><Input value={localCharge.invoice} onChange={(e) => handleLocalChargeChange("invoice", e.target.value)} placeholder={!localCharge.hasInvoice ? "Tham chiếu" : ""} /></div>
                        <div className="col-span-3"><Label>Ngày</Label><DateInput value={localCharge.date} onChange={(e) => handleLocalChargeChange("date", e.target.value)} /></div>
                        {localCharge.hasInvoice ? (
                            <>
                                <div className="col-span-3"><Label>Giá Net</Label><MoneyInput name="net" value={localCharge.net} onChange={(n, v) => handleLocalChargeChange(n as any, v)} /></div>
                                <div className="col-span-3"><Label>VAT</Label><MoneyInput name="vat" value={localCharge.vat} onChange={(n, v) => handleLocalChargeChange(n as any, v)} /></div>
                            </>
                        ) : (
                            <div className="col-span-6"><Label>Tổng tiền (Tạm tính)</Label><MoneyInput name="total" value={localCharge.total} onChange={(n, v) => handleLocalChargeChange(n as any, v)} className="bg-red-50 text-red-700 font-bold" /></div>
                        )}
                        
                        {/* ATTACHMENT ROW FOR MAIN LC */}
                        <AttachmentRow 
                            hasInvoice={localCharge.hasInvoice}
                            fileUrl={localCharge.fileUrl}
                            fileName={localCharge.fileName}
                            onUpload={() => handleUploadClick({ type: 'MAIN' })}
                            onDelete={() => handleDeleteFile({ type: 'MAIN' })}
                            isUploading={isUploading && uploadTarget?.type === 'MAIN'}
                        />
                    </div>

                    {/* ADDITIONAL LOCAL CHARGES */}
                    {additionalLocalCharges.map(item => (
                        <div key={item.id} className="grid grid-cols-12 gap-3 mt-3 items-center bg-slate-50 p-2 rounded border border-slate-100 group relative">
                            <div className="col-span-3"><Input value={item.invoice} onChange={(e) => handleUpdateAdditionalLC(item.id, "invoice", e.target.value)} placeholder="Số HĐ" className="h-7 text-xs" /></div>
                            <div className="col-span-3"><DateInput value={item.date} onChange={(e) => handleUpdateAdditionalLC(item.id, "date", e.target.value)} className="h-7" /></div>
                            <div className="col-span-3"><MoneyInput value={item.net} onChange={(n, v) => handleUpdateAdditionalLC(item.id, "net", v)} className="h-7" /></div>
                            <div className="col-span-2"><MoneyInput value={item.vat} onChange={(n, v) => handleUpdateAdditionalLC(item.id, "vat", v)} className="h-7" /></div>
                            <button onClick={() => handleRemoveAdditionalLC(item.id)} className="absolute -right-2 -top-2 bg-white border rounded-full p-1 text-slate-300 hover:text-red-500 shadow opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3"/></button>
                            
                            {/* ATTACHMENT ROW FOR ADDITIONAL LC */}
                            <AttachmentRow 
                                hasInvoice={item.hasInvoice !== false} // Default true unless explicitly false
                                fileUrl={item.fileUrl}
                                fileName={item.fileName}
                                onUpload={() => handleUploadClick({ type: 'ADDITIONAL', id: item.id })}
                                onDelete={() => handleDeleteFile({ type: 'ADDITIONAL', id: item.id })}
                                isUploading={isUploading && uploadTarget?.type === 'ADDITIONAL' && uploadTarget?.id === item.id}
                            />
                        </div>
                    ))}

                    <div className="mt-3 flex items-center justify-end">
                        <div className="text-[10px] text-slate-400">Total Invoice: <strong className={totalActualNet !== systemTotalAdjustedCost ? "text-red-600" : "text-green-600"}>{formatMoney(totalActualTotal)}</strong> / Target: {formatMoney(systemTotalAdjustedCost)}</div>
                    </div>
                </div>

                {/* 3. EXTENSIONS (Input) - FIXED: Shrink 0 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <SectionHeader 
                        icon={Copy} 
                        title="Gia Hạn" 
                        color="text-orange-600" 
                        rightContent={<button onClick={handleAddExtensionCost} className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100 hover:bg-orange-100 flex items-center"><Plus className="w-3 h-3 mr-1"/>Thêm</button>}
                    />
                    <div className="space-y-2">
                        {extensionCosts.map(ext => (
                            <div key={ext.id} className="bg-orange-50/30 p-2 rounded border border-orange-100 group relative mb-2">
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-3"><Input value={ext.invoice} onChange={(e) => handleUpdateExtensionCost(ext.id, "invoice", e.target.value)} placeholder="Số HĐ" className="h-7 text-xs bg-white" /></div>
                                    <div className="col-span-3"><DateInput value={ext.date} onChange={(e) => handleUpdateExtensionCost(ext.id, "date", e.target.value)} className="h-7" /></div>
                                    <div className="col-span-3"><MoneyInput value={ext.net} onChange={(n, v) => handleUpdateExtensionCost(ext.id, "net", v)} className="h-7 bg-white" /></div>
                                    <div className="col-span-3"><MoneyInput value={ext.vat} onChange={(n, v) => handleUpdateExtensionCost(ext.id, "vat", v)} className="h-7 bg-white" /></div>
                                    <button onClick={() => handleRemoveExtensionCost(ext.id)} className="absolute -right-2 -top-2 bg-white border rounded-full p-1 text-slate-300 hover:text-red-500 shadow opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3"/></button>
                                </div>
                                
                                {/* ATTACHMENT ROW FOR EXTENSION */}
                                <AttachmentRow 
                                    hasInvoice={true} 
                                    fileUrl={ext.fileUrl}
                                    fileName={ext.fileName}
                                    onUpload={() => handleUploadClick({ type: 'EXTENSION', id: ext.id })}
                                    onDelete={() => handleDeleteFile({ type: 'EXTENSION', id: ext.id })}
                                    isUploading={isUploading && uploadTarget?.type === 'EXTENSION' && uploadTarget?.id === ext.id}
                                />
                            </div>
                        ))}
                        {extensionCosts.length === 0 && <div className="text-center text-xs text-slate-400 italic py-2">Chưa có hóa đơn gia hạn</div>}
                    </div>
                    <div className="text-right mt-2 text-xs font-bold text-orange-700">Total: {formatMoney(totalExtensionCost)}</div>
                </div>

            </div>

            {/* RIGHT COLUMN: DEPOSIT & SUMMARY (35%) */}
            <div className="w-full md:w-[35%] flex flex-col bg-slate-50/50 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                
                {/* 4. DEPOSIT */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <SectionHeader 
                        icon={Anchor} 
                        title="Cược (Deposit)" 
                        color="text-indigo-600" 
                        rightContent={
                            <div className="flex items-center gap-2">
                                {/* SYNC BUTTON */}
                                <button 
                                    onClick={handleSyncDeposit}
                                    className="text-indigo-600 p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                                    title="Đồng bộ tiền Cược từ Payment Requests"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button onClick={handleAddDeposit} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100 flex items-center"><Plus className="w-3 h-3 mr-1"/>Thêm</button>
                            </div>
                        }
                    />
                    <div className="space-y-2">
                        {deposits.map(d => (
                            <div key={d.id} className="bg-slate-50 p-2 rounded border border-slate-100 group relative">
                                <div className="flex justify-between mb-1">
                                    <MoneyInput value={d.amount} onChange={(n, v) => handleUpdateDeposit(d.id, "amount", v)} className="w-28 h-7 text-indigo-700 font-bold" />
                                    <button onClick={() => handleRemoveDeposit(d.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>
                                <div className="flex gap-2">
                                    <DateInput value={d.dateOut} onChange={(e) => handleUpdateDeposit(d.id, "dateOut", e.target.value)} className="h-7" />
                                    <DateInput value={d.dateIn} onChange={(e) => handleUpdateDeposit(d.id, "dateIn", e.target.value)} className="h-7" />
                                </div>
                            </div>
                        ))}
                        {deposits.length === 0 && <div className="text-center text-xs text-slate-400 italic py-2">Chưa có cược</div>}
                    </div>
                    <div className="text-right mt-2 text-xs font-bold text-indigo-700">Total: {formatMoney(totalDepositCost)}</div>
                </div>

                {/* 5. SUMMARY (STICKY CARD) */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                        <h3 className="text-xs font-bold uppercase flex items-center"><Calculator className="w-4 h-4 mr-2"/> Tổng Hợp</h3>
                        <div className="flex bg-slate-800 rounded p-0.5">
                            <button onClick={() => setVatMode('pre')} className={`px-2 py-0.5 text-[10px] rounded ${vatMode === 'pre' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Pre-VAT</button>
                            <button onClick={() => setVatMode('post')} className={`px-2 py-0.5 text-[10px] rounded ${vatMode === 'post' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Post-VAT</button>
                        </div>
                    </div>
                    
                    <div className="space-y-3 flex-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Thu LC</span>
                            <span className="text-green-400">{formatMoney(summaryLocalChargeRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Chi LC (Payment)</span>
                            <span className="text-red-400">{formatMoney(summaryAmountExpense)}</span>
                        </div>
                        <div className="border-b border-slate-800 my-1"></div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Thu GH</span>
                            <span className="text-green-400">{formatMoney(summaryExtensionRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Chi GH</span>
                            <span className="text-red-400">{formatMoney(summaryExtensionExpense)}</span>
                        </div>
                        <div className="border-b border-slate-800 my-1"></div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Cược (Deposit)</span>
                            <span className="text-red-400">{formatMoney(totalDepositCost)}</span>
                        </div>

                        {/* NEW FEES SECTION START */}
                        <div className="border-b border-slate-800 my-1"></div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-2 mb-1">Chi tiết Phí (System)</div>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between pl-2 border-l-2 border-slate-700">
                                <span className="text-slate-400">Kimberry</span>
                                <span className="text-slate-300">{formatMoney(totalFeeKimberry)}</span>
                            </div>
                            <div className="flex justify-between pl-2 border-l-2 border-slate-700">
                                <span className="text-slate-400">CIC</span>
                                <span className="text-slate-300">{formatMoney(totalFeeCic)}</span>
                            </div>
                            <div className="flex justify-between pl-2 border-l-2 border-slate-700">
                                <span className="text-slate-400">PSC</span>
                                <span className="text-slate-300">{formatMoney(totalFeePsc)}</span>
                            </div>
                            <div className="flex justify-between pl-2 border-l-2 border-slate-700">
                                <span className="text-slate-400">EMC</span>
                                <span className="text-slate-300">{formatMoney(totalFeeEmc)}</span>
                            </div>
                            <div className="flex justify-between pl-2 border-l-2 border-slate-700">
                                <span className="text-slate-400">Khác</span>
                                <span className="text-slate-300">{formatMoney(totalFeeOther)}</span>
                            </div>
                            <div className="flex justify-between pt-1 mt-1 border-t border-slate-800">
                                <span className="text-slate-400 font-bold">Tổng Phí</span>
                                <span className="text-orange-500 font-bold">{formatMoney(totalSystemFees)}</span>
                            </div>
                        </div>
                        {/* NEW FEES SECTION END */}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-slate-300">LỢI NHUẬN</span>
                            <span className={`text-xl font-bold ${summaryProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                                {formatMoney(summaryProfit)}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Đóng</button>
          <button onClick={() => onSave({ localCharge, additionalLocalCharges, extensionCosts, deposits })} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800 shadow-md flex items-center">
            <Save className="w-3.5 h-3.5 mr-1.5" /> Lưu Thay Đổi
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
