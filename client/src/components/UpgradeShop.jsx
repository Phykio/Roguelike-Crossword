import { useState } from 'react';
import { useGameStore, PERMANENT_COSTS, ACTIVE_COSTS } from '../store/gameStore.js';

// ── Upgrade definitions ────────────────────────────────────────

const PERMANENTS = [
  {
    id:   'extra_time',
    icon: '',
    label: '+30s Per Puzzle',
    desc:  'Every future puzzle starts with 30 extra seconds. This Effect Stacks.',
    cost:  PERMANENT_COSTS.extra_time,
  },
  {
    id:   'extra_heart',
    icon: '',
    label: 'Extra Heart',
    desc:  'Gain one additional life. You can have up to 5 hearts.',
    cost:  PERMANENT_COSTS.extra_heart,
  },
  {
    id:   'bonus_time_long',
    icon: '',
    label: 'Long Word Bonus',
    desc:  'Solving a word 8+ letters long adds 30s back to the clock.',
    cost:  PERMANENT_COSTS.bonus_time_long,
    oneTime: true,
  },
];

const ACTIVES = [
  {
    id:   'hint',
    icon: '',
    label: 'Hint',
    desc:  'Reveals one letter of answer in the selected clue.',
    cost:  ACTIVE_COSTS.hint,
  },
  {
    id:   'hint_pos',
    icon: '',
    label: 'Part of Speech',
    desc:  'Shows whether the answer is a noun, verb, adjective, etc.',
    cost:  ACTIVE_COSTS.hint_pos,
    metaKey: 'pos',
  },
  {
    id:   'hint_synonym',
    icon: '',
    label: 'Synonym',
    desc:  'Shows a synonym for the answer.',
    cost:  ACTIVE_COSTS.hint_synonym,
    metaKey: 'synonym',
  },
  {
    id:   'hint_definition',
    icon: '',
    label: 'Definition',
    desc:  'Shows the dictionary definition of the answer.',
    cost:  ACTIVE_COSTS.hint_definition,
    metaKey: 'definition',
  },
  {
    id:   'hint_example',
    icon: '',
    label: 'Example Sentence',
    desc:  'Shows the answer used in an example sentence.',
    cost:  ACTIVE_COSTS.hint_example,
    metaKey: 'example',
  },
  {
    id:   'reveal_vowels',
    icon: '',
    label: 'Reveal Vowels',
    desc:  'For words 8+ letters, reveals all vowel positions.',
    cost:  ACTIVE_COSTS.reveal_vowels,
  },
  {
    id:   'skip_word',
    icon: '',
    label: 'Skip Word',
    desc:  'Skips one clue and marks it as solved.',
    cost:  ACTIVE_COSTS.skip_word,
  },
];

// ── Component ──────────────────────────────────────────────────

