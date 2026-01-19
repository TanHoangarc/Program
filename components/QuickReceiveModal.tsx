
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle, Wallet, RotateCcw, Plus, Search, Trash2, ChevronDown, Anchor, History, Receipt, ToggleLeft, ToggleRight, Layers, HandCoins, Lock } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo, calculatePaymentStatus } from '../utils';
import { CustomerModal } from './CustomerModal';

export type ReceiveMode = 'local' | 'deposit' | 'deposit_refund' | 'extension' | 'other' | 'refund_overpayment';

interface QuickReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobData) => void;
  job: JobData;
  mode: ReceiveMode;
  customers: Customer[];
  allJobs?: JobData[];
  targetExtensionId?: string | null;
  usedDocNos?: string[]; 
  initialAddedJobs?: JobData[];
  onAddCustomer?: (customer: Customer) => void;
}

// Reusable DateInput Component
const DateInput = ({ 
  value, 
  onChange, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  className?: string;
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const handleBlur = () => {
    if (!displayValue) {
      if (value) onChange('');
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) {
      if (parsed !== value) onChange(parsed);
    } else {
      setDisplayValue(formatDateVN(value));
    }
  };

  const handleDateIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <input 
        type="text" 
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-4 h-4 text-slate-500" />
      </div>
    </div>
  );
};

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
);

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers, allJobs, targetExtensionId, usedDocNos = [], initialAddedJobs = [], onAddCustomer
}) => {
  const [formData, setFormData] = useState<JobData>(job);
  const [otherSubMode, setOtherSubMode] = useState<'local' | 'deposit'>('local');
  
  const [invoiceInputMode, setInvoiceInputMode] = useState<'invoice' | 'bl'>('invoice');

  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0); 
  const [amisDate, setAmisDate] = useState(''); 

  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0], 
    total: 0,
    amisDocNo: '',
    amisDesc: '',
    amisAmount: 0,
    amisDate: '' 
  });
  
  const [originalGroupDocNo, setOriginalGroupDocNo] = useState('');

  const [additionalReceipts, setAdditionalReceipts] = useState<AdditionalReceipt[]>([]);
  const [isAddingReceipt, setIsAddingReceipt] = useState(false);
  const [newReceipt, setNewReceipt] = useState<Partial<AdditionalReceipt>>({
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      desc: '',
      docNo: ''
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [custInputVal, setCustInputVal] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!custInputVal) return [];
    const lower = custInputVal.toLowerCase();
    return customers.filter(c => 
        (c.code || '').toLowerCase().includes(lower) || 
        (c.name || '').toLowerCase().includes(lower)
    );
  }, [custInputVal, customers]);

  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobCode, setSearchJobCode] = useState('');
  
  const [selectedMergedExtIds, setSelectedMergedExtIds] = useState<Set<string>>(new Set());

  const [quickAddTarget, setQuickAddTarget] = useState<{ type: 'MAIN' | 'DEPOSIT' | 'EXTENSION', extId?: string } | null>(null);

  /**
   * Helper tạo chuỗi Invoice tổng hợp: inv1+inv2... + XXX BL Job1+Job2...
   */
  const generateMergedInvoiceString = (mainInvoice: string, extraJobs: JobData[], isExtension: boolean, selectedExtIds: Set<string>) => {
      const invoices: string[] = [];
      const missingJobCodes: string[] = [];
      const allJobsList = [formData, ...extraJobs];

      allJobsList.forEach((j, idx) => {
          const isMain = idx === 0;
          if (isExtension) {
              const selectedExts = (j.extensions || []).filter(e => selectedExtIds.has(e.id));
              selectedExts.forEach(e => {
                  if (e.invoice && e.invoice.trim()) {
                      invoices.push(e.invoice.trim());
                  } else {
                      missingJobCodes.push(j.jobCode);
                  }
              });
          } else {
              const inv = isMain ? mainInvoice : (j.localChargeInvoice || '');
              if (inv && inv.trim()) {
                  invoices.push(inv.trim());
              } else {
                  missingJobCodes.push(j.jobCode);
              }
          }
      });

      const uniqueInvoices = Array.from(new Set(invoices));
      const uniqueMissingJobs = Array.from(new Set(missingJobCodes));

      let result = uniqueInvoices.join('+');
      if (uniqueMissingJobs.length > 0) {
          if (result.length > 0) result += '+';
          result += `XXX BL ${uniqueMissingJobs.join('+')}`;
      }
      return result;
  };

  const generateMergedDescription = (mergedInvoice: string, isExtension: boolean = false) => {
      let desc = isExtension ? "Thu tiền của KH theo hoá đơn GH " : "Thu tiền của KH theo hoá đơn ";
      desc += mergedInvoice || "XXX";
      desc += " (KIM)";
      return desc;
  };

  const recalculateMerge = (currentMainInvoice: string, extraJobs: JobData[], currentSelectedExtIds: Set<string> = selectedMergedExtIds) => {
      const isExtension = mode === 'extension';
      
      // 1. Tính toán chuỗi Invoice gộp mới
      const mergedInvoice = generateMergedInvoiceString(currentMainInvoice, extraJobs, isExtension, currentSelectedExtIds);
      
      // 2. Tính toán Diễn giải từ Invoice gộp
      const newDesc = generateMergedDescription(mergedInvoice, isExtension);
      
      let totalAmount = 0;
      
      if (isExtension) {
          const allJobsList = [formData, ...extraJobs];
          allJobsList.forEach(j => {
              (j.extensions || []).forEach(ext => {
                  if (currentSelectedExtIds.has(ext.id)) {
                      totalAmount += ext.total;
                  }
              });
          });
          
          setNewExtension(prev => ({ 
              ...prev, 
              invoice: mergedInvoice, // Tự động cập nhật ô Invoice
              amisDesc: newDesc,
              total: totalAmount,
              amisAmount: totalAmount 
          }));
          
      } else {
          const mainAmt = job.localChargeTotal || 0; 
          const extraAmt = extraJobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
          
          setFormData(prev => ({ ...prev, localChargeInvoice: mergedInvoice })); // Tự động cập nhật ô Invoice
          setAmisDesc(newDesc);
          setAmisAmount(mainAmt + extraAmt);
      }
  };

  const recalculateDepositRefundMerge = (currentMainJob: JobData, extraJobs: JobData[]) => {
      const allJobs = [currentMainJob, ...extraJobs];
      const totalAmount = allJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
      
      // Generate Description
      const jobCodes = Array.from(new Set(allJobs.map(j => j.jobCode))).join('+');
      const newDesc = `Chi tiền cho KH HOÀN CƯỢC BL ${jobCodes}`;

      setAmisAmount(totalAmount);
      setAmisDesc(newDesc);
  };

  useEffect(() => {
    if (isOpen) {
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      if (mode === 'other') {
          if (!deepCopyJob.localChargeDate) deepCopyJob.localChargeDate = new Date().toISOString().split('T')[0];
      }

      setFormData(deepCopyJob);
      setAddedJobs(initialAddedJobs); 
      setAdditionalReceipts(deepCopyJob.additionalReceipts || []);
      
      const initialExtSet = new Set<string>();
      let orgDoc = '';
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];

      if (mode === 'extension') {
          let targetExt = null;
          if (targetExtensionId) {
              targetExt = deepCopyJob.extensions?.find((e: any) => e.id === targetExtensionId);
              if (targetExt) {
                  orgDoc = targetExt.amisDocNo || '';
                  (deepCopyJob.extensions || []).forEach((ext: any) => {
                      if (ext.amisDocNo === orgDoc) initialExtSet.add(ext.id);
                  });
                  initialAddedJobs.forEach(mergedJob => {
                      (mergedJob.extensions || []).forEach(ext => {
                          if (ext.amisDocNo === orgDoc) initialExtSet.add(ext.id);
                      });
                  });
              }
          } else {
              orgDoc = ''; 
              (deepCopyJob.extensions || []).forEach((ext: any) => {
                  if (!ext.amisDocNo) initialExtSet.add(ext.id);
              });

              // FIX: Default customer to extension's customer if available
              if (initialExtSet.size > 0) {
                  const firstExtId = Array.from(initialExtSet)[0];
                  targetExt = (deepCopyJob.extensions || []).find((e: any) => e.id === firstExtId);
              }
          }

          setOriginalGroupDocNo(orgDoc);
          setSelectedMergedExtIds(initialExtSet);

          const nextNewDocNo = generateNextDocNo(jobsForCalc, 'NTTK', 5, extra);
          const currentDocNo = orgDoc || nextNewDocNo;

          let initTotal = 0;
          (deepCopyJob.extensions || []).forEach((e: any) => { if (initialExtSet.has(e.id)) initTotal += e.total; });
          initialAddedJobs.forEach(j => { (j.extensions || []).forEach(e => { if (initialExtSet.has(e.id)) initTotal += e.total; }); });

          const custId = targetExt ? (targetExt.customerId || deepCopyJob.customerId) : deepCopyJob.customerId;
          
          // Tính toán Invoice gộp ban đầu dựa trên quy tắc mới
          const mergedInv = generateMergedInvoiceString(targetExt?.invoice || '', initialAddedJobs, true, initialExtSet);
          const desc = targetExt?.amisDesc || generateMergedDescription(mergedInv, true);

          setNewExtension({ 
            customerId: custId || '', 
            invoice: mergedInv, 
            date: targetExt?.invoiceDate || new Date().toISOString().split('T')[0],
            total: initTotal,
            amisDocNo: currentDocNo,
            amisDesc: desc,
            amisAmount: targetExt?.amisAmount !== undefined ? targetExt.amisAmount : initTotal,
            amisDate: targetExt?.amisDate || targetExt?.invoiceDate || new Date().toISOString().split('T')[0]
          });

          const foundCust = customers.find(c => c.id === custId);
          setCustInputVal(foundCust ? foundCust.code : (custId || ''));

      } else {
          if (mode === 'local' || mode === 'other' || mode === 'refund_overpayment') orgDoc = deepCopyJob.amisLcDocNo || '';
          else if (mode === 'deposit') orgDoc = deepCopyJob.amisDepositDocNo || '';
          
          setOriginalGroupDocNo(orgDoc);

          let initialCustId = (mode === 'deposit' || mode === 'deposit_refund') ? deepCopyJob.maKhCuocId : deepCopyJob.customerId;
          const foundCust = customers.find(c => c.id === initialCustId);
          setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

          if (mode === 'local' || mode === 'other') {
              const mergedInv = generateMergedInvoiceString(deepCopyJob.localChargeInvoice || '', initialAddedJobs, false, new Set());
              setAmisDocNo(orgDoc || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
              setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
              setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
              setAmisDesc(deepCopyJob.amisLcDesc || generateMergedDescription(mergedInv, false));
              setFormData(prev => ({ ...prev, localChargeInvoice: mergedInv }));
          } else if (mode === 'deposit') {
              setAmisDocNo(orgDoc || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
              setAmisAmount(deepCopyJob.amisDepositAmount !== undefined ? deepCopyJob.amisDepositAmount : (deepCopyJob.thuCuoc || 0));
              setAmisDate(deepCopyJob.ngayThuCuoc || new Date().toISOString().split('T')[0]);
              setAmisDesc(deepCopyJob.amisDepositDesc || `Thu tiền của KH CƯỢC CONT BL ${deepCopyJob.jobCode}`);
          } else if (mode === 'deposit_refund') {
              setAmisDocNo(deepCopyJob.amisDepositRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC')); 
              setAmisDate(deepCopyJob.ngayThuHoan || new Date().toISOString().split('T')[0]);
              
              if (initialAddedJobs.length > 0) {
                  const allJobs = [deepCopyJob, ...initialAddedJobs];
                  const total = allJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
                  const codes = Array.from(new Set(allJobs.map(j => j.jobCode))).join('+');
                  setAmisDesc(deepCopyJob.amisDepositRefundDesc || `Chi tiền cho KH HOÀN CƯỢC BL ${codes}`);
                  setAmisAmount(total); 
              } else {
                  setAmisDesc(deepCopyJob.amisDepositRefundDesc || `Chi tiền cho KH HOÀN CƯỢC BL ${deepCopyJob.jobCode}`);
                  setAmisAmount(deepCopyJob.thuCuoc || 0); 
              }
          } else if (mode === 'refund_overpayment') {
              setAmisDocNo(generateNextDocNo(jobsForCalc, 'UNC'));
              setAmisDate(new Date().toISOString().split('T')[0]);
              setAmisDesc(`Hoàn tiền thừa local charge BL ${deepCopyJob.jobCode} (KIM)`);
              const status = calculatePaymentStatus(deepCopyJob);
              setAmisAmount(Math.max(0, status.lcDiff));
          }
      }
    }
  }, [isOpen, job.id, mode, targetExtensionId, customers]);

  const handleOpenQuickAdd = (type: 'MAIN' | 'DEPOSIT' | 'EXTENSION', extId?: string) => {
      setQuickAddTarget({ type, extId });
  };

  const handleSaveQuickCustomer = (newCustomer: Customer) => {
      onAddCustomer?.(newCustomer);
      if (quickAddTarget?.type === 'MAIN') {
          setCustInputVal(newCustomer.code);
          updateCustomerData(newCustomer.id);
      }
      setQuickAddTarget(null);
  };

  const handleOtherSubModeChange = (subMode: 'local' | 'deposit') => {
      setOtherSubMode(subMode);
      const invPlaceholder = formData.localChargeInvoice || 'XXX';
      if (subMode === 'deposit') setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
      else setAmisDesc(invoiceInputMode === 'bl' ? `Thu tiền của KH theo hoá đơn XXX BL ${invPlaceholder} (LH MB)` : `Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
  };

  const getDisplayValues = () => {
      let currentTotalReceivable = 0; 
      let mainJobReceivable = 0;      
      let currentCustomer = '';
      let currentInvoice = '';

      if (mode === 'local' || mode === 'other') {
          currentInvoice = formData.localChargeInvoice || '';
          currentTotalReceivable = (formData.localChargeTotal || 0) + addedJobs.reduce((sum, j) => sum + (j.localChargeTotal || 0), 0);
          mainJobReceivable = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit' || mode === 'deposit_refund') {
          currentTotalReceivable = (formData.thuCuoc || 0) + addedJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
          mainJobReceivable = formData.thuCuoc || 0;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A'; 
      } else if (mode === 'extension') {
          currentInvoice = newExtension.invoice;
          currentTotalReceivable = newExtension.total;
          let mainPart = 0;
          (formData.extensions || []).forEach(e => { if (selectedMergedExtIds.has(e.id)) mainPart += e.total; });
          mainJobReceivable = mainPart;
          currentCustomer = newExtension.customerId;
      }
      const customerName = customers.find(c => c.id === currentCustomer || c.code === currentCustomer)?.name || '';
      return { currentTotalReceivable, mainJobReceivable, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();
  const relevantAdditionalReceipts = additionalReceipts.filter(r => {
      if (mode === 'extension') return r.type === 'extension' && r.extensionId && selectedMergedExtIds.has(r.extensionId);
      if (mode === 'local') return r.type === 'local';
      if (mode === 'deposit') return r.type === 'deposit';
      if (mode === 'other') return r.type === otherSubMode;
      return false;
  });

  const currentMainAmount = mode === 'extension' ? newExtension.amisAmount : amisAmount;
  const totalPaidAdditional = relevantAdditionalReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalCollected = currentMainAmount + totalPaidAdditional;
  const remaining = display.currentTotalReceivable - totalCollected;

  const handleAmountChange = (val: number) => {
      if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisAmount: val }));
      else setAmisAmount(val);
  };

  const handleMainDateChange = (val: string) => {
      if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisDate: val }));
      else setAmisDate(val);
  };

  const handleCustomerChange = (val: string) => {
      setCustInputVal(val);
      setShowSuggestions(true);
      updateCustomerData(val);
  };

  const handleSelectCustomer = (customer: Customer) => {
      setCustInputVal(customer.code);
      updateCustomerData(customer.id);
      setShowSuggestions(false);
  };

  const updateCustomerData = (val: string) => {
      if (mode === 'local' || mode === 'other' || mode === 'refund_overpayment') setFormData(prev => ({ ...prev, customerId: val }));
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(prev => ({ ...prev, maKhCuocId: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, customerId: val }));
  };

  const handleInvoiceChange = (val: string) => {
      if (mode === 'local') { 
          setFormData(prev => ({ ...prev, localChargeInvoice: val })); 
          // Khi gõ tay Invoice chính, thực hiện tính toán gộp (nếu đang ở chế độ gộp)
          recalculateMerge(val, addedJobs); 
      }
      else if (mode === 'other') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          const invPlaceholder = val || 'XXX';
          if (otherSubMode === 'deposit') setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
          else setAmisDesc(invoiceInputMode === 'bl' ? `Thu tiền của KH theo hoá đơn XXX BL ${invPlaceholder} (LH MB)` : `Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
      }
      else if (mode === 'extension') { 
          setNewExtension(prev => ({ ...prev, invoice: val })); 
          recalculateMerge(val, addedJobs); 
      }
  };

  const handleAddNewReceipt = () => {
      setIsAddingReceipt(true);
      const currentMainDoc = mode === 'extension' ? newExtension.amisDocNo : amisDocNo;
      const existingInSession = [currentMainDoc, ...additionalReceipts.map(r => r.docNo)].filter(Boolean);
      const nextDoc = generateNextDocNo(allJobs || [], 'NTTK', 5, [...(usedDocNos || []), ...existingInSession]);
      const firstSelectedExtId = (formData.extensions || []).find(e => selectedMergedExtIds.has(e.id))?.id;
      setNewReceipt({ amount: Math.max(0, remaining), date: new Date().toISOString().split('T')[0], docNo: nextDoc, desc: mode === 'extension' ? newExtension.amisDesc : amisDesc, extensionId: firstSelectedExtId });
  };

  const handleSaveNewReceipt = () => {
      if (!newReceipt.amount || !newReceipt.docNo) return;
      const receipt: AdditionalReceipt = {
          id: `rcpt-${Date.now()}`,
          type: mode === 'other' ? otherSubMode : (mode === 'deposit' ? 'deposit' : (mode === 'extension' ? 'extension' : 'local')),
          date: newReceipt.date || '', docNo: newReceipt.docNo || '', desc: newReceipt.desc || '', amount: newReceipt.amount || 0,
          extensionId: mode === 'extension' ? newReceipt.extensionId : undefined
      };
      setAdditionalReceipts(prev => [...prev, receipt]);
      setIsAddingReceipt(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const removedJobs = initialAddedJobs.filter(initial => !addedJobs.some(current => current.id === initial.id));
    const mergedList = [formData, ...addedJobs]; 

    if (mode === 'extension') {
        const currentDocNo = newExtension.amisDocNo;
        mergedList.forEach((job, idx) => {
            const isMain = idx === 0;
            const updatedExtensions = (job.extensions || []).map(ext => {
                if (selectedMergedExtIds.has(ext.id)) {
                    return {
                        ...ext,
                        amisDocNo: currentDocNo,
                        amisDesc: newExtension.amisDesc,
                        amisAmount: isMain && ext.id === (job.extensions?.find(e => selectedMergedExtIds.has(e.id))?.id) ? newExtension.amisAmount : undefined,
                        customerId: isMain ? newExtension.customerId : ext.customerId,
                        invoice: isMain ? newExtension.invoice : ext.invoice,
                        invoiceDate: newExtension.amisDate, // Fixed: Update invoiceDate
                        amisDate: newExtension.amisDate,    // Fixed: Update amisDate
                        date: newExtension.amisDate         // Fixed: Update date
                    };
                }
                return ext;
            });
            onSave({ ...job, extensions: updatedExtensions, additionalReceipts: isMain ? additionalReceipts : job.additionalReceipts });
        });

        if (originalGroupDocNo) {
             removedJobs.forEach(remJob => {
                  const cleanedExtensions = (remJob.extensions || []).map(ext => {
                      if (ext.amisDocNo === originalGroupDocNo) return { ...ext, amisDocNo: '', amisDesc: '', amisAmount: 0 };
                      return ext;
                  });
                  onSave({ ...remJob, extensions: cleanedExtensions });
             });
        }
    } else if (mode === 'local' || mode === 'other' || mode === 'deposit') {
        const isDeposit = mode === 'deposit';
        mergedList.forEach((job, index) => {
            const isMainJob = index === 0;
            const updates: any = {};
            if (isDeposit) {
                updates.amisDepositDocNo = amisDocNo;
                updates.amisDepositDesc = amisDesc;
                updates.amisDepositAmount = isMainJob ? amisAmount : undefined;
                updates.ngayThuCuoc = amisDate;
            } else {
                updates.amisLcDocNo = amisDocNo;
                updates.amisLcDesc = amisDesc;
                updates.amisLcAmount = isMainJob ? amisAmount : undefined;
                updates.localChargeDate = amisDate;
                // Cập nhật Invoice gộp cho các job trong nhóm
                updates.localChargeInvoice = isMainJob ? formData.localChargeInvoice : job.localChargeInvoice;
            }
            if (index === 0) updates.additionalReceipts = additionalReceipts;
            onSave({ ...job, ...updates });
        });
        removedJobs.forEach(remJob => {
            const clearUpdates: any = isDeposit ? { amisDepositDocNo: '', amisDepositDesc: '', amisDepositAmount: 0 } : { amisLcDocNo: '', amisLcDesc: '', amisLcAmount: 0 };
            onSave({ ...remJob, ...clearUpdates });
        });
    } else if (mode === 'deposit_refund') {
        mergedList.forEach(j => onSave({ ...j, amisDepositRefundDocNo: amisDocNo, amisDepositRefundDesc: amisDesc, amisDepositRefundDate: amisDate, ngayThuHoan: amisDate }));
        removedJobs.forEach(remJob => onSave({ ...remJob, amisDepositRefundDocNo: '', amisDepositRefundDesc: '', amisDepositRefundDate: '', ngayThuHoan: '' }));
    } else if (mode === 'refund_overpayment') {
        const newRef = { id: Date.now().toString(), date: amisDate, docNo: amisDocNo, amount: amisAmount, desc: amisDesc };
        onSave({ ...formData, refunds: [...(formData.refunds || []), newRef] });
    }
    onClose();
  };

  const handleAddJob = () => {
      if (!allJobs) return;
      const found = allJobs.find(j => j.jobCode.trim().toLowerCase() === searchJobCode.trim().toLowerCase() && j.id !== formData.id);
      if (!found) return alert("Không tìm thấy Job Code này!");
      if (addedJobs.some(j => j.id === found.id)) return alert("Job này đã được thêm!");
      const newAddedJobs = [...addedJobs, found];
      setAddedJobs(newAddedJobs);
      setSearchJobCode('');
      
      if (mode === 'extension') {
          const newSet = new Set(selectedMergedExtIds);
          (found.extensions || []).forEach(e => { if (!e.amisDocNo) newSet.add(e.id); });
          setSelectedMergedExtIds(newSet);
          recalculateMerge(newExtension.invoice, newAddedJobs, newSet);
      } else if (mode === 'deposit_refund') {
          recalculateDepositRefundMerge(formData, newAddedJobs);
      } else { 
          recalculateMerge(formData.localChargeInvoice, newAddedJobs); 
      }
  };

  const handleRemoveAddedJob = (id: string) => {
      const jobToRemove = addedJobs.find(j => j.id === id);
      const newAddedJobs = addedJobs.filter(j => j.id !== id);
      setAddedJobs(newAddedJobs);
      
      if (mode === 'extension') {
          const newSet = new Set(selectedMergedExtIds);
          if (jobToRemove?.extensions) jobToRemove.extensions.forEach(e => newSet.delete(e.id));
          setSelectedMergedExtIds(newSet);
          recalculateMerge(newExtension.invoice, newAddedJobs, newSet);
      } else if (mode === 'deposit_refund') {
          recalculateDepositRefundMerge(formData, newAddedJobs);
      } else {
          recalculateMerge(formData.localChargeInvoice, newAddedJobs);
      }
  };

  const handleToggleMergedExtension = (extId: string, isChecked: boolean) => {
      const newSet = new Set(selectedMergedExtIds);
      if (isChecked) newSet.add(extId); else newSet.delete(extId);
      setSelectedMergedExtIds(newSet);
      recalculateMerge(newExtension.invoice, addedJobs, newSet);
  };

  if (!isOpen) return null;
  const isRedTheme = mode === 'deposit_refund' || mode === 'refund_overpayment';
  const getTitle = () => {
    switch (mode) {
        case 'local': return 'Thu Tiền Local Charge';
        case 'other': return 'Thu Tiền Khác';
        case 'deposit': return 'Thu Tiền Cược';
        case 'deposit_refund': return 'Chi Hoàn Cược';
        case 'extension': return 'Thu Tiền Gia Hạn';
        case 'refund_overpayment': return 'Chi Hoàn Tiền Thừa';
    }
  };

  return (
    createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl ${isRedTheme ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg shadow-sm border ${isRedTheme ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {mode === 'deposit_refund' ? <RotateCcw className="w-5 h-5" /> : mode === 'refund_overpayment' ? <HandCoins className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Job: <span className="font-bold text-blue-700">{job.jobCode}</span></p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {(mode === 'local' || mode === 'other' || mode === 'extension' || mode === 'deposit_refund') && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm mb-4">
                    <h3 className="text-xs font-bold text-blue-800 uppercase flex items-center mb-3"><Layers className="w-4 h-4 mr-2" /> Gộp Job (Thu cùng phiếu)</h3>
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                            <input type="text" value={searchJobCode} onChange={(e) => setSearchJobCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddJob())} placeholder="Nhập Job Code để gộp..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <button type="button" onClick={handleAddJob} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm">Thêm</button>
                    </div>
                    {[formData, ...addedJobs].length > 0 && (
                        <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-blue-100/50 font-bold text-blue-800"><tr><th className="px-3 py-2">Job Code</th><th className="px-3 py-2 text-right">Chi tiết</th><th className="px-3 py-2 w-8"></th></tr></thead>
                                <tbody className="divide-y divide-blue-50">
                                    {[formData, ...addedJobs].map(j => {
                                        const isMain = j.id === formData.id;
                                        return (
                                        <tr key={j.id} className={`group ${isMain ? 'bg-blue-50/40' : ''}`}>
                                            <td className="px-3 py-2 font-medium align-top pt-3">{j.jobCode} {isMain && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">CHÍNH</span>}</td>
                                            <td className="px-3 py-2">
                                                {mode === 'extension' ? (
                                                    <div className="space-y-1">
                                                        {(j.extensions || []).map(ext => {
                                                            const currentDoc = newExtension.amisDocNo;
                                                            const isPaidAlready = !!ext.amisDocNo && ext.amisDocNo !== currentDoc;
                                                            return (
                                                                <label key={ext.id} className={`flex items-center gap-2 p-1 rounded transition-colors ${isPaidAlready ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                                                                    <input type="checkbox" checked={selectedMergedExtIds.has(ext.id)} disabled={isPaidAlready} onChange={(e) => handleToggleMergedExtension(ext.id, e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                                                    <div className="flex-1 text-[11px] flex items-center justify-between">
                                                                        <div><span className="font-bold text-slate-700">HĐ: {ext.invoice || 'N/A'}</span> <span className="mx-1 text-slate-300">|</span> <span className="text-blue-600 font-medium">{new Intl.NumberFormat('en-US').format(ext.total)}</span></div>
                                                                        {isPaidAlready && <div className="flex items-center text-orange-600 font-bold text-[9px] uppercase ml-2 bg-orange-50 px-1 rounded border border-orange-100"><Lock className="w-2.5 h-2.5 mr-0.5" /> Đã thu ({ext.amisDocNo})</div>}
                                                                    </div>
                                                                </label>
                                                            )
                                                        })}
                                                    </div>
                                                ) : <div className="text-right pt-1 font-bold text-slate-700">{new Intl.NumberFormat('en-US').format(mode === 'deposit_refund' ? j.thuCuoc : j.localChargeTotal || 0)}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-center align-top pt-2">{!isMain && <button type="button" onClick={() => handleRemoveAddedJob(j.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {mode === 'other' && (
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${otherSubMode === 'deposit' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{otherSubMode === 'deposit' ? <Anchor className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}</div>
                        <div><Label>Phân loại thu khác</Label><p className="text-xs text-slate-500">{otherSubMode === 'deposit' ? 'Thu tiền cược vỏ (Deposit)' : 'Thu tiền hàng / phí dịch vụ'}</p></div>
                    </div>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        <button type="button" onClick={() => handleOtherSubModeChange('local')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${otherSubMode === 'local' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Doanh Thu</button>
                        <button type="button" onClick={() => handleOtherSubModeChange('deposit')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${otherSubMode === 'deposit' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Thu Cược</button>
                    </div>
                </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide"><User className="w-4 h-4 text-slate-500 mr-2" /> Thông tin nợ (Invoice)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <div className="relative group">
                            <Label>Mã Đối Tượng</Label>
                            <div className="flex gap-2">
                                <input type="text" value={custInputVal} onChange={(e) => handleCustomerChange(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập mã đối tượng..." autoComplete="off" />
                                {onAddCustomer && <button type="button" onClick={() => handleOpenQuickAdd('MAIN')} className="bg-blue-50 text-blue-600 px-3 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center"><Plus className="w-4 h-4" /></button>}
                            </div>
                            {showSuggestions && custInputVal && filteredCustomers.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mt-1 left-0 py-1">
                                    {filteredCustomers.map(c => (
                                        <li key={c.id} onMouseDown={() => handleSelectCustomer(c)} className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0"><div className="font-bold text-blue-700">{c.code}</div><div className="text-xs text-slate-500 truncate">{c.name}</div></li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div><Label>Tên Đối Tượng</Label><input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium" /></div>
                </div>
                {mode !== 'deposit' && mode !== 'deposit_refund' && mode !== 'refund_overpayment' && (
                    <div className="w-full">
                        <Label>{invoiceInputMode === 'bl' ? 'Số BL' : 'Số Hóa Đơn (Invoice)'}</Label>
                        <input type="text" required value={display.currentInvoice} onChange={(e) => handleInvoiceChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" placeholder={invoiceInputMode === 'bl' ? "Nhập số BL..." : "Nhập số hóa đơn..."} />
                    </div>
                )}
            </div>

            <div className={`bg-white rounded-xl border-2 shadow-sm relative overflow-hidden ${isRedTheme ? 'border-red-100' : 'border-blue-100'}`}>
                <div className={`px-5 py-3 border-b flex justify-between items-center ${isRedTheme ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}><h3 className={`text-sm font-bold flex items-center uppercase ${isRedTheme ? 'text-red-800' : 'text-blue-800'}`}><Receipt className="w-4 h-4 mr-2" /> Phiếu Thu/Chi (Gốc)</h3><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isRedTheme ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>MAIN</span></div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                        <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={handleMainDateChange} /></div>
                        <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDocNo: e.target.value})); else setAmisDocNo(e.target.value); }} className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 ${isRedTheme ? 'text-red-800 focus:ring-red-500' : 'text-blue-800 focus:ring-blue-500'}`} /></div>
                    </div>
                    <div><Label>Tổng tiền thu</Label><div className="relative"><input type="text" required value={currentMainAmount ? new Intl.NumberFormat('en-US').format(currentMainAmount) : ''} onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleAmountChange(val); }} className={`w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 text-right ${isRedTheme ? 'text-red-700 focus:ring-red-500' : 'text-blue-700 focus:ring-blue-500'}`} placeholder="0" /><span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span></div></div>
                    <div><Label>Diễn giải</Label><textarea value={mode === 'extension' ? newExtension.amisDesc : amisDesc} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value})); else setAmisDesc(e.target.value); }} rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
            </div>

            {mode !== 'deposit_refund' && mode !== 'refund_overpayment' && (
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-emerald-800 flex items-center uppercase"><History className="w-4 h-4 mr-2" /> Các lần thu thêm (Additional)</h3>{!isAddingReceipt && <button type="button" onClick={handleAddNewReceipt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold flex items-center shadow-sm"><Plus className="w-3 h-3 mr-1" /> Thêm phiếu</button>}</div>
                <div className="space-y-3">
                    {relevantAdditionalReceipts.map((rcpt, idx) => (
                        <div key={rcpt.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative"><div className="absolute top-3 right-3 flex items-center gap-2"><span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">Phiếu #{idx + 2}</span><button type="button" onClick={() => setAdditionalReceipts(prev => prev.filter(r => r.id !== rcpt.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div><div className="grid grid-cols-2 gap-4 mb-2"><div><span className="block text-[10px] text-slate-400 font-bold uppercase">Ngày CT</span><span className="text-sm font-medium text-slate-700">{formatDateVN(rcpt.date)}</span></div><div><span className="block text-[10px] text-slate-400 font-bold uppercase">Số CT</span><span className="text-sm font-bold text-slate-800">{rcpt.docNo}</span></div></div><div className="mb-2"><span className="block text-[10px] text-slate-400 font-bold uppercase">Số tiền</span><span className="text-lg font-bold text-emerald-600">{new Intl.NumberFormat('en-US').format(rcpt.amount)} VND</span></div><div><span className="block text-[10px] text-slate-400 font-bold uppercase">Diễn giải</span><p className="text-xs text-slate-600 truncate">{rcpt.desc}</p></div></div>
                    ))}
                    {relevantAdditionalReceipts.length === 0 && !isAddingReceipt && <div className="text-center py-4 text-slate-400 text-xs italic border-2 border-dashed border-emerald-100 rounded-xl">Chưa có phiếu thu thêm nào</div>}
                </div>
                {isAddingReceipt && (
                    <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 mt-4 animate-in zoom-in-95 shadow-lg"><div className="grid grid-cols-2 gap-3 mb-3"><div><Label>Ngày</Label><DateInput value={newReceipt.date || ''} onChange={(val) => setNewReceipt(prev => ({...prev, date: val}))} /></div><div><Label>Số chứng từ</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt(prev => ({...prev, docNo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div></div><div className="mb-3"><Label>Số tiền</Label><input type="text" value={newReceipt.amount ? new Intl.NumberFormat('en-US').format(newReceipt.amount) : ''} onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setNewReceipt(prev => ({...prev, amount: val})); }} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" /></div><div className="mb-3"><Label>Diễn giải</Label><input type="text" value={newReceipt.desc} onChange={e => setNewReceipt(prev => ({...prev, desc: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setIsAddingReceipt(false)} className="text-xs px-3 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold hover:bg-slate-200">Hủy</button><button type="button" onClick={handleSaveNewReceipt} className="text-xs px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-sm">Lưu phiếu</button></div></div>
                )}
                <div className="mt-4 pt-3 border-t border-emerald-200/60"><div className="flex justify-between items-center text-sm mb-1"><span className="text-emerald-900 font-medium">Tổng thực thu (Lần 1 + Thêm):</span><span className="text-emerald-700 font-bold">{new Intl.NumberFormat('en-US').format(totalCollected)} VND</span></div>{mode !== 'other' && (<div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Còn lại phải thu:</span><span className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>{new Intl.NumberFormat('en-US').format(remaining)} VND</span></div>)}</div>
            </div>
            )}

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
            <button onClick={handleSubmit} className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100 ${isRedTheme ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}><Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi</button>
        </div>
      </div>
      <CustomerModal isOpen={!!quickAddTarget} onClose={() => setQuickAddTarget(null)} onSave={handleSaveQuickCustomer} />
    </div>,
    document.body
    )
  );
};
