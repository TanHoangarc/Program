import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Copy, Check, Trash2, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useNotification } from '../contexts/NotificationContext';

interface MeInvoiceItem {
  id: string;
  tinhChat: string; // "Hàng hóa, dịch vụ"
  tenHHDV: string;
  bienKiemSoat: string;
  dvt: string;
  soLuong: number;
  donGia: number;
}

export const MeInvoicePage: React.FC = () => {
  const { alert } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  const [items, setItems] = useState<MeInvoiceItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
      } else {
        alert("Chỉ chấp nhận file PDF hoặc định dạng hình ảnh (PNG, JPG, JPEG).", "Cảnh báo");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Extract invoice items using Gemini API
  const handleExtract = async () => {
    if (!file) {
      alert("Vui lòng tải lên file hóa đơn trước.", "Thông báo");
      return;
    }

    setIsExtracting(true);
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      setIsExtracting(false);
      alert("Thiếu API Key cho Gemini. Vui lòng cấu hình GEMINI_API_KEY.", "Lỗi");
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3.5-flash";

      // Convert File to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1]; 
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const promptText = `Bạn là chuyên gia kế toán của Việt Nam. Hãy đọc tài liệu hóa đơn điện tử/Meinvoice này và trích xuất TOÀN BỘ danh sách chi tiết các dòng hàng hóa, dịch vụ bán ra.
Mỗi dòng hàng hóa, dịch vụ cần các thông tin chính xác từ hóa đơn:
1. tenHHDV: Tên hàng hóa, dịch vụ hoặc dòng mô tả chi tiết hàng hóa dịch vụ.
2. bienKiemSoat: Số xe, biển kiểm soát đầu kéo hoặc rơ moóc (nếu có đề cập trực tiếp trên dòng mô tả hay tên hàng hóa dịch vụ, ví dụ '51C-12345', 'BKS 51R0123', v.v. Nếu không tìm thấy, hãy cố gắng suy luận từ văn bản hoặc để trống "").
3. dvt: Đơn vị tính (như vỏ, chiếc, chuyến, giờ, km, khối, tấn... Nếu không có thì để "").
4. soLuong: Số lượng dạng số (Nếu không được ghi rõ hoặc mập mờ, hãy để 1).
5. donGia: Đơn giá dạng số.

Yêu cầu trả về JSON thuần cực kỳ chuẩn xác dưới cấu trúc sau:
{
  "items": [
    {
       "tenHHDV": "Tên chi tiết hàng hóa, dịch vụ",
       "bienKiemSoat": "Biển kiểm soát",
       "dvt": "Cái/Chuyến/...",
       "soLuong": 10,
       "donGia": 150000
    }
  ]
}
Lưu ý: Chỉ trả về đoạn JSON tối giản, không bao quanh bằng mã định dạng, không viết thêm từ hay giải thích nào khác ngoài chuỗi JSON hợp lệ.`;

      const result = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: file.type || "application/pdf", data: base64Data } },
            { text: promptText }
          ]
        }
      });

      const responseText = result.text || "";
      const cleanedJsonStr = responseText.replace(/```json|```/g, '').trim();
      const responseData = JSON.parse(cleanedJsonStr);

      if (responseData && Array.isArray(responseData.items)) {
        const parsedItems: MeInvoiceItem[] = responseData.items.map((it: any, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          tinhChat: "Hàng hóa, dịch vụ",
          tenHHDV: it.tenHHDV || '',
          bienKiemSoat: it.bienKiemSoat || '',
          dvt: it.dvt || '',
          soLuong: typeof it.soLuong === 'number' ? it.soLuong : Number(it.soLuong) || 1,
          donGia: typeof it.donGia === 'number' ? it.donGia : Number(it.donGia) || 0
        }));

        setItems(parsedItems);
        alert(`Đã trích xuất thành công ${parsedItems.length} dòng dữ liệu hàng hóa dịch vụ từ hóa đơn!`, "Thành công");
      } else {
        throw new Error("Dữ liệu phản hồi từ AI không đúng định dạng mong đợi.");
      }

    } catch (error: any) {
      console.error("Meinvoice Extraction Error:", error);
      alert(`Trích xuất thất bại: ${error.message || "Lỗi không xác định"}`, "Lỗi");
    } finally {
      setIsExtracting(false);
    }
  };

  // Helper function to copy text to Clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Không thể copy bằng Clipboard API", err);
    }
  };

  // Copy individual cell
  const handleCopyCell = (value: string, key: string) => {
    copyToClipboard(value);
    setCopiedCellKey(key);
    setTimeout(() => setCopiedCellKey(null), 1500);
  };

  // Copy entire row
  const handleCopyRow = (item: MeInvoiceItem) => {
    // Convert to TSV string
    const rowText = `${item.tinhChat}\t${item.tenHHDV}\t${item.bienKiemSoat}\t${item.dvt}\t${item.soLuong}\t${item.donGia}`;
    copyToClipboard(rowText);
    setCopiedRowId(item.id);
    setTimeout(() => setCopiedRowId(null), 1500);
  };

  // Copy entire column
  const handleCopyColumn = (colName: keyof MeInvoiceItem, label: string) => {
    const colValues = items.map(item => String(item[colName] ?? ''));
    const colText = colValues.join('\n');
    copyToClipboard(colText);
    setCopiedColumn(label);
    setTimeout(() => setCopiedColumn(null), 1500);
  };

  // Manual row management
  const handleAddRow = () => {
    const newItem: MeInvoiceItem = {
      id: Date.now().toString(),
      tinhChat: "Hàng hóa, dịch vụ",
      tenHHDV: "",
      bienKiemSoat: "",
      dvt: "",
      soLuong: 1,
      donGia: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof MeInvoiceItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveRow = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-8 w-full h-full flex flex-col max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3 text-slate-800 mb-1">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Trang Meinvoice</h1>
          </div>
          <p className="text-slate-500 ml-12">Kéo thả file hóa đơn Meinvoice (PDF/Ảnh) để phân tích trích xuất dữ liệu chi tiết hàng hóa dịch vụ sang dạng excel cực nhanh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Upload Container */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 block">1. Nhập file hóa đơn</span>
            
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-50/40" 
                  : file 
                    ? "border-green-400 bg-green-50/20" 
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept="application/pdf,image/*" 
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className={`w-10 h-10 mb-3 ${file ? 'text-green-500' : 'text-slate-400'}`} />
              {file ? (
                <div>
                  <p className="font-bold text-slate-700 text-sm truncate max-w-[200px] mb-1">{file.name}</p>
                  <p className="text-xs text-green-600 font-medium">Sẵn sàng phân tích</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-700 text-sm mb-1">Kéo thả hoặc nhấn để chọn file</p>
                  <p className="text-xs text-slate-400">Hỗ trợ PDF, PNG, JPG, JPEG</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExtract}
              disabled={isExtracting || !file}
              className={`w-full py-3 px-4 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                isExtracting || !file
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/20"
              }`}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang quét trích xuất...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-indigo-200" />
                  Trích xuất dữ liệu AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instructive Box */}
        <div className="lg:col-span-2 bg-white/50 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Hướng dẫn sử dụng</span>
            <div className="space-y-3.5 text-sm text-slate-600 font-medium">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 shrink-0 mt-0.5">1</div>
                <p>Chọn một hóa đơn Meinvoice có danh sách kê chi tiết hàng hóa dịch vụ, kéo thả trực tiếp hoặc click khung tải lên bên trái.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 shrink-0 mt-0.5">2</div>
                <p>Click nút <strong className="text-indigo-600 font-bold">Trích xuất dữ liệu AI</strong>. Trình xử lý Gemini Vision sẽ tự động quét hóa đơn, bóc tách bảng chi tiết hàng hóa dịch vụ và tự điền các cột một cách thông minh.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 shrink-0 mt-0.5">3</div>
                <p>Sử dụng các nút copy trên từng tiêu đề cột hoặc đầu dòng để nhận dữ liệu mong muốn định dạng Excel cực kỳ nhanh chóng.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs font-medium">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>AI bóc tách hóa đơn cực kỳ thông minh từ mô tả, số lượng, đơn giá và suy luận Biển kiểm soát nếu có trong văn bản hóa đơn của bạn. Bạn vẫn có thể sửa tay số liệu nếu cần!</span>
          </div>
        </div>
      </div>

      {/* Extracted Data Table Block */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className="text-slate-800 font-extrabold text-base">Bảng dữ liệu hàng hóa, dịch vụ trích xuất</span>
            {items.length > 0 && (
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">
                {items.length} dòng
              </span>
            )}
          </div>
          <button 
            onClick={handleAddRow}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm dòng
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
              <FileText className="w-12 h-12 mb-3 text-slate-300" />
              <p className="font-semibold text-sm mb-1">Chưa có dữ liệu trích xuất</p>
              <p className="text-xs">Tải lên file và trích xuất để hiển thị dữ liệu dạng bảng</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
              <thead className="bg-slate-50/80 text-slate-700 font-bold uppercase text-[11px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center w-14">Hàng</th>
                  <th className="px-4 py-3 w-48 relative group">
                    <div className="flex items-center justify-between">
                      <span>Tính chất HHDV</span>
                      <button 
                        onClick={() => handleCopyColumn('tinhChat', 'Tính chất')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'Tính chất' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 min-w-[280px] relative group">
                    <div className="flex items-center justify-between">
                      <span>Tên hàng hóa/Dịch vụ</span>
                      <button 
                        onClick={() => handleCopyColumn('tenHHDV', 'Tên HHDV')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'Tên HHDV' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-48 relative group">
                    <div className="flex items-center justify-between">
                      <span>Biển kiểm soát</span>
                      <button 
                        onClick={() => handleCopyColumn('bienKiemSoat', 'BKS')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'BKS' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 relative group">
                    <div className="flex items-center justify-between">
                      <span>ĐVT</span>
                      <button 
                        onClick={() => handleCopyColumn('dvt', 'ĐVT')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'ĐVT' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 text-center relative group">
                    <div className="flex items-center justify-between">
                      <span>Số lượng</span>
                      <button 
                        onClick={() => handleCopyColumn('soLuong', 'Số lượng')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'Số lượng' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-36 text-center relative group">
                    <div className="flex items-center justify-between">
                      <span>Đơn giá</span>
                      <button 
                        onClick={() => handleCopyColumn('donGia', 'Đơn giá')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title="Copy toàn bộ cột này"
                      >
                        {copiedColumn === 'Đơn giá' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-36 text-right">Thành tiền</th>
                  <th className="px-4 py-3 w-28 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 relative group">
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2 text-slate-600 font-medium">
                      <div className="flex items-center justify-between relative group/cell">
                        <span>{item.tinhChat}</span>
                        <button 
                          onClick={() => handleCopyCell(item.tinhChat, `${item.id}-tinhChat`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-tinhChat` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-between relative group/cell">
                        <input 
                          type="text" 
                          value={item.tenHHDV}
                          onChange={(e) => handleUpdateItem(item.id, 'tenHHDV', e.target.value)}
                          className="w-full mr-2 px-2 py-1 border border-slate-200 focus:border-indigo-500 focus:bg-white bg-transparent outline-none rounded-lg text-slate-700 font-medium text-sm"
                        />
                        <button 
                          onClick={() => handleCopyCell(item.tenHHDV, `${item.id}-tenHHDV`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded shrink-0"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-tenHHDV` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-between relative group/cell">
                        <input 
                          type="text" 
                          value={item.bienKiemSoat}
                          onChange={(e) => handleUpdateItem(item.id, 'bienKiemSoat', e.target.value)}
                          className="w-full mr-2 px-2 py-1 border border-slate-200 focus:border-indigo-500 focus:bg-white bg-transparent outline-none rounded-lg text-slate-700 font-bold"
                          placeholder="Số xe..."
                        />
                        <button 
                          onClick={() => handleCopyCell(item.bienKiemSoat, `${item.id}-bienKiemSoat`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded shrink-0"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-bienKiemSoat` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-between relative group/cell">
                        <input 
                          type="text" 
                          value={item.dvt}
                          onChange={(e) => handleUpdateItem(item.id, 'dvt', e.target.value)}
                          className="w-full mr-2 px-2 py-1 border border-slate-200 focus:border-indigo-500 focus:bg-white bg-transparent outline-none rounded-lg text-slate-600 font-medium"
                          placeholder="vỏ/chiếc..."
                        />
                        <button 
                          onClick={() => handleCopyCell(item.dvt, `${item.id}-dvt`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded shrink-0"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-dvt` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center font-bold">
                      <div className="flex items-center justify-between relative group/cell">
                        <input 
                          type="number" 
                          value={item.soLuong}
                          onChange={(e) => handleUpdateItem(item.id, 'soLuong', Number(e.target.value))}
                          className="w-full mr-2 px-2 py-1 border border-slate-200 focus:border-indigo-500 focus:bg-white bg-transparent outline-none rounded-lg text-center"
                          min="0"
                        />
                        <button 
                          onClick={() => handleCopyCell(String(item.soLuong), `${item.id}-soLuong`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded shrink-0"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-soLuong` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center font-bold">
                      <div className="flex items-center justify-between relative group/cell">
                        <input 
                          type="text" 
                          value={item.donGia > 0 ? new Intl.NumberFormat('en-US').format(item.donGia) : ''}
                          onChange={(e) => {
                            const val = Number(e.target.value.replace(/,/g, ''));
                            if(!isNaN(val)) handleUpdateItem(item.id, 'donGia', val);
                          }}
                          className="w-full mr-2 px-2 py-1 border border-slate-200 focus:border-indigo-500 focus:bg-white bg-transparent outline-none rounded-lg text-right font-bold text-slate-800"
                        />
                        <button 
                          onClick={() => handleCopyCell(String(item.donGia), `${item.id}-donGia`)}
                          className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-indigo-600 rounded shrink-0"
                          title="Copy ô này"
                        >
                          {copiedCellKey === `${item.id}-donGia` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-extrabold text-indigo-700">
                      {item.soLuong && item.donGia ? formatMoney(item.soLuong * item.donGia) : '0 ₫'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleCopyRow(item)}
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                          title="Copy toàn bộ dòng này dưới dạng Excel"
                        >
                          {copiedRowId === item.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => handleRemoveRow(item.id)}
                          className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                          title="Xóa dòng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm font-semibold text-slate-700">
            <span className="text-xs text-slate-400 font-medium">Bạn có thể tự do copy cột, copy ô hoặc dòng rây dạng để paste trực tiếp vào excel của AMIS nhanh nhất</span>
            <div className="flex items-center space-x-2">
              <span>Tổng cộng Thành tiền:</span>
              <span className="text-lg font-extrabold text-indigo-600">
                {formatMoney(items.reduce((s, it) => s + (it.soLuong * it.donGia), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
