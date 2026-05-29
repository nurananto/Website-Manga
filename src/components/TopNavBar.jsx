import { useState, useEffect, useRef } from 'react';
import { BookOpen, Heart, Key, RotateCcw, LogOut, Coins } from 'lucide-react';

export default function TopNavBar({ activeTab, onTabClick, onChangePasswordClick, userCoins, isLoggedIn, onLoginClick, onLogout, onBuyCoinsClick }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100";
  const userAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuAga_HzDzk1OtChU2zREu_BUOrJMi4taiYX6OLINyLEMxelaVWtoNlQA0dCkEG6ypu8vcHBxd_ijrKwoCAnIL4EY_ZGHyhwkN3V65BQPf6SAtu2hDSBDdM_udAKzk8WKX1DLZ_TyQEhFxN2zFx8YlMowSUpVyrJMQgRY0BkZI6oxWMHj80jgmRjMKAnop27C_WoNzEVu37vwhwdWciRBI_n3qRDQd5H7f8a32p-EEMClj6J5QaiU1L-grX2iaz91TiZhGKsuVPir0s";

  return (
    <nav className="fixed top-0 w-full z-50 h-[72px] bg-surface/70 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(137,92,246,0.1)]">
      <div className="flex justify-between items-center px-2 sm:px-3 md:px-4 h-full w-full">
        {/* Brand (Logo) */}
        <div className="flex items-center gap-8">
          <a 
            className="font-headline-md text-2xl font-black text-on-surface tracking-tight flex items-center gap-2 group" 
            href="#" 
            onClick={(e) => { e.preventDefault(); onTabClick('library'); }}
          >
            <span className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-on-surface via-primary to-surface-tint">
              MangaFlow
            </span>
          </a>
        </div>

        {/* Center Space is Clean / Empty */}
        <div className="flex-1"></div>

        {/* Actions (Profile Avatar with Dropdown) */}
        <div ref={dropdownRef} className="relative">
          <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-9 h-9 rounded-full overflow-hidden border cursor-pointer hover:border-primary transition-colors shrink-0 shadow-md ${
              activeTab === 'profile' || isDropdownOpen ? 'border-primary' : 'border-white/10'
            }`}
          >
            <img
              alt="User profile menu"
              className="w-full h-full object-cover"
              src={isLoggedIn ? userAvatar : defaultAvatar}
            />
          </div>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-12 w-48 bg-surface-container border border-white/5 rounded-xl shadow-2xl py-2 z-50 animate-[fadeIn_0.15s_ease-out]">
              {isLoggedIn ? (
                <>
                  {/* Coin Balance Info */}
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-outline">Koin Saya</span>
                    <div className="flex items-center gap-1 select-none">
                      <Coins className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      <span className="text-xs font-black text-amber-300">{userCoins !== undefined ? userCoins : 120}</span>
                    </div>
                  </div>

                  {/* Buy Coins (Golden Button) */}
                  <div className="px-2 py-2 border-b border-white/5 mb-1.5">
                    <button 
                      onClick={() => { 
                        onBuyCoinsClick();
                        setIsDropdownOpen(false); 
                      }}
                      className="w-full h-9 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer border border-yellow-600/30"
                    >
                      <Coins className="w-3.5 h-3.5 fill-current" />
                      <span>Beli Coin</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => { onTabClick('profile'); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer"
                  >
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>Bookmark</span>
                  </button>
                  <button 
                    onClick={() => { onTabClick('updates'); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-sky-400" />
                    <span>History</span>
                  </button>
                  <button 
                    onClick={() => { 
                      setIsDropdownOpen(false); 
                      if (onChangePasswordClick) onChangePasswordClick();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer border-t border-white/5"
                  >
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Ganti Password</span>
                  </button>
                  <button 
                    onClick={() => { 
                      setIsDropdownOpen(false); 
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 cursor-pointer border-t border-white/5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-white/5">
                    <p className="text-[10px] uppercase font-bold text-outline">Anda belum login</p>
                  </div>
                  <div className="px-2 py-2">
                    <button 
                      onClick={() => { 
                        onLoginClick();
                        setIsDropdownOpen(false); 
                      }}
                      className="w-full h-10 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <span>Masuk / Login</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
