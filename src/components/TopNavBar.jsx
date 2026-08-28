import { useState, useEffect, useRef } from 'react';
import { Key, RotateCcw, LogOut, LogIn, Crown, Sun, Moon } from 'lucide-react';
import { nowTimestamp } from '../utils';

export default function TopNavBar({ activeTab, onTabClick, onChangePasswordClick, isSupporter, supporterUntil, isLoggedIn, currentUser, onLoginClick, onLogout, onBecomeSupporter, onDropdownOpen, theme, onToggleTheme }) {
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
    <nav className="w-full bg-surface border-b border-outline-variant/50 transition-colors">
      <div className="flex items-center h-14 md:h-16 xl:h-[72px] px-3 sm:px-4 md:px-5 xl:px-6 gap-3 md:gap-4 w-full">
        {/* Ikon saja — teks "Nurananto Scanlation" dilepas. Tingginya (w/h-10/11/12)
            jadi skala acuan buat SEMUA tombol di sisi kanan (toggle tema, Log In,
            tombol akun) supaya kedua ujung header selalu sejajar — sama persis
            baik sebelum maupun sesudah login, bukan cuma pas salah satu state. */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onTabClick('library'); }}
          aria-label="Nurananto Scanlation — ke beranda"
          className="flex items-center justify-center active:scale-95 transition-all duration-150 shrink-0 rounded-2xl bg-[#075bad] border border-outline-variant w-10 h-10 md:w-11 md:h-11 xl:w-12 xl:h-12 p-1.5"
        >
          <img
            src="/icon.webp"
            alt="Nurananto Scanlation"
            width="488"
            height="658"
            className="w-full h-full object-contain"
          />
        </a>

        <div className="flex-1" />

        {/* Tombol Discord/Facebook sengaja TIDAK di header — ada di blok
            "Ikuti Update" bawah pagination homepage, footer, dan bawah reader.
            Header disisakan untuk logo + aksi akun saja. */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {/* Toggle light/dark — di kiri tombol login/akun. Dua ikon ditumpuk
              (absolute + m-auto, bukan render kondisional satu ikon) — kalau
              cuma {cond ? <Sun/> : <Moon/>}, React copot-pasang elemennya
              via mount/unmount yang urutannya gak selalu presisi 1 frame,
              kadang sempat kelihatan "kedip kosong". Opacity-nya sengaja TANPA
              transition (bukan lupa) — konsisten sama toggle tema di index.css
              yang sekarang instan juga, bukan di-fade. */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            className="relative h-10 w-10 md:h-11 md:w-11 xl:h-12 xl:w-12 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface shrink-0 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Sun className={`absolute inset-0 m-auto w-[18px] h-[18px] md:w-5 md:h-5 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
            <Moon className={`absolute inset-0 m-auto w-[18px] h-[18px] md:w-5 md:h-5 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`} />
          </button>
          <div ref={dropdownRef} className="relative">
            <div className="relative">
            {isLoggedIn ? (
              <button
                type="button"
                aria-label="Menu akun"
                aria-expanded={isDropdownOpen}
                onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!isDropdownOpen && onDropdownOpen) onDropdownOpen(); }}
                className={`h-10 md:h-11 xl:h-12 rounded-xl border cursor-pointer hover:border-primary transition-colors shrink-0 shadow-md flex items-center gap-2 bg-surface-container-high p-1.5 pr-3 ${
                  activeTab === 'profile' || isDropdownOpen ? 'border-primary' : 'border-outline-variant/60'
                }`}
              >
                <span className="w-7 h-7 md:w-8 md:h-8 xl:w-9 xl:h-9 rounded-full overflow-hidden border border-outline-variant/60 bg-surface-container-highest flex items-center justify-center shrink-0">
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
                className="h-10 md:h-11 xl:h-12 rounded-lg bg-[#075bad] hover:bg-[#096bc5] px-3 md:px-3.5 xl:px-4 text-white text-[11px] md:text-xs xl:text-sm font-black flex items-center justify-center gap-1.5 md:gap-2 border border-[#89ceff]/40 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                <span>Log In</span>
              </button>
            )}
            </div>

            {isLoggedIn && isDropdownOpen && (
              <div className="absolute right-0 top-12 w-56 sm:w-60 md:w-64 bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl py-1.5 z-50 animate-[fadeIn_0.15s_ease-out]">
              <>
                  {/* Nama + badge + countdown Supporter (tepat di bawah nama) */}
                  <div className="px-4 py-2.5 border-b border-outline-variant/40">
                    <span className={`flex w-full items-center justify-center gap-1 px-1.5 py-1 rounded-lg font-label-sm text-[9px] md:text-[10px] font-black uppercase tracking-wider mb-1.5 ${
                      supActive
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
                    }`}>
                      {supActive ? '★ Supporter' : 'Pembaca Setia'}
                    </span>
                    <p className="text-xs md:text-sm font-black text-on-surface truncate">{displayName}</p>
                    <p className="text-[10px] md:text-xs text-outline truncate mt-0.5">{currentUser?.email}</p>
                    {supActive && (
                      <p className="text-[10px] md:text-xs font-bold text-amber-700 dark:text-amber-300 mt-1.5">
                        Supporter aktif: {supLabel}
                      </p>
                    )}
                  </div>

                  {/* Jadi / Perpanjang Supporter */}
                  <div className="px-3 py-2 md:py-2.5 border-b border-outline-variant/40">
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
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-on-surface hover:bg-surface-container-high hover:text-primary flex items-center gap-2.5 md:gap-3 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-sky-600 dark:text-sky-400" />
                    <span>History</span>
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); if (onChangePasswordClick) onChangePasswordClick(); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-on-surface hover:bg-surface-container-high hover:text-primary flex items-center gap-2.5 md:gap-3 cursor-pointer border-t border-outline-variant/40"
                  >
                    <Key className="w-4 h-4 md:w-5 md:h-5 text-amber-600 dark:text-amber-400" />
                    <span>Pengaturan Akun</span>
                  </button>

                  <button
                    onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                    className="w-full text-left px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 md:gap-3 cursor-pointer border-t border-outline-variant/40"
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
