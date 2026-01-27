
import React, { useState } from 'react';
import { Sparkles, Zap, FileInput, Send, CheckCircle, AlertTriangle, Loader2, RefreshCw, Trash2, Save, FileText, Search } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { JobData, Customer } from '../types';

interface AutoToolProps {
    mode: 'payment' | 'invoice';
    jobs: JobData[];
    customers: Customer[];
    onUpdateJob: (job: JobData) => void;
    onAddCustomReceipt?: (receipt: any) => void;
}

interface ParsedData {
    jobCode: string;
    customerCode: string;
    amount: string;
    invoice: string;
    date: string;
    companyName: string;
}

export const AutoTool: React.FC<AutoToolProps> = ({ mode, jobs, customers, onUpdateJob, onAddCustomReceipt }) => {
    const [rawInput, setRawInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const handleParse = async () => {
        if (!rawInput.trim()) return;
        setIsParsing(true);
        setParsedData(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const prompt = `Parse this bank transfer text and extract specific logistics job data.
            Return ONLY a valid JSON object (no markdown, no explanation).
            
            Fields to extract:
            - jobCode: The shipping bill or job number (usually starts with KMLSHA, MSC, ONE, etc.)
            - customerCode: Identify the client company code or name (shortened)
            - amount: The numerical amount from the transfer (remove currency symbols and spaces)
            - invoice: If an invoice number is mentioned, return it. If not, return null.
            - date: The transfer date in YYYY-MM-DD format.
            - companyName: The full company name mentioned.

            Example input:
            "27/01/2026 17:03:43 + 75,103,200 843,613,022 CONG TY TNHH GIAO NHAN VIBTRANS VN Vibtrans 0106159865 TT cho Long Hoa ng theo so bill KMLSHA01180035 Ma giao dich Trace134001 Trace 13400"
            
            Example output:
            {
              "jobCode": "KMLSHA01180035",
              "customerCode": "VIBTRANS",
              "amount": "75,103,200",
              "invoice": null,
              "date": "2026-01-27",
              "companyName": "CONG TY TNHH GIAO NHAN VIBTRANS VN"
            }

            Input text:
            "${rawInput}"`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            const text = response.text || '';
            const cleanedJson = text.replace(/```json|```/g, '').trim();
            const result = JSON.parse(cleanedJson);
            
            // Clean amount string
            if (result.amount) {
                result.amount = result.amount.replace(/[^\d,.]/g, '');
            }

            // Fallback invoice
            if (!result.invoice && result.jobCode) {
                result.invoice = `XXX BL ${result.jobCode}`;
            }

            setParsedData(result);
        } catch (err) {
            console.error("AI Parsing Error:", err);
            alert("Không thể tách nội dung tự động. Vui lòng kiểm tra lại định dạng hoặc thử lại sau.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleUpdateToJob = () => {
        if (!parsedData) return;
        setIsApplying(true);

        const targetJob = jobs.find(j => j.jobCode.toLowerCase().trim() === parsedData.jobCode.toLowerCase().trim());

        if (!targetJob) {
            alert(`Không tìm thấy Job có mã: ${parsedData.jobCode} trong hệ thống.`);
            setIsApplying(false);
            return;
        }

        const amt = Number(parsedData.amount.replace(/,/g, ''));
        const updatedJob: JobData = {
            ...targetJob,
            localChargeTotal: amt,
            localChargeInvoice: parsedData.invoice,
            localChargeDate: parsedData.date,
            bank: 'MB Bank' // Updated to MB Bank per user request
        };

        onUpdateJob(updatedJob);
        alert(`Đã cập nhật Job ${parsedData.jobCode} thành công!`);
        setIsApplying(false);
    };

    const handleCreateReceipt = () => {
        if (!parsedData || !onAddCustomReceipt) return;
        setIsApplying(true);

        const amt = Number(parsedData.amount.replace(/,/g, ''));
        const newReceipt = {
            id: `auto-rcpt-${Date.now()}`,
            type: 'external',
            date: parsedData.date,
            docNo: `NTTK${Date.now().toString().slice(-5)}`,
            objCode: parsedData.customerCode,
            objName: parsedData.companyName,
            desc: `Thu tiền khách hàng theo hoá đơn ${parsedData.invoice} (AUTO)`,
            amount: amt,
            invoice: parsedData.invoice,
            additionalReceipts: []
        };

        onAddCustomReceipt(newReceipt);
        alert(`Đã tạo phiếu thu tự động thành công!`);
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
                <p className="text-slate-500 ml-11">Sử dụng AI để tách nội dung chuyển khoản và tự động hóa quy trình nhập liệu</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Input Section */}
                <div className="flex flex-col space-y-4">
                    <div className="flex-1 glass-panel p-6 rounded-2xl border flex flex-col">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <FileInput size={14} /> Nội dung chuyển khoản (Copy từ App Bank)
                        </label>
                        <textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder='Dán nội dung ví dụ: "27/01/2026 17:03:43 + 75,103,200..." '
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

                {/* Result Section */}
                <div className="flex flex-col space-y-4">
                    <div className="flex-1 glass-panel p-6 rounded-2xl border flex flex-col relative overflow-hidden">
                        {!parsedData && !isParsing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                                <Search size={48} className="opacity-10 mb-4" />
                                <p className="text-sm">Kết quả phân tích sẽ hiển thị tại đây sau khi bấm "Tách Dữ Liệu"</p>
                            </div>
                        )}
                        
                        {isParsing && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-2" />
                                <p className="text-amber-700 font-bold animate-pulse">AI đang phân tích...</p>
                            </div>
                        )}

                        {parsedData && (
                            <div className="animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-6 flex items-center gap-2">
                                    <CheckCircle size={14} className="text-green-500" /> Dữ liệu đã tách
                                </h3>
                                
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">JOB CODE</label>
                                            <input 
                                                value={parsedData.jobCode} 
                                                onChange={e => setParsedData({...parsedData, jobCode: e.target.value})}
                                                className="w-full bg-transparent font-bold text-blue-700 outline-none focus:text-blue-900"
                                            />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">MÃ KH</label>
                                            <input 
                                                value={parsedData.customerCode} 
                                                onChange={e => setParsedData({...parsedData, customerCode: e.target.value})}
                                                className="w-full bg-transparent font-bold text-orange-700 outline-none focus:text-orange-900"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">CÔNG TY</label>
                                        <input 
                                            value={parsedData.companyName} 
                                            onChange={e => setParsedData({...parsedData, companyName: e.target.value})}
                                            className="w-full bg-transparent font-bold text-slate-700 outline-none"
                                        />
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">SỐ TIỀN THU</label>
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
                                                type="date"
                                                value={parsedData.date} 
                                                onChange={e => setParsedData({...parsedData, date: e.target.value})}
                                                className="w-full bg-transparent font-bold text-slate-700 outline-none"
                                            />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">HÓA ĐƠN</label>
                                            <input 
                                                value={parsedData.invoice || ''} 
                                                onChange={e => setParsedData({...parsedData, invoice: e.target.value})}
                                                className="w-full bg-transparent font-bold text-slate-700 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={handleUpdateToJob}
                                        disabled={isApplying}
                                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
                                    >
                                        {isApplying ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
                                        Cập Nhật Vào Job
                                    </button>
                                    <button
                                        onClick={handleCreateReceipt}
                                        disabled={isApplying}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
                                    >
                                        {isApplying ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                        Tạo Phiếu Thu
                                    </button>
                                </div>
                                
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700 leading-relaxed italic">
                                    <AlertTriangle size={12} className="inline mr-1 mb-0.5" />
                                    Vui lòng kiểm tra lại độ chính xác của các trường thông tin trước khi thực hiện cập nhật hệ thống.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
