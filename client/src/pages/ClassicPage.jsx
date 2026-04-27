import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CrosswordGrid from '../components/CrosswordGrid.jsx';
import api from '../lib/api.js';
import { getOrCreatePlayerId, getUsedClueIds } from '../lib/player.js';

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15];

function sizeLabel(s) {
  if (s <= 3)  return ;
  if (s <= 4)  return ;
  if (s <= 5)  return ;
  if (s <= 6) return ;
  if (s <= 7)  return ;
  if (s <= 8)  return ;
  if (s <= 9)  return ;
  if (s <= 11) return ;
  if (s <= 13) return ;
  return ;
}

export default function ClassicPage() {
  const navigate = useNavigate();
  const [size,        setSize]       = useState(9);
  const [puzzle,      setPuzzle]     = useState(null);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState(null);
  const [started,     setStarted]    = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [totalCount,  setTotalCount]  = useState(0);
  const [complete,    setComplete]   = useState(false);

  async function startGame() {
    setLoading(true);
    setError(null);
    setSolvedCount(0);
    setTotalCount(0);
    setComplete(false);

    try {
      const { data } = await api.get('/api/puzzle', {
        params: {
          level:    10,
          size,
          playerId: getOrCreatePlayerId(),
          usedIds:  getUsedClueIds().join(','),
        },
      });
      setPuzzle(data);
      setStarted(true);
    } catch {
      setError('Could not generate a puzzle. Is the server running?');
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
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center gap-8 p-6">
      <button
        onClick={() => navigate('/')}
        className="self-start text-gray-500 hover:text-black text-xs transition-colors font-pixel">
        &#8592; Home
      </button>

      <div className="text-center">
        <h1 className="font-pixel text-black font-bold text-xl mb-2">Classic</h1>
        <p className="text-gray-600 text-xs">No hints. No help. Choose your challenge.</p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-sm">
        <div>
          <p className="text-black text-xs mb-3 font-pixel font-bold">Grid size</p>
          <div className="flex gap-2 flex-wrap">
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-3 py-2 rounded text-xs font-pixel transition-colors
                  ${size === s
                    ? 'bg-black text-white'
                    : 'bg-white text-black border border-gray-300 hover:bg-gray-100'}`}>
                {s}×{s}
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-3">{sizeLabel(size)}</p>
        </div>

        {error && <p className="text-black font-bold text-xs">{error}</p>}

        <button
          onClick={startGame}
          disabled={loading}
          className="mt-2 py-3 bg-black hover:bg-gray-800 text-white disabled:opacity-50
                     font-pixel text-xs rounded-xl transition-colors">
          {loading ? 'Building…' : 'Start Puzzle'}
        </button>

        {loading && (
          <p className="text-black text-xs font-pixel text-center animate-pulse">
            {size >= 11
              ? 'Large grids take 15–30 seconds…'
              : size >= 8
              ? 'Generating your puzzle…'
              : 'Almost ready…'}
          </p>
        )}
      </div>
    </div>
  );

  // ── Game screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center p-4 gap-6">
      <div className="flex items-center gap-4 w-full max-w-2xl pt-4">
        <button
          onClick={handleReset}
          className="text-gray-500 hover:text-black text-xs transition-colors font-pixel">
          &#8592; New game
        </button>
        <div className="flex-1 flex justify-center">
          <span className="font-pixel text-black font-bold text-xs">{size}×{size}</span>
        </div>
        <span className="text-gray-500 text-xs font-pixel">
          {solvedCount}/{totalCount || (puzzle?.words.length ?? 0)} solved
        </span>
      </div>

      {puzzle && (
        <CrosswordGrid
          puzzle={puzzle}
          revealedCells={new Set()}
          onSolvedCountChange={handleSolvedCountChange}
        />
      )}

      {complete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white border-4 border-black rounded-2xl p-10 text-center">
            <p className="font-pixel text-black font-bold text-sm mb-2">Puzzle Complete!</p>
            <p className="text-gray-700 text-xs mb-6">
              You solved all {puzzle.words.length} words.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startGame}
                className="px-6 py-2 bg-black text-white hover:bg-gray-800 font-pixel text-xs rounded-xl transition-colors">
                New Puzzle
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-white text-black border border-black hover:bg-gray-100 text-xs rounded-xl transition-colors">
                Change Size
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-black text-xs rounded-xl transition-colors">
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}