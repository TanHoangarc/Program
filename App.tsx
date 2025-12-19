
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { LookupPage } from './pages/LookupPage'; 
import { PaymentPage } from './pages/PaymentPage'; 
import { CVHCPage } from './pages/CVHCPage'; 
import { SalaryPage } from './pages/SalaryPage';
import { LoginPage } from './components/LoginPage';
import { Menu, Ship } from 'lucide-react';

import { JobData, Customer, ShippingLine, UserAccount, PaymentRequest, SalaryRecord } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES } from './constants';

const DEFAULT_USERS: UserAccount[] = [
  { username: 'KimberryAdmin', pass: 'Jwckim@123#', role: 'Admin' },
  { username: 'Kimberrystaff', pass: 'Jwckim@124#', role: 'Staff' },
  { username: 'Kimberrymanager', pass: 'Jwckim@125#', role: 'Manager' },
  { username: 'Dockimberry', pass: 'Kimberry@123', role: 'Docs' }
];

const App: React.FC = () => {
  const [isServerAvailable, setIsServerAvailable] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  
  const [syncStatus, setSyncStatus] = useState<'saved' | 'syncing' | 'error'>('saved');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialLoad = useRef(true);
  const lastSyncTime = useRef<string>("");

  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation' | 'lookup' | 'payment' | 'cvhc' | 'salary'>(() => {
      try {
          const savedUser = localStorage.getItem('kb_user') || sessionStorage.getItem('kb_user');
          if (savedUser) {
              const user = JSON.parse(savedUser);
              if (user.role === 'Docs') return 'lookup';
          }
      } catch {}
      return 'entry';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  const [modifiedJobIds, setModifiedJobIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_modified_job_ids');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
  });

  const [modifiedPaymentIds, setModifiedPaymentIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_modified_payment_ids');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
  });

  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_deleted_reqs');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
  });

  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  // Helper: Sanitize Data
  const sanitizeData = (data: JobData[]): JobData[] => {
    const seenIds = new Set<string>();
    const currentYear = new Date().getFullYear();
    return data.map(job => {
      const fixedJob = { ...job };
      if (!fixedJob.id || seenIds.has(fixedJob.id)) {
        fixedJob.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      seenIds.add(fixedJob.id);
      if (!fixedJob.year) fixedJob.year = currentYear;
      return fixedJob;
    });
  };

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

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(() => {
    try {
        const saved = localStorage.getItem('payment_requests_v1');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [salaries, setSalaries] = useState<SalaryRecord[]>(() => {
      try {
          const saved = localStorage.getItem('logistics_salaries');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  const [customReceipts, setCustomReceipts] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('amis_custom_receipts');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('logistics_users_v1');
    if (saved) {
        const localUsers = JSON.parse(saved);
        const updatedUsers = [...localUsers];
        DEFAULT_USERS.forEach(defUser => {
            if (!updatedUsers.some(u => u.username === defUser.username)) updatedUsers.push(defUser);
        });
        return updatedUsers;
    }
    return DEFAULT_USERS;
  });

  useEffect(() => { localStorage.setItem('kb_deleted_reqs', JSON.stringify(Array.from(localDeletedIds))); }, [localDeletedIds]);
  useEffect(() => { localStorage.setItem('kb_modified_job_ids', JSON.stringify(Array.from(modifiedJobIds))); }, [modifiedJobIds]);
  useEffect(() => { localStorage.setItem('kb_modified_payment_ids', JSON.stringify(Array.from(modifiedPaymentIds))); }, [modifiedPaymentIds]);
  useEffect(() => { localStorage.setItem("logistics_jobs_v2", JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem("payment_requests_v1", JSON.stringify(paymentRequests)); }, [paymentRequests]);
  useEffect(() => { localStorage.setItem("logistics_customers_v1", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("logistics_lines_v1", JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem("logistics_users_v1", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('amis_custom_receipts', JSON.stringify(customReceipts)); }, [customReceipts]);
  useEffect(() => { localStorage.setItem('logistics_salaries', JSON.stringify(salaries)); }, [salaries]);

  // FETCH DATA FROM SERVER - FAST SYNC
  const fetchData = useCallback(async (silent = false, force = false) => {
    if (!silent) setSyncStatus('syncing');
    try {
      const res = await fetch(`https://api.kimberry.id.vn/data?v=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (res.ok) {
        const data = await res.json();
        
        // Kiểm tra xem dữ liệu server có thực sự mới hơn không thông qua timestamp
        if (!force && data.timestamp === lastSyncTime.current) {
            if (!silent) setSyncStatus('saved');
            return;
        }

        const shouldUpdateAll = force || isInitialLoad.current;

        // Cập nhật lương và danh mục (Luôn ưu tiên server)
        if (data.salaries) setSalaries(data.salaries);
        if (data.customers) setCustomers(data.customers);
        if (data.lines) setLines(data.lines);
        if (data.customReceipts) setCustomReceipts(data.customReceipts);
        if (data.lockedIds) setLockedIds(new Set(data.lockedIds));
        if (data.processedRequestIds) setLocalDeletedIds(new Set(data.processedRequestIds));

        // Job và Payment chỉ cập nhật khi máy này không đang gõ dở
        if (shouldUpdateAll || modifiedJobIds.size === 0) {
            if (data.jobs) setJobs(sanitizeData(data.jobs));
        }
        if (shouldUpdateAll || modifiedPaymentIds.size === 0) {
            if (data.paymentRequests) setPaymentRequests(data.paymentRequests);
        }
        
        if (data.users) {
            const m = new Map(users.map(u => [u.username, u]));
            data.users.forEach((u: UserAccount) => m.set(u.username, u));
            setUsers(Array.from(m.values()));
        }
        
        lastSyncTime.current = data.timestamp || "";
        setIsServerAvailable(true);
        if (!silent) setSyncStatus('saved');
        isInitialLoad.current = false;
      }
    } catch (err) {
      if (!silent) setSyncStatus('error');
      setIsServerAvailable(false);
    }
  }, [modifiedJobIds, modifiedPaymentIds, users]);

  // High-frequency polling (mỗi 15 giây)
  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => { 
        if (!document.hidden) fetchData(true); 
    }, 15000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  // BACKUP LOGIC - SPEED OPTIMIZED
  const performBackup = useCallback(async (immediate = false) => {
    if (!currentUser) return;
    
    // Nếu không phải khẩn cấp, đợi debounce
    setSyncStatus('syncing');
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const now = new Date().toISOString();
      const payload = {
        timestamp: now,
        user: currentUser.username,
        version: "2.9",
        jobs, paymentRequests, customers, lines, salaries, users,
        lockedIds: Array.from(lockedIds),
        processedRequestIds: Array.from(localDeletedIds),
        customReceipts
      };

      const response = await fetch("https://api.kimberry.id.vn/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (response.ok) {
        lastSyncTime.current = now;
        setSyncStatus('saved');
        setIsServerAvailable(true);
      } else { throw new Error("Server Backup Failed"); }
    } catch (err: any) {
      if (err.name !== 'AbortError') setSyncStatus('error');
    }
  }, [jobs, paymentRequests, customers, lines, users, lockedIds, customReceipts, localDeletedIds, salaries, currentUser]);

  // Tự động đẩy dữ liệu khi có thay đổi (Debounce 1.5s)
  useEffect(() => {
    if (isInitialLoad.current) return;
    const timer = setTimeout(() => { performBackup(); }, 1500); 
    return () => clearTimeout(timer);
  }, [jobs, paymentRequests, customers, lines, users, lockedIds, customReceipts, localDeletedIds, salaries, performBackup]);

  // HANDLERS (Thêm lệnh đẩy dữ liệu ngay lập tức cho các thao tác quan trọng)
  const handleAddJob = (job: JobData) => {
      setJobs(prev => [job, ...prev]);
      setModifiedJobIds(prev => new Set(prev).add(job.id));
  };

  const handleEditJob = (job: JobData) => {
      setJobs(prev => prev.map(x => x.id === job.id ? JSON.parse(JSON.stringify(job)) : x));
      setModifiedJobIds(prev => new Set(prev).add(job.id));
  };

  const handleUpdateSalaries = (newSalaries: SalaryRecord[]) => {
      setSalaries(newSalaries);
      // Đẩy khẩn cấp đối với dữ liệu Lương
      setTimeout(() => performBackup(), 500);
  };

  const handleUpdatePaymentRequests = (newRequests: PaymentRequest[]) => {
      setPaymentRequests([...newRequests]);
      setModifiedPaymentIds(prev => { 
        const next = new Set(prev);
        newRequests.forEach(r => next.add(r.id));
        return next;
      });
  };

  const sendPendingToServer = async (directPayload?: any) => {
    if (!currentUser) return;
    let payload = directPayload;
    if (!payload) {
        const jobsToSend = jobs.filter(j => modifiedJobIds.has(j.id));
        const paymentsToSend = paymentRequests.filter(p => modifiedPaymentIds.has(p.id));
        payload = {
            user: currentUser.username, 
            timestamp: new Date().toISOString(),
            jobs: jobsToSend, 
            paymentRequests: paymentsToSend,
            salaries,
            customers, lines, customReceipts, users
        };
    }

    try {
      const res = await fetch("https://api.kimberry.id.vn/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok && !directPayload) {
          alert("Đã gửi dữ liệu duyệt thành công!");
          setModifiedJobIds(new Set());
          setModifiedPaymentIds(new Set());
          fetchData(true, true); // Refresh ngay sau khi gửi
      }
    } catch (err) { console.error("Send pending failed", err); }
  };

  const handleToggleLock = (docNo: string | string[]) => {
      const newSet = new Set(lockedIds);
      if (Array.isArray(docNo)) docNo.forEach(id => newSet.add(id));
      else { if (newSet.has(docNo)) newSet.delete(docNo); else newSet.add(docNo); }
      setLockedIds(newSet);
      if (currentUser) {
          sendPendingToServer({ user: currentUser.username, timestamp: new Date().toISOString(), lockedIds: Array.from(newSet), autoApprove: true, jobs: [], paymentRequests: [], customers: [], lines: [] });
      }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('kb_user') || sessionStorage.getItem('kb_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setCurrentUser(user);
      if (user.role === 'Docs') setCurrentPage('lookup');
    }
  }, []);

  const handleLogin = (username: string, pass: string, remember: boolean) => {
    const user = users.find(u => u.username === username && u.pass === pass);
    if (user) {
      const userData = { username: user.username, role: user.role };
      setIsAuthenticated(true);
      setCurrentUser(userData);
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('kb_user', JSON.stringify(userData));
      if (user.role === 'Docs') setCurrentPage('lookup'); else setCurrentPage('entry');
    } else { alert("Thông tin đăng nhập không đúng"); }
  };

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('kb_user');
    localStorage.removeItem('kb_user');
  }, []);

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden relative bg-slate-50">
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-30 sticky top-0">
         <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg"><Ship className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-lg text-slate-800">KIMBERRY</span>
         </div>
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600"><Menu className="w-6 h-6" /></button>
      </div>

      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSendPending={() => sendPendingToServer()}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        syncStatus={syncStatus}
        onForceRefresh={() => fetchData(false, true)}
      />

      <div className="flex-1 md:ml-[280px] p-2 md:p-4 h-full flex flex-col overflow-hidden relative">
        <main className="flex-1 rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner h-full flex flex-col bg-white/40 backdrop-blur-3xl border border-white/40">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl border border-white/40 rounded-3xl z-0"></div>
          <div className="relative z-10 h-full overflow-y-auto custom-scrollbar p-2">
            {currentPage === 'entry' && <JobEntry jobs={jobs} onAddJob={handleAddJob} onEditJob={handleEditJob} onDeleteJob={(id) => { setJobs(prev => prev.filter(x => x.id !== id)); setModifiedJobIds(prev => { const next = new Set(prev); next.delete(id); return next; }); }} customers={customers} onAddCustomer={(c) => setCustomers([...customers, c])} lines={lines} onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])} initialJobId={targetJobId} onClearTargetJob={() => setTargetJobId(null)} customReceipts={customReceipts} />}
            {currentPage === 'reports' && <Reports jobs={jobs} />}
            {currentPage === 'booking' && <BookingList jobs={jobs} onEditJob={handleEditJob} initialBookingId={targetBookingId} onClearTargetBooking={() => setTargetBookingId(null)} customers={customers} lines={lines} onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])} onAddCustomer={(c) => setCustomers([...customers, c])} />}
            {currentPage === 'deposit-line' && <DepositList mode="line" jobs={jobs} customers={customers} lines={lines} onEditJob={handleEditJob} onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])} onAddCustomer={(c) => setCustomers([...customers, c])} />}
            {currentPage === 'deposit-customer' && <DepositList mode="customer" jobs={jobs} customers={customers} lines={lines} onEditJob={handleEditJob} onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])} onAddCustomer={(c) => setCustomers([...customers, c])} />}
            {currentPage === 'lhk' && <LhkList jobs={jobs} />}
            {currentPage === 'amis-thu' && <AmisExport jobs={jobs} customers={customers} mode="thu" onUpdateJob={handleEditJob} lockedIds={lockedIds} onToggleLock={handleToggleLock} customReceipts={customReceipts} onUpdateCustomReceipts={setCustomReceipts} />}
            {currentPage === 'amis-chi' && <AmisExport jobs={jobs} customers={customers} mode="chi" onUpdateJob={handleEditJob} lockedIds={lockedIds} onToggleLock={handleToggleLock} customReceipts={customReceipts} onUpdateCustomReceipts={setCustomReceipts} />}
            {currentPage === 'amis-ban' && <AmisExport jobs={jobs} customers={customers} mode="ban" onUpdateJob={handleEditJob} lockedIds={lockedIds} onToggleLock={handleToggleLock} customReceipts={customReceipts} onUpdateCustomReceipts={setCustomReceipts} />}
            {currentPage === 'amis-mua' && <AmisExport jobs={jobs} customers={customers} mode="mua" onUpdateJob={handleEditJob} lockedIds={lockedIds} onToggleLock={handleToggleLock} customReceipts={customReceipts} onUpdateCustomReceipts={setCustomReceipts} />}
            {currentPage === 'profit' && <ProfitReport jobs={jobs} salaries={salaries} onViewJob={(id) => { setTargetJobId(id); setCurrentPage("entry"); }} />}
            {currentPage === 'salary' && <SalaryPage salaries={salaries} onUpdateSalaries={handleUpdateSalaries} />}
            {currentPage === 'data-lines' && <DataManagement mode="lines" data={lines} onAdd={(line) => setLines([...lines, line])} onEdit={(l) => setLines(prev => prev.map(x => x.id === l.id ? l : x))} onDelete={(id) => setLines(prev => prev.filter(l => l.id !== id))} />}
            {currentPage === 'data-customers' && <DataManagement mode="customers" data={customers} onAdd={(c) => setCustomers([...customers, c])} onEdit={(c) => { setCustomers(prev => prev.map(x => x.id === c.id ? c : x)); setJobs(pj => pj.map(j => j.customerId === c.id ? {...j, customerName: c.name} : j)); }} onDelete={(id) => setCustomers(prev => prev.filter(cust => cust.id !== id))} />}
            {currentPage === 'debt' && <DebtManagement jobs={jobs} customers={customers} onViewJob={(id) => { setTargetJobId(id); setCurrentPage("entry"); }} />}
            {currentPage === 'reconciliation' && <Reconciliation jobs={jobs} />}
            {currentPage === 'lookup' && <LookupPage jobs={jobs} />}
            {currentPage === 'payment' && <PaymentPage lines={lines} requests={paymentRequests} onUpdateRequests={handleUpdatePaymentRequests} currentUser={currentUser} onSendPending={sendPendingToServer} jobs={jobs} onUpdateJob={handleEditJob} onAddJob={handleAddJob} customers={customers} />}
            {currentPage === 'cvhc' && <CVHCPage jobs={jobs} customers={customers} onUpdateJob={handleEditJob} />}
            {currentPage === 'system' && <SystemPage jobs={jobs} customers={customers} lines={lines} users={users} currentUser={currentUser} onRestore={(d) => { setJobs(sanitizeData(d.jobs)); setCustomers(d.customers); setLines(d.lines); if (d.users) setUsers(d.users); }} onAddUser={(u) => setUsers(prev => [...prev, u])} onEditUser={(u, old) => setUsers(prev => prev.map(user => user.username === old ? u : user))} onDeleteUser={(name) => setUsers(prev => prev.filter(u => u.username !== name))} pendingRequests={pendingRequests} onApproveRequest={async (rid, idata) => { const mj = (c, i) => { if(!i) return c; const m = new Map(c.map(x => [x.id, x])); i.forEach(x => m.set(x.id, x)); return Array.from(m.values()); }; setJobs(prev => mj(prev, idata.jobs)); setPaymentRequests(prev => mj(prev, idata.paymentRequests)); if(idata.salaries) setSalaries(idata.salaries); setCustomers(prev => mj(prev, idata.customers)); setLines(prev => mj(prev, idata.lines)); setCustomReceipts(prev => mj(prev, idata.customReceipts)); if (idata.users) setUsers(prev => { const m = new Map(prev.map(u => [u.username, u])); idata.users.forEach(u => m.set(u.username, u)); return Array.from(m.values()); }); if (idata.lockedIds) setLockedIds(prev => new Set([...prev, ...idata.lockedIds])); setPendingRequests(prev => prev.filter(r => r.id !== rid)); try { await fetch(`https://api.kimberry.id.vn/pending/${encodeURIComponent(rid)}`, { method: 'DELETE' }); } catch {} }} onRejectRequest={async (rid) => { setPendingRequests(prev => prev.filter(r => r.id !== rid)); try { await fetch(`https://api.kimberry.id.vn/pending/${encodeURIComponent(rid)}`, { method: 'DELETE' }); } catch {} }} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
