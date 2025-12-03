
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit2 } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData, ShippingLine } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';
import { formatDateVN } from '../utils';

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
  existingJobs?: JobData[]; // Added for validation
}

// Styled Input Components
const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    {...props} 
    ref={ref}
    // Fix: Ensure value is never null/undefined to prevent uncontrolled warning
    value={props.value ?? ''}
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 disabled:bg-gray-50 disabled:text-gray-500 placeholder-gray-400 transition-shadow ${props.className || ''}`}
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
  if (readOnly) {
    return (
      <Input 
        value={formatDateVN(value)} 
        readOnly 
        className="bg-gray-50"
      />
    );
  }
  return <Input type="date" name={name} value={value || ''} onChange={onChange} />;
};

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 disabled:bg-gray-50 disabled:text-gray-500 transition-shadow ${props.className || ''}`}
  >
    {props.children}
  </select>
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
          className="w-9 h-9 border border-gray-300 rounded-l bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
      )}
      <div className={`flex-1 h-9 flex items-center justify-center border-y border-gray-300 bg-white text-sm font-semibold ${readOnly ? 'border rounded w-full px-3 justify-start' : ''}`}>
        {value || 0}
      </div>
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange((value || 0) + 1)}
          className="w-9 h-9 border border-gray-300 rounded-r bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
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
}> = ({ value, name, onChange, label, readOnly }) => {
  const [displayVal, setDisplayVal] = useState('');

  useEffect(() => {
    // Check for null/undefined
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
        className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-right font-medium ${readOnly ? 'bg-gray-50 text-gray-700 font-bold' : ''}`}
      />
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails,
  isViewMode = false, onSwitchToEdit, existingJobs
}) => {
  // Lazy init to ensure robust state start
  const [formData, setFormData] = useState<JobData>(() => {
    if (initialData) {
      // CRITICAL FIX: Merge with INITIAL_JOB to ensure all fields (extensions, new fees) exist
      // This prevents "White Screen" crashes when opening old jobs
      try {
        const parsed = JSON.parse(JSON.stringify(initialData));
        
        // Force date fields to be strings to prevent formatting crashes
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
          // Explicitly force arrays to be arrays (handle null/undefined from JSON)
          extensions: Array.isArray(safeParsed.extensions) ? safeParsed.extensions : [],
          // Ensure nested objects are not null
          bookingCostDetails: safeParsed.bookingCostDetails || undefined
        };
      } catch (e) {
        return { ...INITIAL_JOB, id: Date.now().toString() };
      }
    } else {
      return { ...INITIAL_JOB, id: Date.now().toString() };
    }
  });

  // State for Customer Input
  const [custCodeInput, setCustCodeInput] = useState(() => {
    if (initialData?.customerId) {
        // Safe check for customer existence and code property
        const c = (customers || []).find(c => c?.id === initialData.customerId);
        return c?.code || ''; // Ensure it returns a string, never undefined
    }
    return '';
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ mst: '', name: '', code: '' });
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState('');
  
  const jobInputRef = useRef<HTMLInputElement>(null);

  // Focus effect for new entries
  useEffect(() => {
    if (isOpen && !initialData && !isViewMode) {
       setTimeout(() => jobInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData, isViewMode]);

  // Sync booking details if they change externally while modal is open (unlikely with current conditional render but good practice)
  useEffect(() => {
    if (isOpen && initialData?.bookingCostDetails) {
        setFormData(prev => ({ ...prev, bookingCostDetails: initialData.bookingCostDetails }));
    }
  }, [initialData?.bookingCostDetails, isOpen]);

  // NEW: Auto-calculate Kimberry Fee based on containers
  useEffect(() => {
    if (isViewMode) return;
    const fee20 = (formData.cont20 || 0) * 250000;
    const fee40 = (formData.cont40 || 0) * 500000;
    const totalFee = fee20 + fee40;
    
    // Only update if different to avoid infinite loops, but enforce formula
    // Removed formData.feeKimberry from dependency array to prevent cyclic updates
    setFormData(prev => {
        if (prev.feeKimberry !== totalFee) {
            return { ...prev, feeKimberry: totalFee };
        }
        return prev;
    });
  }, [formData.cont20, formData.cont40, isViewMode]);

  // Filter customers for custom dropdown - STARTS WITH logic
  // Safe check: c?.code ensures we don't crash on malformed customer data
  // Ensure custCodeInput is treated as string
  const safeInput = (custCodeInput || '').toLowerCase();
  
  const filteredCustomers = (customers || []).filter(c => 
    c?.code && c.code.toLowerCase().startsWith(safeInput)
  );

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

    // Exact match check to auto-select
    // Safe check: c?.code prevents crash if customer list has issues
    const match = (customers || []).find(c => c?.code && c.code.toLowerCase() === val.toLowerCase());
    
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

    // --- VALIDATION SECTION ---
    const code = formData.jobCode || '';
    
    // 1. Check required
    if (!code.trim()) {
      alert("Vui lòng nhập Job Code");
      return;
    }

    // 2. Check for whitespace
    if (/\s/.test(code)) {
      alert("Job Code không được chứa khoảng trắng. Vui lòng kiểm tra lại.");
      return;
    }

    // 3. Check for uniqueness
    if (existingJobs) {
      const isDuplicate = existingJobs.some(j => 
        j.jobCode.toLowerCase() === code.toLowerCase() && 
        j.id !== formData.id // Exclude current job if editing
      );
      
      if (isDuplicate) {
        alert(`Job Code "${code}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`);
        return;
      }
    }
    // --------------------------

    let createdCustomer: Customer | undefined;
    if (isAddingCustomer) {
      createdCustomer = saveNewCustomer();
      if (!createdCustomer) {
         alert("Vui lòng nhập thông tin khách hàng mới");
         return;
      }
    }
    
    // Prepare final data
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

  // Safe checks for lookup
  const selectedCustomerName = (customers || []).find(c => c?.id === formData.customerId)?.name || formData.customerName;
  const isLongHoang = selectedCustomerName === 'Long Hoàng Logistics';
  const selectedLineName = (lines || []).find(l => l?.code === formData.line)?.name || '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isViewMode ? 'Chi Tiết Job' : (initialData ? 'Chỉnh sửa Job' : 'Thêm Job Mới')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isViewMode ? 'Xem thông tin chi tiết lô hàng' : 'Nhập thông tin lô hàng và tài chính'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* --- GENERAL INFO --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2">Thông Tin Chung</h3>
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
                    className={isViewMode ? "font-bold text-blue-900" : ""}
                    placeholder="VD: JOB123 (Không khoảng trắng)"
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
                        className="p-2 bg-gray-100 text-gray-600 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-900 transition-colors" 
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
                        {!isViewMode && <option value="new" className="font-bold text-blue-600">+ Thêm Line mới</option>}
                      </Select>
                      {selectedLineName && <div className="text-[10px] text-gray-500 mt-1 truncate">{selectedLineName}</div>}
                    </>
                  ) : (
                    <div className="flex space-x-1">
                      <Input value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder="Nhập Mã Line..." autoFocus />
                      <button type="button" onClick={saveNewLine} className="bg-green-600 text-white p-2 rounded"><Check className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setIsAddingLine(false)} className="bg-gray-200 text-gray-600 p-2 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {/* CUSTOMER INPUT REPLACEMENT - CUSTOM DROPDOWN */}
                <div className="lg:col-span-2 space-y-1 relative group">
                  <Label>Customer (Mã KH)</Label>
                  <div className="relative">
                     <Input 
                        value={custCodeInput} 
                        onChange={handleCustomerInputChange} 
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        readOnly={isViewMode}
                        placeholder={isViewMode ? "" : "Nhập mã KH..."}
                        className={isAddingCustomer ? "border-blue-500 ring-1 ring-blue-500" : ""}
                        autoComplete="off"
                     />
                     
                     {/* Custom Dropdown List */}
                     {!isViewMode && showSuggestions && custCodeInput && filteredCustomers.length > 0 && (
                        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-b-md shadow-lg max-h-60 overflow-y-auto mt-1 left-0">
                          {filteredCustomers.map(c => (
                            <li 
                              key={c.id}
                              onClick={() => handleSelectSuggestion(c)}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex flex-col border-b border-gray-50 last:border-0"
                            >
                              <span className="font-bold text-blue-800">{c.code}</span>
                              <span className="text-xs text-gray-500 truncate">{c.name}</span>
                            </li>
                          ))}
                        </ul>
                     )}
                  </div>
                  {selectedCustomerName && <div className="text-[10px] text-gray-500 mt-1 truncate font-medium">{selectedCustomerName}</div>}
                  {isAddingCustomer && !isViewMode && <div className="text-[10px] text-blue-600 mt-1 italic">* Đang thêm khách hàng mới</div>}
                </div>

                {isLongHoang && (
                  <div className="space-y-1 animate-in slide-in-from-left">
                    <Label>HBL</Label>
                    <Input name="hbl" value={formData.hbl} onChange={handleChange} readOnly={isViewMode} className="bg-yellow-50 border-yellow-200" />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Transit</Label>
                  <Select name="transit" value={formData.transit} onChange={handleChange} disabled={isViewMode}>
                    {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
              </div>
              
              {/* Inline Add Customer */}
              {isAddingCustomer && !isViewMode && (
                <div className="mt-4 p-4 bg-blue-50/50 rounded border border-blue-100 animate-in slide-in-from-top">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-blue-900 uppercase">Thêm khách hàng mới</h4>
                    <button type="button" onClick={() => { setIsAddingCustomer(false); setCustCodeInput(''); setFormData(prev => ({...prev, customerId: '', customerName: ''})); }}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex space-x-2 items-end">
                       <div className="flex-1">
                          <Label>MST</Label>
                          <Input value={newCustomer.mst} onChange={e => setNewCustomer(prev => ({...prev, mst: e.target.value}))} placeholder="Nhập MST" />
                       </div>
                       <button type="button" onClick={handleMstLookup} className="bg-blue-900 text-white px-3 py-2 rounded text-xs font-medium h-[38px]">Tra cứu</button>
                    </div>
                    <div>
                        <Label>Mã KH</Label>
                        <Input 
                            value={newCustomer.code} 
                            onChange={e => {
                                const val = e.target.value;
                                setNewCustomer(prev => ({...prev, code: val}));
                                setCustCodeInput(val); // Sync main input
                            }} 
                        />
                    </div>
                    <div><Label>Tên công ty</Label><Input value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* --- FINANCE --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2">Tài Chính & Container</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Changed Order: Sell then Cost */}
                <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly />
                <NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} readOnly={isViewMode} />
                <NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} readOnly={isViewMode} />
              </div>
            </div>

            {/* --- COST BREAKDOWN --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-5 border-b pb-2">Chi Tiết Chi Phí</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <MoneyInput label="Phí CIC" name="feeCic" value={formData.feeCic} onChange={handleMoneyChange} readOnly={isViewMode} />
                {/* Updated Kimberry Input to be ReadOnly */}
                <div className="relative">
                    <MoneyInput 
                        label="Phí Kimberry (Auto)" 
                        name="feeKimberry" 
                        value={formData.feeKimberry} 
                        onChange={handleMoneyChange} 
                        readOnly={true} 
                    />
                    {!isViewMode && <div className="absolute top-0 right-0 text-[10px] text-gray-400 italic">250k/20', 500k/40'</div>}
                </div>
                <MoneyInput label="Phí PSC" name="feePsc" value={formData.feePsc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí EMC" name="feeEmc" value={formData.feeEmc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí khác" name="feeOther" value={formData.feeOther} onChange={handleMoneyChange} readOnly={isViewMode} />
              </div>
            </div>

            {/* --- REVENUE IN --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-5 border-b pb-2">Thu (Revenue In)</h3>
              
              <div className="space-y-6">
                {/* Local Charge */}
                <div className="bg-blue-50/30 p-4 rounded border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-800 mb-3">LOCAL CHARGE</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="bg-indigo-50/30 p-4 rounded border border-indigo-100">
                   <h4 className="text-xs font-bold text-indigo-800 mb-3">DEPOSIT (CƯỢC)</h4>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide">Gia Hạn</h3>
                {!isViewMode && (
                  <button type="button" onClick={addExtension} className="flex items-center space-x-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded hover:bg-orange-100 transition-colors">
                    <Plus className="w-3 h-3" />
                    <span>Thêm</span>
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {(formData.extensions || []).map((ext) => (
                   <div key={ext.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-orange-50/20 rounded border border-orange-100 relative group items-end">
                      {!isViewMode && (
                        <button type="button" onClick={() => removeExtension(ext.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                            className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 text-right font-bold text-orange-700 ${isViewMode ? 'bg-transparent border-none' : ''}`}
                            placeholder="0"
                         />
                      </div>
                   </div>
                ))}
                {(!formData.extensions || formData.extensions.length === 0) && (
                   <p className="text-sm text-gray-400 italic text-center py-2">Chưa có gia hạn nào</p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                Đóng
              </button>
              
              {isViewMode ? (
                <button
                    type="button"
                    onClick={handleEditClick}
                    className="px-6 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center shadow-md"
                >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Chỉnh sửa
                </button>
              ) : (
                <button 
                    type="submit"
                    className="px-6 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center shadow-md"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Lưu Job
                </button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
