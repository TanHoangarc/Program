
import React, { useState } from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale, BadgeDollarSign, LogOut, Send, Search, Landmark, FileCheck, ChevronDown, X, Coins, Cpu, IdCard } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation' | 'lookup' | 'payment' | 'cvhc' | 'salary' | 'tool-ai' | 'nfc';
  onNavigate: (page: any) => void;
  currentUser: { username: string, role: string } | null;
  onLogout: () => void;
  onSendPending: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, onNavigate, currentUser, onLogout, onSendPending,
  isOpen, onClose 
}) => {
  
  const role = currentUser?.role || 'Guest';
  const isAdminOrManager = role === 'Admin' || role === 'Manager';
  const isStaff = role === 'Staff';
  const isDocs = role === 'Docs';
  const isAccount = role === 'Account';

  // Permission Logic
  const canViewOverview = isAdminOrManager; // Account excluded from overview
  const canViewOperations = isAdminOrManager || isStaff || isAccount; // Account can view Operations
  const canViewDataPayment = isAdminOrManager || isDocs || isAccount; // Account can view Payment/Lookup
  const canViewAccounting = isAdminOrManager || isAccount; // Account can view Amis
  const canViewRecon = isAdminOrManager; // Account excluded
  const canViewData = isAdminOrManager || isStaff || isAccount; // Account can view Data
  const canViewSystem = isAdminOrManager; // Account excluded
  const canViewToolAI = isAdminOrManager || isStaff || isAccount; // Account can view Tool AI
  
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

  const handleNavigate = (page: any) => {
    onNavigate(page);
    if (window.innerWidth < 768) {
      onClose();
    }
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
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed z-50 flex flex-col bg-slate-900 shadow-2xl border-r border-white/10 md:border md:border-white/10 transition-transform duration-300 ease-in-out
        w-64 h-full top-0 left-0 
        md:h-[96vh] md:top-[2vh] md:left-4 md:rounded-3xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Dark Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-teal-900 z-0 md:rounded-3xl overflow-hidden pointer-events-none"></div>
        
        {/* Header */}
        <div className="relative z-10 px-6 py-6 border-b border-white/5 flex justify-between items-center">
           <div className="flex items-center space-x-3 text-white">
              <div className="p-2 bg-gradient-to-tr from-teal-400 to-blue-500 rounded-lg shadow-lg">
                 <Ship className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h1 className="font-bold text-lg leading-tight tracking-tight">KIMBERRY</h1>
                 <p className="text-[10px] text-teal-200 uppercase tracking-widest opacity-80">Merchant Line</p>
              </div>
           </div>
           {/* Mobile Close Button */}
           <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Menu */}
        <nav className="relative z-10 flex-1 px-4 space-y-1 overflow-visible pt-4 overflow-y-auto custom-scrollbar pb-2">
          
          {/* OVERVIEW SECTION (Admin/Manager Only) */}
          {canViewOverview && (
            <>
              <MenuItem 
                active={currentPage === 'reports'}
                onClick={() => handleNavigate('reports')}
                icon={LayoutDashboard}
                label="Dashboard"
              />
              <MenuItem 
                active={currentPage === 'profit'}
                onClick={() => handleNavigate('profit')}
                icon={BadgeDollarSign}
                label="Lợi Nhuận"
              />
              <MenuItem 
                active={currentPage === 'salary'}
                onClick={() => handleNavigate('salary')}
                icon={Coins}
                label="Quản Lý Lương"
              />
              <MenuItem 
                active={currentPage === 'debt'}
                onClick={() => handleNavigate('debt')}
                icon={WalletCards}
                label="Công Nợ"
              />
            </>
          )}

          {/* OPERATIONS SECTION (Admin/Manager/Staff/Account) */}
          {canViewOperations && (
            <>
              <MenuItem 
                active={currentPage === 'entry'}
                onClick={() => handleNavigate('entry')}
                icon={FileInput}
                label="Nhập Job"
                statusColor="bg-teal-400"
              />
              <MenuItem 
                active={currentPage === 'booking'}
                onClick={() => handleNavigate('booking')}
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
                        onClick={() => handleNavigate('deposit-line')}
                        icon={Building2}
                        label="Hãng Tàu"
                     />
                     <SubMenuItem 
                        active={currentPage === 'deposit-customer'}
                        onClick={() => handleNavigate('deposit-customer')}
                        icon={UserCircle}
                        label="Khách Hàng"
                     />
                  </div>
                )}
              </div>

              {!isAccount && (
                <MenuItem 
                  active={currentPage === 'lhk'}
                  onClick={() => handleNavigate('lhk')}
                  icon={Briefcase}
                  label="LHK Jobs"
                />
              )}
            </>
          )}

          {/* DATA AND PAYMENT SECTION (Admin/Manager/Docs/Account) */}
          {canViewDataPayment && (
            <>
              <MenuItem 
                active={currentPage === 'lookup'}
                onClick={() => handleNavigate('lookup')}
                icon={Search}
                label="Tra cứu"
              />
              <MenuItem 
                active={currentPage === 'payment'}
                onClick={() => handleNavigate('payment')}
                icon={Landmark}
                label="Thanh Toán"
              />
              {!isAccount && (
                <MenuItem 
                  active={currentPage === 'cvhc'}
                  onClick={() => handleNavigate('cvhc')}
                  icon={FileCheck}
                  label="Nộp CVHC"
                />
              )}
            </>
          )}

          {/* ACCOUNTING SECTION (Admin/Manager/Account) */}
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
                      onClick={() => handleNavigate('amis-thu')}
                      icon={FileText}
                      label="Phiếu Thu"
                    />
                    <SubMenuItem 
                      active={currentPage === 'amis-chi'}
                      onClick={() => handleNavigate('amis-chi')}
                      icon={CreditCard}
                      label="Phiếu Chi"
                    />
                    <SubMenuItem 
                      active={currentPage === 'amis-ban'}
                      onClick={() => handleNavigate('amis-ban')}
                      icon={ShoppingCart}
                      label="Phiếu Bán Hàng"
                    />
                    <SubMenuItem 
                      active={currentPage === 'amis-mua'}
                      onClick={() => handleNavigate('amis-mua')}
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
              onClick={() => handleNavigate('reconciliation')}
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
                        onClick={() => handleNavigate('data-lines')}
                        icon={Ship}
                        label="Hãng Tàu"
                     />
                     <SubMenuItem 
                        active={currentPage === 'data-customers'}
                        onClick={() => handleNavigate('data-customers')}
                        icon={UserCircle}
                        label="Khách Hàng"
                     />
                  </div>
              )}
            </div>
          )}

          {canViewToolAI && (
            <>
              <MenuItem 
                active={currentPage === 'tool-ai'}
                onClick={() => handleNavigate('tool-ai')}
                icon={Cpu}
                label="Tool AI"
              />
              <MenuItem 
                active={currentPage === 'nfc'}
                onClick={() => handleNavigate('nfc')}
                icon={IdCard}
                label="NFC Cards"
              />
            </>
          )}

          {canViewSystem && (
            <MenuItem 
              active={currentPage === 'system'}
              onClick={() => handleNavigate('system')}
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
    </>
  );
};
