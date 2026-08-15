import React, { useState, useEffect } from 'react';
import { 
  Key, Plus, Check, Copy, Trash2, Edit3, ShieldCheck, 
  ExternalLink, Sparkles, AlertCircle, CheckCircle2, 
  Loader2, Eye, EyeOff, RefreshCw, Download, Upload,
  Zap, Info, Clock, CheckCircle
} from 'lucide-react';
import { ApiKeyItem } from '../types';
import { 
  getStoredApiKeys, 
  saveStoredApiKey, 
  updateStoredApiKey, 
  deleteStoredApiKey, 
  setActiveApiKey, 
  getActiveApiKey,
  maskApiKey,
  testGeminiApiKey,
  subscribeApiKeyChanges
} from '../utils/apiKeyManager';
import { useNotification } from '../contexts/NotificationContext';

interface ApiKeysPageProps {
  onNavigate?: (page: string) => void;
}

export const ApiKeysPage: React.FC<ApiKeysPageProps> = ({ onNavigate }) => {
  const { alert, confirm } = useNotification();
  
  const [keys, setKeys] = useState<ApiKeyItem[]>(() => getStoredApiKeys());
  const [activeKey, setActiveKeyState] = useState<string>(() => getActiveApiKey());
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  
  // Form States
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formProvider, setFormProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'other'>('gemini');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [showKeyInForm, setShowKeyInForm] = useState(false);

  // Testing Key State
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  
  // Visibility toggles for list
  const [visibleKeyIds, setVisibleKeyIds] = useState<Set<string>>(new Set());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Sync with storage events
  useEffect(() => {
    const unsubscribe = subscribeApiKeyChanges(() => {
      setKeys(getStoredApiKeys());
      setActiveKeyState(getActiveApiKey());
    });
    return unsubscribe;
  }, []);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyKey = (id: string, keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleOpenAddModal = () => {
    setEditingKeyId(null);
    setFormName(`Gemini Key ${keys.length + 1}`);
    setFormKey('');
    setFormProvider('gemini');
    setFormNotes('');
    setFormIsActive(keys.length === 0);
    setShowKeyInForm(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ApiKeyItem) => {
    setEditingKeyId(item.id);
    setFormName(item.name);
    setFormKey(item.key);
    setFormProvider(item.provider || 'gemini');
    setFormNotes(item.notes || '');
    setFormIsActive(!!item.isActive);
    setShowKeyInForm(false);
    setIsModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = formKey.trim();
    if (!cleanKey) {
      await alert('Vui lòng nhập giá trị API Key!', 'Cảnh báo');
      return;
    }

    if (editingKeyId) {
      updateStoredApiKey(editingKeyId, {
        name: formName.trim() || 'Gemini Key',
        key: cleanKey,
        provider: formProvider,
        notes: formNotes.trim(),
        isActive: formIsActive
      });
      await alert('Đã cập nhật thông tin API Key!', 'Thành công');
    } else {
      saveStoredApiKey({
        name: formName.trim() || `Gemini Key ${keys.length + 1}`,
        key: cleanKey,
        provider: formProvider,
        notes: formNotes.trim(),
        isActive: formIsActive || keys.length === 0
      });
      await alert('Đã thêm API Key mới thành công!', 'Thành công');
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (item: ApiKeyItem) => {
    const ok = await confirm(`Bạn có chắc chắn muốn xóa key "${item.name}" khỏi danh sách?`, 'Xác nhận xóa');
    if (ok) {
      deleteStoredApiKey(item.id);
      await alert('Đã xóa API Key.', 'Thông báo');
    }
  };

  const handleSetActive = async (item: ApiKeyItem) => {
    setActiveApiKey(item.key, item.id);
    await alert(`Đã kích hoạt "${item.name}" làm Key chính cho toàn bộ ứng dụng!`, 'Kích hoạt thành công');
  };

  const handleTestKey = async (item: ApiKeyItem) => {
    setTestingKeyId(item.id);
    const res = await testGeminiApiKey(item.key);
    setTestResults(prev => ({ ...prev, [item.id]: res }));
    setTestingKeyId(null);
  };

  // Export JSON
  const handleExportKeys = async () => {
    if (keys.length === 0) {
      await alert('Chưa có API Key nào để xuất file.', 'Thông báo');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(keys, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gemini_api_keys_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportKeys = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          let count = 0;
          imported.forEach((k: any) => {
            if (k.key && typeof k.key === 'string') {
              saveStoredApiKey({
                name: k.name || `Imported Key ${count + 1}`,
                key: k.key,
                provider: k.provider || 'gemini',
                notes: k.notes || 'Nhập từ file JSON',
                isActive: false
              });
              count++;
            }
          });
          await alert(`Đã nhập thành công ${count} API Keys!`, 'Thành công');
        } else {
          await alert('File JSON không đúng định dạng danh sách API Key.', 'Lỗi file');
        }
      } catch (err) {
        await alert('Không thể đọc file JSON. Vui lòng kiểm tra lại.', 'Lỗi');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeKeyItem = keys.find(k => k.isActive || k.key === activeKey);

  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 p-3 md:p-6 space-y-6 pb-24">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              Quản Lý Key API (Gemini / AI)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Lưu trữ danh sách API Key cá nhân để chuyển đổi nhanh khi quét tài liệu CVHC & công cụ AI
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noreferrer"
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            Lấy Key Miễn Phí (Google AI Studio)
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

          <button
            onClick={handleExportKeys}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-1"
            title="Xuất danh sách keys ra file JSON"
          >
            <Download className="w-4 h-4 text-slate-600" />
          </button>

          <label 
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-1"
            title="Nhập danh sách keys từ file JSON"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <input type="file" accept=".json" onChange={handleImportKeys} className="hidden" />
          </label>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Thêm Key Mới
          </button>
        </div>
      </div>

      {/* ACTIVE KEY SPOTLIGHT BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-xl border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-start space-x-4 z-10">
          <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Key Đang Kích Hoạt Mặc Định
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-ping"></span>
                Active
              </span>
            </div>
            
            <h2 className="text-lg md:text-xl font-bold mt-1 text-white flex items-center gap-2">
              {activeKeyItem ? activeKeyItem.name : (activeKey ? 'API Key Thủ Công' : 'Chưa có Key kích hoạt')}
            </h2>

            <p className="text-xs text-slate-300 font-mono mt-1 flex items-center gap-2">
              {activeKey ? (
                <>
                  <span>{maskApiKey(activeKey)}</span>
                  <button 
                    onClick={() => handleCopyKey('active', activeKey)} 
                    className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
                    title="Sao chép Key"
                  >
                    {copiedKeyId === 'active' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : (
                <span className="text-slate-400 italic">Vui lòng thêm hoặc chọn 1 Key bên dưới để bắt đầu sử dụng.</span>
              )}
            </p>
          </div>
        </div>

        {activeKey && (
          <div className="flex items-center gap-2 z-10 w-full md:w-auto justify-end">
            <button
              onClick={() => handleTestKey({ id: 'active', name: 'Active Key', key: activeKey, provider: 'gemini', createdAt: '' })}
              disabled={testingKeyId === 'active'}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {testingKeyId === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Kiểm Tra Key
            </button>
          </div>
        )}
      </div>

      {testResults['active'] && (
        <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
          testResults['active'].success 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {testResults['active'].success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{testResults['active'].message}</span>
        </div>
      )}

      {/* QUICK GUIDE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Nhận Key Miễn Phí</h4>
            <p className="text-xs text-slate-500 mt-1">
              Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline">Google AI Studio</a>, đăng nhập tài khoản Google và bấm "Create API key".
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Lưu Nhiều Key Dự Phòng</h4>
            <p className="text-xs text-slate-500 mt-1">
              Lưu 2-3 key từ các tài khoản Google khác nhau. Khi một key đạt giới hạn (15 RPM), bạn có thể chuyển nhanh sang key khác.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">3. Bảo Mật Cục Bộ</h4>
            <p className="text-xs text-slate-500 mt-1">
              Tất cả API Key được mã hóa lưu trữ trực tiếp trong trình duyệt (LocalStorage) của bạn, không gửi về bất kỳ máy chủ trung gian nào.
            </p>
          </div>
        </div>
      </div>

      {/* API KEYS LIST SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-800">Danh Sách API Keys Đã Lưu ({keys.length})</h3>
          </div>
          <span className="text-xs text-slate-500">
            Bấm "Chọn Dùng" để chuyển đổi key kích hoạt cho hệ thống
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Key className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-700">Chưa có API Key nào được lưu</h4>
            <p className="text-sm text-slate-500 max-w-md">
              Hãy thêm API Key của bạn để sử dụng các tính năng thông minh như quét số Bill CVHC tự động hoặc Tool AI.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Thêm Key Đầu Tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {keys.map((item, index) => {
              const isItemActive = item.isActive || item.key === activeKey;
              const isVisible = visibleKeyIds.has(item.id);
              const testResult = testResults[item.id];
              const isTesting = testingKeyId === item.id;

              return (
                <div 
                  key={item.id} 
                  className={`p-4 md:p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isItemActive ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isItemActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Key className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm md:text-base truncate">
                          {item.name}
                        </span>
                        
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          {item.provider || 'gemini'}
                        </span>

                        {isItemActive && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Đang dùng
                          </span>
                        )}
                      </div>

                      {/* Key Value with Mask and Actions */}
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-600 bg-slate-100/80 px-2.5 py-1.5 rounded-lg w-fit border border-slate-200/60 max-w-full overflow-hidden">
                        <span className="truncate">
                          {isVisible ? item.key : maskApiKey(item.key)}
                        </span>
                        
                        <button
                          onClick={() => toggleKeyVisibility(item.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                          title={isVisible ? "Ẩn Key" : "Xem đầy đủ Key"}
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleCopyKey(item.id, item.key)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                          title="Sao chép Key"
                        >
                          {copiedKeyId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-500 italic mt-0.5">
                          Ghi chú: {item.notes}
                        </p>
                      )}

                      {testResult && (
                        <div className={`mt-1 text-xs font-medium flex items-center gap-1.5 ${
                          testResult.success ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleTestKey(item)}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      title="Kiểm tra trạng thái kết nối và Quota của Key này"
                    >
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
                      Test
                    </button>

                    {!isItemActive ? (
                      <button
                        onClick={() => handleSetActive(item)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Chọn Dùng
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 opacity-90 cursor-default"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Đang Chọn
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <Key className="w-5 h-5" />
                <span className="font-bold text-lg">
                  {editingKeyId ? 'Chỉnh Sửa API Key' : 'Thêm API Key Mới'}
                </span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tên Gợi Nhớ Key <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Gemini Free 1, Key Cá Nhân Gmail Dan..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400">Gợi ý:</span>
                  {['Gemini Free 1', 'Gemini Flash Dự phòng', 'Key Công Ty', 'Key Cá Nhân'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormName(tag)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Giá Trị API Key <span className="text-red-500">*</span></span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setFormKey(text.trim());
                      } catch {}
                    }}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                  >
                    <Copy className="w-3 h-3" /> Dán từ Clipboard
                  </button>
                </label>
                <div className="relative">
                  <input 
                    type={showKeyInForm ? 'text' : 'password'}
                    required
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyInForm(!showKeyInForm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showKeyInForm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nhà Cung Cấp
                  </label>
                  <select
                    value={formProvider}
                    onChange={(e: any) => setFormProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="gemini">Google Gemini AI</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Claude Anthropic</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ghi Chú
                  </label>
                  <input 
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Tài khoản, hạn mức..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center space-x-2.5 cursor-pointer pt-1">
                <input 
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-slate-700">
                  Đặt làm Key kích hoạt mặc định ngay sau khi lưu
                </span>
              </label>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingKeyId ? 'Lưu Thay Đổi' : 'Thêm Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
