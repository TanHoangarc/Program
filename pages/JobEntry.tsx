import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, FileDown, Copy, FileSpreadsheet, Filter, X } from 'lucide-react';
import { JobData, Customer } from '../types';
import { JobModal } from '../components/JobModal';
import { MONTHS } from '../constants';

interface JobEntryProps {
  jobs: JobData[];
  onAddJob: (job: JobData) => void;
  onEditJob: (job: JobData) => void;
  onDeleteJob: (id: string) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  lines: string[];
  onAddLine: (line: string) => void;
}

export const JobEntry: React.FC<JobEntryProps> = ({ 
  jobs, onAddJob, onEditJob, onDeleteJob, customers, onAddCustomer, lines, onAddLine 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBooking, setFilterBooking] = useState('');

  const handleAddNew = () => {
    setEditingJob(null);
    setIsModalOpen(true);
  };

  const handleEdit = (job: JobData) => {
    setEditingJob(job);
    setIsModalOpen(true);
  };

  const handleDuplicate = (job: JobData) => {
    const newJob: JobData = {
      ...job,
      id: Date.now().toString(),
      jobCode: `${job.jobCode} (Copy)`,
      booking: job.booking ? `${job.booking}` : '',
    };
    onAddJob(newJob);
  };

  const handleSave = (job: JobData, newCustomer?: Customer) => {
    if (newCustomer) {
      onAddCustomer(newCustomer);
    }
    if (editingJob) {
      onEditJob(job);
    } else {
      onAddJob(job);
    }
    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    // Define headers
    const headers = [
      "Tháng", "Job", "Booking", "Consol", "Line", "Customer", "HBL", "Transit",
      "Cost", "Sell", "Profit", "Cont 20", "Cont 40",
      "Chi Payment", "Chi Cược", "Ngày Chi Cược", "Ngày Chi Hoàn",
      "Thu Payment", "Invoice", "Ngân hàng",
      "Mã KH Cược", "Thu Cược", "Ngày Thu Cược", "Ngày Thu Hoàn"
    ];

    // Map data to CSV rows
    const rows = filteredJobs.map(job => [
      job.month,
      `"${job.jobCode}"`, // Quote strings to avoid comma issues
      `"${job.booking}"`,
      `"${job.consol}"`,
      `"${job.line}"`,
      `"${job.customerName}"`,
      `"${job.hbl}"`,
      job.transit,
      job.cost,
      job.sell,
      job.profit,
      job.cont20,
      job.cont40,
      job.chiPayment,
      job.chiCuoc,
      job.ngayChiCuoc,
      job.ngayChiHoan,
      job.localChargeTotal,
      `"${job.localChargeInvoice}"`,
      job.bank,
      // We might need to look up the customer code for 'maKhCuocId', simplifying for now
      `"${customers.find(c => c.id === job.maKhCuocId)?.code || ''}"`,
      job.thuCuoc,
      job.ngayThuCuoc,
      job.ngayThuHoan
    ]);

    // Add BOM for Excel UTF-8 support
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `job_data_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredJobs = jobs.filter(job => {
    // General Search
    const matchesSearch = 
      job.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.line.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Specific Filters
    const matchesMonth = filterMonth ? job.month === filterMonth : true;
    const matchesCustomer = filterCustomer ? job.customerId === filterCustomer : true;
    const matchesBooking = filterBooking ? job.booking.toLowerCase().includes(filterBooking.toLowerCase()) : true;

    return matchesSearch && matchesMonth && matchesCustomer && matchesBooking;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterMonth('');
    setFilterCustomer('');
    setFilterBooking('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="p-8 max-w-full">
      {/* Header Actions */}
      <div className="flex flex-col mb-8 gap-4">
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-bold text-slate-800">Quản lý Job</h1>
              <p className="text-slate-500 mt-1">Nhập liệu và theo dõi chi tiết các lô hàng</p>
           </div>
           <div className="flex space-x-2">
             <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Xuất Excel</span>
             </button>
             <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                <Plus className="w-5 h-5" />
                <span>Thêm Job</span>
             </button>
           </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="flex items-center text-slate-500 font-medium">
              <Filter className="w-4 h-4 mr-2" />
              Bộ lọc:
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 w-full">
               {/* Month Filter */}
               <select 
                 value={filterMonth} 
                 onChange={(e) => setFilterMonth(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>

               {/* Customer Filter */}
               <select 
                 value={filterCustomer} 
                 onChange={(e) => setFilterCustomer(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               >
                 <option value="">Tất cả khách hàng</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>

               {/* Booking Filter */}
               <input 
                 type="text" 
                 placeholder="Lọc theo Booking..." 
                 value={filterBooking}
                 onChange={(e) => setFilterBooking(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               />

               {/* General Search */}
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Tìm Job Code, Line..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>

            {(filterMonth || filterCustomer || filterBooking || searchTerm) && (
              <button onClick={clearFilters} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors" title="Xóa bộ lọc">
                <X className="w-5 h-5" />
              </button>
            )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Tháng</th>
                <th className="px-6 py-4">Job Code</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Booking</th>
                <th className="px-6 py-4">Line</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Sell</th>
                <th className="px-6 py-4 text-right">Profit</th>
                <th className="px-6 py-4 text-center">Cont</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">Tháng {job.month}</td>
                    <td className="px-6 py-4 text-blue-600 font-medium">{job.jobCode}</td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-medium">{job.customerName}</div>
                      {job.hbl && <div className="text-xs text-orange-600">HBL: {job.hbl}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{job.booking}</td>
                    <td className="px-6 py-4 text-slate-500">{job.line}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.cost)}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(job.sell)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(job.profit)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex space-x-1 flex-col gap-1">
                        {job.cont20 > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{job.cont20}x20'</span>}
                        {job.cont40 > 0 && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">{job.cont40}x40'</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDuplicate(job)} className="text-slate-400 hover:text-green-600 p-1 rounded hover:bg-green-50 tooltip" title="Nhân bản">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(job)} className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 tooltip" title="Chỉnh sửa">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteJob(job.id)} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 tooltip" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileDown className="w-12 h-12 mb-3 text-gray-300" />
                      <p>Không tìm thấy dữ liệu phù hợp</p>
                      <button onClick={clearFilters} className="mt-2 text-blue-600 hover:underline text-sm">Xóa bộ lọc</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
           <span>Hiển thị {filteredJobs.length} kết quả</span>
           <span>Tổng Profit: {formatCurrency(filteredJobs.reduce((sum, j) => sum + j.profit, 0))}</span>
        </div>
      </div>

      <JobModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
        initialData={editingJob}
        customers={customers}
        lines={lines}
        onAddLine={onAddLine}
      />
    </div>
  );
};