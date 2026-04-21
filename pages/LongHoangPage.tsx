import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Upload, Download, Loader2, X, Save, Copy, Check, Settings, RefreshCw, Lock, Unlock, Eye, Calendar } from 'lucide-react';
import { LongHoangOrder } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { formatDateVN } from '../utils';

const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Invoice";
const TEMPLATE_MAP: Record<string, string> = {
  chi: "Phieu_chi_Mau.xlsx"
};
const GLOBAL_TEMPLATE_CACHE: Record<string, { buffer: ArrayBuffer, name: string }> = {};

interface Carrier {
  name: string;
  accounts: string[];
}

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
  const [previewFile, setPreviewFile] = useState<{url: string, name: string} | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [startingDocNo, setStartingDocNo] = useState('');

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'rates' | 'carriers'>('rates');
  const [settingsDate, setSettingsDate] = useState('');
  const [displaySettingsDate, setDisplaySettingsDate] = useState('');
  const [settingsRate, setSettingsRate] = useState('');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lh_exchange_rates');
    return saved ? JSON.parse(saved) : {};
  });
  const [carriers, setCarriers] = useState<Carrier[]>(() => {
    const savedV2 = localStorage.getItem('lh_carriers_v2');
    if (savedV2) {
      try {
        return JSON.parse(savedV2);
      } catch (e) {}
    }
    const saved = localStorage.getItem('lh_carriers');
    const parsed = saved ? JSON.parse(saved) : [];
    if (Array.isArray(parsed)) {
      return parsed.map(c => typeof c === 'string' ? { name: c, accounts: [] } : c).sort((a: Carrier, b: Carrier) => a.name.localeCompare(b.name));
    }
    return [];
  });
  const [newCarrier, setNewCarrier] = useState('');
  const [newCarrierAccounts, setNewCarrierAccounts] = useState('');
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null);
  const [editCarrierValue, setEditCarrierValue] = useState('');
  const [editCarrierAccounts, setEditCarrierAccounts] = useState('');

  useEffect(() => {
    localStorage.setItem('lh_exchange_rates', JSON.stringify(exchangeRates));
  }, [exchangeRates]);

  useEffect(() => {
    localStorage.setItem('lh_carriers_v2', JSON.stringify(carriers));
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
    setFormData(prev => {
      const newData = { ...prev, [name]: name === 'amount' ? Number(value) : value };
      if (name === 'line') {
        const carrier = carriers.find(c => c.name === value);
        if (carrier && carrier.accounts.length > 0) {
          newData.accountNumber = carrier.accounts[0];
        }
      }
      return newData;
    });
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

    try {
      let uploadedUrls: string[] = formData.invoiceFileUrl ? formData.invoiceFileUrl.split(',').filter(Boolean) : [];
      let uploadedNames: string[] = formData.invoiceFileName ? formData.invoiceFileName.split(',').filter(Boolean) : [];
      
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
      }

      setFormData(prev => ({
        ...prev,
        invoiceFileUrl: uploadedUrls.join(','),
        invoiceFileName: uploadedNames.join(',')
      }));

    } catch (error) {
      console.error('Process error:', error);
      alert('Lỗi trong quá trình tải file.', 'Lỗi');
    } finally {
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
      const names = formData.invoiceFileName ? formData.invoiceFileName.split(',').filter(Boolean) : [];
      let allFees: { name: string; amount: number }[] = [];
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const fileName = names[i] || `File ${i + 1}`;
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
                  
                  Return ONLY a valid JSON object with these exact keys.`
                }
              ]
            },
            config: {
              responseMimeType: "application/json"
            }
          });

          if (aiResponse.text) {
            try {
              const extractedData = JSON.parse(aiResponse.text);
              if (extractedData.fees && Array.isArray(extractedData.fees) && extractedData.fees.length > 0) {
                allFees.push({ name: `--- ${fileName} ---`, amount: 0 });
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

  const handleGlobalTaxChange = (newTaxRate: 'none' | '8' | '5.263') => {
    const currentRate = formData.paymentDate ? exchangeRates[formData.paymentDate] : 0;
    
    setFormData(prev => {
      const oldTaxRate = prev.globalTaxRate || 'none';
      if (newTaxRate === oldTaxRate) return prev;

      const newFees = (prev.fees || []).map(fee => {
        // Ensure originalAmount is set
        if (fee.originalAmount === undefined) {
           fee.originalAmount = fee.amount;
        }
        
        const baseAmount = fee.originalAmount!;
        let finalAmount = baseAmount;
        
        if (newTaxRate === '8') {
          finalAmount = Math.round(baseAmount / 1.08);
        } else if (newTaxRate === '5.263') {
          finalAmount = Math.round(baseAmount / 1.05263);
        }
        
        return {
          ...fee,
          amount: finalAmount,
          usdAmount: currentRate > 0 ? finalAmount / currentRate : ''
        };
      });

      return {
        ...prev,
        globalTaxRate: newTaxRate,
        fees: newFees
      };
    });
  };

  const handleFeeChange = (idx: number, field: 'name' | 'amount' | 'usdAmount', value: string) => {
    const currentRate = formData.paymentDate ? exchangeRates[formData.paymentDate] : 0;
    
    setFormData(prev => {
      if (!prev.fees) return prev;
      const newFees = [...prev.fees];
      const currentTaxRate = prev.globalTaxRate || 'none';
      
      if (field === 'name') {
        newFees[idx].name = value;
      } else if (field === 'amount') {
        const numValue = parseInt(value.replace(/\D/g, ""), 10) || 0;
        
        // Update originalAmount based on current globalTaxRate
        if (currentTaxRate === '8') {
          newFees[idx].originalAmount = Math.round(numValue * 1.08);
        } else if (currentTaxRate === '5.263') {
          newFees[idx].originalAmount = Math.round(numValue * 1.05263);
        } else {
          newFees[idx].originalAmount = numValue;
        }

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
          const calculatedAmount = Math.round(numValue * currentRate);
          newFees[idx].amount = calculatedAmount;
          
          // Update originalAmount based on current globalTaxRate
          if (currentTaxRate === '8') {
            newFees[idx].originalAmount = Math.round(calculatedAmount * 1.08);
          } else if (currentTaxRate === '5.263') {
            newFees[idx].originalAmount = Math.round(calculatedAmount * 1.05263);
          } else {
            newFees[idx].originalAmount = calculatedAmount;
          }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterStatus]);

  const filteredOrders = orders.filter(order => {
    const matchDate = filterDate ? order.paymentDate === filterDate : true;
    const status = order.wireOffStatus || 'Pending';
    const matchStatus = filterStatus === 'All' ? true : status === filterStatus;
    return matchDate && matchStatus;
  }).sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  const handleOpenExportModal = () => {
    const selectedOrders = filteredOrders.filter(o => o.isChecked);
    if (selectedOrders.length === 0) {
      alert('Vui lòng chọn ít nhất một dòng để xuất Excel', 'error');
      return;
    }
    setStartingDocNo('');
    setIsExportModalOpen(true);
  };

  const handleConfirmExport = async () => {
    setIsExportModalOpen(false);
    await handleExportExcel(startingDocNo);
  };

  const handleExportExcel = async (startDocNo: string) => {
    const selectedOrders = filteredOrders.filter(o => o.isChecked);
    if (selectedOrders.length === 0) {
      alert('Vui lòng chọn ít nhất một dòng để xuất Excel', 'error');
      return;
    }

    // Sort selected orders by paymentDate ascending
    const sortedOrders = [...selectedOrders].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

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
      
      let currentDocNo = startDocNo;

      sortedOrders.forEach((order, index) => {
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
          
          const type = order.paymentType || 'Local charge';
          let desc = order.note ? `Chi tiền cho ncc lô ${order.note} BILL ${order.mbl}` : `Chi tiền BILL ${order.mbl}`;
          if (type === 'Deposit') {
            desc = order.note ? `Chi tiền cho ncc CƯỢC lô ${order.note} BILL ${order.mbl}` : `Chi tiền CƯỢC BILL ${order.mbl}`;
          } else if (type === 'Demurage') {
            desc = order.note ? `Chi tiền cho ncc GH lô ${order.note} BILL ${order.mbl}` : `Chi tiền GH BILL ${order.mbl}`;
          } else if (type === 'Repair') {
            desc = order.note ? `Chi tiền cho ncc PHÍ SỬA CHỮA lô ${order.note} BILL ${order.mbl}` : `Chi tiền PHÍ SỬA CHỮA BILL ${order.mbl}`;
          } else if (type === 'Telex') {
            desc = order.note ? `Chi tiền cho ncc PHÍ TELEX lô ${order.note} BILL ${order.mbl}` : `Chi tiền PHÍ TELEX BILL ${order.mbl}`;
          }
          
          row.getCell(1).value = "Ủy nhiệm chi"; 
          row.getCell(2).value = formatDateVN(order.paymentDate); 
          row.getCell(3).value = formatDateVN(order.paymentDate); 
          row.getCell(4).value = currentDocNo; // docNo
          row.getCell(5).value = "Chi khác"; 
          row.getCell(6).value = desc; 
          row.getCell(7).value = "19135447033015"; 
          row.getCell(8).value = "Ngân hàng TMCP Kỹ thương Việt Nam - Gia Định"; 
          row.getCell(9).value = order.line; 
          row.getCell(19).value = "VND"; 
          row.getCell(21).value = desc; 
          row.getCell(22).value = "3311"; 
          row.getCell(23).value = "1121"; 
          row.getCell(24).value = order.amount; 
          row.getCell(26).value = order.line;
          row.commit();

          // Increment docNo for next row
          if (currentDocNo) {
            const match = currentDocNo.match(/^(.*?)(\d+)(\D*)$/);
            if (match) {
              const prefix = match[1];
              const numStr = match[2];
              const suffix = match[3];
              const num = parseInt(numStr, 10) + 1;
              const paddedNum = String(num).padStart(numStr.length, '0');
              currentDocNo = `${prefix}${paddedNum}${suffix}`;
            } else {
              const num = parseInt(currentDocNo, 10);
              if (!isNaN(num)) {
                 currentDocNo = String(num + 1);
              }
            }
          }
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
            onClick={handleOpenExportModal}
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
                <th className="px-2 py-3 font-semibold w-8 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    checked={paginatedOrders.length > 0 && paginatedOrders.filter(o => !o.isLocked).length > 0 && paginatedOrders.filter(o => !o.isLocked).every(o => o.isChecked)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      paginatedOrders.forEach(order => {
                        if (!order.isLocked && !!order.isChecked !== checked) {
                          onEditOrder({ ...order, isChecked: checked });
                        }
                      });
                    }}
                  />
                </th>
                <th className="px-2 py-3 font-semibold whitespace-nowrap">Ngày TT</th>
                <th className="px-2 py-3 font-semibold">Line</th>
                <th className="px-2 py-3 font-semibold text-right whitespace-nowrap">Số tiền</th>
                <th className="px-2 py-3 font-semibold">MBL</th>
                <th className="px-2 py-3 font-semibold">STK</th>
                <th className="px-2 py-3 font-semibold">File</th>
                <th className="px-2 py-3 font-semibold">
                  <div className="flex items-center gap-1">
                    Note
                    {paginatedOrders.some(o => o.isChecked) && (
                      <button
                        onClick={() => {
                          const selectedNotes = paginatedOrders.filter(o => o.isChecked && o.note).map(o => o.note).join('\n');
                          if (selectedNotes) {
                            navigator.clipboard.writeText(selectedNotes);
                            setCopiedKey('all-notes');
                            setTimeout(() => setCopiedKey(null), 2000);
                          }
                        }}
                        className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                        title="Copy note các dòng đã chọn"
                      >
                        {copiedKey === 'all-notes' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </th>
                <th className="px-2 py-3 font-semibold whitespace-nowrap">Wire Off</th>
                <th className="px-2 py-3 font-semibold text-center w-20">Thao tác</th>
                <th className="px-2 py-3 font-semibold text-center w-12">Màu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Không tìm thấy lệnh thanh toán nào
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const dateObj = new Date(order.paymentDate);
                  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                  
                  return (
                  <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${order.isChecked ? 'bg-teal-50/30' : ''} ${order.color === 'blue' ? 'bg-blue-50' : order.color === 'orange' ? 'bg-orange-50' : ''}`}>
                    <td className="px-2 py-3 text-center">
                      <input 
                        type="checkbox" 
                        className={`rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${order.isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        checked={!!order.isChecked}
                        onChange={(e) => !order.isLocked && onEditOrder({ ...order, isChecked: e.target.checked })}
                        disabled={order.isLocked}
                      />
                    </td>
                    <td className="px-2 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="px-2 py-3 text-slate-600 truncate max-w-[80px]" title={order.line}>{order.line}</td>
                    <td className="px-2 py-3 text-slate-900 font-bold text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <span>{order.amount.toLocaleString('vi-VN')}</span>
                        <button
                          onClick={() => handleCopy(order.amount.toString(), `${order.id}-amount`)}
                          className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                          title="Copy số tiền"
                        >
                          {copiedKey === `${order.id}-amount` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[100px]" title={order.mbl}>{order.mbl}</span>
                        <button
                          onClick={() => {
                            const type = order.paymentType || 'Local charge';
                            let copyText = `LONG HOANG PAYMENT BL ${order.mbl} MST 0316113070`;
                            if (type === 'Deposit') copyText = `LONG HOANG PAYMENT CUOC BL ${order.mbl} MST 0316113070`;
                            if (type === 'Demurage') copyText = `LONG HOANG PAYMENT GH BL ${order.mbl} MST 0316113070`;
                            if (type === 'Repair') copyText = `LONG HOANG PAYMENT PHI SUA CHUA BL ${order.mbl} MST 0316113070`;
                            if (type === 'Telex') copyText = `LONG HOANG PAYMENT PHI TELEX BL ${order.mbl} MST 0316113070`;
                            handleCopy(copyText, `${order.id}-mbl`);
                          }}
                          className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                          title="Copy nội dung MBL"
                        >
                          {copiedKey === `${order.id}-mbl` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-600 font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[90px]" title={order.accountNumber}>{order.accountNumber}</span>
                        {order.accountNumber && (
                          <button
                            onClick={() => handleCopy(order.accountNumber, `${order.id}-account`)}
                            className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                            title="Copy số tài khoản"
                          >
                            {copiedKey === `${order.id}-account` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {order.invoiceFileUrl ? (
                        <div className="flex items-center gap-1 flex-wrap max-w-[80px]">
                          {order.invoiceFileUrl.split(',').filter(Boolean).map((url, idx) => {
                            const names = order.invoiceFileName ? order.invoiceFileName.split(',').filter(Boolean) : [];
                            const name = names[idx] || `File ${idx + 1}`;
                            return (
                              <button
                                key={idx}
                                onClick={() => setPreviewFile({ url, name })}
                                className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title={name}
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Trống</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[100px]" title={order.note}>{order.note}</span>
                        {order.note && (
                          <button
                            onClick={() => handleCopy(order.note, `${order.id}-note`)}
                            className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                            title="Copy ghi chú"
                          >
                            {copiedKey === `${order.id}-note` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${order.wireOffStatus === 'Wired Off' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.wireOffStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditOrder({ ...order, isLocked: !order.isLocked })}
                          className={`p-1 rounded-lg transition-colors ${order.isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                          title={order.isLocked ? "Mở khóa" : "Khóa"}
                        >
                          {order.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleOpenModal(order)}
                          disabled={order.isLocked}
                          className={`p-1 rounded-lg transition-colors ${order.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          disabled={order.isLocked}
                          className={`p-1 rounded-lg transition-colors ${order.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onEditOrder({ ...order, color: order.color === 'orange' ? null : 'orange' })}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${order.color === 'orange' ? 'border-orange-500 bg-orange-200' : 'border-slate-200 bg-orange-50 hover:border-orange-300'}`}
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
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-white">
            <div className="text-sm text-slate-500">
              Hiển thị <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> trong <span className="font-medium">{filteredOrders.length}</span> kết quả
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded border text-sm font-medium ${currentPage === page ? 'bg-teal-50 border-teal-200 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        )}
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
                    <p className="text-sm text-slate-500 mb-3">Hỗ trợ chọn nhiều file. Sau khi tải lên, bạn có thể nhấn nút "Đồng bộ" ở phần Chi tiết các phí để AI tự động đọc dữ liệu.</p>
                    
                    {formData.invoiceFileName && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        {formData.invoiceFileName.split(',').filter(Boolean).map((name, idx) => {
                          const urls = formData.invoiceFileUrl ? formData.invoiceFileUrl.split(',').filter(Boolean) : [];
                          const url = urls[idx];
                          return (
                          <div key={idx} className="flex items-center gap-2 text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100 relative z-10">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium truncate max-w-[200px]">{name}</span>
                            {url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPreviewFile({ url, name });
                                }}
                                className="ml-1 p-1 hover:bg-teal-100 rounded-md transition-colors"
                                title="Xem trước"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ngày thanh toán <span className="text-red-500">*</span></label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      name="paymentDate"
                      value={displayDate}
                      onChange={handleDateChange}
                      placeholder="dd/mm/yyyy"
                      className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <Calendar className="w-4 h-4 text-slate-400 pointer-events-none" />
                      <input 
                        type="date"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const val = e.target.value; // YYYY-MM-DD
                          if (val) {
                            const parts = val.split('-');
                            if (parts.length === 3) {
                              setDisplayDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
                              setFormData(prev => ({ ...prev, paymentDate: val }));
                            }
                          } else {
                            setDisplayDate('');
                            setFormData(prev => ({ ...prev, paymentDate: '' }));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Line <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsTab('carriers');
                        setIsSettingsModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-teal-600 transition-colors"
                      title="Cài đặt Carrier"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    name="line"
                    value={formData.line || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  >
                    <option value="">-- Chọn Line --</option>
                    {carriers.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                    {formData.line && !carriers.some(c => c.name === formData.line) && (
                      <option value={formData.line}>{formData.line}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-5">
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
                    <option value="Repair">Repair</option>
                    <option value="Telex">Telex</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-5">
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
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">MBL <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        const mbl = formData.mbl || '';
                        const type = formData.paymentType || 'Local charge';
                        let copyText = `LONG HOANG PAYMENT BL ${mbl} MST 0316113070`;
                        if (type === 'Deposit') copyText = `LONG HOANG PAYMENT CUOC BL ${mbl} MST 0316113070`;
                        if (type === 'Demurage') copyText = `LONG HOANG PAYMENT GH BL ${mbl} MST 0316113070`;
                        if (type === 'Repair') copyText = `LONG HOANG PAYMENT PHI SUA CHUA BL ${mbl} MST 0316113070`;
                        if (type === 'Telex') copyText = `LONG HOANG PAYMENT PHI TELEX BL ${mbl} MST 0316113070`;
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
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Số tài khoản <span className="text-red-500">*</span></label>
                  </div>
                  <input
                    type="text"
                    name="accountNumber"
                    list="account-numbers"
                    value={formData.accountNumber || ''}
                    onChange={handleChange}
                    placeholder="Số tài khoản ngân hàng"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-mono"
                  />
                  <datalist id="account-numbers">
                    {formData.line && carriers.find(c => c.name === formData.line)?.accounts.map(acc => (
                      <option key={acc} value={acc} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Note</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.note || '', 'modal-note')}
                      className="text-slate-400 hover:text-teal-600 transition-colors"
                      title="Copy ghi chú"
                    >
                      {copiedKey === 'modal-note' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
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
                  <div className="flex justify-between items-center h-5">
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
                  {formData.invoiceFileUrl && (
                    <button
                      onClick={handleSyncFees}
                      disabled={isExtracting}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-md transition-colors disabled:opacity-50"
                      title="Đồng bộ dữ liệu phí từ file hóa đơn"
                    >
                      <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                      Đồng bộ
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-3 px-2 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <span className="text-sm font-medium text-slate-700">Thuế:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                  <input 
                    type="radio" 
                    name="globalTaxRate" 
                    value="none" 
                    checked={!formData.globalTaxRate || formData.globalTaxRate === 'none'} 
                    onChange={(e) => handleGlobalTaxChange(e.target.value as any)}
                    className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  None
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                  <input 
                    type="radio" 
                    name="globalTaxRate" 
                    value="8" 
                    checked={formData.globalTaxRate === '8'} 
                    onChange={(e) => handleGlobalTaxChange(e.target.value as any)}
                    className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  8%
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                  <input 
                    type="radio" 
                    name="globalTaxRate" 
                    value="5.263" 
                    checked={formData.globalTaxRate === '5.263'} 
                    onChange={(e) => handleGlobalTaxChange(e.target.value as any)}
                    className="text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  5.263%
                </label>
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
                          if (typeof fee.usdAmount === 'number') {
                            displayUsd = fee.usdAmount.toFixed(2);
                          } else {
                            displayUsd = String(fee.usdAmount);
                          }
                        } else if (currentRate > 0 && fee.amount > 0) {
                          displayUsd = (fee.amount / currentRate).toFixed(2);
                        }

                        const isInvoiceRow = fee.name.startsWith('--- ') && fee.name.endsWith(' ---');

                        return (
                          <tr key={idx} className="group">
                            <td className={`py-2 ${isInvoiceRow ? 'text-indigo-600 font-semibold' : 'text-slate-700'}`} colSpan={isInvoiceRow ? 3 : 1}>
                              {isInvoiceRow ? (
                                <div className="flex items-center border-b border-transparent hover:border-indigo-300 focus-within:border-indigo-500 transition-colors">
                                  <input
                                    type="text"
                                    value={fee.name}
                                    onChange={(e) => handleFeeChange(idx, 'name', e.target.value)}
                                    className="w-full bg-transparent outline-none py-1 text-indigo-600 font-semibold"
                                  />
                                </div>
                              ) : (
                                <FeeNameInput
                                  value={fee.name}
                                  onChange={(val) => handleFeeChange(idx, 'name', val)}
                                />
                              )}
                            </td>
                            {!isInvoiceRow && (
                              <>
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
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (!isNaN(val) && e.target.value !== '') {
                                        handleFeeChange(idx, 'usdAmount', val.toFixed(2));
                                      }
                                    }}
                                    placeholder="0.00"
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-right transition-colors"
                                  />
                                </td>
                              </>
                            )}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95">
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
                          const accs = newCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                          if (!carriers.some(c => c.name === val)) {
                            setCarriers([...carriers, { name: val, accounts: accs }].sort((a, b) => a.name.localeCompare(b.name)));
                            setNewCarrier('');
                            setNewCarrierAccounts('');
                          }
                        }
                      }}
                    />
                    <input
                      type="text"
                      value={newCarrierAccounts}
                      onChange={(e) => setNewCarrierAccounts(e.target.value)}
                      placeholder="Số tài khoản (cách nhau bởi dấu phẩy)..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCarrier.trim()) {
                          const val = newCarrier.trim().toUpperCase();
                          const accs = newCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                          if (!carriers.some(c => c.name === val)) {
                            setCarriers([...carriers, { name: val, accounts: accs }].sort((a, b) => a.name.localeCompare(b.name)));
                            setNewCarrier('');
                            setNewCarrierAccounts('');
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newCarrier.trim()) {
                          const val = newCarrier.trim().toUpperCase();
                          const accs = newCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                          if (!carriers.some(c => c.name === val)) {
                            setCarriers([...carriers, { name: val, accounts: accs }].sort((a, b) => a.name.localeCompare(b.name)));
                            setNewCarrier('');
                            setNewCarrierAccounts('');
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
                              <th className="text-left py-2 px-3 font-semibold text-slate-600">Số tài khoản</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {carriers.map((carrier) => (
                              <tr key={carrier.name} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-900 font-medium w-1/3">
                                  {editingCarrier === carrier.name ? (
                                    <input
                                      type="text"
                                      value={editCarrierValue}
                                      onChange={(e) => setEditCarrierValue(e.target.value)}
                                      className="w-full px-2 py-1 border border-teal-500 rounded outline-none uppercase text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = editCarrierValue.trim().toUpperCase();
                                          const accs = editCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                                          if (val && (!carriers.some(c => c.name === val) || val === carrier.name)) {
                                            setCarriers(carriers.map(c => c.name === carrier.name ? { name: val, accounts: accs } : c).sort((a, b) => a.name.localeCompare(b.name)));
                                            setEditingCarrier(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingCarrier(null);
                                        }
                                      }}
                                    />
                                  ) : (
                                    carrier.name
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {editingCarrier === carrier.name ? (
                                    <input
                                      type="text"
                                      value={editCarrierAccounts}
                                      onChange={(e) => setEditCarrierAccounts(e.target.value)}
                                      className="w-full px-2 py-1 border border-teal-500 rounded outline-none text-sm"
                                      placeholder="Cách nhau bởi dấu phẩy"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = editCarrierValue.trim().toUpperCase();
                                          const accs = editCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                                          if (val && (!carriers.some(c => c.name === val) || val === carrier.name)) {
                                            setCarriers(carriers.map(c => c.name === carrier.name ? { name: val, accounts: accs } : c).sort((a, b) => a.name.localeCompare(b.name)));
                                            setEditingCarrier(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setEditingCarrier(null);
                                        }
                                      }}
                                    />
                                  ) : (
                                    carrier.accounts.join(', ')
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  {editingCarrier === carrier.name ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          const val = editCarrierValue.trim().toUpperCase();
                                          const accs = editCarrierAccounts.split(',').map(s => s.trim()).filter(Boolean);
                                          if (val && (!carriers.some(c => c.name === val) || val === carrier.name)) {
                                            setCarriers(carriers.map(c => c.name === carrier.name ? { name: val, accounts: accs } : c).sort((a, b) => a.name.localeCompare(b.name)));
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
                                          setEditingCarrier(carrier.name);
                                          setEditCarrierValue(carrier.name);
                                          setEditCarrierAccounts(carrier.accounts.join(', '));
                                        }}
                                        className="text-blue-400 hover:text-blue-600 transition-colors"
                                        title="Sửa"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setCarriers(carriers.filter(c => c.name !== carrier.name))}
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

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Xuất Excel</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Số chứng từ bắt đầu</label>
                  <input
                    type="text"
                    value={startingDocNo}
                    onChange={(e) => setStartingDocNo(e.target.value)}
                    placeholder="VD: PC001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirmExport();
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Số chứng từ sẽ được tự động tăng dần theo ngày của các lệnh được chọn.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmExport}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
              >
                <Check className="w-4 h-4" />
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Xem trước: {previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-slate-100 overflow-hidden rounded-b-2xl">
              {previewFile.url.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewFile.url} className="w-full h-full rounded-xl border border-slate-200" title="PDF Preview" />
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  <img src={previewFile.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
