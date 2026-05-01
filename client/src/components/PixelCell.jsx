// when i actually make the sprites
const HAS_SPRITES = true;
const TILE_SIZE = 40;

const WATER_TILE_URL = '/tiles/water_loop.gif';

const SAND_TILE_URL = '/tiles/sand_empty.png';
const CURSOR_TILE_URL = '/tiles/sand_cursor.png';

const BLOCK_TILE_URLS = [
  '/tiles/sand_block.gif',
  '/tiles/sand_block_2.gif',
  '/tiles/sand_block_3.gif',
];

const FALLBACK_CLASS = {
  empty:   'bg-white border-2 border-gray-400',
  focused: 'bg-yellow-100 border-2 border-yellow-300',
  cursor:  'bg-yellow-300 border-2 border-yellow-500',
  correct: 'bg-green-200 border-2 border-green-500',
  block:   'bg-black border-2 border-black',
};

const TEXT_COLOR = {
  empty: '#000000',
  focused: '#000000',
  cursor: '#000000',
  correct: '#166534',
  block: 'transparent',
};

function getStateSpriteUrl(state, blockVariant = 0) {
  if (state === 'empty') return WATER_TILE_URL;
  if (state === 'focused') return SAND_TILE_URL;
  if (state === 'cursor') return CURSOR_TILE_URL;
  if (state === 'correct') return SAND_TILE_URL;
  if (state === 'block') {
    const idx = Math.abs(blockVariant) % BLOCK_TILE_URLS.length;
    return BLOCK_TILE_URLS[idx];
  }
  return null;
}

function EdgeOverlay({ edges, color }) {
  const thickness = 2;
  return (
    <>
      {edges.top && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: thickness, background: color, zIndex: 2, pointerEvents: 'none' }} />
      )}
      {edges.right && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: thickness, background: color, zIndex: 2, pointerEvents: 'none' }} />
      )}
      {edges.bottom && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: thickness, background: color, zIndex: 2, pointerEvents: 'none' }} />
      )}
      {edges.left && (
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: thickness, background: color, zIndex: 2, pointerEvents: 'none' }} />
      )}
    </>
  );
}

export default function PixelCell({
  state = 'empty',
  letter = '',
  wordNumber = null,
  edges = { top: false, right: false, bottom: false, left: false },
  blockVariant = 0,
  onClick = () => {},
  onChange = () => {},
  onKeyDown = () => {},
  inputRef = null,
}) {
  const isLocked = state === 'correct' || state === 'revealed';
  const spriteUrl = getStateSpriteUrl(state, blockVariant);

  const spriteStyle = HAS_SPRITES && spriteUrl ? {
    backgroundImage: `url(${spriteUrl})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  } : {};

  const borderColor = state === 'cursor' ? '#c58a00' : '#2f855a';

  if (state === 'block') {
    return (
      <div
        className={!HAS_SPRITES ? 'bg-black pixel-render border-2 border-black' : 'pixel-render'}
        style={{ width: TILE_SIZE, height: TILE_SIZE, ...spriteStyle }}
      />
    );
  }

  return (
    <div
      className={`relative pixel-render ${!HAS_SPRITES ? (FALLBACK_CLASS[state] ?? FALLBACK_CLASS.empty) : ''}`}
      style={{ width: TILE_SIZE, height: TILE_SIZE, ...spriteStyle }}
      onClick={onClick}
    >
      {(state === 'focused' || state === 'cursor' || state === 'correct') && (
        <EdgeOverlay edges={edges} color={borderColor} />
      )}

      {wordNumber != null && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize: 8,
            lineHeight: 1,
            color: '#000000',
            zIndex: 3,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {wordNumber}
        </span>
      )}

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
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 'bold',
          fontFamily: '"Press Start 2P", monospace',
          color: TEXT_COLOR[state] ?? '#000000',
          zIndex: 4,
          cursor: 'pointer',
          paddingTop: 10,
          caretColor: 'transparent',
        }}
      />
    </div>
  );
}