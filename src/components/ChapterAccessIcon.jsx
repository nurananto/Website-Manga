import { Lock, LogIn } from 'lucide-react';

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
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
      <LogIn className="h-full w-full" strokeWidth={2.4} />
    </span>
  );
}
