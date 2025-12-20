
// ============================================================
// EXTENSION (PHỤ THU / DOANH THU PHÁT SINH)
// ============================================================

export interface ExtensionData {
  id: string;
  customerId: string; // Mã KH

  // Financial Details
  invoice: string; 
  invoiceDate: string;
  net: number;
  vat: number;
  total: number; // Auto-calc

  // AMIS Fields
  amisDocNo?: string;
  amisDesc?: string;
  amisAmount?: number; // Actual collected amount for the main slip
}

// ============================================================
// REFUND RECORD (HOÀN TIỀN THỪA)
// ============================================================
export interface RefundRecord {
  id: string;
  date: string;
  docNo: string;
  amount: number;
  desc: string;
}

// ============================================================
// CUSTOMER
// ============================================================

export interface Customer {
  id: string;
  code: string;
  name: string;
  mst: string;
}

// ============================================================
// SHIPPING LINE
// ============================================================

export interface ShippingLine {
  id: string;
  code: string; // MSC, ONE, HPL...
  name: string; // Tên hãng tàu
  mst: string;
  itemName?: string; // Tên hàng mặc định
}

// ============================================================
// BOOKING INVOICE (1 Hoá đơn duy nhất)
// ============================================================

export interface BookingInvoice {
  invoice: string;
  date: string;
  net: number;
  vat: number;
  total: number;
  hasInvoice?: boolean; // Toggle: Check if official invoice exists
  // File attachments
  fileUrl?: string;
  fileName?: string;
}

// ============================================================
// EXTENSION COST (Nhiều hoá đơn Local Charge)
// ============================================================

export interface BookingExtensionCost {
  id: string;
  invoice: string;
  date: string;
  net: number;
  vat: number;
  total: number;
  hasInvoice?: boolean;
  amisDocNo?: string; // Bổ sung để theo dõi phiếu chi đã gán
  // File attachments
  fileUrl?: string;
  fileName?: string;
}

// ============================================================
// BOOKING DEPOSIT
// ============================================================

export interface BookingDeposit {
  id: string;
  amount: number;
  dateOut: string;
  dateIn: string;
}

// ============================================================
// BOOKING COST DETAILS
// ============================================================

export interface BookingCostDetails {
  localCharge: BookingInvoice;
  additionalLocalCharges?: BookingExtensionCost[];
  extensionCosts: BookingExtensionCost[];
  deposits: BookingDeposit[];
}

// ============================================================
// ADDITIONAL RECEIPT (THU THÊM/THU NHIỀU LẦN)
// ============================================================
export interface AdditionalReceipt {
  id: string;
  type: 'local' | 'deposit' | 'extension' | 'other';
  date: string;
  docNo: string;
  desc: string;
  amount: number;
  
  // Optional links
  extensionId?: string; // If type is extension
  tkNo?: string;
  tkCo?: string;
}

// ============================================================
// JOB DATA – HOÀN CHỈNH
// ============================================================

export interface JobData {
  id: string;

  // General
  month: string;
  year: number; // ADDED YEAR FIELD
  jobCode: string;
  booking: string;
  consol: string;
  line: string;
  customerId: string;
  customerName: string;
  hbl: string;
  transit: string;

  // Financials
  cost: number;
  sell: number;
  profit: number;
  cont20: number;
  cont40: number;

  // Detailed Fees
  feeCic: number;
  feeKimberry: number;
  feePsc: number;
  feeEmc: number;
  feeOther: number;

  // Legacy (Chi Payment)
  chiPayment: number;
  chiCuoc: number;
  ngayChiCuoc: string;
  ngayChiHoan: string;

  // AMIS Fields for Payment Out (Chi Payment / Local Charge Hãng tàu)
  amisPaymentDocNo?: string;
  amisPaymentDesc?: string;
  amisPaymentDate?: string;

  // AMIS Fields for Deposit Out (Chi Cược Hãng tàu - Booking)
  amisDepositOutDocNo?: string;
  amisDepositOutDesc?: string;
  amisDepositOutDate?: string;

