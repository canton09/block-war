
import { GameConfig } from './types';

export const COLORS = {
  PLAYER: '#00E436', // Arcade Green
  NEUTRAL: '#9CA3AF', // Cool Grey
  ENEMY_1: '#FF004D', // Red
  ENEMY_2: '#FFA300', // Orange
  ENEMY_3: '#FFEC27', // Yellow
  ENEMY_4: '#83769C', // Purple
  
  // Revised Retro Map Colors (Tactical Deep Blue Theme)
  WATER_BG: '#0F172A', // Slate 900 - Deep Tactical Blue
  WATER_PATTERN: '#1E293B', // Slate 800 - Slightly lighter for grid
  GRID_LINES: 'rgba(56, 189, 248, 0.05)', // Light Sky Blue, very faint
  
  WHITE: '#FFFFFF',
  TEXT_DARK: '#0F172A',
  TEXT_LIGHT: '#94A3B8',
};

export const CONFIG: GameConfig = {
  baseRadius: 28,
  unitSpeed: 0.7, 
  spawnRate: 100, 
  unitSize: 6,
  islandSize: 60,
};

export const BUILD_COST = 15; 
export const BUILDING_RADIUS = 12; // Collision radius for buildings
