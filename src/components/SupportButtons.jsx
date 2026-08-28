import { Coffee } from 'lucide-react';
import { navigate } from '../router';

// Dua tombol berdampingan: Donasi (Trakteer, merah) & Manga Tracker (biru).
// Sebelumnya satu banner lebar "Dukung Nurananto Scanlation" — diganti jadi
// dua tombol squircle biar tombol Manga Tracker (halaman /tracker) juga
// kelihatan langsung di homepage & halaman detail, gak cuma nyempil di URL.
//
// Donasi langsung ke Trakteer (bukan modal) — modal Supporter cuma dipicu
// dari klik chapter locked & tombol "Jadi/Perpanjang Supporter" di dropdown
// akun (lihat App.jsx/TopNavBar.jsx).
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';

// Garis pemisah tebal antara ikon & teks ("|") — dipakai kedua tombol.
function Divider() {
  return <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-white/50 sm:h-6 md:h-7" />;
}

export default function SupportButtons({ className = '' }) {
  return (
    // max-w + mx-auto: di mobile tetap membentang penuh (kontainer sempit),
    // tapi di tablet/desktop dua tombol ini gak ikut melebar sampai ujung.
    // Padding/ikon/teks naik bertahap 3 langkah (bukan cuma 1 lompatan di
    // sm) — tanpa ini ukurannya "nyangkut" di angka sm sejak layar sekecil
    // apa pun, jadi kelihatan kebesaran di HP kecil.
    <div className={`mx-auto flex w-full max-w-md items-stretch gap-3 sm:max-w-lg sm:gap-4 md:max-w-xl ${className}`}>
      <a
        href={TRAKTEER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-1 items-center justify-center gap-2 sm:gap-2.5 md:gap-3 rounded-2xl border border-red-300/40 bg-gradient-to-r from-red-600 to-red-500 px-3 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-3.5 shadow-md transition-colors hover:from-red-500 hover:to-red-400 cursor-pointer"
      >
        <Coffee aria-hidden="true" className="h-5 w-5 shrink-0 text-white sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <Divider />
        <span className="text-xs font-black text-white sm:text-sm md:text-base">Donasi</span>
      </a>

      <button
        type="button"
        onClick={() => navigate('/tracker')}
        className="group flex flex-1 items-center justify-center gap-2 sm:gap-2.5 md:gap-3 rounded-2xl border border-[#89ceff]/40 bg-gradient-to-r from-[#0052ae] to-[#5865F2] px-3 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-3.5 shadow-md transition-colors hover:brightness-110 cursor-pointer"
      >
        {/* Logo situs (mascot kucing) — sama persis dgn ikon di pojok kiri
            atas header (TopNavBar), cuma dipindah ke dalam tombol ini. */}
        <img src="/icon.webp" alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <Divider />
        <span className="text-xs font-black text-white sm:text-sm md:text-base">Manga Tracker</span>
      </button>
    </div>
  );
}
