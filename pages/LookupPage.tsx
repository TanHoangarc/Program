
import React, { useState, useMemo } from 'react';
import { JobData, Customer } from '../types';
import { Search, CheckCircle, AlertCircle, Calendar, DollarSign, Wallet, RefreshCw, FileText, AlertTriangle, ListFilter, Building2, Filter, ArrowRight, Layers } from 'lucide-react';
import { formatDateVN, calculatePaymentStatus } from '../utils';

interface LookupPageProps {
  jobs: JobData[];
  customReceipts?: any[];
  customers?: Customer[];
}

type TabMode = 'search' | 'list';
type EntityFilter = 'KIMBERRY' | 'LONGHOANG';

export const LookupPage: React.FC<LookupPageProps> = ({ jobs, customReceipts = [], customers = [] }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('search');
  
  // Search State
  const [searchCode, setSearchCode] = useState('');
  const [result, setResult] = useState<JobData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // List State
  const [fromDate, setFromDate] = useState(new Date().getFullYear() + '-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEntity, setSelectedEntity] = useState<EntityFilter>('KIMBERRY');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;

    const normalizedSearch = searchCode.toLowerCase().trim();
    const found = jobs.find(j => j.jobCode.toLowerCase().trim() === normalizedSearch);
    
    setResult(found || null);
    setHasSearched(true);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const extensionTotal = result ? (result.extensions || []).reduce((sum, ext) => sum + ext.total, 0) : 0;
  const isTCB = result?.bank?.includes('TCB');
  const isLcPaid = (result && result.bank && result.localChargeDate) || (result && isTCB);
  const paymentStatus = result ? calculatePaymentStatus(result, jobs, customReceipts) : null;
  
  const paidExtensions = useMemo(() => {
      if (!result || !result.extensions) return [];
      return result.extensions
        .filter(e => e.amisDocNo)
        .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());
  }, [result]);

  const isExtPaid = paidExtensions.length > 0;

  // --- LIST GENERATION LOGIC ---
  const paymentList = useMemo(() => {
      if (activeTab !== 'list') return [];

      const list: any[] = [];
      const from = new Date(fromDate).getTime();
      const to = new Date(toDate).getTime();

      const isInRange = (dateStr?: string) => {
          if (!dateStr) return false;
          const d = new Date(dateStr).getTime();
          return d >= from && d <= to;
      };

      if (selectedEntity === 'KIMBERRY') {
          // --- 1. HANDLE AUTO-PAYMENT RECEIPTS (Custom Receipts with jobCodes) ---
          const coveredJobIds = new Set<string>();
          
          customReceipts.forEach(r => {
              // Check if it's an Auto Tool Receipt (has jobCodes array)
              if (r.jobCodes && Array.isArray(r.jobCodes) && r.jobCodes.length > 0) {
                  
                  // EXCLUDE 'other' type (Thu Khác) - belong to Long Hoang
                  if (r.type === 'other') return;

                  if (isInRange(r.date)) {
                      let typeLabel = 'Local Charge';
                      if (r.type === 'deposit') typeLabel = 'Deposit';
                      else if (r.type === 'extension') typeLabel = 'Gia Hạn';

                      list.push({
                          date: r.date,
                          customer: r.objName || 'Khách Hàng',
                          bill: r.invoice || r.docNo || `Phiếu thu tổng`,
                          amount: r.amount,
                          type: typeLabel,
                          jobCode: r.jobCodes.join(', '),
                          isMerged: true
                      });
                  }
                  
                  // Mark these jobs as "covered" so we don't list them individually
                  r.jobCodes.forEach((code: string) => {
                      const matchingJobs = jobs.filter(j => String(j.jobCode).trim().toLowerCase() === String(code).trim().toLowerCase());
                      matchingJobs.forEach(j => coveredJobIds.add(j.id));
                  });
              }
          });

          // --- 2. HANDLE MANUAL GROUPING (By DocNo) ---
          const lcGroups = new Map<string, any>();
          const depositGroups = new Map<string, any>();

          jobs.forEach(j => {
              if (coveredJobIds.has(j.id)) return;

              // Local Charge
              if (j.localChargeTotal > 0 && isInRange(j.localChargeDate)) {
                  const docNo = j.amisLcDocNo;
                  if (docNo) {
                      if (!lcGroups.has(docNo)) {
                          lcGroups.set(docNo, {
                              date: j.localChargeDate,
                              customer: j.customerName,
                              bill: j.localChargeInvoice || `BL ${j.jobCode}`,
                              amount: 0,
                              type: 'Local Charge',
                              jobCodes: [],
                              docNo: docNo
                          });
                      }
                      const group = lcGroups.get(docNo);
                      group.amount += j.localChargeTotal;
                      group.jobCodes.push(j.jobCode);
                      if (j.localChargeInvoice && j.localChargeInvoice.includes('+')) group.bill = j.localChargeInvoice;
                  } else {
                      list.push({
                          date: j.localChargeDate,
                          customer: j.customerName,
                          bill: j.localChargeInvoice || `BL ${j.jobCode}`,
                          amount: j.localChargeTotal,
                          type: 'Local Charge',
                          jobCode: j.jobCode
                      });
                  }
              }

              // Deposit
              if (j.thuCuoc > 0 && isInRange(j.ngayThuCuoc)) {
                  const docNo = j.amisDepositDocNo;
                  if (docNo) {
                      if (!depositGroups.has(docNo)) {
                          depositGroups.set(docNo, {
                              date: j.ngayThuCuoc,
                              customer: j.customerName,
                              bill: `Cược BL ${j.jobCode}`,
                              amount: 0,
                              type: 'Deposit',
                              jobCodes: [],
                              docNo: docNo
                          });
                      }
                      const group = depositGroups.get(docNo);
                      group.amount += j.thuCuoc;
                      group.jobCodes.push(j.jobCode);
                  } else {
                      list.push({
                          date: j.ngayThuCuoc,
                          customer: j.customerName,
                          bill: `Cược BL ${j.jobCode}`,
                          amount: j.thuCuoc,
                          type: 'Deposit',
                          jobCode: j.jobCode
                      });
                  }
              }

              // Extensions
              (j.extensions || []).forEach(ext => {
                  if (ext.total > 0 && isInRange(ext.invoiceDate)) {
                      list.push({
                          date: ext.invoiceDate,
                          customer: j.customerName,
                          bill: ext.invoice || `GH BL ${j.jobCode}`,
                          amount: ext.total,
                          type: 'Gia Hạn',
                          jobCode: j.jobCode
                      });
                  }
              });

              // Additional Receipts
              (j.additionalReceipts || []).forEach(r => {
                  if (isInRange(r.date)) {
                      list.push({
                          date: r.date,
                          customer: j.customerName,
                          bill: `Thu thêm BL ${j.jobCode}`,
                          amount: r.amount,
                          type: r.type === 'deposit' ? 'Deposit (Add)' : 'Local Charge (Add)',
                          jobCode: j.jobCode
                      });
                  }
              });
          });

          // Push Grouped Items to List
          lcGroups.forEach(g => {
              list.push({
                  date: g.date,
                  customer: g.customer,
                  bill: g.bill,
                  amount: g.amount,
                  type: g.type,
                  jobCode: g.jobCodes.join(', '),
                  isMerged: g.jobCodes.length > 1
              });
          });

          depositGroups.forEach(g => {
              list.push({
                  date: g.date,
                  customer: g.customer,
                  bill: g.bill,
                  amount: g.amount,
                  type: g.type,
                  jobCode: g.jobCodes.join(', '),
                  isMerged: g.jobCodes.length > 1
              });
          });

      } else {
          // LONG HOANG = CUSTOM RECEIPTS ONLY
          customReceipts.forEach(r => {
              const isAuto = r.jobCodes && Array.isArray(r.jobCodes) && r.jobCodes.length > 0;
              
              // IF Auto-generated, ONLY include if type is 'other' (Thu Khác).
              // If it's Local/Deposit/Extension auto-receipt, skip (it belongs to Kimberry).
              if (isAuto && r.type !== 'other') return;

              const resolveName = (code: string, name: string) => {
                  if (name) return name;
                  const found = customers.find(c => c.code === code || c.id === code);
                  return found ? found.name : code;
              };

              if (isInRange(r.date)) {
                  list.push({
                      date: r.date,
                      customer: resolveName(r.objCode, r.objName), 
                      bill: r.invoice || r.docNo || 'Thu Khác',
                      amount: r.amount,
                      type: 'Thu Khác',
                      jobCode: isAuto && r.jobCodes ? r.jobCodes.join(', ') : 'N/A'
                  });
              }
              
              if (r.additionalReceipts) {
                  r.additionalReceipts.forEach((ar: any) => {
                      if (isInRange(ar.date)) {
                          list.push({
                              date: ar.date,
                              customer: resolveName(r.objCode, r.objName),
                              bill: ar.docNo || 'Thu thêm',
                              amount: ar.amount,
                              type: 'Thu Khác (Add)',
                              jobCode: 'N/A'
                          });
                      }
                  });
              }
          });
      }

      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [jobs, customReceipts, activeTab, fromDate, toDate, selectedEntity, customers]);

  const totalAmountList = paymentList.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="p-8 max-w-full h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
         <div>
            <div className="flex items-center space-x-3 text-slate-800 mb-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Search className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Tra Cứu & Lịch Sử</h1>
            </div>
            <p className="text-slate-500 ml-11">Tra cứu thông tin Job hoặc xem lịch sử dòng tiền thu</p>
         </div>

         {/* TAB SWITCHER */}
         <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner">
             <button 
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <Search className="w-4 h-4" /> Tra cứu Job
             </button>
             <button 
                onClick={() => setActiveTab('list')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <ListFilter className="w-4 h-4" /> Lịch sử thu
             </button>
         </div>
      </div>

      {activeTab === 'search' ? (
      /* ================= SEARCH VIEW ================= */
      <div className="flex flex-col items-center justify-start flex-1 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2">
        
        {/* Search Box */}
        <div className="w-full glass-panel p-8 rounded-3xl shadow-lg border border-white/50 mb-8">
            <form onSubmit={handleSearch} className="relative">
                <input 
                    type="text" 
                    value={searchCode}
                    onChange={(e) => {
                        setSearchCode(e.target.value);
                        if (hasSearched) setHasSearched(false); 
                    }}
                    placeholder="Nhập số Job (VD: JOB-23-001)..." 
                    className="w-full pl-6 pr-32 py-4 text-lg bg-white/80 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                />
                <button 
                    type="submit"
                    className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-bold transition-all shadow-md flex items-center"
                >
                    <Search className="w-5 h-5 mr-2" /> Tra cứu
                </button>
            </form>
        </div>

        {/* Results Display */}
        {hasSearched && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {result ? (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Kết quả tra cứu</p>
                                <h2 className="text-3xl font-bold flex items-center">
                                    {result.jobCode}
                                    <span className="ml-3 px-3 py-1 bg-white/20 rounded-lg text-sm font-medium backdrop-blur-sm border border-white/10">
                                        Booking: {result.booking || 'N/A'}
                                    </span>
                                </h2>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="p-8 grid gap-8">
                            {/* Financials Row (Job Specific) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center text-slate-500 mb-2 font-medium text-xs uppercase tracking-wide">
                                        <DollarSign className="w-4 h-4 mr-2 text-blue-500" />
                                        Local Charge (Job)
                                    </div>
                                    <div className="text-2xl font-bold text-slate-800">
                                        {formatCurrency(result.localChargeTotal)}
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center text-slate-500 mb-2 font-medium text-xs uppercase tracking-wide">
                                        <RefreshCw className="w-4 h-4 mr-2 text-orange-500" />
                                        Tiền Gia Hạn (Job)
                                    </div>
                                    <div className={`text-2xl font-bold ${extensionTotal > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                        {formatCurrency(extensionTotal)}
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center text-slate-500 mb-2 font-medium text-xs uppercase tracking-wide">
                                        <Wallet className="w-4 h-4 mr-2 text-purple-500" />
                                        Tiền Cược
                                    </div>
                                    <div className="text-2xl font-bold text-slate-800">
                                        {formatCurrency(result.thuCuoc)}
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status Logic */}
                            <div className="space-y-4">
                                {/* Local Charge Status */}
                                <div className={`p-5 rounded-2xl border-l-4 border-t border-r border-b ${isLcPaid ? 'border-l-green-500 bg-green-50/50 border-green-100' : 'border-l-slate-300 bg-slate-50 border-slate-100'}`}>
                                    <h3 className={`text-xs font-bold uppercase mb-2 ${isLcPaid ? 'text-green-800' : 'text-slate-500'}`}>Trạng thái thanh toán Local Charge</h3>
                                    {isLcPaid ? (
                                        <div>
                                            <div className="flex items-center text-green-700 font-bold text-lg mb-2">
                                                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                                {isTCB ? (
                                                    <span>Đã nhận thanh toán local charge từ khách hàng</span>
                                                ) : (
                                                    <span>Đã nhận thanh toán local charge từ khách hàng ngày {formatDateVN(result.localChargeDate)}</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-slate-500 font-medium">
                                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                            Chưa ghi nhận thanh toán
                                        </div>
                                    )}

                                    {/* MISMATCH WARNING - LOCAL CHARGE */}
                                    {paymentStatus && paymentStatus.hasMismatch && paymentStatus.lcDiff !== 0 && (
                                        <div className="mt-3 p-3 bg-white/80 rounded-xl border border-yellow-200 flex items-start gap-3 shadow-sm">
                                            <div className="p-1.5 bg-yellow-100 rounded-full mt-0.5">
                                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-700">
                                                    Khách hàng thanh toán {paymentStatus.lcDiff > 0 ? 'DƯ' : 'THIẾU'}:
                                                    <span className={`ml-2 text-lg ${paymentStatus.lcDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {formatCurrency(Math.abs(paymentStatus.lcDiff))}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Phải thu: {formatCurrency(result.localChargeTotal)} | Thực thu: {formatCurrency(paymentStatus.totalCollectedLC)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Extension Payment Status */}
                                {extensionTotal > 0 && (
                                    <div className={`p-5 rounded-2xl border-l-4 border-t border-r border-b ${isExtPaid ? 'border-l-green-500 bg-green-50/50 border-green-100' : 'border-l-orange-500 bg-orange-50/50 border-orange-100'}`}>
                                        <h3 className={`text-xs font-bold uppercase mb-2 ${isExtPaid ? 'text-green-800' : 'text-orange-800'}`}>Trạng thái thanh toán Gia Hạn</h3>
                                        {isExtPaid ? (
                                            <div className="space-y-4">
                                                {paidExtensions.map((ext, idx) => (
                                                    <div key={idx} className={`${idx > 0 ? 'border-t border-green-200/50 pt-3' : ''}`}>
                                                        <div className="flex items-center text-green-700 font-bold text-lg mb-1">
                                                            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                                            {paidExtensions.length > 1 ? `Thu lần ${idx + 1}: ` : 'Đã nhận thanh toán: '}
                                                            <span className="text-slate-800 mx-2">{formatCurrency(ext.total)}</span>
                                                            <span className="text-sm font-medium text-slate-500 bg-white/50 px-2 py-0.5 rounded border border-slate-200">
                                                                Ngày {formatDateVN(ext.invoiceDate)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center text-orange-700 font-medium">
                                                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                                Chưa thanh toán gia hạn
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Deposit Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className={`p-5 rounded-2xl border ${result.ngayThuCuoc ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                                        <Calendar className="w-4 h-4 mr-1.5" /> Ngày nhận cược
                                    </div>
                                    <div className={`text-lg font-semibold ${result.ngayThuCuoc ? 'text-blue-700' : 'text-slate-400 italic'}`}>
                                        {result.ngayThuCuoc 
                                            ? `Đã nhận Cược ngày ${formatDateVN(result.ngayThuCuoc)}` 
                                            : 'Chưa có thông tin'}
                                    </div>
                                </div>

                                <div className={`p-5 rounded-2xl border ${result.ngayThuHoan ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                                        <Calendar className="w-4 h-4 mr-1.5" /> Ngày hoàn cược
                                    </div>
                                    <div className={`text-lg font-semibold ${result.ngayThuHoan ? 'text-green-700' : 'text-slate-400 italic'}`}>
                                        {result.ngayThuHoan 
                                            ? `Đã hoàn Cược ngày ${formatDateVN(result.ngayThuHoan)}` 
                                            : 'Chưa hoàn'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/50 backdrop-blur-md rounded-3xl border border-white/40">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700">Không tìm thấy kết quả</h3>
                        <p className="text-slate-500 mt-2">Vui lòng kiểm tra lại số Job và thử lại.</p>
                    </div>
                )}
            </div>
        )}
      </div>
      ) : (
      /* ================= LIST VIEW ================= */
      <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4">
          <div className="glass-panel p-5 rounded-2xl mb-6 shadow-sm border border-white/40 flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  {/* Company Toggle */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Building2 size={12}/> Đơn vị</label>
                      <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
                          <button 
                            onClick={() => setSelectedEntity('KIMBERRY')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${selectedEntity === 'KIMBERRY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              KIMBERRY
                          </button>
                          <button 
                            onClick={() => setSelectedEntity('LONGHOANG')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${selectedEntity === 'LONGHOANG' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              LONG HOÀNG
                          </button>
                      </div>
                  </div>

                  {/* Date Range */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Filter size={12}/> Khoảng thời gian</label>
                      <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <div className="relative flex-1">
                              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* TABLE RESULTS */}
          <div className="glass-panel rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-xs sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="px-6 py-4">Ngày thu</th>
                              <th className="px-6 py-4">Khách hàng / Công ty</th>
                              <th className="px-6 py-4">Số CT / Hóa đơn</th>
                              <th className="px-6 py-4">Loại thu</th>
                              <th className="px-6 py-4 text-right">Số tiền</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                          {paymentList.length > 0 ? paymentList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-3 font-medium text-slate-500">{formatDateVN(item.date)}</td>
                                  <td className="px-6 py-3 font-bold text-slate-700">{item.customer}</td>
                                  <td className="px-6 py-3 text-slate-600">
                                      {item.bill}
                                  </td>
                                  <td className="px-6 py-3">
                                      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${
                                          item.type.includes('Deposit') ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                          item.type.includes('Gia Hạn') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                          item.type.includes('Thu Khác') ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                          'bg-blue-50 text-blue-700 border-blue-100'
                                      }`}>
                                          {item.type}
                                      </span>
                                  </td>
                                  <td className="px-6 py-3 text-right font-bold text-emerald-600 text-base">
                                      {formatCurrency(item.amount)}
                                  </td>
                              </tr>
                          )) : (
                              <tr>
                                  <td colSpan={5} className="text-center py-12 text-slate-400 font-light flex flex-col items-center justify-center">
                                      <Wallet className="w-10 h-10 mb-2 opacity-20" />
                                      Không có dữ liệu thanh toán trong khoảng thời gian này
                                  </td>
                              </tr>
                          )}
                      </tbody>
                      {paymentList.length > 0 && (
                          <tfoot className="bg-slate-50 border-t border-slate-200 sticky bottom-0 font-bold text-slate-800 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                              <tr>
                                  <td colSpan={4} className="px-6 py-4 text-right uppercase text-xs">Tổng cộng:</td>
                                  <td className="px-6 py-4 text-right text-emerald-700 text-lg">{formatCurrency(totalAmountList)}</td>
                              </tr>
                          </tfoot>
                      )}
                  </table>
              </div>
          </div>
          {selectedEntity === 'KIMBERRY' && (
              <div className="text-xs text-slate-400 mt-2 italic px-2">* Danh sách Kimberry KHÔNG bao gồm các khoản Thu Khác (Xem bên tab Long Hoàng). Các phiếu thu gộp được hiển thị dưới dạng 1 dòng.</div>
          )}
      </div>
      )}
    </div>
  );
};
