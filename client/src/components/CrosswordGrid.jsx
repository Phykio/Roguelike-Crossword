import { useState, useRef, useCallback, useEffect } from 'react';
import PixelCell from './PixelCell.jsx';

const TILE_SIZE = 40;

const META_FIELDS = [
  { key: 'pos',        label: 'POS', title: 'Part of Speech' },
  { key: 'definition', label: 'DEF', title: 'Definition'     },
  { key: 'synonym',    label: 'SYN', title: 'Synonym'        },
  { key: 'example',    label: 'EX',  title: 'Example'        },
];

function fieldHasValue(meta, key) {
  if (!meta) return false;
  const v = meta[key];
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

function getSynonymList(synonym) {
  if (!synonym) return [];
  if (Array.isArray(synonym)) return synonym.filter(Boolean);
  return synonym.split(',').map(s => s.trim()).filter(Boolean);
}

function normalizeWordValue(value) {
  return String(value ?? '').trim().toUpperCase();
}

function MetaBadge({ field }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        height: 17, padding: '0 5px', borderRadius: 3,
        background: 'transparent', border: '1.5px solid #bbb',
        color: '#888', fontSize: 8, fontWeight: 800,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        lineHeight: 1, fontFamily: 'inherit', userSelect: 'none',
      }}
    >
      {field.label}
    </span>
  );
}

