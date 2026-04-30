import { useGameStore } from '../store/gameStore.js';

const DISPLAY_SIZE = 24;

export default function HeartsDisplay() {
  const run        = useGameStore(s => s.run);
  const permanents = useGameStore(s => s.permanents);

  const hearts    = run?.hearts ?? 0;
  const maxHearts = 1 + (permanents.extraHearts || 0);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize:   DISPLAY_SIZE,
            lineHeight: 1,
            filter:     i < hearts ? 'none' : 'grayscale(1) opacity(0.3)',
            userSelect: 'none',
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
} 