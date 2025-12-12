import React, { useState, useMemo } from 'react';
import { JobData } from '../types';
import { Search, CheckCircle, AlertCircle, Calendar, DollarSign, Wallet, RefreshCw, FileText } from 'lucide-react';
import { formatDateVN } from '../utils';

interface LookupPageProps {
  jobs: JobData[];
}

export const LookupPage: React.FC<LookupPageProps> = ({ jobs }) => {
  const [searchCode, setSearchCode] = useState('');
  const [result, setResult] = useState<JobData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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

  // Helper to extract just the Job Codes from the AMIS Description
  const extractJobCodes = (desc?: string) => {
      if (!desc) return '';
      if (desc.includes('BL ')) {
          let parts = desc.split('BL ');
          if (parts.length > 1) {
              return parts[1].replace(/\(KIM\)/i, '').trim();
          }
      }
      return desc; 
  };

  // --- MERGED TOTAL CALCULATIONS ---
  
  // 1. Calculate Merged Local Charge Total based on AMIS Doc No
  const mergedLcTotal = useMemo(() => {
      if (!result || !result.amisLcDocNo) return 0;
      const docNo = result.amisLcDocNo;
      
      // Sum all jobs sharing the same Payment DocNo
      return jobs
        .filter(j => j.amisLcDocNo === docNo)
        .reduce((sum, j) => sum + j.localChargeTotal, 0);
  }, [jobs, result]);

  // 2. Calculate Merged Extension Total based on AMIS Doc No
  const paidExtension = result?.extensions?.find(e => e.amisDocNo);
  const mergedExtTotal = useMemo(() => {
      if (!paidExtension || !paidExtension.amisDocNo) return 0;
      const docNo = paidExtension.amisDocNo;

      // Sum all extensions in all jobs sharing the same Payment DocNo
      let total = 0;
      jobs.forEach(job => {
          (job.extensions || []).forEach(ext => {
              if (ext.amisDocNo === docNo) {
                  total += ext.total;
              }
          });
      });
      return total;
  }, [jobs, paidExtension]);


  // Job-specific Extension Total (Top Card)
  const extensionTotal = result ? (result.extensions || []).reduce((sum, ext) => sum + ext.total, 0) : 0;
  
  // Logic check thanh toán
  const isLcPaid = result && result.bank && result.localChargeDate;
  const isExtPaid = !!paidExtension;

  return (
    <div className="p-8 max-w-full h-full flex flex-col">
      <div className="mb-8">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
             <Search className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Tra Cứu Thông Tin</h1>
         </div>
         <p className="text-slate-500 ml-11">Kiểm tra trạng thái thanh toán và cược của lô hàng</p>
      </div>

      <div className="flex flex-col items-center justify-start flex-1 max-w-4xl mx-auto w-full">
        
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
                                                Đã nhận thanh toán local charge từ khách hàng ngày {formatDateVN(result.localChargeDate)}
                                            </div>
                                            {/* Merged Payment Info */}
                                            <div className="bg-white/60 p-3 rounded-xl border border-green-200 text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-green-800">Số tiền nhận:</span> 
                                                    {/* Display MERGED TOTAL here */}
                                                    <span className="font-mono text-slate-700 text-lg font-bold">{formatCurrency(mergedLcTotal)}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="font-bold text-green-800 whitespace-nowrap mt-0.5">KH thanh toán các lô:</span> 
                                                    <span className="text-slate-700 font-bold leading-snug">{extractJobCodes(result.amisLcDesc)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-slate-500 font-medium">
                                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                            Chưa ghi nhận thanh toán
                                        </div>
                                    )}
                                </div>

                                {/* Extension Payment Status */}
                                {extensionTotal > 0 && (
                                    <div className={`p-5 rounded-2xl border-l-4 border-t border-r border-b ${isExtPaid ? 'border-l-green-500 bg-green-50/50 border-green-100' : 'border-l-orange-500 bg-orange-50/50 border-orange-100'}`}>
                                        <h3 className={`text-xs font-bold uppercase mb-2 ${isExtPaid ? 'text-green-800' : 'text-orange-800'}`}>Trạng thái thanh toán Gia Hạn</h3>
                                        {isExtPaid ? (
                                            <div>
                                                <div className="flex items-center text-green-700 font-bold text-lg mb-2">
                                                    <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                                    Đã nhận thanh toán gia hạn ngày {formatDateVN(paidExtension?.invoiceDate)}
                                                </div>
                                                {/* Merged Payment Info for Extension */}
                                                <div className="bg-white/60 p-3 rounded-xl border border-green-200 text-sm">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-green-800">Số tiền nhận:</span> 
                                                        {/* Display MERGED TOTAL here */}
                                                        <span className="font-mono text-slate-700 text-lg font-bold">{formatCurrency(mergedExtTotal)}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <span className="font-bold text-green-800 whitespace-nowrap mt-0.5">KH thanh toán các lô:</span> 
                                                        <span className="text-slate-700 font-bold leading-snug">{extractJobCodes(paidExtension?.amisDesc)}</span>
                                                    </div>
                                                </div>
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
    </div>
  );
};
