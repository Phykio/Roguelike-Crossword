import { create } from 'zustand';
import {
  saveRunState,
  clearRunState,
  saveGameState,
  loadGameState,
  loadRunState,
} from '../lib/player.js';

export const PERMANENT_COSTS = {
  extra_time:      50,
  extra_heart:     100,
  bonus_time_long: 80,
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

export const PERMANENT_LIMITS = {
  extra_heart:     4,
  extra_time:      300,
  bonus_time_long: 1,
};

const DEFAULT_TIMER = 300;

function derivePermanents(run) {
  if (!run) return {};
  return {
    extraHearts:     run.extra_hearts_count       ?? 0,
    extraTime:       run.extra_time_seconds        ?? 0,
    bonusTimeOnLong: run.bonus_time_long_purchased ?? false,
  };
}

function hasPermanentFields(run) {
  if (!run) return false;
  return (
    Object.prototype.hasOwnProperty.call(run, 'extra_hearts_count')
    || Object.prototype.hasOwnProperty.call(run, 'extra_time_seconds')
    || Object.prototype.hasOwnProperty.call(run, 'bonus_time_long_purchased')
  );
}

function getInitialState() {
  const g        = loadGameState();
  const savedRun = loadRunState();
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
  setRun(run) {
    const currentPermanents = get().permanents ?? {};
    const permanents = hasPermanentFields(run)
      ? derivePermanents(run)
      : currentPermanents;
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

  // addCoins is used for word-solve rewards (local only until level-complete syncs to DB).
  // Coin *spending* goes through the API and back via setRun — do not deduct locally.
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
  // addHints is called locally after a successful API purchase of 'hint'.
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
    const saved = loadGameState();
    const permanents = saved?.permanents ?? get().permanents ?? {};
    const timerSeconds = DEFAULT_TIMER + (permanents?.extraTime ?? 0);
    const fresh = {
      run:            null,
      puzzle:         null,
      permanents,
      hintsRemaining: 0,
      timerSeconds,
    };
    saveGameState({ permanents, hintsRemaining: 0, timerSeconds });
    set(fresh);
  },
}));