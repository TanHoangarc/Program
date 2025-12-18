
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, User, RotateCcw, Plus, Trash2, ChevronDown, History, Receipt, Link, Layers, List, ToggleLeft, ToggleRight, CheckSquare, Square, Box, Calculator, AlertTriangle, Check } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt, ExtensionData } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo } from '../utils';

export type ReceiveMode = 'local' | 'deposit' | 'deposit_refund' | 'local_refund' | 'extension' | 'other';

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

// --- HELPER COMPONENTS ---

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
    <div className={`relative w-full ${className || ''}`}>
      <input 
        type="text" 
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
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
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">{children}</label>
);

const SectionHeader = ({ icon: Icon, title, rightContent, color = "text-slate-700" }: any) => (
  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
    <h3 className={`text-xs font-bold uppercase flex items-center tracking-wider ${color}`}>
      <Icon className="w-3.5 h-3.5 mr-2" /> {title}
    </h3>
    {rightContent}
  </div>
);

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers, allJobs, targetExtensionId, usedDocNos = []
}) => {
  // --- STATES ---
  const [formData, setFormData] = useState<JobData>(job);
  const [otherSubMode, setOtherSubMode] = useState<'local' | 'deposit'>('local');
  const [activeTab, setActiveTab] = useState<'merge' | 'installments'>('merge');

  // Main Slip Fields
  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0);
  const [amisDate, setAmisDate] = useState('');

  // Extension Fields (Legacy compat)
  const [newExtension, setNewExtension] = useState({
    customerId: '', invoice: '', date: new Date().toISOString().split('T')[0], total: 0,
    amisDocNo: '', amisDesc: '', amisAmount: 0, amisDate: ''
  });
  
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);
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

  // Merging Logic
  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobCode, setSearchJobCode] = useState('');

  // --- NEW STATES FOR SMART SELECTION ---
  const [selectedExtMap, setSelectedExtMap] = useState<Record<string, string[]>>({});
  const [initialSnapshot, setInitialSnapshot] = useState<{ docNo: string, mapJson: string, amount: number } | null>(null);
  const isInitializing = useRef(true);

  // ----------------------------------------------------------------------
  // INITIALIZATION LOGIC (100% REPRODUCED)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      isInitializing.current = true;
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      
      if (mode === 'other') {
          if (!deepCopyJob.localChargeDate) deepCopyJob.localChargeDate = new Date().toISOString().split('T')[0];
          const desc = deepCopyJob.amisLcDesc || '';
          setOtherSubMode(desc.includes('CƯỢC') ? 'deposit' : 'local');
      }

      setFormData(deepCopyJob);
      
      let foundMergedJobs: JobData[] = [];
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];

      // Find jobs already merged (having same Doc No)
      if (allJobs && allJobs.length > 0) {
          if (mode === 'local' || mode === 'other') {
              const currentDoc = deepCopyJob.amisLcDocNo;
              if (currentDoc) {
                  foundMergedJobs = allJobs.filter(j => j.id !== deepCopyJob.id && j.amisLcDocNo === currentDoc);
              }
          } else if (mode === 'extension') {
              const exts = deepCopyJob.extensions || [];
              let targetDoc = '';
              if (targetExtensionId) {
                  const t = exts.find((e: any) => e.id === targetExtensionId);
                  if (t) targetDoc = t.amisDocNo;
              } else if (exts.length > 0) {
                  targetDoc = exts[0].amisDocNo;
              }
              if (targetDoc) {
                  foundMergedJobs = allJobs.filter(j => j.id !== deepCopyJob.id && (j.extensions || []).some(e => e.amisDocNo === targetDoc));
              }
          }
      }
      setAddedJobs(foundMergedJobs);
      setAdditionalReceipts(deepCopyJob.additionalReceipts || []);

      // Init selected extensions map
      const initMap: Record<string, string[]> = {};
      if (mode === 'extension') {
          // Main Job
          let targetDoc = '';
          if (targetExtensionId) {
              const t = (deepCopyJob.extensions || []).find((e: any) => e.id === targetExtensionId);
              if (t) targetDoc = t.amisDocNo || '';
          } else if ((deepCopyJob.extensions || []).length > 0) {
              targetDoc = deepCopyJob.extensions[0].amisDocNo || '';
          }

          if (targetDoc) {
              initMap[deepCopyJob.id] = (deepCopyJob.extensions || []).filter((e: any) => e.amisDocNo === targetDoc).map((e: any) => e.id);
              foundMergedJobs.forEach(j => {
                  initMap[j.id] = (j.extensions || []).filter((e: any) => e.amisDocNo === targetDoc).map((e: any) => e.id);
              });
          } else {
              // Default select first if nothing linked
              if (deepCopyJob.extensions?.length > 0) initMap[deepCopyJob.id] = [deepCopyJob.extensions[0].id];
          }
      }
      setSelectedExtMap(initMap);

      // Tab selection
      if (foundMergedJobs.length > 0) setActiveTab('merge');
      else if ((deepCopyJob.additionalReceipts || []).length > 0) setActiveTab('installments');
      else setActiveTab('merge');

      // Customer identify
      const initialCustId = (mode === 'deposit' || mode === 'deposit_refund' || mode === 'local_refund') 
        ? (deepCopyJob.maKhCuocId || deepCopyJob.customerId) 
        : deepCopyJob.customerId;
      const foundCust = customers.find(c => c.id === initialCustId);
      setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

      // Setup initial values
      let startDocNo = '';
      let startAmount = 0;

      if (mode === 'local' || mode === 'other') {
          startDocNo = deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra);
          startAmount = deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0);
          setAmisDocNo(startDocNo);
          setAmisAmount(startAmount);
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          setAmisDesc(deepCopyJob.amisLcDesc || `Thu tiền của KH theo hoá đơn ${deepCopyJob.localChargeInvoice || 'XXX'} (KIM)`);
      } 
      else if (mode === 'deposit') {
          startDocNo = deepCopyJob.amisDepositDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra);
          startAmount = deepCopyJob.amisDepositAmount !== undefined ? deepCopyJob.amisDepositAmount : (deepCopyJob.thuCuoc || 0);
          setAmisDocNo(startDocNo);
          setAmisAmount(startAmount);
          setAmisDate(deepCopyJob.ngayThuCuoc || new Date().toISOString().split('T')[0]);
          setAmisDesc(deepCopyJob.amisDepositDesc || `Thu tiền của KH CƯỢC CONT BL ${deepCopyJob.jobCode}`);
      } 
      else if (mode.includes('refund')) {
          startDocNo = mode === 'deposit_refund' ? (deepCopyJob.amisDepositRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC')) : (deepCopyJob.amisLcRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC'));
          startAmount = mode === 'deposit_refund' ? (deepCopyJob.thuCuoc || 0) : (deepCopyJob.amisLcRefundAmount || 0);
          setAmisDocNo(startDocNo);
          setAmisAmount(startAmount);
          setAmisDate((mode === 'deposit_refund' ? deepCopyJob.amisDepositRefundDate : deepCopyJob.amisLcRefundDate) || new Date().toISOString().split('T')[0]);
          setAmisDesc((mode === 'deposit_refund' ? deepCopyJob.amisDepositRefundDesc : deepCopyJob.amisLcRefundDesc) || (mode === 'deposit_refund' ? `Chi hoàn cược BL ${deepCopyJob.jobCode}` : `Chi hoàn local charge BL ${deepCopyJob.jobCode}`));
      }
      else if (mode === 'extension') {
          const targetExt = targetExtensionId ? deepCopyJob.extensions.find((e:any)=>e.id === targetExtensionId) : deepCopyJob.extensions?.[0];
          startDocNo = targetExt?.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra);
          startAmount = targetExt?.amisAmount !== undefined ? targetExt.amisAmount : (targetExt?.total || 0);
          
          setNewExtension({ 
            customerId: targetExt?.customerId || deepCopyJob.customerId || '', 
            invoice: targetExt?.invoice || '', 
            date: targetExt?.invoiceDate || new Date().toISOString().split('T')[0],
            total: targetExt?.total || 0,
            amisDocNo: startDocNo,
            amisDesc: targetExt?.amisDesc || `Thu tiền của KH theo hoá đơn GH ${targetExt?.invoice || 'XXX'} (KIM)`,
            amisAmount: startAmount,
            amisDate: targetExt?.invoiceDate || new Date().toISOString().split('T')[0]
          });
      }

      setInitialSnapshot({ docNo: startDocNo, mapJson: JSON.stringify(initMap), amount: startAmount });
      setTimeout(() => { isInitializing.current = false; }, 100);
    }
  }, [isOpen]);

  // ----------------------------------------------------------------------
  // DYNAMIC LOGIC: DOCUMENT AUTO-INCREMENT & SMART DESC
  // ----------------------------------------------------------------------
  
  const triggerAutoUpdate = (currentMap: Record<string, string[]>, currentAmount: number) => {
      if (isInitializing.current || !initialSnapshot) return;

      const mapChanged = initialSnapshot.mapJson !== JSON.stringify(currentMap);
      const amountChanged = Math.abs(initialSnapshot.amount - currentAmount) > 10;

      if (mapChanged || amountChanged) {
          const jobsForCalc = allJobs || [];
          const nextDoc = generateNextDocNo(jobsForCalc, 'NTTK', 5, usedDocNos);
          const today = new Date().toISOString().split('T')[0];

          if (mode === 'extension') {
              setNewExtension(prev => ({ ...prev, amisDocNo: nextDoc, amisDate: today }));
          } else {
              setAmisDocNo(nextDoc);
              setAmisDate(today);
          }
      } else {
          // Revert to initial if selection matches again
          if (mode === 'extension') {
              setNewExtension(prev => ({ ...prev, amisDocNo: initialSnapshot.docNo }));
          } else {
              setAmisDocNo(initialSnapshot.docNo);
          }
      }
  };

  useEffect(() => {
    if (!isOpen || isInitializing.current) return;

    if (mode === 'extension') {
        let total = 0;
        const invoices: string[] = [];
        const jobCodes: string[] = [];

        // Check Main Job
        const mainSelected = selectedExtMap[formData.id] || [];
        (formData.extensions || []).forEach(e => {
            if (mainSelected.includes(e.id)) {
                total += e.total;
                if (e.invoice) invoices.push(e.invoice);
            }
        });
        if (mainSelected.length === 0) jobCodes.push(formData.jobCode);

        // Check Merged Jobs
        addedJobs.forEach(j => {
            const jSelected = selectedExtMap[j.id] || [];
            let hasSelected = false;
            (j.extensions || []).forEach(e => {
                if (jSelected.includes(e.id)) {
                    total += e.total;
                    if (e.invoice) invoices.push(e.invoice);
                    hasSelected = true;
                }
            });
            if (!hasSelected) jobCodes.push(j.jobCode);
        });

        const smartInv = invoices.length > 0 ? invoices.join('+') : 'XXX';
        const smartJobs = jobCodes.length > 0 ? ` BL ${jobCodes.join('+')}` : '';
        const desc = `Thu tiền của KH theo hoá đơn GH ${smartInv}${smartJobs} (KIM)`;
        
        setNewExtension(prev => ({ ...prev, amisAmount: total, amisDesc: desc }));
        triggerAutoUpdate(selectedExtMap, total);
    } 
    else if (mode === 'local' || mode === 'other') {
        const total = (formData.localChargeTotal || 0) + addedJobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
        const invoices = [formData.localChargeInvoice, ...addedJobs.map(j => j.localChargeInvoice)].filter(Boolean);
        const jobCodes = invoices.length < (addedJobs.length + 1) ? [formData.jobCode, ...addedJobs.map(j => j.jobCode)] : [];
        
        const smartInv = invoices.length > 0 ? invoices.join('+') : 'XXX';
        const smartJobs = jobCodes.length > 0 ? ` BL ${jobCodes.join('+')}` : '';
        const desc = `Thu tiền của KH theo hoá đơn ${smartInv}${smartJobs} (KIM)`;
        
        setAmisAmount(total);
        setAmisDesc(desc);
        triggerAutoUpdate(selectedExtMap, total);
    }
  }, [selectedExtMap, addedJobs, mode, isOpen]);

  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------
  const toggleExtension = (jobId: string, extId: string) => {
      setSelectedExtMap(prev => {
          const current = prev[jobId] || [];
          const next = current.includes(extId) ? current.filter(id => id !== extId) : [...current, extId];
          return { ...prev, [jobId]: next };
      });
  };

  const getDisplayValues = () => {
      let currentTotalReceivable = 0; let currentCustomer = ''; let currentInvoice = '';
      if (mode === 'local' || mode === 'other' || mode === 'local_refund') {
          currentInvoice = formData.localChargeInvoice || '';
          currentTotalReceivable = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit' || mode === 'deposit_refund') {
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
  const relevantAdditionalReceipts = additionalReceipts.filter(r => {
      if (mode === 'extension') return r.type === 'extension' && r.extensionId === internalTargetId;
      if (mode === 'local') return r.type === 'local';
      if (mode === 'deposit') return r.type === 'deposit';
      if (mode === 'other') return r.type === otherSubMode;
      return false;
  });

  const currentMainAmount = mode === 'extension' ? newExtension.amisAmount : amisAmount;
  const totalCollected = currentMainAmount + relevantAdditionalReceipts.reduce((sum, r) => sum + r.amount, 0);
  const remaining = display.currentTotalReceivable - totalCollected;

  const handleSelectCustomer = (customer: Customer) => {
      setCustInputVal(customer.code);
      if (mode === 'local' || mode === 'other' || mode === 'local_refund') setFormData(p => ({ ...p, customerId: customer.id }));
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(p => ({ ...p, maKhCuocId: customer.id }));
      else if (mode === 'extension') setNewExtension(p => ({ ...p, customerId: customer.id }));
      setShowSuggestions(false);
  };

  const handleAddJobToMerge = () => {
      const found = allJobs?.find(j => j.jobCode === searchJobCode && j.id !== formData.id);
      if (!found) return alert("Không tìm thấy Job Code!");
      if (found.customerId !== formData.customerId) return alert("Chỉ gộp được Job cùng khách hàng!");
      if (addedJobs.some(j => j.id === found.id)) return alert("Job này đã có trong danh sách!");
      
      setAddedJobs([...addedJobs, found]);
      if (mode === 'extension') {
          setSelectedExtMap(prev => ({ ...prev, [found.id]: (found.extensions || []).map(e => e.id) }));
      }
      setSearchJobCode('');
  };

  const handleRemoveAddedJob = (id: string) => {
      setAddedJobs(prev => prev.filter(j => j.id !== id));
      setSelectedExtMap(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  // Installment Methods
  const handleAddNewReceipt = () => {
      setIsAddingReceipt(true);
      const jobsForCalc = allJobs || [];
      const existingDocs = [mode === 'extension' ? newExtension.amisDocNo : amisDocNo, ...additionalReceipts.map(r => r.docNo)].filter(Boolean);
      const nextDoc = generateNextDocNo(jobsForCalc, 'NTTK', 5, [...usedDocNos, ...existingDocs]);
      const mainDesc = mode === 'extension' ? newExtension.amisDesc : amisDesc;
      const nextCount = relevantAdditionalReceipts.length + 2;
      const nextDesc = mainDesc.includes('LẦN 1') ? mainDesc.replace('LẦN 1', `LẦN ${nextCount}`) : `${mainDesc} (LẦN ${nextCount})`;
      setNewReceipt({ amount: Math.max(0, remaining), date: new Date().toISOString().split('T')[0], docNo: nextDoc, desc: nextDesc });
  };

  const handleSaveNewReceipt = () => {
      if (!newReceipt.amount || !newReceipt.docNo) return;
      const receipt: AdditionalReceipt = {
          id: `rcpt-${Date.now()}`,
          type: mode === 'other' ? otherSubMode : (mode === 'deposit' ? 'deposit' : (mode === 'extension' ? 'extension' : 'local')),
          date: newReceipt.date || '', docNo: newReceipt.docNo || '', desc: newReceipt.desc || '', amount: newReceipt.amount || 0,
          extensionId: mode === 'extension' ? internalTargetId || undefined : undefined
      };
      setAdditionalReceipts(prev => [...prev, receipt]);
      setIsAddingReceipt(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'extension') {
        const finalDocNo = newExtension.amisDocNo;
        const finalDate = newExtension.amisDate;
        const finalDesc = newExtension.amisDesc;

        // Cập nhật Job chính
        const updatedMainExts = (formData.extensions || []).map(ext => {
            if (selectedExtMap[formData.id]?.includes(ext.id)) {
                return { ...ext, amisDocNo: finalDocNo, amisDate: finalDate, amisDesc: finalDesc, amisAmount: ext.total };
            }
            return ext;
        });
        onSave({ ...formData, extensions: updatedMainExts, additionalReceipts });

        // Cập nhật các Job gộp
        addedJobs.forEach(aj => {
            const updatedAjExts = (aj.extensions || []).map(ext => {
                if (selectedExtMap[aj.id]?.includes(ext.id)) {
                    return { ...ext, amisDocNo: finalDocNo, amisDate: finalDate, amisDesc: finalDesc, amisAmount: ext.total };
                }
                return ext;
            });
            onSave({ ...aj, extensions: updatedAjExts });
        });
    } else {
        const addedTotal = addedJobs.reduce((sum, j) => sum + (j.localChargeTotal || 0), 0);
        const mainUpdate: Partial<JobData> = mode.includes('refund') ? {
            amisLcRefundDocNo: mode === 'local_refund' ? amisDocNo : formData.amisLcRefundDocNo,
            amisLcRefundDesc: mode === 'local_refund' ? amisDesc : formData.amisLcRefundDesc,
            amisLcRefundDate: mode === 'local_refund' ? amisDate : formData.amisLcRefundDate,
            amisLcRefundAmount: mode === 'local_refund' ? amisAmount : formData.amisLcRefundAmount,
            amisDepositRefundDocNo: mode === 'deposit_refund' ? amisDocNo : formData.amisDepositRefundDocNo,
            amisDepositRefundDesc: mode === 'deposit_refund' ? amisDesc : formData.amisDepositRefundDesc,
            amisDepositRefundDate: mode === 'deposit_refund' ? amisDate : formData.amisDepositRefundDate,
            ngayThuHoan: amisDate
        } : (mode === 'deposit' ? {
            amisDepositDocNo: amisDocNo, amisDepositDesc: amisDesc, amisDepositAmount: amisAmount, ngayThuCuoc: amisDate
        } : {
            amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: amisAmount - addedTotal, localChargeDate: amisDate
        });
        
        onSave({ ...formData, ...mainUpdate, additionalReceipts });
        
        if (addedJobs.length > 0 && !mode.includes('refund')) {
            addedJobs.forEach(aj => onSave({ ...aj, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: aj.localChargeTotal }));
        }
    }
    onClose();
  };

  const filteredCustomers = useMemo(() => {
    if (!custInputVal) return customers;
    const lower = custInputVal.toLowerCase();
    return customers.filter(c => (c.code || '').toLowerCase().includes(lower) || (c.name || '').toLowerCase().includes(lower));
  }, [customers, custInputVal]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* HEADER */}
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl ${mode.includes('refund') ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg shadow-sm border ${mode.includes('refund') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {mode.includes('refund') ? <RotateCcw className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div>
                  <h2 className="text-lg font-bold text-slate-800">{mode === 'extension' ? 'Thu Tiền Gia Hạn' : mode.includes('refund') ? 'Chi Hoàn Tiền' : 'Thu Tiền'}</h2>
                  <p className="text-xs text-slate-500 font-medium">Job: <span className="font-bold text-blue-700">{formData.jobCode}</span></p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 p-2"><X className="w-5 h-5" /></button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto p-6 bg-slate-50 flex-1 custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* THÔNG TIN NỢ GỐC */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <SectionHeader icon={User} title="Thông tin nợ" />
                <div className="grid grid-cols-2 gap-5 mb-4">
                        <div className="relative group">
                            <Label>Mã Đối Tượng</Label>
                            <input 
                              type="text" 
                              value={custInputVal} 
                              onChange={(e) => { setCustInputVal(e.target.value); setShowSuggestions(true); }} 
                              onFocus={() => setShowSuggestions(true)} 
                              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                              className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="Mã KH..." 
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
                        <div><Label>Tên Đối Tượng</Label><input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-sm text-slate-600 font-medium" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {!mode.includes('deposit') && !mode.includes('local_refund') && (
                        <div className="col-span-1">
                            <Label>Số HĐ / BL</Label>
                            <input type="text" required value={display.currentInvoice} onChange={(e) => mode === 'extension' ? setNewExtension(p => ({...p, invoice: e.target.value})) : setFormData(p => ({...p, localChargeInvoice: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    )}
                    <div className={mode.includes('deposit') || mode.includes('local_refund') ? "col-span-2" : "col-span-1"}>
                        <Label>Tổng Phải Thu (Debt)</Label>
                        <div className="p-2 bg-slate-100 rounded-lg text-base font-bold text-slate-700 text-right border">{new Intl.NumberFormat('en-US').format(display.currentTotalReceivable)} VND</div>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            {!mode.includes('refund') && (
            <div className="border-b flex space-x-6">
                <button type="button" onClick={() => setActiveTab('merge')} className={`pb-2 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${activeTab === 'merge' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Layers className="w-4 h-4" /> <span>Gộp Job & Chọn dòng</span></button>
                <button type="button" onClick={() => setActiveTab('installments')} className={`pb-2 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${activeTab === 'installments' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><History className="w-4 h-4" /> <span>Thu Nhiều Lần</span></button>
            </div>
            )}

            {/* TAB 1: MERGE & SELECTION */}
            {activeTab === 'merge' && !mode.includes('refund') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-600 uppercase mb-3 flex items-center"><Link className="w-4 h-4 mr-2" /> Thêm Job để gộp thu</h3>
                        <div className="flex gap-2 mb-4">
                            <input type="text" placeholder="Nhập Job Code..." value={searchJobCode} onChange={e => setSearchJobCode(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            <button type="button" onClick={handleAddJobToMerge} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all hover:bg-blue-700 shadow-sm active:scale-95">+ Thêm Job</button>
                        </div>

                        {/* LIST JOBS & EXTENSIONS */}
                        <div className="space-y-3">
                            {/* Main Job */}
                            <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                                <span className="font-bold text-blue-700 flex items-center mb-2"><Box className="w-3.5 h-3.5 mr-1.5" /> {formData.jobCode} (Gốc)</span>
                                {mode === 'extension' && (formData.extensions || []).length > 0 ? (
                                    <div className="space-y-1 pl-2 border-l-2 border-blue-100">
                                        {formData.extensions.map(ext => (
                                            <button key={ext.id} type="button" onClick={() => toggleExtension(formData.id, ext.id)} className="flex items-center w-full text-left p-1.5 hover:bg-blue-50 rounded transition-colors group">
                                                {selectedExtMap[formData.id]?.includes(ext.id) ? <CheckSquare className="w-4 h-4 mr-2 text-blue-600" /> : <Square className="w-4 h-4 mr-2 text-slate-300" />}
                                                <span className="text-xs font-medium text-slate-700 flex-1">HĐ: {ext.invoice || 'N/A'}</span>
                                                <span className="text-xs font-bold text-slate-500">{new Intl.NumberFormat('en-US').format(ext.total)}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : mode === 'extension' ? <div className="text-[10px] text-slate-400 italic pl-2">Không có dòng gia hạn</div> : null}
                            </div>

                            {/* Added Jobs */}
                            {addedJobs.map(j => (
                                <div key={j.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group animate-in slide-in-from-right-2">
                                    <button type="button" onClick={() => handleRemoveAddedJob(j.id)} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                                    <span className="font-bold text-slate-700 flex items-center mb-2"><Box className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {j.jobCode}</span>
                                    {mode === 'extension' && (j.extensions || []).length > 0 ? (
                                        <div className="space-y-1 pl-2 border-l-2 border-slate-100">
                                            {j.extensions.map(ext => (
                                                <button key={ext.id} type="button" onClick={() => toggleExtension(j.id, ext.id)} className="flex items-center w-full text-left p-1.5 hover:bg-slate-50 rounded transition-colors">
                                                    {selectedExtMap[j.id]?.includes(ext.id) ? <CheckSquare className="w-4 h-4 mr-2 text-blue-600" /> : <Square className="w-4 h-4 mr-2 text-slate-300" />}
                                                    <span className="text-xs font-medium text-slate-700 flex-1">HĐ: {ext.invoice || 'N/A'}</span>
                                                    <span className="text-xs font-bold text-slate-500">{new Intl.NumberFormat('en-US').format(ext.total)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : mode === 'extension' ? <div className="text-[10px] text-slate-400 italic pl-2">Không có dòng gia hạn</div> : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RECEIPT SUMMARY */}
                    <div className="bg-white rounded-xl border-2 border-blue-100 shadow-sm overflow-hidden">
                        <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-blue-800 flex items-center uppercase"><Receipt className="w-4 h-4 mr-2" /> Tổng hợp phiếu thu</h3>
                            <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold">AMIS READY</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-5">
                                <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={val => mode === 'extension' ? setNewExtension(p => ({...p, amisDate: val})) : setAmisDate(val)} /></div>
                                <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={e => mode === 'extension' ? setNewExtension(p => ({...p, amisDocNo: e.target.value})) : setAmisDocNo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" /></div>
                            </div>
                            <div>
                                <Label>Tổng tiền thực thu</Label>
                                <div className="relative">
                                    <input type="text" value={new Intl.NumberFormat('en-US').format(currentMainAmount)} readOnly className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xl font-bold text-right text-blue-800 outline-none" />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Calculator className="w-5 h-5" /></div>
                                </div>
                            </div>
                            <div>
                                <Label>Diễn giải thông minh (Tự động gom HĐ)</Label>
                                <textarea value={mode === 'extension' ? newExtension.amisDesc : amisDesc} onChange={e => mode === 'extension' ? setNewExtension(p => ({...p, amisDesc: e.target.value})) : setAmisDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white font-medium" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: INSTALLMENTS (MULTI-PAYMENT) */}
            {activeTab === 'installments' && !mode.includes('refund') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="bg-white rounded-xl border-2 border-emerald-100 shadow-sm overflow-hidden p-5 space-y-4">
                         <SectionHeader icon={Receipt} title="Phiếu Thu Lần 1 (Gốc)" color="text-emerald-700" />
                         <div className="grid grid-cols-2 gap-5">
                            <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={val => mode === 'extension' ? setNewExtension(p => ({...p, amisDate: val})) : setAmisDate(val)} /></div>
                            <div><Label>Số Chứng Từ</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={e => mode === 'extension' ? setNewExtension(p => ({...p, amisDocNo: e.target.value})) : setAmisDocNo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                         </div>
                         <div><Label>Tiền thu (Lần 1)</Label><input type="text" value={new Intl.NumberFormat('en-US').format(currentMainAmount)} onChange={e => { const v = Number(e.target.value.replace(/,/g, '')); if(!isNaN(v)) mode === 'extension' ? setNewExtension(p => ({...p, amisAmount: v})) : setAmisAmount(v); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/30" /></div>
                    </div>

                    <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-emerald-800 uppercase flex items-center"><List className="w-4 h-4 mr-2" /> Các lần thu thêm</h3>
                            {!isAddingReceipt && <button type="button" onClick={handleAddNewReceipt} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-bold flex items-center shadow-md active:scale-95 transition-all"><Plus className="w-3 h-3 mr-1" /> Thêm phiếu (Lần {relevantAdditionalReceipts.length + 2})</button>}
                        </div>
                        <div className="space-y-3">
                            {relevantAdditionalReceipts.map((rcpt, idx) => (
                                <div key={rcpt.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative group hover:border-emerald-300 transition-all">
                                    <button type="button" onClick={() => setAdditionalReceipts(prev => prev.filter(r => r.id !== rcpt.id))} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                                    <div className="grid grid-cols-2 gap-4 mb-2">
                                        <div><span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Ngày CT</span><span className="text-sm font-medium text-slate-600">{formatDateVN(rcpt.date)}</span></div>
                                        <div><span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Số CT</span><span className="text-sm font-bold text-emerald-800">{rcpt.docNo}</span></div>
                                    </div>
                                    <div className="mb-2 text-lg font-bold text-emerald-600">{new Intl.NumberFormat('en-US').format(rcpt.amount)} VND</div>
                                    <div className="text-xs text-slate-500 italic truncate" title={rcpt.desc}>{rcpt.desc}</div>
                                </div>
                            ))}
                            {relevantAdditionalReceipts.length === 0 && !isAddingReceipt && <div className="text-center py-6 text-slate-400 italic text-xs border border-dashed border-emerald-200 rounded-xl">Chưa có các lần thu bổ sung</div>}
                        </div>

                        {isAddingReceipt && (
                            <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 mt-4 animate-in zoom-in-95 shadow-xl space-y-4">
                                <SectionHeader icon={Plus} title="Nhập phiếu thu mới" color="text-emerald-700" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>Ngày</Label><DateInput value={newReceipt.date || ''} onChange={(val) => setNewReceipt(prev => ({...prev, date: val}))} /></div>
                                    <div><Label>Số chứng từ</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt(prev => ({...prev, docNo: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                </div>
                                <div><Label>Số tiền</Label><input type="text" value={new Intl.NumberFormat('en-US').format(newReceipt.amount || 0)} onChange={e => { const v = Number(e.target.value.replace(/,/g, '')); if(!isNaN(v)) setNewReceipt(prev => ({...prev, amount: v})); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                <div><Label>Diễn giải</Label><textarea value={newReceipt.desc} onChange={e => setNewReceipt(prev => ({...prev, desc: e.target.value}))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" /></div>
                                <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setIsAddingReceipt(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold hover:bg-slate-200 text-xs transition-colors">Hủy</button><button type="button" onClick={handleSaveNewReceipt} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md text-xs transition-all active:scale-95">Lưu phiếu</button></div>
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-emerald-200 space-y-2">
                            <div className="flex justify-between font-medium text-slate-700"><span>Tổng thực thu (Tất cả phiếu):</span><span className="text-emerald-700 font-bold text-lg">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalCollected)}</span></div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">Chênh lệch / Còn lại:</span>
                              <span className={`px-2 py-0.5 rounded font-bold ${remaining === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(remaining)}
                              </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REFUND VIEW (Chi hoàn tiền) */}
            {mode.includes('refund') && (
                <div className="bg-white rounded-xl border-2 border-red-100 shadow-sm overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-300">
                    <SectionHeader icon={RotateCcw} title={mode === 'deposit_refund' ? 'Phiếu Chi Hoàn Cược' : 'Phiếu Chi Hoàn Local Charge'} color="text-red-800" />
                    <div className="grid grid-cols-2 gap-5">
                        <div><Label>Ngày Chứng Từ</Label><DateInput value={amisDate} onChange={setAmisDate} /></div>
                        <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={amisDocNo} onChange={e => setAmisDocNo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-red-800 outline-none focus:ring-2 focus:ring-red-500" /></div>
                    </div>
                    <div>
                        <Label>Số tiền hoàn trả</Label>
                        <input type="text" value={new Intl.NumberFormat('en-US').format(amisAmount)} onChange={e => { const v = Number(e.target.value.replace(/,/g, '')); if(!isNaN(v)) setAmisAmount(v); }} className="w-full px-3 py-3 border border-slate-300 rounded-lg text-2xl font-bold text-right text-red-700 focus:ring-2 focus:ring-red-500 outline-none bg-red-50/30" />
                    </div>
                    <div><Label>Diễn giải</Label><textarea value={amisDesc} onChange={e => setAmisDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white font-medium" /></div>
                </div>
            )}

            </form>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end items-center gap-3">
            <div className="flex-1 text-[10px] text-slate-400 italic">
                {mode === 'extension' ? '* Amis sẽ cập nhật cho từng dòng gia hạn được chọn.' : '* Amis sẽ đồng bộ cho Job gốc và các Job gộp (nếu có).'}
            </div>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">Hủy bỏ</button>
            <button onClick={handleSubmit} className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100 ${mode.includes('refund') ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}>
                <Save className="w-4 h-4 mr-2" /> {mode.includes('refund') ? 'Xác Nhận Chi Hoàn' : 'Lưu & Đồng Bộ'}
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

