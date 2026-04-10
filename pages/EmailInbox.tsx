
import React, { useState, useMemo } from 'react';
import { Mail, Search, Trash2, Star, Archive, Inbox, Send, AlertCircle, ChevronLeft, ChevronRight, Paperclip, Reply, Forward, MoreVertical, Filter, X, CheckCircle2, Clock, FileText, Plus, Download } from 'lucide-react';
import { EmailMessage } from '../types';
import { formatDateVN } from '../utils';

interface EmailInboxProps {
  emails: EmailMessage[];
  onUpdateEmail: (email: EmailMessage) => void;
  onDeleteEmail: (id: string) => void;
}

export const EmailInbox: React.FC<EmailInboxProps> = ({ emails, onUpdateEmail, onDeleteEmail }) => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'unread' | 'starred' | 'archived'>('inbox');

  const selectedEmail = useMemo(() => 
    emails.find(e => e.id === selectedEmailId), 
    [emails, selectedEmailId]
  );

  const filteredEmails = useMemo(() => {
    let result = emails;
    
    if (activeTab === 'unread') result = result.filter(e => !e.isRead);
    // Note: Starred and Archived would need fields in EmailMessage, adding them for UI demo
    // if (activeTab === 'starred') result = result.filter(e => e.isStarred);
    
    if (filterText) {
      const search = filterText.toLowerCase();
      result = result.filter(e => 
        e.subject.toLowerCase().includes(search) || 
        e.sender.toLowerCase().includes(search) || 
        e.content.toLowerCase().includes(search)
      );
    }
    
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [emails, activeTab, filterText]);

  const handleEmailClick = (email: EmailMessage) => {
    setSelectedEmailId(email.id);
    if (!email.isRead) {
      onUpdateEmail({ ...email, isRead: true });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteEmail(id);
    if (selectedEmailId === id) setSelectedEmailId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white/30 backdrop-blur-md rounded-3xl border border-white/40 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-7 h-7 text-indigo-600" />
            Hộp thư Email
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý thông báo và trao đổi qua email</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm email..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/40 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <button className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-16 md:w-64 border-r border-white/20 flex flex-col p-2 md:p-4 gap-1 bg-slate-50/30">
          <TabButton 
            active={activeTab === 'inbox'} 
            onClick={() => setActiveTab('inbox')} 
            icon={Inbox} 
            label="Hộp thư đến" 
            count={emails.filter(e => !e.isRead).length}
          />
          <TabButton 
            active={activeTab === 'unread'} 
            onClick={() => setActiveTab('unread')} 
            icon={AlertCircle} 
            label="Chưa đọc" 
          />
          <TabButton 
            active={activeTab === 'starred'} 
            onClick={() => setActiveTab('starred')} 
            icon={Star} 
            label="Đã đánh dấu" 
          />
          <TabButton 
            active={activeTab === 'archived'} 
            onClick={() => setActiveTab('archived')} 
            icon={Archive} 
            label="Lưu trữ" 
          />
          
          <div className="mt-auto pt-4 border-t border-white/20">
            <div className="hidden md:block px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhãn</div>
            <LabelButton color="bg-blue-400" label="Công việc" />
            <LabelButton color="bg-purple-400" label="Khách hàng" />
            <LabelButton color="bg-orange-400" label="Hệ thống" />
          </div>
        </div>

        {/* Email List */}
        <div className={`flex-1 flex flex-col ${selectedEmailId ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredEmails.length > 0 ? (
              <div className="divide-y divide-white/10">
                {filteredEmails.map((email) => (
                  <div 
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    className={`p-4 cursor-pointer transition-all hover:bg-white/40 flex gap-4 ${!email.isRead ? 'bg-indigo-50/40 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="shrink-0 pt-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${!email.isRead ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                        {email.sender.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`text-sm truncate ${!email.isRead ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                          {email.sender}
                        </h3>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                          {new Date(email.timestamp).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h4 className={`text-xs mb-1 truncate ${!email.isRead ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                        {email.subject}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {email.content}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end justify-between">
                      <button 
                        onClick={(e) => handleDelete(e, email.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {email.attachments && email.attachments.length > 0 && (
                        <Paperclip className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <Mail className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium">Không có email nào</p>
              </div>
            )}
          </div>
        </div>

        {/* Email Content Detail */}
        {selectedEmailId && (
          <div className={`flex-1 flex flex-col bg-white/60 backdrop-blur-xl border-l border-white/20 ${selectedEmailId ? 'flex' : 'hidden'}`}>
            {selectedEmail ? (
              <>
                {/* Detail Header */}
                <div className="p-4 border-b border-white/20 flex items-center justify-between bg-white/40">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedEmailId(null)}
                      className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Archive className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><AlertCircle className="w-4 h-4" /></button>
                      <button 
                        onClick={(e) => handleDelete(e, selectedEmail.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Reply className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Forward className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Detail Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <h2 className="text-xl font-bold text-slate-800 mb-6">{selectedEmail.subject}</h2>
                  
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-indigo-100">
                        {selectedEmail.sender.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{selectedEmail.sender}</div>
                        <div className="text-xs text-slate-500">tới tôi</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(selectedEmail.timestamp).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedEmail.content}
                  </div>

                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="mt-12 pt-6 border-t border-white/20">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Paperclip className="w-3 h-3" />
                        Tệp đính kèm ({selectedEmail.attachments.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedEmail.attachments.map((file, idx) => (
                          <a 
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-white/40 border border-white/40 rounded-xl hover:bg-white/60 transition-all group"
                          >
                            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-700 truncate">{file.name}</div>
                              <div className="text-[10px] text-slate-400">PDF Document</div>
                            </div>
                            <Download className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Reply */}
                <div className="p-4 border-t border-white/20 bg-white/40">
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 px-4 bg-white border border-white/60 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                      <Reply className="w-4 h-4" /> Trả lời
                    </button>
                    <button className="flex-1 py-2.5 px-4 bg-white border border-white/60 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                      <Forward className="w-4 h-4" /> Chuyển tiếp
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Mail className="w-16 h-16 mb-4 opacity-10" />
                <p>Chọn một email để xem nội dung</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label, count }: { active: boolean, onClick: () => void, icon: any, label: string, count?: number }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-white/40'}`}
  >
    <div className="flex items-center gap-3">
      <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
      <span className="text-sm font-bold hidden md:block">{label}</span>
    </div>
    {count !== undefined && count > 0 && (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-600'}`}>
        {count}
      </span>
    )}
  </button>
);

const LabelButton = ({ color, label }: { color: string, label: string }) => (
  <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-white/40 rounded-xl transition-all group">
    <div className={`w-2 h-2 rounded-full ${color} group-hover:scale-125 transition-transform`}></div>
    <span className="text-xs font-medium hidden md:block">{label}</span>
  </button>
);

