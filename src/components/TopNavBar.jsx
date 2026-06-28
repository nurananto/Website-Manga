import { useState, useEffect, useRef } from 'react';
import { Key, RotateCcw, LogOut, Heart, Bell } from 'lucide-react';
import { DISCORD_INVITE_URL } from '../lib/links';

const FACEBOOK_URL = 'https://web.facebook.com/profile.php?id=61590960336418';

// Menu "Ikuti Update" — Discord + Facebook (info update manga, bukan sekadar sosmed).
function FollowUpdate() {
  return (
    <div className="px-2 py-2 border-t border-white/5">
      <p className="px-2 pb-1.5 text-[9px] uppercase font-black text-outline tracking-wider flex items-center gap-1">
        <Bell className="w-3 h-3" /> Ikuti Update
      </p>
      <div className="flex flex-col gap-1.5">
        <a href={DISCORD_INVITE_URL || undefined} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#5865F2]/40 hover:border-[#5865F2]/70 transition-all"
          style={{ background: 'linear-gradient(to right, rgba(88,101,242,0.32), rgba(88,101,242,0.18))' }}>
          <img src="/discord-mark-white.svg" alt="" className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold text-white">Discord</span>
        </a>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#1877F2]/40 hover:border-[#1877F2]/70 transition-all"
          style={{ background: 'linear-gradient(to right, rgba(24,119,242,0.32), rgba(24,119,242,0.18))' }}>
          <svg viewBox="0 0 24 24" fill="white" aria-hidden="true" className="w-3.5 h-3.5">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="text-[11px] font-bold text-white">Facebook</span>
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
  const supRemainMs = (isSupporter && supporterUntil) ? new Date(supporterUntil).getTime() - Date.now() : 0;
  const supActive = supRemainMs > 0;
  const supLabel = !supActive
    ? null
    : (supRemainMs < 86400000 ? 'hari ini berakhir' : `${Math.floor(supRemainMs / 86400000)} hari tersisa`);

  return (
    <nav className="w-full bg-black border-b border-white/60">
      <div className="flex items-center h-12 md:h-14 xl:h-16 px-2 sm:px-3 md:px-4 gap-2 w-full">
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
            <div
              role="button"
              tabIndex={0}
              aria-label="Menu akun"
              aria-expanded={isDropdownOpen}
              onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); } }}
              className={`w-9 h-9 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-full overflow-hidden border cursor-pointer hover:border-primary transition-colors shrink-0 shadow-md flex items-center justify-center bg-surface-container-high ${
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
          </div>

          {isDropdownOpen && (
            <div className="absolute right-0 top-12 w-52 bg-surface-container border border-white/5 rounded-xl shadow-2xl py-2 z-50 animate-[fadeIn_0.15s_ease-out]">
              {isLoggedIn ? (
                <>
                  {/* Nama + badge + countdown Supporter (tepat di bawah nama) */}
                  <div className="px-4 py-2.5 border-b border-white/5">
                    <span className={`flex w-full items-center justify-center gap-1 px-1.5 py-1 rounded-lg font-label-sm text-[9px] font-black uppercase tracking-wider mb-1.5 ${
                      supActive
                        ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}>
                      {supActive ? '★ Supporter' : 'Pembaca Setia'}
                    </span>
                    <p className="text-xs font-black text-on-surface truncate">{displayName}</p>
                    <p className="text-[10px] text-outline truncate mt-0.5">{currentUser?.email}</p>
                    {supActive && (
                      <p className="text-[10px] font-bold text-pink-300 mt-1.5">
                        Supporter aktif: {supLabel}
                      </p>
                    )}
                  </div>

                  {/* Jadi / Perpanjang Supporter */}
                  <div className="px-2 py-2 border-b border-white/5 mb-1">
                    <button
                      onClick={() => { onBecomeSupporter?.(); setIsDropdownOpen(false); }}
                      className="w-full h-9 rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>{supActive ? 'Perpanjang Supporter' : 'Jadi Supporter'}</span>
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
                    onClick={() => { setIsDropdownOpen(false); if (onChangePasswordClick) onChangePasswordClick(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-white/5 hover:text-primary flex items-center gap-2.5 cursor-pointer border-t border-white/5"
                  >
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Pengaturan Akun</span>
                  </button>

                  <FollowUpdate />

                  <button
                    onClick={() => { setIsDropdownOpen(false); onLogout(); }}
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
                      onClick={() => { onLoginClick(); setIsDropdownOpen(false); }}
                      className="w-full h-10 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
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
