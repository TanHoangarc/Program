
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit2, Calendar } from 'lucide-react';
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

// Styled Input Components
const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    {...props} 
    ref={ref}
    value={props.value ?? ''}
    className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-50 disabled:text-slate-500 placeholder-slate-400 transition-all shadow-sm ${props.className || ''}`}
  />
));
Input.displayName = 'Input';

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
        className="pr-10"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      {...props}
      className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-50 disabled:text-slate-500 transition-all shadow-sm appearance-none ${props.className || ''}`}
    >
      {props.children}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
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
    <div className="flex items-center">
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange(Math.max(0, (value || 0) - 1))}
          className="w-10 h-10 border border-slate-200 rounded-l-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      )}
      <div className={`flex-1 h-10 flex items-center justify-center border-y border-slate-200 bg-white text-sm font-bold text-slate-800 ${readOnly ? 'border rounded-xl w-full px-3 justify-start bg-slate-50' : ''}`}>
        {value || 0}
      </div>
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange((value || 0) + 1)}
          className="w-10 h-10 border border-slate-200 rounded-r-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
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
}> = ({ value, name, onChange, label, readOnly }) => {
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
        className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-bold transition-all shadow-sm ${readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white text-blue-700'}`}
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

  const safeInput = (custCodeInput || '').toLowerCase().trim();
  const filteredCustomers = (customers || []).filter(c => {
    if (!c) return false;
    const code = String(c.code || '').toLowerCase();
    const name = String(c.name || '').toLowerCase();
    return code.includes(safeInput) || name.includes(safeInput);
  });

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

  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewMode) return;
    const val = e.target.value;
    setCustCodeInput(val);
    setShowSuggestions(true);

    const match = (customers || []).find(c => c?.code && String(c.code).toLowerCase() === val.toLowerCase().trim());
    
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

  const handleMstLookup = async () => {
    if (!newCustomer.mst) return;
    const mockNames = ['Công Ty TNHH Thương Mại Dịch Vụ ABC', 'Tập Đoàn XYZ', 'Logistics Global Solutions'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    setNewCustomer(prev => ({ ...prev, name: randomName }));
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

  const selectedCustomer = (customers || []).find(c => c?.id === formData.customerId);
  const displayCustName = selectedCustomer?.name || formData.customerName || '';
  const nameLower = displayCustName.toLowerCase();
  const isLongHoang = nameLower.includes('long hoàng') || 
                      nameLower.includes('long hoang') || 
                      nameLower.includes('lhk') || 
                      nameLower.includes('longhoang');
  const selectedLineName = (lines || []).find(l => l?.code === formData.line)?.name || '';

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50 ring-1 ring-black/5">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {isViewMode ? 'Chi Tiết Job' : (initialData ? 'Chỉnh sửa Job' : 'Thêm Job Mới')}
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {isViewMode ? 'Xem thông tin chi tiết lô hàng' : 'Nhập thông tin lô hàng và tài chính'}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* --- GENERAL INFO --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6 border-b border-slate-100 pb-3 flex items-center">
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                 Thông Tin Chung
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
                <div className="space-y-1">
                  <Label>Tháng</Label>
                  <Select name="month" value={formData.month} onChange={handleChange} disabled={isViewMode}>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Job Code</Label>
                  <Input 
                    name="jobCode" ref={jobInputRef} value={formData.jobCode} onChange={handleChange} readOnly={isViewMode} 
                    className={isViewMode ? "font-bold text-blue-700 bg-blue-50" : ""}
                    placeholder="VD: JOB123"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Booking</Label>
                  <div className="flex items-center space-x-1">
                    <Input name="booking" value={formData.booking} onChange={handleChange} readOnly={isViewMode} />
                    {formData.booking && (
                      <button 
                        type="button" 
                        onClick={handleBookingClick} 
                        className="p-2.5 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm" 
                        title="Xem chi tiết Booking"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Consol</Label>
                  <Input name="consol" value={formData.consol} onChange={handleChange} readOnly={isViewMode} />
                </div>

                <div className="space-y-1">
                  <Label>Line (Mã Line)</Label>
                  {!isAddingLine ? (
                    <>
                      <Select name="line" value={formData.line} onChange={handleLineSelectChange} disabled={isViewMode}>
                        <option value="">-- Chọn Line --</option>
                        {(lines || []).map((l, i) => <option key={i} value={l?.code}>{l?.code}</option>)}
                        {!isViewMode && <option value="new">+ Thêm Line mới</option>}
                      </Select>
                      {selectedLineName && <div className="text-[10px] text-slate-500 mt-1.5 truncate px-1">{selectedLineName}</div>}
                    </>
                  ) : (
                    <div className="flex space-x-1">
                      <Input value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder="Nhập Mã..." autoFocus />
                      <button type="button" onClick={saveNewLine} className="bg-green-500 text-white p-2.5 rounded-xl shadow-md hover:bg-green-600"><Check className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setIsAddingLine(false)} className="bg-slate-200 text-slate-600 p-2.5 rounded-xl hover:bg-slate-300"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-1 relative group">
                  <Label>Customer (Mã KH)</Label>
                  <div className="relative">
                     <Input 
                        value={custCodeInput} 
                        onChange={handleCustomerInputChange} 
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        readOnly={isViewMode}
                        placeholder={isViewMode ? "" : "Nhập mã KH hoặc tên..."}
                        className={isAddingCustomer ? "border-blue-500 ring-2 ring-blue-100" : ""}
                        autoComplete="off"
                     />
                     {!isViewMode && showSuggestions && custCodeInput && filteredCustomers.length > 0 && (
                        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mt-2 left-0 py-2">
                          {filteredCustomers.map(c => (
                            <li 
                              key={c.id}
                              onClick={() => handleSelectSuggestion(c)}
                              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 flex flex-col border-b border-slate-50 last:border-0 transition-colors"
                            >
                              <span className="font-bold text-blue-700">{c.code}</span>
                              <span className="text-xs text-slate-500 truncate">{c.name}</span>
                            </li>
                          ))}
                        </ul>
                     )}
                  </div>
                  {displayCustName && <div className="text-[10px] text-slate-500 mt-1.5 truncate font-medium px-1">{displayCustName}</div>}
                  {isAddingCustomer && !isViewMode && <div className="text-[10px] text-blue-600 mt-1 px-1 font-medium animate-pulse">* Đang thêm khách hàng mới</div>}
                </div>

                {isLongHoang && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                    <Label>HBL</Label>
                    <Input name="hbl" value={formData.hbl} onChange={handleChange} readOnly={isViewMode} className="bg-orange-50 border-orange-200 text-orange-800 focus:ring-orange-200" />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Transit</Label>
                  <Select name="transit" value={formData.transit} onChange={handleChange} disabled={isViewMode}>
                    {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
              </div>
              
              {isAddingCustomer && !isViewMode && (
                <div className="mt-4 p-5 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Thêm khách hàng mới</h4>
                    <button type="button" onClick={() => { setIsAddingCustomer(false); setCustCodeInput(''); setFormData(prev => ({...prev, customerId: '', customerName: ''})); }}><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex space-x-2 items-end">
                       <div className="flex-1">
                          <Label>MST</Label>
                          <Input value={newCustomer.mst} onChange={e => setNewCustomer(prev => ({...prev, mst: e.target.value}))} placeholder="Nhập MST" />
                       </div>
                       <button type="button" onClick={handleMstLookup} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all h-[42px]">Tra cứu</button>
                    </div>
                    <div>
                        <Label>Mã KH</Label>
                        <Input 
                            value={newCustomer.code} 
                            onChange={e => {
                                const val = e.target.value;
                                setNewCustomer(prev => ({...prev, code: val}));
                                setCustCodeInput(val); 
                            }} 
                        />
                    </div>
                    <div><Label>Tên công ty</Label><Input value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* --- FINANCE --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6 border-b border-slate-100 pb-3 flex items-center">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                 Tài Chính & Container
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly />
                <NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} readOnly={isViewMode} />
                <NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} readOnly={isViewMode} />
              </div>
            </div>

            {/* --- COST BREAKDOWN --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide mb-6 border-b border-slate-100 pb-3 flex items-center">
                 <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                 Chi Tiết Chi Phí
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <MoneyInput label="Phí CIC" name="feeCic" value={formData.feeCic} onChange={handleMoneyChange} readOnly={isViewMode} />
                <div className="relative">
                    <MoneyInput 
                        label="Phí Kimberry (Auto)" 
                        name="feeKimberry" 
                        value={formData.feeKimberry} 
                        onChange={handleMoneyChange} 
                        readOnly={true} 
                    />
                    {!isViewMode && <div className="absolute top-0 right-0 text-[10px] text-slate-400 italic">250k/20', 500k/40'</div>}
                </div>
                <MoneyInput label="Phí PSC" name="feePsc" value={formData.feePsc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí EMC" name="feeEmc" value={formData.feeEmc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí khác" name="feeOther" value={formData.feeOther} onChange={handleMoneyChange} readOnly={isViewMode} />
              </div>
            </div>

            {/* --- REVENUE IN --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-6 border-b border-slate-100 pb-3 flex items-center">
                 <div className="w-1.5 h-1.5 bg-blue-800 rounded-full mr-2"></div>
                 Thu (Revenue In)
              </h3>
              
              <div className="space-y-6">
                {/* Local Charge */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
                  <h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">LOCAL CHARGE</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><Label>Invoice</Label><Input name="localChargeInvoice" value={formData.localChargeInvoice} onChange={handleChange} readOnly={isViewMode} /></div>
                    <MoneyInput label="Amount" name="localChargeTotal" value={formData.localChargeTotal} onChange={handleMoneyChange} readOnly={isViewMode} />
                    <div><Label>Ngân hàng</Label>
                      <Select name="bank" value={formData.bank} onChange={handleChange} disabled={isViewMode}>
                        <option value="">-- Chọn --</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Deposit */}
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/60">
                   <h4 className="text-xs font-bold text-indigo-400 mb-4 uppercase tracking-wider">DEPOSIT (CƯỢC)</h4>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                     <div>
                        <Label>Khách hàng</Label>
                        <Select name="maKhCuocId" value={formData.maKhCuocId} onChange={handleChange} disabled={isViewMode}>
                          <option value="">-- Chọn KH --</option>
                          {(customers || []).map(c => <option key={c.id} value={c.id}>{c?.code}</option>)}
                        </Select>
                     </div>
                     <MoneyInput label="Cược" name="thuCuoc" value={formData.thuCuoc} onChange={handleMoneyChange} readOnly={isViewMode} />
                     <div>
                        <Label>Ngày Cược</Label>
                        <DateInput name="ngayThuCuoc" value={formData.ngayThuCuoc} onChange={handleChange} readOnly={isViewMode} />
                     </div>
                     <div>
                        <Label>Ngày Hoàn</Label>
                        <DateInput name="ngayThuHoan" value={formData.ngayThuHoan} onChange={handleChange} readOnly={isViewMode} />
                     </div>
                   </div>
                </div>
              </div>
            </div>

            {/* --- EXTENSIONS --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide flex items-center">
                   <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></div>
                   Gia Hạn
                </h3>
                {!isViewMode && (
                  <button type="button" onClick={addExtension} className="flex items-center space-x-1.5 text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm</span>
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {(formData.extensions || []).map((ext) => (
                   <div key={ext.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-orange-50/30 rounded-xl border border-orange-100 relative group items-end hover:shadow-sm transition-shadow">
                      {!isViewMode && (
                        <button type="button" onClick={() => removeExtension(ext.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 rounded-full"><Trash2 className="w-4 h-4" /></button>
                      )}
                      <div className="md:col-span-2">
                         <Label>Khách hàng</Label>
                         <Select value={ext.customerId} onChange={(e) => handleExtensionChange(ext.id, 'customerId', e.target.value)} disabled={isViewMode}>
                            <option value="">-- Chọn KH --</option>
                            {(customers || []).map(c => <option key={c.id} value={c.id}>{c?.code}</option>)}
                         </Select>
                      </div>
                      <div>
                        <Label>Invoice</Label>
                        <Input value={ext.invoice} onChange={(e) => handleExtensionChange(ext.id, 'invoice', e.target.value)} readOnly={isViewMode} />
                      </div>
                      <div>
                         <Label>Amount</Label>
                         <input
                            type="text"
                            value={new Intl.NumberFormat('en-US').format(ext.total)}
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) handleExtensionChange(ext.id, 'total', val);
                            }}
                            readOnly={isViewMode}
                            className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-right font-bold text-orange-700 bg-white transition-all ${isViewMode ? 'bg-transparent border-none' : ''}`}
                            placeholder="0"
                         />
                      </div>
                   </div>
                ))}
                {(!formData.extensions || formData.extensions.length === 0) && (
                   <div className="text-sm text-slate-400 italic text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">Chưa có thông tin gia hạn</div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 sticky bottom-0 z-10 bg-white/95 backdrop-blur-md p-4 -mx-8 -mb-8 rounded-b-3xl">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
              >
                Đóng
              </button>
              
              {isViewMode ? (
                <button
                    type="button"
                    onClick={handleEditClick}
                    className="px-6 py-3 bg-blue-900 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-all flex items-center shadow-lg hover:shadow-blue-900/20"
                >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Chỉnh sửa
                </button>
              ) : (
                <button 
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center transform active:scale-95 duration-100"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Lưu Thay Đổi
                </button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
