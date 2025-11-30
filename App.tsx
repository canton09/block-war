
import React, { useState, useCallback, useRef } from 'react';
import GameCanvas, { GameCanvasRef } from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { BuildingType, GameStatus } from './types';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU);
  const [restartKey, setRestartKey] = useState(0);
  const [selectedBase, setSelectedBase] = useState<{ id: string, units: number, isMine: boolean, canAfford: boolean } | null>(null);
  const [buildMode, setBuildMode] = useState<BuildingType | null>(null);
  
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
  };
  
  const handleSelectionChange = useCallback((base: { id: string, units: number, isMine: boolean, canAfford: boolean } | null) => {
      setSelectedBase(base);
      // If we deselect base, we should probably exit build mode to avoid confusion, 
      // but keeping it might be okay if we clicked empty space. 
      // For now, let's keep build mode only if a base is still selected.
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

  return (
    <div className="relative w-full h-screen bg-[#0F172A] overflow-hidden">
      <GameCanvas 
        ref={gameRef}
        gameStatus={gameStatus} 
        onGameOver={handleGameOver}
        triggerRestart={restartKey}
        onSelectionChange={handleSelectionChange}
        onCancelBuild={handleCancelBuildMode}
      />
      <UIOverlay 
        gameStatus={gameStatus} 
        onStartGame={handleStartGame} 
        selectedBase={selectedBase}
        onEnterBuildMode={handleEnterBuildMode}
        isBuildMode={buildMode}
        onCancelBuildMode={handleCancelBuildMode}
      />
    </div>
  );
};

export default App;
