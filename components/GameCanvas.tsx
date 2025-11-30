
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { COLORS, CONFIG, COSTS, ECO, BUILDING_RADIUS, LEVEL_THRESHOLDS } from '../constants';
import { GameStatus, OwnerType, BuildingType, Point, TerrainType, BaseInfo } from '../types';
import { audioManager } from '../audioManager';

export interface GameCanvasRef {
  setBuildMode: (type: BuildingType | null) => void;
  recruitUnit: () => void;
}

interface GameCanvasProps {
  gameStatus: GameStatus;
  playerMoney: number;
  setPlayerMoney: (val: number) => void;
  onGameOver: (win: boolean) => void;
  triggerRestart: number;
  onSelectionChange: (base: BaseInfo | null) => void;
  onCancelBuild: () => void;
  onAddLog: (message: string, color?: string) => void;
}

const CELL_SIZE = 8;

// --- Helper Utils ---

function adjustColor(color: string, amount: number): string {
  let useColor = color;
  if (!useColor.startsWith('#')) return color;
  
  const num = parseInt(useColor.slice(1), 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;

  if (r > 255) r = 255; else if (r < 0) r = 0;
  if (g > 255) g = 255; else if (g < 0) g = 0;
  if (b > 255) b = 255; else if (b < 0) b = 0;

  return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function getOwnerTypeByColor(color: string): OwnerType {
  if (color === COLORS.PLAYER) return OwnerType.PLAYER;
  return OwnerType.AI;
}

function getOwnerName(type: OwnerType, color: string): string {
    if (type === OwnerType.PLAYER) return "指挥官";
    if (type === OwnerType.NEUTRAL) return "中立军";
    if (color === COLORS.ENEMY_1) return "红色军团";
    if (color === COLORS.ENEMY_2) return "橙色军团";
    if (color === COLORS.ENEMY_3) return "黄色军团";
    return "紫色军团";
}

// Improved Perlin-like noise
function noise(x: number, y: number, seed: number) {
    const sin = Math.sin;
    const s = seed;
    return (
        sin(x * 0.04 + s) * 1.0 + 
        sin(y * 0.05 + s * 1.5) * 1.0 + 
        sin(x * 0.1 + y * 0.1 + s) * 0.5
    ) / 2.5; 
}

// --- Pathfinding (A*) ---

interface Node {
    x: number;
    y: number;
    f: number;
    g: number;
    h: number;
    parent: Node | null;
}

function heuristic(a: Point, b: Point) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findPath(start: Point, end: Point, map: TerrainType[][], cols: number, rows: number): Point[] {
    const startNode: Node = { x: start.x, y: start.y, f: 0, g: 0, h: 0, parent: null };
    const openSet: Node[] = [startNode];
    const closedSet = new Set<string>();
    
    // Safety limit to prevent freeze on complex maps
    let iterations = 0;
    const MAX_ITERATIONS = 3000;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        let lowInd = 0;
        for(let i=0; i<openSet.length; i++) {
            if(openSet[i].f < openSet[lowInd].f) { lowInd = i; }
        }
        let current = openSet[lowInd];

        if(Math.abs(current.x - end.x) <= 1 && Math.abs(current.y - end.y) <= 1) {
            const path: Point[] = [];
            let temp: Node | null = current;
            while(temp) {
                path.push({x: temp.x, y: temp.y});
                temp = temp.parent;
            }
            return path.reverse();
        }

        openSet.splice(lowInd, 1);
        closedSet.add(`${current.x},${current.y}`);

        const neighbors = [
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}
        ];

        for(let i=0; i<neighbors.length; i++) {
            const nx = current.x + neighbors[i].x;
            const ny = current.y + neighbors[i].y;

            if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            
            const terrain = map[ny][nx];
            if (terrain === TerrainType.WATER || terrain === TerrainType.MOUNTAIN) continue;
            
            if(closedSet.has(`${nx},${ny}`)) continue;

            const gScore = current.g + 1;
            let gScoreIsBest = false;
            let neighbor = openSet.find(n => n.x === nx && n.y === ny);

            if(!neighbor) {
                gScoreIsBest = true;
                neighbor = { x: nx, y: ny, f: 0, g: 0, h: 0, parent: null };
                openSet.push(neighbor);
            } else if (gScore < neighbor.g) {
                gScoreIsBest = true;
            }

            if(gScoreIsBest && neighbor) {
                neighbor.parent = current;
                neighbor.g = gScore;
                neighbor.h = heuristic({x:nx, y:ny}, end);
                neighbor.f = neighbor.g + neighbor.h;
            }
        }
    }
    return [];
}


// --- Game Classes ---

class Building {
    id: string;
    type: BuildingType;
    x: number;
    y: number;
    ownerBaseId: string;
    color: string;
    shootTimer: number = 0;
    
    constructor(id: string, type: BuildingType, x: number, y: number, ownerBaseId: string, color: string) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.ownerBaseId = ownerBaseId;
        this.color = color;
    }

    update(units: Unit[], createLaser: (x1: number, y1: number, x2: number, y2: number, color: string) => void) {
        // TOWER LOGIC
        if (this.type === BuildingType.TOWER) {
            this.shootTimer++;
            const fireRate = 50;
            const range = 120;
            
            if (this.shootTimer > fireRate) {
                let targetUnit: Unit | null = null;
                let minDist = range * range;
                
                for (const unit of units) {
                    if (!unit.dead && unit.color !== this.color) {
                        const dx = unit.x - this.x;
                        const dy = unit.y - this.y;
                        const d2 = dx*dx + dy*dy;
                        if (d2 < minDist) {
                            minDist = d2;
                            targetUnit = unit;
                        }
                    }
                }
                
                if (targetUnit) {
                    targetUnit.dead = true;
                    this.shootTimer = 0;
                    audioManager.playShoot();
                    createLaser(this.x, this.y - 15, targetUnit.x, targetUnit.y, this.color);
                }
            }
        } 
        // BARRACKS and HOUSE are passive or handled by Base/UI interaction
    }

    draw(ctx: CanvasRenderingContext2D) {
        const cx = this.x;
        const cy = this.y;
        
        ctx.save();
        ctx.translate(cx, cy);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(-8, 2, 16, 6);

        if (this.type === BuildingType.TOWER) {
             ctx.fillStyle = '#2d2d2d';
             ctx.fillRect(-6, -10, 12, 10);
             ctx.fillStyle = this.color;
             ctx.fillRect(-5, -18, 10, 8);
             ctx.fillStyle = '#000';
             ctx.fillRect(-3, -15, 6, 2);
             ctx.strokeStyle = '#888';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(0, -18); ctx.lineTo(0, -24);
             ctx.stroke();
             const t = Math.floor(Date.now() / 200) % 2;
             ctx.fillStyle = t === 0 ? '#FF0000' : '#550000';
             ctx.fillRect(-1, -25, 2, 2);

        } else if (this.type === BuildingType.BARRACKS) {
            ctx.fillStyle = '#3f3f3f';
            ctx.fillRect(-10, -8, 20, 8);
            ctx.fillStyle = this.color;
            ctx.fillRect(-8, -12, 16, 4);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-4, -6, 3, 6);
            ctx.fillRect(1, -6, 3, 6);
            // Swords Icon
            ctx.fillStyle = '#FFF';
            ctx.fillRect(-1, -15, 2, 2); 
            
        } else if (this.type === BuildingType.HOUSE) {
            // Little cottage
            ctx.fillStyle = '#C2C3C7'; // Walls
            ctx.fillRect(-7, -6, 14, 6);
            ctx.fillStyle = '#AB5236'; // Roof
            ctx.beginPath();
            ctx.moveTo(-9, -6);
            ctx.lineTo(0, -12);
            ctx.lineTo(9, -6);
            ctx.fill();
            // Door
            ctx.fillStyle = '#4B2D1F';
            ctx.fillRect(-2, -4, 4, 4);
        }

        ctx.restore();
    }
}

