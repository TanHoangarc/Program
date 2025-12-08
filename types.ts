export interface ExtensionData {
  id: string;
  customerId: string; // Ma KH
  
  // Financial Details (Revenue - Thu)
  invoice: string; // So hoa don
  invoiceDate: string; // Ngay hoa don
  net: number; // Gia net
  vat: number; // Gia vat
  total: number; // Tong (Auto calc)
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  mst: string;
}

export interface ShippingLine {
  id: string;
  code: string; // Ma Line
  name: string; // Ten cong ty
  mst: string;
  itemName?: string; // Ten hang mac dinh (New)
}

export interface BookingInvoice {
  invoice: string;
  date: string;
  net: number;
  vat: number;
  total: number;
}

export interface BookingExtensionCost {
  id: string;
  invoice: string;
  date: string;
  net: number;
  vat: number;
  total: number;
}

export interface BookingDeposit {
  id: string;
  // note removed
  amount: number; // So tien cuoc
  dateOut: string; // Ngay cuoc
  dateIn: string; // Ngay hoan
}

export interface BookingCostDetails {
  // Expense Breakdown (Chi)
  localCharge: BookingInvoice; 
  additionalLocalCharges?: BookingExtensionCost[]; // New: Multiple Local Charge Invoices
  extensionCosts: BookingExtensionCost[];
  deposits: BookingDeposit[]; // New: Deposit at booking level
}

export interface JobData {
  id: string;
  
  // General
  month: string; // Thang 1-12
  jobCode: string; // Job
  booking: string; // Booking
  consol: string; // Consol (Input text)
  line: string; // Line (MSC, TSLHN...)
  customerId: string; // Reference to Customer
  customerName: string; // Store name for easier display/search
  hbl: string; // Only if Customer is Long Hoang
  transit: string; // HCM, HPH

  // Financials
  cost: number;
  sell: number;
  profit: number;
  cont20: number;
  cont40: number;

  // Detailed Costs (Chi phi chi tiet)
  feeCic: number;
  feeKimberry: number;
  feePsc: number;
  feeEmc: number;
  feeOther: number;

  // Payment Out (Chi) - Legacy fields kept for compatibility but hidden in UI
  chiPayment: number;
  chiCuoc: number;
  ngayChiCuoc: string;
  ngayChiHoan: string;

  // Payment In (Thu) - Local Charge (Revenue from Customer)
  localChargeInvoice: string;
  localChargeDate: string;
  localChargeNet: number;
  localChargeVat: number;
  localChargeTotal: number;
  bank: string; // TCB/MB

  // Payment In (Thu) - Deposit
  maKhCuocId: string; // Customer ID for Deposit
  thuCuoc: number;
  ngayThuCuoc: string;
  ngayThuHoan: string;

  // Revenue Extensions
  extensions: ExtensionData[];

  // Booking Level Expense Details (Shared across jobs with same booking)
  bookingCostDetails?: BookingCostDetails;
}

export interface BookingSummary {
  bookingId: string;
  month: string;
  line: string;
  jobCount: number;
  totalCost: number; // Chi Payment sum
  totalSell: number;
  totalProfit: number;
  totalCont20: number;
  totalCont40: number;
  jobs: JobData[];
  
  // Invoice Details
  costDetails: BookingCostDetails;
}

export interface UserAccount {
  username: string;
  pass: string;
  role: 'Admin' | 'Manager' | 'Staff' | 'Docs';
}

export const INITIAL_JOB: JobData = {
  id: '',
  month: '1',
  jobCode: '',
  booking: '',
  consol: '',
  line: '',
  customerId: '',
  customerName: '',
  hbl: '',
  transit: 'HCM',
  
  cost: 0,
  sell: 0,
  profit: 0,
  cont20: 0,
  cont40: 0,

  feeCic: 0,
  feeKimberry: 0,
  feePsc: 0,
  feeEmc: 0,
  feeOther: 0,

  chiPayment: 0,
  chiCuoc: 0,
  ngayChiCuoc: '',
  ngayChiHoan: '',

  localChargeInvoice: '',
  localChargeDate: '',
  localChargeNet: 0,
  localChargeVat: 0,
  localChargeTotal: 0,
  bank: '',

  maKhCuocId: '',
  thuCuoc: 0,
  ngayThuCuoc: '',
  ngayThuHoan: '',

  extensions: []
};