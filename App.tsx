
import React, { useState, useCallback, useRef } from 'react';
import GameCanvas, { GameCanvasRef } from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import Sidebar from './components/Sidebar';
import { BuildingType, GameStatus, LogEntry, BaseInfo } from './types';
import { ECO } from './constants';
import { audioManager } from './audioManager';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU);
  const [restartKey, setRestartKey] = useState(0);
  const [selectedBase, setSelectedBase] = useState<BaseInfo | null>(null);
  const [buildMode, setBuildMode] = useState<BuildingType | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [playerMoney, setPlayerMoney] = useState(ECO.STARTING_MONEY);
  
  const gameRef = useRef<GameCanvasRef>(null);

  const handleGameOver = useCallback((win: boolean) => {
    setGameStatus(win ? GameStatus.WON : GameStatus.LOST);
    setSelectedBase(null);
    setBuildMode(null);
    audioManager.stopMusic();
  }, []);

  const handleStartGame = () => {
    audioManager.init();
    audioManager.startMusic();
    setGameStatus(GameStatus.PLAYING);
    setRestartKey(prev => prev + 1);
    setSelectedBase(null);
    setBuildMode(null);
    setLogs([]); 
    setPlayerMoney(ECO.STARTING_MONEY);
  };
  
  const handleSelectionChange = useCallback((base: BaseInfo | null) => {
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
  
  const handleRecruit = useCallback(() => {
      if (gameRef.current) {
          gameRef.current.recruitUnit();
      }
  }, []);

  return (
    <div className="flex flex-col landscape:flex-row md:flex-row w-full h-[100dvh] bg-[#0F172A] overflow-hidden font-['Press_Start_2P'] touch-none select-none">
      
      <div className="order-2 landscape:order-1 md:order-1 w-full landscape:w-72 md:w-80 h-[45dvh] landscape:h-full md:h-full flex-shrink-0 z-20 border-t landscape:border-t-0 landscape:border-r md:border-t-0 md:border-r border-[#1D2B53] shadow-xl bg-[#1e293b]">
        <Sidebar 
            gameStatus={gameStatus}
            playerMoney={playerMoney}
            logs={logs}
            selectedBase={selectedBase}
            onEnterBuildMode={handleEnterBuildMode}
            isBuildMode={buildMode}
            onCancelBuildMode={handleCancelBuildMode}
            onRecruit={handleRecruit}
        />
      </div>

      <div className="order-1 landscape:order-2 md:order-2 w-full h-[55dvh] landscape:h-full md:h-full flex-1 relative bg-black overflow-hidden">
        <GameCanvas 
            ref={gameRef}
            gameStatus={gameStatus} 
            playerMoney={playerMoney}
            setPlayerMoney={setPlayerMoney}
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