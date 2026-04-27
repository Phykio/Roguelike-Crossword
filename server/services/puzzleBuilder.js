import pool from '../db.js';

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — PackedTrie
// ═══════════════════════════════════════════════════════════════

const NODE_SIZE   = 27;
const END_FLAG    = 26;
const INITIAL_CAP = 1_000_000;

class PackedTrie {
  constructor() {
    this.buf  = new Uint32Array(NODE_SIZE * INITIAL_CAP);
    this.size = 1;
  }

  _alloc() {
    if (this.size * NODE_SIZE >= this.buf.length) {
      const next = new Uint32Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    return this.size++;
  }

  insert(word) {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const ci  = word.charCodeAt(i) - 65;
      const off = node * NODE_SIZE + ci;
      if (this.buf[off] === 0) this.buf[off] = this._alloc();
      node = this.buf[off];
    }
    this.buf[node * NODE_SIZE + END_FLAG] |= 1;
  }

  query(pattern, limit = 200) {
    const results = [];
    const len     = pattern.length;

    const dfs = (node, depth, chars) => {
      if (results.length >= limit) return;
      if (depth === len) {
        if ((this.buf[node * NODE_SIZE + END_FLAG] & 1) === 1)
          results.push(chars.join(''));
        return;
      }
      const fixed = pattern[depth];
      if (fixed !== null) {
        const ci   = fixed.charCodeAt(0) - 65;
        const next = this.buf[node * NODE_SIZE + ci];
        if (next !== 0) {
          chars.push(fixed);
          dfs(next, depth + 1, chars);
          chars.pop();
        }
      } else {
        for (let ci = 0; ci < 26; ci++) {
          if (results.length >= limit) return;
          const next = this.buf[node * NODE_SIZE + ci];
          if (next !== 0) {
            chars.push(String.fromCharCode(65 + ci));
            dfs(next, depth + 1, chars);
            chars.pop();
          }
        }
      }
    };

    dfs(0, 0, []);
    return results;
  }

  hasAny(pattern) {
    const len = pattern.length;
    let found = false;

    const dfs = (node, depth) => {
      if (found) return;
      if (depth === len) {
        if ((this.buf[node * NODE_SIZE + END_FLAG] & 1) === 1) found = true;
        return;
      }
      const fixed = pattern[depth];
      if (fixed !== null) {
        const ci   = fixed.charCodeAt(0) - 65;
        const next = this.buf[node * NODE_SIZE + ci];
        if (next !== 0) dfs(next, depth + 1);
      } else {
        for (let ci = 0; ci < 26 && !found; ci++) {
          const next = this.buf[node * NODE_SIZE + ci];
          if (next !== 0) dfs(next, depth + 1);
        }
      }
    };

    dfs(0, 0);
    return found;
  }
}

// ─── Trie cache ───────────────────────────────────────────────
let _trieCache     = null;
let _trieCacheTime = 0;
const TRIE_TTL_MS  = 30 * 60 * 1000;

async function getTrie() {
  const now = Date.now();
  if (_trieCache && now - _trieCacheTime < TRIE_TTL_MS) return _trieCache;

  const start = Date.now();

  const { rows } = await pool.query(
    `SELECT answer FROM words
     WHERE word_length BETWEEN 3 AND 15
     ORDER BY answer`
  );

  const trie = new PackedTrie();
  for (const row of rows) trie.insert(row.answer);

  _trieCache     = trie;
  _trieCacheTime = now;
  return trie;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — American-style mask generation
// ═══════════════════════════════════════════════════════════════

const MIN_WORD = 3;

function rowHasShortRun(mask, r, size) {
  let run = 0;
  for (let c = 0; c <= size; c++) {
    if (c < size && mask[r][c]) { run++; }
    else { if (run > 0 && run < MIN_WORD) return true; run = 0; }
  }
  return false;
}

function colHasShortRun(mask, col, size) {
  let run = 0;
  for (let r = 0; r <= size; r++) {
    if (r < size && mask[r][col]) { run++; }
    else { if (run > 0 && run < MIN_WORD) return true; run = 0; }
  }
  return false;
}

function isValidMask(mask, size) {
  for (let r = 0; r < size; r++)
    if (rowHasShortRun(mask, r, size)) return false;
  for (let c = 0; c < size; c++)
    if (colHasShortRun(mask, c, size)) return false;

  // BFS connectivity — all white cells must be reachable from one another
  let startR = -1, startC = -1, whites = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (mask[r][c]) {
        whites++;
        if (startR < 0) { startR = r; startC = c; }
      }
  if (startR < 0) return false;

  const vis  = Array.from({ length: size }, () => Array(size).fill(false));
  const q    = [[startR, startC]];
  vis[startR][startC] = true;
  let found  = 1;
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size
          && mask[nr][nc] && !vis[nr][nc]) {
        vis[nr][nc] = true; found++; q.push([nr, nc]);
      }
    }
  }
  return found === whites;
}

