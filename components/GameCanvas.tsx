
import React, { useEffect, useRef } from 'react';
import { COLORS, CONFIG } from '../constants';
import { GameStatus, OwnerType, Point } from '../types';

interface GameCanvasProps {
  gameStatus: GameStatus;
  onGameOver: (win: boolean) => void;
  triggerRestart: number; // Increment to restart
}

const CELL_SIZE = 8; // Smaller cells for smoother territory edges

// --- Helper Utils ---

function adjustColor(color: string, amount: number): string {
  let useColor = color;
  if (!useColor.startsWith('#')) return color; // Fallback
  
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

class Base {
  x: number;
  y: number;
  color: string;
  units: number;
  // Cap removed as per request
  ownerType: OwnerType;
  radius: number;
  spawnTimer: number;
  visualPulse: number;
  territoryPath: Path2D | null = null;
  neighbors: Set<Base> = new Set(); // Adjacency list
  
  // 3D Visual properties
  heightOffset: number;
  flagAngle: number;
  gridPattern: CanvasPattern | null = null;

  constructor(x: number, y: number, color: string, ownerType: OwnerType) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.units = 10;
    this.ownerType = ownerType;
    this.radius = CONFIG.baseRadius;
    this.spawnTimer = 0;
    this.visualPulse = 0;
    this.heightOffset = Math.random() * 5; // Slight variation in island height
    this.flagAngle = Math.random() * Math.PI * 2;
  }

  // Define the shape of the territory for this base
  setTerritory(cells: Point[]) {
    this.territoryPath = new Path2D();
    cells.forEach(cell => {
      // Draw rects slightly overlapping to avoid sub-pixel gaps
      this.territoryPath!.rect(cell.x, cell.y, CELL_SIZE + 0.5, CELL_SIZE + 0.5);
    });
  }

  update(gameActive: boolean, bases: Base[], sendUnits: (source: Base, target: Base) => void) {
    // Flag animation
    this.flagAngle += 0.1;

    // Generate units
    if (this.ownerType !== OwnerType.NEUTRAL) {
      this.spawnTimer++;
      let rate = CONFIG.spawnRate;
      if (this.ownerType === OwnerType.PLAYER) rate = 70; // Slight advantage but slower than before

      if (this.spawnTimer >= rate) {
        this.units++;
        this.spawnTimer = 0;
        this.visualPulse = 5;
      }
    }

    // AI Logic (Simple)
    if (this.ownerType === OwnerType.AI && gameActive) {
      // AI Aggression
      const aggression = this.units > 40 ? 0.01 : 0.002;
      
      if (Math.random() < aggression && this.units > 15) {
        // AI can ONLY attack neighbors now
        const neighbors = Array.from(this.neighbors);
        if (neighbors.length > 0) {
            // Prioritize enemies or weaker targets
            let target = neighbors[Math.floor(Math.random() * neighbors.length)];
            
            // Try to find a better target
            for(let i=0; i<3; i++) {
                const t = neighbors[Math.floor(Math.random() * neighbors.length)];
                if (t.ownerType !== this.ownerType && t.units < this.units * 0.8) {
                    target = t;
                    break;
                }
            }

            if (target) {
              sendUnits(this, target);
            }
        }
      }
    }

    if (this.visualPulse > 0) this.visualPulse--;
  }

  drawTerritory(ctx: CanvasRenderingContext2D) {
    if (!this.territoryPath) return;
    
    // 3D Extrusion Effect
    // 1. Draw the "Side" (Cliff) - Darker color, shifted down
    const sideHeight = 8;
    const sideColor = adjustColor(this.color, -60);
    
    ctx.save();
    ctx.translate(0, sideHeight);
    ctx.fillStyle = sideColor;
    ctx.fill(this.territoryPath);
    ctx.restore();

    // 2. Draw the "Top" (Grass/Ground) - Main Color
    const topColor = this.ownerType === OwnerType.NEUTRAL ? '#E0E0E0' : adjustColor(this.color, -10);
    ctx.fillStyle = topColor;
    ctx.fill(this.territoryPath);

    // 3. Draw Grid Lines on top
    ctx.save();
    ctx.clip(this.territoryPath);
    
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    
    // Draw a grid pattern relative to the world
    const gridSize = 20; // Size of the grid squares on the island
    
    // We can just iterate over the canvas size with a step. 
    // Since we clipped, it only draws on the island.
    // Optimization: find bounding box if needed, but for modern canvas this is usually fast enough.
    ctx.beginPath();
    // Vertical lines
    for (let x = 0; x < ctx.canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
    }
    // Horizontal lines
    for (let y = 0; y < ctx.canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
    }
    ctx.stroke();

    ctx.restore();
    
    // Optional: Highlight border for player
    if (this.ownerType === OwnerType.PLAYER) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke(this.territoryPath);
    }
  }

  drawStructure(ctx: CanvasRenderingContext2D, isSelected: boolean, isNeighborOfSelected: boolean) {
    const cx = this.x;
    const cy = this.y - 10; // Shift up to sit on the 3D block
    
    const baseColor = this.color;
    const darkColor = adjustColor(baseColor, -40);
    const lightColor = adjustColor(baseColor, 40);

    // Bounce effect when spawning
    const scale = 1 + (this.visualPulse / 20);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // --- 3D Castle Rendering ---

    // 1. Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main Tower Base (Cylinder-ish)
    const w = 24;
    const h = 20;
    
    // Side of tower
    ctx.fillStyle = darkColor;
    ctx.fillRect(-w/2, -h, w, h);
    
    // Front face highlight (simulating light from top-left)
    ctx.fillStyle = baseColor;
    ctx.fillRect(-w/2, -h, w/2, h);

    // 3. Battlements (Top section)
    const bw = 32;
    const bh = 12;
    const by = -h - bh;
    
    // Side/Bottom of battlements overhang
    ctx.fillStyle = adjustColor(darkColor, -20);
    ctx.beginPath();
    ctx.moveTo(-w/2, -h);
    ctx.lineTo(-bw/2, -h);
    ctx.lineTo(-bw/2, -h - 5);
    ctx.lineTo(bw/2, -h - 5);
    ctx.lineTo(bw/2, -h);
    ctx.lineTo(w/2, -h);
    ctx.fill();

    // Main battlement block
    ctx.fillStyle = darkColor;
    ctx.fillRect(-bw/2, by, bw, bh);
    ctx.fillStyle = baseColor;
    ctx.fillRect(-bw/2, by, bw/2, bh); // Lighting split

    // 4. Roof (Cone/Pyramid)
    const rh = 25;
    ctx.fillStyle = lightColor; // Lit side
    ctx.beginPath();
    ctx.moveTo(0, by - rh);
    ctx.lineTo(-bw/2 - 2, by);
    ctx.lineTo(0, by);
    ctx.fill();

    ctx.fillStyle = adjustColor(lightColor, -30); // Dark side
    ctx.beginPath();
    ctx.moveTo(0, by - rh);
    ctx.lineTo(bw/2 + 2, by);
    ctx.lineTo(0, by);
    ctx.fill();

    // 5. Door
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI, 0); // Door arch
    ctx.fill();

    // 6. Flag
    const tipX = 0;
    const tipY = by - rh;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX, tipY - 15);
    ctx.stroke();

    // Waving flag
    const wave = Math.sin(this.flagAngle) * 3;
    ctx.fillStyle = this.ownerType === OwnerType.NEUTRAL ? '#FFF' : adjustColor(baseColor, 50);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY - 15);
    ctx.quadraticCurveTo(tipX + 10, tipY - 15 + wave, tipX + 20, tipY - 15);
    ctx.lineTo(tipX + 20, tipY - 5);
    ctx.quadraticCurveTo(tipX + 10, tipY - 5 + wave, tipX, tipY - 5);
    ctx.fill();

    // 7. Unit Count Badge
    ctx.translate(0, -65);
    
    // Badge Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(-16, -12, 32, 24, 12);
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(this.units).toString(), 0, 1);

    ctx.restore();

    // Selection Indicator (3D Ring)
    if (isSelected) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      ctx.ellipse(0, 5, this.radius + 8, (this.radius + 8) * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.restore();
    } else if (isNeighborOfSelected) {
       // Highlight valid targets when dragging
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      ctx.ellipse(0, 5, this.radius + 5, (this.radius + 5) * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

class Unit {
  x: number;
  y: number;
  z: number; // For jump arc
  target: Base;
  color: string;
  speed: number;
  vx: number;
  vy: number;
  dead: boolean;
  spawnTime: number;
  
  // Animation offsets for "Warband" look
  soldierOffsets: {x: number, y: number}[];

  constructor(source: Base, target: Base, color: string) {
    this.x = source.x;
    this.y = source.y;
    this.z = 0;
    this.target = target;
    this.color = color;
    this.speed = CONFIG.unitSpeed + Math.random() * 0.2;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.spawnTime = Date.now();

    // Spread out spawn slightly
    this.x += (Math.random() - 0.5) * 10;
    this.y += (Math.random() - 0.5) * 10;
    
    // Define the squad formation (triangle of 3 small soldiers)
    this.soldierOffsets = [
        {x: 0, y: -3},
        {x: -3, y: 2},
        {x: 3, y: 2}
    ];
  }

  update(createExplosion: (x: number, y: number, color: string) => void) {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      this.hitTarget(createExplosion);
      return;
    }

    // Move
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;

    // Swarm behavior (jitter)
    this.vx += (Math.random() - 0.5) * 0.3;
    this.vy += (Math.random() - 0.5) * 0.3;

    this.x += this.vx;
    this.y += this.vy;

    // Bobbing effect for walking
    this.z = Math.abs(Math.sin((Date.now() - this.spawnTime) / 150)) * 3;
  }

  hitTarget(createExplosion: (x: number, y: number, color: string) => void) {
    this.dead = true;
    createExplosion(this.x, this.y, this.color);

    if (this.target.color === this.color) {
      // Reinforce
      this.target.units++;
    } else {
      // Attack
      this.target.units--;
      if (this.target.units <= 0) {
        // Capture
        this.target.ownerType = getOwnerTypeByColor(this.color);
        this.target.color = this.color;
        this.target.units = 0; // Reset to 0 then add attackers remaining? Or just 0. Usually 0 or remaining. 
        // Logic: Unit dies to reduce count. If count < 0, capture. 
        // Here we just set to 0. It means the last attacker "claimed" it but died in process or just set flag.
        // Let's give it 1 unit to start if captured to be nice.
        this.target.units = 1;
        this.target.visualPulse = 20;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw "Warband" - A group of small soldiers
    const cx = this.x;
    const cy = this.y - this.z;
    const color = this.color;
    const headColor = adjustColor(color, 40);

    this.soldierOffsets.forEach(off => {
        const sx = cx + off.x;
        const sy = cy + off.y;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 6 + this.z, 2, 1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (Cylinder/Rect)
        ctx.fillStyle = color;
        ctx.fillRect(sx - 1.5, sy - 4, 3, 5);

        // Head (Sphere)
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(sx, sy - 5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Simple Arms/Weapon
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy - 2);
        ctx.lineTo(sx + 3, sy - 4); // Spear-ish
        ctx.stroke();
    });
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
    this.z = 10;
    this.color = color;
    this.life = 1.0;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.vz = Math.random() * 4 + 2; // Pop up
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.vz -= this.gravity;
    
    if (this.z < 0) {
        this.z = 0;
        this.vz *= -0.5; // Bounce
        this.vx *= 0.8;
        this.vy *= 0.8;
    }
    
    this.life -= 0.03;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    const drawY = this.y - this.z;
    ctx.fillRect(this.x, drawY, 4, 4);
    ctx.globalAlpha = 1.0;
  }
}

// --- Component ---

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStatus,
  onGameOver,
  triggerRestart,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const basesRef = useRef<Base[]>([]);
  const unitsRef = useRef<Unit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const dragStartBaseRef = useRef<Base | null>(null);
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number>(0);

  // Initialize Level
  const initLevel = (width: number, height: number) => {
    basesRef.current = [];
    unitsRef.current = [];
    particlesRef.current = [];

    // Target about 30 nodes
    const targetCount = 30;
    const totalArea = width * height;
    const areaPerNode = totalArea / targetCount;
    let gridStep = Math.sqrt(areaPerNode);
    gridStep = Math.max(80, Math.min(150, gridStep));

    const cols = Math.floor(width / gridStep); 
    const rows = Math.floor(height / gridStep);
    
    const positions: Point[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const margin = 60;
        const xBase = c * gridStep;
        const yBase = r * gridStep;
        
        if (xBase < margin || xBase > width - margin || yBase < margin || yBase > height - margin) continue;

        const x = xBase + gridStep/2 + (Math.random() - 0.5) * (gridStep * 0.6);
        const y = yBase + gridStep/2 + (Math.random() - 0.5) * (gridStep * 0.6);
        
        if (x > margin && x < width - margin && y > margin && y < height - margin) {
            positions.push({ x, y });
        }
      }
    }

    const validPositions: Point[] = [];
    for (const p of positions) {
        let tooClose = false;
        for (const vp of validPositions) {
            const d = (p.x - vp.x)**2 + (p.y - vp.y)**2;
            if (d < 3600) { 
                tooClose = true;
                break;
            }
        }
        if (!tooClose) validPositions.push(p);
    }
    
    validPositions.sort(() => Math.random() - 0.5);
    const finalPositions = validPositions.slice(0, 35);

    if (finalPositions.length === 0) return;

    // 2. Assign Owners
    // Player
    const pPos = finalPositions.pop()!;
    const playerBase = new Base(pPos.x, pPos.y, COLORS.PLAYER, OwnerType.PLAYER);
    playerBase.units = 20;
    basesRef.current.push(playerBase);

    // Enemies
    const enemyColors = [COLORS.ENEMY_1, COLORS.ENEMY_2, COLORS.ENEMY_3, COLORS.ENEMY_4];
    const numEnemies = Math.min(5, Math.ceil(finalPositions.length / 5));

    for (let i = 0; i < numEnemies; i++) {
        if (finalPositions.length === 0) break;
        const pos = finalPositions.pop()!;
        const b = new Base(pos.x, pos.y, enemyColors[i % enemyColors.length], OwnerType.AI);
        b.units = 15;
        basesRef.current.push(b);
    }

    // Neutrals
    while (finalPositions.length > 0) {
      const pos = finalPositions.pop()!;
      const b = new Base(pos.x, pos.y, COLORS.NEUTRAL, OwnerType.NEUTRAL);
      b.units = 5 + Math.floor(Math.random() * 10);
      basesRef.current.push(b);
    }

    // 3. Generate Territories & Calculate Neighbors
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
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d2 = dx*dx + dy*dy;
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

    // 4. Determine Neighbors using grid adjacency
    const directions = [
        {x: CELL_SIZE, y: 0},
        {x: -CELL_SIZE, y: 0},
        {x: 0, y: CELL_SIZE},
        {x: 0, y: -CELL_SIZE}
    ];

    baseCells.forEach((cells, index) => {
        const currentBase = basesRef.current[index];
        cells.forEach(p => {
            directions.forEach(d => {
                const nx = p.x + d.x;
                const ny = p.y + d.y;
                const neighborBase = cellOwnerMap.get(`${nx},${ny}`);
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

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    initLevel(canvas.width, canvas.height);
    
    window.addEventListener('resize', handleResize);

    const createExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 5; i++) {
        particlesRef.current.push(new Particle(x, y, color));
      }
    };

    const sendUnits = (source: Base, target: Base) => {
      // Adjacency check (Strict rule)
      if (!source.neighbors.has(target)) return;

      if (source.units < 2) return;

      const count = Math.floor(source.units / 2);
      source.units -= count;

      for (let i = 0; i < count; i++) {
        // Stagger spawn more for "column" marching effect or keep loose
        setTimeout(() => {
          if (unitsRef.current && source.units >= 0) {
             unitsRef.current.push(new Unit(source, target, source.color));
          }
        }, i * 60); // Slower stagger for pacing
      }
    };

    const render = () => {
      if (!ctx || !canvas) return;
      
      // Draw Ocean Background
      const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
      );
      gradient.addColorStop(0, COLORS.WATER_TOP);
      gradient.addColorStop(1, COLORS.WATER_BOTTOM);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Game Logic
      if (gameStatus === GameStatus.PLAYING) {
          const playerBases = basesRef.current.filter(b => b.ownerType === OwnerType.PLAYER).length;
          const enemyBases = basesRef.current.filter(b => b.ownerType === OwnerType.AI).length;
          if (playerBases > 0 && enemyBases === 0) {
              onGameOver(true);
          } else if (playerBases === 0 && enemyBases > 0) {
             onGameOver(false);
          }
      }

      // Draw Base Territories
      const sortedBases = [...basesRef.current].sort((a,b) => a.y - b.y);

      sortedBases.forEach((base) => {
        if (gameStatus === GameStatus.PLAYING) {
             base.update(true, basesRef.current, sendUnits);
        }
        base.drawTerritory(ctx);
      });

      // Drag Interaction Line
      if (isDraggingRef.current && dragStartBaseRef.current) {
        const start = dragStartBaseRef.current;
        const mouse = mousePosRef.current;
        
        // Find if hovering over a valid target
        let hoveringBase: Base | null = null;
        let minD = Infinity;
        basesRef.current.forEach(base => {
            const dx = mouse.x - base.x;
            const dy = mouse.y - (base.y - 10);
            const d = dx*dx + dy*dy;
            if (d < (base.radius + 30)**2 && d < minD) {
                minD = d;
                hoveringBase = base;
            }
        });

        const isValidTarget = hoveringBase && start.neighbors.has(hoveringBase);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y - 15);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = isValidTarget ? '#FFF' : '#EF5350'; // Red if not valid
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = isValidTarget ? '#FFF' : '#EF5350';
        ctx.fill();
      }

      // Render Objects (Z-sort)
      const renderables: {y: number, draw: () => void}[] = [];

      sortedBases.forEach(base => {
          const isSelected = base === dragStartBaseRef.current;
          const isNeighbor = dragStartBaseRef.current ? dragStartBaseRef.current.neighbors.has(base) : false;
          
          renderables.push({
              y: base.y,
              draw: () => base.drawStructure(ctx, isSelected, isNeighbor)
          });
      });

      unitsRef.current.forEach(u => {
          renderables.push({
              y: u.y,
              draw: () => u.draw(ctx)
          });
      });

      particlesRef.current.forEach(p => {
          renderables.push({
              y: p.y,
              draw: () => p.draw(ctx)
          });
      });

      renderables.sort((a, b) => a.y - b.y);
      renderables.forEach(r => r.draw());

      // Update Loop
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

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, triggerRestart]);


  // Event Handlers
  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    if ('touches' in e) {
        const touch = e.touches[0];
        if(!touch) return { x: 0, y: 0 };
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

    let clickedBase: Base | null = null;
    let minD = Infinity;

    basesRef.current.forEach((base) => {
      const dx = pos.x - base.x;
      const dy = pos.y - (base.y - 10);
      const d = dx*dx + dy*dy;
      if (d < (base.radius + 15)**2 && d < minD) {
         minD = d;
         clickedBase = base;
      }
    });

    if (clickedBase && (clickedBase as Base).ownerType === OwnerType.PLAYER) {
        isDraggingRef.current = true;
        dragStartBaseRef.current = clickedBase;
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameStatus !== GameStatus.PLAYING) return;
    mousePosRef.current = getPos(e);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current || !dragStartBaseRef.current) {
        isDraggingRef.current = false;
        return;
    }
    isDraggingRef.current = false;
    
    const pos = mousePosRef.current;
    const source = dragStartBaseRef.current;

    let target: Base | null = null;
    let minD = Infinity;

    // Find closest base to release point
    basesRef.current.forEach((base) => {
      const dx = pos.x - base.x;
      const dy = pos.y - (base.y - 10);
      const d = dx * dx + dy * dy;
      if (d < (base.radius + 30) * (base.radius + 30) && d < minD) { 
        minD = d;
        target = base;
      }
    });

    // Check neighbors constraint
    if (target && target !== source && source.neighbors.has(target)) {
        sendUnits(source, target);
    }
    
    // Logic to send units (duplicated here to access closure state if needed, but we used the ref function mostly)
    function sendUnits(source: Base, target: Base) {
         if (source.units >= 2) {
             const count = Math.floor(source.units / 2);
             source.units -= count;
             for (let i = 0; i < count; i++) {
                setTimeout(() => {
                   if (unitsRef.current)
                     unitsRef.current.push(new Unit(source, target!, source.color));
                }, i * 60);
             }
        }
    }

    dragStartBaseRef.current = null;
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
};

export default GameCanvas;
