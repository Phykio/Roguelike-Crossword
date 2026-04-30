import { useState } from 'react';
import { useGameStore, PERMANENT_COSTS, ACTIVE_COSTS, PERMANENT_LIMITS } from '../store/gameStore.js';

// ── Permanent upgrade definitions ──────────────────────────────
const PERMANENTS = [
  {
    id:       'extra_time',
    label:    '+30s Per Puzzle',
    desc:     'Every future puzzle starts with 30 extra seconds. Max +5 minutes total.',
    cost:     PERMANENT_COSTS.extra_time,
    atMax:    p => (p.extraTime ?? 0) >= PERMANENT_LIMITS.extra_time,
    progress: p => {
      const secs = p.extraTime ?? 0;
      const mins = Math.floor(secs / 60);
      const rem  = secs % 60;
      const cur  = mins > 0 ? `${mins}m${rem > 0 ? ` ${rem}s` : ''}` : `${secs}s`;
      return `${cur} / 5m extra`;
    },
  },
  {
    id:       'extra_heart',
    label:    'Extra Heart',
    desc:     'Gain one additional life. Maximum 5 hearts total.',
    cost:     PERMANENT_COSTS.extra_heart,
    atMax:    p => (p.extraHearts ?? 0) >= PERMANENT_LIMITS.extra_heart,
    progress: p => `${1 + (p.extraHearts ?? 0)} / 5 hearts`,
  },
  {
    id:       'bonus_time_long',
    label:    'Long Word Bonus',
    desc:     'Solving a word 8+ letters long adds 30s back to the clock.',
    cost:     PERMANENT_COSTS.bonus_time_long,
    atMax:    p => !!p.bonusTimeOnLong,
    progress: () => '',
  },
];

// ── Active upgrade definitions ─────────────────────────────────
const ACTIVES = [
  {
    id:   'hint',
    label: 'Hint',
    desc:  'Reveals one letter of answer in the selected clue.',
    cost:  ACTIVE_COSTS.hint,
  },
  {
    id:      'hint_pos',
    label:   'Part of Speech',
    desc:    'Shows whether the answer is a noun, verb, adjective, etc.',
    cost:    ACTIVE_COSTS.hint_pos,
    metaKey: 'pos',
  },
  {
    id:      'hint_synonym',
    label:   'Synonym',
    desc:    'Shows a synonym for the answer.',
    cost:    ACTIVE_COSTS.hint_synonym,
    metaKey: 'synonym',
  },
  {
    id:      'hint_definition',
    label:   'Definition',
    desc:    'Shows the dictionary definition of the answer.',
    cost:    ACTIVE_COSTS.hint_definition,
    metaKey: 'definition',
  },
  {
    id:      'hint_example',
    label:   'Example Sentence',
    desc:    'Shows the answer used in an example sentence.',
    cost:    ACTIVE_COSTS.hint_example,
    metaKey: 'example',
  },
  {
    id:   'reveal_vowels',
    label: 'Reveal Vowels',
    desc:  'For words 8+ letters, reveals all vowel positions.',
    cost:  ACTIVE_COSTS.reveal_vowels,
  },
  {
    id:   'skip_word',
    label: 'Skip Word',
    desc:  'Skips one clue and marks it as solved.',
    cost:  ACTIVE_COSTS.skip_word,
  },
];

