import { Coffee } from 'lucide-react';
import { DiscordIcon, FacebookIcon } from './SocialFollowLinks';
import { DISCORD_INVITE_URL, FACEBOOK_URL } from '../lib/links';

// 3 tombol berdampingan: Donasi (Trakteer, merah), Discord, Facebook.
// Sebelumnya cuma 1 banner lebar "Dukung Nurananto Scanlation", lalu sempat
// jadi 2 tombol (Donasi + Manga Tracker) — halaman Tracker dihapus, Discord
// & Facebook yang tadinya di footer dipindah naik ke sini gantikan slotnya.
//
// Donasi langsung ke Trakteer (bukan modal) — modal Supporter cuma dipicu
// dari klik chapter locked & tombol "Jadi/Perpanjang Supporter" di dropdown
// akun (lihat App.jsx/TopNavBar.jsx).
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';

// Garis pemisah tebal antara ikon & teks ("|") — dipakai ketiga tombol.
function Divider() {
  return <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-white/50 sm:h-6 md:h-7" />;
}

export default function SupportButtons({ className = '' }) {
  return (
    // max-w + mx-auto: di mobile tetap membentang penuh (kontainer sempit),
    // tapi di tablet/desktop 3 tombol ini gak ikut melebar sampai ujung.
    // Padding/ikon/teks naik bertahap 3 langkah (bukan cuma 1 lompatan di
    // sm) — tanpa ini ukurannya "nyangkut" di angka sm sejak layar sekecil
    // apa pun, jadi kelihatan kebesaran di HP kecil.
    <div className={`mx-auto flex w-full max-w-lg items-stretch gap-2 sm:max-w-2xl sm:gap-3 md:max-w-3xl md:gap-4 ${className}`}>
      <a
        href={TRAKTEER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-1 items-center justify-center gap-2 sm:gap-2.5 md:gap-3 rounded-2xl border border-red-300/40 bg-gradient-to-r from-red-600 to-red-500 px-2 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-3.5 shadow-md transition-colors hover:from-red-500 hover:to-red-400 cursor-pointer"
      >
        <Coffee aria-hidden="true" className="h-5 w-5 shrink-0 text-white sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <Divider />
        <span className="text-xs font-black text-white sm:text-sm md:text-base">Donasi</span>
      </a>

      <a
        href={DISCORD_INVITE_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Gabung Discord Nurananto Scanlation"
        className="group flex flex-1 items-center justify-center gap-2 sm:gap-2.5 md:gap-3 rounded-2xl border border-white/15 bg-[#5865F2] px-2 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-3.5 shadow-md transition-colors hover:brightness-110 cursor-pointer"
      >
        <DiscordIcon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <Divider />
        <span className="text-xs font-black text-white sm:text-sm md:text-base">Discord</span>
      </a>

      <a
        href={FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ikuti Facebook Nurananto Scanlation"
        className="group flex flex-1 items-center justify-center gap-2 sm:gap-2.5 md:gap-3 rounded-2xl border border-white/15 bg-[#1877F2] px-2 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-3.5 shadow-md transition-colors hover:brightness-110 cursor-pointer"
      >
        <FacebookIcon className="h-5 w-5 shrink-0 text-white sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <Divider />
        <span className="text-xs font-black text-white sm:text-sm md:text-base">Facebook</span>
      </a>
    </div>
  );
}
