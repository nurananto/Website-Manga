import { useState, useEffect, useRef } from 'react';
import { Key, RotateCcw, LogOut, LogIn, Crown, Bell } from 'lucide-react';
import { DISCORD_INVITE_URL } from '../lib/links';
import { nowTimestamp } from '../utils';

const FACEBOOK_URL = 'https://web.facebook.com/profile.php?id=61590960336418';

function AccountSocialLinks() {
  return (
    <div className="animate-[fadeIn_0.2s_ease-out] border-t border-white/5 px-3 py-2 md:py-2.5">
      <p className="flex items-center gap-1 px-1 pb-1.5 text-[9px] font-black uppercase tracking-wider text-outline md:text-[10px]">
        <Bell className="h-3 w-3 md:h-3.5 md:w-3.5" />
        Ikuti Update
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={DISCORD_INVITE_URL || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-[#5865F2] px-3 text-white shadow-sm transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md active:translate-y-0 active:scale-[0.98] md:h-10 md:gap-2.5"
        >
          <img src="/discord-mark-white.svg" alt="" className="h-4 w-4 md:h-[18px] md:w-[18px]" />
          <span className="text-[11px] font-bold md:text-xs">Discord</span>
        </a>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-[#1877F2] px-3 text-white shadow-sm transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md active:translate-y-0 active:scale-[0.98] md:h-10 md:gap-2.5"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4 md:h-[18px] md:w-[18px]">
            <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.3v3h2.8v8h3.4Z" />
          </svg>
          <span className="text-[11px] font-bold md:text-xs">Facebook</span>
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

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {!isLoggedIn && (
            <>
              <a
                href={DISCORD_INVITE_URL || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gabung Discord Nurananto Scanlation"
                title="Discord"
                className="flex h-8 w-8 items-center justify-center rounded-[30%] border border-white/15 bg-[#5865F2] shadow-md transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:translate-y-0 active:scale-95 md:h-10 md:w-10 xl:h-12 xl:w-12"
              >
                <img
                  src="/discord-mark-white.svg"
                  alt=""
                  className="h-4 w-4 md:h-5 md:w-5 xl:h-6 xl:w-6"
                />
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ikuti Facebook Nurananto Scanlation"
                title="Facebook"
                className="flex h-8 w-8 items-center justify-center rounded-[30%] border border-white/15 bg-[#1877F2] text-white shadow-md transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:translate-y-0 active:scale-95 md:h-10 md:w-10 xl:h-12 xl:w-12"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5 xl:h-6 xl:w-6">
                  <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.3v3h2.8v8h3.4Z" />
                </svg>
              </a>
            </>
          )}

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

                  <AccountSocialLinks />

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
