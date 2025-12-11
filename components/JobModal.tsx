
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit2, Calendar, Copy, LayoutGrid, DollarSign, FileText } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData, ShippingLine } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';
import { formatDateVN, parseDateVN } from '../utils';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: JobData, newCustomer?: Customer) => void;
  initialData?: JobData | null;
  customers: Customer[];
  lines: ShippingLine[];
  onAddLine: (line: string) => void;
  onViewBookingDetails: (bookingId: string) => void;
  isViewMode?: boolean;
  onSwitchToEdit?: () => void;
  existingJobs?: JobData[];
}

// Compact Styled Components
const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    {...props} 
    ref={ref}
    value={props.value ?? ''}
    className={`w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-50 disabled:text-slate-500 placeholder-slate-400 transition-all shadow-sm h-9 ${props.className || ''}`}
  />
));
Input.displayName = 'Input';

// --- CUSTOMER INPUT ---
const CustomerInput = ({ 
  value, 
  onChange, 
  customers, 
  readOnly, 
  placeholder,
  className,
  onFocus,
  onBlur
}: { 
  value: string; 
  onChange: (val: string) => void; 
  customers: Customer[];
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Safeguard customers array
  const safeCustomers = customers || [];

  useEffect(() => {
    if (!isFocused) {
        const found = safeCustomers.find(c => c.id === value || c.code === value);
        setInternalValue(found ? found.code : (value || ''));
    }
  }, [value, safeCustomers, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange(val);
    setShowSuggestions(true);
  };

  const handleSelect = (customer: Customer) => {
    setInternalValue(customer.code);
    onChange(customer.id);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTimeout(() => setShowSuggestions(false), 200);
    if (onBlur) onBlur();
  };

  const filtered = safeCustomers.filter(c => 
    (c.code || '').toLowerCase().includes(internalValue.toLowerCase()) || 
    (c.name || '').toLowerCase().includes(internalValue.toLowerCase())
  );

  const selectedObj = safeCustomers.find(c => c.id === value || c.code === value);
  const displayName = selectedObj ? selectedObj.name : '';

  return (
    <div className={`relative group w-full ${className || ''}`}>
      <Input 
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {!readOnly && showSuggestions && internalValue && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 left-0 py-1">
          {filtered.map(c => (
            <li 
              key={c.id} 
              onMouseDown={() => handleSelect(c)}
              className="px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0"
            >
              <div className="font-bold text-blue-700">{c.code}</div>
              <div className="text-[10px] text-slate-500 truncate">{c.name}</div>
            </li>
          ))}
        </ul>
      )}
      
      {displayName && (
        <div className="text-[10px] text-slate-500 mt-0.5 truncate px-1 font-medium italic h-3.5 leading-none">
          {displayName}
        </div>
      )}
    </div>
  );
};

const DateInput = ({ 
  value, 
  name, 
  onChange, 
  readOnly 
}: { 
  value: string; 
  name: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  readOnly?: boolean; 
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const handleBlur = () => {
    if (!displayValue) {
      if (value) triggerChange('');
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) {
      if (parsed !== value) triggerChange(parsed);
    } else {
      setDisplayValue(formatDateVN(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const triggerChange = (newVal: string) => {
    const e = {
      target: { name, value: newVal }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(e);
  };

  const handleDateIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerChange(e.target.value);
  };

  if (readOnly) {
    return (
      <Input 
        value={formatDateVN(value)} 
        readOnly 
        className="bg-slate-50 font-medium"
      />
    );
  }

  return (
    <div className="relative w-full">
      <Input 
        type="text" 
        name={name}
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="dd/mm/yyyy"
        className="pr-8"
      />
      <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  );
};

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      {...props}
      className={`w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-50 disabled:text-slate-500 transition-all shadow-sm appearance-none h-9 ${props.className || ''}`}
    >
      {props.children}
    </select>
    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
    </div>
  </div>
);

const NumberStepper: React.FC<{
  value: number;
  onChange: (val: number) => void;
  label: string;
  readOnly?: boolean;
}> = ({ value, onChange, label, readOnly }) => (
  <div className="flex flex-col w-full">
    <Label>{label}</Label>
    <div className="flex items-center h-9">
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange(Math.max(0, (value || 0) - 1))}
          className="w-8 h-full border border-slate-200 rounded-l-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
      )}
      <div className={`flex-1 h-full flex items-center justify-center border-y border-slate-200 bg-white text-sm font-bold text-slate-800 ${readOnly ? 'border rounded-lg w-full px-3 justify-start bg-slate-50' : ''}`}>
        {value || 0}
      </div>
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange((value || 0) + 1)}
          className="w-8 h-full border border-slate-200 rounded-r-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

const MoneyInput: React.FC<{
  value: number;
  name?: string;
  onChange: (name: string, val: number) => void;
  label: string;
  readOnly?: boolean;
  className?: string;
}> = ({ value, name, onChange, label, readOnly, className }) => {
  const [displayVal, setDisplayVal] = useState('');

  useEffect(() => {
    const safeValue = value || 0;
    setDisplayVal(safeValue === 0 && !readOnly ? '' : new Intl.NumberFormat('en-US').format(safeValue));
  }, [value, readOnly]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(raw))) {
      onChange(name || '', Number(raw));
    }
  };

  return (
    <div className="w-full">
      <Label>{label}</Label>
      <input
        type="text"
        value={displayVal}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder="0"
        className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-bold transition-all shadow-sm h-9 ${readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white text-blue-700'} ${className || ''}`}
      />
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails,
  isViewMode = false, onSwitchToEdit, existingJobs
}) => {
  const [formData, setFormData] = useState<JobData>(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(JSON.stringify(initialData));
        const safeParsed = {
            ...parsed,
            ngayChiCuoc: String(parsed.ngayChiCuoc || ''),
            ngayChiHoan: String(parsed.ngayChiHoan || ''),
            localChargeDate: String(parsed.localChargeDate || ''),
            ngayThuCuoc: String(parsed.ngayThuCuoc || ''),
            ngayThuHoan: String(parsed.ngayThuHoan || '')
        };
        return { 
          ...INITIAL_JOB, 
          ...safeParsed,
          extensions: Array.isArray(safeParsed.extensions) ? safeParsed.extensions : [],
          bookingCostDetails: safeParsed.bookingCostDetails || undefined
        };
      } catch (e) {
        return { ...INITIAL_JOB, id: Date.now().toString() };
      }
    } else {
      return { ...INITIAL_JOB, id: Date.now().toString() };
    }
  });

  const [custCodeInput, setCustCodeInput] = useState(() => {
    if (initialData?.customerId) {
        const c = (customers || []).find(c => c?.id === initialData.customerId);
        return String(c?.code || '');
    }
    return '';
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ mst: '', name: '', code: '' });
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState('');
  
  const [isJobCodeCopied, setIsJobCodeCopied] = useState(false);
  
  const jobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !initialData && !isViewMode) {
       setTimeout(() => jobInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData, isViewMode]);

  useEffect(() => {
    if (isOpen && initialData?.bookingCostDetails) {
        setFormData(prev => ({ ...prev, bookingCostDetails: initialData.bookingCostDetails }));
    }
  }, [initialData?.bookingCostDetails, isOpen]);

  useEffect(() => {
    if (isViewMode) return;
    const fee20 = (formData.cont20 || 0) * 250000;
    const fee40 = (formData.cont40 || 0) * 500000;
    const totalFee = fee20 + fee40;
    setFormData(prev => {
        if (prev.feeKimberry !== totalFee) {
            return { ...prev, feeKimberry: totalFee };
        }
        return prev;
    });
  }, [formData.cont20, formData.cont40, isViewMode]);

  // LOGIC FOR LONG HOANG: SYNC SELL -> LC AMOUNT, HIDE INVOICE, SET BANK
  useEffect(() => {
    if (isViewMode) return;

    const selectedCustomer = (customers || []).find(c => c?.id === formData.customerId);
    const displayCustName = selectedCustomer?.name || formData.customerName || '';
    const nameLower = displayCustName.toLowerCase();
    const codeLower = (selectedCustomer?.code || '').toLowerCase(); // Add code check too

    const isLongHoang = nameLower.includes('long hoàng') || 
                        nameLower.includes('long hoang') || 
                        nameLower.includes('lhk') || 
                        nameLower.includes('longhoang') ||
                        codeLower.includes('longhoang') || // Added code check
                        codeLower.includes('lhk');

    if (isLongHoang) {
        setFormData(prev => {
            const updates: Partial<JobData> = {};
            let changed = false;
            
            // Auto sync Sell to LC Amount
            if (prev.localChargeTotal !== prev.sell) {
                updates.localChargeTotal = prev.sell;
                changed = true;
            }
            
            // Default Bank to MB Bank
            if (prev.bank !== 'MB Bank') {
                updates.bank = 'MB Bank';
                changed = true;
            }
            
            if (changed) {
                return { ...prev, ...updates };
            }
            return prev;
        });
    }
  }, [formData.customerId, formData.customerName, formData.sell, customers, isViewMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (isViewMode) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMoneyChange = (name: string, val: number) => {
    if (isViewMode) return;
    setFormData(prev => {
      const newData: any = { ...prev, [name]: val };
      if (name === 'cost' || name === 'sell') {
        newData.profit = (newData.sell || 0) - (newData.cost || 0);
      }
      return newData;
    });
  };

  const handleLineSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isViewMode) return;
    const val = e.target.value;
    if (val === 'new') {
      setIsAddingLine(true);
      setFormData(prev => ({ ...prev, line: '' }));
    } else {
      setFormData(prev => ({ ...prev, line: val }));
    }
  };

  const saveNewLine = () => {
    if (newLine.trim()) {
      onAddLine(newLine);
      setFormData(prev => ({ ...prev, line: newLine }));
      setIsAddingLine(false);
      setNewLine('');
    }
  };

  const handleCustomerInputChange = (val: string) => {
    if (isViewMode) return;
    setCustCodeInput(val);
    setShowSuggestions(true);

    // 1. Try finding by ID (Select case)
    let match = (customers || []).find(c => c.id === val);

    // 2. If not found, try finding by Code (Typing case)
    if (!match) {
        match = (customers || []).find(c => c?.code && String(c.code).toLowerCase() === val.toLowerCase().trim());
    }
    
    // 3. Optional: Try finding by Name (Typing case fallback)
    if (!match) {
         match = (customers || []).find(c => c?.name && String(c.name).toLowerCase() === val.toLowerCase().trim());
    }
    
    if (match) {
        setIsAddingCustomer(false);
        setNewCustomer({ mst: '', name: '', code: '' });
        setFormData(prev => ({ 
            ...prev, 
            customerId: match.id,
            customerName: match.name
        }));
    } else {
        setIsAddingCustomer(true);
        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
        setNewCustomer(prev => ({ ...prev, code: val }));
    }
  };

  const handleSelectSuggestion = (customer: Customer) => {
    setCustCodeInput(customer.code);
    setIsAddingCustomer(false);
    setNewCustomer({ mst: '', name: '', code: '' });
    setFormData(prev => ({ 
        ...prev, 
        customerId: customer.id,
        customerName: customer.name
    }));
    setShowSuggestions(false);
  };

  const saveNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.code) return;
    const newCustObj: Customer = {
      id: Date.now().toString(),
      ...newCustomer
    };
    setFormData(prev => ({
      ...prev,
      customerId: newCustObj.id,
      customerName: newCustObj.name
    }));
    return newCustObj;
  };

  const handleExtensionChange = (id: string, field: keyof ExtensionData, value: any) => {
    if (isViewMode) return;
    setFormData(prev => {
      const newExts = (prev.extensions || []).map(ext => {
        if (ext.id === id) {
          return { ...ext, [field]: value };
        }
        return ext;
      });
      return { ...prev, extensions: newExts };
    });
  };

  const addExtension = () => {
    if (isViewMode) return;
    setFormData(prev => ({
      ...prev,
      extensions: [...(prev.extensions || []), { 
        id: Date.now().toString(), 
        customerId: '', 
        invoice: '', 
        invoiceDate: '',
        net: 0,
        vat: 0,
        total: 0 
      }]
    }));
  };

  const removeExtension = (id: string) => {
    if (isViewMode) return;
    setFormData(prev => ({
      ...prev,
      extensions: (prev.extensions || []).filter(ext => ext.id !== id)
    }));
  };

  const handleCopyJobCode = () => {
    if (formData.jobCode) {
      navigator.clipboard.writeText(formData.jobCode);
      setIsJobCodeCopied(true);
      setTimeout(() => setIsJobCodeCopied(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode && onSwitchToEdit) {
      onSwitchToEdit();
      return;
    }

    const code = formData.jobCode || '';
    if (!code.trim()) {
      alert("Vui lòng nhập Job Code");
      return;
    }
    if (/\s/.test(code)) {
      alert("Job Code không được chứa khoảng trắng. Vui lòng kiểm tra lại.");
      return;
    }
    if (existingJobs) {
      const isDuplicate = existingJobs.some(j => 
        j.jobCode.toLowerCase() === code.toLowerCase() && 
        j.id !== formData.id 
      );
      if (isDuplicate) {
        alert(`Job Code "${code}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`);
        return;
      }
    }

    let createdCustomer: Customer | undefined;
    if (isAddingCustomer) {
      createdCustomer = saveNewCustomer();
      if (!createdCustomer) {
         alert("Vui lòng nhập thông tin khách hàng mới");
         return;
      }
    }
    
    const finalJob = { ...formData };
    if (createdCustomer) {
        finalJob.customerId = createdCustomer.id;
        finalJob.customerName = createdCustomer.name;
    }

    onSave(finalJob, createdCustomer);
    setIsAddingCustomer(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSwitchToEdit) {
      onSwitchToEdit();
    }
  };

  const handleBookingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (formData.booking) {
      onViewBookingDetails(formData.booking);
    }
  };

  // Re-calculate isLongHoang for rendering logic
  const selectedCustomer = (customers || []).find(c => c?.id === formData.customerId);
  const displayCustName = selectedCustomer?.name || formData.customerName || '';
  const nameLower = displayCustName.toLowerCase();
  const codeLower = (selectedCustomer?.code || '').toLowerCase(); // Add code check too

  const isLongHoang = nameLower.includes('long hoàng') || 
                      nameLower.includes('long hoang') || 
                      nameLower.includes('lhk') || 
                      nameLower.includes('longhoang') ||
                      codeLower.includes('longhoang') ||
                      codeLower.includes('lhk');

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50 ring-1 ring-black/5">
        
        {/* Compact Header */}
        <div className="px-6 py-3 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isViewMode ? 'Chi Tiết Job' : (initialData ? 'Chỉnh sửa Job' : 'Thêm Job Mới')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. COMPACT GENERAL INFO */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Basic IDs */}
                    <div className="md:col-span-2">
                        <Label>Tháng</Label>
                        <Select name="month" value={formData.month} onChange={handleChange} disabled={isViewMode}>
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-3">
                        <Label>Job Code</Label>
                        <div className="relative">
                            <Input name="jobCode" ref={jobInputRef} value={formData.jobCode} onChange={handleChange} readOnly={isViewMode} className={`${isViewMode ? "font-bold text-blue-700 bg-blue-50" : "font-semibold"} pr-8`} placeholder="VD: JOB123" />
                            <button type="button" onClick={handleCopyJobCode} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 rounded">
                                {isJobCodeCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <Label>Booking</Label>
                        <div className="flex items-center gap-1">
                            <Input name="booking" value={formData.booking} onChange={handleChange} readOnly={isViewMode} />
                            {formData.booking && (
                                <button type="button" onClick={handleBookingClick} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 border border-slate-200" title="Chi tiết Booking"><ExternalLink className="w-3.5 h-3.5" /></button>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-4">
                        <Label>Khách hàng (Mã KH)</Label>
                        <div className="relative group">
                            <CustomerInput value={custCodeInput} onChange={handleCustomerInputChange} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} readOnly={isViewMode} placeholder={isViewMode ? "" : "Tìm KH..."} className={isAddingCustomer ? "border-blue-500 ring-2 ring-blue-100" : ""} customers={customers} />
                            {!isViewMode && showSuggestions && custCodeInput && (
                                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 left-0 py-1">
                                    {/* ... suggestions ... */}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Logistics Info */}
                    <div className="md:col-span-2">
                        <Label>Line</Label>
                        {!isAddingLine ? (
                            <Select name="line" value={formData.line} onChange={handleLineSelectChange} disabled={isViewMode}>
                                <option value="">--</option>
                                {(lines || []).map((l, i) => <option key={i} value={l?.code}>{l?.code}</option>)}
                                {!isViewMode && <option value="new">+ Mới</option>}
                            </Select>
                        ) : (
                            <div className="flex gap-1"><Input value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder="Mã..." autoFocus /><button type="button" onClick={saveNewLine} className="bg-green-500 text-white p-1.5 rounded-lg"><Check className="w-3.5 h-3.5" /></button><button type="button" onClick={() => setIsAddingLine(false)} className="bg-slate-200 text-slate-600 p-1.5 rounded-lg"><X className="w-3.5 h-3.5" /></button></div>
                        )}
                    </div>
                    <div className="md:col-span-2"><Label>Consol</Label><Input name="consol" value={formData.consol} onChange={handleChange} readOnly={isViewMode} /></div>
                    <div className="md:col-span-2"><Label>Transit</Label><Select name="transit" value={formData.transit} onChange={handleChange} disabled={isViewMode}>{TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}</Select></div>
                    
                    {/* HBL: Show only for Long Hoang */}
                    {isLongHoang && <div className="md:col-span-2"><Label>HBL</Label><Input name="hbl" value={formData.hbl} onChange={handleChange} readOnly={isViewMode} className="bg-orange-50 text-orange-800 border-orange-200" /></div>}
                    
                    {/* Container Counts */}
                    <div className="md:col-span-2"><NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} readOnly={isViewMode} /></div>
                    <div className="md:col-span-2"><NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} readOnly={isViewMode} /></div>
                </div>
            </div>

            {/* 2. SPLIT VIEW: FINANCE & PAYMENTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* LEFT: FINANCIALS */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center border-b border-slate-100 pb-2">
                        <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Tài Chính & Chi Phí
                    </h3>
                    
                    {/* Big Numbers */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} />
                        <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} />
                        <MoneyInput label="Profit (Lãi)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly className="font-black text-green-600 bg-green-50" />
                    </div>

                    {/* Breakdown */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Chi tiết Cost</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <MoneyInput label="Phí CIC" name="feeCic" value={formData.feeCic} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <div className="relative">
                                <MoneyInput label="Phí Kimberry (Auto)" name="feeKimberry" value={formData.feeKimberry} onChange={handleMoneyChange} readOnly={true} className="bg-slate-100 text-slate-500" />
                            </div>
                            <MoneyInput label="Phí PSC" name="feePsc" value={formData.feePsc} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <MoneyInput label="Phí EMC" name="feeEmc" value={formData.feeEmc} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <MoneyInput label="Phí khác" name="feeOther" value={formData.feeOther} onChange={handleMoneyChange} readOnly={isViewMode} />
                        </div>
                    </div>
                </div>

                {/* RIGHT: REVENUE / PAYMENTS */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center border-b border-slate-100 pb-2">
                        <DollarSign className="w-3.5 h-3.5 mr-1.5 text-green-600" /> Thu (Invoices)
                    </h3>

                    <div className="space-y-3 flex-1">
                        {/* Local Charge Box */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative">
                            <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 uppercase">Local Charge</div>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                {/* Hide Invoice if Long Hoang */}
                                {!isLongHoang && <div className="col-span-2"><Label>Invoice</Label><Input name="localChargeInvoice" value={formData.localChargeInvoice} onChange={handleChange} readOnly={isViewMode} placeholder="Số hóa đơn..." /></div>}
                                
                                <div><MoneyInput label="Amount" name="localChargeTotal" value={formData.localChargeTotal} onChange={handleMoneyChange} readOnly={isViewMode || isLongHoang} className="text-blue-700" /></div>
                                <div>
                                    <Label>Ngân hàng</Label>
                                    <Select name="bank" value={formData.bank} onChange={handleChange} disabled={isViewMode}>
                                        <option value="">--</option>
                                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Deposit Box */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative">
                            <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 uppercase">Deposit (Cược)</div>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                <div className="col-span-2"><Label>KH Cược</Label><CustomerInput value={formData.maKhCuocId} onChange={(val) => setFormData(prev => ({ ...prev, maKhCuocId: val }))} customers={customers} readOnly={isViewMode} placeholder="Mã KH..." className="h-9" /></div>
                                <div><MoneyInput label="Tiền Cược" name="thuCuoc" value={formData.thuCuoc} onChange={handleMoneyChange} readOnly={isViewMode} className="text-orange-700" /></div>
                                <div className="grid grid-cols-2 gap-1">
                                    <div><Label>Ngày Cược</Label><DateInput name="ngayThuCuoc" value={formData.ngayThuCuoc} onChange={handleChange} readOnly={isViewMode} /></div>
                                    <div><Label>Ngày Hoàn</Label><DateInput name="ngayThuHoan" value={formData.ngayThuHoan} onChange={handleChange} readOnly={isViewMode} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. EXTENSIONS */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center"><FileText className="w-3.5 h-3.5 mr-1.5 text-orange-500" /> Gia Hạn</h3>
                    {!isViewMode && <button type="button" onClick={addExtension} className="text-[10px] flex items-center bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100"><Plus className="w-3 h-3 mr-1" /> Thêm</button>}
                </div>
                <div className="space-y-2">
                    {(formData.extensions || []).map((ext) => (
                        <div key={ext.id} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-2 rounded border border-slate-200">
                            <div className="col-span-5"><Label>Khách hàng</Label><CustomerInput value={ext.customerId} onChange={(val) => handleExtensionChange(ext.id, 'customerId', val)} customers={customers} readOnly={isViewMode} placeholder="Mã KH" className="h-8 text-xs" /></div>
                            <div className="col-span-3"><Label>Invoice</Label><Input value={ext.invoice} onChange={(e) => handleExtensionChange(ext.id, 'invoice', e.target.value)} readOnly={isViewMode} className="h-8 text-xs" /></div>
                            <div className="col-span-3"><Label>Amount</Label><input type="text" value={new Intl.NumberFormat('en-US').format(ext.total)} onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleExtensionChange(ext.id, 'total', val); }} readOnly={isViewMode} className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-orange-500 text-right font-bold text-orange-700 h-8" placeholder="0" /></div>
                            <div className="col-span-1 flex justify-center">{!isViewMode && <button type="button" onClick={() => removeExtension(ext.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
                        </div>
                    ))}
                    {(!formData.extensions || formData.extensions.length === 0) && <div className="text-xs text-slate-400 italic text-center py-2">Chưa có phát sinh</div>}
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 pt-3 sticky bottom-0 bg-white/95 backdrop-blur py-3 border-t border-slate-100 -mx-5 -mb-5 px-5 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50">Đóng</button>
              {isViewMode ? (
                <button type="button" onClick={handleEditClick} className="px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 flex items-center"><Edit2 className="w-3.5 h-3.5 mr-1.5" /> Sửa</button>
              ) : (
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center"><Save className="w-3.5 h-3.5 mr-1.5" /> Lưu</button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
