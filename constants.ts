
import { GameConfig } from './types';

export const COLORS = {
  PLAYER: '#00E436', // Arcade Green
  NEUTRAL: '#9CA3AF', // Cool Grey
  ENEMY_1: '#FF004D', // Red
  ENEMY_2: '#FFA300', // Orange
  ENEMY_3: '#FFEC27', // Yellow
  ENEMY_4: '#83769C', // Purple
  
  // Terrain Colors (8-Bit Earthy Tones)
  TERRAIN_WATER: '#1D2B53', // Deep Sea
  TERRAIN_WATER_SHALLOW: '#29ADFF', // Shoreline
  TERRAIN_SAND: '#FFEC27', // Sand
  TERRAIN_GRASS: '#008751', // Base Green
  TERRAIN_FOREST: '#004E35', // Dark Green
  TERRAIN_HILL: '#AB5236', // Brown/Reddish
  TERRAIN_MOUNTAIN: '#C2C3C7', // Grey
  TERRAIN_MOUNTAIN_PEAK: '#FFF1E8', // Snow/Peak

  WHITE: '#FFFFFF',
  TEXT_DARK: '#0F172A',
  TEXT_LIGHT: '#94A3B8',
};

export const CONFIG: GameConfig = {
  baseRadius: 28,
  unitSpeed: 0.15, // Extremely slow, strategic movement
  spawnRate: 350, // Very slow production (approx 6 seconds per unit)
  unitSize: 6,
  islandSize: 60,
};

export const BUILD_COST = 15; 
export const BUILDING_RADIUS = 12; // Collision radius for buildings
