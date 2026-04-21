
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { JobEntry } from './pages/JobEntry';
import { Reports } from './pages/Reports';
import { BookingList } from './pages/BookingList';
import { AmisExport } from './pages/AmisExport';
import * as XLSX from 'xlsx';
import { DataManagement } from './pages/DataManagement';
import { SystemPage } from './pages/SystemPage';
import { LookupPage } from './pages/LookupPage'; 
import { PaymentPage } from './pages/PaymentPage'; 
import { CVHCPage } from './pages/CVHCPage';
import { SalaryPage } from './pages/SalaryPage';
import { ToolAI } from './pages/ToolAI'; 
import { NFCPage } from './pages/NFCPage'; 
import { BankPage } from './pages/BankPage';
import { YearlyProfitPage } from './pages/YearlyProfitPage';
import { LongHoangPage } from './pages/LongHoangPage';
import { LoginPage } from './components/LoginPage';
import { ExportModal } from './components/ExportModal';
import SyncBookingModal from './components/SyncBookingModal';
import { QuickReceiveModal } from './components/QuickReceiveModal';
import { generateNextDocNo } from './utils';
import { Menu, Ship, AlertTriangle, X, Loader2, Wallet, Plus, RefreshCw } from 'lucide-react';
import { useNotification } from './contexts/NotificationContext';
import axios from 'axios';

import { JobData, Customer, ShippingLine, UserAccount, PaymentRequest, SalaryRecord, WebNfcProfile, YearlyConfig, INITIAL_JOB, HeaderMessage, HeaderNotification, LongHoangOrder } from './types';
import { MOCK_DATA, MOCK_CUSTOMERS, MOCK_SHIPPING_LINES, BASE_URL_PREFIX } from './constants';

// --- SECURITY CONFIGURATION ---
const DEFAULT_USERS: UserAccount[] = [
  { username: 'KimberryAdmin', pass: 'Jwckim@123#', role: 'Admin' },
  { username: 'Dockimberry', pass: 'Kimberry@123', role: 'Docs' },
  { username: 'CushcmLH', pass: 'Jwckim@689', role: 'Docs' }
];

const AUTH_CHANNEL_NAME = 'kimberry_auth_channel';

interface SyncCvhcChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: 'all' | 'missing') => void;
}

