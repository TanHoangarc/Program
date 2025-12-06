
import React, { useState } from 'react';
import { JobData, Customer, ShippingLine, UserAccount } from '../types';
import { Settings, Users, Plus, Edit2, Trash2, X, Eye, EyeOff, FileInput, Check, UserCheck } from 'lucide-react';

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
  // New Props for Pending Requests
  pendingRequests?: any[];
  onApproveRequest?: (requestId: string, data: any) => void;
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

  const isAdmin = currentUser?.role === 'Admin';

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
        // Check duplicate
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
  const handleApprove = (req: any) => {
      if (window.confirm(`Duyệt dữ liệu từ ${req.user}?\n(Dữ liệu sẽ được gộp vào hệ thống)`)) {
          if (onApproveRequest) onApproveRequest(req.id, req);
      }
  };

  const handleReject = (id: string) => {
      if (window.confirm("Bạn có chắc muốn từ chối và xóa yêu cầu này?")) {
          if (onRejectRequest) onRejectRequest(id);
      }
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
             <Settings className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Quản Trị Hệ Thống</h1>
         </div>
         <p className="text-slate-500 ml-11">Đồng bộ dữ liệu và quản lý tài khoản</p>
      </div>

      {/* PENDING REQUESTS SECTION - ADMIN ONLY */}
      {isAdmin && (
        <div className="glass-panel p-6 rounded-2xl mb-8 border border-white/40">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <FileInput className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Duyệt Dữ Liệu Từ Nhân Viên</h2>
                        <p className="text-xs text-slate-500">Các yêu cầu gửi dữ liệu đang chờ duyệt</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold border border-orange-200">
                    {pendingRequests.length} Yêu cầu
                </div>
            </div>

            {pendingRequests.length > 0 ? (
                <div className="space-y-4">
                    {pendingRequests.map((req) => (
                        <div key={req.id} className="bg-white/60 p-4 rounded-xl border border-white/50 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                    {(req.user || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                        {req.user || 'Unknown'}
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-normal">
                                            {req.timestamp ? new Date(req.timestamp).toLocaleString('vi-VN') : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                        <span>Jobs: <strong>{(req.jobs || []).length}</strong></span>
                                        <span>|</span>
                                        <span>Customers: <strong>{(req.customers || []).length}</strong></span>
                                        <span>|</span>
                                        <span>Lines: <strong>{(req.lines || []).length}</strong></span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => handleReject(req.id)}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center"
                                >
                                    <X className="w-3.5 h-3.5 mr-1.5" /> Từ chối
                                </button>
                                <button 
                                    onClick={() => handleApprove(req)}
                                    className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 shadow-md hover:shadow-green-600/30 transition-all flex items-center"
                                >
                                    <Check className="w-3.5 h-3.5 mr-1.5" /> Duyệt & Gộp Dữ Liệu
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Không có yêu cầu nào đang chờ duyệt</p>
                </div>
            )}
        </div>
      )}

      {/* User Management Section - ADMIN ONLY */}
      {isAdmin && (
        <div className="glass-panel p-6 rounded-2xl mb-8 border border-white/40">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                        <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Quản Lý Tài Khoản</h2>
                </div>
                <button onClick={handleAddUserClick} className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-purple-700 transition-all">
                    <Plus className="w-4 h-4" /> <span>Thêm Tài Khoản</span>
                </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/30">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/40 text-slate-600 uppercase text-xs font-bold border-b border-white/30">
                        <tr>
                            <th className="px-6 py-3">Tên đăng nhập</th>
                            <th className="px-6 py-3">Mật khẩu</th>
                            <th className="px-6 py-3">Vai trò</th>
                            <th className="px-6 py-3 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/20">
                        {users.map((u, idx) => (
                            <tr key={idx} className="hover:bg-white/30 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-800">{u.username}</td>
                                <td className="px-6 py-3 text-slate-500 font-mono">******</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'Admin' ? 'bg-red-100 text-red-700' : u.role === 'Manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-center flex justify-center space-x-2">
                                    <button onClick={() => handleEditUserClick(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteUserClick(u.username)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6 border border-white/50">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Sửa Tài Khoản' : 'Thêm Tài Khoản'}</h3>
                      <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleSaveUser} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên đăng nhập</label>
                          <input 
                            type="text" 
                            value={formUser.username} 
                            onChange={e => setFormUser({...formUser, username: e.target.value})} 
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={!!editingUser}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu</label>
                          <div className="relative">
                            <input 
                                type={showPass ? "text" : "password"}
                                value={formUser.pass} 
                                onChange={e => setFormUser({...formUser, pass: e.target.value})} 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò</label>
                          <select 
                            value={formUser.role} 
                            onChange={e => setFormUser({...formUser, role: e.target.value as any})}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                          >
                              <option value="Staff">Staff</option>
                              <option value="Manager">Manager</option>
                              <option value="Admin">Admin</option>
                          </select>
                      </div>
                      <div className="pt-4 flex justify-end space-x-3">
                          <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200">Hủy</button>
                          <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 shadow-lg">Lưu</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
