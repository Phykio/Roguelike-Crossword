import { useState } from 'react';
import { 
  useGameStore, 
  PERMANENT_COSTS, 
  ACTIVE_COSTS, 
  PERMANENT_LIMITS 
} from '../store/gameStore.js';

const PERMANENTS = [
  { id: 'extra_time', label: '+30s Per Puzzle', desc: 'Every future puzzle starts with 30 extra seconds.', cost: PERMANENT_COSTS.extra_time },
  { id: 'extra_heart', label: 'Extra Heart', desc: 'Gain one additional life. Max 5 total.', cost: PERMANENT_COSTS.extra_heart },
  { id: 'bonus_time_long', label: 'Long Word Bonus', desc: 'Solving a word 8+ letters long adds 30s back.', cost: PERMANENT_COSTS.bonus_time_long },
];

const ACTIVES = [
  { id: 'hint', label: 'Hint', desc: 'Reveals one letter.', cost: ACTIVE_COSTS.hint },
  { id: 'hint_pos', label: 'Part of Speech', desc: 'Shows noun, verb, etc.', cost: ACTIVE_COSTS.hint_pos, metaKey: 'pos' },
  { id: 'hint_synonym', label: 'Synonym', desc: 'Shows a synonym.', cost: ACTIVE_COSTS.hint_synonym, metaKey: 'synonym' },
  { id: 'hint_definition', label: 'Definition', desc: 'Shows dictionary definition.', cost: ACTIVE_COSTS.hint_definition, metaKey: 'definition' },
  { id: 'hint_example', label: 'Example Sentence', desc: 'Shows example usage.', cost: ACTIVE_COSTS.hint_example, metaKey: 'example' },
  { id: 'reveal_vowels', label: 'Reveal Vowels', desc: 'Reveals all vowels for 8+ letters.', cost: ACTIVE_COSTS.reveal_vowels },
  { id: 'skip_word', label: 'Skip Word', desc: 'Skips one clue.', cost: ACTIVE_COSTS.skip_word },
];

export default function UpgradeShop({ onClose, onHint, onSkipWord, onRevealVowels, onLexicalHint, activeWord }) {
  const { run, applyPermanent, buyActive } = useGameStore();
  const [feedback, setFeedback] = useState(null);

  const coins = run?.coins ?? 0;
  const p = run?.permanents ?? {};

  function showFeedback(msg, ok = true) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  function isMaxed(id) {
    if (id === 'extra_time') return (p.extraTimeCount ?? 0) >= PERMANENT_LIMITS.extra_time;
    if (id === 'extra_heart') return (p.extraHearts ?? 0) >= PERMANENT_LIMITS.extra_heart;
    if (id === 'bonus_time_long') return !!p.bonusTimeOnLong;
    return false;
  }

  function getProgressText(id) {
    if (id === 'extra_time') return `${p.extraTimeCount ?? 0}/${PERMANENT_LIMITS.extra_time}`;
    if (id === 'extra_heart') return `${p.extraHearts ?? 0}/${PERMANENT_LIMITS.extra_heart}`;
    if (id === 'bonus_time_long') return p.bonusTimeOnLong ? '1/1' : '0/1';
    return '';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="bg-white border-4 border-black rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-pixel text-black font-bold text-sm">Upgrade Shop</h2>
          <span className="text-black font-bold font-pixel text-xs">{coins}c</span>
        </div>

        {feedback && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-pixel border-2 ${feedback.ok ? 'bg-black text-white border-black' : 'bg-gray-100 text-black border-black'}`}>
            {feedback.msg}
          </div>
        )}

        <h3 className="font-pixel text-black font-bold text-xs mb-2 mt-2 border-b-2 border-gray-200 pb-1">Permanent Upgrades</h3>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PERMANENTS.map(u => {
            const maxed = isMaxed(u.id);
            const canAfford = coins >= u.cost;
            const disabled = maxed || !canAfford;
            return (
              <button
                key={u.id}
                onClick={() => !disabled && applyPermanent(u.id)}
                disabled={disabled}
                className={`flex items-start gap-3 p-3 rounded-xl text-left border-2 transition-all ${maxed ? 'border-green-200 bg-green-50 opacity-80 cursor-default' : canAfford ? 'border-gray-300 bg-white hover:border-black hover:bg-yellow-50 cursor-pointer' : 'border-gray-100 bg-white opacity-50 cursor-not-allowed'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${maxed ? 'text-green-700' : 'text-black'}`}>{u.label} <span className="ml-2 text-[10px] text-gray-500 font-normal">({getProgressText(u.id)})</span></span>
                    <span className="text-black font-bold text-xs font-pixel ml-2 shrink-0">{maxed ? 'MAXED' : `${u.cost}c`}</span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{u.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <h3 className="font-pixel text-black font-bold text-xs mb-2 border-b-2 border-gray-200 pb-1">Active Upgrades</h3>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {ACTIVES.map(u => {
            const canAfford = coins >= u.cost;
            const softLocked = (u.id === 'reveal_vowels' && (!activeWord || activeWord.answer.length < 8)) || (u.metaKey && (!activeWord || !activeWord.meta?.[u.metaKey]));
            return (
              <button
                key={u.id}
                onClick={() => canAfford && !softLocked && buyActive(u.id, u.cost)}
                disabled={!canAfford || softLocked}
                className={`flex items-start gap-3 p-3 rounded-xl text-left border-2 transition-all ${!canAfford || softLocked ? 'border-gray-100 bg-white opacity-50 cursor-not-allowed' : 'border-gray-300 bg-white hover:border-black hover:bg-yellow-50 cursor-pointer'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{u.label}</span>
                    <span className="font-pixel">{u.cost}c</span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{u.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="mt-5 w-full py-3 bg-black hover:bg-gray-800 border-2 border-black text-white font-bold font-pixel text-xs rounded-xl">Back to Puzzle</button>
      </div>
    </div>
  );
}