function countWords(mask, size) {
  let count = 0;
  for (let r = 0; r < size; r++) {
    let run = 0;
    for (let c = 0; c <= size; c++) {
      if (c < size && mask[r][c]) { run++; }
      else { if (run >= MIN_WORD) count++; run = 0; }
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 0;
    for (let r = 0; r <= size; r++) {
      if (r < size && mask[r][c]) { run++; }
      else { if (run >= MIN_WORD) count++; run = 0; }
    }
  }
  return count;
}

// ─── Black-cell targets by grid size ─────────────────────────
function getBlackTarget(size) {
  if (size <= 5) return { min: 0, max: 0 };
  const total = size * size;
  if (size === 6) return { min: 2, max: Math.floor(total * 0.18) };
  if (size === 7) return { min: 4, max: Math.floor(total * 0.20) };
  if (size === 8) return { min: 6, max: Math.floor(total * 0.22) };
  return { min: Math.floor(total * 0.15), max: Math.floor(total * 0.28) };
}

function generateAmericanMask(size) {
  const { min: minB, max: maxB } = getBlackTarget(size);

  if (maxB === 0) {
    return Array.from({ length: size }, () => Array(size).fill(true));
  }

  const useSymmetry = size >= 7;
  const target = minB + Math.floor(Math.random() * (maxB - minB + 1));

  const allCells = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      allCells.push([r, c]);

  for (let trial = 0; trial < 1500; trial++) {
    const mask = Array.from({ length: size }, () => Array(size).fill(true));
    let placed = 0;

    const cells = [...allCells];
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    for (const [r, c] of cells) {
      if (placed >= target) break;
      if (!mask[r][c]) continue;

      const mr = size - 1 - r;
      const mc = size - 1 - c;

      mask[r][c] = false;
      let mirror = false;

      if (useSymmetry && (r !== mr || c !== mc) && mask[mr][mc]) {
        mask[mr][mc] = false;
        mirror = true;
      }

      let bad = rowHasShortRun(mask, r, size)
             || colHasShortRun(mask, c, size);
      if (!bad && mirror) {
        bad = rowHasShortRun(mask, mr, size)
           || colHasShortRun(mask, mc, size);
      }

      if (!bad && isValidMask(mask, size)) {
        placed += mirror ? 2 : 1;
      } else {
        mask[r][c] = true;
        if (mirror) mask[mr][mc] = true;
      }
    }

    if (placed >= minB) {
      const pct = ((placed / (size * size)) * 100).toFixed(0);
      return mask;
    }
  }

  return Array.from({ length: size }, () => Array(size).fill(true));
}

// ═══════════════════════════════════════════════════════════════
// Slot and intersection helpers
// ═══════════════════════════════════════════════════════════════

function findSlots(size, mask) {
  const slots = [];

  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!mask[r][c]) { c++; continue; }
      let end = c;
      while (end < size && mask[r][end]) end++;
      if (end - c >= MIN_WORD) {
        slots.push({
          direction: 'across', row: r, col: c, length: end - c,
          cells: Array.from({ length: end - c }, (_, i) => ({ row: r, col: c + i })),
        });
      }
      c = end;
    }
  }

  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      if (!mask[r][c]) { r++; continue; }
      let end = r;
      while (end < size && mask[end][c]) end++;
      if (end - r >= MIN_WORD) {
        slots.push({
          direction: 'down', row: r, col: c, length: end - r,
          cells: Array.from({ length: end - r }, (_, i) => ({ row: r + i, col: c })),
        });
      }
      r = end;
    }
  }

  return slots;
}

