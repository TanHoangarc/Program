import React, { useMemo, useState } from 'react';
import { JobData, BookingSummary, BookingCostDetails } from '../types';
import { calculateBookingSummary, getPaginationRange } from '../utils';
import { Search, Filter, Save, Check, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, YEARS } from '../constants';

interface DemurrageListProps {
  jobs: JobData[];
  onEditJob: (job: JobData) => void;
}

export const DemurrageList: React.FC<DemurrageListProps> = ({ jobs, onEditJob }) => {
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // States for tracking unsaved edits
  const [edits, setEdits] = useState<Record<string, { manualDemurragePaid?: number, demurrageNote?: string }>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  const bookingData = useMemo(() => {
    let filteredJobs = jobs;
    if (filterYear) filteredJobs = filteredJobs.filter(j => Number(j.year) === Number(filterYear));
    if (filterMonth) filteredJobs = filteredJobs.filter(j => j.month === filterMonth);

    // Extract unique booking IDs
    const bookingIds = Array.from(new Set<string>(filteredJobs.map(j => j.booking).filter((b): b is string => !!b)));
    
    // Calculate summaries
    let summaries = bookingIds.map((id: string) => calculateBookingSummary(filteredJobs, id)).filter((b): b is BookingSummary => !!b);

    // Only include bookings with Demurrage (gia hạn)
    summaries = summaries.filter(booking => {
      const manualPaid = booking.costDetails?.manualDemurragePaid || 0;
      const extensionInvoiceTotal = (booking.costDetails?.extensionCosts || []).reduce((sum, e) => sum + (e.total || 0), 0);
      const revenueExtension = booking.jobs.reduce((sum, j) => sum + (j.extensions || []).reduce((s, e) => s + (e.total || 0), 0), 0);
      
      return manualPaid > 0 || extensionInvoiceTotal > 0 || revenueExtension > 0;
    });

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      summaries = summaries.filter(s => s.bookingId.toLowerCase().includes(lower));
    }

    return summaries.sort((a, b) => {
      const yearDiff = Number(b.year) - Number(a.year);
      if (yearDiff !== 0) return yearDiff;
      
      const monthDiff = Number(b.month) - Number(a.month);
      if (monthDiff !== 0) return monthDiff;

      const bookingA = String(a.bookingId || '').toLowerCase();
      const bookingB = String(b.bookingId || '').toLowerCase();
      return bookingA.localeCompare(bookingB);
    });
  }, [jobs, filterMonth, filterYear, searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterYear, searchTerm]);

  const totalPages = Math.ceil(bookingData.length / ITEMS_PER_PAGE);
  const paginatedData = bookingData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const handleEditChange = (bookingId: string, field: 'manualDemurragePaid' | 'demurrageNote', value: any) => {
    setEdits(prev => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {}),
        [field]: value
      }
    }));
    setSavedIds(prev => ({ ...prev, [bookingId]: false }));
  };

  const handleSave = (booking: BookingSummary) => {
    const editData = edits[booking.bookingId];
    if (!editData) return;

    const currentCostDetails: BookingCostDetails = booking.costDetails || {
      localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0 },
      extensionCosts: [],
      deposits: []
    };

    const updatedDetails: BookingCostDetails = {
      ...currentCostDetails,
      manualDemurragePaid: editData.manualDemurragePaid !== undefined ? editData.manualDemurragePaid : currentCostDetails.manualDemurragePaid,
      demurrageNote: editData.demurrageNote !== undefined ? editData.demurrageNote : currentCostDetails.demurrageNote
    };

    booking.jobs.forEach(job => {
      onEditJob({ ...job, bookingCostDetails: updatedDetails });
    });

    setSavedIds(prev => ({ ...prev, [booking.bookingId]: true }));
    setTimeout(() => {
      setSavedIds(prev => ({ ...prev, [booking.bookingId]: false }));
    }, 2000);
  };

  const calculateRowData = (booking: BookingSummary) => {
    const editData = edits[booking.bookingId] || {};
    
    // Chi gia hạn (nhập thủ công)
    const manualPaid = editData.manualDemurragePaid !== undefined 
      ? editData.manualDemurragePaid 
      : (booking.costDetails?.manualDemurragePaid || 0);
      
    // Ghi chú (nhập thủ công)
    const note = editData.demurrageNote !== undefined 
      ? editData.demurrageNote 
      : (booking.costDetails?.demurrageNote || '');

    // Hoá đơn gia hạn (Total)
    const extensionInvoiceTotal = (booking.costDetails?.extensionCosts || []).reduce((sum, e) => sum + (e.total || 0), 0);
    
    // Khoản dư = Chi gia hạn - Hoá đơn gia hạn
    const diffPaidAndInvoice = manualPaid - extensionInvoiceTotal;
    
    // Thu gia hạn (từ Job)
    const revenueExtension = booking.jobs.reduce((sum, j) => {
        return sum + (j.extensions || []).reduce((s, e) => s + (e.total || 0), 0);
    }, 0);
    
    // Lợi nhuận DEM = Thu gia hạn - Hoá đơn gia hạn
    const profitDem = revenueExtension - extensionInvoiceTotal;

    return {
      manualPaid,
      note,
      extensionInvoiceTotal,
      diffPaidAndInvoice,
      revenueExtension,
      profitDem,
      hasUnsavedChanges: !!editData && (editData.manualDemurragePaid !== undefined || editData.demurrageNote !== undefined),
      isSaved: savedIds[booking.bookingId]
    };
  };

  const totals = useMemo(() => {
    let sumManualPaid = 0;
    let sumExtInvoice = 0;
    let sumDiff = 0;
    let sumRevExt = 0;
    let sumProfit = 0;

    bookingData.forEach(booking => {
      const data = calculateRowData(booking);
      sumManualPaid += data.manualPaid;
      sumExtInvoice += data.extensionInvoiceTotal;
      sumDiff += data.diffPaidAndInvoice;
      sumRevExt += data.revenueExtension;
      sumProfit += data.profitDem;
    });

    return { sumManualPaid, sumExtInvoice, sumDiff, sumRevExt, sumProfit };
  }, [bookingData, edits]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
              <Database className="w-8 h-8 mr-3 text-orange-500" />
              Thống Kê Demurrage
            </h1>
            <p className="text-slate-500 text-sm mt-1">Quản lý chi và thu gia hạn theo Booking</p>
         </div>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
           <div className="relative flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm Booking..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
           </div>
           
           <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">Tất cả tháng</option>
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">Tất cả năm</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-center w-20">Tháng</th>
                <th className="px-4 py-3 font-semibold w-40">Booking</th>
                <th className="px-4 py-3 font-semibold text-right w-36 text-orange-600 bg-orange-50/50">Chi gia hạn</th>
                <th className="px-4 py-3 font-semibold text-right w-36">Hóa đơn</th>
                <th className="px-4 py-3 font-semibold text-right w-36">Khoản dư</th>
                <th className="px-4 py-3 font-semibold text-right w-36 text-blue-600 bg-blue-50/50">Thu KH</th>
                <th className="px-4 py-3 font-semibold text-right w-36 text-emerald-600">Lợi nhuận DEM</th>
                <th className="px-4 py-3 font-semibold">Ghi chú</th>
                <th className="px-4 py-3 font-semibold text-center w-16">Lưu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Không tìm thấy dữ liệu.
                  </td>
                </tr>
              ) : (
                paginatedData.map(booking => {
                  const data = calculateRowData(booking);
                  
                  return (
                    <tr key={booking.bookingId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-600">
                        {booking.month}/{booking.year}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {booking.bookingId}
                      </td>
                      <td className="px-4 py-3 bg-orange-50/30">
                        <input
                          type="text"
                          value={data.manualPaid === 0 ? '' : new Intl.NumberFormat('en-US').format(data.manualPaid)}
                          onChange={(e) => {
                            const val = Number(e.target.value.replace(/,/g, ''));
                            if (!isNaN(val)) {
                              handleEditChange(booking.bookingId, 'manualDemurragePaid', val);
                            }
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold text-orange-700 bg-white"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {new Intl.NumberFormat('en-US').format(data.extensionInvoiceTotal)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${data.diffPaidAndInvoice !== 0 ? (data.diffPaidAndInvoice > 0 ? 'text-red-600' : 'text-emerald-600') : 'text-slate-500'}`}>
                        {new Intl.NumberFormat('en-US').format(data.diffPaidAndInvoice)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700 bg-blue-50/30">
                        {new Intl.NumberFormat('en-US').format(data.revenueExtension)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${data.profitDem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {new Intl.NumberFormat('en-US').format(data.profitDem)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={data.note}
                          onChange={(e) => handleEditChange(booking.bookingId, 'demurrageNote', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white text-slate-700"
                          placeholder="Nhập ghi chú..."
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSave(booking)}
                          disabled={!data.hasUnsavedChanges && !data.isSaved}
                          className={`p-1.5 rounded-full transition-colors ${
                            data.isSaved 
                              ? 'bg-emerald-100 text-emerald-600' 
                              : data.hasUnsavedChanges 
                                ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                                : 'text-slate-300 bg-slate-100 cursor-not-allowed'
                          }`}
                          title={data.isSaved ? 'Đã lưu' : 'Lưu thay đổi'}
                        >
                          {data.isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {bookingData.length > 0 && (
              <tfoot className="bg-slate-100 font-bold text-slate-800">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right">Tổng cộng:</td>
                  <td className="px-4 py-3 text-right text-orange-700">{new Intl.NumberFormat('en-US').format(totals.sumManualPaid)}</td>
                  <td className="px-4 py-3 text-right">{new Intl.NumberFormat('en-US').format(totals.sumExtInvoice)}</td>
                  <td className={`px-4 py-3 text-right ${totals.sumDiff !== 0 ? (totals.sumDiff > 0 ? 'text-red-600' : 'text-emerald-600') : ''}`}>{new Intl.NumberFormat('en-US').format(totals.sumDiff)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{new Intl.NumberFormat('en-US').format(totals.sumRevExt)}</td>
                  <td className={`px-4 py-3 text-right ${totals.sumProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{new Intl.NumberFormat('en-US').format(totals.sumProfit)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-600">
          <div>Trang {currentPage} / {totalPages} (Tổng {bookingData.length} bookings)</div>
          <div className="flex space-x-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {paginationRange.map((page, index) => (
              page === '...' ? (
                <span key={`dots-${index}`} className="px-2 py-1.5 text-slate-400">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`px-3 py-1.5 rounded-lg border border-slate-300 font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              )
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
