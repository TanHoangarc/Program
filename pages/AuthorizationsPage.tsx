import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Customer, AuthorizationData } from '../types';
import { 
  Plus, Edit2, Trash2, Search, Save, X, Upload, Calendar, 
  AlertTriangle, FileText, CheckCircle, Eye, UserCheck, 
  FileCheck, ArrowRight, Loader2, ArrowUpDown
} from 'lucide-react';
import { getPaginationRange } from '../utils';
import { useNotification } from '../contexts/NotificationContext';
import { CustomerModal } from '../components/CustomerModal';
import { YEARS } from '../constants';
import axios from 'axios';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const BACKEND_URL = "https://api.kimberry.id.vn";

// Wipe out kb_authorizations_v1 from localStorage immediately upon import
try {
  localStorage.removeItem('kb_authorizations_v1');
} catch (e) {
  console.error("Error clearing kb_authorizations_v1 from localStorage:", e);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AuthorizationsPageProps {
  authorizations: AuthorizationData[];
  customers: Customer[];
  onAddAuthorization: (auth: AuthorizationData) => void;
  onUpdateAuthorization: (auth: AuthorizationData) => void;
  onDeleteAuthorization: (id: string) => void;
  onAddCustomer: (c: Customer) => void;
}

export const AuthorizationsPage: React.FC<AuthorizationsPageProps> = ({
  authorizations,
  customers,
  onAddAuthorization,
  onUpdateAuthorization,
  onDeleteAuthorization,
  onAddCustomer
}) => {
  const { alert, confirm } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  
  // Firestore state
  const [authorizationsList, setAuthorizationsList] = useState<AuthorizationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editingAuth, setEditingAuth] = useState<AuthorizationData | null>(null);
  
  // Inner Customer Modal State for Quick Add
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustomerTarget, setQuickCustomerTarget] = useState<'principal' | 'agent' | null>(null);

  // Form State
  const [formPrincipalId, setFormPrincipalId] = useState('');
  const [formAgentId, setFormAgentId] = useState('');
  const [principalSearch, setPrincipalSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [showPrincipalSuggestions, setShowPrincipalSuggestions] = useState(false);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [formYear, setFormYear] = useState<number>(() => new Date().getFullYear());
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  
  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggestions refs for clicking outside
  const principalContainerRef = useRef<HTMLDivElement>(null);
  const agentContainerRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sorted customer list for easy lookup
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  }, [customers]);

  // Load authorizations from Firestore in real-time
  useEffect(() => {
    try {
      localStorage.removeItem('kb_authorizations_v1');
    } catch (e) {}

    const q = query(collection(db, 'authorizations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AuthorizationData[] = [];
      snapshot.forEach((doc) => {
        const item = doc.data();
        list.push({
          id: doc.id,
          principalId: item.principalId || '',
          agentId: item.agentId || '',
          expiryDate: item.expiryDate || '',
          attachmentUrl: item.attachmentUrl || undefined,
          attachmentName: item.attachmentName || undefined,
          year: Number(item.year) || (item.expiryDate ? Number(item.expiryDate) : new Date().getFullYear()),
          createdAt: item.createdAt || new Date().toISOString()
        });
      });
      setAuthorizationsList(list);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'authorizations');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Click outside listener to dismiss auto-suggest dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (principalContainerRef.current && !principalContainerRef.current.contains(event.target as Node)) {
        setShowPrincipalSuggestions(false);
      }
      if (agentContainerRef.current && !agentContainerRef.current.contains(event.target as Node)) {
        setShowAgentSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Generate years list starting from current year
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const effectiveYears = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => currentYear + i);
  }, [currentYear]);

  // Filter principal suggestions
  const principalSuggestions = useMemo(() => {
    const s = principalSearch.toLowerCase().trim();
    if (!s) return sortedCustomers.slice(0, 30);
    return sortedCustomers.filter(c => 
      String(c.code || '').toLowerCase().includes(s) || 
      String(c.name || '').toLowerCase().includes(s)
    ).slice(0, 30);
  }, [principalSearch, sortedCustomers]);

  // Filter agent suggestions
  const agentSuggestions = useMemo(() => {
    const s = agentSearch.toLowerCase().trim();
    if (!s) return sortedCustomers.slice(0, 30);
    return sortedCustomers.filter(c => 
      String(c.code || '').toLowerCase().includes(s) || 
      String(c.name || '').toLowerCase().includes(s)
    ).slice(0, 30);
  }, [agentSearch, sortedCustomers]);

  // Status calculation helper based on the authorization's year
  const getStatus = (yearVal: number) => {
    if (!yearVal) return { label: 'Chưa rõ', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    const cy = new Date().getFullYear();

    if (yearVal < cy) {
      return { label: 'Hết hạn', color: 'bg-rose-50 text-rose-700 border border-rose-200' };
    }

    if (yearVal === cy) {
      return { label: 'Còn hiệu lực', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    }

    return { label: `Có hiệu lực (${yearVal})`, color: 'bg-blue-50 text-blue-700 border border-blue-200' };
  };

  // Helper to get Customer display properties
  const getCustomerDisplay = (id: string) => {
    const cust = customers.find(c => c.id === id || c.code === id || c.name === id);
    if (!cust) return { code: id || '?', name: '' };
    return { code: cust.code, name: cust.name };
  };

  // Filter authorizations
  const filteredAuths = useMemo(() => {
    return authorizationsList
      .filter(auth => {
        // Search matching
        const principal = customers.find(c => c.id === auth.principalId || c.code === auth.principalId);
        const agent = customers.find(c => c.id === auth.agentId || c.code === auth.agentId);
        const s = searchTerm.toLowerCase().trim();
        
        const matchSearch = !s || 
          (principal?.code || '').toLowerCase().includes(s) ||
          (principal?.name || '').toLowerCase().includes(s) ||
          (agent?.code || '').toLowerCase().includes(s) ||
          (agent?.name || '').toLowerCase().includes(s) ||
          auth.principalId.toLowerCase().includes(s) ||
          auth.agentId.toLowerCase().includes(s) ||
          (auth.attachmentName || '').toLowerCase().includes(s);

        // Year filter matching
        const authYear = auth.year || (auth.expiryDate ? Number(auth.expiryDate) : new Date().getFullYear());
        const matchYear = selectedYear === 'All' || String(authYear) === selectedYear;

        return matchSearch && matchYear;
      })
      .sort((a, b) => {
        const yearA = a.year || (a.expiryDate ? Number(a.expiryDate) : 0);
        const yearB = b.year || (b.expiryDate ? Number(b.expiryDate) : 0);
        return yearB - yearA;
      });
  }, [authorizationsList, customers, searchTerm, selectedYear]);

  // Paginated authorizations
  const totalPages = Math.ceil(filteredAuths.length / ITEMS_PER_PAGE);
  const paginatedAuths = useMemo(() => {
    return filteredAuths.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredAuths, currentPage]);

  const paginationRange = getPaginationRange(currentPage, totalPages);

  // Open modal for creating new
  const handleAddNew = () => {
    setEditingAuth(null);
    setFormPrincipalId('');
    setFormAgentId('');
    setPrincipalSearch('');
    setAgentSearch('');
    setFormYear(new Date().getFullYear());
    setAttachmentUrl('');
    setAttachmentName('');
    setIsAuthModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (auth: AuthorizationData) => {
    setEditingAuth(auth);
    setFormPrincipalId(auth.principalId);
    setFormAgentId(auth.agentId);
    
    const pCust = customers.find(c => c.id === auth.principalId || c.code === auth.principalId);
    setPrincipalSearch(pCust ? `${pCust.code} - ${pCust.name}` : auth.principalId);

    const aCust = customers.find(c => c.id === auth.agentId || c.code === auth.agentId);
    setAgentSearch(aCust ? `${aCust.code} - ${aCust.name}` : auth.agentId);

    const authYear = auth.year || (auth.expiryDate ? Number(auth.expiryDate) : new Date().getFullYear());
    setFormYear(authYear);
    setAttachmentUrl(auth.attachmentUrl || '');
    setAttachmentName(auth.attachmentName || '');
    setIsAuthModalOpen(true);
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (await confirm("Bạn có chắc chắn muốn xóa ủy quyền này?", "Xác nhận xóa")) {
      try {
        await deleteDoc(doc(db, 'authorizations', id));
        alert("Đã xóa ủy quyền thành công", "Thành công");
      } catch (err) {
        console.error("Error deleting authorization:", err);
        handleFirestoreError(err, OperationType.DELETE, `authorizations/${id}`);
        alert("Có lỗi xảy ra khi xóa ủy quyền!", "Lỗi");
      }
    }
  };

  // Quick Add Customer Handler
  const handleOpenQuickCustomer = (target: 'principal' | 'agent') => {
    setQuickCustomerTarget(target);
    setIsQuickCustomerOpen(true);
  };

  const handleSaveQuickCustomer = (customer: Customer) => {
    onAddCustomer(customer);
    if (quickCustomerTarget === 'principal') {
      setFormPrincipalId(customer.id);
      setPrincipalSearch(`${customer.code} - ${customer.name}`);
    } else if (quickCustomerTarget === 'agent') {
      setFormAgentId(customer.id);
      setAgentSearch(`${customer.code} - ${customer.name}`);
    }
    setIsQuickCustomerOpen(false);
    setQuickCustomerTarget(null);
    alert(`Đã thêm nhanh khách hàng: ${customer.code}`, "Thành công");
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("fileName", file.name);
      uploadFormData.append("file", file);

      const res = await axios.post(`${BACKEND_URL}/upload-cvhc`, uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        let uploadedUrl = res.data.cvhcUrl;
        if (uploadedUrl && !uploadedUrl.startsWith('http')) {
          uploadedUrl = `${BACKEND_URL}${uploadedUrl.startsWith('/') ? '' : '/'}${uploadedUrl}`;
        }
        setAttachmentUrl(uploadedUrl);
        setAttachmentName(res.data.fileName || file.name);
        alert("Upload file đính kèm thành công!", "Thành công");
      } else {
        alert(res.data?.message || "Không thể upload file đính kèm", "Thất bại");
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi khi kết nối upload server: " + err.message, "Thất bại");
    } finally {
      setIsUploading(false);
    }
  };

  // Save Authorization
  const handleSaveAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalPrincipal = formPrincipalId.trim() || principalSearch.trim();
    const finalAgent = formAgentId.trim() || agentSearch.trim();

    if (!finalPrincipal || !finalAgent || !formYear) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc (*)", "Yêu cầu");
      return;
    }

    if (finalPrincipal === finalAgent) {
      alert("Bên ủy quyền và Bên được ủy quyền không thể trùng nhau!", "Thông báo");
      return;
    }

    const authId = editingAuth ? editingAuth.id : Date.now().toString();
    const authData: AuthorizationData = {
      id: authId,
      principalId: finalPrincipal,
      agentId: finalAgent,
      expiryDate: String(formYear),
      attachmentUrl: attachmentUrl || undefined,
      attachmentName: attachmentName || undefined,
      year: formYear,
      createdAt: editingAuth?.createdAt || new Date().toISOString()
    };

    setIsSaving(true);
    try {
      const docRef = doc(db, 'authorizations', authId);
      await setDoc(docRef, {
        principalId: authData.principalId,
        agentId: authData.agentId,
        expiryDate: authData.expiryDate,
        attachmentUrl: authData.attachmentUrl || null,
        attachmentName: authData.attachmentName || null,
        year: authData.year,
        createdAt: authData.createdAt
      }, { merge: true });

      if (editingAuth) {
        alert("Cập nhật ủy quyền thành công!", "Thành công");
      } else {
        alert("Thêm mới ủy quyền thành công!", "Thành công");
      }
      setIsAuthModalOpen(false);
    } catch (err) {
      console.error("Error saving authorization:", err);
      handleFirestoreError(err, OperationType.WRITE, `authorizations/${authId}`);
      alert("Có lỗi xảy ra khi lưu ủy quyền!", "Lỗi");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-Suggest selection helper
  const handleSelectPrincipal = (cust: Customer) => {
    setFormPrincipalId(cust.id);
    setPrincipalSearch(`${cust.code} - ${cust.name}`);
    setShowPrincipalSuggestions(false);
  };

  const handleSelectAgent = (cust: Customer) => {
    setFormAgentId(cust.id);
    setAgentSearch(`${cust.code} - ${cust.name}`);
    setShowAgentSuggestions(false);
  };

  const handlePrincipalSearchChange = (val: string) => {
    setPrincipalSearch(val);
    setFormPrincipalId(val);
    setShowPrincipalSuggestions(true);
  };

  const handleAgentSearchChange = (val: string) => {
    setAgentSearch(val);
    setFormAgentId(val);
    setShowAgentSuggestions(true);
  };

  return (
    <div className="w-full h-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6 px-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-indigo-600" />
            <span>Quản lý Ủy Quyền (Power of Attorney)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý và tra cứu các văn bản ủy quyền, thời hạn hiệu lực</p>
        </div>

        <div className="flex space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="All">Tất Cả</option>
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddNew}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center hover:shadow-lg hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Thêm Ủy Quyền</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-5 rounded-2xl mb-6 mx-2 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm ủy quyền theo Mã, Tên bên ủy quyền, Bên được ủy quyền..."
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Main Authorizations Table */}
      <div className="glass-panel rounded-2xl overflow-hidden mx-2 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Bên ủy quyền</th>
                <th className="px-6 py-4 text-center w-12"><ArrowRight className="w-4 h-4 mx-auto text-slate-400" /></th>
                <th className="px-6 py-4">Bên được ủy quyền</th>
                <th className="px-6 py-4 text-center">Năm hiệu lực</th>
                <th className="px-6 py-4 text-center">Trạng thái</th>
                <th className="px-6 py-4">File đính kèm</th>
                <th className="px-6 py-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium bg-white">
                    <Loader2 className="w-10 h-10 mx-auto text-indigo-600 mb-2 animate-spin" />
                    Đang tải dữ liệu ủy quyền từ Firebase...
                  </td>
                </tr>
              ) : paginatedAuths.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium bg-white">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Không tìm thấy dữ liệu ủy quyền nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedAuths.map(auth => {
                  const pDisplay = getCustomerDisplay(auth.principalId);
                  const aDisplay = getCustomerDisplay(auth.agentId);
                  const authYear = auth.year || (auth.expiryDate ? Number(auth.expiryDate) : new Date().getFullYear());
                  const status = getStatus(authYear);

                  return (
                    <tr key={auth.id} className="hover:bg-slate-50 transition-colors bg-white">
                      {/* Principal */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded-md tracking-wider border border-blue-200">
                            {pDisplay.code}
                          </span>
                        </div>
                        {pDisplay.name && (
                          <div className="text-xs text-slate-500 mt-1 font-medium truncate max-w-[220px]" title={pDisplay.name}>
                            {pDisplay.name}
                          </div>
                        )}
                      </td>

                      {/* Direction Icon */}
                      <td className="px-6 py-4 text-center">
                        <ArrowRight className="w-4 h-4 mx-auto text-slate-400" />
                      </td>

                      {/* Agent */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase rounded-md tracking-wider border border-indigo-200">
                            {aDisplay.code}
                          </span>
                        </div>
                        {aDisplay.name && (
                          <div className="text-xs text-slate-500 mt-1 font-medium truncate max-w-[220px]" title={aDisplay.name}>
                            {aDisplay.name}
                          </div>
                        )}
                      </td>

                      {/* Year */}
                      <td className="px-6 py-4 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{authYear}</span>
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* File Link */}
                      <td className="px-6 py-4">
                        {auth.attachmentUrl ? (
                          <a
                            href={auth.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
                            title={auth.attachmentName || "Xem tài liệu"}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="max-w-[120px] truncate">{auth.attachmentName || "Xem File"}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không có file</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(auth)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(auth.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded-lg transition-colors border border-transparent hover:border-red-200"
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Trang {currentPage} / {totalPages} (Tổng {filteredAuths.length} dòng)
            </span>
            <div className="flex space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Trước
              </button>
              {paginationRange.map((p, idx) => (
                <button
                  key={idx}
                  disabled={p === '...'}
                  onClick={() => typeof p === 'number' && setCurrentPage(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    p === currentPage
                      ? 'bg-indigo-600 text-white border border-indigo-600'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  } ${p === '...' ? 'cursor-default' : ''}`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Authorizations Edit / Create Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-150 border border-slate-100 relative my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingAuth ? 'Cập Nhật Ủy Quyền' : 'Thêm Mới Ủy Quyền'}
              </h3>
              <button onClick={() => setIsAuthModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors" />
              </button>
            </div>

            <form onSubmit={handleSaveAuth} className="p-6 space-y-5">
              {/* Principal Customer Field */}
              <div className="space-y-1.5 relative" ref={principalContainerRef}>
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Bên Ủy Quyền (*)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenQuickCustomer('principal')}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm nhanh KH mới
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    value={principalSearch}
                    onChange={(e) => {
                      handlePrincipalSearchChange(e.target.value);
                    }}
                    onFocus={() => setShowPrincipalSuggestions(true)}
                    placeholder="Nhập tên bên ủy quyền hoặc chọn từ gợi ý..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    required
                  />
                  {principalSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrincipalSearch('');
                        setFormPrincipalId('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions List */}
                {showPrincipalSuggestions && principalSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-y-auto z-[200]">
                    {principalSuggestions.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectPrincipal(cust)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-800 mr-2">{cust.code}</span>
                          <span className="text-slate-600 text-xs font-medium">{cust.name}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase">
                          Khách Hàng
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Customer Field */}
              <div className="space-y-1.5 relative" ref={agentContainerRef}>
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Bên Được Ủy Quyền (*)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenQuickCustomer('agent')}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm nhanh KH mới
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => {
                      handleAgentSearchChange(e.target.value);
                    }}
                    onFocus={() => setShowAgentSuggestions(true)}
                    placeholder="Nhập tên bên được ủy quyền hoặc chọn từ gợi ý..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    required
                  />
                  {agentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setAgentSearch('');
                        setFormAgentId('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions List */}
                {showAgentSuggestions && agentSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-y-auto z-[200]">
                    {agentSuggestions.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectAgent(cust)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-800 mr-2">{cust.code}</span>
                          <span className="text-slate-600 text-xs font-medium">{cust.name}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase">
                          Khách Hàng
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Năm hiệu lực (*)
                </label>
                <select
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                >
                  {effectiveYears.map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>

              {/* Attachment File upload */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  File đính kèm
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf, .png, .jpg, .jpeg, .doc, .docx"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang upload...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Chọn File Đính Kèm</span>
                      </>
                    )}
                  </button>

                  {attachmentUrl ? (
                    <div className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-xs text-slate-700 font-semibold truncate">
                          {attachmentName}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 text-xs p-1 rounded-lg hover:bg-white"
                          title="Xem File"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => { setAttachmentUrl(''); setAttachmentName(''); }}
                          className="text-red-500 hover:text-red-700 text-xs p-1 rounded-lg hover:bg-white"
                          title="Xóa File"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic font-medium">Chưa chọn file đính kèm nào</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading || isSaving}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center hover:shadow-lg hover:brightness-110 transition-all disabled:opacity-75"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      <span>Lưu Ủy Quyền</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {isQuickCustomerOpen && (
        <CustomerModal
          isOpen={isQuickCustomerOpen}
          onClose={() => { setIsQuickCustomerOpen(false); setQuickCustomerTarget(null); }}
          onSave={handleSaveQuickCustomer}
          initialData={null}
        />
      )}
    </div>
  );
};
