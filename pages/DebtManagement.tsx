import React, { useState, useMemo, useEffect } from 'react';
import { JobData, Customer } from '../types';
import { 
  WalletCards, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw, 
  Building2, 
  DollarSign, 
  Coins, 
  Calendar,
  Layers,
  ArrowUpDown,
  ExternalLink,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DebtManagementProps {
  jobs: JobData[];
  customers: Customer[];
  onEditJob?: (jobOrJobs: JobData | JobData[]) => void;
  onViewJob?: (jobId: string) => void;
}

type CurrencyTypeFilter = 'all' | 'invoice' | 'deposit' | 'extension';
type StatusFilter = 'all' | 'unpaid' | 'paid';

interface CustomerDebtItem {
  key: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  mst?: string;
  
  // Invoice stats
  totalAmount: number;
  amountPaid: number;
  amountUnpaid: number;
  status: 'PAID' | 'UNPAID' | 'PARTIAL' | 'NO_INVOICE';
  isManuallyOverridden?: boolean;
  
  // Deposit stats
  totalDeposit: number;
  depositType: 'Pending' | 'Refunded' | '-';
  isDepositTypeManuallyOverridden?: boolean;
  depositPendingCount: number;
  depositRefundedCount: number;
  
  // Extension stats
  totalExtension: number;
  extensionPaid: number;
  extensionUnpaid: number;
  
  // Final Debt
  totalDebt: number; // Tổng các số tiền amount và gia hạn chưa thu
  
  // Detail job items
  jobs: {
    id: string;
    jobCode: string;
    booking: string;
    month: string;
    year: number;
    invoiceNo: string;
    invoiceDate: string;
    amount: number;
    isPaid: boolean;
    bank: string;
    depositAmount: number;
    depositRefunded: boolean;
    depositDateOut?: string;
    depositDateIn?: string;
    extensionAmount: number;
    extensionPaid: boolean;
  }[];
}

export const DebtManagement: React.FC<DebtManagementProps> = ({ 
  jobs, 
  customers, 
  onEditJob, 
  onViewJob 
}) => {
  // --- FILTERS STATE ---
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [currencyType, setCurrencyType] = useState<CurrencyTypeFilter>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // --- PAGINATION STATE (Default: 10 rows per page) ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Auto reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonth, currencyType, selectedCustomerId, statusFilter, searchTerm, pageSize]);

  // --- EXPANDED ROWS STATE ---
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // --- MANUAL STATUS OVERRIDES (Persisted in LocalStorage) ---
  const [manualStatusMap, setManualStatusMap] = useState<Record<string, 'PAID' | 'UNPAID'>>(() => {
    try {
      const saved = localStorage.getItem('kb_debt_customer_status');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist manual status map
  useEffect(() => {
    try {
      localStorage.setItem('kb_debt_customer_status', JSON.stringify(manualStatusMap));
    } catch (e) {
      console.warn('Failed to save manual status map', e);
    }
  }, [manualStatusMap]);

  // --- MANUAL DEPOSIT TYPE OVERRIDES (Pending / Refunded) ---
  const [manualDepositTypeMap, setManualDepositTypeMap] = useState<Record<string, 'Pending' | 'Refunded'>>(() => {
    try {
      const saved = localStorage.getItem('kb_debt_customer_deposit_type');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist manual deposit type map
  useEffect(() => {
    try {
      localStorage.setItem('kb_debt_customer_deposit_type', JSON.stringify(manualDepositTypeMap));
    } catch (e) {
      console.warn('Failed to save manual deposit type map', e);
    }
  }, [manualDepositTypeMap]);

  // Currency Formatter
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val || 0);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    jobs.forEach(j => {
      if (j.year) years.add(j.year);
    });
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [jobs]);

  // Available Months (1 to 12)
  const availableMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => String(i + 1));
  }, []);

  // Helper to find customer by ID, code, or name
  const findCustomer = (idOrCode?: string, name?: string): Customer | null => {
    if (idOrCode) {
      const clean = String(idOrCode).trim().toLowerCase();
      const byId = customers.find(c => c.id && String(c.id).toLowerCase() === clean);
      if (byId) return byId;
      const byCode = customers.find(c => c.code && String(c.code).toLowerCase() === clean);
      if (byCode) return byCode;
    }
    if (name) {
      const cleanName = String(name).trim().toLowerCase();
      const byName = customers.find(c => (c.name && String(c.name).toLowerCase() === cleanName) || (c.code && String(c.code).toLowerCase() === cleanName));
      if (byName) return byName;
    }
    return null;
  };

  // --- CORE DATA AGGREGATION ---
  const aggregatedData = useMemo(() => {
    // 1. Filter jobs by Year & Month
    const filteredJobs = jobs.filter(job => {
      if (selectedYear !== 'all') {
        const jobYear = job.year ? String(job.year) : '';
        if (jobYear !== selectedYear) return false;
      }
      if (selectedMonth !== 'all') {
        const jobMonth = job.month ? String(Number(job.month)) : '';
        const targetMonth = String(Number(selectedMonth));
        if (jobMonth !== targetMonth) return false;
      }
      return true;
    });

    // 2. Map of customer key -> CustomerDebtItem accumulator
    const customerMap = new Map<string, {
      customerId: string;
      customerCode: string;
      customerName: string;
      mst?: string;
      jobs: CustomerDebtItem['jobs'];
      totalAmount: number;
      amountPaid: number;
      amountUnpaid: number;
      totalDeposit: number;
      depositPendingCount: number;
      depositRefundedCount: number;
      totalExtension: number;
      extensionPaid: number;
      extensionUnpaid: number;
    }>();

    // Helper to get or init customer bucket
    const getBucket = (cId?: string, cName?: string) => {
      const found = findCustomer(cId, cName);
      const key = found ? found.id : (cId || cName || 'UNKNOWN');
      const code = found ? found.code : (cId || 'KH-VANG');
      const name = found ? found.name : (cName || cId || 'Khách hàng vãng lai');
      const mst = found?.mst;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customerId: key,
          customerCode: code,
          customerName: name,
          mst,
          jobs: [],
          totalAmount: 0,
          amountPaid: 0,
          amountUnpaid: 0,
          totalDeposit: 0,
          depositPendingCount: 0,
          depositRefundedCount: 0,
          totalExtension: 0,
          extensionPaid: 0,
          extensionUnpaid: 0
        });
      }
      return customerMap.get(key)!;
    };

    // Process every filtered job
    filteredJobs.forEach(job => {
      // 1. Thu Invoice (Amount / Local charge)
      const invoiceAmt = Number(job.localChargeTotal) || 0;
      const hasInvoiceData = invoiceAmt > 0 || (job.localChargeInvoice && String(job.localChargeInvoice).trim().length > 0);
      const isJobPaid = Boolean(job.bank && String(job.bank).trim().length > 0) || Boolean(job.amisLcDocNo);
      const invBucket = getBucket(job.customerId, job.customerName);

      // 2. Thu Cược (Deposit): may belong to maKhCuocId or job's customer or jobDeposits
      const depositsByBucket = new Map<ReturnType<typeof getBucket>, { amount: number, isRefunded: boolean }>();
      const mainDepositAmt = Number(job.thuCuoc) || 0;
      if (mainDepositAmt > 0) {
        const depBucket = (job.maKhCuocId && job.maKhCuocId !== job.customerId)
          ? getBucket(job.maKhCuocId, undefined)
          : invBucket;
        const isRef = Boolean(job.ngayThuHoan && String(job.ngayThuHoan).trim().length > 0) || 
                      Boolean(job.amisDepositRefundDate) || 
                      Boolean(job.amisDepositRefundDocNo);
        depositsByBucket.set(depBucket, { amount: mainDepositAmt, isRefunded: isRef });
      }

      (job.jobDeposits || []).forEach(d => {
        const dAmt = Number(d.amount) || 0;
        if (dAmt > 0) {
          const b = d.customerId ? getBucket(d.customerId, undefined) : (
            job.maKhCuocId ? getBucket(job.maKhCuocId, undefined) : invBucket
          );
          const isRef = Boolean(d.dateIn && String(d.dateIn).trim().length > 0) ||
                        Boolean(job.ngayThuHoan && String(job.ngayThuHoan).trim().length > 0);
          const existing = depositsByBucket.get(b);
          if (existing) {
            existing.amount += dAmt;
            existing.isRefunded = existing.isRefunded && isRef;
          } else {
            depositsByBucket.set(b, { amount: dAmt, isRefunded: isRef });
          }
        }
      });

      // 3. Gia Hạn (Extensions / Demurage)
      const extByBucket = new Map<ReturnType<typeof getBucket>, { totalExt: number, extPaid: number, extUnpaid: number }>();
      const extensions = job.extensions || [];
      extensions.forEach(e => {
        const b = e.customerId ? getBucket(e.customerId, undefined) : invBucket;
        const amt = Number(e.total) || 0;
        const isPaid = Boolean(e.amisDocNo || e.amisAmount || e.locked || (job.bank && String(job.bank).trim().length > 0));
        if (!extByBucket.has(b)) extByBucket.set(b, { totalExt: 0, extPaid: 0, extUnpaid: 0 });
        const cur = extByBucket.get(b)!;
        cur.totalExt += amt;
        if (isPaid) cur.extPaid += amt;
        else cur.extUnpaid += amt;
      });

      // Collect all distinct customer buckets participating in this job
      const participatingBuckets = new Set<ReturnType<typeof getBucket>>();
      if (hasInvoiceData || invoiceAmt > 0) {
        participatingBuckets.add(invBucket);
      }
      depositsByBucket.forEach((_, b) => {
        participatingBuckets.add(b);
      });
      extByBucket.forEach((_, b) => {
        participatingBuckets.add(b);
      });
      if (participatingBuckets.size === 0) {
        participatingBuckets.add(invBucket);
      }

      // Add financial stats and job entry to EACH participating customer bucket
      participatingBuckets.forEach(b => {
        const custInvAmt = (b === invBucket) ? invoiceAmt : 0;
        const depInfo = depositsByBucket.get(b);
        const custDepAmt = depInfo ? depInfo.amount : 0;
        const custDepRef = depInfo ? depInfo.isRefunded : false;
        const extInfo = extByBucket.get(b) || { totalExt: 0, extPaid: 0, extUnpaid: 0 };

        // Add Invoice to bucket
        if (custInvAmt > 0) {
          b.totalAmount += custInvAmt;
          if (isJobPaid) {
            b.amountPaid += custInvAmt;
          } else {
            b.amountUnpaid += custInvAmt;
          }
        }

        // Add Deposit to bucket
        if (custDepAmt > 0) {
          b.totalDeposit += custDepAmt;
          if (custDepRef) {
            b.depositRefundedCount += 1;
          } else {
            b.depositPendingCount += 1;
          }
        }

        // Add Demurage to bucket
        if (extInfo.totalExt > 0) {
          b.totalExtension += extInfo.totalExt;
          b.extensionPaid += extInfo.extPaid;
          b.extensionUnpaid += extInfo.extUnpaid;
        }

        // Attach Job to this customer bucket
        b.jobs.push({
          id: String(job.id),
          jobCode: String(job.jobCode || 'N/A'),
          booking: String(job.booking || 'N/A'),
          month: String(job.month || ''),
          year: job.year || new Date().getFullYear(),
          invoiceNo: job.localChargeInvoice ? String(job.localChargeInvoice) : '',
          invoiceDate: job.localChargeDate ? String(job.localChargeDate) : '',
          amount: custInvAmt,
          isPaid: custInvAmt > 0 ? isJobPaid : true,
          bank: String(job.bank || ''),
          depositAmount: custDepAmt,
          depositRefunded: custDepRef,
          depositDateOut: job.ngayThuCuoc ? String(job.ngayThuCuoc) : '',
          depositDateIn: job.ngayThuHoan ? String(job.ngayThuHoan) : '',
          extensionAmount: extInfo.totalExt,
          extensionPaid: extInfo.extPaid > 0 && extInfo.extUnpaid === 0
        });
      });
    });

    // 3. Assemble and calculate final customer items
    const list: CustomerDebtItem[] = [];

    customerMap.forEach((bucket, key) => {
      // RULE: "những khách hàng có tồn tại nhưng không phát sinh thu invoice, deposit, gia hạn thì không cần hiện"
      const hasAnyTransaction = (bucket.totalAmount > 0) || (bucket.totalDeposit > 0) || (bucket.totalExtension > 0);
      if (!hasAnyTransaction) {
        return;
      }

      // Manual Override Check
      const manualOverride = manualStatusMap[key];
      let status: CustomerDebtItem['status'];
      let isManuallyOverridden = false;

      if (manualOverride) {
        status = manualOverride;
        isManuallyOverridden = true;
      } else if (bucket.totalAmount > 0) {
        if (bucket.amountUnpaid === 0 && bucket.amountPaid > 0) {
          status = 'PAID';
        } else if (bucket.amountPaid === 0) {
          status = 'UNPAID';
        } else {
          status = 'PARTIAL';
        }
      } else {
        status = 'NO_INVOICE';
      }

      // Deposit Type: Pending / Refunded / '-'
      let depositType: 'Pending' | 'Refunded' | '-' = '-';
      let isDepositTypeManuallyOverridden = false;
      if (bucket.totalDeposit > 0) {
        if (manualDepositTypeMap[key]) {
          depositType = manualDepositTypeMap[key];
          isDepositTypeManuallyOverridden = true;
        } else {
          depositType = bucket.depositPendingCount === 0 ? 'Refunded' : 'Pending';
        }
      }

      // RULE: "Cột công nợ bao gồm tổng các số tiền amount và gia hạn chưa thu"
      let unpaidAmountForDebt = 0;
      if (status === 'PAID') {
        unpaidAmountForDebt = 0;
      } else if (status === 'UNPAID') {
        unpaidAmountForDebt = bucket.totalAmount;
      } else if (status === 'PARTIAL') {
        unpaidAmountForDebt = bucket.amountUnpaid;
      } else {
        unpaidAmountForDebt = 0;
      }

      const totalDebt = unpaidAmountForDebt + bucket.extensionUnpaid;

      list.push({
        key,
        customerId: bucket.customerId,
        customerCode: bucket.customerCode,
        customerName: bucket.customerName,
        mst: bucket.mst,
        totalAmount: bucket.totalAmount,
        amountPaid: bucket.amountPaid,
        amountUnpaid: bucket.amountUnpaid,
        status,
        isManuallyOverridden,
        totalDeposit: bucket.totalDeposit,
        depositType,
        isDepositTypeManuallyOverridden,
        depositPendingCount: bucket.depositPendingCount,
        depositRefundedCount: bucket.depositRefundedCount,
        totalExtension: bucket.totalExtension,
        extensionPaid: bucket.extensionPaid,
        extensionUnpaid: bucket.extensionUnpaid,
        totalDebt,
        jobs: bucket.jobs
      });
    });

    // Default sorting: Most debt first, then by total amount
    return list.sort((a, b) => {
      if (b.totalDebt !== a.totalDebt) {
        return b.totalDebt - a.totalDebt;
      }
      return b.totalAmount - a.totalAmount;
    });
  }, [jobs, customers, selectedYear, selectedMonth, manualStatusMap, manualDepositTypeMap]);

  // --- FILTERED DATA (By Currency Type, Customer Select, Search, Status) ---
  const displayedData = useMemo(() => {
    return aggregatedData.filter(item => {
      // 1. Filter by Currency Type (Loại tiền invoice / deposit / gia hạn)
      if (currencyType === 'invoice' && item.totalAmount <= 0) {
        return false;
      }
      if (currencyType === 'deposit' && item.totalDeposit <= 0) {
        return false;
      }
      if (currencyType === 'extension' && item.totalExtension <= 0) {
        return false;
      }

      // 2. Filter by Specific Customer Dropdown
      if (selectedCustomerId !== 'all' && item.customerId !== selectedCustomerId && item.customerCode !== selectedCustomerId) {
        return false;
      }

      // 3. Filter by Status (Chưa thu tiền / Đã thu tiền)
      if (statusFilter === 'unpaid') {
        if (item.totalDebt <= 0 && item.status === 'PAID') return false;
      }
      if (statusFilter === 'paid') {
        if (item.totalDebt > 0 || item.status === 'UNPAID') return false;
      }

      // 4. Filter by Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchCustomer = 
          String(item.customerName || '').toLowerCase().includes(query) ||
          String(item.customerCode || '').toLowerCase().includes(query) ||
          (item.mst ? String(item.mst).toLowerCase().includes(query) : false);
        
        const matchJob = item.jobs.some(j => 
          String(j.jobCode || '').toLowerCase().includes(query) || 
          String(j.booking || '').toLowerCase().includes(query) ||
          String(j.invoiceNo || '').toLowerCase().includes(query)
        );

        if (!matchCustomer && !matchJob) {
          return false;
        }
      }

      return true;
    });
  }, [aggregatedData, currencyType, selectedCustomerId, statusFilter, searchTerm]);

  // --- PAGINATION DATA ---
  const totalItems = displayedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedData.slice(start, start + pageSize);
  }, [displayedData, currentPage, pageSize]);

  // --- KPI TOTALS ---
  const kpiTotals = useMemo(() => {
    let sumTotalDebt = 0;
    let sumTotalAmount = 0;
    let sumAmountPaid = 0;
    let sumAmountUnpaid = 0;
    let sumTotalDeposit = 0;
    let sumDepositPending = 0;
    let sumDepositRefunded = 0;
    let sumTotalExtension = 0;
    let sumExtensionUnpaid = 0;
    let countInDebt = 0;

    displayedData.forEach(item => {
      sumTotalDebt += item.totalDebt;
      sumTotalAmount += item.totalAmount;
      sumAmountPaid += item.amountPaid;
      sumAmountUnpaid += item.amountUnpaid;
      sumTotalDeposit += item.totalDeposit;
      if (item.depositType === 'Pending') sumDepositPending += item.totalDeposit;
      if (item.depositType === 'Refunded') sumDepositRefunded += item.totalDeposit;
      sumTotalExtension += item.totalExtension;
      sumExtensionUnpaid += item.extensionUnpaid;
      if (item.totalDebt > 0) countInDebt += 1;
    });

    return {
      sumTotalDebt,
      sumTotalAmount,
      sumAmountPaid,
      sumAmountUnpaid,
      sumTotalDeposit,
      sumDepositPending,
      sumDepositRefunded,
      sumTotalExtension,
      sumExtensionUnpaid,
      countInDebt,
      totalCustomers: displayedData.length
    };
  }, [displayedData]);

  // --- HANDLERS ---
  const toggleRowExpand = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle or Update Manual Status for a Customer
  const handleUpdateCustomerStatus = (item: CustomerDebtItem, newStatus: 'PAID' | 'UNPAID') => {
    // 1. Update manual status map
    setManualStatusMap(prev => ({
      ...prev,
      [item.key]: newStatus
    }));

    // 2. Propagate to jobs if onEditJob is available
    if (onEditJob && item.jobs.length > 0) {
      const jobIdsToUpdate = new Set(item.jobs.map(j => j.id));
      const updatedJobs = jobs
        .filter(j => jobIdsToUpdate.has(j.id))
        .map(j => {
          if (newStatus === 'PAID') {
            return {
              ...j,
              bank: j.bank && j.bank.trim().length > 0 ? j.bank : 'TCB'
            };
          } else {
            return {
              ...j,
              bank: ''
            };
          }
        });

      if (updatedJobs.length > 0) {
        onEditJob(updatedJobs);
      }
    }
  };

  // Toggle individual job status in expanded row
  const handleToggleSingleJobStatus = (jobId: string, currentPaid: boolean) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !onEditJob) return;

    const updatedJob: JobData = {
      ...job,
      bank: currentPaid ? '' : (job.bank || 'TCB')
    };

    onEditJob(updatedJob);
  };

  // Toggle or Update Manual Deposit Type for a Customer (Pending / Refunded)
  const handleUpdateCustomerDepositType = (item: CustomerDebtItem, newType: 'Pending' | 'Refunded') => {
    // 1. Update manual deposit type map
    setManualDepositTypeMap(prev => ({
      ...prev,
      [item.key]: newType
    }));

    // 2. Propagate to jobs if onEditJob is available
    if (onEditJob && item.jobs.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const jobIdsToUpdate = new Set(item.jobs.filter(j => j.depositAmount > 0).map(j => j.id));

      const updatedJobs = jobs
        .filter(j => jobIdsToUpdate.has(j.id))
        .map(j => {
          if (newType === 'Refunded') {
            const updated = {
              ...j,
              ngayThuHoan: j.ngayThuHoan || todayStr
            };
            if (updated.jobDeposits && updated.jobDeposits.length > 0) {
              updated.jobDeposits = updated.jobDeposits.map(d => {
                const isForCust = d.customerId === item.customerId || d.customerId === item.customerCode || j.maKhCuocId === item.customerId;
                return isForCust ? { ...d, dateIn: d.dateIn || todayStr } : d;
              });
            }
            return updated;
          } else {
            const updated = {
              ...j,
              ngayThuHoan: ''
            };
            if (updated.jobDeposits && updated.jobDeposits.length > 0) {
              updated.jobDeposits = updated.jobDeposits.map(d => {
                const isForCust = d.customerId === item.customerId || d.customerId === item.customerCode || j.maKhCuocId === item.customerId;
                return isForCust ? { ...d, dateIn: '' } : d;
              });
            }
            return updated;
          }
        });

      if (updatedJobs.length > 0) {
        onEditJob(updatedJobs);
      }
    }
  };

  // Toggle individual job deposit refund status in expanded row
  const handleToggleSingleJobDepositRefund = (jobId: string, currentRefunded: boolean) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !onEditJob) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const newRefunded = !currentRefunded;

    const updatedJob: JobData = {
      ...job,
      ngayThuHoan: newRefunded ? (job.ngayThuHoan || todayStr) : ''
    };

    if (updatedJob.jobDeposits && updatedJob.jobDeposits.length > 0) {
      updatedJob.jobDeposits = updatedJob.jobDeposits.map(d => ({
        ...d,
        dateIn: newRefunded ? (d.dateIn || todayStr) : ''
      }));
    }

    onEditJob(updatedJob);
  };

  // Reset manual deposit type override
  const handleResetCustomerDepositType = (itemKey: string) => {
    setManualDepositTypeMap(prev => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  };

  // Reset manual status override
  const handleResetCustomerStatus = (itemKey: string) => {
    setManualStatusMap(prev => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setCurrencyType('all');
    setSelectedCustomerId('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters = 
    selectedYear !== 'all' || 
    selectedMonth !== 'all' || 
    currencyType !== 'all' || 
    selectedCustomerId !== 'all' || 
    statusFilter !== 'all' || 
    searchTerm.trim().length > 0;

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Mã Khách Hàng',
      'Tên Khách Hàng',
      'MST',
      'Số Lượng Job',
      'Local charge',
      'Trạng Thái',
      'Deposit',
      'Loại Cược (Type)',
      'Demurage',
      'Demurage Chưa Thu',
      'CÔNG NỢ (Local charge + Demurage chưa thu)'
    ];

    const rows = displayedData.map((item, index) => {
      const statusText = 
        item.status === 'PAID' ? 'Đã thu' :
        item.status === 'UNPAID' ? 'Còn nợ' :
        item.status === 'PARTIAL' ? 'Thu một phần' : '-';

      return [
        index + 1,
        item.customerCode,
        item.customerName,
        item.mst || '',
        item.jobs.length,
        item.totalAmount,
        statusText,
        item.totalDeposit,
        item.depositType,
        item.totalExtension,
        item.extensionUnpaid,
        item.totalDebt
      ];
    });

    // Summary row
    rows.push([
      'TỔNG CỘNG',
      '',
      '',
      '',
      displayedData.reduce((s, i) => s + i.jobs.length, 0),
      kpiTotals.sumTotalAmount,
      '',
      kpiTotals.sumTotalDeposit,
      '',
      kpiTotals.sumTotalExtension,
      kpiTotals.sumExtensionUnpaid,
      kpiTotals.sumTotalDebt
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Style column widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 35 },
      { wch: 15 },
      { wch: 12 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 26 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_Cong_No');
    
    const timeStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Bao_Cao_Cong_No_Khach_Hang_${timeStr}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 max-w-full space-y-6 animate-in fade-in duration-200">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-1">
            <div className="p-2.5 bg-gradient-to-tr from-rose-500 to-amber-500 text-white rounded-xl shadow-md">
              <WalletCards className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản Lý Công Nợ Khách Hàng</h1>
              <p className="text-xs md:text-sm text-slate-500">
                Theo dõi phát sinh Local charge, Deposit, Demurage và Công nợ phải thu
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* SEARCH BOX */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm theo Mã KH, Tên KH, MST, Job Code, Số HĐ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* RESET FILTER BUTTON */}
          {hasActiveFilters && (
            <button 
              onClick={handleResetFilters}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* DETAILED FILTERS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* 1. Lọc theo Năm */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Năm
            </label>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="all">Tất cả các năm</option>
              {availableYears.map(y => (
                <option key={y} value={String(y)}>Năm {y}</option>
              ))}
            </select>
          </div>

          {/* 2. Lọc theo Tháng */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Tháng
            </label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>Tháng {m.padStart(2, '0')}</option>
              ))}
            </select>
          </div>

          {/* 3. Lọc theo Chi Phí (Local charge / Deposit / Demurage) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Coins className="w-3 h-3 text-slate-400" /> Chi phí
            </label>
            <select 
              value={currencyType}
              onChange={(e) => setCurrencyType(e.target.value as CurrencyTypeFilter)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="invoice">Local charge</option>
              <option value="deposit">Deposit</option>
              <option value="extension">Demurage</option>
            </select>
          </div>

          {/* 4. Lọc theo Khách Hàng */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" /> Khách Hàng
            </label>
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="all">Tất cả khách hàng ({aggregatedData.length})</option>
              {aggregatedData.map(c => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerCode} - {c.customerName.length > 25 ? c.customerName.slice(0, 25) + '...' : c.customerName}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Lọc theo Trạng Thái (Còn nợ / Đã thu) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-slate-400" /> Trạng thái
            </label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="unpaid">Còn nợ</option>
              <option value="paid">Đã thu</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-4 px-3 w-10 text-center">#</th>
                <th className="py-4 px-4 min-w-[200px]">Khách Hàng</th>
                <th className="py-4 px-4 text-right min-w-[140px] bg-blue-50/40 text-blue-900 border-x border-blue-100/50">
                  Local charge
                </th>
                <th className="py-4 px-4 text-center min-w-[140px]">
                  Trạng thái
                </th>
                <th className="py-4 px-4 text-right min-w-[140px] bg-amber-50/40 text-amber-900 border-x border-amber-100/50">
                  Deposit
                </th>
                <th className="py-4 px-4 text-center min-w-[110px]">
                  Type
                </th>
                <th className="py-4 px-4 text-right min-w-[130px]">
                  Demurage
                </th>
                <th className="py-4 px-4 text-right min-w-[160px] bg-rose-50/60 text-rose-950 font-extrabold border-l border-rose-200">
                  CÔNG NỢ
                </th>
                <th className="py-4 px-3 text-center w-12">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isExpanded = expandedRows.has(item.key);
                  const hasDebt = item.totalDebt > 0;
                  const isPaid = item.status === 'PAID';
                  const isUnpaid = item.status === 'UNPAID';
                  const isPartial = item.status === 'PARTIAL';

                  return (
                    <React.Fragment key={item.key}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          hasDebt ? 'bg-white' : 'bg-slate-50/30 opacity-90'
                        } ${isExpanded ? 'bg-teal-50/20' : ''}`}
                      >
                        {/* STT */}
                        <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                          {globalIdx}
                        </td>

                        {/* CỘT KHÁCH HÀNG */}
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleRowExpand(item.key)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors mt-0.5 cursor-pointer"
                              title="Bấm để xem danh sách Job của khách này"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{item.customerCode}</span>
                                {item.isManuallyOverridden && (
                                  <span 
                                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 cursor-pointer"
                                    title="Trạng thái đã được chỉnh sửa thủ công. Bấm để đặt lại tự động"
                                    onClick={() => handleResetCustomerStatus(item.key)}
                                  >
                                    Đã sửa tay ✕
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-normal line-clamp-1" title={item.customerName}>
                                {item.customerName}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{item.jobs.length} Job</span>
                                {item.mst && <span>• MST: {item.mst}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CỘT LOCAL CHARGE */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800 bg-blue-50/20 border-x border-blue-100/30">
                          {formatCurrency(item.totalAmount)}
                          {item.totalAmount > 0 && (
                            <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                              {item.amountPaid > 0 && <span className="text-emerald-600">Đã thu: {formatCurrency(item.amountPaid)}</span>}
                            </div>
                          )}
                        </td>

                        {/* CỘT TRẠNG THÁI (SỬA THỦ CÔNG: CÒN NỢ / ĐÃ THU) */}
                        <td className="py-3.5 px-4 text-center">
                          {item.totalAmount > 0 ? (
                            <div className="inline-flex items-center gap-1.5">
                              <select
                                value={item.status === 'PARTIAL' ? 'UNPAID' : item.status}
                                onChange={(e) => handleUpdateCustomerStatus(item, e.target.value as 'PAID' | 'UNPAID')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer outline-none ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : isUnpaid
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                }`}
                              >
                                <option value="PAID">✓ Đã thu</option>
                                <option value="UNPAID">⏳ Còn nợ</option>
                              </select>

                              {isPartial && (
                                <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium" title="Có một số job đã thu, một số job còn nợ">
                                  1 phần
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">-</span>
                          )}
                        </td>

                        {/* CỘT DEPOSIT */}
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-800 bg-amber-50/20 border-x border-amber-100/30">
                          {item.totalDeposit > 0 ? (
                            <span className="text-amber-800 font-bold">{formatCurrency(item.totalDeposit)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* CỘT TYPE (PENDING / REFUNDED - CÓ THỂ SỬA THỦ CÔNG) */}
                        <td className="py-3.5 px-4 text-center">
                          {item.totalDeposit > 0 ? (
                            <div className="inline-flex items-center gap-1">
                              <select
                                value={item.depositType}
                                onChange={(e) => handleUpdateCustomerDepositType(item, e.target.value as 'Pending' | 'Refunded')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer outline-none ${
                                  item.depositType === 'Refunded'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                }`}
                              >
                                <option value="Pending">⏳ Pending</option>
                                <option value="Refunded">✓ Refunded</option>
                              </select>
                              {item.isDepositTypeManuallyOverridden && (
                                <span 
                                  className="text-[10px] text-purple-700 bg-purple-100 px-1 py-0.5 rounded font-semibold cursor-pointer"
                                  title="Đã sửa cược thủ công. Bấm để đặt lại tự động"
                                  onClick={() => handleResetCustomerDepositType(item.key)}
                                >
                                  ✕
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">-</span>
                          )}
                        </td>

                        {/* CỘT DEMURAGE */}
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                          {item.totalExtension > 0 ? (
                            <div>
                              <span>{formatCurrency(item.totalExtension)}</span>
                              {item.extensionUnpaid > 0 && (
                                <div className="text-[10px] text-rose-600 font-semibold">
                                  Nợ: {formatCurrency(item.extensionUnpaid)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* CỘT CÔNG NỢ */}
                        <td className="py-3.5 px-4 text-right bg-rose-50/40 border-l border-rose-200">
                          <div className={`font-black text-sm md:text-base ${
                            hasDebt ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {formatCurrency(item.totalDebt)}
                          </div>
                          {hasDebt ? (
                            <div className="text-[10px] text-rose-500 font-medium">
                              Còn nợ
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-600 font-semibold">
                              ✓ Đã thu
                            </div>
                          )}
                        </td>

                        {/* NÚT MỞ RỘNG CHI TIẾT */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => toggleRowExpand(item.key)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Xem chi tiết các Job của khách hàng"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDED ROW: DANH SÁCH CHI TIẾT CÁC JOB */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-teal-200/50">
                          <td colSpan={9} className="p-4 md:p-6">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">
                                    Chi tiết các Job của {item.customerCode} ({item.customerName})
                                  </span>
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                                    {item.jobs.length} Job phát sinh
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                  <span>Gợi ý: Bạn có thể đổi trạng thái thu tiền riêng cho từng Job bên dưới</span>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase text-[10px]">
                                    <tr>
                                      <th className="py-2.5 px-3">Job Code</th>
                                      <th className="py-2.5 px-3">Booking</th>
                                      <th className="py-2.5 px-3">Tháng/Năm</th>
                                      <th className="py-2.5 px-3">Số HĐ / Ngày</th>
                                      <th className="py-2.5 px-3 text-right">Local charge</th>
                                      <th className="py-2.5 px-3 text-center">Thu Tiền Job</th>
                                      <th className="py-2.5 px-3 text-right">Deposit</th>
                                      <th className="py-2.5 px-3 text-center">Hoàn Cược</th>
                                      <th className="py-2.5 px-3 text-right">Demurage</th>
                                      <th className="py-2.5 px-3 text-center">Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.jobs.map((job) => (
                                      <tr key={job.id} className="hover:bg-slate-50/60">
                                        <td className="py-2.5 px-3 font-bold text-teal-700">
                                          {job.jobCode}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {job.booking}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500">
                                          T{job.month}/{job.year}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {job.invoiceNo ? (
                                            <div>
                                              <span className="font-semibold text-slate-800">{job.invoiceNo}</span>
                                              {job.invoiceDate && <div className="text-[10px] text-slate-400">{job.invoiceDate}</div>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 italic">Chưa có HĐ</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                          {formatCurrency(job.amount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          {job.amount > 0 ? (
                                            <button
                                              onClick={() => handleToggleSingleJobStatus(job.id, job.isPaid)}
                                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                                job.isPaid
                                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                              }`}
                                              title="Bấm để chuyển trạng thái Đã thu / Còn nợ cho job này"
                                            >
                                              {job.isPaid ? '✓ Đã thu' : '⏳ Còn nợ'}
                                            </button>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-amber-700">
                                          {job.depositAmount > 0 ? formatCurrency(job.depositAmount) : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          {job.depositAmount > 0 ? (
                                            <button
                                              onClick={() => handleToggleSingleJobDepositRefund(job.id, job.depositRefunded)}
                                              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                                job.depositRefunded
                                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                              }`}
                                              title="Bấm để chuyển trạng thái Refunded / Pending cho job này"
                                            >
                                              {job.depositRefunded ? '✓ Refunded' : '⏳ Pending'}
                                            </button>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                          {job.extensionAmount > 0 ? formatCurrency(job.extensionAmount) : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          {onViewJob && (
                                            <button
                                              onClick={() => onViewJob(job.id)}
                                              className="text-teal-600 hover:text-teal-800 font-semibold cursor-pointer text-[11px]"
                                            >
                                              Xem Job
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <p className="font-semibold text-slate-600">Không tìm thấy khách hàng nào phù hợp với bộ lọc</p>
                      <p className="text-xs text-slate-400">
                        Vui lòng thử điều chỉnh lại điều kiện lọc tháng, năm hoặc từ khóa tìm kiếm
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Xóa tất cả bộ lọc
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {displayedData.length > 0 && (
              <tfoot className="bg-slate-100/95 font-bold text-xs md:text-sm text-slate-900 border-t-2 border-slate-300">
                <tr className="divide-x divide-slate-200">
                  <td colSpan={2} className="py-4 px-4 text-center uppercase tracking-wider font-extrabold text-slate-800">
                    TỔNG CỘNG ({displayedData.length} KH)
                  </td>
                  <td className="py-4 px-4 text-right bg-blue-50/70 text-blue-950 font-black text-sm">
                    {formatCurrency(kpiTotals.sumTotalAmount)}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-600 font-semibold text-xs">
                    {kpiTotals.countInDebt > 0 ? `${kpiTotals.countInDebt} KH còn nợ` : 'Đã thu'}
                  </td>
                  <td className="py-4 px-4 text-right bg-amber-50/70 text-amber-950 font-black text-sm">
                    {formatCurrency(kpiTotals.sumTotalDeposit)}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-400 font-normal">
                    -
                  </td>
                  <td className="py-4 px-4 text-right bg-indigo-50/50 text-indigo-950 font-black text-sm">
                    {formatCurrency(kpiTotals.sumTotalExtension)}
                  </td>
                  <td className="py-4 px-4 text-right bg-rose-100/90 text-rose-950 font-black text-base border-l-2 border-rose-300">
                    {formatCurrency(kpiTotals.sumTotalDebt)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION CONTROLS (10 DÒNG / TRANG) */}
        {displayedData.length > 0 && (
          <div className="bg-white border-t border-slate-200 px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            {/* LEFT: INFO & PAGE SIZE SELECTOR */}
            <div className="flex items-center gap-2.5">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value={10}>10 dòng / trang</option>
                <option value={20}>20 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
                <option value={100}>100 dòng / trang</option>
              </select>
              <span>
                (từ <strong>{totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> trong tổng số <strong>{totalItems}</strong> khách hàng)
              </span>
            </div>

            {/* RIGHT: PAGINATION BUTTONS */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Trang đầu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* PAGE NUMBERS */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span className="px-1 text-slate-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === p
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Trang cuối"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
