
import React from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale, BadgeDollarSign, LogOut } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation';
  onNavigate: (page: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation') => void;
  onResetData: () => void;
  currentUser: { username: string, role: string } | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, onResetData, currentUser, onLogout }) => {
  
  const MenuItem = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    statusColor 
  }: { 
    active: boolean; 
    onClick: () => void; 
    icon: any; 
    label: string; 
    statusColor?: string; 
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 mb-1 rounded-xl transition-all duration-200 group relative ${
        active
          ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/10'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <div className="flex items-center space-x-3">
        {statusColor ? (
           <div className={`w-2 h-2 rounded-full ${statusColor} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}></div>
        ) : (
           <Icon className={`w-5 h-5 ${active ? 'text-teal-300' : 'text-slate-400 group-hover:text-teal-200'}`} />
        )}
        <span className={`text-sm ${active ? 'font-semibold tracking-wide' : 'font-medium'}`}>{label}</span>
      </div>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]"></div>}
    </button>
  );

  return (
    // Changed: Removed overflow-hidden from container to allow popups to show
    <div className="w-64 h-[96vh] fixed left-4 top-[2vh] flex flex-col z-50 rounded-3xl shadow-2xl border border-white/10 bg-slate-900">
      {/* Dark Gradient Background with Border Radius to maintain shape */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-teal-900 z-0 rounded-3xl overflow-hidden pointer-events-none"></div>
      
      {/* Header */}
      <div className="relative z-10 px-6 py-8">
         <div className="flex items-center space-x-3 text-white mb-1">
            <div className="p-2 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg shadow-lg">
               <Ship className="w-6 h-6 text-white" />
            </div>
            <div>
               <h1 className="font-bold text-lg leading-tight tracking-tight">KIMBERRY</h1>
               <p className="text-[10px] text-teal-200 uppercase tracking-widest opacity-80">Merchant Line</p>
            </div>
         </div>
      </div>

      {/* Menu - Removed overflow-y-auto to prevent clipping of submenus */}
      <nav className="relative z-10 flex-1 px-4 space-y-1 overflow-visible">
        <div className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng quan</div>
        
        <MenuItem 
          active={currentPage === 'reports'}
          onClick={() => onNavigate('reports')}
          icon={LayoutDashboard}
          label="Dashboard"
        />
        <MenuItem 
          active={currentPage === 'profit'}
          onClick={() => onNavigate('profit')}
          icon={BadgeDollarSign}
          label="Lợi Nhuận"
        />
        <MenuItem 
          active={currentPage === 'debt'}
          onClick={() => onNavigate('debt')}
          icon={WalletCards}
          label="Công Nợ"
        />

        <div className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Nghiệp vụ</div>

        <MenuItem 
          active={currentPage === 'entry'}
          onClick={() => onNavigate('entry')}
          icon={FileInput}
          label="Nhập Job"
          statusColor="bg-teal-400"
        />

        <MenuItem 
          active={currentPage === 'booking'}
          onClick={() => onNavigate('booking')}
          icon={Container}
          label="Booking"
          statusColor="bg-blue-400"
        />

        {/* Deposit Group */}
        <div className="relative group">
           <MenuItem 
            active={['deposit-line', 'deposit-customer'].includes(currentPage)}
            onClick={() => {}} // Hover only
            icon={ArrowRightLeft}
            label="Quản lý Cược"
            statusColor="bg-purple-400"
          />
          {/* Enhanced Submenu Styling */}
          <div className="hidden group-hover:block absolute left-[90%] top-0 pl-4 w-60 z-[60]">
            <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-2 animate-in fade-in slide-in-from-left-2 duration-150">
              <div 
                onClick={() => onNavigate('deposit-line')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-colors mb-1 ${currentPage === 'deposit-line' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <Building2 className="w-4 h-4 text-purple-300" />
                <span className="text-sm font-medium">Hãng Tàu</span>
              </div>
              <div 
                onClick={() => onNavigate('deposit-customer')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${currentPage === 'deposit-customer' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <UserCircle className="w-4 h-4 text-purple-300" />
                <span className="text-sm font-medium">Khách Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <MenuItem 
          active={currentPage === 'lhk'}
          onClick={() => onNavigate('lhk')}
          icon={Briefcase}
          label="LHK Jobs"
        />

        {/* Amis Group */}
        <div className="relative group">
          <MenuItem 
            active={['amis-thu', 'amis-chi', 'amis-ban', 'amis-mua'].includes(currentPage)}
            onClick={() => {}} // Hover
            icon={FileUp}
            label="Kế Toán AMIS"
          />
          <div className="hidden group-hover:block absolute left-[90%] top-0 pl-4 w-60 z-[60]">
            <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-2 animate-in fade-in slide-in-from-left-2 duration-150">
              <div onClick={() => onNavigate('amis-thu')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white mb-1 ${currentPage === 'amis-thu' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <FileText className="w-4 h-4 text-teal-300" /><span className="text-sm font-medium">Phiếu Thu</span>
              </div>
              <div onClick={() => onNavigate('amis-chi')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white mb-1 ${currentPage === 'amis-chi' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <CreditCard className="w-4 h-4 text-red-300" /><span className="text-sm font-medium">Phiếu Chi</span>
              </div>
              <div onClick={() => onNavigate('amis-ban')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white mb-1 ${currentPage === 'amis-ban' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <ShoppingCart className="w-4 h-4 text-purple-300" /><span className="text-sm font-medium">Phiếu Bán Hàng</span>
              </div>
              <div onClick={() => onNavigate('amis-mua')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white ${currentPage === 'amis-mua' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <Briefcase className="w-4 h-4 text-orange-300" /><span className="text-sm font-medium">Phiếu Mua Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Cấu hình</div>

        <MenuItem 
          active={currentPage === 'reconciliation'}
          onClick={() => onNavigate('reconciliation')}
          icon={Scale}
          label="Đối Chiếu"
        />

        <div className="relative group">
          <MenuItem 
            active={['data-lines', 'data-customers'].includes(currentPage)}
            onClick={() => {}} 
            icon={Database}
            label="Danh Mục"
          />
          <div className="hidden group-hover:block absolute left-[90%] bottom-0 pl-4 w-60 z-[60]">
             <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-2 animate-in fade-in slide-in-from-left-2 duration-150">
               <div onClick={() => onNavigate('data-lines')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white mb-1 ${currentPage === 'data-lines' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <Ship className="w-4 h-4 text-blue-300" /><span className="text-sm font-medium">Hãng Tàu</span>
              </div>
              <div onClick={() => onNavigate('data-customers')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 hover:text-white ${currentPage === 'data-customers' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
                <UserCircle className="w-4 h-4 text-green-300" /><span className="text-sm font-medium">Khách Hàng</span>
              </div>
             </div>
          </div>
        </div>

        <MenuItem 
          active={currentPage === 'system'}
          onClick={() => onNavigate('system')}
          icon={Settings}
          label="Hệ Thống"
        />
      </nav>

      {/* Footer */}
      <div className="relative z-10 p-4 mt-auto border-t border-white/5 bg-black/20 space-y-3">
        {currentUser && (
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-blue-500 flex items-center justify-center shadow-lg">
                   <span className="text-xs font-bold text-white">{currentUser.username.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-200">{currentUser.username}</p>
                   <p className="text-[10px] text-slate-500">{currentUser.role}</p>
                </div>
             </div>
             <button onClick={onLogout} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Đăng xuất">
                <LogOut className="w-4 h-4" />
             </button>
          </div>
        )}

        <button 
          onClick={onResetData}
          className="w-full flex items-center justify-center space-x-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 py-2 rounded-lg text-xs transition-all duration-200 group border border-dashed border-red-900/30"
        >
          <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
          <span>Reset Data</span>
        </button>
      </div>
    </div>
  );
};
