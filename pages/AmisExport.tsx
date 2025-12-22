
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine, INITIAL_JOB, BookingExtensionCost } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, Banknote, ShoppingCart, ShoppingBag, Loader2, Wallet, Plus, Trash2, Copy, Check, Search, CalendarX, ShieldAlert } from 'lucide-react';
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
  const [filterDesc, setFilterDesc] = useState(''); // NEW: Search Description
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
  const [quickReceiveMergedJobs, setQuickReceiveMergedJobs] = useState<JobData[]>([]); // NEW STATE
  
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
  
  // CLEAR DATE STATE
  const [showClearDate, setShowClearDate] = useState(false);
  const [clearTargetDate, setClearTargetDate] = useState(new Date().toISOString().split('T')[0]);
  
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

  const exportData = useMemo(() => {
    let rows: any[] = [];

    // --- MODE THU ---
    if (mode === 'thu') {
      rows = [];
      // 1. Thu Cược (Deduplicated)
      const depGroupMap = new Map<string, any[]>();
      const depAdditionalRows: any[] = [];

      jobs.forEach(j => {
         if (j.thuCuoc > 0 && j.amisDepositDocNo && checkMonth(j.ngayThuCuoc)) {
             const docNo = j.amisDepositDocNo;
             if (!depGroupMap.has(docNo)) depGroupMap.set(docNo, []);
             depGroupMap.get(docNo)?.push(j);
         }
         (j.additionalReceipts || []).forEach(r => {
             if (r.type === 'deposit' && checkMonth(r.date)) {
                 depAdditionalRows.push({
                     jobId: j.id, type: 'deposit_thu', rowId: `dep-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '1388'
                 });
             }
         });
      });

      depGroupMap.forEach((groupJobs, docNo) => {
          const mainJob = groupJobs.find(j => j.amisDepositAmount !== undefined && j.amisDepositAmount > 0);
          if (mainJob) {
             rows.push({
                 jobId: mainJob.id, type: 'deposit_thu', rowId: `dep-${mainJob.id}`,
                 date: mainJob.ngayThuCuoc, docNo: mainJob.amisDepositDocNo, 
                 objCode: getCustomerCode(mainJob.maKhCuocId), objName: getCustomerName(mainJob.maKhCuocId),
                 desc: mainJob.amisDepositDesc || `Thu tiền khách hàng CƯỢC BL ${mainJob.jobCode}`, 
                 amount: mainJob.amisDepositAmount, tkNo: '1121', tkCo: '1388', 
             });
          } else {
             groupJobs.forEach(j => {
                 rows.push({
                     jobId: j.id, type: 'deposit_thu', rowId: `dep-${j.id}`,
                     date: j.ngayThuCuoc, docNo: j.amisDepositDocNo, 
                     objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
                     desc: j.amisDepositDesc || `Thu tiền khách hàng CƯỢC BL ${j.jobCode}`, 
                     amount: j.thuCuoc, tkNo: '1121', tkCo: '1388', 
                 });
             });
          }
      });
      rows.push(...depAdditionalRows);

      // 2. Thu Local Charge
      const lcGroupMap = new Map<string, any[]>();
      const lcAdditionalRows: any[] = [];

      jobs.forEach(j => {
          if (j.localChargeTotal > 0 && j.amisLcDocNo && checkMonth(j.localChargeDate)) {
               const docNo = j.amisLcDocNo;
               if (!lcGroupMap.has(docNo)) lcGroupMap.set(docNo, []);
               lcGroupMap.get(docNo)?.push(j);
          }
          (j.additionalReceipts || []).forEach(r => {
             if ((r.type === 'local' || r.type === 'other') && checkMonth(r.date)) {
                 lcAdditionalRows.push({
                     jobId: j.id, type: 'lc_thu', rowId: `lc-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '13111'
                 });
             }
         });
      });

      lcGroupMap.forEach((groupJobs, docNo) => {
          const mainJob = groupJobs.find(j => j.amisLcAmount !== undefined);
          if (mainJob) {
              rows.push({
                   jobId: mainJob.id, type: 'lc_thu', rowId: `lc-${mainJob.id}`,
                   date: mainJob.localChargeDate, docNo: mainJob.amisLcDocNo, 
                   objCode: getCustomerCode(mainJob.customerId), objName: getCustomerName(mainJob.customerId),
                   desc: mainJob.amisLcDesc || `Thu tiền khách hàng theo hoá đơn ${mainJob.localChargeInvoice} (KIM)`, 
                   amount: mainJob.amisLcAmount, tkNo: '1121', tkCo: '13111',
               });
          } else {
              groupJobs.forEach(j => {
                   rows.push({
                       jobId: j.id, type: 'lc_thu', rowId: `lc-${j.id}`,
                       date: j.localChargeDate, docNo: j.amisLcDocNo, 
                       objCode: getCustomerCode(mainJob.customerId), objName: getCustomerName(mainJob.customerId),
                       desc: j.amisLcDesc || `Thu tiền khách hàng theo hoá đơn ${j.localChargeInvoice} (KIM)`, 
                       amount: j.localChargeTotal, tkNo: '1121', tkCo: '13111',
                   });
              });
          }
      });
      rows.push(...lcAdditionalRows);

      // 3. Thu Extension
      const extGroupMap = new Map<string, any[]>();
      const extAdditionalRows: any[] = [];

      jobs.forEach(j => {
          (j.extensions || []).forEach((ext) => {
              if (ext.total > 0 && ext.amisDocNo && checkMonth(ext.invoiceDate)) {
                  const docNo = ext.amisDocNo;
                  if (!extGroupMap.has(docNo)) extGroupMap.set(docNo, []);
                  extGroupMap.get(docNo)?.push({ ext, job: j });
              }
          });
          (j.additionalReceipts || []).forEach(r => {
             if (r.type === 'extension' && checkMonth(r.date)) {
                 const extTarget = (j.extensions || []).find(e => e.id === r.extensionId);
                 const custId = extTarget ? (extTarget.customerId || j.customerId) : j.customerId;
                 extAdditionalRows.push({
                     jobId: j.id, type: 'ext_thu', extensionId: r.extensionId, rowId: `ext-add-${r.id}`,
                     date: r.date, docNo: r.docNo,
                     objCode: getCustomerCode(custId), objName: getCustomerName(custId),
                     desc: r.desc, amount: r.amount, tkNo: '1121', tkCo: '13111'
                 });
             }
         });
      });

      extGroupMap.forEach((items, docNo) => {
          const bestItem = items.find(i => i.ext.amisAmount !== undefined);
          if (bestItem) {
              const { ext, job } = bestItem;
              rows.push({
                  jobId: job.id, type: 'ext_thu', extensionId: ext.id, rowId: `ext-${ext.id}`,
                  date: ext.invoiceDate, docNo: ext.amisDocNo, 
                  objCode: getCustomerCode(ext.customerId || job.customerId), objName: getCustomerName(ext.customerId || job.customerId),
                  desc: ext.amisDesc || `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`, 
                  amount: ext.amisAmount || ext.total, tkNo: '1121', tkCo: '13111',
              });
          } else {
              items.forEach(({ ext, job }) => {
                  rows.push({
                      jobId: job.id, type: 'ext_thu', extensionId: ext.id, rowId: `ext-${ext.id}`,
                      date: ext.invoiceDate, docNo: ext.amisDocNo, 
                      objCode: getCustomerCode(ext.customerId || job.customerId), objName: getCustomerName(ext.customerId || job.customerId),
                      desc: ext.amisDesc || `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`, 
                      amount: ext.total, tkNo: '1121', tkCo: '13111',
                  });
              });
          }
      });
      rows.push(...extAdditionalRows);

      // 4. Thu Khác
      customReceipts.forEach(r => {
          if (checkMonth(r.date)) {
              const descUpper = (r.desc || '').toUpperCase();
              const isDeposit = descUpper.includes('CƯỢC') || descUpper.includes('DEPOSIT') || r.type === 'deposit';
              const tkCo = isDeposit ? '1388' : '13111';
              rows.push({ ...r, jobId: r.id, type: 'external', rowId: `custom-${r.id}`, tkNo: '1121', tkCo });
              if (r.additionalReceipts && Array.isArray(r.additionalReceipts)) {
                  r.additionalReceipts.forEach((ar: any) => {
                      if (checkMonth(ar.date)) {
                          const arDescUpper = (ar.desc || '').toUpperCase();
                          const arIsDeposit = ar.type === 'deposit' || arDescUpper.includes('CƯỢC');
                          const arTkCo = arIsDeposit ? '1388' : '13111';
                          rows.push({
                              jobId: r.id, type: 'external', rowId: `custom-add-${ar.id}`,
                              date: ar.date, docNo: ar.docNo,
                              objCode: r.objCode, objName: r.objName,
                              desc: ar.desc, amount: ar.amount, tkNo: '1121', tkCo: arTkCo
                          });
                      }
                  });
              }
          }
      });
    } 
    
    // --- MODE CHI ---
    else if (mode === 'chi') {
        rows = [];
        const processedDocNos = new Set<string>();
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Chi Payment
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
        
        // 2. Chi Cược
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

        // 3. Chi Gia Hạn
        const processedExtOut = new Set<string>();
        jobs.forEach(j => {
            if (j.amisExtensionPaymentDocNo && !processedExtOut.has(j.amisExtensionPaymentDocNo) && checkMonth(j.amisExtensionPaymentDate)) {
                processedExtOut.add(j.amisExtensionPaymentDocNo);
                let amount = 0;
                if (j.amisExtensionPaymentAmount && j.amisExtensionPaymentAmount > 0) amount = j.amisExtensionPaymentAmount;
                else {
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

        // 4. Chi Hoàn Cược
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

        // 5. Chi Hoàn Tiền Thừa
        jobs.forEach(j => {
            if (j.refunds && j.refunds.length > 0) {
                j.refunds.forEach(ref => {
                    if (checkMonth(ref.date)) {
                        rows.push({
                            jobId: j.id, type: 'refund_overpayment', rowId: `refund-op-${ref.id}`,
                            date: ref.date, docNo: ref.docNo,
                            objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                            desc: ref.desc, amount: ref.amount,
                            reason: 'Chi hoàn tiền thừa', paymentContent: ref.desc, paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                            currency: 'VND', description: ref.desc, tkNo: '13111', tkCo: '1121',
                        });
                    }
                });
            }
        });
    }
    // ... (Ban/Mua code same as before, omitted for brevity but assumed present)
    else if (mode === 'ban') {
        rows = [];
        let validJobs = jobs.filter(j => {
            const hasSell = j.sell > 0;
            const name = (j.customerName || '').toLowerCase();
            const isLhk = name.includes('long hoàng') || name.includes('lhk') || name.includes('long hoang') || name.includes('longhoang');
            return hasSell && isLhk;
        });
        if (filterMonth) validJobs = validJobs.filter(j => j.month === filterMonth);
        // ... (sorting logic same as before) ...
        validJobs.sort((a, b) => {
            const monthDiff = Number(a.month) - Number(b.month); 
            if (monthDiff !== 0) return monthDiff;
            const bookingA = String(a.booking || '').trim().toLowerCase();
            const bookingB = String(b.booking || '').trim().toLowerCase();
            return bookingA.localeCompare(bookingB);
        });
        const bookingToDocNoMap = new Map<string, string>();
        let currentDocNum = 1;
        const currentYear = new Date().getFullYear();
        validJobs.forEach(j => {
            const bookingKey = String(j.booking || '').trim();
            let docNo = '';
            if (bookingKey && bookingToDocNoMap.has(bookingKey)) {
                docNo = bookingToDocNoMap.get(bookingKey)!;
            } else {
                docNo = `BH${String(currentDocNum).padStart(5, '0')}`;
                if (bookingKey) bookingToDocNoMap.set(bookingKey, docNo);
                currentDocNum++;
            }
            const monthInt = parseInt(j.month || '1', 10);
            const daysInMonth = new Date(currentYear, monthInt, 0).getDate(); 
            const targetDay = Math.min(30, daysInMonth);
            const dateStr = `${currentYear}-${String(monthInt).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
            rows.push({
                jobId: j.id, type: 'ban', rowId: `ban-${j.id}`,
                date: dateStr, docNo: docNo, objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
                desc: `Bán hàng LONG HOÀNG - KIMBERRY BILL ${j.booking || ''} là cost ${j.hbl || ''}`,
                amount: j.sell, projectCode: `K${currentYear.toString().slice(-2)}${(j.month || '01').padStart(2, '0')}${j.jobCode}`
            });
        });
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
                
                // Local Charge
                const lc = details.localCharge;
                let lcNet = 0, lcVat = 0, lcTotal = 0;
                if (lc.hasInvoice === false) { lcTotal = lc.total || 0; lcNet = Math.round(lcTotal / 1.05); lcVat = lcTotal - lcNet; } 
                else { lcNet = lc.net || 0; lcVat = lc.vat || 0; lcTotal = lcNet + lcVat; }
                if (lcTotal > 0) rawItems.push({ jobId: j.id, date: lc.date || new Date().toISOString().split('T')[0], invoice: lc.invoice || '', desc: `Mua hàng của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName: supplierName, itemName: defaultItemName, netAmount: lcNet, vatAmount: lcVat, amount: lcTotal, costType: 'Local charge', sortDate: new Date(lc.date || '1970-01-01').getTime() });

                // Additional LC
                if (details.additionalLocalCharges) {
                    details.additionalLocalCharges.forEach(add => {
                        let aNet = 0, aVat = 0, aTotal = 0;
                        if (add.hasInvoice === false) { aTotal = add.total || 0; aNet = Math.round(aTotal / 1.05); aVat = aTotal - aNet; } 
                        else { aNet = add.net || 0; aVat = add.vat || 0; aTotal = aNet + aVat; }
                        if (aTotal > 0) rawItems.push({ jobId: j.id, date: add.date || new Date().toISOString().split('T')[0], invoice: add.invoice || '', desc: `Chi phí khác của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName: supplierName, itemName: defaultItemName, netAmount: aNet, vatAmount: aVat, amount: aTotal, costType: 'Local charge', sortDate: new Date(add.date || '1970-01-01').getTime() });
                    });
                }
                
                // Extension
                if (details.extensionCosts) {
                    details.extensionCosts.forEach(ext => {
                        if (ext.total > 0) {
                            const eNet = ext.net || Math.round(ext.total / 1.05);
                            const eVat = ext.vat || (ext.total - eNet);
                            rawItems.push({ jobId: j.id, date: ext.date || new Date().toISOString().split('T')[0], invoice: ext.invoice || '', desc: `Phí gia hạn của ${supplierName} BILL ${j.booking}`, supplierCode: j.line, supplierName: supplierName, itemName: 'Phí phát sinh', netAmount: eNet, vatAmount: eVat, amount: ext.total, costType: 'Demurrage', sortDate: new Date(ext.date || '1970-01-01').getTime() });
                        }
                    });
                }
            } else {
                if (j.cost > 0) {
                    const lineObj = lines.find(l => l.code === j.line);
                    const supplierName = lineObj ? lineObj.name : j.line;
                    const defaultItemName = lineObj?.itemName || 'Phí Local Charge';
                    const total = j.cost; const net = Math.round(total / 1.05); const vat = total - net;
                    rawItems.push({ jobId: j.id, date: new Date().toISOString().split('T')[0], invoice: '', desc: `Mua hàng của ${supplierName} Job ${j.jobCode}`, supplierCode: j.line, supplierName: supplierName, itemName: defaultItemName, netAmount: net, vatAmount: vat, amount: total, costType: 'Local charge', sortDate: Date.now() });
                }
            }
        });
        rawItems.sort((a, b) => a.sortDate - b.sortDate);
        const invoiceToDocMap = new Map<string, string>();
        let currentDocNum = 1;
        rows = rawItems.map(item => {
            const groupKey = item.invoice ? item.invoice.trim().toUpperCase() : `NO_INV_${item.jobId}_${Math.random()}`;
            let docNo = '';
            if (item.invoice && invoiceToDocMap.has(groupKey)) docNo = invoiceToDocMap.get(groupKey)!;
            else { docNo = `MH${String(currentDocNum).padStart(5, '0')}`; if (item.invoice) invoiceToDocMap.set(groupKey, docNo); currentDocNum++; }
            return { ...item, type: 'mua', rowId: `mua-${item.jobId}-${docNo}-${Math.random()}`, docNo, invoiceNo: item.invoice, objCode: item.supplierCode, objName: item.supplierName };
        });
    }

    if (filterDesc) {
        const lower = filterDesc.toLowerCase();
        rows = rows.filter(r => (r.desc || '').toLowerCase().includes(lower));
    }

    return rows.sort((a, b) => (a.docNo || '').localeCompare(b.docNo || ''));

  }, [jobs, mode, filterMonth, filterDesc, customers, customReceipts, lines]); 

  // ... (handleEdit, handleSaveJobEdit, handleSaveSales remain same)
  const handleEdit = (row: any) => {
      const job = jobs.find(j => j.id === row.jobId);
      setTargetExtensionId(null);
      setQuickReceiveMergedJobs([]); 

      if (mode === 'thu') {
          if (row.type === 'external') {
               const receiptId = row.jobId || row.id;
               const fullReceipt = customReceipts.find(r => r.id === receiptId);
               
               const dummyJob = { 
                   ...INITIAL_JOB, 
                   id: fullReceipt ? fullReceipt.id : receiptId, 
                   jobCode: 'THU-KHAC', 
                   localChargeDate: fullReceipt ? fullReceipt.date : row.date, 
                   amisLcDocNo: fullReceipt ? fullReceipt.docNo : row.docNo, 
                   amisLcDesc: fullReceipt ? fullReceipt.desc : row.desc,
                   localChargeTotal: fullReceipt ? fullReceipt.amount : row.amount,
                   localChargeInvoice: fullReceipt ? fullReceipt.invoice : (row.invoice || ''),
                   customerId: fullReceipt ? fullReceipt.objCode : row.objCode,
                   customerName: fullReceipt ? fullReceipt.objName : row.objName,
                   additionalReceipts: fullReceipt?.additionalReceipts || []
               };
               setQuickReceiveJob(dummyJob);
               setQuickReceiveMode('other');
               setIsQuickReceiveOpen(true);
          } else if (job) {
              setQuickReceiveJob(job);
              if (row.type === 'deposit_thu') {
                  setQuickReceiveMode('deposit');
                  const matchingJobs = jobs.filter(j => j.id !== job.id && j.amisDepositDocNo === row.docNo);
                  setQuickReceiveMergedJobs(matchingJobs);
              }
              else if (row.type === 'ext_thu') {
                  setQuickReceiveMode('extension');
                  setTargetExtensionId(row.extensionId);
                  const matchingJobs = jobs.filter(j => 
                      j.id !== job.id && 
                      (j.extensions || []).some(e => e.amisDocNo === row.docNo)
                  );
                  setQuickReceiveMergedJobs(matchingJobs);
              }
              else {
                  setQuickReceiveMode('local');
                  const matchingJobs = jobs.filter(j => j.id !== job.id && j.amisLcDocNo === row.docNo);
                  setQuickReceiveMergedJobs(matchingJobs);
              }
              setIsQuickReceiveOpen(true);
          }
      } 
      else if (mode === 'chi' && job) {
          if (row.type === 'payment_refund') {
              setQuickReceiveJob(job);
              setQuickReceiveMode('deposit_refund');
              const matchingJobs = jobs.filter(j => j.id !== job.id && j.amisDepositRefundDocNo === row.docNo);
              setQuickReceiveMergedJobs(matchingJobs);
              setIsQuickReceiveOpen(true);
          } else if (row.type === 'refund_overpayment') {
              setQuickReceiveJob(job);
              setQuickReceiveMode('refund_overpayment');
              const matchingJobs = jobs.filter(j => 
                  j.id !== job.id && 
                  (j.refunds || []).some(r => r.docNo === row.docNo)
              );
              setQuickReceiveMergedJobs(matchingJobs);
              setIsQuickReceiveOpen(true);
          } else {
              setSelectedJobForModal(job);
              if (row.type === 'payment_deposit') setPaymentType('deposit');
              else if (row.type === 'payment_ext') setPaymentType('extension');
              else setPaymentType('local');
              setIsPaymentModalOpen(true);
          }
      }
      else if (mode === 'ban' && job) {
          setSalesJob(job);
          setSalesInitialData({
              docNo: row.docNo, date: row.date, docDate: row.date, amount: row.amount, description: row.desc, projectCode: row.projectCode
          });
          setIsSalesModalOpen(true);
      }
      else if (mode === 'mua' && job) {
          setEditingJob(job);
          setIsJobModalOpen(true);
      }
  };

  const handleSaveJobEdit = (updatedJob: JobData, newCustomer?: Customer) => {
      if (onUpdateJob) onUpdateJob(updatedJob);
      if (newCustomer && onAddCustomer) onAddCustomer(newCustomer);
      setIsJobModalOpen(false);
  };

  const handleSaveSales = (data: any) => {
      setIsSalesModalOpen(false);
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
              if (row.rowId.includes('add')) {
                  updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `dep-add-${r.id}` !== row.rowId);
              } else {
                  updatedJob.amisDepositDocNo = '';
                  updatedJob.amisDepositDesc = '';
                  updatedJob.amisDepositAmount = 0;
              }
          } else if (row.type === 'lc_thu') {
              if (row.rowId.includes('add')) {
                  updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `lc-add-${r.id}` !== row.rowId);
              } else {
                  updatedJob.amisLcDocNo = '';
                  updatedJob.amisLcDesc = '';
                  updatedJob.amisLcAmount = 0;
              }
          } else if (row.type === 'ext_thu') {
              if (row.rowId.includes('add')) {
                  updatedJob.additionalReceipts = (updatedJob.additionalReceipts || []).filter(r => `ext-add-${r.id}` !== row.rowId);
              } else {
                  updatedJob.extensions = (updatedJob.extensions || []).map(e => 
                      e.id === row.extensionId ? { ...e, amisDocNo: '', amisDesc: '', amisAmount: 0 } : e
                  );
              }
          } else if (row.type === 'payment_chi') {
              updatedJob.amisPaymentDocNo = '';
              updatedJob.amisPaymentDesc = '';
              updatedJob.amisPaymentDate = '';
          } else if (row.type === 'payment_deposit') {
              updatedJob.amisDepositOutDocNo = '';
              updatedJob.amisDepositOutDesc = '';
              updatedJob.amisDepositOutDate = '';
          } else if (row.type === 'payment_ext') {
              const docNoToDelete = row.docNo;
              updatedJob.amisExtensionPaymentDocNo = '';
              updatedJob.amisExtensionPaymentDesc = '';
              updatedJob.amisExtensionPaymentDate = '';
              updatedJob.amisExtensionPaymentAmount = 0; 
              
              // Clear internal bookingCostDetails reference
              if (updatedJob.bookingCostDetails) {
                updatedJob.bookingCostDetails = {
                    ...updatedJob.bookingCostDetails,
                    extensionCosts: updatedJob.bookingCostDetails.extensionCosts.map(e => ({
                      ...e, amisDocNo: e.amisDocNo === docNoToDelete ? '' : e.amisDocNo
                    }))
                };
              }
              
              // Global Sync for siblings and ANY job sharing this docNo
              jobs.forEach(j => {
                 if (j.id === updatedJob.id) return; // Skip current
                 let changed = false;
                 const updatedJ = { ...j };

                 // Check Header
                 if (updatedJ.amisExtensionPaymentDocNo === docNoToDelete) {
                     updatedJ.amisExtensionPaymentDocNo = '';
                     updatedJ.amisExtensionPaymentDesc = '';
                     updatedJ.amisExtensionPaymentDate = '';
                     updatedJ.amisExtensionPaymentAmount = 0;
                     changed = true;
                 }

                 // Check Inner items
                 if (updatedJ.bookingCostDetails && updatedJ.bookingCostDetails.extensionCosts) {
                     const hasMatch = updatedJ.bookingCostDetails.extensionCosts.some(e => e.amisDocNo === docNoToDelete);
                     if (hasMatch) {
                         updatedJ.bookingCostDetails = {
                             ...updatedJ.bookingCostDetails,
                             extensionCosts: updatedJ.bookingCostDetails.extensionCosts.map(e => ({
                                 ...e, amisDocNo: e.amisDocNo === docNoToDelete ? '' : e.amisDocNo
                             }))
                         };
                         changed = true;
                     }
                 }

                 if (changed) onUpdateJob(updatedJ);
              });

          } else if (row.type === 'payment_refund') {
              updatedJob.amisDepositRefundDocNo = '';
              updatedJob.amisDepositRefundDesc = '';
              updatedJob.amisDepositRefundDate = '';
          } else if (row.type === 'refund_overpayment') {
              updatedJob.refunds = (updatedJob.refunds || []).filter(r => r.docNo !== row.docNo);
          }
          
          onUpdateJob(updatedJob);
      }
  };

  const handleSavePayment = (data: any) => {
      if (selectedJobForModal && onUpdateJob) {
          let docField: keyof JobData = 'amisPaymentDocNo';
          let descField: keyof JobData = 'amisPaymentDesc';
          let dateField: keyof JobData = 'amisPaymentDate';

          if (paymentType === 'deposit') {
              docField = 'amisDepositOutDocNo';
              descField = 'amisDepositOutDesc';
              dateField = 'amisDepositOutDate';
          } else if (paymentType === 'extension') {
              docField = 'amisExtensionPaymentDocNo';
              descField = 'amisExtensionPaymentDesc';
              dateField = 'amisExtensionPaymentDate';
          }

          const oldDocNo = selectedJobForModal[docField];
          const targetJobs = (oldDocNo && typeof oldDocNo === 'string')
             ? jobs.filter(j => j[docField] === oldDocNo) 
             : [selectedJobForModal]; 

          targetJobs.forEach(job => {
              const updatedJob = { ...job };
              (updatedJob as any)[docField] = data.docNo;
              (updatedJob as any)[dateField] = data.date;
              
              if (job.id === selectedJobForModal.id) {
                  (updatedJob as any)[descField] = data.paymentContent;
                  
                  if (paymentType === 'extension') {
                      updatedJob.amisExtensionPaymentAmount = data.amount;
                      if (updatedJob.bookingCostDetails) {
                          updatedJob.bookingCostDetails.extensionCosts = updatedJob.bookingCostDetails.extensionCosts.map(ext => {
                              if (data.selectedExtensionId === 'merge_all') {
                                  if (!ext.amisDocNo || ext.amisDocNo === oldDocNo) {
                                      return { ...ext, amisDocNo: data.docNo };
                                  }
                              } else if (ext.id === data.selectedExtensionId) {
                                  return { ...ext, amisDocNo: data.docNo };
                              }
                              return ext;
                          });
                      }
                  }
              }
              onUpdateJob(updatedJob);
          });
          setIsPaymentModalOpen(false);
      }
  };

  // --- CLEANUP GHOST DATA UTILITY ---
  const handleCleanupGhostData = () => {
      if (!window.confirm("Hành động này sẽ quét toàn bộ dữ liệu và xóa các liên kết chứng từ bị lỗi (những phiếu đã xóa nhưng vẫn còn dính). Bạn có chắc chắn muốn thực hiện?")) return;

      const validDocNos = new Set<string>();
      
      // 1. Collect Valid DocNos from Headers
      jobs.forEach(j => {
          if (j.amisExtensionPaymentDocNo) validDocNos.add(j.amisExtensionPaymentDocNo);
          if (j.amisPaymentDocNo) validDocNos.add(j.amisPaymentDocNo);
          if (j.amisDepositOutDocNo) validDocNos.add(j.amisDepositOutDocNo);
      });

      let updatedCount = 0;

      // 2. Scan and Fix
      jobs.forEach(j => {
          let changed = false;
          const updatedJob = { ...j };

          if (updatedJob.bookingCostDetails) {
              const newExtCosts = updatedJob.bookingCostDetails.extensionCosts.map(ext => {
                  if (ext.amisDocNo && !validDocNos.has(ext.amisDocNo)) {
                      changed = true;
                      return { ...ext, amisDocNo: '' }; // Clear ghost reference
                  }
                  return ext;
              });
              
              if (changed) {
                  updatedJob.bookingCostDetails = {
                      ...updatedJob.bookingCostDetails,
                      extensionCosts: newExtCosts
                  };
                  if (onUpdateJob) onUpdateJob(updatedJob);
                  updatedCount++;
              }
          }
      });

      alert(`Hoàn tất quét lỗi! Đã sửa dữ liệu cho ${updatedCount} Job.`);
  };

  // --- BULK LOCK HANDLER ---
  const handleBulkLock = () => {
      const idsToLock = Array.from(selectedIds);
      if (idsToLock.length === 0) return;
      if (window.confirm(`Xác nhận khóa ${idsToLock.length} phiếu đã chọn?`)) {
          onToggleLock(idsToLock);
          setSelectedIds(new Set());
      }
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const allIds = exportData.filter(r => !lockedIds.has(r.docNo)).map(r => r.docNo);
          setSelectedIds(new Set(allIds));
      } else {
          setSelectedIds(new Set());
      }
  };

  const handleSelectRow = (docNo: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(docNo)) newSet.delete(docNo);
      else newSet.add(docNo);
      setSelectedIds(newSet);
  };

  const handleExport = async () => {
      if (!templateBuffer) {
          alert("Chưa có file mẫu. Vui lòng tải file mẫu lên hoặc đợi tải từ server.");
          return;
      }

      const dataToExport = selectedIds.size > 0 
          ? exportData.filter(r => selectedIds.has(r.docNo))
          : exportData;

      if (dataToExport.length === 0) {
          alert("Không có dữ liệu để xuất.");
          return;
      }

      try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(templateBuffer);
          
          const worksheet = workbook.worksheets[0];
          
          if (!worksheet) {
             throw new Error("File mẫu không hợp lệ (không có sheet).");
          }

          let currentRow = 12;

          dataToExport.forEach((row) => {
              const r = worksheet.getRow(currentRow);
              
              r.getCell(1).value = formatDateVN(row.date); 
              r.getCell(2).value = formatDateVN(row.date); 
              r.getCell(3).value = row.docNo;              
              r.getCell(4).value = row.desc;               

              if (mode === 'thu' || mode === 'chi') {
                  r.getCell(5).value = row.tkNo || '';     
                  r.getCell(6).value = row.tkCo || '';     
                  r.getCell(7).value = row.amount;         
                  r.getCell(8).value = row.objCode;        
                  r.getCell(9).value = row.objName;        
              } else if (mode === 'ban') {
                  r.getCell(7).value = row.amount;         
                  r.getCell(8).value = row.objCode;
                  r.getCell(9).value = row.objName;
                  if (row.projectCode) {
                      r.getCell(12).value = row.projectCode; 
                  }
              } else if (mode === 'mua') {
                  r.getCell(7).value = row.amount;
                  r.getCell(8).value = row.objCode;
                  r.getCell(9).value = row.objName;
                  r.getCell(14).value = row.invoiceNo; 
              }

              r.commit();
              currentRow++;
          });

          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `AMIS_${mode.toUpperCase()}_${new Date().toISOString().slice(0,10)}.xlsx`;
          anchor.click();
          window.URL.revokeObjectURL(url);

      } catch (err) {
          console.error("Export Error:", err);
          alert("Lỗi khi xuất Excel. Vui lòng kiểm tra lại file mẫu.");
      }
  };

  // --- CLEAR BY DATE HANDLER ---
  const handleClearByDate = () => {
      // ... (Implementation unchanged from previous turn)
      if (!clearTargetDate) return;
      if (!window.confirm(`CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ số chứng từ và số tiền đã ghi nhận trong ngày ${formatDateVN(clearTargetDate)}.\n\nBạn có chắc chắn muốn tiếp tục?`)) return;

      let updatedCount = 0;

      jobs.forEach(job => {
          let changed = false;
          const updatedJob = { ...job };

          if (mode === 'thu') {
              if (updatedJob.localChargeDate === clearTargetDate && updatedJob.amisLcDocNo) {
                  updatedJob.amisLcDocNo = ''; updatedJob.amisLcDesc = ''; updatedJob.amisLcAmount = 0; changed = true;
              }
              if (updatedJob.ngayThuCuoc === clearTargetDate && updatedJob.amisDepositDocNo) {
                  updatedJob.amisDepositDocNo = ''; updatedJob.amisDepositDesc = ''; updatedJob.amisDepositAmount = 0; changed = true;
              }
              if (updatedJob.extensions && updatedJob.extensions.length > 0) {
                  updatedJob.extensions = updatedJob.extensions.map(ext => {
                      if (ext.invoiceDate === clearTargetDate && ext.amisDocNo) { changed = true; return { ...ext, amisDocNo: '', amisDesc: '', amisAmount: 0 }; }
                      return ext;
                  });
              }
              if (updatedJob.additionalReceipts && updatedJob.additionalReceipts.length > 0) {
                  const keep = updatedJob.additionalReceipts.filter(r => r.date !== clearTargetDate);
                  if (keep.length !== updatedJob.additionalReceipts.length) { updatedJob.additionalReceipts = keep; changed = true; }
              }
          } 
          else if (mode === 'chi') {
              if (updatedJob.amisPaymentDate === clearTargetDate && updatedJob.amisPaymentDocNo) {
                  updatedJob.amisPaymentDocNo = ''; updatedJob.amisPaymentDesc = ''; updatedJob.amisPaymentDate = ''; changed = true;
              }
              if (updatedJob.amisDepositOutDate === clearTargetDate && updatedJob.amisDepositOutDocNo) {
                  updatedJob.amisDepositOutDocNo = ''; updatedJob.amisDepositOutDesc = ''; updatedJob.amisDepositOutDate = ''; changed = true;
              }
              if (updatedJob.amisExtensionPaymentDate === clearTargetDate && updatedJob.amisExtensionPaymentDocNo) {
                  const docNoToClear = updatedJob.amisExtensionPaymentDocNo;
                  updatedJob.amisExtensionPaymentDocNo = ''; updatedJob.amisExtensionPaymentDesc = ''; updatedJob.amisExtensionPaymentDate = ''; updatedJob.amisExtensionPaymentAmount = 0;
                  
                  if (updatedJob.bookingCostDetails) {
                      updatedJob.bookingCostDetails = {
                          ...updatedJob.bookingCostDetails,
                          extensionCosts: updatedJob.bookingCostDetails.extensionCosts.map(e => ({
                              ...e, amisDocNo: e.amisDocNo === docNoToClear ? '' : e.amisDocNo
                          }))
                      };
                  }
                  
                  // Global Sync Cleanup
                  jobs.forEach(j => {
                     if (j.id === updatedJob.id) return;
                     let sibChanged = false;
                     const updatedSib = { ...j };
                     if (updatedSib.amisExtensionPaymentDocNo === docNoToClear) {
                         updatedSib.amisExtensionPaymentDocNo = ''; updatedSib.amisExtensionPaymentDesc = ''; updatedSib.amisExtensionPaymentDate = ''; updatedSib.amisExtensionPaymentAmount = 0; sibChanged = true;
                     }
                     if (updatedSib.bookingCostDetails && updatedSib.bookingCostDetails.extensionCosts) {
                         const hasMatch = updatedSib.bookingCostDetails.extensionCosts.some(e => e.amisDocNo === docNoToClear);
                         if (hasMatch) {
                             updatedSib.bookingCostDetails = { ...updatedSib.bookingCostDetails, extensionCosts: updatedSib.bookingCostDetails.extensionCosts.map(e => ({ ...e, amisDocNo: e.amisDocNo === docNoToClear ? '' : e.amisDocNo })) };
                             sibChanged = true;
                         }
                     }
                     if (sibChanged && onUpdateJob) onUpdateJob(updatedSib);
                  });
                  changed = true;
              }
              if (updatedJob.amisDepositRefundDate === clearTargetDate && updatedJob.amisDepositRefundDocNo) {
                  updatedJob.amisDepositRefundDocNo = ''; updatedJob.amisDepositRefundDesc = ''; updatedJob.amisDepositRefundDate = ''; changed = true;
              }
              if (updatedJob.refunds && updatedJob.refunds.length > 0) {
                  const keep = updatedJob.refunds.filter(r => r.date !== clearTargetDate);
                  if (keep.length !== updatedJob.refunds.length) { updatedJob.refunds = keep; changed = true; }
              }
          }

          if (changed && onUpdateJob) { onUpdateJob(updatedJob); updatedCount++; }
      });

      if (mode === 'thu' && onUpdateCustomReceipts && customReceipts) {
          // ... Custom Receipt cleanup
          let customChanged = false;
          const filteredMain = customReceipts.filter(r => r.date !== clearTargetDate);
          const finalCustomReceipts = filteredMain.map(r => {
              if (r.additionalReceipts && r.additionalReceipts.length > 0) {
                  const newAdd = r.additionalReceipts.filter((ar: any) => ar.date !== clearTargetDate);
                  if (newAdd.length !== r.additionalReceipts.length) return { ...r, additionalReceipts: newAdd };
              }
              return r;
          });
          if (JSON.stringify(finalCustomReceipts) !== JSON.stringify(customReceipts)) { onUpdateCustomReceipts(finalCustomReceipts); customChanged = true; }
          if (customChanged) updatedCount++;
      }

      alert(`Đã xóa dữ liệu phiếu của ${updatedCount} đối tượng trong ngày ${formatDateVN(clearTargetDate)}.`);
      setShowClearDate(false);
  };

  // ... (handleExport, handleSelectAll, handleSelectRow remain same)

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
        
        {/* ... Toolbar ... */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-white/40 flex justify-between items-center sticky top-0 z-20">
           {/* ... Filters ... */}
           <div className="flex items-center space-x-4">
              <div className="flex items-center text-slate-500 font-medium"><Filter className="w-4 h-4 mr-2" /> Lọc tháng:</div>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 glass-input rounded-lg text-sm w-32 focus:ring-0 outline-none">
                <option value="">Tất cả</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Tìm diễn giải..." value={filterDesc} onChange={(e) => setFilterDesc(e.target.value)} className="pl-9 pr-4 py-2 glass-input rounded-lg text-sm w-48 focus:ring-0 outline-none" />
              </div>
           </div>

           <div className="flex space-x-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingTemplate} className="glass-panel hover:bg-white/80 px-4 py-2 rounded-lg flex items-center space-x-2 text-slate-700 transition-colors" title="Tải file mẫu từ máy tính lên server">
                 {isUploadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : (templateBuffer ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />)} 
                 <span className="flex flex-col items-start text-xs"><span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>{templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}</span>
              </button>

              {mode === 'thu' && (
                  <button onClick={() => { const nextDocNo = generateNextDocNo(jobs, 'NTTK', 5, customDocNos); const dummyJob = { ...INITIAL_JOB, id: `EXT-${Date.now()}`, jobCode: 'THU-KHAC', localChargeDate: new Date().toISOString().split('T')[0], amisLcDocNo: nextDocNo, amisLcDesc: 'Thu tiền khác' }; setQuickReceiveJob(dummyJob); setQuickReceiveMode('other'); setIsQuickReceiveOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-md transition-all transform active:scale-95">
                      <Wallet className="w-5 h-5" /> <span>Thu Khác</span>
                  </button>
              )}

              {/* CLEANUP BUTTON */}
              {(mode === 'chi' || mode === 'thu') && (
                  <button 
                      onClick={handleCleanupGhostData}
                      className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-2 rounded-lg flex items-center shadow-sm transition-all"
                      title="Quét và sửa lỗi dữ liệu (Xóa các liên kết chứng từ ảo)"
                  >
                      <ShieldAlert className="w-5 h-5" />
                  </button>
              )}

              <button onClick={handleBulkLock} disabled={selectedIds.size === 0} className={`px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg transition-all transform active:scale-95 ${selectedIds.size > 0 ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}>
                  <Lock className="w-5 h-5" /> <span>{selectedIds.size > 0 ? `Khóa (${selectedIds.size})` : 'Khóa'}</span>
              </button>

              {(mode === 'thu' || mode === 'chi') && (
                  <div className="relative">
                      {!showClearDate ? (
                          <button onClick={() => setShowClearDate(true)} className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm transition-all" title="Xóa phiếu theo ngày">
                              <CalendarX className="w-5 h-5" />
                          </button>
                      ) : (
                          <div className="flex items-center bg-white border border-red-200 rounded-lg p-1 shadow-lg animate-in fade-in zoom-in-95 absolute top-0 right-0 z-50">
                              <input type="date" value={clearTargetDate} onChange={(e) => setClearTargetDate(e.target.value)} className="text-xs border-none focus:ring-0 text-slate-700 font-bold bg-transparent" />
                              <button onClick={handleClearByDate} className="bg-red-600 text-white p-1.5 rounded ml-1 hover:bg-red-700" title="Xác nhận xóa"><Trash2 className="w-4 h-4" /></button>
                              <button onClick={() => setShowClearDate(false)} className="text-slate-400 hover:text-slate-600 p-1.5 ml-1"><X className="w-4 h-4" /></button>
                          </div>
                      )}
                  </div>
              )}

              <button onClick={handleExport} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg hover:shadow-green-500/30 transition-all transform active:scale-95">
                  <FileSpreadsheet className="w-5 h-5" /> <span>{selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel'}</span>
              </button>
           </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm border border-white/40 overflow-hidden">
        {/* ... Table Content ... */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-700 font-bold border-b border-white/30 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 w-10 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={exportData.filter(r => !lockedIds.has(r.docNo)).length > 0 && selectedIds.size === exportData.filter(r => !lockedIds.has(r.docNo)).length} onChange={handleSelectAll} />
                </th>
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
                      
                      {mode === 'mua' && (
                          <td className="px-6 py-3 text-slate-500 text-xs italic">
                              {row.costType}
                          </td>
                      )}
                      
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
                      const foundCust = customers.find(c => c.id === updatedJob.customerId);
                      const finalObjCode = foundCust ? foundCust.code : updatedJob.customerId;

                      const newReceipt = { 
                          id: updatedJob.id, 
                          type: 'external', 
                          date: updatedJob.localChargeDate, 
                          docNo: updatedJob.amisLcDocNo, 
                          objCode: finalObjCode, 
                          objName: updatedJob.customerName, 
                          desc: updatedJob.amisLcDesc, 
                          amount: updatedJob.amisLcAmount !== undefined ? updatedJob.amisLcAmount : updatedJob.localChargeTotal, 
                          invoice: updatedJob.localChargeInvoice, 
                          additionalReceipts: updatedJob.additionalReceipts 
                      };
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
              usedDocNos={customDocNos} 
              initialAddedJobs={quickReceiveMergedJobs} 
              onAddCustomer={onAddCustomer || (() => {})}
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
              allJobs={jobs}
          />
      )}

      {/* JOB MODAL FOR LEGACY EDIT */}
      {isJobModalOpen && editingJob && (
          <JobModal 
              isOpen={isJobModalOpen}
              onClose={() => setIsJobModalOpen(false)}
              onSave={handleSaveJobEdit}
              initialData={editingJob}
              customers={customers}
              lines={lines}
              onAddLine={onAddLine || (() => {})}
              onAddCustomer={onAddCustomer || (() => {})}
              onViewBookingDetails={() => {}}
              isViewMode={false}
              existingJobs={jobs}
          />
      )}

      {/* SALES INVOICE MODAL FOR BAN EDIT */}
      {isSalesModalOpen && salesJob && (
          <SalesInvoiceModal 
              isOpen={isSalesModalOpen}
              onClose={() => setIsSalesModalOpen(false)}
              onSave={handleSaveSales}
              job={salesJob}
              initialData={salesInitialData}
          />
      )}

    </div>
  );
};
