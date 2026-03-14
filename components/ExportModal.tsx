
import React, { useState, useMemo } from 'react';
import { X, Search, FileSpreadsheet, CheckSquare, Square, Filter, Info, ChevronRight, CheckCircle2 } from 'lucide-react';
import { JobData, Customer } from '../types';
import { MONTHS, YEARS } from '../constants';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobData[];
  customers: Customer[];
}

interface ExportField {
  id: string;
  label: string;
  category: 'general' | 'finance' | 'shipping' | 'other';
  getValue: (job: JobData) => any;
}

const EXPORT_FIELDS: ExportField[] = [
  { id: 'year', label: 'Năm', category: 'general', getValue: (j) => j.year },
  { id: 'month', label: 'Tháng', category: 'general', getValue: (j) => j.month },
  { id: 'jobCode', label: 'Job Code', category: 'general', getValue: (j) => j.jobCode },
  { id: 'booking', label: 'Booking', category: 'general', getValue: (j) => j.booking },
  { id: 'consol', label: 'Consol', category: 'general', getValue: (j) => j.consol },
  { id: 'line', label: 'Line', category: 'general', getValue: (j) => j.line },
  { id: 'customerName', label: 'Customer', category: 'general', getValue: (j) => j.customerName },
  { id: 'customerId', label: 'Mã KH', category: 'general', getValue: (j) => j.customerId },
  { id: 'hbl', label: 'HBL', category: 'general', getValue: (j) => j.hbl },
  { id: 'transit', label: 'Transit', category: 'general', getValue: (j) => j.transit },
  
  { id: 'cost', label: 'Cost', category: 'finance', getValue: (j) => j.cost },
  { id: 'sell', label: 'Sell', category: 'finance', getValue: (j) => j.sell },
  { id: 'profit', label: 'Profit', category: 'finance', getValue: (j) => j.profit },
  { id: 'thuCuoc', label: 'Cước Thu', category: 'finance', getValue: (j) => j.thuCuoc },
  { id: 'ngayThuCuoc', label: 'Ngày Thu', category: 'finance', getValue: (j) => j.ngayThuCuoc },
  { id: 'thuGiaHan', label: 'Thu Gia Hạn', category: 'finance', getValue: (j) => j.extensions?.reduce((acc, e) => acc + (e.total || 0), 0) || 0 },
  { id: 'invoiceGiaHan', label: 'Invoice Gia Hạn', category: 'finance', getValue: (j) => j.extensions?.map(e => e.invoice).filter(Boolean).join(', ') || '' },
  { id: 'localChargeTotal', label: 'Thu Payment', category: 'finance', getValue: (j) => j.localChargeTotal },
  { id: 'localChargeInvoice', label: 'Invoice Thu', category: 'finance', getValue: (j) => j.localChargeInvoice },
  
  { id: 'cont20', label: 'Cont 20', category: 'shipping', getValue: (j) => j.cont20 },
  { id: 'cont40', label: 'Cont 40', category: 'shipping', getValue: (j) => j.cont40 },
  
  { id: 'bank', label: 'Ngân hàng', category: 'other', getValue: (j) => j.bank },
];

const CATEGORIES = [
  { id: 'general', label: 'Thông tin chung', color: 'blue' },
  { id: 'finance', label: 'Tài chính & Thu phí', color: 'emerald' },
  { id: 'shipping', label: 'Vận tải', color: 'indigo' },
  { id: 'other', label: 'Khác', color: 'slate' },
];

