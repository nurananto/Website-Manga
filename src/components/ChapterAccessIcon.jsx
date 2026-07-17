import { LockKeyhole, UserRound } from 'lucide-react';

export default function ChapterAccessIcon({ accessLevel, className = '' }) {
  const isMember = accessLevel === 'member';
  const label = isMember ? 'Perlu login member' : 'Khusus Early Access';

  if (!isMember) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
        <LockKeyhole className="h-full w-full fill-current" strokeWidth={2.1} />
      </span>
    );
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
      <UserRound className="absolute left-0 top-0 h-[88%] w-[88%]" strokeWidth={2} />
      <LockKeyhole
        className="absolute bottom-0 right-0 h-[52%] w-[52%] fill-current drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]"
        strokeWidth={2.8}
      />
    </span>
  );
}
