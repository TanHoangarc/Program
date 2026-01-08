
import React, { useState, useRef } from 'react';
import { WebNfcProfile, SocialLink, Project, AuthUser } from '../types';
import { BASE_URL_PREFIX } from '../constants';
import { 
  ExternalLink, Edit3, Trash2, Plus, Search, Settings, Download, X, 
  Link as LinkIcon, Image as ImageIcon, User, Phone, Copy, Save, 
  Briefcase, Globe, FileText, ArrowLeft, Layout, ChevronDown, QrCode
} from 'lucide-react';

interface NFCPageProps {
  profiles: WebNfcProfile[];
  currentUser: AuthUser;
  onAdd: (profileData: Omit<WebNfcProfile, 'id' | 'visits' | 'interactions' | 'lastActive' | 'status' | 'fullUrl'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WebNfcProfile>) => void;
}

// Preset Data from Screenshot
const SOCIAL_PRESETS = [
    { id: 'zalo', label: 'Zalo', icon: 'https://i.ibb.co/d4nRhVQV/Zalo.png' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'https://i.ibb.co/XxqRB3Qg/Whatsapp.png' },
    { id: 'wechat', label: 'WeChat', icon: 'https://i.ibb.co/Zz41gSrk/Wechat.png' },
    { id: 'email', label: 'Email', icon: 'https://i.ibb.co/nqyMXyNM/Email.png' },
    { id: 'map', label: 'Địa Chỉ', icon: 'https://i.ibb.co/7dTZHSwV/Map.png' },
    { id: 'website', label: 'Website', icon: 'https://i.ibb.co/Gf69QR4R/Website.png' },
    { id: 'profile', label: 'Profile', icon: 'https://i.ibb.co/VY01h09d/Profile.png' },
    { id: 'facebook', label: 'Facebook', icon: 'https://i.ibb.co/67VF7N5R/Facebook.png' },
    { id: 'tiktok', label: 'TikTok', icon: 'https://i.ibb.co/cStFGVqG/Tiktok.png' },
    { id: 'instagram', label: 'Instagram', icon: 'https://i.ibb.co/39gCrw9n/Instagram.png' },
    { id: 'momo', label: 'Momo', icon: 'https://i.ibb.co/KpRgSv04/Momo.png' },
    { id: 'vcb', label: 'VCB', icon: 'https://i.ibb.co/WNDG8rdx/Vietcombank.png' },
    { id: 'tcb', label: 'TCB', icon: 'https://i.ibb.co/FktVzW2z/Tcb.png' },
];

const DEFAULT_SOCIAL_URLS: Record<string, string> = {
    zalo: "https://zalo.me/",
    email: "mailto:@longhoanglogistics.com",
    map: "https://maps.app.goo.gl/ZSVFYotTCuGWNQmW8",
    website: "https://www.longhoanglogistics.com",
    profile: "https://drive.google.com/file/d/1wyPCBaCLTiUx3aWMwIX3X1WryfnTL-Lp/view?usp=drive_link"
};

const DEFAULT_TITLES = [
  "Accounting Department",
  "Documentation Department",
  "Business Development Department",
  "Overseas Sales",
  "Overseas Manager",
  "Leader Business Development"
];

const DEFAULT_ROLES = [
  "Account – Công ty Long Hoàng Logistics",
  "Documentation – Công ty Long Hoàng Logistics",
  "Sales Logistics – Công ty Long Hoàng Logistics",
  "Overseas Sales – Công ty Long Hoàng Logistics",
  "Overseas Manager – Công ty Long Hoàng Logistics",
  "Leader Team Sale 1 Long Hoàng",
  "Leader Team Sale 2 Long Hoàng",
  "Leader Team Sale 3 Long Hoàng"
];

