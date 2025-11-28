
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
    costDetails: firstJob.bookingCostDetails || {
      localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0 },
      extensionCosts: []
    }
  };

  bookingJobs.forEach(job => {
    summary.jobCount++;
    summary.totalCost += job.chiPayment;
    summary.totalSell += job.sell;
    summary.totalProfit += job.profit;
    summary.totalCont20 += job.cont20;
    summary.totalCont40 += job.cont40;
    summary.jobs.push(job);
  });

  return summary;
};
