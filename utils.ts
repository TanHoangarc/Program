
import { JobData, BookingSummary, AdditionalReceipt } from './types';

export const formatDateVN = (dateStr: any) => {
  if (!dateStr) return '';
  // Force convert to string to prevent crashes if value is number/object
  const str = String(dateStr);
  
  // Handle yyyy-mm-dd
  if (str.includes('-')) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
};

export const parseDateVN = (str: string): string | null => {
  if (!str) return null;
  // match d/m/y or dd/mm/yyyy
  const parts = str.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    
    // Basic validation
    if (y.length !== 4) return null;
    
    const iso = `${y}-${m}-${d}`;
    const date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    
    return iso;
  }
  return null;
};

export const calculateBookingSummary = (jobs: JobData[], bookingId: string): BookingSummary | null => {
  const bookingJobs = jobs.filter(j => j.booking === bookingId);
  if (bookingJobs.length === 0) return null;

  const firstJob = bookingJobs[0];
  
  // ROBUST DATA MERGE FOR COST DETAILS
  // Prevents undefined errors when data is malformed
  const rawDetails = (firstJob.bookingCostDetails || {}) as any;
  const safeDetails = {
    localCharge: rawDetails.localCharge || { invoice: '', date: '', net: 0, vat: 0, total: 0 },
    additionalLocalCharges: Array.isArray(rawDetails.additionalLocalCharges) ? rawDetails.additionalLocalCharges : [],
    extensionCosts: Array.isArray(rawDetails.extensionCosts) ? rawDetails.extensionCosts : [],
    deposits: Array.isArray(rawDetails.deposits) ? rawDetails.deposits : []
  };

  const summary: BookingSummary = {
    bookingId: firstJob.booking,
    month: firstJob.month,
    year: firstJob.year,
    line: firstJob.line,
    jobCount: 0,
    totalCost: 0,
    totalSell: 0,
    totalProfit: 0,
    totalCont20: 0,
    totalCont40: 0,
    jobs: [],
    costDetails: safeDetails
  };

  bookingJobs.forEach(job => {
    summary.jobCount++;
    summary.totalCost += job.cost; // Updated to use Cost instead of chiPayment
    summary.totalSell += job.sell;
    summary.totalProfit += job.profit;
    summary.totalCont20 += job.cont20;
    summary.totalCont40 += job.cont40;
    summary.jobs.push(job);
  });

  return summary;
};

export const getPaginationRange = (currentPage: number, totalPages: number) => {
  const delta = 2;
  const range = [];
  const rangeWithDots: (number | string)[] = [];
  let l;

  range.push(1);
  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i < totalPages && i > 1) {
      range.push(i);
    }
  }
  range.push(totalPages);

  for (const i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
};

// --- AUTO INCREMENT DOCUMENT NUMBER HELPER ---
export const generateNextDocNo = (jobs: JobData[], prefix: string, padding: number = 5, extraDocs: string[] = []): string => {
  let max = 0;
  // Regex to match prefix followed by digits (case insensitive)
  const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

  const checkValue = (val?: string) => {
    if (!val) return;
    const match = val.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > max) max = num;
    }
  };

  jobs.forEach(j => {
    checkValue(j.amisLcDocNo);
    checkValue(j.amisDepositDocNo);
    checkValue(j.amisDepositRefundDocNo);
    checkValue(j.amisPaymentDocNo);
    checkValue(j.amisDepositOutDocNo);
    checkValue(j.amisExtensionPaymentDocNo);

    if (j.extensions) {
      j.extensions.forEach(ext => checkValue(ext.amisDocNo));
    }
    
    // Check refunds
    if (j.refunds) {
        j.refunds.forEach(r => checkValue(r.docNo));
    }
  });

  // Check extra docs (e.g. Thu Khác, Custom Receipts)
  if (extraDocs && extraDocs.length > 0) {
      extraDocs.forEach(doc => checkValue(doc));
  }

  // Return next number with padding (e.g. UNC00001)
  const nextNum = max + 1;
  return `${prefix}${String(nextNum).padStart(padding, '0')}`;
};

// --- PAYMENT STATUS CALCULATION ---
export interface PaymentStatus {
  lcDiff: number;
  depositDiff: number;
  hasMismatch: boolean;
  totalCollectedLC: number;
  totalCollectedDeposit: number;
}

