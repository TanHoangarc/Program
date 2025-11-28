import React, { useRef } from 'react';
import { JobData, Customer, ShippingLine } from '../types';
import { Settings, Download, Upload, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SystemPageProps {
  jobs: JobData[];
  customers: Customer[];
  lines: ShippingLine[];
  onRestore: (data: { jobs: JobData[], customers: Customer[], lines: ShippingLine[] }) => void;
}

export const SystemPage: React.FC<SystemPageProps> = ({ jobs, customers, lines, onRestore }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- BACKUP ---
  const handleBackup = () => {
    const data = {
      timestamp: new Date().toISOString(),
      version: '2.1',
      jobs,
      customers,
      lines
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `Logistics_System_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- RESTORE ---
  const handleRestoreClick = () => {
    if (window.confirm('CẢNH BÁO: Việc khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại (Job, Khách hàng, Line) bằng dữ liệu trong file.\n\nBạn có chắc chắn muốn tiếp tục?')) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Simple validation
        if (!json.jobs || !Array.isArray(json.jobs)) throw new Error('File không hợp lệ: Thiếu dữ liệu Job');
        
        onRestore({
          jobs: json.jobs,
          customers: json.customers || [],
          lines: json.lines || []
        });

        alert(`Khôi phục thành công!\n- ${json.jobs.length} Jobs\n- ${json.customers?.length || 0} Khách hàng\n- ${json.lines?.length || 0} Hãng tàu`);
      } catch (err) {
        alert('Lỗi: File backup không hợp lệ hoặc bị hỏng.');
        console.error(err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8">
         <div className="flex items-center space-x-3 text-slate-800 mb-2">
           <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
             <Settings className="w-6 h-6" />
           </div>
           <h1 className="text-3xl font-bold">Quản Trị Hệ Thống</h1>
         </div>
         <p className="text-slate-500 ml-11">Sao lưu và đồng bộ dữ liệu giữa các thiết bị</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Backup Card */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center hover:border-blue-300 transition-colors">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <Download className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sao Lưu Dữ Liệu</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-xs">
            Tải xuống toàn bộ dữ liệu hiện tại (Job, Khách hàng, Hãng tàu) dưới dạng file .JSON để lưu trữ hoặc chuyển sang máy khác.
          </p>
          <button 
            onClick={handleBackup}
            className="px-6 py-3 bg-blue-900 text-white font-medium rounded-lg shadow-md hover:bg-blue-800 transition-all flex items-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Tải Xuống File Backup
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center hover:border-orange-300 transition-colors">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-6">
            <Upload className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Khôi Phục Dữ Liệu</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-xs">
            Khôi phục dữ liệu từ file Backup (.JSON) đã có. Dữ liệu hiện tại trên máy này sẽ bị thay thế bởi dữ liệu trong file.
          </p>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden" 
          />
          
          <button 
            onClick={handleRestoreClick}
            className="px-6 py-3 bg-white border border-orange-200 text-orange-700 font-medium rounded-lg shadow-sm hover:bg-orange-50 transition-all flex items-center"
          >
            <Upload className="w-5 h-5 mr-2" />
            Chọn File Khôi Phục
          </button>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start space-x-3">
         <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
         <div>
            <h4 className="font-bold text-blue-900 text-sm">Cơ chế hoạt động</h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Trang web hoạt động không cần máy chủ (Serverless), dữ liệu được lưu trực tiếp trên trình duyệt của bạn. 
              Để sử dụng dữ liệu trên máy tính khác, hãy sử dụng tính năng <strong>Sao Lưu</strong> để lấy file về, 
              sau đó gửi file sang máy mới và dùng tính năng <strong>Khôi Phục</strong> để nạp dữ liệu.
            </p>
         </div>
      </div>
    </div>
  );
};