
import React, { useMemo, useState } from 'react';
import { JobData, BookingCostDetails, BookingExtensionCost } from '../types';
import { FileText, Ship, X, Save, Plus, Trash2, AlertCircle, LayoutGrid } from 'lucide-react';

interface BookingListProps {
  jobs: JobData[];
  onEditJob: (job: JobData) => void;
}

interface BookingSummary {
  bookingId: string;
  month: string;
  line: string;
  jobCount: number;
  totalCost: number; // Chi Payment sum
  totalSell: number;
  totalProfit: number;
  totalCont20: number;
  totalCont40: number;
  jobs: JobData[];
  
  // Invoice Details
  costDetails: BookingCostDetails;
}

export const BookingList: React.FC<BookingListProps> = ({ jobs, onEditJob }) => {
  const [selectedBooking, setSelectedBooking] = useState<BookingSummary | null>(null);

  // Group jobs by Booking
  const bookingData = useMemo(() => {
    const groups: Record<string, BookingSummary> = {};

    jobs.forEach(job => {
      if (!job.booking) return;

      if (!groups[job.booking]) {
        // Initialize with data from the first job encountered
        groups[job.booking] = {
          bookingId: job.booking,
          month: job.month,
          line: job.line,
          jobCount: 0,
          totalCost: 0,
          totalSell: 0,
          totalProfit: 0,
          totalCont20: 0,
          totalCont40: 0,
          jobs: [],
          // Ensure we have a structure for cost details
          costDetails: job.bookingCostDetails || {
            localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0 },
            extensionCosts: []
          }
        };
      }

      const g = groups[job.booking];
      g.jobCount++;
      g.totalCost += job.chiPayment; // Sum of Chi Payment from jobs
      g.totalSell += job.sell;
      g.totalProfit += job.profit;
      g.totalCont20 += job.cont20;
      g.totalCont40 += job.cont40;
      g.jobs.push(job);
    });

    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [jobs]);

  const handleSaveDetails = (updatedDetails: BookingCostDetails) => {
    if (!selectedBooking) return;
    
    // We need to update ALL jobs in this booking with the new bookingCostDetails
    // to ensure synchronization.
    selectedBooking.jobs.forEach(job => {
        const updatedJob = { ...job, bookingCostDetails: updatedDetails };
        onEditJob(updatedJob);
    });

    // Update local state to reflect changes immediately
    setSelectedBooking(prev => prev ? { ...prev, costDetails: updatedDetails } : null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Quản lý Booking</h1>
        <p className="text-slate-500 mt-1">Danh sách tổng hợp Booking và chi tiết hóa đơn chi phí</p>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Tháng</th>
              <th className="px-6 py-4">Booking</th>
              <th className="px-6 py-4">Line</th>
              <th className="px-6 py-4 text-center">Số Job</th>
              <th className="px-6 py-4 text-right">Tổng Thu</th>
              <th className="px-6 py-4 text-right">Tổng Chi (Payment)</th>
              <th className="px-6 py-4 text-right">Profit</th>
              <th className="px-6 py-4 text-center">Cont 20'</th>
              <th className="px-6 py-4 text-center">Cont 40'</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookingData.map((booking) => (
              <tr 
                key={booking.bookingId} 
                onClick={() => setSelectedBooking(booking)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 font-medium text-slate-900">Tháng {booking.month}</td>
                <td className="px-6 py-4 text-blue-600 font-bold">{booking.bookingId}</td>
                <td className="px-6 py-4 text-slate-600">{booking.line}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{booking.jobCount}</span>
                </td>
                <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(booking.totalSell)}</td>
                <td className="px-6 py-4 text-right text-red-600 font-medium">{formatCurrency(booking.totalCost)}</td>
                <td className={`px-6 py-4 text-right font-bold ${booking.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(booking.totalProfit)}
                </td>
                <td className="px-6 py-4 text-center text-gray-500">{booking.totalCont20}</td>
                <td className="px-6 py-4 text-center text-gray-500">{booking.totalCont40}</td>
              </tr>
            ))}
            {bookingData.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">Không có dữ liệu booking</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)} 
          onSave={handleSaveDetails}
        />
      )}
    </div>
  );
};

// --- Sub-components for Modal ---

interface BookingDetailModalProps {
  booking: BookingSummary;
  onClose: () => void;
  onSave: (data: BookingCostDetails) => void;
}

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onSave }) => {
  const [localCharge, setLocalCharge] = useState(booking.costDetails.localCharge);
  const [extensionCosts, setExtensionCosts] = useState<BookingExtensionCost[]>(booking.costDetails.extensionCosts);

  // Calculations
  const totalExtensionRevenue = booking.jobs.reduce((sum, job) => 
    sum + job.extensions.reduce((s, ext) => s + ext.total, 0), 0
  );

  const totalExtensionCost = extensionCosts.reduce((sum, ext) => sum + ext.total, 0);

  // Totals for Summary Table
  const grandTotalRevenue = booking.totalSell + totalExtensionRevenue;
  const grandTotalExpense = booking.totalCost + totalExtensionCost;
  const grandTotalProfit = grandTotalRevenue - grandTotalExpense;

  // Sync helpers
  const handleLocalChargeChange = (field: keyof typeof localCharge, val: any) => {
    setLocalCharge(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'net' || field === 'vat') {
        updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
      }
      return updated;
    });
  };

  const handleAddExtensionCost = () => {
    setExtensionCosts(prev => [...prev, {
      id: Date.now().toString(),
      invoice: '',
      date: '',
      net: 0,
      vat: 0,
      total: 0
    }]);
  };

  const handleUpdateExtensionCost = (id: string, field: keyof BookingExtensionCost, val: any) => {
    setExtensionCosts(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: val };
        if (field === 'net' || field === 'vat') {
          updated.total = (Number(updated.net) || 0) + (Number(updated.vat) || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveExtensionCost = (id: string) => {
    setExtensionCosts(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = () => {
    onSave({
      localCharge,
      extensionCosts
    });
    onClose();
  };

  const getProjectCode = (job: JobData) => {
    let year = new Date().getFullYear();
    // Prioritize Invoice Date if available, else use current year
    if (job.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    const yearSuffix = year.toString().slice(-2);
    const monthPad = job.month.padStart(2, '0');
    return `K${yearSuffix}${monthPad}&${job.jobCode}`;
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chi tiết Booking: <span className="text-blue-600">{booking.bookingId}</span></h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Line: {booking.line} | Tháng: {booking.month}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6">
          
          {/* Section 1: Job List Table */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-600 uppercase mb-3 flex items-center">
              <Ship className="w-4 h-4 mr-2" /> Danh sách Job trong Booking
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b">
                    <th className="p-2 border-r">Job</th>
                    <th className="p-2 border-r">Khách hàng</th>
                    <th className="p-2 border-r text-right">Cost</th>
                    <th className="p-2 border-r text-right">VAT (5.263%)</th>
                    <th className="p-2 border-r text-right">Thu Gia Hạn</th>
                    <th className="p-2 text-center">Công trình</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {booking.jobs.map(job => {
                    const vatCalc = job.cost * 0.05263;
                    const extensionRev = job.extensions.reduce((s, e) => s + e.total, 0);
                    return (
                      <tr key={job.id} className="hover:bg-blue-50">
                        <td className="p-2 border-r font-medium text-blue-600">{job.jobCode}</td>
                        <td className="p-2 border-r">{job.customerName}</td>
                        <td className="p-2 border-r text-right font-medium">{formatMoney(job.cost)}</td>
                        <td className="p-2 border-r text-right text-slate-500">{formatMoney(vatCalc)}</td>
                        <td className="p-2 border-r text-right text-orange-600 font-medium">{extensionRev > 0 ? formatMoney(extensionRev) : '-'}</td>
                        <td className="p-2 text-center font-mono text-xs bg-gray-50 text-slate-600">
                          {getProjectCode(job)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Local Charge (Horizontal) */}
          <div className="bg-red-50/50 p-5 rounded-lg border border-red-100 shadow-sm">
             <div className="flex justify-between items-center mb-3">
                 <h3 className="text-sm font-bold text-red-700 uppercase">Local Charge (Hóa đơn Chi)</h3>
                 <div className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded">
                   Target (Tổng Chi Payment): {formatMoney(booking.totalCost)}
                 </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Số hóa đơn</label>
                  <input 
                    type="text" 
                    value={localCharge.invoice} 
                    onChange={(e) => handleLocalChargeChange('invoice', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-red-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ngày hóa đơn</label>
                  <input 
                    type="date" 
                    value={localCharge.date} 
                    onChange={(e) => handleLocalChargeChange('date', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-red-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Giá Net</label>
                  <input 
                    type="number" 
                    value={localCharge.net || ''} 
                    onChange={(e) => handleLocalChargeChange('net', Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded text-sm text-right bg-white focus:ring-2 focus:ring-red-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">VAT</label>
                  <input 
                    type="number" 
                    value={localCharge.vat || ''} 
                    onChange={(e) => handleLocalChargeChange('vat', Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded text-sm text-right bg-white focus:ring-2 focus:ring-red-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Tổng</label>
                  <input 
                    type="text" 
                    value={formatMoney(localCharge.total)} 
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded text-sm text-right bg-red-100 font-bold" 
                  />
                </div>
             </div>

             {/* Validation Message */}
             {localCharge.total !== booking.totalCost && (
               <div className="flex items-center space-x-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200 mt-2">
                 <AlertCircle className="w-4 h-4" />
                 <span>Lưu ý: Tổng hóa đơn ({formatMoney(localCharge.total)}) lệch với Tổng Chi Payment ({formatMoney(booking.totalCost)})</span>
               </div>
             )}
          </div>

          {/* Section 3: Extensions Cost (Horizontal Table) */}
          <div className="bg-orange-50/50 p-5 rounded-lg border border-orange-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
               <h3 className="text-sm font-bold text-orange-700 uppercase">Chi Phí Gia Hạn</h3>
               <button onClick={handleAddExtensionCost} className="text-xs bg-orange-200 text-orange-800 px-3 py-1.5 rounded hover:bg-orange-300 flex items-center transition-colors">
                  <Plus className="w-3 h-3 mr-1" /> Thêm HĐ
               </button>
            </div>

            <div className="overflow-x-auto bg-white rounded border border-orange-200">
               <table className="w-full text-sm text-left">
                  <thead className="bg-orange-100/50 text-orange-800 border-b border-orange-200">
                    <tr>
                      <th className="p-2 w-10"></th>
                      <th className="p-2">Số HĐ</th>
                      <th className="p-2">Ngày HĐ</th>
                      <th className="p-2 text-right">Net</th>
                      <th className="p-2 text-right">VAT</th>
                      <th className="p-2 text-right">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-100">
                    {extensionCosts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-400 py-4 text-xs italic">Chưa có hóa đơn chi gia hạn</td>
                      </tr>
                    ) : (
                      extensionCosts.map((ext) => (
                        <tr key={ext.id} className="hover:bg-orange-50/30 group">
                          <td className="p-2 text-center">
                            <button onClick={() => handleRemoveExtensionCost(ext.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={ext.invoice} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'invoice', e.target.value)}
                              className="w-full p-1 border border-gray-300 rounded text-xs focus:border-orange-500 outline-none"
                              placeholder="Số HĐ"
                            />
                          </td>
                          <td className="p-2">
                             <input 
                              type="date" 
                              value={ext.date} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'date', e.target.value)}
                              className="w-full p-1 border border-gray-300 rounded text-xs focus:border-orange-500 outline-none"
                            />
                          </td>
                          <td className="p-2">
                             <input 
                              type="number" 
                              value={ext.net || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'net', Number(e.target.value))}
                              className="w-full p-1 border border-gray-300 rounded text-xs text-right focus:border-orange-500 outline-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-2">
                             <input 
                              type="number" 
                              value={ext.vat || ''} 
                              onChange={(e) => handleUpdateExtensionCost(ext.id, 'vat', Number(e.target.value))}
                              className="w-full p-1 border border-gray-300 rounded text-xs text-right focus:border-orange-500 outline-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-orange-700">
                             {formatMoney(ext.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
            
            <div className="mt-2 text-right text-xs font-bold text-gray-600">
               Tổng Chi Gia Hạn: <span className="text-orange-700 text-sm ml-1">{formatMoney(totalExtensionCost)}</span>
            </div>
          </div>

          {/* Section 4: Summary Table */}
          <div className="bg-slate-800 text-white p-5 rounded-lg shadow-lg">
             <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center">
               <LayoutGrid className="w-4 h-4 mr-2" /> Tổng Hợp Booking
             </h3>
             <table className="w-full text-sm text-left">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="pb-2 text-center">Tổng Job</th>
                    <th className="pb-2 text-right">Tổng Thu (Sell + GH)</th>
                    <th className="pb-2 text-right">Tổng Chi (Payment + GH)</th>
                    <th className="pb-2 text-right">Tổng Profit</th>
                  </tr>
                </thead>
                <tbody className="text-lg font-bold">
                  <tr>
                    <td className="pt-2 text-center text-blue-300">{booking.jobs.length}</td>
                    <td className="pt-2 text-right text-green-400">{formatMoney(grandTotalRevenue)}</td>
                    <td className="pt-2 text-right text-red-400">{formatMoney(grandTotalExpense)}</td>
                    <td className={`pt-2 text-right ${grandTotalProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {formatMoney(grandTotalProfit)}
                    </td>
                  </tr>
                </tbody>
             </table>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition-colors">Đóng</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center shadow-lg transition-transform active:scale-95">
            <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
          </button>
        </div>
      </div>
    </div>
  );
};