export default function UpgradeShop({
  onClose,
  onApplyPermanent,
  onSyncCoins, // Sync helper from RoguelikePage
  onHint,
  onSkipWord,
  onRevealVowels,
  onLexicalHint,
  activeWord,
}) {
  const { run, permanents, buyActive } = useGameStore();
  const [feedback,   setFeedback]   = useState(null);
  const [permLoading, setPermLoading] = useState(false);

  const coins = run?.coins ?? 0;

  function showFeedback(msg, ok = true) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  // ── Permanent purchase ─────────────────────────────────────
  async function handlePermanent(upgrade) {
    if (permLoading || coins < upgrade.cost || upgrade.atMax(permanents)) return;

    setPermLoading(true);
    try {
      await onApplyPermanent(upgrade.id);
      showFeedback(`${upgrade.label} activated!`);
    } catch (err) {
      console.error("Upgrade Error:", err);
      showFeedback(err?.response?.data?.error || 'Purchase failed.', false);
    } finally {
      setPermLoading(false);
    }
  }

  // ── Active purchase ────────────────────────────────────────
  async function handleActive(upgrade) {
    if (coins < upgrade.cost) {
      showFeedback('Not enough coins.', false);
      return;
    }

    // Logic for Reveal Vowels requirement
    if (upgrade.id === 'reveal_vowels') {
      if (!activeWord || activeWord.answer.length < 8) {
        showFeedback('Select a word with 8+ letters first.', false);
        return;
      }
    }

    // Logic for Lexical Hints (Definition, Synonym, etc.)
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
    }

    // 1. Deduct locally
    buyActive(upgrade.id, upgrade.cost);

    // 2. Sync to Server so Permanent Shop stays updated
    if (onSyncCoins) await onSyncCoins();

    // 3. Trigger Effects
    if (upgrade.id === 'reveal_vowels') onRevealVowels?.(activeWord);
    else if (upgrade.metaKey) {
      const value = activeWord.meta?.[upgrade.metaKey];
      onLexicalHint?.(upgrade.id, value, activeWord.answer);
      onClose(); // Close shop to show the hint
      return;
    } 
    else if (upgrade.id === 'hint') onHint?.();
    else if (upgrade.id === 'skip_word') onSkipWord?.();

    showFeedback(`${upgrade.label} used!`);
  }

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
                      w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto
                      shadow-[8px_8px_0px_rgba(0,0,0,1)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-pixel text-black font-bold text-sm">Upgrade Shop</h2>
          <span className="text-black font-bold font-pixel text-xs">{coins}c</span>
        </div>
        <p className="text-gray-600 text-[10px] mb-4 font-pixel">
          {activeWord
            ? `Active: ${activeWord.number} ${activeWord.direction}`
            : 'Select a word in the grid first.'}
        </p>

        {/* Feedback banner */}
        {feedback && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-[10px] font-pixel border-2
            ${feedback.ok
              ? 'bg-black text-white border-black'
              : 'bg-gray-100 text-black border-black'}`}>
            {feedback.msg}
          </div>
        )}

        {/* Permanent upgrades */}
        <h3 className="font-pixel text-black font-bold text-xs mb-2 border-b-2 border-gray-100 pb-1">
          Permanent
        </h3>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PERMANENTS.map(u => {
            const maxed     = u.atMax(permanents);
            const canAfford = coins >= u.cost;
            const disabled  = maxed || !canAfford || permLoading;
            const progress  = u.progress(permanents);

            return (
              <button
                key={u.id}
                onClick={() => !disabled && handlePermanent(u)}
                disabled={disabled}
                className={`flex items-start gap-3 p-3 rounded-xl text-left border-2 transition-all
                  ${maxed
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-default'
                    : canAfford && !permLoading
                    ? 'border-gray-300 bg-white hover:border-black hover:bg-yellow-50 cursor-pointer'
                    : 'border-gray-100 bg-white opacity-50 cursor-not-allowed'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold ${maxed ? 'text-gray-400' : 'text-black'}`}>
                      {u.label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {progress && (
                        <span className="text-gray-400 text-[9px] font-pixel">
                          {maxed ? 'MAX' : progress}
                        </span>
                      )}
                      {!maxed && (
                        <span className="text-black font-bold text-[10px] font-pixel">
                          {u.cost}c
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-0.5 leading-relaxed">{u.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active upgrades */}
        <h3 className="font-pixel text-black font-bold text-xs mb-2 border-b-2 border-gray-100 pb-1">
          Active
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {ACTIVES.map(u => {
            const canAfford   = coins >= u.cost;
            const vowelLocked = u.id === 'reveal_vowels' && (!activeWord || activeWord.answer.length < 8);
            const lexLocked   = u.metaKey && (!activeWord || !activeWord.meta?.[u.metaKey]);
            const softLocked  = vowelLocked || lexLocked;

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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-black text-[11px] font-bold">{u.label}</span>
                    <span className="text-black font-bold text-[10px] font-pixel ml-2 shrink-0">
                      {u.cost}c
                    </span>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-0.5 leading-relaxed">{u.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-black hover:bg-gray-800 border-2 border-black
                     text-white font-bold font-pixel text-xs rounded-xl transition-colors">
          Back to Puzzle
        </button>
      </div>
    </div>
  );
}