import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import CrosswordGrid from '../components/CrosswordGrid.jsx';
import UpgradeShop from '../components/UpgradeShop.jsx';
import PuzzleTimer from '../components/PuzzleTimer.jsx';
import HeartsDisplay from '../components/HeartsDisplay.jsx';
import api from '../lib/api.js';
import {
  getOrCreatePlayerId,
  getUsedClueIds,
  markCluesUsed,
  loadRunState,
  savePuzzleState,
  loadPuzzleState,
  clearPuzzleState,
  unlockClassic,
} from '../lib/player.js';

const MAX_LEVEL = 12;

export default function RoguelikePage() {
  const navigate = useNavigate();
  const {
    run, puzzle,
    setRun, setPuzzle,
    addScore, addCoins, advanceLevel,
    loseHeart,
    permanents,
    hintsRemaining, useHint,
    addTime,
    resetRun, resetPuzzleState,
    setTimer,
  } = useGameStore();

  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [revealedCells,  setRevealedCells]  = useState(new Set());
  const [revealedVowels, setRevealedVowels] = useState(new Set());
  const [showShop,       setShowShop]       = useState(false);
  const [levelComplete,  setLevelComplete]  = useState(false);
  const [gameover,       setGameover]       = useState(false);
  const [victory,        setVictory]        = useState(false);
  const [activeWord,     setActiveWord]     = useState(null);
  const [lexicalHint,    setLexicalHint]    = useState(null);
  const [userAnswers,    setUserAnswers]    = useState(null);

  const scoredWordsRef   = useRef(new Set());
  const timerPausedRef   = useRef(false);

  // ── Persist puzzle state ───────────────────────────────────────

  function savePuzzle(overrides = {}) {
    if (!puzzle) return;
    const currentTimer = useGameStore.getState().timerSeconds;
    savePuzzleState({
      puzzle,
      userAnswers:    overrides.userAnswers    ?? userAnswers,
      revealedCells:  [...(overrides.revealedCells  ?? revealedCells)],
      revealedVowels: [...(overrides.revealedVowels ?? revealedVowels)],
      scoredWords:    [...scoredWordsRef.current],
      timerSeconds:   currentTimer,
    });
  }

  // ── Init — restore or start fresh ─────────────────────────────

  useEffect(() => {
    async function init() {
      let activeRun = run;

      if (!activeRun) {
        const saved = loadRunState();
        if (saved?.status === 'active') {
          setRun(saved);
          activeRun = saved;
        } else {
          try {
            const { data } = await api.post('/api/run/start', {
              playerId: getOrCreatePlayerId(),
            });
            setRun(data);
            activeRun = data;
          } catch {
            setError('Could not start a run. Is the server running?');
            setLoading(false);
            return;
          }
        }
      }

      const savedPuzzle = loadPuzzleState();
      if (savedPuzzle?.puzzle?.size) {
        setPuzzle(savedPuzzle.puzzle);
        if (savedPuzzle.userAnswers)    setUserAnswers(savedPuzzle.userAnswers);
        if (savedPuzzle.revealedCells)  setRevealedCells(new Set(savedPuzzle.revealedCells));
        if (savedPuzzle.revealedVowels) setRevealedVowels(new Set(savedPuzzle.revealedVowels));
        if (savedPuzzle.scoredWords)    scoredWordsRef.current = new Set(savedPuzzle.scoredWords);
        if (typeof savedPuzzle.timerSeconds === 'number') setTimer(savedPuzzle.timerSeconds);
        setLoading(false);
      } else {
        await fetchPuzzle(activeRun);
      }
    }
    init();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (puzzle && !loading) savePuzzle();
  }, [revealedCells, revealedVowels]); // eslint-disable-line

  // ── Fetch new puzzle ───────────────────────────────────────────

  async function fetchPuzzle(activeRun) {
    setLoading(true);
    setError(null);
    setRevealedCells(new Set());
    setRevealedVowels(new Set());
    setLevelComplete(false);
    setLexicalHint(null);
    setUserAnswers(null);
    scoredWordsRef.current = new Set();
    timerPausedRef.current = false;
    clearPuzzleState();
    resetPuzzleState();

    try {
      const { data } = await api.get('/api/puzzle', {
        params: {
          level:    activeRun?.level ?? 1,
          playerId: getOrCreatePlayerId(),
        },
      });
      setPuzzle(data);
      savePuzzleState({
        puzzle:         data,
        userAnswers:    null,
        revealedCells:  [],
        revealedVowels: [],
        scoredWords:    [],
        timerSeconds:   useGameStore.getState().timerSeconds,
      });
    } catch {
      setError('Could not generate a puzzle. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Timer ran out ──────────────────────────────────────────────

  async function handleTimeUp() {
    timerPausedRef.current = true;
    clearPuzzleState();
    try {
      const { data } = await api.post(`/api/run/${run.id}/hearts`, { delta: -1 });
      setRun(data);
      if (data.hearts <= 0 || data.status === 'lost') { setGameover(true); return; }
      await fetchPuzzle({ ...run, hearts: data.hearts });
    } catch {
      loseHeart();
      const currentHearts = useGameStore.getState().run?.hearts ?? 0;
      if (currentHearts <= 0) setGameover(true);
    }
  }

  // ── Word solved ────────────────────────────────────────────────

  const handleWordSolved = useCallback((word) => {
    const key = `${word.number}-${word.direction}`;
    if (scoredWordsRef.current.has(key)) return;
    scoredWordsRef.current.add(key);
    addScore(word.answer.length * 10);
    addCoins(word.answer.length * 2);
    if (permanents.bonusTimeOnLong && word.answer.length >= 8) addTime(30);
  }, [addScore, addCoins, addTime, permanents]);

  const handleSolvedCountChange = useCallback((solved, total) => {
    if (puzzle && solved === total) handlePuzzleComplete();
  }, [puzzle]); // eslint-disable-line

  async function handlePuzzleComplete() {
    timerPausedRef.current = true;
    setLevelComplete(true);
    clearPuzzleState();
    const clueIds = puzzle.words.map(w => w.id);
    markCluesUsed(clueIds);
    try {
      await api.post('/api/puzzle/complete', {
        playerId: getOrCreatePlayerId(),
        clueIds,
      });
    } catch { /* fire and forget */ }
  }

  // ── Next level ─────────────────────────────────────────────────

  async function handleNextLevel() {
    const currentLevel = run?.level ?? 1;
    if (currentLevel >= MAX_LEVEL) {
      unlockClassic();
      setLevelComplete(false);
      setVictory(true);
      try {
        await api.patch(`/api/run/${run.id}/end`, { status: 'won', score: run.score });
        setRun({ ...run, status: 'won' });
      } catch { /* ignore */ }
      return;
    }
    try {
      const { data } = await api.patch(`/api/run/${run.id}/level-complete`, {
        score: run.score,
        coins: run.coins,
      });
      setRun(data);
      await fetchPuzzle(data);
    } catch {
      advanceLevel();
      await fetchPuzzle({ ...run, level: currentLevel + 1 });
    }
  }

  // ── Permanent upgrades (API-backed) ───────────────────────────
  // Called by UpgradeShop. Makes the server call, then syncs the store
  // via setRun (which re-derives permanents from the returned run row).

  async function handleApplyPermanent(type) {
    const { data } = await api.post(`/api/run/${run.id}/permanent`, { type });
    setRun(data); // re-derives permanents + updates coins/hearts automatically
  }

  // ── Hints ──────────────────────────────────────────────────────

  function handleHint() {
    if (hintsRemaining <= 0 || !puzzle) return;
    const unsolved = puzzle.words.filter(
      w => !scoredWordsRef.current.has(`${w.number}-${w.direction}`)
    );
    if (!unsolved.length) return;
    const target = unsolved[0];
    for (let i = 0; i < target.answer.length; i++) {
      const r   = target.direction === 'across' ? target.row     : target.row + i;
      const c   = target.direction === 'across' ? target.col + i : target.col;
      const key = `${r}-${c}`;
      if (!revealedCells.has(key)) {
        const next = new Set(revealedCells);
        next.add(key);
        setRevealedCells(next);
        useHint();
        savePuzzle({ revealedCells: next });
        break;
      }
    }
  }

  function handleRevealVowels(word) {
    if (!word || word.answer.length < 8) return;
    const vowels = new Set(['A','E','I','O','U']);
    const next   = new Set(revealedVowels);
    for (let i = 0; i < word.answer.length; i++) {
      if (vowels.has(word.answer[i])) {
        const r = word.direction === 'across' ? word.row     : word.row + i;
        const c = word.direction === 'across' ? word.col + i : word.col;
        next.add(`${r}-${c}`);
      }
    }
    setRevealedVowels(next);
    savePuzzle({ revealedVowels: next });
  }

  const allRevealedCells = new Set([...revealedCells, ...revealedVowels]);

  function handleSkipWord() {
    const first = puzzle?.words.find(
      w => !scoredWordsRef.current.has(`${w.number}-${w.direction}`)
    );
    if (!first) return;
    const next = new Set(revealedCells);
    for (let i = 0; i < first.answer.length; i++) {
      const r = first.direction === 'across' ? first.row     : first.row + i;
      const c = first.direction === 'across' ? first.col + i : first.col;
      next.add(`${r}-${c}`);
    }
    setRevealedCells(next);
    savePuzzle({ revealedCells: next });
  }

  function handleUserAnswersChange(answers) {
    setUserAnswers(answers);
    const currentTimer = useGameStore.getState().timerSeconds;
    savePuzzleState({
      puzzle,
      userAnswers:    answers,
      revealedCells:  [...revealedCells],
      revealedVowels: [...revealedVowels],
      scoredWords:    [...scoredWordsRef.current],
      timerSeconds:   currentTimer,
    });
  }

  // ── Navigation ─────────────────────────────────────────────────

  function handleGoHome() {
    timerPausedRef.current = true;
    savePuzzle();
    navigate('/');
  }

  async function handleQuitRun() {
    timerPausedRef.current = true;
    if (run?.id) {
      try {
        await api.patch(`/api/run/${run.id}/end`, { status: 'lost', score: run.score });
      } catch { /* ignore */ }
    }
    resetRun();
    clearPuzzleState();
    navigate('/');
  }

  // ── Dev cheat ──────────────────────────────────────────────────

  useEffect(() => {
    function handleCheat(e) {
      if (e.key === '\\' && puzzle && !levelComplete && !gameover && !loading) {
        e.preventDefault();
        puzzle.words.forEach(word => {
          const key = `${word.number}-${word.direction}`;
          if (!scoredWordsRef.current.has(key)) {
            scoredWordsRef.current.add(key);
            addScore(word.answer.length * 10);
            addCoins(word.answer.length * 2);
          }
        });
        handlePuzzleComplete();
      }
    }
    window.addEventListener('keydown', handleCheat);
    return () => window.removeEventListener('keydown', handleCheat);
  }, [puzzle, levelComplete, gameover, loading]); // eslint-disable-line

  // ── Victory screen ─────────────────────────────────────────────

  if (victory) return (
    <div className="min-h-screen bg-white text-black flex flex-col
                    items-center justify-center gap-8 p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6"></div>
        <h1 className="font-pixel text-black font-bold text-xl mb-4 leading-loose">
          You Won!
        </h1>
        <p className="text-gray-600 text-xs mb-2 leading-relaxed">
          You completed all {MAX_LEVEL} levels of Roguelike mode.
        </p>
        <p className="text-gray-500 text-xs mb-6 leading-relaxed">
          Classic mode is now unlocked. A new challenge awaits.
        </p>
        <div className="bg-gray-50 border-2 border-black rounded-xl p-4 mb-8
                        flex justify-around">
          <div className="text-center">
            <p className="font-pixel text-black font-bold text-lg">{run?.score ?? 0}</p>
            <p className="text-gray-500 text-xs mt-1 font-pixel">pts</p>
          </div>
          <div className="w-px bg-gray-200" />
          <div className="text-center">
            <p className="font-pixel text-black font-bold text-lg">{MAX_LEVEL}</p>
            <p className="text-gray-500 text-xs mt-1 font-pixel">levels</p>
          </div>
          <div className="w-px bg-gray-200" />
          <div className="text-center">
            <p className="font-pixel text-black font-bold text-lg">{run?.hearts ?? 0}</p>
            <p className="text-gray-500 text-xs mt-1 font-pixel">hearts left</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { resetRun(); navigate('/classic'); }}
            className="px-8 py-3 bg-black text-white hover:bg-gray-800
                       font-pixel text-xs rounded-xl transition-colors w-full">
            Play Classic Mode →
          </button>
          <button
            onClick={() => { resetRun(); navigate('/'); }}
            className="px-8 py-3 bg-white text-black border-2 border-black
                       hover:bg-gray-50 font-pixel text-xs rounded-xl transition-colors w-full">
            Play Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-black text-xs transition-colors font-pixel underline">
            Home
          </button>
        </div>
      </div>
    </div>
  );

  // ── Game over screen ───────────────────────────────────────────

  if (gameover) return (
    <div className="min-h-screen bg-white text-black flex flex-col
                    items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">💀</div>
        <p className="font-pixel text-black font-bold text-xl mb-2">Game Over</p>
        <p className="text-gray-600 text-xs mb-1">You ran out of hearts.</p>
        <p className="text-gray-500 text-xs">
          Final score: {run?.score ?? 0} pts · Level {run?.level ?? 1}
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => { resetRun(); clearPuzzleState(); navigate('/'); }}
          className="px-6 py-3 bg-black text-white hover:bg-gray-800
                     font-pixel text-xs rounded-xl transition-colors w-full">
          Try Again
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-white text-black border-2 border-black
                     hover:bg-gray-50 text-xs font-pixel rounded-xl transition-colors w-full">
          Home
        </button>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white text-black flex flex-col
                    items-center justify-center gap-4">
      <p className="text-black font-pixel text-xs">{error}</p>
      <button onClick={() => navigate('/')}
        className="text-gray-600 text-xs underline hover:text-black">
        Home
      </button>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-black flex flex-col
                    items-center p-4 gap-4">

      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-2xl pt-2">

        <div className="flex-1 flex items-center justify-start gap-3">
          <button
            onClick={handleGoHome}
            className="text-gray-400 hover:text-black text-xs transition-colors font-pixel"
            title="Go home (run is saved)"
          >
            ← Home
          </button>
          <HeartsDisplay />
        </div>

        <div className="flex justify-center items-center gap-6 font-pixel text-xs shrink-0">
          <div className="flex flex-col items-center w-14">
            <span className="text-gray-500" style={{ fontSize: 8 }}>LVL</span>
            <span className="text-black">{run?.level ?? 1}/{MAX_LEVEL}</span>
          </div>
          <div className="flex flex-col items-center w-16">
            <span className="text-gray-500" style={{ fontSize: 8 }}>PTS</span>
            <span className="text-black">{run?.score ?? 0}</span>
          </div>
          <div className="flex flex-col items-center w-16">
            <span className="text-gray-500" style={{ fontSize: 8 }}>COINS</span>
            <span className="text-black">{run?.coins ?? 0}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3">
          <PuzzleTimer
            onTimeUp={handleTimeUp}
            paused={timerPausedRef.current || loading || levelComplete}
          />
          <button
            onClick={() => setShowShop(true)}
            className="text-black hover:text-gray-600 font-pixel text-xs
                       transition-colors underline decoration-2 underline-offset-4">
            Shop
          </button>
          <button
            onClick={handleQuitRun}
            className="text-red-400 hover:text-red-600 font-pixel text-base transition-colors"
            title="Reset run (progress will be lost)"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl border-t border-gray-200" />

      {/* Puzzle */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-black border-t-transparent
                          rounded-full animate-spin" />
          <p className="font-pixel text-black text-xs animate-pulse">Building puzzle…</p>
        </div>
      ) : puzzle ? (
        <>
          <CrosswordGrid
            puzzle={puzzle}
            revealedCells={allRevealedCells}
            onWordSolved={handleWordSolved}
            onSolvedCountChange={handleSolvedCountChange}
            onActiveWordChange={setActiveWord}
            onUserAnswersChange={handleUserAnswersChange}
            initialUserAnswers={userAnswers}
            lexicalHint={lexicalHint}
            onDismissLexicalHint={() => setLexicalHint(null)}
          />

          <div className="flex gap-3 flex-wrap justify-center pb-2">
            <button
              onClick={handleHint}
              disabled={hintsRemaining <= 0}
              className="px-4 py-2 bg-white text-black border border-black
                         hover:bg-gray-100 disabled:opacity-40
                         disabled:cursor-not-allowed text-xs font-pixel
                         rounded-lg transition-colors">
               Hint ({hintsRemaining})
            </button>
          </div>

          {levelComplete && (
            <div className="fixed inset-0 bg-black/50 flex items-center
                            justify-center z-40">
              <div className="bg-white border-4 border-black rounded-2xl
                              p-10 text-center max-w-sm mx-4
                              shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                <div className="text-4xl mb-4">
                  {(run?.level ?? 1) >= MAX_LEVEL ? '' : ''}
                </div>
                <p className="font-pixel text-black font-bold text-sm mb-1">
                  Level {run?.level} Complete!
                </p>
                {(run?.level ?? 1) >= MAX_LEVEL && (
                  <p className="text-gray-600 text-xs mb-3">You've reached the final level!</p>
                )}
                <p className="text-black font-pixel text-xs mb-6">
                  +{puzzle.words.reduce((s, w) => s + w.answer.length * 10, 0)} pts
                </p>
                <button
                  onClick={handleNextLevel}
                  className="px-8 py-3 bg-black text-white hover:bg-gray-800
                             font-pixel text-xs rounded-xl transition-colors w-full">
                  {(run?.level ?? 1) >= MAX_LEVEL ? 'Claim Victory →' : 'Next Level →'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Shop */}
      {showShop && (
        <UpgradeShop
          onClose={() => setShowShop(false)}
          onApplyPermanent={handleApplyPermanent}
          onHint={handleHint}
          onSkipWord={handleSkipWord}
          onRevealVowels={handleRevealVowels}
          onLexicalHint={(type, value, answer) => setLexicalHint({ type, value, answer })}
          activeWord={activeWord}
        />
      )}
    </div>
  );
}