
import React from 'react';
import { GameStatus } from '../types';
import { Castle, Play, RotateCcw } from 'lucide-react';

interface UIOverlayProps {
  gameStatus: GameStatus;
  onStartGame: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameStatus, onStartGame }) => {
  const isMenu = gameStatus === GameStatus.MENU;
  const isGameOver = gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST;
  const isWon = gameStatus === GameStatus.WON;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      {/* Header */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full shadow-lg">
            <Castle className="w-8 h-8 text-white drop-shadow-md" />
        </div>
        <h1 className="text-2xl font-bold text-white drop-shadow-md tracking-wide">
          方块战争: 崛起
        </h1>
      </div>

      {/* Hint */}
      {gameStatus === GameStatus.PLAYING && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="bg-black/60 backdrop-blur-md text-white px-6 py-2 rounded-full text-sm font-medium shadow-lg border border-white/10 whitespace-nowrap">
            从你的 <span className="text-green-400 font-bold">绿色城堡</span> 拖拽以发起攻击！
          </div>
        </div>
      )}

      {/* Modal */}
      {(isMenu || isGameOver) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full border border-white/50 transform transition-all scale-100">
            <div className="mb-6 flex justify-center">
                <div className={`p-4 rounded-full ${isWon ? 'bg-green-100' : isMenu ? 'bg-blue-100' : 'bg-red-100'}`}>
                    {isMenu ? <Castle className="w-12 h-12 text-blue-600" /> : 
                     isWon ? <span className="text-4xl">🏆</span> : <span className="text-4xl">💀</span>}
                </div>
            </div>
            
            <h2 className={`text-3xl font-black mb-3 ${isWon ? 'text-green-600' : isMenu ? 'text-slate-800' : 'text-red-600'}`}>
              {isMenu ? '准备好了吗？' : isWon ? '胜利！' : '失败'}
            </h2>
            
            <p className="text-slate-500 mb-8 font-medium">
              {isMenu
                ? '占领所有敌方领土以赢得战争。'
                : isWon
                ? '你征服了这片土地！'
                : '你的帝国覆灭了。'}
            </p>
            
            <button
              onClick={onStartGame}
              className="w-full group relative overflow-hidden bg-gradient-to-b from-green-500 to-green-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] active:translate-y-0.5"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="relative flex items-center justify-center gap-2">
                {isMenu ? <Play className="w-5 h-5 fill-current" /> : <RotateCcw className="w-5 h-5" />}
                <span>{isMenu ? '开始游戏' : '再玩一次'}</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
