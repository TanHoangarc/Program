import React, { useState } from 'react';
import { Bell, Settings, User, LogOut, Menu, MessageSquare, Clock, FileSpreadsheet, Briefcase, Coins, TrendingUp } from 'lucide-react';
import { UserAccount, HeaderMessage, HeaderNotification } from '../types';
import { MONTHS, YEARS } from '../constants';

interface HeaderProps {
  currentUser: UserAccount | null;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  onNavigate?: (page: any) => void;
  messages?: HeaderMessage[];
  notifications?: HeaderNotification[];
  pendingPaymentCount?: number;
  onMarkNotificationsRead?: () => void;
  onExport?: () => void;
  onSyncBooking?: () => void;
  onSyncCvhc?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  onLogout, 
  onMobileMenuToggle,
  onNavigate,
  messages = [],
  notifications = [],
  pendingPaymentCount = 0,
  onMarkNotificationsRead,
  onExport,
  onSyncBooking,
  onSyncCvhc
}) => {
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showManagementDropdown, setShowManagementDropdown] = useState(false);

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${month} ${day} ${year}, ${hours}:${minutes}:${seconds}`;
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 shrink-0">
      {/* Left side: Mobile Menu Toggle */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Right side: Actions & User */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:flex items-center gap-1">
          {/* Message Icon */}
          <div className="relative">
            <button 
              onClick={() => setShowMessageDropdown(!showMessageDropdown)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all relative"
            >
              <MessageSquare className="w-5 h-5" />
              {pendingPaymentCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                  {pendingPaymentCount}
                </span>
              )}
            </button>

            {showMessageDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Tin nhắn (Chờ thanh toán)</h3>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{pendingPaymentCount}</span>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {messages.length > 0 ? (
                    messages.map(msg => (
                      <div key={msg.id} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{msg.carrier}</span>
                          <span className="text-[10px] font-bold text-slate-700">{msg.booking}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="text-slate-400 font-medium">[{formatTimestamp(msg.timestamp)}]</span> Create booking by <span className="font-bold text-slate-800">{msg.username}</span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Không có tin nhắn mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notification Icon */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotificationDropdown(!showNotificationDropdown);
                if (!showNotificationDropdown && onMarkNotificationsRead) {
                  onMarkNotificationsRead();
                }
              }}
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all relative"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotificationDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Thông báo (UNC)</h3>
                  <span className="text-[10px] bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full font-bold">{unreadNotificationsCount} mới</span>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div key={notif.id} className={`px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${!notif.isRead ? 'bg-teal-50/30' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded uppercase">BOOKING</span>
                          <span className="text-[10px] font-bold text-slate-700">{notif.booking}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="text-slate-400 font-medium">[{formatTimestamp(notif.timestamp)}]</span> Approve booking by <span className="font-bold text-slate-800">{notif.username}</span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Không có thông báo mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings Icon */}
          <div className="relative">
            <button 
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cài đặt hệ thống</h3>
                </div>
                <button 
                  onClick={() => { onExport?.(); setShowSettingsDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export file
                </button>
                <button 
                  onClick={() => { onSyncBooking?.(); setShowSettingsDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Clock className="w-4 h-4 text-blue-600" /> Đồng bộ Booking
                </button>
                <button 
                  onClick={() => { onSyncCvhc?.(); setShowSettingsDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Clock className="w-4 h-4 text-purple-600" /> Đồng bộ CVHC
                </button>
              </div>
            )}
          </div>

          {/* Management Icon */}
          <div className="relative">
            <button 
              onClick={() => setShowManagementDropdown(!showManagementDropdown)}
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
            >
              <Briefcase className="w-5 h-5" />
            </button>

            {showManagementDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quản lý</h3>
                </div>
                <button 
                  onClick={() => { onNavigate?.('salary'); setShowManagementDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Coins className="w-4 h-4 text-amber-500" /> Quản lý lương
                </button>
                <button 
                  onClick={() => { onNavigate?.('yearly-profit'); setShowManagementDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <TrendingUp className="w-4 h-4 text-teal-500" /> Profit năm
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-bold text-slate-800 leading-none">
              {currentUser?.username || 'Guest'}
            </span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1">
              {currentUser?.role || 'Visitor'}
            </span>
          </div>
          
          <div className="relative group">
            <button className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-teal-200/50 hover:scale-105 transition-transform">
              {currentUser?.username?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
            </button>
            
            {/* Dropdown Menu (Simplified) */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-4 py-2 border-b border-slate-50 sm:hidden">
                <p className="text-sm font-bold text-slate-800">{currentUser?.username}</p>
                <p className="text-[10px] text-slate-500 uppercase">{currentUser?.role}</p>
              </div>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <User className="w-4 h-4" /> Hồ sơ cá nhân
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Cài đặt
              </button>
              <div className="h-[1px] bg-slate-50 my-1"></div>
              <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