export default function UpgradeShop({
  onClose,
  onHint,
  onSkipWord,
  onRevealVowels,
  onLexicalHint,    // (type, value) => void
  activeWord,       // the currently selected word in the grid
  runId,
}) {
  const { run, permanents, upgrades, applyPermanent, buyActive } = useGameStore();
  const [feedback, setFeedback] = useState(null); // { msg, ok }

  const coins = run?.coins ?? 0;

  function showFeedback(msg, ok = true) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  // ── Permanent purchase ─────────────────────────────────────

  function handlePermanent(upgrade) {
    if (coins < upgrade.cost) return;
    if (upgrade.oneTime && permanents[upgrade.id]) return;
    applyPermanent(upgrade.id);
    showFeedback(`${upgrade.label} activated!`);
  }

  function isPermanentOwned(upgrade) {
    if (!upgrade.oneTime) return false;
    return !!permanents[upgrade.id];
  }

  // ── Active purchase ────────────────────────────────────────

  function handleActive(upgrade) {
    if (coins < upgrade.cost) {
      showFeedback('Not enough coins.', false);
      return;
    }

    // Vowel reveal — only works on 8+ letter words
    if (upgrade.id === 'reveal_vowels') {
      if (!activeWord || activeWord.answer.length < 8) {
        showFeedback('Select a word with 8+ letters first.', false);
        return;
      }
      buyActive(upgrade.id, upgrade.cost);
      onRevealVowels?.(activeWord);
      showFeedback(`${upgrade.label} used!`);
      return;
    }

    // Lexical hints — read directly from activeWord.meta
    if (upgrade.metaKey) {
      if (!activeWord) {
        showFeedback('Select a clue first.', false);
        return;
      }

      const value = activeWord.meta?.[upgrade.metaKey];
      if (!value || (typeof value === 'string' && !value.trim())) {
        showFeedback(`No ${upgrade.label.toLowerCase()} available for this word.`, false);
        return;
      }

      buyActive(upgrade.id, upgrade.cost);
      onLexicalHint?.(upgrade.id, value, activeWord.answer);
      onClose();
      return;
    }

    // hint / skip_word
    buyActive(upgrade.id, upgrade.cost);
    if (upgrade.id === 'hint')      onHint?.();
    if (upgrade.id === 'skip_word') onSkipWord?.();
    showFeedback(`${upgrade.label} used!`);
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div className="bg-white border-4 border-black rounded-2xl p-6
                      w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_rgba(0,0,0,1)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-pixel text-black font-bold text-sm">Upgrade Shop</h2>
          <span className="text-black font-bold font-pixel text-xs">{coins}c</span>
        </div>
        <p className="text-gray-600 text-xs mb-4">
          {activeWord
            ? `Active word: ${activeWord.number} ${activeWord.direction} — ${activeWord.clue}`
            : 'Select a word in the grid to unlock lexical hints.'}
        </p>

        {/* Feedback banner */}
        {feedback && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-pixel border-2
            ${feedback.ok ? 'bg-black text-white border-black' : 'bg-gray-100 text-black border-black'}`}>
            {feedback.msg}
          </div>
        )}

        {/* Permanent upgrades */}
        <h3 className="font-pixel text-black font-bold text-xs mb-2 mt-2 border-b-2 border-gray-200 pb-1">
          Permanent
        </h3>
        <p className="text-gray-600 text-xs mb-3">
          These persist for the rest of your run.
        </p>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PERMANENTS.map(u => {
            const owned     = isPermanentOwned(u);
            const canAfford = coins >= u.cost;
            const disabled  = owned || !canAfford;

            return (
              <button
                key={u.id}
                onClick={() => !disabled && handlePermanent(u)}
                disabled={disabled}
                className={`flex items-start gap-3 p-3 rounded-xl text-left border-2 transition-all
                  ${owned
                    ? 'border-gray-200 bg-gray-100 opacity-60 cursor-default'
                    : canAfford
                    ? 'border-gray-300 bg-white hover:border-black hover:bg-yellow-50 cursor-pointer'
                    : 'border-gray-100 bg-white opacity-50 cursor-not-allowed'}`}
              >
                <span className="font-pixel text-xl text-black mt-0.5">{u.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${owned ? 'text-gray-500 line-through' : 'text-black'}`}>
                      {u.label}
                    </span>
                    <span className="text-black font-bold text-xs font-pixel ml-2 shrink-0">
                      {owned ? 'OWNED' : `${u.cost}c`}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{u.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active upgrades */}
        <h3 className="font-pixel text-black font-bold text-xs mb-2 border-b-2 border-gray-200 pb-1">
          Active
        </h3>
        <p className="text-gray-600 text-xs mb-3">
          One-time use per purchase. Buy multiple times to stock up.
        </p>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {ACTIVES.map(u => {
            const canAfford = coins >= u.cost;

            const vowelLocked = u.id === 'reveal_vowels'
              && (!activeWord || activeWord.answer.length < 8);

            // Lexical hints: need an active word AND the meta field must exist
            const lexLocked = u.metaKey
              && (!activeWord || !activeWord.meta?.[u.metaKey]);

            const softLocked = vowelLocked || lexLocked;

            return (
              <button
                key={u.id}
                onClick={() => canAfford && !softLocked && handleActive(u)}
                disabled={!canAfford || softLocked}
                className={`flex items-start gap-3 p-3 rounded-xl text-left border-2 transition-all
                  ${!canAfford || softLocked
                    ? 'border-gray-100 bg-white opacity-50 cursor-not-allowed'
                    : 'border-gray-300 bg-white hover:border-black hover:bg-yellow-50 cursor-pointer'}`}
              >
                <span className="font-pixel text-lg text-black mt-0.5 text-center font-bold">
                  {u.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-black text-xs font-bold">{u.label}</span>
                    <span className="text-black font-bold text-xs font-pixel ml-2 shrink-0">
                      {u.cost}c
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{u.desc}</p>
                  {softLocked && (
                    <p className="text-gray-500 text-xs mt-1 font-medium">
                      {vowelLocked
                        ? 'Select a word with 8+ letters'
                        : !activeWord
                        ? 'Select a word in the grid first'
                        : 'Not available for this word'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 bg-black hover:bg-gray-800 border-2 border-black
                     text-white font-bold font-pixel text-xs rounded-xl transition-colors">
          Back to Puzzle
        </button>
      </div>
    </div>
  );
}