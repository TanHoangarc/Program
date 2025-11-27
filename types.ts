
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

export interface BookingCostDetails {
  // Expense Breakdown (Chi)
  localCharge: BookingInvoice; 
  extensionCosts: BookingExtensionCost[];
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

  // Payment Out (Chi)
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
