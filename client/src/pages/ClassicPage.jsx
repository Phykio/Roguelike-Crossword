import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CrosswordGrid from '../components/CrosswordGrid.jsx';
import api from '../lib/api.js';
import { getOrCreatePlayerId, getUsedClueIds } from '../lib/player.js';

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15];

export default function ClassicPage() {
  const navigate = useNavigate();
  const [size, setSize] = useState(9);
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [complete, setComplete] = useState(false);

  async function startGame() {
    setLoading(true);
    setError(null);
    setSolvedCount(0);
    setTotalCount(0);
    setComplete(false);

    try {
      const { data } = await api.get('/api/puzzle', {
        params: {
          level: 10,
          size,
          playerId: getOrCreatePlayerId(),
          usedIds: getUsedClueIds().join(','),
        },
      });
      setPuzzle(data);
      setStarted(true);
    } catch {
      setError('Could not generate a puzzle. Server might not be running');
    } finally {
      setLoading(false);
    }
  }

  function handleSolvedCountChange(solved, total) {
    setSolvedCount(solved);
    setTotalCount(total);
    if (solved === total) setComplete(true);
  }

  function handleReset() {
    setPuzzle(null);
    setStarted(false);
    setSolvedCount(0);
    setTotalCount(0);
    setComplete(false);
    setError(null);
  }

  // ── Config screen ─────────────────────────────────────────────
  if (!started) return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-6 relative">
      {/* Top Left Navigation */}
      <nav className="absolute top-8 left-8">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-black text-xs transition-colors font-pixel flex items-center gap-1"
        >
          <span>←</span> Home
        </button>
      </nav>

      <div className="text-center mb-8">
        <h1 className="font-pixel text-black font-bold text-3xl mb-2">Classic</h1>
        <p className="text-gray-500 text-xs font-pixel">No hints. No help. Choose your challenge.</p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-sm">
        <div>
          <p className="text-black text-xs mb-3 font-pixel font-bold">Grid size</p>
          <div className="flex gap-2 flex-wrap">
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-3 py-2 rounded text-xs font-pixel transition-all
                  ${size === s
                    ? 'bg-black text-white'
                    : 'bg-white text-black border border-gray-300 hover:bg-gray-100'}`}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 font-bold text-xs font-pixel">{error}</p>}

        <button
          onClick={startGame}
          disabled={loading}
          className="mt-4 py-4 bg-black hover:bg-gray-800 text-white disabled:opacity-50
                      font-pixel text-xs rounded-xl transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-none"
        >
          {loading ? 'Building…' : 'Start Puzzle'}
        </button>

        {loading && (
          <p className="text-black text-[10px] font-pixel text-center animate-pulse mt-4">
            {size >= 11 ? 'Large grids take 15–30 seconds…' : 'Generating your puzzle…'}
          </p>
        )}
      </div>
    </div>
  );

  // ── Game screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center p-4 gap-6 relative">
      {/* HUD / Header */}
      <div className="flex items-center justify-between w-full max-w-2xl pt-4">
        <button
          onClick={handleReset}
          className="text-gray-400 hover:text-black text-xs transition-colors font-pixel flex items-center gap-1"
        >
          <span>←</span> New game
        </button>

        <div className="flex flex-col items-center">
          <span className="font-pixel text-black font-bold text-xs">{size}×{size}</span>
          <div className="h-1 w-16 bg-gray-100 mt-1 rounded-full overflow-hidden">
             <div 
                className="h-full bg-black transition-all duration-500" 
                style={{ width: `${(solvedCount / (totalCount || 1)) * 100}%` }}
             />
          </div>
        </div>

        <span className="text-gray-500 text-xs font-pixel">
          {solvedCount}/{totalCount || (puzzle?.words.length ?? 0)} solved
        </span>
      </div>

      <div className="w-full max-w-2xl border-t border-gray-100" />

      {puzzle && (
        <CrosswordGrid
          puzzle={puzzle}
          revealedCells={new Set()}
          onSolvedCountChange={handleSolvedCountChange}
        />
      )}

      {complete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white border-4 border-black rounded-2xl p-10 text-center shadow-[8px_8px_0px_rgba(0,0,0,1)] mx-4">
            <div className="text-4xl mb-4">🏆</div>
            <p className="font-pixel text-black font-bold text-lg mb-2">Puzzle Complete!</p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={startGame}
                className="px-6 py-3 bg-black text-white hover:bg-gray-800 font-pixel text-xs rounded-xl transition-colors"
              >
                New Puzzle
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 bg-white text-black border-2 border-black hover:bg-gray-100 text-xs rounded-xl font-pixel transition-colors"
                >
                  Size
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-black text-xs rounded-xl font-pixel transition-colors"
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}