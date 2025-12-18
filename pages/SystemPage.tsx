

import React, { useState, useEffect } from 'react';
import { JobData, Customer, ShippingLine, UserAccount } from '../types';
import { Settings, Users, Plus, Edit2, Trash2, X, Eye, EyeOff, FileInput, Check, UserCheck, Clock, FileText, AlertTriangle, CreditCard, Lock, List, Receipt } from 'lucide-react';

interface SystemPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  users: UserAccount[];
  currentUser: { username: string, role: string } | null;
  // Fix: Added users property to the onRestore data object to match usage in App.tsx
  onRestore: (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[], users?: UserAccount[] }) => void;
  onAddUser: (user: UserAccount) => void;
  onEditUser: (user: UserAccount, originalUsername: string) => void;
  onDeleteUser: (username: string) => void;
  pendingRequests?: any[];
  onApproveRequest?: (requestId: string, data: any, silent?: boolean) => void;
  onRejectRequest?: (requestId: string) => void;
}

export const SystemPage: React.FC<SystemPageProps> = ({ 
  jobs, customers, lines, users, currentUser, 
  onRestore, onAddUser, onEditUser, onDeleteUser,
  pendingRequests = [], onApproveRequest, onRejectRequest
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formUser, setFormUser] = useState<UserAccount>({ username: '', pass: '', role: 'Staff' });
  const [showPass, setShowPass] = useState(false);

  // Helper to check if a user is Staff
  const isStaffUser = (username?: string) => {
      if (!username) return false;
      const u = users.find(user => user.username === username);
      return u?.role === 'Staff';
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

        // Logic: Staff doesn't have lock permission. 
        // If sender is Staff, we ignore `lockCount` (treat it as noise/snapshot).
        // If sender is Admin/Manager, `lockCount` > 0 contributes to content.
        const isStaff = isStaffUser(req.user);
        
        // If Staff: Empty if everything else is 0 (ignore locks)
        // If Not Staff: Empty if everything (including locks) is 0
        const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isStaff ? true : lockCount === 0);

        if (isEmpty) {
           console.log("Auto-rejecting empty packet:", req.id);
           onRejectRequest(req.id);
        }
      });
    }
  }, [pendingRequests, onRejectRequest, onApproveRequest, users]);

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
                    
                    // Empty check logic (ignoring locks for Staff)
                    const isEmpty = jobCount === 0 && custCount === 0 && lineCount === 0 && paymentCount === 0 && receiptCount === 0 && (isStaff ? true : lockCount === 0);

                    // Badge display logic: Only show lock count if NOT Staff
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
