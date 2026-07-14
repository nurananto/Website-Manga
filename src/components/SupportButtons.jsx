// CTA Trakteer statis dan ringkas. Discord/Facebook tetap tersedia di footer.
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';

export default function SupportButtons({ className = '' }) {
  return (
    <a
      href={TRAKTEER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex w-full items-center gap-3 rounded-xl border border-[#1877F2]/45 px-3 py-2.5 shadow-md transition-colors hover:border-[#89ceff]/65 sm:px-4 sm:py-3 ${className}`}
      style={{ background: 'linear-gradient(to right, rgba(0,82,174,0.92), rgba(24,119,242,0.78), rgba(88,101,242,0.9))' }}
    >
      <img
        src="https://cdn.trakteer.id/images/embed/trbtn-icon.png"
        alt=""
        className="h-5 w-5 shrink-0 object-contain brightness-0 invert sm:h-6 sm:w-6"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-white sm:text-sm">Dukung Nurananto Scanlation</p>
        <p className="hidden truncate text-[11px] font-semibold text-white/80 sm:block sm:text-xs">
          Bantu biaya server dan rilis chapter berikutnya melalui Trakteer.
        </p>
      </div>
      <span className="shrink-0 rounded-lg border border-white/20 bg-white/20 px-2.5 py-1.5 text-[10px] font-black text-white transition-colors group-hover:bg-white/30 sm:px-3 sm:text-xs">
        Donasi
      </span>
    </a>
  );
}
