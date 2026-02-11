
import React, { useState, useMemo } from 'react';
import { JobData, SalaryRecord, YearlyConfig } from '../types';
import { TrendingUp, Edit2, Save, X, DollarSign, StickyNote, Calculator } from 'lucide-react';

interface YearlyProfitPageProps {
  jobs: JobData[];
  salaries: SalaryRecord[];
  yearlyConfigs: YearlyConfig[];
  onUpdateConfig: (config: YearlyConfig) => void;
}

const DEFAULT_EXCHANGE_RATE = 23500;

export const YearlyProfitPage: React.FC<YearlyProfitPageProps> = ({ 
  jobs, salaries, yearlyConfigs, onUpdateConfig 
}) => {
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<YearlyConfig>({ year: 0, exchangeRate: DEFAULT_EXCHANGE_RATE, tax: 0, note: '' });
  const [editingStats, setEditingStats] = useState<any>(null);

  const formatCurrencyVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  const formatCurrencyUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // 1. Get Unique Years from Jobs and Salaries
  const years = useMemo(() => {
      const jobYears = jobs.map(j => j.year || 2025);
      const salaryYears = salaries.map(s => s.year || 2025);
      const allYears = Array.from(new Set([...jobYears, ...salaryYears]));
      return allYears.sort((a, b) => b - a); // Descending order
  }, [jobs, salaries]);

  // 2. Calculate Stats for each year
  const yearlyStats = useMemo(() => {
      return years.map(year => {
          // Find config or use default
          const config = yearlyConfigs.find(c => c.year === year) || { year, exchangeRate: DEFAULT_EXCHANGE_RATE, tax: 0, note: '' };
          const exchangeRate = config.exchangeRate > 0 ? config.exchangeRate : DEFAULT_EXCHANGE_RATE;

          // Sum Profit (VND)
          const profitVND = jobs
              .filter(j => j.year === year)
              .reduce((sum, j) => sum + j.profit, 0);

          // Sum Salary (VND)
          const salaryVND = salaries
              .filter(s => s.year === year)
              .reduce((sum, s) => sum + s.amount, 0);

          // Convert to USD
          const profitUSD = profitVND / exchangeRate;
          const salaryUSD = salaryVND / exchangeRate;
          
          // Calculate Net Profit (Remaining)
          // Net Profit = Profit USD - Tax - Salary USD
          const netProfitUSD = profitUSD - config.tax - salaryUSD;

          return {
              year,
              profitVND,
              exchangeRate,
              profitUSD,
              taxUSD: config.tax,
              salaryUSD,
              netProfitUSD,
              salaryVND, // Return Salary VND for display
              note: config.note
          };
      });
  }, [years, jobs, salaries, yearlyConfigs]);

  const handleEditClick = (stats: any) => {
      setEditingYear(stats.year);
      setEditingStats(stats);
      setEditForm({ 
          year: stats.year, 
          exchangeRate: stats.exchangeRate, 
          tax: stats.taxUSD,
          note: stats.note || ''
      });
  };

  const handleSave = () => {
      onUpdateConfig(editForm);
      setEditingYear(null);
      setEditingStats(null);
  };

  // Calculations for Modal Preview
  const modalPreview = useMemo(() => {
      if (!editingStats) return null;
      const rate = editForm.exchangeRate > 0 ? editForm.exchangeRate : 1;
      const pUSD = editingStats.profitVND / rate;
      const sUSD = editingStats.salaryVND / rate;
      const net = pUSD - editForm.tax - sUSD;
      return { pUSD, sUSD, net };
  }, [editForm.exchangeRate, editForm.tax, editingStats]);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Profit Năm (Yearly Profit)</h1>
          </div>
          <p className="text-slate-500 ml-11">Thống kê lợi nhuận ròng theo năm (Quy đổi USD)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Năm</th>
              <th className="px-6 py-4 text-right">Profit (VND)</th>
              <th className="px-6 py-4 text-right">Salary (VND)</th>
              <th className="px-6 py-4 text-center">Tỷ giá</th>
              <th className="px-6 py-4 text-right">Profit (USD)</th>
              <th className="px-6 py-4 text-right">Tax (USD)</th>
              <th className="px-6 py-4 text-right">Salary (USD)</th>
              <th className="px-6 py-4 text-right bg-emerald-50 text-emerald-800">Net Profit (USD)</th>
              <th className="px-6 py-4">Ghi chú</th>
              <th className="px-6 py-4 text-center w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {yearlyStats.length > 0 ? (
                yearlyStats.map((item) => (
                    <tr key={item.year} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{item.year}</td>
                        <td className="px-6 py-4 text-right font-medium text-blue-600">
                            {formatCurrencyVND(item.profitVND)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-orange-600">
                            {formatCurrencyVND(item.salaryVND)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 font-mono">
                            {new Intl.NumberFormat('vi-VN').format(item.exchangeRate)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-700">
                            {formatCurrencyUSD(item.profitUSD)}
                        </td>
                        <td className="px-6 py-4 text-right text-red-500">
                            {formatCurrencyUSD(item.taxUSD)}
                        </td>
                        <td className="px-6 py-4 text-right text-orange-600">
                            {formatCurrencyUSD(item.salaryUSD)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-lg bg-emerald-50/30 text-emerald-600">
                            {formatCurrencyUSD(item.netProfitUSD)}
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate" title={item.note}>
                            {item.note || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button 
                                onClick={() => handleEditClick(item)} 
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">Không có dữ liệu năm</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingYear && editingStats && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-600"/> Cấu hình & Chi tiết Năm {editingYear}
                    </h3>
                    <button onClick={() => setEditingYear(null)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
                </div>
                
                <div className="p-6">
                    {/* Top Stats Section (Read Only) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Profit (VND)</label>
                            <div className="text-sm font-bold text-blue-700">{formatCurrencyVND(editingStats.profitVND)}</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Salary (VND)</label>
                            <div className="text-sm font-bold text-orange-700">{formatCurrencyVND(editingStats.salaryVND)}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Profit (USD)</label>
                            <div className="text-sm font-medium text-slate-700">{modalPreview ? formatCurrencyUSD(modalPreview.pUSD) : '-'}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Salary (USD)</label>
                            <div className="text-sm font-medium text-slate-700">{modalPreview ? formatCurrencyUSD(modalPreview.sUSD) : '-'}</div>
                        </div>
                    </div>

                    {/* Inputs Section */}
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tỷ giá (Exchange Rate)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={editForm.exchangeRate} 
                                        onChange={(e) => setEditForm({...editForm, exchangeRate: Number(e.target.value)})}
                                        className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">VND</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 italic">Tỷ giá dùng để quy đổi VND sang USD.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tax (USD)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={editForm.tax} 
                                        onChange={(e) => setEditForm({...editForm, tax: Number(e.target.value)})}
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 italic">Thuế phải nộp (tính bằng USD).</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú (Note)</label>
                            <div className="relative">
                                <textarea 
                                    value={editForm.note}
                                    onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                                    rows={2}
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Ghi chú thêm..."
                                />
                                <StickyNote className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            </div>
                        </div>
                    </div>

                    {/* Result Preview */}
                    <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center">
                        <div className="text-sm font-bold text-emerald-800">NET PROFIT (USD)</div>
                        <div className="text-2xl font-black text-emerald-600 tracking-tight">
                            {modalPreview ? formatCurrencyUSD(modalPreview.net) : '-'}
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end space-x-3 border-t border-slate-100 mt-6">
                        <button onClick={() => setEditingYear(null)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                        <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2">
                            <Save className="w-4 h-4" /> Lưu Cấu Hình
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
