
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { COLORS, CONFIG, BUILD_COST, BUILDING_RADIUS } from '../constants';
import { GameStatus, OwnerType, BuildingType, Point, TerrainType } from '../types';

export interface GameCanvasRef {
  setBuildMode: (type: BuildingType | null) => void;
}

interface GameCanvasProps {
  gameStatus: GameStatus;
  onGameOver: (win: boolean) => void;
  triggerRestart: number;
  onSelectionChange: (base: { id: string, units: number, isMine: boolean, canAfford: boolean } | null) => void;
  onCancelBuild: () => void;
  onAddLog: (message: string, color?: string) => void;
}

const CELL_SIZE = 8;
const GRID_W = 100; // Max Grid Width fallback
const GRID_H = 100;

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
        // Find lowest f
        let lowInd = 0;
        for(let i=0; i<openSet.length; i++) {
            if(openSet[i].f < openSet[lowInd].f) { lowInd = i; }
        }
        let current = openSet[lowInd];

        // End condition (within 1 cell range)
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
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0} // 4-directional movement for grid feel
        ];

        for(let i=0; i<neighbors.length; i++) {
            const nx = current.x + neighbors[i].x;
            const ny = current.y + neighbors[i].y;

            if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            
            // Obstacle check
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
    return []; // No path found
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
            const fireRate = 50;
            const range = 120; // High ground advantage
            
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
            if (this.produceTimer > 300) { 
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
             // Sentry Tower on Hill
             ctx.fillStyle = '#2d2d2d'; // Stone foundation
             ctx.fillRect(-6, -10, 12, 10);
             ctx.fillStyle = this.color;
             ctx.fillRect(-5, -18, 10, 8); // Cabin
             // Viewport
             ctx.fillStyle = '#000';
             ctx.fillRect(-3, -15, 6, 2);
             // Antenna
             ctx.strokeStyle = '#888';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(0, -18); ctx.lineTo(0, -24);
             ctx.stroke();
             // Light
             const t = Math.floor(Date.now() / 200) % 2;
             ctx.fillStyle = t === 0 ? '#FF0000' : '#550000';
             ctx.fillRect(-1, -25, 2, 2);

        } else if (this.type === BuildingType.BARRACKS) {
            // Training Facility
            ctx.fillStyle = '#3f3f3f';
            ctx.fillRect(-10, -8, 20, 8);
            ctx.fillStyle = this.color;
            ctx.fillRect(-8, -12, 16, 4);
            // Double Doors
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-4, -6, 3, 6);
            ctx.fillRect(1, -6, 3, 6);
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
  }

  setTerritory(cells: Point[]) {
    this.territoryPath = new Path2D();
    cells.forEach(cell => {
      this.territoryPath!.rect(cell.x, cell.y, CELL_SIZE, CELL_SIZE); 
    });
  }

  update(
    gameActive: boolean, 
    bases: Base[], 
    units: Unit[], 
    sendSquad: (source: Base, target: Base) => void
  ) {
    if (!gameActive) return;

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

    // AI Logic: Send Squads
    if (this.ownerType === OwnerType.AI) {
      let aggression = this.units > 40 ? 0.003 : 0.0005;
      
      if (Math.random() < aggression && this.units > 12) {
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

  drawTerritory(ctx: CanvasRenderingContext2D, isHighlight: boolean) {
    if (!this.territoryPath) return;
    
    let topColor = this.ownerType === OwnerType.NEUTRAL ? 'transparent' : this.color;
    
    if (this.ownerType !== OwnerType.NEUTRAL) {
       ctx.save();
       ctx.globalAlpha = 0.3; 
       if (isHighlight) ctx.globalAlpha = 0.5;
       
       ctx.fillStyle = topColor;
       ctx.fill(this.territoryPath);
       
       // Grid Effect for Territory
       ctx.strokeStyle = 'rgba(0,0,0,0.1)';
       ctx.lineWidth = 0.5;
       ctx.stroke(this.territoryPath);

       ctx.restore();
       
       // Border
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

    // Fortress Graphics
    ctx.fillStyle = '#000000'; // Shadow
    ctx.fillRect(-12, 5, 24, 8);

    // Main Keep
    ctx.fillStyle = '#475569'; 
    ctx.fillRect(-10, -10, 20, 20);
    
    // Battlements
    ctx.fillStyle = baseColor;
    ctx.fillRect(-12, -14, 6, 8); 
    ctx.fillRect(6, -14, 6, 8);   
    ctx.fillRect(-4, -18, 8, 8); // Central Tower

    // Gate
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-3, 0, 6, 10); 

    // Flag
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1, -26, 2, 8);
    const wave = Math.floor(Date.now() / 200) % 2;
    ctx.fillStyle = this.ownerType === OwnerType.NEUTRAL ? '#ccc' : baseColor;
    ctx.fillRect(1, wave === 0 ? -26 : -25, 8, 5);

    // Unit Count Badge
    ctx.save();
    ctx.translate(0, -35); 
    ctx.scale(1/scale, 1/scale);
    
    const countStr = Math.floor(this.units).toString();
    ctx.font = '12px "Press Start 2P"';
    const textWidth = ctx.measureText(countStr).width;
    const boxW = Math.max(20, textWidth + 8);

    ctx.fillStyle = '#000';
    ctx.fillRect(-boxW/2, -10, boxW, 20);
    ctx.fillStyle = '#fff'; 
    if (this.units >= BUILD_COST && this.ownerType === OwnerType.PLAYER) {
        ctx.fillStyle = '#FFEC27'; 
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countStr, 0, 2);
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

    // Movement Logic
    if (this.pathIndex < this.path.length) {
        const targetPoint = this.path[this.pathIndex];
        // Convert grid coordinate back to world coordinate for movement
        // Add random slight jitter to make them look like a crowd not a line
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
        // Reached end of path (Base center roughly)
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 10) {
            this.hitTarget(createExplosion, onCapture);
        } else {
            // Final approach if path ends near base but not inside
             this.x += (dx / dist) * this.speed;
             this.y += (dy / dist) * this.speed;
        }
    }
  }

  hitTarget(createExplosion: (x: number, y: number, color: string) => void, onCapture: (base: Base, newColor: string) => void) {
    this.dead = true;
    createExplosion(this.x, this.y, this.color);

    if (this.target.color === this.color) {
      this.target.units++;
    } else {
      this.target.units -= 1;
      if (this.target.units <= 0) {
        // CAPTURE EVENT
        this.target.ownerType = getOwnerTypeByColor(this.color);
        this.target.color = this.color;
        this.target.units = 1;
        this.target.visualPulse = 20;
        onCapture(this.target, this.color);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;

    // Determine facing based on next path node
    let vx = 0;
    if (this.pathIndex < this.path.length) {
         const targetPoint = this.path[this.pathIndex];
         vx = (targetPoint.x * CELL_SIZE + CELL_SIZE/2) - this.x;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Flip if moving left
    if (vx < 0) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-2, 3, 5, 2);

    const step = Math.floor(this.walkFrame) % 4; // 4 frame walk cycle

    // Soldier Art (Side viewish)
    // Legs
    ctx.fillStyle = '#222';
    if (step === 0 || step === 2) {
        ctx.fillRect(-1, 0, 2, 5); // Stand
    } else if (step === 1) {
        ctx.fillRect(-2, 0, 2, 4); // Left fwd
        ctx.fillRect(1, 0, 2, 4); 
    } else {
        ctx.fillRect(0, 0, 2, 4); 
    }

    // Body
    ctx.fillStyle = this.color;
    ctx.fillRect(-2, -5, 5, 5);

    // Head/Helmet
    ctx.fillStyle = adjustColor(this.color, 40);
    ctx.fillRect(-1, -7, 4, 3);
    
    // Gun
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

  const generateTerrain = (cols: number, rows: number) => {
      const map: TerrainType[][] = [];
      const seed = Math.random() * 1000;

      for (let y = 0; y < rows; y++) {
          const row: TerrainType[] = [];
          for (let x = 0; x < cols; x++) {
              // Scale coordinates for noise
              const nx = x;
              const ny = y;
              const n = noise(nx, ny, seed);
              
              let type = TerrainType.WATER;

              // Biome Logic based on Height
              if (n < -0.4) type = TerrainType.WATER;     // Deep Water
              else if (n < -0.3) type = TerrainType.SAND; // Beaches
              else if (n < 0.2) type = TerrainType.GRASS; // Plains
              else if (n < 0.5) type = TerrainType.FOREST;// Forests
              else if (n < 0.7) type = TerrainType.HILL;  // Hills (Buildable for Towers)
              else type = TerrainType.MOUNTAIN;           // Peaks (Impassable)

              row.push(type);
          }
          map.push(row);
      }
      
      // Ensure border is water/impassable to prevent units stuck at edge
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
      
      for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
              const type = map[y]?.[x] || TerrainType.WATER;
              const posX = x * CELL_SIZE;
              const posY = y * CELL_SIZE;

              let color = COLORS.TERRAIN_WATER;
              if (type === TerrainType.SAND) color = COLORS.TERRAIN_SAND;
              else if (type === TerrainType.GRASS) color = COLORS.TERRAIN_GRASS;
              else if (type === TerrainType.FOREST) color = COLORS.TERRAIN_FOREST;
              else if (type === TerrainType.HILL) color = COLORS.TERRAIN_HILL;
              else if (type === TerrainType.MOUNTAIN) color = COLORS.TERRAIN_MOUNTAIN;
              
              ctx.fillStyle = color;
              ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);
              
              // 8-Bit Pattern Details
              ctx.fillStyle = 'rgba(0,0,0,0.1)';
              if (type === TerrainType.GRASS && (x+y)%3 === 0) {
                  ctx.fillRect(posX+2, posY+2, 2, 2);
              } else if (type === TerrainType.FOREST) {
                  ctx.fillRect(posX+1, posY+1, 2, 2);
                  ctx.fillRect(posX+4, posY+4, 2, 2);
              } else if (type === TerrainType.HILL) {
                  ctx.fillStyle = 'rgba(255,255,255,0.1)';
                  ctx.fillRect(posX, posY, 2, 2);
              } else if (type === TerrainType.MOUNTAIN) {
                  ctx.fillStyle = COLORS.TERRAIN_MOUNTAIN_PEAK;
                  ctx.fillRect(posX+2, posY+1, 4, 3);
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

    // Place Bases - Random Method with Safety Margins
    const isSmallScreen = width < 600 || height < 600;
    const targetCount = isSmallScreen ? 8 : 15; 
    
    const validPositions: Point[] = [];
    // Increase margins to prevent UI cutoff (especially top for badges)
    const marginX = 50;
    const marginY = 60; // Top/Bottom need more for unit badges/popups
    
    // Safety check for very small screens
    const safeWidth = Math.max(100, width - marginX * 2);
    const safeHeight = Math.max(100, height - marginY * 2);

    // Try to find valid spots
    let attempts = 0;
    while (validPositions.length < targetCount && attempts < 1000) {
         attempts++;
         const px = marginX + Math.random() * safeWidth;
         const py = marginY + Math.random() * safeHeight;

         const tx = Math.floor(px / CELL_SIZE);
         const ty = Math.floor(py / CELL_SIZE);
         
         if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) {
             const type = terrainMapRef.current[ty][tx];
             // Bases only on GRASS or FOREST or HILL
             if (type === TerrainType.GRASS || type === TerrainType.FOREST || type === TerrainType.HILL) {
                  // Check distance to others
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
    playerBase.units = 30;
    basesRef.current.push(playerBase);

    // Enemies
    const enemyColors = [COLORS.ENEMY_1, COLORS.ENEMY_2, COLORS.ENEMY_3, COLORS.ENEMY_4];
    const numEnemies = Math.min(4, Math.ceil(validPositions.length / 3));

    for (let i = 0; i < numEnemies; i++) {
        if (validPositions.length === 0) break;
        const pos = validPositions.pop()!;
        const b = new Base(`enemy-${i}`, pos.x, pos.y, enemyColors[i % enemyColors.length], OwnerType.AI);
        b.units = 25;
        basesRef.current.push(b);
    }

    // Neutrals
    let nIdx = 0;
    while (validPositions.length > 0) {
      const pos = validPositions.pop()!;
      const b = new Base(`neutral-${nIdx++}`, pos.x, pos.y, COLORS.NEUTRAL, OwnerType.NEUTRAL);
      b.units = 10 + Math.floor(Math.random() * 15);
      basesRef.current.push(b);
    }

    // Territory
    const baseCells: Point[][] = basesRef.current.map(() => []);
    const cellOwnerMap = new Map<string, Base>();

    // Voronoi-ish but respects terrain vaguely
    for (let y = 0; y < height; y += CELL_SIZE) {
      for (let x = 0; x < width; x += CELL_SIZE) {
        // Optimization: Only check every few pixels or simplify distance
        
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

    // Determine Neighbors using pathfinding accessibility? 
    // Simplified: Neighbors are Voronoi adjacents, but unit dispatch will fail if no path.
    const directions = [{x: CELL_SIZE, y: 0}, {x: -CELL_SIZE, y: 0}, {x: 0, y: CELL_SIZE}, {x: 0, y: -CELL_SIZE}];
    baseCells.forEach((cells, index) => {
        const currentBase = basesRef.current[index];
        // Sample a subset of cells to improve performance
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
    
    onAddLog("地形扫描完成。开始行动。", COLORS.WHITE);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;

    const handleResize = () => {
        const rect = canvas.getBoundingClientRect();
        
        // Debounce / Check if size changed significantly (ignore small URL bar scroll shifts)
        const oldW = prevSizeRef.current.w;
        const oldH = prevSizeRef.current.h;
        if (Math.abs(rect.width - oldW) < 50 && Math.abs(rect.height - oldH) < 50) {
            return; 
        }

        prevSizeRef.current = { w: rect.width, h: rect.height };

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;
        initLevel(rect.width, rect.height);
    };

    // Initial setup
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
        prevSizeRef.current = { w: rect.width, h: rect.height };
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        // Set style width/height to 100% to fill flex parent
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
        onAddLog(`战报: ${base.id} 据点被 ${ownerName} 占领！`, newColor);
    };

    const sendSquad = (source: Base, target: Base) => {
      if (!source.neighbors.has(target)) return;
      if (source.units < 4) return; // Min required for a squad

      // Calculate path ONCE for the squad
      const startGrid = { x: Math.floor(source.x / CELL_SIZE), y: Math.floor(source.y / CELL_SIZE) };
      const endGrid = { x: Math.floor(target.x / CELL_SIZE), y: Math.floor(target.y / CELL_SIZE) };
      
      const path = findPath(startGrid, endGrid, terrainMapRef.current, mapColsRef.current, mapRowsRef.current);
      
      if (path.length === 0) {
          if (source.ownerType === OwnerType.PLAYER) {
              onAddLog("警告: 无法到达目标！地形受阻。", "#FF0000");
          }
          return;
      }

      // Send 3 units as a squad
      const squadSize = 3;
      if (source.units < squadSize + 1) return;

      source.units -= squadSize;
      
      // Squad offsets for formation
      const offsets = [
          {x: 0, y: 0},
          {x: -4, y: 4},
          {x: 4, y: 4}
      ];

      for (let i = 0; i < squadSize; i++) {
        if (unitsRef.current) {
             unitsRef.current.push(new Unit(source, target, source.color, path, offsets[i]));
        }
      }
      reportSelection(selectedBaseRef.current);
    };

    let tick = 0;
    const render = () => {
      tick++;
      if (!ctx || !canvas) return;
      
      // Calculate logic size for drawing
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
      }

      const sortedBases = [...basesRef.current].sort((a,b) => a.y - b.y);

      // Draw Territory
      sortedBases.forEach((base) => {
        if (gameStatus === GameStatus.PLAYING) {
             base.update(true, basesRef.current, unitsRef.current, sendSquad);
        }
        const isHighlight = buildModeRef.current && selectedBaseRef.current?.id === base.id;
        base.drawTerritory(ctx, !!isHighlight);
      });

      // Buildings
      buildingsRef.current.forEach(b => {
          const ownerBase = basesRef.current.find(base => base.id === b.ownerBaseId);
          if (ownerBase && ownerBase.color !== b.color) {
              // Building destroyed/captured behavior: destroy it
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

      // Build Ghost
      if (buildModeRef.current && selectedBaseRef.current) {
         const mouse = mousePosRef.current;
         const sb = selectedBaseRef.current;
         
         const tx = Math.floor(mouse.x / CELL_SIZE);
         const ty = Math.floor(mouse.y / CELL_SIZE);
         let isValidTerrain = false;

         if (terrainMapRef.current[ty] && terrainMapRef.current[ty][tx]) {
             const t = terrainMapRef.current[ty][tx];
             if (buildModeRef.current === BuildingType.BARRACKS) {
                 isValidTerrain = (t === TerrainType.GRASS || t === TerrainType.FOREST);
             } else if (buildModeRef.current === BuildingType.TOWER) {
                 isValidTerrain = (t === TerrainType.HILL);
             }
         }

         let isInsideTerritory = false;
         if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, mouse.x, mouse.y)) {
             isInsideTerritory = true;
         }

         // Collision check with other buildings/bases
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

      // Render Objects
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

      // Cleanup
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
        
        // 1. Terrain Check
        const tx = Math.floor(pos.x / CELL_SIZE);
        const ty = Math.floor(pos.y / CELL_SIZE);
        let isValidTerrain = false;

        if (terrainMapRef.current[ty] && terrainMapRef.current[ty][tx]) {
            const t = terrainMapRef.current[ty][tx];
            if (buildModeRef.current === BuildingType.BARRACKS) {
                isValidTerrain = (t === TerrainType.GRASS || t === TerrainType.FOREST);
            } else if (buildModeRef.current === BuildingType.TOWER) {
                isValidTerrain = (t === TerrainType.HILL);
            }
        }

        // 2. Territory Check
        let isInsideTerritory = false;
        if (sb.territoryPath && ctx.isPointInPath(sb.territoryPath, pos.x, pos.y)) {
             isInsideTerritory = true;
         }

        // 3. Collision Check
        let isColliding = false;
        basesRef.current.forEach(b => {
            if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (b.radius + 10)**2) isColliding = true;
        });
        buildingsRef.current.forEach(b => {
            if ((pos.x - b.x)**2 + (pos.y - b.y)**2 < (BUILDING_RADIUS * 2)**2) isColliding = true;
        });
        
        if (isInsideTerritory && !isColliding && isValidTerrain && sb.units >= BUILD_COST) {
            sb.units -= BUILD_COST;
            const bName = buildModeRef.current === BuildingType.TOWER ? "哨塔" : "兵营";
            onAddLog(`建设: 指挥官在据点 ${sb.id} 建造了 ${bName}`, COLORS.PLAYER);
            
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
             // Error Feedback
             if (!isInsideTerritory) {
                  // Clicked outside, maybe cancelling?
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

    // BASE SELECTION / DRAG
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
         // Trigger Squad Send
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
