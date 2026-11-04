
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JobData, Customer, ShippingLine, UserAccount } from '../types';
import { 
  Settings, Users, Plus, Edit2, Trash2, X, Eye, EyeOff, FileInput, 
  Check, UserCheck, Clock, FileText, AlertTriangle, CreditCard, Lock, 
  List, Receipt, Database, RefreshCw, ArrowRight, Trash, Camera, 
  Upload, Sparkles, Shield, Image as ImageIcon, Link as LinkIcon, CheckCircle2
} from 'lucide-react';
import { 
  getUserAvatar, setUserAvatar, getRoleBadge, PRESET_AVATARS, DEFAULT_ROLE_AVATARS,
  subscribeToOnlineUsers, OnlineUser, getOnlineUsers 
} from '../utils/userAvatar';

interface SystemPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  users: UserAccount[];
  currentUser: { username: string, role: string, avatar?: string } | null;
  onRestore: (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[], longHoangOrders?: any[] }) => void;
  onAddUser: (user: UserAccount) => void;
  onEditUser: (user: UserAccount, originalUsername: string) => void;
  onDeleteUser: (username: string) => void;
  onUpdateAvatar?: (username: string, avatarUrl: string) => void;
  pendingRequests?: any[];
  onApproveRequest?: (requestId: string, data: any, silent?: boolean) => void;
  onRejectRequest?: (requestId: string) => void;
  onConfirmMismatch?: () => void;
  systemPopupContent?: string;
  onUpdateSystemPopup?: (content: string) => void;
}

