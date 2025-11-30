
import React, { useState, useCallback, useRef } from 'react';
import GameCanvas, { GameCanvasRef } from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import Sidebar from './components/Sidebar';
import { BuildingType, GameStatus, LogEntry } from './types';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU);
  const [restartKey, setRestartKey] = useState(0);
  const [selectedBase, setSelectedBase] = useState<{ id: string, units: number, isMine: boolean, canAfford: boolean } | null>(null);
  const [buildMode, setBuildMode] = useState<BuildingType | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const gameRef = useRef<GameCanvasRef>(null);

  const handleGameOver = useCallback((win: boolean) => {
    setGameStatus(win ? GameStatus.WON : GameStatus.LOST);
    setSelectedBase(null);
    setBuildMode(null);
  }, []);

  const handleStartGame = () => {
    setGameStatus(GameStatus.PLAYING);
    setRestartKey(prev => prev + 1);
    setSelectedBase(null);
    setBuildMode(null);
    setLogs([]); // Clear logs on restart
  };
  
  const handleSelectionChange = useCallback((base: { id: string, units: number, isMine: boolean, canAfford: boolean } | null) => {
      setSelectedBase(base);
      if (!base) {
           setBuildMode(null);
           if (gameRef.current) gameRef.current.setBuildMode(null);
      }
  }, []);
  
  const handleEnterBuildMode = (type: BuildingType) => {
      setBuildMode(type);
      if (gameRef.current) {
          gameRef.current.setBuildMode(type);
      }
  };
  
  const handleCancelBuildMode = useCallback(() => {
      setBuildMode(null);
      if (gameRef.current) {
          gameRef.current.setBuildMode(null);
      }
  }, []);

  const handleAddLog = useCallback((message: string, color?: string) => {
      setLogs(prev => {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
          const newEntry: LogEntry = {
              id: Date.now() + Math.random(),
              timestamp: timeStr,
              message,
              color
          };
          return [...prev, newEntry].slice(-50);
      });
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-full h-[100dvh] bg-[#0F172A] overflow-hidden font-['Press_Start_2P'] touch-none select-none">
      
      {/* Sidebar: 
          Mobile: Order 2 (Bottom), Height 35% fixed. 
          Desktop: Order 1 (Left), Height 100%, Width 80 (320px).
      */}
      <div className="order-2 md:order-1 w-full md:w-80 h-[35dvh] md:h-full flex-shrink-0 z-20 border-t md:border-t-0 md:border-r border-[#1D2B53] shadow-xl bg-[#1e293b]">
        <Sidebar 
            gameStatus={gameStatus}
            logs={logs}
            selectedBase={selectedBase}
            onEnterBuildMode={handleEnterBuildMode}
            isBuildMode={buildMode}
            onCancelBuildMode={handleCancelBuildMode}
        />
      </div>

      {/* Game Area: 
          Mobile: Order 1 (Top), Height 65%.
          Desktop: Order 2 (Right), Height 100%, Flex-1.
      */}
      <div className="order-1 md:order-2 w-full h-[65dvh] md:h-full flex-1 relative bg-black overflow-hidden">
        <GameCanvas 
            ref={gameRef}
            gameStatus={gameStatus} 
            onGameOver={handleGameOver}
            triggerRestart={restartKey}
            onSelectionChange={handleSelectionChange}
            onCancelBuild={handleCancelBuildMode}
            onAddLog={handleAddLog}
        />
        <UIOverlay 
            gameStatus={gameStatus} 
            onStartGame={handleStartGame} 
        />
      </div>

    </div>
  );
};

export default App;
