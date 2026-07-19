import { Lock } from 'lucide-react';

export default function ChapterAccessIcon({ className = '' }) {
  const label = 'Khusus Early Access';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} role="img" aria-label={label} title={label}>
      <Lock className="h-full w-full" strokeWidth={2.4} />
    </span>
  );
}
