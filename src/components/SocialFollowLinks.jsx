import { Bell } from 'lucide-react';
import { DISCORD_INVITE_URL, FACEBOOK_URL } from '../lib/links';

// Tombol "Ikuti Update" Discord + Facebook — dipakai di bagian bawah reader.
// (Homepage/detail sekarang punya tombol Discord/Facebook sendiri di baris
// atas sebelah Donasi, lihat SupportButtons.jsx — komponen ini diekspor juga
// buat dipakai ulang di sana.)
//
// Responsif tanpa breakpoint khusus: tombol memakai flex-1 + basis-0 sehingga
// selalu membagi lebar induk sama rata — dari 320px sampai desktop lebar,
// tidak pernah meluber maupun terpotong. Label ikut mengecil lewat clamp kelas.

// Diekspor (bukan cuma lokal) — dipakai ulang di SupportButtons.jsx buat
// tombol Discord/Facebook di baris atas (sebelah Donasi).
export function DiscordIcon({ className }) {
  return <img src="/discord-mark-white.svg" alt="" className={className} />;
}

export function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.3v3h2.8v8h3.4Z" />
    </svg>
  );
}

const BUTTON_BASE = 'flex items-center justify-center gap-2 rounded-xl border border-white/15 '
  + 'text-white shadow-sm transition-[transform,filter,box-shadow] duration-200 ease-out '
  + 'hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md active:translate-y-0 active:scale-[0.98]';

// heading: judul "Ikuti Update" — dimatikan di reader, yang hanya menampilkan
// dua tombol tanpa teks (pesan "chapter terbaru" sudah ada di modal tersendiri).
export default function SocialFollowLinks({ heading = true, className = '' }) {
  // basis-0 + min-w-0 mencegah judul panjang mendorong tombol jadi tidak sama lebar.
  const button = `${BUTTON_BASE} h-10 min-w-0 flex-1 basis-0 px-2 sm:h-11 sm:px-3 md:h-12`;
  const icon = 'h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5';
  const label = 'truncate text-[11px] font-bold sm:text-xs md:text-sm';

  return (
    <div className={className}>
      {heading && (
        <p className="flex items-center gap-1 pb-1.5 font-label-sm text-[9px] font-black uppercase tracking-wider text-outline md:text-[10px]">
          <Bell className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" />
          Ikuti Update
        </p>
      )}
      <div className="flex w-full items-stretch gap-2 sm:gap-2.5">
        <a
          href={DISCORD_INVITE_URL || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gabung Discord Nurananto Scanlation"
          className={`${button} bg-[#5865F2]`}
        >
          <DiscordIcon className={icon} />
          <span className={label}>Discord</span>
        </a>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ikuti Facebook Nurananto Scanlation"
          className={`${button} bg-[#1877F2]`}
        >
          <FacebookIcon className={icon} />
          <span className={label}>Facebook</span>
        </a>
      </div>
    </div>
  );
}
