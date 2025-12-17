
import React, { useState } from 'react';
import { SalaryRecord } from '../types';
import { Coins, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { MONTHS } from '../constants';

interface SalaryPageProps {
  salaries: SalaryRecord[];
  onUpdateSalaries: (salaries: SalaryRecord[]) => void;
}

export const SalaryPage: React.FC<SalaryPageProps> = ({ salaries, onUpdateSalaries }) => {
  const currentYear = new Date().getFullYear();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Temporary state for adding/editing
  const [formData, setFormData] = useState<SalaryRecord>({
    id: '',
    month: (new Date().getMonth() + 1).toString(),
    year: currentYear,
    amount: 0,
    note: ''
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      id: Date.now().toString(),
      month: (new Date().getMonth() + 1).toString(),
      year: currentYear,
      amount: 0,
      note: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: SalaryRecord) => {
    setEditingId(record.id);
    setFormData({ ...record });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc muốn xóa khoản lương này?")) {
      onUpdateSalaries(salaries.filter(s => s.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdateSalaries(salaries.map(s => s.id === editingId ? formData : s));
    } else {
      // Check for existing salary for same month/year
      const exists = salaries.some(s => s.month === formData.month && s.year === formData.year);
      if (exists && !window.confirm(`Đã có lương cho tháng ${formData.month}/${formData.year}. Bạn có muốn thêm dòng mới (Cộng dồn) không?`)) {
          return;
      }
      onUpdateSalaries([...salaries, { ...formData, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Sort by year desc, then month desc
  const sortedSalaries = [...salaries].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return Number(b.month) - Number(a.month);
  });

  return (
    <div className="p-8 w-full h-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
              <Coins className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Quản Lý Lương</h1>
          </div>
          <p className="text-slate-500 ml-11">Nhập chi phí lương theo tháng</p>
        </div>
        <button onClick={handleAddNew} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Thêm Lương
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/40 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/40 text-slate-600 font-bold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Tháng / Năm</th>
              <th className="px-6 py-4 text-right">Tổng Lương</th>
              <th className="px-6 py-4">Ghi chú</th>
              <th className="px-6 py-4 text-center w-32">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/40">
            {sortedSalaries.length > 0 ? (
                sortedSalaries.map(record => (
                    <tr key={record.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">
                            Tháng {record.month} / {record.year}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-yellow-700 text-lg">
                            {formatCurrency(record.amount)}
                        </td>
                        <td className="px-6 py-4 text-slate-600 italic">
                            {record.note || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center space-x-2">
                                <button onClick={() => handleEdit(record)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-light">
                        Chưa có dữ liệu lương
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Sửa Chi Phí Lương' : 'Thêm Chi Phí Lương'}</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tháng</label>
                            <select 
                                value={formData.month} 
                                onChange={(e) => setFormData({...formData, month: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-500"
                            >
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Năm</label>
                            <input 
                                type="number" 
                                value={formData.year}
                                onChange={(e) => setFormData({...formData, year: Number(e.target.value)})}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền Lương</label>
                        <input 
                            type="text" 
                            value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                            onChange={(e) => {
                                const val = Number(e.target.value.replace(/,/g, ''));
                                if (!isNaN(val)) setFormData({...formData, amount: val});
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-lg font-bold text-yellow-700 text-right outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú</label>
                        <textarea 
                            value={formData.note}
                            onChange={(e) => setFormData({...formData, note: e.target.value})}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                            placeholder="VD: Lương tháng 1 + Thưởng tết..."
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50">Hủy</button>
                        <button type="submit" className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600 shadow-md">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
