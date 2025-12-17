
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, User, RotateCcw, Plus, Trash2, ChevronDown, History, Receipt, Link, Layers, List, ToggleLeft, ToggleRight } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo } from '../utils';

export type ReceiveMode = 'local' | 'deposit' | 'deposit_refund' | 'extension' | 'other';

export interface QuickReceiveModalProps {
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
  
  // New state for Invoice/BL toggle
  const [invoiceInputMode, setInvoiceInputMode] = useState<'invoice' | 'bl'>('invoice');

  // UI State: Tab selection
  const [activeTab, setActiveTab] = useState<'merge' | 'installments'>('merge');

  // Fields for Main Receipt (Lần 1 / Tổng thu)
  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0); // This overrides the total if set
  const [amisDate, setAmisDate] = useState(''); // Separate date for Main Receipt

  // Fields for Extension Logic
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0], // Invoice Date
    total: 0,
    amisDocNo: '',
    amisDesc: '',
    amisAmount: 0,
    amisDate: '' // Receipt Date
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

  // ----------------------------------------------------------------------
  // EFFECTS
  // ----------------------------------------------------------------------

  // 1. Initialize Mode & Data
  useEffect(() => {
    if (isOpen) {
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      
      if (mode === 'other') {
          if (!deepCopyJob.localChargeDate) deepCopyJob.localChargeDate = new Date().toISOString().split('T')[0];
          const desc = deepCopyJob.amisLcDesc || '';
          if (desc.includes('CƯỢC')) {
              setOtherSubMode('deposit');
          } else {
              setOtherSubMode('local');
          }
          setInvoiceInputMode('invoice');
      }

      setFormData(deepCopyJob);
      
      // --- DETECT MERGED JOBS ---
      let foundMergedJobs: JobData[] = [];
      if (allJobs && allJobs.length > 0) {
          // 1. Check Local/Other Merge
          if (mode === 'local' || mode === 'other') {
              const currentDoc = deepCopyJob.amisLcDocNo;
              if (currentDoc) {
                  // Find other jobs with SAME DocNo but DIFFERENT ID
                  foundMergedJobs = allJobs.filter(j => j.id !== deepCopyJob.id && j.amisLcDocNo === currentDoc);
              }
          }
          // 2. Check Extension Merge
          else if (mode === 'extension') {
              // If editing a specific extension or generally
              const exts = deepCopyJob.extensions || [];
              let targetDoc = '';
              if (targetExtensionId) {
                  const t = exts.find((e: any) => e.id === targetExtensionId);
                  if (t) targetDoc = t.amisDocNo;
              } else if (exts.length > 0) {
                  // Try to find any docno if not specified
                  targetDoc = exts[0].amisDocNo;
              }

              if (targetDoc) {
                  foundMergedJobs = allJobs.filter(j => 
                      j.id !== deepCopyJob.id && 
                      (j.extensions || []).some(e => e.amisDocNo === targetDoc)
                  );
              }
          }
      }
      setAddedJobs(foundMergedJobs);

      setInternalTargetId(null);
      setAdditionalReceipts(deepCopyJob.additionalReceipts || []);

      // Reset Tab to Merge by default unless there are existing additional receipts
      if ((deepCopyJob.additionalReceipts || []).length > 0) {
          setActiveTab('installments');
      } else {
          setActiveTab('merge');
      }

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

      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];

      if (mode === 'local') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          
          if (deepCopyJob.amisLcDesc) {
             setAmisDesc(deepCopyJob.amisLcDesc);
          } else {
             const inv = deepCopyJob.localChargeInvoice;
             const desc = `Thu tiền của KH theo hoá đơn ${inv || 'XXX'} (KIM)`;
             setAmisDesc(desc);
          }
      } 
      else if (mode === 'other') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          const inv = deepCopyJob.localChargeInvoice || 'XXX';
          if (deepCopyJob.amisLcDesc) {
              setAmisDesc(deepCopyJob.amisLcDesc);
          } else {
              setAmisDesc(`Thu tiền của KH theo hoá đơn ${inv} (LH MB)`);
          }
      }
      else if (mode === 'deposit') {
          setAmisDocNo(deepCopyJob.amisDepositDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisDepositAmount !== undefined ? deepCopyJob.amisDepositAmount : (deepCopyJob.thuCuoc || 0));
          setAmisDate(deepCopyJob.ngayThuCuoc || new Date().toISOString().split('T')[0]);
          setAmisDesc(deepCopyJob.amisDepositDesc || `Thu tiền của KH CƯỢC CONT BL ${deepCopyJob.jobCode}`);
      } 
      else if (mode === 'deposit_refund') {
          setAmisDocNo(deepCopyJob.amisDepositRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC')); 
          setAmisDate(deepCopyJob.ngayThuHoan || new Date().toISOString().split('T')[0]);
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
                amisAmount: targetExt.amisAmount !== undefined ? targetExt.amisAmount : (targetExt.total || 0),
                amisDate: targetExt.invoiceDate || new Date().toISOString().split('T')[0]
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
               amisAmount: 0,
               amisDate: new Date().toISOString().split('T')[0]
             });
          }
      }
    }
  }, [isOpen, job, mode, customers, targetExtensionId, allJobs, usedDocNos]);

  // 2. Auto-sum logic for MERGE MODE
  useEffect(() => {
      if (activeTab === 'merge' && isOpen) {
          const mainTotal = mode === 'extension' ? (newExtension.total || 0) : (formData.localChargeTotal || 0);
          
          const addedTotal = addedJobs.reduce((sum, j) => {
              if (mode === 'extension') {
                  // For extension mode, sum all extension totals of added jobs
                  return sum + (j.extensions || []).reduce((s, e) => s + e.total, 0);
              }
              // For local/other, sum localChargeTotal
              return sum + (j.localChargeTotal || 0);
          }, 0);
          
          const finalTotal = mainTotal + addedTotal;
          
          if (mode === 'extension') {
              setNewExtension(prev => ({...prev, amisAmount: finalTotal}));
          } else {
              setAmisAmount(finalTotal);
          }
      }
  }, [addedJobs, activeTab, mode, formData.localChargeTotal, newExtension.total, isOpen]);

  // 3. Description Logic Helper
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
      if (activeTab !== 'merge') return; 

      const isExtension = mode === 'extension';
      const newDesc = generateMergedDescription(currentMainInvoice, extraJobs, isExtension);
      
      if (isExtension) {
          setNewExtension(prev => ({ ...prev, amisDesc: newDesc }));
      } else {
          setAmisDesc(newDesc);
      }
  };

  // 4. Tab Switch Effect for Descriptions
  useEffect(() => {
      if (!isOpen) return;

      const currentDesc = mode === 'extension' ? newExtension.amisDesc : amisDesc;
      
      if (activeTab === 'installments') {
          // Append "LẦN 1" if needed
          if (currentDesc && !currentDesc.toUpperCase().includes('LẦN')) {
              const newDesc = `${currentDesc} (LẦN 1)`;
              if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisDesc: newDesc }));
              else setAmisDesc(newDesc);
          }
      } else if (activeTab === 'merge') {
          // Recalculate merge description (clears LẦN X)
          if (mode === 'extension') {
              recalculateMerge(newExtension.invoice, addedJobs);
          } else {
              recalculateMerge(formData.localChargeInvoice, addedJobs);
          }
      }
  }, [activeTab, isOpen]);

  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------

  const getDisplayValues = () => {
      let currentTotalReceivable = 0; 
      let currentCustomer = '';
      let currentInvoice = '';

      if (mode === 'local') {
          currentInvoice = formData.localChargeInvoice || '';
          currentTotalReceivable = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'other') {
          currentInvoice = formData.localChargeInvoice || '';
          currentTotalReceivable = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit') {
          currentTotalReceivable = formData.thuCuoc || 0;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A'; 
      } else if (mode === 'deposit_refund') {
          currentTotalReceivable = formData.thuCuoc || 0; 
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A';
      } else if (mode === 'extension') {
          currentInvoice = newExtension.invoice;
          currentTotalReceivable = newExtension.total;
          currentCustomer = newExtension.customerId;
      }

      const customerName = customers.find(c => c.id === currentCustomer || c.code === currentCustomer)?.name || '';

      return { currentTotalReceivable, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();

  // Additional Receipts Filter
  const relevantAdditionalReceipts = additionalReceipts.filter(r => {
      if (mode === 'extension') {
          return r.type === 'extension' && r.extensionId === internalTargetId;
      }
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
      if (mode === 'local' || mode === 'other') {
          setFormData(prev => ({ ...prev, customerId: val }));
      }
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(prev => ({ ...prev, maKhCuocId: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, customerId: val }));
  };

  const updateOtherDescription = (val: string, inputMode: 'invoice' | 'bl') => {
      const invPlaceholder = val || 'XXX';
      if (otherSubMode === 'deposit') {
          setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
      } else {
          if (inputMode === 'bl') {
              setAmisDesc(`Thu tiền của KH theo hoá đơn XXX BL ${invPlaceholder} (LH MB)`);
          } else {
              setAmisDesc(`Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
          }
      }
  };

  const toggleInvoiceMode = () => {
      const newMode = invoiceInputMode === 'invoice' ? 'bl' : 'invoice';
      setInvoiceInputMode(newMode);
      updateOtherDescription(formData.localChargeInvoice || '', newMode);
  };

  const handleInvoiceChange = (val: string) => {
      if (mode === 'local') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          recalculateMerge(val, addedJobs);
      }
      else if (mode === 'other') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          updateOtherDescription(val, invoiceInputMode);
      }
      else if (mode === 'extension') {
          setNewExtension(prev => ({ ...prev, invoice: val }));
          recalculateMerge(val, addedJobs);
      }
  };

  const filteredCustomers = useMemo(() => {
    if (!custInputVal) return customers;
    const lower = custInputVal.toLowerCase();
    return customers.filter(c => 
      (c.code || '').toLowerCase().includes(lower) || 
      (c.name || '').toLowerCase().includes(lower)
    );
  }, [customers, custInputVal]);

  const handleAddJob = () => {
      if (!allJobs) return;
      const found = allJobs.find(j => j.jobCode === searchJobCode && j.id !== formData.id);
      if (!found) { alert("Không tìm thấy Job Code!"); return; }
      if (found.customerId !== formData.customerId) { alert("Chỉ được gộp các Job của cùng một khách hàng!"); return; }
      if (addedJobs.some(j => j.id === found.id)) { alert("Job này đã được thêm!"); return; }

      const newAddedJobs = [...addedJobs, found];
      setAddedJobs(newAddedJobs);
      setSearchJobCode('');

      if (mode === 'extension') recalculateMerge(newExtension.invoice, newAddedJobs);
      else recalculateMerge(formData.localChargeInvoice, newAddedJobs);
  };

  const handleRemoveAddedJob = (id: string) => {
      const newAddedJobs = addedJobs.filter(j => j.id !== id);
      setAddedJobs(newAddedJobs);
      if (mode === 'extension') recalculateMerge(newExtension.invoice, newAddedJobs);
      else recalculateMerge(formData.localChargeInvoice, newAddedJobs);
  };

  // --- INSTALLMENT / ADD RECEIPT HANDLERS ---
  const handleAddNewReceipt = () => {
      setIsAddingReceipt(true);
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      
      const currentMainDoc = mode === 'extension' ? newExtension.amisDocNo : amisDocNo;
      const existingInSession = [currentMainDoc, ...additionalReceipts.map(r => r.docNo)].filter(Boolean);
      
      const nextDoc = generateNextDocNo(jobsForCalc, 'NTTK', 5, [...extra, ...existingInSession]);
      
      const mainDesc = mode === 'extension' ? newExtension.amisDesc : amisDesc;
      let nextDesc = mainDesc;
      
      const nextCount = relevantAdditionalReceipts.length + 2; 
      if (mainDesc.includes('LẦN 1')) {
          nextDesc = mainDesc.replace('LẦN 1', `LẦN ${nextCount}`);
      } else {
          nextDesc = `${mainDesc} (LẦN ${nextCount})`;
      }

      setNewReceipt({
          amount: Math.max(0, remaining),
          date: new Date().toISOString().split('T')[0],
          docNo: nextDoc,
          desc: nextDesc 
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

  // --- SUBMIT ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
              net: 0, vat: 0,
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
          additionalReceipts: additionalReceipts 
        });

      // Update merged jobs as well
      if (addedJobs.length > 0) {
          addedJobs.forEach(addedJob => {
              const updatedAddedJobExtensions = (addedJob.extensions || []).map(ext => ({
                  ...ext,
                  amisDocNo: newExtension.amisDocNo,
                  amisDesc: newExtension.amisDesc,
                  amisAmount: 0 // Set amount to 0 for merged jobs as main job holds total
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
            localChargeDate: amisDate,
            additionalReceipts: additionalReceipts
        });

        if (addedJobs.length > 0) {
            addedJobs.forEach(addedJob => {
                onSave({
                    ...addedJob,
                    amisLcDocNo: amisDocNo,
                    amisLcDesc: amisDesc,
                    amisLcAmount: 0 
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
            ngayThuCuoc: amisDate,
            additionalReceipts: additionalReceipts
        });
    }
    else if (mode === 'deposit_refund') {
        onSave({ 
            ...formData, 
            amisDepositRefundDocNo: amisDocNo, 
            amisDepositRefundDesc: amisDesc,
            amisDepositRefundDate: amisDate,
            ngayThuHoan: amisDate
        });
    }
    
    onClose();
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
              amisAmount: 0,
              amisDate: new Date().toISOString().split('T')[0]
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
              amisAmount: target.amisAmount !== undefined ? target.amisAmount : target.total,
              amisDate: target.invoiceDate || new Date().toISOString().split('T')[0]
          });
          
          const extCustId = target.customerId || formData.customerId;
          const extCust = customers.find(c => c.id === extCustId);
          setCustInputVal(extCust ? extCust.code : '');
      }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (mode) {
        case 'local': return 'Thu Tiền Local Charge';
        case 'other': return 'Thu Tiền Khác';
        case 'deposit': return 'Thu Tiền Cược';
        case 'deposit_refund': return 'Chi Hoàn Cược';
        case 'extension': return 'Thu Tiền Gia Hạn';
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* HEADER */}
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

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50 flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. EXTENSION SELECTOR (IF MODE EXTENSION) */}
            {mode === 'extension' && (formData.extensions?.length || 0) > 0 && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold text-sm">
                        <ChevronDown className="w-4 h-4" />
                        Chọn dòng gia hạn
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

            {/* 2. GENERAL INVOICE / DEBT INFO (COMMON) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide">
                    <User className="w-4 h-4 text-slate-500 mr-2" />
                    Thông tin nợ (Invoice)
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
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium" />
                        </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    {mode !== 'deposit' && mode !== 'deposit_refund' && (
                        <div className={mode === 'other' ? "col-span-2" : ""}>
                            <div className="flex items-center justify-between mb-1.5">
                                <Label>{invoiceInputMode === 'bl' ? 'Số BL' : 'Số Hóa Đơn (Invoice)'}</Label>
                                {mode === 'other' && otherSubMode !== 'deposit' && (
                                    <button 
                                        type="button" 
                                        onClick={toggleInvoiceMode}
                                        className="text-[10px] flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                        title="Chuyển đổi giữa nhập số Invoice và số BL"
                                    >
                                        {invoiceInputMode === 'invoice' ? <ToggleLeft className="w-3.5 h-3.5 text-slate-400" /> : <ToggleRight className="w-3.5 h-3.5 text-blue-600" />}
                                        {invoiceInputMode === 'invoice' ? 'Chế độ Invoice' : 'Chế độ BL'}
                                    </button>
                                )}
                            </div>
                            <input 
                                type="text" 
                                required
                                value={display.currentInvoice} 
                                onChange={(e) => handleInvoiceChange(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
                                placeholder={invoiceInputMode === 'bl' ? "Nhập số BL..." : "Nhập số hóa đơn..."}
                            />
                        </div>
                    )}
                    {mode !== 'other' && (
                        <div className={mode === 'deposit' || mode === 'deposit_refund' ? "col-span-2" : ""}>
                            <Label>Tổng Phải Thu (Debt)</Label>
                            <div className="p-2.5 bg-slate-100 rounded-lg text-base font-bold text-slate-700 text-right border border-slate-200">
                                {new Intl.NumberFormat('en-US').format(display.currentTotalReceivable)} VND
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB INTERFACE */}
            {mode !== 'deposit_refund' && (
            <div className="border-b border-slate-200 flex space-x-6 mb-4">
                <button 
                    type="button"
                    onClick={() => setActiveTab('merge')}
                    className={`pb-2 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${activeTab === 'merge' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers className="w-4 h-4" /> <span>Gộp Job (Cùng khách)</span>
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveTab('installments')}
                    className={`pb-2 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${activeTab === 'installments' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <History className="w-4 h-4" /> <span>Thu Nhiều Lần / Lịch Sử</span>
                </button>
            </div>
            )}

            {/* ========= TAB 1: MERGE JOB ========= */}
            {activeTab === 'merge' && (mode === 'local' || mode === 'extension') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                    
                    {/* ADD JOB SECTION */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-600 uppercase mb-3 flex items-center">
                            <Link className="w-4 h-4 mr-2 text-blue-500" /> Chọn Job để gộp
                        </h3>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text" 
                                placeholder="Nhập Job Code để gộp..." 
                                value={searchJobCode}
                                onChange={(e) => setSearchJobCode(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button type="button" onClick={handleAddJob} className="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-blue-700 flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Thêm
                            </button>
                        </div>
                        {addedJobs.length > 0 && (
                            <div className="space-y-2 mb-2">
                                {addedJobs.map(j => {
                                    const amt = mode === 'extension' 
                                        ? (j.extensions || []).reduce((s, e) => s + e.total, 0)
                                        : (j.localChargeTotal || 0);
                                    return (
                                        <div key={j.id} className="flex justify-between items-center bg-white p-2 rounded border border-blue-100 text-sm">
                                            <div>
                                                <span className="font-bold text-blue-700">{j.jobCode}</span>
                                                <span className="text-slate-500 mx-2">|</span>
                                                <span className="text-slate-600">{j.booking}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-700">{new Intl.NumberFormat('en-US').format(amt)}</span>
                                                <button onClick={() => handleRemoveAddedJob(j.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* MAIN RECEIPT (MERGE MODE) */}
                    <div className="bg-white rounded-xl border-2 border-blue-100 shadow-sm relative overflow-hidden">
                        <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-blue-800 flex items-center uppercase">
                                <Receipt className="w-4 h-4 mr-2" /> Tổng thu
                            </h3>
                            <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold">MERGED</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-5">
                                <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={handleMainDateChange} /></div>
                                <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDocNo: e.target.value})); else setAmisDocNo(e.target.value); }} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-800" /></div>
                            </div>
                            <div>
                                <Label>Tổng tiền</Label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        required
                                        value={currentMainAmount ? new Intl.NumberFormat('en-US').format(currentMainAmount) : ''} 
                                        onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleAmountChange(val); }}
                                        className="w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 text-right text-blue-700 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                                </div>
                            </div>
                            <div>
                                <Label>Diễn giải</Label>
                                <textarea 
                                    value={mode === 'extension' ? newExtension.amisDesc : amisDesc}
                                    onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value})); else setAmisDesc(e.target.value); }}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========= TAB 2: INSTALLMENTS ========= */}
            {activeTab === 'installments' && mode !== 'deposit_refund' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    
                    {/* MAIN RECEIPT (LẦN 1) */}
                    <div className="bg-white rounded-xl border-2 border-emerald-100 shadow-sm relative overflow-hidden">
                        <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-emerald-800 flex items-center uppercase">
                                <Receipt className="w-4 h-4 mr-2" /> Phiếu Thu Lần 1 (Gốc)
                            </h3>
                            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">LẦN 1</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-5">
                                <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={handleMainDateChange} /></div>
                                <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDocNo: e.target.value})); else setAmisDocNo(e.target.value); }} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-800" /></div>
                            </div>
                            <div>
                                <Label>Số tiền thu (Lần 1)</Label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        required
                                        value={currentMainAmount ? new Intl.NumberFormat('en-US').format(currentMainAmount) : ''} 
                                        onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleAmountChange(val); }}
                                        className="w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 text-right text-emerald-700 focus:ring-emerald-500"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                                </div>
                            </div>
                            <div>
                                <Label>Diễn giải (Lần 1)</Label>
                                <textarea 
                                    value={mode === 'extension' ? newExtension.amisDesc : amisDesc}
                                    onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value})); else setAmisDesc(e.target.value); }}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* LIST ADDITIONAL RECEIPTS */}
                    <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-emerald-800 flex items-center uppercase">
                                <List className="w-4 h-4 mr-2" /> Các lần thu thêm (Trả góp)
                            </h3>
                            {!isAddingReceipt && (
                                <button type="button" onClick={handleAddNewReceipt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold flex items-center shadow-sm">
                                    <Plus className="w-3 h-3 mr-1" /> Thêm phiếu (Lần {relevantAdditionalReceipts.length + 2})
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="space-y-3">
                            {relevantAdditionalReceipts.map((rcpt, idx) => (
                                <div key={rcpt.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow relative">
                                    <div className="absolute top-3 right-3 flex items-center gap-2">
                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">Phiếu #{idx + 2}</span>
                                        <button type="button" onClick={() => handleDeleteReceipt(rcpt.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-2">
                                        <div><span className="block text-[10px] text-slate-400 font-bold uppercase">Ngày CT</span><span className="text-sm font-medium text-slate-700">{formatDateVN(rcpt.date)}</span></div>
                                        <div><span className="block text-[10px] text-slate-400 font-bold uppercase">Số CT</span><span className="text-sm font-bold text-slate-800">{rcpt.docNo}</span></div>
                                    </div>
                                    <div className="mb-2"><span className="block text-[10px] text-slate-400 font-bold uppercase">Số tiền</span><span className="text-lg font-bold text-emerald-600">{new Intl.NumberFormat('en-US').format(rcpt.amount)} VND</span></div>
                                    <div><span className="block text-[10px] text-slate-400 font-bold uppercase">Diễn giải</span><p className="text-xs text-slate-600 truncate">{rcpt.desc}</p></div>
                                </div>
                            ))}
                            {relevantAdditionalReceipts.length === 0 && !isAddingReceipt && (
                                <div className="text-center py-4 text-slate-400 text-xs italic border-2 border-dashed border-emerald-100 rounded-xl">Chưa có phiếu thu thêm nào</div>
                            )}
                        </div>

                        {/* Add Form */}
                        {isAddingReceipt && (
                            <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 mt-4 animate-in zoom-in-95 shadow-lg">
                                <h4 className="text-xs font-bold text-emerald-700 uppercase mb-3 border-b border-emerald-100 pb-1">Nhập phiếu lần {relevantAdditionalReceipts.length + 2}</h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div><Label>Ngày</Label><DateInput value={newReceipt.date || ''} onChange={(val) => setNewReceipt(prev => ({...prev, date: val}))} /></div>
                                    <div><Label>Số chứng từ</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt(prev => ({...prev, docNo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                </div>
                                <div className="mb-3"><Label>Số tiền</Label><input type="text" value={newReceipt.amount ? new Intl.NumberFormat('en-US').format(newReceipt.amount) : ''} onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setNewReceipt(prev => ({...prev, amount: val})); }} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                <div className="mb-3"><Label>Diễn giải</Label><input type="text" value={newReceipt.desc} onChange={e => setNewReceipt(prev => ({...prev, desc: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsAddingReceipt(false)} className="text-xs px-3 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold hover:bg-slate-200">Hủy</button>
                                    <button type="button" onClick={handleSaveNewReceipt} className="text-xs px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-sm">Lưu phiếu</button>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="mt-4 pt-3 border-t border-emerald-200/60">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-emerald-900 font-medium">Tổng thực thu (Tất cả các lần):</span>
                                <span className="text-emerald-700 font-bold">{new Intl.NumberFormat('en-US').format(totalCollected)} VND</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Còn lại phải thu:</span>
                                <span className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>{new Intl.NumberFormat('en-US').format(remaining)} VND</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DEFAULT VIEW FOR DEPOSIT REFUND */}
            {mode === 'deposit_refund' && (
                <div className="bg-white rounded-xl border-2 border-red-100 shadow-sm relative overflow-hidden">
                    <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-red-800 flex items-center uppercase">
                            <RotateCcw className="w-4 h-4 mr-2" /> Phiếu Chi Hoàn Cược
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-5">
                            <div><Label>Ngày Chứng Từ</Label><DateInput value={amisDate} onChange={handleMainDateChange} /></div>
                            <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={amisDocNo} onChange={(e) => setAmisDocNo(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 text-red-800" /></div>
                        </div>
                        <div>
                            <Label>Số tiền hoàn</Label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    required
                                    value={new Intl.NumberFormat('en-US').format(formData.thuCuoc || 0)} 
                                    readOnly
                                    className="w-full pl-4 pr-14 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-lg font-bold text-right text-slate-500 cursor-not-allowed"
                                />
                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                            </div>
                        </div>
                        <div>
                            <Label>Diễn giải</Label>
                            <textarea 
                                value={amisDesc}
                                onChange={(e) => setAmisDesc(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
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

