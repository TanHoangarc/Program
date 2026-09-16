import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, FileText, AlertCircle, RefreshCw, Key } from 'lucide-react';
import { JobData, PaymentRequest } from '../types';
import { extractInvoiceDataDirect, getGeminiApiKey } from '../utils/geminiDirectApi';
import { maskApiKey, setActiveApiKey, saveStoredApiKey, subscribeApiKeyChanges } from '../utils/apiKeyManager';

interface SyncBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobData[];
  paymentRequests: PaymentRequest[];
  onApply: (updatedJobs: JobData[]) => void;
}

interface SyncItem {
  jobId: string;
  booking: string;
  invoice: string;
  date: string;
  net: number;
  vat: number;
  fileUrl: string;
  fileName: string;
  selected: boolean;
  status: 'pending' | 'syncing' | 'success' | 'error';
  error?: string;
}

const SyncBookingModal: React.FC<SyncBookingModalProps> = ({
  isOpen,
  onClose,
  jobs,
  paymentRequests,
  onApply
}) => {
  const [items, setItems] = useState<SyncItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeApiKey, setActiveApiKeyState] = useState<string>(() => getGeminiApiKey());
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeApiKeyChanges(() => {
      setActiveApiKeyState(getGeminiApiKey());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Group jobs by unique booking number
      const bookingGroups: { [key: string]: JobData[] } = {};
      jobs.forEach(job => {
        if (!job.booking) return;
        if (!bookingGroups[job.booking]) {
          bookingGroups[job.booking] = [];
        }
        bookingGroups[job.booking].push(job);
      });

      const newItems: SyncItem[] = [];

      Object.entries(bookingGroups).forEach(([bookingNum, groupJobs]) => {
        // Use the first job in group to check booking-level cost details
        const firstJob = groupJobs[0];
        const bc = firstJob.bookingCostDetails?.localCharge;
        
        // Check if booking-level local charge is incomplete
        const isIncomplete = !bc || !bc.invoice || !bc.date || bc.net === 0;

        if (isIncomplete) {
          // Find matching payment request with invoice - ONLY Local Charge
          const matchingReq = paymentRequests.find(req => 
            req.booking === bookingNum && 
            req.type === 'Local Charge' &&
            req.invoiceUrl && 
            req.status === 'completed'
          );

          newItems.push({
            jobId: firstJob.id, // Reference ID
            booking: bookingNum,
            invoice: bc?.invoice || '',
            date: bc?.date || '',
            net: bc?.net || 0,
            vat: bc?.vat || 0,
            fileUrl: matchingReq?.invoiceUrl || '',
            fileName: matchingReq?.invoiceFileName || '',
            selected: !!matchingReq,
            status: 'pending'
          });
        }
      });

      setItems(newItems);
    }
  }, [isOpen, jobs, paymentRequests]);

  const handleSync = async () => {
    const currentKey = activeApiKey || getGeminiApiKey();
    if (!currentKey) {
      setKeyInput('');
      setShowKeyModal(true);
      return;
    }

    const selectedItems = items.filter(i => i.selected && i.status !== 'success');
    if (selectedItems.length === 0) return;

    setIsProcessing(true);

    for (const item of selectedItems) {
      setItems(prev => prev.map(i => i.jobId === item.jobId ? { ...i, status: 'syncing', error: undefined } : i));

      try {
        if (!item.fileUrl) throw new Error("Không có file hóa đơn");

        const extracted = await extractInvoiceDataDirect({
          fileUrl: item.fileUrl,
          customApiKey: currentKey,
          invoiceType: 'Local Charge'
        });

        setItems(prev => prev.map(i => i.jobId === item.jobId ? { 
          ...i, 
          invoice: extracted.invoice || i.invoice,
          date: extracted.date || i.date,
          net: extracted.net || i.net,
          vat: extracted.vat || i.vat,
          status: 'success' 
        } : i));

      } catch (error: any) {
        console.error("Sync error:", error);
        setItems(prev => prev.map(i => i.jobId === item.jobId ? { 
          ...i, 
          status: 'error', 
          error: error.message || 'Lỗi xử lý file'
        } : i));
      }
    }

    setIsProcessing(false);
  };

  const handleApply = () => {
    const successItems = items.filter(i => i.status === 'success' || (i.selected && i.invoice));
    if (successItems.length === 0) {
      onClose();
      return;
    }

    let updatedJobs = [...jobs];
    
    successItems.forEach(syncItem => {
      // Update ALL jobs that share this booking ID
      updatedJobs = updatedJobs.map(job => {
        if (job.booking === syncItem.booking) {
          const currentCostDetails = job.bookingCostDetails || {
            localCharge: { invoice: '', date: '', net: 0, vat: 0, total: 0 },
            extensionCosts: [],
            deposits: []
          };

          return {
            ...job,
            // Update "Chi phí chung" (Cost side) - This is the main target for Booking Sync
            bookingCostDetails: {
              ...currentCostDetails,
              localCharge: {
                ...currentCostDetails.localCharge,
                invoice: syncItem.invoice,
                date: syncItem.date,
                net: syncItem.net,
                vat: syncItem.vat,
                total: syncItem.net + syncItem.vat,
                fileUrl: syncItem.fileUrl,
                fileName: syncItem.fileName,
                hasInvoice: true
              }
            }
          };
        }
        return job;
      });
    });

    onApply(updatedJobs);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <RefreshCw className={`w-5 h-5 text-indigo-600 ${isProcessing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-800">Dữ liệu đồng bộ Booking</h2>
                {activeApiKey ? (
                  <button 
                    onClick={() => { setKeyInput(activeApiKey); setShowKeyModal(true); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                    title="Bấm để đổi Gemini API Key"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Key className="w-3 h-3 text-emerald-600" />
                    <span>Gemini: {maskApiKey(activeApiKey)}</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => { setKeyInput(''); setShowKeyModal(true); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-xs font-semibold animate-pulse transition-colors cursor-pointer"
                    title="Chưa có API Key. Bấm để nhập!"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>Chưa có API Key (Bấm để nhập)</span>
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500">Tự động trích xuất thông tin hóa đơn từ các yêu cầu thanh toán qua Gemini AI trực tiếp từ trình duyệt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Check className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Tất cả Booking đã có đầy đủ thông tin hóa đơn</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 w-10">
                      <input 
                        type="checkbox" 
                        checked={items.length > 0 && items.every(i => i.selected)}
                        onChange={(e) => setItems(items.map(i => ({ ...i, selected: e.target.checked })))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 w-32">Booking</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 w-32">Số hóa đơn</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 w-40">Ngày hóa đơn</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 text-right w-44">Giá Net</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 text-right w-44">VAT</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 text-center">File</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-700 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.jobId} className={`hover:bg-slate-50 transition-colors ${item.status === 'success' ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={item.selected}
                          onChange={(e) => setItems(items.map(i => i.jobId === item.jobId ? { ...i, selected: e.target.checked } : i))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{item.booking}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={item.invoice}
                          onChange={(e) => setItems(items.map(i => i.jobId === item.jobId ? { ...i, invoice: e.target.value } : i))}
                          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="date" 
                          value={item.date}
                          onChange={(e) => setItems(items.map(i => i.jobId === item.jobId ? { ...i, date: e.target.value } : i))}
                          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number" 
                          value={item.net}
                          onChange={(e) => setItems(items.map(i => i.jobId === item.jobId ? { ...i, net: Number(e.target.value) } : i))}
                          className="w-40 px-2 py-1 text-sm border border-slate-200 rounded text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number" 
                          value={item.vat}
                          onChange={(e) => setItems(items.map(i => i.jobId === item.jobId ? { ...i, vat: Number(e.target.value) } : i))}
                          className="w-40 px-2 py-1 text-sm border border-slate-200 rounded text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.fileUrl ? (
                          <a 
                            href={item.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={item.fileName}
                          >
                            <FileText className="w-5 h-5" />
                          </a>
                        ) : (
                          <span className="text-slate-300">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'syncing' && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin mx-auto" />}
                        {item.status === 'success' && <Check className="w-5 h-5 text-emerald-600 mx-auto" />}
                        {item.status === 'error' && (
                          <div className="group relative inline-block">
                            <AlertCircle className="w-5 h-5 text-red-500 mx-auto cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {item.error}
                            </div>
                          </div>
                        )}
                        {item.status === 'pending' && <span className="text-xs text-slate-400">Chờ đồng bộ</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {items.filter(i => i.selected).length} mục được chọn
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSync}
              disabled={isProcessing || items.filter(i => i.selected && i.status !== 'success').length === 0}
              className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Đồng bộ từ File
            </button>
            <button
              onClick={handleApply}
              disabled={isProcessing || items.length === 0}
              className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              Cập nhật vào Booking
            </button>
          </div>
        </div>
      </div>

      {/* Modal nhập API Key nếu chưa có hoặc muốn đổi */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[120] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Cấu hình Gemini API Key</h3>
                  <p className="text-xs text-slate-500">Dùng để trích xuất hóa đơn tự động bằng AI</p>
                </div>
              </div>
              <button 
                onClick={() => setShowKeyModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Google Gemini API Key (Bắt đầu bằng AIzaSy...):
              </label>
              <input 
                type="password" 
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Dán mã API Key tại đây (AIzaSy...)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mã API Key được lưu an toàn trực tiếp trên trình duyệt (localStorage) và gửi trực tiếp tới máy chủ Google Gemini, không cần thông qua máy chủ trung gian.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Đóng
              </button>
              <button 
                onClick={() => {
                  const trimmed = keyInput.trim();
                  if (!trimmed) {
                    alert('Vui lòng nhập API Key!');
                    return;
                  }
                  setActiveApiKey(trimmed);
                  saveStoredApiKey({ name: 'Gemini Key', key: trimmed, provider: 'gemini', isActive: true });
                  setActiveApiKeyState(trimmed);
                  setShowKeyModal(false);
                }}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Lưu & Áp Dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncBookingModal;
