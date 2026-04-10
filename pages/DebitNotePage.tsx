import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Upload, Download, Loader2, X, Save, Copy, Check, Settings, RefreshCw, Lock, Unlock, Sparkles } from 'lucide-react';
import { DebitNoteData } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { GoogleGenAI, Type } from '@google/genai';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { formatDateVN } from '../utils';

const BACKEND_URL = "https://api.kimberry.id.vn";
const TEMPLATE_FOLDER = "Invoice";
const TEMPLATE_MAP: Record<string, string> = {
  debit: "Debit_Note_Mau.xlsx"
};
const GLOBAL_TEMPLATE_CACHE: Record<string, { buffer: ArrayBuffer, name: string }> = {};

interface DebitNotePageProps {
  notes: DebitNoteData[];
  onAddNote: (note: DebitNoteData) => void;
  onEditNote: (note: DebitNoteData) => void;
  onDeleteNote: (id: string) => void;
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
                e.preventDefault();
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

export const DebitNotePage: React.FC<DebitNotePageProps> = ({ notes, onAddNote, onEditNote, onDeleteNote }) => {
  const { alert, confirm } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DebitNoteData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<DebitNoteData>>({});
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

  const currentTemplateFileName = TEMPLATE_MAP['debit'];

  useEffect(() => {
    const loadTemplate = async () => {
        if (GLOBAL_TEMPLATE_CACHE['debit']) {
            setTemplateBuffer(GLOBAL_TEMPLATE_CACHE['debit'].buffer);
            setTemplateName(GLOBAL_TEMPLATE_CACHE['debit'].name);
            return;
        }
        setIsLoadingTemplate(true);
        try {
            const staticUrl = `${BACKEND_URL}/uploads/${TEMPLATE_FOLDER}/${currentTemplateFileName}?v=${Date.now()}`;
            const response = await axios.get(staticUrl, { responseType: 'arraybuffer' });
            if (response.status === 200 && response.data) {
                const buffer = response.data;
                const displayName = currentTemplateFileName.replace(/_/g, ' ').replace('.xlsx', '');
                GLOBAL_TEMPLATE_CACHE['debit'] = { buffer, name: `${displayName} (Server)` };
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
          GLOBAL_TEMPLATE_CACHE['debit'] = { buffer, name: statusName };
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

  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'rates' | 'carriers'>('rates');
  const [settingsDate, setSettingsDate] = useState('');
  const [displaySettingsDate, setDisplaySettingsDate] = useState('');
  const [settingsRate, setSettingsRate] = useState('');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('dn_exchange_rates');
    return saved ? JSON.parse(saved) : {};
  });
  const [carriers, setCarriers] = useState<string[]>(() => {
    const saved = localStorage.getItem('dn_carriers');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.sort((a: string, b: string) => a.localeCompare(b)) : [];
  });
  const [newCarrier, setNewCarrier] = useState('');
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null);
  const [editCarrierValue, setEditCarrierValue] = useState('');

  useEffect(() => {
    localStorage.setItem('dn_exchange_rates', JSON.stringify(exchangeRates));
  }, [exchangeRates]);

  useEffect(() => {
    localStorage.setItem('dn_carriers', JSON.stringify(carriers));
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

  const handleOpenModal = (note?: DebitNoteData) => {
    if (note) {
      setEditingNote(note);
      setFormData(note);
      if (note.paymentDate) {
        const parts = note.paymentDate.split('-');
        if (parts.length === 3) {
          setDisplayDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
        } else {
          setDisplayDate(note.paymentDate);
        }
      }
      setDisplayAmount(note.amount ? note.amount.toLocaleString('vi-VN') : '');
    } else {
      setEditingNote(null);
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
    setEditingNote(null);
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
    if (editingNote) {
      onEditNote({
        ...formData,
        paymentType: formData.paymentType || 'Local charge'
      } as DebitNoteData);
      alert('Đã cập nhật Debit Note', 'Thành công');
    } else {
      onAddNote({
        ...formData,
        paymentType: formData.paymentType || 'Local charge',
        id: `dn-${Date.now()}`
      } as DebitNoteData);
      alert('Đã tạo Debit Note mới', 'Thành công');
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Bạn có chắc chắn muốn xóa Debit Note này?', 'Xác nhận xóa')) {
      onDeleteNote(id);
      alert('Đã xóa Debit Note', 'Thành công');
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
        const uploadFormData = new FormData();
        uploadFormData.append("fileName", `DN_INV_${Date.now()}_${file.name}`);
        uploadFormData.append("folderPath", "DN");
        uploadFormData.append("file", file);
        try {
          const res = await axios.post(`${BACKEND_URL}/upload-file`, uploadFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (res.data && res.data.success) {
            let uploadedUrl = res.data.url;
            if (uploadedUrl && !uploadedUrl.startsWith('http')) {
                uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
            }
            uploadedUrls.push(uploadedUrl);
            uploadedNames.push(res.data.fileName || file.name);
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

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
                { inlineData: { mimeType: file.type, data: base64String } },
                { text: `Extract the following information from this invoice file and return it in JSON format:
                  - line: The shipping line or company name (string)
                  - amount: The total amount to be paid (number, remove commas or currency symbols)
                  - mbl: The Master Bill of Lading number (string)
                  - accountNumber: The bank account number for payment (string)
                  - fees: An array of objects representing the detailed fees and their amounts. Each object should have 'name' (string) and 'amount' (number).`
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  line: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  mbl: { type: Type.STRING },
                  accountNumber: { type: Type.STRING },
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
          if (response.text) {
            const extractedData = JSON.parse(response.text);
            if (extractedData.line && !extractedLine) extractedLine = extractedData.line;
            if (extractedData.mbl && !extractedMbl) extractedMbl = extractedData.mbl;
            if (extractedData.accountNumber && !extractedAccountNumber) extractedAccountNumber = extractedData.accountNumber;
            if (extractedData.fees && Array.isArray(extractedData.fees)) {
              const processedFees = extractedData.fees.map((f: any) => ({
                name: f.name || '',
                amount: Number(f.amount) || 0
              }));
              allFees = [...allFees, ...processedFees];
            }
            if (extractedData.amount) {
              totalAmount += Number(extractedData.amount) || 0;
            }
          }
        } catch (aiError) {
          console.error('Gemini API error:', aiError);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
                { inlineData: { data: base64String, mimeType: blob.type || 'application/pdf' } },
                { text: `Extract the following information from this invoice file and return it in JSON format:
                  - fees: An array of objects representing the detailed fees and their amounts. Each object should have 'name' (string) and 'amount' (number).`
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
                        name: { type: Type.STRING },
                        amount: { type: Type.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          });
          if (aiResponse.text) {
            const extractedData = JSON.parse(aiResponse.text);
            if (extractedData.fees && Array.isArray(extractedData.fees)) {
              const processedFees = extractedData.fees.map((f: any) => ({
                name: f.name || '',
                amount: Number(f.amount) || 0
              }));
              allFees = [...allFees, ...processedFees];
            }
          }
        } catch (error) {
          console.error('Error processing URL:', error);
        }
      }
      setFormData(prev => ({ ...prev, fees: allFees.length > 0 ? allFees : prev.fees }));
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
        if (currentRate > 0) newFees[idx].usdAmount = numValue / currentRate;
        else newFees[idx].usdAmount = '';
      } else if (field === 'usdAmount') {
        const cleanValue = value.replace(/[^0-9.-]+/g, "");
        newFees[idx].usdAmount = cleanValue;
        const numValue = Number(cleanValue);
        if (!isNaN(numValue) && currentRate > 0) newFees[idx].amount = Math.round(numValue * currentRate);
      }
      return { ...prev, fees: newFees };
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
      return { ...prev, fees: newFees };
    });
  };

  const filteredNotes = notes.filter(note => {
    const matchDate = filterDate ? note.paymentDate === filterDate : true;
    const status = note.wireOffStatus || 'Pending';
    const matchStatus = filterStatus === 'All' ? true : status === filterStatus;
    return matchDate && matchStatus;
  });

  const handleExportExcel = async () => {
    const selectedNotes = filteredNotes.filter(o => o.isChecked);
    if (selectedNotes.length === 0) {
      alert('Vui lòng chọn ít nhất một dòng để xuất Excel', 'error');
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      if (templateBuffer) await workbook.xlsx.load(templateBuffer);
      else workbook.addWorksheet("Debit Note Export");
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) return;
      const START_ROW = 9;
      const styleRow = templateBuffer ? worksheet.getRow(START_ROW) : null;
      selectedNotes.forEach((note, index) => {
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
          const desc = note.note ? `Debit Note lô ${note.note} BILL ${note.mbl}` : `Debit Note BILL ${note.mbl}`;
          row.getCell(1).value = "Debit Note"; 
          row.getCell(2).value = formatDateVN(note.paymentDate); 
          row.getCell(3).value = formatDateVN(note.paymentDate); 
          row.getCell(6).value = desc; 
          row.getCell(9).value = note.line; 
          row.getCell(10).value = note.line; 
          row.getCell(19).value = "VND"; 
          row.getCell(21).value = desc; 
          row.getCell(24).value = note.amount; 
          row.getCell(26).value = note.line;
          row.commit();
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = "Debit_Note_Export.xlsx";
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a"); 
      anchor.href = url; 
      anchor.download = fileName; 
      anchor.click(); 
      window.URL.revokeObjectURL(url);
      selectedNotes.forEach(note => onEditNote({ ...note, isChecked: false }));
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      alert('Lỗi khi xuất Excel', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Trang Debit Note</h2>
          <p className="text-sm text-slate-500">Quản lý Debit Note</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Ngày:</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-sm border-none outline-none bg-transparent text-slate-700" />
            {filterDate && <button onClick={() => setFilterDate('')} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Trạng thái:</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border-none outline-none bg-transparent text-slate-700">
              <option value="All">Tất cả</option>
              <option value="Pending">Pending</option>
              <option value="Wired Off">Wired Off</option>
            </select>
          </div>
          <button onClick={handleExportExcel} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm">
            <FileText className="w-5 h-5" /> Xuất Excel
          </button>
          <button onClick={() => templateInputRef.current?.click()} disabled={isUploadingTemplate} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-colors">
             {isUploadingTemplate ? <Loader2 className="w-5 h-5 animate-spin text-teal-500" /> : (templateBuffer ? <Check className="w-5 h-5 text-green-500" /> : <Settings className="w-5 h-5" />)} 
             <span className="flex flex-col items-start text-xs"><span className="font-bold">{templateBuffer ? 'Đã có mẫu' : 'Cài đặt mẫu'}</span>{templateName && <span className="text-[9px] text-slate-500 max-w-[150px] truncate">{templateName}</span>}</span>
          </button>
          <input type="file" ref={templateInputRef} onChange={handleTemplateUpload} accept=".xlsx, .xls" className="hidden" />
          <button onClick={handleOpenSettings} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 p-2 rounded-xl font-bold transition-colors flex items-center justify-center shadow-sm"><Settings className="w-5 h-5" /></button>
          <button onClick={() => handleOpenModal()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20">
            <Plus className="w-5 h-5" /> Tạo Debit Note
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold w-10 text-center">
                  <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" checked={filteredNotes.length > 0 && filteredNotes.filter(o => !o.isLocked).length > 0 && filteredNotes.filter(o => !o.isLocked).every(o => o.isChecked)} onChange={(e) => {
                      const checked = e.target.checked;
                      filteredNotes.forEach(note => { if (!note.isLocked && !!note.isChecked !== checked) onEditNote({ ...note, isChecked: checked }); });
                    }} />
                </th>
                <th className="px-4 py-3 font-semibold">Ngày thanh toán</th>
                <th className="px-4 py-3 font-semibold">Line</th>
                <th className="px-4 py-3 font-semibold text-right">Số tiền</th>
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
              {filteredNotes.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Không tìm thấy Debit Note nào</td></tr>
              ) : (
                filteredNotes.map((note) => {
                  const dateObj = new Date(note.paymentDate);
                  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                  return (
                  <tr key={note.id} className={`hover:bg-slate-50 transition-colors ${note.isChecked ? 'bg-teal-50/30' : ''} ${note.color === 'blue' ? 'bg-blue-50' : note.color === 'orange' ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" className={`rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${note.isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} checked={!!note.isChecked} onChange={(e) => !note.isLocked && onEditNote({ ...note, isChecked: e.target.checked })} disabled={note.isLocked} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{formattedDate}</td>
                    <td className="px-4 py-3 text-slate-600">{note.line}</td>
                    <td className="px-4 py-3 text-slate-900 font-bold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{note.amount.toLocaleString('vi-VN')}</span>
                        <button onClick={() => handleCopy(note.amount.toString(), `${note.id}-amount`)} className="text-slate-400 hover:text-teal-600 transition-colors">
                          {copiedKey === `${note.id}-amount` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{note.mbl}</span>
                        <button onClick={() => handleCopy(`DEBIT NOTE BL ${note.mbl}`, `${note.id}-mbl`)} className="text-slate-400 hover:text-teal-600 transition-colors">
                          {copiedKey === `${note.id}-mbl` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{note.accountNumber}</span>
                        {note.accountNumber && <button onClick={() => handleCopy(note.accountNumber, `${note.id}-account`)} className="text-slate-400 hover:text-teal-600 transition-colors">{copiedKey === `${note.id}-account` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {note.invoiceFileUrl ? <a href={note.invoiceFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><FileText className="w-4 h-4" /></a> : <span className="text-slate-400 italic text-sm">Trống</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{note.note}</span>
                        {note.note && <button onClick={() => handleCopy(note.note || '', `${note.id}-note`)} className="text-slate-400 hover:text-teal-600 transition-colors">{copiedKey === `${note.id}-note` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${note.wireOffStatus === 'Wired Off' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{note.wireOffStatus || 'Pending'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onEditNote({ ...note, isLocked: !note.isLocked })} className={`p-1.5 rounded-lg transition-colors ${note.isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>{note.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
                        <button onClick={() => handleOpenModal(note)} disabled={note.isLocked} className={`p-1.5 rounded-lg transition-colors ${note.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(note.id)} disabled={note.isLocked} className={`p-1.5 rounded-lg transition-colors ${note.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => onEditNote({ ...note, color: note.color === 'blue' ? null : 'blue' })} className={`w-6 h-6 rounded-full border-2 transition-all ${note.color === 'blue' ? 'border-blue-500 bg-blue-200' : 'border-slate-200 bg-blue-50 hover:border-blue-300'}`} />
                        <button onClick={() => onEditNote({ ...note, color: note.color === 'orange' ? null : 'orange' })} className={`w-6 h-6 rounded-full border-2 transition-all ${note.color === 'orange' ? 'border-orange-500 bg-orange-200' : 'border-slate-200 bg-orange-50 hover:border-orange-300'}`} />
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingNote ? 'Sửa Debit Note' : 'Tạo Debit Note Mới'}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex flex-col lg:flex-row gap-6 h-full">
                <div className="flex-1 space-y-6">
                  <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center relative">
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,image/*" disabled={isUploading} />
                    {isExtracting ? <div className="flex flex-col items-center gap-3 text-indigo-600"><Loader2 className="w-8 h-8 animate-spin" /><span className="font-medium">Đang đọc dữ liệu...</span></div> : <>
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-blue-600"><Upload className="w-6 h-6" /></div>
                        <p className="font-semibold text-slate-700 mb-1">Tải lên file hóa đơn</p>
                        {formData.invoiceFileName && <div className="flex flex-wrap items-center justify-center gap-2 mt-2">{formData.invoiceFileName.split(',').filter(Boolean).map((name, idx) => (<div key={idx} className="flex items-center gap-2 text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100"><FileText className="w-4 h-4" /><span className="font-medium truncate max-w-[200px]">{name}</span></div>))}</div>}
                      </>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Ngày thanh toán</label><input type="text" name="paymentDate" value={displayDate} onChange={handleDateChange} placeholder="dd/mm/yyyy" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Line</label><select name="line" value={formData.line || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all"><option value="">-- Chọn Line --</option>{carriers.map(c => (<option key={c} value={c}>{c}</option>))}</select></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Loại thanh toán</label><select name="paymentType" value={formData.paymentType || 'Local charge'} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all"><option value="Local charge">Local charge</option><option value="Deposit">Deposit</option><option value="Demurage">Demurage</option></select></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Số tiền</label><input type="text" name="amount" value={displayAmount} onChange={handleAmountChange} placeholder="0" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">MBL</label><input type="text" name="mbl" value={formData.mbl || ''} onChange={handleChange} placeholder="Master Bill of Lading" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Số tài khoản</label><input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} placeholder="Số tài khoản" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all font-mono" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Note</label><input type="text" name="note" value={formData.note || ''} onChange={handleChange} placeholder="Ghi chú..." className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Wire Off</label><select name="wireOffStatus" value={formData.wireOffStatus || 'Pending'} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all"><option value="Pending">Pending</option><option value="Wired Off">Wired Off</option></select></div>
                  </div>
                </div>
                <div className="w-full lg:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-slate-700 flex items-center gap-2"><FileText className="w-5 h-5 text-teal-600" />Chi tiết các phí</h4><div className="flex items-center gap-2"><button onClick={handleAddFee} className="text-xs flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md transition-colors"><Plus className="w-3 h-3" />Thêm</button><button onClick={handleSyncFees} disabled={isExtracting} className="text-xs flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-md transition-colors disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />Đồng bộ</button></div></div>
                  {formData.fees && formData.fees.length > 0 ? (
                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-slate-500 uppercase border-b border-slate-200"><tr><th className="text-left py-2 font-semibold">Tên phí</th><th className="text-right py-2 font-semibold w-24">Số tiền</th><th className="text-right py-2 font-semibold w-20">USD</th><th className="w-6"></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {formData.fees.map((fee, idx) => (<tr key={idx} className="group"><td className="py-2 text-slate-700"><FeeNameInput value={fee.name} onChange={(val) => handleFeeChange(idx, 'name', val)} /></td><td className="py-2 text-slate-900 font-medium text-right"><input type="text" value={fee.amount === 0 ? '' : fee.amount.toLocaleString('vi-VN')} onChange={(e) => handleFeeChange(idx, 'amount', e.target.value)} placeholder="0" className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-right transition-colors" /></td><td className="py-2 text-slate-900 font-medium text-right"><input type="text" value={fee.usdAmount || ''} onChange={(e) => handleFeeChange(idx, 'usdAmount', e.target.value)} placeholder="0.00" className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-right transition-colors" /></td><td className="py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleRemoveFee(idx)} className="text-red-400 hover:text-red-600 transition-colors"><X className="w-4 h-4" /></button></td></tr>))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 font-bold"><tr><td className="py-2 text-slate-700 pt-3">Tổng cộng</td><td className="py-2 text-teal-700 text-right pt-3">{formData.fees.reduce((sum, fee) => sum + fee.amount, 0).toLocaleString('vi-VN')}</td><td className="py-2 text-teal-700 text-right pt-3"></td><td></td></tr></tfoot>
                      </table>
                    </div>
                  ) : (<div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm italic text-center p-8 border-2 border-dashed border-slate-200 rounded-lg"><p className="mb-2">Chưa có dữ liệu chi tiết phí.</p><button onClick={handleAddFee} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors not-italic font-medium"><Plus className="w-3 h-3" />Thêm phí thủ công</button></div>)}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={handleCloseModal} className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors">Hủy</button>
              <button onClick={handleSave} disabled={isExtracting || isUploading} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"><Save className="w-4 h-4" />{editingNote ? 'Cập nhật' : 'Lưu Debit Note'}</button>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-100"><h3 className="text-xl font-bold text-slate-800">Cài đặt</h3><button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button></div>
            <div className="flex border-b border-slate-200">
              <button className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === 'rates' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`} onClick={() => setSettingsTab('rates')}>Tỷ giá</button>
              <button className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === 'carriers' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`} onClick={() => setSettingsTab('carriers')}>Carrier</button>
            </div>
            <div className="p-6 space-y-4">
              {settingsTab === 'rates' ? (<>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Ngày áp dụng</label><input type="text" value={displaySettingsDate} onChange={handleSettingsDateChange} placeholder="dd/mm/yyyy" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Tỷ giá (VND/USD)</label><input type="number" value={settingsRate} onChange={(e) => setSettingsRate(e.target.value)} placeholder="VD: 25000" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all" /></div>
                  {Object.keys(exchangeRates).length > 0 && (<div className="mt-6 pt-6 border-t border-slate-100"><h4 className="text-sm font-bold text-slate-700 mb-3">Danh sách tỷ giá</h4><div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg"><table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0"><tr><th className="text-left py-2 px-3 font-semibold text-slate-600">Ngày</th><th className="text-right py-2 px-3 font-semibold text-slate-600">Tỷ giá</th><th className="w-10"></th></tr></thead><tbody className="divide-y divide-slate-100">{Object.entries(exchangeRates).sort(([dateA], [dateB]) => dateB.localeCompare(dateA)).map(([date, rate]) => (<tr key={date} className="hover:bg-slate-50"><td className="py-2 px-3 text-slate-700">{date}</td><td className="py-2 px-3 text-slate-900 font-medium text-right">{Number(rate).toLocaleString('vi-VN')}</td><td className="py-2 px-3 text-right"><button onClick={() => { setExchangeRates(prev => { const next = { ...prev }; delete next[date]; return next; }); }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></div>)}
                </>) : (<>
                  <div className="flex gap-2"><input type="text" value={newCarrier} onChange={(e) => setNewCarrier(e.target.value)} placeholder="Mã Line mới..." className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none transition-all uppercase" /><button onClick={() => { if (newCarrier.trim()) { const val = newCarrier.trim().toUpperCase(); if (!carriers.includes(val)) { setCarriers([...carriers, val].sort((a, b) => a.localeCompare(b))); setNewCarrier(''); } } }} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Thêm</button></div>
                  {carriers.length > 0 && (<div className="mt-4 border border-slate-200 rounded-lg overflow-hidden"><div className="max-h-60 overflow-y-auto custom-scrollbar"><table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0"><tr><th className="text-left py-2 px-3 font-semibold text-slate-600">Mã Line</th><th className="w-10"></th></tr></thead><tbody className="divide-y divide-slate-100">{carriers.map((carrier) => (<tr key={carrier} className="hover:bg-slate-50"><td className="py-2 px-3 text-slate-900 font-medium">{carrier}</td><td className="py-2 px-3 text-right"><button onClick={() => setCarriers(carriers.filter(c => c !== carrier))} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></div>)}
                </>)}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl"><button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors">Đóng</button>{settingsTab === 'rates' && (<button onClick={handleSaveSettings} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"><Save className="w-4 h-4" />Lưu Tỷ Giá</button>)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
