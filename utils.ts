import { JobData, BookingSummary } from './types';

export const formatDateVN = (dateStr: string) => {
  if (!dateStr) return '';
  // Handle yyyy-mm-dd
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
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