
import React, { useState, useEffect, useCallback } from 'react';
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
import { LoginPage } from './components/LoginPage';
import { JobData, Customer, ShippingLine, UserAccount } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES } from './constants';

// --- SECURITY CONFIGURATION ---
const DEFAULT_USERS: UserAccount[] = [
  { username: 'KimberryAdmin', pass: 'Jwckim@123#', role: 'Admin' },
  { username: 'Kimberrystaff', pass: 'Jwckim@124#', role: 'Staff' },
  { username: 'Kimberrymanager', pass: 'Jwckim@125#', role: 'Manager' }
];

const AUTH_CHANNEL_NAME = 'kimberry_auth_channel';

const App: React.FC = () => {
  // === LOAD DATA FROM SERVER WHEN APP START ===
useEffect(() => {
  const fetchServerData = async () => {
    try {
      const res = await fetch("https://api.kimberry.id.vn/data", {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      console.log("SERVER DATA LOADED:", data);

      if (data.jobs && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }
      if (data.customers) {
        setCustomers(data.customers);
      }
      if (data.lines) {
        setLines(data.lines);
      }

    } catch (err) {
      console.error("Không lấy được dữ liệu từ máy A:", err);
    }
  };

  fetchServerData();
}, []);

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // --- APP STATE ---
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

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('logistics_users_v1');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  // --- AUTHENTICATION LOGIC & SINGLE SESSION ---
  useEffect(() => {
    const savedUser = sessionStorage.getItem('kb_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data.type === 'LOGIN_SUCCESS' && event.data.username === currentUser.username) {
        handleLogout(true);
      }
    };
    return () => { channel.close(); };
  }, [isAuthenticated, currentUser]);

  const handleLogin = (usernameInput: string, passwordInput: string) => {
    setLoginError('');
    // Check against dynamic users state
    const user = users.find(u => u.username === usernameInput && u.pass === passwordInput);
    
    if (user) {
      const userData = { username: user.username, role: user.role };
      setIsAuthenticated(true);
      setCurrentUser(userData);
      setSessionError('');
      sessionStorage.setItem('kb_user', JSON.stringify(userData));
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.postMessage({ type: 'LOGIN_SUCCESS', username: user.username });
      channel.close();
    } else {
      setLoginError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  const handleLogout = useCallback((forced: boolean = false) => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('kb_user');
    if (forced) {
        setSessionError('Tài khoản của bạn đã được đăng nhập ở nơi khác.');
    } else {
        setSessionError('');
    }
  }, []);

  // Sync Data
  useEffect(() => { localStorage.setItem('logistics_jobs_v2', JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem('logistics_customers_v1', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('logistics_lines_v1', JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem('logistics_users_v1', JSON.stringify(users)); }, [users]);

  // === AUTO BACKUP TO SERVER (Ổ E) ===
const autoBackup = async (overrideJobs?: JobData[]) => {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      version: "2.1",
      jobs: overrideJobs || jobs,
      customers,
      lines
    };

    const res = await fetch("https://api.kimberry.id.vn/backup", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    console.log("AUTO BACKUP OK:", result.message);
  } catch (err) {
    console.error("AUTO BACKUP ERROR:", err);
  }
};

  // === AUTO BACKUP TRIGGER ===

// Tự động backup khi thay đổi JOBS
useEffect(() => {
  autoBackup();
}, [jobs]);

// Tự động backup khi thay đổi CUSTOMERS
useEffect(() => {
  autoBackup();
}, [customers]);

// Tự động backup khi thay đổi LINES
useEffect(() => {
  autoBackup();
}, [lines]);
  
  const handleAddJob = (job: JobData) => setJobs(prev => [job, ...prev]);
  const handleEditJob = (updatedJob: JobData) => setJobs(prev => prev.map(job => job.id === updatedJob.id ? updatedJob : job));
  const handleDeleteJob = (id: string) => setJobs(prev => prev.filter(job => job.id !== id));
  const handleAddCustomer = (customer: Customer) => setCustomers(prev => [...prev, customer]);
  const handleEditCustomer = (customer: Customer) => setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
  const handleDeleteCustomer = (id: string) => setCustomers(prev => prev.filter(c => c.id !== id));
  const handleAddLine = (lineData: any) => {
     if (typeof lineData === 'string') {
        setLines(prev => [...prev, { id: Date.now().toString(), code: lineData, name: lineData, mst: '' }]);
     } else {
        setLines(prev => [...prev, lineData]);
     }
  };
  const handleEditLine = (line: ShippingLine) => setLines(prev => prev.map(l => l.id === line.id ? line : l));
  const handleDeleteLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  // User Management Handlers
  const handleAddUser = (user: UserAccount) => setUsers(prev => [...prev, user]);
  const handleEditUser = (updatedUser: UserAccount, originalUsername: string) => 
    setUsers(prev => prev.map(u => u.username === originalUsername ? updatedUser : u));
  const handleDeleteUser = (username: string) => setUsers(prev => prev.filter(u => u.username !== username));

  const handleResetData = () => {
    if (window.confirm("Bạn có chắc chắn muốn reset về dữ liệu mẫu?")) {
      setJobs(sanitizeData(MOCK_DATA)); setCustomers(MOCK_CUSTOMERS); setLines(MOCK_SHIPPING_LINES); setUsers(DEFAULT_USERS);
      localStorage.removeItem('logistics_jobs_v2'); localStorage.removeItem('logistics_customers_v1'); localStorage.removeItem('logistics_lines_v1'); localStorage.removeItem('logistics_users_v1');
      window.location.reload();
    }
  };

  const handleRestoreSystem = (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[] }) => {
    setJobs(sanitizeData(data.jobs)); setCustomers(data.customers); setLines(data.lines);
  };

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} error={sessionError || loginError} />;

  return (
    <div className="flex w-full h-screen overflow-hidden relative">
      {/* Sidebar - Fixed Position */}
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        onResetData={handleResetData} 
        currentUser={currentUser}
        onLogout={() => handleLogout(false)}
      />
      
      {/* Main Content Area - Shifted Right */}
      <div className="flex-1 ml-[280px] p-4 h-full flex flex-col">
        
        {/* Scrollable Content Container */}
        <main className="flex-1 rounded-3xl overflow-hidden relative shadow-inner">
           {/* Glass Background for Content */}
           <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl border border-white/40 rounded-3xl z-0"></div>
           
           <div className="relative z-10 h-full overflow-y-auto custom-scrollbar p-2">
              {currentPage === 'entry' && <JobEntry jobs={jobs} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={handleDeleteJob} customers={customers} onAddCustomer={handleAddCustomer} lines={lines} onAddLine={handleAddLine} initialJobId={targetJobId} onClearTargetJob={() => setTargetJobId(null)} />}
              {currentPage === 'reports' && <Reports jobs={jobs} />}
              {currentPage === 'booking' && <BookingList jobs={jobs} onEditJob={handleEditJob} initialBookingId={targetBookingId} onClearTargetBooking={() => setTargetBookingId(null)} />}
              {currentPage === 'deposit-line' && <DepositList mode="line" jobs={jobs} customers={customers} lines={lines} onEditJob={handleEditJob} onAddLine={handleAddLine} onAddCustomer={handleAddCustomer} />}
              {currentPage === 'deposit-customer' && <DepositList mode="customer" jobs={jobs} customers={customers} lines={lines} onEditJob={handleEditJob} onAddLine={handleAddLine} onAddCustomer={handleAddCustomer} />}
              {currentPage === 'lhk' && <LhkList jobs={jobs} />}
              {currentPage === 'amis-thu' && <AmisExport jobs={jobs} customers={customers} mode="thu" />}
              {currentPage === 'amis-chi' && <AmisExport jobs={jobs} customers={customers} mode="chi" />}
              {currentPage === 'amis-ban' && <AmisExport jobs={jobs} customers={customers} mode="ban" />}
              {currentPage === 'amis-mua' && <AmisExport jobs={jobs} customers={customers} mode="mua" />}
              {currentPage === 'data-lines' && <DataManagement mode="lines" data={lines} onAdd={handleAddLine} onEdit={handleEditLine} onDelete={handleDeleteLine} />}
              {currentPage === 'data-customers' && <DataManagement mode="customers" data={customers} onAdd={handleAddCustomer} onEdit={handleEditCustomer} onDelete={handleDeleteCustomer} />}
              {currentPage === 'debt' && <DebtManagement jobs={jobs} customers={customers} />}
              {currentPage === 'profit' && <ProfitReport jobs={jobs} onViewJob={(id) => { setTargetJobId(id); setCurrentPage('entry'); }} />}
              {currentPage === 'reconciliation' && <Reconciliation jobs={jobs} />}
              {currentPage === 'system' && (
                <SystemPage 
                  jobs={jobs} 
                  customers={customers} 
                  lines={lines} 
                  users={users}
                  currentUser={currentUser}
                  onRestore={handleRestoreSystem} 
                  onAddUser={handleAddUser}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;