function LexicalHintPanel({ hint, onDismiss }) {
  if (!hint) return null;

  const labelMap = {
    hint_pos:        'Part of Speech',
    hint_synonym:    'Synonym',
    hint_definition: 'Definition',
    hint_example:    'Example',
  };

  const POS_MAP = {
    n: 'Noun', v: 'Verb', adj: 'Adjective', a: 'Adjective',
    adv: 'Adverb', r: 'Adverb', prep: 'Preposition',
    conj: 'Conjunction', pron: 'Pronoun', interj: 'Interjection',
  };

  const renderBody = () => {
    if (hint.type === 'hint_pos') {
      const raw = hint.value?.toLowerCase()?.trim() || '';
      return (
        <span style={{ fontSize: 11, textTransform: 'uppercase' }}>
          {POS_MAP[raw] || hint.value}
        </span>
      );
    }
    if (hint.type === 'hint_synonym') {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {getSynonymList(hint.value).slice(0, 7).map((s, i) => (
            <span key={i} style={{ textTransform: 'capitalize', fontSize: 11 }}>{s}</span>
          ))}
        </div>
      );
    }
    if (hint.type === 'hint_example') {
      const display = hint.answer
        ? hint.value.replace(new RegExp(hint.answer, 'gi'), '_'.repeat(hint.answer.length))
        : hint.value;
      return <p style={{ fontStyle: 'italic', fontSize: 11, margin: 0 }}>"{display}"</p>;
    }
    return <p style={{ fontSize: 11, margin: 0 }}>{hint.value}</p>;
  };

  return (
    <div style={{ width: '100%', marginTop: 6 }}>
      <div style={{
        width: 0, height: 0, margin: '0 auto',
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderBottom: '6px solid #e5e7eb',
      }} />
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '8px 12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#888',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
            {labelMap[hint.type] ?? hint.type}:
          </span>
          {renderBody()}
        </div>
        <button
          onClick={onDismiss}
          style={{
            color: '#aaa', fontSize: 12, background: 'none',
            border: 'none', cursor: 'pointer', flexShrink: 0,
            padding: '0 2px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ClueItem({ word, solved, active, onClick }) {
  const hasAnyMeta = META_FIELDS.some(f => fieldHasValue(word.meta, f.key));
  return (
    <button
      onClick={() => !solved && onClick(word)}
      className={[
        'flex items-center text-left w-full text-sm p-1 pl-4 rounded transition-colors leading-relaxed mb-1',
        solved
          ? 'line-through text-gray-400 cursor-default'
          : active
          ? 'text-gray-500 bg-yellow-50 cursor-pointer'
          : 'text-black hover:bg-gray-100 cursor-pointer',
      ].join(' ')}
    >
      <span className={`w-8 shrink-0 text-left font-bold ${solved ? 'text-gray-400' : 'text-black'}`}>
        {word.number}.
      </span>
      {word.clue}
      {!solved && hasAnyMeta && (
        <span style={{
          display: 'inline-block', width: 5, height: 5,
          borderRadius: '50%', background: '#ccc',
          marginLeft: 5, verticalAlign: 'middle', flexShrink: 0,
        }} />
      )}
    </button>
  );
}

export default function CrosswordGrid({
  puzzle,
  revealedCells        = new Set(),
  onWordSolved         = () => {},
  onSolvedCountChange  = () => {},
  onActiveWordChange   = () => {},
  onUserAnswersChange  = () => {},
  initialUserAnswers   = null,
  lexicalHint          = null,
  onDismissLexicalHint = () => {},
}) {
  const [userGrid, setUserGrid] = useState(() =>
    initialUserAnswers ?? puzzle.grid.map(row => row.map(cell => (cell === null ? null : '')))
  );
  const [selectedCell, setSelectedCell] = useState(null);
  const [direction,    setDirection]    = useState('across');
  const [solvedWords,  setSolvedWords]  = useState(new Set());

  const solvedWordsRef = useRef(new Set());
  const inputRefs      = useRef({});

  const wordKey    = w => `${w.number}-${w.direction}`;
  const totalWords = puzzle.words.length;

  function getAcrossWord(row, col) {
    return puzzle.words.find(w =>
      w.direction === 'across' && w.row === row && col >= w.col && col < w.col + w.answer.length
    );
  }

  function getDownWord(row, col) {
    return puzzle.words.find(w =>
      w.direction === 'down' && w.col === col && row >= w.row && row < w.row + w.answer.length
    );
  }

  function getActiveWord() {
    if (!selectedCell) return null;
    const { row, col } = selectedCell;
    return direction === 'across' ? getAcrossWord(row, col) : getDownWord(row, col);
  }

  function getWordCells(word) {
    if (!word) return new Set();
    const cells = new Set();
    for (let i = 0; i < word.answer.length; i++) {
      const r = word.direction === 'across' ? word.row     : word.row + i;
      const c = word.direction === 'across' ? word.col + i : word.col;
      cells.add(`${r}-${c}`);
    }
    return cells;
  }

  function isCellInAnySolvedWord(row, col) {
    const a = getAcrossWord(row, col);
    const d = getDownWord(row, col);
    return (a && solvedWords.has(wordKey(a))) || (d && solvedWords.has(wordKey(d)));
  }

  function isCurrentDirectionWordSolved(row, col) {
    const word = direction === 'across' ? getAcrossWord(row, col) : getDownWord(row, col);
    return word ? solvedWords.has(wordKey(word)) : false;
  }

  function isCellFullyLocked(row, col) {
    const words = [getAcrossWord(row, col), getDownWord(row, col)].filter(Boolean);
    return words.length > 0 && words.every(w => solvedWords.has(wordKey(w)));
  }

  function isCellLocked(row, col) {
    const key = `${row}-${col}`;
    return revealedCells.has(key) || isCellInAnySolvedWord(row, col);
  }

  const activeWord      = getActiveWord();
  const activeWordCells = getWordCells(activeWord);
  const activeKey       = activeWord ? wordKey(activeWord) : null;

  useEffect(() => { onActiveWordChange(activeWord); }, [activeWord]); // eslint-disable-line

  function getCellState(row, col) {
    const key = `${row}-${col}`;
    if (puzzle.grid[row][col] === null)                             return 'block';
    if (isCellInAnySolvedWord(row, col) || revealedCells.has(key)) return 'correct';
    if (selectedCell?.row === row && selectedCell?.col === col)     return 'cursor';
    if (activeWordCells.has(key))                                   return 'focused';
    return 'empty';
  }

  function getNextCell(row, col, dir) {
    if (dir === 'across') { for (let c = col + 1; c < puzzle.size; c++) if (puzzle.grid[row][c] !== null) return { row, col: c }; }
    else                  { for (let r = row + 1; r < puzzle.size; r++) if (puzzle.grid[r][col] !== null) return { row: r, col }; }
    return null;
  }

  function getPrevCell(row, col, dir) {
    if (dir === 'across') { for (let c = col - 1; c >= 0; c--)   if (puzzle.grid[row][c] !== null) return { row, col: c }; }
    else                  { for (let r = row - 1; r >= 0; r--)   if (puzzle.grid[r][col] !== null) return { row: r, col }; }
    return null;
  }

  function moveTo(cell) {
    if (!cell) return;
    setSelectedCell(cell);
    setTimeout(() => { inputRefs.current[`${cell.row}-${cell.col}`]?.focus(); }, 0);
  }

  function handleClueClick(word) {
    setDirection(word.direction);
    moveTo({ row: word.row, col: word.col });
  }

  function handleCellClick(row, col) {
    if (puzzle.grid[row][col] === null) return;
    const hasAcross = !!getAcrossWord(row, col);
    const hasDown   = !!getDownWord(row, col);
    if (selectedCell?.row === row && selectedCell?.col === col) {
      if (hasAcross && hasDown) setDirection(d => d === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ row, col });
      if (hasAcross)      setDirection('across');
      else if (hasDown)   setDirection('down');
    }
    inputRefs.current[`${row}-${col}`]?.focus();
  }

  function handleKeyDown(row, col, e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setDirection('across'); moveTo(getNextCell(row, col, 'across') ?? { row, col }); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setDirection('across'); moveTo(getPrevCell(row, col, 'across') ?? { row, col }); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setDirection('down');   moveTo(getNextCell(row, col, 'down')   ?? { row, col }); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setDirection('down');   moveTo(getPrevCell(row, col, 'down')   ?? { row, col }); return; }
    if (e.key === 'Tab')        { e.preventDefault(); setDirection(d => d === 'across' ? 'down' : 'across'); return; }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const key = `${row}-${col}`;
      if (isCellLocked(row, col)) return;
      if (userGrid[row][col] !== '') {
        setUserGrid(prev => prev.map((r, ri) => r.map((c, ci) => ri === row && ci === col ? '' : c)));
      } else {
        const prev = getPrevCell(row, col, direction);
        if (prev && !isCellLocked(prev.row, prev.col)) {
          setUserGrid(g => g.map((r, ri) => r.map((c, ci) => ri === prev.row && ci === prev.col ? '' : c)));
          moveTo(prev);
        }
      }
    }
  }

  const checkWords = useCallback((grid) => {
    const newlySolved = [];
    for (const word of puzzle.words) {
      const key = wordKey(word);
      if (solvedWordsRef.current.has(key)) continue;
      const letters = [];
      for (let i = 0; i < word.answer.length; i++) {
        const r      = word.direction === 'across' ? word.row     : word.row + i;
        const c      = word.direction === 'across' ? word.col + i : word.col;
        const cellKey = `${r}-${c}`;
        letters.push(revealedCells.has(cellKey) ? puzzle.grid[r][c] : (grid[r]?.[c] ?? ''));
      }
      if (normalizeWordValue(letters.join('')) === normalizeWordValue(word.answer)) {
        newlySolved.push(word);
      }
    }
    if (newlySolved.length > 0) {
      for (const w of newlySolved) solvedWordsRef.current.add(wordKey(w));
      setSolvedWords(prev => { const next = new Set(prev); for (const w of newlySolved) next.add(wordKey(w)); return next; });
      for (const w of newlySolved) onWordSolved(w);
      onSolvedCountChange(solvedWordsRef.current.size, totalWords);
    }
  }, [puzzle.words, puzzle.grid, onWordSolved, onSolvedCountChange, totalWords, revealedCells]); // eslint-disable-line

  useEffect(() => { checkWords(userGrid); }, [revealedCells, userGrid, checkWords]);

  function handleChange(row, col, e) {
    const key = `${row}-${col}`;
    if (isCellLocked(row, col)) return;
    const raw    = e.target.value.toUpperCase();
    const letter = raw.length > 1 ? raw.slice(-1) : raw;
    if (letter && !/^[A-Z]$/.test(letter)) return;
    const next = userGrid.map((r, ri) => r.map((c, ci) => ri === row && ci === col ? letter : c));
    setUserGrid(next);
    onUserAnswersChange(next);
    if (letter) {
      checkWords(next);
      const word = direction === 'across' ? getAcrossWord(row, col) : getDownWord(row, col);
      if (word) {
        for (let i = 0; i < word.answer.length; i++) {
          const r = word.direction === 'across' ? word.row     : word.row + i;
          const c = word.direction === 'across' ? word.col + i : word.col;
          if (r === row && c === col) continue;
          if (!isCellFullyLocked(r, c) && !next[r][c] && !revealedCells.has(`${r}-${c}`)) { moveTo({ row: r, col: c }); return; }
        }
        const endRow = word.direction === 'across' ? word.row                          : word.row + word.answer.length - 1;
        const endCol = word.direction === 'across' ? word.col + word.answer.length - 1 : word.col;
        const after  = getNextCell(endRow, endCol, direction);
        if (after) moveTo(after);
      }
    }
  }

  const numMap = {};
  puzzle.words.forEach(w => {
    const key = `${w.row}-${w.col}`;
    if (!numMap[key]) numMap[key] = w.number;
    else numMap[key] = Math.min(numMap[key], w.number);
  });

  const acrossWords = [...puzzle.words].filter(w => w.direction === 'across').sort((a, b) => a.number - b.number);
  const downWords   = [...puzzle.words].filter(w => w.direction === 'down').sort((a, b) => a.number - b.number);

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {activeWord && (
        <div className="max-w-md w-full text-center px-4 flex flex-col items-center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span className="text-black font-bold font-pixel text-xs">
              {activeWord.number} {activeWord.direction === 'across' ? 'Across' : 'Down'}
            </span>
            <span className="text-gray-600 text-xs">{activeWord.clue}</span>
          </div>
          {activeWord.meta && META_FIELDS.some(f => fieldHasValue(activeWord.meta, f.key)) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 5 }}>
              {META_FIELDS.filter(f => fieldHasValue(activeWord.meta, f.key)).map(field => (
                <MetaBadge key={field.key} field={field} />
              ))}
            </div>
          )}
          <LexicalHintPanel hint={lexicalHint} onDismiss={onDismissLexicalHint} />
        </div>
      )}

      {!activeWord && lexicalHint && (
        <div className="max-w-md w-full px-4">
          <LexicalHintPanel hint={lexicalHint} onDismiss={onDismissLexicalHint} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${puzzle.size}, ${TILE_SIZE}px)`, gap: 2 }}>
        {puzzle.grid.map((row, ri) =>
          row.map((cell, ci) => {
            const key   = `${ri}-${ci}`;
            const state = getCellState(ri, ci);
            const displayLetter = state === 'block' ? '' :
              (revealedCells.has(key) ? puzzle.grid[ri][ci] : (userGrid[ri][ci] || ''));
            return (
              <PixelCell
                key={key}
                state={state}
                letter={displayLetter}
                wordNumber={numMap[key] ?? null}
                onClick={() => handleCellClick(ri, ci)}
                onChange={e => handleChange(ri, ci, e)}
                onKeyDown={e => handleKeyDown(ri, ci, e)}
                inputRef={el => { inputRefs.current[key] = el; }}
              />
            );
          })
        )}
      </div>

      <div className="grid grid-cols-2 gap-8 w-full max-w-2xl px-4 mt-2">
        <div>
          <h3 className="font-pixel font-bold text-black text-sm mb-3 text-center w-full">Across</h3>
          {acrossWords.map(w => (
            <ClueItem key={wordKey(w)} word={w} solved={solvedWords.has(wordKey(w))} active={activeKey === wordKey(w)} onClick={handleClueClick} />
          ))}
        </div>
        <div>
          <h3 className="font-pixel font-bold text-black text-sm mb-3 text-center w-full">Down</h3>
          {downWords.map(w => (
            <ClueItem key={wordKey(w)} word={w} solved={solvedWords.has(wordKey(w))} active={activeKey === wordKey(w)} onClick={handleClueClick} />
          ))}
        </div>
      </div>
    </div>
  );
}