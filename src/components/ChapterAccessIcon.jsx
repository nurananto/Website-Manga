import { Lock, UserRound } from 'lucide-react';

export default function ChapterAccessIcon({ accessLevel, className = '' }) {
  const isMember = accessLevel === 'member';
  const label = isMember ? 'Perlu login member' : 'Khusus Early Access';

  if (!isMember) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
        <Lock className="h-full w-full" strokeWidth={2.4} />
      </span>
    );
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
      <UserRound className="absolute left-0 top-0 h-[88%] w-[88%]" strokeWidth={2} />
      <Lock
        className="absolute bottom-0 right-0 h-[52%] w-[52%] drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]"
        strokeWidth={3}
      />
    </span>
  );
}
