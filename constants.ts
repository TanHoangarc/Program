
import { JobData, Customer, ShippingLine } from './types';

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `Tháng ${i + 1}`
}));

// Generate years from 2023 to 2030
export const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

export const TRANSIT_PORTS = ['HCM', 'HPH'];
export const BANKS = ['TCB Bank', 'MB Bank'];
export const DEFAULT_LINES = ['MSC', 'TSLHN', 'ONE', 'Maersk', 'Cosco', 'Evergreen'];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: '1', code: 'CUST01', name: 'VinaFoods Co', mst: '0301234567' },
  { id: '2', code: 'CUST02', name: 'TechGlobal', mst: '0309998887' },
  { id: '3', code: 'LH001', name: 'Long Hoàng Logistics', mst: '0305554443' },
];

export const MOCK_SHIPPING_LINES: ShippingLine[] = [
  { id: '1', code: 'MSC', name: 'MSC Vietnam Company Ltd', mst: '0301112223', itemName: 'Phí Local Charge' },
  { id: '2', code: 'ONE', name: 'Ocean Network Express', mst: '0304445556', itemName: 'Phí D/O' },
  { id: '3', code: 'MAERSK', name: 'Maersk Vietnam', mst: '0307778889', itemName: 'Phí Local Charge' },
  { id: '4', code: 'COSCO', name: 'Cosco Shipping Lines', mst: '0302223334', itemName: 'Cước vận chuyển' },
];

export const MOCK_DATA: JobData[] = [
  {
    id: '1',
    month: '10',
    year: 2025,
    jobCode: 'JOB-25-001',
    booking: 'BK123456',
    consol: 'Yes',
    line: 'Maersk',
    customerId: '1',
    customerName: 'VinaFoods Co',
    hbl: '',
    transit: 'HCM',
    
    cost: 15000000,
    sell: 22000000,
    profit: 7000000,
    cont20: 2,
    cont40: 0,

    feeCic: 0,
    feeKimberry: 0,
    feePsc: 0,
    feeEmc: 0,
    feeOther: 0,

    chiPayment: 15000000,
    chiCuoc: 2000000,
    ngayChiCuoc: '2025-10-05',
    ngayChiHoan: '2025-10-25',

    localChargeInvoice: 'INV-001',
    localChargeDate: '2025-10-06',
    localChargeNet: 20000000,
    localChargeVat: 2000000,
    localChargeTotal: 22000000,
    bank: 'TCB Bank',

    maKhCuocId: '1',
    thuCuoc: 2000000,
    ngayThuCuoc: '2025-10-06',
    ngayThuHoan: '2025-10-26',

    extensions: [],
    
    bookingCostDetails: {
      localCharge: { invoice: 'COST-INV-01', date: '2025-10-01', net: 14000000, vat: 1000000, total: 15000000 },
      additionalLocalCharges: [],
      extensionCosts: [],
      deposits: [
        { id: 'd1', amount: 2000000, dateOut: '2025-10-05', dateIn: '2025-10-25' }
      ]
    }
  }
];
