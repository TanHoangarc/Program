import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, CreditCard, FileText } from 'lucide-react';
import { JobData, Customer } from '../types';
import { BANKS } from '../constants';

export type ReceiveMode = 'local' | 'deposit' | 'extension';

interface QuickReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJob: JobData) => void;
  job: JobData;
  mode: ReceiveMode;
  customers: Customer[];
}

export const QuickReceiveModal: React.FC<QuickReceiveModalProps> = ({
  isOpen, onClose, onSave, job, mode, customers
}) => {
  const [formData, setFormData] = useState<JobData>(job);
  
  // Extension specific state
  const [newExtension, setNewExtension] = useState({
    customerId: '',
    invoice: '',
    total: 0
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(JSON.parse(JSON.stringify(job)));
      setNewExtension({ customerId: '', invoice: '', total: 0 });
    }
  }, [isOpen, job]);

  if (!isOpen) return null;

  const handleChange = (field: keyof JobData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'extension') {
      // Add new extension to the list
      const updatedExtensions = [
        ...formData.extensions,
        {
          id: Date.now().toString(),
          customerId: newExtension.customerId,
          invoice: newExtension.invoice,
          invoiceDate: new Date().toISOString().split('T')[0], // Default today
          net: 0, 
          vat: 0,
          total: newExtension.total
        }
      ];
      onSave({ ...formData, extensions: updatedExtensions });
    } else {
      onSave(formData);
    }
    onClose();
  };

  const getTitle = () => {
    switch (mode) {
      case 'local': return 'Thu Tiền Local Charge';
      case 'deposit': return 'Thu Tiền Cược (Deposit)';
      case 'extension': return 'Thu Tiền Gia Hạn';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
            <p className="text-xs text-slate-500">Job: {job.jobCode} | Booking: {job.booking}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* --- MODE: LOCAL CHARGE --- */}
          {mode === 'local' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <FileText className="w-4 h-4 mr-1 text-gray-400" /> Invoice
                </label>
                <input
                  type="text"
                  required
                  value={formData.localChargeInvoice}
                  onChange={(e) => handleChange('localChargeInvoice', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Số hóa đơn"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1 text-gray-400" /> Số Tiền (Amount)
                </label>
                <input
                  type="text"
                  required
                  value={formData.localChargeTotal ? new Intl.NumberFormat('en-US').format(formData.localChargeTotal) : ''}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/,/g, ''));
                    if (!isNaN(val)) handleChange('localChargeTotal', val);
                  }}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-blue-600"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <CreditCard className="w-4 h-4 mr-1 text-gray-400" /> Ngân Hàng
                </label>
                <select
                  value={formData.bank}
                  onChange={(e) => handleChange('bank', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </>
          )}

          {/* --- MODE: DEPOSIT (CƯỢC) --- */}
          {mode === 'deposit' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Khách Hàng Cược</label>
                <select
                  value={formData.maKhCuocId}
                  onChange={(e) => handleChange('maKhCuocId', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1 text-gray-400" /> Số Tiền Cược
                </label>
                <input
                  type="text"
                  value={formData.thuCuoc ? new Intl.NumberFormat('en-US').format(formData.thuCuoc) : ''}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/,/g, ''));
                    if (!isNaN(val)) handleChange('thuCuoc', val);
                  }}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-indigo-600"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ngày Thu</label>
                  <input
                    type="date"
                    value={formData.ngayThuCuoc}
                    onChange={(e) => handleChange('ngayThuCuoc', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ngày Hoàn</label>
                  <input
                    type="date"
                    value={formData.ngayThuHoan}
                    onChange={(e) => handleChange('ngayThuHoan', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* --- MODE: EXTENSION (GIA HẠN) --- */}
          {mode === 'extension' && (
            <>
              <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 mb-2">
                Đang thêm phiếu thu gia hạn mới cho Job này.
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Khách Hàng</label>
                <select
                  value={newExtension.customerId}
                  onChange={(e) => setNewExtension(prev => ({ ...prev, customerId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Invoice</label>
                <input
                  type="text"
                  value={newExtension.invoice}
                  onChange={(e) => setNewExtension(prev => ({ ...prev, invoice: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Số hóa đơn"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1 text-gray-400" /> Số Tiền (Amount)
                </label>
                <input
                  type="text"
                  value={newExtension.total ? new Intl.NumberFormat('en-US').format(newExtension.total) : ''}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/,/g, ''));
                    if (!isNaN(val)) setNewExtension(prev => ({ ...prev, total: val }));
                  }}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-orange-600"
                  placeholder="0"
                />
              </div>
              
              {/* List existing extensions just for view */}
              {formData.extensions.length > 0 && (
                <div className="mt-4 border-t pt-2">
                  <p className="text-xs font-bold text-gray-500 mb-1">Các gia hạn đã có:</p>
                  <ul className="text-xs text-gray-600 space-y-1 max-h-24 overflow-y-auto">
                    {formData.extensions.map(ext => (
                      <li key={ext.id} className="flex justify-between">
                        <span>{ext.invoice || '(No Inv)'}</span>
                        <span>{new Intl.NumberFormat('en-US').format(ext.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center shadow-md">
              <Save className="w-4 h-4 mr-2" /> Lưu Phiếu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
