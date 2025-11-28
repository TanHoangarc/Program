import React from 'react';
import { LayoutDashboard, FileInput, Ship, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database, RotateCcw, ChevronRight, WalletCards, Settings, Scale } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'system' | 'reconciliation';
  onNavigate: (page: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers' | 'debt' | 'system' | 'reconciliation') => void;
  onResetData: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, onResetData }) => {
  
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
      className={`w-full flex items-center justify-between px-4 py-3 border-l-4 transition-all duration-200 group relative ${
        active
          ? 'bg-blue-50 border-brand-DEFAULT text-brand-DEFAULT'
          : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center space-x-3">
        {statusColor ? (
           <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
        ) : (
           <Icon className={`w-4 h-4 ${active ? 'text-brand-DEFAULT' : 'text-gray-400 group-hover:text-gray-600'}`} />
        )}
        <span className={`text-sm font-medium ${active ? 'font-semibold' : ''}`}>{label}</span>
      </div>
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );

  return (
    <div className="w-64 bg-white h-[calc(100vh-64px)] fixed left-0 top-16 flex flex-col border-r border-gray-200 z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      
      <div className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
        Main Menu
      </div>

      <nav className="flex-1 overflow-visible space-y-1">
        
        <MenuItem 
          active={currentPage === 'entry'}
          onClick={() => onNavigate('entry')}
          icon={FileInput}
          label="Nhập Job"
          statusColor="bg-red-500"
        />

        <MenuItem 
          active={currentPage === 'booking'}
          onClick={() => onNavigate('booking')}
          icon={Container}
          label="Booking"
          statusColor="bg-orange-400"
        />

        {/* Deposit Menu Group */}
        <div className="relative group">
           <MenuItem 
            active={['deposit-line', 'deposit-customer'].includes(currentPage)}
            onClick={() => {}} // Hover only
            icon={ArrowRightLeft}
            label="Cược (Deposit)"
            statusColor="bg-green-500"
          />
          
          {/* Submenu */}
          <div className="hidden group-hover:block absolute left-full top-0 pl-1 w-56 z-50">
            <div className="bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden py-1">
              <div 
                onClick={() => onNavigate('deposit-line')}
                className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'deposit-line' ? 'text-brand-DEFAULT font-bold' : 'text-gray-600'}`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Cược Hãng Tàu</span>
              </div>
              <div 
                onClick={() => onNavigate('deposit-customer')}
                className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'deposit-customer' ? 'text-brand-DEFAULT font-bold' : 'text-gray-600'}`}
              >
                <UserCircle className="w-4 h-4" />
                <span className="text-sm">Cược Khách Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <MenuItem 
          active={currentPage === 'lhk'}
          onClick={() => onNavigate('lhk')}
          icon={Briefcase}
          label="LHK Jobs"
          statusColor="bg-blue-400"
        />

        {/* Amis Menu Group */}
        <div className="relative group">
          <MenuItem 
            active={['amis-thu', 'amis-chi', 'amis-ban', 'amis-mua'].includes(currentPage)}
            onClick={() => {}} // Hover
            icon={FileUp}
            label="Xuất Amis"
          />
          <div className="hidden group-hover:block absolute left-full top-0 pl-1 w-56 z-50">
            <div className="bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden py-1">
              <div onClick={() => onNavigate('amis-thu')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'amis-thu' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <FileText className="w-4 h-4" /><span className="text-sm">Phiếu Thu</span>
              </div>
              <div onClick={() => onNavigate('amis-chi')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'amis-chi' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <CreditCard className="w-4 h-4" /><span className="text-sm">Phiếu Chi</span>
              </div>
              <div onClick={() => onNavigate('amis-ban')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'amis-ban' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <ShoppingCart className="w-4 h-4" /><span className="text-sm">Phiếu Bán Hàng</span>
              </div>
              <div onClick={() => onNavigate('amis-mua')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'amis-mua' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <Briefcase className="w-4 h-4" /><span className="text-sm">Phiếu Mua Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <MenuItem 
          active={currentPage === 'reconciliation'}
          onClick={() => onNavigate('reconciliation')}
          icon={Scale}
          label="Đối Chiếu"
        />

        {/* Data Menu Group */}
        <div className="relative group">
          <MenuItem 
            active={['data-lines', 'data-customers'].includes(currentPage)}
            onClick={() => {}} 
            icon={Database}
            label="Data Master"
          />
          <div className="hidden group-hover:block absolute left-full top-0 pl-1 w-56 z-50">
             <div className="bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden py-1">
               <div onClick={() => onNavigate('data-lines')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'data-lines' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <Ship className="w-4 h-4" /><span className="text-sm">Hãng Tàu</span>
              </div>
              <div onClick={() => onNavigate('data-customers')} className={`flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${currentPage === 'data-customers' ? 'text-brand-DEFAULT' : 'text-gray-600'}`}>
                <UserCircle className="w-4 h-4" /><span className="text-sm">Khách Hàng</span>
              </div>
             </div>
          </div>
        </div>

        <div className="border-t border-gray-100 my-2 pt-2">
          <MenuItem 
            active={currentPage === 'debt'}
            onClick={() => onNavigate('debt')}
            icon={WalletCards}
            label="Công Nợ"
          />
          <MenuItem 
            active={currentPage === 'reports'}
            onClick={() => onNavigate('reports')}
            icon={LayoutDashboard}
            label="Báo Cáo"
          />
          <MenuItem 
            active={currentPage === 'system'}
            onClick={() => onNavigate('system')}
            icon={Settings}
            label="Hệ Thống"
          />
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50 mt-auto">
        <button 
          onClick={onResetData}
          className="w-full flex items-center justify-center space-x-2 text-red-500 hover:bg-red-50 hover:text-red-600 px-3 py-2 rounded text-xs transition-all border border-transparent hover:border-red-100"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Data</span>
        </button>
        <div className="mt-2 text-[10px] text-gray-400 text-center">
          Logistics System v2.1
        </div>
      </div>
    </div>
  );
};