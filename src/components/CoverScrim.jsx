// Overlay 3-lapis di atas cover background blur (dark bg konstan + 2 gradient
// arah atas & kanan) — dulu disalin identik di FeaturedCarousel, SpotlightCarousel
// (SpotlightBackground), dan hero MangaDetailPage. Sekarang satu sumber di sini
// supaya perubahan opacity/warna cukup di satu tempat.
//
// variant "hero"      — banner besar (FeaturedCarousel + hero MangaDetailPage),
//                        scrim lebih tebal karena teks judul ukuran besar di atasnya.
// variant "spotlight"  — carousel cover kecil (SpotlightCarousel), scrim lebih tipis
//                        karena judul ada di LUAR area cover (di bawahnya), bukan
//                        menimpa cover.
const VARIANTS = {
  hero: {
    base:  'dark:bg-black/45',
    top:   'bg-gradient-to-t from-surface/95 via-surface/70 to-transparent dark:from-surface/95 dark:via-surface/55',
    right: 'bg-gradient-to-r from-surface/92 via-surface/55 to-transparent dark:from-surface/90 dark:via-surface/44',
  },
  spotlight: {
    base:  'dark:bg-black/28',
    top:   'bg-gradient-to-t from-surface/70 via-surface/35 to-transparent dark:from-surface/56 dark:via-surface/20',
    right: 'bg-gradient-to-r from-surface/80 via-surface/30 to-transparent dark:from-surface/72 dark:via-surface/18',
  },
};

export default function CoverScrim({ variant = 'hero' }) {
  const v = VARIANTS[variant] || VARIANTS.hero;
  return (
    <>
      {/* Light mode: panel putih-pudar tembus pandang (base tidak aktif, cuma
          gradient). Dark mode: base gelap konstan + gradient gelap. */}
      <div className={`absolute inset-0 ${v.base}`} />
      <div className={`absolute inset-0 ${v.top}`} />
      <div className={`absolute inset-0 ${v.right}`} />
    </>
  );
}
