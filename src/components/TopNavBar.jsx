import { useState, useEffect, useRef } from 'react';
import { BookOpen, Heart, Key, RotateCcw, LogOut, Coins, Coffee, Bell } from 'lucide-react';

export default function TopNavBar({ activeTab, onTabClick, onChangePasswordClick, userCoins, isLoggedIn, currentUser, onLoginClick, onLogout, onBuyCoinsClick, onDropdownOpen, unreadNotifCount = 0, onNotifClick }) {
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

  const avatarUrl = currentUser?.avatar || null;
  const displayName = currentUser?.name
    || currentUser?.email?.split('@')[0]
    || 'Pengguna';

  return (
    <nav className="w-full bg-black border-b border-white/5">
      <div className="flex items-center px-2 sm:px-3 md:px-4 py-1 gap-2 w-full">
        {/* Brand (Logo) — grows to fill available space */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onTabClick('library'); }}
          className="flex-1 min-w-0"
        >
          {/* Desktop & Tablet */}
          <img src="/header-desktop.webp" alt="Nurananto Scanlation"
            className="hidden sm:block h-10 md:h-12 lg:h-14 w-auto" />
          {/* Mobile */}
          <img src="/header-mobile.webp" alt="Nurananto Scanlation"
            className="block sm:hidden h-14 w-auto" />
        </a>


        {/* Actions (Profile Avatar with Dropdown) */}
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <div
              onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); }}
              className={`w-9 h-9 rounded-full overflow-hidden border cursor-pointer hover:border-primary transition-colors shrink-0 shadow-md flex items-center justify-center bg-surface-container-high ${
                activeTab === 'profile' || isDropdownOpen ? 'border-primary' : 'border-white/10'
              }`}
            >
              {avatarUrl ? (
                <img alt="avatar" className="w-full h-full object-cover" src={avatarUrl} referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xs font-black text-primary select-none">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            {isLoggedIn && unreadNotifCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 border-2 border-surface flex items-center justify-center px-0.5 pointer-events-none">
                <span className="text-[9px] font-black text-white leading-none">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              </div>
            )}
          </div>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-12 w-48 bg-surface-container border border-white/5 rounded-xl shadow-2xl py-2 z-50 animate-[fadeIn_0.15s_ease-out]">
              {isLoggedIn ? (
                <>
                  {/* Username */}
                  <div className="px-4 py-2.5 border-b border-white/5">
                    <p className="text-xs font-black text-on-surface truncate">{displayName}</p>
                    <p className="text-[10px] text-outline truncate mt-0.5">{currentUser?.email}</p>
                  </div>

                  {/* Coin Balance Info */}
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-outline">Koin Saya</span>
                    <div className="flex items-center gap-1 select-none">
                      <Coins className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      <span className="text-xs font-black text-amber-300">{userCoins !== undefined ? userCoins : 0}</span>
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
                    <RotateCcw className="w-4 h-4 text-sky-400" />
                    <span>History</span>
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); if (onNotifClick) onNotifClick(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-violet-400" />
                    <span className="flex-1">Notifikasi</span>
                    {unreadNotifCount > 0 && (
                      <span className="text-[10px] font-black text-white bg-red-500 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); if (onChangePasswordClick) onChangePasswordClick(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer border-t border-white/5"
                  >
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Pengaturan Akun</span>
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
