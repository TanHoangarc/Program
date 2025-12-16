
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit2, Calendar, Copy, LayoutGrid, DollarSign, FileText, AlertTriangle, Clock } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData, ShippingLine } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';
import { formatDateVN, parseDateVN, calculatePaymentStatus } from '../utils';
import { CustomerModal } from './CustomerModal';

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
  onAddCustomer: (customer: Customer) => void;
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
  onBlur,
  onAddClick
}: { 
  value: string; 
  onChange: (val: string) => void; 
  customers: Customer[];
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onAddClick?: () => void;
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
      <div className="flex gap-1">
        <Input 
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            readOnly={readOnly}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1"
        />
        {!readOnly && onAddClick && (
            <button 
                type="button" 
                onClick={onAddClick}
                className="w-9 h-9 flex items-center justify-center bg-blue-50 border border-blue-100 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                title="Thêm khách hàng mới"
            >
                <Plus className="w-4 h-4" />
            </button>
        )}
      </div>
      
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
  label?: string; // Optional Label
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}> = ({ value, name, onChange, label, readOnly, className, placeholder }) => {
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
      {label && <Label>{label}</Label>}
      <input
        type="text"
        value={displayVal}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder || "0"}
        className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-bold transition-all shadow-sm h-9 ${readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white text-blue-700'} ${className || ''}`}
      />
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails,
  isViewMode = false, onSwitchToEdit, existingJobs, onAddCustomer
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
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState('');
  
  const [isJobCodeCopied, setIsJobCodeCopied] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
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

  useEffect(() => {
    if (isViewMode) return;

    const selectedCustomer = (customers || []).find(c => c?.id === formData.customerId);
    const displayCustName = selectedCustomer?.name || formData.customerName || '';
    const nameLower = displayCustName.toLowerCase();
    const codeLower = (selectedCustomer?.code || '').toLowerCase();

    const isLongHoang = nameLower.includes('long hoàng') || 
                        nameLower.includes('long hoang') || 
                        nameLower.includes('lhk') || 
                        nameLower.includes('longhoang') ||
                        codeLower.includes('longhoang') || 
                        codeLower.includes('lhk');

    if (isLongHoang) {
        setFormData(prev => {
            const updates: Partial<JobData> = {};
            let changed = false;
            
            if (prev.localChargeTotal !== prev.sell) {
                updates.localChargeTotal = prev.sell;
                changed = true;
            }
            
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

  const handleCustomerChange = (val: string) => {
    if (isViewMode) return;
    // val is customer ID from CustomerInput
    setFormData(prev => {
        const found = customers.find(c => c.id === val);
        return {
            ...prev,
            customerId: val,
            customerName: found ? found.name : ''
        };
    });
  };

  const handleExtensionChange = (id: string, field: keyof ExtensionData, value: any) => {
    if (isViewMode) return;
    setFormData(prev => ({
        ...prev,
        extensions: (prev.extensions || []).map(ext => {
            if (ext.id === id) {
                const updated = { ...ext, [field]: value };
                if (field === 'net' || field === 'vat') {
                    updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
                }
                return updated;
            }
            return ext;
        })
    }));
  };

  const addExtension = () => {
    if (isViewMode) return;
    const newExt: ExtensionData = {
        id: Date.now().toString(),
        customerId: formData.customerId,
        invoice: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        net: 0,
        vat: 0,
        total: 0
    };
    setFormData(prev => ({ ...prev, extensions: [...(prev.extensions || []), newExt] }));
  };

  const removeExtension = (id: string) => {
    if (isViewMode) return;
    setFormData(prev => ({ ...prev, extensions: (prev.extensions || []).filter(e => e.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAddNewCustomer = (cust: Customer) => {
      onAddCustomer(cust);
      setFormData(prev => ({
          ...prev,
          customerId: cust.id,
          customerName: cust.name
      }));
      setIsCustomerModalOpen(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg shadow-sm border ${isViewMode ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-teal-100 text-teal-700 border-teal-200'}`}>
                    {isViewMode ? <ExternalLink className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{isViewMode ? 'Chi Tiết Job' : (initialData ? 'Cập Nhật Job' : 'Thêm Job Mới')}</h2>
                    {isViewMode ? (
                        <p className="text-xs text-slate-500 font-medium">Xem thông tin chi tiết</p>
                    ) : (
                        <p className="text-xs text-slate-500 font-medium">{initialData ? 'Chỉnh sửa thông tin Job' : 'Nhập thông tin Job mới'}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isViewMode && onSwitchToEdit && (
                    <button onClick={onSwitchToEdit} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                        <Edit2 className="w-4 h-4 mr-2" /> Chỉnh sửa
                    </button>
                )}
                <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 flex-1">
            <form id="jobForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Thông tin chung */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center mb-4 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2 border-slate-100">
                        <LayoutGrid className="w-4 h-4 mr-2 text-teal-500" /> Thông tin chung
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-1">
                            <Label>Tháng</Label>
                            <Select name="month" value={formData.month} onChange={handleChange} disabled={isViewMode}>
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </Select>
                        </div>
                        <div className="md:col-span-1">
                            <Label>Job Code</Label>
                            <Input ref={jobInputRef} name="jobCode" value={formData.jobCode} onChange={handleChange} readOnly={isViewMode} placeholder="Nhập Job Code" className="font-bold text-teal-700" />
                        </div>
                        <div className="md:col-span-1">
                            <Label>Booking</Label>
                            <div className="flex gap-1">
                                <Input name="booking" value={formData.booking} onChange={handleChange} readOnly={isViewMode} placeholder="Booking No." />
                                {formData.booking && onViewBookingDetails && (
                                    <button type="button" onClick={() => onViewBookingDetails(formData.booking)} className="bg-blue-50 text-blue-600 px-2 rounded-lg border border-blue-100 hover:bg-blue-100" title="Xem chi tiết Booking"><ExternalLink className="w-4 h-4" /></button>
                                )}
                            </div>
                        </div>
                        <div className="md:col-span-1">
                            <Label>Line</Label>
                            {isAddingLine ? (
                                <div className="flex gap-1">
                                    <Input value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder="Nhập Line mới" autoFocus />
                                    <button type="button" onClick={saveNewLine} className="bg-green-100 text-green-700 px-2 rounded hover:bg-green-200"><Check className="w-4 h-4"/></button>
                                    <button type="button" onClick={() => setIsAddingLine(false)} className="bg-red-100 text-red-700 px-2 rounded hover:bg-red-200"><X className="w-4 h-4"/></button>
                                </div>
                            ) : (
                                <Select name="line" value={formData.line} onChange={handleLineSelectChange} disabled={isViewMode}>
                                    <option value="">-- Chọn Line --</option>
                                    {lines.map(l => <option key={l.id} value={l.code}>{l.code}</option>)}
                                    <option value="new" className="font-bold text-blue-600">+ Thêm mới</option>
                                </Select>
                            )}
                        </div>
                        <div className="md:col-span-1">
                            <Label>Consol</Label>
                            <Input name="consol" value={formData.consol} onChange={handleChange} readOnly={isViewMode} />
                        </div>
                        <div className="md:col-span-1">
                            <Label>Transit</Label>
                            <Select name="transit" value={formData.transit} onChange={handleChange} disabled={isViewMode}>
                                {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <Label>Khách Hàng (Mã)</Label>
                            <CustomerInput 
                                value={formData.customerId} 
                                onChange={handleCustomerChange} 
                                customers={customers}
                                readOnly={isViewMode}
                                placeholder="Nhập mã hoặc tên KH"
                                onAddClick={() => setIsCustomerModalOpen(true)}
                            />
                        </div>
                        <div>
                            <Label>Tên Công Ty (Tự động)</Label>
                            <Input value={formData.customerName} readOnly className="bg-slate-100 text-slate-600 font-medium" />
                        </div>
                    </div>
                </div>

                {/* 2. Tài chính & Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center mb-4 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2 border-slate-100">
                            <DollarSign className="w-4 h-4 mr-2 text-blue-500" /> Tài chính (VND)
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <MoneyInput label="Cost (Giá mua)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} className="text-red-600" />
                            <MoneyInput label="Sell (Giá bán)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} className="text-blue-600" />
                            <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly={true} className={formData.profit >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberStepper label="Container 20'" value={formData.cont20} onChange={(v) => handleMoneyChange('cont20', v)} readOnly={isViewMode} />
                            <NumberStepper label="Container 40'" value={formData.cont40} onChange={(v) => handleMoneyChange('cont40', v)} readOnly={isViewMode} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center mb-4 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2 border-slate-100">
                            <FileText className="w-4 h-4 mr-2 text-purple-500" /> Các loại phí (Cost)
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <MoneyInput label="Phí CIC" name="feeCic" value={formData.feeCic} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <MoneyInput label="Phí Kimberry" name="feeKimberry" value={formData.feeKimberry} onChange={handleMoneyChange} readOnly={true} className="bg-slate-100" />
                            <MoneyInput label="Phí PSC" name="feePsc" value={formData.feePsc} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <MoneyInput label="Phí EMC" name="feeEmc" value={formData.feeEmc} onChange={handleMoneyChange} readOnly={isViewMode} />
                            <div className="col-span-2">
                                <MoneyInput label="Phí Khác" name="feeOther" value={formData.feeOther} onChange={handleMoneyChange} readOnly={isViewMode} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Thanh toán & Hóa đơn */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Out */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
                        <div className="flex items-center mb-4 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2 border-slate-100 pl-2">
                            Thanh toán Hãng tàu (Chi)
                        </div>
                        <div className="space-y-4 pl-2">
                            <div className="grid grid-cols-2 gap-4">
                                <MoneyInput label="Chi Payment" name="chiPayment" value={formData.chiPayment} onChange={handleMoneyChange} readOnly={isViewMode} />
                                <MoneyInput label="Chi Cược" name="chiCuoc" value={formData.chiCuoc} onChange={handleMoneyChange} readOnly={isViewMode} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Ngày chi cược</Label><DateInput name="ngayChiCuoc" value={formData.ngayChiCuoc} onChange={handleChange} readOnly={isViewMode} /></div>
                                <div><Label>Ngày chi hoàn</Label><DateInput name="ngayChiHoan" value={formData.ngayChiHoan} onChange={handleChange} readOnly={isViewMode} /></div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice In */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-400"></div>
                        <div className="flex items-center mb-4 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2 border-slate-100 pl-2">
                            Thu tiền Khách hàng (Thu)
                        </div>
                        <div className="space-y-4 pl-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Số Hóa đơn</Label><Input name="localChargeInvoice" value={formData.localChargeInvoice} onChange={handleChange} readOnly={isViewMode} placeholder="Số HĐ" /></div>
                                <div><Label>Ngày Hóa đơn</Label><DateInput name="localChargeDate" value={formData.localChargeDate} onChange={handleChange} readOnly={isViewMode} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <MoneyInput label="Thực thu Local Charge" name="localChargeTotal" value={formData.localChargeTotal} onChange={handleMoneyChange} readOnly={isViewMode} className="font-bold text-green-600" />
                                <div>
                                    <Label>Ngân hàng</Label>
                                    <Select name="bank" value={formData.bank} onChange={handleChange} disabled={isViewMode}>
                                        <option value="">-- Chọn --</option>
                                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </Select>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100 mt-2">
                                <Label>Thu Cược (Deposit)</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    <MoneyInput name="thuCuoc" value={formData.thuCuoc} onChange={handleMoneyChange} readOnly={isViewMode} placeholder="Số tiền cược" />
                                    <DateInput name="ngayThuCuoc" value={formData.ngayThuCuoc} onChange={handleChange} readOnly={isViewMode} />
                                    <DateInput name="ngayThuHoan" value={formData.ngayThuHoan} onChange={handleChange} readOnly={isViewMode} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Extensions */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100">
                        <div className="flex items-center text-slate-800 font-bold text-sm uppercase tracking-wide">
                            <Copy className="w-4 h-4 mr-2 text-orange-500" /> Gia Hạn (Extensions)
                        </div>
                        {!isViewMode && (
                            <button type="button" onClick={addExtension} className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg border border-orange-100 hover:bg-orange-100 font-bold flex items-center">
                                <Plus className="w-3 h-3 mr-1" /> Thêm dòng
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        {(formData.extensions || []).map((ext, idx) => (
                            <div key={ext.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                                <div className="col-span-1 text-center text-xs font-bold text-slate-400">#{idx + 1}</div>
                                <div className="col-span-3">
                                    <Label>Số Hóa Đơn</Label>
                                    <Input value={ext.invoice} onChange={(e) => handleExtensionChange(ext.id, 'invoice', e.target.value)} readOnly={isViewMode} placeholder="Số HĐ" />
                                </div>
                                <div className="col-span-3">
                                    <Label>Ngày Hóa Đơn</Label>
                                    <DateInput name={`ext_date_${ext.id}`} value={ext.invoiceDate} onChange={(e) => handleExtensionChange(ext.id, 'invoiceDate', e.target.value)} readOnly={isViewMode} />
                                </div>
                                <div className="col-span-4">
                                    <Label>Tổng Tiền (Total)</Label>
                                    <MoneyInput name={`ext_total_${ext.id}`} value={ext.total} onChange={(n, v) => handleExtensionChange(ext.id, 'total', v)} readOnly={isViewMode} className="text-orange-600" />
                                </div>
                                {!isViewMode && (
                                    <button type="button" onClick={() => removeExtension(ext.id)} className="absolute -right-2 -top-2 bg-white border border-slate-200 rounded-full p-1 text-slate-300 hover:text-red-500 shadow opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {(formData.extensions || []).length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-xs italic border-2 border-dashed border-slate-100 rounded-lg">
                                Chưa có thông tin gia hạn
                            </div>
                        )}
                    </div>
                </div>

            </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                {isViewMode ? 'Đóng' : 'Hủy bỏ'}
            </button>
            {!isViewMode && (
                <button type="submit" form="jobForm" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center transform active:scale-95 duration-100">
                    <Save className="w-4 h-4 mr-2" /> Lưu Job
                </button>
            )}
        </div>

      </div>

      {isCustomerModalOpen && (
          <CustomerModal 
             isOpen={isCustomerModalOpen} 
             onClose={() => setIsCustomerModalOpen(false)} 
             onSave={handleAddNewCustomer} 
          />
      )}
    </div>,
    document.body
  );
};
