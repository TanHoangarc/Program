
import React, { useMemo, useState } from 'react';
import { JobData } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, Package, DollarSign, Wallet, Filter, Ship } from 'lucide-react';
import { MONTHS } from '../constants';

interface ReportsProps {
  jobs: JobData[];
}

export const Reports: React.FC<ReportsProps> = ({ jobs }) => {
  const [filterMonth, setFilterMonth] = useState('');

  const COLORS = ['#1e3a8a', '#3b82f6', '#93c5fd', '#dbeafe']; // Brand Blues

  const filteredJobs = useMemo(() => {
    if (!filterMonth) return jobs;
    return jobs.filter(job => job.month === filterMonth);
  }, [jobs, filterMonth]);

  const stats = useMemo(() => {
    const totalProfit = filteredJobs.reduce((acc, job) => acc + job.profit, 0);
    const totalJobs = filteredJobs.length;
    const totalCont20 = filteredJobs.reduce((acc, job) => acc + job.cont20, 0);
    const totalCont40 = filteredJobs.reduce((acc, job) => acc + job.cont40, 0);
    const totalRevenue = filteredJobs.reduce((acc, job) => acc + job.sell, 0);
    
    // Kimberry Cost Calculation
    const kimberryCost = (totalCont20 * 250000) + (totalCont40 * 500000);

    return { totalProfit, totalJobs, totalCont20, totalCont40, totalRevenue, kimberryCost };
  }, [filteredJobs]);

  const monthlyData = useMemo(() => {
    // If filtering by a specific month, we might still want to show the trend or just that month
    // But usually charts show trend. If filtered, maybe just show that month's data point?
    // Let's stick to showing the filtered data.
    const grouped: Record<string, { month: string, profit: number, revenue: number, cost: number }> = {};
    
    filteredJobs.forEach(job => {
      const m = job.month;
      if (!grouped[m]) {
        grouped[m] = { month: m, profit: 0, revenue: 0, cost: 0 };
      }
      grouped[m].profit += job.profit;
      grouped[m].revenue += job.sell;
      grouped[m].cost += job.cost;
    });

    return Object.values(grouped).sort((a, b) => Number(a.month) - Number(b.month));
  }, [filteredJobs]);

  const contData = [
    { name: 'Cont 20\'', value: stats.totalCont20 },
    { name: 'Cont 40\'', value: stats.totalCont40 },
  ].filter(d => d.value > 0);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumSignificantDigits: 3 }).format(val);

  const StatCard = ({ icon: Icon, title, value, colorClass }: { icon: any, title: string, value: string, colorClass: string }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Hoạt Động</h1>
          <p className="text-sm text-gray-500 mt-1">Tổng quan hiệu suất kinh doanh và vận hành</p>
        </div>
        
        {/* Month Filter */}
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
           <Filter className="w-4 h-4 text-gray-500" />
           <select 
             value={filterMonth} 
             onChange={(e) => setFilterMonth(e.target.value)}
             className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent outline-none cursor-pointer min-w-[120px]"
           >
             <option value="">Tất cả các tháng</option>
             {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
           </select>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard 
          icon={DollarSign} 
          title="Tổng Lợi Nhuận" 
          value={formatCurrency(stats.totalProfit)} 
          colorClass="bg-blue-100 text-blue-700" 
        />
        <StatCard 
          icon={Wallet} 
          title="Doanh Thu" 
          value={formatCurrency(stats.totalRevenue)} 
          colorClass="bg-green-100 text-green-700" 
        />
        <StatCard 
          icon={TrendingUp} 
          title="Tổng Job" 
          value={stats.totalJobs.toString()} 
          colorClass="bg-purple-100 text-purple-700" 
        />
        <StatCard 
          icon={Package} 
          title="Tổng Container" 
          value={(stats.totalCont20 + stats.totalCont40).toString()} 
          colorClass="bg-orange-100 text-orange-700" 
        />
        {/* Kimberry Cost Card */}
        <StatCard 
          icon={Ship} 
          title="CP Kimberry" 
          value={formatCurrency(stats.kimberryCost)} 
          colorClass="bg-red-100 text-red-700" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Main Chart: Profit Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-base font-bold text-gray-900 mb-6">Biểu đồ Lợi Nhuận & Doanh Thu</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                  </linearGradient>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" tickFormatter={(val) => `T${val}`} />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b' }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="url(#colorRevenue)" name="Doanh Thu" />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#1e3a8a" fillOpacity={1} fill="url(#colorProfit)" name="Lợi Nhuận" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Chart: Container Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <h3 className="text-base font-bold text-gray-900 mb-6">Tỷ lệ Container</h3>
           <div className="h-80 w-full flex flex-col items-center justify-center">
             {contData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {contData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} cont`} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
             ) : (
                <p className="text-gray-400 italic">Chưa có dữ liệu container</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
