
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { FileCheck, Upload, Save, CheckCircle, AlertCircle, Loader2, Eye, Edit3, Banknote, Sparkles, X, RotateCcw, FileText, Mail, Copy, Check, Lock, Unlock, Key, Settings, ExternalLink, RefreshCw, StopCircle, BookOpen } from 'lucide-react';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsMod from 'pdfjs-dist';
import { JobModal } from '../components/JobModal';
import { QuickReceiveModal, ReceiveMode } from '../components/QuickReceiveModal';
import { useNotification } from '../contexts/NotificationContext';
import { getStoredApiKeys, maskApiKey, testGeminiApiKey, subscribeApiKeyChanges, setActiveApiKey, getActiveApiKey } from '../utils/apiKeyManager';
import { ApiKeyItem } from '../types';
import { scanCVHCPage } from '../utils/cvhcAiScanner';

const pdfjsLib = (pdfjsMod as any).default || pdfjsMod;
if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
}

interface CVHCPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  onUpdateJob: (job: JobData) => void;
  onAddLine?: (line: string) => void;
  onAddCustomer?: (customer: Customer) => void;
  onNavigate?: (page: string) => void;
}

interface CVHCRow {
  id: string;
  jobCode: string; // Số BL
  customerName: string;
  customerId: string;
  amount: number;
  accountNumber?: string; // Số tài khoản thụ hưởng
  jobId?: string; // Link to actual job if found (can be comma-separated list of IDs)
  previewUrl?: string; // Preview URL for PDF page
  isLocked?: boolean; // Lock status
  bankName?: string;
  accountHolder?: string;
  scannedByAI?: boolean;
}

const BACKEND_URL = "https://api.kimberry.id.vn";

// Local PDF text extraction helper
const extractTextFromBlob = async (blob: Blob): Promise<string> => {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += ' ' + pageText;
        }
        return fullText.trim();
    } catch (e) {
        return '';
    }
};

interface ParsedDocData {
    jobCode: string;
    accountNumber: string;
    customerName?: string;
    amount?: number;
    bankName?: string;
    accountHolder?: string;
}

// Rút gọn và chuẩn hóa tên ngân hàng (loại bỏ chi nhánh, phòng giao dịch để hiển thị ngắn gọn: Vietcombank, VietinBank...)
export const cleanBankName = (bank?: string): string => {
    if (!bank) return '';
    let b = bank.trim();
    if (!b) return '';

    // Danh sách các ngân hàng phổ biến tại VN để nhận diện và hiển thị tên thương hiệu chuẩn, ngắn gọn
    const knownBanks: Array<{ pattern: RegExp; shortName: string }> = [
        { pattern: /\b(vietcombank|vcb)\b/i, shortName: 'Vietcombank' },
        { pattern: /\b(vietinbank|incombank|ctg)\b/i, shortName: 'VietinBank' },
        { pattern: /\b(techcombank|tcb)\b/i, shortName: 'Techcombank' },
        { pattern: /\b(bidv)\b/i, shortName: 'BIDV' },
        { pattern: /\b(agribank|vbard)\b/i, shortName: 'Agribank' },
        { pattern: /\b(mb\s*bank|mbbank|ngân\s*hàng\s*quân\s*đội)\b/i, shortName: 'MB Bank' },
        { pattern: /\b(acb|á\s*châu)\b/i, shortName: 'ACB' },
        { pattern: /\b(vpbank|vpb)\b/i, shortName: 'VPBank' },
        { pattern: /\b(tpbank|tpb|tiên\s*phong)\b/i, shortName: 'TPBank' },
        { pattern: /\b(sacombank|stb)\b/i, shortName: 'Sacombank' },
        { pattern: /\b(vib)\b/i, shortName: 'VIB' },
        { pattern: /\b(hdbank|hdb)\b/i, shortName: 'HDBank' },
        { pattern: /\b(msb|hàng\s*hải)\b/i, shortName: 'MSB' },
        { pattern: /\b(ocb|phương\s*đông)\b/i, shortName: 'OCB' },
        { pattern: /\b(eximbank|eib)\b/i, shortName: 'Eximbank' },
        { pattern: /\b(shb)\b/i, shortName: 'SHB' },
        { pattern: /\b(seabank)\b/i, shortName: 'SeABank' },
        { pattern: /\b(lpbank|lienvietpostbank|bưu\s*điện\s*liên\s*việt)\b/i, shortName: 'LPBank' },
        { pattern: /\b(shinhan(?:\s*bank)?)\b/i, shortName: 'Shinhan Bank' },
        { pattern: /\b(woori(?:\s*bank)?)\b/i, shortName: 'Woori Bank' },
        { pattern: /\b(hsbc)\b/i, shortName: 'HSBC' },
        { pattern: /\b(standard\s*chartered)\b/i, shortName: 'Standard Chartered' },
        { pattern: /\b(bac\s*a\s*bank|bắc\s*á)\b/i, shortName: 'Bac A Bank' },
        { pattern: /\b(nam\s*a\s*bank|nam\s*á)\b/i, shortName: 'Nam A Bank' },
        { pattern: /\b(pvcombank)\b/i, shortName: 'PVcomBank' },
        { pattern: /\b(kienlongbank)\b/i, shortName: 'KienlongBank' },
        { pattern: /\b(baoviet\s*bank)\b/i, shortName: 'BaoViet Bank' },
        { pattern: /\b(saigonbank)\b/i, shortName: 'Saigonbank' },
        { pattern: /\b(public\s*bank)\b/i, shortName: 'Public Bank' },
        { pattern: /\b(cimb)\b/i, shortName: 'CIMB' },
        { pattern: /\b(uob)\b/i, shortName: 'UOB' },
        { pattern: /\b(citibank)\b/i, shortName: 'Citibank' },
        { pattern: /\b(indovina)\b/i, shortName: 'Indovina' },
    ];

    for (const kb of knownBanks) {
        if (kb.pattern.test(b)) {
            return kb.shortName;
        }
    }

    // Nếu không nằm trong danh sách trên, tự động cắt bỏ phần Chi nhánh / PGD / Hội sở
    b = b.replace(/^(?:Ngân\s*hàng\s*(?:TMCP|NHTMCP)?|NH|Bank)\s+/i, '');
    b = b.replace(/\s*[-–,./]?\s*(?:CN|Chi\s*nhánh|PGD|Phòng\s*giao\s*dịch|Hội\s*sở|Văn\s*phòng|Branch).*$/i, '');
    return b.trim();
};

// Kiểm tra xem tên người thụ hưởng có phải là CÁ NHÂN hay không (loại bỏ tên công ty)
export const isIndividualPerson = (name?: string, customerName?: string): boolean => {
    if (!name) return false;
    const clean = name.trim().toUpperCase();
    if (!clean || clean.length < 2) return false;

    // Các từ khóa doanh nghiệp / công ty
    const companyKeywords = [
        'CÔNG TY', 'CONG TY', 'CTY', 'TNHH', 'CỔ PHẦN', 'CO PHAN', 'CP', 
        'DOANH NGHIỆP', 'DNTN', 'MTV', 'LOGISTICS', 'FORWARDING', 
        'XNK', 'XUẤT NHẬP KHẨU', 'COMMERCE', 'TRADING', 'CORP', 'LTD', 
        'INC', 'ENTERPRISE', 'CHI NHÁNH', 'CN', 'VPĐD', 'VĂN PHÒNG ĐẠI DIỆN', 
        'TẬP ĐOÀN', 'CO.,', 'CO.LTD', 'JSC', 'CORPORATION'
    ];
    for (const kw of companyKeywords) {
        if (clean.includes(kw)) return false;
    }

    // Nếu trùng hoặc chứa tên khách hàng (thường là tên công ty đề nghị)
    if (customerName) {
        const cleanCust = customerName.trim().toUpperCase();
        if (cleanCust && (clean.includes(cleanCust) || cleanCust.includes(clean))) {
            return false;
        }
    }

    return true;
};

// Định dạng dòng hiển thị phụ bên dưới số tài khoản: "Tên ngân hàng - Người nhận là cá nhân"
export const formatAccountSubtitle = (bankName?: string, accountHolder?: string, customerName?: string): string => {
    const cleanBank = cleanBankName(bankName);
    const cleanHolder = (accountHolder || '').trim();
    const isPerson = cleanHolder && isIndividualPerson(cleanHolder, customerName);

    if (cleanBank && isPerson) {
        return `${cleanBank} - ${cleanHolder}`;
    }
    if (cleanBank) {
        return cleanBank;
    }
    if (isPerson) {
        return cleanHolder;
    }
    return '';
};

