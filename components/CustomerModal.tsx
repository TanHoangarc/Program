
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Search, ChevronDown, Check } from 'lucide-react';
import { Customer } from '../types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => void;
  initialData?: Customer | null;
  customers?: Customer[];
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSave, initialData, customers = [] }) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    code: '',
    name: '',
    mst: '',
    isAuthorized: false,
    authorizedCode: '',
    validityYear: undefined
  });

  const [searchText, setSearchText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown and reset search text when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsDropdownOpen(false);
      setSearchText('');
    }
  }, [isOpen]);

  // Sync searchText with formData.authorizedCode on load/change
  useEffect(() => {
    if (formData.authorizedCode) {
      setSearchText(formData.authorizedCode);
    } else {
      setSearchText('');
    }
  }, [formData.authorizedCode]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        // Reset search text to current selected authorizedCode
        setSearchText(formData.authorizedCode || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [formData.authorizedCode]);

  const eligibleCustomers = useMemo(() => {
    return (customers || []).filter(c => c.id !== initialData?.id && c.code !== formData.code);
  }, [customers, initialData, formData.code]);

  const filteredCustomers = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return eligibleCustomers;
    return eligibleCustomers.filter(c => 
      (c.code || '').toLowerCase().includes(q) || 
      (c.name || '').toLowerCase().includes(q) ||
      (c.mst || '').toLowerCase().includes(q)
    );
  }, [eligibleCustomers, searchText]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setFormData({
              code: initialData.code || '',
              name: initialData.name || '',
              mst: initialData.mst || '',
              isAuthorized: !!initialData.isAuthorized,
              authorizedCode: initialData.authorizedCode || '',
              validityYear: initialData.validityYear
            });
        } else {
            setFormData({
              code: '',
              name: '',
              mst: '',
              isAuthorized: false,
              authorizedCode: '',
              validityYear: undefined
            });
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
        mst: formData.mst || '',
        isAuthorized: !!formData.isAuthorized,
        authorizedCode: formData.isAuthorized ? (formData.authorizedCode || '') : '',
        validityYear: formData.isAuthorized ? formData.validityYear : undefined
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

          <div className="flex items-center space-x-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200">
            <input 
              type="checkbox" 
              id="isAuthorized"
              checked={!!formData.isAuthorized} 
              onChange={(e) => setFormData({
                ...formData, 
                isAuthorized: e.target.checked,
                authorizedCode: e.target.checked ? (formData.authorizedCode || '') : '',
                validityYear: e.target.checked ? (formData.validityYear || 2026) : undefined
              })} 
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="isAuthorized" className="text-xs font-bold text-slate-700 uppercase cursor-pointer select-none">Ủy Quyền</label>
          </div>

          {formData.isAuthorized && (
            <div className="space-y-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative" ref={dropdownRef}>
                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Mã KH được ủy quyền (*)</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Nhập mã hoặc tên để lọc nhanh..."
                    className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal"
                    required
                  />
                  {formData.authorizedCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, authorizedCode: '' });
                        setSearchText('');
                      }}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                      title="Xóa lựa chọn"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Selected customer name display */}
                {(() => {
                  const selectedObj = (customers || []).find(c => c.code === formData.authorizedCode);
                  if (selectedObj) {
                    return (
                      <div className="mt-1 text-xs text-blue-600 font-medium">
                        Đang chọn: <span className="font-bold">{selectedObj.name}</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, authorizedCode: '' });
                        setSearchText('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-600 font-semibold hover:bg-rose-50 flex items-center justify-between"
                    >
                      <span>-- Bỏ chọn / Không ủy quyền --</span>
                      {!formData.authorizedCode && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(c => {
                        const isSelected = formData.authorizedCode === c.code;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, authorizedCode: c.code });
                              setSearchText(c.code);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{c.code}</span>
                              <span className="text-slate-500 font-normal truncate max-w-[280px]">{c.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-3 text-center text-xs text-slate-400">
                        Không tìm thấy khách hàng nào khớp
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Thời gian hiệu lực (Năm) (*)</label>
                <select 
                  value={formData.validityYear || ''} 
                  onChange={(e) => setFormData({...formData, validityYear: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  required
                >
                  <option value="">-- Chọn Năm --</option>
                  {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

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
