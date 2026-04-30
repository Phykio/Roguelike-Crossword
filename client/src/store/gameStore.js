import { create } from 'zustand';
import {
  saveRunState,
  clearRunState,
  saveGameState,
  loadGameState,
  loadRunState,
} from '../lib/player.js';

export const PERMANENT_COSTS = {
  extra_time:      30,
  extra_heart:     60,
  bonus_time_long: 50,
};

export const ACTIVE_COSTS = {
  hint:            10,
  skip_word:       40,
  reveal_vowels:   25,
  hint_pos:        15,
  hint_synonym:    25,
  hint_definition: 35,
  hint_example:    20,
};

// Limits — kept in sync with the server's PERMANENT_RULES
export const PERMANENT_LIMITS = {
  extra_heart:     4,    // max extra hearts (1 base + 4 extra = 5 total)
  extra_time:      600,  // max extra seconds (10 minutes)
  bonus_time_long: 1,    // one-time purchase
};

const DEFAULT_TIMER = 300;

// Derive the client permanents object from a run row returned by the API.
function derivePermanents(run) {
  if (!run) return {};
  return {
    extraHearts:     run.extra_hearts_count       ?? 0,
    extraTime:       run.extra_time_seconds        ?? 0,
    bonusTimeOnLong: run.bonus_time_long_purchased ?? false,
  };
}

function getInitialState() {
  const g        = loadGameState();
  const savedRun = loadRunState();
  // Prefer run-derived permanents (DB source of truth) over cached game state
  const permanents = savedRun ? derivePermanents(savedRun) : (g?.permanents ?? {});
  return {
    permanents,
    hintsRemaining: g?.hintsRemaining ?? 0,
    timerSeconds:   g?.timerSeconds   ?? DEFAULT_TIMER,
  };
}

function persist(s) {
  saveGameState({
    permanents:     s.permanents,
    hintsRemaining: s.hintsRemaining,
    timerSeconds:   s.timerSeconds,
  });
}

export const useGameStore = create((set, get) => ({
  run:    null,
  puzzle: null,
  ...getInitialState(),

  // ── Run ──────────────────────────────────────────────────────
  // Always re-derives permanents from the updated run so the client
  // stays in sync with whatever the server returned.
  setRun(run) {
    const permanents = derivePermanents(run);
    set({ run, permanents });
    saveRunState(run);
    persist({ ...get(), permanents });
  },

  setPuzzle(puzzle) { set({ puzzle }); },

  addScore(pts) {
    set(s => {
      const run = { ...s.run, score: (s.run?.score ?? 0) + pts };
      saveRunState(run);
      return { run };
    });
  },

  addCoins(amt) {
    set(s => {
      const run = { ...s.run, coins: (s.run?.coins ?? 0) + amt };
      saveRunState(run);
      return { run };
    });
  },

  advanceLevel() {
    set(s => {
      const run = { ...s.run, level: (s.run?.level ?? 1) + 1 };
      saveRunState(run);
      return { run };
    });
  },

  loseHeart() {
    set(s => {
      const hearts = Math.max(0, (s.run?.hearts ?? 1) - 1);
      const run    = { ...s.run, hearts };
      saveRunState(run);
      return { run };
    });
  },

  // ── Timer ────────────────────────────────────────────────────
  addTime(sec) {
    set(s => {
      const timerSeconds = Math.max(0, s.timerSeconds + sec);
      persist({ ...s, timerSeconds });
      return { timerSeconds };
    });
  },

  setTimer(sec) {
    set(s => {
      persist({ ...s, timerSeconds: sec });
      return { timerSeconds: sec };
    });
  },

  // ── Hints ────────────────────────────────────────────────────
  addHints(n) {
    set(s => {
      const hintsRemaining = s.hintsRemaining + n;
      persist({ ...s, hintsRemaining });
      return { hintsRemaining };
    });
  },

  useHint() {
    set(s => {
      const hintsRemaining = Math.max(0, s.hintsRemaining - 1);
      persist({ ...s, hintsRemaining });
      return { hintsRemaining };
    });
  },

  // ── Active upgrades ───────────────────────────────────────────
  // Permanent upgrades are now applied server-side (POST /api/run/:id/permanent).
  // The API response is passed to setRun(), which re-derives permanents automatically.
  buyActive(type, cost) {
    set(s => {
      if ((s.run?.coins ?? 0) < cost) return {};
      const run = { ...s.run, coins: (s.run?.coins ?? 0) - cost };
      const hintsRemaining = type === 'hint' ? s.hintsRemaining + 1 : s.hintsRemaining;
      saveRunState(run);
      persist({ ...s, run, hintsRemaining });
      return { run, hintsRemaining };
    });
  },

  // ── Reset puzzle state (new puzzle, same run) ─────────────────
  resetPuzzleState() {
    set(s => {
      const timerSeconds = DEFAULT_TIMER + (s.permanents?.extraTime ?? 0);
      persist({ ...s, timerSeconds });
      return { timerSeconds };
    });
  },

  // ── Full run reset ────────────────────────────────────────────
  resetRun() {
    clearRunState();
    const fresh = {
      run:            null,
      puzzle:         null,
      permanents:     {},
      hintsRemaining: 0,
      timerSeconds:   DEFAULT_TIMER,
    };
    saveGameState({ permanents: {}, hintsRemaining: 0, timerSeconds: DEFAULT_TIMER });
    set(fresh);
  },
}));