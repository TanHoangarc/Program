
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { JobEntry } from './pages/JobEntry';
import { Reports } from './pages/Reports';
import { BookingList } from './pages/BookingList';
import { DepositList } from './pages/DepositList';
import { LhkList } from './pages/LhkList';
import { JobData, Customer } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, DEFAULT_LINES } from './constants';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk'>('entry');
  
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

  // Lines State
  const [lines, setLines] = useState<string[]>(() => {
    const saved = localStorage.getItem('logistics_lines');
    return saved ? JSON.parse(saved) : DEFAULT_LINES;
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('logistics_jobs_v2', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('logistics_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('logistics_lines', JSON.stringify(lines));
  }, [lines]);

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

  const handleAddLine = (line: string) => {
    setLines(prev => [...prev, line]);
  };

  const renderContent = () => {
    switch(currentPage) {
      case 'entry':
        return (
          <JobEntry 
            jobs={jobs} 
            onAddJob={handleAddJob}
            onEditJob={handleEditJob}
            onDeleteJob={handleDeleteJob}
            customers={customers}
            onAddCustomer={handleAddCustomer}
            lines={lines}
            onAddLine={handleAddLine}
          />
        );
      case 'booking':
        return <BookingList jobs={jobs} onEditJob={handleEditJob} />;
      case 'reports':
        return <Reports jobs={jobs} />;
      case 'deposit-line':
        return <DepositList mode="line" jobs={jobs} customers={customers} />;
      case 'deposit-customer':
        return <DepositList mode="customer" jobs={jobs} customers={customers} />;
      case 'lhk':
        return <LhkList jobs={jobs} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
      />
      
      <main className="ml-64 flex-1 transition-all duration-300">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