const SyncCvhcChoiceModal: React.FC<SyncCvhcChoiceModalProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Đồng bộ CVHC</h3>
        <p className="text-slate-600 mb-6">Vui lòng chọn chế độ đồng bộ:</p>
        <div className="space-y-3">
          <button 
            onClick={() => onSelect('all')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Load lại toàn bộ
          </button>
          <button 
            onClick={() => onSelect('missing')}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Load những job chưa có
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { alert, confirm } = useNotification();

  // Track server availability
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loginError, setLoginError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // --- APP STATE ---
  const [currentPage, setCurrentPage] = useState<'entry' | 'reports' | 'booking' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'system' | 'lookup' | 'payment' | 'cvhc' | 'salary' | 'tool-ai' | 'nfc' | 'bank-tcb' | 'bank-mb' | 'yearly-profit' | 'long-hoang'>(() => {
      try {
          const savedUser = localStorage.getItem('kb_user') || sessionStorage.getItem('kb_user');
          if (savedUser) {
              const user = JSON.parse(savedUser);
              if (user.role === 'Docs') return 'payment';
          }
      } catch {}
      return 'entry';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  
  // --- PENDING REQUESTS STATE (Admin Only) ---
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  // --- DATA INTEGRITY WARNING ---
  const [dataMismatchWarning, setDataMismatchWarning] = useState(false);
  
  // --- SYNC STATUS ---
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);

  // --- SYNC CVHC CHOICE ---
  const [isSyncCvhcChoiceOpen, setIsSyncCvhcChoiceOpen] = useState(false);
  const [syncCvhcMode, setSyncCvhcMode] = useState<'all' | 'missing'>('missing');

  // --- OTHER RECEIPT MODAL ---
  const [isOtherReceiptOpen, setIsOtherReceiptOpen] = useState(false);
  const [otherReceiptJob, setOtherReceiptJob] = useState<JobData>(INITIAL_JOB);

  const handleAddOtherReceipt = () => {
    const customDocNos = customReceipts.map(r => r.docNo).filter(Boolean);
    const nextDocNo = generateNextDocNo(jobs, 'NTTK', 5, customDocNos);
    const dummyJob = { 
        ...INITIAL_JOB, 
        id: `rcpt-${Date.now()}`, 
        jobCode: 'THU-KHAC', 
        localChargeDate: new Date().toISOString().split('T')[0], 
        amisLcDocNo: nextDocNo, 
        amisLcDesc: 'Thu tiền khác' 
    };
    setOtherReceiptJob(dummyJob);
    setIsOtherReceiptOpen(true);
  };

  const handleSaveOtherReceipt = (updatedJob: JobData) => {
    const foundCust = customers.find(c => c.id === updatedJob.customerId);
    const finalObjCode = foundCust ? foundCust.code : updatedJob.customerId;
    const originalReceipt = customReceipts.find(r => r.id === updatedJob.id);

    const newReceipt = { 
        ...originalReceipt,
        id: updatedJob.id, 
        type: 'other', 
        date: updatedJob.localChargeDate, 
        docNo: updatedJob.amisLcDocNo, 
        desc: updatedJob.amisLcDesc,
        amount: updatedJob.amisLcAmount || updatedJob.localChargeTotal || 0,
        objCode: finalObjCode,
        objName: foundCust ? foundCust.name : updatedJob.customerName,
        additionalReceipts: updatedJob.additionalReceipts
    };
    
    let nextReceipts = [...customReceipts];
    const idx = nextReceipts.findIndex(r => r.id === newReceipt.id);
    if (idx >= 0) nextReceipts[idx] = newReceipt;
    else nextReceipts.push(newReceipt);
    
    setCustomReceipts(nextReceipts);
    setIsOtherReceiptOpen(false);
  };

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

  const [deletedJobIds, setDeletedJobIds] = useState<Set<string>>(() => {
      try {
          const saved = localStorage.getItem('kb_deleted_job_ids');
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
      localStorage.setItem('kb_deleted_job_ids', JSON.stringify(Array.from(deletedJobIds)));
  }, [deletedJobIds]);

  useEffect(() => {
      localStorage.setItem('kb_modified_job_ids', JSON.stringify(Array.from(modifiedJobIds)));
  }, [modifiedJobIds]);

  useEffect(() => {
      localStorage.setItem('kb_modified_payment_ids', JSON.stringify(Array.from(modifiedPaymentIds)));
  }, [modifiedPaymentIds]);

  useEffect(() => {
      localStorage.setItem('kb_locked_ids', JSON.stringify(Array.from(lockedIds)));
  }, [lockedIds]);

  // Helper: Sanitize Data (CORRECTED TO REMOVE DUPLICATES)
  const sanitizeData = (data: JobData[]): JobData[] => {
    // Use Map to keep the LAST entry for each ID, effectively deduplicating
    const uniqueMap = new Map<string, JobData>();
    
    data.forEach(job => {
        if (job.id) {
            // Default year to 2025 if missing (Data Migration)
            if (!job.year) {
                job.year = 2025;
            }
            uniqueMap.set(job.id, job);
        }
    });

    return Array.from(uniqueMap.values());
  };

  // --- HEADER MESSAGES & NOTIFICATIONS ---
  const [headerMessages, setHeaderMessages] = useState<HeaderMessage[]>(() => {
    try {
      const saved = localStorage.getItem('kb_header_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [headerNotifications, setHeaderNotifications] = useState<HeaderNotification[]>(() => {
    try {
      const saved = localStorage.getItem('kb_header_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [headerUpdates, setHeaderUpdates] = useState<HeaderMessage[]>(() => {
    try {
      const saved = localStorage.getItem('kb_header_updates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSyncBookingModalOpen, setIsSyncBookingModalOpen] = useState(false);

  // --- AI AUTO UPLOAD STATE ---
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isAutoUploading, setIsAutoUploading] = useState(false);
  const [autoUploadProgress, setAutoUploadProgress] = useState('');

  const BACKEND_URL = "/api";
  const lastSavedHeaderData = useRef<string>("");

  const addHeaderMessage = (username: string, carrier: string, booking: string, jobCode?: string) => {
    const newMessage: HeaderMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      username,
      carrier,
      booking,
      jobCode,
      isRead: false
    };
    setHeaderMessages(prev => [newMessage, ...prev].slice(0, 20)); // Keep last 20
  };

  const addHeaderNotification = (username: string, booking: string) => {
    const newNotification: HeaderNotification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      username,
      booking,
      isRead: false
    };
    setHeaderNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Keep last 20
  };

  const addHeaderUpdate = (username: string, carrier: string, booking: string, action: string = 'Updated', jobCode?: string) => {
    const newUpdate: HeaderMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      username,
      carrier,
      booking,
      jobCode,
      isRead: false
    };
    // Use the booking field to store the action if needed, or just keep it simple
    setHeaderUpdates(prev => [newUpdate, ...prev].slice(0, 20));
  };

  const markNotificationsAsRead = () => {
    setHeaderNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markMessagesAsRead = () => {
    setHeaderMessages(prev => prev.map(m => ({ ...m, isRead: true })));
  };

  const markUpdatesAsRead = () => {
    setHeaderUpdates(prev => prev.map(u => ({ ...u, isRead: true })));
  };

  const handleSyncCvhc = async () => {
    setIsSyncCvhcChoiceOpen(true);
  };

  const handleAutoUploadFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsAutoUploading(true);
    let successCount = 0;
    const fileList: File[] = Array.from(files);
    
    // Target jobs that are completed (have ngayThuHoan)
    // Mode 'missing' only targets jobs without cvhcUrl
    // Mode 'all' targets all jobs with ngayThuHoan
    const targetList = jobs.filter(j => {
        if (!j.ngayThuHoan) return false;
        if (syncCvhcMode === 'missing') {
            const hasCvhc = j.cvhcUrl && !j.cvhcUrl.includes('/files/inv/');
            return !hasCvhc;
        }
        return true;
    }); 

    for (let i = 0; i < targetList.length; i++) {
        const job = targetList[i];
        const searchKey = job.jobCode.trim().toLowerCase();
        if (!searchKey) continue;

        // Find file containing job code
        const matchedFile = fileList.find(f => f.name.toLowerCase().includes(searchKey));
        
        if (matchedFile) {
            setAutoUploadProgress(`Đang upload cho Job ${job.jobCode}...`);
            
            try {
                const safeJobCode = job.jobCode.replace(/[^a-zA-Z0-9-_]/g, '');
                const ext = matchedFile.name.split('.').pop();
                const fileName = `CVHC_BL_${safeJobCode}_AUTO_${Date.now()}.${ext}`;

                const formData = new FormData();
                formData.append("fileName", fileName);
                formData.append("file", matchedFile);

                const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data && res.data.success) {
                    let uploadedUrl = res.data.cvhcUrl;
                    if (uploadedUrl && !uploadedUrl.startsWith('http')) {
                        uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
                    }

                    const updatedJob = { 
                        ...job, 
                        cvhcUrl: uploadedUrl,
                        cvhcFileName: res.data.fileName || fileName
                    };
                    handleEditJob(updatedJob);
                    successCount++;
                }
            } catch (err) {
                console.error(`Failed to upload for job ${job.jobCode}`, err);
            }
        }
    }

    alert(`Hoàn tất quét thư mục! Đã cập nhật CVHC cho ${successCount} Job.`, "Thành công");
    setIsAutoUploading(false);
    setAutoUploadProgress('');
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleSyncBooking = async () => {
    setIsSyncBookingModalOpen(true);
  };

  const handleExport = () => {
    setIsExportModalOpen(true);
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

  // --- YEARLY CONFIG STATE (PROFIT PAGE) ---
  const [yearlyConfigs, setYearlyConfigs] = useState<YearlyConfig[]>(() => {
      try {
          const saved = localStorage.getItem('kb_yearly_configs');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  // --- NFC STATE ---
  const [nfcProfiles, setNfcProfiles] = useState<WebNfcProfile[]>(() => {
      try {
          const saved = localStorage.getItem('kb_nfc_profiles');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });

  // --- LONG HOANG STATE ---
  const [longHoangOrders, setLongHoangOrders] = useState<LongHoangOrder[]>(() => {
      try {
          const saved = localStorage.getItem('kb_long_hoang_orders');
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

  // --- INITIAL LOAD FROM BACKEND ---
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const types = ['jobs', 'customers', 'lines', 'paymentRequests', 'salaries', 'nfcProfiles', 'customReceipts', 'users'];
        for (const type of types) {
          const res = await axios.get(`${BACKEND_URL}/load-data/${type}`);
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            switch (type) {
              case 'jobs': setJobs(sanitizeData(res.data)); break;
              case 'customers': setCustomers(res.data); break;
              case 'lines': setLines(res.data); break;
              case 'paymentRequests': setPaymentRequests(res.data); break;
              case 'salaries': setSalaries(res.data); break;
              case 'nfcProfiles': setNfcProfiles(res.data); break;
              case 'customReceipts': setCustomReceipts(res.data); break;
              case 'users': setUsers(res.data); break;
            }
          }
        }
        setIsInitialSyncDone(true);
      } catch (error) {
        console.error("Failed to load data from backend:", error);
        setIsInitialSyncDone(true); // Still proceed
      }
    };
    loadAllData();
  }, []);

  // --- SYNC TO BACKEND HELPER ---
  const syncToBackend = useCallback(async (type: string, data: any) => {
    if (!isInitialSyncDone) return;
    try {
      await axios.post(`${BACKEND_URL}/sync-data`, { type, data });
    } catch (error) {
      console.warn(`Sync failed for ${type}`, error);
    }
  }, [isInitialSyncDone]);

  // Sync effects
  useEffect(() => { syncToBackend('jobs', jobs); localStorage.setItem('logistics_jobs_v2', JSON.stringify(jobs)); }, [jobs, syncToBackend]);
  useEffect(() => { syncToBackend('customers', customers); localStorage.setItem('logistics_customers_v1', JSON.stringify(customers)); }, [customers, syncToBackend]);
  useEffect(() => { syncToBackend('lines', lines); localStorage.setItem('logistics_lines_v1', JSON.stringify(lines)); }, [lines, syncToBackend]);
  useEffect(() => { syncToBackend('paymentRequests', paymentRequests); localStorage.setItem('payment_requests_v1', JSON.stringify(paymentRequests)); }, [paymentRequests, syncToBackend]);
  useEffect(() => { syncToBackend('salaries', salaries); localStorage.setItem('kb_salaries', JSON.stringify(salaries)); }, [salaries, syncToBackend]);
  useEffect(() => { syncToBackend('nfcProfiles', nfcProfiles); localStorage.setItem('kb_nfc_profiles', JSON.stringify(nfcProfiles)); }, [nfcProfiles, syncToBackend]);
  useEffect(() => { syncToBackend('customReceipts', customReceipts); localStorage.setItem('amis_custom_receipts', JSON.stringify(customReceipts)); }, [customReceipts, syncToBackend]);
  useEffect(() => { syncToBackend('users', users); localStorage.setItem('logistics_users_v1', JSON.stringify(users)); }, [users, syncToBackend]);

  // --- INTEGRITY CHECK LOGIC ---
  useEffect(() => {
      const checkIntegrity = async () => {
          // Only check if user is Admin and server is available
          if (currentUser && currentUser.role === 'Admin' && isServerAvailable) {
              try {
                  const res = await fetch(`${BACKEND_URL}/history/latest`);
                  
                  // Handle non-200 responses (e.g., 404 from live server lacking endpoint)
                  if (!res.ok) return; 
                  
                  // Handle HTML responses (e.g., 404 page)
                  const contentType = res.headers.get("content-type");
                  if (!contentType || !contentType.includes("application/json")) return;

                  const result = await res.json();
                  if (result.found && result.data && Array.isArray(result.data.jobs)) {
                      // Check for missing data: History has it, but Live doesn't
                      const histJobs = result.data.jobs;
                      const currentJobIds = new Set(jobs.map(j => j.id));
                      const missingCount = histJobs.filter((j: JobData) => !currentJobIds.has(j.id)).length;
                      
                      if (missingCount > 0) {
                          setDataMismatchWarning(true);
                      } else {
                          setDataMismatchWarning(false);
                      }
                  }
              } catch (e) {
                  // Silent fail for integrity check to avoid console noise
              }
          }
      };
      
      // Delay check slightly to ensure data loaded
      const timeout = setTimeout(checkIntegrity, 3000);
      return () => clearTimeout(timeout);
  }, [currentUser, isServerAvailable, jobs]); // Re-run if jobs change significantly or user changes

  // --- JOB HANDLERS WITH TRACKING ---
  const handleAddJob = (job: JobData) => {
      // Use functional update to ensure batch updates work correctly in loops
      setJobs(prevJobs => [job, ...prevJobs]);
      setModifiedJobIds(prev => new Set(prev).add(job.id));
      
      // Add header message
      if (currentUser) {
        addHeaderMessage(currentUser.username, job.line, job.booking, job.jobCode);
        addHeaderUpdate(currentUser.username, job.line, job.booking, 'Created', job.jobCode);
      }
  };

  const handleEditJob = (job: JobData) => {
      setJobs(prev => prev.map(x => x.id === job.id ? job : x));
      setModifiedJobIds(prev => new Set(prev).add(job.id));

      if (currentUser) {
        addHeaderUpdate(currentUser.username, job.line, job.booking, 'Updated', job.jobCode);
      }
  };

  const handleDeleteJob = (id: string) => {
      setJobs(prev => prev.filter(x => x.id !== id));
      setDeletedJobIds(prev => new Set(prev).add(id));
      setModifiedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
      });
  };

  // --- PAYMENT HANDLERS WITH TRACKING ---
  const handleUpdatePaymentRequests = (newRequests: PaymentRequest[]) => {
      const currentMap = new Map<string, PaymentRequest>(paymentRequests.map(r => [r.id, r]));
      const changedIds = new Set<string>();
      
      newRequests.forEach(req => {
          const current = currentMap.get(req.id);
          if (!current || JSON.stringify(current) !== JSON.stringify(req)) {
              changedIds.add(req.id);
              
              // Check if UNC was just uploaded (status changed to completed)
              if (current && current.status !== 'completed' && req.status === 'completed' && req.uncUrl) {
                if (currentUser) {
                  addHeaderNotification(currentUser.username, req.booking);
                }
              }
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

  // --- YEARLY CONFIG HANDLERS ---
  const handleUpdateYearlyConfig = (config: YearlyConfig) => {
      setYearlyConfigs(prev => {
          const exists = prev.some(c => c.year === config.year);
          if (exists) {
              return prev.map(c => c.year === config.year ? config : c);
          }
          return [...prev, config];
      });
  };

  // --- NFC HANDLERS ---
  const handleAddNfcProfile = (profileData: Omit<WebNfcProfile, 'id' | 'visits' | 'interactions' | 'lastActive' | 'status' | 'fullUrl'>) => {
      const newProfile: WebNfcProfile = {
          ...profileData,
          id: Date.now().toString(),
          visits: 0,
          interactions: 0,
          lastActive: new Date().toISOString(),
          status: 'active',
          fullUrl: `${BASE_URL_PREFIX}${profileData.slug}`
      };
      setNfcProfiles(prev => [...prev, newProfile]);
  };

  const handleUpdateNfcProfile = (id: string, updates: Partial<WebNfcProfile>) => {
      setNfcProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleDeleteNfcProfile = async (id: string) => {
      if (await confirm("Are you sure you want to delete this profile?", "Confirm Delete")) {
          setNfcProfiles(prev => prev.filter(p => p.id !== id));
      }
  };

  // --- BANK HANDLERS ---
  const handleBankTCBAdd = (item: any) => {
      const newJob: JobData = {
          ...INITIAL_JOB,
          id: item.id,
          localChargeDate: item.date,
          localChargeTotal: item.amount,
          localChargeInvoice: item.invoice,
          amisLcDesc: item.desc,
          bank: 'TCB Bank',
          jobCode: 'TCB-' + Date.now(), // Temp code
          year: new Date().getFullYear(),
          month: (new Date().getMonth() + 1).toString()
      };
      handleAddJob(newJob);
  };
  const handleBankTCBEdit = (item: any) => {
      const job = jobs.find(j => j.id === item.id);
      if (job) {
          handleEditJob({
              ...job,
              localChargeDate: item.date,
              localChargeTotal: item.amount,
              localChargeInvoice: item.invoice,
              amisLcDesc: item.desc,
              bank: 'TCB Bank'
          });
      } else {
          // If not a job, check custom receipts (for TCB mixed items)
          const receiptIndex = customReceipts.findIndex(r => r.id === item.id);
          if (receiptIndex !== -1) {
              setCustomReceipts(prev => prev.map(r => r.id === item.id ? { ...r, ...item } : r));
          }
      }
  };
  const handleBankTCBDelete = (id: string) => {
      const job = jobs.find(j => j.id === id);
      if (job) {
          if (job.jobCode.startsWith('TCB-')) {
              handleDeleteJob(id);
          } else {
              handleEditJob({ ...job, bank: '' });
          }
      } else {
          // If not a job, delete from custom receipts
          setCustomReceipts(prev => prev.filter(r => r.id !== id));
      }
  };

  const handleBankMBAdd = (item: any) => {
      let desc = item.desc || '';
      // Automatically append (LH MB) if missing to ensure it matches the filter
      if (!desc.includes('(LH MB)')) {
          desc = `${desc} (LH MB)`.trim();
      }
      const newReceipt = {
          id: item.id,
          date: item.date,
          amount: item.amount,
          invoice: item.invoice,
          desc: desc,
          docNo: '', 
          type: 'other'
      };
      setCustomReceipts(prev => [...prev, newReceipt]);
  };
  const handleBankMBEdit = (item: any) => {
      setCustomReceipts(prev => prev.map(r => r.id === item.id ? { ...r, ...item } : r));
  };
  const handleBankMBDelete = (id: string) => {
      setCustomReceipts(prev => prev.filter(r => r.id !== id));
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
        alert("Lỗi: Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.", "Lỗi");
        return;
    }
    
    let payload = directPayload;

    if (!payload) {
        const jobsToSend = jobs.filter(j => modifiedJobIds.has(j.id));
        const paymentsToSend = paymentRequests.filter(p => modifiedPaymentIds.has(p.id));

        const hasChanges = jobsToSend.length > 0 || paymentsToSend.length > 0;
        
        if (!hasChanges) {
            alert("Không có thay đổi nào mới (Job hoặc Thanh toán) để gửi đi.", "Thông báo");
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
            salaries: [...salaries], 
            yearlyConfigs: [...yearlyConfigs],
            longHoangOrders: [...longHoangOrders],
            lockedIds: Array.from(lockedIds) 
        };
    }
    
    if (!isServerAvailable) {
        alert("Không thể kết nối với máy chủ (Chế độ Offline). Vui lòng thử lại sau.", "Thông báo");
        return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 

      const response = await fetch(`${BACKEND_URL}/pending`, {
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
              
              alert(`Đã gửi thành công: ${msgParts.join(', ')}!`, "Thành công");
              
              setModifiedJobIds(new Set());
              setModifiedPaymentIds(new Set());
          } 
      } else {
          throw new Error(`Server returned ${response.status}`);
      }

    } catch (err) {
      console.error("Gửi pending thất bại:", err);
      if (!directPayload) {
          alert("Gửi thất bại: Có lỗi khi kết nối đến máy chủ.", "Lỗi");
      }
    }
  };

  // --- FORCE BACKUP TO CONFIRM MISMATCH ---
  const handleConfirmMismatch = async () => {
      // Force sync current data to server to resolve mismatch
      await autoBackup();
      setDataMismatchWarning(false);
      alert("Đã xác nhận dữ liệu hiện tại là chính xác!", "Thành công");
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
  };

  const handleRejectRequest = async (requestId: string) => {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setLocalDeletedIds(prev => new Set(prev).add(requestId));

      if (!isServerAvailable) return;
      
      try {
          const encodedId = encodeURIComponent(requestId);
          await fetch(`${BACKEND_URL}/pending/${encodedId}`, { 
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
      const incConfigs = Array.isArray(incomingData.yearlyConfigs) ? incomingData.yearlyConfigs : (incomingData.data?.yearlyConfigs || incomingData.payload?.yearlyConfigs || []);
      const incLongHoangOrders = Array.isArray(incomingData.longHoangOrders) ? incomingData.longHoangOrders : (incomingData.data?.longHoangOrders || incomingData.payload?.longHoangOrders || []);

      const newJobs = mergeArrays(jobs, incJobs);
      const newPayments = mergeArrays(paymentRequests, incPayments);
      const newCustomers = mergeArrays(customers, incCustomers);
      const newLines = mergeArrays(lines, incLines);
      const newReceipts = mergeArrays(customReceipts, incReceipts);
      const newSalaries = mergeArrays(salaries, incSalaries);
      const newLongHoangOrders = mergeArrays(longHoangOrders, incLongHoangOrders);
      
      // Yearly Config Merge Logic (Merge based on Year)
      const newConfigs = [...yearlyConfigs];
      incConfigs.forEach((c: YearlyConfig) => {
          const idx = newConfigs.findIndex(x => x.year === c.year);
          if (idx >= 0) newConfigs[idx] = c;
          else newConfigs.push(c);
      });

      setJobs(sanitizeData(newJobs)); // Ensure years are populated
      setPaymentRequests(newPayments);
      setCustomers(newCustomers);
      setLines(newLines);
      setCustomReceipts(newReceipts);
      setSalaries(newSalaries);
      setYearlyConfigs(newConfigs);
      setLongHoangOrders(newLongHoangOrders);

      await handleRejectRequest(requestId);
  };

  const fetchPendingRequests = async () => {
    if (!currentUser || currentUser.role !== "Admin" || !isServerAvailable) return;
    try {
        const res = await fetch(`${BACKEND_URL}/pending`);
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

        // Fetch BOTH general data and NFC data
        const [dataRes, nfcRes, headerRes] = await Promise.all([
            fetch(`${BACKEND_URL}/data`, { signal: controller.signal }),
            fetch(`${BACKEND_URL}/nfc`, { signal: controller.signal }),
            fetch(`${BACKEND_URL}/header-data`, { signal: controller.signal }).catch(() => null)
        ]);
        
        clearTimeout(timeoutId);

        if (!dataRes.ok) throw new Error("Server response not OK");

        const data = await dataRes.json();
        console.log("SERVER DATA LOADED:", data);

        if (headerRes && headerRes.ok) {
            const headerData = await headerRes.json();
            const currentDataString = JSON.stringify({
              messages: headerData.messages || [],
              notifications: headerData.notifications || [],
              updates: headerData.updates || []
            });
            lastSavedHeaderData.current = currentDataString;

            if (headerData.messages) setHeaderMessages(headerData.messages);
            if (headerData.notifications) setHeaderNotifications(headerData.notifications);
            if (headerData.updates) setHeaderUpdates(headerData.updates);
        }

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

        if (data.yearlyConfigs && Array.isArray(data.yearlyConfigs)) {
            setYearlyConfigs(data.yearlyConfigs);
        }

        if (data.longHoangOrders && Array.isArray(data.longHoangOrders)) {
            setLongHoangOrders(data.longHoangOrders);
        }

        setIsInitialSyncDone(true);
        setIsServerAvailable(true);

      } catch (err) {
        console.warn("Server unavailable (Offline Mode): Using local data.");
        setIsServerAvailable(false);
        // Even if server is down, we consider initial "sync" attempt done to allow local usage
        setIsInitialSyncDone(true); 
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
          setCurrentPage('payment');
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
      const userData = user;
      setIsAuthenticated(true);
      setCurrentUser(userData);
      setSessionError('');
      
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('kb_user', JSON.stringify(userData));
      
      if (remember) sessionStorage.removeItem('kb_user');
      else localStorage.removeItem('kb_user');

      if (user.role === 'Docs') {
          setCurrentPage('payment');
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

  // --- GENERAL AUTO BACKUP ---
  const autoBackup = async () => {
    // UPDATED: Check for Admin or Docs
    if (!currentUser || !["Admin", "Docs"].includes(currentUser.role)) return;
    if (!isServerAvailable || !isInitialSyncDone) return; 

    try {
      const data = {
        role: currentUser.role, // VITAL: Pass Role for Server Filtering
        timestamp: new Date().toISOString(),
        version: "2.4",
        jobs,
        paymentRequests,
        customers,
        lines,
        lockedIds: Array.from(lockedIds),
        processedRequestIds: Array.from(localDeletedIds),
        deletedJobIds: Array.from(deletedJobIds),
        customReceipts,
        salaries,
        yearlyConfigs,
        longHoangOrders
        // NFC EXCLUDED FROM GENERAL BACKUP
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${BACKEND_URL}/data/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const responseData = await res.json();
      
      // CRITICAL FIX: If server says we are stale (e.g. attempting to save deleted item), RELOAD.
      if (responseData.requireReload) {
          console.warn("⚠️ Data conflict detected (Stale/Deleted data). Forcing reload from server...");
          // Wait slightly to let server finish current writes, then fetch
          setTimeout(() => {
              // Re-fetch logic (copying fetchServerData logic here or calling it if extracted)
              // Since fetchServerData is defined inside useEffect, we trigger a page reload or state reset
              window.location.reload(); 
          }, 1000);
      } else {
          console.log("AUTO BACKUP SUCCESS");
          // Clear deleted IDs once server has processed them
          if (deletedJobIds.size > 0) setDeletedJobIds(new Set());
      }

    } catch (err) {
      console.warn("AUTO BACKUP FAILED (Offline Mode)", err);
    }
  };

  // --- NFC AUTO BACKUP ---
  useEffect(() => {
      if (!isServerAvailable || nfcProfiles.length === 0) return;
      
      // Debounce NFC save
      const timeoutId = setTimeout(() => {
          fetch(`${BACKEND_URL}/nfc/save`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(nfcProfiles)
          }).catch(e => console.warn("NFC Backup failed", e));
      }, 1000); 

      return () => clearTimeout(timeoutId);
  }, [nfcProfiles, isServerAvailable]);

  useEffect(() => { 
    if (!isServerAvailable) return;
    
    const delay = currentUser?.role === 'Admin' ? 0 : 500;
    const timeoutId = setTimeout(() => {
        autoBackup();
    }, delay); 

    return () => clearTimeout(timeoutId);
  }, [jobs, paymentRequests, customers, lines, lockedIds, customReceipts, localDeletedIds, salaries, yearlyConfigs, longHoangOrders, isServerAvailable, currentUser]);

  useEffect(() => { localStorage.setItem("logistics_jobs_v2", JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem("payment_requests_v1", JSON.stringify(paymentRequests)); }, [paymentRequests]);
  useEffect(() => { localStorage.setItem("logistics_customers_v1", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("logistics_lines_v1", JSON.stringify(lines)); }, [lines]);
  useEffect(() => { localStorage.setItem("logistics_users_v1", JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('amis_custom_receipts', JSON.stringify(customReceipts)); }, [customReceipts]);
  useEffect(() => { localStorage.setItem('kb_salaries', JSON.stringify(salaries)); }, [salaries]);
  useEffect(() => { localStorage.setItem('kb_nfc_profiles', JSON.stringify(nfcProfiles)); }, [nfcProfiles]);
  useEffect(() => { localStorage.setItem('kb_long_hoang_orders', JSON.stringify(longHoangOrders)); }, [longHoangOrders]);
  useEffect(() => { localStorage.setItem('kb_yearly_configs', JSON.stringify(yearlyConfigs)); }, [yearlyConfigs]);

  // AUTO POLLING FOR ADMIN: Check for new pending/auto-approve requests regardless of page
  useEffect(() => {
      if (currentUser?.role === 'Admin' && isServerAvailable) {
          fetchPendingRequests(); // Initial fetch
          const interval = setInterval(fetchPendingRequests, 15000); // Poll every 15s
          return () => clearInterval(interval);
      }
  }, [currentUser, isServerAvailable]); 

  // --- REALTIME SSE LISTENER ---
  useEffect(() => {
    if (!isServerAvailable || !isAuthenticated) return;

    const eventSource = new EventSource(`${BACKEND_URL}/events`);

    eventSource.addEventListener('data-updated', (event: any) => {
      const data = JSON.parse(event.data);
      console.log("Realtime Update Received:", data);
      
      // If someone else updated the data, we might want to re-fetch
      // But autoBackup already handles local changes.
      // For Admin, we should re-fetch pending requests immediately
      if (currentUser?.role === 'Admin') {
        fetchPendingRequests();
      }
      
      // Also re-fetch main data if it was a FULL_SYNC from another user
      if (data.type === 'FULL_SYNC' && data.source !== currentUser?.role) {
          // Re-fetch main data
          fetch(`${BACKEND_URL}/data`)
            .then(res => res.json())
            .then(serverData => {
                if (serverData.jobs) setJobs(sanitizeData(serverData.jobs));
                if (serverData.paymentRequests) setPaymentRequests(serverData.paymentRequests);
                if (serverData.customers) setCustomers(serverData.customers);
                if (serverData.lines) setLines(serverData.lines);
                if (serverData.customReceipts) setCustomReceipts(serverData.customReceipts);
                if (serverData.salaries) setSalaries(serverData.salaries);
                if (serverData.yearlyConfigs) setYearlyConfigs(serverData.yearlyConfigs);
            })
            .catch(err => console.warn("Failed to re-fetch after sync", err));
      }
    });

    eventSource.addEventListener('header-updated', (event: any) => {
      fetch(`${BACKEND_URL}/header-data`)
        .then(res => res.json())
        .then(headerData => {
            const currentDataString = JSON.stringify({
              messages: headerData.messages || [],
              notifications: headerData.notifications || [],
              updates: headerData.updates || []
            });
            lastSavedHeaderData.current = currentDataString;

            if (headerData.messages) setHeaderMessages(headerData.messages);
            if (headerData.notifications) setHeaderNotifications(headerData.notifications);
            if (headerData.updates) setHeaderUpdates(headerData.updates);
        })
        .catch(err => console.warn("Failed to re-fetch header data", err));
    });

    eventSource.addEventListener('lock', (event: any) => {
      const data = JSON.parse(event.data);
      // Handle remote lock
    });

    eventSource.addEventListener('unlock', (event: any) => {
      const data = JSON.parse(event.data);
      // Handle remote unlock
    });

    eventSource.onerror = () => {
      console.warn("SSE Connection lost. Reconnecting...");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated, isServerAvailable, currentUser]);

  if (!isAuthenticated)
    return <LoginPage onLogin={handleLogin} error={sessionError || loginError} />;

  return (
    <div className="flex w-full h-screen overflow-hidden bg-slate-50">
      <input 
          type="file" 
          ref={folderInputRef} 
          onChange={handleAutoUploadFolder} 
          className="hidden" 
          {...({ webkitdirectory: "", directory: "" } as any)} 
      />
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentUser={currentUser}
        onLogout={() => handleLogout(false)}
        onSendPending={() => sendPendingToServer()}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 md:ml-[280px] flex flex-col h-full overflow-hidden relative">
        <Header 
          currentUser={currentUser} 
          onLogout={() => handleLogout(false)}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
          onNavigate={setCurrentPage}
          messages={headerMessages}
          notifications={headerNotifications}
          updates={headerUpdates}
          pendingPayments={paymentRequests.filter(r => r.status === 'pending')}
          onMarkNotificationsRead={markNotificationsAsRead}
          onMarkMessagesRead={markMessagesAsRead}
          onMarkUpdatesRead={markUpdatesAsRead}
          onExport={handleExport}
          onSyncBooking={handleSyncBooking}
          onSyncCvhc={handleSyncCvhc}
          onAddOtherReceipt={handleAddOtherReceipt}
        />

        {/* AI Auto Upload Progress Overlay */}
        {isAutoUploading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 animate-in zoom-in-95">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <Loader2 className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Đang đồng bộ CVHC</h3>
                <p className="text-sm text-slate-500">{autoUploadProgress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Server Offline Warning */}
        {!isServerAvailable && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between z-50 shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <span className="font-bold text-sm uppercase tracking-wider">
                CẢNH BÁO: Mất kết nối với Server (Node.js) - Đang chạy chế độ Offline
              </span>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-white text-red-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-red-50 transition-colors"
            >
              Thử kết nối lại
            </button>
          </div>
        )}

        <main className="flex-1 p-2 md:p-4 overflow-hidden relative h-full flex flex-col">
          <div className="flex-1 rounded-2xl md:rounded-3xl overflow-hidden relative shadow-inner h-full flex flex-col bg-white/40 backdrop-blur-3xl border border-white/40">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl border border-white/40 rounded-3xl z-0"></div>

          {/* Alert for Data Mismatch */}
          {dataMismatchWarning && (
              <div className="absolute top-2 left-2 right-2 z-50 bg-orange-100 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <div>
                          <span className="font-bold block">Cảnh báo dữ liệu!</span>
                          <span className="text-xs">Phát hiện dữ liệu không đồng bộ giữa Web và Backup History. Vui lòng vào <strong>Hệ thống</strong> kiểm tra.</span>
                      </div>
                  </div>
                  <button onClick={() => setCurrentPage('system')} className="px-3 py-1 bg-white border border-orange-200 rounded text-xs font-bold hover:bg-orange-50 transition-colors">
                      Kiểm tra ngay
                  </button>
              </div>
          )}

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

            {currentPage === 'reports' && (
              <Reports 
                jobs={jobs} 
                salaries={salaries}
                onUpdateJob={handleEditJob}
                customers={customers}
                lines={lines}
                onAddCustomer={(c) => setCustomers([...customers, c])}
                onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
              />
            )}
            
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
                    customReceipts={customReceipts}
                />
            )}
            
            {/* AMIS EXPORT PAGES WITH SYNCED LOCKS & CUSTOM RECEIPTS */}
            {currentPage === 'amis-thu' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    lines={lines} // Pass lines
                    mode="thu" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock} 
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                    onAddCustomer={(c) => setCustomers(prev => [...prev, c])}
                />
            )}
            {currentPage === 'amis-chi' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    lines={lines} // Pass lines
                    mode="chi" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock}
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                    onAddCustomer={(c) => setCustomers(prev => [...prev, c])}
                />
            )}
            {currentPage === 'amis-ban' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    lines={lines} // Pass lines
                    mode="ban" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock} 
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                    onAddCustomer={(c) => setCustomers(prev => [...prev, c])}
                />
            )}
            {currentPage === 'amis-mua' && (
                <AmisExport 
                    jobs={jobs} 
                    customers={customers} 
                    lines={lines} // Pass lines to enable supplier lookup
                    mode="mua" 
                    onUpdateJob={handleEditJob} 
                    lockedIds={lockedIds} 
                    onToggleLock={handleToggleLock} 
                    customReceipts={customReceipts}
                    onUpdateCustomReceipts={setCustomReceipts}
                    onAddCustomer={(c) => setCustomers(prev => [...prev, c])}
                />
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

            {currentPage === 'lookup' && (
              <LookupPage jobs={jobs} customReceipts={customReceipts} customers={customers} />
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
                onAddCustomer={(c) => setCustomers([...customers, c])}
              />
            )}

            {currentPage === 'cvhc' && (
                <CVHCPage 
                    jobs={jobs} 
                    customers={customers} 
                    onUpdateJob={handleEditJob} 
                    lines={lines}
                    onAddLine={(code) => setLines([...lines, { id: Date.now().toString(), code, name: code, mst: '' }])}
                    onAddCustomer={(c) => setCustomers([...customers, c])}
                />
            )}

            {currentPage === 'salary' && (
                <SalaryPage 
                    salaries={salaries}
                    onUpdateSalaries={handleUpdateSalaries}
                />
            )}

            {currentPage === 'yearly-profit' && (
                <YearlyProfitPage 
                    jobs={jobs} 
                    salaries={salaries} 
                    yearlyConfigs={yearlyConfigs} 
                    onUpdateConfig={handleUpdateYearlyConfig}
                />
            )}

            {currentPage === 'tool-ai' && (
              <ToolAI />
            )}

            {currentPage === 'nfc' && currentUser && (
              <NFCPage 
                profiles={nfcProfiles}
                currentUser={currentUser}
                onAdd={handleAddNfcProfile}
                onUpdate={handleUpdateNfcProfile}
                onDelete={handleDeleteNfcProfile}
              />
            )}

            {currentPage === 'long-hoang' && (
              <LongHoangPage 
                orders={longHoangOrders}
                onAddOrder={(order) => setLongHoangOrders(prev => [order, ...prev])}
                onEditOrder={(order) => setLongHoangOrders(prev => prev.map(o => o.id === order.id ? order : o))}
                onDeleteOrder={(id) => setLongHoangOrders(prev => prev.filter(o => o.id !== id))}
                onRestoreOrders={(orders) => setLongHoangOrders(orders)}
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
                onConfirmMismatch={handleConfirmMismatch}
              />
            )}

            {currentPage === 'bank-tcb' && (
                <BankPage 
                    mode="tcb"
                    data={[
                        ...jobs.filter(j => {
                            const bank = (j.bank || '').toUpperCase();
                            return bank.includes('TCB') || bank.includes('TECHCOM');
                        }).map(j => ({
                            id: j.id, 
                            originalId: j.id,
                            date: j.localChargeDate || '',
                            amount: j.localChargeTotal || 0,
                            invoice: j.localChargeInvoice || '',
                            desc: j.amisLcDesc || j.customerName || '',
                            jobMonth: j.month,
                            jobYear: j.year
                        })),
                        ...customReceipts.filter(r => {
                            // Exclude explicit MB receipts
                            if (r.desc && r.desc.includes('(LH MB)')) return false;
                            
                            // Exclude Auto Tool receipts (unless type is 'other')
                            if (r.id.startsWith('auto-rcpt-') && r.type !== 'other') return false;
                            
                            // Exclude Deposit type receipts
                            if (r.type === 'deposit') return false;

                            // NEW: Exclude text-based deposits (often "Thu Khác" from Auto Tool intended for MB)
                            const descUpper = (r.desc || '').toUpperCase();
                            if (descUpper.includes('CƯỢC') || descUpper.includes('DEPOSIT')) return false;

                            return true;
                        }).map(r => ({
                            id: r.id,
                            originalId: r.id,
                            date: r.date,
                            amount: r.amount,
                            invoice: r.invoice || '',
                            desc: r.desc || '',
                            type: 'other'
                        }))
                    ]}
                    onAdd={handleBankTCBAdd}
                    onEdit={handleBankTCBEdit}
                    onDelete={handleBankTCBDelete}
                />
            )}

            {currentPage === 'bank-mb' && (
                <BankPage 
                    mode="mb"
                    data={customReceipts
                        .filter(r => r.desc && r.desc.includes('(LH MB)'))
                        .map(r => ({
                        id: r.id,
                        originalId: r.id,
                        date: r.date,
                        amount: r.amount,
                        invoice: r.invoice || '',
                        desc: r.desc || '',
                        type: 'other'
                    }))}
                    onAdd={handleBankMBAdd}
                    onEdit={handleBankMBEdit}
                    onDelete={handleBankMBDelete}
                />
            )}

          </div>
        </div>

        {/* Export Modal */}
        <SyncBookingModal 
          isOpen={isSyncBookingModalOpen}
          onClose={() => setIsSyncBookingModalOpen(false)}
          jobs={jobs}
          paymentRequests={paymentRequests}
          onApply={(updatedJobs) => {
            setJobs(updatedJobs);
            alert("Đã cập nhật dữ liệu Booking thành công!", "Thành công");
          }}
        />

        <ExportModal 
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          jobs={jobs}
          customers={customers}
        />

        <SyncCvhcChoiceModal 
          isOpen={isSyncCvhcChoiceOpen}
          onClose={() => setIsSyncCvhcChoiceOpen(false)}
          onSelect={(mode) => {
            setSyncCvhcMode(mode);
            setIsSyncCvhcChoiceOpen(false);
            if (folderInputRef.current) {
                folderInputRef.current.value = '';
                folderInputRef.current.click();
            }
          }}
        />

        {isOtherReceiptOpen && (
          <QuickReceiveModal 
            isOpen={isOtherReceiptOpen}
            onClose={() => setIsOtherReceiptOpen(false)}
            onSave={handleSaveOtherReceipt}
            job={otherReceiptJob}
            mode="other"
            customers={customers}
            allJobs={jobs}
            usedDocNos={customReceipts.map(r => r.docNo).filter(Boolean)}
            onAddCustomer={(newCust) => setCustomers(prev => [...prev, newCust])}
          />
        )}
      </main>
    </div>
  </div>
  );
};

export default App;
