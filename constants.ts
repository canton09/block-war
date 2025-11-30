
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
  GOLD: '#FFEC27', // Money Color
};

export const CONFIG: GameConfig = {
  baseRadius: 28,
  unitSpeed: 0.15, // Extremely slow, strategic movement
  spawnRate: 800, // Very slow natural militia spawn fallback
  unitSize: 6,
  islandSize: 60,
};

export const COSTS = {
  HOUSE: 100,      // Increased cost
  TOWER: 250,      // Increased cost
  BARRACKS: 300,   // Increased cost
  SOLDIER: 40,     // Cost to recruit one unit
};

export const ECO = {
  STARTING_MONEY: 200,     // Lower starting money
  POP_GROWTH_RATE: 150,    // Much slower population growth (ticks per +1 pop)
  TAX_RATE: 300,           // Slower tax collection cycles
  TAX_PER_POP: 0.05,       // Very low tax per person to prevent inflation. 200 pop * 0.05 = $10 per cycle
  
  // Population Scaling
  BASE_START_MAX_POP: 100, // Reduced base cap
  POP_PER_LEVEL: 150,      
  POP_PER_HOUSE: 80,      
  
  UNIT_RATIO: 0.1,         // 10% Rule: Max Units = Pop * 0.1
};

export const LEVEL_THRESHOLDS = {
  LVL_2: 1, // 1 House
  LVL_3: 3, // 3 Houses
  LVL_4: 6, // 6 Houses
  LVL_5: 10, // 10 Houses
  LVL_6: 15, // 15 Houses
};

export const BUILDING_RADIUS = 12; // Collision radius for buildings
