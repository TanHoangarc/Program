import React, { useState, useRef } from 'react';
import { Customer, ShippingLine } from '../types';
import { Plus, Edit2, Trash2, Search, Save, X, Database, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getPaginationRange } from '../utils';

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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    const headers = ['MST', mode === 'customers' ? 'Mã Khách hàng' : 'Mã Line', 'Tên Công Ty'];
    
    const rows = data.map(item => [
      item.mst,
      item.code,
      item.name
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    
    const fileName = `Danh_Sach_${mode === 'customers' ? 'Khach_Hang' : 'Hang_Tau'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // --- IMPORT EXCEL ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      let added = 0;
      let updated = 0;

      jsonData.forEach((row: any) => {
        // Flexible column mapping
        const mst = row['MST'] || row['Mã số thuế'] || row['Tax Code'] || '';
        const code = row['Code'] || row['Mã'] || row['Mã Khách hàng'] || row['Mã Line'] || '';
        const name = row['Name'] || row['Tên'] || row['Tên Công Ty'] || '';

        if (code && name) {
          // Check for duplicate code
          const existing = data.find(d => d.code === code);
          
          if (existing) {
            onEdit({
              ...existing,
              mst: mst || existing.mst,
              name: name || existing.name
            });
            updated++;
          } else {
            onAdd({
              id: Date.now().toString() + Math.random().toString().slice(2,5),
              code,
              name,
              mst
            });
            added++;
          }
        }
      });

      alert(`Hoàn tất nhập dữ liệu:\n- Thêm mới: ${added}\n- Cập nhật: ${updated}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.mst.includes(searchTerm)
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  return (
    <div className="p-8 max-w-full">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý {title}</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách và thông tin chi tiết</p>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={handleImportClick}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium flex items-center shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            <span>Import</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium flex items-center shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            <span>Xuất Excel</span>
          </button>
          <button 
            onClick={handleAddNew}
            className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Thêm Mới</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={`Tìm kiếm theo ${labelCode}, Tên, MST...`}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-900 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">MST</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">{labelCode}</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Tên Công Ty</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-3 font-mono text-gray-600">{item.mst}</td>
                  <td className="px-6 py-3 font-bold text-blue-700">{item.code}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Chỉnh sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Xóa">
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
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {filteredData.length} items)
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex space-x-1">
                 {paginationRange.map((page, idx) => (
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 py-1.5 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-1.5 rounded border text-xs font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                 ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[1px] z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-150 border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Chỉnh Sửa' : 'Thêm Mới'} {title}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Mã số thuế (MST)</label>
                <input 
                  type="text" 
                  required
                  value={formData.mst} 
                  onChange={e => setFormData(prev => ({...prev, mst: e.target.value}))} 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-900" 
                  placeholder="VD: 0301234567"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">{labelCode}</label>
                <input 
                  type="text" 
                  required
                  value={formData.code} 
                  onChange={e => setFormData(prev => ({...prev, code: e.target.value}))} 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-900" 
                  placeholder={`VD: ${mode === 'customers' ? 'CUST01' : 'MSC'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Tên Công Ty</label>
                <input 
                  type="text" 
                  required
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({...prev, name: e.target.value}))} 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-900" 
                  placeholder="Nhập tên công ty đầy đủ"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 flex items-center shadow-sm">
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
