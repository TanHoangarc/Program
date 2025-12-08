import React from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale, BadgeDollarSign, LogOut, Send, Search, Landmark, BookUp, FileCheck } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation' | 'lookup' | 'payment' | 'cvhc';
  onNavigate: (page: any) => void;
  onResetData: () => void;
  currentUser: { username: string, role: string } | null;
  onLogout: () => void;
  onSendPending: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, onResetData, currentUser, onLogout, onSendPending }) => {
  
  const role = currentUser?.role || 'Guest';
  const isAdminOrManager = role === 'Admin' || role === 'Manager';
  const isStaff = role === 'Staff';
  const isDocs = role === 'Docs';

  // Permission Logic
  const canViewOverview = isAdminOrManager;
  const canViewOperations = isAdminOrManager || isStaff;
  const canViewDataPayment = isAdminOrManager || isDocs;
  const canViewAccounting = isAdminOrManager;
  const canViewRecon = isAdminOrManager;
  const canViewData = isAdminOrManager || isStaff;
  const canViewSystem = isAdminOrManager;
  const canSendPending = isStaff || isAdminOrManager;

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
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`w-full flex items-center justify-between px-4 py-2.5 mb-1 rounded-xl transition-all duration-200 group relative ${
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
    <div className="w-64 h-[96vh] fixed left-4 top-[2vh] flex flex-col z-50 rounded-3xl shadow-2xl border border-white/10 bg-slate-900">
      {/* Dark Gradient Background with Border Radius to maintain shape */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-teal-900 z-0 rounded-3xl overflow-hidden pointer-events-none"></div>
      
      {/* Header */}
      <div className="relative z-10 px-6 py-6 border-b border-white/5">
         <div className="flex items-center space-x-3 text-white">
            <div className="p-2 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg shadow-lg">
               <Ship className="w-6 h-6 text-white" />
            </div>
            <div>
               <h1 className="font-bold text-lg leading-tight tracking-tight">KIMBERRY</h1>
               <p className="text-[10px] text-teal-200 uppercase tracking-widest opacity-80">Merchant Line</p>
            </div>
         </div>
      </div>

      {/* Menu */}
      <nav className="relative z-10 flex-1 px-4 space-y-1 overflow-visible pt-4 overflow-y-auto custom-scrollbar">
        
        {/* OVERVIEW SECTION (Admin/Manager Only) */}
        {canViewOverview && (
          <>
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng quan</div>
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
          </>
        )}

        {/* OPERATIONS SECTION (Admin/Manager/Staff) */}
        {canViewOperations && (
          <>
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Nghiệp vụ</div>
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
              <div className="hidden group-hover:block absolute left-[90%] top-0 pl-4 w-60 z-[60]">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-2 animate-in fade-in slide-in-from-left-2 duration-150">
                  <div onClick={() => onNavigate('deposit-line')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-colors mb-1 ${currentPage === 'deposit-line' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                    <Building2 className="w-4 h-4 text-purple-300" />
                    <span className="text-sm font-medium">Hãng Tàu</span>
                  </div>
                  <div onClick={() => onNavigate('deposit-customer')} className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${currentPage === 'deposit-customer' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
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
          </>
        )}

        {/* DATA AND PAYMENT SECTION (Admin/Manager/Docs) */}
        {canViewDataPayment && (
          <>
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Dữ liệu và thanh toán</div>
            <MenuItem 
              active={currentPage === 'lookup'}
              onClick={() => onNavigate('lookup')}
              icon={Search}
              label="Tra cứu"
            />
            <MenuItem 
              active={currentPage === 'payment'}
              onClick={() => onNavigate('payment')}
              icon={Landmark}
              label="Thanh Toán"
            />
            <MenuItem 
              active={currentPage === 'cvhc'}
              onClick={() => onNavigate('cvhc')}
              icon={FileCheck}
              label="Nộp CVHC"
            />
          </>
        )}

        {/* ACCOUNTING SECTION (Admin/Manager Only) */}
        {canViewAccounting && (
          <>
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Kế Toán</div>
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
          </>
        )}

        {/* CONFIG SECTION (Mixed Access) */}
        {(canViewRecon || canViewData || canViewSystem) && (
           <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Cấu hình</div>
        )}

        {canViewRecon && (
          <MenuItem 
            active={currentPage === 'reconciliation'}
            onClick={() => onNavigate('reconciliation')}
            icon={Scale}
            label="Đối Chiếu"
          />
        )}

        {canViewData && (
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
        )}

        {canViewSystem && (
          <MenuItem 
            active={currentPage === 'system'}
            onClick={() => onNavigate('system')}
            icon={Settings}
            label="Hệ Thống"
          />
        )}
      </nav>

      {/* Footer */}
      <div className="relative z-10 p-4 mt-auto border-t border-white/5 bg-black/20 space-y-3">
        {/* Send Pending Button - Visible for Staff/Manager */}
        {canSendPending && (
          <button
            onClick={(e) => { e.preventDefault(); onSendPending(); }}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2.5 px-3 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center space-x-2 group"
          >
            <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            <span className="text-xs uppercase tracking-wide">Gửi Dữ Liệu Duyệt</span>
          </button>
        )}

        {currentUser && (
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-blue-500 flex items-center justify-center shadow-lg border border-white/10">
                   <span className="text-xs font-bold text-white">{(currentUser.username || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div className="overflow-hidden">
                   <p className="text-xs font-bold text-slate-200 truncate max-w-[100px]">{currentUser.username}</p>
                   <p className="text-[10px] text-slate-500 font-medium">{currentUser.role}</p>
                </div>
             </div>
             <button onClick={(e) => { e.preventDefault(); onLogout(); }} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Đăng xuất">
                <LogOut className="w-4 h-4" />
             </button>
          </div>
        )}

        {isAdminOrManager && role === 'Admin' && (
          <button 
            onClick={(e) => { e.preventDefault(); onResetData(); }}
            className="w-full flex items-center justify-center space-x-2 text-red-400/70 hover:bg-red-500/10 hover:text-red-300 px-3 py-2 rounded-lg text-[10px] transition-all duration-200 group border border-dashed border-red-900/30"
          >
            <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
            <span>Reset Data Local</span>
          </button>
        )}
      </div>
    </div>
  );
};