function buildIntersections(slots) {
  const cellMap = new Map();
  for (let si = 0; si < slots.length; si++)
    for (let pos = 0; pos < slots[si].length; pos++) {
      const { row, col } = slots[si].cells[pos];
      const key = `${row},${col}`;
      if (!cellMap.has(key)) cellMap.set(key, []);
      cellMap.get(key).push({ si, pos });
    }

  const ix = slots.map(() => []);
  for (const entries of cellMap.values()) {
    if (entries.length < 2) continue;
    for (const a of entries)
      for (const b of entries)
        if (a.si !== b.si)
          ix[a.si].push({ otherSlot: b.si, myPos: a.pos, otherPos: b.pos });
  }
  return ix;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3 — CSP Solver with wall-clock timeout
// ═══════════════════════════════════════════════════════════════

function getTotalBudget(size) {
  if (size <= 5)  return  8_000;
  if (size <= 7)  return 20_000;
  if (size <= 9)  return 40_000;
  if (size <= 11) return 60_000;
  return 90_000;
}

function getAttemptSlice(size) {
  if (size <= 5)  return  3_000;
  if (size <= 7)  return  8_000;
  if (size <= 9)  return 15_000;
  if (size <= 11) return 20_000;
  return 25_000;
}

function solve(slots, intersections, trie, size, timeLimitMs) {
  const stride    = size + 1;
  const grid      = new Uint8Array(stride * stride);
  const usedSet   = new Set();
  const assigned  = new Map();
  const deadline  = Date.now() + timeLimitMs;

  const idx = (r, c) => r * stride + c;

  function getPattern(slot) {
    return slot.cells.map(({ row, col }) => {
      const v = grid[idx(row, col)];
      return v === 0 ? null : String.fromCharCode(v);
    });
  }

  function forwardCheck(si) {
    for (const { otherSlot } of intersections[si]) {
      if (assigned.has(otherSlot)) continue;
      const pattern = getPattern(slots[otherSlot]);
      if (pattern.every(p => p === null)) continue;
      if (!trie.hasAny(pattern)) return false;
    }
    return true;
  }

  function pickSlot() {
    let bestSi    = -1;
    let bestCount = Infinity;

    for (let si = 0; si < slots.length; si++) {
      if (assigned.has(si)) continue;
      const pattern = getPattern(slots[si]);

      if (pattern.every(p => p === null)) {
        const roughCount = 100000 - slots[si].length * 1000;
        if (roughCount < bestCount) {
          bestCount = roughCount;
          bestSi    = si;
        }
        continue;
      }

      const candidates = trie.query(pattern, bestCount + 1);
      if (candidates.length === 0) return { si: -1, candidates: [] };
      if (candidates.length < bestCount) {
        bestCount = candidates.length;
        bestSi    = si;
        if (bestCount === 1) break;
      }
    }

    if (bestSi === -1) return { si: -1, candidates: [] };
    const candidates = trie.query(getPattern(slots[bestSi]), 400);
    return { si: bestSi, candidates };
  }

  function backtrack() {
    if (assigned.size === slots.length) return true;
    if (Date.now() > deadline) return false;

    const { si, candidates } = pickSlot();
    if (si === -1 || candidates.length === 0) return false;

    const slot = slots[si];

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const word of candidates) {
      if (usedSet.has(word)) continue;
      if (Date.now() > deadline) return false;

      const modified = [];
      let conflict   = false;

      for (let p = 0; p < slot.length; p++) {
        const { row, col } = slot.cells[p];
        const i            = idx(row, col);
        const existing     = grid[i];
        const needed       = word.charCodeAt(p);
        if (existing === 0) {
          grid[i] = needed;
          modified.push(i);
        } else if (existing !== needed) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        for (const i of modified) grid[i] = 0;
        continue;
      }

      usedSet.add(word);
      assigned.set(si, word);

      if (forwardCheck(si) && backtrack()) return true;

      for (const i of modified) grid[i] = 0;
      usedSet.delete(word);
      assigned.delete(si);
    }

    return false;
  }

  if (!backtrack()) return null;

  const grid2d = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const v = grid[idx(r, c)];
      return v === 0 ? null : String.fromCharCode(v);
    })
  );

  return { grid2d, assigned };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — Clue lookup + lexicon meta + numbering
// ═══════════════════════════════════════════════════════════════

