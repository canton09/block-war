
import React, { useState, useEffect } from 'react';
import { BuildingType, GameStatus } from '../types';
import { Castle, Play, RotateCcw, Shield, Swords, Zap, Ban } from 'lucide-react';
import { BUILD_COST } from '../constants';

interface UIOverlayProps {
  gameStatus: GameStatus;
  onStartGame: () => void;
  selectedBase: { id: string, units: number, isMine: boolean, canAfford: boolean } | null;
  onEnterBuildMode: (type: BuildingType) => void;
  isBuildMode: BuildingType | null;
  onCancelBuildMode: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
    gameStatus, 
    onStartGame, 
    selectedBase, 
    onEnterBuildMode,
    isBuildMode,
    onCancelBuildMode
}) => {
  const isMenu = gameStatus === GameStatus.MENU;
  const isGameOver = gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST;
  const isWon = gameStatus === GameStatus.WON;

  const buildOptions = [
    { type: BuildingType.BARRACKS, label: '兵营', icon: Swords, cost: BUILD_COST, desc: '+回兵' },
    { type: BuildingType.TOWER, label: '哨塔', icon: Zap, cost: BUILD_COST, desc: '防御' },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10 font-['Press_Start_2P']">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 pointer-events-auto w-fit">
        <div className="bg-[#1D2B53] border-4 border-white p-2 shadow-lg">
            <Castle className="w-6 h-6 text-white" />
        </div>
        <div className="text-white drop-shadow-md">
            <h1 className="text-sm leading-6 tracking-wider text-[#FFEC27]">
            方块战争
            </h1>
            <p className="text-[10px] text-white/80">RISING</p>
        </div>
      </div>

      {/* Build Notification */}
      {isBuildMode && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-[#FF004D] border-4 border-white text-white px-4 py-3 shadow-xl animate-pulse flex items-center gap-3 pointer-events-auto cursor-pointer" onClick={onCancelBuildMode}>
              <span className="text-[10px]">点击空地建造</span>
              <Ban className="w-4 h-4 text-white"/>
          </div>
      )}

      {/* Build Menu (Bottom Bar) */}
      {gameStatus === GameStatus.PLAYING && selectedBase && selectedBase.isMine && (
        <div className="pointer-events-auto bg-[#FFF1E8] border-t-4 border-[#1D2B53] p-4 pb-8 animate-slide-up shadow-[0_-4px_0px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center mb-4 px-1">
                <span className="text-[#1D2B53] text-[10px] uppercase tracking-wider">
                    {isBuildMode ? '选择位置...' : `建造 (兵力: ${selectedBase.units})`}
                </span>
                {isBuildMode && (
                    <button onClick={onCancelBuildMode} className="text-[8px] text-[#FF004D] border-2 border-[#FF004D] px-2 py-1 bg-white hover:bg-[#FF004D] hover:text-white transition-colors">取消</button>
                )}
            </div>
            <div className="flex gap-4 justify-center">
                {buildOptions.map((opt) => {
                    const isActive = isBuildMode === opt.type;
                    const canAfford = selectedBase.units >= opt.cost;
                    const Icon = opt.icon;
                    
                    return (
                        <button
                            key={opt.type}
                            onClick={() => {
                                if (isActive) onCancelBuildMode();
                                else if (canAfford) onEnterBuildMode(opt.type);
                            }}
                            disabled={!canAfford && !isActive}
                            className={`
                                flex-1 flex flex-col items-center p-3 border-4 transition-all duration-100
                                ${isActive 
                                    ? 'bg-[#29ADFF] border-[#1D2B53] text-white shadow-[4px_4px_0px_rgba(0,0,0,0.5)] translate-x-[-2px] translate-y-[-2px]' 
                                    : canAfford 
                                        ? 'bg-white border-[#C2C3C7] hover:border-[#29ADFF] hover:bg-[#EFFFFF] text-[#1D2B53] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_#C2C3C7]' 
                                        : 'bg-[#C2C3C7] border-[#83769C] opacity-60 cursor-not-allowed text-[#5f574f]'}
                            `}
                        >
                            <div className={`p-1 mb-2 ${isActive ? 'text-white' : 'text-[#1D2B53]'}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-[10px] mb-1">{opt.label}</div>
                            <div className="text-[8px] opacity-70">{opt.desc}</div>
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      {/* Modal */}
      {(isMenu || isGameOver) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1D2B53]/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-[#FFF1E8] border-4 border-white p-6 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] text-center max-w-sm w-full transform transition-all scale-100">
            <div className="mb-6 flex justify-center">
                <div className={`p-4 border-4 ${isWon ? 'bg-[#00E436] border-[#008751]' : isMenu ? 'bg-[#29ADFF] border-[#1D2B53]' : 'bg-[#FF004D] border-[#790025]'}`}>
                    {isMenu ? <Shield className="w-8 h-8 text-white" /> : 
                     isWon ? <span className="text-4xl">🏆</span> : <span className="text-4xl">💀</span>}
                </div>
            </div>
            
            <h2 className={`text-xl mb-4 leading-normal ${isWon ? 'text-[#008751]' : isMenu ? 'text-[#1D2B53]' : 'text-[#FF004D]'}`}>
              {isMenu ? '开始征服' : isWon ? '大获全胜！' : '防线崩溃'}
            </h2>
            
            <p className="text-[#5f574f] text-[10px] mb-8 leading-relaxed">
              {isMenu
                ? '指挥你的军团，在领土上建造防御塔和兵营，运用策略征服这片岛屿。'
                : isWon
                ? '你的战略无可匹敌，所有领土已归你所有。'
                : '敌人占领了你的最后一座堡垒。'}
            </p>
            
            <button
              onClick={onStartGame}
              className="w-full group relative overflow-hidden bg-[#1D2B53] text-[#FFEC27] text-xs py-4 border-4 border-[#83769C] shadow-[4px_4px_0px_#000] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all"
            >
              <div className="flex items-center justify-center gap-3">
                {isMenu ? <Play className="w-4 h-4 fill-current" /> : <RotateCcw className="w-4 h-4" />}
                <span>{isMenu ? '进入战场' : '重整旗鼓'}</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;