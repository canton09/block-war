
import React, { useState } from 'react';
import { BuildingType, GameStatus, LogEntry, BaseInfo } from '../types';
import GameLog from './GameLog';
import { Castle, Zap, Swords, Shield, MapPin, Radar, Home, Coins, UserPlus, TrendingUp, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { COSTS } from '../constants';
import { audioManager } from '../audioManager';

interface SidebarProps {
  gameStatus: GameStatus;
  playerMoney: number;
  logs: LogEntry[];
  selectedBase: BaseInfo | null;
  onEnterBuildMode: (type: BuildingType) => void;
  isBuildMode: BuildingType | null;
  onCancelBuildMode: () => void;
  onRecruit: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  gameStatus,
  playerMoney,
  logs,
  selectedBase,
  onEnterBuildMode,
  isBuildMode,
  onCancelBuildMode,
  onRecruit
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [trackName, setTrackName] = useState(audioManager.getCurrentTrackName());

  const toggleSound = () => {
      const muted = audioManager.toggleMute();
      setIsMuted(muted);
  };

  const nextTrack = () => {
      audioManager.nextTrack();
      setTrackName(audioManager.getCurrentTrackName());
  };
  
  const buildOptions = [
    { type: BuildingType.HOUSE, label: '房屋', icon: Home, cost: COSTS.HOUSE, desc: '增加人口上限' },
    { type: BuildingType.BARRACKS, label: '兵营', icon: Swords, cost: COSTS.BARRACKS, desc: '允许手动征兵' },
    { type: BuildingType.TOWER, label: '哨塔', icon: Zap, cost: COSTS.TOWER, desc: '防御塔' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1e293b] text-[#94A3B8] overflow-hidden">
      {/* Header - Shows Money now */}
      <div className="hidden landscape:flex md:flex p-3 bg-[#0F172A] border-b border-[#29ADFF]/30 items-center justify-between flex-shrink-0">
         <div className="flex items-center gap-2">
            <div className="bg-[#1D2B53] p-1 border border-[#29ADFF]">
                <Radar className="w-4 h-4 text-[#29ADFF] animate-pulse" />
            </div>
            <div>
                <h1 className="text-[10px] text-[#FFEC27] tracking-widest">方块战争: 崛起</h1>
                <div className="flex items-center gap-1 text-[8px] text-[#29ADFF]">
                   <span>国库资金:</span>
                   <span className="text-[#FFEC27]">${playerMoney}</span>
                </div>
            </div>
         </div>
         <div className="flex items-center gap-1">
             <button onClick={nextTrack} className="p-1 hover:bg-[#1D2B53] rounded" title="下一首">
                 <SkipForward className="w-4 h-4 text-[#94A3B8]" />
             </button>
             <button onClick={toggleSound} className="p-1 hover:bg-[#1D2B53] rounded">
                 {isMuted ? <VolumeX className="w-4 h-4 text-[#FF004D]" /> : <Volume2 className="w-4 h-4 text-[#00E436]" />}
             </button>
         </div>
      </div>
      
      {/* Mobile Money Header (Visible only on mobile) */}
      <div className="landscape:hidden md:hidden p-2 bg-[#0F172A] flex justify-between items-center border-b border-[#1D2B53]">
          <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#FFEC27]">方块战争</span>
              <button onClick={toggleSound}>
                 {isMuted ? <VolumeX className="w-3 h-3 text-[#FF004D]" /> : <Volume2 className="w-3 h-3 text-[#00E436]" />}
              </button>
          </div>
          <div className="flex items-center gap-1 bg-[#1D2B53] px-2 py-1 rounded">
              <Coins className="w-3 h-3 text-[#FFEC27]" />
              <span className="text-[10px] text-white">${playerMoney}</span>
          </div>
      </div>

      {/* Track Info (Tiny) */}
      {!isMuted && (
          <div className="text-[8px] bg-[#000] text-[#00E436] px-2 py-0.5 text-center truncate">
              ♪ BGM: {trackName}
          </div>
      )}

      {/* Log Section */}
      <div className="flex-1 overflow-hidden relative border-b border-[#1D2B53] bg-[#0f172a] min-h-0">
         <GameLog logs={logs} />
      </div>

      {/* Control Panel */}
      <div className="flex-shrink-0 bg-[#0F172A] p-2 md:p-4 max-h-[100%] overflow-y-auto">
        
        <div className="mb-1 md:mb-3 flex items-center gap-2 text-[10px] text-[#29ADFF] border-b border-[#29ADFF]/20 pb-1 md:pb-2 sticky top-0 bg-[#0F172A] z-10">
            <MapPin className="w-3 h-3" />
            <span>据点情报</span>
        </div>

        {!selectedBase ? (
            <div className="py-4 md:h-full flex flex-col items-center justify-center text-center opacity-50 gap-2">
                <Castle className="w-6 h-6 md:w-8 md:h-8" />
                <p className="text-[10px]">未选择据点</p>
                <p className="text-[8px] hidden md:block">点击地图上的据点查看详情</p>
            </div>
        ) : (
            <div className="animate-fade-in pb-2">
                {/* Base Info Grid */}
                <div className="grid grid-cols-2 gap-1 md:gap-2 mb-2 md:mb-4">
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53] flex flex-col justify-between">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8] mb-0.5 md:mb-1">城堡等级</div>
                        <div className="text-[10px] md:text-xs text-[#FFEC27] flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            LV.{selectedBase.level}
                        </div>
                    </div>
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53]">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8] mb-0.5 md:mb-1">人口规模</div>
                        <div className="text-[8px] md:text-[10px] text-[#29ADFF]">
                            {selectedBase.population} / {selectedBase.maxPopulation}
                        </div>
                    </div>
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53] col-span-2 flex justify-between items-center">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8]">现役兵力 / 上限(10%)</div>
                        <div className={`text-[10px] md:text-xs ${selectedBase.units >= selectedBase.unitCap ? 'text-[#FF004D] animate-pulse' : 'text-[#00E436]'}`}>
                            {selectedBase.units} / {selectedBase.unitCap}
                        </div>
                    </div>
                </div>

                {/* Player Actions */}
                {selectedBase.isMine ? (
                    <div className="space-y-2">
                         {/* Recruitment Section */}
                         <button
                            onClick={onRecruit}
                            disabled={!selectedBase.hasBarracks || playerMoney < COSTS.SOLDIER || selectedBase.units >= selectedBase.unitCap}
                            className={`
                                w-full flex items-center justify-between p-2 border border-dashed
                                ${(!selectedBase.hasBarracks || selectedBase.units >= selectedBase.unitCap)
                                    ? 'border-gray-700 text-gray-600 cursor-not-allowed bg-[#0F172A]' 
                                    : playerMoney < COSTS.SOLDIER 
                                        ? 'border-red-900 text-red-700 cursor-not-allowed' 
                                        : 'border-[#00E436] text-[#00E436] hover:bg-[#00E436]/10 active:scale-95'
                                }
                            `}
                         >
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                <div className="text-left">
                                    <div className="text-[8px] font-bold">征召士兵</div>
                                    {!selectedBase.hasBarracks && <div className="text-[6px]">需要兵营</div>}
                                    {selectedBase.units >= selectedBase.unitCap && <div className="text-[6px] text-[#FF004D]">人口上限已满</div>}
                                </div>
                            </div>
                            <div className="text-[8px]">${COSTS.SOLDIER}</div>
                         </button>

                         <div className="h-px bg-[#1D2B53] w-full my-2"></div>

                         <div className="text-[6px] md:text-[8px] text-[#29ADFF] mb-1 md:mb-2 uppercase tracking-wider flex justify-between">
                            <span>建筑工程</span>
                            {isBuildMode && <span className="text-[#FFEC27] animate-pulse">...正在部署...</span>}
                         </div>
                         
                         {isBuildMode ? (
                             <div className="bg-[#1D2B53] p-2 md:p-3 border border-[#FFEC27] text-center">
                                 <p className="text-[8px] md:text-[10px] text-white mb-1 md:mb-2">
                                     请在地图上选择位置...
                                 </p>
                                 <p className="text-[6px] md:text-[8px] text-[#94A3B8] mb-2 md:mb-3">
                                     {isBuildMode === BuildingType.TOWER ? '仅限建造于山地 (HILL)' : '仅限建造于平原 (GRASS/FOREST)'}
                                 </p>
                                 <button 
                                     onClick={onCancelBuildMode}
                                     className="w-full py-2 bg-[#FF004D] text-white text-[8px] md:text-[10px] border border-white hover:bg-[#D60040]"
                                 >
                                     取消建造
                                 </button>
                             </div>
                         ) : (
                             <div className="flex gap-1">
                                {buildOptions.map(opt => {
                                    const canAfford = playerMoney >= opt.cost;
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={opt.type}
                                            onClick={() => canAfford && onEnterBuildMode(opt.type)}
                                            disabled={!canAfford}
                                            className={`
                                                flex-1 p-2 border-2 transition-all flex flex-col items-center text-center relative overflow-hidden group
                                                ${canAfford 
                                                    ? 'bg-[#1D2B53] border-[#29ADFF] hover:bg-[#29ADFF] hover:text-[#0F172A] active:scale-95 cursor-pointer' 
                                                    : 'bg-[#0F172A] border-[#334155] opacity-50 cursor-not-allowed'}
                                            `}
                                        >
                                            <Icon className={`w-4 h-4 md:w-5 md:h-5 mb-1 ${canAfford ? 'text-[#FFEC27] group-hover:text-[#0F172A]' : 'text-[#334155]'}`} />
                                            <div className="text-[7px] font-bold mb-0.5">{opt.label}</div>
                                            <div className="text-[6px] opacity-70">${opt.cost}</div>
                                        </button>
                                    )
                                })}
                             </div>
                         )}
                    </div>
                ) : (
                    <div className="p-2 md:p-3 bg-[#FF004D]/10 border border-[#FF004D]/30 text-center">
                        <Shield className="w-4 h-4 md:w-5 md:h-5 text-[#FF004D] mx-auto mb-1 md:mb-2" />
                        <p className="text-[8px] md:text-[10px] text-[#FF004D]">未解锁</p>
                        <p className="text-[6px] md:text-[8px] text-[#94A3B8]">占领该据点以解锁功能</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;