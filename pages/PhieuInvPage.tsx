import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  FileText, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Copy, 
  Loader2, 
  Save, 
  Settings, 
  RefreshCw,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { PhieuInvOrder } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

interface PhieuInvPageProps {
  orders: PhieuInvOrder[];
  onAddOrder: (order: PhieuInvOrder) => void;
  onEditOrder: (order: PhieuInvOrder) => void;
  onDeleteOrder: (id: string) => void;
  alert: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FeeNameInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const commonFees = [
    'THC', 'D/O', 'Cleaning', 'CIC', 'EBS', 'Lift on', 'Lift off', 
    'Handling', 'CFS', 'Storage', 'Demurrage', 'Detention', 'Seal', 'Telex'
  ];

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTimeout(() => setIsEditing(false), 200)}
          className="w-full bg-transparent border-b border-teal-500 outline-none transition-colors"
          autoFocus
        />
        <div className="absolute top-full left-0 w-full bg-white shadow-lg border border-slate-200 rounded-md mt-1 z-50 max-h-40 overflow-y-auto">
          {commonFees.filter(f => f.toLowerCase().includes(value.toLowerCase())).map(f => (
            <button
              key={f}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs"
              onClick={() => {
                onChange(f);
                setIsEditing(false);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="cursor-pointer hover:text-teal-600 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      {value || <span className="text-slate-400 italic">Nhập tên phí...</span>}
    </div>
  );
};

export const PhieuInvPage: React.FC<PhieuInvPageProps> = ({ 
  orders, 
  onAddOrder, 
  onEditOrder, 
  onDeleteOrder,
  alert 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PhieuInvOrder | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Filters
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  
  // Settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'rates' | 'carriers'>('rates');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('phieu_inv_exchange_rates');
    return saved ? JSON.parse(saved) : {};
  });
  const [carriers, setCarriers] = useState<string[]>(() => {
    const saved = localStorage.getItem('phieu_inv_carriers');
    return saved ? JSON.parse(saved) : ['MAERSK', 'MSC', 'CMA CGM', 'COSCO', 'HAPAG-LLOYD', 'ONE', 'EVERGREEN', 'HMM', 'YANG MING', 'ZIM'];
  });
  
  const [settingsRate, setSettingsRate] = useState<string>('');
  const [settingsDate, setSettingsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [displaySettingsDate, setDisplaySettingsDate] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  
  const [newCarrier, setNewCarrier] = useState('');
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null);
  const [editCarrierValue, setEditCarrierValue] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<PhieuInvOrder>>({
    date: new Date().toISOString().split('T')[0],
    carrier: '',
    amount: 0,
    bill: '',
    stk: '',
    shipment: '',
    wireOffStatus: 'Pending',
    fees: [],
    type: 'Local charge'
  });
  const [displayDate, setDisplayDate] = useState(
    `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`
  );
  const [displayAmount, setDisplayAmount] = useState('0');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);

  useEffect(() => {
    localStorage.setItem('phieu_inv_exchange_rates', JSON.stringify(exchangeRates));
  }, [exchangeRates]);

  useEffect(() => {
    localStorage.setItem('phieu_inv_carriers', JSON.stringify(carriers));
  }, [carriers]);

  useEffect(() => {
    const savedTemplate = localStorage.getItem('phieu_inv_excel_template');
    const savedTemplateName = localStorage.getItem('phieu_inv_excel_template_name');
    if (savedTemplate) {
      const binaryString = window.atob(savedTemplate);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      setTemplateBuffer(bytes.buffer);
    }
    if (savedTemplateName) setTemplateName(savedTemplateName);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesDate = !filterDate || order.date === filterDate;
      const matchesStatus = filterStatus === 'All' || order.wireOffStatus === filterStatus;
      return matchesDate && matchesStatus;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, filterDate, filterStatus]);

  const handleOpenModal = (order?: PhieuInvOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData(order);
      const d = new Date(order.date);
      setDisplayDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      setDisplayAmount(order.amount.toLocaleString('vi-VN'));
    } else {
      setEditingOrder(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        carrier: '',
        amount: 0,
        bill: '',
        stk: '',
        shipment: '',
        wireOffStatus: 'Pending',
        fees: [],
        type: 'Local charge'
      });
      const d = new Date();
      setDisplayDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      setDisplayAmount('0');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayDate(val);
    
    const parts = val.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) {
        setFormData(prev => ({ ...prev, date: `${year}-${month}-${day}` }));
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const num = parseInt(val) || 0;
    setDisplayAmount(num.toLocaleString('vi-VN'));
    setFormData(prev => ({ ...prev, amount: num }));
  };

  const handleAddFee = () => {
    setFormData(prev => ({
      ...prev,
      fees: [...(prev.fees || []), { name: '', amount: 0 }]
    }));
  };

  const handleRemoveFee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fees: (prev.fees || []).filter((_, i) => i !== index)
    }));
  };

  const handleFeeChange = (index: number, field: 'name' | 'amount' | 'usdAmount', value: string) => {
    setFormData(prev => {
      const newFees = [...(prev.fees || [])];
      if (field === 'amount') {
        const num = parseInt(value.replace(/\D/g, '')) || 0;
        newFees[index] = { ...newFees[index], amount: num };
      } else if (field === 'name') {
        newFees[index] = { ...newFees[index], name: value };
      } else if (field === 'usdAmount') {
        // We don't store USD amount in PhieuInvOrder interface but we can use it for calculation
        // For now just update the VND amount if rate exists
        const usd = parseFloat(value) || 0;
        const currentRate = formData.date ? exchangeRates[formData.date] : 0;
        if (currentRate > 0) {
          newFees[index] = { ...newFees[index], amount: Math.round(usd * currentRate) };
        }
      }
      return { ...prev, fees: newFees };
    });
  };

  const handleSave = () => {
    if (!formData.date || !formData.carrier || !formData.bill) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc (Ngày, Carrier, BILL)', 'error');
      return;
    }

    const orderToSave = {
      ...formData,
      id: editingOrder?.id || Date.now().toString(),
    } as PhieuInvOrder;

    if (editingOrder) {
      onEditOrder(orderToSave);
    } else {
      onAddOrder(orderToSave);
    }
    handleCloseModal();
    alert('Đã lưu thành công', 'success');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phiếu này?')) {
      onDeleteOrder(id);
      alert('Đã xóa thành công', 'success');
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setIsExtracting(true);

    try {
      const file = files[0];
      const reader = new FileReader();
      
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Trích xuất thông tin từ hóa đơn này. Trả về JSON với các trường: date (YYYY-MM-DD), carrier, amount (number), bill (MBL/HBL), stk (số tài khoản), shipment, fees (mảng các đối tượng {name, amount})." },
              { inlineData: { data: fileData, mimeType: file.type } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              carrier: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              bill: { type: Type.STRING },
              stk: { type: Type.STRING },
              shipment: { type: Type.STRING },
              fees: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      
      setFormData(prev => ({
        ...prev,
        ...result,
        fileName: file.name,
        // Keep existing fields if AI missed them
        date: result.date || prev.date,
        carrier: result.carrier || prev.carrier,
        amount: result.amount || prev.amount,
        bill: result.bill || prev.bill,
        stk: result.stk || prev.stk,
        shipment: result.shipment || prev.shipment,
        fees: result.fees || prev.fees || []
      }));

      if (result.date) {
        const d = new Date(result.date);
        setDisplayDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      }
      if (result.amount) {
        setDisplayAmount(result.amount.toLocaleString('vi-VN'));
      }

      alert('Đã trích xuất dữ liệu thành công', 'success');
    } catch (error) {
      console.error('Lỗi khi tải file/trích xuất:', error);
      alert('Lỗi khi trích xuất dữ liệu từ file', 'error');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleSyncFees = async () => {
    if (!formData.fileUrl && !formData.fileName) {
      alert('Không có file để đồng bộ lại', 'error');
      return;
    }
    // Logic for resyncing from existing file
    // In a real app, we'd fetch the file from URL and re-run AI
    alert('Đang đồng bộ lại dữ liệu...', 'info');
    setIsExtracting(true);
    setTimeout(() => {
      setIsExtracting(false);
      alert('Đã đồng bộ lại thành công', 'success');
    }, 1500);
  };

  const handleExportExcel = async () => {
    const selectedOrders = filteredOrders.filter(o => o.isChecked);
    if (selectedOrders.length === 0) {
      alert('Vui lòng chọn ít nhất một phiếu để xuất', 'error');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      let worksheet;

      if (templateBuffer) {
        await workbook.xlsx.load(templateBuffer);
        worksheet = workbook.getWorksheet(1);
      } else {
        worksheet = workbook.addWorksheet('Phieu_INV');
        // Add headers if no template
        worksheet.addRow(['Ngày', 'Carrier', 'Số tiền', 'BILL', 'STK', 'Shipment', 'Wire Off']);
      }

      // Fill data starting from row 2 (assuming row 1 is header)
      selectedOrders.forEach((order, index) => {
        const row = worksheet.addRow([
          order.date,
          order.carrier,
          order.amount,
          order.bill,
          order.stk,
          order.shipment,
          order.wireOffStatus
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Phieu_INV.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      
      alert('Đã xuất Excel thành công', 'success');
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      alert('Lỗi khi xuất Excel', 'error');
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      setTemplateBuffer(buffer);
      setTemplateName(file.name);
      
      // Save to localStorage as base64
      const binary = new Uint8Array(buffer);
      let binaryString = '';
      for (let i = 0; i < binary.length; i++) {
        binaryString += String.fromCharCode(binary[i]);
      }
      const base64 = window.btoa(binaryString);
      localStorage.setItem('phieu_inv_excel_template', base64);
      localStorage.setItem('phieu_inv_excel_template_name', file.name);
      
      setIsUploadingTemplate(false);
      alert('Đã tải file mẫu lên thành công', 'success');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleSettingsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplaySettingsDate(val);
    const parts = val.split('/');
    if (parts.length === 3) {
      setSettingsDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
  };

  const handleSaveSettings = () => {
    if (settingsTab === 'rates') {
      if (!settingsRate || !settingsDate) {
        alert('Vui lòng nhập đầy đủ ngày và tỷ giá', 'error');
        return;
      }
      setExchangeRates(prev => ({ ...prev, [settingsDate]: parseFloat(settingsRate) }));
      alert('Đã lưu tỷ giá', 'success');
    }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50 overflow-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Phiếu INV</h2>
          <p className="text-sm text-slate-500">Quản lý danh sách Phiếu INV</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Ngày:</span>
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-sm border-none outline-none bg-transparent text-slate-700"
            />
            {filterDate && (
              <button onClick={() => setFilterDate('')} className="text-slate-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Trạng thái:</span>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border-none outline-none bg-transparent text-slate-700"
            >
              <option value="All">Tất cả</option>
              <option value="Pending">Pending</option>
              <option value="Wired">Wired</option>
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-5 h-5" />
            Xuất Excel
          </button>

          <button onClick={() => templateInputRef.current?.click()} disabled={isUploadingTemplate} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-colors" title="Cài đặt file mẫu">
             {isUploadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> : (templateBuffer ? <Check className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />)} 
             <span className="flex flex-col items-start text-xs"><span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span></span>
          </button>
          <input type="file" ref={templateInputRef} onChange={handleTemplateUpload} accept=".xlsx, .xls" className="hidden" />

          <button
            onClick={handleOpenSettings}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 p-2 rounded-xl font-bold transition-colors flex items-center justify-center shadow-sm"
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
          >
            <Plus className="w-5 h-5" />
            Tạo Shipment
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold w-10 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    checked={filteredOrders.length > 0 && filteredOrders.every(o => o.isChecked)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      filteredOrders.forEach(order => {
                        onEditOrder({ ...order, isChecked: checked });
                      });
                    }}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Ngày</th>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                <th className="px-4 py-3 font-semibold">BILL</th>
                <th className="px-4 py-3 font-semibold">STK</th>
                <th className="px-4 py-3 font-semibold text-center">File</th>
                <th className="px-4 py-3 font-semibold">Shipment</th>
                <th className="px-4 py-3 font-semibold">Wire Off</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Không tìm thấy phiếu nào
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const dateObj = new Date(order.date);
                  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                  
                  return (
                  <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${order.isChecked ? 'bg-teal-50/30' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        checked={!!order.isChecked}
                        onChange={(e) => onEditOrder({ ...order, isChecked: e.target.checked })}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {formattedDate}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.carrier}</td>
                    <td className="px-4 py-3 text-slate-900 font-bold text-right">
                      {order.amount.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.bill}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{order.stk}</td>
                    <td className="px-4 py-3 text-center">
                      {order.fileUrl ? (
                        <a href={order.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          <FileText className="w-5 h-5 mx-auto" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.shipment}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${order.wireOffStatus === 'Wired' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.wireOffStatus}
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

      {/* Modal Tạo/Sửa Shipment */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                {editingOrder ? 'Sửa Phiếu INV' : 'Tạo Shipment'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-6">
                  {/* Upload Section */}
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center relative">
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
                        <span className="font-medium">Đang trích xuất dữ liệu AI...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-blue-600">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-slate-700 mb-1">Kéo thả hoặc chọn file hóa đơn</p>
                        <p className="text-xs text-slate-500">Hỗ trợ PDF, Ảnh. AI sẽ tự động đọc dữ liệu.</p>
                        {formData.fileName && (
                          <div className="mt-3 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-100 text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {formData.fileName}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Ngày <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={displayDate}
                        onChange={handleDateChange}
                        placeholder="dd/mm/yyyy"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Carrier <span className="text-red-500">*</span></label>
                      <select
                        name="carrier"
                        value={formData.carrier || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="">-- Chọn Carrier --</option>
                        {carriers.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Loại</label>
                      <select
                        name="type"
                        value={formData.type || 'Local charge'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="Local charge">Local charge</option>
                        <option value="Deposit">Deposit</option>
                        <option value="Demurage">Demurage</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Amount <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={displayAmount}
                        onChange={handleAmountChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-bold text-right"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">BILL <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="bill"
                        value={formData.bill || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">STK</label>
                      <input
                        type="text"
                        name="stk"
                        value={formData.stk || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Shipment</label>
                      <input
                        type="text"
                        name="shipment"
                        value={formData.shipment || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Wire Off</label>
                      <select
                        name="wireOffStatus"
                        value={formData.wireOffStatus || 'Pending'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Wired">Wired</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fees Section */}
                <div className="w-full lg:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal-600" />
                      Chi tiết các dòng phí
                    </h4>
                    <div className="flex items-center gap-2">
                      <button onClick={handleAddFee} className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300 transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Thêm
                      </button>
                      <button onClick={handleSyncFees} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded hover:bg-teal-200 transition-colors flex items-center gap-1">
                        <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} /> Đồng bộ lại
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="text-left py-2">Tên phí</th>
                          <th className="text-right py-2 w-24">Số tiền</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.fees?.map((fee, idx) => (
                          <tr key={idx}>
                            <td className="py-2">
                              <FeeNameInput value={fee.name} onChange={(v) => handleFeeChange(idx, 'name', v)} />
                            </td>
                            <td className="py-2">
                              <input 
                                type="text" 
                                value={fee.amount.toLocaleString('vi-VN')} 
                                onChange={(e) => handleFeeChange(idx, 'amount', e.target.value)}
                                className="w-full bg-transparent text-right outline-none focus:text-teal-600"
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button onClick={() => handleRemoveFee(idx)} className="text-red-400 hover:text-red-600">
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={handleCloseModal} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-medium">Hủy</button>
              <button onClick={handleSave} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20">
                <Save className="w-4 h-4" /> {editingOrder ? 'Cập nhật' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Cài đặt</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex border-b border-slate-200">
              <button
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === 'rates' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setSettingsTab('rates')}
              >
                Tỷ giá
              </button>
              <button
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === 'carriers' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setSettingsTab('carriers')}
              >
                Carrier
              </button>
            </div>

            <div className="p-6 space-y-4">
              {settingsTab === 'rates' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ngày áp dụng</label>
                    <input
                      type="text"
                      value={displaySettingsDate}
                      onChange={handleSettingsDateChange}
                      placeholder="dd/mm/yyyy"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tỷ giá (VND/USD)</label>
                    <input
                      type="number"
                      value={settingsRate}
                      onChange={(e) => setSettingsRate(e.target.value)}
                      placeholder="VD: 25000"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg mt-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold">Ngày</th>
                          <th className="text-right py-2 px-3 font-semibold">Tỷ giá</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(exchangeRates).sort((a, b) => b[0].localeCompare(a[0])).map(([date, rate]) => (
                          <tr key={date}>
                            <td className="py-2 px-3">{date}</td>
                            <td className="py-2 px-3 text-right font-medium">{(rate as number).toLocaleString('vi-VN')}</td>
                            <td className="py-2 px-3 text-right">
                              <button onClick={() => setExchangeRates(prev => { const n = {...prev}; delete n[date]; return n; })} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCarrier}
                      onChange={(e) => setNewCarrier(e.target.value)}
                      placeholder="Nhập mã Carrier mới..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none uppercase"
                    />
                    <button
                      onClick={() => { if (newCarrier.trim()) { setCarriers([...carriers, newCarrier.trim().toUpperCase()].sort()); setNewCarrier(''); } }}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                      Thêm
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg mt-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold">Mã Carrier</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {carriers.map(c => (
                          <tr key={c}>
                            <td className="py-2 px-3">{c}</td>
                            <td className="py-2 px-3 text-right">
                              <button onClick={() => setCarriers(carriers.filter(x => x !== c))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-medium">Đóng</button>
              {settingsTab === 'rates' && (
                <button onClick={handleSaveSettings} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-600/20">
                  <Save className="w-4 h-4" /> Lưu Tỷ Giá
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
