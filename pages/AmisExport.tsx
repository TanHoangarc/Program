import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { FileUp, FileSpreadsheet, Filter, X, Settings, Upload, CheckCircle, Save, Edit3, Calendar, CreditCard, User, FileText, DollarSign, Lock, RefreshCw, Unlock, Banknote, ShoppingCart, ShoppingBag } from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';
import { formatDateVN, calculateBookingSummary } from '../utils';
import { PaymentVoucherModal } from '../components/PaymentVoucherModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseInvoiceModal } from '../components/PurchaseInvoiceModal';

interface AmisExportProps {
  jobs: JobData[];
  customers: Customer[];
  mode: 'thu' | 'chi' | 'ban' | 'mua';
}

export const AmisExport: React.FC<AmisExportProps> = ({ jobs, customers, mode }) => {
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<JobData | null>(null);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<any | null>(null);
  
  // State to store edited rows keyed by DocNo
  const [editedRows, setEditedRows] = useState<Record<string, any>>({});
  
  // Selection & Locking State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem(`amis_locked_${mode}_v1`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
        return new Set();
    }
  });

  // Template State
  const [templateWb, setTemplateWb] = useState<XLSX.WorkBook | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock Lines data since not passed in props (can be improved by updating parent)
  // For now we rely on booking.line as code and name if not available
  const mockLines: ShippingLine[] = [];

  // Save locks whenever they change
  useEffect(() => {
    localStorage.setItem(`amis_locked_${mode}_v1`, JSON.stringify(Array.from(lockedIds)));
  }, [lockedIds, mode]);

  // Reset selection when mode or filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, filterMonth]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const getCustomerCode = (id: string) => customers.find(c => c.id === id)?.code || id;
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || '';

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

  const triggerFileUpload = () => fileInputRef.current?.click();

  // --- DATA TRANSFORMATION LOGIC ---
  const exportData = useMemo(() => {
    let filteredJobs = jobs;
    if (filterMonth) {
      filteredJobs = jobs.filter(j => j.month === filterMonth);
    }

    // --- MODE THU ---
    if (mode === 'thu') {
      const rows: any[] = [];
      filteredJobs.filter(j => j.thuCuoc > 0 && j.ngayThuCuoc).forEach(j => {
         const docNo = `PT-C-${j.jobCode}`;
         const desc = `Thu tiền khách hàng CƯỢC BL ${j.jobCode}`;
         rows.push({
             date: j.ngayThuCuoc, docNo, objCode: getCustomerCode(j.maKhCuocId), objName: getCustomerName(j.maKhCuocId),
             desc, amount: j.thuCuoc, tkNo: '1121', tkCo: '1388', 
             col1: j.ngayThuCuoc, col2: j.ngayThuCuoc, col3: docNo, col4: getCustomerCode(j.maKhCuocId), col5: getCustomerName(j.maKhCuocId),
             col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '1388', col17: j.thuCuoc, col19: getCustomerCode(j.maKhCuocId),
             ...(editedRows[docNo] || {})
         });
      });
      filteredJobs.filter(j => j.localChargeTotal > 0 && j.localChargeInvoice && j.bank).forEach(j => {
          const docNo = `PT-LC-${j.jobCode}`;
          const desc = `Thu tiền khách hàng theo hoá đơn ${j.localChargeInvoice} (KIM)`;
           rows.push({
               date: j.localChargeDate, docNo, objCode: getCustomerCode(j.customerId), objName: getCustomerName(j.customerId),
               desc, amount: j.localChargeTotal, tkNo: '1121', tkCo: '13111',
               col1: j.localChargeDate, col2: j.localChargeDate, col3: docNo, col4: getCustomerCode(j.customerId), col5: getCustomerName(j.customerId),
               col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '13111', col17: j.localChargeTotal, col19: getCustomerCode(j.customerId),
               ...(editedRows[docNo] || {})
           });
      });
      filteredJobs.forEach(j => {
          (j.extensions || []).forEach((ext, idx) => {
              if (ext.total > 0 && ext.invoice) {
                  const docNo = `PT-GH-${j.jobCode}-${idx + 1}`;
                  const desc = `Thu tiền khách hàng theo hoá đơn GH ${ext.invoice}`;
                  const custId = ext.customerId || j.customerId;
                  rows.push({
                      date: ext.invoiceDate, docNo, objCode: getCustomerCode(custId), objName: getCustomerName(custId),
                      desc, amount: ext.total, tkNo: '1121', tkCo: '13111',
                      col1: ext.invoiceDate, col2: ext.invoiceDate, col3: docNo, col4: getCustomerCode(custId), col5: getCustomerName(custId),
                      col7: '345673979999', col8: 'Ngân hàng TMCP Quân đội', col9: 'Thu khác', col10: desc, col12: 'VND', col14: desc, col15: '1121', col16: '13111', col17: ext.total, col19: getCustomerCode(custId),
                      ...(editedRows[docNo] || {})
                  });
              }
          });
      });
      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } 
    // --- MODE CHI ---
    else if (mode === 'chi') {
        const rows: any[] = [];
        filteredJobs.filter(j => j.chiPayment > 0).forEach(j => {
             const date = j.bookingCostDetails?.localCharge?.date || j.localChargeDate || new Date().toISOString().split('T')[0];
             const docNo = `UNC-${j.jobCode}-L`;
             const content = `Chi tiền cho ncc ${j.line} lô ${j.jobCode}`;
             const objCode = j.line; 
             
             rows.push({
                 date, docNo, objCode, objName: '', desc: content, amount: j.chiPayment,
                 reason: 'Chi khác',
                 paymentContent: content,
                 paymentAccount: '345673979999',
                 paymentBank: 'Ngân hàng TMCP Quân đội',
                 address: '', receiverAccount: '', receiverBank: '', receiverName: '',
                 currency: 'VND', description: content, tkNo: '3311', tkCo: '1121',
                 ...(editedRows[docNo] || {})
             });
        });
        filteredJobs.filter(j => j.chiCuoc > 0).forEach(j => {
             const date = j.ngayChiCuoc || new Date().toISOString().split('T')[0];
             const docNo = `UNC-${j.jobCode}-C`;
             const content = `Chi cược hãng tàu ${j.line} lô ${j.jobCode}`;
             
             rows.push({
                 date, docNo, objCode: j.line, objName: '', desc: content, amount: j.chiCuoc,
                 reason: 'Chi khác', paymentContent: content,
                 paymentAccount: '345673979999', paymentBank: 'Ngân hàng TMCP Quân đội',
                 currency: 'VND', description: content, tkNo: '3311', tkCo: '1121',
                 ...(editedRows[docNo] || {})
             });
        });
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    // --- MODE BAN ---
    else if (mode === 'ban') {
        const rows: any[] = [];
        filteredJobs.filter(j => j.sell > 0).forEach(j => {
            const date = new Date().toISOString().split('T')[0];
            const docNo = `PBH-${j.jobCode}`;
            const year = new Date().getFullYear().toString().slice(-2);
            const month = (j.month || '01').padStart(2, '0');
            const defaultProjectCode = `K${year}${month}${j.jobCode}`;
            const desc = `Bán hàng LONG HOÀNG - KIMBERRY BILL ${j.booking || ''} là cost ${j.hbl || ''} (không xuất hóa đơn)`;
            rows.push({
                originalJob: j, // Store ref for modal
                date,
                docDate: date,
                docNo,
                customerCode: 'LONGHOANGKIMBERRY',
                desc,
                amount: j.sell, // Don gia / Thanh tien (Quantity 1)
                
                // Defaults for Excel
                salesType: 'Bán hàng hóa trong nước',
                paymentMethod: 'Chưa thu tiền',
                isDeliveryVoucher: 'Không',
                isInvoiceIncluded: 'Không',
                currency: 'VND',
                itemCode: 'AGENT FEE',
                isNote: 'Không',
                tkNo: '13112',
                tkCo: '51111',
                quantity: 1,
                vatRate: '0%',
                tkVat: '33311',
                projectCode: defaultProjectCode,
                
                ...(editedRows[docNo] || {})
            });
        });
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    // --- MODE MUA ---
    else if (mode === 'mua') {
        const bookingIds = Array.from(new Set(filteredJobs.map(j => j.booking).filter(b => !!b)));
        const rows: any[] = [];

        bookingIds.forEach(bid => {
            const summary = calculateBookingSummary(filteredJobs, bid);
            if (!summary) return;

            const lcDetails = summary.costDetails.localCharge;
            const additional = summary.costDetails.additionalLocalCharges || [];
            
            const totalNet = (lcDetails.net || 0) + additional.reduce((s,i) => s + (i.net || 0), 0);
            
            if (totalNet > 0) {
                const docNo = `PMH-${summary.bookingId}`;
                const date = lcDetails.date || new Date().toISOString().split('T')[0];
                const supplierName = summary.line; 
                const desc = `Mua hàng của ${supplierName} BILL ${summary.bookingId}`;
                
                rows.push({
                    originalBooking: summary,
                    date, 
                    docNo,
                    invoiceNo: lcDetails.invoice || '',
                    supplierCode: summary.line,
                    supplierName,
                    desc,
                    itemName: 'Phí Local Charge',
                    amount: totalNet,
                    // Excel Defaults
                    purchaseType: 'Mua hàng trong nước không qua kho',
                    paymentMethod: 'Chưa thanh toán',
                    invoiceIncluded: 'Nhận kèm hóa đơn',
                    importSlipNo: '1',
                    currency: 'VND',
                    itemCode: 'LCC',
                    isNote: 'Không',
                    tkCost: '63211',
                    tkPayable: '3311',
                    quantity: 1,
                    vatRate: '5%',
                    vatAmount: (lcDetails.vat || 0) + additional.reduce((s,i) => s + (i.vat || 0), 0),
                    tkVat: '1331',
                    ...(editedRows[docNo] || {})
                });
            }
        });
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return [];
  }, [jobs, mode, filterMonth, customers, editedRows]); 

  // --- SELECTION HANDLERS ---
  const handleSelectAll = () => {
    const unlockedRows = exportData.filter(r => !lockedIds.has(r.docNo));
    if (selectedIds.size === unlockedRows.length && unlockedRows.length > 0) setSelectedIds(new Set());
    else {
        const newSet = new Set<string>();
        unlockedRows.forEach(r => newSet.add(r.docNo));
        setSelectedIds(newSet);
    }
  };

  const handleSelectRow = (id: string) => {
    if (lockedIds.has(id)) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleLock = (docNo: string) => {
    const newLocks = new Set(lockedIds);
    if (newLocks.has(docNo)) newLocks.delete(docNo);
    else {
        newLocks.add(docNo);
        const newSelection = new Set(selectedIds);
        newSelection.delete(docNo);
        setSelectedIds(newSelection);
    }
    setLockedIds(newLocks);
  };

  const handleEditClick = (row: any) => {
      setSelectedItem(row);
      if (mode === 'ban') {
          setSelectedJobForModal(row.originalJob);
      } else if (mode === 'mua') {
          setSelectedBookingForModal(row.originalBooking);
      }
  };

  // --- EXPORT ---
  const handleExport = () => {
    const rowsToExport = selectedIds.size > 0 ? exportData.filter(d => selectedIds.has(d.docNo)) : [];
    if (rowsToExport.length === 0) {
        alert("Vui lòng chọn ít nhất một phiếu để xuất Excel.");
        return;
    }

    let csvRows: any[][] = [];
    if (mode === 'thu') {
      csvRows = rowsToExport.map((d: any) => [
        d.col1, d.col2, d.col3, d.col4, d.col5, d.col6, d.col7, d.col8, d.col9, d.col10, d.col11, d.col12,
        d.col13, d.col14, d.col15, d.col16, d.col17, d.col18, d.col19, d.col20
      ]);
    } else if (mode === 'chi') {
        csvRows = rowsToExport.map((d: any) => [
            d.date, d.date, d.docNo, d.reason || 'Chi khác', d.paymentContent,
            d.paymentAccount || '345673979999', d.paymentBank || 'Ngân hàng TMCP Quân đội',
            d.objCode, d.objName, d.address, d.receiverAccount, d.receiverBank, d.receiverName,
            '', '', '', '', d.currency || 'VND', d.rate, d.description,
            d.tkNo || '3311', d.tkCo || '1121', d.amount, d.amount,
            d.objCodeAccounting || d.objCode, d.loanContract
        ]);
    } else if (mode === 'ban') {
        csvRows = rowsToExport.map((d: any) => [
            d.date, d.docDate, d.docNo, d.salesType, d.paymentMethod, d.customerCode, d.desc, d.itemCode,
            d.tkNo, d.tkCo, d.quantity, d.amount, d.amount, d.vatRate, d.tkVat, d.projectCode,
            d.isDeliveryVoucher, d.isInvoiceIncluded, d.currency, d.isNote
        ]);
    } else if (mode === 'mua') {
        csvRows = rowsToExport.map((d: any) => [
            d.purchaseType, d.paymentMethod, d.invoiceIncluded, d.date, d.date, d.importSlipNo, d.docNo,
            '', '', d.invoiceNo, d.date, d.supplierCode, d.supplierName, '', '', d.desc,
            d.itemCode, d.itemName, d.tkCost, d.tkPayable, '', d.quantity, d.amount, d.amount,
            d.vatRate, d.vatAmount, d.tkVat
        ]);
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
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Nộp vào TK', 'Mở tại NH', 'Lý do thu', 'Diễn giải lý do', 'NV thu', 'Loại tiền', 'Tỷ giá', 'Diễn giải HT', 'TK Nợ', 'TK Có', 'Số tiền', 'Quy đổi', 'Mã ĐT HT', 'Khế ước'];
      } else if (mode === 'chi') {
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Lý do chi', 'Nội dung TT', 'Số TK chi', 'Tên NH chi', 'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Số TK nhận', 'Tên NH nhận', 'Người lĩnh', 'CMND', 'Ngày cấp', 'Nơi cấp', 'Mã NV', 'Loại tiền', 'Tỷ giá', 'Diễn giải HT', 'TK Nợ', 'TK Có', 'Số tiền', 'Quy đổi', 'Mã ĐT HT', 'Khế ước'];
      } else if (mode === 'ban') {
         headers = ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Hình thức bán hàng', 'Phương thức TT', 'Mã khách hàng', 'Diễn giải', 'Mã hàng', 'TK Nợ', 'TK Có', 'Số lượng', 'Đơn giá', 'Thành tiền', '% Thuế GTGT', 'TK Thuế GTGT', 'Mã công trình', 'Kiêm phiếu XK', 'Lập kèm HĐ', 'Loại tiền', 'Là dòng ghi chú'];
      } else if (mode === 'mua') {
         headers = ['Hình thức mua hàng', 'Phương thức thanh toán', 'Nhận kèm hóa đơn', 'Ngày hạch toán', 'Ngày chứng từ', 'Số phiếu nhập', 'Số chứng từ', 'Mẫu số HĐ', 'Ký hiệu HĐ', 'Số hóa đơn', 'Ngày hóa đơn', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Địa chỉ', 'MST', 'Diễn giải', 'Mã hàng', 'Tên hàng', 'TK kho/chi phí', 'TK công nợ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', '% Thuế GTGT', 'Tiền thuế GTGT', 'TK thuế GTGT'];
      }
      ws = XLSX.utils.aoa_to_sheet([headers, ...csvRows]);
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Amis Export");
    }

    XLSX.writeFile(wb, `amis_export_${mode}_${new Date().toISOString().slice(0,10)}.xlsx`);

    // Lock exported rows
    const newLocked = new Set(lockedIds);
    rowsToExport.forEach((r: any) => newLocked.add(r.docNo));
    setLockedIds(newLocked);
    setSelectedIds(new Set());
  };

  const titles = { thu: 'Phiếu Thu Tiền', chi: 'Phiếu Chi Tiền', ban: 'Phiếu Bán Hàng', mua: 'Phiếu Mua Hàng' };
  const unlockedCount = exportData.filter(r => !lockedIds.has(r.docNo)).length;
  const isAllSelected = unlockedCount > 0 && selectedIds.size === unlockedCount;

  // --- SAVE EDIT ---
  const handleSaveEdit = (newData: any) => {
     // Save merged data back to editedRows
     setEditedRows(prev => ({
         ...prev,
         [newData.docNo]: newData
     }));
     setSelectedItem(null);
     setSelectedJobForModal(null);
     setSelectedBookingForModal(null);
  };
  
  const isInteractiveMode = mode === 'thu' || mode === 'chi' || mode === 'ban' || mode === 'mua';

  return (
    <div className="p-8 max-w-full">
      <input type="file" ref={fileInputRef} onChange={handleTemplateUpload} accept=".xlsx, .xls" className="hidden" />

      <div className="mb-6">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className={`p-2 rounded-lg ${mode === 'chi' ? 'bg-red-100 text-red-700' : mode === 'ban' ? 'bg-purple-100 text-purple-700' : mode === 'mua' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
             {mode === 'chi' ? <Banknote className="w-6 h-6" /> : mode === 'ban' ? <ShoppingCart className="w-6 h-6" /> : mode === 'mua' ? <ShoppingBag className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
           </div>
           <h1 className="text-3xl font-bold">Xuất Dữ Liệu AMIS</h1>
        </div>
        <p className="text-slate-500 ml-11 mb-4">Kết xuất dữ liệu kế toán: <span className="font-bold text-blue-600">{titles[mode]}</span></p>
        
        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center sticky top-0 z-20">
           <div className="flex items-center space-x-4">
              <div className="flex items-center text-slate-500 font-medium"><Filter className="w-4 h-4 mr-2" /> Lọc tháng:</div>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm w-48">
                <option value="">Tất cả</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
           </div>
           <div className="flex space-x-2">
              <button onClick={triggerFileUpload} className="bg-white border hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center space-x-2 text-gray-700">
                 {templateName ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />} <span>{templateName ? 'Đã tải mẫu' : 'Cài đặt mẫu'}</span>
              </button>
              {isInteractiveMode && lockedIds.size > 0 && (
                  <button onClick={() => setLockedIds(new Set())} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4" /> <span>Mở khóa tất cả</span>
                  </button>
              )}
              <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-md">
                  <FileSpreadsheet className="w-5 h-5" /> <span>{selectedIds.size > 0 ? `Xuất Excel (${selectedIds.size})` : 'Xuất Excel'}</span>
              </button>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-gray-200 uppercase text-xs">
              <tr>
                {isInteractiveMode && (
                    <th className="px-6 py-3 w-10 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={isAllSelected} onChange={handleSelectAll} />
                    </th>
                )}
                {isInteractiveMode && <th className="px-6 py-3 w-10 text-center">Khóa</th>}
                <th className="px-6 py-3">Ngày CT</th>
                <th className="px-6 py-3">Số CT</th>
                <th className="px-6 py-3">Đối Tượng</th>
                <th className="px-6 py-3">Diễn giải</th>
                <th className="px-6 py-3 text-right">Số tiền</th>
                {isInteractiveMode && <th className="px-6 py-3 text-center w-20">Sửa</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exportData.length > 0 ? (
                 exportData.map((row: any, idx) => {
                   const isLocked = isInteractiveMode && lockedIds.has(row.docNo);
                   const isSelected = selectedIds.has(row.docNo);

                   // Display mapping for different modes
                   const objCode = mode === 'ban' ? row.customerCode : mode === 'mua' ? row.supplierCode : row.objCode;
                   // const desc = mode === 'ban' ? row.desc : row.desc;

                   return (
                   <tr key={idx} className={`${isLocked ? 'bg-gray-100 text-gray-500' : 'hover:bg-blue-50'} ${isSelected ? 'bg-blue-50' : ''}`}>
                      {isInteractiveMode && (
                          <td className="px-6 py-3 text-center">
                              <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(row.docNo)} disabled={isLocked} className="w-4 h-4 rounded border-gray-300" />
                          </td>
                      )}
                      {isInteractiveMode && (
                        <td className="px-6 py-3 text-center">
                             <button onClick={() => toggleLock(row.docNo)} className="text-gray-400 hover:text-blue-600">
                                {isLocked ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 opacity-30" />}
                             </button>
                        </td>
                      )}
                      
                      <td className="px-6 py-3">{formatDateVN(row.date)}</td>
                      <td className={`px-6 py-3 font-medium ${isLocked ? 'text-gray-600' : 'text-blue-600'}`}>{row.docNo}</td>
                      <td className="px-6 py-3">{objCode}</td>
                      <td className="px-6 py-3 truncate max-w-xs">{row.desc}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                      
                      {isInteractiveMode && (
                          <td className="px-6 py-3 text-center">
                              {!isLocked && (
                                  <button onClick={() => handleEditClick(row)} className="text-gray-400 hover:text-blue-500 hover:bg-blue-100 p-1 rounded">
                                      <Edit3 className="w-4 h-4" />
                                  </button>
                              )}
                          </td>
                      )}
                   </tr>
                 )})
              ) : (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">Không có dữ liệu phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modals */}
      {selectedItem && mode === 'thu' && (
         <ReceiptDetailModal data={selectedItem} onClose={() => setSelectedItem(null)} onSave={handleSaveEdit} />
      )}

      {selectedItem && mode === 'chi' && (
         <PaymentVoucherModal 
            isOpen={true} 
            initialData={selectedItem}
            onClose={() => setSelectedItem(null)} 
            onSave={handleSaveEdit} 
         />
      )}

      {selectedItem && mode === 'ban' && selectedJobForModal && (
          <SalesInvoiceModal
             isOpen={true}
             job={selectedJobForModal}
             initialData={selectedItem}
             onClose={() => { setSelectedItem(null); setSelectedJobForModal(null); }}
             onSave={handleSaveEdit}
          />
      )}

      {selectedItem && mode === 'mua' && selectedBookingForModal && (
          <PurchaseInvoiceModal
             isOpen={true}
             booking={selectedBookingForModal}
             initialData={selectedItem}
             lines={mockLines}
             onClose={() => { setSelectedItem(null); setSelectedBookingForModal(null); }}
             onSave={handleSaveEdit}
          />
      )}
    </div>
  );
};

// ... ReceiptDetailModal ...
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
        onSave({
             ...data,
             col1: formData.date,
             col2: formData.date,
             col3: formData.docNo,
             col4: formData.objCode,
             col5: formData.objName,
             col10: formData.desc,
             col14: formData.desc,
             col15: formData.tkNo,
             col16: formData.tkCo,
             col17: formData.amount,
             col19: formData.objCode,
             // Update view props too for immediate UI refresh
             date: formData.date,
             docNo: formData.docNo,
             objCode: formData.objCode,
             desc: formData.desc,
             amount: formData.amount
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 border border-gray-200 flex flex-col max-h-[90vh]">
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                    <div><h2 className="text-xl font-bold text-slate-800">Phiếu Thu Tiền</h2></div>
                 </div>
                 <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-8 bg-slate-50/50 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500">Ngày CT</label><input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-xs font-bold text-gray-500">Số CT</label><input type="text" name="docNo" value={formData.docNo} onChange={handleChange} className="w-full p-2 border rounded font-bold text-blue-600" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500">Mã Đối Tượng</label><input type="text" name="objCode" value={formData.objCode} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-xs font-bold text-gray-500">Số Tiền</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} className="w-full p-2 border rounded font-bold" /></div>
                 </div>
                 <div><label className="text-xs font-bold text-gray-500">Diễn giải</label><textarea name="desc" value={formData.desc} onChange={handleChange} className="w-full p-2 border rounded" rows={2} /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500">TK Nợ</label><input type="text" name="tkNo" value={formData.tkNo} onChange={handleChange} className="w-full p-2 border rounded text-center" /></div>
                    <div><label className="text-xs font-bold text-gray-500">TK Có</label><input type="text" name="tkCo" value={formData.tkCo} onChange={handleChange} className="w-full p-2 border rounded text-center" /></div>
                 </div>
                 <div className="flex justify-end pt-4"><button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded shadow">Lưu Thay Đổi</button></div>
              </div>
           </div>
        </div>
    );
};