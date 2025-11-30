
import React from 'react';
import { GameStatus } from '../types';
import { Play, RotateCcw, Shield } from 'lucide-react';

interface UIOverlayProps {
  gameStatus: GameStatus;
  onStartGame: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
    gameStatus, 
    onStartGame, 
}) => {
  const isMenu = gameStatus === GameStatus.MENU;
  const isGameOver = gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST;
  const isWon = gameStatus === GameStatus.WON;

  if (!isMenu && !isGameOver) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm pointer-events-auto p-4 z-50 font-['Press_Start_2P']">
          <div className="bg-[#FFF1E8] border-4 border-white p-6 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] text-center w-full max-w-sm transform transition-all scale-100">
            <div className="mb-6 flex justify-center">
                <div className={`p-4 border-4 ${isWon ? 'bg-[#00E436] border-[#008751]' : isMenu ? 'bg-[#29ADFF] border-[#1D2B53]' : 'bg-[#FF004D] border-[#790025]'}`}>
                    {isMenu ? <Shield className="w-10 h-10 text-white" /> : 
                     isWon ? <span className="text-5xl">🏆</span> : <span className="text-5xl">💀</span>}
                </div>
            </div>
            
            <h2 className={`text-xl md:text-2xl mb-4 leading-normal ${isWon ? 'text-[#008751]' : isMenu ? 'text-[#1D2B53]' : 'text-[#FF004D]'}`}>
              {isMenu ? '开始征服' : isWon ? '大获全胜！' : '防线崩溃'}
            </h2>
            
            <p className="text-[#5f574f] text-xs mb-8 leading-relaxed px-2">
              {isMenu
                ? '指挥官，系统已上线。检查左侧面板获取情报。'
                : isWon
                ? '敌军已被彻底肃清。'
                : '我方基地全部沦陷。'}
            </p>
            
            <button
              onClick={onStartGame}
              className="w-full group relative overflow-hidden bg-[#1D2B53] text-[#FFEC27] text-sm py-5 border-4 border-[#83769C] shadow-[4px_4px_0px_#000] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all touch-manipulation"
            >
              <div className="flex items-center justify-center gap-3">
                {isMenu ? <Play className="w-5 h-5 fill-current" /> : <RotateCcw className="w-5 h-5" />}
                <span>{isMenu ? '初始化系统' : '重置战场'}</span>
              </div>
            </button>
          </div>
    </div>
  );
};

export default UIOverlay;
