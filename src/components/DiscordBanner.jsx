import { DISCORD_INVITE_URL } from '../lib/links';

// Running text "gabung Discord" — ajak komunitas, info update tercepat.
// Warna mengikuti brand Discord "Blurple" (#5865F2). Logo Discord putih.
// rounded=true → kartu (homepage) | rounded=false → border-y full-width (detail).
export default function DiscordBanner({ rounded = true }) {
  const disabled = !DISCORD_INVITE_URL;

  const Track = () => (
    <div className="flex items-center gap-8 pr-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-white">
          <img
            src="/discord-mark-white.svg"
            alt="Discord"
            className="w-5 h-5 object-contain shrink-0 drop-shadow-[0_0_4px_rgba(255,255,255,0.35)] group-hover:scale-110 transition-transform duration-300"
          />
          <span>Gabung komunitas Discord kami — dapatkan info update terbaru lebih cepat!</span>
          <span className="flex items-center gap-1.5 bg-white/25 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs font-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
            Gabung
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <a
      href={DISCORD_INVITE_URL || undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      onClick={(e) => { if (disabled) e.preventDefault(); }}
      className={`relative w-full overflow-hidden py-3 flex items-center group shadow-md transition-all duration-300 border-[#5865F2]/35 hover:border-[#5865F2]/60 ${rounded ? 'rounded-xl border' : 'border-y'} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ background: 'linear-gradient(to right, rgba(88,101,242,0.38), rgba(88,101,242,0.22), rgba(88,101,242,0.38))' }}
    >
      <div className="flex whitespace-nowrap animate-marquee">
        <Track />
        <Track />
      </div>
    </a>
  );
}
