
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import { Customer } from '../types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => void;
  initialData?: Customer | null;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    code: '',
    name: '',
    mst: ''
  });

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({ code: '', name: '', mst: '' });
        }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;
    
    onSave({
        id: initialData?.id || Date.now().toString(),
        code: formData.code || '',
        name: formData.name || '',
        mst: formData.mst || ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150 border border-white/50">
        <div className="px-6 py-4 border-b border-slate-200/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">{initialData ? 'Cập Nhật Khách Hàng' : 'Thêm Mới Khách Hàng'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MÃ KHÁCH HÀNG (*)</label>
            <input 
              type="text" 
              value={formData.code} 
              onChange={(e) => setFormData({...formData, code: e.target.value})} 
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
              required 
              placeholder="VD: CUST01"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">TÊN CÔNG TY (*)</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
              required 
              placeholder="Tên đầy đủ của công ty"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">MÃ SỐ THUẾ</label>
            <input 
              type="text" 
              value={formData.mst} 
              onChange={(e) => setFormData({...formData, mst: e.target.value})} 
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
              placeholder="Nhập mã số thuế..."
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-900 text-white rounded-xl hover:bg-blue-800 text-sm font-bold flex items-center shadow-lg transform active:scale-95 transition-all">
               <Save className="w-4 h-4 mr-2" /> Lưu
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
