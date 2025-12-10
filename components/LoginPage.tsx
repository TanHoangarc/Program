
import React, { useState } from 'react';
import { Ship, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, pass: string) => void;
  error?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    // Simulate network delay for "High Security" feel
    setTimeout(() => {
        onLogin(username, password);
        setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background is handled by index.html's .mesh-bg, we just need to be transparent */}
      
      <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-500 border border-white/40">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-900/90 to-slate-900/90 p-10 text-center relative backdrop-blur-md">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           <div className="relative z-10">
             <div className="mx-auto w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md mb-6 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                <Ship className="w-10 h-10 text-teal-300" />
             </div>
             <h1 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-md">Kimberry</h1>
             <p className="text-teal-200 text-xs mt-1 uppercase tracking-[0.3em] font-semibold flex items-center justify-center gap-2">
               Merchant Line
             </p>
           </div>
        </div>

        {/* Form */}
        <div className="p-8 pt-10 bg-white/40 backdrop-blur-xl">
           <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1">Tài khoản</label>
                 <div className="relative group">
                    <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 group-focus-within:text-blue-600 transition-colors">
                       <User className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="glass-input w-full pl-12 pr-4 py-3.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold text-slate-800 placeholder-slate-400/70"
                      placeholder="Nhập tên đăng nhập..."
                      autoFocus
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1">Mật khẩu</label>
                 <div className="relative group">
                    <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-slate-500 group-focus-within:text-blue-600 transition-colors">
                       <Lock className="w-5 h-5" />
                    </div>
                    <input 
                      type={showPass ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="glass-input w-full pl-12 pr-12 py-3.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 transition-all font-semibold text-slate-800 placeholder-slate-400/70"
                      placeholder="Nhập mật khẩu..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                    >
                       {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                 </div>
              </div>

              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                   <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                   <span className="font-medium leading-tight">{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-900 to-slate-900 hover:from-blue-800 hover:to-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-blue-900/30 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {isLoading ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                   <>
                     Đăng Nhập Hệ Thống <ArrowRight className="w-4 h-4" />
                   </>
                )}
              </button>
           </form>

           <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/20 backdrop-blur-sm">
                 <ShieldCheck className="w-3 h-3 text-teal-600" />
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bảo mật đa lớp</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};