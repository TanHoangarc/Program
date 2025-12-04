
import React, { useState, useRef } from 'react';
import { Customer, ShippingLine } from '../types';
import { Plus, Edit2, Trash2, Search, Save, X, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
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
    mst: '',
    itemName: '' // Only for lines
  });

  const title = mode === 'customers' ? 'Khách Hàng' : 'Hãng Tàu';
  const labelCode = mode === 'customers' ? 'Mã Khách hàng' : 'Mã Line';

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ code: '', name: '', mst: '', itemName: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: Customer | ShippingLine) => {
    setEditingItem(item);
    setFormData({
      code: String(item.code || ''),
      name: String(item.name || ''),
      mst: String(item.mst || ''),
      itemName: String((item as ShippingLine).itemName || '')
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
    if (mode === 'lines') headers.push('Tên Hàng (Mặc định)');
    
    // Export sorted data as well
    const dataToExport = [...data].sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

    const rows = dataToExport.map(item => {
      const row = [item.mst, item.code, item.name];
      if (mode === 'lines') row.push((item as ShippingLine).itemName || '');
      return row;
    });

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
        // Flexible column mapping - Force String conversion to prevent type errors
        const mst = String(row['MST'] || row['Mã số thuế'] || row['Tax Code'] || '').trim();
        const code = String(row['Code'] || row['Mã'] || row['Mã Khách hàng'] || row['Mã Line'] || '').trim();
        const name = String(row['Name'] || row['Tên'] || row['Tên Công Ty'] || '').trim();
        const itemName = String(row['Item Name'] || row['Tên Hàng'] || row['Tên Hàng (Mặc định)'] || '').trim();

        if (code && name) {
          // Check for duplicate code
          const existing = data.find(d => String(d.code) === code);
          
          if (existing) {
            onEdit({
              ...existing,
              mst: mst || existing.mst,
              name: name || existing.name,
              itemName: mode === 'lines' ? (itemName || (existing as ShippingLine).itemName) : undefined
            });
            updated++;
          } else {
            onAdd({
              id: Date.now().toString() + Math.random().toString().slice(2,5),
              code,
              name,
              mst,
              itemName: mode === 'lines' ? itemName : undefined
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

  // Safe filtering logic to prevent white screen crashes
  const filteredData = data
    .filter(item => {
        const s = searchTerm.toLowerCase().trim();
        // Force String conversion to prevent crashes if data is numeric
        const name = String(item.name || '').toLowerCase();
        const code = String(item.code || '').toLowerCase();
        const mst = String(item.mst || '').toLowerCase();
        
        return name.includes(s) || code.includes(s) || mst.includes(s);
    })
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

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
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">{labelCode}</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Tên Công Ty</th>
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Mã Số Thuế</th>
              {mode === 'lines' && <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs">Mặt Hàng (Mặc định)</th>}
              <th className="px-6 py-3 font-semibold text-gray-700 uppercase text-xs text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30">
                  <td className="px-6 py-3 font-bold text-blue-700">{item.code}</td>
                  <td className="px-6 py-3 text-gray-700">{item.name}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono">{item.mst}</td>
                  {mode === 'lines' && (
                     <td className="px-6 py-3 text-gray-500 text-xs italic">
                       {(item as ShippingLine).itemName || '-'}
                     </td>
                  )}
                  <td className="px-6 py-3 text-center flex justify-center space-x-2">
                    <button 
                      onClick={() => handleEdit(item)} 
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={mode === 'lines' ? 5 : 4} className="px-6 py-8 text-center text-gray-400">Không tìm thấy dữ liệu</td></tr>
            )}
          </tbody>
        </table>

         {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {filteredData.length} dòng)
            </div>
            <div className="flex space-x-2 items-center">
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingItem ? 'Cập Nhật' : 'Thêm Mới'} {title}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400 hover:text-red-500" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">{labelCode} (*)</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value})} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-900 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tên Công Ty (*)</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-900 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Mã Số Thuế</label>
                <input 
                  type="text" 
                  value={formData.mst} 
                  onChange={(e) => setFormData({...formData, mst: e.target.value})} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-900 outline-none" 
                />
              </div>
              
              {mode === 'lines' && (
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Tên Hàng Mặc Định</label>
                    <input 
                      type="text" 
                      value={formData.itemName} 
                      onChange={(e) => setFormData({...formData, itemName: e.target.value})} 
                      className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-900 outline-none" 
                      placeholder="VD: Phí Local Charge"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Dùng để tự động điền khi tạo phiếu mua hàng</p>
                 </div>
              )}

              <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800 text-sm font-medium flex items-center">
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
