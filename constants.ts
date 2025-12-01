

import { JobData, Customer, ShippingLine } from './types';

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `Tháng ${i + 1}`
}));

export const TRANSIT_PORTS = ['HCM', 'HPH'];
export const BANKS = ['TCB Bank', 'MB Bank'];
export const DEFAULT_LINES = ['MSC', 'TSLHN', 'ONE', 'Maersk', 'Cosco', 'Evergreen'];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: '1', code: 'CUST01', name: 'VinaFoods Co', mst: '0301234567' },
  { id: '2', code: 'CUST02', name: 'TechGlobal', mst: '0309998887' },
  { id: '3', code: 'LH001', name: 'Long Hoàng Logistics', mst: '0305554443' },
];

export const MOCK_SHIPPING_LINES: ShippingLine[] = [
  { id: '1', code: 'MSC', name: 'MSC Vietnam Company Ltd', mst: '0301112223' },
  { id: '2', code: 'ONE', name: 'Ocean Network Express', mst: '0304445556' },
  { id: '3', code: 'MAERSK', name: 'Maersk Vietnam', mst: '0307778889' },
  { id: '4', code: 'COSCO', name: 'Cosco Shipping Lines', mst: '0302223334' },
];

export const MOCK_DATA: JobData[] = [
  {
    id: '1',
    month: '10',
    jobCode: 'JOB-23-001',
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
    ngayChiCuoc: '2023-10-05',
    ngayChiHoan: '2023-10-25',

    localChargeInvoice: 'INV-001',
    localChargeDate: '2023-10-06',
    localChargeNet: 20000000,
    localChargeVat: 2000000,
    localChargeTotal: 22000000,
    bank: 'TCB Bank',

    maKhCuocId: '1',
    thuCuoc: 2000000,
    ngayThuCuoc: '2023-10-06',
    ngayThuHoan: '2023-10-26',

    extensions: [],
    
    bookingCostDetails: {
      localCharge: { invoice: 'COST-INV-01', date: '2023-10-01', net: 14000000, vat: 1000000, total: 15000000 },
      additionalLocalCharges: [],
      extensionCosts: [],
      deposits: [
        { id: 'd1', amount: 2000000, dateOut: '2023-10-05', dateIn: '2023-10-25' }
      ]
    }
  },
  {
    id: '2',
    month: '10',
    jobCode: 'JOB-23-002',
    booking: 'BK789012',
    consol: 'No',
    line: 'Evergreen',
    customerId: '2',
    customerName: 'TechGlobal',
    hbl: '',
    transit: 'HPH',

    cost: 32000000,
    sell: 45000000,
    profit: 13000000,
    cont20: 0,
    cont40: 3,

    feeCic: 0,
    feeKimberry: 0,
    feePsc: 0,
    feeEmc: 0,
    feeOther: 0,

    chiPayment: 30000000,
    chiCuoc: 5000000,
    ngayChiCuoc: '2023-10-10',
    ngayChiHoan: '',

    localChargeInvoice: 'INV-002',
    localChargeDate: '2023-10-11',
    localChargeNet: 0,
    localChargeVat: 0,
    localChargeTotal: 0,
    bank: 'MB Bank',

    maKhCuocId: '2',
    thuCuoc: 5000000,
    ngayThuCuoc: '2023-10-12',
    ngayThuHoan: '',

    extensions: [
      { 
        id: 'ext1', 
        customerId: '2', 
        invoice: 'INV-GH-01',
        invoiceDate: '2023-10-15',
        net: 454545,
        vat: 45455,
        total: 500000
      }
    ],

    bookingCostDetails: {
      localCharge: { invoice: 'COST-INV-02', date: '2023-10-09', net: 28000000, vat: 2000000, total: 30000000 },
      additionalLocalCharges: [],
      extensionCosts: [
        { id: 'ec1', invoice: 'EXT-COST-01', date: '2023-10-14', net: 200000, vat: 20000, total: 220000 }
      ],
      deposits: []
    }
  }
];