import { DISCORD_INVITE_URL } from '../lib/links';

// Sebaris dua tombol: Donasi Trakteer + Gabung Discord.
// Menggantikan running text (marquee) agar tidak ramai/pusing dilihat.
const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';

export default function SupportButtons({ className = '' }) {
  const discordDisabled = !DISCORD_INVITE_URL;

  return (
    <div className={`flex gap-2 sm:gap-3 ${className}`}>
      {/* Trakteer */}
      <a
        href={TRAKTEER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border border-red-400/50 bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:via-red-400 hover:to-red-500 hover:border-red-300/60 shadow-md active:scale-[0.99] transition-all cursor-pointer group"
      >
        <img
          src="https://cdn.trakteer.id/images/embed/trbtn-icon.png"
          alt="Trakteer"
          className="w-5 h-5 object-contain shrink-0 brightness-0 invert group-hover:scale-110 transition-transform"
        />
        <span className="font-bold text-xs sm:text-sm text-white">Donasi Trakteer</span>
      </a>

      {/* Discord */}
      <a
        href={DISCORD_INVITE_URL || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={discordDisabled}
        onClick={(e) => { if (discordDisabled) e.preventDefault(); }}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border border-[#5865F2]/40 hover:border-[#5865F2]/70 shadow-md active:scale-[0.99] transition-all group ${discordDisabled ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ background: 'linear-gradient(to right, rgba(88,101,242,0.38), rgba(88,101,242,0.24), rgba(88,101,242,0.38))' }}
      >
        <img
          src="/discord-mark-white.svg"
          alt="Discord"
          className="w-5 h-5 object-contain shrink-0 group-hover:scale-110 transition-transform"
        />
        <span className="font-bold text-xs sm:text-sm text-white">Gabung Komunitas</span>
      </a>
    </div>
  );
}
