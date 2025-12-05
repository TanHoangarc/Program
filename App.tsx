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

  // Đánh dấu dữ liệu đã tải từ server chưa
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // --- APP STATE ---
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation'>('entry');

  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);

  // Helper: Sanitize Data
  const sanitizeData = (data: JobData[]): JobData[] => {
    const seenIds = new Set<string>();
    let hasDuplicates = false;

    const sanitized = data.map(job => {
      if (!job.id || seenIds.has(job.id)) {
        hasDuplicates = true;
        const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return { ...job, id: newId };
      }
      seenIds.add(job.id);
      return job;
    });

    if (hasDuplicates) console.warn("Fixed duplicate IDs");

    return sanitized;
  };

  // Load initial data from localStorage
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

  // --- LOAD DATA FROM SERVER WHEN APP START ---
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const res = await fetch("https://api.kimberry.id.vn/data");
        const data = await res.json();

        console.log("SERVER DATA LOADED:", data);

        if (data.jobs) setJobs(data.jobs);
        if (data.customers) setCustomers(data.customers);
        if (data.lines) setLines(data.lines);

        setLoadedFromServer(true);

      } catch (err) {
        console.error("Không lấy được dữ liệu từ máy A:", err);
      }
    };

    fetchServerData();
  }, []);

  // --- AUTH LOGIC ---
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

    return () => channel.close();
  }, [isAuthenticated, currentUser]);

  const handleLogin = (username: string, pass: string) => {
    setLoginError('');
    const user = users.find(u => u.username === username && u.pass === pass);

    if (user) {
      const userData = { username: user.username, role: user.role };
      setIsAuthenticated(true);
      setCurrentUser(userData);
      setSessionError('');
      sessionStorage.setItem('kb_user', JSON.stringify(userData));
    } else {
      setLoginError("Thông tin đăng nhập không đúng");
    }
  };

  const handleLogout = useCallback((forced = false) => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('kb_user');
    setSessionError(forced ? "Tài khoản đã được đăng nhập nơi khác." : "");
  }, []);

  // === AUTO BACKUP TO SERVER (Chỉ máy A ghi vào E) ===
  const autoBackup = async () => {
    if (loadedFromServer) return; // tránh backup khi lấy từ máy A
    if (!currentUser || currentUser.role !== "Admin") return;

    try {
      const data = {
        timestamp: new Date().toISOString(),
        version: "2.1",
        jobs,
        customers,
        lines
      };

      await fetch("https://api.kimberry.id.vn/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      console.log("AUTO BACKUP SUCCESS");

    } catch (err) {
      console.error("AUTO BACKUP FAILED:", err);
    }
  };

  // Trigger auto backup on changes
  useEffect(() => { autoBackup(); }, [jobs]);
  useEffect(() => { autoBackup(); }, [customers]);
  useEffect(() => { autoBackup(); }, [lines]);

  // SAVE TO LOCAL STORAGE
  useEffect(() => { localStorage.setItem("logistics_jobs_v2", JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem("logistics_customers_v1", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("logistics_lines_v1", JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem("logistics_users_v1", JSON.stringify(users)); }, [users]);

  
  if (!isAuthenticated)
    return <LoginPage onLogin={handleLogin} error={sessionError || loginError} />;
  
const sendPendingToServer = async () => {
  if (!currentUser) return;

  try {
    const data = {
      user: currentUser.username,
      timestamp: new Date().toISOString(),
      jobs,
      customers,
      lines
    };

    await fetch("https://api.kimberry.id.vn/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    alert("Đã gửi lên server chờ Admin duyệt!");

  } catch (err) {
    console.error("Gửi pending thất bại:", err);
  }
};

  return (
    <div className="flex w-full h-screen overflow-hidden relative">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onResetData={() => window.location.reload()}
        currentUser={currentUser}
        onLogout={() => handleLogout(false)}
        onSendPending={sendPendingToServer}
      />

      <div className="flex-1 ml-[280px] p-4 h-full flex flex-col">
        <main className="flex-1 rounded-3xl overflow-hidden relative shadow-inner">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl border border-white/40 rounded-3xl z-0"></div>

          <div className="relative z-10 h-full overflow-y-auto custom-scrollbar p-2">

            {currentPage === 'entry' && (
              <JobEntry
                jobs={jobs}
                onAddJob={(job) => setJobs([job, ...jobs])}
                onEditJob={(j) => setJobs(prev => prev.map(x => x.id === j.id ? j : x))}
                onDeleteJob={(id) => setJobs(prev => prev.filter(x => x.id !== id))}
                customers={customers}
                onAddCustomer={(c) => setCustomers([...customers, c])}
                lines={lines}
                onAddLine={(l) => setLines([...lines, l])}
              />
            )}

            {currentPage === 'reports' && <Reports jobs={jobs} />}
            {currentPage === 'booking' && <BookingList jobs={jobs} onEditJob={(j) => setJobs(prev => prev.map(x => x.id === j.id ? j : x))} />}
            {currentPage === 'deposit-line' && <DepositList mode="line" jobs={jobs} customers={customers} lines={lines} />}
            {currentPage === 'deposit-customer' && <DepositList mode="customer" jobs={jobs} customers={customers} lines={lines} />}
            {currentPage === 'lhk' && <LhkList jobs={jobs} />}
            {currentPage === 'amis-thu' && <AmisExport jobs={jobs} customers={customers} mode="thu" />}
            {currentPage === 'amis-chi' && <AmisExport jobs={jobs} customers={customers} mode="chi" />}
            {currentPage === 'amis-ban' && <AmisExport jobs={jobs} customers={customers} mode="ban" />}
            {currentPage === 'amis-mua' && <AmisExport jobs={jobs} customers={customers} mode="mua" />}

            {currentPage === 'profit' && (
              <ProfitReport jobs={jobs} onViewJob={(id) => { setTargetJobId(id); setCurrentPage("entry"); }} />
            )}

            {currentPage === 'data-lines' && (
              <DataManagement mode="lines" data={lines} onAdd={(line) => setLines([...lines, line])} />
            )}

            {currentPage === 'data-customers' && (
              <DataManagement mode="customers" data={customers} onAdd={(c) => setCustomers([...customers, c])} />
            )}

            {currentPage === 'system' && (
              <SystemPage
                jobs={jobs}
                customers={customers}
                lines={lines}
                users={users}
                currentUser={currentUser}
                onRestore={(d) => {
                  setJobs(sanitizeData(d.jobs));
                  setCustomers(d.customers);
                  setLines(d.lines);
                }}
              />
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
