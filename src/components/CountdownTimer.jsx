import { useState, useEffect } from 'react';

export default function CountdownTimer({ unlockDate, onUnlock }) {
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

      let formatted = '';
      if (days > 0) {
        formatted = `${days}h`;
      } else if (hours > 0) {
        formatted = `${hours}j`;
      } else if (minutes > 0) {
        formatted = `${minutes}m`;
      } else {
        formatted = `${seconds}d`;
      }
      setTimeLeft(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockDate, onUnlock]);

  return <span className="font-mono">{timeLeft}</span>;
}
