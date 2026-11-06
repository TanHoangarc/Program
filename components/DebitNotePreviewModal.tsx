import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, Edit3, Check, RotateCcw, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { JobData, Customer } from '../types';
import { readVietnameseNumber, lookupCompanyTaxInfo } from '../utils';

export const FEE_INVOICE_NAMES: Record<string, string> = {
  'DO phí': 'Phí lệnh giao hàng',
  'THC': 'Phí xếp dỡ',
  'Cleaning container fee': 'Phí vệ sinh container',
  'EMC FEE': 'Phụ phí (EMC)',
  'CIC': 'Phí phụ trội hàng nhập',
  'PCS FEE': 'Phí kẹt cầu cảng',
};

// Official Assets provided by user
const ASSETS = {
  VIEN: '/assets/aistudio/Vien_6d4b243f.jpg',
  LOGO: '/assets/aistudio/Logo_8d30e1f0.jpg',
  HIDE_LOGO: '/assets/aistudio/HideLogo_cbc9994e.jpg',
  QR: '/assets/aistudio/QR_4ba50029.jpg',
};

interface FeeRow {
  id: string;
  fee: string;
  price: number;
  unit: string;
  quantity: number;
  vat: number;
  total: number;
  jobCode: string;
}

interface DebitNotePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCode: string;
  matchedJob?: JobData | null;
  customer?: Customer | null;
  rows: FeeRow[];
  vatRate: number;
  initialTaxCode?: string;
  initialTaxName?: string;
  initialTaxAddress?: string;
  vessel?: string;
  pol?: string;
  pod?: string;
}

