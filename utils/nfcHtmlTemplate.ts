import type { WebNfcProfile } from '../types';

export function generateHtmlTemplate(profile: WebNfcProfile): string {
  const targetData = {
    id: profile.id || 'temp',
    name: profile.name || 'Alan',
    phoneContact: profile.phoneNumber || '',
    zaloContact: profile.zaloNumber || profile.phoneNumber || '',
    assets: {
      avatar: profile.avatarUrl || 'https://i.ibb.co/xTxbkM3/Alan.jpg',
      avatarQr: profile.avatarUrl || 'https://i.ibb.co/xTxbkM3/Alan.jpg',
      cover: profile.coverUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      roleIcon: 'https://i.ibb.co/VY0kfHdv/Logo-Nhon-My-700x700-2-150x150.png',
      flagVi: 'https://flagcdn.com/w40/vn.png',
      flagEn: 'https://flagcdn.com/w40/us.png'
    },
    qrImages: {
      main: profile.mainQrUrl || profile.avatarUrl || 'https://i.ibb.co/9CQLmR1/Alan.jpg'
    },
    socialLinks: (profile.socialLinks || []).map(link => ({
      id: link.id || String(Date.now()),
      label: link.label || '',
      iconUrl: link.iconUrl || 'https://i.ibb.co/d4nRhVQV/Zalo.png',
      href: link.url || '',
      qrImage: link.qrImageUrl || ''
    })),
    projects: (profile.projects || []).map(p => ({
      id: p.id || String(Date.now()),
      title: p.name || '',
      name: p.name || '',
      url: p.url || '',
      thumbnail: p.imageUrl || '',
      imageUrl: p.imageUrl || '',
      description: p.description || '',
      images: p.detailImageUrls || (p.imageUrl ? [p.imageUrl] : [])
    })),
    content: {
      vi: {
        title: profile.headerTitleVi || profile.name || 'Huỳnh Tấn Lộc',
        subtitle: profile.title || 'Sales Logistics',
        description: profile.bio
          ? profile.bio.split('\n').filter(Boolean)
          : [
              'Nhiều năm kinh nghiệm hàng hóa xuất nhập đa dạng các loại hàng : Rời, Nguy hiểm, Siêu trường siêu trọng.',
              'Tư vấn thủ tục hàng các chủng hàng hóa nhập khẩu theo danh mục kiểm tra chất lượng ( xe nâng, vỏ xe, máy móc y tế,… ).',
              'Tư vấn hàng cửa khẩu tiểu ngạch, chính ngạch.'
            ],
        consultButton: 'Đăng Ký Tư Vấn',
        roles: profile.footerRoleVi
          ? [profile.footerRoleVi]
          : ['Sales Logistics - Công ty Long Hoàng Logistics'],
        saveContact: 'Lưu Danh bạ',
        share: 'Chia sẻ',
        scanQr: 'Quét mã',
        close: 'Đóng',
        projectsTitle: 'Dự Án Tiêu Biểu',
        backToProjects: 'Quay lại danh sách',
        consultationForm: {
          title: 'Yêu Cầu Báo Giá',
          goodsType: 'Loại Hàng hóa',
          pol: 'Cảng đi (POL)',
          pod: 'Cảng đến (POD)',
          volume: 'Khối lượng (Volume)',
          submit: 'Báo Giá Qua Zalo',
          alertCopied: 'Nội dung đã được copy! Vui lòng dán vào cuộc trò chuyện Zalo.'
        }
      },
      en: {
        title: profile.headerTitleEn || profile.headerTitleVi || profile.name || 'Mr. Alan',
        subtitle: profile.titleEn || profile.title || 'Sales Logistics',
        description: profile.bioEn
          ? profile.bioEn.split('\n').filter(Boolean)
          : (profile.bio
              ? profile.bio.split('\n').filter(Boolean)
              : [
                  'Many years of experience in handling a wide variety of import and export cargo, including bulk, hazardous, and oversized/overweight shipments.',
                  'Provide consultation on import procedures for goods subject to quality inspection (e.g., forklifts, tires, medical equipment, etc.).',
                  'Advise on procedures for border-gate trade, both informal and formal channels.'
                ]),
        consultButton: 'Register for Consultation',
        roles: profile.footerRoleEn
          ? [profile.footerRoleEn]
          : (profile.footerRoleVi
              ? [profile.footerRoleVi]
              : ['Sales Logistics - Long Hoang Logistics co.,ltd']),
        saveContact: 'Save Contact',
        share: 'Share',
        scanQr: 'Scan QR',
        close: 'Close',
        projectsTitle: 'Featured Projects',
        backToProjects: 'Back to Projects',
        consultationForm: {
          title: 'Request Quotation',
          goodsType: 'Type of Goods',
          pol: 'Port of Loading',
          pod: 'Port of Discharge',
          volume: 'Volume',
          submit: 'Get Quote via Zalo',
          alertCopied: 'Content copied! Please paste into Zalo chat.'
        }
      }
    }
  };

  const safeJsonData = JSON.stringify(targetData, null, 2).replace(/<\/script>/gi, '<\\/script>');
  const safeProfileName = escapeHtml(profile.name || 'NCV Card');

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#B2F2BB" />
    <title>NCV Card - ${safeProfileName}</title>
    
    <!-- React & ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <!-- Babel để dịch JSX -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#B2F2BB',
              secondary: '#8b004f',
              accent: '#0033cc',
            },
            animation: {
              'fade-in': 'fadeIn 0.3s ease-out',
              'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }
            }
          },
        },
      }
    </script>
    <style>
      body { background-color: #E5E5E5; margin: 0; padding: 0; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      @keyframes scan { 0% { top: 0%; opacity: 1; } 50% { opacity: 0.5; } 100% { top: 100%; opacity: 0; } }
    </style>
  </head>
  <body>
    <div id="root"></div>

    <script type="text/babel">
      const { useState, useEffect, useRef } = React;

      // --- ICONS (SVG Components) ---
      const Icons = {
        Phone: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>,
        Share2: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>,
        Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
        Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
        Briefcase: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
        Link2: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 0 1 0 10h-2"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>,
        ScanLine: ({size=18}) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
        X: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
        Camera: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>,
        AlertCircle: () => <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
        Container: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7.7c0-.8-.7-1.28-1.5-1.75L12 1l-8.5 4.95c-.8.47-1.5 1-1.5 1.75v8.6c0 .8.7 1.28 1.5 1.75L12 23l8.5-4.95c.8-.47 1.5-1 1.5-1.75z"/><path d="M2 7.7 12 13.44 22 7.7"/><path d="M12 22.96V13.44"/></svg>,
        Package: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
        Anchor: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>,
        Box: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
        Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
        ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      };

      // --- CONFIG START ---
      // This object is dynamically populated by the builder
      const DEFAULT_PROFILE = ${safeJsonData};
      // --- CONFIG END ---

      // --- COMPONENTS ---

      const ImageModal = ({ isOpen, imageUrl, onClose, onScanClick, title, description }) => {
        if (!isOpen || !imageUrl) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-gray-800">{title || 'QR Code'}</h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition"><Icons.X /></button>
              </div>
              <div className="p-6 flex flex-col items-center justify-center bg-gray-50">
                <img src={imageUrl} alt="QR Display" className="w-64 h-64 object-contain rounded-lg shadow-lg border-4 border-white bg-white" />
                <p className="mt-4 text-sm text-gray-500 text-center">{description || 'Quét mã này để kết nối'}</p>
              </div>
              <div className="p-4 bg-white border-t flex gap-3">
                <button onClick={() => { window.open(imageUrl, '_blank'); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"><Icons.Download /> <span>Lưu</span></button>
                {onScanClick && <button onClick={() => { onClose(); onScanClick(); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-blue-200 shadow-lg"><Icons.ScanLine /> <span>Quét Mã</span></button>}
              </div>
            </div>
          </div>
        );
      };

      const QRScannerModal = ({ isOpen, onClose, label }) => {
        const videoRef = useRef(null);
        const [error, setError] = useState(null);

        useEffect(() => {
          let stream = null;
          if (isOpen) {
            navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'environment' } })
              ?.then(s => { stream = s; if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }})
              ?.catch(err => setError("Không thể truy cập camera. Vui lòng kiểm tra quyền hoặc sử dụng HTTPS."));
          }
          return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
        }, [isOpen]);

        if (!isOpen) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 animate-fade-in">
            <div className="relative w-full max-w-md h-full flex flex-col">
              <div className="flex justify-between items-center p-4 text-white bg-black bg-opacity-50 absolute top-0 w-full z-10">
                <h2 className="text-lg font-bold flex items-center gap-2"><Icons.Camera /> {label}</h2>
                <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition"><Icons.X /></button>
              </div>
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                {!error ? (
                  <>
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                    <div className="relative z-10 w-64 h-64 border-2 border-white/50 rounded-lg overflow-hidden"><div className="w-full h-1 bg-green-500 absolute top-0 animate-[scan_2s_infinite]"></div></div>
                  </>
                ) : <div className="text-white text-center p-4"><Icons.AlertCircle /><p className="mt-2">{error}</p></div>}
              </div>
            </div>
          </div>
        );
      };

      const ConsultationModal = ({ isOpen, onClose, translations, zaloLink }) => {
        const [formData, setFormData] = useState({ goodsType: '', pol: '', pod: '', volume: '' });
        const [isCopied, setIsCopied] = useState(false);
        if (!isOpen) return null;
        
        const handleSubmit = async (e) => {
          e.preventDefault();
          const message = \`📢 *YÊU CẦU BÁO GIÁ*\\n📦 *\${translations.goodsType}:* \${formData.goodsType}\\n🚩 *\${translations.pol}:* \${formData.pol}\\n🏁 *\${translations.pod}:* \${formData.pod}\\n📊 *\${translations.volume}:* \${formData.volume}\`;
          try { 
            await navigator.clipboard.writeText(message); 
            setIsCopied(true); 
            setTimeout(() => { 
              if (zaloLink) window.open(zaloLink, '_blank'); 
              setIsCopied(false); 
            }, 1000); 
          } catch (err) { 
            if (zaloLink) window.open(zaloLink, '_blank'); 
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm animate-fade-in p-4">
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
              <div className="bg-gradient-to-r from-[#8b004f] to-[#b20066] p-4 flex justify-between items-center text-white">
                <h2 className="text-lg font-bold flex items-center gap-2"><Icons.Container /> {translations.title}</h2>
                <button onClick={onClose}><Icons.X /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto no-scrollbar">
                <div className="space-y-1"><label className="flex gap-2 text-sm font-medium"><Icons.Package /> {translations.goodsType}</label><input required className="w-full p-3 bg-gray-50 border rounded-xl" value={formData.goodsType} onChange={e => setFormData({...formData, goodsType: e.target.value})} /></div>
                <div className="space-y-1"><label className="flex gap-2 text-sm font-medium"><Icons.Anchor /> {translations.pol}</label><input required className="w-full p-3 bg-gray-50 border rounded-xl" value={formData.pol} onChange={e => setFormData({...formData, pol: e.target.value})} /></div>
                <div className="space-y-1"><label className="flex gap-2 text-sm font-medium"><Icons.Anchor /> {translations.pod}</label><input required className="w-full p-3 bg-gray-50 border rounded-xl" value={formData.pod} onChange={e => setFormData({...formData, pod: e.target.value})} /></div>
                <div className="space-y-1"><label className="flex gap-2 text-sm font-medium"><Icons.Box /> {translations.volume}</label><input required className="w-full p-3 bg-gray-50 border rounded-xl" value={formData.volume} onChange={e => setFormData({...formData, volume: e.target.value})} /></div>
                {isCopied && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm text-center">{translations.alertCopied}</div>}
                <button type="submit" className="w-full bg-[#0068FF] text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"><Icons.Send /> {translations.submit}</button>
              </form>
            </div>
          </div>
        );
      };

      const ProjectDetailModal = ({ project, isOpen, onClose }) => {
        if (!isOpen || !project) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 truncate pr-2">{project.title || project.name}</h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition"><Icons.X /></button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                {(project.thumbnail || project.imageUrl) && (
                  <img src={project.thumbnail || project.imageUrl} alt="Project" className="w-full h-48 object-cover rounded-xl shadow-sm" />
                )}
                {project.description && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{project.description}</p>
                )}
                {project.images && project.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {project.images.map((img, idx) => (
                      <img key={idx} src={img} alt="" className="w-full h-24 object-cover rounded-lg shadow-xs" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      };

      // --- MAIN HOME APP ---
      const App = () => {
        const [data] = useState(DEFAULT_PROFILE);
        const [lang, setLang] = useState('vi');
        const [currentTab, setCurrentTab] = useState('home');
        const [qrOpen, setQrOpen] = useState(false);
        const [scanOpen, setScanOpen] = useState(false);
        const [consultOpen, setConsultOpen] = useState(false);
        const [activeQr, setActiveQr] = useState(null);
        const [selectedProject, setSelectedProject] = useState(null);

        const t = data.content[lang] || data.content.vi;

        const openQr = (url, title, desc) => { setActiveQr({url, title, desc}); setQrOpen(true); };
        
        const handleSaveContact = () => {
             const fullName = t.title || data.name;
             const phone = (data.phoneContact || "").replace(/\\s/g, '');
             const webObj = data.socialLinks.find(s => s.id === 'website' || s.label?.toLowerCase() === 'website');
             const website = webObj ? webObj.href : window.location.href;

             let vcard = "BEGIN:VCARD\\nVERSION:3.0\\n";
             vcard += \`FN:\${fullName}\\n\`;
             vcard += \`N:;\${fullName};;;\\n\`;
             if (phone) vcard += \`TEL;TYPE=CELL:\${phone}\\n\`;
             if (website) vcard += \`URL:\${website}\\n\`;
             vcard += "END:VCARD";

             const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = \`\${fullName.replace(/\\s+/g, '_')}.vcf\`;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
        };

        return (
          <div className="min-h-screen bg-[#E5E5E5]">
            <div className="container max-w-md mx-auto bg-[#B2F2BB] min-h-screen sm:min-h-[calc(100vh-40px)] sm:my-5 sm:rounded-[30px] shadow-2xl overflow-hidden flex flex-col relative">
              
              {/* NAV */}
              <div className="bg-white/95 backdrop-blur z-30 flex items-center justify-between px-4 h-14 shadow-sm shrink-0 relative">
                <div className="flex flex-1 justify-center gap-6 h-full">
                   <button onClick={() => setCurrentTab('home')} className={\`h-full flex flex-col justify-center px-2 text-sm font-bold uppercase transition-colors relative \${currentTab === 'home' ? 'text-[#8b004f]' : 'text-gray-400 hover:text-gray-600'}\`}>
                      <div className="flex items-center gap-2"><Icons.Home /> Home</div>
                      {currentTab === 'home' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#8b004f] rounded-t-full"></div>}
                   </button>
                   <button onClick={() => setCurrentTab('project')} className={\`h-full flex flex-col justify-center px-2 text-sm font-bold uppercase transition-colors relative \${currentTab === 'project' ? 'text-[#8b004f]' : 'text-gray-400 hover:text-gray-600'}\`}>
                      <div className="flex items-center gap-2"><Icons.Briefcase /> Project</div>
                      {currentTab === 'project' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#8b004f] rounded-t-full"></div>}
                   </button>
                </div>
                <div className="flex gap-2 absolute right-4">
                   <button onClick={() => setLang('vi')} className={\`w-7 h-5 rounded overflow-hidden transition-transform \${lang==='vi'?'ring-1 ring-green-500':'opacity-60'}\`}><img src={data.assets.flagVi} className="w-full h-full object-cover"/></button>
                   <button onClick={() => setLang('en')} className={\`w-7 h-5 rounded overflow-hidden transition-transform \${lang==='en'?'ring-1 ring-green-500':'opacity-60'}\`}><img src={data.assets.flagEn} className="w-full h-full object-cover"/></button>
                </div>
              </div>

              {/* TAB CONTENT: HOME */}
              {currentTab === 'home' ? (
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
                  <div className="w-full h-48 relative shrink-0">
                    <img src={data.assets.cover} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#B2F2BB] via-[#B2F2BB]/60 to-transparent"></div>
                  </div>

                  <div className="px-6 pb-6 text-center relative z-10 -mt-24 flex-1 animate-fade-in">
                     {/* Avatar */}
                     <div className="relative inline-block mb-2 group">
                        <div className="w-[240px] h-[240px] rounded-full border-4 border-white shadow-2xl overflow-hidden mx-auto bg-gray-200 relative z-10">
                           <img src={data.assets.avatar} className="w-full h-full object-cover cursor-pointer" onClick={() => openQr(data.assets.avatar, t.title, '')}/>
                        </div>
                        <button onClick={() => openQr(data.qrImages.main, 'Personal QR')} className="absolute bottom-2 right-4 z-20 bg-white p-2 rounded-xl shadow-lg hover:scale-110 transition">
                            <img src={data.qrImages.main} className="w-14 h-14 object-contain" />
                            <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1 rounded-full"><Icons.ScanLine size={12}/></div>
                        </button>
                     </div>
                     
                     <h1 className="text-2xl font-bold text-gray-800 mt-4">{t.title}</h1>
                     <p className="text-[#357] font-medium mb-6">{t.subtitle}</p>

                     {data.phoneContact && (
                     <a href={\`tel:\${data.phoneContact}\`} className="flex items-center justify-center gap-3 w-full bg-[#8b004f] text-white py-3.5 px-6 rounded-full shadow-lg hover:bg-[#700040] transition font-bold text-lg mb-6">
                        <Icons.Phone /> <span>{data.phoneContact}</span>
                     </a>
                     )}

                     <div className="grid grid-cols-2 gap-4 mb-8">
                        <button onClick={() => navigator.share ? navigator.share({title: t.title, url: window.location.href}) : (navigator.clipboard?.writeText(window.location.href), alert('Đã sao chép liên kết!'))} className="flex items-center justify-center gap-2 bg-gray-100/80 py-3 rounded-xl font-medium shadow-xs hover:bg-white transition"><Icons.Share2 /> {t.share}</button>
                        <button onClick={handleSaveContact} className="flex items-center justify-center gap-2 bg-gray-100/80 py-3 rounded-xl font-medium shadow-xs hover:bg-white transition"><Icons.Download /> {t.saveContact}</button>
                     </div>

                     <button onClick={() => setConsultOpen(true)} className="bg-[#0033cc] hover:bg-[#002699] text-white px-8 py-3 rounded-xl font-bold shadow-lg w-full mb-6 transition active:scale-98">{t.consultButton}</button>

                     <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 text-left shadow-sm mb-6">
                        <ul className="space-y-2 text-gray-800 text-sm">{t.description.map((l,i) => <li key={i} className="flex gap-2"><span className="text-green-600 font-bold">✓</span><span>{l}</span></li>)}</ul>
                     </div>

                     <div className="space-y-3 mb-8">
                        {t.roles.map((role, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-[#f0fff0] p-3 rounded-xl border border-green-100 shadow-sm">
                            <img src={data.assets.roleIcon} className="w-10 h-10 rounded-full object-cover" />
                            <span className="text-sm font-semibold text-gray-700 flex-1 text-left">{role}</span>
                            <Icons.Link2 className="text-gray-400"/>
                          </div>
                        ))}
                     </div>

                     <div className="grid grid-cols-4 gap-y-6 gap-x-2 mb-20">
                        {data.socialLinks.map(link => (
                          <button key={link.id} onClick={() => link.qrImage ? openQr(link.qrImage, link.label) : window.open(link.href, '_blank')} className="flex flex-col items-center group">
                             <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mb-2 group-hover:scale-110 transition p-2"><img src={link.iconUrl} className="w-10 h-10 object-contain"/></div>
                             <span className="text-xs font-medium text-gray-700 truncate w-full text-center">{link.label}</span>
                          </button>
                        ))}
                     </div>
                  </div>
                </div>
              ) : (
                /* TAB CONTENT: PROJECTS */
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 animate-fade-in flex flex-col">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">{t.projectsTitle}</h2>
                  {data.projects && data.projects.length > 0 ? (
                    <div className="space-y-4">
                      {data.projects.map((p, idx) => (
                        <div key={idx} onClick={() => setSelectedProject(p)} className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer flex gap-3 items-center">
                          {(p.thumbnail || p.imageUrl) && (
                            <img src={p.thumbnail || p.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 text-sm truncate">{p.title || p.name}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                          </div>
                          <Icons.ChevronRight />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/60 backdrop-blur rounded-2xl p-8 text-center text-gray-500 my-auto">
                      <div className="mx-auto w-12 h-12 text-gray-400 mb-3 flex items-center justify-center"><Icons.Briefcase /></div>
                      <p className="text-sm font-medium">Chưa có dự án nào được cập nhật</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ImageModal isOpen={qrOpen} imageUrl={activeQr?.url} title={activeQr?.title} description={activeQr?.desc} onClose={() => setQrOpen(false)} onScanClick={() => setScanOpen(true)} />
            <QRScannerModal isOpen={scanOpen} onClose={() => setScanOpen(false)} label={t.scanQr} />
            <ConsultationModal isOpen={consultOpen} onClose={() => setConsultOpen(false)} translations={t.consultationForm} zaloLink={data.zaloContact ? \`https://zalo.me/\${data.zaloContact.replace(/[^0-9]/g, '')}\` : ''} />
            <ProjectDetailModal project={selectedProject} isOpen={!!selectedProject} onClose={() => setSelectedProject(null)} />
          </div>
        );
      };

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<App />);
    </script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
