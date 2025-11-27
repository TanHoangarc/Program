import React, { useMemo } from 'react';
import { JobData } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, Package, DollarSign, Wallet } from 'lucide-react';

interface ReportsProps {
  jobs: JobData[];
}

export const Reports: React.FC<ReportsProps> = ({ jobs }) => {

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const stats = useMemo(() => {
    const totalProfit = jobs.reduce((acc, job) => acc + job.profit, 0);
    const totalJobs = jobs.length;
    const totalCont20 = jobs.reduce((acc, job) => acc + job.cont20, 0);
    const totalCont40 = jobs.reduce((acc, job) => acc + job.cont40, 0);
    const totalRevenue = jobs.reduce((acc, job) => acc + job.sell, 0);

    return { totalProfit, totalJobs, totalCont20, totalCont40, totalRevenue };
  }, [jobs]);

  const monthlyData = useMemo(() => {
    const grouped: Record<string, { month: string, profit: number, revenue: number, cost: number }> = {};
    
    jobs.forEach(job => {
      const m = job.month;
      if (!grouped[m]) {
        grouped[m] = { month: m, profit: 0, revenue: 0, cost: 0 };
      }
      grouped[m].profit += job.profit;
      grouped[m].revenue += job.sell;
      grouped[m].cost += job.cost;
    });

    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [jobs]);

  const contData = [
    { name: 'Cont 20\'', value: stats.totalCont20 },
    { name: 'Cont 40\'', value: stats.totalCont40 },
  ].filter(d => d.value > 0);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumSignificantDigits: 3 }).format(val);

  return (
    <div className="p-8 max-w-full">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Báo Cáo Hoạt Động</h1>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tổng Lợi Nhuận</p>
            <h3 className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalProfit)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Doanh Thu</p>
            <h3 className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalRevenue)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tổng Job</p>
            <h3 className="text-xl font-bold text-slate-800">{stats.totalJobs}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
           <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tổng Container</p>
            <h3 className="text-xl font-bold text-slate-800">{stats.totalCont20 + stats.totalCont40}</h3>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Main Chart: Profit Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Biểu đồ Lợi Nhuận & Chi Phí theo Tháng</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                   <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `${val / 1000000}M`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Doanh Thu" />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProfit)" name="Lợi Nhuận" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Chart: Container Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 mb-6">Tỷ lệ Container</h3>
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
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
             ) : (
                <p className="text-gray-400">Chưa có dữ liệu container</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};