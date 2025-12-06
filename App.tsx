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

  // Track server availability to prevent spamming failed requests
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // --- APP STATE ---
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation'>('entry');

  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  
  // --- PENDING REQUESTS STATE (Admin Only) ---
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  // --- TRACKING CHANGES (NEW FEATURE) ---
  // Store IDs of jobs that have been added or modified since the last sync
  const [modifiedJobIds, setModifiedJobIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_modified_job_ids');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
          return new Set();
      }
  });

  // Local Blacklist for "Deleted" requests
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_deleted_reqs');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
          return new Set();
      }
  });

  // Persist tracking states
  useEffect(() => {
      localStorage.setItem('kb_deleted_reqs', JSON.stringify(Array.from(localDeletedIds)));
  }, [localDeletedIds]);

  useEffect(() => {
      localStorage.setItem('kb_modified_job_ids', JSON.stringify(Array.from(modifiedJobIds)));
  }, [modifiedJobIds]);

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

  // --- JOB HANDLERS WITH TRACKING ---
  const handleAddJob = (job: JobData) => {
      setJobs([job, ...jobs]);
      setModifiedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.add(job.id);
          return newSet;
      });
  };

  const handleEditJob = (job: JobData) => {
      setJobs(prev => prev.map(x => x.id === job.id ? job : x));
      setModifiedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.add(job.id);
          return newSet;
      });
  };

  const handleDeleteJob = (id: string) => {
      setJobs(prev => prev.filter(x => x.id !== id));
      // If deleted, remove from modified list (since we can't send a deleted job object)
      // Note: In a full sync system, we'd need a "deletedIds" list. 
      // For this "partial update" logic, removing it locally is sufficient for now.
      setModifiedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
      });
  };

  // --- DATA SYNC FUNCTIONS ---
  const handleUpdateCustomer = (updatedCustomer: Customer) => {
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      
      // Sync Jobs & Mark Modified
      setJobs(prevJobs => prevJobs.map(job => {
          if (job.customerId === updatedCustomer.id) {
              // Side effect: Mark job as modified because name changed
              setModifiedJobIds(prev => {
                  const newSet = new Set(prev);
                  newSet.add(job.id);
                  return newSet;
              });
              return { ...job, customerName: updatedCustomer.name };
          }
          return job;
      }));
  };

  const handleUpdateLine = (updatedLine: ShippingLine) => {
      setLines(prev => prev.map(l => l.id === updatedLine.id ? updatedLine : l));
  };

  // --- API FUNCTIONS (Defined BEFORE conditional return) ---

  const sendPendingToServer = async () => {
    if (!currentUser || !currentUser.username) {
        alert("Lỗi: Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        return;
    }
    
    // FILTER: Only send jobs that are in the modifiedJobIds list
    const jobsToSend = jobs.filter(j => modifiedJobIds.has(j.id));

    // Allow sending if there are customer changes (even if no job changes)
    // We send full customer/line lists as they are small reference data
    const hasJobChanges = jobsToSend.length > 0;
    
    if (!hasJobChanges) {
        alert("Không có thay đổi nào mới (Job) để gửi đi.");
        return;
    }
    
    if (!isServerAvailable) {
        alert("Không thể kết nối với máy chủ (Chế độ Offline). Vui lòng thử lại sau.");
        return;
    }

    try {
      const payload = {
        user: currentUser.username, 
        timestamp: new Date().toISOString(),
        jobs: jobsToSend, // ONLY SEND MODIFIED JOBS
        customers: [...customers],
        lines: [...lines]
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 

      const response = await fetch("https://api.kimberry.id.vn/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
          alert(`Đã gửi thành công ${jobsToSend.length} Job đã thay đổi!`);
          // RESET TRACKING on success
          setModifiedJobIds(new Set());
      } else {
          throw new Error(`Server returned ${response.status}`);
      }

    } catch (err) {
      console.error("Gửi pending thất bại:", err);
      alert("Gửi thất bại: Có lỗi khi kết nối đến máy chủ.");
    }
  };

  // --- ADMIN: FETCH PENDING REQUESTS ---
  const fetchPendingRequests = async () => {
    if (!currentUser || currentUser.role !== "Admin" || !isServerAvailable) return;
    try {
        const res = await fetch("https://api.kimberry.id.vn/pending");
        if (res.ok) {
            const data = await res.json();
            const validData = (Array.isArray(data) ? data : []).filter(item => item && typeof item === 'object' && item.id);
            
            const serverIdSet = new Set(validData.map(d => d.id));
            setLocalDeletedIds(prev => {
                const next = new Set(prev);
                let changed = false;
                prev.forEach(id => {
                    if (!serverIdSet.has(id)) {
                        next.delete(id);
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });

            setPendingRequests(validData.filter(item => !localDeletedIds.has(item.id)));
        }
    } catch (e) {
        console.warn("Failed to fetch pending requests", e);
    }
  };

  // --- ADMIN: REJECT/DELETE REQUEST (THOROUGH FIX) ---
  const handleRejectRequest = async (requestId: string) => {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setLocalDeletedIds(prev => {
          const newSet = new Set(prev);
          newSet.add(requestId);
          return newSet;
      });

      if (!isServerAvailable) return;
      
      try {
          const encodedId = encodeURIComponent(requestId);
          await fetch(`https://api.kimberry.id.vn/pending/${encodedId}`, { 
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
          });
      } catch (e) {
          console.warn(`Background delete for ${requestId} failed, handled by local blacklist.`);
      }
  };

  // --- ADMIN: APPROVE REQUEST ---
  const handleApproveRequest = async (requestId: string, incomingData: any) => {
      const mergeArrays = (current: any[], incoming: any[]) => {
          if (!incoming) return current;
          const map = new Map(current.map(i => [i.id, i]));
          incoming.forEach(i => map.set(i.id, i));
          return Array.from(map.values());
      };

      const incJobs = Array.isArray(incomingData.jobs) ? incomingData.jobs : (incomingData.data?.jobs || incomingData.payload?.jobs || []);
      const incCustomers = Array.isArray(incomingData.customers) ? incomingData.customers : (incomingData.data?.customers || incomingData.payload?.customers || []);
      const incLines = Array.isArray(incomingData.lines) ? incomingData.lines : (incomingData.data?.lines || incomingData.payload?.lines || []);

      const newJobs = mergeArrays(jobs, incJobs);
      const newCustomers = mergeArrays(customers, incCustomers);
      const newLines = mergeArrays(lines, incLines);

      setJobs(newJobs);
      setCustomers(newCustomers);
      setLines(newLines);

      await handleRejectRequest(requestId);
      alert("Đã duyệt và cập nhật dữ liệu thành công!");
  };

  // --- LOAD DATA FROM SERVER WHEN APP START ---
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); 

        const res = await fetch("https://api.kimberry.id.vn/data", { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("Server response not OK");

        const data = await res.json();

        console.log("SERVER DATA LOADED:", data);

        if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) setJobs(data.jobs);
        if (data.customers && Array.isArray(data.customers)) setCustomers(data.customers);
        if (data.lines && Array.isArray(data.lines)) setLines(data.lines);

        setIsServerAvailable(true);

      } catch (err) {
        console.warn("Server unavailable (Offline Mode): Using local data.");
        setIsServerAvailable(false);
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
    if (!currentUser || currentUser.role !== "Admin") return;
    if (!isServerAvailable) return; // Don't try if server is down

    try {
      const data = {
        timestamp: new Date().toISOString(),
        version: "2.1",
        jobs,
        customers,
        lines
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch("https://api.kimberry.id.vn/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log("AUTO BACKUP SUCCESS");

    } catch (err) {
      console.warn("AUTO BACKUP FAILED (Offline Mode)", err);
    }
  };

  useEffect(() => { 
    if (isServerAvailable) autoBackup(); 
  }, [jobs, customers, lines, isServerAvailable]);

  // SAVE TO LOCAL STORAGE
  useEffect(() => { localStorage.setItem("logistics_jobs_v2", JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem("logistics_customers_v1", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("logistics_lines_v1", JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem("logistics_users_v1", JSON.stringify(users)); }, [users]);

  // Auto fetch pending when Admin goes to System page
  useEffect(() => {
      if (currentPage === 'system' && currentUser?.role === 'Admin') {
          fetchPendingRequests();
      }
  }, [currentPage, currentUser]);

  if (!isAuthenticated)
    return <LoginPage onLogin={handleLogin} error={sessionError || loginError} />;

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
                onAddJob={handleAddJob}
                onEditJob={handleEditJob}
                onDeleteJob={handleDeleteJob}
                customers={customers}
                onAddCustomer={(c) => setCustomers([...customers, c])}
                lines={lines}
                onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
                initialJobId={targetJobId}
                onClearTargetJob={() => setTargetJobId(null)}
              />
            )}

            {currentPage === 'reports' && <Reports jobs={jobs} />}
            
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
                    onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
                    onAddCustomer={(c) => setCustomers([...customers, c])}
                />
            )}
            
            {currentPage === 'deposit-customer' && (
                <DepositList 
                    mode="customer" 
                    jobs={jobs} 
                    customers={customers} 
                    lines={lines} 
                    onEditJob={handleEditJob}
                    onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
                    onAddCustomer={(c) => setCustomers([...customers, c])}
                />
            )}
            
            {currentPage === 'lhk' && <LhkList jobs={jobs} />}
            {currentPage === 'amis-thu' && <AmisExport jobs={jobs} customers={customers} mode="thu" />}
            {currentPage === 'amis-chi' && <AmisExport jobs={jobs} customers={customers} mode="chi" />}
            {currentPage === 'amis-ban' && <AmisExport jobs={jobs} customers={customers} mode="ban" />}
            {currentPage === 'amis-mua' && <AmisExport jobs={jobs} customers={customers} mode="mua" />}

            {currentPage === 'profit' && (
              <ProfitReport jobs={jobs} onViewJob={(id) => { setTargetJobId(id); setCurrentPage("entry"); }} />
            )}

            {currentPage === 'data-lines' && (
              <DataManagement 
                mode="lines" 
                data={lines} 
                onAdd={(line) => setLines([...lines, line])} 
                onEdit={handleUpdateLine}
                onDelete={(id) => setLines(prev => prev.filter(l => l.id !== id))}
              />
            )}

            {currentPage === 'data-customers' && (
              <DataManagement 
                mode="customers" 
                data={customers} 
                onAdd={(c) => setCustomers([...customers, c])} 
                onEdit={handleUpdateCustomer}
                onDelete={(id) => setCustomers(prev => prev.filter(cust => cust.id !== id))}
              />
            )}

            {currentPage === 'debt' && (
              <DebtManagement jobs={jobs} customers={customers} />
            )}

            {currentPage === 'reconciliation' && (
              <Reconciliation jobs={jobs} />
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
                onAddUser={(u) => setUsers([...users, u])}
                onEditUser={(u, oldName) => setUsers(users.map(user => user.username === oldName ? u : user))}
                onDeleteUser={(name) => setUsers(users.filter(u => u.username !== name))}
                // New Props for Pending Requests
                pendingRequests={pendingRequests}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
              />
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
