export enum OwnerType {
  PLAYER = 'player',
  AI = 'ai',
  NEUTRAL = 'neutral',
}

export interface Point {
  x: number;
  y: number;
}

export interface GameConfig {
  baseRadius: number;
  unitSpeed: number;
  spawnRate: number;
  unitSize: number;
  islandSize: number;
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
}
