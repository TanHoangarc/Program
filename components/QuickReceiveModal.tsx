
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, User, RotateCcw, Plus, Trash2, ChevronDown, History, Receipt, Link, Layers, List, ToggleLeft, ToggleRight, Search, Check, AlertCircle } from 'lucide-react';
import { JobData, Customer, AdditionalReceipt, ExtensionData } from '../types';
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
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{children}</label>
);

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers, allJobs, targetExtensionId, usedDocNos = []
}) => {
  const [formData, setFormData] = useState<JobData>(job);
  const [activeTab, setActiveTab] = useState<'single' | 'merge'>('single');

  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');
  const [amisAmount, setAmisAmount] = useState(0); 
  const [amisDate, setAmisDate] = useState('');

  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobTerm, setSearchJobTerm] = useState('');
  const [selectedExtIds, setSelectedExtIds] = useState<Set<string>>(new Set());
  const [custInputVal, setCustInputVal] = useState('');

  // 1. Khởi tạo dữ liệu và KHÔI PHỤC TRẠNG THÁI GỘP KHI CHỈNH SỬA
  useEffect(() => {
    if (isOpen) {
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      setFormData(deepCopyJob);

      let initialCustId = '';
      if (mode === 'local' || mode === 'other' || mode === 'local_refund') initialCustId = deepCopyJob.customerId;
      else if (mode === 'deposit' || mode === 'deposit_refund') initialCustId = deepCopyJob.maKhCuocId;
      else if (mode === 'extension') initialCustId = deepCopyJob.customerId;

      const foundCust = customers.find(c => c.id === initialCustId);
      setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

      const jobsForCalc = allJobs || [];
      const extra = usedDocNos || [];
      let currentDoc = '';

      // Tự động chọn dòng gia hạn đích
      if (mode === 'extension') {
          const exts = deepCopyJob.extensions || [];
          const target = targetExtensionId ? exts.find((e: any) => e.id === targetExtensionId) : null;
          currentDoc = target?.amisDocNo || '';

          if (currentDoc) {
              // CHẾ ĐỘ CHỈNH SỬA: Tìm tất cả Job và Dòng có chung số chứng từ
              const othersWithSameDoc = (allJobs || []).filter(j => 
                (j.extensions || []).some(ext => ext.amisDocNo === currentDoc)
              );
              
              const siblingJobs = othersWithSameDoc.filter(j => j.id !== deepCopyJob.id);
              const allMatchingExtIds = othersWithSameDoc.flatMap(j => 
                (j.extensions || []).filter(ext => ext.amisDocNo === currentDoc).map(ext => ext.id)
              );

              setAddedJobs(siblingJobs);
              setSelectedExtIds(new Set(allMatchingExtIds));
              if (siblingJobs.length > 0) setActiveTab('merge');
          } else {
              // CHẾ ĐỘ THÊM MỚI
              if (targetExtensionId) setSelectedExtIds(new Set([targetExtensionId]));
              else if (exts.length > 0) {
                  const pendingIds = exts.filter((e: any) => !e.amisDocNo).map((e: any) => e.id);
                  setSelectedExtIds(new Set(pendingIds.length > 0 ? pendingIds : [exts[0].id]));
              }
          }
      }

      // Cấu hình chứng từ dựa trên mode
      if (mode === 'local' || mode === 'other') {
          const doc = deepCopyJob.amisLcDocNo;
          setAmisDocNo(doc || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisLcAmount !== undefined ? deepCopyJob.amisLcAmount : (deepCopyJob.localChargeTotal || 0));
          setAmisDate(deepCopyJob.localChargeDate || new Date().toISOString().split('T')[0]);
          
          if (doc && allJobs) {
              const siblings = allJobs.filter(j => j.id !== deepCopyJob.id && j.amisLcDocNo === doc);
              if (siblings.length > 0) { setAddedJobs(siblings); setActiveTab('merge'); }
          }
      } 
      else if (mode === 'local_refund') {
          setAmisDocNo(deepCopyJob.amisLcRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC'));
          setAmisDate(deepCopyJob.amisLcRefundDate || new Date().toISOString().split('T')[0]);
          const status = calculatePaymentStatus(deepCopyJob);
          setAmisAmount(deepCopyJob.amisLcRefundAmount || (status.lcDiff > 0 ? status.lcDiff : 0));
      }
      else if (mode === 'deposit') {
          const doc = deepCopyJob.amisDepositDocNo;
          setAmisDocNo(doc || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisAmount(deepCopyJob.amisDepositAmount !== undefined ? deepCopyJob.amisDepositAmount : (deepCopyJob.thuCuoc || 0));
          setAmisDate(deepCopyJob.ngayThuCuoc || new Date().toISOString().split('T')[0]);
          
          if (doc && allJobs) {
            const siblings = allJobs.filter(j => j.id !== deepCopyJob.id && j.amisDepositDocNo === doc);
            if (siblings.length > 0) { setAddedJobs(siblings); setActiveTab('merge'); }
          }
      } 
      else if (mode === 'deposit_refund') {
          setAmisDocNo(deepCopyJob.amisDepositRefundDocNo || generateNextDocNo(jobsForCalc, 'UNC')); 
          setAmisDate(deepCopyJob.ngayThuHoan || new Date().toISOString().split('T')[0]);
          setAmisAmount(deepCopyJob.thuCuoc || 0); 
      }
      else if (mode === 'extension') {
          const exts = deepCopyJob.extensions || [];
          const target = targetExtensionId ? exts.find((e: any) => e.id === targetExtensionId) : (exts.length > 0 ? exts[0] : null);
          setAmisDocNo(currentDoc || target?.amisDocNo || generateNextDocNo(jobsForCalc, 'NTTK', 5, extra));
          setAmisDate(target?.invoiceDate || new Date().toISOString().split('T')[0]);
      }
    }
  }, [isOpen, job, mode, customers, targetExtensionId, allJobs, usedDocNos]);

  // 2. Tự động tính toán Số tiền và Diễn giải
  useEffect(() => {
      if (!isOpen) return;

      let total = 0;
      const allInvolvedJobs = [formData, ...addedJobs];
      
      if (mode === 'extension') {
          total = allInvolvedJobs.reduce((sum, j) => {
              const selectedInJob = (j.extensions || []).filter(ext => selectedExtIds.has(ext.id));
              return sum + selectedInJob.reduce((s, ext) => s + ext.total, 0);
          }, 0);
      } else {
          total = (formData.localChargeTotal || 0) + addedJobs.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
      }
      
      if (mode !== 'local_refund' && mode !== 'deposit_refund') {
          setAmisAmount(total);
      }

      const jobsWithSelection = mode === 'extension' 
          ? allInvolvedJobs.filter(j => (j.extensions || []).some(ext => selectedExtIds.has(ext.id)))
          : allInvolvedJobs;

      const allCodes = jobsWithSelection.map(j => j.jobCode).filter(Boolean);
      const codesStr = allCodes.join('+');
      const suffix = '(KIM)';
      
      if (mode === 'extension') {
          const allInvoices = allInvolvedJobs.flatMap(j => 
              (j.extensions || [])
                  .filter(ext => selectedExtIds.has(ext.id))
                  .map(ext => ext.invoice)
          ).filter(Boolean);
          
          const uniqueInvoices = Array.from(new Set(allInvoices));
          if (uniqueInvoices.length > 0) {
              const invStr = uniqueInvoices.join('+');
              setAmisDesc(`Thu tiền của KH theo hoá đơn GH ${invStr} ${suffix}`);
          } else {
              setAmisDesc(`Thu tiền của KH theo hoá đơn GH XXX BL ${codesStr} ${suffix}`);
          }
      } else if (mode === 'local' || mode === 'other') {
          setAmisDesc(`Thu tiền của KH theo hoá đơn ${formData.localChargeInvoice || 'XXX'} BL ${codesStr} ${suffix}`);
      } else if (mode === 'local_refund') {
          setAmisDesc(`Chi hoàn tiền thanh toán dư Local Charge BL ${codesStr}`);
      } else if (mode === 'deposit') {
          setAmisDesc(`Thu tiền của KH CƯỢC CONT BL ${codesStr}`);
      } else if (mode === 'deposit_refund') {
          setAmisDesc(`Chi tiền cho KH HOÀN CƯỢC BL ${codesStr}`);
      }

  }, [addedJobs, selectedExtIds, formData, mode, isOpen]);

  const handleAddJobToMerge = (j: JobData) => {
      if (j.id === formData.id) return;
      if (addedJobs.some(x => x.id === j.id)) return;
      
      if (mode === 'extension') {
          const newIds = new Set(selectedExtIds);
          (j.extensions || []).forEach(ext => { if(!ext.amisDocNo) newIds.add(ext.id); });
          setSelectedExtIds(newIds);
      }

      setAddedJobs(prev => [...prev, j]);
      setSearchJobTerm('');
  };

  const handleRemoveJobFromMerge = (id: string) => {
      const targetJob = addedJobs.find(j => j.id === id);
      if (targetJob && mode === 'extension') {
          const next = new Set(selectedExtIds);
          (targetJob.extensions || []).forEach(ext => next.delete(ext.id));
          setSelectedExtIds(next);
      }
      setAddedJobs(prev => prev.filter(j => j.id !== id));
  };

  const toggleExtSelection = (id: string) => {
      setSelectedExtIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'extension') {
        const updatedMainExtensions = (formData.extensions || []).map(ext => {
            if (selectedExtIds.has(ext.id)) {
                return { ...ext, amisDocNo, amisDesc, amisAmount: ext.total, invoiceDate: amisDate };
            }
            return ext;
        });
        onSave({ ...formData, extensions: updatedMainExtensions });

        addedJobs.forEach(j => {
            const updatedExts = (j.extensions || []).map(ext => {
                if (selectedExtIds.has(ext.id)) {
                    return { ...ext, amisDocNo, amisDesc, amisAmount: ext.total, invoiceDate: amisDate };
                }
                return ext;
            });
            onSave({ ...j, extensions: updatedExts });
        });
    } 
    else if (mode === 'local' || mode === 'other') {
        onSave({ ...formData, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: formData.localChargeTotal, localChargeDate: amisDate });
        addedJobs.forEach(j => onSave({ ...j, amisLcDocNo: amisDocNo, amisLcDesc: amisDesc, amisLcAmount: j.localChargeTotal, localChargeDate: amisDate }));
    }
    else if (mode === 'local_refund') {
        onSave({ ...formData, amisLcRefundDocNo: amisDocNo, amisLcRefundDesc: amisDesc, amisLcRefundAmount: amisAmount, amisLcRefundDate: amisDate });
    }
    else if (mode === 'deposit') {
        onSave({ ...formData, amisDepositDocNo: amisDocNo, amisDepositDesc: amisDesc, amisDepositAmount: formData.thuCuoc, ngayThuCuoc: amisDate });
        addedJobs.forEach(j => onSave({ ...j, amisDepositDocNo: amisDocNo, amisDepositDesc: amisDesc, amisDepositAmount: j.thuCuoc, ngayThuCuoc: amisDate }));
    }
    else if (mode === 'deposit_refund') {
        onSave({ ...formData, amisDepositRefundDocNo: amisDocNo, amisDepositRefundDesc: amisDesc, amisDepositRefundDate: amisDate, ngayThuHoan: amisDate });
    }
    onClose();
  };

  const searchResults = useMemo(() => {
      if (!searchJobTerm || !allJobs) return [];
      const term = searchJobTerm.toLowerCase().trim();
      return allJobs.filter(j => 
        j.id !== formData.id && 
        !addedJobs.some(added => added.id === j.id) &&
        (String(j.jobCode || '').toLowerCase().includes(term) || String(j.booking || '').toLowerCase().includes(term))
      ).slice(0, 5);
  }, [searchJobTerm, allJobs, addedJobs, formData.id]);

  const customerName = customers.find(c => c.id === formData.customerId || c.code === formData.customerId)?.name || '';

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center ${mode.includes('refund') ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-2.5 rounded-2xl shadow-sm border ${mode.includes('refund') ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {mode.includes('refund') ? <RotateCcw className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  {mode === 'extension' ? 'Thu Gia Hạn' : (mode === 'local' ? 'Thu Local Charge' : (mode.includes('refund') ? 'Chi Hoàn Tiền' : 'Thu Cược'))}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 font-bold uppercase">Main Job:</span>
                    <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs font-black text-blue-700">{job.jobCode}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            <button onClick={() => setActiveTab('single')} className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'single' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <FileText className="w-4 h-4" /> Thu một Job
            </button>
            <button onClick={() => setActiveTab('merge')} className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'merge' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Layers className="w-4 h-4" /> Thu gộp nhiều Job
            </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50/30 flex-1 space-y-6">
            
            {/* SEARCH & MERGE LIST */}
            {activeTab === 'merge' && (
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm animate-in fade-in duration-200">
                    <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Thêm Job để gộp
                    </h3>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" value={searchJobTerm} onChange={e => setSearchJobTerm(e.target.value)} placeholder="Nhập mã Job hoặc Booking..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                            {searchResults.length > 0 && (
                                <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-2 py-1 overflow-hidden">
                                    {searchResults.map(res => (
                                        <li key={res.id} onClick={() => handleAddJobToMerge(res)} className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0">
                                            <div className="flex flex-col"><span className="font-bold text-slate-800 text-sm">{res.jobCode}</span><span className="text-[10px] text-slate-500">Booking: {res.booking}</span></div>
                                            <span className="text-xs font-bold text-blue-600">Chọn</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="space-y-3">
                            {addedJobs.map(j => (
                                <div key={j.id} className="bg-white border border-blue-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md border-l-4 border-l-blue-500">
                                    <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center">
                                        <span className="text-sm font-black text-blue-700">{j.jobCode}</span>
                                        <button onClick={() => handleRemoveJobFromMerge(j.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                                    </div>
                                    {mode === 'extension' ? (
                                        <div className="p-3 space-y-2">
                                            {(j.extensions || []).map(ext => (
                                                <div key={ext.id} onClick={() => toggleExtSelection(ext.id)} className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${selectedExtIds.has(ext.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedExtIds.has(ext.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                                            {selectedExtIds.has(ext.id) && <Check className="w-3 h-3" />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-700">HĐ: {ext.invoice || 'N/A'}</span>
                                                    </div>
                                                    <span className={`text-[11px] font-black ${selectedExtIds.has(ext.id) ? 'text-blue-700' : 'text-slate-400'}`}>{new Intl.NumberFormat('en-US').format(ext.total)} đ</span>
                                                </div>
                                            ))}
                                            {(j.extensions || []).length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-1">Không có dòng gia hạn</p>}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 flex justify-between text-[11px]">
                                            <span className="text-slate-500">Local Charge:</span>
                                            <span className="font-bold text-blue-700">{new Intl.NumberFormat('en-US').format(j.localChargeTotal)} đ</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CHỌN DÒNG JOB CHÍNH */}
            {mode === 'extension' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <List className="w-4 h-4" /> Chọn hóa đơn gia hạn của Job chính
                    </h3>
                    <div className="space-y-2">
                        {(formData.extensions || []).map((ext) => (
                            <div key={ext.id} onClick={() => toggleExtSelection(ext.id)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group ${selectedExtIds.has(ext.id) ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-200 bg-slate-50/50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedExtIds.has(ext.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                                        {selectedExtIds.has(ext.id) && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex flex-col"><span className="text-xs font-black text-slate-800">HĐ: {ext.invoice || 'N/A'}</span><span className="text-[10px] text-slate-500">Ngày: {formatDateVN(ext.invoiceDate)}</span></div>
                                </div>
                                <span className={`text-sm font-black ${selectedExtIds.has(ext.id) ? 'text-blue-700' : 'text-slate-400'}`}>{new Intl.NumberFormat('en-US').format(ext.total)} đ</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ĐỐI TƯỢNG HẠCH TOÁN */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center uppercase tracking-wide"><User className="w-4 h-4 text-slate-500 mr-2" /> Đối tượng hạch toán</h3>
                <div className="grid grid-cols-2 gap-5">
                    <div><Label>Mã Đối Tượng</Label><input type="text" value={custInputVal} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-700" /></div>
                    <div><Label>Tên Đối Tượng</Label><input type="text" value={customerName} readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-medium" /></div>
                </div>
            </div>

            {/* CHỨNG TỪ AMIS */}
            <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-lg relative overflow-hidden">
                <div className={`${mode.includes('refund') ? 'bg-red-600' : 'bg-blue-700'} px-5 py-3 border-b flex justify-between items-center text-white`}>
                    <h3 className="text-xs font-black flex items-center uppercase tracking-widest">
                        <FileText className="w-4 h-4 mr-2" /> {mode.includes('refund') ? 'Phiếu Chi (UNC)' : 'Phiếu Thu (NTTK)'}
                    </h3>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div><Label>Ngày Chứng Từ</Label><DateInput value={amisDate} onChange={setAmisDate} /></div>
                        <div><Label>Số Chứng Từ</Label><input type="text" value={amisDocNo} onChange={(e) => setAmisDocNo(e.target.value)} className={`w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-black focus:ring-2 focus:outline-none ${mode.includes('refund') ? 'text-red-700 focus:ring-red-500' : 'text-blue-800 focus:ring-blue-500'}`} /></div>
                    </div>
                    <div>
                        <Label>Tổng số tiền hạch toán</Label>
                        <div className="relative">
                            <input type="text" value={amisAmount ? new Intl.NumberFormat('en-US').format(amisAmount) : ''} onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) setAmisAmount(val); }} className={`w-full pl-5 pr-14 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-2xl font-black text-right focus:ring-4 focus:outline-none transition-all ${mode.includes('refund') ? 'text-red-700 focus:ring-red-500/20 focus:border-red-500' : 'text-blue-700 focus:ring-blue-500/20 focus:border-blue-500'}`} />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">VND</span>
                        </div>
                    </div>
                    <div>
                        <Label>Diễn giải</Label>
                        <textarea value={amisDesc} onChange={(e) => setAmisDesc(e.target.value)} rows={3} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-medium text-slate-700 resize-none focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed" />
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end space-x-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-black text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">Hủy bỏ</button>
            <button onClick={handleSave} disabled={mode === 'extension' && selectedExtIds.size === 0} className={`px-8 py-2.5 rounded-xl text-sm font-black text-white shadow-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${mode.includes('refund') ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-700 hover:bg-blue-800 shadow-blue-500/20'}`}>
                <Save className="w-4 h-4 mr-2 inline" /> Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

