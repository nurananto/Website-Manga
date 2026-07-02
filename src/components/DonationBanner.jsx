import { useState } from 'react';
import { X, Check } from 'lucide-react';

// Banner ajakan donasi Trakteer — tampil di bawah TopNavBar, di atas konten.
// Bisa ditutup (X) dan tidak akan muncul lagi di browser yang sama (localStorage).
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';
const DISMISS_KEY = 'donation_banner_dismissed';

const PERKS = [
  'Buka semua chapter terkunci',
  'Server tetap online',
  'Rilis makin lancar',
  'Dukung tim scanlator',
];

export default function DonationBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="relative w-full rounded-xl border border-red-400/40 overflow-hidden px-3 sm:px-4 py-3 pr-9 sm:pr-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: 'linear-gradient(to right, rgba(30,8,10,0.95), rgba(56,13,17,0.9), rgba(30,8,10,0.95))' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Logo Trakteer */}
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center shrink-0 shadow-md">
          <img
            src="https://cdn.trakteer.id/images/embed/trbtn-icon.png"
            alt="Trakteer"
            className="w-5 h-5 sm:w-7 sm:h-7 object-contain brightness-0 invert"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black text-xs sm:text-base text-red-400 leading-tight">Dukung Nurananto Scanlation!</p>
          <p className="text-[11px] sm:text-sm text-outline/80 font-semibold leading-snug mt-0.5">
            Bantu donasi untuk membuka akses chapter lainnya &amp; menjaga server tetap online.
          </p>
          <div className="hidden md:flex items-center gap-3 mt-1.5 flex-wrap">
            {PERKS.map((t) => (
              <span key={t} className="flex items-center gap-1 text-[11px] text-outline/70 font-semibold">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <a
        href={TRAKTEER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full sm:w-auto text-center px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm text-white active:scale-95 transition-all cursor-pointer shadow-md whitespace-nowrap shrink-0"
        style={{ background: 'linear-gradient(to right, #dc2626, #f97316)' }}
      >
        Donasi Sekarang
      </a>

      <button
        onClick={handleDismiss}
        aria-label="Tutup banner"
        className="absolute top-2 right-2 sm:static sm:top-auto sm:right-auto w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-outline/60 hover:text-on-surface hover:bg-white/10 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
