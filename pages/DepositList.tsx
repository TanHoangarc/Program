import React, { useMemo, useState, useEffect } from 'react';
import { JobData, Customer } from '../types';
import { Search, ArrowRightLeft, Building2, UserCircle, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS } from '../constants';
import { formatDateVN, getPaginationRange } from '../utils';

interface DepositListProps {
  mode: 'line' | 'customer';
  jobs: JobData[];
  customers: Customer[];
}

export const DepositList: React.FC<DepositListProps> = ({ mode, jobs, customers }) => {
  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterEntity, setFilterEntity] = useState(''); // Stores Line Name or Customer ID
  const [filterMonth, setFilterMonth] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterEntity, filterMonth, mode]);

  // Derived Lists for Dropdowns
  const uniqueLines = useMemo(() => {
    const lines = new Set<string>();
    jobs.forEach(j => {
      if (j.line) lines.add(j.line);
    });
    return Array.from(lines);
  }, [jobs]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterEntity('');
    setFilterMonth('');
  };

  const hasActiveFilters = filterStatus !== 'all' || filterEntity !== '' || filterMonth !== '';

  // --- LOGIC FOR LINE DEPOSIT (HÃNG TÀU) ---
  // Aggregated by Booking
  const lineDeposits = useMemo(() => {
    if (mode !== 'line') return [];
    
    // Updated Logic: Use deposits from BookingCostDetails
    // Since BookingCostDetails.deposits is the source of truth for "Cược Hãng Tàu" now.
    
    // We need to iterate over all jobs, extract unique bookings, and get their deposits
    const processedBookings = new Set<string>();
    const depositsList: any[] = [];

    jobs.forEach(job => {
      if (job.booking && !processedBookings.has(job.booking)) {
        processedBookings.add(job.booking);
        
        const details = job.bookingCostDetails;
        if (details && details.deposits && details.deposits.length > 0) {
            // Aggregate all deposits for this booking
            let totalAmt = 0;
            let lastDateOut = '';
            let lastDateIn = '';

            details.deposits.forEach(d => {
                totalAmt += d.amount;
                if (d.dateOut) lastDateOut = d.dateOut;
                if (d.dateIn) lastDateIn = d.dateIn;
            });

            // Status Check
            let isPending = false;
            // If any deposit line item is missing dateIn, consider the booking deposit pending? 
            // Or use the last one? Let's assume if any amount is outstanding.
            // Simplified: If 'lastDateIn' is present, it's completed (based on previous logic), 
            // but strictly we should check if all items have dateIn.
            // For listing, let's stick to the aggregate display.
            const allCompleted = details.deposits.every(d => !!d.dateIn);

            const item = {
                month: job.month,
                booking: job.booking,
                line: job.line,
                amount: totalAmt,
                dateOut: lastDateOut,
                dateIn: allCompleted ? lastDateIn : '', // If not all completed, show as pending
                isCompleted: allCompleted
            };

            depositsList.push(item);
        }
      }
    });

    // Filter Logic
    let result = depositsList.filter(item => {
      const matchMonth = filterMonth ? item.month === filterMonth : true;
      const matchLine = filterEntity ? item.line === filterEntity : true;
      
      let matchStatus = true;
      if (filterStatus === 'pending') matchStatus = !item.isCompleted;
      if (filterStatus === 'completed') matchStatus = item.isCompleted;

      return matchMonth && matchLine && matchStatus;
    });

    return result.sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, mode, filterMonth, filterEntity, filterStatus]);

  // --- LOGIC FOR CUSTOMER DEPOSIT (KHÁCH HÀNG) ---
  // Individual Jobs
  const customerDeposits = useMemo(() => {
    if (mode !== 'customer') return [];
    
    let result = jobs.filter(job => job.thuCuoc > 0);

    // Filter Logic
    result = result.filter(job => {
      const matchMonth = filterMonth ? job.month === filterMonth : true;
      const matchCustomer = filterEntity ? job.maKhCuocId === filterEntity : true;
      
      let matchStatus = true;
      if (filterStatus === 'pending') matchStatus = !job.ngayThuHoan;
      if (filterStatus === 'completed') matchStatus = !!job.ngayThuHoan;

      return matchMonth && matchCustomer && matchStatus;
    });

    return result.map(job => {
        const customer = customers.find(c => c.id === job.maKhCuocId);
        return {
          id: job.id,
          month: job.month,
          jobCode: job.jobCode,
          customerCode: customer ? customer.code : 'N/A',
          customerName: customer ? customer.name : 'Unknown',
          amount: job.thuCuoc,
          dateIn: job.ngayThuCuoc, // Ngay thu cuoc
          dateOut: job.ngayThuHoan // Ngay tra hoan
        };
      })
      .sort((a, b) => Number(b.month) - Number(a.month));
  }, [jobs, customers, mode, filterMonth, filterEntity, filterStatus]);

  const currentList = mode === 'line' ? lineDeposits : customerDeposits;
  const totalAmount = currentList.reduce((sum, item) => sum + item.amount, 0);

  // Pagination Logic
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const paginatedList = currentList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
          {mode === 'line' ? (
             <div className="p-2 bg-red-100 text-red-600 rounded-lg">
               <Building2 className="w-6 h-6" />
             </div>
          ) : (
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
               <UserCircle className="w-6 h-6" />
             </div>
          )}
          <h1 className="text-3xl font-bold">
            {mode === 'line' ? 'Quản lý Cược Hãng Tàu' : 'Quản lý Cược Khách Hàng'}
          </h1>
        </div>
        <p className="text-slate-500 ml-11 mb-6">
          {mode === 'line' 
            ? 'Theo dõi tiền cược đã chi cho hãng tàu theo Booking' 
            : 'Theo dõi tiền cược đã thu từ khách hàng theo Job'}
        </p>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="flex items-center text-slate-500 font-medium">
              <Filter className="w-4 h-4 mr-2" />
              Bộ lọc:
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
               {/* Month Filter */}
               <select 
                 value={filterMonth} 
                 onChange={(e) => setFilterMonth(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               >
                 <option value="">Tất cả các tháng</option>
                 {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
               </select>

               {/* Entity Filter (Line or Customer) */}
               <select 
                 value={filterEntity} 
                 onChange={(e) => setFilterEntity(e.target.value)}
                 className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               >
                 <option value="">{mode === 'line' ? 'Tất cả Hãng Tàu' : 'Tất cả Khách Hàng'}</option>
                 {mode === 'line' 
                    ? uniqueLines.map(l => <option key={l} value={l}>{l}</option>)
                    : customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                 }
               </select>

               {/* Status Filter */}
               <select 
                 value={filterStatus} 
                 onChange={(e) => setFilterStatus(e.target.value as any)}
                 className={`w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium
                    ${filterStatus === 'pending' ? 'text-orange-600 bg-orange-50' : ''}
                    ${filterStatus === 'completed' ? 'text-green-600 bg-green-50' : ''}
                 `}
               >
                 <option value="all">Tất cả trạng thái</option>
                 <option value="pending">Chưa hoàn (Pending)</option>
                 <option value="completed">Đã hoàn (Completed)</option>
               </select>
            </div>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors flex items-center space-x-1" title="Xóa bộ lọc">
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">Xóa lọc</span>
              </button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Tháng</th>
                {mode === 'line' ? (
                  <>
                    <th className="px-6 py-4">Booking</th>
                    <th className="px-6 py-4">Line</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Job Code</th>
                    <th className="px-6 py-4">Mã KH</th>
                    <th className="px-6 py-4">Tên Khách Hàng</th>
                  </>
                )}
                <th className="px-6 py-4 text-right">Tiền Cược</th>
                <th className="px-6 py-4 text-center">Ngày Cược</th>
                <th className="px-6 py-4 text-center">Ngày Hoàn</th>
                <th className="px-6 py-4 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mode === 'line' ? (
                paginatedList.length > 0 ? (
                  paginatedList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">Tháng {item.month}</td>
                      <td className="px-6 py-4 text-blue-600 font-bold">{item.booking}</td>
                      <td className="px-6 py-4 text-slate-600">{item.line}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-600">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateOut)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateIn)}</td>
                      <td className="px-6 py-4 text-center">
                        {item.isCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Đã hoàn
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Chưa hoàn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Không có dữ liệu phù hợp</td></tr>
                )
              ) : (
                paginatedList.length > 0 ? (
                  paginatedList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">Tháng {item.month}</td>
                      <td className="px-6 py-4 text-blue-600 font-bold">{item.jobCode}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono">{item.customerCode}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-xs" title={item.customerName}>{item.customerName}</td>
                      <td className="px-6 py-4 text-right font-medium text-indigo-600">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateIn)}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(item.dateOut)}</td>
                      <td className="px-6 py-4 text-center">
                        {item.dateOut ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Đã hoàn
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Chưa hoàn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Không có dữ liệu phù hợp</td></tr>
                )
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-bold text-slate-700 uppercase text-xs">
              <tr>
                <td colSpan={mode === 'line' ? 3 : 4} className="px-6 py-4 text-right">Tổng Cộng (Tất cả kết quả lọc):</td>
                <td className="px-6 py-4 text-right text-base text-red-600">{formatCurrency(totalAmount)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-between items-center text-sm text-gray-600">
            <div>
              Trang {currentPage} / {totalPages} (Tổng {currentList.length} items)
            </div>
            <div className="flex space-x-2 items-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex space-x-1">
                 {paginationRange.map((page, idx) => (
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 py-1.5 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-1.5 rounded border text-xs font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                 ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
