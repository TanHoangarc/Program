
import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { Briefcase, Search, FileText } from 'lucide-react';
import { MONTHS } from '../constants';

interface LhkListProps {
  jobs: JobData[];
}

export const LhkList: React.FC<LhkListProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const lhkJobs = useMemo(() => {
    // Filter for Long Hoang Logistics customers
    let filtered = jobs.filter(j => j.customerName === 'Long Hoàng Logistics');

    // Apply Filters
    if (filterMonth) {
      filtered = filtered.filter(j => j.month === filterMonth);
    }

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.jobCode.toLowerCase().includes(lowerTerm) ||
        j.booking.toLowerCase().includes(lowerTerm) ||
        j.hbl.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort by Month descending
    return filtered.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, filterMonth, searchTerm]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getProjectCode = (job: JobData) => {
    // Try to determine year from a date field, fallback to current year
    let year = new Date().getFullYear();
    if (job.localChargeDate) {
      year = new Date(job.localChargeDate).getFullYear();
    } else if (job.ngayChiCuoc) {
      year = new Date(job.ngayChiCuoc).getFullYear();
    }

    const yearSuffix = year.toString().slice(-2);
    const monthPad = job.month.padStart(2, '0');
    
    return `K${yearSuffix}${monthPad}&${job.jobCode}`;
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex justify-between items-end">
        <div>
           <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
               <Briefcase className="w-6 h-6" />
             </div>
             <h1 className="text-3xl font-bold">Quản lý LHK</h1>
           </div>
           <p className="text-slate-500 ml-11">Danh sách Job của khách hàng Long Hoàng Logistics</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex gap-4 mb-6">
          <div className="w-1/4">
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả các tháng</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm Job, Booking, HBL..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Job</th>
              <th className="px-6 py-4 text-right">Sell (Doanh thu)</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4">HBL</th>
              <th className="px-6 py-4 font-mono text-center">Công trình</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lhkJobs.length > 0 ? (
              lhkJobs.map((job) => (
                <tr key={job.id} className="hover:bg-yellow-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">Tháng {job.month}</td>
                  <td className="px-6 py-4 text-blue-600 font-medium">{job.jobCode}</td>
                  <td className="px-6 py-4 text-right text-green-600 font-medium">{formatCurrency(job.sell)}</td>
                  <td className="px-6 py-4 text-slate-600">{job.booking}</td>
                  <td className="px-6 py-4 text-slate-600">{job.hbl || '-'}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs bg-slate-50 text-slate-700 py-1 rounded border border-slate-200">
                    {getProjectCode(job)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                   <FileText className="w-10 h-10 mb-2 opacity-50" />
                   <span>Không có dữ liệu Long Hoàng Logistics</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