export const calculatePaymentStatus = (job: JobData, allJobs?: JobData[], customReceipts: any[] = []): PaymentStatus => {
  // EXCLUSION LOGIC:
  // 1. Customer is LONG HOANG LOGISTICS (or variations like LHK)
  // 2. Bank is TCB Bank
  const custName = (job.customerName || '').toUpperCase();
  const isLongHoang = custName.includes('LONG HOANG') || custName.includes('LONGHOANG') || custName.includes('LHK');
  const isTCB = job.bank === 'TCB Bank';

  if (isLongHoang || isTCB) {
      return {
          lcDiff: 0,
          depositDiff: 0,
          hasMismatch: false,
          totalCollectedLC: 0,
          totalCollectedDeposit: 0
      };
  }

  // 1. Local Charge
  const lcExpected = job.localChargeTotal || 0;
  
  // Determine if main receipt amount (amisLcAmount) is for a merged group
  let lcMain = job.amisLcDocNo ? (job.amisLcAmount !== undefined ? job.amisLcAmount : job.localChargeTotal) : 0;

  if (allJobs && job.amisLcDocNo && job.amisLcAmount !== undefined && job.amisLcAmount > lcExpected) {
      const groupTotal = allJobs.reduce((sum, j) => {
          if (j.amisLcDocNo !== job.amisLcDocNo) return sum;
          return sum + (j.localChargeTotal || 0);
      }, 0);
      
      if (Math.abs(job.amisLcAmount - groupTotal) < 5000) {
          lcMain = lcExpected;
      }
  }
  
  // Collected from job's own additional receipts
  const lcAdditional = (job.additionalReceipts || [])
    .filter(r => r.type === 'local' || r.type === 'other') // Include 'other' for legacy compatibility
    .reduce((sum, r) => sum + r.amount, 0);

  // --- NEW: Collected from global Custom Receipts (Auto Payment Tool) ---
  const lcFromCustom = customReceipts.reduce((sum, r) => {
      // Filter for Revenue types
      const isLcType = r.type === 'external' || r.type === 'local' || r.type === 'other';
      if (!isLcType) return sum;

      // 1. Check array-based match (Auto Tool generated)
      if (r.jobCodes && Array.isArray(r.jobCodes) && r.jobCodes.length > 0) {
          const normalizedJobCodes = r.jobCodes.map((c: any) => String(c).trim().toLowerCase());
          const currentJobCode = job.jobCode.trim().toLowerCase();

          if (normalizedJobCodes.includes(currentJobCode)) {
              // It matches! Now check for Smart Distribution
              if (allJobs) {
                  // Find all jobs in the system that are listed in this receipt
                  const jobsInGroup = allJobs.filter(j => normalizedJobCodes.includes(j.jobCode.trim().toLowerCase()));
                  
                  // Calculate Total Expected for this group
                  const totalExpectedGroup = jobsInGroup.reduce((s, j) => s + (j.localChargeTotal || 0), 0);
                  
                  // Check if Receipt Amount matches Group Total (with tolerance)
                  if (Math.abs((r.amount || 0) - totalExpectedGroup) < 5000) {
                      // PERFECT MATCH: Allocate exactly what THIS job needs
                      return sum + (job.localChargeTotal || 0);
                  }
              }
              // Fallback: If amounts don't match group total, return full amount to trigger mismatch warning
              return sum + (r.amount || 0);
          }
          return sum;
      }

      // 2. Legacy String Match
      const hasJobCode = r.desc && r.desc.includes(job.jobCode);
      const hasInvoice = r.invoice && job.localChargeInvoice && r.invoice === job.localChargeInvoice;
      
      if (hasJobCode || hasInvoice) {
          return sum + (r.amount || 0);
      }
      return sum;
  }, 0);
    
  const lcRefunds = (job.refunds || []).reduce((sum, r) => sum + r.amount, 0);

  const totalCollectedLC = lcMain + lcAdditional + lcFromCustom - lcRefunds;
  const lcDiff = totalCollectedLC - lcExpected;

  // 2. Deposit
  const depositExpected = job.thuCuoc || 0;
  
  let depositMain = job.amisDepositDocNo ? (job.amisDepositAmount !== undefined ? job.amisDepositAmount : job.thuCuoc) : 0;

  if (allJobs && job.amisDepositDocNo && job.amisDepositAmount !== undefined && job.amisDepositAmount > depositExpected) {
      const groupTotal = allJobs.reduce((sum, j) => {
          if (j.amisDepositDocNo !== job.amisDepositDocNo) return sum;
          return sum + (j.thuCuoc || 0);
      }, 0);
      
      if (Math.abs(job.amisDepositAmount - groupTotal) < 5000) {
          depositMain = depositExpected;
      }
  }
  
  const depositAdditional = (job.additionalReceipts || [])
    .filter(r => r.type === 'deposit')
    .reduce((sum, r) => sum + r.amount, 0);

  // --- NEW: Deposit from global Custom Receipts ---
  const depositFromCustom = customReceipts.reduce((sum, r) => {
      const isDepositType = r.type === 'deposit' || (r.desc && r.desc.toUpperCase().includes('CƯỢC'));
      if (!isDepositType) return sum;

      // 1. Array-based Match (Smart Distribution)
      if (r.jobCodes && Array.isArray(r.jobCodes) && r.jobCodes.length > 0) {
          const normalizedJobCodes = r.jobCodes.map((c: any) => String(c).trim().toLowerCase());
          const currentJobCode = job.jobCode.trim().toLowerCase();

          if (normalizedJobCodes.includes(currentJobCode)) {
              if (allJobs) {
                  const jobsInGroup = allJobs.filter(j => normalizedJobCodes.includes(j.jobCode.trim().toLowerCase()));
                  const totalExpectedGroup = jobsInGroup.reduce((s, j) => s + (j.thuCuoc || 0), 0);
                  
                  if (Math.abs((r.amount || 0) - totalExpectedGroup) < 5000) {
                      return sum + (job.thuCuoc || 0);
                  }
              }
              return sum + (r.amount || 0);
          }
          return sum;
      }

      // 2. Legacy String Match
      const hasJobCode = r.desc && r.desc.includes(job.jobCode);
      if (hasJobCode) {
          return sum + (r.amount || 0);
      }
      return sum;
  }, 0);

  const totalCollectedDeposit = depositMain + depositAdditional + depositFromCustom;
  const depositDiff = totalCollectedDeposit - depositExpected;

  // Logic: Mismatch exists if Diff != 0 AND (Expected > 0 OR Collected > 0)
  // UPDATED: Lower threshold from 1000 to 10 to catch small discrepancies like 60 VND
  const lcMismatch = (lcExpected > 0 || totalCollectedLC > 0) && Math.abs(lcDiff) > 10;
  const depositMismatch = (depositExpected > 0 || totalCollectedDeposit > 0) && Math.abs(depositDiff) > 10;

  return {
    lcDiff,
    depositDiff,
    hasMismatch: lcMismatch || depositMismatch,
    totalCollectedLC,
    totalCollectedDeposit
  };
};