  // AMIS Fields for Extension Payment (Chi Gia Hạn)
  amisExtensionPaymentDocNo?: string;
  amisExtensionPaymentDesc?: string;
  amisExtensionPaymentDate?: string;
  amisExtensionPaymentAmount?: number; // New field to track specific payment amount

  // Payment In (Local Charge – Thu KH)
  localChargeInvoice: string;
  localChargeDate: string;
  localChargeNet: number;
  localChargeVat: number;
  localChargeTotal: number;
  bank: string;
  
  // AMIS Fields for Local Charge (Thu)
  amisLcDocNo?: string;
  amisLcDesc?: string;
  amisLcAmount?: number; // Actual collected amount for the main slip (Partial Payment 1)

  // Payment In (Deposit - Thu)
  maKhCuocId: string;
  thuCuoc: number;
  ngayThuCuoc: string;
  ngayThuHoan: string;
  
  // AMIS Fields for Deposit In (Thu Cược)
  amisDepositDocNo?: string;
  amisDepositDesc?: string;
  amisDepositAmount?: number; // Actual collected amount for the main slip

  // NEW: AMIS Fields for Deposit Refund (Hoàn Cược - Chi cho khách)
  amisDepositRefundDocNo?: string;
  amisDepositRefundDesc?: string;
  amisDepositRefundDate?: string;

  // NEW: CVHC File Info
  cvhcUrl?: string;
  cvhcFileName?: string;

  // Revenue Extensions
  extensions: ExtensionData[];

  // Chi phí theo Booking (dùng chung)
  bookingCostDetails?: BookingCostDetails;

  // Additional Receipts (Thu nhiều lần)
  additionalReceipts?: AdditionalReceipt[];

  // Refunds (Hoàn tiền thừa)
  refunds?: RefundRecord[];
}

// ============================================================
// BOOKING SUMMARY
// ============================================================

export interface BookingSummary {
  bookingId: string;
  month: string;
  year: number; // ADDED YEAR
  line: string;

  jobCount: number;
  totalCost: number;
  totalSell: number;
  totalProfit: number;
  totalCont20: number;
  totalCont40: number;

  jobs: JobData[];

  costDetails: BookingCostDetails;
}

// ============================================================
// PAYMENT REQUEST
// ============================================================

export interface PaymentRequest {
  id: string;

  lineCode: string;            // MSC, ONE, EVERGREEN...
  pod?: "HCM" | "HPH";         // Chỉ dùng cho MSC
  booking: string;             // Số booking
  amount: number;              // Số tiền
  type?: 'Local Charge' | 'Deposit' | 'Demurrage'; // Loại chi

  // ------------------------------------------
  // INVOICE (HÓA ĐƠN)
  // ------------------------------------------
  invoiceFileName: string;     // INV_xxx.pdf
  invoicePath: string;         // E:/ServerData/Uploads/UNC/xxx.pdf
  invoiceUrl?: string;         // URL xem file qua HTTP
  invoiceBlobUrl?: string;     // Blob dùng khi chưa reload trang

  // ------------------------------------------
  // UNC (ỦY NHIỆM CHI)
  // ------------------------------------------
  uncFileName?: string;         
  uncPath?: string;             // Đường dẫn ổ E
  uncUrl?: string;              // URL xem UNC qua server
  uncBlobUrl?: string;          // Blob local

  // Status
  status: "pending" | "completed";

  createdAt: string;
  completedAt?: string;
}

// ============================================================
// SALARY RECORD
// ============================================================
export interface SalaryRecord {
  id: string;
  month: string;
  year: number;
  amount: number;
  note?: string;
}

// ============================================================
// USER ACCOUNT
// ============================================================

export interface UserAccount {
  username: string;
  pass: string;
  role: "Admin" | "Manager" | "Staff" | "Docs";
}

// ============================================================
// INITIAL JOB (DEFAULT OBJECT)
// ============================================================

export const INITIAL_JOB: JobData = {
  id: '',

  month: '1',
  year: new Date().getFullYear(), // Default current year
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

  extensions: [],
  additionalReceipts: [],
  refunds: []
};
