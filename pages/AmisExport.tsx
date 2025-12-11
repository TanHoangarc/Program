
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine, INITIAL_JOB } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, Banknote, ShoppingCart, ShoppingBag, Loader2, Wallet, Plus, Trash2, Copy, Check } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';
import { formatDateVN, calculateBookingSummary, parseDateVN } from '../utils';
import { PaymentVoucherModal } from '../components/PaymentVoucherModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseInvoiceModal } from '../components/PurchaseInvoiceModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal'; // Import standard modal
import axios from 'axios';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  mode: 'thu' | 'chi' | 'ban' | 'mua';
  onUpdateJob?: (job: JobData) => void;
}

// Cấu hình đường dẫn Server
const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Templates";

// Map modes to specific filenames
const TEMPLATE_MAP: Record<string, string> = {
  thu: "Phieu_thu_Mau.xlsx",
  chi: "Phieu_chi_Mau.xlsx",
  ban: "Ban_hang_Mau.xlsx",
  mua: "Mua_hang_Mau.xlsx"
};

export const AmisExport: React.FC<AmisExportProps> = ({ jobs, customers, mode, onUpdateJob }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobData | null>(null);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<any | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem(`amis_locked_${mode}_v1`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
        return new Set();
    }
  });

  // Template State
  const [templateWb, setTemplateWb] = useState<XLSX.WorkBook | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  
  // Custom Receipts State (For "Thu Khác" external items)
  const [customReceipts, setCustomReceipts] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('amis_custom_receipts');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });
  
  // Quick Receive Modal State
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('local');
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);
  const [targetExtensionId, setTargetExtensionId] = useState<string | null>(null);
  
  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mockLines: ShippingLine[] = [];

  const currentTemplateFileName = TEMPLATE_MAP[mode] || "AmisTemplate.xlsx";

  useEffect(() => {
    localStorage.setItem(`amis_locked_${mode}_v1`, JSON.stringify(Array.from(lockedIds)));
  }, [lockedIds, mode]);

  useEffect(() => {
      localStorage.setItem('amis_custom_receipts', JSON.stringify(customReceipts));
  }, [customReceipts]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, filterMonth]);

  // --- AUTO LOAD TEMPLATE FROM SERVER ---
  useEffect(() => {
    const fetchServerTemplate = async () => {
        setIsLoadingTemplate(true);
        setTemplateWb(null); 
        setTemplateName('');
        
        try {
            const fileUrl = `${BACKEND_URL}/uploads/${TEMPLATE_FOLDER}/${currentTemplateFileName}`;
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            
            if (response.status === 200) {
                const wb = XLSX.read(response.data, { type: 'array' });
                setTemplateWb(wb);
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

  // --- UPLOAD TEMPLATE TO SERVER ---
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      setTemplateWb(wb);
      setTemplateName(file.name);
    };
    reader.readAsBinaryString(file);

    try {
        const formData = new FormData();
        formData.append("folderPath", TEMPLATE_FOLDER);
        formData.append("fileName", currentTemplateFileName);
        formData.append("file", file);

        await axios.post(`${BACKEND_URL}/upload-file`, formData);
        
        const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
        alert(`Đã lưu mẫu "${displayName}" lên Server! Lần sau truy cập sẽ tự động tải.`);
        setTemplateName(`${displayName} (Mới cập nhật)`);
    } catch (err) {
        console.error("Lỗi upload mẫu:", err);
        alert("Có lỗi khi lưu mẫu lên server. Mẫu chỉ có hiệu lực trong phiên làm việc này.");
    } finally {
        setIsUploadingTemplate(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => fileInputRef.current?.click();

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
  };

  const exportData = useMemo(() => {
    let filteredJobs = jobs;
    if (filterMonth) {
      filteredJobs = jobs.filter(j => j.month === filterMonth);
    }

    if (mode === 'thu') {
      const rows: any[] = [];
      
      // 1. Thu Cược (Deposit)
      filteredJobs.filter(j => j.thuCuoc > 0 && j.amisDepositDocNo).forEach(j => {
         const docNo = j.amisDepositDocNo;
         const desc = j.amisDepositDesc || `Thu tiền khách hàng CƯỢC BL ${j.jobCode}`;
         const custCode = getCustomerCode(j.maKhCuocId);
         
         rows.push({
             jobId: j.id, type: 'deposit_thu', rowId: `dep-${j.id}`,
             date: j.ngayThuCuoc, docNo, objCode: custCode, objName: getCustomerName(j.maKhCuocId),
             desc, amount: j.thuCuoc, tkNo: '1121', tkCo: '1388', 
             col1: j.ngayThuCuoc, col2: j.ngayThuCuoc, col3: docNo, col4: custCode, col5: getCustomerName(j.maKhCuocId),
             col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '1388', col17: j.thuCuoc, col19: custCode,
         });
      });

      // 2. Thu Local Charge
      filteredJobs.filter(j => j.localChargeTotal > 0 && j.amisLcDocNo).forEach(j => {
          const docNo = j.amisLcDocNo;
          const desc = j.amisLcDesc || `Thu tiền khách hàng theo hoá đơn ${j.localChargeInvoice} (KIM)`;
          const custCode = getCustomerCode(j.customerId);

           rows.push({
               jobId: j.id, type: 'lc_thu', rowId: `lc-${j.id}`,
               date: j.localChargeDate, docNo, objCode: custCode, objName: getCustomerName(j.customerId),
               desc, amount: j.localChargeTotal, tkNo: '1121', tkCo: '13111',
               col1: j.localChargeDate, col2: j.localChargeDate, col3: docNo, col4: custCode, col5: getCustomerName(j.customerId),
               col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '13111', col17: j.localChargeTotal, col19: custCode,
           });
      });

      // 3. Thu Extension
      filteredJobs.forEach(j => {
          (j.extensions || []).forEach((ext) => {
              if (ext.total > 0 && ext.amisDocNo) {
                  const docNo = ext.amisDocNo;
                  const desc = ext.amisDesc || `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`;
                  const custId = ext.customerId || j.customerId;
                  const custCode = getCustomerCode(custId);

                  rows.push({
                      jobId: j.id, type: 'ext_thu', extensionId: ext.id, rowId: `ext-${ext.id}`,
                      date: ext.invoiceDate, docNo, objCode: custCode, objName: getCustomerName(custId),
                      desc, amount: ext.total, tkNo: '1121', tkCo: '13111',
                      col1: ext.invoiceDate, col2: ext.invoiceDate, col3: docNo, col4: custCode, col5: getCustomerName(custId),
                      col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '13111', col17: ext.total, col19: custCode,
                  });
              }
          });
      });

      // 4. Custom Receipts (Thu Khác - Ngoài Job)
      // Filter by Month if needed
      customReceipts.forEach(r => {
          const d = new Date(r.date);
          const m = (d.getMonth() + 1).toString();
          
          if (!filterMonth || m === filterMonth) {
              rows.push({
                  ...r,
                  type: 'external', rowId: `custom-${r.id}`,
                  col1: r.date, col2: r.date, col3: r.docNo, col4: r.objCode, col5: r.objName,
                  col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: r.desc, col12: 'VND', col14: r.desc, col15: r.tkNo, col16: r.tkCo, col17: r.amount, col19: r.objCode,
              });
          }
      });

      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } 
    else if (mode === 'chi') {
        const rows: any[] = [];
        const processedDocNos = new Set<string>();

        // 1. Chi Payment (General/Local Charge)
        filteredJobs.forEach(j => {
             if (j.amisPaymentDocNo && !processedDocNos.has(j.amisPaymentDocNo)) {
                 processedDocNos.add(j.amisPaymentDocNo);
                 
                 let amount = 0;
                 if (j.booking) {
                     // Sum all jobs in this booking
                     const bookingJobs = jobs.filter(x => x.booking === j.booking);
                     amount = bookingJobs.reduce((sum, x) => sum + (x.chiPayment || 0), 0);
                 } else {
                     amount = j.chiPayment || 0;
                 }
                 
                 if (amount === 0) {
                     const summary = calculateBookingSummary(jobs, j.booking);
                     amount = summary ? summary.totalCost : j.cost;
                 }

                 rows.push({
                     jobId: j.id, type: 'payment_chi', rowId: `pay-${j.id}`,
                     date: j.amisPaymentDate || new Date().toISOString().split('T')[0],
                     docNo: j.amisPaymentDocNo,
                     objCode: j.line, 
                     objName: '', 
                     desc: j.amisPaymentDesc, 
                     amount: amount,
                     reason: 'Chi khác',
                     paymentContent: j.amisPaymentDesc,
                     paymentAccount: '345673979999',
                     paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisPaymentDesc, tkNo: '3311', tkCo: '1121',
                 });
             }
        });

        // 2. Chi Cược (Deposit Out)
        filteredJobs.forEach(j => {
             if (j.amisDepositOutDocNo && !processedDocNos.has(j.amisDepositOutDocNo)) {
                 processedDocNos.add(j.amisDepositOutDocNo);
                 
                 let depositAmt = 0;
                 if (j.booking) {
                     const bookingJobs = jobs.filter(x => x.booking === j.booking);
                     depositAmt = bookingJobs.reduce((sum, x) => sum + (x.chiCuoc || 0), 0);
                 } else {
                     depositAmt = j.chiCuoc || 0;
                 }

                 rows.push({
                     jobId: j.id, type: 'deposit_chi', rowId: `depchi-${j.id}`,
                     date: j.amisDepositOutDate || new Date().toISOString().split('T')[0],
                     docNo: j.amisDepositOutDocNo,
                     objCode: j.line, 
                     objName: '', 
                     desc: j.amisDepositOutDesc, 
                     amount: depositAmt,
                     reason: 'Chi khác', 
                     paymentContent: j.amisDepositOutDesc,
                     paymentAccount: '345673979999', 
                     paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisDepositOutDesc, tkNo: '3311', tkCo: '1121',
                 });
             }
        });

        // 3. Chi Hoàn Cược Khách Hàng (Deposit Refund)
        filteredJobs.forEach(j => {
             if (j.amisDepositRefundDocNo && !processedDocNos.has(j.amisDepositRefundDocNo)) {
                 processedDocNos.add(j.amisDepositRefundDocNo);
                 const custCode = getCustomerCode(j.maKhCuocId || j.customerId);
                 const custName = getCustomerName(j.maKhCuocId || j.customerId);

                 rows.push({
                     jobId: j.id, type: 'deposit_refund', rowId: `depref-${j.id}`,
                     date: j.amisDepositRefundDate || j.ngayThuHoan || new Date().toISOString().split('T')[0],
                     docNo: j.amisDepositRefundDocNo,
                     objCode: custCode, 
                     objName: custName, 
                     desc: j.amisDepositRefundDesc, 
                     amount: j.thuCuoc,
                     reason: 'Chi khác', 
                     paymentContent: j.amisDepositRefundDesc,
                     paymentAccount: '345673979999', 
                     paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisDepositRefundDesc, tkNo: '1388', tkCo: '1121',
                 });
             }
        });

        // 4. Chi Gia Hạn (Extension Payment)
        filteredJobs.forEach(j => {
             if (j.amisExtensionPaymentDocNo && !processedDocNos.has(j.amisExtensionPaymentDocNo)) {
                 processedDocNos.add(j.amisExtensionPaymentDocNo);
                 
                 // Get total extension cost
                 let amount = 0;
                 if (j.booking) {
                     const summary = calculateBookingSummary(jobs, j.booking);
                     if (summary) amount = summary.costDetails.extensionCosts.reduce((s, i) => s + i.total, 0);
                 } else if (j.bookingCostDetails) {
                     amount = j.bookingCostDetails.extensionCosts.reduce((s, i) => s + i.total, 0);
                 }

                 rows.push({
                     jobId: j.id, type: 'extension_chi', rowId: `extchi-${j.id}`,
                     date: j.amisExtensionPaymentDate || new Date().toISOString().split('T')[0],
                     docNo: j.amisExtensionPaymentDocNo,
                     objCode: j.line, 
                     objName: '', 
                     desc: j.amisExtensionPaymentDesc, 
                     amount: amount,
                     reason: 'Chi khác', 
                     paymentContent: j.amisExtensionPaymentDesc,
                     paymentAccount: '345673979999', 
                     paymentBank: 'Ngân hàng TMCP Quân đội',
                     currency: 'VND', description: j.amisExtensionPaymentDesc, tkNo: '3311', tkCo: '1121',
                 });
             }
        });

        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    else if (mode === 'ban') {
        const rows: any[] = [];
        filteredJobs.filter(j => j.sell > 0).forEach(j => {
            const date = new Date().toISOString().split('T')[0];
            const docNo = `PBH-${j.jobCode}`;
            const year = new Date().getFullYear().toString().slice(-2);
            const month = (j.month || '01').padStart(2, '0');
            const defaultProjectCode = `K${year}${month}${j.jobCode}`;
            const desc = `Bán hàng LONG HOÀNG - KIMBERRY BILL ${j.booking || ''} là cost ${j.hbl || ''} (không xuất hóa đơn)`;
            rows.push({
                originalJob: j, rowId: `ban-${j.id}`,
                date,
                docDate: date,
                docNo,
                customerCode: 'LONGHOANGKIMBERRY',
                desc,
                amount: j.sell, 
                salesType: 'Bán hàng hóa trong nước',
                paymentMethod: 'Chưa thu tiền',
                isDeliveryVoucher: 'Không',
                isInvoiceIncluded: 'Không',
                currency: 'VND',
                itemCode: 'AGENT FEE',
                isNote: 'Không',
                tkNo: '13112',
                tkCo: '51111',
                quantity: 1,
                vatRate: '0%',
                tkVat: '33311',
                projectCode: defaultProjectCode,
            });
        });
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    else if (mode === 'mua') {
        const bookingIds = Array.from(new Set(filteredJobs.map(j => j.booking).filter(b => !!b)));
        const rows: any[] = [];

        bookingIds.forEach(bid => {
            const summary = calculateBookingSummary(filteredJobs, bid);
            if (!summary) return;

            const lcDetails = summary.costDetails.localCharge;
            const additional = summary.costDetails.additionalLocalCharges || [];
            
            const totalNet = (lcDetails.net || 0) + additional.reduce((s,i) => s + (i.net || 0), 0);
            
            if (totalNet > 0) {
                const docNo = `PMH-${summary.bookingId}`;
                const date = lcDetails.date || new Date().toISOString().split('T')[0];
                const supplierName = summary.line; 
                const desc = `Mua hàng của ${supplierName} BILL ${summary.bookingId}`;
                
                rows.push({
                    originalBooking: summary, rowId: `mua-${summary.bookingId}`,
                    date, 
                    docNo,
                    invoiceNo: lcDetails.invoice || '',
                    supplierCode: summary.line,
                    supplierName,
                    desc,
                    itemName: 'Phí Local Charge',
                    amount: totalNet,
                    purchaseType: 'Mua hàng trong nước không qua kho',
                    paymentMethod: 'Chưa thanh toán',
                    invoiceIncluded: 'Nhận kèm hóa đơn',
                    importSlipNo: '1',
                    currency: 'VND',
                    itemCode: 'LCC',
                    isNote: 'Không',
                    tkCost: '63211',
                    tkPayable: '3311',
                    quantity: 1,
                    vatRate: '5%',
                    vatAmount: (lcDetails.vat || 0) + additional.reduce((s,i) => s + (i.vat || 0), 0),
                    tkVat: '1331',
                });
            }
        });
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return [];
  }, [jobs, mode, filterMonth, customers, customReceipts]); 

  // ... Handlers ...
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

  const toggleLock = (docNo: string) => {
    const newLocks = new Set(lockedIds);
    if (newLocks.has(docNo)) newLocks.delete(docNo);
    else {
        newLocks.add(docNo);
        const newSelection = new Set(selectedIds);
        newSelection.delete(docNo);
        setSelectedIds(newSelection);
    }
    setLockedIds(newLocks);
  };

  const handleEditClick = (row: any) => {
      // If it's a "Chi" or Sales/Purchase receipt, we use the specific modals or fallback logic
      if (mode === 'chi' || mode === 'ban' || mode === 'mua') {
          setSelectedItem(row);
          if (mode === 'ban') {
              setSelectedJobForModal(row.originalJob);
          } else if (mode === 'mua') {
              setSelectedBookingForModal(row.originalBooking);
          }
          return;
      }

      // Handle "Thu" Receipts using QuickReceiveModal
      if (row.type === 'external') {
          // Convert row back to a dummy job for editing
          const dummyJob: JobData = {
              ...INITIAL_JOB,
              id: row.id, // Keep original ID to update
              jobCode: 'THU-KHAC', 
              customerId: row.objCode, // Map code to ID field for simplicity in dummy
              customerName: row.objName,
              localChargeDate: row.date,
              localChargeTotal: row.amount,
              localChargeInvoice: '', // Invoice might be part of desc or handled by modal
              amisLcDocNo: row.docNo,
              amisLcDesc: row.desc
          };
          setQuickReceiveJob(dummyJob);
          setQuickReceiveMode('other');
          setTargetExtensionId(null);
          setIsQuickReceiveOpen(true);
      } else {
          // It's a real job receipt
          const job = jobs.find(j => j.id === row.jobId);
          if (job) {
              setQuickReceiveJob(job);
              
              if (row.type === 'deposit_thu') setQuickReceiveMode('deposit');
              else if (row.type === 'lc_thu') setQuickReceiveMode('local');
              else if (row.type === 'ext_thu') {
                  setQuickReceiveMode('extension');
                  setTargetExtensionId(row.extensionId);
              }
              
              setIsQuickReceiveOpen(true);
          }
      }
  };

  const handleDeleteRow = (row: any) => {
      if (!window.confirm("Bạn có chắc chắn muốn xóa phiếu này?")) return;

      if (row.type === 'external') {
          setCustomReceipts(prev => prev.filter(r => r.id !== row.id));
      } else {
          // Standard Job deletion logic: Clear AMIS fields
          if (!onUpdateJob) return;
          
          const job = jobs.find(j => j.id === row.jobId);
          if (!job) return;

          let updatedJob = { ...job };

          if (row.type === 'deposit_thu') {
              updatedJob.amisDepositDocNo = '';
              updatedJob.amisDepositDesc = '';
          } else if (row.type === 'lc_thu') {
              updatedJob.amisLcDocNo = '';
              updatedJob.amisLcDesc = '';
          } else if (row.type === 'ext_thu') {
              if (updatedJob.extensions) {
                  updatedJob.extensions = updatedJob.extensions.map(ext => {
                      if (ext.id === row.extensionId) {
                          return { ...ext, amisDocNo: '', amisDesc: '' };
                      }
                      return ext;
                  });
              }
          } else if (row.type === 'payment_chi') {
              updatedJob.amisPaymentDocNo = '';
              updatedJob.amisPaymentDesc = '';
          } else if (row.type === 'deposit_chi') {
              updatedJob.amisDepositOutDocNo = '';
              updatedJob.amisDepositOutDesc = '';
          } else if (row.type === 'extension_chi') {
              updatedJob.amisExtensionPaymentDocNo = '';
              updatedJob.amisExtensionPaymentDesc = '';
          } else if (row.type === 'deposit_refund') {
              updatedJob.amisDepositRefundDocNo = '';
              updatedJob.amisDepositRefundDesc = '';
          }

          onUpdateJob(updatedJob);
      }
  };

  const handleExport = () => {
    const rowsToExport = selectedIds.size > 0 ? exportData.filter(d => selectedIds.has(d.docNo)) : [];
    if (rowsToExport.length === 0) {
        alert("Vui lòng chọn ít nhất một phiếu để xuất Excel.");
        return;
    }

    let csvRows: any[][] = [];
    if (mode === 'thu') {
      csvRows = rowsToExport.map((d: any) => [
        d.col1, d.col2, d.col3, d.col4, d.col5, d.col6, d.col7, d.col8, d.col9, d.col10, d.col11, d.col12,
        d.col13, d.col14, d.col15, d.col16, d.col17, d.col18, d.col19, d.col20
      ]);
    } else if (mode === 'chi') {
        csvRows = rowsToExport.map((d: any) => [
            d.date, d.date, d.docNo, d.reason || 'Chi khác', d.paymentContent,
            d.paymentAccount || '345673979999', d.paymentBank || 'Ngân hàng TMCP Quân đội',
            d.objCode, d.objName, 
            '', '', '', '', 
            '', '', '', '', d.currency || 'VND', d.rate, d.description,
            d.tkNo || '3311', d.tkCo || '1121', d.amount, d.amount,
            d.objCodeAccounting || d.objCode, d.loanContract
        ]);
    } else if (mode === 'ban') {
        csvRows = rowsToExport.map((d: any) => [
            d.date, d.docDate, d.docNo, d.salesType, d.paymentMethod, d.customerCode, d.desc, d.itemCode,
            d.tkNo, d.tkCo, d.quantity, d.amount, d.amount, d.vatRate, d.tkVat, d.projectCode,
            d.isDeliveryVoucher, d.isInvoiceIncluded, d.currency, d.isNote
        ]);
    } else if (mode === 'mua') {
        csvRows = rowsToExport.map((d: any) => [
            d.purchaseType, d.paymentMethod, d.invoiceIncluded, d.date, d.date, d.importSlipNo, d.docNo,
            '', '', d.invoiceNo, d.date, d.supplierCode, d.supplierName, '', '', d.desc,
            d.itemCode, d.itemName, d.tkCost, d.tkPayable, '', d.quantity, d.amount, d.amount,
            d.vatRate, d.vatAmount, d.tkVat
        ]);
    }

    let wb: XLSX.WorkBook;
    let ws: XLSX.WorkSheet;

    if (templateWb) {
      wb = templateWb;
      const sheetName = wb.SheetNames[0];
      ws = wb.Sheets[sheetName];
      XLSX.utils.sheet_add_aoa(ws, csvRows, { origin: -1 });
    } else {
      let headers: string[] = [];
      if (mode === 'thu') {
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Nộp vào TK', 'Mở tại NH', 'Lý do thu', 'Diễn giải lý do', 'NV thu', 'Loại tiền', 'Tỷ giá', 'Diễn giải HT', 'TK Nợ', 'TK Có', 'Số tiền', 'Quy đổi', 'Mã ĐT HT', 'Khế ước'];
      } else if (mode === 'chi') {
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Lý do chi', 'Nội dung TT', 'Số TK chi', 'Tên NH chi', 'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Số TK nhận', 'Tên NH nhận', 'Người lĩnh', 'CMND', 'Ngày cấp', 'Nơi cấp', 'Mã NV', 'Loại tiền', 'Tỷ giá', 'Diễn giải HT', 'TK Nợ', 'TK Có', 'Số tiền', 'Quy đổi', 'Mã ĐT HT', 'Khế ước'];
      } else if (mode === 'ban') {
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Hình thức bán hàng', 'Phương thức TT', 'Mã khách hàng', 'Diễn giải', 'Mã hàng', 'TK Nợ', 'TK Có', 'Số lượng', 'Đơn giá', 'Thành tiền', '% Thuế GTGT', 'TK Thuế GTGT', 'Mã công trình', 'Kiêm phiếu XK', 'Lập kèm HĐ', 'Loại tiền', 'Là dòng ghi chú'];
      } else if (mode === 'mua') {
         headers = ['Hình thức mua hàng', 'Phương thức thanh toán', 'Nhận kèm hóa đơn', 'Ngày hạch toán', 'Ngày chứng từ', 'Số phiếu nhập', 'Số chứng từ', 'Mẫu số HĐ', 'Ký hiệu HĐ', 'Số hóa đơn', 'Ngày hóa đơn', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Địa chỉ', 'MST', 'Diễn giải', 'Mã hàng', 'Tên hàng', 'TK kho/chi phí', 'TK công nợ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', '% Thuế GTGT', 'Tiền thuế GTGT', 'TK thuế GTGT'];
      }
      ws = XLSX.utils.aoa_to_sheet([headers, ...csvRows]);
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Amis Export");
    }

    XLSX.writeFile(wb, `amis_export_${mode}_${new Date().toISOString().slice(0,10)}.xlsx`);

    const newLocked = new Set(lockedIds);
    rowsToExport.forEach((r: any) => newLocked.add(r.docNo));
    setLockedIds(newLocked);
    setSelectedIds(new Set());
  };

  const titles = { thu: 'Phiếu Thu Tiền', chi: 'Phiếu Chi Tiền', ban: 'Phiếu Bán Hàng', mua: 'Phiếu Mua Hàng' };
  const unlockedCount = exportData.filter(r => !lockedIds.has(r.docNo)).length;
  const isAllSelected = unlockedCount > 0 && selectedIds.size === unlockedCount;

  // --- SAVE HANDLER FOR CHI/BAN/MUA MODALS ---
  const handleSaveEdit = (newData: any) => {
     if (!onUpdateJob) return;

     const context = selectedItem; 
     if (!context || !context.jobId) return;

     const originalJob = jobs.find(j => j.id === context.jobId);
     if (!originalJob) return;

     let updatedJob = { ...originalJob };

     if (context.type === 'payment_chi') {
         updatedJob.amisPaymentDocNo = newData.docNo;
         updatedJob.amisPaymentDesc = newData.paymentContent || newData.desc; 
         updatedJob.amisPaymentDate = newData.date;
         
         if (updatedJob.booking) {
             const bookingJobs = jobs.filter(x => x.booking === updatedJob.booking && x.id !== updatedJob.id);
             bookingJobs.forEach(bj => {
                 onUpdateJob({ ...bj, chiPayment: 0 }); // Zero out others
             });
         }
         updatedJob.chiPayment = newData.amount; // Set total to this job
     }
     else if (context.type === 'deposit_chi') {
         updatedJob.amisDepositOutDocNo = newData.docNo;
         updatedJob.amisDepositOutDesc = newData.paymentContent || newData.desc;
         updatedJob.amisDepositOutDate = newData.date;
         
         if (updatedJob.booking) {
             const bookingJobs = jobs.filter(x => x.booking === updatedJob.booking && x.id !== updatedJob.id);
             bookingJobs.forEach(bj => {
                 onUpdateJob({ ...bj, chiCuoc: 0 }); // Zero out others
             });
         }
         updatedJob.chiCuoc = newData.amount; // Set total to this job
     }
     else if (context.type === 'extension_chi') {
         updatedJob.amisExtensionPaymentDocNo = newData.docNo;
         updatedJob.amisExtensionPaymentDesc = newData.paymentContent || newData.desc;
         updatedJob.amisExtensionPaymentDate = newData.date;
     }
     else if (context.type === 'deposit_refund') {
         updatedJob.amisDepositRefundDocNo = newData.docNo;
         updatedJob.amisDepositRefundDesc = newData.paymentContent || newData.desc;
         updatedJob.amisDepositRefundDate = newData.date;
         updatedJob.thuCuoc = newData.amount; 
     }

     onUpdateJob(updatedJob);

     setSelectedItem(null);
     setSelectedJobForModal(null);
     setSelectedBookingForModal(null);
  };
  
  const isInteractiveMode = mode === 'thu' || mode === 'chi' || mode === 'ban' || mode === 'mua';

  // --- THU KHÁC (STANDALONE RECEIPT) ---
  const handleOpenThuKhac = () => {
      // Create a dummy job container for the QuickReceiveModal
      const dummyJob: JobData = {
          ...INITIAL_JOB,
          id: `EXT-${Date.now()}`,
          jobCode: 'THU-KHAC', // Display name in modal
          // Reset key fields
          customerId: '',
          customerName: '',
          localChargeTotal: 0,
          localChargeDate: new Date().toISOString().split('T')[0],
          amisLcDocNo: '',
          amisLcDesc: 'Thu tiền khác'
      };
      setQuickReceiveJob(dummyJob);
      setQuickReceiveMode('other');
      setTargetExtensionId(null);
      setIsQuickReceiveOpen(true);
  };

  const handleSaveQuickReceive = (updatedJob: JobData) => {
      // 1. Handle External Receipt (Thu Khác)
      if (quickReceiveMode === 'other') {
          // Check if this ID already exists in customReceipts (Editing case)
          const existingIndex = customReceipts.findIndex(r => r.id === updatedJob.id);
          
          const cust = customers.find(c => c.id === updatedJob.customerId);
          const objCode = cust ? cust.code : (updatedJob.customerId || '');
          const objName = cust ? cust.name : (updatedJob.customerName || '');
          
          const receiptData = {
              id: updatedJob.id,
              type: 'external',
              date: updatedJob.localChargeDate || new Date().toISOString().split('T')[0],
              docNo: updatedJob.amisLcDocNo || '',
              objCode,
              objName,
              desc: updatedJob.amisLcDesc || '',
              amount: updatedJob.localChargeTotal || 0,
              tkNo: '1121', 
              tkCo: '13111',
              
              // AMIS Columns mapping
              col1: updatedJob.localChargeDate,
              col2: updatedJob.localChargeDate,
              col3: updatedJob.amisLcDocNo,
              col4: objCode,
              col5: objName,
              col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác',
              col10: updatedJob.amisLcDesc,
              col12: 'VND',
              col14: updatedJob.amisLcDesc,
              col15: '1121',
              col16: '13111', 
              col17: updatedJob.localChargeTotal,
              col19: objCode
          };

          if (existingIndex >= 0) {
              // Update existing
              setCustomReceipts(prev => {
                  const newArr = [...prev];
                  newArr[existingIndex] = receiptData;
                  return newArr;
              });
          } else {
              // Add new
              setCustomReceipts(prev => [...prev, receiptData]);
          }
      } 
      // 2. Handle Real Job Receipt Update
      else {
          if (onUpdateJob) {
              onUpdateJob(updatedJob);
          }
      }
      
      setIsQuickReceiveOpen(false);
      setQuickReceiveJob(null);
      setTargetExtensionId(null);
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
                onClick={triggerFileUpload} 
                disabled={isUploadingTemplate}
                className="glass-panel hover:bg-white/80 px-4 py-2 rounded-lg flex items-center space-x-2 text-slate-700 transition-colors"
                title="Tải file mẫu từ máy tính lên server"
              >
                 {isUploadingTemplate ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                 ) : (
                    templateWb ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />
                 )} 
                 <span className="flex flex-col items-start text-xs">
                    <span className="font-bold">{templateWb ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>
                    {templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}
                 </span>
              </button>

              {isLoadingTemplate && (
                  <div className="flex items-center text-xs text-blue-500 px-2 animate-pulse">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang tải mẫu...
                  </div>
              )}

              {isInteractiveMode && lockedIds.size > 0 && (
                  <button onClick={() => setLockedIds(new Set())} className="bg-white/50 hover:bg-white/80 text-slate-600 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                      <RefreshCw className="w-4 h-4" /> <span>Mở khóa tất cả</span>
                  </button>
              )}

              {/* THU KHÁC BUTTON */}
              {mode === 'thu' && (
                  <button 
                    onClick={handleOpenThuKhac} 
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
                {isInteractiveMode && (
                    <th className="px-6 py-3 w-10 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={isAllSelected} onChange={handleSelectAll} />
                    </th>
                )}
                {isInteractiveMode && <th className="px-6 py-3 w-10 text-center">Khóa</th>}
                <th className="px-6 py-3">Ngày CT</th>
                <th className="px-6 py-3">Số CT</th>
                <th className="px-6 py-3">Mã Đối Tượng</th>
                <th className="px-6 py-3">Diễn giải</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                {isInteractiveMode && <th className="px-6 py-3 text-center w-28">Chức năng</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {exportData.length > 0 ? (
                 exportData.map((row: any, idx) => {
                   const isLocked = isInteractiveMode && lockedIds.has(row.docNo);
                   const isSelected = selectedIds.has(row.docNo);
                   const rowKey = row.rowId || `${row.type}-${row.docNo}-${idx}`;
                   
                   return (
                   <tr key={rowKey} className={`${isLocked ? 'bg-slate-100/50 text-gray-500' : 'hover:bg-white/30'} ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      {isInteractiveMode && (
                          <td className="px-6 py-3 text-center">
                              <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(row.docNo)} disabled={isLocked} className="w-4 h-4 rounded border-gray-300" />
                          </td>
                      )}
                      {isInteractiveMode && (
                        <td className="px-6 py-3 text-center">
                             <button onClick={() => toggleLock(row.docNo)} className="text-gray-400 hover:text-blue-600">
                                {isLocked ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 opacity-30" />}
                             </button>
                        </td>
                      )}
                      
                      <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                      <td className={`px-6 py-3 font-medium ${isLocked ? 'text-gray-600' : 'text-blue-600'}`}>{row.docNo}</td>
                      <td className="px-6 py-3">{row.objCode}</td>
                      
                      {/* Description with Copy */}
                      <td className="px-6 py-3 max-w-xs group relative">
                          <div className="flex items-center justify-between">
                              <span className="truncate mr-2" title={row.desc}>{row.desc}</span>
                              <button 
                                  onClick={() => handleCopy(row.desc, `desc-${rowKey}`)}
                                  className="text-slate-300 hover:text-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Copy diễn giải"
                              >
                                  {copiedId === `desc-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                          </div>
                      </td>

                      {/* Amount with Copy */}
                      <td className="px-6 py-3 text-right font-medium group relative">
                          <div className="flex items-center justify-end">
                              <span className="mr-2">{formatCurrency(row.amount)}</span>
                              <button 
                                  onClick={() => handleCopy(row.amount.toString(), `amt-${rowKey}`)}
                                  className="text-slate-300 hover:text-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Copy số tiền"
                              >
                                  {copiedId === `amt-${rowKey}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                          </div>
                      </td>
                      
                      {isInteractiveMode && (
                          <td className="px-6 py-3 text-center">
                              {!isLocked && (
                                  <div className="flex justify-center space-x-2">
                                      <button 
                                        onClick={() => handleEditClick(row)} 
                                        className="text-gray-400 hover:text-blue-500 hover:bg-blue-100 p-1.5 rounded transition-colors"
                                        title="Sửa"
                                      >
                                          <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteRow(row)} 
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors"
                                        title="Xóa phiếu"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              )}
                          </td>
                      )}
                   </tr>
                 )})
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu phù hợp (Hãy tạo phiếu thu/chi trước)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modals */}
      {selectedItem && mode === 'chi' && (
         <PaymentVoucherModal 
            isOpen={true} 
            initialData={selectedItem}
            onClose={() => setSelectedItem(null)} 
            onSave={handleSaveEdit} 
         />
      )}

      {selectedItem && mode === 'ban' && selectedJobForModal && (
          <SalesInvoiceModal
             isOpen={true}
             job={selectedJobForModal}
             initialData={selectedItem}
             onClose={() => { setSelectedItem(null); setSelectedJobForModal(null); }}
             onSave={handleSaveEdit}
          />
      )}

      {selectedItem && mode === 'mua' && selectedBookingForModal && (
          <PurchaseInvoiceModal
             isOpen={true}
             booking={selectedBookingForModal}
             initialData={selectedItem}
             lines={mockLines}
             onClose={() => { setSelectedItem(null); setSelectedBookingForModal(null); }}
             onSave={handleSaveEdit}
          />
      )}

      {/* QUICK RECEIVE MODAL FOR THU KHAC & EDITING RECEIPTS */}
      {isQuickReceiveOpen && quickReceiveJob && (
          <QuickReceiveModal 
              isOpen={isQuickReceiveOpen}
              onClose={() => setIsQuickReceiveOpen(false)}
              onSave={handleSaveQuickReceive}
              job={quickReceiveJob}
              mode={quickReceiveMode}
              customers={customers}
              targetExtensionId={targetExtensionId}
          />
      )}

    </div>
  );
};
