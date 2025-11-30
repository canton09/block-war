import React, { useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { GameStatus } from './types';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.MENU);
  const [restartKey, setRestartKey] = useState(0);

  const handleGameOver = useCallback((win: boolean) => {
    setGameStatus(win ? GameStatus.WON : GameStatus.LOST);
  }, []);

  const handleStartGame = () => {
    setGameStatus(GameStatus.PLAYING);
    setRestartKey(prev => prev + 1);
  };

  return (
    <div className="relative w-full h-screen bg-[#2196F3] overflow-hidden">
      <GameCanvas 
        gameStatus={gameStatus} 
        onGameOver={handleGameOver}
        triggerRestart={restartKey}
      />
      <UIOverlay 
        gameStatus={gameStatus} 
        onStartGame={handleStartGame} 
      />
    </div>
  );
};

export default App;
