import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';

export default function PuzzleTimer({ onTimeUp, paused = false }) {
  const timerSeconds = useGameStore(s => s.timerSeconds);
  const addTime      = useGameStore(s => s.addTime);
  const intervalRef  = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (paused) return;

    intervalRef.current = setInterval(() => {
      // Always read from store directly to avoid stale closure
      const current = useGameStore.getState().timerSeconds;

      if (current <= 0) {
        clearInterval(intervalRef.current);
        onTimeUp?.();
        return;
      }

      // addTime persists to localStorage on every tick
      addTime(-1);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [paused]); // eslint-disable-line

  const mins  = Math.floor(timerSeconds / 60);
  const secs  = timerSeconds % 60;
  const isLow  = timerSeconds <= 60;
  const isCrit = timerSeconds <= 15;

  return (
    <div
      className={`font-pixel tabular-nums transition-colors select-none
        ${isCrit  ? 'text-red-500 animate-pulse'
        : isLow   ? 'text-amber-500'
        : 'text-black'}`}
      style={{ fontSize: 13, letterSpacing: '0.05em' }}
    >
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}