import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, User, LogOut, Menu, MessageSquare, Clock, FileSpreadsheet, Briefcase, Coins, TrendingUp, RefreshCw, Wallet, Info } from 'lucide-react';
import { UserAccount, HeaderMessage, HeaderNotification, PaymentRequest } from '../types';
import { MONTHS, YEARS } from '../constants';

interface HeaderProps {
  currentUser: UserAccount | null;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  onNavigate?: (page: any) => void;
  messages?: HeaderMessage[];
  notifications?: HeaderNotification[];
  updates?: HeaderMessage[];
  pendingPayments?: PaymentRequest[];
  onMarkNotificationsRead?: () => void;
  onMarkMessagesRead?: () => void;
  onMarkUpdatesRead?: () => void;
  onExport?: () => void;
  onSyncBooking?: () => void;
  onSyncCvhc?: () => void;
  onAddOtherReceipt?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  onLogout, 
  onMobileMenuToggle,
  onNavigate,
  messages = [],
  notifications = [],
  updates = [],
  pendingPayments = [],
  onMarkNotificationsRead,
  onMarkMessagesRead,
  onMarkUpdatesRead,
  onExport,
  onSyncBooking,
  onSyncCvhc,
  onAddOtherReceipt
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;
  const unreadMessagesCount = messages.filter(m => !m.isRead).length;
  const unreadUpdatesCount = updates.filter(u => !u.isRead).length;

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const toggleDropdown = (name: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    
    if (activeDropdown === name) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(name);
      
      // Special action for notifications
      if (name === 'notifications' && onMarkNotificationsRead) {
        onMarkNotificationsRead();
      }
      if (name === 'messages' && onMarkMessagesRead) {
        onMarkMessagesRead();
      }
      if (name === 'updates' && onMarkUpdatesRead) {
        onMarkUpdatesRead();
      }

      closeTimer.current = setTimeout(() => {
        setActiveDropdown(null);
      }, 2000);
    }
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
          {currentUser?.role?.toLowerCase() !== 'docs' && (
            <div className="relative">
              <button 
                onClick={() => toggleDropdown('messages')}
                className={`p-2 rounded-lg transition-all relative ${activeDropdown === 'messages' ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                title="Yêu cầu thanh toán"
              >
                <MessageSquare className="w-5 h-5" />
                {pendingPayments.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                    {pendingPayments.length}
                  </span>
                )}
              </button>

              {activeDropdown === 'messages' && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800">Yêu cầu thanh toán</h3>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{pendingPayments.length} chờ duyệt</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {pendingPayments.length > 0 ? (
                      pendingPayments.map(payment => (
                        <div 
                          key={payment.id} 
                          className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors cursor-pointer"
                          onClick={() => {
                            onNavigate?.('payment');
                            setActiveDropdown(null);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{payment.type === 'advance' ? 'Tạm ứng' : payment.type === 'settlement' ? 'Quyết toán' : 'Khác'}</span>
                            <span className="text-[10px] font-bold text-slate-700">{payment.booking || payment.jobCode}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <span className="text-slate-400 font-medium">[{formatTimestamp(payment.requestDate)}]</span> Created by <span className="font-bold text-slate-800">{payment.requester}</span>
                          </p>
                          <p className="text-xs font-bold text-slate-800 mt-1">
                            {payment.amount.toLocaleString()} {payment.currency}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Không có yêu cầu thanh toán nào</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notification Icon */}
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('notifications')}
              className={`p-2 rounded-lg transition-all relative ${activeDropdown === 'notifications' ? 'text-teal-600 bg-teal-50' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50'}`}
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {activeDropdown === 'notifications' && (
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

          {/* Info/Updates Icon */}
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('updates')}
              className={`p-2 rounded-lg transition-all relative ${activeDropdown === 'updates' ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
            >
              <Info className="w-5 h-5" />
              {unreadUpdatesCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                  {unreadUpdatesCount}
                </span>
              )}
            </button>

            {activeDropdown === 'updates' && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Lịch sử cập nhật</h3>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{unreadUpdatesCount} mới</span>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {updates.length > 0 ? (
                    updates.map(update => (
                      <div key={update.id} className={`px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${!update.isRead ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{update.carrier}</span>
                          <span className="text-[10px] font-bold text-slate-700">{update.booking}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="text-slate-400 font-medium">[{formatTimestamp(update.timestamp)}]</span> {update.jobCode || 'Job/booking'} Updated by <span className="font-bold text-slate-800">{update.username}</span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Info className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Không có cập nhật mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {currentUser?.role?.toLowerCase() !== 'docs' && (
            <>
              {/* Settings Icon */}
              <div className="relative">
                <button 
                  onClick={() => toggleDropdown('settings')}
                  className={`p-2 rounded-lg transition-all ${activeDropdown === 'settings' ? 'text-teal-600 bg-teal-50' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50'}`}
                >
                  <Settings className="w-5 h-5" />
                </button>

                {activeDropdown === 'settings' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-slate-50">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cài đặt hệ thống</h3>
                    </div>
                    <button 
                      onClick={() => { onExport?.(); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export file
                    </button>
                    <button 
                      onClick={() => { onSyncBooking?.(); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-blue-600" /> Đồng bộ Booking
                    </button>
                    <button 
                      onClick={() => { onSyncCvhc?.(); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-purple-600" /> Đồng bộ CVHC
                    </button>
                    <button 
                      onClick={() => { onAddOtherReceipt?.(); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-indigo-600" /> Thu khác
                    </button>
                  </div>
                )}
              </div>

              {/* Management Icon */}
              <div className="relative">
                <button 
                  onClick={() => toggleDropdown('management')}
                  className={`p-2 rounded-lg transition-all ${activeDropdown === 'management' ? 'text-teal-600 bg-teal-50' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50'}`}
                >
                  <Briefcase className="w-5 h-5" />
                </button>

                {activeDropdown === 'management' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-slate-50">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quản lý</h3>
                    </div>
                    <button 
                      onClick={() => { onNavigate?.('salary'); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Coins className="w-4 h-4 text-amber-500" /> Quản lý lương
                    </button>
                    <button 
                      onClick={() => { onNavigate?.('yearly-profit'); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <TrendingUp className="w-4 h-4 text-teal-500" /> Profit năm
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
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
          
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('user')}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-teal-200/50 hover:scale-105 transition-transform"
            >
              {currentUser?.username?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
            </button>
            
            {activeDropdown === 'user' && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
