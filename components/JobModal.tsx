

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
}

// Styled Input Components
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input 
    {...props} 
    ref={ref}
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
  return <Input type="date" name={name} value={value} onChange={onChange} />;
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
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 border border-gray-300 rounded-l bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
      )}
      <div className={`flex-1 h-9 flex items-center justify-center border-y border-gray-300 bg-white text-sm font-semibold ${readOnly ? 'border rounded w-full px-3 justify-start' : ''}`}>
        {value}
      </div>
      {!readOnly && (
        <button 
          type="button"
          onClick={() => onChange(value + 1)}
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
    setDisplayVal(value === 0 && !readOnly ? '' : new Intl.NumberFormat('en-US').format(value));
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
  isViewMode = false, onSwitchToEdit
}) => {
  const [formData, setFormData] = useState<JobData>(INITIAL_JOB);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ mst: '', name: '', code: '' });
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
      
      // Auto focus only on new entry, not when viewing/editing
      if (!initialData && !isViewMode) {
        setTimeout(() => jobInputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isOpen && initialData?.bookingCostDetails) {
        setFormData(prev => ({ ...prev, bookingCostDetails: initialData.bookingCostDetails }));
    }
  }, [initialData?.bookingCostDetails]);

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

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isViewMode) return;
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
    let createdCustomer: Customer | undefined;
    if (isAddingCustomer) {
      createdCustomer = saveNewCustomer();
    }
    onSave(formData, createdCustomer);
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

  const selectedCustomerName = customers.find(c => c.id === formData.customerId)?.name || formData.customerName;
  const isLongHoang = selectedCustomerName === 'Long Hoàng Logistics';
  const selectedLineName = lines.find(l => l.code === formData.line)?.name || '';

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
                        {lines.map((l, i) => <option key={i} value={l.code}>{l.code}</option>)}
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

                <div className="lg:col-span-2 space-y-1">
                  <Label>Customer (Mã KH)</Label>
                  <Select name="customerId" value={isAddingCustomer ? 'new' : formData.customerId} onChange={handleCustomerChange} disabled={isViewMode}>
                    <option value="">-- Chọn khách hàng --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                    {!isViewMode && <option value="new" className="font-bold text-blue-600">+ Thêm khách hàng mới</option>}
                  </Select>
                  {selectedCustomerName && <div className="text-[10px] text-gray-500 mt-1 truncate">{selectedCustomerName}</div>}
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
                    <button type="button" onClick={() => setIsAddingCustomer(false)}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex space-x-2 items-end">
                       <div className="flex-1">
                          <Label>MST</Label>
                          <Input value={newCustomer.mst} onChange={e => setNewCustomer(prev => ({...prev, mst: e.target.value}))} placeholder="Nhập MST" />
                       </div>
                       <button type="button" onClick={handleMstLookup} className="bg-blue-900 text-white px-3 py-2 rounded text-xs font-medium h-[38px]">Tra cứu</button>
                    </div>
                    <div><Label>Mã KH</Label><Input value={newCustomer.code} onChange={e => setNewCustomer(prev => ({...prev, code: e.target.value}))} /></div>
                    <div><Label>Tên công ty</Label><Input value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* --- FINANCE --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5 border-b pb-2">Tài Chính & Container</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <MoneyInput label="Cost (Chi phí)" name="cost" value={formData.cost} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Sell (Doanh thu)" name="sell" value={formData.sell} onChange={handleMoneyChange} readOnly={isViewMode} />
                <MoneyInput label="Profit (Lợi nhuận)" name="profit" value={formData.profit} onChange={handleMoneyChange} readOnly />
                <NumberStepper label="Cont 20'" value={formData.cont20} onChange={(val) => setFormData(prev => ({...prev, cont20: val}))} readOnly={isViewMode} />
                <NumberStepper label="Cont 40'" value={formData.cont40} onChange={(val) => setFormData(prev => ({...prev, cont40: val}))} readOnly={isViewMode} />
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
                  <Edit2 className="w-4 h-4" /> <span>Chỉnh sửa</span>
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
