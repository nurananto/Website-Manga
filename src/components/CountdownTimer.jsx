import { useState, useEffect } from 'react';

export default function CountdownTimer({ unlockDate, onUnlock, silent = false }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(unlockDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft('Gratis');
        if (onUnlock) onUnlock();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const seconds = totalSeconds % 60;
      const totalMinutes = Math.floor(totalSeconds / 60);
      const minutes = totalMinutes % 60;
      const totalHours = Math.floor(totalMinutes / 60);
      const hours = totalHours % 24;
      const days = Math.floor(totalHours / 24);

      // Label Indonesia eksplisit — hindari "h"/"d" yang ambigu (hari vs hours, detik vs days)
      let formatted;
      if (days > 0) {
        formatted = `${days} hari`;
      } else if (hours > 0) {
        formatted = `${hours} jam`;
      } else if (minutes > 0) {
        formatted = `${minutes} mnt`;
      } else {
        formatted = `${seconds} dtk`;
      }
      setTimeLeft(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockDate, onUnlock]);

  if (silent) return null;
  return <span className="font-mono">{timeLeft}</span>;
}
