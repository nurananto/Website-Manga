import { useState, useEffect, useEffectEvent } from 'react';

export default function CountdownTimer({ unlockDate, onUnlock, silent = false }) {
  const [timeLeft, setTimeLeft] = useState('');
  const handleUnlock = useEffectEvent(() => onUnlock?.());

  useEffect(() => {
    const target = new Date(unlockDate).getTime();
    if (!Number.isFinite(target)) return undefined;
    let fired = false;
    let timer;

    const finish = () => {
      if (fired) return;
      fired = true;
      if (!silent) setTimeLeft('Gratis');
      handleUnlock();
    };

    // Mode silent hanya membutuhkan satu timeout menuju waktu transisi. Ini
    // menghindari interval per detik dan rerender yang tidak terlihat.
    if (silent) {
      const schedule = () => {
        const diff = target - Date.now();
        if (diff <= 0) { finish(); return; }
        timer = setTimeout(schedule, Math.min(diff, 2_147_000_000));
      };
      schedule();
      return () => clearTimeout(timer);
    }

    const updateTimer = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        finish();
        clearInterval(timer);
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
    timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [silent, unlockDate]);

  if (silent) return null;
  return <span className="font-mono">{timeLeft}</span>;
}
