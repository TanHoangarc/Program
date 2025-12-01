
import React, { useState, useMemo } from 'react';
import { JobData, Customer } from '../types';
import { WalletCards, FileSpreadsheet, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DebtManagementProps {
  jobs: JobData[];
  customers: Customer[];
}

type ReportType = 
  | 'CUSTOMER_DEBT' 
  | 'LINE_DEBT' 
  | 'UNPAID_JOBS' 
  | 'LONGHOANG_NO_HBL' 
  | 'NO_INVOICE_JOBS' 
  | 'TCB_PAYMENT' 
  | 'DEPOSIT_MISSING_INFO'
  | 'BOOKING_NO_INVOICE';

export const DebtManagement: React.FC<DebtManagementProps> = ({ jobs, customers }) => {
  const [reportType, setReportType] = useState<ReportType>('CUSTOMER_DEBT');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // --- REPORT LOGIC ---
  const reportData = useMemo(() => {
    let data: any[] = [];
    
    switch (reportType) {
      case 'CUSTOMER_DEBT': {
        // Group by Customer, sum debts
        const grouped: Record<string, { id: string, name: string, totalDebt: number, jobCount: number }> = {};
        jobs.forEach(job => {
          // Condition: Job has revenue but Bank is empty (Unpaid)
          if (!job.bank && (job.sell > 0 || job.localChargeTotal > 0)) {
            const custId = job.customerId;
            if (!grouped[custId]) {
              grouped[custId] = { 
                id: custId, 
                name: job.customerName || 'Unknown', 
                totalDebt: 0, 
                jobCount: 0 
              };
            }
            // Debt amount: Prefer Local Charge Total (Invoice Amt), else Sell
            const debtAmt = job.localChargeTotal > 0 ? job.localChargeTotal : job.sell;
            grouped[custId].totalDebt += debtAmt;
            grouped[custId].jobCount++;
          }
        });
        data = Object.values(grouped).sort((a, b) => b.totalDebt - a.totalDebt);
        break;
      }

      case 'LINE_DEBT': {
        // Group by Line, sum expenses
        const grouped: Record<string, { line: string, totalCost: number, jobCount: number }> = {};
        jobs.forEach(job => {
          if (job.chiPayment > 0) {
            const line = job.line || 'Unknown';
            if (!grouped[line]) {
              grouped[line] = { line, totalCost: 0, jobCount: 0 };
            }
            grouped[line].totalCost += job.chiPayment;
            grouped[line].jobCount++;
          }
        });
        data = Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);
        break;
      }

      case 'UNPAID_JOBS': {
        // Jobs where Bank is empty but has revenue
        data = jobs.filter(j => !j.bank && (j.sell > 0 || j.localChargeTotal > 0));
        break;
      }

      case 'LONGHOANG_NO_HBL': {
        // Customer name contains "Long Hoàng" AND HBL is empty
        data = jobs.filter(j => 
          j.customerName.toLowerCase().includes('long hoàng') && !j.hbl
        );
        break;
      }

      case 'NO_INVOICE_JOBS': {
        // Has revenue but Invoice is empty
        data = jobs.filter(j => 
          (j.sell > 0 || j.localChargeTotal > 0) && !j.localChargeInvoice
        );
        break;
      }

      case 'TCB_PAYMENT': {
        // Paid via TCB Bank
        data = jobs.filter(j => j.bank === 'TCB Bank');
        break;
      }

      case 'DEPOSIT_MISSING_INFO': {
        // Deposit > 0 but No Customer ID selected
        data = jobs.filter(j => j.thuCuoc > 0 && !j.maKhCuocId);
        break;
      }

      case 'BOOKING_NO_INVOICE': {
        // Booking Cost Details -> Local Charge Invoice/Date is missing
        // Need to filter unique bookings that have issues
        const processed = new Set();
        data = jobs.filter(j => {
          if (!j.booking || processed.has(j.booking)) return false;
          
          const details = j.bookingCostDetails?.localCharge;
          const isMissing = !details?.invoice || !details?.date;
          
          if (isMissing) {
            processed.add(j.booking);
            return true;
          }
          return false;
        });
        break;
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(item => {
        if (item.jobCode) return String(item.jobCode).toLowerCase().includes(lower);
        if (item.name) return String(item.name).toLowerCase().includes(lower);
        if (item.line) return String(item.line).toLowerCase().includes(lower);
        if (item.booking) return String(item.booking).toLowerCase().includes(lower);
        return false;
      });
    }

    return data;
  }, [jobs, reportType, searchTerm]);

  // --- EXPORT ---
  const handleExportExcel = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (reportType === 'CUSTOMER_DEBT') {
      headers = ['Khách Hàng', 'Số Job Nợ', 'Tổng Nợ'];
      rows = reportData.map((d: any) => [d.name, d.jobCount, d.totalDebt]);
    } else if (reportType === 'LINE_DEBT') {
      headers = ['Hãng Tàu', 'Số Job', 'Tổng Chi Phí'];
      rows = reportData.map((d: any) => [d.line, d.jobCount, d.totalCost]);
    } else {
      headers = ['Tháng', 'Job Code', 'Booking', 'Khách Hàng', 'Số Tiền', 'Lỗi/Ghi chú'];
      rows = reportData.map((j: JobData) => {
        let note = '';
        if (reportType === 'UNPAID_JOBS') note = 'Chưa thanh toán (Bank rỗng)';
        if (reportType === 'LONGHOANG_NO_HBL') note = 'Thiếu HBL';
        if (reportType === 'NO_INVOICE_JOBS') note = 'Thiếu số Hóa đơn';
        if (reportType === 'DEPOSIT_MISSING_INFO') note = 'Cược không có Mã KH';
        if (reportType === 'BOOKING_NO_INVOICE') note = 'Booking thiếu Invoice đầu vào';
        
        const amt = j.localChargeTotal || j.sell || j.thuCuoc;
        return [j.month, j.jobCode, j.booking, j.customerName, amt, note];
      });
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cong_no_Report");
    XLSX.writeFile(wb, `Report_${reportType}.xlsx`);
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center space-x-3 text-slate-800 mb-2">
             <div className="p-2 bg-pink-100 text-pink-700 rounded-lg">
               <WalletCards className="w-6 h-6" />
             </div>
             <h1 className="text-3xl font-bold">Quản Lý Công Nợ & Kiểm Soát</h1>
           </div>
           <p className="text-slate-500 ml-11">Báo cáo công nợ và lọc các job thiếu thông tin</p>
        </div>
        
        <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center shadow-md hover:bg-green-700 transition-colors">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Xuất Excel
        </button>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
         <div className="flex-1">
           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loại Báo Cáo</label>
           <select 
             value={reportType} 
             onChange={(e) => setReportType(e.target.value as ReportType)}
             className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
           >
             <optgroup label="Tổng Hợp Công Nợ">
               <option value="CUSTOMER_DEBT">Công nợ Khách Hàng</option>
               <option value="LINE_DEBT">Công nợ Hãng Tàu</option>
             </optgroup>
             <optgroup label="Kiểm Soát & Cảnh Báo">
               <option value="UNPAID_JOBS">Danh sách Job chưa thanh toán</option>
               <option value="LONGHOANG_NO_HBL">Job Long Hoàng thiếu HBL</option>
               <option value="NO_INVOICE_JOBS">Job thiếu Hóa đơn</option>
               <option value="TCB_PAYMENT">Job thanh toán qua TCB</option>
               <option value="DEPOSIT_MISSING_INFO">Cược thiếu thông tin KH</option>
               <option value="BOOKING_NO_INVOICE">Booking thiếu Hóa đơn đầu vào</option>
             </optgroup>
           </select>
         </div>
         <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên, job code, booking..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
         </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {reportType === 'CUSTOMER_DEBT' || reportType === 'LINE_DEBT' ? (
          // Summary Table
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                <th className="px-6 py-4">{reportType === 'CUSTOMER_DEBT' ? 'Khách Hàng' : 'Hãng Tàu'}</th>
                <th className="px-6 py-4 text-center">Số lượng</th>
                <th className="px-6 py-4 text-right">Tổng Tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.length > 0 ? (
                reportData.map((item: any, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name || item.line}</td>
                    <td className="px-6 py-4 text-center bg-gray-50/50">{item.jobCount}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">
                       {formatCurrency(reportType === 'CUSTOMER_DEBT' ? item.totalDebt : item.totalCost)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          // Detail Job Table
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Tháng</th>
                <th className="px-6 py-4">Job Code</th>
                <th className="px-6 py-4">Booking</th>
                <th className="px-6 py-4">Khách Hàng</th>
                <th className="px-6 py-4 text-right">Số Tiền</th>
                <th className="px-6 py-4 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.length > 0 ? (
                 reportData.map((job: JobData) => {
                   const amt = job.localChargeTotal || job.sell || job.thuCuoc;
                   return (
                     <tr key={job.id} className="hover:bg-gray-50">
                       <td className="px-6 py-4 text-gray-500">T{job.month}</td>
                       <td className="px-6 py-4 font-medium text-blue-600">{job.jobCode}</td>
                       <td className="px-6 py-4 text-gray-600">{job.booking}</td>
                       <td className="px-6 py-4 text-gray-800 font-medium">{job.customerName}</td>
                       <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(amt)}</td>
                       <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                             <AlertTriangle className="w-3 h-3 mr-1" /> Kiểm tra
                          </span>
                       </td>
                     </tr>
                   )
                 })
              ) : (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center flex flex-col items-center justify-center text-gray-400">
                      <CheckCircle className="w-10 h-10 mb-2 text-green-500 opacity-50" />
                      <span>Không phát hiện dữ liệu lỗi hoặc công nợ</span>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
