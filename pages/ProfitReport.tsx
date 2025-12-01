import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { BadgeDollarSign, Search, ExternalLink } from 'lucide-react';
import { MONTHS } from '../constants';

interface ProfitReportProps {
  jobs: JobData[];
  onViewJob?: (jobId: string) => void;
}

export const ProfitReport: React.FC<ProfitReportProps> = ({ jobs, onViewJob }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const profitData = useMemo(() => {
    let filtered = jobs;
    if (filterMonth) filtered = filtered.filter(j => j.month === filterMonth);
    if (searchTerm) {
        filtered = filtered.filter(j => 
            j.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
            j.booking.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const mapped = filtered.map(job => {
      const totalFees = (job.feeCic || 0) + 
                       (job.feeKimberry || 0) + 
                       (job.feeEmc || 0) + 
                       (job.feePsc || 0) + 
                       (job.feeOther || 0);

      return {
        id: job.id,
        month: job.month,
        jobCode: job.jobCode,
        booking: job.booking,
        totalProfit: job.profit,
        fees: totalFees
      };
    });

    return mapped.sort((a, b) => {
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;
      const bookingA = String(a.booking || '').toLowerCase();
      const bookingB = String(b.booking || '').toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, searchTerm]);

  const totalNetProfit = profitData.reduce((acc, p) => acc + p.totalProfit, 0);
  const totalFees = profitData.reduce((acc, p) => acc + p.fees, 0);

  return (
    <div className="p-8 max-w-full">
       <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <BadgeDollarSign className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Báo Cáo Lợi Nhuận</h1>
          </div>
          <p className="text-slate-500 ml-11">Phân tích lợi nhuận và các khoản phí</p>
        </div>
        
        <div className="flex space-x-4">
           <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="p-2 border rounded text-sm min-w-[150px]">
             <option value="">Tất cả tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
           <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Tìm kiếm..." 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 p-2 border rounded text-sm w-64"
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         <div className="bg-green-50 border border-green-200 p-6 rounded-xl">
            <h3 className="text-green-800 font-bold uppercase text-xs mb-2">Tổng Lợi Nhuận Ròng</h3>
            <div className="text-3xl font-bold text-green-700">{formatCurrency(totalNetProfit)}</div>
         </div>
         <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl">
            <h3 className="text-purple-800 font-bold uppercase text-xs mb-2">Tổng Các Khoản Phí</h3>
            <div className="text-3xl font-bold text-purple-700">{formatCurrency(totalFees)}</div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Job Code</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4 text-right">Tổng Phí (Fees)</th>
              <th className="px-6 py-4 text-right">Lợi Nhuận (Profit)</th>
              <th className="px-6 py-4 text-center">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
             {profitData.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                   <td className="px-6 py-4 text-gray-500">T{item.month}</td>
                   <td className="px-6 py-4 font-bold text-blue-700">{item.jobCode}</td>
                   <td className="px-6 py-4 text-gray-600">{item.booking}</td>
                   <td className="px-6 py-4 text-right text-purple-600">{formatCurrency(item.fees)}</td>
                   <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(item.totalProfit)}</td>
                   <td className="px-6 py-4 text-center">
                     {onViewJob && (
                        <button onClick={() => onViewJob(item.id)} className="text-gray-400 hover:text-blue-600 transition-colors">
                           <ExternalLink className="w-4 h-4" />
                        </button>
                     )}
                   </td>
                </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};