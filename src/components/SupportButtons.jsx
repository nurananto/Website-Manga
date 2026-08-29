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

// Tinggi tombol disamakan dgn Discord/Facebook reader (SocialFollowLinks) —
// h-11/12/14/16 tetap, bukan py-* yg bikin tombol jadi "gendut".
const BUTTON_BASE = 'group flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl '
  + 'px-2 shadow-sm transition-colors cursor-pointer sm:h-12 sm:gap-2 sm:px-3 md:h-14 md:px-4 lg:h-16';

// Garis pemisah tebal antara ikon & teks ("|") — dipakai ketiga tombol.
function Divider() {
  return <span aria-hidden="true" className="h-[18px] w-1 shrink-0 rounded-full bg-white/50 sm:h-5 md:h-6 lg:h-7" />;
}

// Diekspor — dipakai ulang di ReaderModal.jsx (tombol Donasi di bawah
// Discord/Facebook reader), tampilan (ikon+teks+ukuran) sama persis dgn di
// sini, cuma lebar penuh (bukan flex-1 di antara 2 tombol lain).
export function DonateButton({ className = '' }) {
  return (
    <a
      href={TRAKTEER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BUTTON_BASE} border border-red-300/40 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 ${className}`}
    >
      <Coffee aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-white sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
      <Divider />
      <span className="truncate text-xs font-black text-white sm:text-sm md:text-base lg:text-lg">Donasi</span>
    </a>
  );
}

export default function SupportButtons({ className = '' }) {
  return (
    // max-w + mx-auto: di mobile tetap membentang penuh (kontainer sempit),
    // tapi di tablet/desktop 3 tombol ini gak ikut melebar sampai ujung.
    // gap-1.5 di base (bukan gap-2): di layar 320px pas-pasan, gap-2 bikin
    // overflow horizontal beberapa px.
    <div className={`mx-auto flex w-full max-w-lg items-stretch gap-1.5 sm:max-w-2xl sm:gap-2.5 md:max-w-3xl ${className}`}>
      <DonateButton />

      <a
        href={DISCORD_INVITE_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Gabung Discord Nurananto Scanlation"
        className={`${BUTTON_BASE} border border-white/15 bg-[#5865F2] hover:brightness-110`}
      >
        <DiscordIcon className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
        <Divider />
        <span className="truncate text-xs font-black text-white sm:text-sm md:text-base lg:text-lg">Discord</span>
      </a>

      <a
        href={FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ikuti Facebook Nurananto Scanlation"
        className={`${BUTTON_BASE} border border-white/15 bg-[#1877F2] hover:brightness-110`}
      >
        <FacebookIcon className="h-[18px] w-[18px] shrink-0 text-white sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
        <Divider />
        <span className="truncate text-xs font-black text-white sm:text-sm md:text-base lg:text-lg">Facebook</span>
      </a>
    </div>
  );
}
