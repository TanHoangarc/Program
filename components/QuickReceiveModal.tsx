
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, User, RotateCcw, Plus, Trash2, ChevronDown, History, Receipt, Link, Layers, List, ToggleLeft, ToggleRight } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo, calculatePaymentStatus } from '../utils';

export type ReceiveMode = 'local' | 'local_refund' | 'deposit' | 'deposit_refund' | 'extension' | 'other';

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
          if (mode === 'local' || mode === 'other') {
              const currentDoc = deepCopyJob.amisLcDocNo;
              if (currentDoc) {
                  foundMergedJobs = allJobs.filter(j => j.id !== deepCopyJob.id && j.amisLcDocNo === currentDoc);
              }
          }
          else if (mode === 'extension') {
              const exts = deepCopyJob.extensions || [];
              let targetDoc = '';
              if (targetExtensionId) {
                  const t = exts.find((e: any) => e.id === targetExtensionId);
                  if (t) targetDoc = t.amisDocNo;
              } else if (exts.length > 0) {
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

      // Reset Tab logic
      if (foundMergedJobs.length > 0) {
          setActiveTab('merge');
      } else if ((deepCopyJob.additionalReceipts || []).length > 0) {
          setActiveTab('installments');
      } else {
          setActiveTab('merge');
      }

      let initialCustId = '';
      if (mode === 'local' || mode === 'other' || mode === 'local_refund') initialCustId = deepCopyJob.customerId;
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
          setAmisDesc(deepCopyJob.amisLcDesc || `Thu tiền của KH theo hoá đơn ${deepCopyJob.localChargeInvoice || 'XXX'} (KIM)`);
      } 
      else if (mode === 'local_refund') {
          setAmisDocNo(deepCopyJob.amisLcRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC'));
          setAmisDate(deepCopyJob.amisLcRefundDate || new Date().toISOString().split('T')[0]);
          setAmisDesc(deepCopyJob.amisLcRefundDesc || `Chi hoàn tiền thanh toán dư Local Charge BL ${deepCopyJob.jobCode}`);
          
          // Auto-fill overpayment amount if any
          const status = calculatePaymentStatus(deepCopyJob);
          setAmisAmount(deepCopyJob.amisLcRefundAmount || (status.lcDiff > 0 ? status.lcDiff : 0));
      }
      else if (mode === 'other') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          const inv = deepCopyJob.localChargeInvoice || 'XXX';
          setAmisDesc(deepCopyJob.amisLcDesc || `Thu tiền của KH theo hoá đơn ${inv} (LH MB)`);
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
          if (targetExtensionId) targetExt = exts.find((e: any) => e.id === targetExtensionId);
          else if (exts.length > 0) targetExt = exts[0];

          if (targetExt) {
             setInternalTargetId(targetExt.id);
             setNewExtension({ 
                customerId: targetExt.customerId || deepCopyJob.customerId || '', 
                invoice: targetExt.invoice || '', 
                date: targetExt.invoiceDate || new Date().toISOString().split('T')[0],
                total: targetExt.total || 0,
                amisDocNo: targetExt.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra),
                amisDesc: targetExt.amisDesc || (targetExt.invoice ? `Thu tiền của KH theo hoá đơn GH ${targetExt.invoice} (KIM)` : `Thu tiền của KH theo hoá đơn GH XXX BL ${deepCopyJob.jobCode} (KIM)`),
                amisAmount: targetExt.amisAmount !== undefined ? targetExt.amisAmount : (targetExt.total || 0),
                amisDate: targetExt.invoiceDate || new Date().toISOString().split('T')[0]
             });
          }
      }
    }
  }, [isOpen, job, mode, customers, targetExtensionId, allJobs, usedDocNos]);

  // Auto-sum logic for MERGE MODE
  useEffect(() => {
      if (activeTab === 'merge' && isOpen) {
          const mainTotal = mode === 'extension' ? (newExtension.total || 0) : (formData.localChargeTotal || 0);
          const addedTotal = addedJobs.reduce((sum, j) => sum + (mode === 'extension' ? (j.extensions || []).reduce((s, e) => s + e.total, 0) : (j.localChargeTotal || 0)), 0);
          const finalTotal = mainTotal + addedTotal;
          if (mode === 'extension') setNewExtension(prev => ({...prev, amisAmount: finalTotal}));
          else if (mode !== 'local_refund' && mode !== 'deposit_refund') setAmisAmount(finalTotal);
      }
  }, [addedJobs, activeTab, mode, formData.localChargeTotal, newExtension.total, isOpen]);

  const handleAmountChange = (val: number) => {
      if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisAmount: val }));
      else setAmisAmount(val);
  };

  const handleMainDateChange = (val: string) => {
      if (mode === 'extension') setNewExtension(prev => ({ ...prev, amisDate: val }));
      else setAmisDate(val);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'extension') {
      const addedTotal = addedJobs.reduce((sum, j) => sum + (j.extensions || []).reduce((s, e) => s + e.total, 0), 0);
      const mainAmount = newExtension.amisAmount - addedTotal;
      let updatedExtensions = (formData.extensions || []).map(ext => ext.id === internalTargetId ? { ...ext, customerId: newExtension.customerId, invoice: newExtension.invoice, invoiceDate: newExtension.date, total: newExtension.total, amisDocNo: newExtension.amisDocNo, amisDesc: newExtension.amisDesc, amisAmount: mainAmount } : ext);
      onSave({ ...formData, extensions: updatedExtensions, additionalReceipts: additionalReceipts });
      if (addedJobs.length > 0) addedJobs.forEach(addedJob => onSave({ ...addedJob, extensions: (addedJob.extensions || []).map(ext => ({ ...ext, amisDocNo: newExtension.amisDocNo, amisDesc: newExtension.amisDesc, amisAmount: ext.total })) }));
    } 
    else if (mode === 'local' || mode === 'other') {
        const addedTotal = addedJobs.reduce((sum, j) => sum + (j.localChargeTotal || 0), 0);
        onSave({ ...formData, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: amisAmount - addedTotal, localChargeDate: amisDate, additionalReceipts: additionalReceipts });
        if (addedJobs.length > 0) addedJobs.forEach(addedJob => onSave({ ...addedJob, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: addedJob.localChargeTotal }));
    }
    else if (mode === 'local_refund') {
        onSave({ ...formData, amisLcRefundDocNo: amisDocNo, amisLcRefundDesc: amisDesc, amisLcRefundAmount: amisAmount, amisLcRefundDate: amisDate });
    }
    else if (mode === 'deposit') {
        onSave({ ...formData, amisDepositDocNo: amisDocNo, amisDepositDesc: amisDesc, amisDepositAmount: amisAmount, ngayThuCuoc: amisDate, additionalReceipts: additionalReceipts });
    }
    else if (mode === 'deposit_refund') {
        onSave({ ...formData, amisDepositRefundDocNo: amisDocNo, amisDepositRefundDesc: amisDesc, amisDepositRefundDate: amisDate, ngayThuHoan: amisDate });
    }
    onClose();
  };

  const getDisplayValues = () => {
    let currentTotalReceivable = 0; let currentCustomer = ''; let currentInvoice = '';
    if (mode === 'local' || mode === 'other' || mode === 'local_refund') { currentInvoice = formData.localChargeInvoice || ''; currentTotalReceivable = formData.localChargeTotal || 0; currentCustomer = formData.customerId || ''; }
    else if (mode === 'deposit' || mode === 'deposit_refund') { currentTotalReceivable = formData.thuCuoc || 0; currentCustomer = formData.maKhCuocId || ''; currentInvoice = 'N/A'; }
    else if (mode === 'extension') { currentInvoice = newExtension.invoice; currentTotalReceivable = newExtension.total; currentCustomer = newExtension.customerId; }
    const customerName = customers.find(c => c.id === currentCustomer || c.code === currentCustomer)?.name || '';
    return { currentTotalReceivable, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200">
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl ${mode.includes('refund') ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg shadow-sm border ${mode.includes('refund') ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {mode.includes('refund') ? <RotateCcw className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{mode === 'local_refund' ? 'Chi Hoàn Local Charge' : (mode === 'deposit_refund' ? 'Chi Hoàn Cược' : (mode === 'local' ? 'Thu Local Charge' : (mode === 'extension' ? 'Thu Gia Hạn' : 'Thu Khác')))}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Job: <span className="font-bold text-blue-700">{job.jobCode}</span></p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50 flex-1">
            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide"><User className="w-4 h-4 text-slate-500 mr-2" /> Thông tin đối tượng</h3>
                    <div className="grid grid-cols-2 gap-5">
                        <div><Label>Mã Đối Tượng</Label><input type="text" value={custInputVal} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold" /></div>
                        <div><Label>Tên Đối Tượng</Label><input type="text" value={display.customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium" /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
                    <div className={`${mode.includes('refund') ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'} px-5 py-3 border-b flex justify-between items-center`}>
                        <h3 className={`text-sm font-bold flex items-center uppercase ${mode.includes('refund') ? 'text-red-800' : 'text-blue-800'}`}>
                            <Receipt className="w-4 h-4 mr-2" /> {mode.includes('refund') ? 'Phiếu Chi (AMIS)' : 'Phiếu Thu (AMIS)'}
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-5">
                            <div><Label>Ngày Chứng Từ</Label><DateInput value={mode === 'extension' ? newExtension.amisDate : amisDate} onChange={handleMainDateChange} /></div>
                            <div><Label>Số Chứng Từ</Label><input type="text" value={mode === 'extension' ? newExtension.amisDocNo : amisDocNo} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDocNo: e.target.value})); else setAmisDocNo(e.target.value); }} className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:outline-none ${mode.includes('refund') ? 'text-red-700 focus:ring-red-500' : 'text-blue-800 focus:ring-blue-500'}`} /></div>
                        </div>
                        <div>
                            <Label>Số tiền</Label>
                            <div className="relative">
                                <input type="text" value={amisAmount ? new Intl.NumberFormat('en-US').format(amisAmount) : ''} onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleAmountChange(val); }} className={`w-full pl-4 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold text-right focus:ring-2 focus:outline-none ${mode.includes('refund') ? 'text-red-700 focus:ring-red-500' : 'text-blue-700 focus:ring-blue-500'}`} />
                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                            </div>
                        </div>
                        <div><Label>Diễn giải</Label><textarea value={mode === 'extension' ? newExtension.amisDesc : amisDesc} onChange={(e) => { if(mode === 'extension') setNewExtension(prev => ({...prev, amisDesc: e.target.value})); else setAmisDesc(e.target.value); }} rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none" /></div>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
            <button onClick={handleSave} className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-md hover:shadow-lg transition-all transform active:scale-95 ${mode.includes('refund') ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}><Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
