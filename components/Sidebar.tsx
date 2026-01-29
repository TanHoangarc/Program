
import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale, BadgeDollarSign, LogOut, Send, Search, Landmark, FileCheck, ChevronDown, X, Coins, Cpu, IdCard, Sparkles, Zap } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'profit' | 'system' | 'reconciliation' | 'lookup' | 'payment' | 'cvhc' | 'salary' | 'tool-ai' | 'nfc' | 'bank-tcb' | 'bank-mb' | 'auto-payment' | 'auto-invoice';
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
  const canViewOverview = isAdminOrManager; 
  const canViewOperations = isAdminOrManager || isStaff || isAccount; 
  const canViewDataPayment = isAdminOrManager || isDocs || isAccount; 
  const canViewAccounting = isAdminOrManager || isAccount; 
  const canViewRecon = isAdminOrManager; 
  const canViewData = isAdminOrManager || isStaff || isAccount; 
  const canViewSystem = isAdminOrManager; 
  const canViewToolAI = isAdminOrManager || isStaff || isAccount || isDocs; 
  const canViewNfc = isAdminOrManager; 
  
  const canSendPending = isStaff;

  // State for Flyout Menu
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close menu on scroll to prevent misalignment
  useEffect(() => {
      const handleScroll = () => {
          if (activeGroup) setActiveGroup(null);
      };
      const navEl = navRef.current;
      if (navEl) navEl.addEventListener('scroll', handleScroll);
      return () => navEl?.removeEventListener('scroll', handleScroll);
  }, [activeGroup]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // If clicking inside the sidebar or the flyout menu, ignore
      // Note: We stop propagation on menu click, so this mainly catches outside clicks
      if (activeGroup) {
          setActiveGroup(null);
      }
    }
    // Use capture to catch clicks before they might be stopped elsewhere, or bubble is fine
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeGroup]);

  const handleGroupClick = (e: React.MouseEvent, group: string) => {
    e.stopPropagation(); // Prevent triggering document click listener immediately
    e.preventDefault();

    if (activeGroup === group) {
        setActiveGroup(null);
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    // Calculate position: Right of sidebar, aligned with item top
    setMenuStyle({
        top: rect.top,
        left: rect.right + 12, // 12px margin
        position: 'fixed'
    });
    setActiveGroup(group);
  };

  const handleNavigate = (page: any) => {
    onNavigate(page);
    setActiveGroup(null);
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
    onClick: (e: React.MouseEvent) => void; 
    icon: any; 
    label: string; 
    statusColor?: string; 
    hasSubmenu?: boolean;
    isOpen?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2.5 mb-1 rounded-xl transition-all duration-200 group relative ${
        active || isOpen
          ? 'bg-white/10 text-white shadow-sm border border-white/5'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="flex items-center space-x-3">
        {statusColor ? (
           <div className={`w-2 h-2 rounded-full ${statusColor} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}></div>
        ) : (
           <Icon className={`w-5 h-5 ${active || isOpen ? 'text-teal-300' : 'text-slate-400 group-hover:text-teal-200'}`} />
        )}
        <span className={`text-sm ${active || isOpen ? 'font-semibold tracking-wide' : 'font-medium'}`}>{label}</span>
      </div>
      {hasSubmenu ? (
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'text-white rotate-90' : ''}`} />
      ) : (
        active && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]"></div>
      )}
    </button>
  );

  const SubMenuItem = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
      <button
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
            active ? 'text-teal-300 bg-white/10 font-medium' : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`}
      >
          <Icon className={`w-4 h-4 ${active ? 'text-teal-300' : 'text-slate-500'}`} />
          <span>{label}</span>
      </button>
  );

  // --- FLOATING MENU RENDERER ---
  const renderFloatingMenu = () => {
      if (!activeGroup) return null;

      let content = null;

      switch (activeGroup) {
          case 'auto':
              content = (
                  <>
                      <SubMenuItem active={currentPage === 'auto-payment'} onClick={() => handleNavigate('auto-payment')} icon={Zap} label="Auto Payment" />
                      <SubMenuItem active={currentPage === 'auto-invoice'} onClick={() => handleNavigate('auto-invoice')} icon={FileInput} label="Auto Invoice" />
                  </>
              );
              break;
          case 'deposit':
              content = (
                  <>
                      <SubMenuItem active={currentPage === 'deposit-line'} onClick={() => handleNavigate('deposit-line')} icon={Building2} label="Hãng Tàu" />
                      <SubMenuItem active={currentPage === 'deposit-customer'} onClick={() => handleNavigate('deposit-customer')} icon={UserCircle} label="Khách Hàng" />
                  </>
              );
              break;
          case 'amis':
              content = (
                  <>
                      <SubMenuItem active={currentPage === 'amis-thu'} onClick={() => handleNavigate('amis-thu')} icon={FileText} label="Phiếu Thu" />
                      <SubMenuItem active={currentPage === 'amis-chi'} onClick={() => handleNavigate('amis-chi')} icon={CreditCard} label="Phiếu Chi" />
                      <SubMenuItem active={currentPage === 'amis-ban'} onClick={() => handleNavigate('amis-ban')} icon={ShoppingCart} label="Phiếu Bán Hàng" />
                      <SubMenuItem active={currentPage === 'amis-mua'} onClick={() => handleNavigate('amis-mua')} icon={Briefcase} label="Phiếu Mua Hàng" />
                  </>
              );
              break;
          case 'bank':
              content = (
                  <>
                      <SubMenuItem active={currentPage === 'bank-tcb'} onClick={() => handleNavigate('bank-tcb')} icon={Briefcase} label="Techcom Bank" />
                      <SubMenuItem active={currentPage === 'bank-mb'} onClick={() => handleNavigate('bank-mb')} icon={Coins} label="MB Bank" />
                  </>
              );
              break;
          case 'data':
              content = (
                  <>
                      <SubMenuItem active={currentPage === 'data-lines'} onClick={() => handleNavigate('data-lines')} icon={Ship} label="Hãng Tàu" />
                      <SubMenuItem active={currentPage === 'data-customers'} onClick={() => handleNavigate('data-customers')} icon={UserCircle} label="Khách Hàng" />
                  </>
              );
              break;
      }

      if (!content) return null;

      return (
          <div 
            className="fixed z-[60] w-56 bg-slate-800 rounded-xl shadow-2xl border border-white/10 p-2 animate-in fade-in slide-in-from-left-2 duration-200"
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
             {content}
          </div>
      );
  };

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
      <div 
        ref={sidebarRef}
        className={`
        fixed z-50 flex flex-col bg-slate-900 shadow-2xl border-r border-white/10 md:border md:border-white/10 transition-transform duration-300 ease-in-out
        w-64 h-full top-0 left-0 
        md:h-[96vh] md:top-[2vh] md:left-4 md:rounded-3xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Dark Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-teal-900 z-0 md:rounded-3xl overflow-hidden pointer-events-none"></div>
        
        {/* Header */}
        <div className="relative z-10 px-6 py-6 border-b border-white/5 flex justify-between items-center shrink-0">
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

        {/* Menu - SCROLLABLE AREA */}
        <nav 
            ref={navRef}
            className="relative z-10 flex-1 px-4 space-y-1 pt-4 pb-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent custom-scrollbar"
        >
          
          {/* OVERVIEW SECTION */}
          {canViewOverview && (
            <>
              <MenuItem active={currentPage === 'reports'} onClick={() => handleNavigate('reports')} icon={LayoutDashboard} label="Dashboard" />
              <MenuItem active={currentPage === 'profit'} onClick={() => handleNavigate('profit')} icon={BadgeDollarSign} label="Lợi Nhuận" />
              <MenuItem active={currentPage === 'salary'} onClick={() => handleNavigate('salary')} icon={Coins} label="Quản Lý Lương" />
              <MenuItem active={currentPage === 'debt'} onClick={() => handleNavigate('debt')} icon={WalletCards} label="Công Nợ" />
              
              <MenuItem 
                  active={['auto-payment', 'auto-invoice'].includes(currentPage)}
                  onClick={(e) => handleGroupClick(e, 'auto')}
                  icon={Sparkles}
                  label="Công Cụ Tự Động"
                  hasSubmenu={true}
                  isOpen={activeGroup === 'auto'}
              />
            </>
          )}

          {/* OPERATIONS SECTION */}
          {canViewOperations && (
            <>
              <MenuItem active={currentPage === 'entry'} onClick={() => handleNavigate('entry')} icon={FileInput} label="Nhập Job" statusColor="bg-teal-400" />
              <MenuItem active={currentPage === 'booking'} onClick={() => handleNavigate('booking')} icon={Container} label="Booking" statusColor="bg-blue-400" />
              
              <MenuItem 
                  active={['deposit-line', 'deposit-customer'].includes(currentPage)}
                  onClick={(e) => handleGroupClick(e, 'deposit')}
                  icon={ArrowRightLeft}
                  label="Quản lý Cược"
                  statusColor="bg-purple-400"
                  hasSubmenu={true}
                  isOpen={activeGroup === 'deposit'}
              />

              {!isAccount && (
                <MenuItem active={currentPage === 'lhk'} onClick={() => handleNavigate('lhk')} icon={Briefcase} label="LHK Jobs" />
              )}
            </>
          )}

          {/* DATA AND PAYMENT SECTION */}
          {canViewDataPayment && (
            <>
              <MenuItem active={currentPage === 'lookup'} onClick={() => handleNavigate('lookup')} icon={Search} label="Tra cứu" />
              <MenuItem active={currentPage === 'payment'} onClick={() => handleNavigate('payment')} icon={Landmark} label="Thanh Toán" />
              {!isAccount && (
                <MenuItem active={currentPage === 'cvhc'} onClick={() => handleNavigate('cvhc')} icon={FileCheck} label="Nộp CVHC" />
              )}
            </>
          )}

          {/* ACCOUNTING SECTION */}
          {canViewAccounting && (
            <>
              <MenuItem 
                  active={['amis-thu', 'amis-chi', 'amis-ban', 'amis-mua'].includes(currentPage)}
                  onClick={(e) => handleGroupClick(e, 'amis')}
                  icon={FileUp}
                  label="Kế Toán AMIS"
                  hasSubmenu={true}
                  isOpen={activeGroup === 'amis'}
              />
              <MenuItem 
                  active={['bank-tcb', 'bank-mb'].includes(currentPage)}
                  onClick={(e) => handleGroupClick(e, 'bank')}
                  icon={Landmark}
                  label="Ngân hàng"
                  hasSubmenu={true}
                  isOpen={activeGroup === 'bank'}
              />
            </>
          )}

          {canViewRecon && (
            <MenuItem active={currentPage === 'reconciliation'} onClick={() => handleNavigate('reconciliation')} icon={Scale} label="Đối Chiếu" />
          )}

          {canViewData && (
            <MenuItem 
                active={['data-lines', 'data-customers'].includes(currentPage)}
                onClick={(e) => handleGroupClick(e, 'data')}
                icon={Database}
                label="Danh Mục"
                hasSubmenu={true}
                isOpen={activeGroup === 'data'}
            />
          )}

          {canViewToolAI && (
            <MenuItem active={currentPage === 'tool-ai'} onClick={() => handleNavigate('tool-ai')} icon={Cpu} label="Tool AI" />
          )}

          {canViewNfc && (
            <MenuItem active={currentPage === 'nfc'} onClick={() => handleNavigate('nfc')} icon={IdCard} label="NFC Cards" />
          )}

          {canViewSystem && (
            <MenuItem active={currentPage === 'system'} onClick={() => handleNavigate('system')} icon={Settings} label="Hệ Thống" />
          )}
        </nav>

        {/* Footer */}
        <div className="relative z-10 p-4 mt-auto border-t border-white/5 bg-black/20 space-y-3 shrink-0">
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

      {/* Render Floating Menu Outside the Sidebar structure to avoid clipping */}
      {renderFloatingMenu()}
    </>
  );
};
