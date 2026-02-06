
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit2, Calendar, Copy, LayoutGrid, DollarSign, FileText, AlertTriangle, Mail, Receipt, Anchor } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData, ShippingLine } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS, YEARS } from '../constants';
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
  customReceipts?: any[];
  onViewReceipt?: (job: JobData, mode: 'local' | 'deposit' | 'extension') => void;
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
  label: string;
  readOnly?: boolean;
  className?: string;
  rightElement?: React.ReactNode;
}> = ({ value, name, onChange, label, readOnly, className, rightElement }) => {
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
      <div className="flex items-center gap-1">
        <input
            type="text"
            value={displayVal}
            onChange={handleChange}
            readOnly={readOnly}
            placeholder="0"
            className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-bold transition-all shadow-sm h-9 ${readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white text-blue-700'} ${className || ''}`}
        />
        {rightElement}
      </div>
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails,
  isViewMode = false, onSwitchToEdit, existingJobs, onAddCustomer, customReceipts = [], onViewReceipt
}) => {
  const [formData, setFormData] = useState<JobData>(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(JSON.stringify(initialData));
        const safeParsed = {
            ...parsed,
            year: parsed.year || 2025, // Default year fallback
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Quick Add Customer State
  const [quickAddTarget, setQuickAddTarget] = useState<{ type: 'MAIN' | 'DEPOSIT' | 'EXTENSION', extId?: string } | null>(null);
  
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

  // AUTOMATED FEE CALCULATION
  useEffect(() => {
    if (isViewMode) return;

    // 1. Calculate Kimberry Fee
    const fee20 = (formData.cont20 || 0) * 250000;
    const fee40 = (formData.cont40 || 0) * 500000;
    const totalFeeKimberry = fee20 + fee40;

    // 2. Calculate CIC Fee (Logic applies from year 2026)
    let newFeeCic = formData.feeCic;
    if ((formData.year || 0) >= 2026) {
        const totalCont = (formData.cont20 || 0) + (formData.cont40 || 0);
        newFeeCic = totalCont * 200000;
    }

    setFormData(prev => {
        const updates: Partial<JobData> = {};
        let hasChanges = false;

        if (prev.feeKimberry !== totalFeeKimberry) {
            updates.feeKimberry = totalFeeKimberry;
            hasChanges = true;
        }

        // Only update CIC if it meets the year condition and value has changed
        // This ensures if user manually edited it for >= 2026, it snaps back if conts change
        if ((prev.year || 0) >= 2026 && prev.feeCic !== newFeeCic) {
            updates.feeCic = newFeeCic;
            hasChanges = true;
        }

        if (hasChanges) {
            return { ...prev, ...updates };
        }
        return prev;
    });
  }, [formData.cont20, formData.cont40, formData.year, isViewMode]);

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

  const handleCustomerInputChange = (val: string) => {
    if (isViewMode) return;
    setCustCodeInput(val);
    setShowSuggestions(true);

    let match = (customers || []).find(c => c.id === val);

    if (!match) {
        match = (customers || []).find(c => c?.code && String(c.code).toLowerCase() === val.toLowerCase().trim());
    }
    
    if (!match) {
         match = (customers || []).find(c => c?.name && String(c.name).toLowerCase() === val.toLowerCase().trim());
    }
    
    if (match) {
        setFormData(prev => ({ 
            ...prev, 
            customerId: match.id,
            customerName: match.name
        }));
    } else {
        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
    }
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

  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
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

    // --- AUTO-UPDATE DESCRIPTIONS LOGIC ---
    let finalJobData = { ...formData };
    const jobCodePlaceholder = `XXX BL ${finalJobData.jobCode}`;

    if (initialData) {
        // 1. Local Charge Update
        const oldLcInv = String(initialData.localChargeInvoice || '').trim();
        const newLcInv = String(finalJobData.localChargeInvoice || '').trim();

        if (newLcInv && newLcInv !== oldLcInv) {
            const updateLcText = (text: string) => {
                if (!text) return text;
                let res = text;
                // 1. Replace Placeholder (XXX BL JOB...)
                res = res.split(jobCodePlaceholder).join(newLcInv);
                // 2. Replace Old Invoice if it existed
                if (oldLcInv) res = res.split(oldLcInv).join(newLcInv);
                return res;
            };

            // Update Main Receipt Description
            if (finalJobData.amisLcDesc) {
                finalJobData.amisLcDesc = updateLcText(finalJobData.amisLcDesc);
            }
            // Update Additional Receipts
            if (finalJobData.additionalReceipts) {
                finalJobData.additionalReceipts = finalJobData.additionalReceipts.map(r => {
                    if ((r.type === 'local' || r.type === 'other') && r.desc) {
                        return { ...r, desc: updateLcText(r.desc) };
                    }
                    return r;
                });
            }
        }

        // 2. Extensions Update
        if (finalJobData.extensions && initialData.extensions) {
            finalJobData.extensions = finalJobData.extensions.map(newExt => {
                const oldExt = initialData.extensions?.find(e => e.id === newExt.id);
                const oldExtInv = String(oldExt ? oldExt.invoice : '').trim();
                const newExtInv = String(newExt.invoice || '').trim();

                if (newExtInv && newExtInv !== oldExtInv) {
                    const updateExtText = (text: string) => {
                        if (!text) return text;
                        let res = text;
                        // 1. Replace Placeholder
                        res = res.split(jobCodePlaceholder).join(newExtInv);
                        // 2. Replace Old Invoice
                        if (oldExtInv) res = res.split(oldExtInv).join(newExtInv);
                        return res;
                    };

                    // Update Main Extension Description
                    if (newExt.amisDesc) {
                        newExt.amisDesc = updateExtText(newExt.amisDesc);
                    }
                    
                    // Update Additional Receipts linked to this extension
                    if (finalJobData.additionalReceipts) {
                        finalJobData.additionalReceipts = finalJobData.additionalReceipts.map(r => {
                            if (r.type === 'extension' && r.extensionId === newExt.id && r.desc) {
                                return { ...r, desc: updateExtText(r.desc) };
                            }
                            return r;
                        });
                    }
                }
                return newExt;
            });
        }
    } else {
        // Handle New Job creation where placeholders might exist in defaults
        const newLcInv = (finalJobData.localChargeInvoice || '').trim();
        if (newLcInv) {
             const updateLcText = (text: string) => {
                if (!text) return text;
                return text.split(jobCodePlaceholder).join(newLcInv);
            };
            if (finalJobData.amisLcDesc) finalJobData.amisLcDesc = updateLcText(finalJobData.amisLcDesc);
        }
    }

    onSave(finalJobData);
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

  // --- QUICK ADD CUSTOMER HANDLERS ---
  const handleOpenQuickAdd = (type: 'MAIN' | 'DEPOSIT' | 'EXTENSION', extId?: string) => {
      setQuickAddTarget({ type, extId });
  };

  const handleSaveQuickCustomer = (newCustomer: Customer) => {
      onAddCustomer(newCustomer);
      
      if (quickAddTarget?.type === 'MAIN') {
          setCustCodeInput(newCustomer.code);
          setFormData(prev => ({ 
              ...prev, 
              customerId: newCustomer.id,
              customerName: newCustomer.name
          }));
      } else if (quickAddTarget?.type === 'DEPOSIT') {
          setFormData(prev => ({ ...prev, maKhCuocId: newCustomer.id }));
      } else if (quickAddTarget?.type === 'EXTENSION' && quickAddTarget.extId) {
          handleExtensionChange(quickAddTarget.extId, 'customerId', newCustomer.id);
      }
      
      setQuickAddTarget(null);
  };

  const selectedCust = (customers || []).find(c => c?.id === formData.customerId);
  const displayCustNameLongHoang = selectedCust?.name || formData.customerName || '';
  const nameLowerLongHoang = displayCustNameLongHoang.toLowerCase();
  const codeLowerLongHoang = (selectedCust?.code || '').toLowerCase(); 

  const isLongHoang = nameLowerLongHoang.includes('long hoàng') || 
                      nameLowerLongHoang.includes('long hoang') || 
                      nameLowerLongHoang.includes('lhk') || 
                      nameLowerLongHoang.includes('longhoang') ||
                      codeLowerLongHoang.includes('longhoang') ||
                      codeLowerLongHoang.includes('lhk');

  // PASS EXISTING JOBS AND CUSTOM RECEIPTS FOR ACCURATE CALCULATION
  const paymentStatus = calculatePaymentStatus(formData, existingJobs, customReceipts);

  // Extract receipt doc numbers for display
  const receiptDocs = useMemo(() => {
      const docs = [];
      if (formData.amisLcDocNo) docs.push({ type: 'local', docNo: formData.amisLcDocNo, label: 'LC' });
      if (formData.amisDepositDocNo) docs.push({ type: 'deposit', docNo: formData.amisDepositDocNo, label: 'Cược' });
      
      const extDocs = new Set();
      (formData.extensions || []).forEach(ext => {
          if (ext.amisDocNo && !extDocs.has(ext.amisDocNo)) {
              extDocs.add(ext.amisDocNo);
              docs.push({ type: 'extension', docNo: ext.amisDocNo, label: 'GH' });
          }
      });
      return docs;
  }, [formData]);

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
            {/* Display Related Receipts */}
            {receiptDocs.length > 0 && isViewMode && (
                <div className="flex gap-2 mt-1">
                    {receiptDocs.map((doc, idx) => (
                        <button 
                            key={idx}
                            onClick={() => onViewReceipt && onViewReceipt(formData, doc.type as any)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-1 transition-colors"
                            title="Click để xem phiếu thu"
                        >
                            <Receipt className="w-3 h-3" /> {doc.label}: {doc.docNo}
                        </button>
                    ))}
                </div>
            )}
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
                        <Label>Tháng / Năm</Label>
                        <div className="flex gap-2">
                            <Select name="month" value={formData.month} onChange={handleChange} disabled={isViewMode} className="min-w-[70px]">
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </Select>
                            <Select 
                                name="year" 
                                value={formData.year} 
                                onChange={(e) => setFormData(prev => ({...prev, year: Number(e.target.value)}))} 
                                disabled={isViewMode} 
                                className="min-w-[80px] font-bold text-blue-700"
                            >
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </Select>
                        </div>
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
                        <CustomerInput 
                            value={custCodeInput} 
                            onChange={handleCustomerInputChange} 
                            onFocus={() => setShowSuggestions(true)} 
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                            readOnly={isViewMode} 
                            placeholder={isViewMode ? "" : "Tìm KH..."} 
                            customers={customers} 
                            onAddClick={() => handleOpenQuickAdd('MAIN')}
                        />
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
                            <MoneyInput label="Phí THC" name="feeCic" value={formData.feeCic} onChange={handleMoneyChange} readOnly={isViewMode} />
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
                            {/* Refunds Display */}
                            {formData.refunds && formData.refunds.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <Label>Đã hoàn trả (Refunds):</Label>
                                    {formData.refunds.map((ref, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-red-600 font-medium">
                                            <span>{ref.docNo} ({formatDateVN(ref.date)})</span>
                                            <span>-{new Intl.NumberFormat('en-US').format(ref.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Deposit Box */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative">
                            <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 uppercase">Deposit (Cược)</div>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                <div className="col-span-2">
                                    <Label>KH Cược</Label>
                                    <CustomerInput 
                                        value={formData.maKhCuocId} 
                                        onChange={(val) => setFormData(prev => ({ ...prev, maKhCuocId: val }))} 
                                        customers={customers} 
                                        readOnly={isViewMode} 
                                        placeholder="Mã KH..." 
                                        className="h-9" 
                                        onAddClick={() => handleOpenQuickAdd('DEPOSIT')}
                                    />
                                </div>
                                <div>
                                    <MoneyInput 
                                        label="Tiền Cược" 
                                        name="thuCuoc" 
                                        value={formData.thuCuoc} 
                                        onChange={handleMoneyChange} 
                                        readOnly={isViewMode} 
                                        className="text-orange-700" 
                                        rightElement={
                                            <div className="flex gap-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleCopyText(formData.thuCuoc.toString(), 'deposit-amt')}
                                                    className="h-9 w-9 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                    title="Copy số tiền"
                                                >
                                                    {copiedField === 'deposit-amt' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleCopyText(`PAYMENT HOAN CUOC BL ${formData.jobCode || ''} MST 0316113070`, 'deposit-txt')}
                                                    className="h-9 w-9 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                    title="Copy nội dung chuyển khoản"
                                                >
                                                    {copiedField === 'deposit-txt' ? <Check className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4" />}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleCopyText("doc_hph@kimberryline.com", 'email-txt')}
                                                    className="h-9 w-9 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                    title="Copy Email: doc_hph@kimberryline.com"
                                                >
                                                    {copiedField === 'email-txt' ? <Check className="w-4 h-4 text-green-500" /> : <Mail className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        }
                                    />
                                </div>
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
                            <div className="col-span-5">
                                <Label>Khách hàng</Label>
                                <CustomerInput 
                                    value={ext.customerId} 
                                    onChange={(val) => handleExtensionChange(ext.id, 'customerId', val)} 
                                    customers={customers} 
                                    readOnly={isViewMode} 
                                    placeholder="Mã KH" 
                                    className="h-8 text-xs" 
                                    onAddClick={() => handleOpenQuickAdd('EXTENSION', ext.id)}
                                />
                            </div>
                            <div className="col-span-3"><Label>Invoice</Label><Input value={ext.invoice} onChange={(e) => handleExtensionChange(ext.id, 'invoice', e.target.value)} readOnly={isViewMode} className="h-8 text-xs" /></div>
                            <div className="col-span-3"><Label>Amount</Label><input type="text" value={new Intl.NumberFormat('en-US').format(ext.total)} onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleExtensionChange(ext.id, 'total', val); }} readOnly={isViewMode} className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-orange-500 text-right font-bold text-orange-700 h-8" placeholder="0" /></div>
                            <div className="col-span-1 flex justify-center">{!isViewMode && <button type="button" onClick={() => removeExtension(ext.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
                        </div>
                    ))}
                    {(!formData.extensions || formData.extensions.length === 0) && <div className="text-xs text-slate-400 italic text-center py-2">Chưa có phát sinh</div>}
                </div>
            </div>

            {/* 4. PAYMENT WARNING */}
            {paymentStatus.hasMismatch && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-yellow-100 rounded-full shrink-0">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-yellow-800 uppercase mb-1">Cảnh báo thanh toán</h4>
                        <div className="text-sm text-yellow-800 space-y-1">
                            {paymentStatus.lcDiff !== 0 && (
                                <p>
                                    Local Charge: 
                                    <span className="font-bold ml-1">
                                        {paymentStatus.lcDiff > 0 ? 'Dư' : 'Thiếu'} {new Intl.NumberFormat('en-US').format(Math.abs(paymentStatus.lcDiff))}
                                    </span>
                                </p>
                            )}
                            {paymentStatus.depositDiff !== 0 && (
                                <p>
                                    Cược (Deposit): 
                                    <span className="font-bold ml-1">
                                        {paymentStatus.depositDiff > 0 ? 'Dư' : 'Thiếu'} {new Intl.NumberFormat('en-US').format(Math.abs(paymentStatus.depositDiff))}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

      {/* CUSTOMER MODAL FOR QUICK ADD */}
      <CustomerModal 
          isOpen={!!quickAddTarget} 
          onClose={() => setQuickAddTarget(null)} 
          onSave={handleSaveQuickCustomer} 
      />
    </div>,
    document.body
  );
};
