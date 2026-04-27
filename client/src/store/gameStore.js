import { create } from 'zustand';
import {
  saveRunState,
  clearRunState,
  saveGameState,
  loadGameState,
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

const DEFAULT_TIMER = 300;

// Load persisted client state on startup
function getInitialState() {
  const g = loadGameState();
  return {
    permanents:     g?.permanents     ?? {},
    hintsRemaining: g?.hintsRemaining ?? 0,   // no cap — infinite storage
    timerSeconds:   g?.timerSeconds   ?? DEFAULT_TIMER,
    upgrades:       g?.upgrades       ?? [],
  };
}

function persist(s) {
  // Helper: save the current game state snapshot
  saveGameState({
    permanents:     s.permanents,
    hintsRemaining: s.hintsRemaining,
    timerSeconds:   s.timerSeconds,
    upgrades:       s.upgrades,
  });
}

export const useGameStore = create((set, get) => ({
  run:    null,
  puzzle: null,
  ...getInitialState(),

  // ── Run ────────────────────────────────────────────────────────
  setRun(run) {
    set({ run });
    saveRunState(run);
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

  // ── Timer ──────────────────────────────────────────────────────
  // addTime(-1) is called every second by the timer component.
  // We save to localStorage on every tick so a refresh resumes exactly.
  addTime(sec) {
    set(s => {
      const timerSeconds = Math.max(0, s.timerSeconds + sec);
      const next = { ...s, timerSeconds };
      persist(next);
      return { timerSeconds };
    });
  },

  setTimer(sec) {
    set(s => {
      const next = { ...s, timerSeconds: sec };
      persist(next);
      return { timerSeconds: sec };
    });
  },

  // ── Hints — no cap, infinite accumulation ─────────────────────
  addHints(n) {
    set(s => {
      const hintsRemaining = s.hintsRemaining + n;
      const next = { ...s, hintsRemaining };
      persist(next);
      return { hintsRemaining };
    });
  },

  useHint() {
    set(s => {
      const hintsRemaining = Math.max(0, s.hintsRemaining - 1);
      const next = { ...s, hintsRemaining };
      persist(next);
      return { hintsRemaining };
    });
  },

  // ── Permanent upgrades ─────────────────────────────────────────
  applyPermanent(type) {
    set(s => {
      const cost = PERMANENT_COSTS[type];
      if ((s.run?.coins ?? 0) < cost) return {};

      const permanents = { ...s.permanents };
      if (type === 'extra_time')       permanents.extraTime       = (permanents.extraTime || 0) + 30;
      if (type === 'extra_heart')      permanents.extraHearts     = (permanents.extraHearts || 0) + 1;
      if (type === 'bonus_time_long')  permanents.bonusTimeOnLong = true;

      const run = { ...s.run, coins: (s.run?.coins ?? 0) - cost };
      saveRunState(run);
      const next = { ...s, permanents, run };
      persist(next);
      return { run, permanents };
    });
  },

  // ── Active upgrades ────────────────────────────────────────────
  buyActive(type, cost) {
    set(s => {
      if ((s.run?.coins ?? 0) < cost) return {};

      const run      = { ...s.run, coins: (s.run?.coins ?? 0) - cost };
      const upgrades = [...s.upgrades, type];

      // Buying hint adds 1 to the pool — no cap
      const hintsRemaining = type === 'hint'
        ? s.hintsRemaining + 1
        : s.hintsRemaining;

      saveRunState(run);
      const next = { ...s, run, upgrades, hintsRemaining };
      persist(next);
      return { run, upgrades, hintsRemaining };
    });
  },

  // ── Reset puzzle state (new puzzle, same run) ──────────────────
  // Does NOT reset hints — they carry over between puzzles.
  // Resets timer to base + permanent bonuses.
  resetPuzzleState() {
    set(s => {
      const timerSeconds = DEFAULT_TIMER + (s.permanents?.extraTime ?? 0);
      const upgrades     = [];
      const next = { ...s, timerSeconds, upgrades };
      persist(next);
      return { timerSeconds, upgrades };
    });
  },

  // ── Full run reset ─────────────────────────────────────────────
  resetRun() {
    clearRunState();
    const fresh = {
      run:            null,
      puzzle:         null,
      permanents:     {},
      upgrades:       [],
      hintsRemaining: 0,
      timerSeconds:   DEFAULT_TIMER,
    };
    saveGameState({
      permanents:     {},
      hintsRemaining: 0,
      timerSeconds:   DEFAULT_TIMER,
      upgrades:       [],
    });
    set(fresh);
  },
}));