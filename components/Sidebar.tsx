
import React from 'react';
import { LayoutDashboard, FileInput, Ship, Settings, Container, ArrowRightLeft, Building2, UserCircle, Briefcase, FileUp, FileText, CreditCard, ShoppingCart, Database } from 'lucide-react';

interface SidebarProps {
  currentPage: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers';
  onNavigate: (page: 'entry' | 'reports' | 'booking' | 'deposit-line' | 'deposit-customer' | 'lhk' | 'amis-thu' | 'amis-chi' | 'amis-ban' | 'amis-mua' | 'data-lines' | 'data-customers') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col shadow-xl z-50">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-700">
        <Ship className="w-8 h-8 text-blue-400" />
        <span className="text-xl font-bold tracking-wide">LogiSoft</span>
      </div>

      {/* Changed overflow-y-auto to overflow-visible to allow flyout menus */}
      <nav className="flex-1 py-6 px-3 space-y-2 overflow-visible">
        <button
          onClick={() => onNavigate('entry')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
            currentPage === 'entry'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileInput className="w-5 h-5" />
          <span className="font-medium">Nhập Job</span>
        </button>

        <button
          onClick={() => onNavigate('booking')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
            currentPage === 'booking'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Container className="w-5 h-5" />
          <span className="font-medium">Booking</span>
        </button>

        {/* Deposit Menu with Hover Effect */}
        <div className="relative group">
          <button
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
              currentPage === 'deposit-line' || currentPage === 'deposit-customer'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-5 h-5" />
            <span className="font-medium">Cược (Deposit)</span>
          </button>
          
          {/* Submenu Dropdown on Hover */}
          <div className="hidden group-hover:block absolute left-full top-0 pl-2 w-56 z-50">
            <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              <div 
                onClick={() => onNavigate('deposit-line')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'deposit-line' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-medium">Cược Hãng Tàu</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div 
                onClick={() => onNavigate('deposit-customer')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'deposit-customer' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <UserCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cược Khách Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('lhk')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
            currentPage === 'lhk'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="font-medium">LHK</span>
        </button>

        {/* Amis Export Menu */}
        <div className="relative group">
          <button
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
              ['amis-thu', 'amis-chi', 'amis-ban', 'amis-mua'].includes(currentPage)
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileUp className="w-5 h-5" />
            <span className="font-medium">Xuất Amis</span>
          </button>
          
          {/* Submenu Dropdown on Hover */}
          <div className="hidden group-hover:block absolute left-full top-0 pl-2 w-56 z-50">
            <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              <div 
                onClick={() => onNavigate('amis-thu')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'amis-thu' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Phiếu Thu</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div 
                onClick={() => onNavigate('amis-chi')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'amis-chi' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Phiếu Chi</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div 
                onClick={() => onNavigate('amis-ban')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'amis-ban' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="text-sm font-medium">Phiếu Bán Hàng</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div 
                onClick={() => onNavigate('amis-mua')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'amis-mua' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span className="text-sm font-medium">Phiếu Mua Hàng</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Management Menu */}
        <div className="relative group">
          <button
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
              ['data-lines', 'data-customers'].includes(currentPage)
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="font-medium">Data</span>
          </button>
          
          {/* Submenu Dropdown on Hover */}
          <div className="hidden group-hover:block absolute left-full top-0 pl-2 w-56 z-50">
            <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              <div 
                onClick={() => onNavigate('data-lines')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'data-lines' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Ship className="w-4 h-4" />
                <span className="text-sm font-medium">Hãng Tàu</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div 
                onClick={() => onNavigate('data-customers')}
                className={`flex items-center space-x-3 px-4 py-3 cursor-pointer transition-colors ${
                  currentPage === 'data-customers' ? 'bg-blue-900 text-blue-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <UserCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Khách Hàng</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('reports')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
            currentPage === 'reports'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Báo Cáo</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-3 text-slate-400 hover:text-white cursor-pointer px-4 py-2">
          <Settings className="w-5 h-5" />
          <span>Cài đặt</span>
        </div>
        <div className="mt-4 text-xs text-slate-500 text-center">
          v1.5.0
        </div>
      </div>
    </div>
  );
};
