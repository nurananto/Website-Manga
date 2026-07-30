import { useState, useEffect, useRef } from 'react';
import { Key, RotateCcw, LogOut, LogIn, Crown } from 'lucide-react';
import { nowTimestamp } from '../utils';
import SocialFollowLinks from './SocialFollowLinks';

export default function TopNavBar({ activeTab, onTabClick, onChangePasswordClick, isSupporter, supporterUntil, isLoggedIn, currentUser, onLoginClick, onLogout, onBecomeSupporter, onDropdownOpen }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
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
        {/* Ikon saja — teks "Nurananto Scanlation" dilepas. Ikonnya portrait
            (488x658) sehingga terlihat ramping kalau tingginya pas tombol, jadi
            dinaikkan satu tingkat dari tinggi tombol di sisi kanan. Tetap ikut
            status login karena tombol akun (h-10/11/12) lebih tinggi daripada
            tombol Log In (h-8/10/12), supaya proporsinya konsisten. */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onTabClick('library'); }}
          aria-label="Nurananto Scanlation — ke beranda"
          className="flex items-center active:scale-95 transition-transform duration-150 shrink-0"
        >
          <img
            src="/icon.webp"
            alt="Nurananto Scanlation"
            width="488"
            height="658"
            className={`w-auto ${isLoggedIn ? 'h-12 md:h-13 xl:h-14' : 'h-10 md:h-12 xl:h-14'}`}
          />
        </a>

        <div className="flex-1" />

        {/* Tombol Discord/Facebook sengaja TIDAK di header — sudah pindah ke blok
            "Ikuti Update" di bawah reader, footer, dan dropdown akun. Header
            disisakan untuk logo + aksi akun saja. */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <div ref={dropdownRef} className="relative">
            <div className="relative">
            {isLoggedIn ? (
              <button
                type="button"
                aria-label="Menu akun"
                aria-expanded={isDropdownOpen}
                onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); }}
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
              </button>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="h-8 md:h-10 xl:h-12 rounded-lg bg-[#075bad] hover:bg-[#096bc5] px-2.5 md:px-3.5 xl:px-4 text-white text-[11px] md:text-xs xl:text-sm font-black flex items-center justify-center gap-1.5 md:gap-2 border border-[#89ceff]/40 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4 xl:w-[18px] xl:h-[18px]" />
                <span>Log In</span>
              </button>
            )}
            </div>

            {isLoggedIn && isDropdownOpen && (
              <div className="absolute right-0 top-12 w-56 sm:w-60 md:w-64 bg-surface-container border border-white/5 rounded-xl shadow-2xl py-1.5 z-50 animate-[fadeIn_0.15s_ease-out]">
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

                  <SocialFollowLinks
                    layout="stack"
                    className="animate-[fadeIn_0.2s_ease-out] border-t border-white/5 px-3 py-2 md:py-2.5"
                  />

                  <button
                    onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 md:gap-3 cursor-pointer border-t border-white/5"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Log out</span>
                  </button>
              </>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
