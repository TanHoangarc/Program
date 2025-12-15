
import { JobData, BookingSummary } from './types';

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
  });

  // Check extra docs (e.g. Thu Khác, Custom Receipts)
  if (extraDocs && extraDocs.length > 0) {
      extraDocs.forEach(doc => checkValue(doc));
  }

  // Return next number with padding (e.g. UNC00001)
  const nextNum = max + 1;
  return `${prefix}${String(nextNum).padStart(padding, '0')}`;
};
