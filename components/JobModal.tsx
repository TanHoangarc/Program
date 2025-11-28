
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, Check, Minus, ExternalLink } from 'lucide-react';
import { JobData, INITIAL_JOB, Customer, ExtensionData } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: JobData, newCustomer?: Customer) => void;
  initialData?: JobData | null;
  customers: Customer[];
  lines: string[];
  onAddLine: (line: string) => void;
  onViewBookingDetails: (bookingId: string) => void;
}

const NumberStepper: React.FC<{
  value: number;
  onChange: (val: number) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <div className="flex flex-col space-y-1 w-full">
    <label className="text-xs font-medium text-gray-500">{label}</label>
    <div className="flex items-center space-x-2">
      <button 
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input 
        type="text" 
        readOnly
        value={value}
        className="w-12 text-center font-medium border-b border-gray-300 py-1 bg-transparent"
      />
      <button 
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-600 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
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
    setDisplayVal(value === 0 && !readOnly ? '' : new Intl.NumberFormat('en-US').format(value));
  }, [value, readOnly]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(raw))) {
      onChange(name || '', Number(raw));
    }
  };

  return (
    <div className="space-y-1 w-full">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <input
        type="text"
        value={displayVal}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder="0"
        className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-right ${readOnly ? 'bg-gray-100 text-gray-600 font-bold' : ''}`}
      />
    </div>
  );
};

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, onClose, onSave, initialData, customers, lines, onAddLine, onViewBookingDetails
}) => {
  const [formData, setFormData] = useState<JobData>(INITIAL_JOB);
  
  // Customer Logic
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ mst: '', name: '', code: '' });

  // Line Logic
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState('');
  
  const jobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(JSON.parse(JSON.stringify(initialData)));
      } else {
        setFormData({ ...INITIAL_JOB, id: Date.now().toString() });
      }
      setNewCustomer({ mst: '', name: '', code: '' });
      setIsAddingCustomer(false);
      setIsAddingLine(false);
      setNewLine('');
      
      setTimeout(() => jobInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  // Sync BookingCostDetails if they change in parent (e.g. via BookingDetailModal)
  useEffect(() => {
    if (isOpen && initialData?.bookingCostDetails) {
        setFormData(prev => ({
            ...prev,
            bookingCostDetails: initialData.bookingCostDetails
        }));
    }
  }, [initialData?.bookingCostDetails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMoneyChange = (name: string, val: number) => {
    setFormData(prev => {
      const newData: any = { ...prev, [name]: val };
      
      // Auto calc Profit
      if (name === 'cost' || name === 'sell') {
        newData.profit = (newData.sell || 0) - (newData.cost || 0);
      }
      
      return newData;
    });
  };

  // --- Line Handlers ---
  const handleLineSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') {
      setIsAddingLine(true);
      setFormData(prev => ({ ...prev, line: '' })); // Reset temporary
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

  // --- Customer Handlers ---
  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    if (custId === 'new') {
      setIsAddingCustomer(true);
      return;
    }
    const cust = customers.find(c => c.id === custId);
    setFormData(prev => ({ 
      ...prev, 
      customerId: custId,
      customerName: cust ? cust.name : ''
    }));
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
    setIsAddingCustomer(false);
    return newCustObj;
  };

  const handleMstLookup = async () => {
    if (!newCustomer.mst) return;
    const mockNames = ['Công Ty TNHH Thương Mại Dịch Vụ ABC', 'Tập Đoàn XYZ', 'Logistics Global Solutions'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    setNewCustomer(prev => ({ ...prev, name: randomName }));
  };

  // --- Extension Handlers ---
  const handleExtensionChange = (id: string, field: keyof ExtensionData, value: any) => {
    setFormData(prev => {
      const newExts = prev.extensions.map(ext => {
        if (ext.id === id) {
          const updated = { ...ext, [field]: value };
          // Auto calc total for extension removed as net/vat inputs are removed
          return updated;
        }
        return ext;
      });
      return { ...prev, extensions: newExts };
    });
  };

  const addExtension = () => {
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
    setFormData(prev => ({
      ...prev,
      extensions: prev.extensions.filter(ext => ext.id !== id)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let createdCustomer: Customer | undefined;
    if (isAddingCustomer) {
      createdCustomer = saveNewCustomer();
    }
    onSave(formData, createdCustomer);
  };

  const handleBookingClick = () => {
    if (formData.booking) {
      onViewBookingDetails(formData.booking);
    }
  };

  const selectedCustomerName = customers.find(c => c.id === formData.customerId)?.name || formData.customerName;
  const isLongHoang = selectedCustomerName === 'Long Hoàng Logistics';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Chỉnh sửa Job' : 'Thêm Job Mới'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-red-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* --- SECTION 1: GENERAL INFO --- */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-4 border-b pb-2">Thông Tin Chung</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Tháng</label>
                  <select name="month" value={formData.month} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Job</label>
                  <input type="text" name="jobCode" ref={jobInputRef} value={formData.jobCode} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-medium" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Booking</label>
                  <input type="text" name="booking" value={formData.booking} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Consol</label>
                  <input type="text" name="consol" value={formData.consol} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" placeholder="Nhập Consol..." />
                </div>

                {/* Line Selection with Sub-form */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Line</label>
                  {!isAddingLine ? (
                    <select 
                      name="line" 
                      value={formData.line} 
                      onChange={handleLineSelectChange} 
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn Line --</option>
                      {lines.map((l, i) => <option key={i} value={l}>{l}</option>)}
                      <option value="new" className="text-blue-600 font-bold">+ Thêm Line mới</option>
                    </select>
                  ) : (
                    <div className="flex space-x-1">
                      <input 
                        type="text" 
                        value={newLine}
                        onChange={(e) => setNewLine(e.target.value)}
                        placeholder="Nhập tên Line..."
                        autoFocus
                        className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={saveNewLine} className="bg-green-600 text-white p-2 rounded hover:bg-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setIsAddingLine(false)} className="bg-gray-200 text-gray-600 p-2 rounded hover:bg-gray-300">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <label className="text-xs font-medium text-gray-500">Customer</label>
                  <div className="flex space-x-2">
                    <select 
                      name="customerId" 
                      value={isAddingCustomer ? 'new' : formData.customerId} 
                      onChange={handleCustomerChange} 
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                      <option value="new" className="text-blue-600 font-bold">+ Thêm khách hàng mới</option>
                    </select>
                  </div>
                </div>

                {/* Conditional HBL */}
                {isLongHoang && (
                  <div className="space-y-1 animate-in slide-in-from-left duration-300">
                    <label className="text-xs font-medium text-gray-500">HBL</label>
                    <input type="text" name="hbl" value={formData.hbl} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-yellow-50" />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Transit</label>
                  <select name="transit" value={formData.transit} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                    {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Add Customer Inline Form */}
              {isAddingCustomer && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in slide-in-from-top duration-200">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-blue-700 uppercase">Thêm khách hàng mới</h4>
                    <button type="button" onClick={() => setIsAddingCustomer(false)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-xs font-medium text-gray-500">MST</label>
                      <div className="flex">
                         <input 
                           type="text" 
                           value={newCustomer.mst} 
                           onChange={e => setNewCustomer(prev => ({...prev, mst: e.target.value}))} 
                           className="w-full p-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-500" 
                           placeholder="Nhập MST"
                         />
                         <button type="button" onClick={handleMstLookup} className="bg-blue-600 text-white px-3 rounded-r hover:bg-blue-700 text-xs font-medium">Tra cứu</button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Mã KH</label>
                      <input 
                        type="text" 
                        value={newCustomer.code} 
                        onChange={e => setNewCustomer(prev => ({...prev, code: e.target.value}))} 
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" 
                        placeholder="VD: CUST001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Tên công ty</label>
                      <input 
                        type="text" 
                        value={newCustomer.name} 
                        onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} 
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" 
                        placeholder="Tự nhập hoặc tra cứu"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- SECTION 2: FINANCE --- */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-4 border-b pb-2">Tài Chính & Container</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} />
                <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} />
                <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly />
                
                <div className="flex items-end justify-center">
                  <NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} />
                </div>
                <div className="flex items-end justify-center">
                  <NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} />
                </div>
              </div>
            </div>

            {/* --- SECTION 3: CHI (Horizontal Layout) --- */}
            <div className="bg-red-50 p-5 rounded-lg border border-red-100 shadow-sm">
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-4 border-b border-red-200 pb-2">Chi (Payment Out)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-end space-x-2">
                  <MoneyInput label="Payment" name="chiPayment" value={formData.chiPayment} onChange={handleMoneyChange} />
                  {formData.booking && (
                    <button 
                      type="button" 
                      onClick={handleBookingClick}
                      className="mb-0.5 p-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 hover:text-red-700 transition-colors"
                      title="Xem chi tiết hóa đơn Booking"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <MoneyInput label="Cược (Deposit)" name="chiCuoc" value={formData.chiCuoc} onChange={handleMoneyChange} />
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ngày Cược</label>
                  <input type="date" name="ngayChiCuoc" value={formData.ngayChiCuoc} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ngày Hoàn</label>
                  <input type="date" name="ngayChiHoan" value={formData.ngayChiHoan} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
            </div>

            {/* --- SECTION 4: THU (Horizontal Layouts) --- */}
            <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 shadow-sm space-y-6">
              
              {/* Local Charge Row */}
              <div>
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide mb-4 border-b border-indigo-200 pb-2">Thu - Local Charge</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Invoice</label>
                    <input type="text" name="localChargeInvoice" value={formData.localChargeInvoice} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <MoneyInput label="Amount (Tổng)" name="localChargeTotal" value={formData.localChargeTotal} onChange={handleMoneyChange} />
                   <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Ngân hàng</label>
                    <select name="bank" value={formData.bank} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500">
                      <option value="">-- Chọn --</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Deposit Row */}
              <div>
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide mb-4 border-b border-indigo-200 pb-2">Thu - Deposit (Cược)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Khách hàng</label>
                    <select 
                      name="maKhCuocId" 
                      value={formData.maKhCuocId} 
                      onChange={handleChange} 
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                       <option value="">-- Chọn khách hàng --</option>
                       {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </select>
                  </div>
                  <MoneyInput label="Cược" name="thuCuoc" value={formData.thuCuoc} onChange={handleMoneyChange} />
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Ngày Cược</label>
                    <input type="date" name="ngayThuCuoc" value={formData.ngayThuCuoc} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Ngày Hoàn</label>
                    <input type="date" name="ngayThuHoan" value={formData.ngayThuHoan} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* --- SECTION 5: EXTENSIONS --- */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide">Gia Hạn</h3>
                <button type="button" onClick={addExtension} className="flex items-center space-x-1 text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded hover:bg-orange-200 transition-colors">
                  <Plus className="w-3 h-3" />
                  <span>Thêm gia hạn</span>
                </button>
              </div>
              
              {formData.extensions.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm italic">Chưa có thông tin gia hạn</div>
              ) : (
                <div className="space-y-4">
                  {formData.extensions.map((ext) => (
                    <div key={ext.id} className="p-4 bg-orange-50/50 rounded border border-orange-100 relative group">
                      <button type="button" onClick={() => removeExtension(ext.id)} className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-5 h-5" />
                      </button>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                         <div className="space-y-1 md:col-span-2">
                           <label className="text-xs font-medium text-gray-500">Khách hàng</label>
                           <select 
                              value={ext.customerId} 
                              onChange={(e) => handleExtensionChange(ext.id, 'customerId', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            >
                               <option value="">-- Chọn khách hàng --</option>
                               {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Invoice</label>
                            <input 
                              type="text" 
                              value={ext.invoice} 
                              onChange={(e) => handleExtensionChange(ext.id, 'invoice', e.target.value)} 
                              className="w-full p-2 border border-gray-300 rounded text-sm"
                            />
                         </div>
                         <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Amount (Tổng)</label>
                           <input
                            type="text"
                            value={new Intl.NumberFormat('en-US').format(ext.total)}
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) handleExtensionChange(ext.id, 'total', val);
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm font-mono text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-gray-50/50 backdrop-blur-sm p-4 -mx-6 -mb-6">
              <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors font-medium">
                Hủy
              </button>
              <button type="submit" className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl transform active:scale-95 duration-150">
                <Save className="w-4 h-4" />
                <span>Lưu Job</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