class Base {
  id: string;
  x: number;
  y: number;
  color: string;
  units: number;
  ownerType: OwnerType;
  radius: number;
  level: number;
  
  // Economy
  money: number = 0; // AI Wallet (Player uses global state)
  population: number;
  maxPopulation: number;
  popGrowTimer: number = 0;
  taxTimer: number = 0;
  hasBarracks: boolean = false;
  
  spawnTimer: number;
  visualPulse: number;
  territoryPath: Path2D | null = null;
  territoryCells: Point[] = []; // Store raw cells for AI decision making
  neighbors: Set<Base> = new Set();
  
  constructor(id: string, x: number, y: number, color: string, ownerType: OwnerType) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.ownerType = ownerType;
    this.radius = CONFIG.baseRadius;
    this.spawnTimer = 0;
    this.visualPulse = 0;
    this.level = 1;
    this.money = ECO.STARTING_MONEY; // Start with some funds
    
    // Initial Stats
    this.units = ownerType === OwnerType.NEUTRAL ? 5 : 10;
    this.population = 40; 
    this.maxPopulation = ECO.BASE_START_MAX_POP;
  }

  setTerritory(cells: Point[]) {
    this.territoryCells = cells;
    this.territoryPath = new Path2D();
    cells.forEach(cell => {
      this.territoryPath!.rect(cell.x, cell.y, CELL_SIZE, CELL_SIZE); 
    });
  }
  
  getUnitCap() {
      return Math.floor(this.population * ECO.UNIT_RATIO);
  }

  update(
    gameActive: boolean, 
    bases: Base[], 
    units: Unit[], 
    sendSquad: (source: Base, target: Base) => void,
    onIncome: (amount: number) => void
  ) {
    if (!gameActive) return;
    const unitCap = this.getUnitCap();

    if (this.ownerType !== OwnerType.NEUTRAL) {
      // 1. Natural Militia Spawn (Strictly capped by 10% rule)
      if (this.units < unitCap) {
        this.spawnTimer++;
        if (this.spawnTimer >= CONFIG.spawnRate) {
          this.units++;
          this.spawnTimer = 0;
        }
      }

      // 2. Population Growth (Slow & Steady)
      if (this.population < this.maxPopulation) {
          this.popGrowTimer++;
          if (this.popGrowTimer >= ECO.POP_GROWTH_RATE) {
              this.population++;
              this.popGrowTimer = 0;
          }
      }

      // 3. Tax Generation
      this.taxTimer++;
      if (this.taxTimer >= ECO.TAX_RATE) {
          this.taxTimer = 0;
          const income = Math.floor(this.population * ECO.TAX_PER_POP);
          if (income > 0) {
              if (this.ownerType === OwnerType.PLAYER) {
                  onIncome(income);
              } else {
                  this.money += income;
              }
          }
      }
    }

    // AI Logic: Recruit and Attack
    if (this.ownerType === OwnerType.AI) {
      
      // AI Recruiting (If has barracks and money)
      if (this.hasBarracks && this.units < unitCap && this.money >= COSTS.SOLDIER) {
          // AI Recruits if it has spare money or is under threat
          if (Math.random() < 0.05) { 
              this.money -= COSTS.SOLDIER;
              this.units++;
              this.visualPulse = 5;
          }
      }

      // AI Spends units to attack
      let aggression = 0.003;
      if (this.units > unitCap * 0.9) aggression = 0.01; // Aggressive if at cap

      if (Math.random() < aggression && this.units > 5) {
        const neighbors = Array.from(this.neighbors);
        if (neighbors.length > 0) {
            let target = neighbors.find(n => n.ownerType !== this.ownerType && n.units < this.units * 0.8); 
            if (!target) {
                target = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
            if (target) {
              sendSquad(this, target);
            }
        }
      }
    }

    if (this.visualPulse > 0) this.visualPulse--;
  }

  recalculateStats(buildings: Building[]) {
      // 1. Count Houses
      let houses = buildings.filter(b => b.ownerBaseId === this.id && b.type === BuildingType.HOUSE).length;
      this.hasBarracks = buildings.some(b => b.ownerBaseId === this.id && b.type === BuildingType.BARRACKS);

      // 2. Determine Level
      if (houses >= LEVEL_THRESHOLDS.LVL_6) this.level = 6;
      else if (houses >= LEVEL_THRESHOLDS.LVL_5) this.level = 5;
      else if (houses >= LEVEL_THRESHOLDS.LVL_4) this.level = 4;
      else if (houses >= LEVEL_THRESHOLDS.LVL_3) this.level = 3;
      else if (houses >= LEVEL_THRESHOLDS.LVL_2) this.level = 2;
      else this.level = 1;

      // 3. Calculate Max Pop CAP (Population grows towards this, doesn't jump)
      const levelBonus = (this.level - 1) * ECO.POP_PER_LEVEL;
      const houseBonus = houses * ECO.POP_PER_HOUSE;
      this.maxPopulation = ECO.BASE_START_MAX_POP + levelBonus + houseBonus;
  }

  drawTerritory(ctx: CanvasRenderingContext2D, isHighlight: boolean) {
    if (!this.territoryPath) return;
    
    let topColor = this.ownerType === OwnerType.NEUTRAL ? 'transparent' : this.color;
    
    if (this.ownerType !== OwnerType.NEUTRAL) {
       ctx.save();
       ctx.globalAlpha = 0.3; 
       if (isHighlight) ctx.globalAlpha = 0.5;
       
       ctx.fillStyle = topColor;
       ctx.fill(this.territoryPath);
       
       ctx.strokeStyle = 'rgba(0,0,0,0.1)';
       ctx.lineWidth = 0.5;
       ctx.stroke(this.territoryPath);

       ctx.restore();
       
       ctx.lineWidth = 1;
       ctx.strokeStyle = adjustColor(topColor, 60);
       ctx.globalAlpha = 0.7;
       ctx.stroke(this.territoryPath);
       ctx.globalAlpha = 1.0;
    }
    
    if (isHighlight && this.ownerType === OwnerType.NEUTRAL) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill(this.territoryPath);
    }
  }

  drawStructure(ctx: CanvasRenderingContext2D, isSelected: boolean) {
    const cx = this.x;
    const cy = this.y - 10;
    const baseColor = this.color;
    const scale = 1 + (this.visualPulse / 15);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Dynamic Castle Graphics based on Level
    const lvl = this.ownerType === OwnerType.NEUTRAL ? 1 : this.level;

    // Common Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-14, 6, 28, 8);

    if (lvl === 1) {
        // Outpost
        ctx.fillStyle = '#475569'; ctx.fillRect(-8, -6, 16, 14); // Body
        ctx.fillStyle = baseColor; ctx.fillRect(-8, -8, 16, 2); // Roof line
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-3, 0, 6, 8); // Door
    } else if (lvl === 2) {
        // Fort
        ctx.fillStyle = '#475569'; ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = baseColor; ctx.fillRect(-12, -10, 4, 6); // Left Turret
        ctx.fillStyle = baseColor; ctx.fillRect(8, -10, 4, 6); // Right Turret
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-4, 0, 8, 8);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-8, -4, 4, 4); // Windows
        ctx.fillStyle = '#1e293b'; ctx.fillRect(4, -4, 4, 4);
    } else if (lvl === 3) {
        // Keep
        ctx.fillStyle = '#475569'; ctx.fillRect(-12, -8, 24, 16);
        ctx.fillStyle = '#334155'; ctx.fillRect(-6, -16, 12, 8); // Central Tower
        ctx.fillStyle = baseColor; ctx.fillRect(-8, -20, 16, 4); // Tower Roof
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-4, 2, 8, 6);
    } else if (lvl === 4) {
        // Castle
        ctx.fillStyle = '#475569'; ctx.fillRect(-14, -8, 28, 16);
        ctx.fillStyle = '#334155'; ctx.fillRect(-14, -18, 8, 10); // L Tower
        ctx.fillStyle = '#334155'; ctx.fillRect(6, -18, 8, 10); // R Tower
        ctx.fillStyle = baseColor; ctx.fillRect(-16, -22, 12, 6); // L Roof
        ctx.fillStyle = baseColor; ctx.fillRect(4, -22, 12, 6); // R Roof
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-5, 0, 10, 8);
    } else if (lvl === 5) {
        // Fortress
        ctx.fillStyle = '#475569'; ctx.fillRect(-16, -10, 32, 18);
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-10, -24, 20, 14); // Keep
        ctx.fillStyle = baseColor; ctx.fillRect(-12, -28, 24, 6); // Keep Roof
        ctx.fillStyle = baseColor; ctx.fillRect(-18, -14, 6, 8); // Side deco
        ctx.fillStyle = baseColor; ctx.fillRect(12, -14, 6, 8);
        ctx.fillStyle = '#FFEC27'; ctx.fillRect(-2, -32, 4, 4); // Gold Top
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-6, 0, 12, 10);
    } else {
        // Palace (Level 6)
        ctx.fillStyle = '#1e293b'; ctx.fillRect(-18, -12, 36, 20); // Darker base
        ctx.fillStyle = '#475569'; ctx.fillRect(-12, -28, 24, 16); // High Keep
        ctx.fillStyle = baseColor; ctx.fillRect(-20, -16, 8, 12); // L Wing
        ctx.fillStyle = baseColor; ctx.fillRect(12, -16, 8, 12); // R Wing
        ctx.fillStyle = '#FFEC27'; ctx.fillRect(-14, -34, 28, 6); // Gold Roof
        ctx.fillStyle = '#FFEC27'; ctx.fillRect(-2, -40, 4, 8); // Spire
        ctx.fillStyle = '#0F172A'; ctx.fillRect(-6, 2, 12, 6); // Grand Gate
        // Banners
        ctx.fillStyle = baseColor; ctx.fillRect(-22, -20, 4, 8);
        ctx.fillStyle = baseColor; ctx.fillRect(18, -20, 4, 8);
    }

    // Flag logic (Waving)
    if (this.ownerType !== OwnerType.NEUTRAL) {
        const wave = Math.floor(Date.now() / 200) % 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, lvl >= 5 ? -44 : lvl >= 3 ? -30 : -20, 2, 8);
        ctx.fillStyle = baseColor;
        ctx.fillRect(1, (lvl >= 5 ? -44 : lvl >= 3 ? -30 : -20) + (wave ? 1 : 0), 6, 4);
    }

    // Badges
    ctx.save();
    ctx.translate(0, lvl >= 5 ? -50 : lvl >= 3 ? -38 : -28); 
    ctx.scale(1/scale, 1/scale);
    
    // Unit Count
    const countStr = Math.floor(this.units).toString();
    ctx.font = '12px "Press Start 2P"';
    const textWidth = ctx.measureText(countStr).width;
    const boxW = Math.max(20, textWidth + 8);
    
    // Unit Cap Warning Color
    const unitCap = this.getUnitCap();
    const isAtCap = this.units >= unitCap;

    ctx.fillStyle = isAtCap ? '#FF004D' : '#000';
    ctx.fillRect(-boxW/2, -10, boxW, 20);
    ctx.fillStyle = '#fff'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countStr, 0, 2);

    // Pop Count
    if (this.ownerType !== OwnerType.NEUTRAL) {
        ctx.font = '8px "Press Start 2P"';
        const popStr = `人:${this.population}`;
        ctx.fillStyle = '#1D2B53';
        ctx.fillRect(-boxW/2, -22, boxW, 10);
        ctx.fillStyle = '#29ADFF';
        ctx.fillText(popStr, 0, -17);
    }

    ctx.restore(); 
    ctx.restore(); 

    if (isSelected) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, -10, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

