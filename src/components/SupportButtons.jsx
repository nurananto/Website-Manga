// Running text (marquee) ajakan donasi Trakteer — menggantikan tombol Trakteer.
// Warna brand Trakteer (merah), logo Trakteer putih. Pause saat hover (lihat
// .animate-marquee di index.css). Discord/Facebook ada sebagai tombol di footer.
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';

export default function SupportButtons({ className = '' }) {
  const Track = () => (
    <div className="flex items-center gap-8 pr-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-white">
          <img
            src="https://cdn.trakteer.id/images/embed/trbtn-icon.png"
            alt="Trakteer"
            className="w-5 h-5 object-contain shrink-0 brightness-0 invert group-hover:scale-110 transition-transform duration-300"
          />
          <span>Dukung kami lewat Trakteer — bantu biaya server &amp; rilis chapter tetap lancar!</span>
          <span className="flex items-center gap-1.5 bg-white/25 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
            Donasi
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <a
      href={TRAKTEER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative w-full overflow-hidden py-3 flex items-center group shadow-md transition-all duration-300 rounded-xl border border-red-400/40 hover:border-red-300/60 cursor-pointer ${className}`}
      style={{ background: 'linear-gradient(to right, rgba(220,38,38,0.9), rgba(239,68,68,0.75), rgba(220,38,38,0.9))' }}
    >
      <div className="flex whitespace-nowrap animate-marquee">
        <Track />
        <Track />
      </div>
    </a>
  );
}
