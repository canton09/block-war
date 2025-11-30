
import { GameConfig } from './types';

export const COLORS = {
  PLAYER: '#00E436', // Arcade Green (Keep unit/base colors bright for visibility)
  NEUTRAL: '#9CA3AF', 
  ENEMY_1: '#FF004D', 
  ENEMY_2: '#FFA300', 
  ENEMY_3: '#FFEC27', 
  ENEMY_4: '#83769C', 
  
  // Terrain Colors (Age of Empires / Realistic RTS Style)
  TERRAIN_WATER: '#1e3a8a', // Deep Blue
  TERRAIN_WATER_SHALLOW: '#3b82f6', // Azure
  TERRAIN_SAND: '#d4b483', // Tan/Beige
  TERRAIN_GRASS: '#4d6b35', // Olive Green
  TERRAIN_FOREST: '#2e4222', // Deep Pine Green
  TERRAIN_HILL: '#8c7352', // Earthy Brown
  TERRAIN_MOUNTAIN: '#57534e', // Stone Grey
  TERRAIN_MOUNTAIN_PEAK: '#e5e7eb', // Off-white Snow

  WHITE: '#FFFFFF',
  TEXT_DARK: '#0F172A',
  TEXT_LIGHT: '#94A3B8',
  GOLD: '#FFD700', // Classic Gold
};

export const CONFIG: GameConfig = {
  baseRadius: 28,
  unitSpeed: 0.15, // Extremely slow, strategic movement
  spawnRate: 800, // Very slow natural militia spawn fallback
  unitSize: 6,
  islandSize: 60,
};

export const COSTS = {
  HOUSE: 100,      
  TOWER: 250,      
  BARRACKS: 300,   
  SOLDIER: 40,     
};

export const ECO = {
  STARTING_MONEY: 200,     
  POP_GROWTH_RATE: 150,    
  TAX_RATE: 300,           
  TAX_PER_POP: 0.05,       
  
  // Population Scaling
  BASE_START_MAX_POP: 100, 
  POP_PER_LEVEL: 150,      
  POP_PER_HOUSE: 80,      
  
  UNIT_RATIO: 0.1,         
};

export const LEVEL_THRESHOLDS = {
  LVL_2: 1, 
  LVL_3: 3, 
  LVL_4: 6, 
  LVL_5: 10, 
  LVL_6: 15, 
};

export const BUILDING_RADIUS = 12; // Collision radius for buildings
