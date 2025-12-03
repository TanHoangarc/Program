
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, CheckSquare, Square } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';
import { formatDateVN } from '../utils';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  mode: 'thu' | 'chi' | 'ban' | 'mua';
}

export const AmisExport: React.FC<AmisExportProps> = ({ jobs, customers, mode }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  
  // State to store edited rows keyed by DocNo (SoChungTu)
  const [editedRows, setEditedRows] = useState<Record<string, any>>({});
  
  // Selection & Locking State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('amis_locked_vouchers');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
        return new Set();
    }
  });

  // Template State
  const [templateWb, setTemplateWb] = useState<XLSX.WorkBook | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save locks whenever they change
  useEffect(() => {
    localStorage.setItem('amis_locked_vouchers', JSON.stringify(Array.from(lockedIds)));
  }, [lockedIds]);

  // Reset selection when mode or filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, filterMonth]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getCustomerCode = (id: string) => {
    return customers.find(c => c.id === id)?.code || id;
  };
  
  const getCustomerName = (id: string) => {
    return customers.find(c => c.id === id)?.name || '';
  };

  const getProjectCode = (job: JobData | null, fallbackDate?: string) => {
    let year = new Date().getFullYear();
    if (job?.localChargeDate) year = new Date(job.localChargeDate).getFullYear();
    else if (fallbackDate) year = new Date(fallbackDate).getFullYear();
    
    const yearSuffix = year.toString().slice(-2);
    const monthPad = (job?.month || '1').padStart(2, '0');
    return `K${yearSuffix}${monthPad}&${job?.jobCode || ''}`;
  };

  // --- TEMPLATE UPLOAD HANDLER ---
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      setTemplateWb(wb);
      setTemplateName(file.name);
    };
    reader.readAsBinaryString(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // --- DATA TRANSFORMATION LOGIC ---

  const exportData = useMemo(() => {
    let filteredJobs = jobs;
    if (filterMonth) {
      filteredJobs = jobs.filter(j => j.month === filterMonth);
    }

    if (mode === 'thu') {
      // 1. PHIẾU THU: Combines Deposit In (Thu Cược) AND Local Charge Receipts
      const rows = [];

      // A. THU CƯỢC (DEPOSIT)
      const depositJobs = filteredJobs.filter(j => j.thuCuoc > 0 && j.ngayThuCuoc);
      for (const j of depositJobs) {
         const docNo = `PT-C-${j.jobCode}`;
         const defaultRow = {
          // View Fields
          date: j.ngayThuCuoc,
          docNo: docNo,
          objCode: getCustomerCode(j.maKhCuocId),
          objName: getCustomerName(j.maKhCuocId),
          desc: `Thu tiền cược Job ${j.jobCode}`,
          amount: j.thuCuoc,
          
          // Excel Fields (20 columns default)
          col1: j.ngayThuCuoc,          // Ngày hạch toán
          col2: j.ngayThuCuoc,          // Ngày chứng từ
          col3: docNo,                  // Số chứng từ
          col4: getCustomerCode(j.maKhCuocId), // Mã đối tượng
          col5: getCustomerName(j.maKhCuocId), // Tên đối tượng
          col6: '',                     // Địa chỉ
          col7: '345673979999',         // Nộp vào TK (HARDCODED)
          col8: 'Ngân hàng TMCP Quân đội', // Mở tại ngân hàng (HARDCODED)
          col9: 'Thu khác',             // Lý do thu (HARDCODED)
          col10: `Thu tiền cược Job ${j.jobCode}`, // Diễn giải lý do thu
          col11: '',                    // Mã nhân viên thu
          col12: 'VND',                 // Loại tiền (HARDCODED)
          col13: '',                    // Tỷ giá
          col14: `Thu tiền cược Job ${j.jobCode}`, // Diễn giải (hạch toán)
          col15: '1121',                // TK Nợ (HARDCODED)
          col16: '1388',                // TK Có (CƯỢC -> 1388)
          col17: j.thuCuoc,             // Số tiền
          col18: '',                    // Quy đổi
          col19: getCustomerCode(j.maKhCuocId), // Mã đối tượng (hạch toán)
          col20: ''                     // Số khế ước đi vay
         };

         // MERGE WITH EDITS
         rows.push({ ...defaultRow, ...(editedRows[docNo] || {}) });
      }

      // B. THU LOCAL CHARGE (SALES RECEIPT)
      const salesJobs = filteredJobs.filter(j => j.localChargeTotal > 0 && j.localChargeInvoice && j.bank);
      for (const j of salesJobs) {
          const date = j.localChargeDate; 
          const docNo = `PT-LC-${j.jobCode}`;
          
          const defaultRow = {
            // View Fields
            date: date,
            docNo: docNo,
            objCode: getCustomerCode(j.customerId),
            objName: getCustomerName(j.customerId),
            desc: `Thu tiền hàng Job ${j.jobCode} (Inv: ${j.localChargeInvoice})`,
            amount: j.localChargeTotal,
            
            // Excel Fields
            col1: date,
            col2: date,
            col3: docNo,
            col4: getCustomerCode(j.customerId),
            col5: getCustomerName(j.customerId),
            col6: '',
            col7: '345673979999',
            col8: 'Ngân hàng TMCP Quân đội',
            col9: 'Thu khác',
            col10: `Thu tiền hàng Job ${j.jobCode} theo HĐ ${j.localChargeInvoice}`,
            col11: '',
            col12: 'VND',
            col13: '',
            col14: `Thu tiền hàng Job ${j.jobCode}`,
            col15: '1121',
            col16: '13111', // LOCAL CHARGE -> 13111
            col17: j.localChargeTotal,
            col18: '',
            col19: getCustomerCode(j.customerId),
            col20: ''
          };

          // MERGE WITH EDITS
          rows.push({ ...defaultRow, ...(editedRows[docNo] || {}) });
      }

      // Sort by Date
      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } 
    
    // ... Other modes logic kept simple for now
    else if (mode === 'chi') {
      const rows = [];
      for (const j of filteredJobs) {
        if (j.chiCuoc > 0 && j.ngayChiCuoc) {
          rows.push({
            date: j.ngayChiCuoc, docNo: `PC-C-${j.booking}`, content: 'Chi cược hãng tàu', objCode: j.line, desc: `Chi cược Booking ${j.booking}`, amount: j.chiCuoc
          });
        }
        if (j.chiPayment > 0) {
          const invDate = j.bookingCostDetails?.localCharge?.date;
          if (invDate) {
            rows.push({
              date: invDate, docNo: `PC-T-${j.booking}`, content: 'Thanh toán Local Charge', objCode: j.line, desc: `Thanh toán Booking ${j.booking}`, amount: j.chiPayment
            });
          }
        }
      }
      return rows;
    }
    else if (mode === 'ban') {
      const rows = [];
      for (const j of filteredJobs) {
        if (!j.localChargeInvoice) continue;
        const projectCode = getProjectCode(j);
        if (j.sell > 0) {
          rows.push({
            date: j.localChargeDate, docNo: `BH-${j.jobCode}`, objCode: getCustomerCode(j.customerId), desc: `Doanh thu cước ${j.jobCode}`, itemCode: 'SERVICE', amount: j.sell, vat: 0, project: projectCode
          });
        }
        if (j.localChargeTotal > 0) {
           rows.push({
            date: j.localChargeDate, docNo: `BH-${j.jobCode}-LC`, objCode: getCustomerCode(j.customerId), desc: `Local Charge ${j.jobCode}`, itemCode: 'LOCAL', amount: j.localChargeNet || j.localChargeTotal, vat: j.localChargeVat || 0, project: projectCode
          });
        }
      }
      return rows;
    }
    else if (mode === 'mua') {
      const processedBookings = new Set();
      const rows = [];
      for (const j of filteredJobs) {
        if (!j.booking || processedBookings.has(j.booking)) continue;
        if (j.bookingCostDetails) {
           const details = j.bookingCostDetails;
           if (details.localCharge && details.localCharge.total > 0 && details.localCharge.invoice) {
             rows.push({
               date: details.localCharge.date, docNo: `MH-${j.booking}`, invNo: details.localCharge.invoice, invDate: details.localCharge.date, vendorCode: j.line, desc: `Chi phí Booking ${j.booking}`, itemCode: 'SHIPPING', itemName: 'Cước vận chuyển/Local Charge', price: details.localCharge.net, vatRate: '5.263%', vatAmt: details.localCharge.vat
             });
           }
           if (details.extensionCosts) {
             details.extensionCosts.forEach((ext, idx) => {
                if (ext.invoice) {
                    rows.push({
                    date: ext.date, docNo: `MH-${j.booking}-E${idx}`, invNo: ext.invoice, invDate: ext.date, vendorCode: 'VENDOR', desc: `Chi phí khác Booking ${j.booking}`, itemCode: 'OTHERS', itemName: 'Chi phí khác', price: ext.net, vatRate: '8% or 10%', vatAmt: ext.vat
                    });
                }
             });
           }
        }
        processedBookings.add(j.booking);
      }
      return rows;
    }
    return [];
  }, [jobs, mode, filterMonth, customers, editedRows]); 

  // --- SELECTION HANDLERS ---
  const handleSelectAll = () => {
    // Only select unlocked items
    const unlockedRows = exportData.filter(r => !lockedIds.has(r.docNo));
    
    if (selectedIds.size === unlockedRows.length && unlockedRows.length > 0) {
        setSelectedIds(new Set());
    } else {
        const newSet = new Set<string>();
        unlockedRows.forEach(r => newSet.add(r.docNo));
        setSelectedIds(newSet);
    }
  };

  const handleSelectRow = (id: string) => {
    if (lockedIds.has(id)) return; // Can't select locked
    
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleResetLocks = () => {
    if (window.confirm("Bạn có chắc chắn muốn mở khóa tất cả các phiếu? Điều này cho phép xuất và chỉnh sửa lại.")) {
        setLockedIds(new Set());
    }
  };

  const toggleLock = (docNo: string) => {
    const newLocks = new Set(lockedIds);
    if (newLocks.has(docNo)) {
        newLocks.delete(docNo);
    } else {
        newLocks.add(docNo);
        // Also remove from selection if manually locked
        const newSelection = new Set(selectedIds);
        newSelection.delete(docNo);
        setSelectedIds(newSelection);
    }
    setLockedIds(newLocks);
  };

  // --- EXPORT FUNCTION ---
  const handleExport = () => {
    let csvRows: any[][] = [];
    
    // Determine which rows to export
    const rowsToExport = selectedIds.size > 0 
        ? exportData.filter(d => selectedIds.has(d.docNo))
        : [];

    if (rowsToExport.length === 0) {
        alert("Vui lòng chọn ít nhất một phiếu để xuất Excel.");
        return;
    }

    if (mode === 'thu') {
      // Map to the 20 columns
      csvRows = rowsToExport.map((d: any) => [
        d.col1, d.col2, d.col3, d.col4,
        d.col5, d.col6, d.col7, d.col8,
        d.col9, d.col10, d.col11, d.col12,
        d.col13, d.col14, d.col15, d.col16,
        d.col17, d.col18, d.col19, d.col20
      ]);
    } else {
      // Fallback for other modes
      if (mode === 'chi') csvRows = rowsToExport.map((d: any) => [d.date, d.docNo, d.content, d.objCode, d.desc, d.amount]);
      else if (mode === 'ban') csvRows = rowsToExport.map((d: any) => [d.date, d.docNo, d.objCode, d.desc, d.itemCode, d.amount, d.vat, d.project]);
      else if (mode === 'mua') csvRows = rowsToExport.map((d: any) => [d.date, d.docNo, d.invNo, d.invDate, d.vendorCode, d.desc, d.itemCode, d.itemName, d.price, d.vatRate, d.vatAmt]);
    }

    let wb: XLSX.WorkBook;
    let ws: XLSX.WorkSheet;

    if (templateWb) {
      wb = templateWb;
      const sheetName = wb.SheetNames[0];
      ws = wb.Sheets[sheetName];
      XLSX.utils.sheet_add_aoa(ws, csvRows, { origin: -1 });
    } else {
      let headers: string[] = [];
      if (mode === 'thu') {
         headers = [
            'Ngày hạch toán (*)', 'Ngày chứng từ (*)', 'Số chứng từ (*)', 'Mã đối tượng', 
            'Tên đối tượng', 'Địa chỉ', 'Nộp vào TK', 'Mở tại ngân hàng', 
            'Lý do thu', 'Diễn giải lý do thu', 'Mã nhân viên thu', 'Loại tiền', 
            'Tỷ giá', 'Diễn giải (hạch toán)', 'TK Nợ (*)', 'TK Có (*)', 
            'Số tiền', 'Quy đổi', 'Mã đối tượng (hạch toán)', 'Số khế ước đi vay'
          ];
      } else if (mode === 'chi') {
         headers = ['Ngày chứng từ', 'Số chứng từ', 'Nội dung TT', 'Mã đối tượng', 'Diễn giải', 'Số tiền'];
      } else if (mode === 'ban') {
         headers = ['Ngày chứng từ', 'Số chứng từ', 'Mã đối tượng', 'Diễn giải', 'Mã hàng', 'Số tiền', 'Thuế GTGT', 'Công trình'];
      } else if (mode === 'mua') {
         headers = ['Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Ngày hóa đơn', 'Mã NCC', 'Diễn giải', 'Mã hàng', 'Tên hàng', 'Đơn giá', 'Thuế GTGT', 'Tiền thuế GTGT'];
      }
      
      ws = XLSX.utils.aoa_to_sheet([headers, ...csvRows]);
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Amis Export");
    }

    XLSX.writeFile(wb, `amis_export_${mode}_${new Date().toISOString().slice(0,10)}.xlsx`);

    // LOCKING LOGIC: Lock ONLY exported rows
    if (mode === 'thu') {
        const newLocked = new Set(lockedIds);
        rowsToExport.forEach((r: any) => newLocked.add(r.docNo));
        setLockedIds(newLocked);
        
        // Clear selection after lock
        setSelectedIds(new Set());
    }
  };

  const titles = {
    thu: 'Phiếu Thu',
    chi: 'Phiếu Chi',
    ban: 'Phiếu Bán Hàng',
    mua: 'Phiếu Mua Hàng'
  };

  // --- MODAL SAVE ---
  const handleSaveEdit = (newData: any) => {
      const key = newData.docNo; 
      
      setEditedRows(prev => ({
          ...prev,
          [key]: {
              // Map form fields back to excel columns
              col1: newData.date,
              col2: newData.date,
              col3: newData.docNo,
              col4: newData.objCode,
              col5: newData.objName,
              col10: newData.desc,
              col14: newData.desc,
              col15: newData.tkNo,
              col16: newData.tkCo,
              col17: newData.amount,
              col19: newData.objCode,
              
              // Persist view fields
              date: newData.date,
              docNo: newData.docNo,
              objCode: newData.objCode,
              objName: newData.objName,
              desc: newData.desc,
              amount: newData.amount,
          }
      }));
      setSelectedItem(null);
  };

  // Calculate unlocked count for "Select All" checkbox state
  const unlockedCount = exportData.filter(r => !lockedIds.has(r.docNo)).length;
  const isAllSelected = unlockedCount > 0 && selectedIds.size === unlockedCount;

  return (
    <div className="p-8 max-w-full">
      {/* Hidden File Input for Template */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleTemplateUpload} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
             <FileUp className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Xuất Dữ Liệu AMIS</h1>
        </div>
        <p className="text-slate-500 ml-11 mb-4">Kết xuất dữ liệu kế toán: <span className="font-bold text-blue-600">{titles[mode]}</span></p>
        <div className="ml-11 mb-4 flex flex-col gap-2">
            <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded inline-block border border-orange-100 w-fit">
                <span className="font-bold">Lưu ý:</span> Chỉ xuất các dữ liệu đã có đầy đủ <strong>Ngày chứng từ</strong> và <strong>Số hóa đơn</strong>.
            </div>
            {mode === 'thu' && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded inline-block border border-blue-100 w-fit">
                    <span className="font-bold">Hướng dẫn:</span> Tích chọn các phiếu cần xuất -> Nhấn "Xuất Excel". Các phiếu đã xuất sẽ tự động bị <strong>Khóa</strong>.
                </div>
            )}
        </div>
        
        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center sticky top-0 z-20">
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

           <div className="flex space-x-2">
              <button 
                onClick={triggerFileUpload} 
                className={`bg-white border text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-sm ${templateName ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300'}`}
                title="Tải lên file Excel mẫu để ghi dữ liệu vào"
              >
                 {templateName ? <CheckCircle className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                 <span>{templateName ? 'Đã tải mẫu' : 'Cài đặt mẫu'}</span>
              </button>
              
              {mode === 'thu' && lockedIds.size > 0 && (
                  <button onClick={handleResetLocks} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-sm">
                      <RefreshCw className="w-4 h-4" />
                      <span>Mở khóa tất cả</span>
                  </button>
              )}

              <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>
                    {selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel'}
                  </span>
              </button>
           </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                {mode === 'thu' && (
                    <th className="px-6 py-3 w-10 text-center">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            title="Chọn tất cả phiếu chưa khóa"
                        />
                    </th>
                )}
                {mode === 'thu' && (
                  <>
                    <th className="px-6 py-3 w-10 text-center">Khóa</th>
                    <th className="px-6 py-3">Ngày CT</th>
                    <th className="px-6 py-3">Số CT</th>
                    <th className="px-6 py-3">Mã Đối Tượng</th>
                    <th className="px-6 py-3">Diễn giải</th>
                    <th className="px-6 py-3 text-right">Số tiền</th>
                    <th className="px-6 py-3 text-center w-20">Sửa</th>
                  </>
                )}
                {/* Headers for other modes... */}
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
                 exportData.map((row: any, idx) => {
                   const isLocked = mode === 'thu' && lockedIds.has(row.docNo);
                   const isSelected = selectedIds.has(row.docNo);

                   return (
                   <tr 
                      key={idx} 
                      className={`
                        ${isLocked ? 'bg-gray-100 text-gray-500' : 'hover:bg-blue-50'} 
                        ${isSelected ? 'bg-blue-50' : ''}
                        transition-colors
                      `}
                   >
                      {mode === 'thu' && (
                          <td className="px-6 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => handleSelectRow(row.docNo)}
                                disabled={isLocked}
                                className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              />
                          </td>
                      )}

                      {mode === 'thu' && (
                        <>
                          <td className="px-6 py-3 text-center">
                                <button onClick={() => toggleLock(row.docNo)} className="text-gray-400 hover:text-blue-600 focus:outline-none" title={isLocked ? "Mở khóa" : "Khóa"}>
                                    {isLocked ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 opacity-30" />}
                                </button>
                          </td>
                          <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                          <td className={`px-6 py-3 font-medium ${isLocked ? 'text-gray-600' : 'text-blue-600'}`}>{row.docNo}</td>
                          <td className="px-6 py-3">{row.objCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                          <td className="px-6 py-3 text-center">
                              {isLocked ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    Đã chốt
                                  </span>
                              ) : (
                                  <button onClick={() => setSelectedItem(row)} className="text-gray-400 hover:text-blue-500 hover:bg-blue-100 p-1 rounded transition-colors">
                                      <Edit3 className="w-4 h-4" />
                                  </button>
                              )}
                          </td>
                        </>
                      )}
                      
                      {/* Other Modes (Read Only for now) */}
                      {mode === 'chi' && (
                        <>
                          <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                          <td className="px-6 py-3 font-medium text-blue-600">{row.docNo}</td>
                          <td className="px-6 py-3">{row.content}</td>
                          <td className="px-6 py-3">{row.objCode}</td>
                          <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                        </>
                      )}
                      {mode === 'ban' && (
                        <>
                          <td className="px-6 py-3">{formatDateVN(row.date)}</td>
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
                          <td className="px-6 py-3">{formatDateVN(row.date)}</td>
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
                 )})
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-400">
                    Không có dữ liệu phù hợp (Vui lòng kiểm tra Ngày chứng từ & Số hóa đơn trong Job)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODERN EDIT MODAL FOR RECEIPT VOUCHER */}
      {selectedItem && mode === 'thu' && (
         <ReceiptDetailModal 
            data={selectedItem} 
            onClose={() => setSelectedItem(null)} 
            onSave={handleSaveEdit} 
         />
      )}
    </div>
  );
};

// --- SUB COMPONENT: MODERN EDIT FORM ---

const ReceiptDetailModal = ({ data, onClose, onSave }: { data: any, onClose: () => void, onSave: (data: any) => void }) => {
    // Local state for editing
    const [formData, setFormData] = useState({
        date: data.col1, // Ngay Hach Toan/Chung Tu
        docNo: data.col3,
        objCode: data.col4,
        objName: data.col5,
        desc: data.col10,
        amount: data.col17,
        tkNo: data.col15,
        tkCo: data.col16
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 border border-gray-200 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Phiếu Thu Tiền</h2>
                        <p className="text-xs text-slate-400 font-medium">{data.col9} - {data.col12}</p>
                    </div>
                 </div>
                 <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="overflow-y-auto p-8 bg-slate-50/50">
                 <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Section 1: General Info */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                            <Calendar className="w-3 h-3 mr-1.5" /> Thông tin chung
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">Ngày Chứng Từ / Hạch Toán</label>
                                <input 
                                    type="date" name="date" 
                                    value={formData.date} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">Số Chứng Từ</label>
                                <input 
                                    type="text" name="docNo" 
                                    value={formData.docNo} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Customer & Amount */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                            <User className="w-3 h-3 mr-1.5" /> Đối tượng & Số tiền
                        </h3>
                        <div className="grid grid-cols-3 gap-6 mb-4">
                             <div className="col-span-1 space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">Mã Đối Tượng</label>
                                <input 
                                    type="text" name="objCode" 
                                    value={formData.objCode} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                             </div>
                             <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">Tên Đối Tượng</label>
                                <input 
                                    type="text" name="objName" 
                                    value={formData.objName} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                             </div>
                        </div>
                        
                        <div className="space-y-1.5">
                             <label className="text-xs font-semibold text-gray-500 flex items-center">
                                <DollarSign className="w-3 h-3 mr-1" /> Số Tiền Thu
                             </label>
                             <div className="relative">
                                <input 
                                    type="number" name="amount" 
                                    value={formData.amount} onChange={handleChange} 
                                    className="w-full pl-3 pr-12 py-3 border border-blue-200 rounded-lg text-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30 focus:bg-white transition-colors text-right"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-300">VND</span>
                             </div>
                        </div>
                    </div>

                    {/* Section 3: Accounting & Description */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center">
                            <CreditCard className="w-3 h-3 mr-1.5" /> Hạch toán & Diễn giải
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-6 mb-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">TK Nợ</label>
                                <input 
                                    type="text" name="tkNo" 
                                    value={formData.tkNo} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-500">TK Có</label>
                                <input 
                                    type="text" name="tkCo" 
                                    value={formData.tkCo} onChange={handleChange} 
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Diễn giải lý do thu</label>
                            <textarea 
                                name="desc" 
                                value={formData.desc} onChange={handleChange} 
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors resize-none"
                            />
                        </div>
                    </div>

                    {/* Default Info (Read only visual) */}
                    <div className="flex items-center space-x-2 text-xs text-gray-400 px-2">
                        <CheckCircle className="w-3 h-3" />
                        <span>Mặc định: Ngân hàng TMCP Quân đội (MB) - TK: 345673979999</span>
                    </div>

                 </form>
              </div>

              {/* Footer Actions */}
              <div className="px-8 py-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-end space-x-3">
                 <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                    Hủy bỏ
                 </button>
                 <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center">
                    <Save className="w-4 h-4 mr-2" /> Lưu Thay Đổi
                 </button>
              </div>
           </div>
        </div>
    );
};
