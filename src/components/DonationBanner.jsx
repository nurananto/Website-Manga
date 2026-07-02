import { useState } from 'react';
import { X, Check } from 'lucide-react';

// Banner ajakan donasi Trakteer — tampil di bawah TopNavBar, di atas konten.
// Sama di semua halaman (home & detail) via satu key localStorage, jadi ditutup
// di satu halaman berarti ikut tertutup di halaman lain. Muncul lagi otomatis
// setelah 24 jam. Klik tombol membuka modal login (donasi diproses lewat alur
// Supporter setelah login).
const DISMISS_KEY = 'donation_banner_dismissed_at';
const DISMISS_MS = 24 * 60 * 60 * 1000;

const PERKS = [
  'Buka semua chapter terkunci',
  'Server tetap online',
  'Rilis makin lancar',
  'Dukung tim scanlator',
];

export default function DonationBanner({ onLoginClick }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() - dismissedAt < DISMISS_MS;
    } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="relative w-full rounded-xl border border-red-400/40 overflow-hidden px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: 'linear-gradient(to right, rgba(220,38,38,0.9), rgba(239,68,68,0.75), rgba(220,38,38,0.9))' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-7 sm:pr-0">
        {/* Logo Trakteer — warna & border sama seperti tombol Donasi Sekarang */}
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-md">
          <img
            src="https://cdn.trakteer.id/images/embed/trbtn-icon.png"
            alt="Trakteer"
            className="w-5 h-5 sm:w-7 sm:h-7 object-contain brightness-0 invert"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black text-xs sm:text-base text-white leading-tight">Dukung Nurananto Scanlation!</p>
          <p className="text-[11px] sm:text-sm text-white/85 font-semibold leading-snug mt-0.5">
            Bantu donasi untuk membuka akses chapter lainnya &amp; menjaga server tetap online.
          </p>
          <div className="hidden md:flex items-center gap-3 mt-1.5 flex-wrap">
            {PERKS.map((t) => (
              <span key={t} className="flex items-center gap-1 text-[11px] text-white/80 font-semibold">
                <Check className="w-3 h-3 text-white shrink-0" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onLoginClick}
        className="w-full sm:w-auto text-center px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm text-white bg-white/15 hover:bg-white/25 border border-white/25 active:scale-95 transition-all cursor-pointer shadow-md whitespace-nowrap shrink-0"
      >
        Login &amp; Donasi Sekarang
      </button>

      <button
        onClick={handleDismiss}
        aria-label="Tutup banner"
        className="absolute top-2 right-2 sm:static sm:top-auto sm:right-auto w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