// Match extracted text against database jobs and regex patterns
const parseDocumentText = (text: string, existingJobs: JobData[]): ParsedDocData => {
    let jobCode = '';
    let accountNumber = '';
    let customerName = '';
    let amount = 0;
    let bankName = '';
    let accountHolder = '';

    if (!text || text.length < 3) return { jobCode, accountNumber, customerName, amount, bankName, accountHolder };

    // 1. Check against known Jobs in database (exact matching)
    for (const j of existingJobs) {
        if (j.jobCode && j.jobCode.trim().length >= 4) {
            const cleanCode = j.jobCode.trim();
            const regex = new RegExp(`\\b${cleanCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
            if (regex.test(text) || text.toUpperCase().includes(cleanCode.toUpperCase())) {
                jobCode = cleanCode;
                break;
            }
        }
    }

    // 2. Regex search for B/L / Booking / Job patterns
    if (!jobCode) {
        const blPatterns = [
            /(?:B\/L|BL|Bill\s*of\s*Lading|MBL|HBL|Booking|Số\s*Vận\s*Đơn|Vận\s*đơn|Bill\s*No)[#:\s.-]*([A-Z0-9\/-]{6,25})/i,
            /(?:Số\s*BL|Mã\s*BL|Số\s*Job)[#:\s.-]*([A-Z0-9\/-]{6,25})/i
        ];
        for (const pattern of blPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                jobCode = match[1].trim();
                break;
            }
        }
    }

    // 3. Search for Customer / Company name
    const custPatterns = [
        /(?:CÔNG\s*TY\s*(?:TNHH|CỔ\s*PHẦN|CP|MTV)?[^,\n:\.]{3,60})/i,
        /(?:Đơn\s*vị\s*đề\s*nghị|Kính\s*gửi|Khách\s*hàng)[:\s]+([^,\n\.]{3,60})/i
    ];
    for (const pattern of custPatterns) {
        const match = text.match(pattern);
        if (match && match[0]) {
            customerName = match[1] ? match[1].trim() : match[0].trim();
            break;
        }
    }

    // 4. Search for Deposit Amount (Số tiền cược)
    const amtPatterns = [
        /(?:Số\s*tiền\s*cược|Tiền\s*cược|Hoàn\s*cược|Số\s*tiền\s*đề\s*nghị|Số\s*tiền|Tổng\s*cộng)[^0-9\n]{0,25}([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{6,9})/i
    ];
    for (const pattern of amtPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const cleanAmt = parseInt(match[1].replace(/[.,]/g, ''), 10);
            if (!isNaN(cleanAmt) && cleanAmt > 0) {
                amount = cleanAmt;
                break;
            }
        }
    }

    // 5. Search for Account Number (STK / Bank Account)
    const stkPatterns = [
        /(?:Số\s*tài\s*khoản|Số\s*TK|STK|Tài\s*khoản\s*thụ\s*hưởng|TK\s*thụ\s*hưởng|Account\s*Number|Account\s*No|A\/C\s*No|A\/C)[#:\s.-]*([0-9\s]{6,25})/i,
        /(?:Tại\s*ngân\s*hàng|Ngân\s*hàng|Bank)[^0-9\n]{0,25}([0-9]{8,20})/i
    ];
    for (const pattern of stkPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const cleanAcc = match[1].replace(/\s+/g, '').trim();
            if (cleanAcc.length >= 6 && /^\d+$/.test(cleanAcc)) {
                accountNumber = cleanAcc;
                break;
            }
        }
    }

    // 6. Search for Bank Name
    const bankPatterns = [
        /(?:Tại\s*ngân\s*hàng|Ngân\s*hàng|Bank|NH)[:\s]+([^,\n]{3,50})/i,
        /\b(Vietcombank|Techcombank|MB\s*Bank|BIDV|Agribank|ACB|VPBank|TPBank|Sacombank|VIB|HDBank|MSB|OCB|Eximbank|SHB|VietinBank|Shinhan|Woori|Standard\s*Chartered|HSBC)\b/i
    ];
    for (const pattern of bankPatterns) {
        const match = text.match(pattern);
        if (match && (match[1] || match[0])) {
            const rawBank = (match[1] || match[0]).trim();
            bankName = cleanBankName(rawBank);
            if (bankName) break;
        }
    }

    // 7. Search for Account Holder (Chủ tài khoản / Người thụ hưởng)
    const holderPatterns = [
        /(?:Chủ\s*tài\s*khoản|Tên\s*tài\s*khoản|Chủ\s*TK|Tên\s*người\s*thụ\s*hưởng|Người\s*thụ\s*hưởng)[:\s]+([^,\n]{2,45})/i
    ];
    for (const pattern of holderPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const h = match[1].trim();
            if (h.length >= 2) {
                accountHolder = h;
                break;
            }
        }
    }

    return { jobCode, accountNumber, customerName, amount, bankName, accountHolder };
};

export const CVHCPage: React.FC<CVHCPageProps> = ({ 
  jobs, customers, lines, onUpdateJob, onAddLine, onAddCustomer, onNavigate 
}) => {
  const { alert, confirm } = useNotification();
  
  // Custom API Key state & List
  const [customApiKey, setCustomApiKey] = useState<string>(() => getActiveApiKey());
  const [savedKeys, setSavedKeys] = useState<ApiKeyItem[]>(() => getStoredApiKeys());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync API Keys across components
  useEffect(() => {
    const unsub = subscribeApiKeyChanges(() => {
      setCustomApiKey(getActiveApiKey());
      setSavedKeys(getStoredApiKeys());
    });
    return unsub;
  }, []);
  
  // Load rows from localStorage cache on mount
  const [rows, setRows] = useState<CVHCRow[]>(() => {
    try {
      const cached = localStorage.getItem('cvhc_rows_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(r => ({ ...r, isLocked: !!r.isLocked }));
        }
      }
    } catch (e) {
      console.error("Failed to load CVHC rows cache:", e);
    }
    return [{ id: '1', jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }];
  });

  // Load pageCount from localStorage cache on mount
  const [pageCount, setPageCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('cvhc_page_count_cache');
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 1;
  });

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isScanning, setIsScanning] = useState(false); // For AI Scan
  const [scanningCurrentIndex, setScanningCurrentIndex] = useState<number | null>(null); // Current page being read
  const [scanProgressMessage, setScanProgressMessage] = useState<string>(''); // Live status text
  const cancelScanRef = useRef<boolean>(false); // Cancel flag
  const [iframePreviewUrl, setIframePreviewUrl] = useState<string | null>(null); // Embedded preview modal
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  const [editingSubtitleRowId, setEditingSubtitleRowId] = useState<string | null>(null);
  const [subtitleInput, setSubtitleInput] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('cvhc_is_locked_cache');
      return cached === 'true';
    } catch {
      return false;
    }
  });

  // Persist rows and pageCount to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('cvhc_rows_cache', JSON.stringify(rows));
    } catch (e) {
      console.error("Failed to save CVHC rows cache:", e);
    }
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem('cvhc_page_count_cache', pageCount.toString());
    } catch {}
  }, [pageCount]);

  useEffect(() => {
    try {
      localStorage.setItem('cvhc_is_locked_cache', isLocked.toString());
    } catch {}
  }, [isLocked]);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedState(prev => ({ ...prev, [key]: false }));
    }, 1500);
  };

  // Modal State
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobData | null>(null);

  // Quick Receive (Chi Hoàn Cược) state
  const [isQuickReceiveOpen, setIsQuickReceiveOpen] = useState(false);
  const [quickReceiveJob, setQuickReceiveJob] = useState<JobData | null>(null);
  const [quickReceiveMode, setQuickReceiveMode] = useState<ReceiveMode>('deposit_refund');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize used document numbers to pass into the modal
  const usedDocNos = useMemo(() => {
    const list: string[] = [];
    jobs.forEach(j => {
      if (j.amisPaymentDocNo) list.push(j.amisPaymentDocNo);
      if (j.amisDepositOutDocNo) list.push(j.amisDepositOutDocNo);
      if (j.amisExtensionPaymentDocNo) list.push(j.amisExtensionPaymentDocNo);
      if (j.amisDepositRefundDocNo) list.push(j.amisDepositRefundDocNo);
      (j.extensions || []).forEach(e => { if (e.amisDocNo) list.push(e.amisDocNo); });
      (j.refunds || []).forEach(r => { if (r.docNo) list.push(r.docNo); });
      (j.additionalReceipts || []).forEach(r => { if (r.docNo) list.push(r.docNo); });
    });
    return list;
  }, [jobs]);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<'edit' | 'refund' | null>(null);

  const handleRowRefundSingle = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setQuickReceiveJob(job);
      setQuickReceiveMode('deposit_refund');
      setIsQuickReceiveOpen(true);
    } else {
      alert("Không tìm thấy dữ liệu Job tương ứng để chi hoàn cược.", "Lỗi");
    }
  };

  const onRowActionClick = (row: CVHCRow, action: 'edit' | 'refund') => {
    if (!row.jobId) return;
    const ids = row.jobId.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 1) {
        if (action === 'edit') {
            handleEditJobClick(ids[0]);
        } else {
            handleRowRefundSingle(ids[0]);
        }
    } else if (ids.length > 1) {
        if (expandedRowId === row.id && expandedAction === action) {
            setExpandedRowId(null);
            setExpandedAction(null);
        } else {
            setExpandedRowId(row.id);
            setExpandedAction(action);
        }
    }
  };

  const handleSaveQuickReceive = (updatedJob: JobData) => {
    onUpdateJob(updatedJob);
    // Auto-refresh coordinates in table
    setRows(prev => prev.map(row => {
      const rowIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
      if (rowIds.includes(updatedJob.id)) {
        const isMain = rowIds[0] === updatedJob.id;
        const updatedRow = { ...row };
        if (isMain) {
          const custId = updatedJob.maKhCuocId || updatedJob.customerId;
          const custName = findCustomer(custId)?.name || updatedJob.customerName;
          updatedRow.customerName = custName;
          updatedRow.customerId = custId;
        }
        return updatedRow;
      }
      return row;
    }));
  };

  // Helper to format currency
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  // Helper to find job by code
  const findJob = (code: string) => jobs.find(j => j.jobCode.toLowerCase().trim() === code.toLowerCase().trim());

  // Helper to find customer by ID
  const findCustomer = (id: string) => customers.find(c => c.id === id);

  const resetForm = () => {
    setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
    setFile(null);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    try {
      localStorage.removeItem('cvhc_rows_cache');
      localStorage.removeItem('cvhc_page_count_cache');
    } catch {}
  };

  const handleJobCodeChange = (id: string, code: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const codes = code.split(',').map(s => s.trim()).filter(Boolean);
        const matchedJobs = codes.map(c => findJob(c)).filter((j): j is JobData => !!j);

        if (matchedJobs.length > 0) {
          // Found Job(s) -> Auto-fill
          const firstJob = matchedJobs[0];
          const custId = firstJob.maKhCuocId || firstJob.customerId;
          const custName = findCustomer(custId)?.name || firstJob.customerName;
          
          // Sum up the amounts of all found jobs
          const totalAmount = matchedJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
          const jobIds = matchedJobs.map(j => j.id).join(',');

          return {
            ...row,
            jobCode: code,
            jobId: jobIds,
            amount: totalAmount,
            customerId: custId,
            customerName: custName
          };
        } else {
          // Not found -> just update code, clear others
          return { ...row, jobCode: code, jobId: undefined, amount: 0, customerName: '', customerId: '', previewUrl: row.previewUrl };
        }
      }
      return row;
    }));
  };

  const handleRowChange = (id: string, field: keyof CVHCRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveSubtitle = (rowId: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, bankName: '', accountHolder: '' } : r));
      setEditingSubtitleRowId(null);
      return;
    }
    const parts = trimmed.split('-').map(s => s.trim());
    const b = cleanBankName(parts[0] || '');
    const h = parts.slice(1).join('-').trim() || '';
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          bankName: b,
          accountHolder: h
        };
      }
      return r;
    }));
    setEditingSubtitleRowId(null);
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(r => r.id !== id));
    } else {
      // If only 1 row, just clear it
      setRows([{ id: Date.now().toString(), jobCode: '', customerName: '', customerId: '', amount: 0, accountNumber: '', isLocked: false }]);
    }
  };

  const handlePageCountChange = (count: number) => {
      setPageCount(count);
      setRows(prev => {
          const newRows: CVHCRow[] = [...prev];
          if (count > prev.length) {
              // Add new rows
              for (let i = prev.length; i < count; i++) {
                  newRows.push({ 
                      id: `page-${i}-${Date.now()}`, 
                      jobCode: '', 
                      customerName: '', 
                      customerId: '', 
                      amount: 0, 
                      accountNumber: '',
                      isLocked: false
                  });
              }
          } else if (count < prev.length) {
              // Truncate rows
              return newRows.slice(0, count);
          }
          return newRows;
      });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // AUTO SPLIT PREVIEW FOR PDF
      if (selectedFile.type === 'application/pdf') {
          setIsUploading(true);
          setUploadProgress('Đang phân tích và tách trang...');
          
          try {
              const arrayBuffer = await selectedFile.arrayBuffer();
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              const totalPages = pdfDoc.getPageCount();
              
              setPageCount(totalPages); // Auto update page count input

              const newPreviewUrls: string[] = [];
              for (let i = 0; i < totalPages; i++) {
                  // Create single page PDF for preview
                  const subDoc = await PDFDocument.create();
                  const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
                  subDoc.addPage(copiedPage);
                  const pdfBytes = await subDoc.save();
                  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  newPreviewUrls.push(url);
              }

              // Check if we can merge with existing rows (e.g. on page reload, user selects the same file again)
              if (rows.length === totalPages) {
                  setRows(prev => prev.map((row, i) => ({
                      ...row,
                      previewUrl: newPreviewUrls[i]
                  })));
              } else {
                  const newRows: CVHCRow[] = [];
                  for (let i = 0; i < totalPages; i++) {
                      newRows.push({
                          id: `page-${i}-${Date.now()}`,
                          jobCode: '',
                          customerName: '',
                          customerId: '',
                          amount: 0,
                          accountNumber: '',
                          previewUrl: newPreviewUrls[i],
                          isLocked: false
                      });
                  }
                  setRows(newRows);
              }
          } catch (error) {
              console.error("Error splitting PDF preview:", error);
              alert("Không thể đọc file PDF. Vui lòng kiểm tra lại file.", "Lỗi");
          } finally {
              setIsUploading(false);
              setUploadProgress('');
          }
      } else {
          // Non-PDF (Image, etc.) -> Single row
          setPageCount(1);
          const newPreviewUrl = URL.createObjectURL(selectedFile);
          if (rows.length === 1) {
              setRows(prev => [{
                  ...prev[0],
                  previewUrl: newPreviewUrl
              }]);
          } else {
              setRows([{ 
                  id: Date.now().toString(), 
                  jobCode: '', 
                  customerName: '', 
                  customerId: '', 
                  amount: 0, 
                  accountNumber: '', 
                  previewUrl: newPreviewUrl,
                  isLocked: false
              }]);
          }
      }
    }
  };

  // Helper: Apply extracted data to row and link with jobs/customers database
  const applyExtractedDataToRow = (
      rowIndex: number, 
      data: { 
          jobCode?: string; 
          customerName?: string; 
          amount?: number | string; 
          accountNumber?: string; 
          bankName?: string; 
          accountHolder?: string;
          notes?: string;
      }
  ) => {
      let finalJobCode = (data.jobCode || '').trim();
      let finalCustomerName = (data.customerName || '').trim();
      let finalAmount = typeof data.amount === 'string' ? (parseInt(data.amount.replace(/[^0-9]/g, ''), 10) || 0) : (Number(data.amount) || 0);
      let finalAccountNumber = (data.accountNumber || '').replace(/[^0-9]/g, '').trim();
      let finalJobId: string | undefined = undefined;
      let finalCustomerId = '';

      // 1. Check if jobCode matches any existing Job in system
      if (finalJobCode) {
          const codes = finalJobCode.split(',').map(s => s.trim()).filter(Boolean);
          const matchedJobs = codes.map(c => findJob(c)).filter((j): j is JobData => !!j);

          if (matchedJobs.length > 0) {
              const firstJob = matchedJobs[0];
              finalJobId = matchedJobs.map(j => j.id).join(',');
              const dbCustId = firstJob.maKhCuocId || firstJob.customerId;
              const dbCustName = findCustomer(dbCustId)?.name || firstJob.customerName;
              
              finalCustomerId = dbCustId || '';
              if (dbCustName) {
                  finalCustomerName = dbCustName;
              }
              const dbTotalAmount = matchedJobs.reduce((sum, j) => sum + (j.thuCuoc || 0), 0);
              if (dbTotalAmount > 0) {
                  finalAmount = dbTotalAmount;
              }
          }
      }

      // 2. If no customerId from jobs, check if customerName matches any existing Customer
      if (!finalCustomerId && finalCustomerName) {
          const cleanName = finalCustomerName.toLowerCase().replace(/công ty|tnhh|cp|cổ phần|mtv/gi, '').trim();
          const matchedCust = customers.find(c => {
              const cClean = c.name.toLowerCase().replace(/công ty|tnhh|cp|cổ phần|mtv/gi, '').trim();
              return (cleanName.length >= 3 && cClean.includes(cleanName)) || (cClean.length >= 3 && cleanName.includes(cClean));
          });
          if (matchedCust) {
              finalCustomerId = matchedCust.id;
              finalCustomerName = matchedCust.name;
          }
      }

      setRows(currentRows => currentRows.map((r, rIdx) => {
          if (rIdx === rowIndex) {
              return {
                  ...r,
                  jobCode: finalJobCode || r.jobCode,
                  jobId: finalJobId !== undefined ? finalJobId : r.jobId,
                  customerName: finalCustomerName || r.customerName,
                  customerId: finalCustomerId || r.customerId,
                  amount: finalAmount > 0 ? finalAmount : r.amount,
                  accountNumber: finalAccountNumber || r.accountNumber,
                  bankName: data.bankName ? cleanBankName(data.bankName) : r.bankName,
                  accountHolder: data.accountHolder || r.accountHolder,
                  scannedByAI: true
              };
          }
          return r;
      }));

      return {
          jobCode: finalJobCode,
          customerName: finalCustomerName,
          amount: finalAmount,
          accountNumber: finalAccountNumber
      };
  };

  // Helper: Read a single page / row with AI
  const scanSingleRow = async (index: number) => {
      if (isLocked) {
          alert("Bảng dữ liệu đang bị khóa. Vui lòng mở khóa để đọc tài liệu.", "Thông báo");
          return;
      }
      const row = rows[index];
      if (!row || !row.previewUrl) {
          alert(`Trang ${index + 1} chưa có file đính kèm để đọc.`, "Thông báo");
          return;
      }

      setScanningCurrentIndex(index);
      setScanProgressMessage(`Đang đọc Trang ${index + 1}: Quan sát và trích xuất dữ liệu...`);

      try {
          const response = await fetch(row.previewUrl);
          const blob = await response.blob();
          const mimeType = blob.type || "application/pdf";
          
          let extractedData: any = null;

          // 1. Try Gemini API
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                  const base64String = reader.result as string;
                  const base64Data = base64String.split(',')[1]; 
                  resolve(base64Data);
              };
              reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;

          try {
              extractedData = await scanCVHCPage(base64Data, mimeType, customApiKey);
          } catch (apiErr: any) {
              console.warn("AI scan failed for single row, trying local fallback:", apiErr);
              if (mimeType.includes("pdf")) {
                  const localText = await extractTextFromBlob(blob);
                  if (localText && localText.trim().length > 10) {
                      extractedData = parseDocumentText(localText, jobs);
                  }
              }
          }

          if (extractedData && (extractedData.jobCode || extractedData.accountNumber || extractedData.customerName || extractedData.amount)) {
              const res = applyExtractedDataToRow(index, extractedData);
              setScanProgressMessage(`Đã đọc xong Trang ${index + 1}: BL: ${res.jobCode || '---'} | KH: ${res.customerName || '---'} | Tiền: ${res.amount ? formatCurrency(res.amount) : '0 đ'}`);
          } else {
              alert(`Không đọc được thông tin từ Trang ${index + 1}. Vui lòng kiểm tra lại chất lượng tài liệu hoặc nhập tay.`, "Thông báo");
          }
      } catch (err: any) {
          console.error("Error reading single row:", err);
          alert(`Lỗi khi đọc Trang ${index + 1}: ${err.message}`, "Lỗi");
      } finally {
          setScanningCurrentIndex(null);
          setScanProgressMessage('');
      }
  };

  // --- AI WORKFLOW: 1 NGƯỜI ĐỌC TỪNG TRANG VÀ GHI LẠI DỮ LIỆU ---
  const handleAutoScan = async () => {
      if (isLocked) {
          alert("Bảng dữ liệu đang bị khóa. Vui lòng mở khóa để quét tự điền.", "Thông báo");
          return;
      }
      if (!file && !rows.some(r => r.previewUrl)) {
          alert("Vui lòng chọn file đính kèm (PDF hoặc ảnh) trước khi yêu cầu AI đọc và ghi lại dữ liệu.", "Thông báo");
          return;
      }

      const availableRows = rows.filter(r => r.previewUrl);
      if (availableRows.length === 0) {
          alert("Không có trang nào có file đính kèm để đọc. Vui lòng chọn lại file.", "Thông báo");
          return;
      }

      // Check if some rows already have data
      const rowsWithData = rows.filter(r => r.jobCode.trim() || r.amount > 0 || r.customerName.trim());
      let scanAll = true;
      if (rowsWithData.length > 0 && rowsWithData.length < rows.length) {
          scanAll = await confirm(
              `Bảng đang có ${rowsWithData.length}/${rows.length} dòng đã có dữ liệu.\n\nBạn có muốn AI đọc lại TOÀN BỘ ${rows.length} trang từ file đính kèm không?\n\n- Chọn 'Đồng ý' để đọc lại từ đầu tất cả các trang.\n- Chọn 'Hủy' để chỉ đọc những trang chưa có số BL.`,
              "AI Đọc File & Ghi Lại"
          );
      }

      setIsScanning(true);
      cancelScanRef.current = false;
      let successCount = 0;
      let quotaExhausted = false;
      let lastApiError = "";

      for (let i = 0; i < rows.length; i++) {
          if (cancelScanRef.current) {
              break;
          }

          const row = rows[i];
          if (!row.previewUrl) continue;
          if (!scanAll && row.jobCode.trim()) continue;

          setScanningCurrentIndex(i);
          setScanProgressMessage(`Đang đọc Trang ${i + 1}/${rows.length}: Quan sát văn bản, B/L, công ty, số tiền cược và STK...`);

          try {
              // 1. Fetch Blob
              const response = await fetch(row.previewUrl);
              const blob = await response.blob();
              const mimeType = blob.type || "application/pdf";
              
              let extractedData: any = null;

              // 2. PRIMARY: SERVER-SIDE GEMINI API ("1 người đọc file và ghi lại")
              if (!quotaExhausted) {
                  const reader = new FileReader();
                  const base64Promise = new Promise<string>((resolve, reject) => {
                      reader.onloadend = () => {
                          const base64String = reader.result as string;
                          const base64Data = base64String.split(',')[1]; 
                          resolve(base64Data);
                      };
                      reader.onerror = reject;
                  });
                  reader.readAsDataURL(blob);
                  const base64Data = await base64Promise;

                  try {
                      extractedData = await scanCVHCPage(base64Data, mimeType, customApiKey);
                  } catch (apiErr: any) {
                      const errMsg = apiErr.message || "";
                      const isQuotaError = apiErr.status === 429 || 
                                           errMsg.includes("RESOURCE_EXHAUSTED") || 
                                           errMsg.includes("prepayment") || 
                                           errMsg.includes("Credits") || 
                                           errMsg.includes("Quota") || 
                                           errMsg.includes("Hạn mức") ||
                                           apiErr.status === 403 ||
                                           errMsg.includes("API key not valid");

                      if (isQuotaError) {
                          quotaExhausted = true;
                          console.warn("Gemini API Quota exhausted on page", i + 1);
                      } else {
                          lastApiError = errMsg;
                          console.error(`AI Scan API error at page ${i+1}:`, errMsg);
                      }
                  }
              }

              // 3. FALLBACK: FAST LOCAL EXTRACTION (If AI failed or quota exhausted)
              if (!extractedData || (!extractedData.jobCode && !extractedData.accountNumber && !extractedData.customerName)) {
                  if (mimeType.includes("pdf")) {
                      try {
                          const localText = await extractTextFromBlob(blob);
                          if (localText && localText.trim().length > 10) {
                              const parsed = parseDocumentText(localText, jobs);
                              if (parsed.jobCode || parsed.accountNumber || parsed.customerName || parsed.amount) {
                                  extractedData = parsed;
                              }
                          }
                      } catch (err) {
                          console.warn("Local PDF text extraction skipped:", err);
                      }
                  }
              }

              // 4. Update Row if data was found
              if (extractedData && (extractedData.jobCode || extractedData.accountNumber || extractedData.customerName || extractedData.amount)) {
                  const applied = applyExtractedDataToRow(i, extractedData);
                  setScanProgressMessage(`Đã ghi xong Trang ${i + 1}/${rows.length}: BL: ${applied.jobCode || '---'} | KH: ${applied.customerName || '---'} | Tiền: ${applied.amount ? formatCurrency(applied.amount) : '0 đ'} | STK: ${applied.accountNumber || '---'}`);
                  successCount++;
              }

          } catch (e: any) {
              console.error(`Scan Error at page ${i+1}:`, e);
          }
      }

      setIsScanning(false);
      setScanningCurrentIndex(null);
      setScanProgressMessage('');

      if (cancelScanRef.current) {
          alert(`Đã tạm dừng quá trình đọc file. Đã ghi nhận dữ liệu cho ${successCount} trang.`, "Đã dừng");
          return;
      }

      if (quotaExhausted) {
          if (successCount > 0) {
              alert(`Hệ thống đã đọc và ghi nhận được ${successCount} trang. Tuy nhiên hạn mức AI mặc định đã hết. Bạn có thể bấm biểu tượng Chìa khóa (API Key) để cấu hình Gemini API Key cá nhân nhằm quét tiếp các trang phức tạp hoặc dạng ảnh.`, "Đã quét một phần");
          } else {
              alert("Hạn mức Gemini API (Credits/Quota) mặc định đã hết. Vui lòng bấm vào nút 'Cấu hình API Key' để nhập Gemini API Key cá nhân hoặc kiểm tra lại file đính kèm.", "Hạn mức AI");
              setTempApiKey(customApiKey);
              setIsApiKeyModalOpen(true);
          }
      } else {
          if (successCount > 0) {
              alert(`Đã hoàn tất quá trình đọc file! AI đã đọc từng trang và ghi lại dữ liệu chính xác cho ${successCount} dòng.`, "Thành công");
          } else {
              if (lastApiError) {
                  alert(`Lỗi hệ thống khi quét AI: ${lastApiError}. Vui lòng kiểm tra lại kết nối mạng hoặc API Key.`, "Lỗi API");
              } else {
                  alert("Không trích xuất được thông tin từ các trang này. Bạn có thể tự nhập tay hoặc kiểm tra lại chất lượng file đính kèm.", "Thông báo");
              }
          }
      }
  };

  const uploadSingleFile = async (fileToUpload: File, fileName: string): Promise<{ url: string, name: string }> => {
      const formData = new FormData();
      formData.append("fileName", fileName); 
      formData.append("file", fileToUpload);

      const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
          const finalFileName = res.data.fileName || fileName;
          let uploadedUrl = res.data.cvhcUrl;
          if (uploadedUrl && !uploadedUrl.startsWith('http')) {
              uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
          }
          return { url: uploadedUrl, name: finalFileName };
      }
      throw new Error(res.data?.message || "Upload failed");
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (!file) {
      alert("Vui lòng chọn file đính kèm!", "Thông báo");
      return;
    }
    const invalidRows = rows.filter(r => !r.jobCode || !r.jobId);
    if (invalidRows.length > 0) {
      alert("Vui lòng nhập đúng Số BL (Job Code) cho tất cả các dòng. Hệ thống cần tìm thấy Job tương ứng.", "Cảnh báo");
      return;
    }

    setIsUploading(true);
    setUploadProgress('Đang xử lý...');

    try {
      // IF PDF AND MULTIPLE ROWS: SPLIT PDF
      if (file.type === 'application/pdf' && rows.length > 1) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const actualPageCount = pdfDoc.getPages().length;

          if (actualPageCount !== rows.length) {
              throw new Error(`Số trang PDF (${actualPageCount}) không khớp với số dòng dữ liệu (${rows.length}). Vui lòng kiểm tra lại.`);
          }

          let successCount = 0;

          // Loop through rows and split
          for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              setUploadProgress(`Đang tách và upload trang ${i + 1}/${actualPageCount}...`);

              // Split Page
              const subDoc = await PDFDocument.create();
              const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
              subDoc.addPage(copiedPage);
              const subPdfBytes = await subDoc.save();
              
              // Create File
              const safeJobCode = String(row.jobCode).replace(/[^a-zA-Z0-9-_]/g, ''); 
              const subFileName = `CVHC BL ${safeJobCode}.pdf`;
              const subFile = new File([subPdfBytes], subFileName, { type: 'application/pdf' });

              // Upload
              const result = await uploadSingleFile(subFile, subFileName);

              // Update Jobs mapped to this row
              const jobIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
              const isMulti = jobIds.length > 1;

              for (const jId of jobIds) {
                  const job = jobs.find(j => j.id === jId);
                  if (job) {
                      const finalAmount = isMulti ? job.thuCuoc : row.amount;
                      const updatedJob: JobData = {
                          ...job,
                          thuCuoc: finalAmount,
                          maKhCuocId: row.customerId || job.maKhCuocId,
                          cvhcUrl: result.url,
                          cvhcFileName: result.name
                      };
                      onUpdateJob(updatedJob);
                      successCount++;
                  }
              }
          }
          
          alert(`Hoàn tất! Đã tách file và cập nhật CVHC cho ${successCount} Job.`, "Thành công");

      } else {
          // SINGLE FILE (Image or 1-page PDF or just one row)
          const ext = file.name.split('.').pop() || 'pdf';
          
          const mainJobCode = rows[0]?.jobCode || 'Unknown';
          const safeJobCode = String(mainJobCode).replace(/[^a-zA-Z0-9-_]/g, ''); 
          const svFileName = `CVHC BL ${safeJobCode}.${ext}`;

          setUploadProgress('Đang upload file...');
          const result = await uploadSingleFile(file, svFileName);

          // Update All Rows with SAME File (usually just 1 row now)
          let updatedCount = 0;
          rows.forEach(row => {
              const jobIds = row.jobId ? row.jobId.split(',').map(id => id.trim()).filter(Boolean) : [];
              const isMulti = jobIds.length > 1;

              jobIds.forEach(jId => {
                  const job = jobs.find(j => j.id === jId);
                  if (job) {
                      const finalAmount = isMulti ? job.thuCuoc : row.amount;
                      const updatedJob: JobData = {
                          ...job,
                          thuCuoc: finalAmount, 
                          maKhCuocId: row.customerId || job.maKhCuocId,
                          cvhcUrl: result.url,
                          cvhcFileName: result.name
                      };
                      onUpdateJob(updatedJob);
                      updatedCount++;
                  }
              });
          });
          
          alert(`Đã nộp CVHC thành công cho ${updatedCount} Job! File: ${result.name}`, "Thành công");
      }

      // Reset form
      resetForm(); 

    } catch (err: any) {
      console.error("Submit Error:", err);
      const msg = err.response?.data?.message || err.message || "Unknown Error";
      alert(`Có lỗi xảy ra: ${msg}`, "Lỗi");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleEditJobClick = (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
          setEditingJob(JSON.parse(JSON.stringify(job)));
          setIsJobModalOpen(true);
      }
  };

  const handleSaveJobModal = (updatedJob: JobData, newCustomer?: Customer) => {
      onUpdateJob(updatedJob);
      if (newCustomer && onAddCustomer) onAddCustomer(newCustomer);
      setIsJobModalOpen(false);
      
      // Auto refresh the row data based on new job info
      setRows(prev => prev.map(row => {
          if (row.jobId === updatedJob.id) {
              const custId = updatedJob.maKhCuocId || updatedJob.customerId;
              const custName = findCustomer(custId)?.name || updatedJob.customerName;
              return {
                  ...row,
                  jobCode: updatedJob.jobCode,
                  amount: updatedJob.thuCuoc,
                  customerId: custId,
                  customerName: custName
              };
          }
          return row;
      }));
  };

  return (
    <div className="p-8 w-full h-full flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
             <FileCheck className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Nộp CVHC (Công Văn Hoàn Cược)</h1>
        </div>
        <p className="text-slate-500 ml-11">Cập nhật chứng từ hoàn cược cho các lô hàng</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          
          {/* File Upload Section */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400">
                      <Upload className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-700">File đính kèm (PDF/Image)</h3>
                      <p className="text-xs text-slate-500">
                          Vui lòng chọn file PDF nhiều trang hoặc file ảnh đơn lẻ. Hệ thống sẽ tự động nhận diện.
                      </p>
                  </div>
              </div>
              <div className="flex items-center space-x-3">
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden" 
                      accept="*/*"
                  />
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                      {file ? "Đổi File" : "Chọn File"}
                  </button>
                  {file && <span className="text-sm font-medium text-indigo-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> {file.name}</span>}
              </div>
          </div>

          {!file && rows.some(r => r.previewUrl) && (
              <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start space-x-3 text-amber-800 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                      <span className="font-bold">Đã khôi phục dữ liệu nháp:</span> Hệ thống đã tự động phục hồi dữ liệu từ phiên làm việc trước. Vui lòng <strong className="underline cursor-pointer hover:text-amber-950" onClick={() => fileInputRef.current?.click()}>chọn lại file gốc</strong> để khôi phục ảnh xem trước (Preview) hoặc thực hiện lưu/nộp thành công.
                  </div>
              </div>
          )}

          {/* Page Count Input & AI SCAN */}
          <div className="mb-4 flex flex-wrap justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 gap-3">
              <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                  <label className="font-bold text-slate-700">Số lượng trang/Job:</label>
                  <input 
                      type="number" 
                      min="1" 
                      value={pageCount} 
                      disabled={isLocked}
                      onChange={(e) => handlePageCountChange(Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-blue-300 rounded-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs text-slate-500 italic">
                      (Tự động cập nhật khi chọn file PDF)
                  </span>
              </div>
              
              <div className="flex items-center space-x-3">
                  {/* GLOBAL LOCK BUTTON */}
                  <button 
                      type="button"
                      onClick={() => setIsLocked(!isLocked)}
                      className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${isLocked ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                      title={isLocked ? "Mở khóa tất cả các dòng" : "Khóa tất cả các dòng tránh bị thay đổi"}
                  >
                      {isLocked ? <Lock className="w-4 h-4 text-amber-600 animate-pulse" /> : <Unlock className="w-4 h-4 text-slate-500" />}
                      {isLocked ? "Đang Khóa" : "Mở Khóa"}
                  </button>

                  {/* API KEY CONFIG BUTTON */}
                  <button 
                      type="button"
                      onClick={() => {
                          setTempApiKey(customApiKey);
                          setIsApiKeyModalOpen(true);
                      }}
                      className={`p-2 border rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-1 ${customApiKey ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                      title={customApiKey ? "API Key Gemini tùy chỉnh đã được cấu hình" : "Cấu hình Gemini API Key"}
                  >
                      <Key className="w-4 h-4 text-indigo-600" />
                  </button>

                  {/* AI SCAN BUTTON */}
                  <button 
                      onClick={handleAutoScan}
                      disabled={isScanning || !file || isLocked}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      title="AI đóng vai trò 1 chuyên viên: đọc từng trang của file đính kèm và ghi chép số BL, khách hàng, tiền hoàn cược và STK vào từng dòng tương ứng"
                  >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>AI Đọc Từng Trang & Ghi Dòng</span>
                  </button>
              </div>
          </div>

          {/* LIVE AI READING BANNER */}
          {isScanning && (
              <div className="mb-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl p-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between gap-4 mb-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
                              <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                          <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                                  <span>AI đang đóng vai trò người đọc từng trang và ghi lại...</span>
                                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                                      Trang {(scanningCurrentIndex !== null ? scanningCurrentIndex + 1 : 1)} / {rows.length}
                                  </span>
                              </h4>
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                  {scanProgressMessage || "Đang đọc văn bản, số BL, tên khách hàng, số tiền hoàn cược và số tài khoản..."}
                              </p>
                          </div>
                      </div>
                      <button
                          type="button"
                          onClick={() => { cancelScanRef.current = true; }}
                          className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                          <StopCircle className="w-3.5 h-3.5" />
                          Dừng lại
                      </button>
                  </div>
                  <div className="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
                      <div 
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, Math.round(((scanningCurrentIndex !== null ? scanningCurrentIndex + 1 : 0) / (rows.length || 1)) * 100))}%` }}
                      />
                  </div>
              </div>
          )}

          {/* Data Entry Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 mb-6">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-3 py-3 w-16 text-center">Trang</th>
                          <th className="px-3 py-3 w-[310px]">
                              <div className="flex items-center justify-between">
                                  <span>Số BL (Job Code)</span>
                                  {rows.some(r => r.jobCode) && (
                                      <button
                                          type="button"
                                          onClick={() => {
                                              const allCodes = rows.map(r => r.jobCode.trim()).filter(Boolean).join('\n');
                                              if (allCodes) {
                                                  handleCopyText(allCodes, 'col-jobCode');
                                              }
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-all shrink-0"
                                          title="Copy toàn bộ cột Số BL (Job Code) (mỗi dòng một hàng)"
                                      >
                                          {copiedState['col-jobCode'] ? <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                  )}
                              </div>
                          </th>
                          <th className="px-4 py-3 min-w-[320px]">Khách hàng (Cược)</th>
                          <th className="px-3 py-3 w-40 text-right">Số tiền cược</th>
                          <th className="px-3 py-3 w-48">
                              <div className="flex items-center justify-between">
                                  <span>Số tài khoản</span>
                                  {rows.some(r => r.accountNumber) && (
                                      <button
                                          type="button"
                                          onClick={() => {
                                              const allAccounts = rows.map(r => r.accountNumber?.trim()).filter(Boolean).join('\n');
                                              if (allAccounts) {
                                                  handleCopyText(allAccounts, 'col-account');
                                              }
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-all shrink-0"
                                          title="Copy toàn bộ cột Số tài khoản (mỗi dòng một hàng)"
                                      >
                                          {copiedState['col-account'] ? <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                  )}
                              </div>
                          </th>
                          <th className="px-2 py-3 w-14 text-center">Xem</th>
                          <th className="px-2 py-3 w-24 text-center">Chi hoàn</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                          <React.Fragment key={row.id}>
                          <tr className={`transition-colors ${scanningCurrentIndex === idx ? 'bg-purple-50/90 ring-2 ring-purple-400 font-medium' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-3 py-3 text-center">
                                  <div className="flex flex-col items-center justify-center gap-1">
                                      <span className="font-bold text-slate-700 text-xs">{`Trang ${idx + 1}`}</span>
                                      {row.previewUrl && (
                                          <button
                                              type="button"
                                              onClick={() => scanSingleRow(idx)}
                                              disabled={isScanning || isLocked || scanningCurrentIndex === idx}
                                              className="px-2 py-0.5 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-2xs"
                                              title={`AI đọc riêng Trang ${idx + 1} và ghi lại dữ liệu vào dòng này`}
                                          >
                                              {scanningCurrentIndex === idx ? (
                                                  <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                                              ) : (
                                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                              )}
                                              <span>Đọc</span>
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-3 py-3">
                                  <div className="relative flex items-center gap-1.5">
                                      <div className="relative flex-1">
                                          <input 
                                              type="text" 
                                              value={row.jobCode}
                                              disabled={isLocked}
                                              onChange={(e) => handleJobCodeChange(row.id, e.target.value)}
                                              placeholder={isLocked ? "Đã khóa" : "Nhập số Job..."}
                                              className={`w-full px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${row.jobId ? 'border-green-300 focus:ring-green-500 bg-green-50 text-green-800' : 'border-slate-300 focus:ring-indigo-500'}`}
                                          />
                                          {(() => {
                                              const jobList = (row.jobCode || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
                                              if (jobList.length > 1) {
                                                  return (
                                                      <span 
                                                          className="absolute -top-2 right-2 min-w-[19px] h-[19px] px-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border-2 border-white z-10 select-none cursor-help transition-transform hover:scale-110"
                                                          title={`Ô này có ${jobList.length} số Job/BL:\n${jobList.map((j, i) => `${i + 1}. ${j}`).join('\n')}`}
                                                      >
                                                          {jobList.length}
                                                      </span>
                                                  );
                                              }
                                              return null;
                                          })()}
                                      </div>
                                      {row.jobCode && (
                                          <>
                                              <button 
                                                  type="button"
                                                  onClick={() => handleCopyText(`PAYMENT HOAN CUOC BL ${row.jobCode} MST 0316113070`, `${row.id}-desc`)}
                                                  className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0"
                                                  title="Copy nội dung chuyển khoản"
                                              >
                                                  {copiedState[`${row.id}-desc`] ? <Check className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4" />}
                                              </button>
                                              <button 
                                                  type="button"
                                                  onClick={() => handleCopyText("doc_hph@kimberryline.com", `${row.id}-email`)}
                                                  className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0"
                                                  title="Copy Email: doc_hph@kimberryline.com"
                                              >
                                                  {copiedState[`${row.id}-email`] ? <Check className="w-4 h-4 text-green-500" /> : <Mail className="w-4 h-4" />}
                                              </button>
                                          </>
                                      )}
                                      {row.jobId && (
                                          <button 
                                              onClick={() => onRowActionClick(row, 'edit')}
                                              disabled={isLocked}
                                              className={`p-2 rounded-lg transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${expandedRowId === row.id && expandedAction === 'edit' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-200'}`}
                                              title="Xem/Sửa Job"
                                          >
                                              <Edit3 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-4 py-3">
                                  <input 
                                      type="text" 
                                      value={row.customerName}
                                      disabled={isLocked}
                                      onChange={(e) => handleRowChange(row.id, 'customerName', e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-medium text-slate-800"
                                      placeholder="Tên khách hàng"
                                      title={row.customerName}
                                  />
                              </td>
                              <td className="px-3 py-3">
                                  <div className="relative flex items-center">
                                      <input 
                                          type="text" 
                                          value={row.amount > 0 ? new Intl.NumberFormat('en-US').format(row.amount) : ''}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                              const val = Number(e.target.value.replace(/,/g, ''));
                                              if(!isNaN(val)) handleRowChange(row.id, 'amount', val);
                                          }}
                                          className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                          placeholder="0"
                                      />
                                      {row.amount > 0 && (
                                          <button
                                              type="button"
                                              onClick={() => handleCopyText(row.amount.toString(), `${row.id}-amount`)}
                                              className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                              title="Copy số tiền cược"
                                          >
                                              {copiedState[`${row.id}-amount`] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-3 py-3">
                                  <div className="flex flex-col">
                                      <div className="relative flex items-center">
                                          <input 
                                              type="text" 
                                              value={row.accountNumber || ''}
                                              disabled={isLocked}
                                              onChange={(e) => handleRowChange(row.id, 'accountNumber', e.target.value)}
                                              className="w-full pl-2.5 pr-7 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                              placeholder="STK"
                                              title={row.accountNumber ? `STK: ${row.accountNumber}` : ''}
                                          />
                                          {row.accountNumber && (
                                              <button
                                                  type="button"
                                                  onClick={() => handleCopyText(row.accountNumber || '', `${row.id}-account`)}
                                                  className="absolute right-1.5 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                                  title="Copy số tài khoản"
                                              >
                                                  {copiedState[`${row.id}-account`] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                              </button>
                                          )}
                                      </div>

                                      {/* Hiển thị tên ngân hàng - người nhận là cá nhân bên dưới số tài khoản */}
                                      {editingSubtitleRowId === row.id ? (
                                          <div className="mt-1 flex items-center gap-1">
                                              <input
                                                  type="text"
                                                  value={subtitleInput}
                                                  onChange={(e) => setSubtitleInput(e.target.value)}
                                                  onKeyDown={(e) => {
                                                      if (e.key === 'Enter') handleSaveSubtitle(row.id, subtitleInput);
                                                      if (e.key === 'Escape') setEditingSubtitleRowId(null);
                                                  }}
                                                  placeholder="Ngân hàng - Tên cá nhân"
                                                  className="w-full text-[11px] px-1.5 py-0.5 border border-indigo-300 rounded bg-white text-indigo-900 outline-none focus:ring-1 focus:ring-indigo-500"
                                                  autoFocus
                                              />
                                              <button
                                                  type="button"
                                                  onClick={() => handleSaveSubtitle(row.id, subtitleInput)}
                                                  className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                                  title="Lưu"
                                              >
                                                  <Check className="w-3 h-3" />
                                              </button>
                                              <button
                                                  type="button"
                                                  onClick={() => setEditingSubtitleRowId(null)}
                                                  className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                                                  title="Hủy"
                                              >
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </div>
                                      ) : (() => {
                                          const subtitle = formatAccountSubtitle(row.bankName, row.accountHolder, row.customerName);
                                          if (subtitle) {
                                              return (
                                                  <div 
                                                      className="text-[11px] text-indigo-700 font-medium truncate mt-1 flex items-center gap-1 group cursor-pointer"
                                                      onClick={() => {
                                                          if (isLocked) return;
                                                          setSubtitleInput(subtitle);
                                                          setEditingSubtitleRowId(row.id);
                                                      }}
                                                      title={`Ngân hàng & Người nhận cá nhân: ${subtitle} (Bấm để sửa)`}
                                                  >
                                                      <span className="text-indigo-500 shrink-0 text-[10px]">🏦</span>
                                                      <span className="truncate group-hover:underline">{subtitle}</span>
                                                      <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-indigo-400 shrink-0 transition-opacity" />
                                                  </div>
                                              );
                                          }
                                          if (row.accountNumber && !isLocked) {
                                              return (
                                                  <button
                                                      type="button"
                                                      onClick={() => {
                                                          setSubtitleInput('');
                                                          setEditingSubtitleRowId(row.id);
                                                      }}
                                                      className="text-[10px] text-slate-400 hover:text-indigo-600 mt-0.5 text-left flex items-center gap-0.5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                                      title="Thêm tên ngân hàng / người nhận cá nhân"
                                                  >
                                                      <span>+ Ngân hàng</span>
                                                  </button>
                                              );
                                          }
                                          return null;
                                      })()}
                                  </div>
                              </td>
                              <td className="px-2 py-3 text-center">
                                  {row.previewUrl ? (
                                      <button 
                                        type="button"
                                        onClick={() => setIframePreviewUrl(row.previewUrl || null)}
                                        className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                        title="Xem trực tiếp tài liệu"
                                      >
                                          <Eye className="w-4 h-4" />
                                      </button>
                                  ) : (
                                      <span className="text-slate-300">-</span>
                                  )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                  {row.jobId ? (() => {
                                      const ids = row.jobId.split(',').map(id => id.trim()).filter(Boolean);
                                      const hasUnrefunded = ids.some(id => {
                                          const j = jobs.find(x => x.id === id);
                                          return j && !j.amisDepositRefundDocNo;
                                      });
                                      if (!hasUnrefunded) {
                                          return <span className="text-slate-300">-</span>;
                                      }
                                      return (
                                          <button 
                                            type="button"
                                            onClick={() => onRowActionClick(row, 'refund')}
                                            disabled={isLocked}
                                            className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${expandedRowId === row.id && expandedAction === 'refund' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 border-orange-200/50'}`}
                                            title="Chi hoàn cược cho Job này"
                                          >
                                              <RotateCcw className="w-4 h-4" />
                                          </button>
                                      );
                                  })() : (
                                      <span className="text-slate-300">-</span>
                                  )}
                              </td>
                          </tr>
                          {expandedRowId === row.id && (
                              <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner">
                                  <td colSpan={7} className="p-4">
                                      <div className="flex flex-col gap-2">
                                          <div className="text-sm font-bold text-slate-700 mb-1">
                                              {expandedAction === 'edit' ? 'Chọn Job để Xem/Sửa:' : 'Chọn Job để Chi hoàn cược:'}
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                              {row.jobId!.split(',').map(id => id.trim()).filter(Boolean).map(jId => {
                                                  const job = jobs.find(j => j.id === jId);
                                                  if (!job) return null;
                                                  
                                                  const isRefunded = !!job.amisDepositRefundDocNo;
                                                  if (expandedAction === 'refund' && isRefunded) return null;
                                                  
                                                  return (
                                                      <button
                                                          key={jId}
                                                          onClick={() => {
                                                              if (expandedAction === 'edit') {
                                                                  handleEditJobClick(jId);
                                                              } else {
                                                                  handleRowRefundSingle(jId);
                                                              }
                                                              setExpandedRowId(null);
                                                              setExpandedAction(null);
                                                          }}
                                                          className={`p-3 border rounded-xl text-left hover:bg-white shadow-sm transition-all flex justify-between items-center ${expandedAction === 'edit' ? 'border-blue-200 hover:border-blue-400' : 'border-orange-200 hover:border-orange-400'}`}
                                                      >
                                                          <div>
                                                              <div className="font-bold text-slate-800">{job.jobCode}</div>
                                                              <div className="text-xs text-slate-500 mt-0.5">Tiền cược: {formatCurrency(job.thuCuoc || 0)}</div>
                                                          </div>
                                                          {expandedAction === 'edit' ? <Edit3 className="w-4 h-4 text-blue-500" /> : <RotateCcw className="w-4 h-4 text-orange-500" />}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          )}
                          </React.Fragment>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-3">
                  {isUploading && <span className="text-sm font-bold text-indigo-600 animate-pulse flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin"/> {uploadProgress}</span>}
                  
                  {!isUploading && rows.some(r => r.jobCode || r.accountNumber || r.previewUrl) && (
                      <button 
                          onClick={async () => {
                              if (await confirm("Bạn có chắc chắn muốn xóa toàn bộ dữ liệu nháp hiện tại và đặt lại bảng?", "Xác nhận xóa nháp")) {
                                  resetForm();
                              }
                          }}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-sm transition-all transform active:scale-95 flex items-center"
                      >
                          Xóa nháp
                      </button>
                  )}
              </div>
              <div className="flex space-x-3">
                  <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-sm flex items-center">
                      Tổng tiền: <span className="text-indigo-600 ml-2 text-lg">{formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>

                  <button 
                      onClick={handleSubmit}
                      disabled={isUploading}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      <Save className="w-4 h-4 mr-2" /> {isUploading ? 'Đang xử lý...' : 'Lưu & Cập nhật'}
                  </button>
              </div>
          </div>

      </div>

      {isJobModalOpen && editingJob && (
          <JobModal
              isOpen={isJobModalOpen}
              onClose={() => setIsJobModalOpen(false)}
              onSave={handleSaveJobModal}
              initialData={editingJob}
              customers={customers}
              lines={lines}
              onAddLine={onAddLine || (() => {})}
              onAddCustomer={onAddCustomer || (() => {})}
              onViewBookingDetails={() => {}}
              isViewMode={false}
              existingJobs={jobs}
          />
      )}

      {isQuickReceiveOpen && quickReceiveJob && (
          <QuickReceiveModal 
              isOpen={isQuickReceiveOpen}
              onClose={() => setIsQuickReceiveOpen(false)}
              onSave={handleSaveQuickReceive}
              job={quickReceiveJob}
              mode={quickReceiveMode}
              customers={customers}
              allJobs={jobs}
              usedDocNos={usedDocNos}
              onAddCustomer={onAddCustomer}
          />
      )}

      {/* Embedded Iframe Document Preview Modal */}
      {iframePreviewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                          <Eye className="w-5 h-5 text-indigo-600" />
                          <span className="font-bold text-slate-800 text-lg">Xem trước tài liệu</span>
                      </div>
                      <button 
                          onClick={() => setIframePreviewUrl(null)}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          title="Đóng xem trước"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="flex-1 bg-slate-100 p-2">
                      <iframe 
                          src={iframePreviewUrl} 
                          className="w-full h-full border-0 rounded-lg"
                          title="Document Page Preview"
                      />
                  </div>
              </div>
          </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
                  <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                      <div className="flex items-center space-x-2.5">
                          <Key className="w-5 h-5" />
                          <span className="font-bold text-lg">Cấu hình Gemini API Key</span>
                      </div>
                      <button 
                          onClick={() => setIsApiKeyModalOpen(false)}
                          className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                      <p className="text-sm text-slate-600 leading-relaxed">
                          Chọn hoặc nhập <strong>Google Gemini API Key</strong> cá nhân của bạn để sử dụng tính năng quét AI trích xuất Số Bill (Job Code) và Số Tài Khoản từ tài liệu ảnh hoặc PDF scan.
                      </p>

                      {/* QUICK SELECTION FROM SAVED KEYS */}
                      {savedKeys.length > 0 && (
                          <div className="space-y-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                              <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Key className="w-3.5 h-3.5 text-amber-500" />
                                      Chọn nhanh từ Key đã lưu ({savedKeys.length}):
                                  </label>
                                  {onNavigate && (
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setIsApiKeyModalOpen(false);
                                              onNavigate('api-keys');
                                          }}
                                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                      >
                                          Quản lý tất cả keys <ExternalLink className="w-3 h-3" />
                                      </button>
                                  )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {savedKeys.map((k) => {
                                      const isSelected = tempApiKey.trim() === k.key.trim();
                                      return (
                                          <button
                                              key={k.id}
                                              type="button"
                                              onClick={() => {
                                                  setTempApiKey(k.key);
                                                  setTestResult(null);
                                              }}
                                              className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                                                  isSelected 
                                                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900 shadow-sm' 
                                                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                                              }`}
                                          >
                                              <div className="flex items-center justify-between w-full">
                                                  <span className="font-bold text-xs truncate">{k.name}</span>
                                                  {isSelected && <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />}
                                              </div>
                                              <span className="text-[10px] font-mono text-slate-400 mt-1">
                                                  {maskApiKey(k.key)}
                                              </span>
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      )}

                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                              <span>Gemini API Key đang áp dụng</span>
                              <button
                                  type="button"
                                  onClick={async () => {
                                      try {
                                          const text = await navigator.clipboard.readText();
                                          if (text) {
                                              setTempApiKey(text.trim());
                                              setTestResult(null);
                                          }
                                      } catch {}
                                  }}
                                  className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                              >
                                  <Copy className="w-3 h-3" /> Dán từ Clipboard
                              </button>
                          </label>
                          <div className="relative flex items-center gap-2">
                              <input 
                                  type="password"
                                  value={tempApiKey}
                                  onChange={(e) => {
                                      setTempApiKey(e.target.value);
                                      setTestResult(null);
                                  }}
                                  placeholder="AIzaSy..."
                                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                              />
                              <button
                                  type="button"
                                  disabled={!tempApiKey.trim() || isTestingKey}
                                  onClick={async () => {
                                      setIsTestingKey(true);
                                      const res = await testGeminiApiKey(tempApiKey);
                                      setTestResult(res);
                                      setIsTestingKey(false);
                                  }}
                                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 shrink-0 flex items-center gap-1.5"
                                  title="Kiểm tra xem API Key này có hoạt động tốt không"
                              >
                                  {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  Test
                              </button>
                          </div>
                      </div>

                      {testResult && (
                          <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 animate-in fade-in duration-200 ${
                              testResult.success 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : 'bg-red-50 text-red-800 border-red-200'
                          }`}>
                              {testResult.success ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                              )}
                              <span>{testResult.message}</span>
                          </div>
                      )}

                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                              Lưu ý & Hướng dẫn:
                          </div>
                          <div>• Lấy API Key hoàn toàn miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold text-blue-600 hover:text-blue-800">Google AI Studio</a>.</div>
                          <div>• Để lưu và quản lý nhiều keys, hãy vào menu <strong>Cài đặt ➔ Quản lý Key API</strong> ở thanh trên.</div>
                      </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
                      {customApiKey && (
                          <button
                              type="button"
                              onClick={() => {
                                  setActiveApiKey('');
                                  setCustomApiKey('');
                                  setTempApiKey('');
                                  setTestResult(null);
                                  setIsApiKeyModalOpen(false);
                                  alert("Đã xóa API Key tùy chỉnh.", "Thông báo");
                              }}
                              className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors mr-auto"
                          >
                              Xóa Key
                          </button>
                      )}
                      <button 
                          type="button"
                          onClick={() => {
                              setIsApiKeyModalOpen(false);
                              setTestResult(null);
                          }}
                          className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                          Hủy
                      </button>
                      <button 
                          type="button"
                          onClick={() => {
                              const trimmed = tempApiKey.trim();
                              if (trimmed) {
                                  setActiveApiKey(trimmed);
                                  setCustomApiKey(trimmed);
                                  setIsApiKeyModalOpen(false);
                                  setTestResult(null);
                                  alert("Đã lưu & kích hoạt Gemini API Key thành công!", "Thành công");
                              } else {
                                  setActiveApiKey('');
                                  setCustomApiKey('');
                                  setIsApiKeyModalOpen(false);
                                  setTestResult(null);
                              }
                          }}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                      >
                          <Check className="w-4 h-4" />
                          Lưu & Áp Dụng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
