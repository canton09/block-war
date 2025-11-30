
export enum OwnerType {
  PLAYER = 'player',
  AI = 'ai',
  NEUTRAL = 'neutral',
}

export enum BuildingType {
  TOWER = 'TOWER',       // Defensive: Shoots enemies
  BARRACKS = 'BARRACKS', // Military: Allows recruiting
  HOUSE = 'HOUSE',       // Economic: Increases max population
}

export enum TerrainType {
  WATER = 'WATER',
  SAND = 'SAND',
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  HILL = 'HILL',
  MOUNTAIN = 'MOUNTAIN'
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

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  color?: string;
}

export interface BaseInfo {
    id: string;
    units: number;
    population: number;
    maxPopulation: number;
    level: number;
    unitCap: number;
    isMine: boolean;
    hasBarracks: boolean;
}
