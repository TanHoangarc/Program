import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { JobEntry } from './pages/JobEntry';
import { Reports } from './pages/Reports';
import { BookingList } from './pages/BookingList';
import { DepositList } from './pages/DepositList';
import { LhkList } from './pages/LhkList';
import { AmisExport } from './pages/AmisExport';
import { DataManagement } from './pages/DataManagement';
import { DebtManagement } from './pages/DebtManagement';
import { SystemPage } from './pages/SystemPage';
import { Reconciliation } from './pages/Reconciliation';
import { JobData, Customer, ShippingLine } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES } from './constants';
import { Search, Bell, User, ChevronDown, Ship } from 'lucide-react';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'system' | 'reconciliation'>('entry');
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  
  // Jobs State
  const [jobs, setJobs] = useState<JobData[]>(() => {
    const saved = localStorage.getItem('logistics_jobs_v2');
    return saved ? JSON.parse(saved) : MOCK_DATA;
  });

  // Customers State
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('logistics_customers');
    return saved ? JSON.parse(saved) : MOCK_CUSTOMERS;
  });

  // Shipping Lines State
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>(() => {
    const saved = localStorage.getItem('logistics_shipping_lines');
    if (saved) return JSON.parse(saved);
    return MOCK_SHIPPING_LINES;
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('logistics_jobs_v2', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('logistics_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('logistics_shipping_lines', JSON.stringify(shippingLines));
  }, [shippingLines]);

  const handleAddJob = (newJob: JobData) => {
    setJobs(prev => [newJob, ...prev]);
  };

  const handleEditJob = (updatedJob: JobData) => {
    setJobs(prev => prev.map(job => job.id === updatedJob.id ? updatedJob : job));
  };

  const handleDeleteJob = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa job này không?')) {
      setJobs(prev => prev.filter(job => job.id !== id));
    }
  };

  const handleAddCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
  };

  const handleEditCustomer = (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const handleAddLine = (lineNameOrObj: string | ShippingLine) => {
    if (typeof lineNameOrObj === 'string') {
      const newLine: ShippingLine = {
        id: Date.now().toString(),
        code: lineNameOrObj.substring(0, 4).toUpperCase(),
        name: lineNameOrObj,
        mst: ''
      };
      setShippingLines(prev => [...prev, newLine]);
    } else {
      setShippingLines(prev => [...prev, lineNameOrObj]);
    }
  };

  const handleEditLine = (updatedLine: ShippingLine) => {
    setShippingLines(prev => prev.map(l => l.id === updatedLine.id ? updatedLine : l));
  };

  const handleDeleteLine = (id: string) => {
    setShippingLines(prev => prev.filter(l => l.id !== id));
  };

  const handleNavigateToBooking = (bookingId: string) => {
    setTargetBookingId(bookingId);
    setCurrentPage('booking');
  };

  const handleResetData = () => {
    if (window.confirm('CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ danh sách Job hiện tại.\nBạn có chắc chắn muốn tiếp tục không?')) {
      setJobs([]);
      localStorage.setItem('logistics_jobs_v2', JSON.stringify([]));
    }
  };

  // Restore logic for System Page
  const handleSystemRestore = (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[] }) => {
    if (data.jobs) setJobs(data.jobs);
    if (data.customers && data.customers.length > 0) setCustomers(data.customers);
    if (data.lines && data.lines.length > 0) setShippingLines(data.lines);
  };

  const renderContent = () => {
    switch(currentPage) {
      case 'entry':
        return <JobEntry jobs={jobs} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={handleDeleteJob} customers={customers} onAddCustomer={handleAddCustomer} lines={shippingLines} onAddLine={handleAddLine} />;
      case 'booking':
        return <BookingList jobs={jobs} onEditJob={handleEditJob} initialBookingId={targetBookingId} onClearTargetBooking={() => setTargetBookingId(null)} />;
      case 'reports':
        return <Reports jobs={jobs} />;
      case 'deposit-line':
        return <DepositList mode="line" jobs={jobs} customers={customers} />;
      case 'deposit-customer':
        return <DepositList mode="customer" jobs={jobs} customers={customers} />;
      case 'lhk':
        return <LhkList jobs={jobs} />;
      case 'amis-thu':
        return <AmisExport jobs={jobs} customers={customers} mode="thu" />;
      case 'amis-chi':
        return <AmisExport jobs={jobs} customers={customers} mode="chi" />;
      case 'amis-ban':
        return <AmisExport jobs={jobs} customers={customers} mode="ban" />;
      case 'amis-mua':
        return <AmisExport jobs={jobs} customers={customers} mode="mua" />;
      case 'reconciliation':
        return <Reconciliation jobs={jobs} />;
      case 'data-lines':
        return <DataManagement mode="lines" data={shippingLines} onAdd={handleAddLine} onEdit={handleEditLine} onDelete={handleDeleteLine} />;
      case 'data-customers':
        return <DataManagement mode="customers" data={customers} onAdd={handleAddCustomer} onEdit={handleEditCustomer} onDelete={handleDeleteCustomer} />;
      case 'debt':
        return <DebtManagement jobs={jobs} customers={customers} />;
      case 'system':
        return <SystemPage jobs={jobs} customers={customers} lines={shippingLines} onRestore={handleSystemRestore} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-100">
      
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-brand-DEFAULT text-white z-50 flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center space-x-3">
          <Ship className="w-6 h-6 text-blue-300" />
          <span className="text-xl font-bold tracking-tight">LogiSoft</span>
          <div className="hidden md:flex ml-8 space-x-1">
             <button className="px-4 py-2 text-sm font-medium bg-brand-dark/50 rounded-t-md border-b-2 border-blue-400">Dashboard</button>
             <button className="px-4 py-2 text-sm font-medium text-blue-200 hover:text-white">Operations</button>
             <button className="px-4 py-2 text-sm font-medium text-blue-200 hover:text-white">Finance</button>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="relative hidden md:block">
            <input 
              type="text" 
              placeholder="Search keyword" 
              className="pl-4 pr-10 py-1.5 rounded bg-white text-slate-800 text-sm focus:outline-none w-64"
            />
            <div className="absolute right-0 top-0 h-full w-8 flex items-center justify-center bg-gray-200 rounded-r text-gray-500">
               <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          
          <button className="text-blue-200 hover:text-white relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center space-x-2 border-l border-blue-800 pl-6">
            <span className="text-sm text-right hidden lg:block">
              <div className="font-medium">Admin User</div>
              <div className="text-xs text-blue-300">Logistics Manager</div>
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-200 text-brand-DEFAULT flex items-center justify-center">
               <User className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex pt-16">
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={(page) => {
            setCurrentPage(page);
            setTargetBookingId(null);
          }} 
          onResetData={handleResetData}
        />
        
        <main className="ml-64 flex-1 p-6 min-h-[calc(100vh-64px)] overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;