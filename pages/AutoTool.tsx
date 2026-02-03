
import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Zap, FileInput, Send, CheckCircle, AlertTriangle, Loader2, RefreshCw, Trash2, Save, FileText, Search, CreditCard, Anchor, Repeat, Wallet, Layers, RotateCcw, Plus } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { JobData, Customer } from '../types';
import { generateNextDocNo, formatDateVN, parseDateVN } from '../utils';
import { CustomerModal } from '../components/CustomerModal';

interface AutoToolProps {
    mode: 'payment' | 'invoice';
    jobs: JobData[];
    customers: Customer[];
    onUpdateJob: (job: JobData) => void;
    onAddCustomReceipt?: (receipt: any) => void;
    customReceipts?: any[];
    onAddCustomer?: (customer: Customer) => void;
}

interface ParsedData {
    jobCodes: string[];
    customerCode: string;
    amount: string;
    invoice: string;
    date: string;
    companyName: string;
}

type ReceiptType = 'local' | 'deposit' | 'extension' | 'other';

export const AutoTool: React.FC<AutoToolProps> = ({ mode, jobs, customers, onUpdateJob, onAddCustomReceipt, customReceipts = [], onAddCustomer }) => {
    const [rawInput, setRawInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [receiptType, setReceiptType] = useState<ReceiptType>('local');
    
    // State for New Customer Modal
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    
    // State riêng để hiển thị ngày dạng dd/mm/yyyy
    const [dateInput, setDateInput] = useState('');

    const usedDocNos = useMemo(() => {
        const list: string[] = [];
        customReceipts.forEach(r => {
            if (r.docNo) list.push(r.docNo);
            if (r.additionalReceipts) {
                r.additionalReceipts.forEach((ar: any) => { if(ar.docNo) list.push(ar.docNo); });
            }
        });
        jobs.forEach(j => {
            if (j.additionalReceipts) {
                j.additionalReceipts.forEach(r => { if (r.docNo) list.push(r.docNo); });
            }
        });
        return list;
    }, [customReceipts, jobs]);

    // Check if parsed customer exists in database
    const existingCustomer = useMemo(() => {
        if (!parsedData?.customerCode) return null;
        const code = parsedData.customerCode.trim().toLowerCase();
        // Check exact match on Code or ID
        return customers.find(c => c.code.toLowerCase() === code || c.id === code);
    }, [parsedData?.customerCode, customers]);

    // Update Company Name automatically if existing customer found
    useEffect(() => {
        if (existingCustomer && parsedData) {
            setParsedData(prev => prev ? ({ ...prev, companyName: existingCustomer.name }) : null);
        }
    }, [existingCustomer]); 

    // Cập nhật dateInput khi có kết quả phân tích mới
    useEffect(() => {
        if (parsedData?.date) {
            setDateInput(formatDateVN(parsedData.date));
        }
    }, [parsedData]);

    const handleParse = async () => {
        if (!rawInput.trim()) return;
        setIsParsing(true);
        setParsedData(null);
        setDateInput('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const customerContext = customers.map(c => `${c.code}: ${c.name}`).join('\n');

            const prompt = `Parse this bank transfer text and extract specific logistics job data.
            IMPORTANT: If multiple bill numbers or job codes are mentioned (e.g. KMLSHA..., ONE...), extract ALL of them into an array.
            Return ONLY a valid JSON object (no markdown, no explanation).
            
            PRIORITY: Try to match the company name or sender info in the input with one from this EXISTING CUSTOMER LIST:
            ${customerContext}
            If a close match is found, return that specific code as "customerCode".

            Fields to extract:
            - jobCodes: An ARRAY of all shipping bill or job numbers found.
            - customerCode: The matched system code or shortened name.
            - amount: The numerical amount from the transfer as a string.
            - invoice: If an invoice number is mentioned, return it. If not, return null.
            - date: The transfer date in YYYY-MM-DD format.
            - companyName: The full company name mentioned.

            Input text:
            "${rawInput}"`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            const text = response.text || '';
            const cleanedJson = text.replace(/```json|```/g, '').trim();
            const result = JSON.parse(cleanedJson);
            
            if (result.amount !== undefined && result.amount !== null) {
                result.amount = String(result.amount).replace(/[^\d,.]/g, '');
            } else {
                result.amount = '0';
            }

            if (!result.jobCodes || !Array.isArray(result.jobCodes)) {
                result.jobCodes = result.jobCode ? [String(result.jobCode)] : [];
            } else {
                result.jobCodes = result.jobCodes.map((c: any) => String(c));
            }

            // CLEAN & FILTER JOB CODES
            // 1. Remove all spaces
            // 2. Must contain KML
            // 3. Length must be around 13-16 chars (e.g. KMLSHA0122009 is 13)
            result.jobCodes = result.jobCodes
                .map((code: string) => code.toUpperCase().replace(/\s+/g, '').trim())
                .filter((code: string) => code.includes('KML') && code.length >= 13 && code.length <= 16);

            // Tự động tính tổng tiền từ các Job tìm thấy nếu AI không trả về hoặc trả về 0
            if (result.jobCodes.length > 0) {
                const calculatedTotal = result.jobCodes.reduce((sum: number, code: string) => {
                    const j = jobs.find(job => job.jobCode.toLowerCase().trim() === String(code).toLowerCase().trim());
                    // Ưu tiên localChargeTotal (vì đây là công cụ thanh toán)
                    return sum + (j ? (j.localChargeTotal || 0) : 0);
                }, 0);

                if (calculatedTotal > 0 && (result.amount === '0' || !result.amount)) {
                    result.amount = String(calculatedTotal);
                }
            }

            if (!result.invoice && result.jobCodes.length > 0) {
                result.invoice = `XXX BL ${result.jobCodes.join('+')}`;
            }

            setParsedData(result);
        } catch (err: any) {
            console.error("AI Parsing Error:", err);
            alert(`Không thể tách nội dung tự động. Lỗi: ${err.message || "Kiểm tra lại định dạng hoặc thử lại sau."}`);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDateBlur = () => {
        if (!parsedData) return;
        const parsed = parseDateVN(dateInput);
        if (parsed) {
            setParsedData({ ...parsedData, date: parsed });
        } else {
            // Nếu nhập sai định dạng, reset về giá trị gốc
            setDateInput(formatDateVN(parsedData.date));
        }
    };

    const handleResetInvoice = () => {
        if (!parsedData) return;
        const defaultInv = `XXX BL ${parsedData.jobCodes.join('+')}`;
        setParsedData({ ...parsedData, invoice: defaultInv });
    };

    const handleSaveNewCustomer = (newCustomer: Customer) => {
        if (onAddCustomer) {
            onAddCustomer(newCustomer);
            if (parsedData) {
                setParsedData({ 
                    ...parsedData, 
                    customerCode: newCustomer.code, 
                    companyName: newCustomer.name 
                });
            }
        }
        setIsCustomerModalOpen(false);
    };

    const handleUpdateToJob = () => {
        if (!parsedData || parsedData.jobCodes.length === 0) return;
        setIsApplying(true);

        let successCount = 0;
        const missingCodes: string[] = [];
        
        // Parse amount once
        const numericAmount = parseFloat(parsedData.amount.replace(/,/g, '')) || 0;

        parsedData.jobCodes.forEach(code => {
            const targetJob = jobs.find(j => j.jobCode.toLowerCase().trim() === code.toLowerCase().trim());
            if (targetJob) {
                let updatedJob = { ...targetJob };
                
                // Find Customer by Code or Name
                const foundCust = customers.find(c => 
                    (c.code && c.code === parsedData.customerCode) || 
                    (c.name && c.name === parsedData.companyName)
                );
                const custId = foundCust ? foundCust.id : (parsedData.customerCode || '');

                if (receiptType === 'deposit') {
                    // Update Deposit Info
                    updatedJob.ngayThuCuoc = parsedData.date;
                    if (custId) updatedJob.maKhCuocId = custId;
                    
                    // Update Amount only if single job to avoid duplicating total across multiple jobs
                    if (parsedData.jobCodes.length === 1) {
                        updatedJob.thuCuoc = numericAmount;
                    }
                } 
                else if (receiptType === 'extension') {
                    // Update Extension Info
                    let inv = parsedData.invoice || '';
                    if (inv.startsWith('XXX BL')) inv = `XXX BL ${targetJob.jobCode}`;
                    
                    let extensions = [...(targetJob.extensions || [])];
                    
                    // Logic: Find existing extension by invoice number, or create new
                    // If invoice is placeholder XXX BL..., find match.
                    const existingIdx = extensions.findIndex(e => e.invoice === inv);
                    
                    const extAmount = parsedData.jobCodes.length === 1 ? numericAmount : 0;

                    if (existingIdx >= 0) {
                        // Update existing
                        extensions[existingIdx] = {
                            ...extensions[existingIdx],
                            customerId: custId || extensions[existingIdx].customerId,
                            invoiceDate: parsedData.date,
                            // If single job, update total. If multi, preserve existing unless 0.
                            total: (parsedData.jobCodes.length === 1 && extAmount > 0) ? extAmount : extensions[existingIdx].total
                        };
                        // Update net/vat if total changed
                        if (parsedData.jobCodes.length === 1 && extAmount > 0) {
                             extensions[existingIdx].net = Math.round(extAmount / 1.08);
                             extensions[existingIdx].vat = extAmount - extensions[existingIdx].net;
                        }
                    } else {
                        // Add new
                        extensions.push({
                            id: Date.now().toString() + Math.random(),
                            customerId: custId || targetJob.customerId,
                            invoice: inv || `GH BL ${targetJob.jobCode}`,
                            invoiceDate: parsedData.date,
                            total: extAmount,
                            net: Math.round(extAmount / 1.08),
                            vat: extAmount - Math.round(extAmount / 1.08),
                            amisDocNo: '', amisDesc: '', amisAmount: 0 // Init AMIS fields
                        });
                    }
                    updatedJob.extensions = extensions;
                }
                else {
                    // Default: Local Charge
                    let appliedInvoice = parsedData.invoice;
                    if (appliedInvoice && appliedInvoice.startsWith('XXX BL')) {
                        appliedInvoice = `XXX BL ${targetJob.jobCode}`;
                    }
                    
                    updatedJob.localChargeInvoice = appliedInvoice;
                    updatedJob.localChargeDate = parsedData.date;
                    updatedJob.bank = 'MB Bank'; // Default Bank for Auto Tool
                    
                    // For Local Charge, we can also update customer if needed
                    if (receiptType === 'local' && custId) {
                        updatedJob.customerId = custId;
                        if (foundCust) updatedJob.customerName = foundCust.name;
                    }
                }

                onUpdateJob(updatedJob);
                successCount++;
            } else {
                missingCodes.push(code);
            }
        });

        if (missingCodes.length > 0) {
            alert(`Đã cập nhật ${successCount} Job. Không tìm thấy mã: ${missingCodes.join(', ')}`);
        } else {
            alert(`Đã cập nhật thành công tất cả ${successCount} Job liên quan!`);
        }
        
        setIsApplying(false);
    };

    const handleCreateReceipt = () => {
        if (!parsedData || !onAddCustomReceipt) return;
        setIsApplying(true);

        const amtStr = String(parsedData.amount || '0').replace(/,/g, '');
        const amt = Number(amtStr);
        const nextDoc = generateNextDocNo(jobs, 'NTTK', 5, usedDocNos);

        let finalDesc = '';
        const combinedJobs = parsedData.jobCodes.join('+');
        const inv = parsedData.invoice || 'XXX';
        
        switch (receiptType) {
            case 'local':
                finalDesc = `Thu tiền của KH theo hoá đơn ${inv} (KIM)`;
                break;
            case 'deposit':
                finalDesc = `Thu tiền của KH CƯỢC CONT BL ${combinedJobs}`;
                break;
            case 'extension':
                finalDesc = `Thu tiền của KH theo hoá đơn GH ${inv} (KIM)`;
                break;
            case 'other':
                finalDesc = `Thu tiền của KH theo hoá đơn ${inv} (LH MB)`;
                break;
        }

        const newReceipt = {
            id: `auto-rcpt-${Date.now()}`,
            category: 'external', // Đánh dấu là phiếu từ Auto Tool/Thu ngoài
            type: receiptType,    // Lưu đúng loại người dùng chọn (local, deposit...)
            date: parsedData.date,
            docNo: nextDoc,
            objCode: parsedData.customerCode,
            objName: parsedData.companyName,
            desc: finalDesc,
            amount: amt,
            invoice: parsedData.invoice,
            jobCodes: parsedData.jobCodes, // Lưu danh sách mã Job để khi sửa có thể hiện list gộp
            additionalReceipts: []
        };

        onAddCustomReceipt(newReceipt);
        alert(`Đã tạo phiếu thu gộp "${nextDoc}" cho các Job: ${parsedData.jobCodes.join(', ')}`);
        setIsApplying(false);
    };

    if (mode === 'invoice') {
        return (
            <div className="p-8 h-full flex flex-col items-center justify-center text-slate-400">
                <FileText size={64} className="opacity-20 mb-4" />
                <h2 className="text-2xl font-bold">Auto Invoice</h2>
                <p>Tính năng đang được phát triển...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-full h-full flex flex-col">
            <div className="mb-8">
                <div className="flex items-center space-x-3 text-slate-800 mb-2">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-bold">Auto Payment Tool</h1>
                </div>
                <p className="text-slate-500 ml-11">Sử dụng AI để tách nội dung chuyển khoản gộp nhiều Job</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                <div className="flex flex-col space-y-4">
                    <div className="flex-1 glass-panel p-6 rounded-2xl border flex flex-col">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <FileInput size={14} /> Nội dung chuyển khoản (Copy từ App Bank)
                        </label>
                        <textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder='Dán nội dung chuyển khoản tại đây...'
                            className="flex-1 w-full p-4 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm font-medium leading-relaxed"
                        />
                        <button
                            onClick={handleParse}
                            disabled={isParsing || !rawInput.trim()}
                            className="mt-4 w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isParsing ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                            Tách Dữ Liệu Tự Động
                        </button>
                    </div>
                </div>

                <div className="flex flex-col space-y-4">
                    <div className="flex-1 glass-panel p-6 rounded-2xl border flex flex-col relative overflow-hidden">
                        {!parsedData && !isParsing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                                <Search size={48} className="opacity-10 mb-4" />
                                <p className="text-sm">Kết quả phân tích sẽ hiển thị tại đây</p>
                            </div>
                        )}
                        
                        {isParsing && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-2" />
                                <p className="text-amber-700 font-bold animate-pulse">AI đang phân tích gộp Job...</p>
                            </div>
                        )}

                        {parsedData && (
                            <div className="animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-6 flex items-center gap-2">
                                    <CheckCircle size={14} className="text-green-500" /> Dữ liệu đã tách
                                </h3>
                                
                                <div className="space-y-4">
                                    {/* Hide Job List if receipt type is 'other' (Thu Khác) */}
                                    {receiptType !== 'other' && (
                                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                            <label className="text-[10px] font-bold text-blue-500 block mb-2 flex items-center gap-1">
                                                <Layers size={10} /> DANH SÁCH JOB ({parsedData.jobCodes.length})
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {parsedData.jobCodes.map((code, idx) => (
                                                    <span key={idx} className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-700 font-bold text-xs shadow-sm">
                                                        {code}
                                                    </span>
                                                ))}
                                                {parsedData.jobCodes.length === 0 && <span className="text-xs text-slate-400 italic">Không tìm thấy mã Job (KML... 13-16 ký tự)</span>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">MÃ KH (HỆ THỐNG)</label>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    list="customer-list"
                                                    value={parsedData.customerCode} 
                                                    onChange={e => setParsedData({...parsedData, customerCode: e.target.value})}
                                                    className="w-full bg-transparent font-bold text-orange-700 outline-none"
                                                    placeholder="Nhập mã hoặc chọn..."
                                                />
                                                <datalist id="customer-list">
                                                    {customers.map(c => (
                                                        <option key={c.id} value={c.code}>{c.name}</option>
                                                    ))}
                                                </datalist>

                                                {!existingCustomer && (
                                                    <button 
                                                        onClick={() => setIsCustomerModalOpen(true)}
                                                        className="p-1 text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                                                        title="Thêm khách hàng mới"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`p-3 rounded-xl border ${existingCustomer ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">CÔNG TY {existingCustomer && <span className="text-green-600">(Đã khớp)</span>}</label>
                                            <input 
                                                value={parsedData.companyName} 
                                                onChange={e => setParsedData({...parsedData, companyName: e.target.value})}
                                                readOnly={!!existingCustomer} // Locked if matches system customer
                                                className={`w-full bg-transparent font-bold outline-none truncate ${existingCustomer ? 'text-green-800' : 'text-slate-700'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">TỔNG TIỀN THU</label>
                                        <input 
                                            value={parsedData.amount} 
                                            onChange={e => setParsedData({...parsedData, amount: e.target.value})}
                                            className="w-full bg-transparent font-black text-2xl text-green-600 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">NGÀY THU</label>
                                            <input 
                                                type="text"
                                                value={dateInput} 
                                                onChange={e => setDateInput(e.target.value)}
                                                onBlur={handleDateBlur}
                                                placeholder="dd/mm/yyyy"
                                                className="w-full bg-transparent font-bold text-slate-700 outline-none"
                                            />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">HÓA ĐƠN</label>
                                            <div className="flex items-center">
                                                <input 
                                                    value={parsedData.invoice || ''} 
                                                    onChange={e => setParsedData({...parsedData, invoice: e.target.value})}
                                                    className="w-full bg-transparent font-bold text-slate-700 outline-none pr-6"
                                                />
                                                <button 
                                                    onClick={handleResetInvoice}
                                                    title="Reset về mặc định (XXX BL ...)"
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 bg-white p-1 rounded-full shadow-sm mt-3"
                                                >
                                                    <RotateCcw size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Loại hình phiếu thu</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'local', label: 'Local Charge', icon: CreditCard },
                                                { id: 'deposit', label: 'Thu Cược', icon: Anchor },
                                                { id: 'extension', label: 'Gia Hạn', icon: Repeat },
                                                { id: 'other', label: 'Thu Khác', icon: Wallet }
                                            ].map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setReceiptType(t.id as ReceiptType)}
                                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                                                        receiptType === t.id 
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                                    }`}
                                                >
                                                    <t.icon size={16} className="mb-1" />
                                                    <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className={`mt-6 grid gap-4 ${receiptType !== 'other' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                    {/* Hide 'Update to Job' button if type is 'other' */}
                                    {receiptType !== 'other' && (
                                        <button
                                            onClick={handleUpdateToJob}
                                            disabled={isApplying || parsedData.jobCodes.length === 0}
                                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                                        >
                                            {isApplying ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
                                            Cập Nhật Vào Jobs
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCreateReceipt}
                                        disabled={isApplying}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
                                    >
                                        {isApplying ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                        Tạo Phiếu Thu
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal for adding new customer */}
            <CustomerModal 
                isOpen={isCustomerModalOpen} 
                onClose={() => setIsCustomerModalOpen(false)} 
                onSave={handleSaveNewCustomer} 
                initialData={parsedData ? { id: '', code: parsedData.customerCode, name: parsedData.companyName, mst: '' } : null}
            />
        </div>
    );
};
