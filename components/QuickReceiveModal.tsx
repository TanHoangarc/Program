
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, DollarSign, Calendar, CreditCard, FileText, User, CheckCircle, Wallet, RotateCcw, Plus, Search, Trash2, ChevronDown } from 'lucide-react';
import { JobData, Customer } from '../types';
import { formatDateVN, parseDateVN } from '../utils';

export type ReceiveMode = 'local' | 'deposit' | 'deposit_refund' | 'extension' | 'other';

interface QuickReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobData) => void;
  job: JobData;
  mode: ReceiveMode;
  customers: Customer[];
  allJobs?: JobData[];
  targetExtensionId?: string | null; // NEW PROP
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

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers, allJobs, targetExtensionId
}) => {
  // Main form data is the job itself
  const [formData, setFormData] = useState<JobData>(job);
  
  // Specific state for Extension creation/editing
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0],
    total: 0,
    amisDocNo: '',
    amisDesc: ''
  });
  
  // State for "Manual" Amis fields
  const [amisDocNo, setAmisDocNo] = useState('');
  const [amisDesc, setAmisDesc] = useState('');

  // State to track internal target ID for extension editing
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);

  // Suggestions state for "Mã Đối Tượng"
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [custInputVal, setCustInputVal] = useState('');

  // --- MERGE JOB STATE (LOCAL CHARGE) ---
  const [addedJobs, setAddedJobs] = useState<JobData[]>([]);
  const [searchJobCode, setSearchJobCode] = useState('');

  // Generate random number string
  const generateRandomStr = () => Math.floor(10000 + Math.random() * 90000).toString();

  // Helper to generate Description Logic for Merged Jobs
  const generateMergedDescription = (mainInvoice: string, extraJobs: JobData[]) => {
      const invoices: string[] = [];
      const missingJobCodes: string[] = [];

      if (mainInvoice && mainInvoice.trim()) {
          invoices.push(mainInvoice.trim());
      } else {
          missingJobCodes.push(formData.jobCode);
      }

      extraJobs.forEach(j => {
          if (j.localChargeInvoice && j.localChargeInvoice.trim()) {
              invoices.push(j.localChargeInvoice.trim());
          } else {
              missingJobCodes.push(j.jobCode);
          }
      });

      let desc = "Thu tiền của KH theo hoá đơn ";
      
      const invPart = invoices.join('+');
      desc += invPart;

      if (missingJobCodes.length > 0) {
          if (invPart.length > 0) desc += "+"; // Connector if invoices exist
          desc += "XXX BL " + missingJobCodes.join('+');
      }

      desc += " (KIM)";
      return desc;
  };

  // Recalculate Total Amount and Description
  const recalculateMerge = (currentMainInvoice: string, extraJobs: JobData[]) => {
      const newDesc = generateMergedDescription(currentMainInvoice, extraJobs);
      setAmisDesc(newDesc);
  };

  useEffect(() => {
    if (isOpen) {
      // 1. Reset Job Data
      const deepCopyJob = JSON.parse(JSON.stringify(job));
      
      if (mode === 'other') {
          if (!deepCopyJob.localChargeDate) deepCopyJob.localChargeDate = new Date().toISOString().split('T')[0];
      }

      setFormData(deepCopyJob);
      setAddedJobs([]); 
      setInternalTargetId(null);

      // Initialize Customer Input Value
      let initialCustId = '';
      if (mode === 'local' || mode === 'other') initialCustId = deepCopyJob.customerId;
      else if (mode === 'deposit' || mode === 'deposit_refund') initialCustId = deepCopyJob.maKhCuocId;
      else if (mode === 'extension') {
          const exts = deepCopyJob.extensions || [];
          let target = null;
          
          if (targetExtensionId) {
              target = exts.find((e: any) => e.id === targetExtensionId);
          } else if (exts.length > 0) {
              // Auto-select first extension if available
              target = exts[0];
          }
          
          initialCustId = target ? (target.customerId || deepCopyJob.customerId) : deepCopyJob.customerId;
      }

      const foundCust = customers.find(c => c.id === initialCustId);
      setCustInputVal(foundCust ? foundCust.code : (initialCustId || ''));

      // 2. Setup Amis Fields based on mode
      if (mode === 'local') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || `NTTK${generateRandomStr()}`);
          
          if (deepCopyJob.amisLcDesc) {
             setAmisDesc(deepCopyJob.amisLcDesc);
          } else {
             const inv = deepCopyJob.localChargeInvoice;
             const desc = generateMergedDescription(inv, []);
             setAmisDesc(desc);
          }
      } 
      else if (mode === 'other') {
          setAmisDocNo(deepCopyJob.amisLcDocNo || `NTTK${generateRandomStr()}`);
          const inv = deepCopyJob.localChargeInvoice || 'XXX';
          setAmisDesc(deepCopyJob.amisLcDesc || `Thu tiền của KH theo hoá đơn ${inv} (LH MB)`);
      }
      else if (mode === 'deposit') {
          setAmisDocNo(deepCopyJob.amisDepositDocNo || `NTTK${generateRandomStr()}`);
          setAmisDesc(deepCopyJob.amisDepositDesc || `Thu tiền của KH CƯỢC CONT BL ${deepCopyJob.jobCode}`);
      } 
      else if (mode === 'deposit_refund') {
          setAmisDocNo(deepCopyJob.amisDepositRefundDocNo || `UNC${generateRandomStr()}`);
          setAmisDesc(deepCopyJob.amisDepositRefundDesc || `Chi tiền cho KH HOÀN CƯỢC BL ${deepCopyJob.jobCode}`);
      }
      else if (mode === 'extension') {
          // Extension Logic Update
          const exts = deepCopyJob.extensions || [];
          let targetExt = null;

          if (targetExtensionId) {
              targetExt = exts.find((e: any) => e.id === targetExtensionId);
          } else if (exts.length > 0) {
              // Auto-select first extension to edit if available
              targetExt = exts[0];
          }

          if (targetExt) {
             setInternalTargetId(targetExt.id);
             
             // Generate Description: If Invoice exists, no BL Job. Else BL Job.
             const extInv = targetExt.invoice;
             const defaultDesc = extInv 
                ? `Thu tiền của KH theo hoá đơn GH ${extInv} (KIM)`
                : `Thu tiền của KH theo hoá đơn GH XXX BL ${deepCopyJob.jobCode} (KIM)`;

             setNewExtension({ 
                customerId: targetExt.customerId || deepCopyJob.customerId || '', 
                invoice: targetExt.invoice || '', 
                date: targetExt.invoiceDate || new Date().toISOString().split('T')[0],
                total: targetExt.total || 0,
                amisDocNo: targetExt.amisDocNo || `NTTK${generateRandomStr()}`,
                amisDesc: targetExt.amisDesc || defaultDesc
             });
          } else {
             setInternalTargetId(null);
             // New Extension
             setNewExtension({ 
               customerId: deepCopyJob.customerId || '', 
               invoice: '', 
               date: new Date().toISOString().split('T')[0],
               total: 0,
               amisDocNo: `NTTK${generateRandomStr()}`,
               amisDesc: `Thu tiền của KH theo hoá đơn GH XXX BL ${deepCopyJob.jobCode} (KIM)`
             });
          }
      }
    }
  }, [isOpen, job, mode, customers, targetExtensionId]);

  // Derived Values for Display
  const getDisplayValues = () => {
      let tkNo = '1121';
      let tkCo = '';
      let currentDate = '';
      let currentAmount = 0;
      let currentCustomer = '';
      let currentInvoice = '';

      if (mode === 'local') {
          currentInvoice = formData.localChargeInvoice || '';
          tkCo = '13111';
          currentDate = formData.localChargeDate || '';
          currentAmount = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'other') {
          currentInvoice = formData.localChargeInvoice || '';
          tkCo = '711'; // Thu Khác uses 711
          currentDate = formData.localChargeDate || '';
          currentAmount = formData.localChargeTotal || 0;
          currentCustomer = formData.customerId || '';
      } else if (mode === 'deposit') {
          tkCo = '1388';
          currentDate = formData.ngayThuCuoc || '';
          currentAmount = formData.thuCuoc || 0;
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A'; 
      } else if (mode === 'deposit_refund') {
          tkNo = '1388'; 
          tkCo = '1121'; 
          currentDate = formData.ngayThuHoan || new Date().toISOString().split('T')[0];
          currentAmount = formData.thuCuoc || 0; 
          currentCustomer = formData.maKhCuocId || '';
          currentInvoice = 'N/A';
      } else if (mode === 'extension') {
          currentInvoice = newExtension.invoice;
          tkCo = '13111';
          currentDate = newExtension.date;
          currentAmount = newExtension.total;
          currentCustomer = newExtension.customerId;
      }

      const customerName = customers.find(c => c.id === currentCustomer || c.code === currentCustomer)?.name || '';

      return { tkNo, tkCo, currentDate, currentAmount, currentCustomer, customerName, currentInvoice };
  };

  const display = getDisplayValues();

  // --- Handlers ---

  const handleAmountChange = (val: number) => {
      if (mode === 'local' || mode === 'other') setFormData(prev => ({ ...prev, localChargeTotal: val }));
      else if (mode === 'deposit' || mode === 'deposit_refund') setFormData(prev => ({ ...prev, thuCuoc: val }));
      else if (mode === 'extension') setNewExtension(prev => ({ ...prev, total: val }));
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
      const jobCode = formData.jobCode;

      if (mode === 'local') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          recalculateMerge(val, addedJobs);
      }
      else if (mode === 'other') {
          setFormData(prev => ({ ...prev, localChargeInvoice: val }));
          setAmisDesc(`Thu tiền của KH theo hoá đơn ${invPlaceholder} (LH MB)`);
      }
      else if (mode === 'extension') {
          // If invoice is provided, remove BL Job. Else keep BL Job.
          const desc = val 
            ? `Thu tiền của KH theo hoá đơn GH ${val} (KIM)`
            : `Thu tiền của KH theo hoá đơn GH XXX BL ${jobCode} (KIM)`;

          setNewExtension(prev => ({ 
              ...prev, 
              invoice: val,
              amisDesc: desc
          }));
      }
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

      recalculateMerge(formData.localChargeInvoice, newAddedJobs);

      const currentAmt = formData.localChargeTotal || 0;
      const addedAmt = found.localChargeTotal || 0; 
      setFormData(prev => ({ ...prev, localChargeTotal: currentAmt + addedAmt }));
  };

  const handleRemoveAddedJob = (id: string) => {
      const jobToRemove = addedJobs.find(j => j.id === id);
      const newAddedJobs = addedJobs.filter(j => j.id !== id);
      setAddedJobs(newAddedJobs);

      recalculateMerge(formData.localChargeInvoice, newAddedJobs);

      if (jobToRemove) {
          const currentAmt = formData.localChargeTotal || 0;
          setFormData(prev => ({ ...prev, localChargeTotal: Math.max(0, currentAmt - (jobToRemove.localChargeTotal || 0)) }));
      }
  };

  // --- EXTENSION SELECTION HANDLER ---
  const handleSelectExtensionToPay = (extId: string) => {
      if (!extId) {
          // Create New Mode
          setInternalTargetId(null);
          setNewExtension({
              customerId: formData.customerId,
              invoice: '',
              date: new Date().toISOString().split('T')[0],
              total: 0,
              amisDocNo: `NTTK${generateRandomStr()}`,
              amisDesc: `Thu tiền của KH theo hoá đơn GH XXX BL ${formData.jobCode} (KIM)`
          });
          // Update customer input to main job customer
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
              amisDocNo: target.amisDocNo || `NTTK${generateRandomStr()}`,
              amisDesc: desc
          });
          
          // Update customer input to extension customer
          const extCustId = target.customerId || formData.customerId;
          const extCust = customers.find(c => c.id === extCustId);
          setCustInputVal(extCust ? extCust.code : '');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'extension') {
      let updatedExtensions;
      // If we have an internalTargetId, we update that extension. Otherwise create new.
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
                      amisDesc: newExtension.amisDesc
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
              amisDesc: newExtension.amisDesc
            }
          ];
      }
      onSave({ ...formData, extensions: updatedExtensions });
    } 
    else if (mode === 'local' || mode === 'other') {
        onSave({ 
            ...formData, 
            amisLcDocNo: amisDocNo, 
            amisLcDesc: amisDesc 
        });
    }
    else if (mode === 'deposit') {
        onSave({ 
            ...formData, 
            amisDepositDocNo: amisDocNo, 
            amisDepositDesc: amisDesc 
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

  const filteredCustomers = customers.filter(c => 
      c.code.toLowerCase().includes(custInputVal.toLowerCase()) || 
      c.name.toLowerCase().includes(custInputVal.toLowerCase())
  );

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

  const getLabelAmount = () => {
      return mode === 'deposit_refund' ? 'Số Tiền Hoàn' : 'Số Tiền Thu';
  };

  const getLabelDesc = () => {
      return mode === 'deposit_refund' ? 'Diễn giải lý do hoàn' : 'Diễn giải lý do thu';
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{children}</label>
  );

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

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
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
                        <Label>Số Hóa Đơn (Invoice)</Label>
                        <input 
                            type="text" 
                            required
                            value={display.currentInvoice} 
                            onChange={(e) => handleInvoiceChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
                            placeholder="Nhập số hóa đơn..."
                        />
                    </div>
                )}
            </div>

            {/* --- ADD JOBS SECTION (ONLY FOR LOCAL CHARGE) --- */}
            {mode === 'local' && (
                <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 shadow-sm">
                    <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> Gộp Job (Thu nhiều lô)
                    </h3>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            value={searchJobCode}
                            onChange={(e) => setSearchJobCode(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Nhập Job Code để thêm..."
                        />
                        <button 
                            type="button" 
                            onClick={handleAddJob}
                            className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 flex items-center"
                        >
                            <Search className="w-4 h-4 mr-1" /> Thêm
                        </button>
                    </div>
                    {addedJobs.length > 0 && (
                        <div className="space-y-2">
                            {addedJobs.map((j) => (
                                <div key={j.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-orange-100 text-sm">
                                    <div>
                                        <span className="font-bold text-slate-700">{j.jobCode}</span>
                                        <span className="text-slate-500 ml-2 text-xs">
                                            (Inv: {j.localChargeInvoice || 'Trống'}, Amt: {new Intl.NumberFormat('en-US').format(j.localChargeTotal)})
                                        </span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveAddedJob(j.id)}
                                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
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
                                        <li 
                                            key={c.id} 
                                            onMouseDown={() => handleSelectCustomer(c)}
                                            className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0"
                                        >
                                            <div className="font-bold text-blue-700">{c.code}</div>
                                            <div className="text-xs text-slate-500 truncate">{c.name}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <Label>Tên Đối Tượng</Label>
                            <input 
                                type="text" 
                                value={display.customerName} 
                                readOnly
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-600 font-medium"
                            />
                        </div>
                </div>
                
                <div>
                        <Label>{getLabelAmount()}</Label>
                        <div className="relative">
                        <input 
                            type="text" 
                            required
                            value={display.currentAmount ? new Intl.NumberFormat('en-US').format(display.currentAmount) : ''} 
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) handleAmountChange(val);
                            }}
                            className={`w-full pl-4 pr-14 py-3 bg-white border border-slate-300 rounded-xl text-2xl font-bold focus:outline-none focus:ring-2 text-right ${mode === 'deposit_refund' ? 'text-red-700 focus:ring-red-500' : 'text-blue-700 focus:ring-blue-500'}`}
                            placeholder="0"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
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
                        <input 
                            type="text" 
                            value={display.tkNo} 
                            readOnly
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-slate-700"
                        />
                    </div>
                    <div>
                        <Label>TK Có</Label>
                        <input 
                            type="text" 
                            value={display.tkCo} 
                            readOnly
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-center text-blue-700"
                        />
                    </div>
                </div>

                <div>
                    <Label>{getLabelDesc()}</Label>
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

            <div className="flex items-center space-x-2 text-xs text-slate-600 px-3 py-2 font-medium bg-white rounded-lg border border-slate-200 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Mặc định: Ngân hàng TMCP Quân đội (MB) - TK: 345673979999</span>
            </div>

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
