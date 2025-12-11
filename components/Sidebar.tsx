import React, { useState } from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale, BadgeDollarSign, LogOut, Send, Search, Landmark, BookUp, FileCheck, ChevronDown } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation' | 'lookup' | 'payment' | 'cvhc';
  onNavigate: (page: any) => void;
  currentUser: { username: string, role: string } | null;
  onLogout: () => void;
  onSendPending: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentUser, onLogout, onSendPending }) => {
  
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
  
  // FIX: Chỉ Staff mới được gửi dữ liệu duyệt
  const canSendPending = isStaff;

  // State for Accordion Menus
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    deposit: false,
    amis: false,
    data: false
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const MenuItem = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    statusColor,
    hasSubmenu = false,
    isOpen = false
  }: { 
    active: boolean; 
    onClick: () => void; 
    icon: any; 
    label: string; 
    statusColor?: string; 
    hasSubmenu?: boolean;
    isOpen?: boolean;
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
      {hasSubmenu ? (
        isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
      ) : (
        active && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]"></div>
      )}
    </button>
  );

  const SubMenuItem = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
      <button
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-sm transition-colors mb-1 ${
            active ? 'text-teal-300 bg-white/5 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
          <Icon className={`w-4 h-4 ${active ? 'text-teal-300' : 'text-slate-500'}`} />
          <span>{label}</span>
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
      <nav className="relative z-10 flex-1 px-4 space-y-1 overflow-visible pt-4 overflow-y-auto custom-scrollbar pb-2">
        
        {/* OVERVIEW SECTION (Admin/Manager Only) */}
        {canViewOverview && (
          <>
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
            
            {/* Deposit Accordion */}
            <div>
               <MenuItem 
                active={['deposit-line', 'deposit-customer'].includes(currentPage)}
                onClick={() => toggleGroup('deposit')}
                icon={ArrowRightLeft}
                label="Quản lý Cược"
                statusColor="bg-purple-400"
                hasSubmenu={true}
                isOpen={openGroups.deposit}
              />
              {openGroups.deposit && (
                <div className="pl-6 pr-2 py-2 bg-black/20 rounded-xl mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                   <SubMenuItem 
                      active={currentPage === 'deposit-line'}
                      onClick={() => onNavigate('deposit-line')}
                      icon={Building2}
                      label="Hãng Tàu"
                   />
                   <SubMenuItem 
                      active={currentPage === 'deposit-customer'}
                      onClick={() => onNavigate('deposit-customer')}
                      icon={UserCircle}
                      label="Khách Hàng"
                   />
                </div>
              )}
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
            <div>
              <MenuItem 
                active={['amis-thu', 'amis-chi', 'amis-ban', 'amis-mua'].includes(currentPage)}
                onClick={() => toggleGroup('amis')}
                icon={FileUp}
                label="Kế Toán AMIS"
                hasSubmenu={true}
                isOpen={openGroups.amis}
              />
              {openGroups.amis && (
                <div className="pl-6 pr-2 py-2 bg-black/20 rounded-xl mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <SubMenuItem 
                    active={currentPage === 'amis-thu'}
                    onClick={() => onNavigate('amis-thu')}
                    icon={FileText}
                    label="Phiếu Thu"
                  />
                  <SubMenuItem 
                    active={currentPage === 'amis-chi'}
                    onClick={() => onNavigate('amis-chi')}
                    icon={CreditCard}
                    label="Phiếu Chi"
                  />
                  <SubMenuItem 
                    active={currentPage === 'amis-ban'}
                    onClick={() => onNavigate('amis-ban')}
                    icon={ShoppingCart}
                    label="Phiếu Bán Hàng"
                  />
                  <SubMenuItem 
                    active={currentPage === 'amis-mua'}
                    onClick={() => onNavigate('amis-mua')}
                    icon={Briefcase}
                    label="Phiếu Mua Hàng"
                  />
                </div>
              )}
            </div>
          </>
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
          <div>
            <MenuItem 
              active={['data-lines', 'data-customers'].includes(currentPage)}
              onClick={() => toggleGroup('data')}
              icon={Database}
              label="Danh Mục"
              hasSubmenu={true}
              isOpen={openGroups.data}
            />
            {openGroups.data && (
                <div className="pl-6 pr-2 py-2 bg-black/20 rounded-xl mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                   <SubMenuItem 
                      active={currentPage === 'data-lines'}
                      onClick={() => onNavigate('data-lines')}
                      icon={Ship}
                      label="Hãng Tàu"
                   />
                   <SubMenuItem 
                      active={currentPage === 'data-customers'}
                      onClick={() => onNavigate('data-customers')}
                      icon={UserCircle}
                      label="Khách Hàng"
                   />
                </div>
            )}
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
        {/* Send Pending Button - Visible ONLY for Staff */}
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
      </div>
    </div>
  );
};