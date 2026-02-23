
import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, HelpCircle, Info, X } from 'lucide-react';

export type DialogType = 'alert' | 'confirm' | 'info' | 'success' | 'warning';

interface CustomDialogProps {
  isOpen: boolean;
  type: DialogType;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Đồng ý',
  cancelText = 'Hủy bỏ'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'warning': return <AlertCircle className="w-12 h-12 text-amber-500" />;
      case 'confirm': return <HelpCircle className="w-12 h-12 text-blue-500" />;
      case 'alert': return <AlertCircle className="w-12 h-12 text-red-500" />;
      default: return <Info className="w-12 h-12 text-blue-500" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success': return 'Thành công';
      case 'warning': return 'Cảnh báo';
      case 'confirm': return 'Xác nhận';
      case 'alert': return 'Thông báo';
      default: return 'Thông tin';
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'success': return 'bg-green-50 text-green-800';
      case 'warning': return 'bg-amber-50 text-amber-800';
      case 'confirm': return 'bg-blue-50 text-blue-800';
      case 'alert': return 'bg-red-50 text-red-800';
      default: return 'bg-slate-50 text-slate-800';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className={`px-6 py-4 flex items-center justify-between border-b border-slate-100 ${getHeaderColor()}`}>
          <h3 className="font-bold text-lg">{getTitle()}</h3>
          {type !== 'confirm' && (
            <button onClick={onConfirm} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="p-8 flex flex-col items-center text-center">
          <div className="mb-4">
            {getIcon()}
          </div>
          <div className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
            {message}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-center space-x-3">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all shadow-sm"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-8 py-2.5 rounded-xl text-white font-bold shadow-md transition-all transform active:scale-95 ${
              type === 'alert' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
              type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' :
              type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' :
              'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
