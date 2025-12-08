import React, { useState, useRef, useEffect } from 'react';
import { ShippingLine } from '../types';
import { 
  CreditCard, Upload, Plus, FileText, CheckCircle, Trash2, 
  Eye, Download, AlertCircle, Search, Save, X, HardDrive, CornerDownRight 
} from 'lucide-react';

interface PaymentRequest {
  id: string;
  lineCode: string; // MSC, ONE, etc.
  pod?: 'HCM' | 'HPH'; // Specific for MSC
  booking: string;
  amount: number;
  
  // Invoice File Info
  invoiceFileName: string;
  invoicePath: string; // Simulated Server Path
  invoiceBlobUrl?: string; // For session preview
  
  // UNC File Info
  uncFileName?: string;
  uncPath?: string; // Simulated Server Path
  uncBlobUrl?: string; // For session preview
  
  status: 'pending' | 'completed';
  createdAt: string;
  completedAt?: string;
}

interface PaymentPageProps {
  lines: ShippingLine[];
}

export const PaymentPage: React.FC<PaymentPageProps> = ({ lines }) => {
  // --- STATE ---
  const [requests, setRequests] = useState<PaymentRequest[]>(() => {
      try {
          const saved = localStorage.getItem('payment_requests_v1');
          return saved ? JSON.parse(saved) : [];
      } catch {
          return [];
      }
  });
  
  // Form State
  const [line, setLine] = useState('');
  const [pod, setPod] = useState<'HCM' | 'HPH'>('HCM');
  const [booking, setBooking] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  
  // Modal State for Completion (UNC Upload)
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [uncFile, setUncFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uncInputRef = useRef<HTMLInputElement>(null);

  // Persist Metadata
  useEffect(() => {
      localStorage.setItem('payment_requests_v1', JSON.stringify(requests));
  }, [requests]);

  // --- HANDLERS ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!line || !booking || !amount) {
        alert("Vui lòng điền đầy đủ thông tin: Line, Booking, Số tiền");
        return;
    }

    // Simulate Path: E:\ServerData\Uploads\Invoice_[Booking]_[Timestamp].pdf
    const fileName = invoiceFile ? invoiceFile.name : `Invoice_${booking}.pdf`;
    const simulatedPath = `E:\\ServerData\\Uploads\\${fileName}`;

    const newReq: PaymentRequest = {
        id: Date.now().toString(),
        lineCode: line,
        pod: line === 'MSC' ? pod : undefined,
        booking,
        amount,
        invoiceFileName: fileName,
        invoicePath: simulatedPath,
        invoiceBlobUrl: invoiceFile ? URL.createObjectURL(invoiceFile) : '',
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    setRequests(prev => [newReq, ...prev]);
    
    // Reset Form
    setBooking('');
    setAmount(0);
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Bạn có chắc chắn muốn xóa yêu cầu thanh toán này?")) {
          setRequests(prev => prev.filter(r => r.id !== id));
      }
  };

  const initiateComplete = (id: string) => {
      setCompletingId(id);
      setUncFile(null);
  };

  const handleUncSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setUncFile(e.target.files[0]);
      }
  };

  const confirmComplete = () => {
      if (!completingId) return;
      if (!uncFile) {
          alert("Vui lòng upload Ủy nhiệm chi (UNC) để hoàn tất.");
          return;
      }

      // Simulate UNC Path
      const fileName = uncFile.name;
      const simulatedUncPath = `E:\\ServerData\\Uploads\\UNC\\${fileName}`;

      setRequests(prev => prev.map(req => {
          if (req.id === completingId) {
              return {
                  ...req,
                  status: 'completed',
                  uncFileName: fileName,
                  uncPath: simulatedUncPath,
                  uncBlobUrl: URL.createObjectURL(uncFile),
                  completedAt: new Date().toISOString()
              };
          }
          return req;
      }));

      setCompletingId(null);
      setUncFile(null);
  };

  // --- RENDER HELPERS ---

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const getLineDisplay = (req: PaymentRequest) => {
      if (req.lineCode === 'MSC') {
          return (
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                MSC-{req.pod || 'HCM'}
            </span>
          );
      }
      return <span className="font-bold text-slate-700">{req.lineCode}</span>;
  };

  const openFile = (url: string | undefined) => {
      if (url) window.open(url, '_blank');
      else alert("File gốc không tồn tại trong phiên làm việc này (đã bị xóa khỏi bộ nhớ đệm).");
  };

  const downloadUNC = (req: PaymentRequest) => {
      if (!req.uncBlobUrl) {
          alert("File không khả dụng để tải xuống.");
          return;
      }
      const link = document.createElement('a');
      link.href = req.uncBlobUrl;
      // Rename file per requirement: UNC BL [booking].pdf
      // We assume it's a PDF or keep original extension if possible
      const ext = req.uncFileName?.split('.').pop() || 'pdf';
      link.download = `UNC BL ${req.booking}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const pendingList = requests.filter(r => r.status === 'pending');
  const completedList = requests.filter(r => r.status === 'completed');

  return (
    <div className="p-8 w-full h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
             <CreditCard className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Thanh Toán MBL</h1>
         </div>
         <p className="text-slate-500 ml-11">Tạo yêu cầu và quản lý thanh toán cước hãng tàu</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20">
        
        {/* SECTION 1: INPUT FORM */}
        <div className="glass-panel p-6 rounded-2xl border border-white/50 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center">
                <Plus className="w-4 h-4 mr-2 text-emerald-600" /> Tạo Yêu Cầu Thanh Toán
            </h3>
            <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                
                {/* Line Selection */}
                <div className="md:col-span-1 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Mã Line</label>
                    <select 
                        value={line} 
                        onChange={(e) => setLine(e.target.value)}
                        className="glass-input w-full p-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        <option value="">-- Chọn Line --</option>
                        {lines.map(l => <option key={l.id} value={l.code}>{l.code}</option>)}
                    </select>
                </div>

                {/* MSC POD Condition */}
                {line === 'MSC' ? (
                    <div className="md:col-span-1 space-y-1.5 animate-in fade-in zoom-in-95">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase">POD (MSC)</label>
                        <div className="flex bg-white rounded-xl border border-blue-200 p-1">
                            <button 
                                type="button"
                                onClick={() => setPod('HCM')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${pod === 'HCM' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                HCM
                            </button>
                            <button 
                                type="button"
                                onClick={() => setPod('HPH')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${pod === 'HPH' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                HPH
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="md:col-span-1"></div>
                )}

                <div className="md:col-span-1 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">MBL / Booking</label>
                    <input 
                        type="text" 
                        value={booking} 
                        onChange={(e) => setBooking(e.target.value)}
                        className="glass-input w-full p-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Nhập số Booking..."
                    />
                </div>

                <div className="md:col-span-1 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Số tiền</label>
                    <input 
                        type="text" 
                        value={amount ? new Intl.NumberFormat('en-US').format(amount) : ''} 
                        onChange={(e) => {
                            const val = Number(e.target.value.replace(/,/g, ''));
                            if (!isNaN(val)) setAmount(val);
                        }}
                        className="glass-input w-full p-2.5 rounded-xl text-sm font-bold text-red-600 focus:ring-2 focus:ring-emerald-500 outline-none text-right"
                        placeholder="0"
                    />
                </div>

                <div className="md:col-span-1 flex items-center space-x-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex-1 p-2.5 rounded-xl border border-dashed flex items-center justify-center text-xs font-bold transition-all h-[42px] ${invoiceFile ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                    >
                        {invoiceFile ? <CheckCircle className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        {invoiceFile ? 'Đã chọn HĐ' : 'Up Hóa Đơn'}
                    </button>
                    
                    <button 
                        type="submit"
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg hover:shadow-emerald-500/30 transition-all h-[42px] px-6 font-bold text-sm"
                    >
                        Tạo
                    </button>
                </div>
            </form>
        </div>

        {/* SECTION 2: PENDING TABLE */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/40 shadow-sm">
            <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-orange-800 uppercase flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" /> Danh sách chờ thanh toán
                </h3>
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md text-xs font-bold">{pendingList.length}</span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/40 text-slate-600 border-b border-white/40 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Mã Line</th>
                            <th className="px-6 py-3">MBL/Booking</th>
                            <th className="px-6 py-3 text-right">Số tiền</th>
                            <th className="px-6 py-3 text-center">Xem File</th>
                            <th className="px-6 py-3 text-center w-32">Chức năng</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                        {pendingList.length > 0 ? (
                            pendingList.map(req => (
                                <tr key={req.id} className="hover:bg-white/40 transition-colors">
                                    <td className="px-6 py-4">{getLineDisplay(req)}</td>
                                    <td className="px-6 py-4 font-medium text-slate-700">{req.booking}</td>
                                    <td className="px-6 py-4 text-right font-bold text-red-600">{formatCurrency(req.amount)}</td>
                                    <td className="px-6 py-4 text-center">
                                        {req.invoiceBlobUrl ? (
                                            <button onClick={() => openFile(req.invoiceBlobUrl)} className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Chưa có</span>
                                        )}
                                        <div className="text-[9px] text-slate-400 mt-1 truncate max-w-[150px] mx-auto" title={req.invoicePath}>{req.invoicePath}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button 
                                                onClick={() => initiateComplete(req.id)}
                                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-2 rounded-lg transition-colors flex items-center shadow-sm"
                                                title="Hoàn thành & Up UNC"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(req.id)}
                                                className="bg-white border border-red-200 hover:bg-red-50 text-red-600 p-2 rounded-lg transition-colors shadow-sm"
                                                title="Xóa"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">Không có yêu cầu chờ thanh toán</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* SECTION 3: COMPLETED TABLE */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/40 shadow-sm opacity-90">
            <div className="bg-emerald-50/50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-emerald-800 uppercase flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" /> Danh sách đã thanh toán
                </h3>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold">{completedList.length}</span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/40 text-slate-600 border-b border-white/40 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Mã Line</th>
                            <th className="px-6 py-3">MBL/Booking</th>
                            <th className="px-6 py-3 text-right">Số tiền</th>
                            <th className="px-6 py-3 text-center">File UNC (Path)</th>
                            <th className="px-6 py-3 text-center w-40">Chức năng</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                        {completedList.length > 0 ? (
                            completedList.map(req => (
                                <tr key={req.id} className="hover:bg-white/40 transition-colors">
                                    <td className="px-6 py-4">{getLineDisplay(req)}</td>
                                    <td className="px-6 py-4 font-medium text-slate-700">{req.booking}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-600">{formatCurrency(req.amount)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="flex items-center text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                                <HardDrive className="w-3 h-3 mr-1.5 text-purple-500" /> 
                                                <span className="text-xs font-mono font-bold">Local Disk</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400 mt-1 truncate max-w-[200px]" title={req.uncPath}>
                                                {req.uncPath}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button 
                                                onClick={() => req.invoiceBlobUrl && openFile(req.invoiceBlobUrl)}
                                                className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Xem Hóa Đơn Gốc"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => downloadUNC(req)}
                                                className="text-purple-600 hover:text-purple-800 p-2 hover:bg-purple-50 rounded-lg transition-colors bg-purple-50/50 border border-purple-100"
                                                title="Download UNC (Đổi tên)"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(req.id)}
                                                className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Xóa"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">Chưa có dữ liệu thanh toán</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>

      {/* MODAL: UPLOAD UNC */}
      {completingId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 p-6 border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Hoàn Tất Thanh Toán</h3>
                      <button onClick={() => setCompletingId(null)} className="text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600">
                          Vui lòng upload file <strong>Ủy Nhiệm Chi (UNC)</strong> để xác nhận thanh toán hoàn tất cho lô hàng này.
                      </div>

                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => uncInputRef.current?.click()}>
                          <input type="file" ref={uncInputRef} onChange={handleUncSelect} className="hidden" />
                          <div className="p-4 bg-slate-100 rounded-full mb-3 group-hover:bg-emerald-50 transition-colors">
                             <Upload className={`w-8 h-8 ${uncFile ? 'text-emerald-500' : 'text-slate-400'}`} />
                          </div>
                          <span className="text-sm font-bold text-slate-700">{uncFile ? uncFile.name : 'Chọn file UNC từ máy tính'}</span>
                          <span className="text-xs text-slate-400 mt-1">Hệ thống sẽ lưu file vào E:\ServerData\Uploads</span>
                      </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                      <button onClick={() => setCompletingId(null)} className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                      <button onClick={confirmComplete} className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-lg hover:shadow-emerald-500/30 transition-all">Xác nhận</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};