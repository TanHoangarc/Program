
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
import { LookupPage } from './pages/LookupPage'; 
import { PaymentPage } from './pages/PaymentPage'; 
import { CVHCPage } from './pages/CVHCPage';
import { SalaryPage } from './pages/SalaryPage'; // IMPORT SalaryPage
import { LoginPage } from './components/LoginPage';
import { Menu, Ship } from 'lucide-react';

import { JobData, Customer, ShippingLine, UserAccount, PaymentRequest, SalaryRecord } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES } from './constants';

// --- SECURITY CONFIGURATION ---
const DEFAULT_USERS: UserAccount[] = [
  { username: 'KimberryAdmin', pass: 'Jwckim@123#', role: 'Admin' },
  { username: 'Kimberrystaff', pass: 'Jwckim@124#', role: 'Staff' },
  { username: 'Kimberrymanager', pass: 'Jwckim@125#', role: 'Manager' },
  { username: 'Dockimberry', pass: 'Kimberry@123', role: 'Docs' }
  { username: 'Admin', pass: 'Admin123', role: 'Admin' }
];

const AUTH_CHANNEL_NAME = 'kimberry_auth_channel';

const App: React.FC = () => {

  // Track server availability
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ username: string, role: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // --- APP STATE ---
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
  
  // --- PENDING REQUESTS STATE (Admin Only) ---
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  // --- TRACKING CHANGES ---
  const [modifiedJobIds, setModifiedJobIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_modified_job_ids');
          return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
          return new Set();
      }
  });

  const [modifiedPaymentIds, setModifiedPaymentIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_modified_payment_ids');
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

  // --- LOCKED IDs STATE (Global Sync) ---
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_locked_ids');
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

  useEffect(() => {
      localStorage.setItem('kb_modified_payment_ids', JSON.stringify(Array.from(modifiedPaymentIds)));
  }, [modifiedPaymentIds]);

  useEffect(() => {
      localStorage.setItem('kb_locked_ids', JSON.stringify(Array.from(lockedIds)));
  }, [lockedIds]);

  // Helper: Sanitize Data
  const sanitizeData = (data: JobData[]): JobData[] => {
    const seenIds = new Set<string>();
    let hasDuplicates = false;

    const sanitized = data.map(job => {
      // Default year to 2025 if missing (Data Migration)
      if (!job.year) {
          job.year = 2025;
      }

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

  // --- MAIN DATA STATE ---
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
    } catch {
        return [];
    }
  });

  // --- SALARY STATE ---
  const [salaries, setSalaries] = useState<SalaryRecord[]>(() => {
      try {
          const saved = localStorage.getItem('kb_salaries');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  // --- AMIS CUSTOM RECEIPTS (THU KHÁC) ---
  const [customReceipts, setCustomReceipts] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('amis_custom_receipts');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('logistics_users_v1');
    if (saved) {
        const localUsers = JSON.parse(saved);
        const updatedUsers = [...localUsers];
        DEFAULT_USERS.forEach(defUser => {
            if (!updatedUsers.some(u => u.username === defUser.username)) {
                updatedUsers.push(defUser);
            }
        });
        return updatedUsers;
    }
    return DEFAULT_USERS;
  });

  // --- JOB HANDLERS WITH TRACKING ---
  const handleAddJob = (job: JobData) => {
      // Use functional update to ensure batch updates work correctly in loops
      setJobs(prevJobs => [job, ...prevJobs]);
      setModifiedJobIds(prev => new Set(prev).add(job.id));
  };

  const handleEditJob = (job: JobData) => {
      setJobs(prev => prev.map(x => x.id === job.id ? job : x));
      setModifiedJobIds(prev => new Set(prev).add(job.id));
  };

  const handleDeleteJob = (id: string) => {
      setJobs(prev => prev.filter(x => x.id !== id));
      setModifiedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
      });
  };

  // --- PAYMENT HANDLERS WITH TRACKING ---
  const handleUpdatePaymentRequests = (newRequests: PaymentRequest[]) => {
      const currentMap = new Map(paymentRequests.map(r => [r.id, r]));
      const changedIds = new Set<string>();
      
      newRequests.forEach(req => {
          const current = currentMap.get(req.id);
          if (!current || JSON.stringify(current) !== JSON.stringify(req)) {
              changedIds.add(req.id);
          }
      });

      setPaymentRequests(newRequests);
      
      setModifiedPaymentIds(prev => {
          const next = new Set(prev);
          changedIds.forEach(id => next.add(id));
          return next;
      });
  };

  // --- SALARY HANDLERS ---
  const handleUpdateSalaries = (newSalaries: SalaryRecord[]) => {
      setSalaries(newSalaries);
  };

  // --- DATA SYNC FUNCTIONS ---
  const handleUpdateCustomer = (updatedCustomer: Customer) => {
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      
      setJobs(prevJobs => prevJobs.map(job => {
          if (job.customerId === updatedCustomer.id) {
              setModifiedJobIds(prev => new Set(prev).add(job.id));
              return { ...job, customerName: updatedCustomer.name };
          }
          return job;
      }));
  };

  const handleUpdateLine = (updatedLine: ShippingLine) => {
      setLines(prev => prev.map(l => l.id === updatedLine.id ? updatedLine : l));
  };

  // --- API FUNCTIONS ---

  const sendPendingToServer = async (directPayload?: any) => {
    if (!currentUser || !currentUser.username) {
        alert("Lỗi: Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        return;
    }
    
    let payload = directPayload;

    if (!payload) {
        const jobsToSend = jobs.filter(j => modifiedJobIds.has(j.id));
        const paymentsToSend = paymentRequests.filter(p => modifiedPaymentIds.has(p.id));

        const hasChanges = jobsToSend.length > 0 || paymentsToSend.length > 0;
        
        if (!hasChanges) {
            alert("Không có thay đổi nào mới (Job hoặc Thanh toán) để gửi đi.");
            return;
        }

        payload = {
            user: currentUser.username, 
            timestamp: new Date().toISOString(),
            jobs: jobsToSend, 
            paymentRequests: paymentsToSend,
            customers: [...customers],
            lines: [...lines],
            customReceipts: [...customReceipts],
            salaries: [...salaries], // Include salaries in sync if needed
            lockedIds: Array.from(lockedIds) // Include lockedIds in manual sync
        };
    } else {
        if (!payload.lockedIds) {
            // Only add lockedIds if it's a specific lock update payload
            // payload.lockedIds = Array.from(lockedIds); 
        }
    }
    
    if (!isServerAvailable) {
        alert("Không thể kết nối với máy chủ (Chế độ Offline). Vui lòng thử lại sau.");
        return;
    }

    try {
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
          if (!directPayload) {
              const msgParts = [];
              if (payload.jobs?.length > 0) msgParts.push(`${payload.jobs.length} Job`);
              if (payload.paymentRequests?.length > 0) msgParts.push(`${payload.paymentRequests.length} Thanh toán`);
              
              alert(`Đã gửi thành công: ${msgParts.join(', ')}!`);
              
              setModifiedJobIds(new Set());
              setModifiedPaymentIds(new Set());
          } 
          // Auto-sync success log REMOVED
      } else {
          throw new Error(`Server returned ${response.status}`);
      }

    } catch (err) {
      console.error("Gửi pending thất bại:", err);
      if (!directPayload) {
          alert("Gửi thất bại: Có lỗi khi kết nối đến máy chủ.");
      }
    }
  };

  const handleToggleLock = (docNo: string | string[]) => {
      const newSet = new Set(lockedIds);
      
      if (Array.isArray(docNo)) {
          docNo.forEach(id => newSet.add(id));
      } else {
          if (newSet.has(docNo)) newSet.delete(docNo);
          else newSet.add(docNo);
      }
      
      setLockedIds(newSet);
      // Removed automatic sendPendingToServer call
  };

  const handleRejectRequest = async (requestId: string) => {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setLocalDeletedIds(prev => new Set(prev).add(requestId));

      if (!isServerAvailable) return;
      
      try {
          const encodedId = encodeURIComponent(requestId);
          await fetch(`https://api.kimberry.id.vn/pending/${encodedId}`, { 
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
          });
      } catch (e) {
          console.warn(`Background delete for ${requestId} failed.`);
      }
  };

  const handleApproveRequest = async (requestId: string, incomingData: any) => {
      const mergeArrays = (current: any[], incoming: any[]) => {
          if (!incoming) return current;
          const map = new Map(current.map(i => [i.id, i]));
          incoming.forEach(i => map.set(i.id, i));
          return Array.from(map.values());
      };

      const incJobs = Array.isArray(incomingData.jobs) ? incomingData.jobs : (incomingData.data?.jobs || incomingData.payload?.jobs || []);
      const incPayments = Array.isArray(incomingData.paymentRequests) ? incomingData.paymentRequests : (incomingData.data?.paymentRequests || incomingData.payload?.paymentRequests || []);
      const incCustomers = Array.isArray(incomingData.customers) ? incomingData.customers : (incomingData.data?.customers || incomingData.payload?.customers || []);
      const incLines = Array.isArray(incomingData.lines) ? incomingData.lines : (incomingData.data?.lines || incomingData.payload?.lines || []);
      const incReceipts = Array.isArray(incomingData.customReceipts) ? incomingData.customReceipts : (incomingData.data?.customReceipts || incomingData.payload?.customReceipts || []);
      const incSalaries = Array.isArray(incomingData.salaries) ? incomingData.salaries : (incomingData.data?.salaries || incomingData.payload?.salaries || []);

      // REMOVED LOCKED ID MERGING TO PREVENT RE-LOCKING OF MANUALLY UNLOCKED ITEMS
      /*
      const incLocks = Array.isArray(incomingData.lockedIds) ? incomingData.lockedIds : (incomingData.data?.lockedIds || incomingData.payload?.lockedIds || []);
      if (incLocks.length > 0) {
          setLockedIds(prev => {
              const newSet = new Set(prev);
              incLocks.forEach((id: string) => newSet.add(id));
              return newSet;
          });
      }
      */

      const newJobs = mergeArrays(jobs, incJobs);
      const newPayments = mergeArrays(paymentRequests, incPayments);
      const newCustomers = mergeArrays(customers, incCustomers);
      const newLines = mergeArrays(lines, incLines);
      const newReceipts = mergeArrays(customReceipts, incReceipts);
      const newSalaries = mergeArrays(salaries, incSalaries);

      setJobs(sanitizeData(newJobs)); // Ensure years are populated
      setPaymentRequests(newPayments);
      setCustomers(newCustomers);
      setLines(newLines);
      setCustomReceipts(newReceipts);
      setSalaries(newSalaries);

      await handleRejectRequest(requestId);
  };

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

            // Filter out items already processed/deleted locally
            const activeRequests = validData.filter(item => !localDeletedIds.has(item.id));
            
            const manualReviewRequests: any[] = [];

            // AUTO APPROVE HANDLING
            for (const req of activeRequests) {
                const realData = req.data || req.payload || req;
                if (realData.autoApprove) {
                    // Automatically approve and merge!
                    await handleApproveRequest(req.id, realData);
                } else {
                    manualReviewRequests.push(req);
                }
            }

            setPendingRequests(manualReviewRequests);
        }
    } catch (e) {
        console.warn("Failed to fetch pending requests", e);
    }
  };

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

        if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) setJobs(sanitizeData(data.jobs));
        if (data.paymentRequests && Array.isArray(data.paymentRequests)) setPaymentRequests(data.paymentRequests);
        if (data.customers && Array.isArray(data.customers)) setCustomers(data.customers);
        if (data.lines && Array.isArray(data.lines)) setLines(data.lines);
        
        if (data.lockedIds && Array.isArray(data.lockedIds)) {
            setLockedIds(new Set(data.lockedIds));
        }
        
        if (data.processedRequestIds && Array.isArray(data.processedRequestIds)) {
            setLocalDeletedIds(prev => {
                const next = new Set(prev);
                data.processedRequestIds.forEach((id: string) => next.add(id));
                return next;
            });
        }
        
        if (data.customReceipts && Array.isArray(data.customReceipts)) {
            setCustomReceipts(data.customReceipts);
        }

        if (data.salaries && Array.isArray(data.salaries)) {
            setSalaries(data.salaries);
        }

        setIsServerAvailable(true);

      } catch (err) {
        console.warn("Server unavailable (Offline Mode): Using local data.");
        setIsServerAvailable(false);
      }
    };

    fetchServerData();
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('kb_user') || sessionStorage.getItem('kb_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setCurrentUser(user);
      
      if (user.role === 'Docs') {
          setCurrentPage('lookup');
      }
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

  const handleLogin = (username: string, pass: string, remember: boolean) => {
    setLoginError('');
    const user = users.find(u => u.username === username && u.pass === pass);

    if (user) {
      const userData = { username: user.username, role: user.role };
      setIsAuthenticated(true);
      setCurrentUser(userData);
      setSessionError('');
      
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('kb_user', JSON.stringify(userData));
      
      if (remember) sessionStorage.removeItem('kb_user');
      else localStorage.removeItem('kb_user');

      if (user.role === 'Docs') {
          setCurrentPage('lookup');
      } else {
          setCurrentPage('entry');
      }
    } else {
      setLoginError("Thông tin đăng nhập không đúng");
    }
  };

  const handleLogout = useCallback((forced = false) => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('kb_user');
    localStorage.removeItem('kb_user');
    
    setSessionError(forced ? "Tài khoản đã được đăng nhập nơi khác." : "");
  }, []);

  const autoBackup = async () => {
    if (!currentUser || !["Admin", "Manager", "Docs"].includes(currentUser.role)) return;
    if (!isServerAvailable) return; 

    try {
      const data = {
        timestamp: new Date().toISOString(),
        version: "2.3",
        jobs,
        paymentRequests,
        customers,
        lines,
        lockedIds: Array.from(lockedIds),
        processedRequestIds: Array.from(localDeletedIds),
        customReceipts,
        salaries
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
    if (!isServerAvailable) return;
    
    const timeoutId = setTimeout(() => {
        autoBackup();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [jobs, paymentRequests, customers, lines, lockedIds, customReceipts, localDeletedIds, salaries, isServerAvailable]);

  useEffect(() => { localStorage.setItem("logistics_jobs_v2", JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem("payment_requests_v1", JSON.stringify(paymentRequests)); }, [paymentRequests]);
  useEffect(() => { localStorage.setItem("logistics_customers_v1", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("logistics_lines_v1", JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem("logistics_users_v1", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('amis_custom_receipts', JSON.stringify(customReceipts)); }, [customReceipts]);
  useEffect(() => { localStorage.setItem('kb_salaries', JSON.stringify(salaries)); }, [salaries]);

  // AUTO POLLING FOR ADMIN: Check for new pending/auto-approve requests regardless of page
  useEffect(() => {
      if (currentUser?.role === 'Admin' && isServerAvailable) {
          fetchPendingRequests(); // Initial fetch
          const interval = setInterval(fetchPendingRequests, 15000); // Poll every 15s
          return () => clearInterval(interval);
      }
  }, [currentUser, isServerAvailable]); // Removed currentPage dependency

  if (!isAuthenticated)
    return <LoginPage onLogin={handleLogin} error={sessionError || loginError} />;

  return (
    <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden relative bg-slate-50">
      {/* ... (Rest of JSX remains unchanged) ... */}
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 shrink-0 sticky top-0">
         <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg shadow-sm">
                <Ship className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-800 tracking-tight">KIMBERRY</span>
         </div>
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6" />
         </button>
      </div>

      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentUser={currentUser}
        onLogout={() => handleLogout(false)}
        onSendPending={() => sendPendingToServer()}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 md:ml-[280px] p-2 md:p-4 h-full flex flex-col overflow-hidden relative">
        <main className="flex-1 rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner h-full flex flex-col bg-white/40 backdrop-blur-3xl border border-white/40">
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
                customReceipts={customReceipts}
              />
            )}

            {currentPage === 'reports' && <Reports jobs={jobs} salaries={salaries} />}
            
            {currentPage === 'booking' && (
                <BookingList 
                    jobs={jobs} 
                    onEditJob={handleEditJob} 
                    initialBookingId={targetBookingId}
                    onClearTargetBooking={() => setTargetBookingId(null)}
                    customers={customers}
                    lines={lines}
                    onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
                    onAddCustomer={(c) => setCustomers([...customers, c])}
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
            
            {/* AMIS EXPORT PAGES WITH SYNCED LOCKS & CUSTOM RECEIPTS */}
            {currentPage === 'amis-thu' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    mode="thu" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock} 
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                />
            )}
            {currentPage === 'amis-chi' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    mode="chi" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock}
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                />
            )}
            {currentPage === 'amis-ban' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    mode="ban" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock}
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                />
            )}
            {currentPage === 'amis-mua' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    mode="mua" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock}
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                />
            )}

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
              <DebtManagement 
                jobs={jobs} 
                customers={customers} 
                onViewJob={(id) => {
                    setTargetJobId(id);
                    setCurrentPage("entry");
                }}
              />
            )}

            {currentPage === 'reconciliation' && (
              <Reconciliation jobs={jobs} />
            )}

            {currentPage === 'lookup' && (
              <LookupPage jobs={jobs} />
            )}
            
            {currentPage === 'payment' && (
              <PaymentPage 
                lines={lines} 
                requests={paymentRequests}
                onUpdateRequests={handleUpdatePaymentRequests}
                currentUser={currentUser}
                onSendPending={sendPendingToServer} 
                jobs={jobs} 
                onUpdateJob={handleEditJob}
                onAddJob={handleAddJob}
                customers={customers} 
              />
            )}

            {currentPage === 'cvhc' && (
                <CVHCPage 
                    jobs={jobs} 
                    customers={customers} 
                    onUpdateJob={handleEditJob} 
                />
            )}

            {currentPage === 'salary' && (
                <SalaryPage 
                    salaries={salaries}
                    onUpdateSalaries={handleUpdateSalaries}
                />
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
