import { GameConfig } from './types';

export const COLORS = {
  PLAYER: '#4CAF50', // Green
  NEUTRAL: '#CFD8DC', // Light Grey (Better for 3D white walls)
  ENEMY_1: '#AB47BC', // Purple
  ENEMY_2: '#FF7043', // Orange
  ENEMY_3: '#EC407A', // Pink
  ENEMY_4: '#FDD835', // Yellow
  WATER_TOP: '#4FC3F7', // Lighter water for gradient
  WATER_BOTTOM: '#0288D1', // Darker water for gradient
  WHITE: '#FFFFFF',
  TEXT_DARK: '#263238',
  TEXT_LIGHT: '#546E7A',
};

export const CONFIG: GameConfig = {
  baseRadius: 28,
  unitSpeed: 1.2, // Much slower for better pacing (was 2.5)
  spawnRate: 90, // Slower spawn rate (was 60)
  unitSize: 6,
  islandSize: 60,
};