async function fetchClues(answers, usedClueIds) {
  if (!answers.length) return new Map();

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (answer) answer, id, clue
     FROM clues
     WHERE answer = ANY($1::text[])
       AND id != ALL($2::int[])
     ORDER BY answer, RANDOM()`,
    [answers, usedClueIds.length ? usedClueIds : [0]]
  );

  const map = new Map();
  for (const row of rows) map.set(row.answer, row);
  return map;
}

// ─── NEW: fetch enrichment data from word_lexicon ─────────────
async function fetchLexicon(answers) {
  if (!answers.length) return new Map();

  const { rows } = await pool.query(
    `SELECT answer, part_of_speech, definition, synonym, example
     FROM word_lexicon
     WHERE answer = ANY($1::text[])`,
    [answers]
  );

  const map = new Map();
  for (const row of rows) {
    // Only store entries that have at least one non-null enrichment field
    if (row.part_of_speech || row.definition || row.synonym || row.example) {
      map.set(row.answer, {
        pos:        row.part_of_speech ?? null,
        definition: row.definition     ?? null,
        synonym:    row.synonym        ?? null,   // comma-separated string from DB
        example:    row.example        ?? null,
      });
    }
  }
  return map;
}

function numberSlots(slots, size) {
  const starts = new Map();
  for (let si = 0; si < slots.length; si++) {
    const key = `${slots[si].row},${slots[si].col}`;
    if (!starts.has(key)) starts.set(key, { across: -1, down: -1 });
    starts.get(key)[slots[si].direction] = si;
  }

  const cellNum = new Map();
  let num = 1;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const key = `${r},${c}`;
      if (starts.has(key)) cellNum.set(key, num++);
    }

  const slotNum = new Map();
  for (const [key, dirs] of starts.entries()) {
    const n = cellNum.get(key);
    if (dirs.across !== -1) slotNum.set(dirs.across, n);
    if (dirs.down   !== -1) slotNum.set(dirs.down,   n);
  }
  return slotNum;
}

// ─── UPDATED: accepts lexiconMap and attaches meta ────────────
function buildWordList(slots, assigned, clueMap, slotNum, lexiconMap) {
  const words = [];
  for (const [si, answer] of assigned.entries()) {
    const clueRow = clueMap.get(answer);
    if (!clueRow) continue;
    words.push({
      id:        clueRow.id,
      clue:      clueRow.clue,
      answer,
      row:       slots[si].row,
      col:       slots[si].col,
      direction: slots[si].direction,
      number:    slotNum.get(si) ?? 0,
      // null when the word has no lexicon entry
      meta:      lexiconMap.get(answer) ?? null,
    });
  }
  words.sort((a, b) => a.number - b.number || a.direction.localeCompare(b.direction));
  return words;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export async function buildPuzzle(size, difficulty, usedClueIds = []) {
  const trie        = await getTrie();
  const totalBudget = getTotalBudget(size);
  const sliceMs     = getAttemptSlice(size);
  const deadline    = Date.now() + totalBudget;

  for (let attempt = 0; attempt < 8; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) {
      break;
    }

    const attemptBudget = Math.min(sliceMs, remaining);

    const mask          = generateAmericanMask(size);
    const slots         = findSlots(size, mask);
    const intersections = buildIntersections(slots);

    if (slots.length === 0) continue;

    const slotLengths = slots.map(s => s.length).join(',');

    const start   = Date.now();
    const result  = solve(slots, intersections, trie, size, attemptBudget);
    const elapsed = Date.now() - start;

    if (!result) {
      continue;
    }


    const answers = [...result.assigned.values()];

    // Fetch clues and lexicon enrichment in parallel
    const [clueMap, lexiconMap] = await Promise.all([
      fetchClues(answers, usedClueIds),
      fetchLexicon(answers),
    ]);

    const slotNum  = numberSlots(slots, size);
    const words    = buildWordList(slots, result.assigned, clueMap, slotNum, lexiconMap);

    const finalGrid = result.grid2d.map((row, ri) =>
      row.map((cell, ci) => mask[ri][ci] ? cell : null)
    );

    return { grid: finalGrid, words, size };
  }

  throw new Error(
    `Could not generate a ${size}×${size} puzzle after 8 attempts. ` +
    `Try a smaller grid size.`
  );
}