
import React, { useState, useEffect, useRef } from 'react';
import { JobData, Customer, ShippingLine, INITIAL_JOB } from '../types';
import { MONTHS, TRANSIT_PORTS, BANKS } from '../constants';
import { X, Save, Plus, ExternalLink, Edit3, Calculator, FileText } from 'lucide-react';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: JobData, newCustomer?: Customer) => void;
  initialData: JobData | null;
  customers: Customer[];
  lines: ShippingLine[];
  onAddLine: (line: string) => void;
  onViewBookingDetails: (bookingId: string) => void;
  isViewMode: boolean;
  onSwitchToEdit: () => void;
  jobs?: JobData[]; // Added for duplicate check
}

export const JobModal: React.FC<JobModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  customers,
  lines,
  onAddLine,
  onViewBookingDetails,
  isViewMode,
  onSwitchToEdit,
  jobs = []
}) => {
  const [formData, setFormData] = useState<JobData>(INITIAL_JOB);
  
  // New Customer State
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Customer>({ id: '', code: '', name: '', mst: '' });
  const [jobCodeError, setJobCodeError] = useState('');

  useEffect(() => {
    if (isOpen) {
        setJobCodeError(''); // Reset error on open
        if (initialData) {
            setFormData(JSON.parse(JSON.stringify(initialData)));
        } else {
            setFormData({ ...INITIAL_JOB, id: Date.now().toString() });
        }
    }
  }, [isOpen, initialData]);

  const handleChange = (field: keyof JobData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto calculate Profit
      if (['cost', 'sell'].includes(field)) {
        updated.profit = (updated.sell || 0) - (updated.cost || 0);
      }
      
      // Auto calculate Customer Name if ID changes
      if (field === 'customerId') {
          const cust = customers.find(c => c.id === value);
          if (cust) updated.customerName = cust.name;
      }

      return updated;
    });
  };

  // Dedicated Job Code Handler for Trim & Duplicate Check
  const handleJobCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Auto-trim spaces
    const val = rawVal.trim();

    // Check duplicate
    // Only check if it's a new job OR editing but code changed from initial
    const isDuplicate = jobs.some(j => 
        j.jobCode.toLowerCase() === val.toLowerCase() && 
        j.id !== formData.id
    );

    if (isDuplicate) {
        setJobCodeError('Mã Job này đã tồn tại!');
    } else {
        setJobCodeError('');
    }
    
    // Update state using the trimmed value
    handleChange('jobCode', val);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (jobCodeError) {
        alert("Vui lòng sửa mã Job bị trùng trước khi lưu.");
        return;
    }

    if (isAddingCustomer && newCustomer.name) {
       const custToAdd = { ...newCustomer, id: Date.now().toString() };
       onSave({ ...formData, customerId: custToAdd.id, customerName: custToAdd.name }, custToAdd);
    } else {
       onSave(formData);
    }
  };

  const handleBookingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (formData.booking) {
      onViewBookingDetails(formData.booking);
    }
  };

  // Safe checks for lookup
  const selectedCustomerName = customers.find(c => c.id === formData.customerId)?.name || formData.customerName;
  
  // UPDATED CHECK: Case-insensitive and accent-insensitive check for Long Hoang
  const isLongHoang = (selectedCustomerName || '').toUpperCase().includes('LONG HOANG') || (selectedCustomerName || '').toUpperCase().includes('LONGHOANG');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {isViewMode ? 'Chi Tiết Job' : (initialData ? 'Chỉnh Sửa Job' : 'Thêm Job Mới')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{formData.jobCode || 'New Job'}</p>
          </div>
          <div className="flex items-center space-x-2">
            {isViewMode && (
                <button 
                    onClick={onSwitchToEdit}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200"
                >
                    <Edit3 className="w-4 h-4" />
                    <span>Chỉnh sửa</span>
                </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
           <form id="jobForm" onSubmit={handleSave} className="space-y-6">
              
              {/* General Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Column 1 */}
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4">Thông tin chung</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Tháng</label>
                            <select 
                                disabled={isViewMode}
                                value={formData.month} 
                                onChange={(e) => handleChange('month', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                            >
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Job Code</label>
                            <input 
                                disabled={isViewMode}
                                type="text"
                                value={formData.jobCode}
                                onChange={handleJobCodeChange}
                                className={`w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 font-bold text-blue-700 ${jobCodeError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}`}
                                required
                            />
                            {jobCodeError && !isViewMode && (
                                <p className="text-[10px] text-red-600 font-bold mt-1">{jobCodeError}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                         <label className="text-xs font-semibold text-gray-500">Khách hàng</label>
                         {!isAddingCustomer ? (
                             <div className="flex space-x-2">
                                <select 
                                    disabled={isViewMode}
                                    value={formData.customerId}
                                    onChange={(e) => handleChange('customerId', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">-- Chọn khách hàng --</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {!isViewMode && (
                                    <button type="button" onClick={() => setIsAddingCustomer(true)} className="p-2 bg-gray-100 rounded border border-gray-300 hover:bg-gray-200">
                                        <Plus className="w-4 h-4 text-gray-600" />
                                    </button>
                                )}
                             </div>
                         ) : (
                             <div className="p-3 bg-blue-50 rounded border border-blue-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-blue-700">Thêm khách hàng mới</span>
                                    <button type="button" onClick={() => setIsAddingCustomer(false)} className="text-xs text-red-500 hover:underline">Hủy</button>
                                </div>
                                <input placeholder="Mã KH" className="w-full p-1.5 text-xs border rounded" value={newCustomer.code} onChange={e => setNewCustomer(prev => ({...prev, code: e.target.value}))} />
                                <input placeholder="Tên Công Ty" className="w-full p-1.5 text-xs border rounded" value={newCustomer.name} onChange={e => setNewCustomer(prev => ({...prev, name: e.target.value}))} />
                                <input placeholder="MST" className="w-full p-1.5 text-xs border rounded" value={newCustomer.mst} onChange={e => setNewCustomer(prev => ({...prev, mst: e.target.value}))} />
                             </div>
                         )}
                    </div>

                    {isLongHoang && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                             <label className="text-xs font-semibold text-orange-600">HBL (Long Hoàng)</label>
                             <input 
                                disabled={isViewMode}
                                type="text"
                                value={formData.hbl}
                                onChange={(e) => handleChange('hbl', e.target.value)}
                                className="w-full p-2 border border-orange-300 bg-orange-50 rounded text-sm focus:ring-1 focus:ring-orange-500 text-orange-800 font-medium"
                                placeholder="Nhập số HBL..."
                             />
                        </div>
                    )}
                 </div>

                 {/* Column 2 */}
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4">Vận đơn & Line</h3>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500">Booking Number</label>
                        <div className="flex items-center space-x-2">
                            <input 
                                disabled={isViewMode}
                                type="text"
                                value={formData.booking}
                                onChange={(e) => handleChange('booking', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 font-medium"
                            />
                            {formData.booking && (
                                <button 
                                    type="button"
                                    onClick={handleBookingClick}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100"
                                    title="Xem chi tiết Booking này"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500">Shipping Line</label>
                         <div className="flex space-x-2">
                            <select 
                                disabled={isViewMode}
                                value={formData.line}
                                onChange={(e) => handleChange('line', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">-- Chọn Line --</option>
                                {lines.map(l => <option key={l.id} value={l.code}>{l.code} - {l.name}</option>)}
                            </select>
                            {!isViewMode && (
                                <button type="button" onClick={() => {
                                    const newLine = prompt("Nhập tên hãng tàu mới:");
                                    if (newLine) onAddLine(newLine);
                                }} className="p-2 bg-gray-100 rounded border border-gray-300 hover:bg-gray-200">
                                    <Plus className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500">Transit Port</label>
                             <select 
                                disabled={isViewMode}
                                value={formData.transit}
                                onChange={(e) => handleChange('transit', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                            >
                                {TRANSIT_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500">Consol</label>
                             <input 
                                disabled={isViewMode}
                                type="text"
                                value={formData.consol}
                                onChange={(e) => handleChange('consol', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                placeholder="Yes/No..."
                            />
                        </div>
                    </div>
                 </div>

                 {/* Column 3: Volume & Financials */}
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4">Sản lượng & Lợi nhuận</h3>
                    
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                         <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500">Container 20'</label>
                             <input 
                                disabled={isViewMode}
                                type="number"
                                value={formData.cont20}
                                onChange={(e) => handleChange('cont20', Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 rounded text-sm text-center font-bold text-blue-600"
                            />
                        </div>
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500">Container 40'</label>
                             <input 
                                disabled={isViewMode}
                                type="number"
                                value={formData.cont40}
                                onChange={(e) => handleChange('cont40', Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 rounded text-sm text-center font-bold text-blue-600"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                         <div className="flex justify-between items-center">
                             <label className="text-xs font-semibold text-gray-500">COST (Chi)</label>
                             <input 
                                disabled={isViewMode}
                                type="number"
                                value={formData.cost}
                                onChange={(e) => handleChange('cost', Number(e.target.value))}
                                className="w-32 p-1.5 border border-gray-300 rounded text-sm text-right font-medium text-red-600"
                            />
                         </div>
                         <div className="flex justify-between items-center">
                             <label className="text-xs font-semibold text-gray-500">SELL (Thu)</label>
                             <input 
                                disabled={isViewMode}
                                type="number"
                                value={formData.sell}
                                onChange={(e) => handleChange('sell', Number(e.target.value))}
                                className="w-32 p-1.5 border border-gray-300 rounded text-sm text-right font-medium text-blue-600"
                            />
                         </div>
                         <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                             <label className="text-xs font-bold text-gray-700">PROFIT</label>
                             <span className={`text-lg font-bold ${formData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 {new Intl.NumberFormat('vi-VN').format(formData.profit)}
                             </span>
                         </div>
                    </div>
                 </div>
              </div>

              {/* Extra Sections (Collapsible or Tabbed) */}
              <div className="border-t border-gray-200 pt-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Invoice Info */}
                     <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">
                        <h4 className="text-sm font-bold text-blue-800 flex items-center"><FileText className="w-4 h-4 mr-2" /> Thông tin xuất hóa đơn (Local Charge)</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-blue-700">Số hóa đơn</label>
                                <input disabled={isViewMode} type="text" className="w-full p-2 border border-blue-200 rounded text-sm" value={formData.localChargeInvoice} onChange={e => handleChange('localChargeInvoice', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-blue-700">Ngày hóa đơn</label>
                                <input disabled={isViewMode} type="date" className="w-full p-2 border border-blue-200 rounded text-sm" value={formData.localChargeDate} onChange={e => handleChange('localChargeDate', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-blue-700">Net</label>
                                <input disabled={isViewMode} type="number" className="w-full p-2 border border-blue-200 rounded text-sm text-right" value={formData.localChargeNet} onChange={e => handleChange('localChargeNet', Number(e.target.value))} placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-blue-700">VAT</label>
                                <input disabled={isViewMode} type="number" className="w-full p-2 border border-blue-200 rounded text-sm text-right" value={formData.localChargeVat} onChange={e => handleChange('localChargeVat', Number(e.target.value))} placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-blue-700">Total</label>
                                <input disabled={isViewMode} type="number" className="w-full p-2 border border-blue-200 rounded text-sm text-right font-bold" value={formData.localChargeTotal} onChange={e => handleChange('localChargeTotal', Number(e.target.value))} placeholder="0" />
                            </div>
                        </div>
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-blue-700">Ngân hàng thanh toán</label>
                             <select disabled={isViewMode} className="w-full p-2 border border-blue-200 rounded text-sm" value={formData.bank} onChange={e => handleChange('bank', e.target.value)}>
                                 <option value="">-- Chọn ngân hàng --</option>
                                 {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                             </select>
                        </div>
                     </div>

                     {/* Fees Detail */}
                     <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                         <h4 className="text-sm font-bold text-gray-800 flex items-center"><Calculator className="w-4 h-4 mr-2" /> Các khoản phí (Chi tiết)</h4>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-500">Phí CIC</label>
                                 <input disabled={isViewMode} type="number" className="w-full p-2 border border-gray-300 rounded text-sm text-right" value={formData.feeCic} onChange={e => handleChange('feeCic', Number(e.target.value))} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-500">Phí Kimberry</label>
                                 <input disabled={isViewMode} type="number" className="w-full p-2 border border-gray-300 rounded text-sm text-right" value={formData.feeKimberry} onChange={e => handleChange('feeKimberry', Number(e.target.value))} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-500">Phí PSC</label>
                                 <input disabled={isViewMode} type="number" className="w-full p-2 border border-gray-300 rounded text-sm text-right" value={formData.feePsc} onChange={e => handleChange('feePsc', Number(e.target.value))} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-500">Phí EMC</label>
                                 <input disabled={isViewMode} type="number" className="w-full p-2 border border-gray-300 rounded text-sm text-right" value={formData.feeEmc} onChange={e => handleChange('feeEmc', Number(e.target.value))} />
                             </div>
                             <div className="space-y-1 col-span-2">
                                 <label className="text-xs font-semibold text-gray-500">Phí Khác</label>
                                 <input disabled={isViewMode} type="number" className="w-full p-2 border border-gray-300 rounded text-sm text-right" value={formData.feeOther} onChange={e => handleChange('feeOther', Number(e.target.value))} />
                             </div>
                         </div>
                     </div>
                 </div>
              </div>

           </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
            Đóng
          </button>
          {!isViewMode && (
              <button 
                type="submit" 
                form="jobForm"
                className="px-5 py-2.5 rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 flex items-center shadow-sm"
            >
                <Save className="w-4 h-4 mr-2" /> Lưu Job
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
