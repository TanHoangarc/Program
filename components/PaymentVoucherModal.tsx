
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, FileText, Check, DollarSign, ListFilter, AlertCircle, Building2, CreditCard } from 'lucide-react';
import { JobData, BookingSummary, BookingExtensionCost } from '../types';
import { formatDateVN, parseDateVN, generateNextDocNo } from '../utils';

interface PaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PaymentVoucherData) => void;
  job?: JobData | null;
  booking?: BookingSummary | null;
  type: 'local' | 'deposit' | 'extension';
  allJobs?: JobData[];
  initialDocNo?: string;
}

export interface PaymentVoucherData {
  docNo: string;
  date: string;
  amount: number;
  receiverName: string;
  paymentContent: string;
  tkNo: string;
  tkCo: string;
  selectedExtensionIds?: string[];
  originalDocNo?: string;
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

const SectionHeader = ({ icon: Icon, title, color = "text-slate-700" }: { icon: any, title: string, color?: string }) => (
  <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 ${color}`}>
    <Icon className="w-4 h-4" />
    <h3 className="text-xs font-bold uppercase">{title}</h3>
  </div>
);

const DateInput = ({ 
  value, 
  onChange, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  className?: string;
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateVN(value));
  }, [value]);

  const handleBlur = () => {
    if (!displayValue) {
      if (value) onChange('');
      return;
    }
    const parsed = parseDateVN(displayValue);
    if (parsed) {
      if (parsed !== value) onChange(parsed);
    } else {
      setDisplayValue(formatDateVN(value));
    }
  };

  const handleDateIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <input 
        type="text" 
        value={displayValue} 
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/yyyy"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 shadow-sm transition-all font-medium placeholder-slate-400"
      />
      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center">
         <input 
            type="date" 
            value={value || ''} 
            onChange={handleDateIconChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
         />
         <Calendar className="w-4 h-4 text-slate-500" />
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  isOpen, onClose, onSave, job, booking, type, allJobs, initialDocNo
}) => {
  // --- STATE MANAGEMENT ---
  const [formData, setFormData] = useState<PaymentVoucherData>({
    docNo: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    receiverName: '',
    paymentContent: '',
    tkNo: '',
    tkCo: '1121', // Default Credit Account (Tiền mặt/Ngân hàng)
    selectedExtensionIds: [],
    originalDocNo: initialDocNo
  });

  // Extension Items (for 'extension' mode)
  const [availableExtensions, setAvailableExtensions] = useState<(BookingExtensionCost & { amisDocNo?: string, amisDesc?: string, amisDate?: string })[]>([]);
  const [selectedExtensionIds, setSelectedExtensionIds] = useState<Set<string>>(new Set());

  // --- INITIALIZATION EFFECT ---
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      const jobsForCalc = allJobs || [];
      const currentBookingId = booking?.bookingId || job?.booking || '';
      const currentJobCode = job?.jobCode || '';
      const lineName = booking?.line || job?.line || '';

      // 1. GATHER DATA SOURCES
      let targetBookingExtensions: (BookingExtensionCost & { amisDocNo?: string, amisDesc?: string, amisDate?: string })[] = [];
      
      if (type === 'extension') {
          if (booking && booking.costDetails?.extensionCosts) {
              targetBookingExtensions = booking.costDetails.extensionCosts;
          } else if (job && job.bookingCostDetails?.extensionCosts) {
              targetBookingExtensions = job.bookingCostDetails.extensionCosts;
          }
          setAvailableExtensions(targetBookingExtensions);
      }

      // 2. DEFINE INITIAL VALUES BASED ON TYPE & MODE (EDIT/CREATE)
      let initDocNo = '';
      let initDate = today;
      let initAmount = 0;
      let initContent = '';
      let initReceiver = lineName;
      let initTkNo = '';
      let initTkCo = '1121';
      let initSelectedIds = new Set<string>();

      // --- LOGIC: LOCAL CHARGE ---
      if (type === 'local') {
          initTkNo = '3311'; // Phải trả người bán
          initTkCo = '1121';

          if (initialDocNo) {
              // EDIT MODE
              initDocNo = initialDocNo;
              // Try to find ANY job with this docNo to pull metadata
              const refJob = jobsForCalc.find(j => j.amisPaymentDocNo === initialDocNo);
              if (refJob) {
                  initDate = refJob.amisPaymentDate || today;
                  initContent = refJob.amisPaymentDesc || '';
                  // Calc total amount for this DocNo across ALL jobs
                  const total = jobsForCalc
                      .filter(j => j.amisPaymentDocNo === initialDocNo)
                      .reduce((sum, j) => sum + (j.chiPayment || 0), 0);
                  initAmount = total;
              } else if (job) {
                  // Fallback to passed prop if not found in list (rare)
                  initDate = job.amisPaymentDate || today;
                  initContent = job.amisPaymentDesc || '';
                  initAmount = job.chiPayment || 0;
              }
          } else {
              // CREATE MODE
              initDocNo = generateNextDocNo(jobsForCalc, 'UNC', 5);
              if (booking) {
                  // Sum all Local Charges for Booking
                  const lc = booking.costDetails.localCharge;
                  const addLc = booking.costDetails.additionalLocalCharges || [];
                  let total = (lc.hasInvoice === false ? lc.total : (lc.net||0) + (lc.vat||0));
                  addLc.forEach(a => total += (a.hasInvoice === false ? a.total : (a.net||0) + (a.vat||0)));
                  initAmount = total;
                  initContent = `Thanh toán Local Charge Booking ${currentBookingId}`;
              } else if (job) {
                  initAmount = job.chiPayment || 0;
                  initContent = `Thanh toán Local Charge Job ${currentJobCode}`;
              }
          }
      } 
      
      // --- LOGIC: DEPOSIT (CƯỢC) ---
      else if (type === 'deposit') {
          initTkNo = '1388'; // Phải thu khác (Cược)
          initTkCo = '1121';

          if (initialDocNo) {
              // EDIT MODE
              initDocNo = initialDocNo;
              const refJob = jobsForCalc.find(j => j.amisDepositOutDocNo === initialDocNo);
              if (refJob) {
                  initDate = refJob.amisDepositOutDate || today;
                  initContent = refJob.amisDepositOutDesc || '';
                  // Sum total deposit out for this doc
                  const total = jobsForCalc
                      .filter(j => j.amisDepositOutDocNo === initialDocNo)
                      .reduce((sum, j) => sum + (j.chiCuoc || 0), 0);
                  initAmount = total;
              } else if (job) {
                  initDate = job.amisDepositOutDate || today;
                  initContent = job.amisDepositOutDesc || '';
                  initAmount = job.chiCuoc || 0;
              }
          } else {
              // CREATE MODE
              initDocNo = generateNextDocNo(jobsForCalc, 'UNC', 5);
              initContent = `Chi tiền cược lô Booking ${currentBookingId}`;
              
              if (booking) {
                   const depTotal = (booking.costDetails.deposits || []).reduce((s,d) => s+d.amount, 0);
                   initAmount = depTotal;
              } else if (job) {
                  initAmount = job.chiCuoc || 0;
              }
          }
      } 
      
      // --- LOGIC: EXTENSION (GIA HẠN) ---
      else if (type === 'extension') {
          initTkNo = '3311'; // Default as requested
          initTkCo = '1121';

          if (initialDocNo) {
              // EDIT MODE
              initDocNo = initialDocNo;
              
              // Find the first extension line that matches this DocNo to get metadata
              const refExt = targetBookingExtensions.find(e => e.amisDocNo === initialDocNo);
              
              if (refExt) {
                  initDate = refExt.amisDate || today;
                  initContent = refExt.amisDesc || '';
              } else if (job?.amisExtensionPaymentDocNo === initialDocNo) {
                  // Legacy fallback
                  initDate = job.amisExtensionPaymentDate || today;
                  initContent = job.amisExtensionPaymentDesc || '';
              }

              // Calculate total amount from selected items
              let total = 0;
              targetBookingExtensions.forEach(e => {
                  if (e.amisDocNo === initialDocNo) {
                      initSelectedIds.add(e.id);
                      total += e.total;
                  }
              });
              initAmount = total;

          } else {
              // CREATE MODE
              initDocNo = generateNextDocNo(jobsForCalc, 'UNC', 5);
              
              // CUSTOM DESCRIPTION FORMAT REQUIRED BY USER
              // "Chi tiền cho ncc GH lô BL [BOOKING] (kimberry)(GIA HẠN)"
              initContent = `Chi tiền cho ncc GH lô BL ${currentBookingId} (kimberry)(GIA HẠN)`;
              
              initAmount = 0; // Starts at 0, user selects lines
              initSelectedIds = new Set();
          }
      }

      setFormData({
          docNo: initDocNo,
          date: initDate,
          amount: initAmount,
          receiverName: initReceiver,
          paymentContent: initContent,
          tkNo: initTkNo,
          tkCo: initTkCo,
          selectedExtensionIds: Array.from(initSelectedIds),
          originalDocNo: initialDocNo
      });
      setSelectedExtensionIds(initSelectedIds);
    }
  }, [isOpen, job, booking, type, allJobs, initialDocNo]);

  // --- HANDLERS ---

  const handleToggleExtension = (extId: string, amount: number, isChecked: boolean) => {
      const newSet = new Set(selectedExtensionIds);
      if (isChecked) newSet.add(extId);
      else newSet.delete(extId);
      setSelectedExtensionIds(newSet);
      
      setFormData(prev => ({
          ...prev,
          amount: prev.amount + (isChecked ? amount : -amount)
      }));
  };

  const handleAmountChange = (val: number) => {
      setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({
          ...formData,
          selectedExtensionIds: Array.from(selectedExtensionIds)
      });
  };

  if (!isOpen) return null;

  // --- RENDER ---

  const titleMap = {
      local: 'Chi Local Charge',
      deposit: 'Chi Cược (Deposit)',
      extension: 'Chi Gia Hạn (Extension)'
  };

  const colorMap = {
      local: 'blue',
      deposit: 'purple',
      extension: 'orange'
  };

  const themeColor = colorMap[type];

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-${themeColor}-50 rounded-t-2xl`}>
            <div className="flex items-center space-x-3">
                <div className={`p-2 bg-${themeColor}-100 text-${themeColor}-600 rounded-lg shadow-sm border border-${themeColor}-200`}>
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Lập Phiếu Chi (UNC)</h2>
                    <p className={`text-xs font-bold text-${themeColor}-600 mt-0.5 uppercase tracking-wider`}>{titleMap[type]}</p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-white p-2 rounded-full transition-all">
               <X className="w-5 h-5" />
            </button>
        </div>

