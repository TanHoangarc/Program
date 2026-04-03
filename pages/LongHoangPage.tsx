import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Upload, Download, Loader2, X, Save, Copy, Check, Settings, RefreshCw, Lock, Unlock } from 'lucide-react';
import { LongHoangOrder } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { GoogleGenAI, Type } from '@google/genai';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { formatDateVN } from '../utils';

const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Invoice";
const TEMPLATE_MAP: Record<string, string> = {
  chi: "Phieu_chi_Mau.xlsx"
};
const GLOBAL_TEMPLATE_CACHE: Record<string, { buffer: ArrayBuffer, name: string }> = {};

interface LongHoangPageProps {
  orders: LongHoangOrder[];
  onAddOrder: (order: LongHoangOrder) => void;
  onEditOrder: (order: LongHoangOrder) => void;
  onDeleteOrder: (id: string) => void;
  onRestoreOrders: (orders: LongHoangOrder[]) => void;
}

const FEE_OPTIONS = ["OF", "EXW", "THC", "DO", "CIC", "CLN", "CFS", "BAF", "EMC", "PCS", "LSS", "DEM"];

const FeeNameInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center border-b border-transparent hover:border-slate-300 focus-within:border-teal-500 transition-colors">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Tên phí"
          className="w-full bg-transparent outline-none py-1"
        />
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {FEE_OPTIONS.map(opt => (
            <div
              key={opt}
              className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const LongHoangPage: React.FC<LongHoangPageProps> = ({ orders, onAddOrder, onEditOrder, onDeleteOrder, onRestoreOrders }) => {
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
  const templateInputRef = useRef<HTMLInputElement>(null);

  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);

  const currentTemplateFileName = TEMPLATE_MAP['chi'];

  useEffect(() => {
    const loadTemplate = async () => {
        if (GLOBAL_TEMPLATE_CACHE['chi']) {
            setTemplateBuffer(GLOBAL_TEMPLATE_CACHE['chi'].buffer);
            setTemplateName(GLOBAL_TEMPLATE_CACHE['chi'].name);
            return;
        }
        setIsLoadingTemplate(true);
        setTemplateBuffer(null); 
        setTemplateName('');
        try {
            const staticUrl = `${BACKEND_URL}/uploads/${TEMPLATE_FOLDER}/${currentTemplateFileName}?v=${Date.now()}`;
            const response = await axios.get(staticUrl, { responseType: 'arraybuffer' });
            if (response.status === 200 && response.data) {
                const buffer = response.data;
                const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
                GLOBAL_TEMPLATE_CACHE['chi'] = { buffer, name: `${displayName} (Server)` };
                setTemplateBuffer(buffer);
                setTemplateName(`${displayName} (Server)`);
            }
        } catch (error) {
            console.log(`Chưa có file mẫu ${currentTemplateFileName} trên server.`);
        } finally {
            setIsLoadingTemplate(false);
        }
    };
    loadTemplate();
  }, [currentTemplateFileName]);

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingTemplate(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (evt.target?.result) {
          const buffer = evt.target.result as ArrayBuffer;
          const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
          const statusName = `${displayName} (Mới cập nhật)`;
          setTemplateBuffer(buffer);
          setTemplateName(statusName);
          GLOBAL_TEMPLATE_CACHE['chi'] = { buffer, name: statusName };
          try {
              const formData = new FormData();
              formData.append("folderPath", TEMPLATE_FOLDER);
              formData.append("fileName", currentTemplateFileName);
              formData.append("file", file);
              await axios.post(`${BACKEND_URL}/upload-file`, formData);
              alert(`Đã lưu mẫu "${displayName}" thành công!`, "Thành công");
          } catch (err) {
              console.error("Lỗi upload mẫu:", err);
              alert("Lưu mẫu lên server thất bại, nhưng sẽ dùng mẫu này tạm thời.", "Cảnh báo");
          } finally {
              setIsUploadingTemplate(false);
              if (templateInputRef.current) templateInputRef.current.value = '';
          }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  });
  const [filterStatus, setFilterStatus] = useState('All');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'rates' | 'carriers'>('rates');
  const [settingsDate, setSettingsDate] = useState('');
  const [displaySettingsDate, setDisplaySettingsDate] = useState('');
  const [settingsRate, setSettingsRate] = useState('');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lh_exchange_rates');
    return saved ? JSON.parse(saved) : {};
  });
  const [carriers, setCarriers] = useState<string[]>(() => {
    const saved = localStorage.getItem('lh_carriers');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.sort((a: string, b: string) => a.localeCompare(b)) : [];
  });
  const [newCarrier, setNewCarrier] = useState('');
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null);
  const [editCarrierValue, setEditCarrierValue] = useState('');

  useEffect(() => {
    localStorage.setItem('lh_exchange_rates', JSON.stringify(exchangeRates));
  }, [exchangeRates]);

  useEffect(() => {
    localStorage.setItem('lh_carriers', JSON.stringify(carriers));
  }, [carriers]);

  const handleOpenSettings = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    setSettingsDate(todayStr);
    setDisplaySettingsDate(`${dd}/${mm}/${yyyy}`);
    setSettingsRate(exchangeRates[todayStr] ? exchangeRates[todayStr].toString() : '');
    setIsSettingsModalOpen(true);
  };

  const handleSettingsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = value;
    if (value.length >= 3 && value.length <= 4) {
      formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
    } else if (value.length >= 5) {
      formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    }
    
    setDisplaySettingsDate(formatted);
    
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        setSettingsDate(dateStr);
        setSettingsRate(exchangeRates[dateStr] ? exchangeRates[dateStr].toString() : '');
      }
    } else {
      setSettingsDate('');
      setSettingsRate('');
    }
  };

  const handleSaveSettings = () => {
    if (!settingsDate || !settingsRate) {
      alert('Vui lòng nhập đầy đủ ngày và tỷ giá', 'Lỗi');
      return;
    }
    setExchangeRates(prev => ({
      ...prev,
      [settingsDate]: Number(settingsRate)
    }));
    setIsSettingsModalOpen(false);
    alert('Đã lưu tỷ giá', 'Thành công');
  };

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
        wireOffStatus: 'Pending',
        fees: [],
        paymentType: 'Local charge'
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
      onEditOrder({
        ...formData,
        paymentType: formData.paymentType || 'Local charge'
      } as LongHoangOrder);
      alert('Đã cập nhật lệnh thanh toán', 'Thành công');
    } else {
      onAddOrder({
        ...formData,
        paymentType: formData.paymentType || 'Local charge',
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setIsExtracting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let allFees: { name: string; amount: number }[] = formData.fees ? [...formData.fees] : [];
      let totalAmount = formData.amount || 0;
      let uploadedUrls: string[] = formData.invoiceFileUrl ? formData.invoiceFileUrl.split(',').filter(Boolean) : [];
      let uploadedNames: string[] = formData.invoiceFileName ? formData.invoiceFileName.split(',').filter(Boolean) : [];
      
      let extractedLine = formData.line || '';
      let extractedMbl = formData.mbl || '';
      let extractedAccountNumber = formData.accountNumber || '';

      for (const file of files as File[]) {
        // 1. Upload file to server
        const uploadFormData = new FormData();
        uploadFormData.append("fileName", `LH_INV_${Date.now()}_${file.name}`);
        uploadFormData.append("folderPath", "LH");
        uploadFormData.append("file", file);

        try {
          const res = await axios.post(`${BACKEND_URL}/upload-file`, uploadFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          let uploadedUrl = '';
          if (res.data && res.data.success) {
            uploadedUrl = res.data.url;
            if (uploadedUrl && !uploadedUrl.startsWith('http')) {
                uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
            }
            uploadedUrls.push(uploadedUrl);
            uploadedNames.push(res.data.fileName || file.name);
          }
        } catch (uploadError) {
          console.error('Upload error for file', file.name, ':', uploadError);
          continue;
        }

        // 2. Extract data using Gemini
        const base64String = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });

        try {
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
                  - amount: The total amount to be paid INCLUDING VAT (số tiền tổng đã bao gồm VAT) (number, remove commas or currency symbols)
                  - mbl: The Master Bill of Lading number (string)
                  - accountNumber: The bank account number for payment (string)
                  - fees: An array of objects representing the detailed fees and their amounts BEFORE VAT (số tiền trước thuế). Each object should have 'name' (string) and 'amount' (number, before VAT).
                  
                  Return ONLY a valid JSON object with these exact keys. If a value is not found, return an empty string for strings, 0 for numbers, and an empty array for arrays.`
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  line: { type: Type.STRING, description: "The shipping line or company name. Empty string if not found." },
                  amount: { type: Type.NUMBER, description: "The total amount to be paid INCLUDING VAT. 0 if not found." },
                  mbl: { type: Type.STRING, description: "The Master Bill of Lading number. Empty string if not found." },
                  accountNumber: { type: Type.STRING, description: "The bank account number for payment. Empty string if not found." },
                  fees: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Fee name" },
                        amount: { type: Type.NUMBER, description: "Fee amount before VAT" }
                      }
                    },
                    description: "Detailed fees and their amounts BEFORE VAT. Empty array if not found."
                  }
                }
              }
            }
          });

          if (response.text) {
            try {
              const extractedData = JSON.parse(response.text);
              if (extractedData.line && !extractedLine) extractedLine = extractedData.line;
              if (extractedData.mbl && !extractedMbl) extractedMbl = extractedData.mbl;
              if (extractedData.accountNumber && !extractedAccountNumber) extractedAccountNumber = extractedData.accountNumber;
              
              if (extractedData.fees && Array.isArray(extractedData.fees)) {
                const processedFees = extractedData.fees.map((f: any) => ({
                  name: f.name || '',
                  amount: typeof f.amount === 'string' ? parseInt(f.amount.replace(/\D/g, ''), 10) || 0 : Number(f.amount) || 0
                }));
                allFees = [...allFees, ...processedFees];
              }
              if (extractedData.amount) {
                const amt = typeof extractedData.amount === 'string' 
                  ? parseInt(extractedData.amount.replace(/\D/g, ''), 10) || 0 
                  : Number(extractedData.amount) || 0;
                totalAmount += amt;
              }
            } catch (parseError) {
              console.error('Failed to parse Gemini response for file', file.name, ':', parseError);
            }
          }
        } catch (aiError) {
          console.error('Gemini API error for file', file.name, ':', aiError);
        }
      }

      setFormData(prev => ({
        ...prev,
        invoiceFileUrl: uploadedUrls.join(','),
        invoiceFileName: uploadedNames.join(','),
        line: extractedLine,
        mbl: extractedMbl,
        accountNumber: extractedAccountNumber,
        amount: totalAmount,
        fees: allFees
      }));
      setDisplayAmount(totalAmount.toLocaleString('vi-VN'));
      alert('Đã xử lý xong các file hóa đơn', 'Thành công');

    } catch (error) {
      console.error('Process error:', error);
      alert('Lỗi trong quá trình xử lý file.', 'Lỗi');
    } finally {
      setIsExtracting(false);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSyncFees = async () => {
    if (!formData.invoiceFileUrl) {
      alert('Không tìm thấy file hóa đơn để đồng bộ.', 'Lỗi');
      return;
    }

    setIsExtracting(true);
    try {
      const urls = formData.invoiceFileUrl.split(',').filter(Boolean);
      let allFees: { name: string; amount: number }[] = [];
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      for (const url of urls) {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          
          const base64String = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              resolve(base64data.split(',')[1]);
            };
            reader.readAsDataURL(blob);
          });
          
          const aiResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64String,
                    mimeType: blob.type || 'application/pdf'
                  }
                },
                {
                  text: `Extract the following information from this invoice file and return it in JSON format:
                  - fees: An array of objects representing the detailed fees and their amounts BEFORE VAT (số tiền trước thuế). Each object should have 'name' (string) and 'amount' (number, before VAT).
                  
                  Return ONLY a valid JSON object with these exact keys. If no fees are found, return an empty array.`
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  fees: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Fee name" },
                        amount: { type: Type.NUMBER, description: "Fee amount before VAT" }
                      }
                    },
                    description: "Detailed fees and their amounts BEFORE VAT. Empty array if not found."
                  }
                }
              }
            }
          });

          if (aiResponse.text) {
            try {
              const extractedData = JSON.parse(aiResponse.text);
              if (extractedData.fees && Array.isArray(extractedData.fees)) {
                const processedFees = extractedData.fees.map((f: any) => ({
                  name: f.name || '',
                  amount: typeof f.amount === 'string' ? parseInt(f.amount.replace(/\D/g, ''), 10) || 0 : Number(f.amount) || 0
                }));
                allFees = [...allFees, ...processedFees];
              }
            } catch (parseError) {
              console.error('Failed to parse Gemini response for URL', url, ':', parseError);
            }
          }
        } catch (error) {
          console.error('Error processing URL', url, ':', error);
        }
      }

      setFormData(prev => ({
        ...prev,
        fees: allFees.length > 0 ? allFees : prev.fees
      }));
      alert('Đã đồng bộ chi tiết phí thành công', 'Thành công');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Lỗi khi đồng bộ dữ liệu.', 'Lỗi');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFeeChange = (idx: number, field: 'name' | 'amount' | 'usdAmount', value: string) => {
    const currentRate = formData.paymentDate ? exchangeRates[formData.paymentDate] : 0;
    
    setFormData(prev => {
      if (!prev.fees) return prev;
      const newFees = [...prev.fees];
      
      if (field === 'name') {
        newFees[idx].name = value;
      } else if (field === 'amount') {
        const numValue = parseInt(value.replace(/\D/g, ""), 10) || 0;
        newFees[idx].amount = numValue;
        if (currentRate > 0) {
          newFees[idx].usdAmount = numValue / currentRate;
        } else {
          newFees[idx].usdAmount = '';
        }
      } else if (field === 'usdAmount') {
        const cleanValue = value.replace(/[^0-9.-]+/g, "");
        newFees[idx].usdAmount = cleanValue;
        
        const numValue = Number(cleanValue);
        if (!isNaN(numValue) && currentRate > 0) {
          newFees[idx].amount = Math.round(numValue * currentRate);
        }
      }
      
      return {
        ...prev,
        fees: newFees
      };
    });
  };

  const handleAddFee = () => {
    setFormData(prev => ({
      ...prev,
      fees: [...(prev.fees || []), { name: '', amount: 0, usdAmount: 0 }]
    }));
  };

  const handleRemoveFee = (idx: number) => {
    setFormData(prev => {
      if (!prev.fees) return prev;
      const newFees = [...prev.fees];
      newFees.splice(idx, 1);
      
      return {
        ...prev,
        fees: newFees
      };
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchDate = filterDate ? order.paymentDate === filterDate : true;
    const status = order.wireOffStatus || 'Pending';
    const matchStatus = filterStatus === 'All' ? true : status === filterStatus;
    return matchDate && matchStatus;
  });

  const handleBackup = async () => {
    try {
      const response = await axios.post('/api/long-hoang/backup', { orders });
      if (response.data.success) {
        alert("Đã lưu dữ liệu backup lên server (E:\\ServerData\\lhoang.json) thành công", "Thành công");
      } else {
        alert("Lỗi khi lưu dữ liệu backup", "Lỗi");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi khi kết nối đến server", "Lỗi");
    }
  };

  const handleRestore = async () => {
    try {
      const response = await axios.get('/api/long-hoang/restore');
      if (response.data.success && Array.isArray(response.data.orders)) {
        onRestoreOrders(response.data.orders);
        alert("Đã khôi phục dữ liệu từ server (E:\\ServerData\\lhoang.json) thành công", "Thành công");
      } else {
        alert("Dữ liệu backup không hợp lệ", "Lỗi");
      }
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        alert("Không tìm thấy file backup trên server", "Lỗi");
      } else {
        alert("Lỗi khi đọc file backup từ server", "Lỗi");
      }
    }
  };

  const handleExportExcel = async () => {
    const selectedOrders = filteredOrders.filter(o => o.isChecked);
    if (selectedOrders.length === 0) {
      alert('Vui lòng chọn ít nhất một dòng để xuất Excel', 'error');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      if (templateBuffer) {
        await workbook.xlsx.load(templateBuffer);
      } else {
        workbook.addWorksheet("Long Hoang Export");
      }
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return;
      
      const START_ROW = 9;
      const styleRow = templateBuffer ? worksheet.getRow(START_ROW) : null;
      
      selectedOrders.forEach((order, index) => {
          const currentRowIndex = START_ROW + index;
          const row = worksheet.getRow(currentRowIndex);
          if (styleRow && currentRowIndex > START_ROW) {
               for(let i = 1; i <= styleRow.cellCount; i++) {
                   const sourceCell = styleRow.getCell(i);
                   const targetCell = row.getCell(i);
                   targetCell.style = sourceCell.style;
                   if (sourceCell.border) targetCell.border = sourceCell.border;
                   if (sourceCell.fill) targetCell.fill = sourceCell.fill;
                   if (sourceCell.font) targetCell.font = sourceCell.font;
                   if (sourceCell.alignment) targetCell.alignment = sourceCell.alignment;
               }
               row.height = styleRow.height;
          }
          
          const desc = order.note ? `Chi tiền cho ncc lô ${order.note} BILL ${order.mbl}` : `Chi tiền BILL ${order.mbl}`;
          
          row.getCell(1).value = "Ủy nhiệm chi"; 
          row.getCell(2).value = formatDateVN(order.paymentDate); 
          row.getCell(3).value = formatDateVN(order.paymentDate); 
          row.getCell(4).value = ""; // docNo
          row.getCell(5).value = "Chi khác"; 
          row.getCell(6).value = desc; 
          row.getCell(7).value = "19135447033015"; 
          row.getCell(8).value = "Ngân hàng TMCP Kỹ thương Việt Nam - Gia Định"; 
          row.getCell(9).value = order.line; 
          row.getCell(10).value = order.line; 
          row.getCell(19).value = "VND"; 
          row.getCell(21).value = desc; 
          row.getCell(22).value = "3311"; 
          row.getCell(23).value = "1121"; 
          row.getCell(24).value = order.amount; 
          row.getCell(26).value = order.line;
          row.commit();
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = "Phieu_chi_LH_Export.xlsx";
      
      try {
          const formData = new FormData();
          const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          formData.append("file", blob, fileName); 
          formData.append("targetDir", "E:\\ServerData");
          const response = await axios.post(`${BACKEND_URL}/save-excel`, formData, { headers: { "Content-Type": "multipart/form-data" } });
          if (response.data?.success) {
              alert(`Đã xuất và lưu file "${fileName}" vào E:\\ServerData thành công!`, "Thành công");
          } else {
              throw new Error(response.data?.message || "Server did not confirm save.");
          }
      } catch (err) {
          console.warn("Không thể lưu trực tiếp vào Server. Đang tải xuống máy...", err);
          const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement("a"); 
          anchor.href = url; 
          anchor.download = fileName; 
          anchor.click(); 
          window.URL.revokeObjectURL(url);
      }
      
      // Update isLocked status for exported orders
      selectedOrders.forEach(order => {
        if (!order.isLocked) {
          onEditOrder({ ...order, isLocked: true, isChecked: false });
        } else {
          onEditOrder({ ...order, isChecked: false });
        }
      });
      
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      alert('Lỗi khi xuất Excel', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Trang Long Hoàng</h2>
          <p className="text-sm text-slate-500">Quản lý lệnh thanh toán Long Hoàng</p>
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
              <option value="Wired Off">Wired Off</option>
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-5 h-5" />
            Xuất Excel
          </button>

          <button onClick={() => templateInputRef.current?.click()} disabled={isUploadingTemplate} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-colors" title="Tải file mẫu từ máy tính lên server">
             {isUploadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> : (templateBuffer ? <Check className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />)} 
             <span className="flex flex-col items-start text-xs"><span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>{templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}</span>
          </button>

          <button onClick={handleBackup} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm">
            <Download className="w-5 h-5" />
            Backup
          </button>
          
          <button onClick={handleRestore} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm">
            <Upload className="w-5 h-5" />
            Restore
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
            Tạo Lệnh
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
                    checked={filteredOrders.length > 0 && filteredOrders.filter(o => !o.isLocked).length > 0 && filteredOrders.filter(o => !o.isLocked).every(o => o.isChecked)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      filteredOrders.forEach(order => {
                        if (!order.isLocked && !!order.isChecked !== checked) {
                          onEditOrder({ ...order, isChecked: checked });
                        }
                      });
                    }}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Ngày thanh toán</th>
                <th className="px-4 py-3 font-semibold">Line</th>
                <th className="px-4 py-3 font-semibold text-right">Số tiền (đã gồm VAT)</th>
                <th className="px-4 py-3 font-semibold w-32">MBL</th>
                <th className="px-4 py-3 font-semibold">Số tài khoản</th>
                <th className="px-4 py-3 font-semibold">File Inv</th>
                <th className="px-4 py-3 font-semibold">Note</th>
                <th className="px-4 py-3 font-semibold">Wire Off</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Thao tác</th>
                <th className="px-4 py-3 font-semibold text-center w-24">Màu sắc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Không tìm thấy lệnh thanh toán nào
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const dateObj = new Date(order.paymentDate);
                  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                  
                  return (
                  <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${order.isChecked ? 'bg-teal-50/30' : ''} ${order.color === 'blue' ? 'bg-blue-50' : order.color === 'orange' ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        className={`rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${order.isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        checked={!!order.isChecked}
                        onChange={(e) => !order.isLocked && onEditOrder({ ...order, isChecked: e.target.checked })}
                        disabled={order.isLocked}
                      />
                    </td>
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
                          onClick={() => {
                            const type = order.paymentType || 'Local charge';
                            let copyText = `LONG HOANG PAYMENT BL ${order.mbl} MST 0316113070`;
                            if (type === 'Deposit') copyText = `LONG HOANG PAYMENT CUOC BL ${order.mbl} MST 0316113070`;
                            if (type === 'Demurage') copyText = `LONG HOANG PAYMENT GH BL ${order.mbl} MST 0316113070`;
                            handleCopy(copyText, `${order.id}-mbl`);
                          }}
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
                          onClick={() => onEditOrder({ ...order, isLocked: !order.isLocked })}
                          className={`p-1.5 rounded-lg transition-colors ${order.isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                          title={order.isLocked ? "Mở khóa" : "Khóa"}
                        >
                          {order.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleOpenModal(order)}
                          disabled={order.isLocked}
                          className={`p-1.5 rounded-lg transition-colors ${order.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          disabled={order.isLocked}
                          className={`p-1.5 rounded-lg transition-colors ${order.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEditOrder({ ...order, color: order.color === 'blue' ? null : 'blue' })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${order.color === 'blue' ? 'border-blue-500 bg-blue-200' : 'border-slate-200 bg-blue-50 hover:border-blue-300'}`}
                          title="Màu kem xanh"
                        />
                        <button
                          onClick={() => onEditOrder({ ...order, color: order.color === 'orange' ? null : 'orange' })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${order.color === 'orange' ? 'border-orange-500 bg-orange-200' : 'border-slate-200 bg-orange-50 hover:border-orange-300'}`}
                          title="Màu kem cam"
                        />
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                {editingOrder ? 'Sửa Lệnh Thanh Toán' : 'Tạo Lệnh Thanh Toán Mới'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex flex-col lg:flex-row gap-6 h-full">
                <div className="flex-1 space-y-6">
                  {/* Upload Section */}
              <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center relative">
                <input 
                  type="file" 
                  multiple
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
                    <p className="text-sm text-slate-500 mb-3">Hệ thống sẽ tự động đọc dữ liệu và điền vào form bên dưới. Hỗ trợ chọn nhiều file.</p>
                    
                    {formData.invoiceFileName && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        {formData.invoiceFileName.split(',').filter(Boolean).map((name, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium truncate max-w-[200px]">{name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ngày thanh toán <span className="text-red-500">*</span></label>
                  </div>
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
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Line <span className="text-red-500">*</span></label>
                  </div>
                  <select
                    name="line"
                    value={formData.line || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  >
                    <option value="">-- Chọn Line --</option>
                    {carriers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {formData.line && !carriers.includes(formData.line) && (
                      <option value={formData.line}>{formData.line}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Loại thanh toán <span className="text-red-500">*</span></label>
                  </div>
                  <select
                    name="paymentType"
                    value={formData.paymentType || 'Local charge'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  >
                    <option value="Local charge">Local charge</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Demurage">Demurage</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Số tiền (đã bao gồm VAT) <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.amount?.toString() || '', 'modal-amount')}
                      className="text-slate-400 hover:text-teal-600 transition-colors"
                      title="Copy số tiền"
                    >
                      {copiedKey === 'modal-amount' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">MBL <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        const mbl = formData.mbl || '';
                        const type = formData.paymentType || 'Local charge';
                        let copyText = `LONG HOANG PAYMENT BL ${mbl} MST 0316113070`;
                        if (type === 'Deposit') copyText = `LONG HOANG PAYMENT CUOC BL ${mbl} MST 0316113070`;
                        if (type === 'Demurage') copyText = `LONG HOANG PAYMENT GH BL ${mbl} MST 0316113070`;
                        handleCopy(copyText, 'modal-mbl');
                      }}
                      className="text-slate-400 hover:text-teal-600 transition-colors"
                      title="Copy nội dung MBL"
                    >
                      {copiedKey === 'modal-mbl' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <input
                    type="text"
                    name="mbl"
                    value={formData.mbl || ''}
                    onChange={handleChange}
                    placeholder="Master Bill of Lading"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Số tài khoản <span className="text-red-500">*</span></label>
                  </div>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber || ''}
                    onChange={handleChange}
                    placeholder="Số tài khoản ngân hàng"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Note</label>
                  </div>
                  <input
                    type="text"
                    name="note"
                    value={formData.note || ''}
                    onChange={handleChange}
                    placeholder="Ghi chú thêm..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-6">
                    <label className="text-xs font-bold text-slate-500 uppercase">Wire Off</label>
                  </div>
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
            
            {/* Fees Table Section */}
            <div className="w-full lg:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  Chi tiết các phí
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddFee}
                    className="text-xs flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md transition-colors"
                    title="Thêm dòng phí mới"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm
                  </button>
                  {editingOrder && formData.invoiceFileUrl && (
                    <button
                      onClick={handleSyncFees}
                      disabled={isExtracting}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-md transition-colors disabled:opacity-50"
                      title="Đồng bộ lại dữ liệu phí từ file hóa đơn"
                    >
                      <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                      Đồng bộ
                    </button>
                  )}
                </div>
              </div>
              {formData.fees && formData.fees.length > 0 ? (
                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="text-left py-2 font-semibold">Tên phí</th>
                        <th className="text-right py-2 font-semibold w-24">Số tiền</th>
                        <th className="text-right py-2 font-semibold w-20">USD</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.fees.map((fee, idx) => {
                        const currentRate = formData.paymentDate ? exchangeRates[formData.paymentDate] : 0;
                        
                        // Format USD amount for display if it's calculated, otherwise show raw input
                        let displayUsd = '';
                        if (fee.usdAmount !== undefined && fee.usdAmount !== '') {
                          displayUsd = String(fee.usdAmount);
                        } else if (currentRate > 0 && fee.amount > 0) {
                          displayUsd = (fee.amount / currentRate).toFixed(2);
                        }

                        return (
                          <tr key={idx} className="group">
                            <td className="py-2 text-slate-700">
                              <FeeNameInput
                                value={fee.name}
                                onChange={(val) => handleFeeChange(idx, 'name', val)}
                              />
                            </td>
                            <td className="py-2 text-slate-900 font-medium text-right">
                              <input 
                                type="text" 
                                value={fee.amount === 0 ? '' : fee.amount.toLocaleString('vi-VN')} 
                                onChange={(e) => handleFeeChange(idx, 'amount', e.target.value)}
                                placeholder="0"
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-right transition-colors"
                              />
                            </td>
                            <td className="py-2 text-slate-900 font-medium text-right">
                              <input 
                                type="text" 
                                value={displayUsd} 
                                onChange={(e) => handleFeeChange(idx, 'usdAmount', e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-right transition-colors"
                              />
                            </td>
                            <td className="py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleRemoveFee(idx)}
                                className="text-red-400 hover:text-red-600 transition-colors"
                                title="Xóa phí"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-200 font-bold">
                      <tr>
                        <td className="py-2 text-slate-700 pt-3">Tổng cộng</td>
                        <td className="py-2 text-teal-700 text-right pt-3">
                          {formData.fees.reduce((sum, fee) => sum + fee.amount, 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 text-teal-700 text-right pt-3">
                          {(() => {
                            const currentRate = formData.paymentDate ? exchangeRates[formData.paymentDate] : 0;
                            const totalAmount = formData.fees.reduce((sum, fee) => sum + fee.amount, 0);
                            return currentRate > 0 ? (totalAmount / currentRate).toFixed(2) : '-';
                          })()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm italic text-center p-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="mb-2">Chưa có dữ liệu chi tiết phí.</p>
                  <button
                    onClick={handleAddFee}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors not-italic font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm phí thủ công
                  </button>
                </div>
              )}
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
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tỷ giá (VND/USD)</label>
                    <input
                      type="number"
                      value={settingsRate}
                      onChange={(e) => setSettingsRate(e.target.value)}
                      placeholder="VD: 25000"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                  </div>
                  
                  {Object.keys(exchangeRates).length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-bold text-slate-700 mb-3">Danh sách tỷ giá đã lưu</h4>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold text-slate-600">Ngày</th>
                              <th className="text-right py-2 px-3 font-semibold text-slate-600">Tỷ giá</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(exchangeRates)
                              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                              .map(([date, rate]) => {
                                const parts = date.split('-');
                                const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
                                return (
                                  <tr key={date} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 text-slate-700">{displayDate}</td>
                                    <td className="py-2 px-3 text-slate-900 font-medium text-right">{Number(rate).toLocaleString('vi-VN')}</td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        onClick={() => {
                                          setExchangeRates(prev => {
                                            const next = { ...prev };
                                            delete next[date];
                                            return next;
                                          });
                                        }}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                        title="Xóa"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCarrier}
                      onChange={(e) => setNewCarrier(e.target.value)}
                      placeholder="Nhập mã Line mới..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all uppercase"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCarrier.trim()) {
                          const val = newCarrier.trim().toUpperCase();
                          if (!carriers.includes(val)) {
                            setCarriers([...carriers, val].sort((a, b) => a.localeCompare(b)));
                            setNewCarrier('');
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newCarrier.trim()) {
                          const val = newCarrier.trim().toUpperCase();
                          if (!carriers.includes(val)) {
                            setCarriers([...carriers, val].sort((a, b) => a.localeCompare(b)));
                            setNewCarrier('');
                          }
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm
                    </button>
                  </div>

                  {carriers.length > 0 && (
                    <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold text-slate-600">Mã Line</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {carriers.map((carrier) => (
                              <tr key={carrier} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-900 font-medium">
                                  {editingCarrier === carrier ? (
                                    <input
                                      type="text"
                                      value={editCarrierValue}
                                      onChange={(e) => setEditCarrierValue(e.target.value)}
                                      className="w-full px-2 py-1 border border-teal-500 rounded outline-none uppercase text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = editCarrierValue.trim().toUpperCase();
                                          if (val && (!carriers.includes(val) || val === carrier)) {
                                            setCarriers(carriers.map(c => c === carrier ? val : c).sort((a, b) => a.localeCompare(b)));
                                            setEditingCarrier(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingCarrier(null);
                                        }
                                      }}
                                    />
                                  ) : (
                                    carrier
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  {editingCarrier === carrier ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          const val = editCarrierValue.trim().toUpperCase();
                                          if (val && (!carriers.includes(val) || val === carrier)) {
                                            setCarriers(carriers.map(c => c === carrier ? val : c).sort((a, b) => a.localeCompare(b)));
                                            setEditingCarrier(null);
                                          }
                                        }}
                                        className="text-teal-600 hover:text-teal-700 transition-colors"
                                        title="Lưu"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingCarrier(null)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                        title="Hủy"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingCarrier(carrier);
                                          setEditCarrierValue(carrier);
                                        }}
                                        className="text-blue-400 hover:text-blue-600 transition-colors"
                                        title="Sửa"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setCarriers(carriers.filter(c => c !== carrier))}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                        title="Xóa"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Đóng
              </button>
              {settingsTab === 'rates' && (
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
                >
                  <Save className="w-4 h-4" />
                  Lưu Tỷ Giá
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