export const SystemPage: React.FC<SystemPageProps> = ({ 
  jobs, customers, lines, users, currentUser, 
  onRestore, onAddUser, onEditUser, onDeleteUser, onUpdateAvatar,
  pendingRequests = [], onApproveRequest, onRejectRequest, onConfirmMismatch,
  systemPopupContent = '', onUpdateSystemPopup
}) => {
  const BACKEND_URL = "https://api.kimberry.id.vn";
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formUser, setFormUser] = useState<UserAccount>({ username: '', pass: '', role: 'Docs', avatar: '' });
  const [showPass, setShowPass] = useState(false);

  // --- AVATAR MODAL STATE ---
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarTargetUser, setAvatarTargetUser] = useState<UserAccount | null>(null);
  const [avatarSelectedUrl, setAvatarSelectedUrl] = useState<string>('');
  const [avatarInputUrl, setAvatarInputUrl] = useState<string>('');
  const [avatarTab, setAvatarTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [avatarSuccessMsg, setAvatarSuccessMsg] = useState<string>('');
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time cross-device online users state
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>(() => getOnlineUsers());

  // Subscribe to real-time online presence across all machines
  useEffect(() => {
    const unsubscribe = subscribeToOnlineUsers((list) => {
      setOnlineUsers(list);
    });
    return () => unsubscribe();
  }, []);

  // Listen to external avatar changes to re-render
  useEffect(() => {
    const handleAvatarChanged = () => setAvatarVersion(v => v + 1);
    window.addEventListener('kb_avatar_changed', handleAvatarChanged);
    return () => window.removeEventListener('kb_avatar_changed', handleAvatarChanged);
  }, []);

  const handleOpenAvatarModal = (user: UserAccount) => {
    setAvatarTargetUser(user);
    const current = getUserAvatar(user);
    setAvatarSelectedUrl(current);
    setAvatarInputUrl(current.startsWith('data:') ? '' : current);
    setAvatarTab('presets');
    setAvatarSuccessMsg('');
    setIsAvatarModalOpen(true);
  };

  const handleSelectPresetAvatar = (url: string) => {
    setAvatarSelectedUrl(url);
    setAvatarInputUrl(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("Vui lòng chọn ảnh có dung lượng dưới 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarSelectedUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = () => {
    if (!avatarTargetUser || !avatarSelectedUrl) return;

    if (onUpdateAvatar) {
      onUpdateAvatar(avatarTargetUser.username, avatarSelectedUrl);
    } else {
      setUserAvatar(avatarTargetUser.username, avatarSelectedUrl);
      onEditUser({ ...avatarTargetUser, avatar: avatarSelectedUrl }, avatarTargetUser.username);
    }

    // If currently editing formUser in UserModal, also sync formUser avatar
    if (isUserModalOpen && formUser.username === avatarTargetUser.username) {
      setFormUser(prev => ({ ...prev, avatar: avatarSelectedUrl }));
    }

    setAvatarVersion(v => v + 1);
    setAvatarSuccessMsg('Đã cập nhật ảnh đại diện thành công!');
    setTimeout(() => {
      setIsAvatarModalOpen(false);
      setAvatarSuccessMsg('');
    }, 700);
  };

  const handleResetToDefaultAvatar = () => {
    if (!avatarTargetUser) return;
    const defaultUrl = DEFAULT_ROLE_AVATARS[avatarTargetUser.role] || DEFAULT_ROLE_AVATARS.Admin;
    setAvatarSelectedUrl(defaultUrl);
    setAvatarInputUrl(defaultUrl);
  };

  // --- HISTORY DATA CHECK STATE ---
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFileName, setHistoryFileName] = useState('');

  // Helper to check if a user is Docs
  const isDocsUser = (username?: string) => {
      if (!username) return false;
      const u = users.find(user => user.username === username);
      return u?.role === 'Docs';
  };

  // --- AUTO PROCESS PACKETS (REJECT EMPTY or APPROVE AUTO) ---
  useEffect(() => {
    if (pendingRequests.length > 0 && onApproveRequest && onRejectRequest) {
      pendingRequests.forEach(req => {
        const realData = req.data || req.payload || req;
        
        // 1. Check for Auto Approve (Lock updates from Admin)
        if (realData.autoApprove) {
            // Silently approve
            onApproveRequest(req.id, realData, true);
            return;
        }

        // 2. Empty Check logic
        const jobCount = (realData.jobs || []).length;
        const custCount = (realData.customers || []).length;
        const lineCount = (realData.lines || []).length;
        const paymentCount = (realData.paymentRequests || []).length;
        const lockCount = (realData.lockedIds || []).length;
        const receiptCount = (realData.customReceipts || []).length;

        const isDocs = isDocsUser(req.user);
        const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isDocs ? true : lockCount === 0);

        if (isEmpty) {
           console.log("Auto-rejecting empty packet:", req.id);
           onRejectRequest(req.id);
        }
      });
    }
  }, [pendingRequests, onRejectRequest, onApproveRequest, users]);

  // --- FETCH HISTORY DATA ---
  useEffect(() => {
      if (currentUser?.role === 'Admin') {
          fetchHistory();
      }
  }, [currentUser]);

  const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
          const res = await fetch(`${BACKEND_URL}/history/latest`);
          
          if (!res.ok) {
              console.warn("History fetch skipped: Server returned " + res.status);
              return;
          }

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
              console.warn("History fetch skipped: Response is not JSON");
              return;
          }

          const result = await res.json();
          if (result.found) {
              setHistoryData(result.data);
              setHistoryFileName(result.fileName);
          }
      } catch (e) {
          console.error("Failed to fetch history", e);
      } finally {
          setLoadingHistory(false);
      }
  };

  // --- CALCULATE MISSING DATA ---
  const missingData = useMemo(() => {
      if (!historyData) return { jobs: [], customers: [], lines: [], corruptedJobs: [] };

      // Check Jobs
      const histJobs = Array.isArray(historyData.jobs) ? historyData.jobs : [];
      const currentJobMap = new Map<string, JobData>(jobs.map(j => [j.id, j]));
      
      const missingJobs: JobData[] = [];
      const corruptedJobs: { histJob: JobData, currentJob: JobData, reasons: string[] }[] = [];

      histJobs.forEach((hJob: JobData) => {
          const cJob = currentJobMap.get(hJob.id);
          if (!cJob) {
              missingJobs.push(hJob);
          } else {
              const reasons: string[] = [];
              
              // Check AMIS data
              const amisFields = [
                  "amisPaymentDocNo", "amisDepositOutDocNo", "amisExtensionPaymentDocNo",
                  "amisLcDocNo", "amisDepositDocNo", "amisDepositRefundDocNo"
              ];
              let amisMissing = false;
              amisFields.forEach(field => {
                  if (hJob[field as keyof JobData] && !cJob[field as keyof JobData]) amisMissing = true;
              });
              if (amisMissing) {
                  reasons.push(`Mất dữ liệu Kế toán AMIS`);
              }

              if (reasons.length > 0) {
                  corruptedJobs.push({ histJob: hJob, currentJob: cJob, reasons });
              }
          }
      });

      // Check Customers
      const histCust = Array.isArray(historyData.customers) ? historyData.customers : [];
      const currentCustIds = new Set(customers.map(c => c.id));
      const missingCust = histCust.filter((c: Customer) => !currentCustIds.has(c.id));

      return { jobs: missingJobs, customers: missingCust, lines: [], corruptedJobs };
  }, [historyData, jobs, customers]);

  const hasMissingData = missingData.jobs.length > 0 || missingData.customers.length > 0 || missingData.corruptedJobs.length > 0;

  const handleSyncHistory = () => {
      if (!historyData || !hasMissingData) return;
      if (window.confirm(`Xác nhận đồng bộ?\n- ${missingData.jobs.length} Jobs bị xóa sẽ được khôi phục\n- ${missingData.corruptedJobs.length} Jobs bị mất dữ liệu sẽ được khôi phục\n- ${missingData.customers.length} Khách hàng sẽ được khôi phục`)) {
          // Merge missing data into current state
          const newJobs = [...jobs, ...missingData.jobs];
          
          // Restore corrupted jobs by merging missing data
          missingData.corruptedJobs.forEach(({ histJob, currentJob }) => {
              const jobIndex = newJobs.findIndex(j => j.id === currentJob.id);
              if (jobIndex !== -1) {
                  const updatedJob = { ...newJobs[jobIndex] };
                  
                  // Restore AMIS data if missing
                  const amisFields = [
                      "amisPaymentDocNo", "amisPaymentDesc", "amisPaymentDate",
                      "amisDepositOutDocNo", "amisDepositOutDesc", "amisDepositOutDate",
                      "amisExtensionPaymentDocNo", "amisExtensionPaymentDesc", "amisExtensionPaymentDate", "amisExtensionPaymentAmount",
                      "amisLcDocNo", "amisLcDesc", "amisLcAmount",
                      "amisDepositDocNo", "amisDepositDesc", "amisDepositAmount",
                      "amisDepositRefundDocNo", "amisDepositRefundDesc", "amisDepositRefundDate", "amisDepositRefundAmount"
                  ];
                  amisFields.forEach(field => {
                      if (histJob[field as keyof JobData] && !updatedJob[field as keyof JobData]) {
                          (updatedJob as any)[field] = histJob[field as keyof JobData];
                      }
                  });

                  newJobs[jobIndex] = updatedJob;
              }
          });

          const newCustomers = [...customers, ...missingData.customers];
          
          // Call restore (this triggers App.tsx to update state and save to server)
          onRestore({
              jobs: newJobs,
              customers: newCustomers,
              lines: lines, // No changes to lines for now
              longHoangOrders: historyData.longHoangOrders
          });
          alert("Đã đồng bộ dữ liệu từ History thành công!");
      }
  };

  const handleConfirmDelete = () => {
      if (window.confirm("Bạn có chắc chắn muốn xác nhận xóa dữ liệu này? Hành động này sẽ cập nhật bản lưu trữ trên Server khớp với dữ liệu hiện tại.")) {
          if (onConfirmMismatch) onConfirmMismatch();
      }
  };

  // --- USER MANAGEMENT ---
  const handleAddUserClick = () => {
    setEditingUser(null);
    setFormUser({ username: '', pass: '', role: 'Docs', avatar: '' });
    setShowPass(true);
    setIsUserModalOpen(true);
  };

  const handleEditUserClick = (user: UserAccount) => {
    setEditingUser(user);
    setFormUser({ ...user, avatar: user.avatar || getUserAvatar(user) });
    setShowPass(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUser.username || !formUser.pass) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    const finalAvatar = formUser.avatar || getUserAvatar(formUser);
    const updatedFormUser = { ...formUser, avatar: finalAvatar };

    if (editingUser) {
        onEditUser(updatedFormUser, editingUser.username);
    } else {
        if (users.some(u => u.username === updatedFormUser.username)) {
            alert("Tên tài khoản đã tồn tại!");
            return;
        }
        onAddUser(updatedFormUser);
    }

    if (finalAvatar) {
      setUserAvatar(updatedFormUser.username, finalAvatar);
    }

    setIsUserModalOpen(false);
  };

  const handleDeleteUserClick = (username: string) => {
      if (username === currentUser?.username) {
          alert("Không thể xóa tài khoản đang đăng nhập!");
          return;
      }
      if (window.confirm(`Bạn chắc chắn muốn xóa tài khoản ${username}?`)) {
          onDeleteUser(username);
      }
  };

  // --- APPROVE HANDLERS ---
  const handleApprove = (req: any, realData: any) => {
      if (window.confirm(`Duyệt dữ liệu từ ${req.user || 'Docs'}?\n(Dữ liệu sẽ được gộp vào hệ thống)`)) {
          if (onApproveRequest) onApproveRequest(req.id, realData);
      }
  };

  return (
    <div className="p-8 max-w-full">
      {/* Header with Admin Profile & Avatar Card */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-white/10 relative overflow-hidden">
          {/* Background decorative glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-teal-300 border border-white/10 shadow-inner">
                <Settings className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Quản Trị Hệ Thống</h1>
            </div>
            <p className="text-slate-300 text-sm max-w-xl">
              Quản lý tài khoản, thay đổi ảnh đại diện (Avatar), duyệt dữ liệu gửi từ nhân viên và kiểm tra tính toàn vẹn hệ thống.
            </p>

            {/* Live Online Users Status Bar */}
            <div className="flex items-center gap-2 mt-3.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span>{onlineUsers.length} tài khoản đang online</span>
              </div>
              {onlineUsers.map(ou => (
                <span key={ou.username} className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-medium border border-white/15 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold">{ou.username}</span>
                  <span className="text-[10px] text-teal-300 font-normal">({ou.role})</span>
                  {ou.loginTime && <span className="text-[9px] text-slate-300">· {ou.loginTime}</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Current Admin Avatar & Quick Change Card */}
          {currentUser && (
            <div className="relative z-10 flex items-center gap-4 bg-white/10 backdrop-blur-md p-3.5 pr-5 rounded-2xl border border-white/15 shadow-lg">
              <div 
                className="relative group cursor-pointer"
                onClick={() => handleOpenAvatarModal({ username: currentUser.username, role: currentUser.role as any, pass: '', avatar: currentUser.avatar })}
                title="Nhấn để đổi ảnh đại diện Admin"
              >
                <img 
                  key={`admin-avatar-${currentUser.username}-${avatarVersion}`}
                  src={getUserAvatar(currentUser)} 
                  alt={currentUser.username} 
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-teal-400 shadow-md group-hover:ring-4 group-hover:ring-teal-300 transition-all"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white">
                  <Camera className="w-5 h-5 text-teal-300 drop-shadow" />
                </div>
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow"></span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">{currentUser.username}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {currentUser.role}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">Tài khoản quản trị viên</p>
                <button
                  type="button"
                  onClick={() => handleOpenAvatarModal({ username: currentUser.username, role: currentUser.role as any, pass: '', avatar: currentUser.avatar })}
                  className="mt-1.5 text-xs text-teal-300 hover:text-white font-semibold flex items-center gap-1.5 transition-colors group/btn"
                >
                  <Camera className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" /> Đổi Avatar Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DATA INTEGRITY CHECK SECTION (ADMIN ONLY) */}
      {currentUser?.role === 'Admin' && (
          <div className="mb-8 glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-700 flex items-center">
                      <Database className="w-5 h-5 mr-2 text-indigo-600" /> Kiểm Tra & Đồng Bộ Dữ Liệu
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>File History mới nhất: {historyFileName || 'Đang tải...'}</span>
                      <button onClick={fetchHistory} className="p-1 hover:bg-slate-100 rounded-full" title="Tải lại"><RefreshCw size={12}/></button>
                  </div>
              </div>

              {loadingHistory ? (
                  <div className="text-center py-4 text-slate-400">Đang so sánh dữ liệu...</div>
              ) : hasMissingData ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-4">
                          <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0" />
                          <div>
                              <h4 className="font-bold text-orange-800">Phát hiện dữ liệu chưa đồng bộ!</h4>
                              <p className="text-sm text-orange-700 mt-1">
                                  Có dữ liệu tồn tại trong bản Backup History nhưng không có trong dữ liệu hiện tại (backup.json). 
                                  Điều này có thể do lỗi lưu trữ hoặc dữ liệu bị xóa mà không qua quy trình chuẩn.
                              </p>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {missingData.jobs.length > 0 && (
                              <div className="bg-white p-3 rounded-lg border border-orange-100">
                                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Jobs bị thiếu ({missingData.jobs.length})</div>
                                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                      {missingData.jobs.map(j => (
                                          <div key={j.id} className="text-xs text-slate-700 flex justify-between">
                                              <span>{j.jobCode}</span>
                                              <span className="text-slate-400">{j.booking}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                          {missingData.corruptedJobs.length > 0 && (
                              <div className="bg-white p-3 rounded-lg border border-orange-100">
                                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Jobs bị mất dữ liệu ({missingData.corruptedJobs.length})</div>
                                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                      {missingData.corruptedJobs.map(({ currentJob, reasons }) => (
                                          <div key={currentJob.id} className="text-xs text-slate-700 flex flex-col mb-2 border-b border-slate-100 pb-1">
                                              <div className="flex justify-between font-medium">
                                                  <span>{currentJob.jobCode}</span>
                                                  <span className="text-slate-400">{currentJob.booking}</span>
                                              </div>
                                              <div className="text-red-500 text-[10px] mt-1">
                                                  {reasons.join(', ')}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                          {missingData.customers.length > 0 && (
                              <div className="bg-white p-3 rounded-lg border border-orange-100">
                                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Khách hàng bị thiếu ({missingData.customers.length})</div>
                                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                      {missingData.customers.map(c => (
                                          <div key={c.id} className="text-xs text-slate-700">
                                              {c.code} - {c.name}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={handleSyncHistory}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2"
                          >
                              <RefreshCw className="w-4 h-4" /> Đồng bộ Dữ liệu từ History
                          </button>
                          
                          <button 
                              onClick={handleConfirmDelete}
                              className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 shadow-sm flex items-center gap-2"
                          >
                              <Trash className="w-4 h-4" /> Chấp nhận xoá (Lưu hiện tại)
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                      <Check className="w-6 h-6 text-green-600" />
                      <div>
                          <h4 className="font-bold text-green-800">Dữ liệu đồng bộ</h4>
                          <p className="text-sm text-green-700">Dữ liệu hiện tại khớp hoàn toàn với bản sao lưu gần nhất.</p>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* User Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* User List with Avatars */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-700 flex items-center">
                   <Users className="w-5 h-5 mr-2 text-blue-600" /> Danh Sách Tài Khoản
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Nhấn vào ảnh đại diện hoặc nút máy ảnh để đổi avatar</p>
              </div>
              <button onClick={handleAddUserClick} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center shadow-md transition-all">
                 <Plus className="w-4 h-4 mr-1" /> Thêm
              </button>
           </div>
           
           <div className="space-y-3">
              {users.map((user, idx) => {
                 const roleBadge = getRoleBadge(user.role);
                 const isCurrent = currentUser?.username === user.username;
                 const avatarSrc = getUserAvatar(user);
                 const onlineSession = onlineUsers.find(ou => ou.username?.toLowerCase() === user.username.toLowerCase());
                 const isOnline = !!onlineSession;

                 return (
                  <div key={`${user.username}-${idx}-${avatarVersion}`} className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200/70 hover:border-blue-300 hover:shadow-sm transition-all group">
                     <div className="flex items-center space-x-3.5">
                        {/* Interactive Avatar with Online Dot */}
                        <div 
                          className="relative group/avatar cursor-pointer" 
                          onClick={() => handleOpenAvatarModal(user)} 
                          title={`Nhấn để thay đổi avatar cho ${user.username}`}
                        >
                           <img 
                              src={avatarSrc} 
                              alt={user.username} 
                              className={`w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm ring-2 ${isOnline ? 'ring-emerald-400' : 'ring-slate-200'} group-hover/avatar:ring-blue-500 transition-all`}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                ((e.target as HTMLElement).nextElementSibling as HTMLElement)?.classList.remove('hidden');
                              }}
                           />
                           <div className="hidden w-11 h-11 rounded-full items-center justify-center font-bold text-white shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600">
                              {user.username.charAt(0).toUpperCase()}
                           </div>
                           <div className="absolute inset-0 bg-slate-900/50 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all text-white">
                              <Camera className="w-4 h-4 text-blue-200 drop-shadow" />
                           </div>
                           {/* Status Indicator Dot on Avatar */}
                           <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-xs ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        </div>

                        <div>
                           <div className="flex items-center gap-2 flex-wrap">
                             <p className="font-bold text-slate-800 text-sm">{user.username}</p>
                             {isCurrent && (
                               <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
                                 Bạn
                               </span>
                             )}
                             {/* Online / Offline Status Badge */}
                             {isOnline ? (
                               <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full shadow-xs">
                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                 Online {isCurrent ? '(Máy này)' : '(Online)'}
                                 {onlineSession?.loginTime && !isCurrent && (
                                   <span className="text-[9px] font-normal text-emerald-600">· {onlineSession.loginTime}</span>
                                 )}
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                 <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                 Offline
                               </span>
                             )}
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                             <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleBadge.badgeClass}`}>
                               {roleBadge.label}
                             </span>
                             <button
                               type="button"
                               onClick={() => handleOpenAvatarModal(user)}
                               className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 opacity-80 hover:opacity-100"
                             >
                               <Camera className="w-3 h-3" /> Đổi avatar
                             </button>
                           </div>
                        </div>
                     </div>

                     <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          type="button"
                          onClick={() => handleOpenAvatarModal(user)} 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Thay đổi Avatar"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleEditUserClick(user)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa tài khoản"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteUserClick(user.username)} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                 );
              })}
           </div>
        </div>

        {/* Popup Config Box */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 flex items-center mb-3">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" /> Thông Báo Toàn Hệ Thống
            </h3>
            <p className="text-xs text-slate-500 mb-3">Nội dung này hiển thị dạng Popup khi User đăng nhập/tải lại trang.</p>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nhập thông báo tại đây..."
              value={systemPopupContent}
              onChange={(e) => onUpdateSystemPopup && onUpdateSystemPopup(e.target.value)}
            />
        </div>

        {/* Pending Data Section */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-700 flex items-center">
                 <FileInput className="w-5 h-5 mr-2 text-orange-600" /> Duyệt Dữ Liệu Từ Nhân Viên
              </h3>
              <span className="text-xs font-medium text-slate-500">Các yêu cầu gửi dữ liệu đang chờ duyệt</span>
           </div>

           <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {pendingRequests.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                    <Check className="w-12 h-12 mb-2 opacity-20" />
                    <p>Không có yêu cầu nào đang chờ.</p>
                 </div>
              ) : (
                 pendingRequests.map((req, idx) => {
                    const realData = req.data || req.payload || req;
                    
                    // IF AUTO-APPROVED, DO NOT RENDER (IT WILL BE PROCESSED BY EFFECT)
                    if (realData.autoApprove) return null;

                    const jobCount = (realData.jobs || []).length;
                    const custCount = (realData.customers || []).length;
                    const lineCount = (realData.lines || []).length;
                    const paymentCount = (realData.paymentRequests || []).length;
                    const lockCount = (realData.lockedIds || []).length;
                    const receiptCount = (realData.customReceipts || []).length;

                    const isDocs = isDocsUser(req.user);
                    const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isDocs ? true : lockCount === 0);
                    const showLockBadge = lockCount > 0 && !isDocs;

                    return (
                       <div key={req.id || idx} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                   {(req.user || 'S').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                   <p className="font-bold text-slate-800 text-sm">Cập nhật từ: <span className="text-blue-700">{req.user || 'Unknown'}</span></p>
                                   <p className="text-[10px] text-slate-400 flex items-center">
                                      <Clock className="w-3 h-3 mr-1" /> {new Date(req.timestamp).toLocaleString()}
                                   </p>
                                </div>
                             </div>
                          </div>

                          {isEmpty ? (
                             <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs flex items-center mb-3 border border-red-100">
                                <AlertTriangle className="w-4 h-4 mr-2" /> Gói tin rỗng. Đang tự động xử lý...
                             </div>
                          ) : (
                             <div className="grid grid-cols-2 gap-2 mb-3">
                                 {jobCount > 0 && (
                                     <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100 flex items-center">
                                         <FileText className="w-3 h-3 mr-1.5" /> {jobCount} Jobs
                                     </div>
                                 )}
                                 {custCount > 0 && (
                                     <div className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium border border-indigo-100 flex items-center">
                                         <UserCheck className="w-3 h-3 mr-1.5" /> {custCount} Khách hàng
                                     </div>
                                 )}
                                 {lineCount > 0 && (
                                     <div className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium border border-slate-200 flex items-center">
                                         <List className="w-3 h-3 mr-1.5" /> {lineCount} Lines
                                     </div>
                                 )}
                                 {paymentCount > 0 && (
                                     <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium border border-emerald-100 flex items-center">
                                         <CreditCard className="w-3 h-3 mr-1.5" /> {paymentCount} Yêu cầu TT
                                     </div>
                                 )}
                                 {showLockBadge && (
                                     <div className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs font-medium border border-orange-100 flex items-center">
                                         <Lock className="w-3 h-3 mr-1.5" /> {lockCount} Khóa sổ
                                     </div>
                                 )}
                                 {receiptCount > 0 && (
                                     <div className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-medium border border-purple-100 flex items-center">
                                         <Receipt className="w-3 h-3 mr-1.5" /> {receiptCount} Thu Khác
                                     </div>
                                 )}
                             </div>
                          )}

                          <div className="flex space-x-2 justify-end">
                             <button 
                                onClick={() => onRejectRequest && onRejectRequest(req.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors"
                             >
                                Từ chối
                             </button>
                             <button 
                                onClick={() => handleApprove(req, realData)}
                                className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-bold shadow-sm transition-colors flex items-center"
                             >
                                <Check className="w-3 h-3 mr-1" /> Duyệt
                             </button>
                          </div>
                       </div>
                    );
                 })
              )}
           </div>
        </div>
      </div>

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 border border-white/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Sửa Tài Khoản' : 'Thêm Tài Khoản'}</h3>
                 <button type="button" onClick={() => setIsUserModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
              </div>
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                 {/* Avatar Selector in User Modal */}
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ảnh đại diện (Avatar)</label>
                    <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                       <div 
                         className="relative group cursor-pointer shrink-0"
                         onClick={() => handleOpenAvatarModal(formUser)}
                         title="Nhấn để đổi avatar"
                       >
                          <img 
                            src={formUser.avatar || getUserAvatar(formUser)} 
                            alt={formUser.username || "avatar"} 
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-blue-500/30 group-hover:ring-blue-500 transition-all"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-slate-900/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                             <Camera className="w-4 h-4 text-blue-200" />
                          </div>
                       </div>
                       <div className="flex-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAvatarModal(formUser)}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
                          >
                             <Camera className="w-3.5 h-3.5 text-blue-600" /> Chọn ảnh mẫu / Tải lên...
                          </button>
                          <p className="text-[11px] text-slate-400 mt-1">Đổi avatar từ thư viện mẫu, tải ảnh hoặc link</p>
                       </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên đăng nhập</label>
                    <input 
                       type="text" 
                       value={formUser.username} 
                       onChange={(e) => setFormUser({...formUser, username: e.target.value})}
                       className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                       disabled={!!editingUser}
                       placeholder="Nhập tên đăng nhập..."
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu</label>
                    <div className="relative">
                       <input 
                          type={showPass ? "text" : "password"} 
                          value={formUser.pass} 
                          onChange={(e) => setFormUser({...formUser, pass: e.target.value})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nhập mật khẩu..."
                       />
                       <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-2 text-slate-400 hover:text-blue-600">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò</label>
                    <select 
                       value={formUser.role} 
                       onChange={(e) => setFormUser({...formUser, role: e.target.value as any})}
                       className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                       <option value="Docs">Docs (Chứng từ)</option>
                       <option value="Admin">Admin (Quản trị)</option>
                       <option value="Cus">Cus (CSKH)</option>
                    </select>
                 </div>
                 <div className="pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md">Lưu</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* DEDICATED AVATAR CHANGER MODAL */}
      {isAvatarModalOpen && avatarTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 border border-white/60 overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                 <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-white/10 rounded-xl text-teal-300">
                       <Camera className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-bold text-white">Thay Đổi Ảnh Đại Diện</h3>
                       <p className="text-xs text-slate-300">Tài khoản: <span className="font-semibold text-teal-300">{avatarTargetUser.username}</span> ({avatarTargetUser.role})</p>
                    </div>
                 </div>
                 <button 
                   type="button" 
                   onClick={() => setIsAvatarModalOpen(false)} 
                   className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                 
                 {/* Live Preview Card */}
                 <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <img 
                            src={avatarSelectedUrl || getUserAvatar(avatarTargetUser)} 
                            alt="Preview" 
                            className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md border border-slate-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_ROLE_AVATARS[avatarTargetUser.role] || DEFAULT_ROLE_AVATARS.Admin;
                            }}
                          />
                          <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white p-1 rounded-full shadow border-2 border-white">
                             <Sparkles className="w-3 h-3" />
                          </div>
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-800">{avatarTargetUser.username}</p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                             {avatarTargetUser.role}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-1">Ảnh đại diện xem trước</p>
                       </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetToDefaultAvatar}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all shadow-sm"
                      title="Đặt lại về avatar mặc định"
                    >
                      Mặc định
                    </button>
                 </div>

                 {/* Success alert message */}
                 {avatarSuccessMsg && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                       <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                       {avatarSuccessMsg}
                    </div>
                 )}

                 {/* Navigation Tabs */}
                 <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setAvatarTab('presets')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        avatarTab === 'presets' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                       <ImageIcon className="w-3.5 h-3.5" /> Thư viện mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTab('upload')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        avatarTab === 'upload' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                       <Upload className="w-3.5 h-3.5" /> Tải từ máy tính
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTab('url')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        avatarTab === 'url' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                       <LinkIcon className="w-3.5 h-3.5" /> Nhập link URL
                    </button>
                 </div>

                 {/* Tab Content: Presets */}
                 {avatarTab === 'presets' && (
                    <div>
                       <div className="flex justify-between items-center mb-2.5">
                          <label className="text-xs font-bold text-slate-600 uppercase">Chọn ảnh từ bộ sưu tập</label>
                          <span className="text-[11px] text-slate-400">{PRESET_AVATARS.length} mẫu có sẵn</span>
                       </div>
                       <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-56 overflow-y-auto custom-scrollbar p-1">
                          {PRESET_AVATARS.map((preset) => {
                             const isSelected = avatarSelectedUrl === preset.url;
                             return (
                               <div
                                 key={preset.id}
                                 onClick={() => handleSelectPresetAvatar(preset.url)}
                                 className={`cursor-pointer group flex flex-col items-center p-2 rounded-2xl border transition-all text-center ${
                                    isSelected 
                                      ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20' 
                                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                 }`}
                               >
                                  <div className="relative mb-1.5">
                                     <img 
                                       src={preset.url} 
                                       alt={preset.name} 
                                       className="w-12 h-12 rounded-full object-cover border border-white shadow-sm group-hover:scale-105 transition-transform" 
                                     />
                                     {isSelected && (
                                        <div className="absolute -top-1 -right-1 bg-indigo-600 text-white p-0.5 rounded-full shadow">
                                           <Check className="w-3 h-3" />
                                        </div>
                                     )}
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-700 line-clamp-1">{preset.name}</span>
                                  <span className="text-[9px] text-slate-400">{preset.role}</span>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 )}

                 {/* Tab Content: Upload File */}
                 {avatarTab === 'upload' && (
                    <div className="space-y-3">
                       <input 
                         type="file" 
                         ref={fileInputRef} 
                         onChange={handleFileUpload} 
                         accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" 
                         className="hidden" 
                       />
                       <div 
                         onClick={() => fileInputRef.current?.click()}
                         className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
                       >
                          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                             <Upload className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-800 mb-1">Nhấn để chọn ảnh từ máy tính</p>
                          <p className="text-xs text-slate-500 text-center">Hỗ trợ PNG, JPG, JPEG, WEBP hoặc GIF (Tối đa 3MB)</p>
                          <button
                            type="button"
                            className="mt-3 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors"
                          >
                             Chọn tệp ảnh
                          </button>
                       </div>
                       <p className="text-[11px] text-slate-400 text-center">Ảnh sau khi tải lên sẽ được tự động tối ưu và lưu vào hệ thống</p>
                    </div>
                 )}

                 {/* Tab Content: URL Link */}
                 {avatarTab === 'url' && (
                    <div className="space-y-3">
                       <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Đường dẫn hình ảnh (Image URL)</label>
                          <div className="flex gap-2">
                             <input 
                               type="url" 
                               value={avatarInputUrl} 
                               onChange={(e) => setAvatarInputUrl(e.target.value)}
                               placeholder="https://example.com/avatar.jpg" 
                               className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                             <button
                               type="button"
                               onClick={() => {
                                 if (avatarInputUrl.trim()) {
                                    setAvatarSelectedUrl(avatarInputUrl.trim());
                                 }
                               }}
                               className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shrink-0 shadow-sm"
                             >
                                Áp dụng
                             </button>
                          </div>
                       </div>
                       <p className="text-[11px] text-slate-400">Bạn có thể dán link ảnh từ bất kỳ trang web nào (Pinterest, Google Photos, Imgur, v.v.)</p>
                    </div>
                 )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                 <button 
                   type="button" 
                   onClick={() => setIsAvatarModalOpen(false)} 
                   className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                 >
                    Hủy bỏ
                 </button>
                 <button 
                   type="button" 
                   onClick={handleSaveAvatar} 
                   className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                 >
                    <Check className="w-4 h-4" /> Lưu Avatar
                 </button>
              </div>

           </div>
        </div>
      )}
    </div>
  );
};
