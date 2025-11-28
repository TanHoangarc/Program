
import React, { useState } from 'react';
import { Customer, ShippingLine } from '../types';
import { Plus, Edit2, Trash2, Search, Save, X, Database } from 'lucide-react';

interface DataManagementProps {
  mode: 'customers' | 'lines';
  data: (Customer | ShippingLine)[];
  onAdd: (item: any) => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({ mode, data, onAdd, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | ShippingLine | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    mst: ''
  });

  const title = mode === 'customers' ? 'Khách Hàng' : 'Hãng Tàu';
  const labelCode = mode === 'customers' ? 'Mã Khách hàng' : 'Mã Line';

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ code: '', name: '', mst: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: Customer | ShippingLine) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      mst: item.mst
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${title.toLowerCase()} này không?`)) {
      onDelete(id);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem = {
      id: editingItem ? editingItem.id : Date.now().toString(),
      ...formData
    };

    if (editingItem) {
      onEdit(newItem);
    } else {
      onAdd(newItem);
    }
    setIsModalOpen(false);
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.mst.includes(searchTerm)
  );

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Quản lý {title}</h1>
          </div>
          <p className="text-slate-500 ml-11">Thêm, sửa, xóa thông tin {title}</p>
        </div>
        
        <button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm Mới</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={`Tìm kiếm theo ${labelCode}, Tên, MST...`}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">MST</th>
              <th className="px-6 py-4">{labelCode}</th>
              <th className="px-6 py-4">Tên Công Ty</th>
              <th className="px-6 py-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-slate-600">{item.mst}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">{item.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(item)} className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Chỉnh sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">Không có dữ liệu phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h2 className="text-xl font-bold text-slate-800">
                {editingItem ? 'Chỉnh Sửa' : 'Thêm Mới'} {title}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-red-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Mã số thuế (MST)</label>
                <input 
                  type="text" 
                  required
                  value={formData.mst} 
                  onChange={e => setFormData(prev => ({...prev, mst: e.target.value}))} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="VD: 0301234567"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">{labelCode}</label>
                <input 
                  type="text" 
                  required
                  value={formData.code} 
                  onChange={e => setFormData(prev => ({...prev, code: e.target.value}))} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder={`VD: ${mode === 'customers' ? 'CUST01' : 'MSC'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Tên Công Ty</label>
                <input 
                  type="text" 
                  required
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({...prev, name: e.target.value}))} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Nhập tên công ty đầy đủ"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center shadow-md">
                  <Save className="w-4 h-4 mr-2" /> Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
