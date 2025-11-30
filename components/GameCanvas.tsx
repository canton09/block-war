
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { COLORS, CONFIG, BUILD_COST, BUILDING_RADIUS } from '../constants';
import { GameStatus, OwnerType, BuildingType, Point } from '../types';

export interface GameCanvasRef {
  setBuildMode: (type: BuildingType | null) => void;
}

interface GameCanvasProps {
  gameStatus: GameStatus;
  onGameOver: (win: boolean) => void;
  triggerRestart: number;
  onSelectionChange: (base: { id: string, units: number, isMine: boolean, canAfford: boolean } | null) => void;
  onCancelBuild: () => void;
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

// --- Game Classes ---

class Building {
    id: string;
    type: BuildingType;
    x: number;
    y: number;
    ownerBaseId: string;
    color: string;
    shootTimer: number = 0;
    produceTimer: number = 0;
    
    constructor(id: string, type: BuildingType, x: number, y: number, ownerBaseId: string, color: string) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.ownerBaseId = ownerBaseId;
        this.color = color;
    }

    update(units: Unit[], createLaser: (x1: number, y1: number, x2: number, y2: number, color: string) => void, addUnitToBase: () => void) {
        if (this.type === BuildingType.TOWER) {
            this.shootTimer++;
            const fireRate = 40;
            const range = 100;
            
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
                    createLaser(this.x, this.y - 15, targetUnit.x, targetUnit.y, this.color);
                }
            }
        } else if (this.type === BuildingType.BARRACKS) {
            this.produceTimer++;
            // Barracks adds 1 unit to base every ~2 seconds (faster than base natural spawn)
            if (this.produceTimer > 120) {
                this.produceTimer = 0;
                addUnitToBase();
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const cx = this.x;
        const cy = this.y;
        
        ctx.save();
        ctx.translate(cx, cy);

        // Shadow (Pixelated)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(-8, 2, 16, 6);

        if (this.type === BuildingType.TOWER) {
             // Base
             ctx.fillStyle = '#475569'; // Slate 600
             ctx.fillRect(-6, -10, 12, 10);
             
             // Top
             ctx.fillStyle = this.color;
             ctx.fillRect(-4, -18, 8, 8);
             
             // Crystal / Light
             const t = Math.floor(Date.now() / 200) % 2;
             ctx.fillStyle = t === 0 ? '#FFFFFF' : adjustColor(this.color, 40); // Blink
             ctx.fillRect(-2, -22, 4, 4);

        } else if (this.type === BuildingType.BARRACKS) {
            // Structure
            ctx.fillStyle = '#475569';
            ctx.fillRect(-10, -8, 20, 8);
            
            // Roof
            ctx.fillStyle = this.color;
            ctx.fillRect(-8, -12, 16, 4);
            
            // Door
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(-3, -6, 6, 6);
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
  spawnTimer: number;
  visualPulse: number;
  territoryPath: Path2D | null = null;
  neighbors: Set<Base> = new Set();
  flagAngle: number;
  
  constructor(id: string, x: number, y: number, color: string, ownerType: OwnerType) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.units = 10;
    this.ownerType = ownerType;
    this.radius = CONFIG.baseRadius;
    this.spawnTimer = 0;
    this.visualPulse = 0;
    this.flagAngle = Math.random() * Math.PI * 2;
  }

  setTerritory(cells: Point[]) {
    this.territoryPath = new Path2D();
    cells.forEach(cell => {
      this.territoryPath!.rect(cell.x, cell.y, CELL_SIZE + 0.2, CELL_SIZE + 0.2); // +0.2 to avoid gaps
    });
  }

  update(
    gameActive: boolean, 
    bases: Base[], 
    units: Unit[], 
    sendUnits: (source: Base, target: Base) => void
  ) {
    this.flagAngle += 0.1;

    if (!gameActive) return;

    // Production Logic
    if (this.ownerType !== OwnerType.NEUTRAL) {
      this.spawnTimer++;
      let rate = CONFIG.spawnRate;
      if (this.ownerType === OwnerType.PLAYER) rate *= 0.9; 

      if (this.spawnTimer >= rate) {
        this.units++;
        this.spawnTimer = 0;
        this.visualPulse = 3;
      }
    }

    // AI Logic
    if (this.ownerType === OwnerType.AI) {
      let aggression = this.units > 50 ? 0.005 : 0.001;
      
      if (Math.random() < aggression && this.units > 15) {
        const neighbors = Array.from(this.neighbors);
        if (neighbors.length > 0) {
            let target: Base | null = null;
            if (Math.random() < 0.5) {
               target = neighbors.find(n => n.ownerType !== this.ownerType && n.units < this.units * 0.8) || null;
            } 
            if (!target) {
                target = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
            if (target) {
              sendUnits(this, target);
            }
        }
      }
    }

    if (this.visualPulse > 0) this.visualPulse--;
  }

  drawTerritory(ctx: CanvasRenderingContext2D, isHighlight: boolean) {
    if (!this.territoryPath) return;
    
    // Draw "3D" side thickness for territory
    const sideHeight = 4;
    ctx.save();
    ctx.translate(0, sideHeight);
    
    // Darker shadow for depth
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; 
    ctx.fill(this.territoryPath);
    ctx.restore();

    let topColor = this.ownerType === OwnerType.NEUTRAL ? '#64748B' : this.color;
    
    if (this.ownerType === OwnerType.NEUTRAL) {
       topColor = 'rgba(100, 116, 139, 0.2)'; // Faint neutral
    } else {
       // Make territory slightly translucent to see grid?
       // Let's use solid but darkened colors for that tactical look
       topColor = adjustColor(topColor, -40);
       
       // Add transparency
       ctx.globalAlpha = 0.8;
    }
    
    if (isHighlight) {
        topColor = adjustColor(topColor, 60);
        ctx.globalAlpha = 0.9;
    }

    ctx.fillStyle = topColor;
    ctx.fill(this.territoryPath);
    ctx.globalAlpha = 1.0;
    
    // Highlight Border
    if (this.ownerType === OwnerType.PLAYER) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke(this.territoryPath);
    }
  }

  drawStructure(ctx: CanvasRenderingContext2D, isSelected: boolean) {
    const cx = this.x;
    const cy = this.y - 10;
    
    const baseColor = this.color;
    const scale = 1 + (this.visualPulse / 10);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-12, 10, 24, 6);

    // CASTLE PIXEL ART
    // Main Keep
    ctx.fillStyle = '#475569'; // Slate 600 Stone
    ctx.fillRect(-10, -10, 20, 20);
    
    // Battlements
    ctx.fillStyle = baseColor;
    ctx.fillRect(-12, -14, 6, 6); // Left tower
    ctx.fillRect(6, -14, 6, 6);   // Right tower
    ctx.fillRect(-4, -16, 8, 8);  // Center tower high

    // Windows / Detail
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-2, -6, 4, 6); // Door
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-8, -4, 2, 4); // Windows
    ctx.fillRect(6, -4, 2, 4);

    // Flag
    const tipX = 0;
    const tipY = -24;
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(tipX - 1, tipY, 2, 10); // Pole

    // Waving flag
    const wave = Math.floor(Date.now() / 200) % 2;
    ctx.fillStyle = this.ownerType === OwnerType.NEUTRAL ? '#CBD5E1' : baseColor;
    if (wave === 0) {
        ctx.fillRect(tipX + 1, tipY, 10, 6);
    } else {
        ctx.fillRect(tipX + 1, tipY + 2, 10, 6);
    }

    // Badge / Counter
    ctx.translate(0, -35);
    
    // Pixelated box for number
    ctx.fillStyle = '#000';
    ctx.fillRect(-14, -8, 28, 14);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-12, -6, 24, 10);
    
    ctx.fillStyle = '#0F172A';
    ctx.font = '10px "Press Start 2P"'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(this.units).toString(), 0, 0);
    
    ctx.restore();

    if (isSelected) {
      ctx.save();
      ctx.translate(this.x, this.y);
      
      // Selection bracket
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      const r = 25;
      const len = 8;
      
      ctx.beginPath();
      ctx.moveTo(-r, -r + len); ctx.lineTo(-r, -r); ctx.lineTo(-r + len, -r);
      ctx.moveTo(r, -r + len); ctx.lineTo(r, -r); ctx.lineTo(r - len, -r);
      ctx.moveTo(-r, r - len); ctx.lineTo(-r, r); ctx.lineTo(-r + len, r);
      ctx.moveTo(r, r - len); ctx.lineTo(r, r); ctx.lineTo(r - len, r);
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
  vx: number;
  vy: number;
  dead: boolean;
  spawnTime: number;

  constructor(source: Base, target: Base, color: string) {
    this.x = source.x;
    this.y = source.y;
    this.target = target;
    this.color = color;
    this.speed = CONFIG.unitSpeed + Math.random() * 0.1;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.spawnTime = Date.now();
    this.x += (Math.random() - 0.5) * 10;
    this.y += (Math.random() - 0.5) * 10;
  }

  update(createExplosion: (x: number, y: number, color: string) => void) {
    if (this.dead) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      this.hitTarget(createExplosion);
      return;
    }

    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;

    this.vx += (Math.random() - 0.5) * 0.2;
    this.vy += (Math.random() - 0.5) * 0.2;

    this.x += this.vx;
    this.y += this.vy;
  }

  hitTarget(createExplosion: (x: number, y: number, color: string) => void) {
    this.dead = true;
    createExplosion(this.x, this.y, this.color);

    if (this.target.color === this.color) {
      this.target.units++;
    } else {
      this.target.units -= 1;
      if (this.target.units <= 0) {
        this.target.ownerType = getOwnerTypeByColor(this.color);
        this.target.color = this.color;
        this.target.units = 1;
        this.target.visualPulse = 20;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    
    // Pixel Unit
    ctx.fillStyle = '#000';
    ctx.fillRect(this.x - 3, this.y - 3, 6, 6);
    
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
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
    const size = 4;
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
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.life = 1.0;
    }
    update() { this.life -= 0.15; }
    draw(ctx: CanvasRenderingContext2D) {
        if (this.life <= 0) return;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        
        const midX = (this.x1 + this.x2) / 2;
        const midY = (this.y1 + this.y2) / 2;
        const offset = (Math.random() - 0.5) * 20;
        
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(midX + offset, midY + offset);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
    }
}

// --- Component ---

const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(({
  gameStatus,
  onGameOver,
  triggerRestart,
  onSelectionChange,
  onCancelBuild
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const basesRef = useRef<Base[]>([]);
  const unitsRef = useRef<Unit[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  
  const selectedBaseRef = useRef<Base | null>(null);
  const dragStartBaseRef = useRef<Base | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const buildModeRef = useRef<BuildingType | null>(null);
  const animationFrameIdRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    setBuildMode: (type: BuildingType | null) => {
        buildModeRef.current = type;
    }
  }));

  const reportSelection = (base: Base | null) => {
      if (base) {
          onSelectionChange({
              id: base.id,
              units: Math.floor(base.units),
              isMine: base.ownerType === OwnerType.PLAYER,
              canAfford: base.units >= BUILD_COST
          });
      } else {
          onSelectionChange(null);
      }
  };

  // Create Water Pattern
  const createPattern = () => {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 48; // Wider pattern for better repeat
      pCanvas.height = 48;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
          pCtx.fillStyle = COLORS.WATER_BG;
          pCtx.fillRect(0,0,48,48);
          
          // Subtle tech grid dots
          pCtx.fillStyle = COLORS.GRID_LINES;
          // Vertical lines
          pCtx.fillRect(23, 0, 2, 48);
          pCtx.fillRect(0, 23, 48, 2);
          
          // Intersections
          pCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          pCtx.fillRect(23, 23, 2, 2);
          
          // Diagonal or extra noise for texture
          pCtx.fillStyle = 'rgba(0,0,0,0.1)';
          pCtx.fillRect(0,0, 24, 24);
          pCtx.fillRect(24,24, 24, 24);
      }
      patternCanvasRef.current = pCanvas;
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
    createPattern();

    const targetCount = 30;
    const totalArea = width * height;
    const gridStep = Math.max(80, Math.sqrt(totalArea / targetCount));

    const cols = Math.floor(width / gridStep); 
    const rows = Math.floor(height / gridStep);
    
    const positions: Point[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const margin = 60;
        const xBase = c * gridStep;
        const yBase = r * gridStep;
        
        if (xBase < margin || xBase > width - margin || yBase < margin || yBase > height - margin) continue;
        const x = xBase + gridStep/2 + (Math.random() - 0.5) * (gridStep * 0.7);
        const y = yBase + gridStep/2 + (Math.random() - 0.5) * (gridStep * 0.7);
        
        if (x > margin && x < width - margin && y > margin && y < height - margin) {
            positions.push({ x, y });
        }
      }
    }

    const validPositions: Point[] = [];
    for (const p of positions) {
        let tooClose = false;
        for (const vp of validPositions) {
            if ((p.x - vp.x)**2 + (p.y - vp.y)**2 < 3000) { 
                tooClose = true;
                break;
            }
        }
        if (!tooClose) validPositions.push(p);
    }
    
    validPositions.sort(() => Math.random() - 0.5);
    const finalPositions = validPositions.slice(0, 32);

    if (finalPositions.length === 0) return;

    // Player
    const pPos = finalPositions.pop()!;
    const playerBase = new Base('player-1', pPos.x, pPos.y, COLORS.PLAYER, OwnerType.PLAYER);
    playerBase.units = 30;
    basesRef.current.push(playerBase);

    // Enemies
    const enemyColors = [COLORS.ENEMY_1, COLORS.ENEMY_2, COLORS.ENEMY_3, COLORS.ENEMY_4];
    const numEnemies = Math.min(4, Math.ceil(finalPositions.length / 6));

    for (let i = 0; i < numEnemies; i++) {
        if (finalPositions.length === 0) break;
        const pos = finalPositions.pop()!;
        const b = new Base(`enemy-${i}`, pos.x, pos.y, enemyColors[i % enemyColors.length], OwnerType.AI);
        b.units = 20;
        basesRef.current.push(b);
    }

    // Neutrals
    let nIdx = 0;
    while (finalPositions.length > 0) {
      const pos = finalPositions.pop()!;
      const b = new Base(`neutral-${nIdx++}`, pos.x, pos.y, COLORS.NEUTRAL, OwnerType.NEUTRAL);
      b.units = 10 + Math.floor(Math.random() * 15);
      basesRef.current.push(b);
    }

    // Territory & Neighbors
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
        cells.forEach(p => {
            directions.forEach(d => {
                const neighborBase = cellOwnerMap.get(`${p.x + d.x},${p.y + d.y}`);
                if (neighborBase && neighborBase !== currentBase) {
                    currentBase.neighbors.add(neighborBase);
                    neighborBase.neighbors.add(currentBase);
                }
            });
        });
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp pixel rendering
    ctx.imageSmoothingEnabled = false;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    };
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initLevel(canvas.width, canvas.height);
    window.addEventListener('resize', handleResize);

    const createExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 6; i++) particlesRef.current.push(new Particle(x, y, color));
    };
    
    const createLaser = (x1: number, y1: number, x2: number, y2: number, color: string) => {
        lasersRef.current.push(new Laser(x1, y1, x2, y2, color));
    }

    const sendUnits = (source: Base, target: Base) => {
      if (!source.neighbors.has(target)) return;
      if (source.units < 2) return;
      const count = Math.floor(source.units / 2);
      source.units -= count;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (unitsRef.current && source.units >= 0) {
             unitsRef.current.push(new Unit(source, target, source.color));
          }
        }, i * 150);
      }
      reportSelection(selectedBaseRef.current);
    };

    let tick = 0;
    const render = () => {
      tick++;
      if (!ctx || !canvas) return;
      
      // Draw Background Pattern
      if (patternCanvasRef.current) {
          const pat = ctx.createPattern(patternCanvasRef.current, 'repeat');
          if (pat) {
              ctx.fillStyle = pat;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
              ctx.fillStyle = COLORS.WATER_BG;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
      }

      if (gameStatus === GameStatus.PLAYING) {
          const playerBases = basesRef.current.filter(b => b.ownerType === OwnerType.PLAYER).length;
          const enemyBases = basesRef.current.filter(b => b.ownerType === OwnerType.AI).length;
          if (playerBases > 0 && enemyBases === 0) onGameOver(true);
          else if (playerBases === 0 && enemyBases > 0) onGameOver(false);
          
          if (tick % 10 === 0 && selectedBaseRef.current) {
              reportSelection(selectedBaseRef.current);
          }
      }

      const sortedBases = [...basesRef.current].sort((a,b) => a.y - b.y);

      // Draw Territory
      sortedBases.forEach((base) => {
        if (gameStatus === GameStatus.PLAYING) {
             base.update(true, basesRef.current, unitsRef.current, sendUnits);
        }
        const isHighlight = buildModeRef.current && selectedBaseRef.current?.id === base.id;
        base.drawTerritory(ctx, !!isHighlight);
      });

      // Buildings
      buildingsRef.current.forEach(b => {
          const ownerBase = basesRef.current.find(base => base.id === b.ownerBaseId);
          if (ownerBase && ownerBase.color !== b.color) {
              b.type = null as any; 
          } else if (ownerBase) {
              b.update(unitsRef.current, createLaser, () => ownerBase.units++);
          }
      });
      buildingsRef.current = buildingsRef.current.filter(b => b.type);

      // Drag Line
      if (isDraggingRef.current && dragStartBaseRef.current) {
        const start = dragStartBaseRef.current;
        const mouse = mousePosRef.current;
        
        let hoveringBase: Base | null = null;
        let minD = Infinity;
        basesRef.current.forEach(base => {
            const d = (mouse.x - base.x)**2 + (mouse.y - (base.y - 10))**2;
            if (d < (base.radius + 30)**2 && d < minD) {
                minD = d;
                hoveringBase = base;
            }
        });

        const isValidTarget = hoveringBase && start.neighbors.has(hoveringBase);
        
        // Pixel line style
        ctx.beginPath();
        ctx.moveTo(start.x, start.y - 15);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = isValidTarget ? '#FFF' : '#FF004D'; 
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Target Box
        if (isValidTarget) {
            ctx.strokeStyle = '#FFF';
            ctx.strokeRect(mouse.x - 6, mouse.y - 6, 12, 12);
        } else {
            ctx.fillStyle = '#FF004D';
            ctx.fillRect(mouse.x - 3, mouse.y - 3, 6, 6);
        }
      }

      // Draw Placement Ghost
      if (buildModeRef.current && selectedBaseRef.current) {
         const mouse = mousePosRef.current;
         let isValid = false;
         const sb = selectedBaseRef.current;
         if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, mouse.x, mouse.y)) {
             isValid = true;
             basesRef.current.forEach(b => {
                 if ((mouse.x - b.x)**2 + (mouse.y - b.y)**2 < (b.radius + 10)**2) isValid = false;
             });
             buildingsRef.current.forEach(b => {
                 if ((mouse.x - b.x)**2 + (mouse.y - b.y)**2 < (BUILDING_RADIUS * 2)**2) isValid = false;
             });
         }

         ctx.save();
         ctx.translate(mouse.x, mouse.y);
         ctx.fillStyle = isValid ? 'rgba(0, 228, 54, 0.5)' : 'rgba(255, 0, 77, 0.5)';
         ctx.fillRect(-10, -10, 20, 20); // Square ghost
         ctx.strokeStyle = '#FFF';
         ctx.lineWidth = 2;
         ctx.strokeRect(-10, -10, 20, 20);
         
         if (buildModeRef.current === BuildingType.TOWER) {
             ctx.strokeStyle = 'rgba(255,255,255,0.2)';
             ctx.setLineDash([4, 4]);
             ctx.beginPath();
             ctx.arc(0, 0, 100, 0, Math.PI * 2);
             ctx.stroke();
         }
         ctx.restore();
      }

      // Render Objects sorted by Y
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

      // Logic Updates
      for (let i = unitsRef.current.length - 1; i >= 0; i--) {
        const u = unitsRef.current[i];
        if (gameStatus === GameStatus.PLAYING) u.update(createExplosion);
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

    const ctx = canvasRef.current?.getContext('2d');

    // BUILD MODE CLICK
    if (buildModeRef.current && selectedBaseRef.current && ctx) {
        const sb = selectedBaseRef.current;
        let isValid = false;
        if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, pos.x, pos.y)) {
             isValid = true;
             basesRef.current.forEach(b => {
                 if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (b.radius + 10)**2) isValid = false;
             });
             buildingsRef.current.forEach(b => {
                 if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (BUILDING_RADIUS * 2)**2) isValid = false;
             });
        }
        
        if (isValid && sb.units >= BUILD_COST) {
            sb.units -= BUILD_COST;
            buildingsRef.current.push(new Building(
                `build-${Date.now()}`,
                buildModeRef.current,
                pos.x,
                pos.y,
                sb.id,
                sb.color
            ));
            
            buildModeRef.current = null;
            onCancelBuild();
            reportSelection(sb);
            return;
        } else {
            buildModeRef.current = null;
            onCancelBuild();
        }
    }

    let clickedBase: Base | null = null;
    let minD = Infinity;

    basesRef.current.forEach((base) => {
      const d = (pos.x - base.x)**2 + (pos.y - (base.y - 10))**2;
      if (d < (base.radius + 15)**2 && d < minD) {
         minD = d;
         clickedBase = base;
      }
    });
    
    if (!clickedBase) {
        selectedBaseRef.current = null;
        reportSelection(null);
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

    if (dragDuration < 250 && distMoved < 20) {
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
      if (d < (base.radius + 30)**2 && d < minD) { 
        minD = d;
        target = base;
      }
    });

    if (target && target !== source && source.neighbors.has(target)) {
        if (source.units >= 2) {
             const count = Math.floor(source.units / 2);
             source.units -= count;
             for (let i = 0; i < count; i++) {
                setTimeout(() => {
                   if (unitsRef.current)
                     unitsRef.current.push(new Unit(source, target!, source.color));
                }, i * 150);
             }
             reportSelection(source);
        }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full cursor-crosshair touch-none select-none"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
});

export default GameCanvas;
