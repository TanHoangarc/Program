
import React, { useState, useEffect, useMemo } from 'react';
import { JobData, Customer, ShippingLine, UserAccount } from '../types';
import { Settings, Users, Plus, Edit2, Trash2, X, Eye, EyeOff, FileInput, Check, UserCheck, Clock, FileText, AlertTriangle, CreditCard, Lock, List, Receipt, Database, RefreshCw, ArrowRight, Trash, Save, HardDrive } from 'lucide-react';

interface SystemPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  users: UserAccount[];
  currentUser: { username: string, role: string } | null;
  onRestore: (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[] }) => void;
  onAddUser: (user: UserAccount) => void;
  onEditUser: (user: UserAccount, originalUsername: string) => void;
  onDeleteUser: (username: string) => void;
  pendingRequests?: any[];
  onApproveRequest?: (requestId: string, data: any, silent?: boolean) => void;
  onRejectRequest?: (requestId: string) => void;
  onConfirmMismatch?: () => void;
}

export const SystemPage: React.FC<SystemPageProps> = ({ 
  jobs, customers, lines, users, currentUser, 
  onRestore, onAddUser, onEditUser, onDeleteUser,
  pendingRequests = [], onApproveRequest, onRejectRequest, onConfirmMismatch
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formUser, setFormUser] = useState<UserAccount>({ username: '', pass: '', role: 'Staff' });
  const [showPass, setShowPass] = useState(false);

  // --- HISTORY DATA CHECK STATE ---
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFileName, setHistoryFileName] = useState('');
  
  // --- MANUAL BACKUP STATE ---
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Helper to check if a user is Staff
  const isStaffUser = (username?: string) => {
      if (!username) return false;
      const u = users.find(user => user.username === username);
      return u?.role === 'Staff';
  };

  // --- MANUAL BACKUP HANDLERS ---
  const handleManualBackup = async () => {
      if (!window.confirm("Bạn có chắc chắn muốn sao lưu dữ liệu hiện tại vào thư mục Mydata?")) return;
      setIsBackingUp(true);
      try {
          const res = await fetch('/api/manual-backup', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              alert(`Sao lưu thành công!\nFile: ${data.path}`);
          } else {
              alert("Sao lưu thất bại: " + data.error);
          }
      } catch (e) {
          console.error(e);
          alert("Lỗi kết nối khi sao lưu.");
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleManualRestore = async () => {
      if (!window.confirm("CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại bằng file backup trong thư mục Mydata.\nBạn có chắc chắn muốn tiếp tục?")) return;
      setIsRestoring(true);
      try {
          const res = await fetch('/api/manual-restore', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              alert("Khôi phục dữ liệu thành công! Hệ thống sẽ tự động cập nhật.");
              window.location.reload(); // Reload to ensure fresh state
          } else {
              alert("Khôi phục thất bại: " + (data.message || data.error));
          }
      } catch (e) {
          console.error(e);
          alert("Lỗi kết nối khi khôi phục.");
      } finally {
          setIsRestoring(false);
      }
  };

  // --- AUTO PROCESS PACKETS (REJECT EMPTY or APPROVE AUTO) ---
  useEffect(() => {
    if (pendingRequests.length > 0 && onApproveRequest && onRejectRequest) {
      pendingRequests.forEach(req => {
        const realData = req.data || req.payload || req;
        
        // 1. Check for Auto Approve (Lock updates from Admin/Manager)
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

        const isStaff = isStaffUser(req.user);
        const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isStaff ? true : lockCount === 0);

        if (isEmpty) {
           console.log("Auto-rejecting empty packet:", req.id);
           onRejectRequest(req.id);
        }
      });
    }
  }, [pendingRequests, onRejectRequest, onApproveRequest, users]);

  // --- FETCH HISTORY DATA ---
  useEffect(() => {
      if (currentUser?.role === 'Admin' || currentUser?.role === 'Manager') {
          fetchHistory();
      }
  }, [currentUser]);

  const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
          const res = await fetch('https://api.kimberry.id.vn/history/latest');
          
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
      if (!historyData) return { jobs: [], customers: [], lines: [] };

      // Check Jobs
      const histJobs = Array.isArray(historyData.jobs) ? historyData.jobs : [];
      const currentJobIds = new Set(jobs.map(j => j.id));
      const missingJobs = histJobs.filter((j: JobData) => !currentJobIds.has(j.id));

      // Check Customers
      const histCust = Array.isArray(historyData.customers) ? historyData.customers : [];
      const currentCustIds = new Set(customers.map(c => c.id));
      const missingCust = histCust.filter((c: Customer) => !currentCustIds.has(c.id));

      return { jobs: missingJobs, customers: missingCust, lines: [] };
  }, [historyData, jobs, customers]);

  const hasMissingData = missingData.jobs.length > 0 || missingData.customers.length > 0;

  const handleSyncHistory = () => {
      if (!historyData || !hasMissingData) return;
      if (window.confirm(`Xác nhận đồng bộ?\n- ${missingData.jobs.length} Jobs sẽ được khôi phục\n- ${missingData.customers.length} Khách hàng sẽ được khôi phục`)) {
          // Merge missing data into current state
          const newJobs = [...jobs, ...missingData.jobs];
          const newCustomers = [...customers, ...missingData.customers];
          
          // Call restore (this triggers App.tsx to update state and save to server)
          onRestore({
              jobs: newJobs,
              customers: newCustomers,
              lines: lines // No changes to lines for now
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
    setFormUser({ username: '', pass: '', role: 'Staff' });
    setShowPass(true);
    setIsUserModalOpen(true);
  };

  const handleEditUserClick = (user: UserAccount) => {
    setEditingUser(user);
    setFormUser({ ...user });
    setShowPass(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUser.username || !formUser.pass) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    if (editingUser) {
        onEditUser(formUser, editingUser.username);
    } else {
        if (users.some(u => u.username === formUser.username)) {
            alert("Tên tài khoản đã tồn tại!");
            return;
        }
        onAddUser(formUser);
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
      if (window.confirm(`Duyệt dữ liệu từ ${req.user || 'Staff'}?\n(Dữ liệu sẽ được gộp vào hệ thống)`)) {
          if (onApproveRequest) onApproveRequest(req.id, realData);
      }
  };

  return (
    <div className="p-8 max-w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
             <Settings className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Quản Trị Hệ Thống</h1>
        </div>
        <p className="text-slate-500 ml-11">Quản lý người dùng và duyệt dữ liệu từ nhân viên</p>
      </div>

      {/* DATA INTEGRITY CHECK SECTION (ADMIN ONLY) */}
      {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
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

      {/* MANUAL BACKUP & RESTORE SECTION (ADMIN ONLY) */}
      {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
          <div className="mb-8 glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-700 flex items-center">
                      <HardDrive className="w-5 h-5 mr-2 text-indigo-600" /> Sao Lưu & Khôi Phục Thủ Công
                  </h3>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm text-slate-600 mb-4">
                      Thao tác này cho phép bạn sao lưu dữ liệu hiện tại vào thư mục riêng (Mydata) hoặc khôi phục lại từ đó.
                      <br/>
                      <span className="text-xs text-slate-500 italic">Lưu ý: File backup được lưu tại E:\ServerData\Mydata\backup.json</span>
                  </p>
                  
                  <div className="flex gap-4">
                      <button 
                          onClick={handleManualBackup}
                          disabled={isBackingUp || isRestoring}
                          className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 shadow-sm flex items-center gap-2 disabled:opacity-50"
                      >
                          {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Sao Lưu (Backup)
                      </button>
                      
                      <button 
                          onClick={handleManualRestore}
                          disabled={isBackingUp || isRestoring}
                          className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 shadow-sm flex items-center gap-2 disabled:opacity-50"
                      >
                          {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Khôi Phục (Restore)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* User Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* User List */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-700 flex items-center">
                 <Users className="w-5 h-5 mr-2 text-blue-600" /> Danh Sách Tài Khoản
              </h3>
              <button onClick={handleAddUserClick} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center shadow-md transition-all">
                 <Plus className="w-4 h-4 mr-1" /> Thêm
              </button>
           </div>
           
           <div className="space-y-3">
              {users.map((user, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all group">
                    <div className="flex items-center space-x-3">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${user.role === 'Admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-400 to-teal-500'}`}>
                          {user.username.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <p className="font-bold text-slate-800">{user.username}</p>
                          <p className="text-xs text-slate-500 font-medium">{user.role}</p>
                       </div>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleEditUserClick(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                       <button onClick={() => handleDeleteUserClick(user.username)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                 </div>
              ))}
           </div>
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

                    const isStaff = isStaffUser(req.user);
                    const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isStaff ? true : lockCount === 0);
                    const showLockBadge = lockCount > 0 && !isStaff;

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
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 border border-white/50">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Sửa Tài Khoản' : 'Thêm Tài Khoản'}</h3>
                 <button onClick={() => setIsUserModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
              </div>
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên đăng nhập</label>
                    <input 
                       type="text" 
                       value={formUser.username} 
                       onChange={(e) => setFormUser({...formUser, username: e.target.value})}
                       className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                       disabled={!!editingUser}
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
                       <option value="Staff">Staff (Nhân viên)</option>
                       <option value="Docs">Docs (Chứng từ)</option>
                       <option value="Account">Account (Kế toán)</option>
                       <option value="Manager">Manager (Quản lý)</option>
                       <option value="Admin">Admin (Quản trị)</option>
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
    </div>
  );
};
