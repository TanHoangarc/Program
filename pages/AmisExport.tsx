
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine, INITIAL_JOB } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, Banknote, ShoppingCart, ShoppingBag, Loader2, Wallet, Plus, Trash2, Copy, Check } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx'; // Keep for reading uploads if needed, or misc utils
import ExcelJS from 'exceljs'; // NEW: For exporting with styles
import { formatDateVN, calculateBookingSummary, parseDateVN } from '../utils';
import { PaymentVoucherModal } from '../components/PaymentVoucherModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseInvoiceModal } from '../components/PurchaseInvoiceModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import axios from 'axios';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  mode: 'thu' | 'chi' | 'ban' | 'mua';
  onUpdateJob?: (job: JobData) => void;
  lockedIds: Set<string>;
  onToggleLock: (docNo: string | string[]) => void;
  customReceipts?: any[];
  onUpdateCustomReceipts?: (receipts: any[]) => void;
}

const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Invoice"; // CHANGED from "Templates"

const TEMPLATE_MAP: Record<string, string> = {
  thu: "Phieu_thu_Mau.xlsx",
  chi: "Phieu_chi_Mau.xlsx",
  ban: "Ban_hang_Mau.xlsx",
  mua: "Mua_hang_Mau.xlsx"
};

export const AmisExport: React.FC<AmisExportProps> = ({ jobs, customers, mode, onUpdateJob, lockedIds, onToggleLock, customReceipts = [], onUpdateCustomReceipts }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobData | null>(null);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Template State (Now storing ArrayBuffer for ExcelJS)
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  
  // Modal States
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('local');
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);
  const [targetExtensionId, setTargetExtensionId] = useState<string | null>(null);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'local' | 'deposit' | 'extension'>('local');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTemplateFileName = TEMPLATE_MAP[mode] || "AmisTemplate.xlsx";

  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, filterMonth]);

  // --- AUTO LOAD TEMPLATE FROM SERVER ---
  useEffect(() => {
    const fetchServerTemplate = async () => {
        setIsLoadingTemplate(true);
        setTemplateBuffer(null); 
        setTemplateName('');
        
        try {
            // Timestamp prevents caching old 404s or old file versions
            const fileUrl = `${BACKEND_URL}/amis/template/${currentTemplateFileName.replace(/_/g, '-').replace('.xlsx', '').toLowerCase()}?v=${Date.now()}`;
            // Correct API mapping logic for template fetching if needed, or rely on specific endpoints provided previously
            // Fallback to static path if the dynamic one is complex
            const staticUrl = `${BACKEND_URL}/uploads/${TEMPLATE_FOLDER}/${currentTemplateFileName}?v=${Date.now()}`;
            
            const response = await axios.get(staticUrl, { responseType: 'arraybuffer' });
            
            if (response.status === 200 && response.data) {
                setTemplateBuffer(response.data);
                const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
                setTemplateName(`${displayName} (Server)`);
            }
        } catch (error) {
            console.log(`Chưa có file mẫu ${currentTemplateFileName} trên server.`);
        } finally {
            setIsLoadingTemplate(false);
        }
    };

    fetchServerTemplate();
  }, [mode, currentTemplateFileName]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getCustomerCode = (id: string) => customers.find(c => c.id === id)?.code || id;
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || '';

  // --- UPLOAD TEMPLATE ---
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);

    // Read immediately into buffer for local use
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
          setTemplateBuffer(evt.target.result as ArrayBuffer);
          setTemplateName(file.name);
      }
    };
    reader.readAsArrayBuffer(file);

    try {
        const formData = new FormData();
        formData.append("folderPath", TEMPLATE_FOLDER);
        formData.append("fileName", currentTemplateFileName);
        formData.append("file", file);

        await axios.post(`${BACKEND_URL}/upload-file`, formData);
        
        const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
        alert(`Đã lưu mẫu "${displayName}" lên Server thành công!`);
        setTemplateName(`${displayName} (Mới cập nhật)`);
    } catch (err) {
        console.error("Lỗi upload mẫu:", err);
        alert("Lưu mẫu thất bại. Mẫu chỉ có hiệu lực tạm thời trong phiên này.");
    } finally {
        setIsUploadingTemplate(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const checkMonth = (dateStr?: string | null) => {
      if (!filterMonth) return true;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      return (date.getMonth() + 1).toString() === filterMonth;
  };

  const exportData = useMemo(() => {
    if (mode === 'thu') {
      const rows: any[] = [];
      jobs.forEach(j => {
         if (j.thuCuoc > 0 && j.amisDepositDocNo && checkMonth(j.ngayThuCuoc)) {
             rows.push({
                 jobId: j.id, type: 'deposit_thu', rowId: `dep-${j.id}`,
                 date: j.ngayThuCuoc, docNo: j.amisDepositDocNo, 
                 objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
                 desc: j.amisDepositDesc || `Thu tiền khách hàng CƯỢC BL ${j.jobCode}`, amount: j.thuCuoc, tkNo: '1121', tkCo: '1388', 
             });
         }
      });
      jobs.forEach(j => {
          if (j.localChargeTotal > 0 && j.amisLcDocNo && checkMonth(j.localChargeDate)) {
               rows.push({
                   jobId: j.id, type: 'lc_thu', rowId: `lc-${j.id}`,
                   date: j.localChargeDate, docNo: j.amisLcDocNo, 
                   objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                   desc: j.amisLcDesc || `Thu tiền khách hàng theo hoá đơn ${j.localChargeInvoice} (KIM)`, amount: j.localChargeTotal, tkNo: '1121', tkCo: '13111',
               });
          }
      });
      jobs.forEach(j => {
          (j.extensions || []).forEach((ext) => {
              if (ext.total > 0 && ext.amisDocNo && checkMonth(ext.invoiceDate)) {
                  rows.push({
                      jobId: j.id, type: 'ext_thu', extensionId: ext.id, rowId: `ext-${ext.id}`,
                      date: ext.invoiceDate, docNo: ext.amisDocNo, 
                      objCode: getCustomerCode(ext.customerId || j.customerId), objName: getCustomerName(ext.customerId || j.customerId),
                      desc: ext.amisDesc || `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`, amount: ext.total, tkNo: '1121', tkCo: '13111',
                  });
              }
          });
      });
      customReceipts.forEach(r => {
          if (checkMonth(r.date)) rows.push({ ...r, type: 'external', rowId: `custom-${r.id}` });
      });
      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } 
    else if (mode === 'chi') {
        const rows: any[] = [];
        const processedDocNos = new Set<string>();
        const todayStr = new Date().toISOString().split('T')[0];

        jobs.forEach(j => {
             const date = j.amisPaymentDate || todayStr;
             if (j.amisPaymentDocNo && !processedDocNos.has(j.amisPaymentDocNo) && checkMonth(date)) {
                 processedDocNos.add(j.amisPaymentDocNo);
                 let amount = 0;
                 if (j.booking) {
                     const summary = calculateBookingSummary(jobs, j.booking);
                     if (summary) {
                         const lc = summary.costDetails.localCharge;
                         const mainAmount = (lc.hasInvoice === false) ? (lc.total || 0) : ((lc.net || 0) + (lc.vat || 0));
                         const addAmount = (summary.costDetails.additionalLocalCharges || []).reduce((sum, item) => sum + (item.hasInvoice === false ? (item.total || 0) : ((item.net || 0) + (item.vat || 0))), 0);
                         amount = mainAmount + addAmount;
                     }
                 } else if (j.bookingCostDetails) {
                     amount = (j.bookingCostDetails.localCharge.hasInvoice === false ? j.bookingCostDetails.localCharge.total : (j.bookingCostDetails.localCharge.net || 0) + (j.bookingCostDetails.localCharge.vat || 0));
                 }
                 if (amount === 0) amount = j.chiPayment || 0;

                 rows.push({
                     jobId: j.id, type: 'payment_chi', rowId: `pay-${j.id}`, date, docNo: j.amisPaymentDocNo,
                     objCode: j.line, objName: '', desc: j.amisPaymentDesc, amount,
                     reason: 'Chi khác', paymentContent: j.amisPaymentDesc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisPaymentDesc, tkNo: '3311', tkCo: '1121',
                 });
             }
        });
        
        // Deposit Out Logic
        const processedDepositOut = new Set<string>();
        jobs.forEach(j => {
            if (j.amisDepositOutDocNo && !processedDepositOut.has(j.amisDepositOutDocNo) && checkMonth(j.amisDepositOutDate)) {
                processedDepositOut.add(j.amisDepositOutDocNo);
                let amount = 0;
                if (j.booking) {
                    const summary = calculateBookingSummary(jobs, j.booking);
                    amount = (summary?.costDetails.deposits || []).reduce((s,d) => s+d.amount, 0);
                }
                if (amount === 0) amount = j.chiCuoc || 0;
                
                rows.push({
                     jobId: j.id, type: 'payment_deposit', rowId: `pay-dep-${j.id}`, 
                     date: j.amisDepositOutDate || todayStr, docNo: j.amisDepositOutDocNo,
                     objCode: j.line, objName: '', desc: j.amisDepositOutDesc, amount,
                     reason: 'Chi khác', paymentContent: j.amisDepositOutDesc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisDepositOutDesc, tkNo: '1388', tkCo: '1121',
                });
            }
        });

        // Extension Payment Logic
        const processedExtOut = new Set<string>();
        jobs.forEach(j => {
            if (j.amisExtensionPaymentDocNo && !processedExtOut.has(j.amisExtensionPaymentDocNo) && checkMonth(j.amisExtensionPaymentDate)) {
                processedExtOut.add(j.amisExtensionPaymentDocNo);
                let amount = 0;
                if (j.booking) {
                    const summary = calculateBookingSummary(jobs, j.booking);
                    amount = (summary?.costDetails.extensionCosts || []).reduce((s,e) => s+e.total, 0);
                }
                
                rows.push({
                     jobId: j.id, type: 'payment_ext', rowId: `pay-ext-${j.id}`, 
                     date: j.amisExtensionPaymentDate || todayStr, docNo: j.amisExtensionPaymentDocNo,
                     objCode: j.line, objName: '', desc: j.amisExtensionPaymentDesc, amount,
                     reason: 'Chi khác', paymentContent: j.amisExtensionPaymentDesc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisExtensionPaymentDesc, tkNo: '13111', tkCo: '1121',
                });
            }
        });

        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  }, [jobs, mode, filterMonth, customers, customReceipts]); 

  // --- HANDLERS FOR EDIT & DELETE ---
  const handleEdit = (row: any) => {
      const job = jobs.find(j => j.id === row.jobId);
      setTargetExtensionId(null);

      // MODE THU
      if (mode === 'thu') {
          if (row.type === 'external') {
               const dummyJob = { 
                   ...INITIAL_JOB, 
                   id: row.id, 
                   jobCode: 'THU-KHAC', 
                   localChargeDate: row.date, 
                   amisLcDocNo: row.docNo,
                   amisLcDesc: row.desc,
                   localChargeTotal: row.amount,
                   customerId: row.objCode,
                   customerName: row.objName
               };
               setQuickReceiveJob(dummyJob);
               setQuickReceiveMode('other');
               setIsQuickReceiveOpen(true);
          } else if (job) {
              setQuickReceiveJob(job);
              if (row.type === 'deposit_thu') setQuickReceiveMode('deposit');
              else if (row.type === 'ext_thu') {
                  setQuickReceiveMode('extension');
                  setTargetExtensionId(row.extensionId);
              }
              else setQuickReceiveMode('local');
              setIsQuickReceiveOpen(true);
          }
      } 
      // MODE CHI
      else if (mode === 'chi' && job) {
          setSelectedJobForModal(job);
          if (row.type === 'payment_deposit') setPaymentType('deposit');
          else if (row.type === 'payment_ext') setPaymentType('extension');
          else setPaymentType('local');
          setIsPaymentModalOpen(true);
      }
  };

  const handleDelete = (row: any) => {
      if (!window.confirm("Bạn có chắc muốn xóa chứng từ này khỏi danh sách AMIS? (Dữ liệu gốc vẫn giữ, chỉ xóa số chứng từ)")) return;
      
      if (row.type === 'external' && onUpdateCustomReceipts) {
          const newR = customReceipts.filter(r => r.id !== row.id);
          onUpdateCustomReceipts(newR);
          return;
      }

      const job = jobs.find(j => j.id === row.jobId);
      if (job && onUpdateJob) {
          const updatedJob = { ...job };
          
          if (row.type === 'deposit_thu') {
              updatedJob.amisDepositDocNo = '';
              updatedJob.amisDepositDesc = '';
          } else if (row.type === 'lc_thu') {
              updatedJob.amisLcDocNo = '';
              updatedJob.amisLcDesc = '';
          } else if (row.type === 'ext_thu') {
              updatedJob.extensions = (updatedJob.extensions || []).map(e => 
                  e.id === row.extensionId ? { ...e, amisDocNo: '', amisDesc: '' } : e
              );
          } else if (row.type === 'payment_chi') {
              updatedJob.amisPaymentDocNo = '';
              updatedJob.amisPaymentDesc = '';
              updatedJob.amisPaymentDate = '';
          } else if (row.type === 'payment_deposit') {
              updatedJob.amisDepositOutDocNo = '';
              updatedJob.amisDepositOutDesc = '';
              updatedJob.amisDepositOutDate = '';
          } else if (row.type === 'payment_ext') {
              updatedJob.amisExtensionPaymentDocNo = '';
              updatedJob.amisExtensionPaymentDesc = '';
              updatedJob.amisExtensionPaymentDate = '';
          }
          
          onUpdateJob(updatedJob);
      }
  };

  const handleSavePayment = (data: any) => {
      if (selectedJobForModal && onUpdateJob) {
          const updatedJob = { ...selectedJobForModal };
          if (paymentType === 'local') {
              updatedJob.amisPaymentDocNo = data.docNo;
              updatedJob.amisPaymentDesc = data.paymentContent;
              updatedJob.amisPaymentDate = data.date;
          } else if (paymentType === 'deposit') {
              updatedJob.amisDepositOutDocNo = data.docNo;
              updatedJob.amisDepositOutDesc = data.paymentContent;
              updatedJob.amisDepositOutDate = data.date;
          } else if (paymentType === 'extension') {
              updatedJob.amisExtensionPaymentDocNo = data.docNo;
              updatedJob.amisExtensionPaymentDesc = data.paymentContent;
              updatedJob.amisExtensionPaymentDate = data.date;
          }
          onUpdateJob(updatedJob);
          setIsPaymentModalOpen(false);
      }
  };

  // --- EXPORT WITH EXCELJS (PRESERVES STYLES) ---
  const handleExport = async () => {
    const rowsToExport = selectedIds.size > 0 ? exportData.filter(d => selectedIds.has(d.docNo)) : [];
    if (rowsToExport.length === 0) {
        alert("Vui lòng chọn ít nhất một phiếu để xuất Excel.");
        return;
    }

    const workbook = new ExcelJS.Workbook();

    if (templateBuffer) {
        await workbook.xlsx.load(templateBuffer);
    } else {
        workbook.addWorksheet("Amis Export");
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return;

    const START_ROW = 9;
    const styleRow = templateBuffer ? worksheet.getRow(START_ROW) : null;

    rowsToExport.forEach((data, index) => {
        const currentRowIndex = START_ROW + index;
        const row = worksheet.getRow(currentRowIndex);

        if (styleRow && currentRowIndex > START_ROW) {
             for(let i = 1; i <= styleRow.cellCount; i++) {
                 const sourceCell = styleRow.getCell(i);
                 const targetCell = row.getCell(i);
                 targetCell.style = sourceCell.style;
                 if (sourceCell.border) targetCell.border = sourceCell.border;
                 if (sourceCell.fill) targetCell.fill = sourceCell.fill;
                 if (sourceCell.font) targetCell.font = sourceCell.font;
                 if (sourceCell.alignment) targetCell.alignment = sourceCell.alignment;
             }
             row.height = styleRow.height;
        }

        if (mode === 'thu') {
            row.getCell(1).value = formatDateVN(data.date);
            row.getCell(2).value = formatDateVN(data.date);
            row.getCell(3).value = data.docNo;
            row.getCell(4).value = data.objCode;
            row.getCell(5).value = data.objName;
            row.getCell(7).value = "345673979999";
            row.getCell(8).value = "Ngân hàng TMCP Quân đội (MB)";
            row.getCell(9).value = "Thu khác";
            row.getCell(10).value = data.desc;
            row.getCell(12).value = "VND";
            row.getCell(14).value = data.desc;
            row.getCell(15).value = data.tkNo;
            row.getCell(16).value = data.tkCo;
            row.getCell(17).value = data.amount;
            row.getCell(19).value = data.objCode;
        } else if (mode === 'chi') {
            row.getCell(1).value = "Ủy nhiệm chi";
            row.getCell(2).value = formatDateVN(data.date);
            row.getCell(3).value = formatDateVN(data.date);
            row.getCell(4).value = data.docNo;
            row.getCell(5).value = "Chi khác";
            row.getCell(6).value = data.paymentContent || data.desc;
            row.getCell(7).value = "345673979999";
            row.getCell(8).value = "Ngân hàng TMCP Quân đội";
            row.getCell(9).value = data.objCode;
            row.getCell(10).value = data.objName;
            row.getCell(19).value = "VND";
            row.getCell(21).value = data.paymentContent || data.desc;
            row.getCell(22).value = data.tkNo;
            row.getCell(23).value = data.tkCo;
            row.getCell(24).value = data.amount;
            row.getCell(26).value = data.objCode;
        }
        
        row.commit();
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileNameMap: Record<string, string> = {
      thu: "Phieuthu.xlsx",
      chi: "Phieuchi.xlsx",
      ban: "Banhang.xlsx",
      mua: "Muahang.xlsx"
    };
    const fileName = fileNameMap[mode] || `Export_${mode}.xlsx`;

    try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        formData.append("file", blob, fileName);
        formData.append("targetDir", "E:\\ServerData");

        const response = await axios.post(`${BACKEND_URL}/save-excel`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        
        if (response.data?.success) {
            alert(`Đã xuất và lưu file "${fileName}" vào E:\\ServerData thành công!`);
        } else {
            throw new Error(response.data?.message || "Server did not confirm save.");
        }

    } catch (err) {
        console.warn("Không thể lưu trực tiếp vào Server (Offline hoặc chưa cấu hình API). Đang tải xuống máy...", err);
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.URL.revokeObjectURL(url);
    }

    const idsToLock = Array.from(selectedIds);
    if (idsToLock.length > 0) {
        onToggleLock(idsToLock);
    }

    setSelectedIds(new Set());
  };

  const titles = { thu: 'Phiếu Thu Tiền', chi: 'Phiếu Chi Tiền', ban: 'Phiếu Bán Hàng', mua: 'Phiếu Mua Hàng' };
  const unlockedCount = exportData.filter(r => !lockedIds.has(r.docNo)).length;
  const isAllSelected = unlockedCount > 0 && selectedIds.size === unlockedCount;

  const handleSelectAll = () => {
    const unlockedRows = exportData.filter(r => !lockedIds.has(r.docNo));
    if (selectedIds.size === unlockedRows.length && unlockedRows.length > 0) setSelectedIds(new Set());
    else {
        const newSet = new Set<string>();
        unlockedRows.forEach(r => newSet.add(r.docNo));
        setSelectedIds(newSet);
    }
  };

  const handleSelectRow = (id: string) => {
    if (lockedIds.has(id)) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
  };

  return (
    <div className="p-8 max-w-full">
      <input type="file" ref={fileInputRef} onChange={handleTemplateUpload} accept=".xlsx, .xls" className="hidden" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className={`p-2 rounded-lg ${mode === 'chi' ? 'bg-red-100 text-red-700' : mode === 'ban' ? 'bg-purple-100 text-purple-700' : mode === 'mua' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
             {mode === 'chi' ? <Banknote className="w-6 h-6" /> : mode === 'ban' ? <ShoppingCart className="w-6 h-6" /> : mode === 'mua' ? <ShoppingBag className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
           </div>
           <h1 className="text-3xl font-bold">Xuất Dữ Liệu AMIS</h1>
        </div>
        <p className="text-slate-500 ml-11 mb-4">Kết xuất dữ liệu kế toán: <span className="font-bold text-blue-600">{titles[mode]}</span></p>
        
        {/* Toolbar */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-white/40 flex justify-between items-center sticky top-0 z-20">
           <div className="flex items-center space-x-4">
              <div className="flex items-center text-slate-500 font-medium"><Filter className="w-4 h-4 mr-2" /> Lọc tháng:</div>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 glass-input rounded-lg text-sm w-48 focus:ring-0 outline-none">
                <option value="">Tất cả</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
           </div>
           <div className="flex space-x-2">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploadingTemplate}
                className="glass-panel hover:bg-white/80 px-4 py-2 rounded-lg flex items-center space-x-2 text-slate-700 transition-colors"
                title="Tải file mẫu từ máy tính lên server"
              >
                 {isUploadingTemplate ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                 ) : (
                    templateBuffer ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />
                 )} 
                 <span className="flex flex-col items-start text-xs">
                    <span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>
                    {templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}
                 </span>
              </button>

              {/* THU KHÁC BUTTON */}
              {mode === 'thu' && (
                  <button 
                    onClick={() => {
                        const dummyJob = { ...INITIAL_JOB, id: `EXT-${Date.now()}`, jobCode: 'THU-KHAC', localChargeDate: new Date().toISOString().split('T')[0], amisLcDocNo: `NTTK${Math.floor(10000+Math.random()*90000)}`, amisLcDesc: 'Thu tiền khác' };
                        setQuickReceiveJob(dummyJob);
                        setQuickReceiveMode('other');
                        setIsQuickReceiveOpen(true);
                    }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-md transition-all transform active:scale-95"
                  >
                      <Wallet className="w-5 h-5" /> <span>Thu Khác</span>
                  </button>
              )}

              <button onClick={handleExport} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg hover:shadow-green-500/30 transition-all transform active:scale-95">
                  <FileSpreadsheet className="w-5 h-5" /> <span>{selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel'}</span>
              </button>
           </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm border border-white/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-700 font-bold border-b border-white/30 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 w-10 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={isAllSelected} onChange={handleSelectAll} />
                </th>
                <th className="px-6 py-3 w-10 text-center">Khóa</th>
                <th className="px-6 py-3">Ngày CT</th>
                <th className="px-6 py-3">Số CT</th>
                <th className="px-6 py-3">Mã Đối Tượng</th>
                <th className="px-6 py-3">Diễn giải</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                <th className="px-6 py-3 text-center w-28">Chức năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {exportData.length > 0 ? (
                 exportData.map((row: any, idx) => {
                   const isLocked = lockedIds.has(row.docNo);
                   const isSelected = selectedIds.has(row.docNo);
                   const rowKey = row.rowId || `${row.type}-${row.docNo}-${idx}`;
                   
                   return (
                   <tr key={rowKey} className={`${isLocked ? 'bg-slate-100/50 text-gray-500' : 'hover:bg-white/30'} ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-6 py-3 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(row.docNo)} disabled={isLocked} className="w-4 h-4 rounded border-gray-300" />
                      </td>
                      <td className="px-6 py-3 text-center">
                           <button onClick={() => { onToggleLock(row.docNo); const newS = new Set(selectedIds); newS.delete(row.docNo); setSelectedIds(newS); }} className="text-gray-400 hover:text-blue-600">
                              {isLocked ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 opacity-30" />}
                           </button>
                      </td>
                      <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                      <td className={`px-6 py-3 font-medium ${isLocked ? 'text-gray-600' : 'text-blue-600'}`}>{row.docNo}</td>
                      <td className="px-6 py-3">{row.objCode}</td>
                      
                      <td className="px-6 py-3 max-w-xs group relative">
                          <div className="flex items-center justify-between">
                              <span className="truncate mr-2" title={row.desc}>{row.desc}</span>
                              <button onClick={() => handleCopy(row.desc, `desc-${rowKey}`)} className="text-slate-300 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {copiedId === `desc-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                          </div>
                      </td>

                      <td className="px-6 py-3 text-right font-medium group relative">
                          <div className="flex items-center justify-end">
                              <span className="mr-2">{formatCurrency(row.amount)}</span>
                              <button onClick={() => handleCopy(row.amount.toString(), `amt-${rowKey}`)} className="text-slate-300 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {copiedId === `amt-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                          </div>
                      </td>
                      
                      <td className="px-6 py-3 text-center">
                          {!isLocked && (
                              <div className="flex justify-center space-x-2">
                                  <button onClick={() => handleEdit(row)} className="text-gray-400 hover:text-blue-500 p-1.5"><Edit3 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDelete(row)} className="text-gray-400 hover:text-red-500 p-1.5"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          )}
                      </td>
                   </tr>
                 )})
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK RECEIVE MODAL FOR THU & THU KHAC */}
      {isQuickReceiveOpen && quickReceiveJob && (
          <QuickReceiveModal 
              isOpen={isQuickReceiveOpen}
              onClose={() => setIsQuickReceiveOpen(false)}
              onSave={(updatedJob) => {
                  if (quickReceiveMode === 'other' && onUpdateCustomReceipts) {
                      const newReceipt = { id: updatedJob.id, type: 'external', date: updatedJob.localChargeDate, docNo: updatedJob.amisLcDocNo, objCode: updatedJob.customerId, objName: updatedJob.customerName, desc: updatedJob.amisLcDesc, amount: updatedJob.localChargeTotal };
                      const exists = customReceipts.findIndex(r => r.id === updatedJob.id);
                      if (exists >= 0) { const updated = [...customReceipts]; updated[exists] = newReceipt; onUpdateCustomReceipts(updated); }
                      else onUpdateCustomReceipts([...customReceipts, newReceipt]);
                  } else if (onUpdateJob) onUpdateJob(updatedJob);
                  setIsQuickReceiveOpen(false);
              }}
              job={quickReceiveJob}
              mode={quickReceiveMode}
              customers={customers}
              targetExtensionId={targetExtensionId}
              allJobs={jobs}
          />
      )}

      {/* PAYMENT MODAL FOR CHI */}
      {isPaymentModalOpen && selectedJobForModal && (
          <PaymentVoucherModal 
              isOpen={isPaymentModalOpen}
              onClose={() => setIsPaymentModalOpen(false)}
              onSave={handleSavePayment}
              job={selectedJobForModal}
              type={paymentType}
          />
      )}

    </div>
  );
};