const TEMPLATES = [
  { id: 'default', label: 'Default - Tự chọn field', fields: [] },
  { id: 'all', label: 'All - Tất cả các field', fields: EXPORT_FIELDS.map(f => f.id) },
  { id: 'lhk', label: 'Long Hoàng - Setup sẵn', fields: ['year', 'month', 'jobCode', 'booking', 'hbl', 'line', 'cont20', 'cont40', 'sell'] },
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, jobs, customers }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!filterCustomer) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(filterCustomer.toLowerCase()) ||
      c.id.toLowerCase().includes(filterCustomer.toLowerCase())
    ).slice(0, 10);
  }, [customers, filterCustomer]);

  if (!isOpen) return null;

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedFields(template.fields);
      if (templateId === 'lhk') {
          setFilterCustomer('LONG HOÀNG'); // Auto-set customer for LHK template if possible
      }
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
    setSelectedTemplate('custom');
  };

  const handleExport = () => {
    const filteredJobs = jobs.filter(job => {
      const matchesYear = filterYear ? job.year === Number(filterYear) : true;
      const matchesMonth = filterMonth ? job.month === filterMonth : true;
      const matchesCustomer = filterCustomer ? (job.customerName || '').toLowerCase().includes(filterCustomer.toLowerCase()) : true;
      return matchesYear && matchesMonth && matchesCustomer;
    });

    if (filteredJobs.length === 0) {
      alert('Không có dữ liệu phù hợp với bộ lọc đã chọn.');
      return;
    }

    const exportData = filteredJobs.map(job => {
      const row: any = {};
      EXPORT_FIELDS.forEach(field => {
        if (selectedFields.includes(field.id)) {
          row[field.label] = field.getValue(job);
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");
    
    const fileName = `Export_Jobs_${filterYear || 'All'}${filterMonth ? '_T' + filterMonth : ''}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Export File</h2>
              <p className="text-xs text-slate-500 font-medium">Cấu hình dữ liệu xuất Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {/* Section 1: Data Filters (Compact) */}
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Bộ lọc dữ liệu nguồn</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1 tracking-wider">Năm làm việc</span>
                <select 
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none hover:border-cyan-300 transition-all"
                >
                  <option value="">Tất cả năm</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1 tracking-wider">Tháng làm việc</span>
                <select 
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none hover:border-cyan-300 transition-all"
                >
                  <option value="">Tất cả tháng</option>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 relative">
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1 tracking-wider">Đối tác / Khách hàng</span>
                <input 
                  type="text"
                  placeholder="Nhập tên khách hàng..."
                  value={filterCustomer}
                  onChange={(e) => {
                    setFilterCustomer(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none hover:border-cyan-300 transition-all"
                />
                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setFilterCustomer(c.name);
                          setShowCustomerSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-cyan-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="font-bold text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Map Fields (Image Style) */}
          <div className="px-8 py-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-800">Map fields</h3>
                <Info className="w-4 h-4 text-cyan-500 cursor-help" />
              </div>

              <div className="flex items-center gap-2 text-cyan-600 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>From a saved fields mapping template</span>
              </div>

              <div className="relative max-w-2xl">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-cyan-400 rounded-xl text-sm font-bold focus:ring-4 focus:ring-cyan-500/10 outline-none appearance-none transition-all cursor-pointer pr-12"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                  <option value="custom" disabled>Custom mapping...</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-500">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Mapping Table */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-2/5">Column Heading (-&gt; First row value)</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-center">Excel Header</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Map field values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {EXPORT_FIELDS.map(field => {
                    const firstJob = jobs[0];
                    const previewValue = firstJob ? field.getValue(firstJob) : 'N/A';
                    const isSelected = selectedFields.includes(field.id);

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-700 text-[15px] group-hover:text-cyan-600 transition-colors">{field.label}</div>
                          <div className="text-[11px] text-slate-400 font-medium mt-1">(-&gt; {String(previewValue)})</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-4">
                            <div className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-cyan-50 text-cyan-500' : 'bg-slate-50 text-slate-200'}`}>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                            <div className="relative min-w-[120px]">
                              <span className={`text-sm font-bold ${isSelected ? 'text-slate-400' : 'text-slate-300'} italic`}>
                                {isSelected ? 'Select' : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-end">
                            <button 
                              onClick={() => toggleField(field.id)}
                              className={`w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center ${
                                isSelected 
                                  ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-100' 
                                  : 'border-slate-100 bg-white hover:border-cyan-200'
                              }`}
                            >
                              {isSelected && <CheckSquare className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total selected</span>
              <span className="text-lg font-black text-cyan-600 leading-none">
                {selectedFields.length} <span className="text-xs font-bold text-slate-400">fields</span>
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleExport}
              disabled={selectedFields.length === 0}
              className="px-10 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl shadow-lg shadow-cyan-100 transition-all flex items-center gap-2.5 active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Confirm & Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
