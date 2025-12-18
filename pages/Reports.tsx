
import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, DollarSign, Wallet, Filter, Ship, Calendar } from 'lucide-react';
import { MONTHS } from '../constants';

interface ReportsProps {
  jobs: JobData[];
}

export const Reports: React.FC<ReportsProps> = ({ jobs }) => {
  const currentYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState<number>(currentYear);

  const COLORS = ['#2dd4bf', '#3b82f6', '#818cf8', '#c084fc', '#f472b6']; // Teal, Blue, Indigo, Purple, Pink

  // Extract unique years from jobs
  const uniqueYears = useMemo(() => {
      const years = new Set<number>();
      years.add(currentYear); // Always include current year
      jobs.forEach(j => {
          if (j.year) years.add(j.year);
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [jobs, currentYear]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
        const matchYear = job.year === filterYear;
        const matchMonth = filterMonth ? job.month === filterMonth : true;
        return matchYear && matchMonth;
    });
  }, [jobs, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const totalProfit = filteredJobs.reduce((acc, job) => acc + job.profit, 0);
    const totalJobs = filteredJobs.length;
    const totalCont20 = filteredJobs.reduce((acc, job) => acc + job.cont20, 0);
    const totalCont40 = filteredJobs.reduce((acc, job) => acc + job.cont40, 0);
    const totalRevenue = filteredJobs.reduce((acc, job) => acc + job.sell, 0);
    const kimberryCost = (totalCont20 * 250000) + (totalCont40 * 500000);
    return { totalProfit, totalJobs, totalCont20, totalCont40, totalRevenue, kimberryCost };
  }, [filteredJobs]);

  const monthlyData = useMemo(() => {
    // Initialize all months with 0
    const grouped: Record<string, { month: string, profit: number, revenue: number }> = {};
    for (let i = 1; i <= 12; i++) {
        grouped[i.toString()] = { month: i.toString(), profit: 0, revenue: 0 };
    }

    // Aggregate data based on filtered jobs (which are already filtered by Year)
    filteredJobs.forEach(job => {
      const m = job.month;
      if (grouped[m]) {
          grouped[m].profit += job.profit;
          grouped[m].revenue += job.sell;
      }
    });
    
    return Object.values(grouped).sort((a, b) => Number(a.month) - Number(b.month));
  }, [filteredJobs]);

  const contData = [
    { name: 'Cont 20\'', value: stats.totalCont20 },
    { name: 'Cont 40\'', value: stats.totalCont40 },
  ].filter(d => d.value > 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumSignificantDigits: 3 }).format(val);

  const StatCard = ({ icon: Icon, title, value, colorClass, gradient }: { icon: any, title: string, value: string, colorClass: string, gradient: string }) => (
    <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group transition-all duration-300 hover:translate-y-[-4px]`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${gradient} opacity-20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-xl ${colorClass} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Tổng quan hiệu suất kinh doanh năm {filterYear}</p>
        </div>
        
        <div className="flex items-center space-x-3">
           <div className="flex items-center space-x-2 glass-panel px-3 py-1.5 rounded-xl">
               <Calendar className="w-4 h-4 text-slate-400" />
               <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="bg-transparent border-none text-sm text-slate-700 font-bold focus:ring-0 outline-none cursor-pointer">
                 {uniqueYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
               </select>
           </div>

           <div className="flex items-center space-x-2 glass-panel px-3 py-1.5 rounded-xl">
               <Filter className="w-4 h-4 text-slate-400" />
               <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-transparent border-none text-sm text-slate-600 font-medium focus:ring-0 outline-none cursor-pointer min-w-[100px]">
                 <option value="">Cả năm</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>
           </div>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard icon={DollarSign} title="Lợi Nhuận" value={formatCurrency(stats.totalProfit)} colorClass="bg-teal-500" gradient="bg-teal-500" />
        <StatCard icon={Wallet} title="Doanh Thu" value={formatCurrency(stats.totalRevenue)} colorClass="bg-blue-500" gradient="bg-blue-500" />
        <StatCard icon={TrendingUp} title="Tổng Job" value={stats.totalJobs.toString()} colorClass="bg-indigo-500" gradient="bg-indigo-500" />
        <StatCard icon={Package} title="Container" value={(stats.totalCont20 + stats.totalCont40).toString()} colorClass="bg-purple-500" gradient="bg-purple-500" />
        <StatCard icon={Ship} title="Chi Kimberry" value={formatCurrency(stats.kimberryCost)} colorClass="bg-pink-500" gradient="bg-pink-500" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Biểu đồ tăng trưởng ({filterYear})</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" tickFormatter={(val) => `T${val}`} axisLine={false} tickLine={false} dy={10} />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false} dx={-10} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" strokeWidth={3} fill="url(#colorRevenue)" name="Doanh Thu" />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" name="Lợi Nhuận" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
           <h3 className="text-lg font-bold text-slate-800 mb-6">Tỷ lệ Container</h3>
           <div className="flex-1 min-h-[320px] w-full relative">
             {contData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {contData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `${value} cont`} 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
             ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 italic">Chưa có dữ liệu</div>
             )}
             {/* Center Text Overlay */}
             {contData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                   <span className="text-3xl font-bold text-slate-700">{stats.totalCont20 + stats.totalCont40}</span>
                   <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tổng Cont</span>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
