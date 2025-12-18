
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine, INITIAL_JOB } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, Banknote, ShoppingCart, ShoppingBag, Loader2, Wallet, Plus, Trash2, Copy, Check, RotateCcw } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx'; 
import ExcelJS from 'exceljs'; 
import { formatDateVN, calculateBookingSummary, parseDateVN, generateNextDocNo } from '../utils';
import { PaymentVoucherModal } from '../components/PaymentVoucherModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseInvoiceModal } from '../components/PurchaseInvoiceModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { JobModal } from '../components/JobModal';
import axios from 'axios';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  lines?: ShippingLine[]; 
  onAddLine?: (line: string) => void;
  onAddCustomer?: (customer: Customer) => void;
  mode: 'thu' | 'chi' | 'ban' | 'mua';
  onUpdateJob?: (job: JobData) => void;
  lockedIds: Set<string>;
  onToggleLock: (docNo: string | string[]) => void;
  customReceipts?: any[];
  onUpdateCustomReceipts?: (receipts: any[]) => void;
}

const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Invoice"; 

const TEMPLATE_MAP: Record<string, string> = {
  thu: "Phieu_thu_Mau.xlsx",
  chi: "Phieu_chi_Mau.xlsx",
  ban: "Ban_hang_Mau.xlsx",
  mua: "Mua_hang_Mau.xlsx"
};

// GLOBAL CACHE
const GLOBAL_TEMPLATE_CACHE: Record<string, { buffer: ArrayBuffer, name: string }> = {};

