
import React, { useRef, useState } from 'react';
import { JobData, Customer, ShippingLine, UserAccount } from '../types';
import { Settings, Download, Upload, AlertTriangle, ShieldCheck, Users, Plus, Edit2, Trash2, X, Save, Eye, EyeOff } from 'lucide-react';

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
}

export const SystemPage: React.FC<SystemPageProps> = ({ 
  jobs, customers, lines, users, currentUser, 
  onRestore, onAddUser, onEditUser, onDeleteUser 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formUser, setFormUser] = useState<UserAccount>({ username: '', pass: '', role: 'Staff' });
  const [showPass, setShowPass] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  // --- BACKUP ---
const handleBackup = async () => {
  const data = {
    timestamp: new Date().toISOString(),
    version: "2.1",
    jobs,
    customers,
    lines,
  };

  try {
    const res = await fetch("https://api.kimberry.id.vn/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    alert("Đã lưu dữ liệu vào máy chủ (Ổ E): " + result.message);
  } catch (err) {
    alert("Không thể kết nối máy chủ để sao lưu.");
    console.error(err);
  }
};

  // --- RESTORE ---
  const handleRestoreClick = () => {
    if (window.confirm('CẢNH BÁO: Việc khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại (Job, Khách hàng, Line) bằng dữ liệu trong file.\n\nBạn có chắc chắn muốn tiếp tục?')) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Simple validation
        if (!json.jobs || !Array.isArray(json.jobs)) throw new Error('File không hợp lệ: Thiếu dữ liệu Job');
        
        onRestore({
          jobs: json.jobs,
          customers: json.customers || [],
          lines: json.lines || []
        });

        alert(`Khôi phục thành công!\n- ${json.jobs.length} Jobs\n- ${json.customers?.length || 0} Khách hàng\n- ${json.lines?.length || 0} Hãng tàu`);
      } catch (err) {
        alert('Lỗi: File backup không hợp lệ hoặc bị hỏng.');
        console.error(err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
             <Settings className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Quản Trị Hệ Thống</h1>
         </div>
         <p className="text-slate-500 ml-11">Sao lưu, đồng bộ dữ liệu và quản lý tài khoản</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* Backup Card */}
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center hover:border-blue-300 transition-colors">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-md">
            <Download className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Sao Lưu Dữ Liệu</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-xs">
            Tải xuống toàn bộ dữ liệu hiện tại (Job, Khách hàng, Hãng tàu) dưới dạng file .JSON để lưu trữ.
          </p>
          <button 
            onClick={handleBackup}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all flex items-center transform active:scale-95"
          >
            <Download className="w-5 h-5 mr-2" />
            Tải Xuống File Backup
          </button>
        </div>

        {/* Restore Card */}
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center hover:border-orange-300 transition-colors">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6 shadow-md">
            <Upload className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Khôi Phục Dữ Liệu</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-xs">
            Khôi phục dữ liệu từ file Backup (.JSON). Dữ liệu hiện tại sẽ bị ghi đè.
          </p>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden" 
          />
          
          <button 
            onClick={handleRestoreClick}
            className="px-6 py-3 bg-white border border-orange-200 text-orange-700 font-medium rounded-xl shadow-sm hover:bg-orange-50 transition-all flex items-center"
          >
            <Upload className="w-5 h-5 mr-2" />
            Chọn File Khôi Phục
          </button>
        </div>
      </div>

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

      {/* Footer Info */}
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 flex items-start space-x-3">
         <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
         <div>
            <h4 className="font-bold text-blue-900 text-sm">Cơ chế hoạt động</h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Trang web hoạt động không cần máy chủ (Serverless), dữ liệu được lưu trực tiếp trên trình duyệt của bạn. 
              Để sử dụng dữ liệu trên máy tính khác, hãy sử dụng tính năng <strong>Sao Lưu</strong> để lấy file về, 
              sau đó gửi file sang máy mới và dùng tính năng <strong>Khôi Phục</strong> để nạp dữ liệu.
            </p>
         </div>
      </div>

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
