
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
import { ProfitReport } from './pages/ProfitReport';
import { JobData, Customer, ShippingLine } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES } from './constants';
import { Search, Bell, User, ChevronDown, Ship } from 'lucide-react';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation'>('entry');
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  
  // Helper: Sanitize Data to prevent duplicate IDs (Self-Healing)
  const sanitizeData = (data: JobData[]): JobData[] => {
    const seenIds = new Set<string>();
    let hasDuplicates = false;

    const sanitized = data.map(job => {
      // If ID is missing or duplicate, generate a new one
      if (!job.id || seenIds.has(job.id)) {
        hasDuplicates = true;
        const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.floor(Math.random() * 1000)}`;
        return { ...job, id: newId };
      }
      seenIds.add(job.id);
      return job;
    });

    if (hasDuplicates) {
      console.warn("Found and fixed duplicate IDs in initial data");
    }
    return sanitized;
  };

  // Load initial data from localStorage or use Mock
  const [jobs, setJobs] = useState<JobData[]>(() => {
    const saved = localStorage.getItem('logistics_jobs_v2');
    return saved ? sanitizeData(JSON.parse(saved)) : sanitizeData(MOCK_DATA);
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('logistics_customers_v1');
    return saved ? JSON.parse(saved) : MOCK_CUSTOMERS;
  });

  const [lines, setLines] = useState<ShippingLine[]>(() => {
    const saved = localStorage.getItem('logistics_lines_v1');
    return saved ? JSON.parse(saved) : MOCK_SHIPPING_LINES;
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('logistics_jobs_v2', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('logistics_customers_v1', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('logistics_lines_v1', JSON.stringify(lines));
  }, [lines]);

  const handleAddJob = (job: JobData) => {
    setJobs(prev => [job, ...prev]);
  };

  const handleEditJob = (updatedJob: JobData) => {
    setJobs(prev => prev.map(job => job.id === updatedJob.id ? updatedJob : job));
  };

  const handleDeleteJob = (id: string) => {
    setJobs(prev => prev.filter(job => job.id !== id));
  };

  const handleAddCustomer = (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
  };

  const handleEditCustomer = (customer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const handleAddLine = (lineData: any) => {
     // Check if it's a string (old way) or object (new way)
     if (typeof lineData === 'string') {
        const newLine: ShippingLine = { 
            id: Date.now().toString(), 
            code: lineData, 
            name: lineData, 
            mst: '' 
        };
        setLines(prev => [...prev, newLine]);
     } else {
        setLines(prev => [...prev, lineData]);
     }
  };

  const handleEditLine = (line: ShippingLine) => {
    setLines(prev => prev.map(l => l.id === line.id ? line : l));
  };

  const handleDeleteLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleResetData = () => {
    if (window.confirm("Bạn có chắc chắn muốn reset về dữ liệu mẫu? Dữ liệu hiện tại sẽ bị mất.")) {
      setJobs(sanitizeData(MOCK_DATA));
      setCustomers(MOCK_CUSTOMERS);
      setLines(MOCK_SHIPPING_LINES);
      localStorage.removeItem('logistics_jobs_v2');
      localStorage.removeItem('logistics_customers_v1');
      localStorage.removeItem('logistics_lines_v1');
      window.location.reload();
    }
  };

  const handleNavigateToBooking = (bookingId: string) => {
    setTargetBookingId(bookingId);
    setCurrentPage('booking');
  };

  const handleNavigateToJob = (jobId: string) => {
    setTargetJobId(jobId);
    setCurrentPage('entry');
  };

  // --- RESTORE FUNCTION ---
  const handleRestoreSystem = (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[] }) => {
    setJobs(sanitizeData(data.jobs));
    setCustomers(data.customers);
    setLines(data.lines);
  };

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onResetData={handleResetData} />
      
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-30 flex-shrink-0">
          <div className="flex items-center text-gray-400 text-sm">
             <Ship className="w-5 h-5 mr-2" />
             <span className="font-semibold text-gray-600">Logistics Management System</span>
             <span className="mx-2">/</span>
             <span className="text-gray-900 font-medium capitalize">{currentPage.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center space-x-6">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center space-x-3 pl-6 border-l border-gray-100 cursor-pointer hover:bg-gray-50 py-1 px-2 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                AD
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-400">Quản trị viên</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-100 relative">
          {currentPage === 'entry' && (
            <div className="p-8">
               <JobEntry 
                  jobs={jobs} 
                  onAddJob={handleAddJob} 
                  onEditJob={handleEditJob} 
                  onDeleteJob={handleDeleteJob} 
                  customers={customers} 
                  onAddCustomer={handleAddCustomer} 
                  lines={lines}
                  onAddLine={handleAddLine}
                  initialJobId={targetJobId}
                  onClearTargetJob={() => setTargetJobId(null)}
               />
            </div>
          )}
          
          {currentPage === 'reports' && (
            <Reports jobs={jobs} />
          )}

          {currentPage === 'booking' && (
            <BookingList 
               jobs={jobs} 
               onEditJob={handleEditJob} 
               initialBookingId={targetBookingId}
               onClearTargetBooking={() => setTargetBookingId(null)}
            />
          )}

          {currentPage === 'deposit-line' && (
            <DepositList 
              mode="line" 
              jobs={jobs} 
              customers={customers} 
              lines={lines}
              onEditJob={handleEditJob}
              onAddLine={handleAddLine}
              onAddCustomer={handleAddCustomer}
            />
          )}

          {currentPage === 'deposit-customer' && (
            <DepositList 
              mode="customer" 
              jobs={jobs} 
              customers={customers} 
              lines={lines}
              onEditJob={handleEditJob}
              onAddLine={handleAddLine}
              onAddCustomer={handleAddCustomer}
            />
          )}

          {currentPage === 'lhk' && (
            <LhkList jobs={jobs} />
          )}

          {/* Amis Export Pages */}
          {currentPage === 'amis-thu' && <AmisExport jobs={jobs} customers={customers} mode="thu" />}
          {currentPage === 'amis-chi' && <AmisExport jobs={jobs} customers={customers} mode="chi" />}
          {currentPage === 'amis-ban' && <AmisExport jobs={jobs} customers={customers} mode="ban" />}
          {currentPage === 'amis-mua' && <AmisExport jobs={jobs} customers={customers} mode="mua" />}
          
          {/* Data Management Pages */}
          {currentPage === 'data-lines' && (
            <DataManagement 
               mode="lines" 
               data={lines} 
               onAdd={handleAddLine} 
               onEdit={handleEditLine} 
               onDelete={handleDeleteLine}
            />
          )}
          {currentPage === 'data-customers' && (
            <DataManagement 
               mode="customers" 
               data={customers} 
               onAdd={handleAddCustomer} 
               onEdit={handleEditCustomer} 
               onDelete={handleDeleteCustomer}
            />
          )}

          {currentPage === 'debt' && <DebtManagement jobs={jobs} customers={customers} />}
          {currentPage === 'profit' && <ProfitReport jobs={jobs} onViewJob={handleNavigateToJob} />}
          {currentPage === 'reconciliation' && <Reconciliation jobs={jobs} />}
          
          {currentPage === 'system' && (
            <SystemPage 
               jobs={jobs} 
               customers={customers} 
               lines={lines} 
               onRestore={handleRestoreSystem} 
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
