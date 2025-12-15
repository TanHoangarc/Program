
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle, Wallet, RotateCcw, Plus, Search, Trash2, ChevronDown, Anchor, History } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo } from '../utils';

export type ReceiveMode = 'local' | 'deposit' | 'deposit_refund' | 'extension' | 'other';

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
  isOpen, onClose, onSave, job, mode, customers, allJobs, targetExtensionId, usedDocNos = []
}) => {
  const [formData, setFormData] = useState<JobData>(job);
  const [otherSubMode, setOtherSubMode] = useState<'local' | 'deposit'>('local');

  // Fields for Main Receipt (Lần 1)
  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0); // This overrides the total if set

  // Fields for Extension Logic
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0],
    total: 0,
    amisDocNo: '',
    amisDesc: '',
    amisAmount: 0
  });
  
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);

  // --- MULTI-PAYMENT STATE ---
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

  // --- MERGE JOB STATE ---
  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobCode, setSearchJobCode] = useState('');

  // Helper to generate Description Logic for Merged Jobs
  const generateMergedDescription = (mainInvoice: string, extraJobs: JobData[], isExtension: boolean = false) => {
      const invoices: string[] = [];
      const missingJobCodes: string[] = [];

      if (mainInvoice && mainInvoice.trim()) {
          invoices.push(mainInvoice.trim());
      } else {
          missingJobCodes.push(formData.jobCode);
      }

      extraJobs.forEach(j => {
          let inv = isExtension 
            ? (j.extensions || []).map(e => e.invoice).filter(Boolean).join('+')
            : j.localChargeInvoice;
            
          if (inv && inv.trim()) {
              invoices.push(inv.trim());
          } else {
              missingJobCodes.push(j.jobCode);
          }
      });

      let desc = isExtension ? "Thu tiền của KH theo hoá đơn GH " : "Thu tiền của KH theo hoá đơn ";
      
      const invPart = invoices.join('+');
      desc += invPart;

      if (missingJobCodes.length > 0) {
          if (invPart.length > 0) desc += "+"; 
          desc += "XXX BL " + missingJobCodes.join('+');
      }

      desc += " (KIM)";
      return desc;
  };

  const recalculateMerge = (currentMainInvoice: string, extraJobs: JobData[]) => {
      const isExtension = mode === 'extension';
      const newDesc = generateMergedDescription(currentMainInvoice, extraJobs, isExtension);
      
      if (isExtension) {
          setNewExtension(prev => ({ ...prev, amisDesc: newDesc }));
      } else {
          setAmisDesc(newDesc);
      }
  };

  useEffect(() => {
      if (isOpen && mode === 'other') {
          setOtherSubMode('local');
      }
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen) {
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      
      if (mode === 'other') {
          if (!deepCopyJob.localChargeDate) deepCopyJob.localChargeDate = new Date().toISOString().split('T')[0];
      }

      setFormData(deepCopyJob);
      setAddedJobs([]); 
      setInternalTargetId(null);
      setAdditionalReceipts(deepCopyJob.additionalReceipts || []);

      let initialCustId = '';
      if (mode === 'local' || mode === 'other') initialCustId = deepCopyJob.customerId;
      else if (mode === 'deposit' || mode === 'deposit_refund') initialCustId = deepCopyJob.maKhCuocId;
      else if (mode === 'extension') {
          const exts = deepCopyJob.extensions || [];
          let target = null;
          
          if (targetExtensionId) {
              target = exts.find((e: any) => e.id === targetExtensionId);
          } else if (exts.length > 0) {
              target = exts[0];
          }
          
          initialCustId = target ? (target.customerId || deepCopyJob.customerId) : deepCopyJob.customerId;
      }

      const foundCust = customers.find(c => c.id === initialCustId);
      setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

      // AUTO INCREMENT DOC NO
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];

      if (mode === 'local') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          
          if (deepCopyJob.amisLcDesc) {
             setAmisDesc(deepCopyJob.amisLcDesc);
          } else {
             const inv = deepCopyJob.localChargeInvoice;
             const desc = generateMergedDescription(inv, []);
             setAmisDesc(desc);
          }
      } 
      else if (mode === 'other') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          const inv = deepCopyJob.localChargeInvoice || 'XXX';
          setAmisDesc(deepCopyJob.amisLcDesc || `Thu tiền của KH theo hoá đơn ${inv} (LH MB)`);
      }
      else if (mode === 'deposit') {
          setAmisDocNo(deepCopyJob.amisDepositDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisDepositAmount !== undefined ? deepCopyJob.amisDepositAmount : (deepCopyJob.thuCuoc || 0));
          setAmisDesc(deepCopyJob.amisDepositDesc || `Thu tiền của KH CƯỢC CONT BL ${deepCopyJob.jobCode}`);
      } 
      else if (mode === 'deposit_refund') {
          setAmisDocNo(deepCopyJob.amisDepositRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC')); 
          setAmisDesc(deepCopyJob.amisDepositRefundDesc || `Chi tiền cho KH HOÀN CƯỢC BL ${deepCopyJob.jobCode}`);
          setAmisAmount(deepCopyJob.thuCuoc || 0); 
      }
      else if (mode === 'extension') {
          const exts = deepCopyJob.extensions || [];
          let targetExt = null;

          if (targetExtensionId) {
              targetExt = exts.find((e: any) => e.id === targetExtensionId);
          } else if (exts.length > 0) {
              targetExt = exts[0];
          }

          if (targetExt) {
             setInternalTargetId(targetExt.id);
             
             const extInv = targetExt.invoice;
             const defaultDesc = extInv 
                ? `Thu tiền của KH theo hoá đơn GH ${extInv} (KIM)`
                : `Thu tiền của KH theo hoá đơn GH XXX BL ${deepCopyJob.jobCode} (KIM)`;

             setNewExtension({ 
                customerId: targetExt.customerId || deepCopyJob.customerId || '', 
                invoice: targetExt.invoice || '', 
                date: targetExt.invoiceDate || new Date().toISOString().split('T')[0],
                total: targetExt.total || 0,
                amisDocNo: targetExt.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
                amisDesc: targetExt.amisDesc || defaultDesc,
                amisAmount: targetExt.amisAmount !== undefined ? targetExt.amisAmount : (targetExt.total || 0)
             });
          } else {
             setInternalTargetId(null);
             setNewExtension({ 
               customerId: deepCopyJob.customerId || '', 
               invoice: '', 
               date: new Date().toISOString().split('T')[0],
               total: 0,
               amisDocNo: generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
               amisDesc: `Thu tiền của KH theo hoá đơn GH XXX BL ${deepCopyJob.jobCode} (KIM)`,
               amisAmount: 0
             });
          }
      }
    }
  }, [isOpen, job, mode, customers, targetExtensionId, allJobs, usedDocNos]);

  const handleOtherSubModeChange = (subMode: 'local' | 'deposit') => {
      setOtherSubMode(subMode);
      
      const invPlaceholder = formData.localChargeInvoice || 'XXX';
      
      if (subMode === 'deposit') {
          setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
      } else {
          setAmisDesc(`Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
      }
  };

  const getDisplayValues = () => {
      let tkNo = '1121';
      let tkCo = '';
      let currentDate = '';
      let currentTotalReceivable = 0; // The invoice amount
      let currentMainAmount = 0; // The amount paid in first receipt
      let currentCustomer = '';
      let currentInvoice = '';

      if (mode === 'local') {
          currentInvoice = formData.localChargeInvoice || '';
          tkCo = '13111';
          currentDate = formData.localChargeDate || '';
          currentTotalReceivable = formData.localChargeTotal || 0;
          currentMainAmount = amisAmount;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'other') {
          currentInvoice = formData.localChargeInvoice || '';
          tkCo = otherSubMode === 'deposit' ? '1388' : '13111';
          currentDate = formData.localChargeDate || '';
          currentTotalReceivable = formData.localChargeTotal || 0;
          currentMainAmount = amisAmount;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit') {
          tkCo = '1388';
          currentDate = formData.ngayThuCuoc || '';
          currentTotalReceivable = formData.thuCuoc || 0;
          currentMainAmount = amisAmount;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A'; 
      } else if (mode === 'deposit_refund') {
          tkNo = '1388'; 
          tkCo = '1121'; 
          currentDate = formData.ngayThuHoan || new Date().toISOString().split('T')[0];
          currentTotalReceivable = formData.thuCuoc || 0; 
          currentMainAmount = amisAmount;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A';
      } else if (mode === 'extension') {
          currentInvoice = newExtension.invoice;
          tkCo = '13111';
          currentDate = newExtension.date;
          currentTotalReceivable = newExtension.total;
          currentMainAmount = newExtension.amisAmount;
          currentCustomer = newExtension.customerId;
      }

      const customerName = customers.find(c => c.id === currentCustomer || c.code === currentCustomer)?.name || '';

      return { tkNo, tkCo, currentDate, currentTotalReceivable, currentMainAmount, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();

  // Filter additional receipts relevant to current context
  const relevantAdditionalReceipts = additionalReceipts.filter(r => {
      if (mode === 'extension') {
          return r.type === 'extension' && r.extensionId === internalTargetId;
      }
      if (mode === 'local') return r.type === 'local';
      if (mode === 'deposit') return r.type === 'deposit';
      if (mode === 'other') return r.type === otherSubMode;
      return false;
  });

  const totalPaidAdditional = relevantAdditionalReceipts.reduce((sum, r) => sum + r.amount, 0);
  const hasMainReceipt = mode === 'extension' ? !!newExtension.amisDocNo : (mode === 'deposit' ? !!amisDocNo : (mode === 'local' ? !!amisDocNo : !!amisDocNo));
  const totalCollected = (hasMainReceipt ? display.currentMainAmount : 0) + totalPaidAdditional;
  const remaining = display.currentTotalReceivable - totalCollected;

  const handleAmountChange = (val: number) => {
      if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisAmount: val }));
      else setAmisAmount(val);
  };

  const handleDateChange = (val: string) => {
      if (mode === 'local' || mode === 'other') setFormData(prev => ({ ...prev, localChargeDate: val }));
      else if (mode === 'deposit') setFormData(prev => ({ ...prev, ngayThuCuoc: val }));
      else if (mode === 'deposit_refund') setFormData(prev => ({ ...prev, ngayThuHoan: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, date: val }));
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
      if (mode === 'local' || mode === 'other') {
          setFormData(prev => ({ ...prev, customerId: val }));
      }
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(prev => ({ ...prev, maKhCuocId: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, customerId: val }));
  };

  const handleInvoiceChange = (val: string) => {
      const invPlaceholder = val || 'XXX';
      
      if (mode === 'local') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          recalculateMerge(val, addedJobs);
      }
      else if (mode === 'other') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          
          if (otherSubMode === 'deposit') {
              setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
          } else {
              setAmisDesc(`Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
          }
      }
      else if (mode === 'extension') {
          setNewExtension(prev => ({ 
              ...prev, 
              invoice: val
          }));
          recalculateMerge(val, addedJobs);
      }
  };

  // --- MULTI-RECEIPT HANDLERS ---
  const handleAddNewReceipt = () => {
      setIsAddingReceipt(true);
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      
      // Calculate next Doc No, ensuring uniqueness from Main Doc No and other additionals
      const currentMainDoc = mode === 'extension' ? newExtension.amisDocNo : amisDocNo;
      
      // Ensure we treat all currently visible Doc Nos as "taken"
      const existingInSession = [currentMainDoc, ...additionalReceipts.map(r => r.docNo)].filter(Boolean);
      
      // Pass combined taken list to generator
      const nextDoc = generateNextDocNo(jobsForCalc, 'NTTK', 5, [...extra, ...existingInSession]);
      
      setNewReceipt({
          amount: Math.max(0, remaining),
          date: new Date().toISOString().split('T')[0],
          docNo: nextDoc,
          desc: mode === 'extension' ? newExtension.amisDesc : amisDesc 
      });
  };

  const handleSaveNewReceipt = () => {
      if (!newReceipt.amount || !newReceipt.docNo) return;
      
      const receipt: AdditionalReceipt = {
          id: `rcpt-${Date.now()}`,
          type: mode === 'other' ? otherSubMode : (mode === 'deposit' ? 'deposit' : (mode === 'extension' ? 'extension' : 'local')),
          date: newReceipt.date || '',
          docNo: newReceipt.docNo || '',
          desc: newReceipt.desc || '',
          amount: newReceipt.amount || 0,
          extensionId: mode === 'extension' ? internalTargetId || undefined : undefined
      };

      setAdditionalReceipts(prev => [...prev, receipt]);
      setIsAddingReceipt(false);
  };

  const handleDeleteReceipt = (id: string) => {
      setAdditionalReceipts(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalReceipts = additionalReceipts;

    if (mode === 'extension') {
      let updatedExtensions;
      if (internalTargetId) {
          updatedExtensions = (formData.extensions || []).map(ext => {
              if (ext.id === internalTargetId) {
                  return {
                      ...ext,
                      customerId: newExtension.customerId,
                      invoice: newExtension.invoice,
                      invoiceDate: newExtension.date,
                      total: newExtension.total, 
                      amisDocNo: newExtension.amisDocNo,
                      amisDesc: newExtension.amisDesc,
                      amisAmount: newExtension.amisAmount 
                  };
              }
              return ext;
          });
      } else {
          updatedExtensions = [
            ...(formData.extensions || []),
            {
              id: Date.now().toString(),
              customerId: newExtension.customerId,
              invoice: newExtension.invoice,
              invoiceDate: newExtension.date,
              net: 0, 
              vat: 0,
              total: newExtension.total,
              amisDocNo: newExtension.amisDocNo,
              amisDesc: newExtension.amisDesc,
              amisAmount: newExtension.amisAmount
            }
          ];
      }
      onSave({ 
          ...formData, 
          extensions: updatedExtensions,
          additionalReceipts: finalReceipts 
        });

      if (addedJobs.length > 0) {
          addedJobs.forEach(addedJob => {
              const updatedAddedJobExtensions = (addedJob.extensions || []).map(ext => ({
                  ...ext,
                  amisDocNo: newExtension.amisDocNo,
                  amisDesc: newExtension.amisDesc,
              }));
              onSave({ ...addedJob, extensions: updatedAddedJobExtensions });
          });
      }

    } 
    else if (mode === 'local' || mode === 'other') {
        onSave({ 
            ...formData, 
            amisLcDocNo: amisDocNo, 
            amisLcDesc: amisDesc,
            amisLcAmount: amisAmount,
            additionalReceipts: finalReceipts
        });

        if (addedJobs.length > 0) {
            addedJobs.forEach(addedJob => {
                onSave({
                    ...addedJob,
                    amisLcDocNo: amisDocNo,
                    amisLcDesc: amisDesc
                });
            });
        }
    }
    else if (mode === 'deposit') {
        onSave({ 
            ...formData, 
            amisDepositDocNo: amisDocNo, 
            amisDepositDesc: amisDesc,
            amisDepositAmount: amisAmount,
            additionalReceipts: finalReceipts
        });
    }
    else if (mode === 'deposit_refund') {
        onSave({ 
            ...formData, 
            amisDepositRefundDocNo: amisDocNo, 
            amisDepositRefundDesc: amisDesc,
            amisDepositRefundDate: formData.ngayThuHoan
        });
    }
    
    onClose();
  };

  // ... (Keep render logic same as before) ...
  const filteredCustomers = customers.filter(c => 
      c.code.toLowerCase().includes(custInputVal.toLowerCase()) || 
      c.name.toLowerCase().includes(custInputVal.toLowerCase())
  );

  const handleAddJob = () => {
      if (!allJobs) return;
      const found = allJobs.find(j => j.jobCode === searchJobCode && j.id !== formData.id);
      
      if (!found) {
          alert("Không tìm thấy Job Code này hoặc Job đang là Job chính!");
          return;
      }
      if (addedJobs.some(j => j.id === found.id)) {
          alert("Job này đã được thêm vào danh sách!");
          return;
      }

      const newAddedJobs = [...addedJobs, found];
      setAddedJobs(newAddedJobs);
      setSearchJobCode('');

      if (mode === 'extension') {
          const extTotal = (found.extensions || []).reduce((sum, e) => sum + e.total, 0);
          const currentAmt = newExtension.total || 0;
          setNewExtension(prev => ({ ...prev, total: currentAmt + extTotal, amisAmount: (prev.amisAmount || 0) + extTotal }));
          recalculateMerge(newExtension.invoice, newAddedJobs);
      } else {
          const currentAmt = formData.localChargeTotal || 0;
          const addedAmt = found.localChargeTotal || 0; 
          setFormData(prev => ({ ...prev, localChargeTotal: currentAmt + addedAmt }));
          setAmisAmount(prev => prev + addedAmt);
          recalculateMerge(formData.localChargeInvoice, newAddedJobs);
      }
  };

  const handleRemoveAddedJob = (id: string) => {
      const jobToRemove = addedJobs.find(j => j.id === id);
      const newAddedJobs = addedJobs.filter(j => j.id !== id);
      setAddedJobs(newAddedJobs);

      if (mode === 'extension') {
          recalculateMerge(newExtension.invoice, newAddedJobs);
          if (jobToRemove) {
              const extTotal = (jobToRemove.extensions || []).reduce((sum, e) => sum + e.total, 0);
              setNewExtension(prev => ({ ...prev, total: Math.max(0, (prev.total || 0) - extTotal), amisAmount: Math.max(0, (prev.amisAmount || 0) - extTotal) }));
          }
      } else {
          recalculateMerge(formData.localChargeInvoice, newAddedJobs);
          if (jobToRemove) {
              const currentAmt = formData.localChargeTotal || 0;
              setFormData(prev => ({ ...prev, localChargeTotal: Math.max(0, currentAmt - (jobToRemove.localChargeTotal || 0)) }));
              setAmisAmount(prev => Math.max(0, prev - (jobToRemove.localChargeTotal || 0)));
          }
      }
  };

  const handleSelectExtensionToPay = (extId: string) => {
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      
      if (!extId) {
          setInternalTargetId(null);
          setNewExtension({
              customerId: formData.customerId,
              invoice: '',
              date: new Date().toISOString().split('T')[0],
              total: 0,
              amisDocNo: generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
              amisDesc: `Thu tiền của KH theo hoá đơn GH XXX BL ${formData.jobCode} (KIM)`,
              amisAmount: 0
          });
          const mainCust = customers.find(c => c.id === formData.customerId);
          setCustInputVal(mainCust ? mainCust.code : '');
          return;
      }

      const target = formData.extensions?.find(e => e.id === extId);
      if (target) {
          setInternalTargetId(target.id);
          const inv = target.invoice;
          const desc = target.amisDesc || (inv
            ? `Thu tiền của KH theo hoá đơn GH ${inv} (KIM)`
            : `Thu tiền của KH theo hoá đơn GH XXX BL ${formData.jobCode} (KIM)`);

          setNewExtension({
              customerId: target.customerId || formData.customerId,
              invoice: target.invoice,
              date: target.invoiceDate || new Date().toISOString().split('T')[0],
              total: target.total,
              amisDocNo: target.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
              amisDesc: desc,
              amisAmount: target.amisAmount !== undefined ? target.amisAmount : target.total
          });
          
          const extCustId = target.customerId || formData.customerId;
          const extCust = customers.find(c => c.id === extCustId);
          setCustInputVal(extCust ? extCust.code : '');
      }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (mode) {
        case 'local': return 'Phiếu Thu Tiền (Local Charge)';
        case 'other': return 'Phiếu Thu Tiền (Thu Khác)';
        case 'deposit': return 'Phiếu Thu Tiền (Cược)';
        case 'deposit_refund': return 'Phiếu Chi Tiền (Hoàn Cược)';
        case 'extension': return 'Phiếu Thu Tiền (Gia Hạn)';
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl ${mode === 'deposit_refund' ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg shadow-sm border ${mode === 'deposit_refund' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {mode === 'deposit_refund' ? <RotateCcw className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Job: <span className="font-bold text-blue-700">{job.jobCode}</span></p>
            </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
            <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* THU KHÁC TYPE SWITCHER */}
            {mode === 'other' && (
                <div className="flex space-x-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="otherSubMode" 
                            value="local" 
                            checked={otherSubMode === 'local'} 
                            onChange={() => handleOtherSubModeChange('local')}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700 flex items-center">
                            <FileText className="w-4 h-4 mr-1 text-blue-500" /> Thu Local Charge
                        </span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="radio" 
                            name="otherSubMode" 
                            value="deposit" 
                            checked={otherSubMode === 'deposit'} 
                            onChange={() => handleOtherSubModeChange('deposit')}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700 flex items-center">
                            <Anchor className="w-4 h-4 mr-1 text-purple-500" /> Thu Deposit (Cược)
                        </span>
                    </label>
                </div>
            )}

            {/* EXTENSION SELECTOR */}
            {mode === 'extension' && (formData.extensions?.length || 0) > 0 && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm mb-4">
                    <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold text-sm">
                        <ChevronDown className="w-4 h-4" />
                        Chọn dòng gia hạn để thu tiền
                    </div>
                    <select
                        className="w-full p-2.5 bg-white border border-orange-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none text-slate-700"
                        value={internalTargetId || ''}
                        onChange={(e) => handleSelectExtensionToPay(e.target.value)}
                    >
                        <option value="">+ Tạo mới dòng gia hạn</option>
                        {formData.extensions?.map(ext => (
                            <option key={ext.id} value={ext.id}>
                                [HĐ: {ext.invoice || 'N/A'}] - {new Intl.NumberFormat('en-US').format(ext.total)} VND
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* MAIN PAYMENT INFO */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
                <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">Lần 1 (Chính)</div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <Calendar className={`w-4 h-4 mr-2 ${mode === 'deposit_refund' ? 'text-red-600' : 'text-blue-600'}`} />
                    Thông tin chứng từ
                </h3>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <Label>Ngày Chứng Từ</Label>
                        <DateInput 
                            value={display.currentDate} 
                            onChange={handleDateChange}
                        />
                    </div>
                    <div>
                        <Label>Số Chứng Từ (AMIS)</Label>
                        <input 
                            type="text" 
                            value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo}
                            onChange={(e) => {
                                if(mode === 'extension') setNewExtension(prev => ({...prev, amisDocNo: e.target.value}));
                                else setAmisDocNo(e.target.value);
                            }}
                            className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 ${mode === 'deposit_refund' ? 'text-red-800 focus:ring-red-500' : 'text-blue-800 focus:ring-blue-500'}`}
                        />
                    </div>
                </div>

                {mode !== 'deposit' && mode !== 'deposit_refund' && (
                     <div className="mt-4">
                        <Label>
                            {mode === 'other' && otherSubMode === 'deposit' ? 'Số BL' : 'Số Hóa Đơn (Invoice)'}
                        </Label>
                        <input 
                            type="text" 
                            required
                            value={display.currentInvoice} 
                            onChange={(e) => handleInvoiceChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
                            placeholder={mode === 'other' && otherSubMode === 'deposit' ? "Nhập số BL..." : "Nhập số hóa đơn..."}
                        />
                    </div>
                )}
            </div>

            {/* --- ADD JOBS SECTION (LOCAL & EXTENSION) --- */}
            {(mode === 'local' || mode === 'extension') && (
                <div className={`p-5 rounded-xl border shadow-sm ${mode === 'local' ? 'bg-orange-50 border-orange-200' : 'bg-orange-50 border-orange-200'}`}>
                    <h3 className={`text-sm font-bold mb-3 flex items-center ${mode === 'local' ? 'text-orange-800' : 'text-orange-800'}`}>
                        <Plus className="w-4 h-4 mr-2" /> Gộp Job (Thu nhiều lô)
                    </h3>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            value={searchJobCode}
                            onChange={(e) => setSearchJobCode(e.target.value)}
                            className={`flex-1 px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${mode === 'local' ? 'border-orange-300 focus:ring-orange-500' : 'border-orange-300 focus:ring-orange-500'}`}
                            placeholder="Nhập Job Code để thêm..."
                        />
                        <button 
                            type="button" 
                            onClick={handleAddJob}
                            className={`text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center ${mode === 'local' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                        >
                            <Search className="w-4 h-4 mr-1" /> Thêm
                        </button>
                    </div>
                    {addedJobs.length > 0 && (
                        <div className="space-y-2">
                            {addedJobs.map((j) => (
                                <div key={j.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-orange-100 text-sm">
                                    <div><span className="font-bold text-slate-700">{j.jobCode}</span></div>
                                    <button type="button" onClick={() => handleRemoveAddedJob(j.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <User className="w-4 h-4 text-green-600 mr-2" />
                    Đối tượng & Số tiền
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <div className="relative group">
                            <Label>Mã Đối Tượng</Label>
                            <input
                                type="text"
                                value={custInputVal}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Nhập mã đối tượng..."
                                autoComplete="off"
                            />
                            {showSuggestions && custInputVal && filteredCustomers.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mt-1 left-0 py-1">
                                    {filteredCustomers.map(c => (
                                        <li key={c.id} onMouseDown={() => handleSelectCustomer(c)} className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0">
                                            <div className="font-bold text-blue-700">{c.code}</div>
                                            <div className="text-xs text-slate-500 truncate">{c.name}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <Label>Tên Đối Tượng</Label>
                            <input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-600 font-medium" />
                        </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>Tổng Phải Thu (Invoice)</Label>
                        <div className="p-3 bg-slate-100 rounded-xl text-lg font-bold text-slate-600 text-right border border-slate-200">
                            {new Intl.NumberFormat('en-US').format(display.currentTotalReceivable)}
                        </div>
                    </div>
                    <div>
                        <Label>Thực thu (Lần 1)</Label>
                        <div className="relative">
                            <input 
                                type="text" 
                                required
                                value={display.currentMainAmount ? new Intl.NumberFormat('en-US').format(display.currentMainAmount) : ''} 
                                onChange={(e) => {
                                    const val = Number(e.target.value.replace(/,/g, ''));
                                    if (!isNaN(val)) handleAmountChange(val);
                                }}
                                className={`w-full pl-4 pr-14 py-3 bg-white border border-slate-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 text-right ${mode === 'deposit_refund' ? 'text-red-700 focus:ring-red-500' : 'text-blue-700 focus:ring-blue-500'}`}
                                placeholder="0"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                    <CreditCard className="w-4 h-4 text-purple-600 mr-2" />
                    Hạch toán & Diễn giải
                </h3>
                
                <div className="grid grid-cols-2 gap-5 mb-4">
                    <div>
                        <Label>TK Nợ</Label>
                        <input type="text" value={display.tkNo} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-slate-700" />
                    </div>
                    <div>
                        <Label>TK Có</Label>
                        <input type="text" value={display.tkCo} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-blue-700" />
                    </div>
                </div>

                <div>
                    <Label>Diễn giải lý do thu</Label>
                    <textarea 
                        value={mode === 'extension' ? newExtension.amisDesc : amisDesc}
                        onChange={(e) => {
                            if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value}));
                            else setAmisDesc(e.target.value);
                        }}
                        rows={2}
                        className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 ${mode === 'deposit_refund' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                    />
                </div>
            </div>

            {/* --- ADDITIONAL RECEIPTS SECTION --- */}
            {mode !== 'deposit_refund' && (
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-emerald-800 flex items-center">
                        <History className="w-4 h-4 mr-2" /> Các lần thu thêm (Partial Payment)
                    </h3>
                    {!isAddingReceipt && (
                        <button type="button" onClick={handleAddNewReceipt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold flex items-center">
                            <Plus className="w-3 h-3 mr-1" /> Thêm lần thu
                        </button>
                    )}
                </div>

                {relevantAdditionalReceipts.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {relevantAdditionalReceipts.map((rcpt, idx) => (
                            <div key={rcpt.id} className="bg-white p-3 rounded-lg border border-emerald-100 flex justify-between items-center text-sm shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-700">{rcpt.docNo} - <span className="text-emerald-600">{new Intl.NumberFormat('en-US').format(rcpt.amount)} VND</span></div>
                                    <div className="text-xs text-slate-500">{formatDateVN(rcpt.date)} - {rcpt.desc}</div>
                                </div>
                                <button type="button" onClick={() => handleDeleteReceipt(rcpt.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Receipt Form */}
                {isAddingReceipt && (
                    <div className="bg-white p-4 rounded-lg border-2 border-emerald-200 animate-in zoom-in-95">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div><Label>Ngày</Label><DateInput value={newReceipt.date || ''} onChange={(val) => setNewReceipt(prev => ({...prev, date: val}))} /></div>
                            <div><Label>Số chứng từ</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt(prev => ({...prev, docNo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" /></div>
                        </div>
                        <div className="mb-3"><Label>Số tiền</Label>
                            <input 
                                type="text" 
                                value={newReceipt.amount ? new Intl.NumberFormat('en-US').format(newReceipt.amount) : ''} 
                                onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setNewReceipt(prev => ({...prev, amount: val})); }} 
                                className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-right" 
                            />
                        </div>
                        <div className="mb-3"><Label>Diễn giải</Label><input type="text" value={newReceipt.desc} onChange={e => setNewReceipt(prev => ({...prev, desc: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsAddingReceipt(false)} className="text-xs px-3 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold">Hủy</button>
                            <button type="button" onClick={handleSaveNewReceipt} className="text-xs px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold">Lưu dòng</button>
                        </div>
                    </div>
                )}

                {/* Summary */}
                <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-emerald-200 mt-2">
                    <span className="text-emerald-800">Tổng đã thu (Lần 1 + Thêm):</span>
                    <span className={remaining === 0 ? "text-green-600" : "text-slate-600"}>{new Intl.NumberFormat('en-US').format(totalCollected)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-1">
                    <span className="text-emerald-800">Còn lại:</span>
                    <span className="text-red-600">{new Intl.NumberFormat('en-US').format(remaining)}</span>
                </div>
            </div>
            )}

            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
            Hủy bỏ
            </button>
            <button 
                onClick={handleSubmit} 
                className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100 ${mode === 'deposit_refund' ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}
            >
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
