
import React from 'react';
import { BuildingType, GameStatus, LogEntry } from '../types';
import GameLog from './GameLog';
import { Castle, Zap, Swords, Shield, MapPin, Radar } from 'lucide-react';
import { BUILD_COST } from '../constants';

interface SidebarProps {
  gameStatus: GameStatus;
  logs: LogEntry[];
  selectedBase: { id: string, units: number, isMine: boolean, canAfford: boolean } | null;
  onEnterBuildMode: (type: BuildingType) => void;
  isBuildMode: BuildingType | null;
  onCancelBuildMode: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  logs,
  selectedBase,
  onEnterBuildMode,
  isBuildMode,
  onCancelBuildMode
}) => {
  
  const buildOptions = [
    { type: BuildingType.BARRACKS, label: '兵营', icon: Swords, cost: BUILD_COST, desc: '加快兵力生产' },
    { type: BuildingType.TOWER, label: '哨塔', icon: Zap, cost: BUILD_COST, desc: '自动攻击敌人' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1e293b] text-[#94A3B8]">
      {/* Header - Hidden on Mobile to save vertical space */}
      <div className="hidden md:flex p-3 bg-[#0F172A] border-b border-[#29ADFF]/30 items-center justify-between flex-shrink-0">
         <div className="flex items-center gap-2">
            <div className="bg-[#1D2B53] p-1 border border-[#29ADFF]">
                <Radar className="w-4 h-4 text-[#29ADFF] animate-pulse" />
            </div>
            <div>
                <h1 className="text-[10px] text-[#FFEC27] tracking-widest">WAR INC: RISING</h1>
                <div className="text-[8px] text-[#29ADFF]">TAC-NET ONLINE</div>
            </div>
         </div>
      </div>

      {/* Log Section (Flex Grow) - Allows it to shrink if needed */}
      <div className="flex-1 overflow-hidden relative border-b border-[#1D2B53] bg-[#0f172a] min-h-0">
         <GameLog logs={logs} />
      </div>

      {/* Control Panel (Fixed Bottom) - Compact on Mobile */}
      <div className="flex-shrink-0 bg-[#0F172A] p-2 md:p-4 min-h-fit md:min-h-[280px] overflow-y-auto">
        
        {/* Status Header */}
        <div className="mb-1 md:mb-3 flex items-center gap-2 text-[10px] text-[#29ADFF] border-b border-[#29ADFF]/20 pb-1 md:pb-2">
            <MapPin className="w-3 h-3" />
            <span>SELECTION INFO</span>
        </div>

        {/* Content */}
        {!selectedBase ? (
            <div className="h-[120px] md:h-full flex flex-col items-center justify-center text-center opacity-50 gap-2 mt-2">
                <Castle className="w-6 h-6 md:w-8 md:h-8" />
                <p className="text-[10px]">未选择据点</p>
                <p className="text-[8px] hidden md:block">点击地图上的据点查看详情</p>
            </div>
        ) : (
            <div className="animate-fade-in">
                {/* Base Info Grid - Compact Grid for Mobile */}
                <div className="grid grid-cols-2 gap-1 md:gap-2 mb-2 md:mb-4">
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53]">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8] mb-0.5 md:mb-1">ID</div>
                        <div className="text-[8px] md:text-[10px] text-white truncate">{selectedBase.id}</div>
                    </div>
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53]">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8] mb-0.5 md:mb-1">OWNER</div>
                        <div className={`text-[8px] md:text-[10px] ${selectedBase.isMine ? 'text-[#00E436]' : 'text-[#FF004D]'}`}>
                            {selectedBase.isMine ? '我军' : '敌军'}
                        </div>
                    </div>
                    <div className="bg-[#1D2B53]/50 p-1 md:p-2 border border-[#1D2B53] col-span-2 flex justify-between items-center">
                        <div className="text-[6px] md:text-[8px] text-[#94A3B8]">GARRISON</div>
                        <div className="text-[10px] md:text-xs text-[#FFEC27]">{selectedBase.units} UNITS</div>
                    </div>
                </div>

                {/* Build Controls */}
                {selectedBase.isMine ? (
                    <div>
                         <div className="text-[6px] md:text-[8px] text-[#29ADFF] mb-1 md:mb-2 uppercase tracking-wider flex justify-between">
                            <span>Protocol</span>
                            {isBuildMode && <span className="text-[#FFEC27] animate-pulse">DEPLOYING...</span>}
                         </div>
                         
                         {isBuildMode ? (
                             <div className="bg-[#1D2B53] p-2 md:p-3 border border-[#FFEC27] text-center">
                                 <p className="text-[8px] md:text-[10px] text-white mb-1 md:mb-2">
                                     选择地图位置...
                                 </p>
                                 <p className="text-[6px] md:text-[8px] text-[#94A3B8] mb-2 md:mb-3">
                                     {isBuildMode === BuildingType.TOWER ? '只能建造在山地 (HILL)' : '只能建造在平原 (GRASS)'}
                                 </p>
                                 <button 
                                     onClick={onCancelBuildMode}
                                     className="w-full py-2 bg-[#FF004D] text-white text-[8px] md:text-[10px] border border-white hover:bg-[#D60040]"
                                 >
                                     取消建造
                                 </button>
                             </div>
                         ) : (
                             <div className="flex gap-2">
                                {buildOptions.map(opt => {
                                    const canAfford = selectedBase.units >= opt.cost;
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
                                            <div className="text-[8px] font-bold mb-0.5 md:mb-1">{opt.label}</div>
                                            <div className="text-[6px] md:text-[8px] opacity-70">{opt.cost}</div>
                                        </button>
                                    )
                                })}
                             </div>
                         )}
                    </div>
                ) : (
                    <div className="p-2 md:p-3 bg-[#FF004D]/10 border border-[#FF004D]/30 text-center">
                        <Shield className="w-4 h-4 md:w-5 md:h-5 text-[#FF004D] mx-auto mb-1 md:mb-2" />
                        <p className="text-[8px] md:text-[10px] text-[#FF004D]">LOCKED</p>
                        <p className="text-[6px] md:text-[8px] text-[#94A3B8]">占领以解锁</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
