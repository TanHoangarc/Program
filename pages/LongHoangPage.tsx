import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Upload, Loader2, X, Save, Copy, Check } from 'lucide-react';
import { LongHoangOrder } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

const BACKEND_URL = "https://api.kimberry.id.vn";

interface LongHoangPageProps {
  orders: LongHoangOrder[];
  onAddOrder: (order: LongHoangOrder) => void;
  onEditOrder: (order: LongHoangOrder) => void;
  onDeleteOrder: (id: string) => void;
}

export const LongHoangPage: React.FC<LongHoangPageProps> = ({ orders, onAddOrder, onEditOrder, onDeleteOrder }) => {
  const { alert, confirm } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<LongHoangOrder | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<LongHoangOrder>>({});
  const [displayDate, setDisplayDate] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = (order?: LongHoangOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData(order);
      
      if (order.paymentDate) {
        const parts = order.paymentDate.split('-');
        if (parts.length === 3) {
          setDisplayDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
        } else {
          setDisplayDate(order.paymentDate);
        }
      }
      setDisplayAmount(order.amount ? order.amount.toLocaleString('vi-VN') : '');
    } else {
      setEditingOrder(null);
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      
      setFormData({
        paymentDate: `${yyyy}-${mm}-${dd}`,
        line: '',
        amount: 0,
        mbl: '',
        accountNumber: '',
        wireOffStatus: 'Pending'
      });
      setDisplayDate(`${dd}/${mm}/${yyyy}`);
      setDisplayAmount('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData({});
    setDisplayDate('');
    setDisplayAmount('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = value;
    if (value.length >= 3 && value.length <= 4) {
      formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
    } else if (value.length >= 5) {
      formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    }
    
    setDisplayDate(formatted);
    
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        setFormData(prev => ({ ...prev, paymentDate: `${parts[2]}-${parts[1]}-${parts[0]}` }));
      }
    } else {
      setFormData(prev => ({ ...prev, paymentDate: '' }));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue) {
      const num = parseInt(rawValue, 10);
      setDisplayAmount(num.toLocaleString('vi-VN'));
      setFormData(prev => ({ ...prev, amount: num }));
    } else {
      setDisplayAmount('');
      setFormData(prev => ({ ...prev, amount: 0 }));
    }
  };

  const handleSave = () => {
    if (!formData.paymentDate || !formData.line || !formData.mbl || !formData.accountNumber) {
      alert('Vui lòng điền đầy đủ thông tin (Ngày, Line, MBL, Số tài khoản)', 'Lỗi');
      return;
    }

    if (editingOrder) {
      onEditOrder(formData as LongHoangOrder);
      alert('Đã cập nhật lệnh thanh toán', 'Thành công');
    } else {
      onAddOrder({
        ...formData,
        id: `lh-${Date.now()}`
      } as LongHoangOrder);
      alert('Đã tạo lệnh thanh toán mới', 'Thành công');
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Bạn có chắc chắn muốn xóa lệnh thanh toán này?', 'Xác nhận xóa')) {
      onDeleteOrder(id);
      alert('Đã xóa lệnh thanh toán', 'Thành công');
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setIsExtracting(true);

    try {
      // 1. Upload file to server
      const uploadFormData = new FormData();
      uploadFormData.append("fileName", `LH_INV_${Date.now()}_${file.name}`);
      uploadFormData.append("folderPath", "LH");
      uploadFormData.append("file", file);

      const res = await axios.post(`${BACKEND_URL}/upload-file`, uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      let uploadedUrl = '';
      if (res.data && res.data.success) {
        uploadedUrl = res.data.url;
        if (uploadedUrl && !uploadedUrl.startsWith('http')) {
            uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
        }
        setFormData(prev => ({
          ...prev,
          invoiceFileUrl: uploadedUrl,
          invoiceFileName: res.data.fileName || file.name
        }));
      }

      // 2. Extract data using Gemini
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64String = base64data.split(',')[1];
        
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64String
                  }
                },
                {
                  text: `Extract the following information from this invoice file and return it in JSON format:
                  - line: The shipping line or company name (string)
                  - amount: The total amount to be paid (number, remove commas or currency symbols)
                  - mbl: The Master Bill of Lading number (string)
                  - accountNumber: The bank account number for payment (string)
                  
                  Return ONLY a valid JSON object with these exact keys.`
                }
              ]
            },
            config: {
              responseMimeType: "application/json"
            }
          });

          if (response.text) {
            try {
              const extractedData = JSON.parse(response.text);
              setFormData(prev => ({
                ...prev,
                line: extractedData.line || prev.line,
                amount: extractedData.amount || prev.amount,
                mbl: extractedData.mbl || prev.mbl,
                accountNumber: extractedData.accountNumber || prev.accountNumber
              }));
              if (extractedData.amount) {
                setDisplayAmount(Number(extractedData.amount).toLocaleString('vi-VN'));
              }
              alert('Đã trích xuất dữ liệu thành công', 'Thành công');
            } catch (parseError) {
              console.error('Failed to parse Gemini response:', parseError);
              alert('Không thể đọc dữ liệu từ file. Vui lòng nhập thủ công.', 'Cảnh báo');
            }
          }
        } catch (aiError) {
          console.error('Gemini API error:', aiError);
          alert('Lỗi khi gọi AI trích xuất dữ liệu. Vui lòng nhập thủ công.', 'Cảnh báo');
        } finally {
          setIsExtracting(false);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);

    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Lỗi khi tải file lên server.', 'Lỗi');
      setIsExtracting(false);
      setIsUploading(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Trang Long Hoàng</h2>
          <p className="text-sm text-slate-500">Quản lý lệnh thanh toán Long Hoàng</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
        >
          <Plus className="w-5 h-5" />
          Tạo Lệnh
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold">Ngày thanh toán</th>
                <th className="px-4 py-3 font-semibold">Line</th>
                <th className="px-4 py-3 font-semibold text-right">Số tiền</th>
                <th className="px-4 py-3 font-semibold">MBL</th>
                <th className="px-4 py-3 font-semibold">Số tài khoản</th>
                <th className="px-4 py-3 font-semibold">File Inv</th>
                <th className="px-4 py-3 font-semibold">Note</th>
                <th className="px-4 py-3 font-semibold">Wire Off</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Chưa có lệnh thanh toán nào
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const dateObj = new Date(order.paymentDate);
                  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                  
                  return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {formattedDate}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.line}</td>
                    <td className="px-4 py-3 text-slate-900 font-bold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{order.amount.toLocaleString('vi-VN')}</span>
                        <button
                          onClick={() => handleCopy(order.amount.toString(), `${order.id}-amount`)}
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                          title="Copy số tiền"
                        >
                          {copiedKey === `${order.id}-amount` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{order.mbl}</span>
                        <button
                          onClick={() => handleCopy(`LONG HOANG PAYMENT BL ${order.mbl} MST 0316113070`, `${order.id}-mbl`)}
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                          title="Copy nội dung MBL"
                        >
                          {copiedKey === `${order.id}-mbl` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{order.accountNumber}</span>
                        {order.accountNumber && (
                          <button
                            onClick={() => handleCopy(order.accountNumber, `${order.id}-account`)}
                            className="text-slate-400 hover:text-teal-600 transition-colors"
                            title="Copy số tài khoản"
                          >
                            {copiedKey === `${order.id}-account` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {order.invoiceFileUrl ? (
                        <a 
                          href={order.invoiceFileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          title={order.invoiceFileName || 'Xem file'}
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Trống</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{order.note}</span>
                        {order.note && (
                          <button
                            onClick={() => handleCopy(order.note, `${order.id}-note`)}
                            className="text-slate-400 hover:text-teal-600 transition-colors"
                            title="Copy ghi chú"
                          >
                            {copiedKey === `${order.id}-note` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${order.wireOffStatus === 'Wired Off' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.wireOffStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(order)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo/Sửa Lệnh */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                {editingOrder ? 'Sửa Lệnh Thanh Toán' : 'Tạo Lệnh Thanh Toán Mới'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Upload Section */}
              <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center relative">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,image/*"
                  disabled={isUploading}
                />
                
                {isExtracting ? (
                  <div className="flex flex-col items-center gap-3 text-indigo-600">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="font-medium">Đang đọc dữ liệu từ file bằng AI...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-blue-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700 mb-1">Tải lên file hóa đơn (PDF, Ảnh)</p>
                    <p className="text-sm text-slate-500 mb-3">Hệ thống sẽ tự động đọc dữ liệu và điền vào form bên dưới</p>
                    
                    {formData.invoiceFileName && (
                      <div className="flex items-center gap-2 text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium truncate max-w-[200px]">{formData.invoiceFileName}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ngày thanh toán <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="paymentDate"
                    value={displayDate}
                    onChange={handleDateChange}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Line <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="line"
                    value={formData.line || ''}
                    onChange={handleChange}
                    placeholder="VD: MSC, ONE..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Số tiền <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="amount"
                    value={displayAmount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">MBL <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="mbl"
                    value={formData.mbl || ''}
                    onChange={handleChange}
                    placeholder="Master Bill of Lading"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Số tài khoản <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber || ''}
                    onChange={handleChange}
                    placeholder="Số tài khoản ngân hàng"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Note</label>
                  <input
                    type="text"
                    name="note"
                    value={formData.note || ''}
                    onChange={handleChange}
                    placeholder="Ghi chú thêm..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Wire Off</label>
                  <select
                    name="wireOffStatus"
                    value={formData.wireOffStatus || 'Pending'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Wired Off">Wired Off</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={isExtracting || isUploading}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
              >
                <Save className="w-4 h-4" />
                {editingOrder ? 'Cập nhật' : 'Lưu Lệnh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