class Unit {
  x: number;
  y: number;
  target: Base;
  color: string;
  speed: number;
  path: Point[] = [];
  pathIndex: number = 0;
  dead: boolean;
  spawnTime: number;
  walkFrame: number;
  offsetX: number;
  offsetY: number;

  constructor(source: Base, target: Base, color: string, path: Point[], offset: Point) {
    this.x = source.x + offset.x;
    this.y = source.y + offset.y;
    this.target = target;
    this.color = color;
    this.path = path;
    this.speed = CONFIG.unitSpeed; 
    this.dead = false;
    this.spawnTime = Date.now();
    this.walkFrame = Math.random() * 10;
    this.offsetX = offset.x;
    this.offsetY = offset.y;
  }

  update(createExplosion: (x: number, y: number, color: string) => void, onCapture: (base: Base, newColor: string) => void) {
    if (this.dead) return;
    this.walkFrame += 0.2;

    if (this.pathIndex < this.path.length) {
        const targetPoint = this.path[this.pathIndex];
        const tx = targetPoint.x * CELL_SIZE + CELL_SIZE/2 + this.offsetX * 0.5;
        const ty = targetPoint.y * CELL_SIZE + CELL_SIZE/2 + this.offsetY * 0.5;
        
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
            this.pathIndex++;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    } else {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 10) {
            this.hitTarget(createExplosion, onCapture);
        } else {
             this.x += (dx / dist) * this.speed;
             this.y += (dy / dist) * this.speed;
        }
    }
  }

  hitTarget(createExplosion: (x: number, y: number, color: string) => void, onCapture: (base: Base, newColor: string) => void) {
    this.dead = true;
    createExplosion(this.x, this.y, this.color);
    audioManager.playExplosion();

    if (this.target.color === this.color) {
      this.target.units++;
    } else {
      this.target.units -= 1;
      if (this.target.units <= 0) {
        this.target.ownerType = getOwnerTypeByColor(this.color);
        this.target.color = this.color;
        this.target.units = 1;
        this.target.visualPulse = 20;
        // Reset economy on capture
        this.target.population = 40; // Reset pop
        this.target.level = 1;
        this.target.maxPopulation = ECO.BASE_START_MAX_POP; 
        this.target.money = 0; // Seize the coffers (or empty them)
        audioManager.playCapture();
        onCapture(this.target, this.color);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    let vx = 0;
    if (this.pathIndex < this.path.length) {
         const targetPoint = this.path[this.pathIndex];
         vx = (targetPoint.x * CELL_SIZE + CELL_SIZE/2) - this.x;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (vx < 0) ctx.scale(-1, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-2, 3, 5, 2);

    const step = Math.floor(this.walkFrame) % 4; 
    ctx.fillStyle = '#222';
    if (step === 0 || step === 2) {
        ctx.fillRect(-1, 0, 2, 5); 
    } else if (step === 1) {
        ctx.fillRect(-2, 0, 2, 4); 
        ctx.fillRect(1, 0, 2, 4); 
    } else {
        ctx.fillRect(0, 0, 2, 4); 
    }

    ctx.fillStyle = this.color;
    ctx.fillRect(-2, -5, 5, 5);
    ctx.fillStyle = adjustColor(this.color, 40);
    ctx.fillRect(-1, -7, 4, 3);
    ctx.fillStyle = '#111';
    ctx.fillRect(1, -3, 5, 2);

    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  z: number;
  color: string;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number = 0.5;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.z = 5;
    this.color = color;
    this.life = 1.0;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.vz = Math.random() * 3 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.vz -= this.gravity;
    if (this.z < 0) {
        this.z = 0;
        this.vz *= -0.5;
        this.vx *= 0.8;
        this.vy *= 0.8;
    }
    this.life -= 0.05;
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    const size = 3;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - size/2, (this.y - this.z) - size/2, size, size);
  }
}

class Laser {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    life: number;
    constructor(x1: number, y1: number, x2: number, y2: number, color: string) {
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; this.color = color; this.life = 1.0;
    }
    update() { this.life -= 0.1; }
    draw(ctx: CanvasRenderingContext2D) {
        if (this.life <= 0) return;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }
}

// --- Component ---

const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(({
  gameStatus,
  playerMoney,
  setPlayerMoney,
  onGameOver,
  triggerRestart,
  onSelectionChange,
  onCancelBuild,
  onAddLog
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const basesRef = useRef<Base[]>([]);
  const unitsRef = useRef<Unit[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  const terrainMapRef = useRef<TerrainType[][]>([]);
  const mapColsRef = useRef<number>(0);
  const mapRowsRef = useRef<number>(0);
  
  const selectedBaseRef = useRef<Base | null>(null);
  const dragStartBaseRef = useRef<Base | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const buildModeRef = useRef<BuildingType | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  
  const prevSizeRef = useRef<{w: number, h: number}>({w: 0, h: 0});
  const moneyRef = useRef(playerMoney);

  // Sync ref with prop
  useEffect(() => {
      moneyRef.current = playerMoney;
  }, [playerMoney]);

  useImperativeHandle(ref, () => ({
    setBuildMode: (type: BuildingType | null) => {
        buildModeRef.current = type;
    },
    recruitUnit: () => {
        const sb = selectedBaseRef.current;
        if (sb && sb.ownerType === OwnerType.PLAYER) {
            const unitCap = sb.getUnitCap();
            if (sb.units >= unitCap) {
                onAddLog(`征兵失败: 兵力已达人口上限 (${unitCap})`, '#FF004D');
                return;
            }

            if (moneyRef.current >= COSTS.SOLDIER) {
                const newMoney = moneyRef.current - COSTS.SOLDIER;
                setPlayerMoney(newMoney);
                moneyRef.current = newMoney;
                sb.units++;
                sb.visualPulse = 5;
                reportSelection(sb);
            }
        }
    }
  }));

  const reportSelection = (base: Base | null) => {
      if (base) {
          const hasBarracks = buildingsRef.current.some(b => b.ownerBaseId === base.id && b.type === BuildingType.BARRACKS);
          onSelectionChange({
              id: base.id,
              units: Math.floor(base.units),
              population: base.population,
              maxPopulation: base.maxPopulation,
              level: base.level,
              unitCap: base.getUnitCap(),
              isMine: base.ownerType === OwnerType.PLAYER,
              hasBarracks
          });
      } else {
          onSelectionChange(null);
      }
  };

  const generateTerrain = (cols: number, rows: number) => {
      let map: TerrainType[][] = [];
      const seed = Math.random() * 1000;

      // 1. Initial Noise Generation
      for (let y = 0; y < rows; y++) {
          const row: TerrainType[] = [];
          for (let x = 0; x < cols; x++) {
              const nx = x;
              const ny = y;
              const n = noise(nx, ny, seed);
              
              let type = TerrainType.WATER;
              if (n < -0.4) type = TerrainType.WATER;     
              else if (n < -0.3) type = TerrainType.SAND; 
              else if (n < 0.2) type = TerrainType.GRASS; 
              else if (n < 0.5) type = TerrainType.FOREST;
              else if (n < 0.7) type = TerrainType.HILL;  
              else type = TerrainType.MOUNTAIN;           

              row.push(type);
          }
          map.push(row);
      }

      // 2. Cellular Automata Smoothing (Cleanup lonely pixels)
      for (let i = 0; i < 2; i++) {
          const newMap = JSON.parse(JSON.stringify(map));
          for (let y = 1; y < rows - 1; y++) {
              for (let x = 1; x < cols - 1; x++) {
                  let waterCount = 0;
                  // Check 8 neighbors
                  for (let dy = -1; dy <= 1; dy++) {
                      for (let dx = -1; dx <= 1; dx++) {
                          if (map[y+dy][x+dx] === TerrainType.WATER) waterCount++;
                      }
                  }
                  
                  // Rule: Surrounded by water -> Become water
                  if (map[y][x] !== TerrainType.WATER && waterCount >= 6) {
                      newMap[y][x] = TerrainType.WATER;
                  } 
                  // Rule: Surrounded by land -> Become land
                  else if (map[y][x] === TerrainType.WATER && waterCount <= 2) {
                       newMap[y][x] = TerrainType.GRASS;
                  }
              }
          }
          map = newMap;
      }
      
      // 3. Borders
      for(let y=0; y<rows; y++) {
          map[y][0] = TerrainType.WATER;
          map[y][cols-1] = TerrainType.WATER;
      }
      for(let x=0; x<cols; x++) {
          map[0][x] = TerrainType.WATER;
          map[rows-1][x] = TerrainType.WATER;
      }

      terrainMapRef.current = map;
      mapColsRef.current = cols;
      mapRowsRef.current = rows;
  };

  const drawTerrainToStaticCanvas = (width: number, height: number, cols: number, rows: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const map = terrainMapRef.current;
      
      // 1. Fill Deep Ocean Background
      ctx.fillStyle = COLORS.TERRAIN_WATER;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Cells
      for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
              const type = map[y]?.[x] || TerrainType.WATER;
              const posX = x * CELL_SIZE;
              const posY = y * CELL_SIZE;

              // --- Water & Coastline Logic ---
              if (type === TerrainType.WATER) {
                  // Check neighbors for coastline effect
                  let isCoast = false;
                  const neighbors = [[0,-1], [0,1], [-1,0], [1,0]]; // Up, Down, Left, Right
                  for(const [dx, dy] of neighbors) {
                      const ny = y + dy;
                      const nx = x + dx;
                      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                          if (map[ny][nx] !== TerrainType.WATER) {
                              isCoast = true;
                              break;
                          }
                      }
                  }
                  if (isCoast) {
                      ctx.fillStyle = COLORS.TERRAIN_WATER_SHALLOW;
                      ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);
                  }
                  continue; 
              }

              // --- Land Drawing ---
              let color = COLORS.TERRAIN_GRASS;
              if (type === TerrainType.SAND) color = COLORS.TERRAIN_SAND;
              else if (type === TerrainType.FOREST) color = COLORS.TERRAIN_FOREST;
              else if (type === TerrainType.HILL) color = COLORS.TERRAIN_HILL;
              else if (type === TerrainType.MOUNTAIN) color = COLORS.TERRAIN_MOUNTAIN;
              
              ctx.fillStyle = color;
              ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);
              
              // --- Organic Texture Details (No more grid lines) ---
              // Use pseudo-random deterministic noise based on coordinates
              const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
              const rand = seed - Math.floor(seed);

              if (type === TerrainType.GRASS) {
                  // Sparse noise for grass
                  if (rand > 0.85) {
                      ctx.fillStyle = 'rgba(0,0,0,0.08)';
                      ctx.fillRect(posX + 2, posY + 2, 2, 2);
                  }
              } else if (type === TerrainType.FOREST) {
                  // Tree Clusters (Darker green organic shapes)
                  ctx.fillStyle = '#003a28'; 
                  if (rand > 0.5) {
                      // Shape A: Tall Tree
                      ctx.fillRect(posX + 3, posY + 1, 2, 5);
                      ctx.fillRect(posX + 1, posY + 3, 6, 2);
                  } else {
                      // Shape B: Bushy Cluster
                      ctx.fillRect(posX + 1, posY + 1, 3, 3);
                      ctx.fillRect(posX + 4, posY + 4, 3, 3);
                  }
              } else if (type === TerrainType.HILL) {
                  // Mounds
                  ctx.fillStyle = 'rgba(0,0,0,0.15)';
                  ctx.fillRect(posX + 2, posY + 4, 4, 2);
                  ctx.fillStyle = 'rgba(255,255,255,0.05)';
                  ctx.fillRect(posX + 2, posY + 2, 2, 2);
              } else if (type === TerrainType.MOUNTAIN) {
                  // Snow Peaks
                  ctx.fillStyle = COLORS.TERRAIN_MOUNTAIN_PEAK;
                  ctx.fillRect(posX + 2, posY + 1, 4, 3);
                  // Rocky Shadow
                  ctx.fillStyle = 'rgba(0,0,0,0.3)';
                  ctx.fillRect(posX + 4, posY + 3, 2, 5);
              } else if (type === TerrainType.SAND) {
                   if (rand > 0.7) {
                      ctx.fillStyle = '#ccbb22';
                      ctx.fillRect(posX + 4, posY + 4, 2, 2);
                   }
              }
          }
      }
      terrainCanvasRef.current = canvas;
  };

  const initLevel = (width: number, height: number) => {
    basesRef.current = [];
    unitsRef.current = [];
    buildingsRef.current = [];
    particlesRef.current = [];
    lasersRef.current = [];
    selectedBaseRef.current = null;
    buildModeRef.current = null;
    reportSelection(null);

    const cols = Math.ceil(width / CELL_SIZE);
    const rows = Math.ceil(height / CELL_SIZE);
    
    generateTerrain(cols, rows);
    drawTerrainToStaticCanvas(width, height, cols, rows);

    const isSmallScreen = width < 600 || height < 600;
    const targetCount = isSmallScreen ? 8 : 15; 
    
    const validPositions: Point[] = [];
    const marginX = 50;
    const marginY = 60;
    const safeWidth = Math.max(100, width - marginX * 2);
    const safeHeight = Math.max(100, height - marginY * 2);

    let attempts = 0;
    while (validPositions.length < targetCount && attempts < 1000) {
         attempts++;
         const px = marginX + Math.random() * safeWidth;
         const py = marginY + Math.random() * safeHeight;

         const tx = Math.floor(px / CELL_SIZE);
         const ty = Math.floor(py / CELL_SIZE);
         
         if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) {
             const type = terrainMapRef.current[ty][tx];
             if (type === TerrainType.GRASS || type === TerrainType.FOREST || type === TerrainType.HILL) {
                  let tooClose = false;
                  for (const p of validPositions) {
                      if ((px - p.x)**2 + (py - p.y)**2 < 8000) {
                          tooClose = true;
                          break;
                      }
                  }
                  if (!tooClose) validPositions.push({ x: px, y: py });
             }
         }
    }

    if (validPositions.length === 0) return;

    // Player
    const pPos = validPositions.pop()!;
    const playerBase = new Base('player-1', pPos.x, pPos.y, COLORS.PLAYER, OwnerType.PLAYER);
    // Player starts with better population to allow initial army
    playerBase.population = 150; 
    playerBase.units = 10;
    basesRef.current.push(playerBase);

    // Enemies
    const enemyColors = [COLORS.ENEMY_1, COLORS.ENEMY_2, COLORS.ENEMY_3, COLORS.ENEMY_4];
    const numEnemies = Math.min(4, Math.ceil(validPositions.length / 3));

    for (let i = 0; i < numEnemies; i++) {
        if (validPositions.length === 0) break;
        const pos = validPositions.pop()!;
        const b = new Base(`enemy-${i}`, pos.x, pos.y, enemyColors[i % enemyColors.length], OwnerType.AI);
        b.population = 150;
        b.units = 10;
        basesRef.current.push(b);
    }

    // Neutrals
    let nIdx = 0;
    while (validPositions.length > 0) {
      const pos = validPositions.pop()!;
      const b = new Base(`neutral-${nIdx++}`, pos.x, pos.y, COLORS.NEUTRAL, OwnerType.NEUTRAL);
      b.units = 5 + Math.floor(Math.random() * 5);
      basesRef.current.push(b);
    }

    const baseCells: Point[][] = basesRef.current.map(() => []);
    const cellOwnerMap = new Map<string, Base>();

    for (let y = 0; y < height; y += CELL_SIZE) {
      for (let x = 0; x < width; x += CELL_SIZE) {
        let closestDist = Infinity;
        let closestBaseIndex = -1;
        const cx = x + CELL_SIZE / 2;
        const cy = y + CELL_SIZE / 2;

        for (let i = 0; i < basesRef.current.length; i++) {
          const b = basesRef.current[i];
          const d2 = (b.x - cx)**2 + (b.y - cy)**2;
          if (d2 < closestDist) {
            closestDist = d2;
            closestBaseIndex = i;
          }
        }
        if (closestBaseIndex !== -1) {
          baseCells[closestBaseIndex].push({x, y});
          cellOwnerMap.set(`${x},${y}`, basesRef.current[closestBaseIndex]);
        }
      }
    }

    basesRef.current.forEach((base, index) => {
      base.setTerritory(baseCells[index]);
    });

    const directions = [{x: CELL_SIZE, y: 0}, {x: -CELL_SIZE, y: 0}, {x: 0, y: CELL_SIZE}, {x: 0, y: -CELL_SIZE}];
    baseCells.forEach((cells, index) => {
        const currentBase = basesRef.current[index];
        const sampleRate = 5;
        for(let i=0; i<cells.length; i+=sampleRate) {
            const p = cells[i];
            directions.forEach(d => {
                const neighborBase = cellOwnerMap.get(`${p.x + d.x},${p.y + d.y}`);
                if (neighborBase && neighborBase !== currentBase) {
                    currentBase.neighbors.add(neighborBase);
                    neighborBase.neighbors.add(currentBase);
                }
            });
        }
    });
    
    onAddLog("系统启动: 战争规则更新。", COLORS.GOLD);
  };

  const processAIConstruction = () => {
      basesRef.current.forEach(base => {
          if (base.ownerType !== OwnerType.AI) return;
          
          // Only attempt build occasionally
          if (Math.random() > 0.02) return;

          let targetType: BuildingType | null = null;
          let cost = 0;

          const unitCap = base.getUnitCap();
          
          // AI Logic 1: If nearing pop cap -> Build House
          if (base.population >= base.maxPopulation - 10 && base.money >= COSTS.HOUSE) {
              targetType = BuildingType.HOUSE;
              cost = COSTS.HOUSE;
          }
          // AI Logic 2: If no barracks -> Build Barracks
          else if (!base.hasBarracks && base.money >= COSTS.BARRACKS) {
              targetType = BuildingType.BARRACKS;
              cost = COSTS.BARRACKS;
          }
          // AI Logic 3: Rich -> Build Tower or Barracks randomly
          else if (base.money > 500) {
              if (Math.random() < 0.5 && base.money >= COSTS.TOWER) {
                  targetType = BuildingType.TOWER;
                  cost = COSTS.TOWER;
              } else if (base.money >= COSTS.BARRACKS) {
                  targetType = BuildingType.BARRACKS;
                  cost = COSTS.BARRACKS;
              }
          }

          if (targetType) {
              // Find valid spot
              // Scan raw territory cells
              const cells = base.territoryCells;
              // Shuffle cells to find random spot
              const candidates = [];
              for(let i=0; i<10; i++) {
                   candidates.push(cells[Math.floor(Math.random() * cells.length)]);
              }

              for (const cell of candidates) {
                  const tx = Math.floor(cell.x / CELL_SIZE);
                  const ty = Math.floor(cell.y / CELL_SIZE);
                  
                  // Check terrain
                  const t = terrainMapRef.current[ty]?.[tx];
                  let isValidTerrain = false;
                  if (targetType === BuildingType.HOUSE || targetType === BuildingType.BARRACKS) {
                      isValidTerrain = (t === TerrainType.GRASS || t === TerrainType.FOREST);
                  } else if (targetType === BuildingType.TOWER) {
                      isValidTerrain = (t === TerrainType.HILL);
                  }
                  
                  if (!isValidTerrain) continue;

                  // Check Collision
                  const cx = cell.x;
                  const cy = cell.y;
                  
                  // Check dist from base center
                  if ((cx - base.x)**2 + (cy - base.y)**2 < (base.radius + 15)**2) continue;

                  // Check buildings
                  let isColliding = false;
                  for (const b of buildingsRef.current) {
                      if ((cx - b.x)**2 + (cy - b.y)**2 < (BUILDING_RADIUS * 2.5)**2) {
                          isColliding = true; 
                          break;
                      }
                  }
                  if (isColliding) continue;

                  // Build it!
                  base.money -= cost;
                  buildingsRef.current.push(new Building(
                      `ai-build-${Date.now()}-${Math.random()}`,
                      targetType,
                      cx,
                      cy,
                      base.id,
                      base.color
                  ));
                  base.recalculateStats(buildingsRef.current);
                  break; // Built one, stop
              }
          }
      });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;

    const handleResize = () => {
        const rect = canvas.getBoundingClientRect();
        const oldW = prevSizeRef.current.w;
        const oldH = prevSizeRef.current.h;
        if (Math.abs(rect.width - oldW) < 50 && Math.abs(rect.height - oldH) < 50) return; 

        prevSizeRef.current = { w: rect.width, h: rect.height };
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;
        initLevel(rect.width, rect.height);
    };

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
        prevSizeRef.current = { w: rect.width, h: rect.height };
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        ctx.imageSmoothingEnabled = false;
        initLevel(rect.width, rect.height);
    }
    
    window.addEventListener('resize', handleResize);

    const createExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 6; i++) particlesRef.current.push(new Particle(x, y, color));
    };
    
    const createLaser = (x1: number, y1: number, x2: number, y2: number, color: string) => {
        lasersRef.current.push(new Laser(x1, y1, x2, y2, color));
    }
    
    const onBaseCaptured = (base: Base, newColor: string) => {
        const ownerName = getOwnerName(base.ownerType, newColor);
        onAddLog(`战报: ${base.id} 被 ${ownerName} 占领！建筑已尽毁。`, newColor);
        
        // Scorched Earth: Remove ALL buildings belonging to this base
        // Filter OUT buildings that belong to this base ID
        const oldBuildingCount = buildingsRef.current.length;
        buildingsRef.current = buildingsRef.current.filter(b => b.ownerBaseId !== base.id);
        const destroyed = oldBuildingCount - buildingsRef.current.length;
        
        if (destroyed > 0) {
             createExplosion(base.x, base.y + 20, '#555');
        }

        // Recalculate will reset level to 1 since buildings are gone
        base.recalculateStats(buildingsRef.current);
    };
    
    const onIncome = (amount: number) => {
        const newTotal = moneyRef.current + amount;
        moneyRef.current = newTotal;
        setPlayerMoney(newTotal); // Sync to UI
    };

    const sendSquad = (source: Base, target: Base) => {
      if (!source.neighbors.has(target)) return;
      if (source.units < 4) return;

      const startGrid = { x: Math.floor(source.x / CELL_SIZE), y: Math.floor(source.y / CELL_SIZE) };
      const endGrid = { x: Math.floor(target.x / CELL_SIZE), y: Math.floor(target.y / CELL_SIZE) };
      
      const path = findPath(startGrid, endGrid, terrainMapRef.current, mapColsRef.current, mapRowsRef.current);
      
      if (path.length === 0) {
          if (source.ownerType === OwnerType.PLAYER) {
              onAddLog("警告: 无法到达目标！地形受阻。", "#FF0000");
          }
          return;
      }

      const squadSize = 3;
      if (source.units < squadSize + 1) return;

      source.units -= squadSize;
      
      if(source.ownerType === OwnerType.PLAYER) {
        onAddLog(`出征: 兵团前往 ${target.id}`, COLORS.PLAYER);
      }

      const offsets = [ {x: 0, y: 0}, {x: -4, y: 4}, {x: 4, y: 4} ];
      for (let i = 0; i < squadSize; i++) {
        if (unitsRef.current)
            unitsRef.current.push(new Unit(source, target!, source.color, path, offsets[i]));
      }
      reportSelection(selectedBaseRef.current);
    };

    let tick = 0;
    const render = () => {
      tick++;
      if (!ctx || !canvas) return;
      
      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;
      
      if (terrainCanvasRef.current) {
          ctx.drawImage(terrainCanvasRef.current, 0, 0, logicalWidth, logicalHeight);
      } else {
           ctx.fillStyle = COLORS.TERRAIN_WATER;
           ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      }

      if (gameStatus === GameStatus.PLAYING) {
          const playerBases = basesRef.current.filter(b => b.ownerType === OwnerType.PLAYER).length;
          const enemyBases = basesRef.current.filter(b => b.ownerType === OwnerType.AI).length;
          if (playerBases > 0 && enemyBases === 0) onGameOver(true);
          else if (playerBases === 0 && enemyBases > 0) onGameOver(false);
          
          if (tick % 10 === 0 && selectedBaseRef.current) {
              reportSelection(selectedBaseRef.current);
          }

          // Run AI Construction Loop occasionally
          if (tick % 30 === 0) {
              processAIConstruction();
          }
      }

      const sortedBases = [...basesRef.current].sort((a,b) => a.y - b.y);

      sortedBases.forEach((base) => {
        if (gameStatus === GameStatus.PLAYING) {
             base.update(true, basesRef.current, unitsRef.current, sendSquad, onIncome);
        }
        const isHighlight = buildModeRef.current && selectedBaseRef.current?.id === base.id;
        base.drawTerritory(ctx, !!isHighlight);
      });

      buildingsRef.current.forEach(b => {
          const ownerBase = basesRef.current.find(base => base.id === b.ownerBaseId);
          if (ownerBase && ownerBase.color !== b.color) {
              // Ownership check handled in onBaseCaptured, this is a double check
              // or for visual consistency. But logic is now: clear on capture.
          } else if (ownerBase) {
              b.update(unitsRef.current, createLaser);
          }
      });
      buildingsRef.current = buildingsRef.current.filter(b => b.type);

      // Recalculate caps periodically
      if (tick % 30 === 0) {
          basesRef.current.forEach(b => b.recalculateStats(buildingsRef.current));
      }

      if (isDraggingRef.current && dragStartBaseRef.current) {
        const start = dragStartBaseRef.current;
        const mouse = mousePosRef.current;
        
        let hoveringBase: Base | null = null;
        let minD = Infinity;
        const snapRange = 40; 
        
        basesRef.current.forEach(base => {
            const d = (mouse.x - base.x)**2 + (mouse.y - (base.y - 10))**2;
            if (d < (base.radius + snapRange)**2 && d < minD) {
                minD = d;
                hoveringBase = base;
            }
        });

        const isValidTarget = hoveringBase && start.neighbors.has(hoveringBase);
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y - 15);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = isValidTarget ? '#FFF' : '#FF004D'; 
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (buildModeRef.current && selectedBaseRef.current) {
         const mouse = mousePosRef.current;
         const sb = selectedBaseRef.current;
         
         const tx = Math.floor(mouse.x / CELL_SIZE);
         const ty = Math.floor(mouse.y / CELL_SIZE);
         let isValidTerrain = false;

         if (terrainMapRef.current[ty] && terrainMapRef.current[ty][tx]) {
             const t = terrainMapRef.current[ty][tx];
             if (buildModeRef.current === BuildingType.BARRACKS || buildModeRef.current === BuildingType.HOUSE) {
                 isValidTerrain = (t === TerrainType.GRASS || t === TerrainType.FOREST);
             } else if (buildModeRef.current === BuildingType.TOWER) {
                 isValidTerrain = (t === TerrainType.HILL);
             }
         }

         let isInsideTerritory = false;
         if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, mouse.x, mouse.y)) {
             isInsideTerritory = true;
         }

         let isColliding = false;
         basesRef.current.forEach(b => {
            if ((mouse.x - b.x)**2 + (mouse.y - b.y)**2 < (b.radius + 10)**2) isColliding = true;
         });
         buildingsRef.current.forEach(b => {
             if ((mouse.x - b.x)**2 + (mouse.y - b.y)**2 < (BUILDING_RADIUS * 2)**2) isColliding = true;
         });

         const canBuild = isValidTerrain && isInsideTerritory && !isColliding;

         ctx.save();
         ctx.translate(mouse.x, mouse.y);
         ctx.fillStyle = canBuild ? 'rgba(0, 228, 54, 0.5)' : 'rgba(255, 0, 77, 0.5)';
         ctx.fillRect(-10, -10, 20, 20); 
         ctx.restore();
      }

      const renderables: {y: number, draw: () => void}[] = [];

      sortedBases.forEach(base => {
          const isSelected = base === selectedBaseRef.current;
          renderables.push({
              y: base.y,
              draw: () => base.drawStructure(ctx, isSelected)
          });
      });

      buildingsRef.current.forEach(b => {
          renderables.push({ y: b.y, draw: () => b.draw(ctx) });
      });

      unitsRef.current.forEach(u => renderables.push({ y: u.y, draw: () => u.draw(ctx) }));
      particlesRef.current.forEach(p => renderables.push({ y: p.y, draw: () => p.draw(ctx) }));
      lasersRef.current.forEach(l => renderables.push({ y: Math.max(l.y1, l.y2), draw: () => l.draw(ctx) }));

      renderables.sort((a, b) => a.y - b.y);
      renderables.forEach(r => r.draw());

      for (let i = unitsRef.current.length - 1; i >= 0; i--) {
        const u = unitsRef.current[i];
        if (gameStatus === GameStatus.PLAYING) u.update(createExplosion, onBaseCaptured);
        if (u.dead) unitsRef.current.splice(i, 1);
      }
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update();
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
          const l = lasersRef.current[i];
          l.update();
          if (l.life <= 0) lasersRef.current.splice(i, 1);
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [gameStatus, triggerRestart]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    if ('touches' in e) {
        const touch = e.touches[0];
        if(!touch) return mousePosRef.current;
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    } else {
        const mouseEvent = e as React.MouseEvent;
        const rect = (mouseEvent.target as HTMLElement).getBoundingClientRect();
        return { x: mouseEvent.clientX - rect.left, y: mouseEvent.clientY - rect.top };
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameStatus !== GameStatus.PLAYING) return;
    const pos = getPos(e);
    mousePosRef.current = pos;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d'); 

    // BUILD MODE CLICK
    if (buildModeRef.current && selectedBaseRef.current && ctx) {
        const sb = selectedBaseRef.current;
        
        let cost = 0;
        if (buildModeRef.current === BuildingType.HOUSE) cost = COSTS.HOUSE;
        else if (buildModeRef.current === BuildingType.TOWER) cost = COSTS.TOWER;
        else if (buildModeRef.current === BuildingType.BARRACKS) cost = COSTS.BARRACKS;

        const tx = Math.floor(pos.x / CELL_SIZE);
        const ty = Math.floor(pos.y / CELL_SIZE);
        let isValidTerrain = false;

        if (terrainMapRef.current[ty] && terrainMapRef.current[ty][tx]) {
            const t = terrainMapRef.current[ty][tx];
            if (buildModeRef.current === BuildingType.BARRACKS || buildModeRef.current === BuildingType.HOUSE) {
                isValidTerrain = (t === TerrainType.GRASS || t === TerrainType.FOREST);
            } else if (buildModeRef.current === BuildingType.TOWER) {
                isValidTerrain = (t === TerrainType.HILL);
            }
        }

        let isInsideTerritory = false;
        if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, pos.x, pos.y)) {
             isInsideTerritory = true;
         }

        let isColliding = false;
        basesRef.current.forEach(b => {
            if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (b.radius + 10)**2) isColliding = true;
        });
        buildingsRef.current.forEach(b => {
            if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (BUILDING_RADIUS * 2)**2) isColliding = true;
        });
        
        if (isInsideTerritory && !isColliding && isValidTerrain && moneyRef.current >= cost) {
            moneyRef.current -= cost;
            setPlayerMoney(moneyRef.current);

            const bName = buildModeRef.current === BuildingType.TOWER ? "哨塔" : buildModeRef.current === BuildingType.HOUSE ? "房屋" : "兵营";
            onAddLog(`建设: 在据点 ${sb.id} 建造了 ${bName}`, COLORS.PLAYER);
            
            buildingsRef.current.push(new Building(
                `build-${Date.now()}`,
                buildModeRef.current,
                pos.x,
                pos.y,
                sb.id,
                sb.color
            ));
            
            // Recalc stats immediately
            sb.recalculateStats(buildingsRef.current);

            buildModeRef.current = null;
            onCancelBuild();
            reportSelection(sb);
            return;
        } else {
             if (!isInsideTerritory) {
                  let clickedAnother = false;
                  basesRef.current.forEach((base) => {
                    const d = (pos.x - base.x)**2 + (pos.y - (base.y - 10))**2;
                    if (d < (base.radius + 20)**2) clickedAnother = true;
                  });
                  if (!clickedAnother) {
                      buildModeRef.current = null;
                      onCancelBuild();
                      return;
                  }
             } else if (!isValidTerrain) {
                 const reason = buildModeRef.current === BuildingType.TOWER ? "需要山地地形" : "需要平原地形";
                 onAddLog(`建造失败: ${reason}`, '#FF0000');
                 return;
             } else if (isColliding) {
                 onAddLog(`建造失败: 空间不足`, '#FF0000');
                 return;
             }
        }
    }

    let clickedBase: Base | null = null;
    let minD = Infinity;

    basesRef.current.forEach((base) => {
      const d = (pos.x - base.x)**2 + (pos.y - (base.y - 10))**2;
      if (d < (base.radius + 25)**2 && d < minD) {
         minD = d;
         clickedBase = base;
      }
    });
    
    if (!clickedBase) {
        if (!buildModeRef.current) {
            selectedBaseRef.current = null;
            reportSelection(null);
        }
    } else {
        if (clickedBase.ownerType === OwnerType.PLAYER) {
            isDraggingRef.current = true;
            dragStartBaseRef.current = clickedBase;
            dragStartTimeRef.current = Date.now();
        } else {
            selectedBaseRef.current = clickedBase;
            reportSelection(clickedBase);
        }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameStatus !== GameStatus.PLAYING) return;
    mousePosRef.current = getPos(e);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current || !dragStartBaseRef.current) {
        return;
    }
    
    const source = dragStartBaseRef.current;
    const pos = mousePosRef.current;
    
    const dragDuration = Date.now() - dragStartTimeRef.current;
    const distMoved = Math.sqrt((pos.x - source.x)**2 + (pos.y - source.y)**2);

    if (dragDuration < 300 && distMoved < 20) {
        selectedBaseRef.current = source;
        reportSelection(source);
        isDraggingRef.current = false;
        dragStartBaseRef.current = null;
        return;
    }

    isDraggingRef.current = false;
    dragStartBaseRef.current = null;
    
    let target: Base | null = null;
    let minD = Infinity;

    basesRef.current.forEach((base) => {
      const d = (pos.x - base.x)**2 + (pos.y - (base.y - 10))**2;
      if (d < (base.radius + 35)**2 && d < minD) { 
        minD = d;
        target = base;
      }
    });

    if (target && target !== source) {
         const startGrid = { x: Math.floor(source.x / CELL_SIZE), y: Math.floor(source.y / CELL_SIZE) };
         const endGrid = { x: Math.floor(target.x / CELL_SIZE), y: Math.floor(target.y / CELL_SIZE) };
         
         const path = findPath(startGrid, endGrid, terrainMapRef.current, mapColsRef.current, mapRowsRef.current);
         
         if (path.length > 0) {
             const squadSize = 3;
             if (source.units >= squadSize + 1) {
                 source.units -= squadSize;
                 
                 if(source.ownerType === OwnerType.PLAYER) {
                    onAddLog(`出征: 兵团前往 ${target.id}`, COLORS.PLAYER);
                 }

                 const offsets = [ {x: 0, y: 0}, {x: -4, y: 4}, {x: 4, y: 4} ];
                 for (let i = 0; i < squadSize; i++) {
                     if (unitsRef.current)
                        unitsRef.current.push(new Unit(source, target!, source.color, path, offsets[i]));
                 }
                 reportSelection(source);
             }
         } else {
             onAddLog("无法通行: 地形阻挡", "#FF0000");
         }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full cursor-crosshair select-none touch-none"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      style={{ touchAction: 'none' }} 
    />
  );
});

export default GameCanvas;
