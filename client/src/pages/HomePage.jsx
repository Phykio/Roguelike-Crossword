import { useNavigate } from 'react-router-dom';
import { isClassicUnlocked } from '../lib/player.js';

export default function HomePage() {
  const navigate  = useNavigate();
  const unlocked  = isClassicUnlocked();

  return (
    <div className="min-h-screen bg-white text-black flex flex-col
                    items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="font-pixel text-black font-bold text-3xl mb-3 leading-loose">
          Infini-CrossWords
        </h1>
        <p className="text-gray-600 text-xs">
          A Infinite Crossword Generator with Roguelike Features.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        {/* Roguelike — always visible */}
        <button
          onClick={() => navigate('/roguelike')}
          className="group bg-white border border-gray-300 hover:border-black
                     rounded-2xl p-8 text-center transition-all duration-200 hover:bg-gray-50"
        >
          <h2 className="font-pixel text-black font-bold text-xl mb-3">Roguelike</h2>
        </button>

        {/* Classic — locked until roguelike is beaten */}
        {unlocked ? (
          <button
            onClick={() => navigate('/classic')}
            className="group bg-white border border-gray-300 hover:border-black
                       rounded-2xl p-8 text-left transition-all duration-200 hover:bg-gray-50"
          >
            <h2 className="font-pixel text-black font-bold text-lg mb-3 text-center">Classic</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-4 text-center">
              Traditional American Style Crossword Generator
            </p>
          </button>
        ) : (
          /* Locked card */
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8
                          opacity-60 cursor-not-allowed select-none text-center">
            <div className="font-pixel text-3xl text-gray-400 mb-4"></div>
            <h2 className="font-pixel text-gray-500 text-xl mb-3">Classic</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Locked Until all Levels of Roguelike Mode are Completed
            </p>
          </div>
        )}
      </div>

      <p className="text-gray-400 text-xs">
        Created With Database from https://xd.saul.pw/data. 
      </p>
    </div>
  );
}