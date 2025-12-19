
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle, Wallet, RotateCcw, Plus, Search, Trash2, ChevronDown, Anchor, History, Receipt, ToggleLeft, ToggleRight, Layers, HandCoins } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo, calculatePaymentStatus } from '../utils';

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

  // Fields for Main Receipt (Lần 1)
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
  
  // NEW: Track selected extension IDs for added jobs (Set of strings)
  const [selectedMergedExtIds, setSelectedMergedExtIds] = useState<Set<string>>(new Set());

  // Helper to generate Description Logic for Merged Jobs
  const generateMergedDescription = (mainInvoice: string, extraJobs: JobData[], isExtension: boolean = false, selectedExtIds?: Set<string>) => {
      const invoices: string[] = [];
      const missingJobCodes: string[] = [];

      if (mainInvoice && mainInvoice.trim()) {
          invoices.push(mainInvoice.trim());
      } else {
          missingJobCodes.push(formData.jobCode);
      }

      extraJobs.forEach(j => {
          let inv = '';
          
          if (isExtension) {
              // Only get invoices from SELECTED extensions
              const selectedExts = (j.extensions || []).filter(e => selectedExtIds?.has(e.id));
              // Get invoices if present, ignore empty
              const extInvoices = selectedExts.map(e => e.invoice).filter(Boolean);
              
              if (extInvoices.length > 0) {
                  inv = extInvoices.join('+');
              } else if (selectedExts.length > 0) {
                  // Selected extensions but no invoice numbers -> use job code
                  missingJobCodes.push(j.jobCode);
              }
          } else {
              inv = j.localChargeInvoice;
              if (!inv || !inv.trim()) {
                  missingJobCodes.push(j.jobCode);
              }
          }
            
          if (inv && inv.trim()) {
              invoices.push(inv.trim());
          }
      });

      // Remove duplicates and split composite invoices
      const uniqueInvoices = Array.from(new Set(invoices.flatMap(i => i.split('+').map(s => s.trim()))));
      const uniqueJobCodes = Array.from(new Set(missingJobCodes));

      let desc = isExtension ? "Thu tiền của KH theo hoá đơn GH " : "Thu tiền của KH theo hoá đơn ";
      
      const invPart = uniqueInvoices.join('+');
      desc += invPart;

      if (uniqueJobCodes.length > 0) {
          if (invPart.length > 0) desc += "+"; 
          desc += "XXX BL " + uniqueJobCodes.join('+');
      }

      desc += " (KIM)";
      return desc;
  };

  const recalculateMerge = (currentMainInvoice: string, extraJobs: JobData[], currentSelectedExtIds: Set<string> = selectedMergedExtIds) => {
      const isExtension = mode === 'extension';
      
      // Calculate Description
      const newDesc = generateMergedDescription(currentMainInvoice, extraJobs, isExtension, currentSelectedExtIds);
      
      // Calculate Total Amount
      let totalAmount = 0;
      
      if (isExtension) {
          // 1. Main Job Selected Extension
          if (internalTargetId) {
              const mainExt = formData.extensions?.find(e => e.id === internalTargetId);
              if (mainExt) totalAmount += mainExt.total;
          }
          
          // 2. Added Jobs Selected Extensions
          extraJobs.forEach(j => {
              (j.extensions || []).forEach(ext => {
                  if (currentSelectedExtIds.has(ext.id)) {
                      totalAmount += ext.total;
                  }
              });
          });
          
          setNewExtension(prev => ({ 
              ...prev, 
              amisDesc: newDesc,
              total: totalAmount,
              amisAmount: totalAmount // Auto-update amount to match total
          }));
          
      } else {
          // Local/Other Logic (Simple Sum)
          totalAmount = formData.localChargeTotal || 0;
          extraJobs.forEach(j => {
              totalAmount += (j.localChargeTotal || 0);
          });
          
          // For Local/Other, we update form description manually
          setAmisDesc(newDesc);
          
          // Recalculating form total based on merge
          const mainAmt = job.localChargeTotal || 0; // Original main amount
          const extraAmt = extraJobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
          
          setFormData(prev => ({ ...prev, localChargeTotal: mainAmt + extraAmt }));
          setAmisAmount(mainAmt + extraAmt);
      }
  };

  useEffect(() => {
      if (isOpen && mode === 'other') {
          // Check existing description to determine mode if editing
          const desc = job.amisLcDesc || '';
          if (desc.includes('CƯỢC')) {
              setOtherSubMode('deposit');
          } else {
              setOtherSubMode('local');
          }
          setInvoiceInputMode('invoice');
      }
  }, [isOpen, mode, job.amisLcDesc]);

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
      setSelectedMergedExtIds(new Set()); // Reset selection

      let initialCustId = '';
      if (mode === 'local' || mode === 'other' || mode === 'refund_overpayment') initialCustId = deepCopyJob.customerId;
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
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          
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
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          const inv = deepCopyJob.localChargeInvoice || 'XXX';
          // Use existing desc or default based on detected submode
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
      else if (mode === 'refund_overpayment') {
          setAmisDocNo(generateNextDocNo(jobsForCalc, 'UNC'));
          setAmisDate(new Date().toISOString().split('T')[0]);
          setAmisDesc(`Hoàn tiền thừa local charge BL ${deepCopyJob.jobCode} (KIM)`);
          
          // Auto calculate overpayment
          const status = calculatePaymentStatus(deepCopyJob);
          const overpaid = Math.max(0, status.lcDiff);
          setAmisAmount(overpaid);
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
                amisDate: targetExt.invoiceDate || new Date().toISOString().split('T')[0] // Default receipt date to invoice date
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

  const handleOtherSubModeChange = (subMode: 'local' | 'deposit') => {
      setOtherSubMode(subMode);
      const invPlaceholder = formData.localChargeInvoice || 'XXX';
      
      // CRITICAL: Update description keyword for AmisExport.tsx logic
      if (subMode === 'deposit') {
          setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
      } else {
          // If switching back to local/other, determine format
          if (invoiceInputMode === 'bl') {
              setAmisDesc(`Thu tiền của KH theo hoá đơn XXX BL ${invPlaceholder} (LH MB)`);
          } else {
              setAmisDesc(`Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
          }
      }
  };

  const getDisplayValues = () => {
      let currentTotalReceivable = 0; // Total Debt
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
      } else if (mode === 'refund_overpayment') {
          currentTotalReceivable = 0; // Refund is not debt
          currentCustomer = formData.customerId || '';
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
      if (mode === 'local' || mode === 'other' || mode === 'refund_overpayment') {
          setFormData(prev => ({ ...prev, customerId: val }));
      }
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(prev => ({ ...prev, maKhCuocId: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, customerId: val }));
  };

  // Helper to update description specifically for Other Receipt modes
  const updateOtherDescription = (val: string, inputMode: 'invoice' | 'bl') => {
      const invPlaceholder = val || 'XXX';
      if (otherSubMode === 'deposit') {
          setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${invPlaceholder}`);
      } else {
          // Check Input Mode: Invoice vs BL
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
      // Trigger description update immediately
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

  // --- MULTI-RECEIPT HANDLERS ---
  const handleAddNewReceipt = () => {
      setIsAddingReceipt(true);
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      
      const currentMainDoc = mode === 'extension' ? newExtension.amisDocNo : amisDocNo;
      const existingInSession = [currentMainDoc, ...additionalReceipts.map(r => r.docNo)].filter(Boolean);
      
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
    
    // Save Dates logic: Main Receipt Date maps to specific fields
    const finalDate = mode === 'extension' ? newExtension.amisDate : amisDate;

    if (mode === 'extension') {
      let updatedExtensions;
      if (internalTargetId) {
          updatedExtensions = (formData.extensions || []).map(ext => {
              if (ext.id === internalTargetId) {
                  return {
                      ...ext,
                      customerId: newExtension.customerId,
                      invoice: newExtension.invoice,
                      // invoiceDate: newExtension.date, // Keep original invoice date? or update? Let's keep original
                      amisDocNo: newExtension.amisDocNo,
                      amisDesc: newExtension.amisDesc,
                      amisAmount: ext.total // Save the full amount of this extension as paid
                  };
              }
              return ext;
          });
      } else {
          // If no internal target (creating new), standard logic
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

      // SAVE ADDED JOBS (Specific Extensions)
      if (addedJobs.length > 0) {
          addedJobs.forEach(addedJob => {
              const updatedAddedJobExtensions = (addedJob.extensions || []).map(ext => {
                  if (selectedMergedExtIds.has(ext.id)) {
                      return {
                          ...ext,
                          amisDocNo: newExtension.amisDocNo,
                          amisDesc: newExtension.amisDesc,
                          amisAmount: ext.total // Mark as paid
                      };
                  }
                  return ext;
              });
              
              // Only save if changes made
              if (updatedAddedJobExtensions !== addedJob.extensions) {
                  onSave({ ...addedJob, extensions: updatedAddedJobExtensions });
              }
          });
      }

    } 
    else if (mode === 'local' || mode === 'other') {
        // ... (Existing logic for local/other unchanged)
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
                    amisLcDesc: amisDesc
                });
            });
        }
    }
    // ... (deposit logic unchanged)
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
    else if (mode === 'refund_overpayment') {
        const newRefundRecord = {
            id: Date.now().toString(),
            date: amisDate,
            docNo: amisDocNo,
            amount: amisAmount,
            desc: amisDesc
        };
        const updatedRefunds = [...(formData.refunds || []), newRefundRecord];
        onSave({ ...formData, refunds: updatedRefunds });
    }
    
    onClose();
  };

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
          // For Extension: By default select all UNPAID extensions of the added job
          const unpaidExts = (found.extensions || []).filter(e => !e.amisDocNo);
          const newSet = new Set(selectedMergedExtIds);
          unpaidExts.forEach(e => newSet.add(e.id));
          setSelectedMergedExtIds(newSet);
          
          recalculateMerge(newExtension.invoice, newAddedJobs, newSet);
      } else {
          // Local/Other Logic
          recalculateMerge(formData.localChargeInvoice, newAddedJobs);
      }
  };

  const handleRemoveAddedJob = (id: string) => {
      const jobToRemove = addedJobs.find(j => j.id === id);
      const newAddedJobs = addedJobs.filter(j => j.id !== id);
      setAddedJobs(newAddedJobs);

      if (mode === 'extension') {
          // Remove extensions of this job from selection
          const newSet = new Set(selectedMergedExtIds);
          if (jobToRemove && jobToRemove.extensions) {
              jobToRemove.extensions.forEach(e => newSet.delete(e.id));
          }
          setSelectedMergedExtIds(newSet);
          recalculateMerge(newExtension.invoice, newAddedJobs, newSet);
      } else {
          recalculateMerge(formData.localChargeInvoice, newAddedJobs);
      }
  };

  const handleToggleMergedExtension = (extId: string, isChecked: boolean) => {
      const newSet = new Set(selectedMergedExtIds);
      if (isChecked) {
          newSet.add(extId);
      } else {
          newSet.delete(extId);
      }
      setSelectedMergedExtIds(newSet);
      recalculateMerge(newExtension.invoice, addedJobs, newSet);
  };

  const handleSelectExtensionToPay = (extId: string) => {
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      setInternalTargetId(extId || null); // FIX: Ensure null if empty

      if (!extId) {
          // Reset to default blank state
          setNewExtension(prev => ({
              ...prev,
              invoice: '',
              total: 0,
              amisAmount: 0,
              amisDesc: generateMergedDescription('', addedJobs, true, selectedMergedExtIds)
          }));
          // Recalculate based on merged jobs only
          recalculateMerge('', addedJobs, selectedMergedExtIds);
          return;
      }

      const target = formData.extensions?.find(e => e.id === extId);
      if (target) {
          // Temporarily set invoice to target invoice to calc description
          const newDesc = generateMergedDescription(target.invoice, addedJobs, true, selectedMergedExtIds);
          
          setNewExtension({
              customerId: target.customerId || formData.customerId,
              invoice: target.invoice,
              date: target.invoiceDate || new Date().toISOString().split('T')[0],
              total: target.total, // Will be updated by recalculate
              amisDocNo: target.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
              amisDesc: target.amisDesc || newDesc,
              amisAmount: target.amisAmount !== undefined ? target.amisAmount : target.total,
              amisDate: target.invoiceDate || new Date().toISOString().split('T')[0]
          });
          
          const extCustId = target.customerId || formData.customerId;
          const extCust = customers.find(c => c.id === extCustId);
          setCustInputVal(extCust ? extCust.code : '');
          
          // Trigger recalculate to add merged amounts
          // Pass the target invoice
          recalculateMerge(target.invoice, addedJobs, selectedMergedExtIds);
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
        case 'refund_overpayment': return 'Chi Hoàn Tiền Thừa';
    }
  };

  const isRedTheme = mode === 'deposit_refund' || mode === 'refund_overpayment';

  return createPortal(
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
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
            <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50">
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

            {/* GROUP JOBS SECTION (VISIBLE FOR LOCAL / OTHER / EXTENSION) */}
            {(mode === 'local' || mode === 'other' || mode === 'extension') && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-blue-800 uppercase flex items-center">
                            <Layers className="w-4 h-4 mr-2" /> Gộp Job (Thu cùng phiếu)
                        </h3>
                    </div>

                    {/* Search Input */}
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchJobCode}
                                onChange={(e) => setSearchJobCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddJob())}
                                placeholder="Nhập Job Code để gộp..."
                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAddJob}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm"
                        >
                            Thêm
                        </button>
                    </div>

                    {/* List of Added Jobs */}
                    {addedJobs.length > 0 && (
                        <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-blue-100/50 font-bold text-blue-800">
                                    <tr>
                                        <th className="px-3 py-2">Job Code</th>
                                        <th className="px-3 py-2 text-right">Chi tiết</th>
                                        <th className="px-3 py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-50">
                                    {addedJobs.map(j => (
                                        <tr key={j.id} className="group">
                                            <td className="px-3 py-2 font-medium align-top pt-3">{j.jobCode}</td>
                                            <td className="px-3 py-2">
                                                {/* EXTENSION MODE: List extensions with Checkboxes */}
                                                {mode === 'extension' ? (
                                                    <div className="space-y-1">
                                                        {(j.extensions && j.extensions.length > 0) ? (
                                                            j.extensions.map(ext => (
                                                                <label key={ext.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={selectedMergedExtIds.has(ext.id)}
                                                                        onChange={(e) => handleToggleMergedExtension(ext.id, e.target.checked)}
                                                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                                    />
                                                                    <div className="flex-1 text-[11px]">
                                                                        <span className="font-bold text-slate-700">HĐ: {ext.invoice || 'N/A'}</span>
                                                                        <span className="mx-1 text-slate-300">|</span>
                                                                        <span className="text-blue-600 font-medium">{new Intl.NumberFormat('en-US').format(ext.total)}</span>
                                                                    </div>
                                                                </label>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-400 italic">Không có dòng gia hạn</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* LOCAL/OTHER MODE: Just show total */
                                                    <div className="text-right pt-1 font-bold text-slate-700">
                                                        {new Intl.NumberFormat('en-US').format(j.localChargeTotal || 0)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center align-top pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAddedJob(j.id)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TOGGLE OTHER MODE TYPE (REVENUE VS DEPOSIT) */}
            {mode === 'other' && (
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${otherSubMode === 'deposit' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {otherSubMode === 'deposit' ? <Anchor className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                        </div>
                        <div>
                            <Label>Phân loại thu khác</Label>
                            <p className="text-xs text-slate-500">{otherSubMode === 'deposit' ? 'Thu tiền cược vỏ (Deposit)' : 'Thu tiền hàng / phí dịch vụ'}</p>
                        </div>
                    </div>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        <button
                            type="button"
                            onClick={() => handleOtherSubModeChange('local')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${otherSubMode === 'local' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Doanh Thu
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOtherSubModeChange('deposit')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${otherSubMode === 'deposit' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Thu Cược
                        </button>
                    </div>
                </div>
            )}

            {/* 2. GENERAL INVOICE / DEBT INFO */}
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
                    {mode !== 'deposit' && mode !== 'deposit_refund' && mode !== 'refund_overpayment' && (
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
                    {mode !== 'other' && mode !== 'refund_overpayment' && (
                        <div className={mode === 'deposit' || mode === 'deposit_refund' ? "col-span-2" : ""}>
                            <Label>Tổng Phải Thu (Debt)</Label>
                            <div className="p-2.5 bg-slate-100 rounded-lg text-base font-bold text-slate-700 text-right border border-slate-200">
                                {new Intl.NumberFormat('en-US').format(display.currentTotalReceivable)} VND
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. MAIN PAYMENT RECEIPT (Lần 1) */}
            <div className={`bg-white rounded-xl border-2 shadow-sm relative overflow-hidden ${isRedTheme ? 'border-red-100' : 'border-blue-100'}`}>
                <div className={`px-5 py-3 border-b flex justify-between items-center ${isRedTheme ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                    <h3 className={`text-sm font-bold flex items-center uppercase ${isRedTheme ? 'text-red-800' : 'text-blue-800'}`}>
                        <Receipt className="w-4 h-4 mr-2" /> Phiếu Thu/Chi (Gốc)
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isRedTheme ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>MAIN</span>
                </div>
                
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <Label>Ngày Chứng Từ</Label>
                            <DateInput 
                                value={mode === 'extension' ? newExtension.amisDate : amisDate} 
                                onChange={handleMainDateChange}
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
                                className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 ${isRedTheme ? 'text-red-800 focus:ring-red-500' : 'text-blue-800 focus:ring-blue-500'}`}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Số tiền {isRedTheme ? 'chi' : 'thu'} (Lần 1)</Label>
                        <div className="relative">
                            <input 
                                type="text" 
                                required
                                value={currentMainAmount ? new Intl.NumberFormat('en-US').format(currentMainAmount) : ''} 
                                onChange={(e) => {
                                    const val = Number(e.target.value.replace(/,/g, ''));
                                    if (!isNaN(val)) handleAmountChange(val);
                                }}
                                className={`w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 text-right ${isRedTheme ? 'text-red-700 focus:ring-red-500' : 'text-blue-700 focus:ring-blue-500'}`}
                                placeholder="0"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                        </div>
                    </div>

                    <div>
                        <Label>Diễn giải</Label>
                        <textarea 
                            value={mode === 'extension' ? newExtension.amisDesc : amisDesc}
                            onChange={(e) => {
                                if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value}));
                                else setAmisDesc(e.target.value);
                            }}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* 4. ADDITIONAL RECEIPTS */}
            {mode !== 'deposit_refund' && mode !== 'refund_overpayment' && (
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-emerald-800 flex items-center uppercase">
                        <History className="w-4 h-4 mr-2" /> Các lần thu thêm (Additional)
                    </h3>
                    {!isAddingReceipt && (
                        <button type="button" onClick={handleAddNewReceipt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold flex items-center shadow-sm">
                            <Plus className="w-3 h-3 mr-1" /> Thêm phiếu
                        </button>
                    )}
                </div>

                {/* List of Additional Receipts */}
                <div className="space-y-3">
                    {relevantAdditionalReceipts.map((rcpt, idx) => (
                        <div key={rcpt.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow relative">
                            <div className="absolute top-3 right-3 flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">Phiếu #{idx + 2}</span>
                                <button type="button" onClick={() => handleDeleteReceipt(rcpt.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div>
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Ngày CT</span>
                                    <span className="text-sm font-medium text-slate-700">{formatDateVN(rcpt.date)}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-slate-400 font-bold uppercase">Số CT</span>
                                    <span className="text-sm font-bold text-slate-800">{rcpt.docNo}</span>
                                </div>
                            </div>
                            <div className="mb-2">
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Số tiền</span>
                                <span className="text-lg font-bold text-emerald-600">{new Intl.NumberFormat('en-US').format(rcpt.amount)} VND</span>
                            </div>
                            <div>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Diễn giải</span>
                                <p className="text-xs text-slate-600 truncate">{rcpt.desc}</p>
                            </div>
                        </div>
                    ))}
                    
                    {relevantAdditionalReceipts.length === 0 && !isAddingReceipt && (
                        <div className="text-center py-4 text-slate-400 text-xs italic border-2 border-dashed border-emerald-100 rounded-xl">
                            Chưa có phiếu thu thêm nào
                        </div>
                    )}
                </div>

                {/* Add Receipt Form */}
                {isAddingReceipt && (
                    <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 mt-4 animate-in zoom-in-95 shadow-lg">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div><Label>Ngày</Label><DateInput value={newReceipt.date || ''} onChange={(val) => setNewReceipt(prev => ({...prev, date: val}))} /></div>
                            <div><Label>Số chứng từ</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt(prev => ({...prev, docNo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                        </div>
                        <div className="mb-3"><Label>Số tiền</Label>
                            <input 
                                type="text" 
                                value={newReceipt.amount ? new Intl.NumberFormat('en-US').format(newReceipt.amount) : ''} 
                                onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setNewReceipt(prev => ({...prev, amount: val})); }} 
                                className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" 
                            />
                        </div>
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
                        <span className="text-emerald-900 font-medium">Tổng thực thu (Lần 1 + Thêm):</span>
                        <span className="text-emerald-700 font-bold">{new Intl.NumberFormat('en-US').format(totalCollected)} VND</span>
                    </div>
                    {mode !== 'other' && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Còn lại phải thu:</span>
                            <span className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>{new Intl.NumberFormat('en-US').format(remaining)} VND</span>
                        </div>
                    )}
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
                className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100 ${isRedTheme ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}
            >
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
