
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink, Edit3, Calculator, FileText } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData, ShippingLine } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';
import { formatDateVN } from '../utils';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: JobData, newCustomer?: Customer) => void;
  initialData: JobData | null;
  customers: Customer[];
  lines: ShippingLine[];
  onAddLine: (line: string) => void;
  onViewBookingDetails: (bookingId: string) => void;
  isViewMode?: boolean;
  onSwitchToEdit?: () => void;
  jobs?: JobData[]; 
}

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    ref={ref}
    {...props} 
    value={props.value ?? ''} 
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT focus:border-brand-DEFAULT disabled:bg-gray-50 disabled:text-gray-500 transition-shadow ${props.className || ''}`}
  />
));

const DateInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    type="date"
    {...props}
    value={props.value || ''}
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT focus:border-brand-DEFAULT disabled:bg-gray-50 disabled:text-gray-500 ${props.className || ''}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT focus:border-brand-DEFAULT disabled:bg-gray-50 disabled:text-gray-500 ${props.className || ''}`}
  >
    {props.children}
  </select>
);

const NumberStepper = ({ label, value, onChange, readOnly }: { label: string, value: number, onChange: (val: number) => void, readOnly?: boolean }) => {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center">
        {!readOnly && (
          <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="p-2 bg-gray-100 border border-gray-300 rounded-l hover:bg-gray-200">
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
        )}
        <div className={`flex-1 px-3 py-2 border-y border-gray-300 text-center text-sm font-semibold bg-white ${readOnly ? 'border-x rounded' : ''}`}>
          {value}
        </div>
        {!readOnly && (
          <button type="button" onClick={() => onChange(value + 1)} className="p-2 bg-gray-100 border border-gray-300 rounded-r hover:bg-gray-200">
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
};

const MoneyInput = ({ label, value, onChange, name, readOnly }: { label: string, value: number, onChange: (name: string, val: number) => void, name: string, readOnly?: boolean }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value.replace(/,/g, ''));
    if (!isNaN(val)) onChange(name, val);
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <input 
        type="text" 
        value={value ? new Intl.NumberFormat('en-US').format(value) : ''} 
        onChange={handleChange}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT text-right font-bold text-gray-800 ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
        placeholder="0"
      />
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails,
  isViewMode = false, onSwitchToEdit, jobs = []
}) => {
  const [formData, setFormData] = useState<JobData>(() => {
    const base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...INITIAL_JOB, id: Date.now().toString() };
    if (!Array.isArray(base.extensions)) base.extensions = [];
    if (!base.bookingCostDetails) {
        base.bookingCostDetails = {
            localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0 },
            additionalLocalCharges: [],
            extensionCosts: [],
            deposits: []
        };
    }
    const dateFields = ['ngayChiCuoc', 'ngayChiHoan', 'localChargeDate', 'ngayThuCuoc', 'ngayThuHoan'];
    dateFields.forEach(f => {
        if (base[f]) base[f] = String(base[f]);
    });
    return base;
  });

  const [custCodeInput, setCustCodeInput] = useState(() => {
    if (initialData?.customerId) {
        const c = (customers || []).find(c => c?.id === initialData.customerId);
        return c?.code || ''; 
    }
    return '';
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ mst: '', name: '', code: '' });
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState('');
  const [jobCodeError, setJobCodeError] = useState('');
  
  const jobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !initialData && !isViewMode) {
       setTimeout(() => jobInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isViewMode) return;
    const fee20 = (formData.cont20 || 0) * 250000;
    const fee40 = (formData.cont40 || 0) * 500000;
    const totalFee = fee20 + fee40;
    if (formData.feeKimberry !== totalFee) {
        setFormData(prev => ({ ...prev, feeKimberry: totalFee }));
    }
  }, [formData.cont20, formData.cont40, isViewMode]); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (isViewMode) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleJobCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewMode) return;
    const rawVal = e.target.value;
    const val = rawVal.trim();

    const isDuplicate = jobs.some(j => 
        j.jobCode.toLowerCase() === val.toLowerCase() && 
        j.id !== formData.id
    );

    if (isDuplicate) {
        setJobCodeError('Mã Job này đã tồn tại!');
    } else {
        setJobCodeError('');
    }
    
    setFormData(prev => ({ ...prev, jobCode: val }));
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

  // CUSTOMER HANDLERS - SEARCHABLE INPUT (CODE OR NAME)
  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewMode) return;
    const val = e.target.value;
    setCustCodeInput(val);
    setShowSuggestions(true);

    const safeVal = val.toLowerCase();
    
    // Check if matches existing customers (Code or Name)
    const matches = (customers || []).filter(c => {
        const code = (c.code || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        return code.includes(safeVal) || name.includes(safeVal);
    });
    
    // If input is not empty AND no matches found, trigger ADD NEW mode
    if (matches.length === 0 && val.trim() !== '') {
        setIsAddingCustomer(true);
        // Reset form data for selected customer
        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
        // Pre-fill new customer code
        setNewCustomer(prev => ({ ...prev, code: val, name: '', mst: '' }));
    } else {
        setIsAddingCustomer(false);
        // If exact code match, we could auto-select, but let user click to be safe
        const exactCode = matches.find(c => c.code.toLowerCase() === safeVal);
        if (exactCode) {
             // Optional: auto-select logic could go here
        }
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

  // Filter for rendering list
  const safeInput = (custCodeInput || '').toLowerCase();
  const filteredCustomers = (customers || []).filter(c => {
      const code = (c?.code || '').toLowerCase();
      const name = (c?.name || '').toLowerCase();
      return code.includes(safeInput) || name.includes(safeInput);
  });

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
      const newExts = prev.extensions.map(ext => {
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
      extensions: [...prev.extensions, { 
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
      extensions: prev.extensions.filter(ext => ext.id !== id)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode && onSwitchToEdit) {
      onSwitchToEdit();
      return;
    }
    
    if (jobCodeError) {
        alert("Vui lòng sửa mã Job bị trùng trước khi lưu.");
        return;
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

  const selectedCustomerName = (customers || []).find(c => c?.id === formData.customerId)?.name || formData.customerName;
  const isLongHoang = (selectedCustomerName || '').toUpperCase().includes('LONG HOANG') || (selectedCustomerName || '').toUpperCase().includes('LONGHOANG');
  const selectedLineName = (lines || []).find(l => l?.code === formData.line)?.name || '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200">
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

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* GENERAL */}
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
                    name="jobCode" 
                    ref={jobInputRef} 
                    value={formData.jobCode} 
                    onChange={handleJobCodeChange} 
                    readOnly={isViewMode} 
                    className={`${isViewMode ? "font-bold text-blue-900" : ""} ${jobCodeError ? "border-red-500 ring-1 ring-red-500" : ""}`}
                  />
                  {jobCodeError && !isViewMode && <p className="text-[10px] text-red-600 font-bold mt-1">{jobCodeError}</p>}
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
                        {lines.map((l, i) => <option key={i} value={l.code}>{l?.code}</option>)}
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

                {/* CUSTOMER SEARCHABLE INPUT */}
                <div className="lg:col-span-2 space-y-1 relative group">
                  <Label>Customer (Mã KH hoặc Tên)</Label>
                  <div className="relative">
                     <Input 
                        value={custCodeInput} 
                        onChange={handleCustomerInputChange} 
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        readOnly={isViewMode}
                        placeholder={isViewMode ? "" : "Nhập Mã hoặc Tên KH..."}
                        className={isAddingCustomer ? "border-blue-500 ring-1 ring-blue-500" : ""}
                        autoComplete="off"
                     />
                     {/* Suggestion Dropdown */}
                     {!isViewMode && showSuggestions && filteredCustomers.length > 0 && (
                        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-b-md shadow-lg max-h-60 overflow-y-auto mt-1 left-0">
                          {filteredCustomers.map(c => (
                            <li 
                              key={c.id}
                              onClick={() => handleSelectSuggestion(c)}
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex flex-col border-b border-gray-50 last:border-0"
                            >
                              <span className="font-bold text-blue-800">{c.code}</span>
                              <span className="text-xs text-gray-600 truncate">{c.name}</span>
                            </li>
                          ))}
                        </ul>
                     )}
                  </div>
                  {selectedCustomerName && <div className="text-[10px] text-gray-500 mt-1 truncate font-medium">{selectedCustomerName}</div>}
                  {isAddingCustomer && !isViewMode && <div className="text-[10px] text-blue-600 mt-1 italic">* Mã KH mới - Đang tạo KH</div>}
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
                                setCustCodeInput(val);
                            }} 
                        />
                    </div>
                    <div><Label>Tên công ty</Label><Input value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* FINANCE */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2">Tài Chính & Container</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly />
                <NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} readOnly={isViewMode} />
                <NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} readOnly={isViewMode} />
              </div>
            </div>

            {/* COST DETAILS */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-5 border-b pb-2">Chi Tiết Chi Phí</h3>
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
                    {!isViewMode && <div className="absolute top-0 right-0 text-[10px] text-gray-400 italic">250k/20', 500k/40'</div>}
                </div>
                <MoneyInput label="Phí PSC" name="feePsc" value={formData.feePsc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí EMC" name="feeEmc" value={formData.feeEmc} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Phí khác" name="feeOther" value={formData.feeOther} onChange={handleMoneyChange} readOnly={isViewMode} />
              </div>
            </div>

            {/* REVENUE IN */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-5 border-b pb-2">Thu (Revenue In)</h3>
              <div className="space-y-6">
                <div className="bg-blue-50/30 p-4 rounded border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-800 mb-3">LOCAL CHARGE</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div><Label>Invoice</Label><Input name="localChargeInvoice" value={formData.localChargeInvoice} onChange={handleChange} readOnly={isViewMode} /></div>
                        <MoneyInput label="Amount" name="localChargeTotal" value={formData.localChargeTotal} onChange={handleMoneyChange} readOnly={isViewMode} />
                    </div>
                    <div><Label>Ngân hàng</Label>
                      <Select name="bank" value={formData.bank} onChange={handleChange} disabled={isViewMode}>
                        <option value="">-- Chọn --</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/30 p-4 rounded border border-indigo-100">
                   <h4 className="text-xs font-bold text-indigo-800 mb-3">DEPOSIT (CƯỢC)</h4>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div>
                        <Label>Khách hàng</Label>
                        <Select name="maKhCuocId" value={formData.maKhCuocId} onChange={handleChange} disabled={isViewMode}>
                          <option value="">-- Chọn KH --</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
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

            {/* EXTENSIONS */}
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
                {formData.extensions.map((ext) => (
                   <div key={ext.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-orange-50/20 rounded border border-orange-100 relative group items-end">
                      {!isViewMode && (
                        <button type="button" onClick={() => removeExtension(ext.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      )}
                      <div className="md:col-span-2">
                         <Label>Khách hàng</Label>
                         <Select value={ext.customerId} onChange={(e) => handleExtensionChange(ext.id, 'customerId', e.target.value)} disabled={isViewMode}>
                            <option value="">-- Chọn KH --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
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
                            className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 text-right font-medium ${isViewMode ? 'bg-gray-50' : ''}`}
                          />
                      </div>
                   </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
                {isViewMode ? 'Đóng' : 'Hủy bỏ'}
              </button>
              {isViewMode ? (
                <button type="button" onClick={handleEditClick} className="px-5 py-2.5 rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 transition-colors flex items-center space-x-2 shadow-sm">
                  <Edit3 className="w-4 h-4" /> <span>Chỉnh sửa</span>
                </button>
              ) : (
                <button type="submit" className="px-5 py-2.5 rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 transition-colors flex items-center space-x-2 shadow-sm">
                  <Save className="w-4 h-4" /> <span>Lưu thay đổi</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