        {/* BODY */}
        <div className="p-6 bg-slate-50 overflow-y-auto custom-scrollbar flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* SECTION 1: EXTENSION SELECTOR (ONLY FOR EXTENSION TYPE) */}
                {type === 'extension' && availableExtensions.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3 border-b border-orange-100 pb-2">
                            <h3 className="text-xs font-bold text-orange-700 uppercase flex items-center">
                                <ListFilter className="w-3.5 h-3.5 mr-1.5" /> Chọn hóa đơn chi
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {selectedExtensionIds.size} đã chọn
                            </span>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {availableExtensions.map(ext => {
                                // Locked if it has a DocNo AND it's NOT the one we are currently editing
                                const isLocked = !!ext.amisDocNo && ext.amisDocNo !== formData.originalDocNo;
                                const isChecked = selectedExtensionIds.has(ext.id);
                                
                                return (
                                    <div 
                                        key={ext.id} 
                                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all select-none
                                            ${isLocked 
                                                ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' 
                                                : isChecked 
                                                    ? 'bg-orange-50 border-orange-300 shadow-sm' 
                                                    : 'bg-white border-slate-200 hover:border-orange-200 cursor-pointer'
                                            }`}
                                         onClick={() => !isLocked && handleToggleExtension(ext.id, ext.total, !isChecked)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-orange-500 border-orange-600' : 'bg-white border-slate-300'}`}>
                                                {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="text-xs font-bold text-slate-700 truncate w-full" title={ext.invoice}>
                                                    INV: {ext.invoice || '(Chưa có số)'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" /> {formatDateVN(ext.date)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right pl-2">
                                            <div className={`text-xs font-bold ${isChecked ? 'text-orange-700' : 'text-slate-600'}`}>
                                                {new Intl.NumberFormat('en-US').format(ext.total)}
                                            </div>
                                            {isLocked && <div className="text-[9px] font-bold text-red-500 flex items-center justify-end mt-0.5"><AlertCircle className="w-2.5 h-2.5 mr-0.5"/> {ext.amisDocNo}</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* SECTION 2: VOUCHER DETAILS */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <SectionHeader icon={CreditCard} title="Thông tin chứng từ" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label required>Ngày chứng từ</Label>
                            <DateInput value={formData.date} onChange={(val) => setFormData(prev => ({ ...prev, date: val }))} />
                        </div>
                        <div>
                            <Label required>Số chứng từ (UNC)</Label>
                            <input 
                                type="text" 
                                value={formData.docNo} 
                                onChange={(e) => setFormData(prev => ({ ...prev, docNo: e.target.value }))} 
                                className={`w-full px-3 py-2 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg text-sm font-bold text-${themeColor}-800 outline-none focus:ring-2 focus:ring-${themeColor}-500 transition-all`} 
                                required 
                            />
                        </div>
                    </div>

                    <div>
                        <Label required>Đơn vị nhận tiền</Label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                value={formData.receiverName} 
                                onChange={(e) => setFormData(prev => ({ ...prev, receiverName: e.target.value }))} 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Tên hãng tàu hoặc người nhận..."
                            />
                        </div>
                    </div>

                    <div>
                        <Label required>Diễn giải</Label>
                        <textarea 
                            value={formData.paymentContent} 
                            onChange={(e) => setFormData(prev => ({ ...prev, paymentContent: e.target.value }))} 
                            rows={3} 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium placeholder-slate-400" 
                            required 
                            placeholder="Nhập nội dung thanh toán..."
                        />
                    </div>

                    <div>
                        <Label required>Số tiền (VND)</Label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={new Intl.NumberFormat('en-US').format(formData.amount)} 
                                onChange={(e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) handleAmountChange(val); }} 
                                className={`w-full pl-4 pr-12 py-3 bg-white border border-slate-300 rounded-xl text-xl font-black text-${themeColor}-600 outline-none focus:ring-2 focus:ring-${themeColor}-500 text-right shadow-inner`} 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VND</div>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><DollarSign className="w-5 h-5" /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <Label>TK Nợ</Label>
                            <input 
                                type="text" 
                                value={formData.tkNo} 
                                onChange={(e) => setFormData(prev => ({ ...prev, tkNo: e.target.value }))} 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-colors" 
                            />
                        </div>
                        <div>
                            <Label>TK Có</Label>
                            <input 
                                type="text" 
                                value={formData.tkCo} 
                                onChange={(e) => setFormData(prev => ({ ...prev, tkCo: e.target.value }))} 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-colors" 
                            />
                        </div>
                    </div>
                </div>

            </form>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-2xl flex justify-end space-x-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button 
                onClick={onClose} 
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-all hover:shadow-sm"
            >
                Hủy bỏ
            </button>
            <button 
                onClick={handleSubmit} 
                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-${themeColor}-600 hover:bg-${themeColor}-700 shadow-lg hover:shadow-${themeColor}-500/30 transition-all flex items-center transform active:scale-95 duration-100`}
            >
                <Save className="w-4 h-4 mr-2" /> Lưu Phiếu
            </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
