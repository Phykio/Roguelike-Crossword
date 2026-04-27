const PLAYER_ID_KEY    = 'crossword_player_id';
const USED_CLUES_KEY   = 'crossword_used_clues';
const RUN_STATE_KEY    = 'crossword_run_state';
const GAME_STATE_KEY   = 'crossword_game_state';
const PUZZLE_STATE_KEY = 'crossword_puzzle_state'; // grid + timer snapshot
const CLASSIC_UNLOCKED = 'crossword_classic_unlocked';

export function getOrCreatePlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getUsedClueIds() {
  try { return JSON.parse(localStorage.getItem(USED_CLUES_KEY)) || []; }
  catch { return []; }
}

export function markCluesUsed(ids) {
  const merged = [...new Set([...getUsedClueIds(), ...ids])];
  localStorage.setItem(USED_CLUES_KEY, JSON.stringify(merged));
}

// ── Run state (DB row) ─────────────────────────────────────────
export function saveRunState(run) {
  if (!run) { localStorage.removeItem(RUN_STATE_KEY); return; }
  localStorage.setItem(RUN_STATE_KEY, JSON.stringify(run));
}

export function loadRunState() {
  try { return JSON.parse(localStorage.getItem(RUN_STATE_KEY)) || null; }
  catch { return null; }
}

export function clearRunState() {
  localStorage.removeItem(RUN_STATE_KEY);
  localStorage.removeItem(GAME_STATE_KEY);
  localStorage.removeItem(PUZZLE_STATE_KEY);
}

// ── Game state (permanents, hints, timer) ──────────────────────
export function saveGameState(state) {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

export function loadGameState() {
  try { return JSON.parse(localStorage.getItem(GAME_STATE_KEY)) || null; }
  catch { return null; }
}

// ── Puzzle state (the actual grid + user answers + timer) ──────
// This is what allows the same puzzle to be resumed after refresh/back.
export function savePuzzleState(state) {
  // state = { puzzle, userAnswers, timerSeconds, revealedCells, revealedVowels }
  localStorage.setItem(PUZZLE_STATE_KEY, JSON.stringify(state));
}

export function loadPuzzleState() {
  try { return JSON.parse(localStorage.getItem(PUZZLE_STATE_KEY)) || null; }
  catch { return null; }
}

export function clearPuzzleState() {
  localStorage.removeItem(PUZZLE_STATE_KEY);
}

// ── Classic unlock ─────────────────────────────────────────────
export function isClassicUnlocked() {
  return localStorage.getItem(CLASSIC_UNLOCKED) === 'true';
}

export function unlockClassic() {
  localStorage.setItem(CLASSIC_UNLOCKED, 'true');
}