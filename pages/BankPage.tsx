
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { JobData, AdditionalReceipt, BankTransaction } from '../types';
import { Landmark, Search, Filter, Plus, Edit2, Trash2, FileSpreadsheet, Upload, X, Save, Calendar, Check } from 'lucide-react';
import { MONTHS, YEARS } from '../constants';
import { formatDateVN, parseDateVN, getPaginationRange } from '../utils';
import * as XLSX from 'xlsx';

interface BankPageProps {
    mode: 'tcb' | 'mb';
    data: BankTransaction[];
    onAdd: (item: BankTransaction) => void;
    onEdit: (item: BankTransaction) => void;
    onDelete: (id: string, originalId?: string) => void;
}

export const BankPage: React.FC<BankPageProps> = ({ mode, data, onAdd, onEdit, onDelete }) => {
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState(''); // Default to ALL years to show data
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<BankTransaction | null>(null);
    const [formData, setFormData] = useState<BankTransaction>({
        id: '', date: new Date().toISOString().split('T')[0], amount: 0, invoice: '', desc: '', bankType: mode === 'tcb' ? 'TCB' : 'MB'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const title = mode === 'tcb' ? 'Techcom Bank' : 'MB Bank';
    const description = mode === 'tcb' ? 'Tổng hợp Job thanh toán qua TCB' : 'Tổng hợp các khoản Thu Khác';
    const colorTheme = mode === 'tcb' ? 'red' : 'indigo'; // TCB Red, MB Indigo/Blue

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMonth, filterYear, searchTerm]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

    // Filter Logic
    const filteredData = useMemo(() => {
        return data.filter(item => {
            // Handle missing or invalid dates gracefully
            let m = '', y = '';
            if (item.date) {
                const date = new Date(item.date);
                if (!isNaN(date.getTime())) {
                    m = (date.getMonth() + 1).toString();
                    y = date.getFullYear().toString();
                }
            }

            const matchMonth = filterMonth ? m === filterMonth : true;
            const matchYear = filterYear ? y === filterYear : true;
            
            // Safe string check - force String conversion to handle numbers
            const safeInvoice = String(item.invoice || '').toLowerCase();
            const safeDesc = String(item.desc || '').toLowerCase();
            const searchLower = searchTerm.toLowerCase();

            const matchSearch = searchTerm ? (
                safeInvoice.includes(searchLower) ||
                safeDesc.includes(searchLower)
            ) : true;

            return matchMonth && matchYear && matchSearch;
        }).sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
    }, [data, filterMonth, filterYear, searchTerm]);

    // Totals
    const totalAmount = useMemo(() => filteredData.reduce((sum, item) => sum + item.amount, 0), [filteredData]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const paginationRange = getPaginationRange(currentPage, totalPages);

    // Handlers
    const handleAddNew = () => {
        setEditingItem(null);
        setFormData({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, invoice: '', desc: '', bankType: mode === 'tcb' ? 'TCB' : 'MB' });
        setIsModalOpen(true);
    };

    const handleEdit = (item: BankTransaction) => {
        setEditingItem(item);
        setFormData({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = (item: BankTransaction) => {
        if(window.confirm("Bạn chắc chắn muốn xóa giao dịch này?")) {
            onDelete(item.id, item.originalId);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            onEdit(formData);
        } else {
            onAdd(formData);
        }
        setIsModalOpen(false);
    };

    const handleExportExcel = () => {
        const rows = filteredData.map(item => ({
            [mode === 'tcb' ? "Tháng/Năm" : "Ngày"]: (mode === 'tcb' && item.jobMonth) 
                ? `T${item.jobMonth}/${item.jobYear || new Date().getFullYear()}` 
                : formatDateVN(item.date),
            "Số Hoá Đơn": item.invoice,
            "Số Tiền": item.amount,
            "Diễn Giải": item.desc
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${title}_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            jsonData.forEach((row: any) => {
                const dateRaw = row['Ngày'] || row['Date'];
                let dateStr = new Date().toISOString().split('T')[0];
                
                // Try parse date
                if (dateRaw) {
                    if (typeof dateRaw === 'string' && dateRaw.includes('/')) {
                        const parsed = parseDateVN(dateRaw);
                        if (parsed) dateStr = parsed;
                    } 
                    // Add more date parsing logic if needed
                }

                const amount = Number(row['Số tiền'] || row['Amount'] || 0);
                const invoice = String(row['Số hoá đơn'] || row['Invoice'] || '');
                const desc = String(row['Diễn giải'] || row['Description'] || '');

                if (amount > 0) {
                    onAdd({
                        id: Date.now().toString() + Math.random(),
                        date: dateStr,
                        amount,
                        invoice,
                        desc,
                        bankType: mode === 'tcb' ? 'TCB' : 'MB'
                    });
                    added++;
                }
            });
            alert(`Đã nhập ${added} giao dịch.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    // Date Input Helper Component inside
    const DateInputSimple = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
        const [display, setDisplay] = useState(formatDateVN(value));
        useEffect(() => setDisplay(formatDateVN(value)), [value]);
        
        const handleBlur = () => {
            const parsed = parseDateVN(display);
            if (parsed) onChange(parsed);
            else setDisplay(formatDateVN(value));
        };

        return (
            <div className="relative">
                <input 
                    type="text" value={display} onChange={e => setDisplay(e.target.value)} onBlur={handleBlur}
                    className="w-full px-3 py-2 border rounded-lg pl-9 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="dd/mm/yyyy"
                />
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <input type="date" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
        );
    };

    return (
        <div className="p-8 max-w-full h-full pb-10">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />

            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
                <div>
                    <div className="flex items-center space-x-3 text-slate-800 mb-2">
                        <div className={`p-2 rounded-lg shadow-sm ${mode === 'tcb' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Landmark className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold">{title}</h1>
                    </div>
                    <p className="text-slate-500 ml-11">{description}</p>
                </div>
                
                <div className="flex space-x-2">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center shadow-sm">
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </button>
                    <button onClick={handleExportExcel} className="bg-white border border-slate-300 text-green-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center shadow-sm">
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
                    </button>
                    <button onClick={handleAddNew} className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md flex items-center ${mode === 'tcb' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        <Plus className="w-4 h-4 mr-2" /> Thêm
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-5 rounded-2xl mb-6 mx-2 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-wide">
                    <Filter className="w-4 h-4 mr-2" /> Bộ lọc
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-sm font-bold text-blue-700 outline-none">
                        <option value="">Tất cả năm</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-sm outline-none">
                        <option value="">Tất cả các tháng</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Tìm theo hoá đơn, diễn giải..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
                <div className="overflow-x-auto pb-20">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/40 text-slate-600 border-b border-white/40">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">
                                    {mode === 'tcb' ? 'Tháng/Năm' : 'Ngày'}
                                </th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Số Hoá Đơn</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider">Diễn Giải</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-right">Số Tiền</th>
                                <th className="px-6 py-4 font-bold uppercase text-[10px] tracking-wider text-center w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/40">
                            {paginatedData.length > 0 ? (
                                paginatedData.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/40 transition-colors">
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {mode === 'tcb' && item.jobMonth 
                                                ? `T${item.jobMonth}/${item.jobYear || new Date().getFullYear()}` 
                                                : formatDateVN(item.date)}
                                        </td>
                                        <td className="px-6 py-4 text-blue-700 font-bold">{item.invoice}</td>
                                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.desc}>{item.desc}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${mode === 'tcb' ? 'text-red-600' : 'text-indigo-600'}`}>
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center flex justify-center gap-2">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-400 font-light">Không có dữ liệu</td></tr>
                            )}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot className="bg-white/30 border-t border-white/40 font-bold text-slate-800 text-xs uppercase">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-right">Tổng Cộng:</td>
                                    <td className={`px-6 py-4 text-right text-base ${mode === 'tcb' ? 'text-red-600' : 'text-indigo-600'}`}>{formatCurrency(totalAmount)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-white/40 bg-white/30 flex justify-between items-center text-xs text-slate-600">
                        <div>Trang {currentPage} / {totalPages} (Tổng {filteredData.length} dòng)</div>
                        <div className="flex space-x-1.5">
                            {paginationRange.map((page, idx) => (
                                page === '...' ? <span key={`dots-${idx}`} className="px-2 py-1.5">...</span> : 
                                <button key={page} onClick={() => setCurrentPage(page as number)} className={`px-3 py-1.5 rounded-lg border border-white/60 font-medium ${currentPage === page ? 'bg-slate-800 text-white' : 'bg-white/40 hover:bg-white/80'}`}>{page}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className={`px-6 py-4 border-b flex justify-between items-center rounded-t-2xl ${mode === 'tcb' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                            <h3 className={`text-lg font-bold ${mode === 'tcb' ? 'text-red-800' : 'text-indigo-800'}`}>{editingItem ? 'Sửa Giao Dịch' : 'Thêm Giao Dịch'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày giao dịch</label>
                                <DateInputSimple value={formData.date} onChange={(val) => setFormData({...formData, date: val})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Hoá Đơn</label>
                                <input type="text" value={formData.invoice} onChange={e => setFormData({...formData, invoice: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tiền</label>
                                <input 
                                    type="text" 
                                    value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                                    onChange={e => { const val = Number(e.target.value.replace(/,/g, '')); if(!isNaN(val)) setFormData({...formData, amount: val}); }} 
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Diễn giải</label>
                                <textarea rows={3} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200">Hủy</button>
                                <button type="submit" className={`px-4 py-2 text-white rounded-lg font-bold shadow-md ${mode === 'tcb' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Lưu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
