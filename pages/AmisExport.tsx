
import React, { useMemo, useState } from 'react';
import { JobData, Customer } from '../types';
import { FileUp, FileSpreadsheet, Filter } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  mode: 'thu' | 'chi' | 'ban' | 'mua';
}

export const AmisExport: React.FC<AmisExportProps> = ({ jobs, customers, mode }) => {
  const [filterMonth, setFilterMonth] = useState('');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getCustomerCode = (id: string) => {
    return customers.find(c => c.id === id)?.code || id;
  };

  const getProjectCode = (job: JobData | null, fallbackDate?: string) => {
    let year = new Date().getFullYear();
    if (job?.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    else if (fallbackDate) year = new Date(fallbackDate).getFullYear();
    
    const yearSuffix = year.toString().slice(-2);
    const monthPad = (job?.month || '1').padStart(2, '0');
    return `K${yearSuffix}${monthPad}&${job?.jobCode || ''}`;
  };

  // --- DATA TRANSFORMATION LOGIC ---

  const exportData = useMemo(() => {
    let filteredJobs = jobs;
    if (filterMonth) {
      filteredJobs = jobs.filter(j => j.month === filterMonth);
    }

    if (mode === 'thu') {
      // 1. PHIẾU THU: Data from Deposit In (Thu Cược)
      // Needs: Date, DocNo, ObjCode, Desc, Amount
      return filteredJobs
        .filter(j => j.thuCuoc > 0)
        .map(j => ({
          date: j.ngayThuCuoc,
          docNo: `PT-${j.jobCode}`,
          objCode: getCustomerCode(j.maKhCuocId),
          desc: `Thu cược ${j.jobCode}`,
          amount: j.thuCuoc,
          extra1: '', // Placeholder
          extra2: ''
        }));
    } 
    
    else if (mode === 'chi') {
      // 2. PHIẾU CHI: Data from Deposit Out (Chi Cược) AND Payment Out (Chi Payment)
      const rows = [];
      
      // Type A: Chi Cược
      for (const j of filteredJobs) {
        if (j.chiCuoc > 0) {
          rows.push({
            date: j.ngayChiCuoc,
            docNo: `PC-C-${j.booking}`,
            content: 'Chi cược hãng tàu',
            objCode: j.line, // Line is the object
            desc: `Chi cược Booking ${j.booking}`,
            amount: j.chiCuoc
          });
        }
        // Type B: Chi Payment (Thanh toán)
        // Note: Use Booking Invoice Date if available, else default
        if (j.chiPayment > 0) {
          const invDate = j.bookingCostDetails?.localCharge?.date || '';
          rows.push({
            date: invDate,
            docNo: `PC-T-${j.booking}`,
            content: 'Thanh toán Local Charge',
            objCode: j.line,
            desc: `Thanh toán Booking ${j.booking}`,
            amount: j.chiPayment
          });
        }
      }
      return rows;
    }

    else if (mode === 'ban') {
      // 3. PHIẾU BÁN HÀNG
      // Source: Sell (Revenue) AND LocalCharge (Revenue)
      const rows = [];
      for (const j of filteredJobs) {
        const projectCode = getProjectCode(j);
        
        // Row 1: Sell (Doanh thu cước)
        if (j.sell > 0) {
          rows.push({
            date: j.localChargeDate, // Assume invoice date
            docNo: `BH-${j.jobCode}`,
            objCode: getCustomerCode(j.customerId),
            desc: `Doanh thu cước ${j.jobCode}`,
            itemCode: 'SERVICE', // Default item code
            amount: j.sell,
            vat: 0, // Sell usually 0% in this context unless specified
            project: projectCode
          });
        }

        // Row 2: Local Charge (Thu hộ/Chi hộ or Local Charge Revenue)
        if (j.localChargeTotal > 0) {
           // Calculate Net from Total and Vat if Net is 0/missing, or use fields
           // In JobData we have localChargeNet, localChargeVat.
           rows.push({
            date: j.localChargeDate,
            docNo: `BH-${j.jobCode}-LC`,
            objCode: getCustomerCode(j.customerId),
            desc: `Local Charge ${j.jobCode}`,
            itemCode: 'LOCAL',
            amount: j.localChargeNet || j.localChargeTotal, // Use Net if avail
            vat: j.localChargeVat || 0,
            project: projectCode
          });
        }
      }
      return rows;
    }

    else if (mode === 'mua') {
      // 4. PHIẾU MUA HÀNG
      // Source: Booking Cost Details (Invoices from vendors)
      // Must group by Booking to avoid duplicates
      const processedBookings = new Set();
      const rows = [];

      for (const j of filteredJobs) {
        if (!j.booking || processedBookings.has(j.booking)) continue;
        
        // Process this booking
        if (j.bookingCostDetails) {
           const details = j.bookingCostDetails;
           
           // Invoice 1: Local Charge from Line
           if (details.localCharge && details.localCharge.total > 0) {
             rows.push({
               date: details.localCharge.date,
               docNo: `MH-${j.booking}`,
               invNo: details.localCharge.invoice,
               invDate: details.localCharge.date,
               vendorCode: j.line, // Line is vendor
               desc: `Chi phí Booking ${j.booking}`,
               itemCode: 'SHIPPING',
               itemName: 'Cước vận chuyển/Local Charge',
               price: details.localCharge.net,
               vatRate: '5.263%', // Standard rate based on job entry, or derive
               vatAmt: details.localCharge.vat
             });
           }

           // Invoice 2+: Extensions
           if (details.extensionCosts) {
             details.extensionCosts.forEach((ext, idx) => {
                rows.push({
                  date: ext.date,
                  docNo: `MH-${j.booking}-E${idx}`,
                  invNo: ext.invoice,
                  invDate: ext.date,
                  vendorCode: 'VENDOR', // Unknown vendor for extension, maybe add field later
                  desc: `Chi phí khác Booking ${j.booking}`,
                  itemCode: 'OTHERS',
                  itemName: 'Chi phí khác',
                  price: ext.net,
                  vatRate: '8% or 10%', // Placeholder
                  vatAmt: ext.vat
                });
             });
           }
        }
        processedBookings.add(j.booking);
      }
      return rows;
    }

    return [];
  }, [jobs, mode, filterMonth, customers]);

  // --- EXPORT FUNCTION ---
  const handleExport = () => {
    let headers: string[] = [];
    let csvRows: any[][] = [];

    if (mode === 'thu') {
      headers = ['Ngày chứng từ', 'Số chứng từ', 'Mã đối tượng', 'Diễn giải', 'Số tiền'];
      csvRows = exportData.map((d: any) => [d.date, d.docNo, d.objCode, d.desc, d.amount]);
    } else if (mode === 'chi') {
      headers = ['Ngày chứng từ', 'Số chứng từ', 'Nội dung TT', 'Mã đối tượng', 'Diễn giải', 'Số tiền'];
      csvRows = exportData.map((d: any) => [d.date, d.docNo, d.content, d.objCode, d.desc, d.amount]);
    } else if (mode === 'ban') {
      headers = ['Ngày chứng từ', 'Số chứng từ', 'Mã đối tượng', 'Diễn giải', 'Mã hàng', 'Số tiền', 'Thuế GTGT', 'Công trình'];
      csvRows = exportData.map((d: any) => [d.date, d.docNo, d.objCode, d.desc, d.itemCode, d.amount, d.vat, d.project]);
    } else if (mode === 'mua') {
      headers = ['Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Ngày hóa đơn', 'Mã NCC', 'Diễn giải', 'Mã hàng', 'Tên hàng', 'Đơn giá', 'Thuế GTGT', 'Tiền thuế GTGT'];
      csvRows = exportData.map((d: any) => [d.date, d.docNo, d.invNo, d.invDate, d.vendorCode, d.desc, d.itemCode, d.itemName, d.price, d.vatRate, d.vatAmt]);
    }

    // Convert to Excel Sheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...csvRows]);
    
    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Amis Export");

    // Write file
    XLSX.writeFile(wb, `amis_export_${mode}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const titles = {
    thu: 'Phiếu Thu',
    chi: 'Phiếu Chi',
    ban: 'Phiếu Bán Hàng',
    mua: 'Phiếu Mua Hàng'
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
             <FileUp className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Xuất Dữ Liệu AMIS</h1>
        </div>
        <p className="text-slate-500 ml-11 mb-4">Kết xuất dữ liệu kế toán: <span className="font-bold text-blue-600">{titles[mode]}</span></p>
        
        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
           <div className="flex items-center space-x-4">
              <div className="flex items-center text-slate-500 font-medium">
                <Filter className="w-4 h-4 mr-2" />
                Lọc tháng:
              </div>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48"
              >
                <option value="">Tất cả</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
           </div>

           <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
              <span>Tải file Excel (.xlsx)</span>
           </button>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                {mode === 'thu' && (
                  <>
                    <th className="px-6 py-3">Ngày CT</th>
                    <th className="px-6 py-3">Số CT</th>
                    <th className="px-6 py-3">Mã Đối Tượng</th>
                    <th className="px-6 py-3">Diễn giải</th>
                    <th className="px-6 py-3 text-right">Số tiền</th>
                  </>
                )}
                {mode === 'chi' && (
                  <>
                    <th className="px-6 py-3">Ngày CT</th>
                    <th className="px-6 py-3">Số CT</th>
                    <th className="px-6 py-3">Nội dung TT</th>
                    <th className="px-6 py-3">Mã Đối Tượng</th>
                    <th className="px-6 py-3">Diễn giải</th>
                    <th className="px-6 py-3 text-right">Số tiền</th>
                  </>
                )}
                {mode === 'ban' && (
                  <>
                    <th className="px-6 py-3">Ngày CT</th>
                    <th className="px-6 py-3">Số CT</th>
                    <th className="px-6 py-3">Mã Đối Tượng</th>
                    <th className="px-6 py-3">Diễn giải</th>
                    <th className="px-6 py-3">Mã Hàng</th>
                    <th className="px-6 py-3 text-right">Số tiền</th>
                    <th className="px-6 py-3 text-right">Thuế GTGT</th>
                    <th className="px-6 py-3 text-center">Công Trình</th>
                  </>
                )}
                {mode === 'mua' && (
                  <>
                    <th className="px-6 py-3">Ngày CT</th>
                    <th className="px-6 py-3">Số CT</th>
                    <th className="px-6 py-3">Số HĐ</th>
                    <th className="px-6 py-3">Mã NCC</th>
                    <th className="px-6 py-3">Diễn giải</th>
                    <th className="px-6 py-3">Mã Hàng</th>
                    <th className="px-6 py-3 text-right">Đơn giá</th>
                    <th className="px-6 py-3 text-right">Thuế GTGT</th>
                    <th className="px-6 py-3 text-right">Tiền Thuế</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exportData.length > 0 ? (
                 exportData.map((row: any, idx) => (
                   <tr key={idx} className="hover:bg-gray-50">
                      {mode === 'thu' && (
                        <>
                          <td className="px-6 py-3">{row.date}</td>
                          <td className="px-6 py-3 font-medium text-blue-600">{row.docNo}</td>
                          <td className="px-6 py-3">{row.objCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                        </>
                      )}
                      {mode === 'chi' && (
                        <>
                          <td className="px-6 py-3">{row.date}</td>
                          <td className="px-6 py-3 font-medium text-blue-600">{row.docNo}</td>
                          <td className="px-6 py-3">{row.content}</td>
                          <td className="px-6 py-3">{row.objCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                        </>
                      )}
                      {mode === 'ban' && (
                        <>
                          <td className="px-6 py-3">{row.date}</td>
                          <td className="px-6 py-3 font-medium text-blue-600">{row.docNo}</td>
                          <td className="px-6 py-3">{row.objCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-center bg-gray-50">{row.itemCode}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                          <td className="px-6 py-3 text-right">{formatCurrency(row.vat)}</td>
                          <td className="px-6 py-3 text-center font-mono text-xs">{row.project}</td>
                        </>
                      )}
                      {mode === 'mua' && (
                        <>
                          <td className="px-6 py-3">{row.date}</td>
                          <td className="px-6 py-3 font-medium text-blue-600">{row.docNo}</td>
                          <td className="px-6 py-3">{row.invNo}</td>
                          <td className="px-6 py-3">{row.vendorCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-center bg-gray-50">{row.itemCode}</td>
                          <td className="px-6 py-3 text-right">{formatCurrency(row.price)}</td>
                          <td className="px-6 py-3 text-right text-gray-500">{row.vatRate}</td>
                          <td className="px-6 py-3 text-right">{formatCurrency(row.vatAmt)}</td>
                        </>
                      )}
                   </tr>
                 ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
