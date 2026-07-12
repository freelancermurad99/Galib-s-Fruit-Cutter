import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { GameState } from './game/types';
import { MAX_MISSED } from './game/constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new GameEngine();
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = getEngine();

    engine.onStateChange = (state: GameState) => {
      setGameState(state);
    };
    engine.onScoreChange = (s: number, _c: number, m: number) => {
      setScore(s);
      setMissed(m);
    };

    engine.init(canvas);

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [getEngine]);

  const startGame = () => getEngine().startGame();
  const resumeGame = () => getEngine().resume();
  const pauseGame = () => getEngine().pause();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* ===== START SCREEN ===== */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-fadeIn">
          <div className="absolute inset-0 start-photo-backdrop" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-black/85" />
          <div className="relative z-10 flex flex-col items-center gap-5 px-6 max-w-lg w-full">
            {/* Logo */}
            <div className="relative">
              <div className="text-7xl sm:text-8xl animate-bounce-slow drop-shadow-2xl">🍉</div>
              <div className="absolute -top-1 -right-3 text-3xl animate-pulse-glow">✨</div>
            </div>

            <h1
              className="text-5xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 tracking-tight leading-tight text-center"
              style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}
            >
              Galib's Fruit Cutter
            </h1>

            <p className="text-base sm:text-lg text-blue-200/70 text-center leading-relaxed">
              Swipe to slice fruits before they fall!<br />
              <span className="text-red-300/70">Watch out for bombs 💣</span>
            </p>

            <button
              onClick={startGame}
              className="mt-2 group relative px-12 py-4 text-white text-xl sm:text-2xl font-bold rounded-2xl cursor-pointer
                         overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 transition-all duration-300 group-hover:brightness-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 flex items-center gap-2">
                <span className="text-2xl">▶</span> Start Game
              </span>
            </button>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs sm:text-sm text-white/40 mt-1">
              <span>🖱️ Click & Drag</span>
              <span>👆 Touch & Swipe</span>
              <span>⌨️ Space / Enter</span>
            </div>

            <div className="brand-credit" aria-label="Game credits">
              <span>Designed &amp; developed by <strong>Md. Asadullah Hil Galib</strong></span>
              <span className="credit-divider">|</span>
              <span>Owner of <a href="https://softct.com" target="_blank" rel="noreferrer">softct.com</a></span>
            </div>

            <HighScoreTable engine={getEngine()} />
          </div>
        </div>
      )}

      {/* ===== PAUSE SCREEN ===== */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-5 px-6">
            <div className="text-6xl">⏸️</div>
            <h2
              className="text-4xl sm:text-5xl font-bold text-white"
              style={{ textShadow: '0 0 30px rgba(0, 210, 255, 0.4)' }}
            >
              Paused
            </h2>

            <div className="bg-white/5 rounded-xl px-6 py-3 border border-white/10">
              <span className="text-white/50 text-sm">Current Score: </span>
              <span className="text-white text-lg font-bold">{score}</span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={resumeGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-lg font-bold rounded-xl
                           shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                ▶ Resume
              </button>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-white/10 hover:bg-white/15 text-white text-lg font-bold rounded-xl
                           border border-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                🔄 Restart
              </button>
            </div>

            <p className="text-xs text-white/30 mt-1">Press ESC / P to resume • Space to resume</p>
          </div>
        </div>
      )}

      {/* ===== GAME OVER SCREEN ===== */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 max-w-sm w-full">
            <div className="text-6xl">💥</div>
            <h2
              className="text-4xl sm:text-5xl font-black text-white text-center"
              style={{ textShadow: '0 0 30px rgba(255, 71, 87, 0.5)' }}
            >
              Game Over
            </h2>

            {/* Score card */}
            <div className="w-full bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md">
              <div className="text-center">
                <div className="text-sm text-white/40 uppercase tracking-widest mb-1">Final Score</div>
                <div className="text-5xl font-black text-white mb-3">{score}</div>
              </div>

              <div className="flex justify-center gap-8 pt-3 border-t border-white/5">
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">{engineRef.current?.bestCombo || 0}x</div>
                  <div className="text-xs text-white/40 mt-1">Best Combo</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-400">{missed}/{MAX_MISSED}</div>
                  <div className="text-xs text-white/40 mt-1">Missed</div>
                </div>
              </div>

              {/* New high score indicator */}
              {engineRef.current && engineRef.current.highScores.length > 0 && engineRef.current.highScores[0].score === score && (
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <span className="text-yellow-400 text-sm font-bold animate-pulse">🏆 New High Score! 🏆</span>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="w-full mt-1 group relative px-10 py-4 text-white text-xl font-bold rounded-2xl cursor-pointer
                         overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              <span className="relative z-10">🔄 Play Again</span>
            </button>

            <p className="text-xs text-white/30">Press Space or Enter to restart</p>

            <HighScoreTable engine={getEngine()} />
          </div>
        </div>
      )}

      {/* ===== PAUSE BUTTON (during gameplay) ===== */}
      {gameState === 'playing' && (
        <button
          onClick={pauseGame}
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 w-11 h-11 flex items-center justify-center
                     bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-xl text-white text-lg
                     transition-all duration-200 cursor-pointer active:scale-90 border border-white/10"
          aria-label="Pause game"
        >
          ⏸
        </button>
      )}
    </div>
  );
}

function HighScoreTable({ engine }: { engine: GameEngine }) {
  const scores = engine.highScores;
  if (scores.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mt-3 w-full max-w-xs">
      <h3 className="text-center text-xs font-semibold text-white/30 uppercase tracking-[0.2em] mb-2">
        🏆 High Scores
      </h3>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden backdrop-blur-md divide-y divide-white/5">
        {scores.slice(0, 5).map((s, i) => (
          <div
            key={i}
            className={`flex items-center px-4 py-2.5 text-sm transition-colors
                       ${i === 0 ? 'text-yellow-400 bg-yellow-500/5' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}
          >
            <span className="w-8 text-base">{medals[i] || `${i + 1}.`}</span>
            <span className="font-bold flex-1 tabular-nums">{s.score}</span>
            <span className="text-white/20 text-xs">{s.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
