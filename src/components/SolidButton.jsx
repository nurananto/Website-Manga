// Tombol solid terang/gelap dipakai di FeaturedCarousel ("Baca dari Awal" /
// "Lihat Detail") dan hero MangaDetailPage ("Baca Ch." / "Lanjut Ch.") — dulu
// className-nya disalin identik ke 2 file, jadi begitu perlu ganti (mis. warna
// border kurang kontras) harus diingat fix di 2 tempat. Sekarang cukup di sini.
//
// variant: "light" = bg putih teks hitam (aksi utama), "dark" = bg hitam teks
// putih (aksi kedua) — dua-duanya SELALU pakai warna solid ini di light MAUPUN
// dark mode (bukan ikut tema situs), karena duduk di atas cover foto yang
// kontrasnya sudah diurus lewat CoverScrim.
// size: "pill" = ukuran di FeaturedCarousel (padding responsif), "fixed" =
// ukuran di hero MangaDetailPage (tinggi tetap h-9/10/11).
const VARIANT_CLS = {
  light: 'bg-white hover:bg-white/90 border border-black/15 text-black',
  dark:  'bg-black hover:bg-black/85 border border-white/40 text-white',
};

const SIZE_CLS = {
  pill:  'gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl text-[10px] sm:text-xs md:text-sm lg:text-base',
  fixed: 'gap-2 h-9 sm:h-10 md:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm md:text-base',
};

export default function SolidButton({ variant = 'light', size = 'pill', onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center font-bold shadow-md active:scale-[0.98] transition-all cursor-pointer ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}
    >
      {children}
    </button>
  );
}
