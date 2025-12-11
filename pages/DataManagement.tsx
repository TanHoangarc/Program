
import React, { useState, useRef } from 'react';
import { Customer, ShippingLine } from '../types';
import { Plus, Edit2, Trash2, Search, Save, X, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getPaginationRange } from '../utils';
import { CustomerModal } from '../components/CustomerModal';

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
  
  // Form State for Lines
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

  // Handler for Line Modal
  const handleSaveLine = (e: React.FormEvent) => {
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

  // Handler for Customer Modal
  const handleSaveCustomer = (customer: Customer) => {
      // If editing, preserve original ID
      if (editingItem) {
          onEdit({ ...customer, id: editingItem.id });
      } else {
          onAdd(customer);
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
    <div className="w-full h-full pb-10">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý {title}</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách và thông tin chi tiết</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={handleImportClick}
            className="glass-panel px-4 py-2 text-slate-700 hover:bg-white/80 rounded-lg text-sm font-medium flex items-center transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            <span>Import</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="glass-panel px-4 py-2 text-green-700 hover:bg-white/80 rounded-lg text-sm font-bold flex items-center transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            <span>Xuất Excel</span>
          </button>
          <button 
            onClick={handleAddNew}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center hover:shadow-lg hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Thêm Mới</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-5 rounded-2xl mb-6 mx-2">
         <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Tìm kiếm theo ${labelCode}, Tên, MST...`}
              className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto pb-24">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 text-slate-600 border-b border-white/40">
              <tr>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">{labelCode}</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Tên Công Ty</th>
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Mã Số Thuế</th>
                {mode === 'lines' && <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Mặt Hàng (Mặc định)</th>}
                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-700">{item.code}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.mst}</td>
                    {mode === 'lines' && (
                       <td className="px-6 py-4 text-slate-500 text-xs italic">
                         {(item as ShippingLine).itemName || '-'}
                       </td>
                    )}
                    <td className="px-6 py-4 text-center flex justify-center space-x-2">
                      <button 
                        onClick={() => handleEdit(item)} 
                        className="p-2 text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="p-2 text-red-600 hover:bg-red-50/50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={mode === 'lines' ? 5 : 4} className="px-6 py-12 text-center text-slate-400 font-light">Không tìm thấy dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

         {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {filteredData.length} dòng)
            </div>
            <div className="flex space-x-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex space-x-1">
                 {paginationRange.map((page, idx) => (
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 py-1.5 text-slate-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-1.5 rounded-lg border border-white/60 font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                            : 'bg-white/40 hover:bg-white/80 text-slate-700'
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
                className="p-1.5 rounded-lg border border-white/60 hover:bg-white/60 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && mode === 'customers' && (
          <CustomerModal 
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSave={handleSaveCustomer}
              initialData={editingItem as Customer}
          />
      )}

      {isModalOpen && mode === 'lines' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150 border border-white/50">
            <div className="px-6 py-4 border-b border-slate-200/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? 'Cập Nhật' : 'Thêm Mới'} {title}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors" /></button>
            </div>
            <form onSubmit={handleSaveLine} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{labelCode} (*)</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value})} 
                  className="glass-input w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên Công Ty (*)</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  className="glass-input w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mã Số Thuế</label>
                <input 
                  type="text" 
                  value={formData.mst} 
                  onChange={(e) => setFormData({...formData, mst: e.target.value})} 
                  className="glass-input w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên Hàng Mặc Định</label>
                <input 
                    type="text" 
                    value={formData.itemName} 
                    onChange={(e) => setFormData({...formData, itemName: e.target.value})} 
                    className="glass-input w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="VD: Phí Local Charge"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 italic">Dùng để tự động điền khi tạo phiếu mua hàng</p>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-900 text-white rounded-xl hover:bg-blue-800 text-sm font-bold flex items-center shadow-lg transform active:scale-95 transition-all">
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
