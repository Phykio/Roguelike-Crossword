import { useGameStore } from '../store/gameStore.js';

// Replace with your Aseprite heart sprite later
// For now renders pixel-style heart icons using text/emoji
// Set HAS_HEART_SPRITE = true and add the import once you have the .png

const HAS_HEART_SPRITE = false;
// import heartFull  from '../assets/heart_full.png';
// import heartEmpty from '../assets/heart_empty.png';

const SPRITE_SIZE = 16; // your Aseprite canvas size
const DISPLAY_SIZE = 24; // rendered size

export default function HeartsDisplay() {
  const { hearts, permanents } = useGameStore();
  const maxHearts = 1 + (permanents.extraHearts || 0);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => {
        const filled = i < hearts;

        if (HAS_HEART_SPRITE) {
          return (
            <img
              key={i}
              // src={filled ? heartFull : heartEmpty}
              alt={filled ? 'heart' : 'empty heart'}
              style={{
                width:          DISPLAY_SIZE,
                height:         DISPLAY_SIZE,
                imageRendering: 'pixelated',
              }}
            />
          );
        }

        // Fallback — pixel-font hearts
        return (
          <span
            key={i}
            style={{
              fontSize:    DISPLAY_SIZE,
              lineHeight:  1,
              filter:      filled ? 'none' : 'grayscale(1) opacity(0.3)',
              userSelect:  'none',
            }}
          >
            ♥
          </span>
        );
      })}
    </div>
  );
}