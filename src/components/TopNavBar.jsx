import { useState, useEffect, useRef } from 'react';
import { Key, RotateCcw, LogOut, LogIn, Crown, Bell } from 'lucide-react';
import { DISCORD_INVITE_URL } from '../lib/links';
import { nowTimestamp } from '../utils';

const FACEBOOK_URL = 'https://web.facebook.com/profile.php?id=61590960336418';

// Menu "Ikuti Update" — Discord + Facebook (info update manga, bukan sekadar sosmed).
function FollowUpdate() {
  return (
    <div className="px-3 py-2 md:py-2.5 border-t border-white/5">
      <p className="px-1 pb-1.5 text-[9px] md:text-[10px] uppercase font-black text-outline tracking-wider flex items-center gap-1">
        <Bell className="w-3 h-3 md:w-3.5 md:h-3.5" /> Ikuti Update
      </p>
      <div className="flex flex-col gap-2">
        <a href={DISCORD_INVITE_URL || undefined} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-2.5 px-2.5 py-2 md:py-2.5 rounded-lg shadow-sm hover:brightness-110 transition-all"
          style={{ background: '#5865F2' }}>
          <img src="/discord-mark-white.svg" alt="" className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="text-[11px] md:text-xs font-bold text-white">Discord</span>
        </a>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-2.5 px-2.5 py-2 md:py-2.5 rounded-lg shadow-sm hover:brightness-110 transition-all"
          style={{ background: '#1877F2' }}>
          <svg viewBox="0 0 24 24" fill="white" aria-hidden="true" className="w-3.5 h-3.5 md:w-4 md:h-4">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="text-[11px] md:text-xs font-bold text-white">Facebook</span>
        </a>
      </div>
    </div>
  );
}

export default function TopNavBar({ activeTab, onTabClick, onChangePasswordClick, isSupporter, supporterUntil, isLoggedIn, currentUser, onLoginClick, onLogout, onBecomeSupporter, onDropdownOpen }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // Countdown masa aktif Supporter (dihitung dari supporter_until backend).
  const supRemainMs = (isSupporter && supporterUntil) ? new Date(supporterUntil).getTime() - nowTimestamp() : 0;
  const supActive = supRemainMs > 0;
  const supLabel = !supActive
    ? null
    : (supRemainMs < 86400000 ? 'hari ini berakhir' : `${Math.floor(supRemainMs / 86400000)} hari tersisa`);

  return (
    <nav className="w-full bg-[#07111f]">
      <div className="flex items-center h-14 md:h-16 xl:h-[72px] px-3 sm:px-4 md:px-5 xl:px-6 gap-3 md:gap-4 w-full">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onTabClick('library'); }}
          className="flex items-center gap-2 sm:gap-3 active:scale-95 transition-transform duration-150 shrink-0"
        >
          <img src="/logo-header.webp" alt="Nurananto Scanlation" width="1740" height="847"
            className="h-8 md:h-10 xl:h-12 w-auto" />
          <span className="flex flex-col leading-none gap-0">
            <span className="text-xs md:text-base xl:text-xl font-black text-blue-400 tracking-tight">Nurananto</span>
            <span className="text-xs md:text-base xl:text-xl font-bold text-white tracking-tight">Scanlation</span>
          </span>
        </a>

        <div className="flex-1" />

        <div ref={dropdownRef} className="relative">
          <div className="relative">
            {isLoggedIn ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Menu akun"
                aria-expanded={isDropdownOpen}
                onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); } }}
                className={`h-10 md:h-11 xl:h-12 rounded-xl border cursor-pointer hover:border-primary transition-colors shrink-0 shadow-md flex items-center gap-2 bg-surface-container-high p-1.5 pr-3 ${
                  activeTab === 'profile' || isDropdownOpen ? 'border-primary' : 'border-white/10'
                }`}
              >
                <span className="w-7 h-7 md:w-8 md:h-8 xl:w-9 xl:h-9 rounded-full overflow-hidden border border-white/10 bg-surface-container-highest flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img alt="avatar" className="w-full h-full object-cover" src={avatarUrl} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[10px] md:text-xs font-black text-primary select-none">
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="max-w-24 truncate text-xs md:text-sm font-black text-on-surface">
                  {displayName}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="h-10 md:h-11 xl:h-12 rounded-lg bg-primary-container hover:bg-inverse-primary px-3 md:px-4 text-white text-xs md:text-sm font-black flex items-center justify-center gap-1.5 md:gap-2 border border-primary/25 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                <span>Log In</span>
              </button>
            )}
          </div>

          {isLoggedIn && isDropdownOpen && (
            <div className="absolute right-0 top-12 w-56 sm:w-60 md:w-64 bg-surface-container border border-white/5 rounded-xl shadow-2xl py-1.5 z-50 animate-[fadeIn_0.15s_ease-out]">
              {isLoggedIn ? (
                <>
                  {/* Nama + badge + countdown Supporter (tepat di bawah nama) */}
                  <div className="px-4 py-2.5 border-b border-white/5">
                    <span className={`flex w-full items-center justify-center gap-1 px-1.5 py-1 rounded-lg font-label-sm text-[9px] md:text-[10px] font-black uppercase tracking-wider mb-1.5 ${
                      supActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}>
                      {supActive ? '★ Supporter' : 'Pembaca Setia'}
                    </span>
                    <p className="text-xs md:text-sm font-black text-on-surface truncate">{displayName}</p>
                    <p className="text-[10px] md:text-xs text-outline truncate mt-0.5">{currentUser?.email}</p>
                    {supActive && (
                      <p className="text-[10px] md:text-xs font-bold text-amber-300 mt-1.5">
                        Supporter aktif: {supLabel}
                      </p>
                    )}
                  </div>

                  {/* Jadi / Perpanjang Supporter */}
                  <div className="px-3 py-2 md:py-2.5 border-b border-white/5">
                    <button
                      onClick={() => { onBecomeSupporter?.(); setIsDropdownOpen(false); }}
                      className="w-full h-9 md:h-10 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-[11px] md:text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
                      <span>{supActive ? 'Perpanjang Supporter' : 'Jadi Supporter'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => { onTabClick('profile'); setIsDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 md:gap-3 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-sky-400" />
                    <span>History</span>
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); if (onChangePasswordClick) onChangePasswordClick(); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 md:gap-3 cursor-pointer border-t border-white/5"
                  >
                    <Key className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                    <span>Pengaturan Akun</span>
                  </button>

                  <FollowUpdate />

                  <button
                    onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 md:gap-3 cursor-pointer border-t border-white/5"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Log out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-white/5">
                    <p className="text-[10px] uppercase font-bold text-outline">Anda belum login</p>
                  </div>
                  <div className="px-3 py-2 md:py-2.5">
                    <button
                      onClick={() => { onLoginClick(); setIsDropdownOpen(false); }}
                      className="w-full h-10 md:h-11 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <span>Masuk / Login</span>
                    </button>
                  </div>

                  <FollowUpdate />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