const DEFAULT_ROLES_EN = [
  "Account – Long Hoang Logistics Co.,ltd",
  "Documentation – Long Hoang Logistics Co.,ltd",
  "Sales Logistics – Long Hoang Logistics Co.,ltd",
  "Overseas Sales – Long Hoang Logistics Co.,ltd",
  "Overseas Manager – Long Hoang Logistics Co.,ltd",
  "Leader Team Sale 1 - Long Hoang Logistics Co.,ltd",
  "Leader Team Sale 2 - Long Hoang Logistics Co.,ltd",
  "Leader Team Sale 3 - Long Hoang Logistics Co.,ltd"
];

// Template for the generated HTML file
const generateHtmlTemplate = (profile: WebNfcProfile) => {
  const targetData = {
    id: profile.id,
    name: profile.name,
    phoneContact: profile.phoneNumber || '',
    zaloContact: profile.zaloNumber || '',
    assets: {
      avatar: profile.avatarUrl || 'https://i.ibb.co/4RKTydDT/Andy.jpg',
      avatarQr: profile.avatarUrl || '', 
      cover: profile.coverUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      roleIcon: "https://i.ibb.co/VY0kfHdv/Logo-Nhon-My-700x700-2-150x150.png",
      flagVi: "https://flagcdn.com/w40/vn.png",
      flagEn: "https://flagcdn.com/w40/us.png",
    },
    qrImages: {
      main: profile.mainQrUrl || profile.avatarUrl || '', 
    },
    socialLinks: profile.socialLinks.map(link => ({
      id: link.id,
      label: link.label,
      iconUrl: link.iconUrl,
      href: link.url,
      qrImage: link.qrImageUrl
    })),
    projects: (profile.projects || []).map(p => ({
      id: p.id,
      title: p.name,
      thumbnail: p.imageUrl,
      description: p.description,
      images: p.detailImageUrls
    })),
    content: {
      vi: {
        title: profile.headerTitleVi || profile.name,
        subtitle: profile.title || '',
        description: (profile.bio || '').split('\n'),
        consultButton: "Đăng Ký Tư Vấn",
        roles: profile.footerRoleVi ? [profile.footerRoleVi] : [],
        saveContact: "Lưu Danh bạ",
        share: "Chia sẻ",
        scanQr: "Quét mã",
        close: "Đóng",
        projectsTitle: "Dự Án Tiêu Biểu",
        backToProjects: "Quay lại danh sách",
        consultationForm: { 
            title: "Yêu Cầu Báo Giá", 
            goodsType: "Loại Hàng hóa", 
            pol: "Cảng đi (POL)", 
            pod: "Cảng đến (POD)", 
            volume: "Khối lượng (Volume)", 
            submit: "Báo Giá Qua Zalo", 
            alertCopied: "Nội dung đã được copy! Vui lòng dán vào cuộc trò chuyện Zalo." 
        }
      },
      en: {
        title: profile.headerTitleEn || profile.headerTitleVi || profile.name,
        subtitle: profile.titleEn || profile.title || '',
        description: (profile.bioEn || profile.bio || '').split('\n'),
        consultButton: "Register for Consultation",
        roles: profile.footerRoleEn ? [profile.footerRoleEn] : (profile.footerRoleVi ? [profile.footerRoleVi] : []),
        saveContact: "Save Contact",
        share: "Share",
        scanQr: "Scan QR",
        close: "Close",
        projectsTitle: "Featured Projects",
        backToProjects: "Back to Projects",
        consultationForm: { 
            title: "Request Quotation", 
            goodsType: "Type of Goods", 
            pol: "Port of Loading", 
            pod: "Port of Discharge", 
            volume: "Volume", 
            submit: "Get Quote via Zalo", 
            alertCopied: "Content copied! Please paste into Zalo chat." 
        }
      }
    }
  };

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NCV Card - ${profile.name}</title>
    <!-- Placeholder for template structure -->
    <script>window.PROFILE_DATA = ${JSON.stringify(targetData)};</script>
  </head>
  <body>
    <!-- Template implementation would be here -->
    <h1>${profile.name}</h1>
  </body>
</html>`;
};

type Tab = 'general' | 'images' | 'content_vn' | 'content_en' | 'social' | 'projects';

export const NFCPage: React.FC<NFCPageProps> = ({ profiles, currentUser, onAdd, onDelete, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dynamic Lists State
  const [titlesList, setTitlesList] = useState<string[]>(DEFAULT_TITLES);
  const [rolesList, setRolesList] = useState<string[]>(DEFAULT_ROLES);
  const [titlesEnList, setTitlesEnList] = useState<string[]>(DEFAULT_TITLES);
  const [rolesEnList, setRolesEnList] = useState<string[]>(DEFAULT_ROLES_EN);

  // Form State
  const [formData, setFormData] = useState<Omit<WebNfcProfile, 'id' | 'visits' | 'interactions' | 'lastActive' | 'status' | 'fullUrl'>>({
    name: '', slug: '', title: '', bio: '', headerTitleVi: '', footerRoleVi: '',
    titleEn: '', bioEn: '', headerTitleEn: '', footerRoleEn: '',
    phoneNumber: '', zaloNumber: '', avatarUrl: '', coverUrl: '', mainQrUrl: '',
    socialLinks: [], projects: []
  });

  // --- FILTERING LOGIC ---
  const filteredProfiles = profiles.filter(p => {
      // 1. Role-based filter (Sales can only see assigned)
      if (currentUser.role === 'sales') {
          const allowed = currentUser.allowedProfileIds || [];
          if (!allowed.includes(p.id)) return false;
      }
      
      // 2. Search filter
      return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             p.slug.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddSubmit = () => {
    if (formData.name && formData.slug) {
        let slug = formData.slug.trim();
        // Remove existing full URL parts if user pasted full URL
        slug = slug.replace('https://', '').replace('http://', '').replace(BASE_URL_PREFIX, '');
        
        // Auto-append .github.io if it looks like a simple name (no extension, no slash)
        if (!slug.includes('.') && !slug.includes('/')) {
            slug += '.github.io';
        }

        const fullUrl = `${BASE_URL_PREFIX}${slug}`;

        if (editingId) {
            onUpdate(editingId, { ...formData, slug, fullUrl });
        } else {
            // Note: onAdd in App.tsx regenerates fullUrl using BASE_URL_PREFIX + slug
            // So we must pass the modified slug here.
            onAdd({ ...formData, slug }); 
        }
        resetForm();
        setIsModalOpen(false);
    } else {
        alert("Please fill in at least the Name and Slug (General tab).");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
        name: '', slug: '', title: '', bio: '', headerTitleVi: '', footerRoleVi: '',
        titleEn: '', bioEn: '', headerTitleEn: '', footerRoleEn: '',
        phoneNumber: '', zaloNumber: '', avatarUrl: '', coverUrl: '', mainQrUrl: '',
        socialLinks: [], projects: []
    });
    setActiveTab('general');
  };

  // ... (Social Link, Project helper functions) ...
  const addSocialLink = (presetId: string) => {
    const preset = SOCIAL_PRESETS.find(p => p.id === presetId);
    const defaultUrl = DEFAULT_SOCIAL_URLS[presetId] || '';
    setFormData(prev => ({...prev, socialLinks: [...prev.socialLinks, { id: Date.now().toString(), platform: presetId as any, url: defaultUrl, label: preset?.label || 'New Link', iconUrl: preset?.icon || '', qrImageUrl: '' }]}));
    setShowAddMenu(false);
  };
  const updateSocialLink = (id: string, field: keyof SocialLink, value: string) => { setFormData(prev => ({...prev, socialLinks: prev.socialLinks.map(link => link.id === id ? { ...link, [field]: value } : link)})); };
  const removeSocialLink = (id: string) => { setFormData(prev => ({...prev, socialLinks: prev.socialLinks.filter(l => l.id !== id)})); };
  const addProject = () => { setFormData(prev => ({...prev, projects: [...(prev.projects || []), { id: Date.now().toString(), name: '', url: '', description: '', imageUrl: '', detailImageUrls: [] }]})); };
  const updateProject = (id: string, field: keyof Project, value: any) => { setFormData(prev => ({...prev, projects: prev.projects?.map(p => p.id === id ? { ...p, [field]: value } : p)})); };
  const handleDetailImagesChange = (id: string, text: string) => { const urls = text.split('\n').map(u => u.trim()).filter(u => u !== ''); updateProject(id, 'detailImageUrls', urls); };
  const removeProject = (id: string) => { setFormData(prev => ({...prev, projects: prev.projects?.filter(p => p.id !== id) || []})); };

  const handleEditRedirect = (profile: WebNfcProfile) => {
    setEditingId(profile.id);
    setFormData({
        name: profile.name,
        slug: profile.slug,
        title: profile.title,
        bio: profile.bio,
        headerTitleVi: profile.headerTitleVi,
        footerRoleVi: profile.footerRoleVi,
        titleEn: profile.titleEn,
        bioEn: profile.bioEn,
        headerTitleEn: profile.headerTitleEn,
        footerRoleEn: profile.footerRoleEn,
        phoneNumber: profile.phoneNumber,
        zaloNumber: profile.zaloNumber,
        avatarUrl: profile.avatarUrl,
        coverUrl: profile.coverUrl,
        mainQrUrl: profile.mainQrUrl || '',
        socialLinks: profile.socialLinks || [],
        projects: profile.projects || []
    });
    setIsModalOpen(true);
  };

  const downloadProject = (profileData: any) => {
    const tempProfile: WebNfcProfile = {
        id: 'temp', visits: 0, interactions: 0, lastActive: '', status: 'active',
        fullUrl: `${BASE_URL_PREFIX}${profileData.slug}`, ...profileData
    };
    const htmlContent = generateHtmlTemplate(tempProfile);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'index.html'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const copyJson = () => { navigator.clipboard.writeText(JSON.stringify(formData, null, 2)); alert("Profile JSON copied to clipboard!"); };
  const handleAddCustomTitle = () => { const newTitle = window.prompt("Nhập chức danh / tiêu đề mới:"); if (newTitle && newTitle.trim()) { const trimmed = newTitle.trim(); if (!titlesList.includes(trimmed)) setTitlesList([...titlesList, trimmed]); setFormData({ ...formData, title: trimmed }); }};
  const handleAddCustomRole = () => { const newRole = window.prompt("Nhập chức vụ mới:"); if (newRole && newRole.trim()) { const trimmed = newRole.trim(); if (!rolesList.includes(trimmed)) setRolesList([...rolesList, trimmed]); setFormData({ ...formData, footerRoleVi: trimmed }); }};
  const handleAddCustomTitleEn = () => { const newTitle = window.prompt("Enter new Job Title:"); if (newTitle && newTitle.trim()) { const trimmed = newTitle.trim(); if (!titlesEnList.includes(trimmed)) setTitlesEnList([...titlesEnList, trimmed]); setFormData({ ...formData, titleEn: trimmed }); }};
  const handleAddCustomRoleEn = () => { const newRole = window.prompt("Enter new Footer Role:"); if (newRole && newRole.trim()) { const trimmed = newRole.trim(); if (!rolesEnList.includes(trimmed)) setRolesEnList([...rolesEnList, trimmed]); setFormData({ ...formData, footerRoleEn: trimmed }); }};

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {currentUser.role === 'admin' || currentUser.role === 'Admin' ? 'Manage All Pages' : 'My Assigned Profiles'}
          </h2>
          <p className="text-slate-500">
            {currentUser.role === 'admin' || currentUser.role === 'Admin'
                ? 'Create, edit, and monitor all NFC deployments.' 
                : 'Manage and update your specific NFC pages.'}
          </p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={18} />
          New Profile
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
        </div>
        <input 
            type="text" 
            placeholder="Search profiles..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-96 bg-white border border-slate-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-slate-700">Profile Name</th>
                        <th className="px-6 py-4 font-semibold text-slate-700">URL Slug</th>
                        <th className="px-6 py-4 font-semibold text-slate-700 text-right">Traffic</th>
                        <th className="px-6 py-4 font-semibold text-slate-700 text-center">Status</th>
                        <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredProfiles.length > 0 ? filteredProfiles.map((profile) => (
                        <tr key={profile.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    {profile.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt={profile.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                            {profile.name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-medium text-slate-900 block">{profile.name}</span>
                                        {profile.title && <span className="text-xs text-slate-500">{profile.title}</span>}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <a 
                                    href={profile.fullUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 truncate max-w-[200px]"
                                >
                                    {profile.slug}
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-600">
                                {profile.visits.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    profile.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {profile.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => downloadProject(profile)}
                                        title="Download Source Code"
                                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleEditRedirect(profile)}
                                        title="Edit Profile"
                                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                    >
                                        <Settings size={16} />
                                    </button>
                                    
                                    {(currentUser.role === 'admin' || currentUser.role === 'Admin') && (
                                        <button 
                                            onClick={() => onDelete(profile.id)}
                                            title="Delete Profile"
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                {currentUser.role === 'sales' 
                                    ? "No profiles assigned to you. Contact Admin." 
                                    : "No profiles found."}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Full Screen Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 animate-in fade-in duration-200">
             <div className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 shadow-md flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h3 className="font-semibold text-lg">
                        {editingId ? 'Chỉnh sửa: ' : 'Tạo mới: '} {formData.name || 'User'}
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={copyJson} className="hidden md:flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Copy size={16} /><span>Copy JSON</span></button>
                    <button onClick={() => downloadProject(formData)} className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Download size={16} /><span>Tải Website (.html)</span></button>
                    <button onClick={handleAddSubmit} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Save size={16} /><span>{editingId ? 'Lưu Thay Đổi' : 'Tạo Profile'}</span></button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 space-y-1">
                        {[{ id: 'general', label: 'Chung', icon: Settings }, { id: 'images', label: 'Hình ảnh', icon: ImageIcon }, { id: 'content_vn', label: 'Nội dung (VN)', icon: FileText }, { id: 'content_en', label: 'Nội dung (EN)', icon: Globe }, { id: 'social', label: 'Mạng Xã Hội', icon: LinkIcon }, { id: 'projects', label: 'Dự án', icon: Briefcase }].map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}><tab.icon size={18} />{tab.label}</button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[500px]">
                        {/* Tab: General */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Thông tin cơ bản</h4>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Tên quản lý (Admin) <span className="text-red-500">*</span></label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="New User" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"/></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">GitHub Slug / Domain <span className="text-red-500">*</span></label><input type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="e.g. Andy (auto becomes Andy.github.io)" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"/></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại (Gọi)</label><input type="text" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="+84972133680" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"/></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Số Zalo (Liên hệ)</label><input type="text" value={formData.zaloNumber} onChange={e => setFormData({...formData, zaloNumber: e.target.value})} placeholder="0972133680" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"/></div>
                            </div>
                        )}
                        {/* Tab: Images */}
                        {activeTab === 'images' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Hình ảnh hiển thị</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Avatar URL</label><input type="text" value={formData.avatarUrl} onChange={e => setFormData({...formData, avatarUrl: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm"/><div className="mt-4 w-32 h-32 bg-slate-100 rounded-full overflow-hidden border-4 border-white shadow-md mx-auto">{formData.avatarUrl ? <img src={formData.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={32} /></div>}</div></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Cover Photo URL</label><input type="text" value={formData.coverUrl} onChange={e => setFormData({...formData, coverUrl: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm"/><div className="mt-4 w-full h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">{formData.coverUrl ? <img src={formData.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32} /></div>}</div></div>
                                    <div className="md:col-span-2 border-t border-slate-100 pt-6"><label className="block text-sm font-medium text-slate-700 mb-1">Main QR Code URL (Optional)</label><div className="flex items-start gap-6"><div className="flex-1"><input type="text" value={formData.mainQrUrl || ''} onChange={e => setFormData({...formData, mainQrUrl: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm"/></div><div className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">{formData.mainQrUrl ? <img src={formData.mainQrUrl} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><QrCode size={24} /></div>}</div></div></div>
                                </div>
                            </div>
                        )}
                         {/* Tab: Content VN */}
                        {activeTab === 'content_vn' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h4 className="text-lg font-bold text-emerald-800 border-b border-emerald-100 pb-4 mb-6">Nội dung Tiếng Việt</h4>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Tên tiêu đề (Tiêu đề trên cùng)</label><input type="text" value={formData.headerTitleVi || ''} onChange={e => setFormData({...formData, headerTitleVi: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white"/></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Chức danh / Tiêu đề</label><div className="flex gap-2"><select value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="flex-1 border border-slate-300 rounded-lg px-4 py-2 bg-white"><option value="">-- Chọn Chức danh --</option>{titlesList.map((t) => (<option key={t} value={t}>{t}</option>))}{!titlesList.includes(formData.title) && formData.title && (<option value={formData.title}>{formData.title}</option>)}</select><button onClick={handleAddCustomTitle} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg border border-indigo-200"><Plus size={20} /></button></div></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Giới thiệu bản thân (Bio)</label><textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={6} className="w-full border border-slate-300 rounded-lg px-4 py-2"/></div>
                                <div className="pt-4 border-t border-slate-100"><label className="block text-sm font-medium text-slate-700 mb-1">Chức vụ (Cuối trang)</label><div className="flex gap-2"><select value={formData.footerRoleVi || ''} onChange={e => setFormData({...formData, footerRoleVi: e.target.value})} className="flex-1 border border-slate-300 rounded-lg px-4 py-2 bg-white"><option value="">-- Chọn Chức vụ --</option>{rolesList.map((r) => (<option key={r} value={r}>{r}</option>))}{!rolesList.includes(formData.footerRoleVi || '') && formData.footerRoleVi && (<option value={formData.footerRoleVi}>{formData.footerRoleVi}</option>)}</select><button onClick={handleAddCustomRole} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg border border-indigo-200"><Plus size={20} /></button></div></div>
                            </div>
                        )}
                        {/* Tab: Content EN */}
                        {activeTab === 'content_en' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h4 className="text-lg font-bold text-indigo-800 border-b border-indigo-100 pb-4 mb-6">English Content</h4>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Header Title (Top)</label><input type="text" value={formData.headerTitleEn || ''} onChange={e => setFormData({...formData, headerTitleEn: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2"/></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label><div className="flex gap-2"><select value={formData.titleEn || ''} onChange={e => setFormData({...formData, titleEn: e.target.value})} className="flex-1 border border-slate-300 rounded-lg px-4 py-2 bg-white"><option value="">-- Select Job Title --</option>{titlesEnList.map((t) => (<option key={t} value={t}>{t}</option>))}{!titlesEnList.includes(formData.titleEn || '') && formData.titleEn && (<option value={formData.titleEn}>{formData.titleEn}</option>)}</select><button onClick={handleAddCustomTitleEn} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg border border-indigo-200"><Plus size={20} /></button></div></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Bio / About</label><textarea value={formData.bioEn} onChange={e => setFormData({...formData, bioEn: e.target.value})} rows={6} className="w-full border border-slate-300 rounded-lg px-4 py-2"/></div>
                                <div className="pt-4 border-t border-slate-100"><label className="block text-sm font-medium text-slate-700 mb-1">Footer Role (Bottom)</label><div className="flex gap-2"><select value={formData.footerRoleEn || ''} onChange={e => setFormData({...formData, footerRoleEn: e.target.value})} className="flex-1 border border-slate-300 rounded-lg px-4 py-2 bg-white"><option value="">-- Select Footer Role --</option>{rolesEnList.map((r) => (<option key={r} value={r}>{r}</option>))}{!rolesEnList.includes(formData.footerRoleEn || '') && formData.footerRoleEn && (<option value={formData.footerRoleEn}>{formData.footerRoleEn}</option>)}</select><button onClick={handleAddCustomRoleEn} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg border border-indigo-200"><Plus size={20} /></button></div></div>
                            </div>
                        )}
                        {/* Tab: Social */}
                        {activeTab === 'social' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6"><h4 className="text-lg font-bold text-slate-900">Mạng xã hội</h4><div className="relative"><button onClick={() => setShowAddMenu(!showAddMenu)} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"><Plus size={16} /> Thêm</button>{showAddMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-10 max-h-80 overflow-y-auto">{SOCIAL_PRESETS.map(p => (<button key={p.id} onClick={() => addSocialLink(p.id)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700"><img src={p.icon} className="w-5 h-5 object-contain" />{p.label}</button>))}</div>)}</div></div>
                                <div className="space-y-4">{formData.socialLinks.map((link) => (<div key={link.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full border border-slate-200 p-1 flex-shrink-0 bg-white">{link.iconUrl ? <img src={link.iconUrl} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center"><LinkIcon size={16} className="text-slate-400" /></div>}</div><input type="text" value={link.label} onChange={(e) => updateSocialLink(link.id, 'label', e.target.value)} className="w-40 font-medium text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-1"/><div className="flex-1"><input type="text" value={link.iconUrl || ''} onChange={(e) => updateSocialLink(link.id, 'iconUrl', e.target.value)} className="w-full text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5"/></div><button onClick={() => removeSocialLink(link.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18} /></button></div><div className="mb-3"><input type="text" value={link.url} onChange={(e) => updateSocialLink(link.id, 'url', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div><div><input type="text" value={link.qrImageUrl || ''} onChange={(e) => updateSocialLink(link.id, 'qrImageUrl', e.target.value)} placeholder="QR Image URL (Optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50"/></div></div>))}</div>
                            </div>
                        )}
                        {/* Tab: Projects */}
                        {activeTab === 'projects' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6"><h4 className="text-lg font-bold text-slate-900">Dự Án</h4><button onClick={addProject} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"><Plus size={16} /> Thêm Dự Án</button></div>
                                <div className="space-y-4">{formData.projects && formData.projects.length > 0 ? formData.projects.map((project, index) => (<div key={project.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-4"><div className="flex justify-between items-center mb-4"><h5 className="font-bold text-slate-800">Project #{index + 1}</h5><button onClick={() => removeProject(project.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Xóa</button></div><div className="space-y-4"><div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">TÊN DỰ ÁN</label><input type="text" value={project.name} onChange={e => updateProject(project.id, 'name', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2"/></div><div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ẢNH THU NHỎ (THUMBNAIL)</label><input type="text" value={project.imageUrl || ''} onChange={e => updateProject(project.id, 'imageUrl', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600"/></div><div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">MÔ TẢ</label><textarea value={project.description || ''} onChange={e => updateProject(project.id, 'description', e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2"/></div><div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ẢNH CHI TIẾT (MỖI DÒNG 1 LINK)</label><textarea value={project.detailImageUrls?.join('\n') || ''} onChange={e => handleDetailImagesChange(project.id, e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600"/></div></div></div>)) : <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><p className="text-slate-500">Chưa có dự án nào.</p></div>}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
