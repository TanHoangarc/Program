import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Settings, User, LogOut, Menu, MessageSquare, Clock, FileSpreadsheet, Briefcase, Coins, TrendingUp, RefreshCw, Wallet, Info, FileUp, Key, Users, Camera, Upload, X, Check, Shield } from 'lucide-react';
import { UserAccount, HeaderMessage, HeaderNotification, PaymentRequest } from '../types';
import { MONTHS, YEARS } from '../constants';
import { getUserAvatar, setUserAvatar, getRoleBadge, PRESET_AVATARS, registerUserHeartbeat, getOnlineUsers, subscribeToOnlineUsers, OnlineUser } from '../utils/userAvatar';

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
  onSyncFileName?: () => void;
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
  onSyncFileName,
  onAddOtherReceipt
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const [avatarVersion, setAvatarVersion] = useState(0);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar = useMemo(() => {
    return getUserAvatar(currentUser);
  }, [currentUser, avatarVersion]);

  // Real-time cross-device heartbeat & presence sync
  useEffect(() => {
    if (!currentUser) return;
    registerUserHeartbeat(currentUser);

    const interval = setInterval(() => {
      registerUserHeartbeat(currentUser);
    }, 15000);

    const unsubscribe = subscribeToOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    const handleAvatarChange = () => {
      setAvatarVersion(v => v + 1);
    };
    window.addEventListener('kb_avatar_changed', handleAvatarChange);

    return () => {
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener('kb_avatar_changed', handleAvatarChange);
    };
  }, [currentUser]);

  const handleUploadAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.username) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Vui lòng chọn ảnh nhỏ hơn 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setUserAvatar(currentUser.username, result);
        setAvatarVersion(v => v + 1);
        setIsAvatarModalOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (url: string) => {
    if (!currentUser?.username) return;
    setUserAvatar(currentUser.username, url);
    setAvatarVersion(v => v + 1);
    setIsAvatarModalOpen(false);
  };

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

      // Start the auto-close timer
      closeTimer.current = setTimeout(() => {
        setActiveDropdown(null);
      }, 2000);
    }
  };

  const handleMouseEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (activeDropdown) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
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
                <div 
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800">Tin nhắn</h3>
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
                            Created by Document <span className="font-bold text-slate-800">{payment.requester}</span> - <span className="font-bold text-slate-800">{payment.amount.toLocaleString()} {payment.currency}</span>
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
              <div 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
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
              <div 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Thông tin</h3>
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
                  <div 
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                  >
                    <div className="px-4 py-2 border-b border-slate-50">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cài đặt hệ thống</h3>
                    </div>
                    <button 
                      onClick={() => { onNavigate?.('api-keys'); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium text-amber-700"
                    >
                      <Key className="w-4 h-4 text-amber-500" /> Quản lý Key API
                    </button>
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
                      onClick={() => { onSyncFileName?.(); setActiveDropdown(null); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <FileUp className="w-4 h-4 text-emerald-600" /> Đồng bộ tên file
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
                  <div 
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                  >
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

        {/* Online Users Pill - Hiển thị ai đang vào web */}
        <div className="relative hidden md:block">
          <button
            onClick={() => toggleDropdown('online_users')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border transition-all ${
              activeDropdown === 'online_users'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Xem danh sách người dùng đang vào web"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold whitespace-nowrap">
              {onlineUsers.length > 0 ? onlineUsers.length : 1} đang vào web
            </span>
            <div className="flex -space-x-1.5 overflow-hidden">
              {(onlineUsers.length > 0 ? onlineUsers : [
                { username: currentUser?.username || 'Bạn', role: currentUser?.role || 'User', avatar: currentAvatar, lastSeen: Date.now() }
              ]).slice(0, 3).map((ou, idx) => (
                <img
                  key={`${ou.username}-${idx}`}
                  src={ou.avatar || currentAvatar}
                  alt={ou.username}
                  className="inline-block h-5 w-5 rounded-full ring-2 ring-white object-cover"
                />
              ))}
            </div>
          </button>

          {activeDropdown === 'online_users' && (
            <div 
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2"
            >
              <div className="px-4 pb-2.5 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    Người dùng đang vào web
                  </h3>
                  <p className="text-[11px] text-slate-500">Các tài khoản đang truy cập hệ thống</p>
                </div>
                <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  {onlineUsers.length > 0 ? onlineUsers.length : 1} online
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {(onlineUsers.length > 0 ? onlineUsers : [
                  { username: currentUser?.username || 'Bạn', role: currentUser?.role || 'User', avatar: currentAvatar, lastSeen: Date.now(), loginTime: 'Hiện tại' }
                ]).map((u, i) => {
                  const isMe = u.username === currentUser?.username;
                  const badge = getRoleBadge(u.role);
                  return (
                    <div
                      key={`${u.username}-${i}`}
                      className={`p-2.5 rounded-xl flex items-center justify-between transition-colors ${
                        isMe ? 'bg-teal-50/60 border border-teal-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={u.avatar || getUserAvatar({ username: u.username, role: u.role as any, pass: '' })}
                            alt={u.username}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/40"
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800">{u.username}</span>
                            {isMe && (
                              <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.2 rounded font-semibold">Bạn</span>
                            )}
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          Online
                        </span>
                        {u.loginTime && (
                          <span className="text-[10px] text-slate-400 block">{u.loginTime}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

        {/* Current User Profile & Avatar */}
        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-bold text-slate-800 leading-none">
              {currentUser?.username || 'Guest'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getRoleBadge(currentUser?.role).badgeClass}`}>
                {getRoleBadge(currentUser?.role).label}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Online
              </span>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => toggleDropdown('user')}
              className="w-10 h-10 rounded-full relative p-0.5 ring-2 ring-teal-500/40 hover:ring-teal-600 transition-all shadow-md overflow-hidden bg-white hover:scale-105"
              title={`Đang đăng nhập: ${currentUser?.username || 'Guest'}`}
            >
              <img
                src={currentAvatar}
                alt={currentUser?.username || 'User Avatar'}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </button>
            
            {activeDropdown === 'user' && (
              <div 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2"
              >
                {/* Profile Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={currentAvatar}
                      alt={currentUser?.username}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-teal-500/40 shadow-sm"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getRoleBadge(currentUser?.role).badgeClass}`}>
                        {getRoleBadge(currentUser?.role).label}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    </div>
                  </div>
                </div>

                {/* Change Avatar Button */}
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={() => {
                      setIsAvatarModalOpen(true);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-600" /> Đổi ảnh đại diện (Avatar)
                  </button>
                </div>

                <div className="py-1">
                  <button 
                    onClick={() => {
                      toggleDropdown('online_users');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-500" /> Ai đang vào web ({onlineUsers.length || 1})
                  </button>
                  <button 
                    onClick={() => { onNavigate?.('api-keys'); setActiveDropdown(null); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" /> Quản lý Key API
                  </button>
                </div>

                <div className="h-[1px] bg-slate-100 my-1"></div>
                <div className="px-2">
                  <button 
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Change Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">Chọn ảnh đại diện cho tài khoản</h3>
              </div>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Current avatar preview */}
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <img
                  src={currentAvatar}
                  alt={currentUser?.username}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-teal-500/30 shadow-md"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">{currentUser?.username}</p>
                  <p className="text-xs text-slate-500">Ảnh đại diện hiện tại trên header</p>
                </div>
              </div>

              {/* Upload photo from device */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Tải ảnh từ máy tính / điện thoại
                </label>
                <input
                  type="file"
                  ref={avatarFileInputRef}
                  onChange={handleUploadAvatarFile}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl border border-teal-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Tải ảnh mới lên (JPG, PNG, WebP)
                </button>
              </div>

              {/* Preset avatars */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Hoặc chọn avatar mẫu chuyên nghiệp
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PRESET_AVATARS.map((preset) => {
                    const isSelected = currentAvatar === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAvatar(preset.url)}
                        className={`relative rounded-2xl p-1.5 border-2 transition-all flex flex-col items-center gap-1.5 group cursor-pointer ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/50 shadow-md'
                            : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        <span className="text-[10px] font-semibold text-slate-700 text-center truncate w-full">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1 right-1 w-4 h-4 bg-teal-600 text-white rounded-full flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
