
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, User, RotateCcw, Plus, Trash2, ChevronDown, History, Receipt, Link, Layers, List, ToggleLeft, ToggleRight, CheckSquare, Square, Box, Calculator, AlertTriangle, Check, Banknote, Anchor } from 'lucide-react';
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
  const [formData, setFormData] = useState<JobData>(job);
  // Chế độ thu khác: local (Phí/HĐ) hoặc deposit (Cược)
  const [otherSubMode, setOtherSubMode] = useState<'local' | 'deposit'>('local');
  const [hasInvoice, setHasInvoice] = useState(true);
  const [activeTab, setActiveTab] = useState<'merge' | 'installments'>('merge');

  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0);
  const [amisDate, setAmisDate] = useState('');

  const [newExtension, setNewExtension] = useState({
    customerId: '', invoice: '', date: new Date().toISOString().split('T')[0], total: 0,
    amisDocNo: '', amisDesc: '', amisAmount: 0, amisDate: ''
  });
  
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

  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobCode, setSearchJobCode] = useState('');

  const [selectedExtMap, setSelectedExtMap] = useState<Record<string, string[]>>({});
  const [initialSnapshot, setInitialSnapshot] = useState<{ docNo: string, mapJson: string, amount: number } | null>(null);
  const isInitializing = useRef(true);

  // 1. INITIALIZATION
  useEffect(() => {
    if (isOpen) {
      isInitializing.current = true;
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      
      if (mode === 'other') {
          const desc = (deepCopyJob.amisLcDesc || '').toUpperCase();
          const isDeposit = desc.includes('CƯỢC') || desc.includes('DEPOSIT');
          setOtherSubMode(isDeposit ? 'deposit' : 'local');
          setHasInvoice(!!deepCopyJob.localChargeInvoice && !deepCopyJob.localChargeInvoice.includes('REF-BL'));
      }

      setFormData(deepCopyJob);
      
      let foundMergedJobs: JobData[] = [];
      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];

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

      const initMap: Record<string, string[]> = {};
      if (mode === 'extension') {
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
              if (deepCopyJob.extensions?.length > 0) initMap[deepCopyJob.id] = [deepCopyJob.extensions[0].id];
          }
      }
      setSelectedExtMap(initMap);

      if (foundMergedJobs.length > 0) setActiveTab('merge');
      else if ((deepCopyJob.additionalReceipts || []).length > 0) setActiveTab('installments');
      else setActiveTab('merge');

      const initialCustId = (mode === 'deposit' || mode === 'deposit_refund' || mode === 'local_refund') 
        ? (deepCopyJob.maKhCuocId || deepCopyJob.customerId) 
        : deepCopyJob.customerId;
      const foundCust = customers.find(c => c.id === initialCustId);
      setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

      let startDocNo = '';
      let startAmount = 0;

      if (mode === 'local' || mode === 'other') {
          startDocNo = deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra);
          startAmount = deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0);
          setAmisDocNo(startDocNo);
          setAmisAmount(startAmount);
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          const prefix = mode === 'other' && otherSubMode === 'deposit' ? 'Thu tiền của KH CƯỢC' : 'Thu tiền của KH theo hoá đơn';
          setAmisDesc(deepCopyJob.amisLcDesc || `${prefix} ${deepCopyJob.localChargeInvoice || 'XXX'} (KIM)`);
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

  // 2. AUTO UPDATE DESCRIPTION
  useEffect(() => {
    if (mode === 'other' && !isInitializing.current) {
        const prefix = otherSubMode === 'deposit' ? 'Thu tiền của KH CƯỢC' : 'Thu tiền của KH theo hoá đơn';
        const ref = formData.localChargeInvoice || 'XXX';
        setAmisDesc(`${prefix} ${ref} (KIM)`);
    }
  }, [otherSubMode, formData.localChargeInvoice, hasInvoice]);

  const triggerAutoUpdate = (currentMap: Record<string, string[]>, currentAmount: number) => {
      if (isInitializing.current || !initialSnapshot) return;
      const mapChanged = initialSnapshot.mapJson !== JSON.stringify(currentMap);
      const amountChanged = Math.abs(initialSnapshot.amount - currentAmount) > 10;
      if (mapChanged || amountChanged) {
          const jobsForCalc = allJobs || [];
          const nextDoc = generateNextDocNo(jobsForCalc, 'NTTK', 5, usedDocNos);
          const today = new Date().toISOString().split('T')[0];
          if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisDocNo: nextDoc, amisDate: today }));
          else { setAmisDocNo(nextDoc); setAmisDate(today); }
      } else {
          if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisDocNo: initialSnapshot.docNo }));
          else setAmisDocNo(initialSnapshot.docNo);
      }
  };

  useEffect(() => {
    if (!isOpen || isInitializing.current) return;
    if (mode === 'extension') {
        let total = 0; const invoices: string[] = []; const jobCodes: string[] = [];
        const mainSelected = selectedExtMap[formData.id] || [];
        (formData.extensions || []).forEach(e => { if (mainSelected.includes(e.id)) { total += e.total; if (e.invoice) invoices.push(e.invoice); } });
        if (mainSelected.length === 0) jobCodes.push(formData.jobCode);
        addedJobs.forEach(j => {
            const jSelected = selectedExtMap[j.id] || []; let hasSelected = false;
            (j.extensions || []).forEach(e => { if (jSelected.includes(e.id)) { total += e.total; if (e.invoice) invoices.push(e.invoice); hasSelected = true; } });
            if (!hasSelected) jobCodes.push(j.jobCode);
        });
        const smartInv = invoices.length > 0 ? invoices.join('+') : 'XXX';
        const smartJobs = jobCodes.length > 0 ? ` BL ${jobCodes.join('+')}` : '';
        const desc = `Thu tiền của KH theo hoá đơn GH ${smartInv}${smartJobs} (KIM)`;
        setNewExtension(prev => ({ ...prev, amisAmount: total, amisDesc: desc }));
        triggerAutoUpdate(selectedExtMap, total);
    } else if (mode === 'local' || mode === 'other') {
        const total = (formData.localChargeTotal || 0) + addedJobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
        const invoices = [formData.localChargeInvoice, ...addedJobs.map(j => j.localChargeInvoice)].filter(Boolean);
        const jobCodes = invoices.length < (addedJobs.length + 1) ? [formData.jobCode, ...addedJobs.map(j => j.jobCode)] : [];
        const smartInv = invoices.length > 0 ? invoices.join('+') : 'XXX';
        const smartJobs = jobCodes.length > 0 ? ` BL ${jobCodes.join('+')}` : '';
        const prefix = mode === 'other' && otherSubMode === 'deposit' ? 'Thu tiền của KH CƯỢC' : 'Thu tiền của KH theo hoá đơn';
        const desc = `${prefix} ${smartInv}${smartJobs} (KIM)`;
        setAmisAmount(total); setAmisDesc(desc);
        triggerAutoUpdate(selectedExtMap, total);
    }
  }, [selectedExtMap, addedJobs, mode, isOpen, otherSubMode]);

  // 3. HANDLERS
  const toggleExtension = (jobId: string, extId: string) => {
      setSelectedExtMap(prev => {
          const current = prev[jobId] || [];
          const next = current.includes(extId) ? current.filter(id => id !== extId) : [...current, extId];
          return { ...prev, [jobId]: next };
      });
  };

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
      if (mode === 'extension') setSelectedExtMap(prev => ({ ...prev, [found.id]: (found.extensions || []).map(e => e.id) }));
      setSearchJobCode('');
  };

  // HANDLERS FOR INSTALLMENTS (ADDITIONAL RECEIPTS)
  const addReceiptRow = () => {
    if (!newReceipt.docNo || !newReceipt.amount) {
        alert("Vui lòng nhập Số chứng từ và Số tiền");
        return;
    }
    const receiptType = mode === 'deposit' ? 'deposit' : mode === 'extension' ? 'extension' : 'local';
    const completeReceipt: AdditionalReceipt = {
        id: Date.now().toString(),
        type: receiptType,
        date: newReceipt.date || new Date().toISOString().split('T')[0],
        docNo: newReceipt.docNo,
        desc: newReceipt.desc || amisDesc,
        amount: Number(newReceipt.amount),
        extensionId: mode === 'extension' ? targetExtensionId || undefined : undefined
    };
    setAdditionalReceipts([...additionalReceipts, completeReceipt]);
    setNewReceipt({ amount: 0, date: new Date().toISOString().split('T')[0], desc: amisDesc, docNo: generateNextDocNo(allJobs || [], 'NTTK') });
    setIsAddingReceipt(false);
  };

  const removeReceiptRow = (id: string) => setAdditionalReceipts(additionalReceipts.filter(r => r.id !== id));

  // 4. SAVE
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'extension') {
        const finalDocNo = newExtension.amisDocNo; const finalDate = newExtension.amisDate; const finalDesc = newExtension.amisDesc;
        const updatedMainExts = (formData.extensions || []).map(ext => {
            if (selectedExtMap[formData.id]?.includes(ext.id)) return { ...ext, amisDocNo: finalDocNo, amisDate: finalDate, amisDesc: finalDesc, amisAmount: ext.total };
            return ext;
        });
        onSave({ ...formData, extensions: updatedMainExts, additionalReceipts });
        addedJobs.forEach(aj => {
            const updatedAjExts = (aj.extensions || []).map(ext => { if (selectedExtMap[aj.id]?.includes(ext.id)) return { ...ext, amisDocNo: finalDocNo, amisDate: finalDate, amisDesc: finalDesc, amisAmount: ext.total }; return ext; });
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
        
        const finalSaveData = { ...formData, ...mainUpdate, additionalReceipts };
        if (mode === 'other') {
            (finalSaveData as any).type = otherSubMode;
        }
        
        onSave(finalSaveData);
        if (addedJobs.length > 0 && !mode.includes('refund')) {
            addedJobs.forEach(aj => onSave({ ...aj, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: aj.localChargeTotal }));
        }
    }
    onClose();
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
  const currentMainAmount = mode === 'extension' ? newExtension.amisAmount : amisAmount;
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
              <div className={`p-2 rounded-lg shadow-sm border ${mode.includes('refund') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}><FileText className="w-5 h-5" /></div>
              <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {mode === 'extension' ? 'Thu Tiền Gia Hạn' : mode === 'other' ? 'Thu Tiền Khác' : mode.includes('refund') ? 'Chi Hoàn Tiền' : 'Thu Tiền'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Job: <span className="font-bold text-blue-700">{formData.jobCode}</span></p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 p-2"><X className="w-5 h-5" /></button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto p-6 bg-slate-50 flex-1 custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. OTHER MODE SUB-SELECTORS */}
            {mode === 'other' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <button 
                        type="button"
                        onClick={() => setOtherSubMode('local')}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${otherSubMode === 'local' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400 hover:border-blue-200'}`}
                    >
                        <Banknote className="w-6 h-6" />
                        <span className="text-xs font-bold uppercase tracking-tight">Phí Dịch Vụ / Local</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setOtherSubMode('deposit')}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${otherSubMode === 'deposit' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-200'}`}
                    >
                        <Anchor className="w-6 h-6" />
                        <span className="text-xs font-bold uppercase tracking-tight">Tiền Cược / Deposit</span>
                    </button>
                </div>
            )}

            {/* 2. CUSTOMER INFO */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <SectionHeader icon={User} title="Thông tin nợ" />
                <div className="grid grid-cols-2 gap-5 mb-4">
                        <div className="relative group">
                            <Label>Mã Đối Tượng</Label>
                            <input type="text" value={custInputVal} onChange={(e) => { setCustInputVal(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mã KH..." autoComplete="off" />
                            {showSuggestions && custInputVal && filteredCustomers.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mt-1 left-0 py-1">
                                    {filteredCustomers.map(c => <li key={c.id} onMouseDown={() => handleSelectCustomer(c)} className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0"><div className="font-bold text-blue-700">{c.code}</div><div className="text-xs text-slate-500 truncate">{c.name}</div></li>)}
                                </ul>
                            )}
                        </div>
                        <div><Label>Tên Đối Tượng</Label><input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-sm text-slate-600 font-medium" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {(!mode.includes('deposit') || mode === 'other') && !mode.includes('local_refund') && (
                        <div className="col-span-1">
                            <div className="flex justify-between items-center mb-1.5">
                                <Label>{hasInvoice ? 'Số Hóa Đơn' : 'Số BL / Ref'}</Label>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const nextStatus = !hasInvoice;
                                        setHasInvoice(nextStatus);
                                        if (!nextStatus) {
                                            setFormData(p => ({ ...p, localChargeInvoice: `REF-BL-${p.jobCode}` }));
                                        } else {
                                            setFormData(p => ({ ...p, localChargeInvoice: '' }));
                                        }
                                    }}
                                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                >
                                    {hasInvoice ? 'Chưa có HĐ' : 'Có HĐ'}
                                </button>
                            </div>
                            <input 
                                type="text" 
                                required 
                                value={display.currentInvoice} 
                                onChange={(e) => mode === 'extension' ? setNewExtension(p => ({...p, invoice: e.target.value})) : setFormData(p => ({...p, localChargeInvoice: e.target.value}))} 
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!hasInvoice ? 'bg-orange-50 border-orange-200 italic' : 'border-slate-200'}`} 
                                placeholder={hasInvoice ? "Nhập số hóa đơn..." : "Nhập số BL hoặc Ref..."}
                            />
                        </div>
                    )}
                    <div className={(mode.includes('deposit') && mode !== 'other') || mode.includes('local_refund') ? "col-span-2" : "col-span-1"}><Label>Tổng Thực Thu (Dự tính)</Label><div className="p-2 bg-slate-100 rounded-lg text-base font-bold text-slate-700 text-right border">{new Intl.NumberFormat('en-US').format(display.currentTotalReceivable)} VND</div></div>
                </div>
            </div>

            {/* 3. TABS: MERGE vs INSTALLMENTS */}
            {!mode.includes('refund') && (
                <div className="border-b flex space-x-6">
                    <button type="button" onClick={() => setActiveTab('merge')} className={`pb-2 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${activeTab === 'merge' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Layers className="w-4 h-4" /> <span>Gộp Job & Chọn dòng</span></button>
                    <button type="button" onClick={() => setActiveTab('installments')} className={`pb-2 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${activeTab === 'installments' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><History className="w-4 h-4" /> <span>Thu Nhiều Lần (Installments)</span></button>
                </div>
            )}

            {/* TAB CONTENT 1: MERGE */}
            {activeTab === 'merge' && !mode.includes('refund') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-600 uppercase mb-3 flex items-center"><Link className="w-4 h-4 mr-2" /> Thêm Job để gộp thu</h3>
                        <div className="flex gap-2 mb-4"><input type="text" placeholder="Nhập Job Code..." value={searchJobCode} onChange={e => setSearchJobCode(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /><button type="button" onClick={handleAddJobToMerge} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all hover:bg-blue-700 shadow-sm active:scale-95">+ Thêm Job</button></div>
                        <div className="space-y-3">
                            <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm"><span className="font-bold text-blue-700 flex items-center mb-2"><Box className="w-3.5 h-3.5 mr-1.5" /> {formData.jobCode} (Gốc)</span>{mode === 'extension' && (formData.extensions || []).length > 0 ? (<div className="space-y-1 pl-2 border-l-2 border-blue-100">{formData.extensions.map(ext => (<button key={ext.id} type="button" onClick={() => toggleExtension(formData.id, ext.id)} className="flex items-center w-full text-left p-1.5 hover:bg-blue-50 rounded transition-colors group">{selectedExtMap[formData.id]?.includes(ext.id) ? <CheckSquare className="w-4 h-4 mr-2 text-blue-600" /> : <Square className="w-4 h-4 mr-2 text-slate-300" />}<span className="text-xs font-medium text-slate-700 flex-1">HĐ: {ext.invoice || 'N/A'}</span><span className="text-xs font-bold text-slate-500">{new Intl.NumberFormat('en-US').format(ext.total)}</span></button>))}</div>) : mode === 'extension' ? <div className="text-[10px] text-slate-400 italic pl-2">Không có dòng gia hạn</div> : null}</div>
                            {addedJobs.map(j => (<div key={j.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group animate-in slide-in-from-right-2"><button type="button" onClick={() => setAddedJobs(prev => prev.filter(x => x.id !== j.id))} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5"/></button><span className="font-bold text-slate-700 flex items-center mb-2"><Box className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {j.jobCode}</span>{mode === 'extension' && (j.extensions || []).length > 0 ? (<div className="space-y-1 pl-2 border-l-2 border-slate-100">{j.extensions.map(ext => (<button key={ext.id} type="button" onClick={() => toggleExtension(j.id, ext.id)} className="flex items-center w-full text-left p-1.5 hover:bg-slate-50 rounded transition-colors">{selectedExtMap[j.id]?.includes(ext.id) ? <CheckSquare className="w-4 h-4 mr-2 text-blue-600" /> : <Square className="w-4 h-4 mr-2 text-slate-300" />}<span className="text-xs font-medium text-slate-700 flex-1">HĐ: {ext.invoice || 'N/A'}</span><span className="text-xs font-bold text-slate-500">{new Intl.NumberFormat('en-US').format(ext.total)}</span></button>))}</div>) : mode === 'extension' ? <div className="text-[10px] text-slate-400 italic pl-2">Không có dòng gia hạn</div> : null}</div>))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: INSTALLMENTS (FULL VERSION) */}
            {activeTab === 'installments' && !mode.includes('refund') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <SectionHeader icon={History} title="Lịch sử thu nhiều lần" rightContent={<button type="button" onClick={() => setIsAddingReceipt(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all">+ Thêm lần thu</button>} color="text-emerald-700" />
                        
                        <div className="space-y-3 mt-4">
                            {additionalReceipts.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 italic text-xs bg-white/50 rounded-lg border border-dashed border-slate-200">Chưa ghi nhận lần thu nào thêm.</div>
                            ) : (
                                <div className="overflow-hidden border border-slate-200 rounded-lg">
                                    <table className="w-full text-xs text-left bg-white">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                                            <tr>
                                                <th className="px-3 py-2">Ngày</th>
                                                <th className="px-3 py-2">Số CT</th>
                                                <th className="px-3 py-2 text-right">Số tiền</th>
                                                <th className="px-3 py-2 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {additionalReceipts.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2 font-medium">{formatDateVN(r.date)}</td>
                                                    <td className="px-3 py-2 font-bold text-blue-700">{r.docNo}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{new Intl.NumberFormat('en-US').format(r.amount)}</td>
                                                    <td className="px-3 py-2 text-center"><button type="button" onClick={() => removeReceiptRow(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-emerald-50 font-bold border-t border-emerald-100">
                                            <tr>
                                                <td colSpan={2} className="px-3 py-2 text-right text-emerald-800">Cộng dồn:</td>
                                                <td className="px-3 py-2 text-right text-emerald-800">{new Intl.NumberFormat('en-US').format(additionalReceipts.reduce((s, r) => s + r.amount, 0))}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal con để thêm lần thu */}
                        {isAddingReceipt && (
                            <div className="mt-4 p-4 bg-white border border-emerald-200 rounded-xl shadow-md animate-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div><Label>Ngày thu</Label><DateInput value={newReceipt.date || ''} onChange={val => setNewReceipt({...newReceipt, date: val})} /></div>
                                    <div><Label>Số CT (Amis)</Label><input type="text" value={newReceipt.docNo} onChange={e => setNewReceipt({...newReceipt, docNo: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-blue-700 outline-none focus:ring-1 focus:ring-emerald-500" /></div>
                                </div>
                                <div className="mb-3"><Label>Số tiền thu lần này</Label><input type="text" value={newReceipt.amount ? new Intl.NumberFormat('en-US').format(newReceipt.amount) : ''} onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setNewReceipt({...newReceipt, amount: val}); }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-right text-emerald-700 outline-none" /></div>
                                <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsAddingReceipt(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Hủy</button><button type="button" onClick={addReceiptRow} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm">Xác nhận lần thu</button></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. SUMMARY SLIP (AMIS READY) */}
            <div className="bg-white rounded-xl border-2 border-blue-100 shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex justify-between items-center"><h3 className="text-sm font-bold text-blue-800 flex items-center uppercase"><Receipt className="w-4 h-4 mr-2" /> Tổng hợp phiếu {mode.includes('refund') ? 'chi' : 'thu'}</h3><span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold">AMIS READY</span></div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                        <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={val => mode === 'extension' ? setNewExtension(p => ({...p, amisDate: val})) : setAmisDate(val)} /></div>
                        <div><Label>Số Chứng Từ (AMIS)</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={e => mode === 'extension' ? setNewExtension(p => ({...p, amisDocNo: e.target.value})) : setAmisDocNo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    </div>
                    <div><Label>Tổng tiền thực {mode.includes('refund') ? 'chi' : 'thu'}</Label><div className="relative"><input type="text" value={new Intl.NumberFormat('en-US').format(currentMainAmount)} readOnly className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xl font-bold text-right text-blue-800 outline-none" /><div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Calculator className="w-5 h-5" /></div></div></div>
                    <div><Label>Diễn giải thông minh (Tự động gom HĐ)</Label><textarea value={mode === 'extension' ? newExtension.amisDesc : amisDesc} onChange={e => mode === 'extension' ? setNewExtension(p => ({...p, amisDesc: e.target.value})) : setAmisDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white font-medium" /></div>
                </div>
            </div>

            </form>
        </div>

        {/* FOOTER */}
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
