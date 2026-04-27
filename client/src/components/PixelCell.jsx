// ── Sprite sheet config ────────────────────────────────────────
// Set to true once your Aseprite exports are in client/src/assets/tiles/
const HAS_SPRITES = false;

// Native Aseprite canvas size
const SPRITE_NATIVE = 16;

// Display size in the browser (CSS pixels)
// We scale 16px → 40px via CSS. image-rendering: pixelated keeps it crisp.
const TILE_SIZE = 40;

// Import sprites — these are ignored when HAS_SPRITES = false
// Uncomment when you have the files:
import spriteSandEmpty    from '../assets/water_loop.gif';
import spriteSandCursor   from '../assets/tiles/sand_cursor.png';
import spriteSandCorrect  from '../assets/tiles/sand_correct.png';
import spriteSandBlock from '../assets/tiles/sand_block.gif';
import spriteSandFocused from '../assets/tiles/sand_empty.png';
<as></as>
// import spriteLetters      from '../assets/letters.png';

// Map each state to its sprite (fill in after uncommenting imports)
const SPRITES = {
  empty:    spriteSandEmpty,
  cursor:   spriteSandCursor,
  correct:  spriteSandCorrect,
  block: spriteSandBlock,
  focused: spriteSandFocused,
};

// ── Tailwind fallback styles (used when HAS_SPRITES = false) ───
const FALLBACK_CLASS = {
  empty:    'bg-white border-2 border-gray-400',
  focused:  'bg-yellow-100 border-2 border-yellow-300',
  cursor:   'bg-yellow-300 border-2 border-yellow-500',
  correct:  'bg-green-200 border-2 border-green-500',
  block:    'bg-black border-2 border-black',
};

const TEXT_COLOR = {
  empty:    '#000000',
  focused:  '#000000',
  cursor:   '#000000',
  correct:  '#166534',
  block:    'transparent',
};

// ── Letter sprite helper ───────────────────────────────────────
// Returns inline style to show one letter from the sprite strip.
// The strip is 26 letters × SPRITE_NATIVE px wide.
// We display each letter at a scaled size inside the cell.
const LETTER_DISPLAY = 20; // px — how big each letter renders

function getLetterStyle(char) {
  if (!HAS_SPRITES || !char) return null;
  const col    = char.toUpperCase().charCodeAt(0) - 65;
  const offset = col * SPRITE_NATIVE;
  return {
    backgroundImage:    `url(${SPRITES.letters})`, // add to SPRITES above
    backgroundPosition: `-${offset}px 0px`,
    backgroundSize:     `${SPRITE_NATIVE * 26}px ${SPRITE_NATIVE}px`,
    backgroundRepeat:   'no-repeat',
    imageRendering:     'pixelated',
    width:              LETTER_DISPLAY,
    height:             SPRITE_NATIVE,
    display:            'inline-block',
    transform:          `scale(${LETTER_DISPLAY / SPRITE_NATIVE})`,
    transformOrigin:    'top left',
  };
}

// ── Component ──────────────────────────────────────────────────

export default function PixelCell({
  state      = 'empty',
  letter     = '',
  wordNumber = null,
  onClick    = () => {},
  onChange   = () => {},
  onKeyDown  = () => {},
  inputRef   = null,
}) {
  // ── Block cell ─────────────────────────────────────────────
  if (state === 'block') {
    return HAS_SPRITES ? (
      <div
        style={{
          width:          TILE_SIZE,
          height:         TILE_SIZE,
          backgroundImage:   `url(${SPRITES.block})`,
          backgroundSize:    'cover',
          backgroundRepeat:  'no-repeat',
          imageRendering:    'pixelated',
        }}
      />
    ) : (
      <div
        className="bg-black pixel-render border-2 border-black"
        style={{ width: TILE_SIZE, height: TILE_SIZE }}
      />
    );
  }

  const isLocked = state === 'correct' || state === 'revealed';

  // ── Sprite background style ────────────────────────────────
  const spriteStyle = HAS_SPRITES && SPRITES[state] ? {
    backgroundImage:    `url(${SPRITES[state]})`,
    backgroundSize:     'cover',
    backgroundRepeat:   'no-repeat',
    imageRendering:     'pixelated',
  } : {};

  return (
    <div
      className={`relative pixel-render ${!HAS_SPRITES ? (FALLBACK_CLASS[state] ?? FALLBACK_CLASS.empty) : ''}`}
      style={{
        width:  TILE_SIZE,
        height: TILE_SIZE,
        ...spriteStyle,
      }}
      onClick={onClick}
    >
      {/* Word number badge */}
      {wordNumber != null && (
        <span
          style={{
            position:      'absolute',
            top:           2,
            left:          3,
            fontSize:      8,
            lineHeight:    1,
            color:         '#000000', // Changed to always be black for contrast against white/yellow
            zIndex:        2,
            fontFamily:    'monospace',
            fontWeight:    'bold',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          {wordNumber}
        </span>
      )}

      {/* Letter — sprite version uses a positioned div, fallback uses input */}
      {HAS_SPRITES && letter ? (
        <>
          {/* Sprite letter */}
          <div
            style={{
              position:   'absolute',
              top:        '50%',
              left:       '50%',
              transform:  'translate(-50%, -50%)',
              zIndex:     3,
              pointerEvents: 'none',
              ...getLetterStyle(letter),
            }}
          />
          {/* Invisible input on top to capture keyboard events */}
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            maxLength={2}
            value={letter}
            readOnly={isLocked}
            onChange={isLocked ? undefined : onChange}
            onKeyDown={onKeyDown}
            style={{
              position:   'absolute',
              top: 0, left: 0,
              width:      '100%',
              height:     '100%',
              opacity:    0,           // invisible — just captures input
              zIndex:     4,
              cursor:     'pointer',
            }}
          />
        </>
      ) : (
        /* Fallback: plain text input */
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          maxLength={2}
          value={letter}
          readOnly={isLocked}
          onChange={isLocked ? undefined : onChange}
          onKeyDown={onKeyDown}
          style={{
            position:   'absolute',
            top:        0,
            left:       0,
            width:      '100%',
            height:     '100%',
            background: 'transparent',
            border:     'none',
            outline:    'none',
            textAlign:  'center',
            fontSize:   15,
            fontWeight: 'bold',
            fontFamily: '"Press Start 2P", monospace',
            color:      TEXT_COLOR[state] ?? '#000000',
            zIndex:     3,
            cursor:     'pointer',
            paddingTop: 10,
            caretColor: 'transparent',
          }}
        />
      )}
    </div>
  );
}