export const DebitNotePreviewModal: React.FC<DebitNotePreviewModalProps> = ({
  isOpen,
  onClose,
  jobCode,
  matchedJob,
  customer,
  rows,
  vatRate,
  initialTaxCode = '',
  initialTaxName = '',
  initialTaxAddress = '',
  vessel = '',
  pol = '',
  pod = '',
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Editable fields for fine-tuning invoice details
  const today = new Date();
  const [invoiceDate, setInvoiceDate] = useState(() => {
    return {
      day: String(today.getDate()).padStart(2, '0'),
      month: String(today.getMonth() + 1).padStart(2, '0'),
      year: String(today.getFullYear()),
    };
  });

  const [invoiceSymbol, setInvoiceSymbol] = useState(() => {
    const yy = today.getFullYear().toString().slice(-2);
    return `1C${yy}TYY`;
  });

  const [buyerName, setBuyerName] = useState(() => {
    return initialTaxName || customer?.name || matchedJob?.customerName || '';
  });

  const [buyerTaxCode, setBuyerTaxCode] = useState(() => {
    return initialTaxCode || customer?.mst || '';
  });

  const [buyerAddress, setBuyerAddress] = useState(() => {
    return initialTaxAddress || '';
  });

  const [blNumber, setBlNumber] = useState(() => {
    return matchedJob?.jobCode || jobCode || matchedJob?.hbl || matchedJob?.booking || '';
  });

  const [vesselVal, setVesselVal] = useState(() => vessel || '');
  const [polVal, setPolVal] = useState(() => pol || '');
  const [podVal, setPodVal] = useState(() => pod || '');

  const [isEditing, setIsEditing] = useState(false);
  const [zoomScale, setZoomScale] = useState<number>(0.95);
  const [isLookingUpInModal, setIsLookingUpInModal] = useState(false);

  // Đồng bộ thông tin Khách hàng của Job và Địa chỉ mỗi khi mở modal hoặc thay đổi job
  useEffect(() => {
    if (isOpen) {
      const name = initialTaxName || customer?.name || matchedJob?.customerName || '';
      const mst = initialTaxCode || customer?.mst || '';
      const address = initialTaxAddress || '';
      const bl = matchedJob?.jobCode || jobCode || matchedJob?.hbl || matchedJob?.booking || '';

      setBuyerName(name);
      setBuyerTaxCode(mst);
      setBuyerAddress(address);
      setBlNumber(bl);
      setVesselVal(vessel || '');
      setPolVal(pol || '');
      setPodVal(pod || '');

      // TỰ ĐỘNG tra cứu và điền địa chỉ vào hóa đơn nếu chưa có địa chỉ và có MST
      if (!address && mst) {
        setIsLookingUpInModal(true);
        lookupCompanyTaxInfo(mst).then(info => {
          if (info && info.address) {
            setBuyerAddress(info.address);
          }
          if (info && info.name && !name) {
            setBuyerName(info.name);
          }
        }).finally(() => {
          setIsLookingUpInModal(false);
        });
      }
    }
  }, [isOpen, initialTaxName, initialTaxCode, initialTaxAddress, customer, matchedJob, jobCode, vessel, pol, pod]);

  const handleLookupInModal = async () => {
    if (!buyerTaxCode) return;
    setIsLookingUpInModal(true);
    try {
      const info = await lookupCompanyTaxInfo(buyerTaxCode.trim());
      if (info && info.address) {
        setBuyerAddress(info.address);
        if (info.name && !buyerName) setBuyerName(info.name);
      } else {
        window.open(`https://masothue.com/Search/?q=${encodeURIComponent(buyerTaxCode.trim())}`, '_blank');
      }
    } catch {
      window.open(`https://masothue.com/Search/?q=${encodeURIComponent(buyerTaxCode.trim())}`, '_blank');
    } finally {
      setIsLookingUpInModal(false);
    }
  };

  // Helper formatters for additional shipping info
  const formatVesselText = (val: string) => {
    const trimmed = val.trim();
    if (/^vessel(\/voy)?:\s*/i.test(trimmed)) {
      return trimmed;
    }
    return `Vessel/Voy: ${trimmed}`;
  };

  const formatPolText = (val: string) => {
    const trimmed = val.trim();
    if (/^pol:\s*/i.test(trimmed)) {
      return trimmed;
    }
    return `POL: ${trimmed}`;
  };

  const formatPodText = (val: string) => {
    const trimmed = val.trim();
    if (/^pod:\s*/i.test(trimmed)) {
      return trimmed;
    }
    return `POD: ${trimmed}`;
  };

  // Calculations
  const subTotal = rows.reduce((sum, r) => sum + (r.price * r.quantity), 0);
  const vatAmount = Math.round(subTotal * (vatRate / 100));
  const grandTotal = subTotal + vatAmount;
  const wordsTotal = readVietnameseNumber(grandTotal);
  const extraRowsCount = (vesselVal?.trim() ? 1 : 0) + (polVal?.trim() ? 1 : 0) + (podVal?.trim() ? 1 : 0);
  const emptyRowsCount = Math.max(1, 8 - rows.length - extraRowsCount);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) return;

    // Collect all CSS rules from existing stylesheets to embed every compiled Tailwind utility directly
    let embeddedRules = '';
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            for (const rule of Array.from(sheet.cssRules)) {
              embeddedRules += rule.cssText + '\n';
            }
          }
        } catch {
          // Ignore cross-origin security restrictions
        }
      }
    } catch {
      // Fallback
    }

    // Also collect all style and link elements from host document
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <title>Hoa_don_Nhap_${blNumber || jobCode || 'A4'}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
    ${styleTags}
    <style>
      ${embeddedRules}
    </style>
    <style>
      @page {
        size: 210mm 297mm;
        margin: 0mm !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
        overflow: hidden !important;
      }
      .a4-print-sheet {
        width: 210mm !important;
        height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        position: relative !important;
        background: #ffffff !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
      }
      .a4-border-frame {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: fill !important;
        z-index: 0 !important;
        pointer-events: none !important;
      }
      .watermark-container {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: none !important;
        z-index: 0 !important;
        overflow: hidden !important;
      }
      .watermark-img {
        width: 230px !important;
        max-width: 42% !important;
        height: auto !important;
        opacity: 0.15 !important;
        mix-blend-mode: multiply !important;
      }
      .a4-content {
        position: relative !important;
        z-index: 10 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        padding: 13mm 14mm 10mm 14mm !important;
        box-sizing: border-box !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
      }
      /* Fallback utility styles for print */
      .flex { display: flex !important; }
      .flex-col { flex-direction: column !important; }
      .justify-between { justify-content: space-between !important; }
      .items-start { align-items: flex-start !important; }
      .items-center { align-items: center !important; }
      .grid { display: grid !important; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .relative { position: relative !important; }
      .absolute { position: absolute !important; }
      .inset-0 { inset: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
      .w-full { width: 100% !important; }
      .h-full { height: 100% !important; }
      .shrink-0 { flex-shrink: 0 !important; }
      .flex-1 { flex: 1 1 0% !important; }
      .text-center { text-align: center !important; }
      .text-left { text-align: left !important; }
      .text-right { text-align: right !important; }
      .font-bold { font-weight: bold !important; }
      .font-normal { font-weight: normal !important; }
      .italic { font-style: italic !important; }
      .uppercase { text-transform: uppercase !important; }
      .invisible { visibility: hidden !important; }

      /* Table layout & borders */
      table, table.invoice-table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
        border: 1px solid #334155 !important;
      }
      table th, table td, table.invoice-table th, table.invoice-table td {
        border-left: 1px solid #334155 !important;
        border-right: 1px solid #334155 !important;
        padding: 3px 5px !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
        font-size: 12px !important;
        box-sizing: border-box !important;
      }
      table thead tr, table.invoice-table thead tr {
        border-top: 1px solid #334155 !important;
        border-bottom: 1px solid #334155 !important;
        background-color: transparent !important;
      }
      table thead th, table.invoice-table thead th {
        background-color: transparent !important;
        font-weight: bold !important;
        text-align: center !important;
        font-size: 12px !important;
        padding: 4px 4px !important;
      }
      .row-dashed td {
        border-bottom: 1px dashed #94a3b8 !important;
      }
      .row-solid td {
        border-bottom: 1px solid #334155 !important;
      }
      .border-r {
        border-right: 1px solid #334155 !important;
      }
      .border-b {
        border-bottom: 1px solid #334155 !important;
      }
      .digital-signature-box {
        border: 1.5px solid #48a05b !important;
        background-color: #ebf8ee !important;
        padding: 8px 12px !important;
        width: 260px !important;
        text-align: left !important;
        box-sizing: border-box !important;
        margin: 8px auto 0 auto !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
      }
      .digital-signature-box * {
        color: #cc0000 !important;
        font-family: 'Times New Roman', 'Tinos', Times, serif !important;
      }
    </style>
  </head>
  <body>
    <div class="a4-print-sheet">
      ${printContent.innerHTML}
    </div>
  </body>
</html>`;

    // Remove any previously created print iframe
    const oldIframe = document.getElementById('debit-note-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'debit-note-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = '0';
    iframe.style.opacity = '1';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print iframe failed, using window.print fallback', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 12000);
      }
    };

    // Ensure all images are fully loaded before opening print dialog
    const imgs = Array.from(doc.images);
    if (imgs.length === 0) {
      setTimeout(doPrint, 250);
    } else {
      let loaded = 0;
      let hasTriggered = false;
      const onDone = () => {
        loaded++;
        if (loaded >= imgs.length && !hasTriggered) {
          hasTriggered = true;
          setTimeout(doPrint, 250);
        }
      };

      imgs.forEach(img => {
        if (img.complete) {
          onDone();
        } else {
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
        }
      });

      // Safety fallback timeout
      setTimeout(() => {
        if (!hasTriggered) {
          hasTriggered = true;
          doPrint();
        }
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in duration-150">
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm;
            margin: 0mm !important;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .mesh-bg {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          .a4-viewport-container {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          #a4-print-sheet-wrapper {
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          body * {
            visibility: hidden;
          }
          #a4-print-sheet-root, #a4-print-sheet-root * {
            visibility: visible !important;
          }
          #a4-print-sheet-root {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            transform: none !important;
            z-index: 2147483647 !important;
            background: #ffffff !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
      
      {/* Top Controller Bar */}
      <div className="no-print bg-slate-900 border-b border-slate-700/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/30 text-blue-400 p-2 rounded-lg border border-blue-500/30">
            <Printer className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Hoá đơn Nháp
              </h2>
              <span className="text-xs bg-cyan-900/70 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-700/60 font-bold">
                {blNumber || jobCode}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mẫu hóa đơn điện tử GTGT MISA meInvoice - Công ty Long Hoàng
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 mr-2">
            <button
              onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs px-2 font-mono text-slate-300 w-12 text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.min(1.4, prev + 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomScale(0.95)}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors ml-1"
              title="Đặt lại 95%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Edit Buyer Info */}
          <button
            onClick={() => setIsEditing(prev => !prev)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isEditing 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30' 
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? 'Đóng Sửa Nhanh' : 'Sửa Thông Tin'}
          </button>

          {/* Print / Save PDF */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/50 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            In / Lưu PDF (A4)
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container with Optional Edit Drawer */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Quick Edit Panel (Collapsible) */}
        {isEditing && (
          <div className="no-print w-80 bg-slate-800/95 border-r border-slate-700 p-4 overflow-y-auto text-xs space-y-3 shrink-0 animate-in slide-in-from-left duration-200">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                Tinh Chỉnh Thông Tin
              </span>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <Check className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Số B/L / Số Job:</label>
              <input
                type="text"
                value={blNumber}
                onChange={e => setBlNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Tên Đơn Vị (Khách Hàng):</label>
              <textarea
                rows={2}
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-semibold">Mã Số Thuế:</label>
                {buyerTaxCode && (
                  <button
                    type="button"
                    onClick={() => window.open(`https://masothue.com/Search/?q=${encodeURIComponent(buyerTaxCode.trim())}`, '_blank')}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] underline flex items-center gap-1 cursor-pointer"
                    title="Mở trang masothue.com theo MST này"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Mở masothue.com
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={buyerTaxCode}
                  onChange={e => setBuyerTaxCode(e.target.value)}
                  placeholder="Nhập MST..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleLookupInModal}
                  disabled={isLookingUpInModal || !buyerTaxCode}
                  className="px-2.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded text-[11px] font-semibold shrink-0 cursor-pointer"
                  title="Tự động tra cứu địa chỉ từ MST"
                >
                  {isLookingUpInModal ? 'Đang tra...' : 'Tra địa chỉ'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-semibold">Địa Chỉ:</label>
                <button
                  type="button"
                  onClick={() => window.open(buyerTaxCode ? `https://masothue.com/Search/?q=${encodeURIComponent(buyerTaxCode.trim())}` : 'https://masothue.com', '_blank')}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] underline flex items-center gap-1 cursor-pointer"
                  title="Tra cứu địa chỉ trên trang masothue.com"
                >
                  <ExternalLink className="w-3 h-3" />
                  Tra masothue.com
                </button>
              </div>
              <textarea
                rows={3}
                value={buyerAddress}
                onChange={e => setBuyerAddress(e.target.value)}
                placeholder="Nhập hoặc dán địa chỉ tra từ masothue.com vào đây..."
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Ngày:</label>
                <input
                  type="text"
                  value={invoiceDate.day}
                  onChange={e => setInvoiceDate(prev => ({ ...prev, day: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tháng:</label>
                <input
                  type="text"
                  value={invoiceDate.month}
                  onChange={e => setInvoiceDate(prev => ({ ...prev, month: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Năm:</label>
                <input
                  type="text"
                  value={invoiceDate.year}
                  onChange={e => setInvoiceDate(prev => ({ ...prev, year: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Ký Hiệu:</label>
              <input
                type="text"
                value={invoiceSymbol}
                onChange={e => setInvoiceSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Vessel/Voy:</label>
              <input
                type="text"
                value={vesselVal}
                onChange={e => setVesselVal(e.target.value)}
                placeholder="VD: EVER GIVEN / 001E"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">POL (Cảng đi):</label>
                <input
                  type="text"
                  value={polVal}
                  onChange={e => setPolVal(e.target.value)}
                  placeholder="VD: HCM"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">POD (Cảng đến):</label>
                <input
                  type="text"
                  value={podVal}
                  onChange={e => setPodVal(e.target.value)}
                  placeholder="VD: USLAX"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Viewport & Paper Centering */}
        <div className="flex-1 overflow-auto p-6 flex justify-center items-start custom-scrollbar a4-viewport-container">
          <div 
            id="a4-print-sheet-wrapper"
            style={{ 
              transform: `scale(${zoomScale})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="shrink-0"
          >
            {/* The A4 Sheet */}
            <div 
              ref={printAreaRef}
              id="a4-print-sheet-root"
              className="bg-white text-slate-900 shadow-2xl mx-auto relative select-text"
              style={{
                width: '210mm',
                height: '297mm',
                margin: '0 auto',
                position: 'relative',
                boxSizing: 'border-box',
                fontFamily: "'Times New Roman', 'Tinos', Times, serif",
                overflow: 'hidden'
              }}
            >
              {/* Official Border Frame Image */}
              <img 
                src={ASSETS.VIEN} 
                alt="Khung Viền Hóa Đơn" 
                className="a4-border-frame absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0" 
              />

              {/* Official Center Watermark Image ("chìm ở giữa" - giảm còn 70%) */}
              <div 
                className="watermark-container absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
              >
                <img 
                  src={ASSETS.HIDE_LOGO} 
                  alt="LH Logistics Watermark" 
                  className="watermark-img w-[230px] max-w-[42%] h-auto opacity-15 pointer-events-none select-none"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </div>

              {/* Content Inner Container positioned neatly within the border */}
              <div 
                className="a4-content relative z-10 h-full flex flex-col justify-between"
                style={{
                  padding: '13mm 14mm 10mm 14mm',
                  boxSizing: 'border-box',
                  fontFamily: "'Times New Roman', Times, serif"
                }}
              >
                {/* Top Section: Header & Seller */}
                <div>
                  <div className="flex items-start justify-between gap-4 pb-2">
                    {/* Official Brand Logo */}
                    <div className="w-[135px] shrink-0 pt-0.5">
                      <img 
                        src={ASSETS.LOGO} 
                        alt="Long Hoang Logistics" 
                        className="w-[132px] h-auto object-contain"
                      />
                    </div>

                    {/* Seller Information (Left-aligned, Times New Roman, +1 size) */}
                    <div className="flex-1 text-left text-[12px] leading-relaxed text-black pl-2">
                      <h1 className="font-bold text-[14.5px] text-black uppercase tracking-tight mb-1.5">
                        CÔNG TY TNHH TIẾP VẬN VÀ VẬN TẢI QUỐC TẾ LONG HOÀNG
                      </h1>
                      <div className="space-y-1.5 text-black">
                        <p>Mã số thuế: 0316113070</p>
                        <p>Địa chỉ: Số 132 – 134 Đường Nguyễn Gia Trí, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh, Việt Nam</p>
                        <p>Điện thoại: 02873042677</p>
                        <p>Số tài khoản: <strong>345673979999 - MB Bank chi nhánh HCM</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Divider Line Below Company Info */}
                  <div className="border-b border-slate-300 my-1.5"></div>

                  {/* Title & Invoice Meta (+1 size) */}
                  <div className="relative my-2 text-center">
                    <div 
                      className="absolute right-0 top-0 text-left text-[12.5px] leading-relaxed text-black select-text"
                      style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="inline-block min-w-[56px]">Ký hiệu:</span>
                        <span className="font-semibold">{invoiceSymbol || '1C26TYY'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="inline-block min-w-[56px]">Số:</span>
                        <span className="font-semibold">&lt;Chưa cấp số&gt;</span>
                      </div>
                    </div>

                    <h2 className="text-[20.5px] font-bold text-black uppercase tracking-wide">
                      HÓA ĐƠN GIÁ TRỊ GIA TĂNG
                    </h2>
                    <p className="italic text-[12px] text-black mt-0.5">
                      Ngày {invoiceDate.day} tháng {invoiceDate.month} năm {invoiceDate.year}
                    </p>
                    <p className="italic text-[12px] text-black mt-0.5">
                      Mã CQT:
                    </p>
                  </div>

                  {/* Horizontal Divider Line Below Tax Authority Code */}
                  <div className="border-b border-slate-300 my-1.5"></div>

                  {/* Buyer Details & Enlarged QR without borders (+1 size) */}
                  <div className="pt-1 text-[12.5px] leading-relaxed flex justify-between items-start gap-4 mb-2 text-black">
                    <div className="flex-1 space-y-1">
                      <p>Họ tên người mua hàng:</p>
                      <p>Tên đơn vị: <span className="uppercase font-bold">{buyerName || '---'}</span></p>
                      <p>Mã số thuế: {buyerTaxCode || '---'}</p>
                      <p>Địa chỉ: {buyerAddress || '---'}</p>
                      <div className="flex gap-10">
                        <p>Hình thức thanh toán: Chuyển khoản</p>
                        <p>Số tài khoản:</p>
                      </div>
                      <p>Đồng tiền thanh toán: VND</p>
                    </div>

                    {/* Official QR Code Image (To lên và bỏ viền hoàn toàn) */}
                    <div className="w-[105px] h-[105px] shrink-0 flex items-center justify-center">
                      <img 
                        src={ASSETS.QR} 
                        alt="QR Tra Cứu Hóa Đơn" 
                        className="w-[105px] h-[105px] object-contain"
                      />
                    </div>
                  </div>

                  {/* Main Invoice Items Table */}
                  <div className="mt-1">
                    <table className="invoice-table w-full border-collapse border border-slate-700 text-[12px] table-fixed">
                      <colgroup>
                        <col style={{ width: '6.5%' }} />
                        <col style={{ width: '39%' }} />
                        <col style={{ width: '11.5%' }} />
                        <col style={{ width: '11.5%' }} />
                        <col style={{ width: '15.5%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-700 bg-transparent text-slate-900">
                          <th className="border-r border-slate-700 py-1.5 px-1 text-center font-bold text-[12px]">STT</th>
                          <th className="border-r border-slate-700 py-1.5 px-2 text-center font-bold text-[12px]">Tên hàng hóa, dịch vụ</th>
                          <th className="border-r border-slate-700 py-1.5 px-1.5 text-center font-bold text-[12px]">Đơn vị tính</th>
                          <th className="border-r border-slate-700 py-1.5 px-1.5 text-center font-bold text-[12px]">Số lượng</th>
                          <th className="border-r border-slate-700 py-1.5 px-2 text-center font-bold text-[12px]">Đơn giá</th>
                          <th className="py-1.5 px-2 text-center font-bold text-[12px]">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* B/L row header inside table */}
                        {blNumber && (
                          <tr className="row-dashed border-b border-dashed border-slate-400">
                            <td className="border-r border-slate-700 py-1 px-1 text-center">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2 text-left font-normal text-slate-900 text-[12px]">
                              B/L: {blNumber}
                            </td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="py-1 px-2.5">&nbsp;</td>
                          </tr>
                        )}

                        {/* Fee item rows */}
                        {rows.map((row, idx) => {
                          const displayName = FEE_INVOICE_NAMES[row.fee] || row.fee;
                          const lineTotal = row.price * row.quantity;
                          return (
                            <tr key={row.id} className="row-dashed border-b border-dashed border-slate-400 hover:bg-slate-50/40">
                              <td className="border-r border-slate-700 py-1 px-1 text-center font-normal text-slate-900">{idx + 1}</td>
                              <td className="border-r border-slate-700 py-1 px-2 text-left font-normal text-slate-900">{displayName}</td>
                              <td className="border-r border-slate-700 py-1 px-2.5 text-left font-normal text-slate-900">{row.unit}</td>
                              <td className="border-r border-slate-700 py-1 px-2.5 text-right font-normal text-slate-900">
                                {row.quantity.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                              </td>
                              <td className="border-r border-slate-700 py-1 px-2.5 text-right font-normal text-slate-900">
                                {row.price.toLocaleString('vi-VN')},00
                              </td>
                              <td className="py-1 px-2.5 text-right font-normal text-slate-900">
                                {lineTotal.toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Additional shipping info rows: Vessel/Voy, POL, POD without numbering (each on its own row, format matching B/L row) */}
                        {vesselVal?.trim() && (
                          <tr className="row-dashed border-b border-dashed border-slate-400">
                            <td className="border-r border-slate-700 py-1 px-1 text-center font-normal text-slate-900">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2 text-left font-normal text-slate-900 text-[12px]">
                              {formatVesselText(vesselVal)}
                            </td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="py-1 px-2.5">&nbsp;</td>
                          </tr>
                        )}

                        {polVal?.trim() && (
                          <tr className="row-dashed border-b border-dashed border-slate-400">
                            <td className="border-r border-slate-700 py-1 px-1 text-center font-normal text-slate-900">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2 text-left font-normal text-slate-900 text-[12px]">
                              {formatPolText(polVal)}
                            </td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="py-1 px-2.5">&nbsp;</td>
                          </tr>
                        )}

                        {podVal?.trim() && (
                          <tr className="row-dashed border-b border-dashed border-slate-400">
                            <td className="border-r border-slate-700 py-1 px-1 text-center font-normal text-slate-900">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2 text-left font-normal text-slate-900 text-[12px]">
                              {formatPodText(podVal)}
                            </td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                            <td className="py-1 px-2.5">&nbsp;</td>
                          </tr>
                        )}

                        {/* Empty rows to match image formatting */}
                        {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => {
                          const isLast = emptyIdx === emptyRowsCount - 1;
                          return (
                            <tr 
                              key={`empty-${emptyIdx}`} 
                              className={isLast ? "row-solid border-b border-slate-700 h-6" : "row-dashed border-b border-dashed border-slate-400 h-6"}
                            >
                              <td className="border-r border-slate-700 py-1 px-1">&nbsp;</td>
                              <td className="border-r border-slate-700 py-1 px-2">&nbsp;</td>
                              <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                              <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                              <td className="border-r border-slate-700 py-1 px-2.5">&nbsp;</td>
                              <td className="py-1 px-2.5">&nbsp;</td>
                            </tr>
                          );
                        })}

                        {/* Total Summary Row 1: Cộng tiền hàng */}
                        <tr className="row-solid border-b border-slate-700">
                          <td colSpan={5} className="border-r border-slate-700 py-1 px-2 text-center font-normal text-slate-900">
                            Cộng tiền hàng:
                          </td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-900">
                            {subTotal.toLocaleString('vi-VN')}
                          </td>
                        </tr>

                        {/* Total Summary Row 2: Thuế suất GTGT & Tiền thuế GTGT */}
                        <tr className="row-solid border-b border-slate-700">
                          <td colSpan={5} className="border-r border-slate-700 py-1 px-2.5">
                            <div className="flex items-center justify-between w-full">
                              <span className="font-normal text-slate-900">Thuế suất GTGT:</span>
                              <span className="font-normal text-slate-900">
                                <strong className="font-bold mr-2">{vatRate} %</strong>
                                <span>Tiền thuế GTGT:</span>
                              </span>
                              <span className="invisible select-none" aria-hidden="true">Thuế suất GTGT:</span>
                            </div>
                          </td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-900">
                            {vatAmount.toLocaleString('vi-VN')}
                          </td>
                        </tr>

                        {/* Total Summary Row 3: Tổng tiền thanh toán */}
                        <tr className="row-solid border-b border-slate-700">
                          <td colSpan={5} className="border-r border-slate-700 py-1 px-2 text-center font-normal text-slate-900">
                            Tổng tiền thanh toán:
                          </td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-900">
                            {grandTotal.toLocaleString('vi-VN')}
                          </td>
                        </tr>

                        {/* Total Summary Row 4: Số tiền viết bằng chữ */}
                        <tr>
                          <td colSpan={6} className="py-1.5 px-2.5 text-left text-[12px] text-slate-900 leading-normal">
                            <span className="font-normal">Số tiền viết bằng chữ: </span>
                            <span className="font-bold italic">{wordsTotal}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures (+1 size: text-[13px], strictly Times New Roman) */}
                  <div 
                    className="grid grid-cols-2 mt-4 text-center text-[13px] leading-tight"
                    style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                  >
                    <div>
                      <p className="font-bold text-slate-900" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                        Người mua hàng
                      </p>
                      <p className="italic text-[12px] text-slate-700 mt-0.5" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                        (Ký, ghi rõ họ, tên)
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      <p className="font-bold text-slate-900" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                        Người bán hàng
                      </p>
                      <p className="italic text-[12px] text-slate-700 mt-0.5 mb-2" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                        (Ký, ghi rõ họ, tên)
                      </p>

                      {/* Digital Signature Box as in user image_e91d1424.png */}
                      <div 
                        className="digital-signature-box border-[1.5px] border-[#48a05b] bg-[#ebf8ee] px-3.5 py-2.5 text-left w-[265px] select-text shadow-sm"
                        style={{
                          borderColor: '#48a05b',
                          backgroundColor: '#ebf8ee',
                          fontFamily: "'Times New Roman', 'Tinos', Times, serif"
                        }}
                      >
                        <div 
                          className="font-bold text-[13.5px] text-[#cc0000] mb-1 leading-snug"
                          style={{ color: '#cc0000', fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                        >
                          Signature Valid
                        </div>
                        <div 
                          className="font-bold italic text-[12.5px] text-[#cc0000] mb-1 leading-snug"
                          style={{ color: '#cc0000', fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                        >
                          Ký bởi:
                        </div>
                        <div 
                          className="font-bold italic text-[12.5px] text-[#cc0000] leading-snug"
                          style={{ color: '#cc0000', fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                        >
                          Ký ngày:
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer Info without horizontal line as in image_22ac276b.png */}
                <div 
                  className="pt-2 text-[11px] text-slate-800 leading-normal relative z-10 mt-4"
                  style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}
                >
                  <p className="text-left text-slate-900" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                    Tra cứu tại Website: <span className="text-[#0055aa] underline">https://www.meinvoice.vn/tra-cuu</span> - Mã tra cứu hóa đơn:
                  </p>
                  <p className="text-center italic text-slate-800 mt-1" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                    (Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)
                  </p>
                  <p className="text-center text-slate-800 mt-0.5" style={{ fontFamily: "'Times New Roman', 'Tinos', Times, serif" }}>
                    Phát hành bởi phần mềm MISA meInvoice - Công ty Cổ phần MISA (www.misa.vn) - MST 0101243150
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Footer Bar */}
      <div className="no-print bg-slate-900 border-t border-slate-700/80 px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0 z-20">
        <div>
          <span>Tổng cộng: <strong className="text-white">{grandTotal.toLocaleString('vi-VN')} VND</strong> (gồm VAT {vatRate}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

    </div>
  );
};