export const AmisExport: React.FC<AmisExportProps> = ({ 
    jobs, customers, lines = [], onAddLine, onAddCustomer,
    mode, onUpdateJob, lockedIds, onToggleLock, customReceipts = [], onUpdateCustomReceipts 
}) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Template State
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
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobData | null>(null);

  // Job Modal for Legacy Editing
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);

  // Sales Invoice Modal State (New)
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [salesJob, setSalesJob] = useState<JobData | null>(null);
  const [salesInitialData, setSalesInitialData] = useState<any>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTemplateFileName = TEMPLATE_MAP[mode] || "AmisTemplate.xlsx";

  // COLLECT ALL USED DOC NOS from Custom Receipts AND Additional Receipts
  const customDocNos = useMemo(() => {
      const customs = customReceipts.map(r => r.docNo).filter(Boolean);
      const additionals: string[] = [];
      
      // Collect from Jobs
      jobs.forEach(j => {
          if (j.additionalReceipts) {
              j.additionalReceipts.forEach(r => { if(r.docNo) additionals.push(r.docNo); });
          }
      });
      
      // Collect from Custom Receipts (Thu Khac)
      customReceipts.forEach(r => {
          if (r.additionalReceipts) {
              r.additionalReceipts.forEach((ar: any) => { if(ar.docNo) additionals.push(ar.docNo); });
          }
      });

      return [...customs, ...additionals];
  }, [customReceipts, jobs]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, filterMonth]);

  useEffect(() => {
    const loadTemplate = async () => {
        if (GLOBAL_TEMPLATE_CACHE[mode]) {
            setTemplateBuffer(GLOBAL_TEMPLATE_CACHE[mode].buffer);
            setTemplateName(GLOBAL_TEMPLATE_CACHE[mode].name);
            return;
        }
        setIsLoadingTemplate(true);
        setTemplateBuffer(null); 
        setTemplateName('');
        try {
            const staticUrl = `${BACKEND_URL}/uploads/${TEMPLATE_FOLDER}/${currentTemplateFileName}?v=${Date.now()}`;
            const response = await axios.get(staticUrl, { responseType: 'arraybuffer' });
            if (response.status === 200 && response.data) {
                const buffer = response.data;
                const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
                GLOBAL_TEMPLATE_CACHE[mode] = { buffer, name: `${displayName} (Server)` };
                setTemplateBuffer(buffer);
                setTemplateName(`${displayName} (Server)`);
            }
        } catch (error) {
            console.log(`Chưa có file mẫu ${currentTemplateFileName} trên server.`);
        } finally {
            setIsLoadingTemplate(false);
        }
    };
    loadTemplate();
  }, [mode, currentTemplateFileName]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getCustomerCode = (id: string) => customers.find(c => c.id === id)?.code || id;
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || '';

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingTemplate(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (evt.target?.result) {
          const buffer = evt.target.result as ArrayBuffer;
          const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
          const statusName = `${displayName} (Mới cập nhật)`;
          setTemplateBuffer(buffer);
          setTemplateName(statusName);
          GLOBAL_TEMPLATE_CACHE[mode] = { buffer, name: statusName };
          try {
              const formData = new FormData();
              formData.append("folderPath", TEMPLATE_FOLDER);
              formData.append("fileName", currentTemplateFileName);
              formData.append("file", file);
              await axios.post(`${BACKEND_URL}/upload-file`, formData);
              alert(`Đã lưu mẫu "${displayName}" cho phần ${mode.toUpperCase()} thành công!`);
          } catch (err) {
              console.error("Lỗi upload mẫu:", err);
              alert("Lưu mẫu lên server thất bại, nhưng sẽ dùng mẫu này tạm thời.");
          } finally {
              setIsUploadingTemplate(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const checkMonth = (dateStr?: string | null) => {
      if (!filterMonth) return true;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      return (date.getMonth() + 1).toString() === filterMonth;
  };

  // --- HELPER FOR GROUPING ---
  const addToGroupMap = (map: Map<string, any>, item: any) => {
      const key = `${item.type}_${item.docNo}`;
      if (map.has(key)) {
          const existing = map.get(key);
          existing.amount += item.amount;
          // Keep the description that is longer as it likely contains merged info
          if (item.desc && item.desc.length > existing.desc.length) {
              existing.desc = item.desc;
          }
          // Preserve main Job ID link if the existing one was a "child" or "add" row
          if (!existing.jobId && item.jobId) existing.jobId = item.jobId;
          if (existing.rowId.includes('add') && !item.rowId.includes('add')) {
              existing.jobId = item.jobId;
              existing.rowId = item.rowId;
          }
      } else {
          map.set(key, { ...item });
      }
  };

  const exportData = useMemo(() => {
    // --- MODE THU ---
    if (mode === 'thu') {
      const groupMap = new Map<string, any>();

      // 1. Thu Cược
      jobs.forEach(j => {
         // Main Receipt
         if (j.amisDepositDocNo && checkMonth(j.ngayThuCuoc)) {
             const amt = j.amisDepositAmount !== undefined ? j.amisDepositAmount : j.thuCuoc;
             addToGroupMap(groupMap, {
                 jobId: j.id, type: 'deposit_thu', rowId: `dep-${j.id}`,
                 date: j.ngayThuCuoc, docNo: j.amisDepositDocNo, 
                 objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
                 desc: j.amisDepositDesc || `Thu tiền khách hàng CƯỢC BL ${j.jobCode}`, 
                 amount: amt, 
                 tkNo: '1121', tkCo: '1388', 
             });
         }
         // Additional Receipts (Multi-payment)
         (j.additionalReceipts || []).forEach(r => {
             if (r.type === 'deposit' && checkMonth(r.date)) {
                 addToGroupMap(groupMap, {
                     jobId: j.id, type: 'deposit_thu', rowId: `dep-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '1388'
                 });
             }
         });
      });

      // 2. Thu Local Charge
      jobs.forEach(j => {
          // Main Receipt
          if (j.amisLcDocNo && checkMonth(j.localChargeDate)) {
               const amt = j.amisLcAmount !== undefined ? j.amisLcAmount : j.localChargeTotal;
               addToGroupMap(groupMap, {
                   jobId: j.id, type: 'lc_thu', rowId: `lc-${j.id}`,
                   date: j.localChargeDate, docNo: j.amisLcDocNo, 
                   objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                   desc: j.amisLcDesc || `Thu tiền khách hàng theo hoá đơn ${j.localChargeInvoice} (KIM)`, 
                   amount: amt,
                   tkNo: '1121', tkCo: '13111',
               });
          }
          // Additional Receipts (Multi-payment)
          (j.additionalReceipts || []).forEach(r => {
             if (r.type === 'local' && checkMonth(r.date)) {
                 addToGroupMap(groupMap, {
                     jobId: j.id, type: 'lc_thu', rowId: `lc-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '13111'
                 });
             }
         });
      });

      // 3. Thu Extension
      jobs.forEach(j => {
          (j.extensions || []).forEach((ext) => {
              if (ext.amisDocNo && checkMonth(ext.invoiceDate)) {
                  const amt = ext.amisAmount !== undefined ? ext.amisAmount : ext.total;
                  addToGroupMap(groupMap, {
                      jobId: j.id, type: 'ext_thu', extensionId: ext.id, rowId: `ext-${ext.id}`,
                      date: ext.invoiceDate, docNo: ext.amisDocNo, 
                      objCode: getCustomerCode(ext.customerId || j.customerId), objName: getCustomerName(ext.customerId || j.customerId),
                      desc: ext.amisDesc || `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`, 
                      amount: amt, 
                      tkNo: '1121', tkCo: '13111',
                  });
              }
          });
          // Additional Receipts for Extension (Multi-payment)
          (j.additionalReceipts || []).forEach(r => {
             if (r.type === 'extension' && checkMonth(r.date)) {
                 const extTarget = (j.extensions || []).find(e => e.id === r.extensionId);
                 const custId = extTarget ? (extTarget.customerId || j.customerId) : j.customerId;
                 addToGroupMap(groupMap, {
                     jobId: j.id, type: 'ext_thu', extensionId: r.extensionId, rowId: `ext-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(custId), objName: getCustomerName(custId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '13111'
                 });
             }
         });
      });

      // 4. Thu Khác (External + Multi-Payment of type 'other')
      customReceipts.forEach(r => {
          if (checkMonth(r.date)) {
              const descUpper = (r.desc || '').toUpperCase();
              const isDeposit = descUpper.includes('CƯỢC') || descUpper.includes('DEPOSIT') || r.type === 'deposit';
              const tkCo = isDeposit ? '1388' : '13111';
              
              addToGroupMap(groupMap, { ...r, jobId: r.id, type: 'external', rowId: `custom-${r.id}`, tkNo: '1121', tkCo });

              if (r.additionalReceipts && Array.isArray(r.additionalReceipts)) {
                  r.additionalReceipts.forEach((ar: any) => {
                      if (checkMonth(ar.date)) {
                          const arDescUpper = (ar.desc || '').toUpperCase();
                          const arIsDeposit = ar.type === 'deposit' || arDescUpper.includes('CƯỢC');
                          const arTkCo = arIsDeposit ? '1388' : '13111';
                          
                          addToGroupMap(groupMap, {
                              jobId: r.id, 
                              type: 'external',
                              rowId: `custom-add-${ar.id}`,
                              date: ar.date,
                              docNo: ar.docNo,
                              objCode: r.objCode,
                              objName: r.objName,
                              desc: ar.desc,
                              amount: ar.amount,
                              tkNo: '1121',
                              tkCo: arTkCo
                          });
                      }
                  });
              }
          }
      });

      const rows = Array.from(groupMap.values());
      return rows.sort((a, b) => (a.docNo || '').localeCompare(b.docNo || ''));
    } 
    
    // --- MODE CHI ---
    else if (mode === 'chi') {
        const rows: any[] = [];
        const processedDocNos = new Set<string>();
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Chi Payment (Local Charge Out)
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
        
        // 2. Chi Cược (Deposit Out)
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

        // 3. Chi Gia Hạn (Extension Out)
        const processedExtOut = new Set<string>();
        jobs.forEach(j => {
            if (j.amisExtensionPaymentDocNo && !processedExtOut.has(j.amisExtensionPaymentDocNo) && checkMonth(j.amisExtensionPaymentDate)) {
                processedExtOut.add(j.amisExtensionPaymentDocNo);
                let amount = 0;
                if (j.amisExtensionPaymentAmount && j.amisExtensionPaymentAmount > 0) {
                    amount = j.amisExtensionPaymentAmount;
                } else {
                    if (j.booking) {
                        const summary = calculateBookingSummary(jobs, j.booking);
                        amount = (summary?.costDetails.extensionCosts || []).reduce((s,e) => s+e.total, 0);
                    }
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

        // 4. Chi Hoàn Cược (Deposit Refund to Customer)
        const processedRefunds = new Set<string>();
        jobs.forEach(j => {
            if (j.amisDepositRefundDocNo && !processedRefunds.has(j.amisDepositRefundDocNo) && checkMonth(j.amisDepositRefundDate)) {
                processedRefunds.add(j.amisDepositRefundDocNo);
                const groupJobs = jobs.filter(subJ => subJ.amisDepositRefundDocNo === j.amisDepositRefundDocNo);
                const totalRefund = groupJobs.reduce((sum, item) => sum + (item.thuCuoc || 0), 0);

                rows.push({
                     jobId: j.id, type: 'payment_refund', rowId: `pay-ref-${j.id}`, 
                     date: j.amisDepositRefundDate || todayStr, docNo: j.amisDepositRefundDocNo,
                     objCode: getCustomerCode(j.maKhCuocId || j.customerId), objName: getCustomerName(j.maKhCuocId || j.customerId), 
                     desc: j.amisDepositRefundDesc, amount: totalRefund,
                     reason: 'Chi hoàn cược', paymentContent: j.amisDepositRefundDesc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisDepositRefundDesc, tkNo: '1388', tkCo: '1121',
                });
            }
        });

        // 5. Chi Hoàn Local Charge (Local Charge Refund to Customer)
        const processedLcRefunds = new Set<string>();
        jobs.forEach(j => {
            if (j.amisLcRefundDocNo && !processedLcRefunds.has(j.amisLcRefundDocNo) && checkMonth(j.amisLcRefundDate)) {
                processedLcRefunds.add(j.amisLcRefundDocNo);
                const totalRefund = j.amisLcRefundAmount || 0;

                rows.push({
                     jobId: j.id, type: 'lc_refund', rowId: `pay-lc-ref-${j.id}`, 
                     date: j.amisLcRefundDate || todayStr, docNo: j.amisLcRefundDocNo,
                     objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId), 
                     desc: j.amisLcRefundDesc, amount: totalRefund,
                     reason: 'Chi khác', paymentContent: j.amisLcRefundDesc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisLcRefundDesc, tkNo: '13111', tkCo: '1121',
                });
            }
        });

        return rows.sort((a, b) => (a.docNo || '').localeCompare(b.docNo || ''));
    }
    else if (mode === 'ban') {
        const rows: any[] = [];
        let validJobs = jobs.filter(j => {
            const hasSell = j.sell > 0;
            const name = (j.customerName || '').toLowerCase();
            return hasSell && (name.includes('long hoàng') || name.includes('lhk') || name.includes('long hoang') || name.includes('longhoang'));
        });
        if (filterMonth) validJobs = validJobs.filter(j => j.month === filterMonth);
        validJobs.sort((a, b) => {
            const monthDiff = Number(a.month) - Number(b.month); 
            if (monthDiff !== 0) return monthDiff;
            return String(a.booking || '').trim().toLowerCase().localeCompare(String(b.booking || '').trim().toLowerCase());
        });
        const bookingToDocNoMap = new Map<string, string>();
        let currentDocNum = 1;
        const currentYear = new Date().getFullYear();
        validJobs.forEach(j => {
            const bookingKey = String(j.booking || '').trim();
            let docNo = bookingKey && bookingToDocNoMap.has(bookingKey) ? bookingToDocNoMap.get(bookingKey)! : `BH${String(currentDocNum++).padStart(5, '0')}`;
            if (bookingKey && !bookingToDocNoMap.has(bookingKey)) bookingToDocNoMap.set(bookingKey, docNo);
            const yy = currentYear.toString().slice(-2);
            const mm = (j.month || '01').padStart(2, '0');
            const projectCode = `K${yy}${mm}${j.jobCode}`;
            const monthInt = parseInt(j.month || '1', 10);
            const dateStr = `${currentYear}-${String(monthInt).padStart(2, '0')}-${String(Math.min(30, new Date(currentYear, monthInt, 0).getDate())).padStart(2, '0')}`;
            rows.push({ jobId: j.id, type: 'ban', rowId: `ban-${j.id}`, date: dateStr, docNo: docNo, objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId), desc: `Bán hàng LONG HOÀNG - KIMBERRY BILL ${j.booking || ''} là cost ${j.hbl || ''}`, amount: j.sell, projectCode: projectCode });
        });
        return rows.sort((a, b) => a.docNo.localeCompare(b.docNo));
    }
    else if (mode === 'mua') {
        const rawItems: any[] = [];
        const processedBookings = new Set<string>();
        jobs.forEach(j => {
            if (filterMonth && j.month !== filterMonth) return;
            if (j.booking) {
                if (processedBookings.has(j.booking)) return;
                processedBookings.add(j.booking);
                const details = j.bookingCostDetails;
                if (!details) return;
                const lineObj = lines.find(l => l.code === j.line);
                const supplierName = lineObj ? lineObj.name : j.line;
                const defaultItemName = lineObj?.itemName || 'Phí Local Charge';
                const lc = details.localCharge;
                let lcTotal = lc.hasInvoice === false ? (lc.total || 0) : ((lc.net || 0) + (lc.vat || 0));
                let lcNet = lc.hasInvoice === false ? Math.round(lcTotal / 1.05) : (lc.net || 0);
                if (lcTotal > 0) rawItems.push({ jobId: j.id, date: lc.date || new Date().toISOString().split('T')[0], invoice: lc.invoice || '', desc: `Mua hàng của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName, itemName: defaultItemName, netAmount: lcNet, vatAmount: lcTotal - lcNet, amount: lcTotal, costType: 'Local charge', sortDate: new Date(lc.date || '1970-01-01').getTime() });
                if (details.additionalLocalCharges) details.additionalLocalCharges.forEach(add => {
                    let aTotal = add.hasInvoice === false ? (add.total || 0) : ((add.net || 0) + (add.vat || 0));
                    let aNet = add.hasInvoice === false ? Math.round(aTotal / 1.05) : (add.net || 0);
                    if (aTotal > 0) rawItems.push({ jobId: j.id, date: add.date || new Date().toISOString().split('T')[0], invoice: add.invoice || '', desc: `Chi phí khác của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName, itemName: defaultItemName, netAmount: aNet, vatAmount: aTotal - aNet, amount: aTotal, costType: 'Local charge', sortDate: new Date(add.date || '1970-01-01').getTime() });
                });
                if (details.extensionCosts) details.extensionCosts.forEach(ext => {
                    if (ext.total > 0) {
                        const eNet = ext.net || Math.round(ext.total / 1.05);
                        rawItems.push({ jobId: j.id, date: ext.date || new Date().toISOString().split('T')[0], invoice: ext.invoice || '', desc: `Phí gia hạn của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName, itemName: 'Phí phát sinh', netAmount: eNet, vatAmount: ext.total - eNet, amount: ext.total, costType: 'Demurrage', sortDate: new Date(ext.date || '1970-01-01').getTime() });
                    }
                });
            } else if (j.cost > 0) {
                const lineObj = lines.find(l => l.code === j.line);
                const supplierName = lineObj ? lineObj.name : j.line;
                const net = Math.round(j.cost / 1.05);
                rawItems.push({ jobId: j.id, date: new Date().toISOString().split('T')[0], invoice: '', desc: `Mua hàng của ${supplierName} Job ${j.jobCode}`, supplierCode: j.line, supplierName, itemName: lineObj?.itemName || 'Phí Local Charge', netAmount: net, vatAmount: j.cost - net, amount: j.cost, costType: 'Local charge', sortDate: Date.now() });
            }
        });
        rawItems.sort((a, b) => a.sortDate - b.sortDate);
        const invoiceToDocMap = new Map<string, string>();
        let currentDocNum = 1;
        const finalRows = rawItems.map(item => {
            const groupKey = item.invoice ? item.invoice.trim().toUpperCase() : `NO_INV_${item.jobId}_${Math.random()}`;
            let docNo = item.invoice && invoiceToDocMap.has(groupKey) ? invoiceToDocMap.get(groupKey)! : `MH${String(currentDocNum++).padStart(5, '0')}`;
            if (item.invoice && !invoiceToDocMap.has(groupKey)) invoiceToDocMap.set(groupKey, docNo);
            return { ...item, type: 'mua', rowId: `mua-${item.jobId}-${docNo}-${Math.random()}`, docNo, invoiceNo: item.invoice, objCode: item.supplierCode, objName: item.supplierName };
        });
        return finalRows.sort((a, b) => a.docNo.localeCompare(b.docNo));
    }
    return [];
  }, [jobs, mode, filterMonth, customers, customReceipts, lines]); 

  // --- HANDLERS FOR EDIT & DELETE ---
  const handleEdit = (row: any) => {
      const job = jobs.find(j => j.id === row.jobId);
      setTargetExtensionId(null);
      if (mode === 'thu') {
          if (row.type === 'external') {
               const receiptId = row.jobId || row.id;
               const fullReceipt = customReceipts.find(r => r.id === receiptId);
               setQuickReceiveJob({ ...INITIAL_JOB, id: fullReceipt ? fullReceipt.id : receiptId, jobCode: 'THU-KHAC', localChargeDate: fullReceipt ? fullReceipt.date : row.date, amisLcDocNo: fullReceipt ? fullReceipt.docNo : row.docNo, amisLcDesc: fullReceipt ? fullReceipt.desc : row.desc, localChargeTotal: fullReceipt ? fullReceipt.amount : row.amount, localChargeInvoice: fullReceipt ? fullReceipt.invoice : (row.invoice || ''), customerId: fullReceipt ? fullReceipt.objCode : row.objCode, customerName: fullReceipt ? fullReceipt.objName : row.objName, additionalReceipts: fullReceipt?.additionalReceipts || [] });
               setQuickReceiveMode('other');
               setIsQuickReceiveOpen(true);
          } else if (job) {
              setQuickReceiveJob(job);
              if (row.type === 'deposit_thu') setQuickReceiveMode('deposit');
              else if (row.type === 'ext_thu') { setQuickReceiveMode('extension'); setTargetExtensionId(row.extensionId); }
              else setQuickReceiveMode('local');
              setIsQuickReceiveOpen(true);
          }
      } 
      else if (mode === 'chi' && job) {
          if (row.type === 'payment_refund' || row.type === 'lc_refund') {
              setQuickReceiveJob(job);
              setQuickReceiveMode(row.type === 'payment_refund' ? 'deposit_refund' : 'local_refund');
              setIsQuickReceiveOpen(true);
          } else {
              setSelectedJobForModal(job);
              if (row.type === 'payment_deposit') setPaymentType('deposit');
              else if (row.type === 'payment_ext') setPaymentType('extension');
              else setPaymentType('local');
              setIsPaymentModalOpen(true);
          }
      }
      else if (mode === 'ban' && job) { setSalesJob(job); setSalesInitialData({ docNo: row.docNo, date: row.date, docDate: row.date, amount: row.amount, description: row.desc, projectCode: row.projectCode }); setIsSalesModalOpen(true); }
      else if (mode === 'mua' && job) { setEditingJob(job); setIsJobModalOpen(true); }
  };

  const handleSaveJobEdit = (updatedJob: JobData, newCustomer?: Customer) => {
      if (onUpdateJob) onUpdateJob(updatedJob);
      if (newCustomer && onAddCustomer) onAddCustomer(newCustomer);
      setIsJobModalOpen(false);
  };

  const handleSaveSales = (data: any) => { setIsSalesModalOpen(false); };

  const handleDelete = (row: any) => {
      if (!window.confirm("Bạn có chắc muốn xóa chứng từ này khỏi danh sách AMIS?")) return;
      if (row.type === 'external' && onUpdateCustomReceipts) { onUpdateCustomReceipts(customReceipts.filter(r => r.id !== row.id)); return; }
      const job = jobs.find(j => j.id === row.jobId);
      if (job && onUpdateJob) {
          const updatedJob = { ...job };
          if (row.type === 'deposit_thu') { if (row.rowId.includes('add')) updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `dep-add-${r.id}` !== row.rowId); else { updatedJob.amisDepositDocNo = ''; updatedJob.amisDepositDesc = ''; updatedJob.amisDepositAmount = 0; } }
          else if (row.type === 'lc_thu') { if (row.rowId.includes('add')) updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `lc-add-${r.id}` !== row.rowId); else { updatedJob.amisLcDocNo = ''; updatedJob.amisLcDesc = ''; updatedJob.amisLcAmount = 0; } }
          else if (row.type === 'ext_thu') { if (row.rowId.includes('add')) updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `ext-add-${r.id}` !== row.rowId); else updatedJob.extensions = (updatedJob.extensions || []).map(e => e.id === row.extensionId ? { ...e, amisDocNo: '', amisDesc: '', amisAmount: 0 } : e); }
          else if (row.type === 'payment_chi') { updatedJob.amisPaymentDocNo = ''; updatedJob.amisPaymentDesc = ''; updatedJob.amisPaymentDate = ''; }
          else if (row.type === 'payment_deposit') { updatedJob.amisDepositOutDocNo = ''; updatedJob.amisDepositOutDesc = ''; updatedJob.amisDepositOutDate = ''; }
          else if (row.type === 'payment_ext') { updatedJob.amisExtensionPaymentDocNo = ''; updatedJob.amisExtensionPaymentDesc = ''; updatedJob.amisExtensionPaymentDate = ''; updatedJob.amisExtensionPaymentAmount = 0; }
          else if (row.type === 'payment_refund') { updatedJob.amisDepositRefundDocNo = ''; updatedJob.amisDepositRefundDesc = ''; updatedJob.amisDepositRefundDate = ''; }
          else if (row.type === 'lc_refund') { updatedJob.amisLcRefundDocNo = ''; updatedJob.amisLcRefundDesc = ''; updatedJob.amisLcRefundDate = ''; updatedJob.amisLcRefundAmount = 0; }
          onUpdateJob(updatedJob);
      }
  };

  const handleSavePayment = (data: any) => {
      if (selectedJobForModal && onUpdateJob) {
          let fields = { doc: 'amisPaymentDocNo', desc: 'amisPaymentDesc', date: 'amisPaymentDate' };
          if (paymentType === 'deposit') fields = { doc: 'amisDepositOutDocNo', desc: 'amisDepositOutDesc', date: 'amisDepositOutDate' };
          else if (paymentType === 'extension') fields = { doc: 'amisExtensionPaymentDocNo', desc: 'amisExtensionPaymentDesc', date: 'amisExtensionPaymentDate' };
          const targetJobs = selectedJobForModal[fields.doc as keyof JobData] ? jobs.filter(j => j[fields.doc as keyof JobData] === selectedJobForModal[fields.doc as keyof JobData]) : [selectedJobForModal];
          targetJobs.forEach(job => {
              const updatedJob = { ...job, [fields.doc]: data.docNo, [fields.date]: data.date };
              if (job.id === selectedJobForModal.id) { (updatedJob as any)[fields.desc] = data.paymentContent; if (paymentType === 'extension' && data.amount > 0) updatedJob.amisExtensionPaymentAmount = data.amount; }
              onUpdateJob(updatedJob);
          });
          setIsPaymentModalOpen(false);
      }
  };

  const handleExport = async () => {
    const rowsToExport = selectedIds.size > 0 ? exportData.filter(d => selectedIds.has(d.docNo)) : [];
    if (rowsToExport.length === 0) { alert("Vui lòng chọn ít nhất một phiếu để xuất Excel."); return; }
    const workbook = new ExcelJS.Workbook();
    if (templateBuffer) await workbook.xlsx.load(templateBuffer);
    else workbook.addWorksheet("Amis Export");
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return;
    const START_ROW = 9;
    const styleRow = templateBuffer ? worksheet.getRow(START_ROW) : null;
    rowsToExport.forEach((data, index) => {
        const currentRowIndex = START_ROW + index;
        const row = worksheet.getRow(currentRowIndex);
        if (styleRow && currentRowIndex > START_ROW) { for(let i = 1; i <= styleRow.cellCount; i++) { const sourceCell = styleRow.getCell(i); const targetCell = row.getCell(i); targetCell.style = sourceCell.style; if (sourceCell.border) targetCell.border = sourceCell.border; if (sourceCell.fill) targetCell.fill = sourceCell.fill; if (sourceCell.font) targetCell.font = sourceCell.font; if (sourceCell.alignment) targetCell.alignment = sourceCell.alignment; } row.height = styleRow.height; }
        if (mode === 'thu') { row.getCell(1).value = formatDateVN(data.date); row.getCell(2).value = formatDateVN(data.date); row.getCell(3).value = data.docNo; row.getCell(4).value = data.objCode; row.getCell(5).value = data.objName; row.getCell(7).value = "345673979999"; row.getCell(8).value = "Ngân hàng TMCP Quân đội (MB)"; row.getCell(9).value = "Thu khác"; row.getCell(10).value = data.desc; row.getCell(12).value = "VND"; row.getCell(14).value = data.desc; row.getCell(15).value = data.tkNo; row.getCell(16).value = data.tkCo; row.getCell(17).value = data.amount; row.getCell(19).value = data.objCode; }
        else if (mode === 'chi') { row.getCell(1).value = "Ủy nhiệm chi"; row.getCell(2).value = formatDateVN(data.date); row.getCell(3).value = formatDateVN(data.date); row.getCell(4).value = data.docNo; row.getCell(5).value = "Chi khác"; row.getCell(6).value = data.paymentContent || data.desc; row.getCell(7).value = "345673979999"; row.getCell(8).value = "Ngân hàng TMCP Quân đội"; row.getCell(9).value = data.objCode; row.getCell(10).value = data.objName; row.getCell(19).value = "VND"; row.getCell(21).value = data.paymentContent || data.desc; row.getCell(22).value = data.tkNo; row.getCell(23).value = data.tkCo; row.getCell(24).value = data.amount; row.getCell(26).value = data.objCode; }
        else if (mode === 'ban') { row.getCell(1).value = "Bán hàng hóa trong nước"; row.getCell(2).value = "Chưa thu tiền"; row.getCell(3).value = "Không"; row.getCell(4).value = "Không"; row.getCell(6).value = formatDateVN(data.date); row.getCell(7).value = formatDateVN(data.date); row.getCell(8).value = data.docNo; row.getCell(14).value = data.objCode; row.getCell(22).value = data.desc; row.getCell(28).value = "VND"; row.getCell(30).value = "AGENT FEE"; row.getCell(33).value = "Không"; row.getCell(36).value = "13112"; row.getCell(37).value = "51111"; row.getCell(39).value = 1; row.getCell(40).value = data.amount; row.getCell(51).value = "0%"; row.getCell(55).value = "33311"; row.getCell(61).value = data.projectCode; }
        else if (mode === 'mua') { row.getCell(1).value = "Mua hàng trong nước không qua kho"; row.getCell(2).value = "Chưa thanh toán"; row.getCell(3).value = "Nhận kèm hóa đơn"; row.getCell(4).value = formatDateVN(data.date); row.getCell(5).value = formatDateVN(data.date); row.getCell(6).value = "1"; row.getCell(7).value = data.docNo; row.getCell(10).value = data.invoiceNo; row.getCell(11).value = formatDateVN(data.date); row.getCell(14).value = data.objCode; row.getCell(19).value = data.desc; row.getCell(26).value = "VND"; row.getCell(28).value = "LCC"; row.getCell(29).value = data.itemName; row.getCell(30).value = "Không"; row.getCell(33).value = "63211"; row.getCell(34).value = "3311"; row.getCell(35).value = "Lô"; row.getCell(36).value = "1"; row.getCell(37).value = data.netAmount; row.getCell(43).value = "5%"; row.getCell(45).value = data.vatAmount; }
        row.commit();
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = mode === 'thu' ? "Phieuthu.xlsx" : (mode === 'chi' ? "Phieuchi.xlsx" : (mode === 'ban' ? "Banhang.xlsx" : "Muahang.xlsx"));
    try { const formData = new FormData(); formData.append("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName); formData.append("targetDir", "E:\\ServerData"); const response = await axios.post(`${BACKEND_URL}/save-excel`, formData); if (response.data?.success) alert(`Đã xuất và lưu file "${fileName}" vào E:\\ServerData thành công!`); else throw new Error(); } catch { const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = window.URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.URL.revokeObjectURL(url); }
    if (selectedIds.size > 0) onToggleLock(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const unlockedCount = exportData.filter(r => !lockedIds.has(r.docNo)).length;
  return (
    <div className="p-8 max-w-full">
      <input type="file" ref={fileInputRef} onChange={handleTemplateUpload} accept=".xlsx, .xls" className="hidden" />
      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className={`p-2 rounded-lg ${mode === 'chi' ? 'bg-red-100 text-red-700' : mode === 'ban' ? 'bg-purple-100 text-purple-700' : mode === 'mua' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
             {mode === 'chi' ? <Banknote className="w-6 h-6" /> : mode === 'ban' ? <ShoppingCart className="w-6 h-6" /> : mode === 'mua' ? <ShoppingBag className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
           </div>
           <h1 className="text-3xl font-bold">Xuất Dữ Liệu AMIS</h1>
        </div>
        <p className="text-slate-500 ml-11 mb-4">Kết xuất dữ liệu kế toán: <span className="font-bold text-blue-600">{mode === 'thu' ? 'Phiếu Thu' : (mode === 'chi' ? 'Phiếu Chi' : (mode === 'ban' ? 'Phiếu Bán Hàng' : 'Phiếu Mua Hàng'))}</span></p>
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-white/40 flex justify-between items-center sticky top-0 z-20">
           <div className="flex items-center space-x-4">
              <div className="flex items-center text-slate-500 font-medium"><Filter className="w-4 h-4 mr-2" /> Lọc tháng:</div>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 glass-input rounded-lg text-sm w-48 focus:ring-0 outline-none">
                <option value="">Tất cả</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
           </div>
           <div className="flex space-x-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingTemplate} className="glass-panel hover:bg-white/80 px-4 py-2 rounded-lg flex items-center space-x-2 text-slate-700 transition-colors">
                 {isUploadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : (templateBuffer ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />)} 
                 <span className="flex flex-col items-start text-xs"><span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>{templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}</span>
              </button>
              {mode === 'thu' && (
                  <button onClick={() => { const nextDocNo = generateNextDocNo(jobs, 'NTTK', 5, customDocNos); setQuickReceiveJob({ ...INITIAL_JOB, id: `EXT-${Date.now()}`, jobCode: 'THU-KHAC', localChargeDate: new Date().toISOString().split('T')[0], amisLcDocNo: nextDocNo, amisLcDesc: 'Thu tiền khác' }); setQuickReceiveMode('other'); setIsQuickReceiveOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-md transform active:scale-95 transition-all"><Wallet className="w-5 h-5" /> <span>Thu Khác</span></button>
              )}
              <button onClick={handleExport} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg hover:shadow-green-500/30 transform active:scale-95 transition-all"><FileSpreadsheet className="w-5 h-5" /> <span>{selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel'}</span></button>
           </div>
        </div>
      </div>
      <div className="glass-panel rounded-2xl shadow-sm border border-white/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-700 font-bold border-b border-white/30 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 w-10 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={unlockedCount > 0 && selectedIds.size === unlockedCount} onChange={() => { if (selectedIds.size === unlockedCount) setSelectedIds(new Set()); else { const newSet = new Set<string>(); exportData.filter(r => !lockedIds.has(r.docNo)).forEach(r => newSet.add(r.docNo)); setSelectedIds(newSet); } }} /></th>
                <th className="px-6 py-3 w-10 text-center">Khóa</th>
                <th className="px-6 py-3">Ngày CT</th>
                <th className="px-6 py-3">Số CT</th>
                <th className="px-6 py-3">Mã Đối Tượng</th>
                <th className="px-6 py-3">Diễn giải</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                {mode === 'mua' && <th className="px-6 py-3"></th>}
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
                      <td className="px-6 py-3 text-center"><input type="checkbox" checked={isSelected} onChange={() => { if (isLocked) return; const newSet = new Set(selectedIds); if (newSet.has(row.docNo)) newSet.delete(row.docNo); else newSet.add(row.docNo); setSelectedIds(newSet); }} disabled={isLocked} className="w-4 h-4 rounded border-gray-300" /></td>
                      <td className="px-6 py-3 text-center"><button onClick={() => { onToggleLock(row.docNo); const newS = new Set(selectedIds); newS.delete(row.docNo); setSelectedIds(newS); }} className="text-gray-400 hover:text-blue-600">{isLocked ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 opacity-30" />}</button></td>
                      <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                      <td className={`px-6 py-3 font-medium ${isLocked ? 'text-gray-600' : 'text-blue-600'}`}>{row.docNo}</td>
                      <td className="px-6 py-3">{row.objCode}</td>
                      <td className="px-6 py-3 max-w-xs group relative"><div className="flex items-center justify-between"><span className="truncate mr-2" title={row.desc}>{row.desc}</span><button onClick={() => { navigator.clipboard.writeText(row.desc); setCopiedId(`desc-${rowKey}`); setTimeout(() => setCopiedId(null), 1000); }} className="text-slate-300 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">{copiedId === `desc-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</button></div></td>
                      <td className="px-6 py-3 text-right font-medium group relative"><div className="flex items-center justify-end"><span className="mr-2">{formatCurrency(row.amount)}</span><button onClick={() => { navigator.clipboard.writeText(row.amount.toString()); setCopiedId(`amt-${rowKey}`); setTimeout(() => setCopiedId(null), 1000); }} className="text-slate-300 hover:text-blue-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">{copiedId === `amt-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</button></div></td>
                      {mode === 'mua' && <td className="px-6 py-3 text-slate-500 text-xs italic">{row.costType}</td>}
                      <td className="px-6 py-3 text-center">{!isLocked && <div className="flex justify-center space-x-2"><button onClick={() => handleEdit(row)} className="text-gray-400 hover:text-blue-500 p-1.5"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDelete(row)} className="text-gray-400 hover:text-red-500 p-1.5"><Trash2 className="w-4 h-4" /></button></div>}</td>
                   </tr>
                 )})
              ) : (<tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu phù hợp</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {isQuickReceiveOpen && quickReceiveJob && <QuickReceiveModal isOpen={isQuickReceiveOpen} onClose={() => setIsQuickReceiveOpen(false)} onSave={(updatedJob) => { if (quickReceiveMode === 'other' && onUpdateCustomReceipts) { const foundCust = customers.find(c => c.id === updatedJob.customerId); const finalObjCode = foundCust ? foundCust.code : updatedJob.customerId; const newReceipt = { id: updatedJob.id, type: 'external', date: updatedJob.localChargeDate, docNo: updatedJob.amisLcDocNo, objCode: finalObjCode, objName: updatedJob.customerName, desc: updatedJob.amisLcDesc, amount: updatedJob.amisLcAmount !== undefined ? updatedJob.amisLcAmount : updatedJob.localChargeTotal, invoice: updatedJob.localChargeInvoice, additionalReceipts: updatedJob.additionalReceipts }; const exists = customReceipts.findIndex(r => r.id === updatedJob.id); if (exists >= 0) { const updated = [...customReceipts]; updated[exists] = newReceipt; onUpdateCustomReceipts(updated); } else onUpdateCustomReceipts([...customReceipts, newReceipt]); } else if (onUpdateJob) onUpdateJob(updatedJob); setIsQuickReceiveOpen(false); }} job={quickReceiveJob} mode={quickReceiveMode} customers={customers} targetExtensionId={targetExtensionId} allJobs={jobs} usedDocNos={customDocNos} />}
      {isPaymentModalOpen && selectedJobForModal && <PaymentVoucherModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} onSave={handleSavePayment} job={selectedJobForModal} type={paymentType} allJobs={jobs} />}
      {isJobModalOpen && editingJob && <JobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={handleSaveJobEdit} initialData={editingJob} customers={customers} lines={lines} onAddLine={onAddLine || (() => {})} onAddCustomer={onAddCustomer || (() => {})} onViewBookingDetails={() => {}} isViewMode={false} existingJobs={jobs} />}
      {isSalesModalOpen && salesJob && <SalesInvoiceModal isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} onSave={handleSaveSales} job={salesJob} initialData={salesInitialData} />}
    </div>
  );
};
