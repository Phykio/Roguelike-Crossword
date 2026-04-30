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

export const PERMANENT_LIMITS = {
  extra_time:      10, 
  extra_heart:     4,  
  bonus_time_long: 1,  
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

function getInitialState() {
  const g = loadGameState();
  return {
    hintsRemaining: g?.hintsRemaining ?? 0,
    timerSeconds:   g?.timerSeconds   ?? DEFAULT_TIMER,
    upgrades:       g?.upgrades       ?? [],
  };
}

function persist(s) {
  saveGameState({
    hintsRemaining: s.hintsRemaining,
    timerSeconds:   s.timerSeconds,
    upgrades:       s.upgrades,
  });
}

export const useGameStore = create((set, get) => ({
  run:    null,
  puzzle: null,
  ...getInitialState(),

  setRun(run) {
    if (run && !run.permanents) {
      run.permanents = { extraTime: 0, extraTimeCount: 0, extraHearts: 0, bonusTimeOnLong: false };
    }
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

  applyPermanent(type) {
    set(s => {
      if (!s.run) return {};
      const cost = PERMANENT_COSTS[type];
      const p = s.run.permanents || { extraTime: 0, extraTimeCount: 0, extraHearts: 0, bonusTimeOnLong: false };

      if (s.run.coins < cost) return {};

      if (type === 'extra_time' && (p.extraTimeCount >= PERMANENT_LIMITS.extra_time)) return {};
      if (type === 'extra_heart' && (p.extraHearts >= PERMANENT_LIMITS.extra_heart)) return {};
      if (type === 'bonus_time_long' && p.bonusTimeOnLong) return {};

      const nextPermanents = { ...p };
      
      if (type === 'extra_time') {
        nextPermanents.extraTime = (nextPermanents.extraTime || 0) + 30;
        nextPermanents.extraTimeCount = (nextPermanents.extraTimeCount || 0) + 1;
      }
      if (type === 'extra_heart') {
        nextPermanents.extraHearts = (nextPermanents.extraHearts || 0) + 1;
      }
      if (type === 'bonus_time_long') {
        nextPermanents.bonusTimeOnLong = true;
      }

      const run = { 
        ...s.run, 
        coins: s.run.coins - cost,
        permanents: nextPermanents 
      };
      
      saveRunState(run);
      return { run };
    });
  },

  buyActive(type, cost) {
    set(s => {
      if ((s.run?.coins ?? 0) < cost) return {};
      const run = { ...s.run, coins: s.run.coins - cost };
      const upgrades = [...s.upgrades, type];
      const hintsRemaining = type === 'hint' ? s.hintsRemaining + 1 : s.hintsRemaining;

      saveRunState(run);
      persist({ ...s, run, upgrades, hintsRemaining });
      return { run, upgrades, hintsRemaining };
    });
  },

  resetPuzzleState() {
    set(s => {
      const timerSeconds = DEFAULT_TIMER + (s.run?.permanents?.extraTime ?? 0);
      const upgrades = [];
      persist({ ...s, timerSeconds, upgrades });
      return { timerSeconds, upgrades };
    });
  },

  resetRun() {
    clearRunState();
    const fresh = {
      run:            null,
      puzzle:         null,
      upgrades:       [],
      hintsRemaining: 0,
      timerSeconds:   DEFAULT_TIMER,
    };
    saveGameState(fresh);
    set(fresh);
  },
}));