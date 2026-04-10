
import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Inbox, 
  Send, 
  Trash2, 
  Search, 
  RefreshCw, 
  Plus, 
  X, 
  Paperclip, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Star,
  Archive,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  ArrowLeft,
  FileText,
  RotateCcw,
  Download,
  ExternalLink,
  Eye,
  Flag,
  Check
} from 'lucide-react';
import { EmailMessage, EmailConfig } from '../types';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';

const BACKEND_URL = window.location.origin + "/api";

export const EmailPage: React.FC = () => {
  const { alert, confirm } = useNotification();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'INBOX' | 'SENT' | 'TRASH'>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [limit, setLimit] = useState(50);
  const [totalUnread, setTotalUnread] = useState(0);
  const [previewFile, setPreviewFile] = useState<{ name: string, contentType: string, url: string } | null>(null);
  const attachmentScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollAttachments = (direction: 'left' | 'right') => {
    if (attachmentScrollRef.current) {
      const scrollAmount = 200;
      attachmentScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [activeFolder, limit]);

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/emails?folder=${activeFolder}&limit=${limit}`);
      if (res.data && res.data.success) {
        setEmails(res.data.emails);
        if (activeFolder === 'INBOX') {
          setTotalUnread(res.data.totalUnread || 0);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch emails", err);
      const errorMsg = err.response?.data?.message || err.message;
      alert(`Lỗi Kết Nối: Không thể tải email: ${errorMsg}\n\nVui lòng kiểm tra cấu hình mail trong mục Hệ thống.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      alert("Thông báo: Vui lòng điền đầy đủ thông tin người nhận, tiêu đề và nội dung.");
      return;
    }

    setIsSending(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/emails/send`, {
        to: composeTo,
        subject: composeSubject,
        body: composeBody
      });

      if (res.data && res.data.success) {
        alert("Thành công: Email đã được gửi thành công!");
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        if (activeFolder === 'SENT') fetchEmails();
      } else {
        alert(res.data.message || "Gửi email thất bại.", "Lỗi");
      }
    } catch (err) {
      console.error("Send email error", err);
      alert("Lỗi khi gửi email. Vui lòng kiểm tra lại cấu hình SMTP.", "Lỗi");
    } finally {
      setIsSending(false);
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUnread = filterUnread ? !email.isRead : true;
    
    return matchesSearch && matchesUnread;
  });

  const handleViewAttachment = (file: { name: string, contentType: string }) => {
    if (!selectedEmail) return;
    const url = `${BACKEND_URL}/emails/attachment?uid=${selectedEmail.uid}&folder=${activeFolder}&filename=${encodeURIComponent(file.name)}`;
    setPreviewFile({ ...file, url });
  };

  const handleToggleFlag = async (email: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const action = email.isFlagged ? 'remove' : 'add';
      await axios.post(`${BACKEND_URL}/emails/flags`, {
        uid: email.uid,
        folder: activeFolder,
        flags: ['\\Flagged'],
        action
      });
      // Update local state
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isFlagged: !email.isFlagged } : e));
    } catch (err) {
      console.error("Failed to toggle flag", err);
    }
  };

  const handleMarkAsRead = async (email: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.isRead) return;
    try {
      await axios.post(`${BACKEND_URL}/emails/flags`, {
        uid: email.uid,
        folder: activeFolder,
        flags: ['\\Seen'],
        action: 'add'
      });
      // Update local state
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
      setTotalUnread(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg">
            <Mail className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Hộp thư Email</h1>
            <p className="text-xs text-slate-500">Quản lý thư đến và đi của bạn</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm email..."
              className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-teal-500 rounded-xl text-sm w-64 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setFilterUnread(!filterUnread)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${filterUnread ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <AlertCircle className="w-4 h-4" />
            {filterUnread ? 'Đang lọc: Chưa đọc' : 'Tất cả thư'}
          </button>
          <button 
            onClick={fetchEmails}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all"
          >
            <Plus className="w-5 h-5" /> Soạn thư
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveFolder('INBOX')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeFolder === 'INBOX' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Inbox className="w-5 h-5" />
            <span>Hộp thư đến</span>
            {totalUnread > 0 && (
              <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveFolder('SENT')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeFolder === 'SENT' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Send className="w-5 h-5" />
            <span>Đã gửi</span>
          </button>
          <button 
            onClick={() => setActiveFolder('TRASH')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeFolder === 'TRASH' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Trash2 className="w-5 h-5" />
            <span>Thùng rác</span>
          </button>
          
          <div className="mt-8 px-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Nhãn</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Công việc</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span>Quan trọng</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span>Cá nhân</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className={`flex-1 flex flex-col bg-white overflow-hidden ${selectedEmail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 opacity-20" />
                </div>
                <p className="font-medium">Không có email nào</p>
                <p className="text-xs">Hộp thư của bạn hiện đang trống</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEmails.map((email) => (
                  <div 
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`group flex items-start gap-4 p-4 cursor-pointer transition-all hover:bg-slate-50 ${email.isFlagged ? 'bg-orange-50' : !email.isRead ? 'bg-blue-50/30' : ''} ${selectedEmail?.id === email.id ? 'bg-teal-50/50 border-l-4 border-l-teal-500' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${!email.isRead ? 'bg-gradient-to-tr from-blue-500 to-teal-400' : 'bg-slate-300'}`}>
                        {email.from.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`text-sm truncate ${!email.isRead ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                          {email.from}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className={`text-sm truncate mb-1 ${!email.isRead ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                        {email.subject}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {email.body}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleToggleFlag(email, e)}
                        className={`p-1 transition-colors ${email.isFlagged ? 'text-orange-500' : 'text-slate-400 hover:text-orange-500'}`}
                        title="Đánh dấu"
                      >
                        <Flag className={`w-4 h-4 ${email.isFlagged ? 'fill-orange-500' : ''}`} />
                      </button>
                      {!email.isRead && (
                        <button 
                          onClick={(e) => handleMarkAsRead(email, e)}
                          className="p-1 text-slate-400 hover:text-teal-500 transition-colors"
                          title="Đọc mail"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {emails.length >= limit && (
                  <div className="p-4 flex justify-center">
                    <button 
                      onClick={() => setLimit(prev => prev + 50)}
                      className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Xem thêm email cũ hơn
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Email Content */}
        {selectedEmail && (
          <div className="flex-[2] bg-white border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/30 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="lg:hidden p-2 text-slate-600 hover:bg-slate-200 rounded-lg flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div ref={attachmentScrollRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 ? (
                    selectedEmail.attachments.map((file, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleViewAttachment(file)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-teal-50 hover:border-teal-200 transition-all whitespace-nowrap shadow-sm flex-shrink-0"
                        title={file.name}
                      >
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">{file.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 italic text-xs flex-shrink-0">
                      <Paperclip className="w-3.5 h-3.5 opacity-50" />
                      Không có tệp đính kèm
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button 
                  onClick={() => scrollAttachments('left')}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Cuộn trái"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => scrollAttachments('right')}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Cuộn phải"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">{selectedEmail.subject}</h2>
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {selectedEmail.from.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{selectedEmail.from}</span>
                      <span className="text-xs text-slate-400">&lt;{selectedEmail.from.toLowerCase().replace(' ', '.')}@gmail.com&gt;</span>
                    </div>
                    <p className="text-xs text-slate-500">Tới: {selectedEmail.to}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-600">
                    {new Date(selectedEmail.timestamp).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(selectedEmail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedEmail.body}
              </div>

              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Tệp đính kèm ({selectedEmail.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedEmail.attachments.map((file, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleViewAttachment(file)}
                        className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-teal-50 hover:border-teal-200 transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                          <FileText className="w-5 h-5 text-slate-500 group-hover:text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-teal-700">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <RefreshCw className="w-4 h-4 text-teal-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
              <div className="flex gap-3">
                <button className="flex-1 py-3 bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Trả lời
                </button>
                <button className="flex-1 py-3 bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Chuyển tiếp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 truncate max-w-md">{previewFile.name}</h3>
                  <p className="text-xs text-slate-500">{previewFile.contentType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewFile.url} 
                  download={previewFile.name}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Tải về"
                >
                  <Download className="w-5 h-5" />
                </a>
                <a 
                  href={previewFile.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-4">
              {previewFile.contentType.startsWith('image/') ? (
                <img 
                  src={previewFile.url} 
                  alt={previewFile.name} 
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : previewFile.contentType === 'application/pdf' ? (
                <iframe 
                  src={previewFile.url} 
                  className="w-full h-full rounded-lg shadow-lg bg-white"
                  title="PDF Preview"
                ></iframe>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <FileText className="w-10 h-10 opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Không hỗ trợ xem trước loại tệp này</p>
                    <p className="text-sm">Vui lòng tải về hoặc mở trong tab mới để xem</p>
                  </div>
                  <a 
                    href={previewFile.url} 
                    download={previewFile.name}
                    className="mt-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Tải về ngay
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 pointer-events-none">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col pointer-events-auto animate-in slide-in-from-bottom-8 duration-300 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="font-bold">Thư mới</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsComposeOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex flex-col flex-1 p-6 gap-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
                <span className="text-sm font-medium text-slate-400 w-12">Tới</span>
                <input 
                  type="text" 
                  className="flex-1 text-sm outline-none"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
                <span className="text-sm font-medium text-slate-400 w-12">Tiêu đề</span>
                <input 
                  type="text" 
                  className="flex-1 text-sm outline-none"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
              <textarea 
                className="flex-1 text-sm outline-none resize-none min-h-[300px]"
                placeholder="Nội dung thư..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              ></textarea>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50"
                  onClick={handleSendEmail}
                  disabled={isSending}
                >
                  {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Gửi ngay
                </button>
                <button className="p-2.5 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={() => setIsComposeOpen(false)}
                className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
