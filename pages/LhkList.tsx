import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { Search, Briefcase } from 'lucide-react';
import { MONTHS } from '../constants';

interface LhkListProps {
  jobs: JobData[];
}

export const LhkList: React.FC<LhkListProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const lhkJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      // Logic for LHK jobs: Check customer name or specific IDs if known. 
      // Assuming 'Long Hoàng' or 'LHK' in name.
      const isLhk = job.customerName.toLowerCase().includes('long hoàng') || 
                    job.customerName.toLowerCase().includes('lhk');
      
      const matchesMonth = filterMonth ? job.month === filterMonth : true;
      const matchesSearch = searchTerm ? (
        job.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
        job.booking.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.hbl.toLowerCase().includes(searchTerm.toLowerCase())
      ) : true;

      return isLhk && matchesMonth && matchesSearch;
    });

    return filtered.sort((a, b) => {
        const mA = parseInt(a.month) || 0;
        const mB = parseInt(b.month) || 0;
        const monthDiff = mB - mA;
        
        if (monthDiff !== 0) return monthDiff;

        const bookingA = String(a.booking || '').toLowerCase();
        const bookingB = String(b.booking || '').toLowerCase();
        return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Quản Lý Job Long Hoàng (LHK)</h1>
          </div>
          <p className="text-slate-500 ml-11">Danh sách riêng cho khách hàng Long Hoàng Logistics</p>
        </div>
        
        <div className="flex space-x-4">
           <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-2 border rounded text-sm min-w-[150px]">
             <option value="">Tất cả tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
           <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Tìm Job/Booking/HBL..." 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 p-2 border rounded text-sm w-64"
              />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Job Code</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4">HBL</th>
              <th className="px-6 py-4">Line</th>
              <th className="px-6 py-4 text-center">Cont 20'</th>
              <th className="px-6 py-4 text-center">Cont 40'</th>
              <th className="px-6 py-4 text-right">Lợi Nhuận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
             {lhkJobs.length > 0 ? (
               lhkJobs.map(job => (
                 <tr key={job.id} className="hover:bg-blue-50/30">
                   <td className="px-6 py-4">T{job.month}</td>
                   <td className="px-6 py-4 font-bold text-blue-700">{job.jobCode}</td>
                   <td className="px-6 py-4 font-mono">{job.booking}</td>
                   <td className="px-6 py-4 font-bold text-orange-600 bg-orange-50 w-32 text-center rounded-lg">{job.hbl || '-'}</td>
                   <td className="px-6 py-4">{job.line}</td>
                   <td className="px-6 py-4 text-center">{job.cont20}</td>
                   <td className="px-6 py-4 text-center">{job.cont40}</td>
                   <td className="px-6 py-4 text-right font-medium text-green-700">{formatCurrency(job.profit)}</td>
                 </tr>
               ))
             ) : (
               <tr><td colSpan={8} className="text-center py-12 text-gray-400">Không tìm thấy Job LHK nào</td></tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
};