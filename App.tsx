
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { JobEntry } from './pages/JobEntry';
import { Reports } from './pages/Reports';
import { BookingList } from './pages/BookingList';
import { DepositList } from './pages/DepositList';
import { LhkList } from './pages/LhkList';
import { AmisExport } from './pages/AmisExport';
import { DataManagement } from './pages/DataManagement';
import { JobData, Customer, ShippingLine } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES, DEFAULT_LINES } from './constants';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers'>('entry');
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

  // Shipping Lines State (New Object Structure)
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>(() => {
    const saved = localStorage.getItem('logistics_shipping_lines');
    if (saved) return JSON.parse(saved);
    
    // Migration: If no object lines exist, try to check if we had old string lines
    const oldLines = localStorage.getItem('logistics_lines');
    if (oldLines) {
      const parsedOld: string[] = JSON.parse(oldLines);
      // Convert old string array to object array
      return parsedOld.map((name, idx) => ({
        id: `migrated-${idx}`,
        code: name.toUpperCase().substring(0, 4),
        name: name,
        mst: ''
      }));
    }
    
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

  // Line Handlers
  const handleAddLine = (lineNameOrObj: string | ShippingLine) => {
    if (typeof lineNameOrObj === 'string') {
      // Compatibility for Quick Add in Job Modal (String only)
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

  // Derive simple string array for backward compatibility with JobModal
  const lineNames = shippingLines.map(l => l.name);

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
            lines={lineNames}
            onAddLine={handleAddLine}
          />
        );
      case 'booking':
        return (
          <BookingList 
            jobs={jobs} 
            onEditJob={handleEditJob} 
            initialBookingId={targetBookingId}
            onClearTargetBooking={() => setTargetBookingId(null)}
          />
        );
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
      case 'data-lines':
        return (
          <DataManagement 
            mode="lines" 
            data={shippingLines} 
            onAdd={handleAddLine} 
            onEdit={handleEditLine} 
            onDelete={handleDeleteLine} 
          />
        );
      case 'data-customers':
        return (
          <DataManagement 
            mode="customers" 
            data={customers} 
            onAdd={handleAddCustomer} 
            onEdit={handleEditCustomer} 
            onDelete={handleDeleteCustomer} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={(page) => {
          setCurrentPage(page);
          setTargetBookingId(null); // Reset target when manually navigating
        }} 
      />
      
      <main className="ml-64 flex-1 transition-all duration-300">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
