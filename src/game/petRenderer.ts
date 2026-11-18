import { DEFAULT_ROOM_LAYOUT, getHoverEmoteForStats, getPetEvolution } from './petState';
import type {
  MoodBgColor,
  PetAnimation,
  PetId,
  PetStats,
  RoomItemPosition,
  TransientEmoteDescriptor,
  TransientEmoteKind,
} from './petState';

export interface PetRenderConfig {
  petId: PetId;
  animation: PetAnimation;
  stats: PetStats;
  uiBgColor: MoodBgColor;
  roomInventory: string[];
  roomLayout: Record<string, RoomItemPosition>;
  audioMode: 'lofi' | 'rain' | 'none';
  reducedMotion: boolean;
  isSleeping: boolean;
  tasksCompletedCount: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: 'heart' | 'spark' | 'tear' | 'anger' | 'note' | 'rain' | 'sleep';
  color: string;
  size: number;
}

const POOL_SIZE = 72;

export class PetCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime = 0;
  private simTime = 0;

  private pointerX = 0;
  private pointerY = 0;
  private pointer01X = 0.5;
  private pointer01Y = 0.78;
  private pointerActive = false;
  private pointerMoveHold = 0;

  // Autonomous pet movement & sleepy nap state (normalized 0..1 coordinates)
  private petPosX = 0.5;
  private petPosY = 0.78;
  private isMoving = false;
  private facing = 1;
  private wanderTargetX = 0.5;
  private wanderTargetY = 0.79;
  private wanderTimer = 2.6;
  private sleepy = false;
  private sleepyCycleTimer = 7.5;
  private sleepyDuration = 0;
  private awakeHoldTimer = 0;

  private draggingItem: string | null = null;
  private hoveredItem: string | null = null;

  private squashImpulse = 0;
  private blinkTimer = 2.6;
  private blinkAmount = 0;
  private particleTimer = 0;
  private sleepParticleTimer = 0;
  private emoteTimer = 0;
  private readonly emoteDuration = 2.4;
  private emoteDescriptor: TransientEmoteDescriptor | null = null;
  private hoverEmoteCooldown = 0;
  private cursor = 0;
  private particles: Particle[] = [];
  private config: PetRenderConfig;
  private width = 640;
  private height = 360;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, initialConfig: PetRenderConfig) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = context;
    this.config = initialConfig;

    for (let i = 0; i < POOL_SIZE; i += 1) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        kind: 'spark',
        color: '#F59E0B',
        size: 6,
      });
    }
  }

  public updateConfig(next: PetRenderConfig) {
    const prevAnim = this.config.animation;
    const prevPet = this.config.petId;
    const prevSleeping = this.config.isSleeping;
    const prevStats = this.config.stats;
    const prevHasBeanbag = this.hasItem('Beanbag Chair');
    this.config = next;
    const nowHasBeanbag = this.hasItem('Beanbag Chair');

    if (next.isSleeping) {
      this.sleepy = true;
    } else if (prevSleeping && !next.isSleeping) {
      this.sleepy = false;
      this.awakeHoldTimer = 5.0;
      this.sleepyCycleTimer = 14.0;
      this.squashImpulse = 0.25;
    }

    if (prevAnim !== next.animation || prevPet !== next.petId) {
      this.squashImpulse = 0.25;
      this.spawnBurstForAnimation(next.animation);
      if (next.animation !== 'Idle' && !next.isSleeping) {
        this.sleepy = false;
        this.awakeHoldTimer = 3.0;
      }
    }
    if (!prevHasBeanbag && nowHasBeanbag && next.animation === 'Idle') {
      this.sleepyCycleTimer = Math.min(this.sleepyCycleTimer, 3.5);
    }

    if (
      this.pointerActive &&
      (prevSleeping !== next.isSleeping ||
        prevStats.happiness !== next.stats.happiness ||
        prevStats.hunger !== next.stats.hunger)
    ) {
      this.triggerHoverEmote(true);
    }
  }

  public resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
  }

  public triggerHoverEmote(force = false) {
    if (!force && (this.emoteTimer > 0 || this.hoverEmoteCooldown > 0)) {
      return;
    }
    this.emoteDescriptor = getHoverEmoteForStats(
      this.config.stats,
      this.config.isSleeping || (this.sleepy && !this.isMoving)
    );
    this.emoteTimer = this.emoteDuration;
    this.hoverEmoteCooldown = 3.2;
  }

  public setPointer(normX: number, normY: number, active: boolean) {
    const wasActive = this.pointerActive;
    const clampedX = Math.max(-1, Math.min(1, normX));
    const clampedY = Math.max(-1, Math.min(1, normY));
    const next01X = (clampedX + 1) * 0.5;
    const next01Y = (clampedY + 1) * 0.5;

    const moved =
      Math.hypot(next01X - this.pointer01X, next01Y - this.pointer01Y) > 0.008;

    this.pointerX = clampedX;
    this.pointerY = clampedY;
    this.pointer01X = next01X;
    this.pointer01Y = next01Y;
    this.pointerActive = active;

    if (!active) {
      this.hoverEmoteCooldown = 0;
      return;
    }

    if (!wasActive && active) {
      this.triggerHoverEmote(true);
    } else if (active && moved && this.emoteTimer <= 0 && this.hoverEmoteCooldown <= 0) {
      this.triggerHoverEmote(false);
    }

    if (active && moved && !this.draggingItem && !this.config.isSleeping) {
      this.pointerMoveHold = 2.0;
      if (this.sleepy) {
        this.sleepy = false;
        this.sleepyCycleTimer = 10;
      }
    }
  }

  public setDraggingItem(itemName: string | null) {
    this.draggingItem = itemName;
  }

  public setHoveredItem(itemName: string | null) {
    this.hoveredItem = itemName;
  }

  public getPetStateInfo(): {
    x: number;
    y: number;
    sleepy: boolean;
    moving: boolean;
    emote: TransientEmoteKind | null;
  } {
    return {
      x: Number(this.petPosX.toFixed(3)),
      y: Number(this.petPosY.toFixed(3)),
      sleepy: this.sleepy,
      moving: this.isMoving,
      emote: this.emoteTimer > 0 ? this.emoteDescriptor?.kind ?? null : null,
    };
  }

  public hitTestPet(nx01: number, ny01: number): boolean {
    const px = nx01 * this.width;
    const py = ny01 * this.height;
    const isSleepyNap =
      this.sleepy &&
      !this.isMoving &&
      (this.config.animation === 'Idle' || this.config.isSleeping);
    const petScreenX = this.petPosX * this.width;
    const petCenterY = this.petPosY * this.height - (isSleepyNap ? 26 : 54);
    const dx = px - petScreenX;
    const dy = py - petCenterY;
    const radius = isSleepyNap ? 64 : 58;
    return dx * dx + dy * dy <= radius * radius;
  }

  private getItemPos01(itemName: string): RoomItemPosition {
    if (itemName === 'Fish Bowl' && !this.config.roomLayout['Fish Bowl']) {
      const table = this.config.roomLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
      return { x: table.x, y: table.y - 0.16 };
    }
    return this.config.roomLayout[itemName] ?? DEFAULT_ROOM_LAYOUT[itemName] ?? { x: 0.5, y: 0.8 };
  }

  private getFurnitureHitboxPx(itemName: string): { x: number; y: number; hw: number; hh: number } {
    const pos = this.getItemPos01(itemName);
    const cx = pos.x * this.width;
    const cy = pos.y * this.height;
    switch (itemName) {
      case 'Fish Bowl':
        return { x: cx, y: cy - 16, hw: 28, hh: 26 };
      case 'Cozy Table':
        return { x: cx, y: cy - 22, hw: 56, hh: 36 };
      case 'Beanbag Chair':
        return { x: cx, y: cy - 14, hw: 46, hh: 28 };
      case 'Potted Plant':
        return { x: cx, y: cy - 30, hw: 28, hh: 38 };
      case 'Warm Floor Lamp':
        return { x: cx, y: cy - 58, hw: 28, hh: 66 };
      case 'Bookshelf':
        return { x: cx, y: cy - 48, hw: 38, hh: 56 };
      case 'Disco Ball':
        return { x: cx, y: cy, hw: 26, hh: 26 };
      case 'Soft Rug':
        return { x: cx, y: cy, hw: 86, hh: 20 };
      default:
        return { x: cx, y: cy, hw: 34, hh: 28 };
    }
  }

  public hitTestFurniture(nx01: number, ny01: number): string | null {
    const px = nx01 * this.width;
    const py = ny01 * this.height;
    // Top-most rendered items tested first
    const drawOrder = [
      'Fish Bowl',
      'Cozy Table',
      'Beanbag Chair',
      'Potted Plant',
      'Warm Floor Lamp',
      'Bookshelf',
      'Disco Ball',
      'Soft Rug',
    ];
    for (const itemName of drawOrder) {
      if (!this.hasItem(itemName)) continue;
      const box = this.getFurnitureHitboxPx(itemName);
      if (Math.abs(px - box.x) <= box.hw && Math.abs(py - box.y) <= box.hh) {
        return itemName;
      }
    }
    return null;
  }

  public triggerPetTap() {
    this.squashImpulse = this.config.isSleeping ? 0.16 : 0.35;
    if (!this.config.isSleeping) {
      this.sleepy = false;
      this.awakeHoldTimer = 4.5;
      this.sleepyCycleTimer = 11.0;
    }

    const cx = this.petPosX * this.width;
    const cy = this.petPosY * this.height - 54;
    for (let i = 0; i < (this.config.isSleeping ? 3 : 6); i += 1) {
      this.spawnParticle({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 24,
        vx: (Math.random() - 0.5) * 44,
        vy: -36 - Math.random() * 44,
        maxLife: 0.9 + Math.random() * 0.4,
        kind: this.config.isSleeping
          ? 'sleep'
          : this.config.animation === 'Angry_Hiss'
            ? 'anger'
            : 'heart',
        color: this.config.isSleeping
          ? '#CBD5E1'
          : this.config.animation === 'Angry_Hiss'
            ? '#EF4444'
            : '#F59E0B',
        size: this.config.isSleeping ? 12 : 8,
      });
    }
  }

  private spawnBurstForAnimation(anim: PetAnimation) {
    const cx = this.petPosX * this.width;
    const cy = this.petPosY * this.height - 52;
    if (anim === 'Happy_Bounce' || anim === 'Comforting_Nuzzle') {
      for (let i = 0; i < 9; i += 1) {
        this.spawnParticle({
          x: cx + (Math.random() - 0.5) * 90,
          y: cy + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 55,
          vy: -40 - Math.random() * 50,
          maxLife: 1.0 + Math.random() * 0.5,
          kind: anim === 'Comforting_Nuzzle' ? 'heart' : 'spark',
          color: anim === 'Comforting_Nuzzle' ? '#F472B6' : '#FACC15',
          size: 8,
        });
      }
    } else if (anim === 'Sad_Ears_Down') {
      for (let i = 0; i < 4; i += 1) {
        this.spawnParticle({
          x: cx + (Math.random() - 0.5) * 64,
          y: cy - 10,
          vx: (Math.random() - 0.5) * 14,
          vy: 24 + Math.random() * 20,
          maxLife: 0.9,
          kind: 'tear',
          color: '#60A5FA',
          size: 5,
        });
      }
    } else if (anim === 'Angry_Hiss') {
      for (let i = 0; i < 5; i += 1) {
        this.spawnParticle({
          x: cx + (i % 2 === 0 ? -56 : 56),
          y: cy - 42 + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 20,
          vy: -22 - Math.random() * 16,
          maxLife: 0.85,
          kind: 'anger',
          color: '#F87171',
          size: 9,
        });
      }
    }
  }

  private spawnParticle(opts: Omit<Particle, 'active' | 'life'>) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    p.active = true;
    p.life = 0;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx;
    p.vy = opts.vy;
    p.maxLife = opts.maxLife;
    p.kind = opts.kind;
    p.color = opts.color;
    p.size = opts.size;
  }

  public start() {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.step(dt);
      this.draw();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private step(dt: number) {
    const motionScale = this.config.reducedMotion ? 0.15 : 1;
    this.simTime += dt * motionScale;

    if (this.squashImpulse > 0) {
      this.squashImpulse = Math.max(0, this.squashImpulse - dt * 2.5);
    }
    if (this.awakeHoldTimer > 0) {
      this.awakeHoldTimer = Math.max(0, this.awakeHoldTimer - dt);
    }
    if (this.pointerMoveHold > 0) {
      this.pointerMoveHold = Math.max(0, this.pointerMoveHold - dt);
    }
    if (this.emoteTimer > 0) {
      this.emoteTimer = Math.max(0, this.emoteTimer - dt);
    }
    if (this.hoverEmoteCooldown > 0) {
      this.hoverEmoteCooldown = Math.max(0, this.hoverEmoteCooldown - dt);
    }

    // Autonomous Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAmount = 1;
      this.blinkTimer = 2.4 + Math.random() * 2.8;
    }
    if (this.blinkAmount > 0) {
      this.blinkAmount = Math.max(0, this.blinkAmount - dt * 7);
    }

    // Autonomous sleepy cycle, sustained Sleep Mode & movement on studio grid
    const anim = this.config.animation;
    const forcedSleep = this.config.isSleeping;
    const canMove =
      !this.config.reducedMotion &&
      (forcedSleep || (anim !== 'Angry_Hiss' && anim !== 'Sad_Ears_Down'));

    if (forcedSleep) {
      this.sleepy = true;
    } else if (anim === 'Idle' && this.awakeHoldTimer <= 0 && !this.draggingItem) {
      if (!this.sleepy) {
        if (this.pointerMoveHold <= 0) {
          this.sleepyCycleTimer -= dt;
          if (this.sleepyCycleTimer <= 0) {
            this.sleepy = true;
            // Longer natural naps (22-28 seconds)
            this.sleepyDuration = 22 + Math.random() * 6;
          }
        }
      } else {
        this.sleepyDuration -= dt;
        if (this.sleepyDuration <= 0) {
          this.sleepy = false;
          this.sleepyCycleTimer = 12 + Math.random() * 6;
        }
      }
    } else if (anim !== 'Idle') {
      this.sleepy = false;
    }

    let targetX = this.petPosX;
    let targetY = this.petPosY;
    let speed = 0.15;

    if (canMove) {
      if (this.sleepy) {
        if (this.hasItem('Beanbag Chair')) {
          const bb = this.getItemPos01('Beanbag Chair');
          targetX = bb.x;
          targetY = Math.max(0.71, bb.y - 0.045);
          speed = forcedSleep ? 0.23 : 0.19;
        } else {
          targetX = this.petPosX;
          targetY = this.petPosY;
        }
      } else if (this.pointerActive && !this.draggingItem) {
        // Follow cursor across the room floor grid
        targetX = Math.max(0.11, Math.min(0.89, this.pointer01X));
        targetY = Math.max(0.74, Math.min(0.89, this.pointer01Y));
        speed = 0.28;
      } else {
        // Gentle idle roaming
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTargetX = 0.22 + Math.random() * 0.56;
          this.wanderTargetY = 0.76 + Math.random() * 0.1;
          this.wanderTimer = 3.4 + Math.random() * 2.8;
        }
        targetX = this.wanderTargetX;
        targetY = this.wanderTargetY;
        speed = 0.12;
      }
    }

    const dx = targetX - this.petPosX;
    const dy = targetY - this.petPosY;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.012 && canMove) {
      const stepDist = Math.min(dist, speed * dt);
      this.petPosX += (dx / dist) * stepDist;
      this.petPosY += (dy / dist) * stepDist;
      this.isMoving = true;
      if (Math.abs(dx) > 0.004) {
        this.facing = dx >= 0 ? 1 : -1;
      }
    } else {
      this.isMoving = false;
    }

    const cx = this.petPosX * this.width;
    const cy = this.petPosY * this.height - 54;

    // Sleepy Z particles when curled up sideways napping
    if (this.sleepy && !this.isMoving && (anim === 'Idle' || forcedSleep) && !this.config.reducedMotion) {
      this.sleepParticleTimer += dt;
      if (this.sleepParticleTimer >= (forcedSleep ? 0.75 : 0.95)) {
        this.sleepParticleTimer = 0;
        this.spawnParticle({
          x: cx - 22,
          y: cy + 8,
          vx: -8 + Math.random() * 14,
          vy: -24,
          maxLife: 1.5,
          kind: 'sleep',
          color: '#CBD5E1',
          size: 13,
        });
      }
    }

    // Continuous Ambient Particles (Rain, Tears, Music Notes)
    if (!this.config.reducedMotion) {
      this.particleTimer += dt;
      if (this.config.audioMode === 'rain' && this.particleTimer >= 0.05) {
        this.particleTimer = 0;
        this.spawnParticle({
          x: Math.random() * this.width,
          y: -10,
          vx: -18,
          vy: 230 + Math.random() * 90,
          maxLife: 1.8,
          kind: 'rain',
          color: 'rgba(147, 197, 253, 0.55)',
          size: 11,
        });
      } else if (this.particleTimer >= 0.45) {
        this.particleTimer = 0;
        if (anim === 'Sad_Ears_Down') {
          this.spawnParticle({
            x: cx + (Math.random() > 0.5 ? -20 : 20),
            y: cy - 22,
            vx: 0,
            vy: 30,
            maxLife: 0.9,
            kind: 'tear',
            color: '#60A5FA',
            size: 4.5,
          });
        } else if (anim === 'Angry_Hiss' && !this.sleepy) {
          this.spawnParticle({
            x: cx + (Math.random() > 0.5 ? -44 : 44),
            y: cy - 48 + (Math.random() - 0.5) * 14,
            vx: (Math.random() - 0.5) * 18,
            vy: -24 - Math.random() * 14,
            maxLife: 0.8,
            kind: 'anger',
            color: '#EF4444',
            size: 9,
          });
        }

        if (this.config.audioMode === 'lofi') {
          this.spawnParticle({
            x: cx + (Math.random() > 0.5 ? -86 : 86),
            y: cy - 22,
            vx: (Math.random() - 0.5) * 18,
            vy: -28,
            maxLife: 1.5,
            kind: 'note',
            color: '#93C5FD',
            size: 13,
          });
        }
      }
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private hasItem(name: string): boolean {
    return this.config.roomInventory.some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Room Wall Backdrop tinted clearly by mood ui_bg_color
    const wallTop =
      this.config.uiBgColor === '#1F2937'
        ? '#13213C'
        : this.config.uiBgColor === '#8B0000'
          ? '#3B080C'
          : this.config.uiBgColor === '#D4AF37'
            ? '#241D0B'
            : '#141622';
    const wallBottom =
      this.config.uiBgColor === '#1F2937'
        ? '#1E3A5F'
        : this.config.uiBgColor === '#8B0000'
          ? '#6E1117'
          : this.config.uiBgColor === '#D4AF37'
            ? '#3B2F13'
            : '#1E1E2E';

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, wallTop);
    bgGrad.addColorStop(1, wallBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle studio wall grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const step = 34;
    for (let gx = step; gx < w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h * 0.72);
      ctx.stroke();
    }

    // Room Floor Horizon + subtle navigable floor grid
    const floorY = h * 0.72;
    ctx.fillStyle = '#242638';
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(0, floorY, w, 1.5);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let gx = step; gx < w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, floorY);
      ctx.lineTo(gx + (gx - w * 0.5) * 0.18, h);
      ctx.stroke();
    }
    for (const fy of [floorY + (h - floorY) * 0.35, floorY + (h - floorY) * 0.7]) {
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(w, fy);
      ctx.stroke();
    }

    // Subtle floor target ring when cursor is actively guiding pet
    if (this.pointerActive && !this.draggingItem && !this.sleepy && this.config.animation !== 'Angry_Hiss' && this.config.animation !== 'Sad_Ears_Down') {
      const tx = Math.max(0.11, Math.min(0.89, this.pointer01X)) * w;
      const ty = Math.max(0.74, Math.min(0.89, this.pointer01Y)) * h;
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 18, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Room Furniture Layer (in user-customizable positions)
    if (this.hasItem('Soft Rug')) {
      const p = this.getItemPos01('Soft Rug');
      this.drawSoftRug(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Disco Ball')) {
      const p = this.getItemPos01('Disco Ball');
      this.drawDiscoBall(ctx, p.x * w, p.y * h, this.simTime);
    }
    if (this.hasItem('Bookshelf')) {
      const p = this.getItemPos01('Bookshelf');
      this.drawBookshelf(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Warm Floor Lamp')) {
      const p = this.getItemPos01('Warm Floor Lamp');
      this.drawWarmFloorLamp(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Potted Plant')) {
      const p = this.getItemPos01('Potted Plant');
      this.drawPottedPlant(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Beanbag Chair')) {
      const p = this.getItemPos01('Beanbag Chair');
      this.drawBeanbagChair(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Cozy Table')) {
      const p = this.getItemPos01('Cozy Table');
      this.drawCozyTable(ctx, p.x * w, p.y * h);
    }
    if (this.hasItem('Fish Bowl')) {
      const p = this.getItemPos01('Fish Bowl');
      this.drawFishBowl(ctx, p.x * w, p.y * h, this.simTime);
    }

    // Highlight border when hovering or dragging a piece of furniture
    const highlightItem = this.draggingItem ?? this.hoveredItem;
    if (highlightItem && this.hasItem(highlightItem)) {
      const box = this.getFurnitureHitboxPx(highlightItem);
      ctx.save();
      ctx.strokeStyle = this.draggingItem ? '#60A5FA' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(box.x - box.hw, box.y - box.hh, box.hw * 2, box.hh * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(box.x - 42, box.y - box.hh - 22, 84, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '500 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(highlightItem, box.x, box.y - box.hh - 10);
      ctx.restore();
    }

    // 2. Compute Pet Pose & Moving Coordinates
    const anim = this.config.animation;
    const t = this.simTime;
    const isSleepyNap = this.sleepy && !this.isMoving && (anim === 'Idle' || this.config.isSleeping);
    const evo = getPetEvolution(this.config.tasksCompletedCount);

    let offsetX = 0;
    let offsetY = 0;
    let scaleX = 1;
    let scaleY = 1;
    let tilt = 0;

    if (isSleepyNap) {
      // Gentle slow breathing on sideways curled sleeping body
      offsetY = 3;
      scaleX = 1 + Math.sin(t * 1.4) * 0.018;
      scaleY = 1 - Math.sin(t * 1.4) * 0.016;
      tilt = 0;
    } else if (anim === 'Idle') {
      const walkBob = this.isMoving ? Math.abs(Math.sin(t * 11)) * 7 : 0;
      offsetY = Math.sin(t * 2.2) * 2.5 - walkBob;
      scaleY = 1 + Math.sin(t * 2.2) * 0.018;
      scaleX = 1 - Math.sin(t * 2.2) * 0.012;
      tilt = this.isMoving ? Math.sin(t * 11) * 0.045 : 0;
    } else if (anim === 'Happy_Bounce') {
      const hop = Math.abs(Math.sin(t * 5.2));
      offsetY = -hop * 28;
      scaleX = 1 - hop * 0.08 + (1 - hop) * 0.09;
      scaleY = 1 + hop * 0.1 - (1 - hop) * 0.08;
      tilt = Math.sin(t * 2.6) * 0.05;
    } else if (anim === 'Angry_Hiss') {
      offsetX = Math.sin(t * 36) * 1.5;
      offsetY = 3;
      scaleX = 1.05;
      scaleY = 0.94;
    } else if (anim === 'Sad_Ears_Down') {
      offsetY = 10 + Math.sin(t * 1.2) * 2;
      scaleX = 1.04;
      scaleY = 0.91;
      tilt = -0.04;
    } else if (anim === 'Comforting_Nuzzle') {
      offsetX = Math.sin(t * 1.8) * 6;
      offsetY = -2 + Math.sin(t * 2.4) * 3;
      tilt = Math.sin(t * 1.8) * 0.08;
    }

    if (this.squashImpulse > 0) {
      scaleX += this.squashImpulse * 0.28;
      scaleY -= this.squashImpulse * 0.22;
    }

    const basePetX = this.petPosX * w;
    const basePetY = this.petPosY * h;
    const petX = basePetX + offsetX;
    const petBaseY = basePetY + offsetY;

    // Ground shadow (softened when on beanbag)
    const shadowScale = Math.max(0.65, 1 - Math.abs(offsetY) / 90);
    ctx.fillStyle = isSleepyNap && this.hasItem('Beanbag Chair')
      ? 'rgba(0, 0, 0, 0.22)'
      : 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(
      basePetX,
      basePetY + 4,
      (isSleepyNap ? 66 : 62) * shadowScale,
      (isSleepyNap ? 14 : 12) * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Level 4 Ascended Golden Aura behind pet
    if (evo.level >= 4) {
      const auraR = (isSleepyNap ? 86 : 104) + Math.sin(t * 2.2) * 6;
      const auraCenterY = petBaseY - (isSleepyNap ? 28 : 62);
      const evoAura = ctx.createRadialGradient(petX, auraCenterY, 16, petX, auraCenterY, auraR);
      evoAura.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
      evoAura.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = evoAura;
      ctx.beginPath();
      ctx.arc(petX, auraCenterY, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm Comfort Aura
    if (anim === 'Comforting_Nuzzle' && !isSleepyNap) {
      const auraR = 96 + Math.sin(t * 3) * 6;
      const aura = ctx.createRadialGradient(petX, petBaseY - 56, 18, petX, petBaseY - 56, auraR);
      aura.addColorStop(0, 'rgba(244, 114, 182, 0.22)');
      aura.addColorStop(1, 'rgba(244, 114, 182, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(petX, petBaseY - 56, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Active Pet Character (upright or sideways sleeping pose + evolution upgrades)
    ctx.save();
    ctx.translate(petX, petBaseY);
    ctx.rotate(tilt);
    ctx.scale(scaleX, scaleY);
    if (isSleepyNap) {
      if (this.config.petId === 'Barnaby') {
        this.drawBarnabySleeping(ctx, t, evo.level);
      } else if (this.config.petId === 'Bloop') {
        this.drawBloopSleeping(ctx, t, evo.level);
      } else if (this.config.petId === 'Rex') {
        this.drawRexSleeping(ctx, t, evo.level);
      } else if (this.config.petId === 'Otto') {
        this.drawOttoSleeping(ctx, t, evo.level);
      } else {
        this.drawKuroSleeping(ctx, t, evo.level);
      }
    } else {
      if (this.config.petId === 'Barnaby') {
        this.drawBarnaby(ctx, anim, t, evo.level);
      } else if (this.config.petId === 'Bloop') {
        this.drawBloop(ctx, anim, t, evo.level);
      } else if (this.config.petId === 'Rex') {
        this.drawRex(ctx, anim, t, evo.level);
      } else if (this.config.petId === 'Otto') {
        this.drawOtto(ctx, anim, t, evo.level);
      } else {
        this.drawKuro(ctx, anim, t, evo.level);
      }
    }
    ctx.restore();

    // Soft peaceful dimming vignette when Sleep Mode is active
    if (this.config.isSleeping) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Transient Hover Emote above Pet's Head
    if (this.emoteTimer > 0 && this.emoteDescriptor) {
      this.drawTransientEmote(ctx, petX, petBaseY, this.emoteDescriptor, isSleepyNap);
    }

    // 4. Pooled Particles (Hearts, Sparks, Tears, Rain, Notes, Sleep Z)
    this.drawParticles(ctx);

    ctx.restore();
  }

  private drawTransientEmote(
    ctx: CanvasRenderingContext2D,
    petX: number,
    petBaseY: number,
    emote: TransientEmoteDescriptor,
    isSleepyNap: boolean
  ) {
    const progress = Math.max(0, Math.min(1, 1 - this.emoteTimer / this.emoteDuration));
    const fadeIn = Math.min(1, progress / 0.14);
    const fadeOut = progress > 0.72 ? Math.max(0, (1 - progress) / 0.28) : 1;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.01) return;

    const popScale =
      progress < 0.14 ? 0.65 + (progress / 0.14) * 0.45 : progress < 0.24 ? 1.1 - ((progress - 0.14) / 0.1) * 0.1 : 1;
    const floatY = -progress * 15;
    const swayX = Math.sin(progress * Math.PI * 3) * 2.5;
    const headOffsetX = isSleepyNap ? -24 : 0;
    const headOffsetY = isSleepyNap ? -92 : -146;
    const ex = Math.max(36, Math.min(this.width - 36, petX + headOffsetX + swayX));
    const ey = Math.max(44, petBaseY + headOffsetY + floatY);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ex, ey);
    ctx.scale(popScale, popScale);

    // Bubble tail + rounded comic emote badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = emote.color;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.roundRect(-20, -19, 40, 34, 11);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(0, 21);
    ctx.lineTo(5, 14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.strokeStyle = emote.color;
    ctx.beginPath();
    ctx.moveTo(-5, 15);
    ctx.lineTo(0, 21);
    ctx.lineTo(5, 15);
    ctx.stroke();

    // Draw crisp icon inside bubble
    ctx.fillStyle = emote.color;
    ctx.strokeStyle = emote.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (emote.kind === 'heart') {
      const s = 6.2;
      ctx.beginPath();
      ctx.moveTo(0, s * 1.05);
      ctx.bezierCurveTo(-s * 2.1, -s * 0.85, -s * 1.05, -s * 2.25, 0, -s * 0.75);
      ctx.bezierCurveTo(s * 1.05, -s * 2.25, s * 2.1, -s * 0.85, 0, s * 1.05);
      ctx.fill();
    } else if (emote.kind === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 9.5 : 4.2;
        const sx = Math.cos(ang) * r;
        const sy = -2 + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    } else if (emote.kind === 'question') {
      ctx.font = '700 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, -1);
    } else if (emote.kind === 'hungry') {
      // Cozy food bowl + steam/alert dot
      ctx.beginPath();
      ctx.arc(0, 1, 8.5, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = emote.accent;
      ctx.beginPath();
      ctx.arc(0, -6.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (emote.kind === 'sad') {
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(7.5, 0, 5.5, 5.5);
      ctx.arc(0, 4, 6, 0.25, Math.PI - 0.25);
      ctx.quadraticCurveTo(-7.5, 0, 0, -10);
      ctx.fill();
    } else if (emote.kind === 'anger') {
      ctx.lineWidth = 2.4;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(dx * 3, -2 + dy * 3);
        ctx.quadraticCurveTo(dx * 1.2, -2 + dy * 7.5, dx * 7, -2 + dy * 6.5);
        ctx.stroke();
      }
    } else {
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Zzz', 0, -2);
    }

    ctx.restore();
  }

  private drawSoftRug(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(x, y, 84, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.ellipse(x, y, 72, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 60, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBeanbagChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 46, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 44, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.ellipse(x - 10, y - 24, 28, 20, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(x - 16, y - 30, 11, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Proper sturdy wooden study table (wide rectangular top + 4 legs + drawer)
  private drawCozyTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    // Floor shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 56, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back legs
    ctx.fillStyle = '#5C2B0B';
    ctx.fillRect(x - 42, y - 42, 6, 42);
    ctx.fillRect(x + 36, y - 42, 6, 42);

    // Front legs
    ctx.fillStyle = '#78350F';
    ctx.fillRect(x - 48, y - 38, 7, 45);
    ctx.fillRect(x + 41, y - 38, 7, 45);

    // Table apron + drawer
    ctx.fillStyle = '#92400E';
    ctx.fillRect(x - 46, y - 44, 92, 16);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(x - 24, y - 41, 48, 10);
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(x, y - 36, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Solid wide wooden tabletop
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.roundRect(x - 54, y - 54, 108, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.roundRect(x - 52, y - 54, 104, 5, 3);
    ctx.fill();
    ctx.restore();
  }

  // Glass Fish Bowl (sits on top of Cozy Table or anywhere dragged)
  private drawFishBowl(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.save();
    // Base ring
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glass globe outline & water fill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 19, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Water volume inside lower globe
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y - 19, 19, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(14, 165, 233, 0.48)';
    ctx.fillRect(x - 22, y - 24, 44, 28);

    // Pebbles
    ctx.fillStyle = '#94A3B8';
    for (const px of [-10, -4, 3, 9]) {
      ctx.beginPath();
      ctx.ellipse(x + px, y - 3, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Little green sea plant
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 3);
    ctx.quadraticCurveTo(x - 13, y - 13, x - 8, y - 19);
    ctx.stroke();

    // Swimming goldfish inside bowl
    const fx = x + Math.sin(t * 2.1) * 8;
    const fy = y - 14 + Math.cos(t * 2.7) * 3;
    const dir = Math.cos(t * 2.1) >= 0 ? 1 : -1;
    ctx.fillStyle = '#FB923C';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 5.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - dir * 5, fy);
    ctx.lineTo(fx - dir * 9.5, fy - 3);
    ctx.lineTo(fx - dir * 9.5, fy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top rim & glass specular shine
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - 37, 11, 3.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x - 6, y - 22, 12, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();
  }

  private drawPottedPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leaves
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 3;
    for (const [lx, ly, rot] of [
      [-14, -46, -0.5],
      [14, -48, 0.5],
      [0, -58, 0],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - 22);
      ctx.lineTo(x + lx, y + ly);
      ctx.stroke();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.ellipse(x + lx, y + ly, 10, 6, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // Terracotta pot
    ctx.fillStyle = '#C2410C';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 24);
    ctx.lineTo(x + 16, y - 24);
    ctx.lineTo(x + 12, y + 2);
    ctx.lineTo(x - 12, y + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.roundRect(x - 18, y - 28, 36, 7, 3);
    ctx.fill();
    ctx.restore();
  }

  private drawWarmFloorLamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    // Warm light cone
    const glow = ctx.createRadialGradient(x, y - 92, 6, x, y - 56, 76);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 62, 76, 0, Math.PI * 2);
    ctx.fill();

    // Base & stand
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 86);
    ctx.stroke();

    // Lampshade
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 112);
    ctx.lineTo(x + 15, y - 112);
    ctx.lineTo(x + 22, y - 82);
    ctx.lineTo(x - 22, y - 82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(x, y - 82, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 38, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabinet frame
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.roundRect(x - 34, y - 102, 68, 104, 4);
    ctx.fill();

    // Shelf recesses
    for (const sy of [-94, -62, -30]) {
      ctx.fillStyle = '#451A03';
      ctx.fillRect(x - 28, y + sy, 56, 26);
    }

    // Colorful book spines
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7'];
    for (let row = 0; row < 3; row += 1) {
      const sy = y - 92 + row * 32;
      for (let b = 0; b < 5; b += 1) {
        ctx.fillStyle = colors[(row * 2 + b) % colors.length];
        ctx.fillRect(x - 24 + b * 9, sy + 4, 7, 20);
      }
    }
    ctx.restore();
  }

  private drawDiscoBall(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.save();
    // Cord
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y - 20);
    ctx.stroke();

    // Shimmer rays
    for (let i = 0; i < 6; i += 1) {
      const ang = t * 0.9 + (i * Math.PI) / 3;
      const rx = x + Math.cos(ang) * 140;
      const ry = y + 90 + Math.sin(ang * 1.3) * 38;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(96, 165, 250, 0.22)';
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sphere
    const grad = ctx.createRadialGradient(x - 6, y - 6, 3, x, y, 22);
    grad.addColorStop(0, '#F8FAFC');
    grad.addColorStop(1, '#64748B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, Math.PI * 2);
    ctx.fill();

    // Facet grid
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y + 20);
    ctx.stroke();
    ctx.restore();
  }

  private drawEvolutionHalo(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, evoLevel: number) {
    if (evoLevel < 4) return;
    const bob = Math.sin(t * 2.4) * 2.5;
    ctx.save();
    ctx.translate(x, y + bob);
    // Floating Golden Celestial Halo + Orbiting Star Motes
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3.2;
    ctx.shadowColor = 'rgba(250, 204, 21, 0.65)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FEF08A';
    for (const side of [-1, 1]) {
      const mx = Math.cos(t * 2.8 + (side > 0 ? Math.PI : 0)) * 28;
      const my = Math.sin(t * 2.8 + (side > 0 ? Math.PI : 0)) * 6;
      ctx.beginPath();
      ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCollarStarMedal(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#FACC15') {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 7.5 : 3.4;
      const sx = Math.cos(ang) * r;
      const sy = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Pet 1: Kuro (The Cyber-Cat) - Upright Active Pose
  private drawKuro(ctx: CanvasRenderingContext2D, anim: PetAnimation, t: number, evoLevel: number) {
    const tailSpeed =
      anim === 'Happy_Bounce' ? 6.5 : anim === 'Angry_Hiss' ? 9 : anim === 'Sad_Ears_Down' ? 1.0 : 2.6;
    const tailAmp = anim === 'Angry_Hiss' ? 16 : anim === 'Sad_Ears_Down' ? 5 : 22;
    const tailWag = Math.sin(t * tailSpeed) * tailAmp;

    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(34, -22);
    ctx.bezierCurveTo(72, -26, 78 + tailWag * 0.5, -72, 62 + tailWag, -92);
    ctx.stroke();
    ctx.strokeStyle = evoLevel >= 2 ? '#60A5FA' : '#38BDF8';
    ctx.lineWidth = evoLevel >= 2 ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(62 + tailWag * 0.85, -83);
    ctx.lineTo(62 + tailWag, -92);
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -32, 42, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lv.3+ Cyber Scarf draped across chest
    if (evoLevel >= 3) {
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.roundRect(-28, -60, 56, 14, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -50);
      ctx.lineTo(24, -22);
      ctx.lineTo(8, -24);
      ctx.closePath();
      ctx.fill();
    }

    // Collar + bell (Upgrades to star badge at Lv.2+)
    ctx.strokeStyle = anim === 'Angry_Hiss' ? '#EF4444' : '#3B82F6';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -64, 28, Math.PI * 0.22, Math.PI * 0.78);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, 0, -38, '#FACC15');
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, -39, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Paws
    const pawY = anim === 'Happy_Bounce' ? -10 : -4;
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.8;
    for (const px of [-20, 20]) {
      ctx.beginPath();
      ctx.ellipse(px, pawY, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Head
    const headDrop = anim === 'Sad_Ears_Down' ? 8 : 0;
    ctx.save();
    ctx.translate(0, -86 + headDrop);

    const earDroop = anim === 'Sad_Ears_Down' ? 0.45 : anim === 'Comforting_Nuzzle' ? 0.12 : 0;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 32, -22);
      ctx.rotate(side * (0.22 + earDroop));
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * -14, 14);
      ctx.lineTo(side * -4, -26);
      ctx.lineTo(side * 16, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = anim === 'Angry_Hiss' ? '#EF4444' : '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(side * -7, 8);
      ctx.lineTo(side * -2, -14);
      ctx.lineTo(side * 8, 5);
      ctx.closePath();
      ctx.fill();
      // Lv.3+ sleek ear cyber fins
      if (evoLevel >= 3) {
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(side * 10, -4);
        ctx.lineTo(side * 20, -18);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-48, -32, 96, 68, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0B0F19';
    ctx.beginPath();
    ctx.roundRect(-38, -20, 76, 46, 22);
    ctx.fill();

    // Lv.2+ Forehead cyber chevron crest
    if (evoLevel >= 2) {
      ctx.strokeStyle = evoLevel >= 4 ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -25);
      ctx.lineTo(0, -18);
      ctx.lineTo(10, -25);
      ctx.stroke();
    }

    const eyeColor =
      anim === 'Angry_Hiss'
        ? '#F87171'
        : anim === 'Comforting_Nuzzle'
          ? '#F472B6'
          : anim === 'Sad_Ears_Down'
            ? '#60A5FA'
            : anim === 'Happy_Bounce'
              ? '#34D399'
              : '#38BDF8';
    this.drawExpressiveEyes(ctx, anim, eyeColor, false);
    this.drawMouthAndWhiskers(ctx, anim, '#F472B6', '#CBD5E1', true);
    this.drawEvolutionHalo(ctx, 0, -54, t, evoLevel);
    ctx.restore();
  }

  // Pet 1: Kuro Sideways Curled Sleeping Pose
  private drawKuroSleeping(ctx: CanvasRenderingContext2D, t: number, evoLevel: number) {
    const tailTip = Math.sin(t * 0.9) * 3;

    // Horizontal curled body lying on side
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(8, -22, 48, 25, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tail curled snugly around back & bottom edge
    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(50, -18);
    ctx.bezierCurveTo(68, -6, 48, 8, 12 + tailTip, 3);
    ctx.stroke();
    ctx.strokeStyle = evoLevel >= 2 ? '#60A5FA' : '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22 + tailTip * 0.5, 4);
    ctx.lineTo(12 + tailTip, 3);
    ctx.stroke();
    ctx.restore();

    // Collar + Lv.3 scarf wrapped cleanly around lying neck
    if (evoLevel >= 3) {
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.ellipse(-18, -26, 12, 18, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(-18, -24, 15, -Math.PI * 0.4, Math.PI * 0.65);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -18, -10, '#FACC15');
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(-18, -11, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tucked front paws resting flat under cheek
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.8;
    for (const [px, py] of [
      [-42, -3],
      [-14, -2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px, py, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Head resting sideways low on paws
    ctx.save();
    ctx.translate(-30, -32);
    ctx.rotate(-0.18);

    // Relaxed ears angled softly sideways
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 24, -18);
      ctx.rotate(side * 0.48);
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * -11, 10);
      ctx.lineTo(side * -3, -20);
      ctx.lineTo(side * 12, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(side * -5, 6);
      ctx.lineTo(side * -1, -11);
      ctx.lineTo(side * 6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-36, -24, 72, 52, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0B0F19';
    ctx.beginPath();
    ctx.roundRect(-28, -15, 56, 35, 16);
    ctx.fill();

    if (evoLevel >= 2) {
      ctx.strokeStyle = evoLevel >= 4 ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-8, -19);
      ctx.lineTo(0, -13);
      ctx.lineTo(8, -19);
      ctx.stroke();
    }

    // Closed peaceful curved eyes
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (const ex of [-13, 13]) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, -1);
      ctx.quadraticCurveTo(ex, 4, ex + 6, -1);
      ctx.stroke();
    }
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.moveTo(-2.5, 6);
    ctx.lineTo(2.5, 6);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, 11);
    ctx.quadraticCurveTo(0, 14, 5, 11);
    ctx.stroke();

    this.drawEvolutionHalo(ctx, 0, -40, t, evoLevel);
    ctx.restore();
  }

  // Pet 2: Barnaby (The Golden Retriever) - Upright Active Pose
  private drawBarnaby(ctx: CanvasRenderingContext2D, anim: PetAnimation, t: number, evoLevel: number) {
    const tailSpeed = anim === 'Happy_Bounce' ? 11 : anim === 'Sad_Ears_Down' ? 1.2 : 5.5;
    const tailWag = Math.sin(t * tailSpeed) * (anim === 'Sad_Ears_Down' ? 7 : 26);

    ctx.save();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(32, -24);
    ctx.quadraticCurveTo(68, -42, 66 + tailWag, -76);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -32, 44, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(0, -28, 22, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lv.3+ Cozy Crimson Hero Bandana
    if (evoLevel >= 3) {
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-28, -56);
      ctx.lineTo(28, -56);
      ctx.lineTo(0, -26);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -64, 28, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, 0, -36, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, -37, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const pawY = anim === 'Happy_Bounce' ? -10 : -4;
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.8;
    for (const px of [-20, 20]) {
      ctx.beginPath();
      ctx.ellipse(px, pawY, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const headDrop = anim === 'Sad_Ears_Down' ? 9 : 0;
    ctx.save();
    ctx.translate(0, -86 + headDrop);

    const earLift = anim === 'Happy_Bounce' ? -0.25 : anim === 'Sad_Ears_Down' ? 0.25 : 0;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 42, -12);
      ctx.rotate(side * (0.2 + earLift));
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(0, 20, 14, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lv.2+ Fluffy Hero Tuft Crest
    if (evoLevel >= 2) {
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.moveTo(-10, -32);
      ctx.quadraticCurveTo(0, -48, 8, -32);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-46, -34, 92, 68, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(0, 12, 24, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawExpressiveEyes(ctx, anim, '#1E293B', false);

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(0, 6, 7.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (anim === 'Happy_Bounce' || anim === 'Idle') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.roundRect(-5, 16, 10, 12, 5);
      ctx.fill();
    }
    this.drawMouthAndWhiskers(ctx, anim, '#1E293B', '#78350F', false);
    this.drawEvolutionHalo(ctx, 0, -54, t, evoLevel);
    ctx.restore();
  }

  // Pet 2: Barnaby Sideways Curled Sleeping Pose
  private drawBarnabySleeping(ctx: CanvasRenderingContext2D, t: number, evoLevel: number) {
    const tailTip = Math.sin(t * 1.1) * 4;

    // Relaxed tail resting low along the floor/beanbag
    ctx.save();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(46, -14);
    ctx.quadraticCurveTo(68, -8 + tailTip * 0.4, 62, 2 + tailTip);
    ctx.stroke();
    ctx.restore();

    // Horizontal curled golden torso lying on its side
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(10, -22, 48, 25, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cream belly patch facing front while lying sideways
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(12, -12, 28, 12, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Back hind leg tucked curled
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(42, -9, 17, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Collar + Lv.3 bandana tucked neatly at sideways neck
    if (evoLevel >= 3) {
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.ellipse(-18, -24, 11, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-18, -24, 15, -Math.PI * 0.35, Math.PI * 0.6);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -18, -10, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-18, -11, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Front paws stretched forward under resting chin
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.8;
    for (const [px, py] of [
      [-46, -3],
      [-16, -2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px, py, 14, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Sideways resting head tucked low on paws
    ctx.save();
    ctx.translate(-30, -30);
    ctx.rotate(-0.16);

    if (evoLevel >= 2) {
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.moveTo(-8, -25);
      ctx.quadraticCurveTo(0, -37, 7, -25);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-36, -26, 72, 52, 26);
    ctx.fill();
    ctx.stroke();

    // Muzzle + nose
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(-4, 10, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(-6, 5, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, 13);
    ctx.quadraticCurveTo(-5, 16, 1, 13);
    ctx.stroke();

    // Closed sleeping eyes
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.6;
    for (const ex of [-17, 7]) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, -3);
      ctx.quadraticCurveTo(ex, 2, ex + 6, -3);
      ctx.stroke();
    }

    // Floppy retriever ear draped softly downward across cheek
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.ellipse(24, 6, 12, 22, -0.25, 0, Math.PI * 2);
    ctx.fill();

    this.drawEvolutionHalo(ctx, 0, -40, t, evoLevel);
    ctx.restore();
  }

  // Pet 3: Bloop (Shape-Shifting Alien) - Upright Active Pose
  private drawBloop(ctx: CanvasRenderingContext2D, anim: PetAnimation, t: number, evoLevel: number) {
    const wobble = Math.sin(t * 4) * 4;
    const blobColor =
      anim === 'Angry_Hiss'
        ? '#F87171'
        : anim === 'Sad_Ears_Down'
          ? '#60A5FA'
          : anim === 'Comforting_Nuzzle'
            ? '#A78BFA'
            : '#2DD4BF';
    const outlineColor =
      anim === 'Angry_Hiss'
        ? '#B91C1C'
        : anim === 'Sad_Ears_Down'
          ? '#1D4ED8'
          : '#0F766E';

    const antDroop = anim === 'Sad_Ears_Down' ? 18 : 0;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(side * 18, -94);
      ctx.quadraticCurveTo(
        side * 28,
        -122 + antDroop,
        side * (26 + wobble * 0.4),
        -128 + antDroop
      );
      ctx.stroke();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(side * (26 + wobble * 0.4), -128 + antDroop, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = blobColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (anim === 'Sad_Ears_Down') {
      ctx.ellipse(0, -28, 62, 34, 0, 0, Math.PI * 2);
    } else if (anim === 'Angry_Hiss') {
      ctx.moveTo(-48, -6);
      ctx.lineTo(-56, -42);
      ctx.lineTo(-34, -88);
      ctx.lineTo(0, -104);
      ctx.lineTo(34, -88);
      ctx.lineTo(56, -42);
      ctx.lineTo(48, -6);
      ctx.closePath();
    } else {
      ctx.moveTo(-48, -10);
      ctx.bezierCurveTo(-56, -64, -36, -102 + wobble * 0.3, 0, -102 + wobble * 0.3);
      ctx.bezierCurveTo(36, -102 + wobble * 0.3, 56, -64, 48, -10);
      ctx.quadraticCurveTo(0, 6, -48, -10);
    }
    ctx.fill();
    ctx.stroke();

    // Lv.3+ Luminous cosmic ring around Bloop
    if (evoLevel >= 3) {
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -34, 64, 14, -0.14, 0, Math.PI);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-18, -72, 12, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Lv.2+ Forehead Star Gem
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, 0, -82, '#FACC15');
    }

    ctx.save();
    ctx.translate(0, anim === 'Sad_Ears_Down' ? -36 : -58);
    this.drawExpressiveEyes(ctx, anim, '#0F172A', false);
    this.drawMouthAndWhiskers(ctx, anim, '#0F172A', '#0F172A', false);
    ctx.restore();

    this.drawEvolutionHalo(ctx, 0, -138, t, evoLevel);
  }

  // Pet 3: Bloop Sideways Lounging Sleeping Puddle Pose
  private drawBloopSleeping(ctx: CanvasRenderingContext2D, t: number, evoLevel: number) {
    // Wide low sideways jelly mound
    ctx.fillStyle = '#2DD4BF';
    ctx.strokeStyle = '#0F766E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(4, -19, 58, 22, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (evoLevel >= 3) {
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(4, -18, 66, 12, -0.08, 0, Math.PI);
      ctx.stroke();
    }

    // Antennae drooping lazily to the side
    for (const [ax, ay] of [
      [14, -36],
      [34, -32],
    ] as const) {
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ax - 12, -32);
      ctx.quadraticCurveTo(ax + 6, ay - 6, ax + 16, ay + 4);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(ax + 16, ay + 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -20, -32, '#FACC15');
    }

    ctx.save();
    ctx.translate(-22, -19);
    ctx.rotate(-0.18);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (const ex of [-13, 13]) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, -2);
      ctx.quadraticCurveTo(ex, 3, ex + 6, -2);
      ctx.stroke();
    }
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5, 7);
    ctx.quadraticCurveTo(0, 10, 5, 7);
    ctx.stroke();
    ctx.restore();

    this.drawEvolutionHalo(ctx, -18, -54, t, evoLevel);
  }

  // Pet 4: Rex (German Shepherd Puppy) - Upright Active Pose
  private drawRex(ctx: CanvasRenderingContext2D, anim: PetAnimation, t: number, evoLevel: number) {
    const tailSpeed = anim === 'Happy_Bounce' ? 11.5 : anim === 'Sad_Ears_Down' ? 1.4 : 6;
    const tailWag = Math.sin(t * tailSpeed) * (anim === 'Sad_Ears_Down' ? 6 : 24);

    // Bushy German Shepherd two-tone tail (black dorsal + warm tan undercoat)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1F242D';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(30, -24);
    ctx.quadraticCurveTo(66, -42, 65 + tailWag, -76);
    ctx.stroke();

    ctx.strokeStyle = '#D99B52';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(31, -21);
    ctx.quadraticCurveTo(64, -38, 63 + tailWag * 0.9, -71);
    ctx.stroke();
    ctx.restore();

    // Warm tan puppy torso
    ctx.fillStyle = '#D99B52';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -31, 42, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Signature dark charcoal-black German Shepherd saddle across shoulders/back
    ctx.fillStyle = '#1F242D';
    ctx.beginPath();
    ctx.ellipse(0, -40, 34, 21, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();

    // Warm cream-tan chest fur tuft
    ctx.fillStyle = '#F4CFA0';
    ctx.beginPath();
    ctx.ellipse(0, -26, 20, 23, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lv.3+ Guard K9 Teal Bandana
    if (evoLevel >= 3) {
      ctx.fillStyle = '#0D9488';
      ctx.strokeStyle = '#115E59';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-27, -55);
      ctx.lineTo(27, -55);
      ctx.lineTo(0, -25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Cobalt Puppy Collar & Gold Tag / Lv.2+ Star Medal
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -63, 27, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, 0, -35, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, -36, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tan puppy paws with subtle toe marks
    const pawY = anim === 'Happy_Bounce' ? -10 : -4;
    ctx.fillStyle = '#E7B574';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 1.8;
    for (const px of [-19, 19]) {
      ctx.beginPath();
      ctx.ellipse(px, pawY, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Puppy Head (big perked pointed ears, dark mask, tan eyebrow pips)
    const headDrop = anim === 'Sad_Ears_Down' ? 9 : 0;
    ctx.save();
    ctx.translate(0, -85 + headDrop);

    const earSpread = anim === 'Sad_Ears_Down' ? 0.42 : anim === 'Happy_Bounce' ? -0.05 : 0.08;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 24, -26);
      ctx.rotate(side * earSpread);
      // Big alert German Shepherd puppy ear (black outer + rim for dark background contrast)
      ctx.fillStyle = '#1F242D';
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.quadraticCurveTo(-8, -42, side * 5, -46);
      ctx.quadraticCurveTo(16, -24, 15, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Warm tan inner ear & soft pink center
      ctx.fillStyle = '#D99B52';
      ctx.beginPath();
      ctx.moveTo(-7, 5);
      ctx.lineTo(side * 3, -32);
      ctx.lineTo(8, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#E6A89C';
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(side * 2, -21);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Lv.2+ Puppy Forehead Tuft Crest
    if (evoLevel >= 2) {
      ctx.fillStyle = '#1F242D';
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, -32);
      ctx.quadraticCurveTo(0, -47, 8, -32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Head base in warm tan
    ctx.fillStyle = '#D99B52';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-43, -33, 86, 66, 32);
    ctx.fill();
    ctx.stroke();

    // Classic German Shepherd dark widow's-peak forehead & eye mask
    ctx.fillStyle = '#1F242D';
    ctx.beginPath();
    ctx.moveTo(-26, -32);
    ctx.lineTo(26, -32);
    ctx.quadraticCurveTo(32, -8, 22, 6);
    ctx.lineTo(-22, 6);
    ctx.quadraticCurveTo(-32, -8, -26, -32);
    ctx.closePath();
    ctx.fill();

    // Warm tan cheeks & lighter tan muzzle
    ctx.fillStyle = '#F4CFA0';
    ctx.beginPath();
    ctx.ellipse(0, 14, 24, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark GSD muzzle bridge / snout mask
    ctx.fillStyle = '#2A303C';
    ctx.beginPath();
    ctx.ellipse(0, 8, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Classic German Shepherd Tan Eyebrow Pips
    ctx.fillStyle = '#F4CFA0';
    for (const bx of [-17, 17]) {
      ctx.beginPath();
      ctx.ellipse(bx, -14, 5.5, 3.6, bx < 0 ? -0.25 : 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright expressive puppy eyes (light outline backing for dark Shepherd mask)
    if (anim !== 'Happy_Bounce' && anim !== 'Comforting_Nuzzle') {
      ctx.fillStyle = '#F8FAFC';
      for (const ex of [-18, 18]) {
        ctx.beginPath();
        ctx.arc(ex, -2, 8.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.drawExpressiveEyes(
      ctx,
      anim,
      anim === 'Happy_Bounce' || anim === 'Comforting_Nuzzle' ? '#F8FAFC' : '#0F172A',
      false
    );

    // Nose
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(0, 6, 7.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Happy puppy tongue
    if (anim === 'Happy_Bounce' || anim === 'Idle') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.roundRect(-5, 16, 10, 11, 5);
      ctx.fill();
    }
    this.drawMouthAndWhiskers(ctx, anim, '#0F172A', '#5C3A21', false);
    this.drawEvolutionHalo(ctx, 0, -76, t, evoLevel);
    ctx.restore();
  }

  // Pet 4: Rex Sideways Curled Sleeping Pose
  private drawRexSleeping(ctx: CanvasRenderingContext2D, t: number, evoLevel: number) {
    const tailTip = Math.sin(t * 1.1) * 4;

    // Relaxed bushy two-tone Shepherd tail curled neatly along floor/beanbag
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1F242D';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(45, -14);
    ctx.quadraticCurveTo(67, -8 + tailTip * 0.4, 62, 2 + tailTip);
    ctx.stroke();
    ctx.strokeStyle = '#D99B52';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(46, -12);
    ctx.quadraticCurveTo(65, -6 + tailTip * 0.4, 60, 3 + tailTip);
    ctx.stroke();
    ctx.restore();

    // Horizontal curled warm tan puppy torso lying on its side
    ctx.fillStyle = '#D99B52';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(10, -22, 47, 24, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark Shepherd dorsal saddle along top of sleeping torso
    ctx.fillStyle = '#1F242D';
    ctx.beginPath();
    ctx.ellipse(14, -31, 35, 14, -0.05, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // Cream-tan belly patch
    ctx.fillStyle = '#F4CFA0';
    ctx.beginPath();
    ctx.ellipse(10, -12, 26, 11, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Tucked hind puppy leg
    ctx.fillStyle = '#C78642';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(41, -9, 16, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Collar + Lv.3 K9 Teal Bandana at sideways neck
    if (evoLevel >= 3) {
      ctx.fillStyle = '#0D9488';
      ctx.beginPath();
      ctx.ellipse(-18, -24, 11, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-18, -24, 15, -Math.PI * 0.35, Math.PI * 0.6);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -18, -10, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-18, -11, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Front tan paws stretched out under resting chin
    ctx.fillStyle = '#E7B574';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 1.8;
    for (const [px, py] of [
      [-45, -3],
      [-15, -2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px, py, 14, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Sideways resting GSD puppy head tucked on paws
    ctx.save();
    ctx.translate(-30, -30);
    ctx.rotate(-0.15);

    // Tall pointed Shepherd ears angled gently back while sleeping
    for (const [ex, erot] of [
      [-12, -0.35],
      [14, 0.28],
    ] as const) {
      ctx.save();
      ctx.translate(ex, -20);
      ctx.rotate(erot);
      ctx.fillStyle = '#1F242D';
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-11, 6);
      ctx.quadraticCurveTo(-4, -30, 3, -32);
      ctx.quadraticCurveTo(13, -14, 11, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#D99B52';
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(2, -21);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Head outline in warm tan + dark mask
    ctx.fillStyle = '#D99B52';
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-35, -25, 70, 50, 25);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1F242D';
    ctx.beginPath();
    ctx.moveTo(-22, -24);
    ctx.lineTo(20, -24);
    ctx.quadraticCurveTo(24, -4, 15, 6);
    ctx.lineTo(-22, 6);
    ctx.closePath();
    ctx.fill();

    // Tan eyebrow pips + muzzle
    ctx.fillStyle = '#F4CFA0';
    for (const bx of [-16, 6]) {
      ctx.beginPath();
      ctx.ellipse(bx, -11, 4.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-5, 10, 20, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(-7, 5, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5C3A21';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 13);
    ctx.quadraticCurveTo(-6, 16, 0, 13);
    ctx.stroke();

    // Closed peaceful sleeping arcs (light slate-white on dark mask)
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2.5;
    for (const ex of [-17, 6]) {
      ctx.beginPath();
      ctx.moveTo(ex - 6, -3);
      ctx.quadraticCurveTo(ex, 2, ex + 6, -3);
      ctx.stroke();
    }

    this.drawEvolutionHalo(ctx, 0, -46, t, evoLevel);
    ctx.restore();
  }

  // Pet 5: Otto (Smooth Black & Tan Dachshund) - Upright Side-Profile Pose
  private drawOtto(ctx: CanvasRenderingContext2D, anim: PetAnimation, t: number, evoLevel: number) {
    // Flip horizontally to face movement direction cleanly when walking right vs left
    const dir = this.isMoving ? -this.facing : 1;
    const tailSpeed = anim === 'Happy_Bounce' ? 12 : anim === 'Sad_Ears_Down' ? 1.5 : 6.2;
    const tailWag = Math.sin(t * tailSpeed) * (anim === 'Sad_Ears_Down' ? 4 : 14);
    const legStride = this.isMoving ? Math.sin(t * 14) * 5 : 0;

    ctx.save();
    ctx.scale(dir, 1);

    // 1. Slender tapering Dachshund tail (black top, mahogany-tan underside)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1A1D24';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(46, -34);
    ctx.quadraticCurveTo(68, -42 + tailWag * 0.4, 72, -58 + tailWag);
    ctx.stroke();

    ctx.strokeStyle = '#B86B32';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(48, -32);
    ctx.quadraticCurveTo(67, -40 + tailWag * 0.4, 70, -55 + tailWag);
    ctx.stroke();
    ctx.restore();

    // 2. Far-side stubby mahogany-tan legs (back & front)
    const pawLift = anim === 'Happy_Bounce' ? -4 : 0;
    ctx.fillStyle = '#9A5424';
    ctx.strokeStyle = '#3F4756';
    ctx.lineWidth = 1.6;
    // Far hind leg
    ctx.beginPath();
    ctx.roundRect(26 - legStride * 0.6, -24 + pawLift, 11, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(29 - legStride * 0.6, -4 + pawLift, 7.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Far front leg
    ctx.beginPath();
    ctx.roundRect(-24 + legStride * 0.6, -24 + pawLift, 11, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-27 + legStride * 0.6, -4 + pawLift, 7.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Signature long low Dachshund sausage torso & proud curved chest
    ctx.fillStyle = '#1A1D24';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-34, -44);
    ctx.bezierCurveTo(-18, -50, 26, -50, 48, -39);
    ctx.bezierCurveTo(56, -32, 54, -18, 42, -16);
    ctx.bezierCurveTo(22, -14, -10, -14, -30, -16);
    ctx.bezierCurveTo(-42, -18, -42, -36, -34, -44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rich mahogany-tan chest & belly-rim accents
    ctx.fillStyle = '#B86B32';
    ctx.beginPath();
    ctx.ellipse(-30, -28, 10, 11, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Subtle glossy coat sheen along back
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -45);
    ctx.quadraticCurveTo(16, -47, 38, -40);
    ctx.stroke();

    // 4. Lv.3+ Forest Emerald Dachshund Knit Bandana / Sweater Collar
    if (evoLevel >= 3) {
      ctx.fillStyle = '#059669';
      ctx.strokeStyle = '#065F46';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-38, -56);
      ctx.lineTo(-14, -52);
      ctx.lineTo(-28, -26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 5. Near-side stubby mahogany-tan legs (front & back)
    ctx.fillStyle = '#B86B32';
    ctx.strokeStyle = '#6B3B18';
    ctx.lineWidth = 1.8;
    // Near hind leg (with slight haunch curve like photo)
    ctx.beginPath();
    ctx.ellipse(37, -23 + pawLift, 9.5, 13, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C87A3E';
    ctx.beginPath();
    ctx.roundRect(33 + legStride * 0.7, -22 + pawLift, 11, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(35 + legStride * 0.7, -3 + pawLift, 8.5, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Near front leg
    ctx.fillStyle = '#C87A3E';
    ctx.beginPath();
    ctx.roundRect(-18 - legStride * 0.7, -23 + pawLift, 11.5, 19, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-21 - legStride * 0.7, -3 + pawLift, 8.5, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 6. Proud lifted Dachshund Neck + Amber Leather Collar
    const headDrop = anim === 'Sad_Ears_Down' ? 9 : 0;
    const headTilt = anim === 'Comforting_Nuzzle' ? -0.14 : anim === 'Sad_Ears_Down' ? -0.22 : 0;

    ctx.fillStyle = '#1A1D24';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-36, -34);
    ctx.quadraticCurveTo(-39, -58, -32, -70 + headDrop * 0.7);
    ctx.lineTo(-14, -66 + headDrop * 0.7);
    ctx.quadraticCurveTo(-12, -46, -15, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Amber-gold collar (turns Crimson Red when Angry) + tag / Lv.2+ star medal
    ctx.strokeStyle = anim === 'Angry_Hiss' ? '#DC2626' : '#D97706';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-36, -54 + headDrop * 0.4);
    ctx.quadraticCurveTo(-25, -49 + headDrop * 0.4, -14, -52 + headDrop * 0.4);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -32, -42 + headDrop * 0.4, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-32, -44 + headDrop * 0.4, 4.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Sleek Dachshund Head & Tapered Snout (facing left in local space)
    ctx.save();
    ctx.translate(-27, -75 + headDrop);
    ctx.rotate(headTilt);

    // Lv.2+ Sleek Crown Crest
    if (evoLevel >= 2) {
      ctx.fillStyle = '#B86B32';
      ctx.beginPath();
      ctx.moveTo(-6, -19);
      ctx.quadraticCurveTo(2, -31, 9, -18);
      ctx.closePath();
      ctx.fill();
    }

    // Cranium + tapered long muzzle (black top, mahogany-tan lower jaw/muzzle)
    ctx.fillStyle = '#1A1D24';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.quadraticCurveTo(18, -22, 0, -22);
    ctx.quadraticCurveTo(-14, -22, -22, -10);
    ctx.lineTo(-42, -5);
    ctx.quadraticCurveTo(-48, 2, -42, 9);
    ctx.lineTo(-16, 12);
    ctx.quadraticCurveTo(8, 14, 18, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rich mahogany-tan lower muzzle, jaw, & cheek spots (just like photo!)
    ctx.fillStyle = '#B86B32';
    ctx.beginPath();
    ctx.moveTo(-43, 2);
    ctx.lineTo(-18, 2);
    ctx.quadraticCurveTo(-8, 3, -6, 12);
    ctx.lineTo(-39, 9);
    ctx.quadraticCurveTo(-45, 7, -43, 2);
    ctx.closePath();
    ctx.fill();

    // Warm tan cheek pip + throat spot
    ctx.beginPath();
    ctx.ellipse(-6, 6, 7.5, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Classic Dachshund tan eyebrow pip
    ctx.fillStyle = '#D1864B';
    ctx.beginPath();
    ctx.ellipse(-13, -13, 4.5, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dark glossy nose tip
    ctx.fillStyle = '#090B0E';
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-44, -2, 4.8, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Happy puppy tongue / snarling or frowning mouth line
    if (anim === 'Happy_Bounce') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.roundRect(-34, 8, 7, 9, 3.5);
      ctx.fill();
    }
    ctx.strokeStyle = anim === 'Angry_Hiss' ? '#FCA5A5' : '#5C2E11';
    ctx.lineWidth = anim === 'Angry_Hiss' ? 2.1 : 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (anim === 'Angry_Hiss') {
      // Fierce snarl line with tiny bared canine tooth
      ctx.moveTo(-38, 7.5);
      ctx.quadraticCurveTo(-30, 1.5, -21, 7.5);
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(-33, 5.5);
      ctx.lineTo(-30.5, 10.5);
      ctx.lineTo(-28, 5.2);
      ctx.closePath();
      ctx.fill();
    } else if (anim === 'Sad_Ears_Down') {
      ctx.moveTo(-36, 7);
      ctx.quadraticCurveTo(-28, 3, -22, 7);
      ctx.stroke();
    } else {
      ctx.moveTo(-37, 5);
      ctx.quadraticCurveTo(-29, 9, -22, 4);
      ctx.stroke();
    }

    // Expressive Dachshund eye (with crisp highlight / mood)
    const eyeX = -14;
    const eyeY = -6;
    const isBlinking =
      this.blinkAmount > 0.45 && anim !== 'Happy_Bounce' && anim !== 'Comforting_Nuzzle';
    ctx.save();
    if (isBlinking) {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(eyeX - 5, eyeY);
      ctx.quadraticCurveTo(eyeX, eyeY + 3, eyeX + 5, eyeY);
      ctx.stroke();
    } else if (anim === 'Happy_Bounce' || anim === 'Comforting_Nuzzle') {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(eyeX - 5, eyeY + 1);
      ctx.quadraticCurveTo(eyeX, eyeY - 5, eyeX + 5, eyeY + 1);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 6.2, anim === 'Angry_Hiss' ? 4.4 : 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = anim === 'Angry_Hiss' ? '#7F1D1D' : '#1E1B18';
      ctx.beginPath();
      ctx.arc(eyeX - 1.2, eyeY + (anim === 'Angry_Hiss' ? 0.5 : 0), anim === 'Angry_Hiss' ? 3.5 : 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(eyeX - 2.3, eyeY - 1.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (anim === 'Angry_Hiss') {
        // Furrowed angry brow slanting fiercely DOWN toward the snout (left)
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(eyeX + 7, eyeY - 9.5);
        ctx.lineTo(eyeX - 7, eyeY - 3);
        ctx.stroke();
      } else if (anim === 'Sad_Ears_Down') {
        ctx.strokeStyle = '#93C5FD';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eyeX - 6, eyeY - 4);
        ctx.lineTo(eyeX + 5, eyeY - 8);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (anim === 'Comforting_Nuzzle' || anim === 'Happy_Bounce') {
      ctx.fillStyle = 'rgba(251, 113, 133, 0.42)';
      ctx.beginPath();
      ctx.ellipse(-9, 3, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Velvety Rounded Floppy Dachshund Ear (just like photo!)
    const earFlop =
      anim === 'Happy_Bounce'
        ? -0.18
        : anim === 'Angry_Hiss'
          ? -0.24
          : anim === 'Sad_Ears_Down'
            ? 0.24
            : 0.04;
    ctx.save();
    ctx.translate(4, -10);
    ctx.rotate(earFlop);
    ctx.fillStyle = '#252A34';
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.bezierCurveTo(10, -8, 16, 10, 12, 24);
    ctx.bezierCurveTo(7, 30, -4, 24, -7, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // end head

    ctx.restore(); // end dir scale
    // Keep evolution halo unflipped cleanly above Otto's lifted head
    const haloX = dir * -29;
    this.drawEvolutionHalo(ctx, haloX, -110 + (anim === 'Sad_Ears_Down' ? 9 : 0), t, evoLevel);
  }

  // Pet 5: Otto (Smooth Black & Tan Dachshund) Sideways Curled Sleeping Pose
  private drawOttoSleeping(ctx: CanvasRenderingContext2D, t: number, evoLevel: number) {
    const tailTip = Math.sin(t * 1.1) * 3.5;

    // Slender tapering black & tan tail wrapped gently around rump
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1A1D24';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(50, -14);
    ctx.quadraticCurveTo(70, -6 + tailTip * 0.4, 58, 3 + tailTip);
    ctx.stroke();
    ctx.strokeStyle = '#B86B32';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(52, -12);
    ctx.quadraticCurveTo(68, -5 + tailTip * 0.4, 57, 3 + tailTip);
    ctx.stroke();
    ctx.restore();

    // Long curled black sausage torso lying peacefully on its side
    ctx.fillStyle = '#1A1D24';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(12, -19, 51, 21, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Warm mahogany-tan chest & inner curl curve
    ctx.fillStyle = '#B86B32';
    ctx.beginPath();
    ctx.ellipse(6, -11, 26, 9, -0.04, 0, Math.PI * 2);
    ctx.fill();

    // Tucked stubby tan hind leg
    ctx.fillStyle = '#B86B32';
    ctx.strokeStyle = '#6B3B18';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(42, -9, 13, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Amber Collar + Lv.3 Emerald Bandana + Lv.2 Star Medal at neck
    if (evoLevel >= 3) {
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.ellipse(-22, -21, 10, 14, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.arc(-22, -21, 13, -Math.PI * 0.35, Math.PI * 0.6);
    ctx.stroke();
    if (evoLevel >= 2) {
      this.drawCollarStarMedal(ctx, -22, -8, '#FACC15');
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-22, -9, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stubby mahogany-tan front paws stretched forward under snout
    ctx.fillStyle = '#C87A3E';
    ctx.strokeStyle = '#6B3B18';
    ctx.lineWidth = 1.6;
    for (const [px, py] of [
      [-48, -3],
      [-20, -2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(px, py, 10.5, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Sideways resting Dachshund head & tapered snout resting on paws
    ctx.save();
    ctx.translate(-30, -24);
    ctx.rotate(-0.12);

    ctx.fillStyle = '#1A1D24';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.quadraticCurveTo(16, -20, -2, -20);
    ctx.quadraticCurveTo(-16, -20, -24, -8);
    ctx.lineTo(-42, -3);
    ctx.quadraticCurveTo(-47, 4, -41, 10);
    ctx.lineTo(-14, 13);
    ctx.quadraticCurveTo(8, 14, 16, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tan muzzle point & eyebrow pip
    ctx.fillStyle = '#B86B32';
    ctx.beginPath();
    ctx.moveTo(-42, 3);
    ctx.lineTo(-18, 3);
    ctx.quadraticCurveTo(-10, 4, -8, 12);
    ctx.lineTo(-39, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#D1864B';
    ctx.beginPath();
    ctx.ellipse(-14, -11, 4, 2.2, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#090B0E';
    ctx.beginPath();
    ctx.ellipse(-43, -1, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Peaceful closed sleeping eye arc
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.quadraticCurveTo(-14, 1, -8, -4);
    ctx.stroke();

    // Velvety floppy ear draped softly across cheek
    ctx.fillStyle = '#252A34';
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1, -12);
    ctx.bezierCurveTo(13, -12, 18, 6, 12, 19);
    ctx.bezierCurveTo(6, 24, -4, 18, -5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this.drawEvolutionHalo(ctx, -6, -38, t, evoLevel);
    ctx.restore();
  }

  private drawExpressiveEyes(
    ctx: CanvasRenderingContext2D,
    anim: PetAnimation,
    color: string,
    sleepyNap: boolean
  ) {
    const lookX = this.pointerActive
      ? this.pointerX * 4.5
      : this.isMoving
        ? this.facing * 3.5
        : Math.sin(this.simTime * 0.9) * 2;
    const lookY = this.pointerActive ? this.pointerY * 3 : 0;
    const isBlinking =
      this.blinkAmount > 0.45 && anim !== 'Happy_Bounce' && anim !== 'Comforting_Nuzzle';

    for (const side of ['left', 'right'] as const) {
      const x = (side === 'left' ? -18 : 18) + (sleepyNap ? 0 : lookX);
      const y = -2 + (sleepyNap ? 2 : lookY);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      if (sleepyNap) {
        // Closed calm sleeping arcs
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.quadraticCurveTo(x, y + 6, x + 8, y);
        ctx.stroke();
      } else if (isBlinking) {
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 1);
        ctx.quadraticCurveTo(x, y + 4, x + 8, y + 1);
        ctx.stroke();
      } else if (anim === 'Happy_Bounce' || anim === 'Comforting_Nuzzle') {
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 2);
        ctx.quadraticCurveTo(x, y - 7, x + 8, y + 2);
        ctx.stroke();
      } else if (anim === 'Sad_Ears_Down') {
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 7.5, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x - 2, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        if (side === 'left') {
          ctx.moveTo(x - 9, y - 5);
          ctx.lineTo(x + 6, y - 10);
        } else {
          ctx.moveTo(x - 6, y - 10);
          ctx.lineTo(x + 9, y - 5);
        }
        ctx.stroke();
      } else if (anim === 'Angry_Hiss') {
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 7, 4.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color === '#F87171' ? '#F87171' : '#DC2626';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        if (side === 'left') {
          ctx.moveTo(x - 10, y - 9);
          ctx.lineTo(x + 8, y - 3);
        } else {
          ctx.moveTo(x - 8, y - 3);
          ctx.lineTo(x + 10, y - 9);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(x, y, 7.5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x - 2.2, y - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawMouthAndWhiskers(
    ctx: CanvasRenderingContext2D,
    anim: PetAnimation,
    noseColor: string,
    lineColor: string,
    withWhiskers: boolean
  ) {
    if (withWhiskers) {
      ctx.fillStyle = noseColor;
      ctx.beginPath();
      ctx.moveTo(-3, 9);
      ctx.lineTo(3, 9);
      ctx.lineTo(0, 12.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (anim === 'Angry_Hiss' || anim === 'Sad_Ears_Down') {
      ctx.beginPath();
      ctx.moveTo(-7, 19);
      ctx.quadraticCurveTo(0, 13, 7, 19);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-7, 15);
      ctx.quadraticCurveTo(-3.5, 19, 0, 15);
      ctx.quadraticCurveTo(3.5, 19, 7, 15);
      ctx.stroke();
    }

    if (anim === 'Comforting_Nuzzle' || anim === 'Happy_Bounce') {
      ctx.fillStyle = 'rgba(251, 113, 133, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-28, 10, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(28, 10, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (withWhiskers) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 34, 4);
        ctx.lineTo(side * 54, 1);
        ctx.moveTo(side * 34, 10);
        ctx.lineTo(side * 55, 12);
        ctx.stroke();
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      if (p.kind === 'note') {
        ctx.font = `600 ${p.size}px sans-serif`;
        ctx.fillText('♪', p.x, p.y);
      } else if (p.kind === 'sleep') {
        ctx.font = `700 ${p.size}px sans-serif`;
        ctx.fillText('z', p.x, p.y);
      } else if (p.kind === 'rain') {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 3, p.y + p.size);
        ctx.stroke();
      } else if (p.kind === 'tear') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.55, p.size * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'heart') {
        const s = p.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s);
        ctx.bezierCurveTo(p.x - s * 2, p.y - s, p.x - s, p.y - s * 2.4, p.x, p.y - s * 0.8);
        ctx.bezierCurveTo(p.x + s, p.y - s * 2.4, p.x + s * 2, p.y - s, p.x, p.y + s);
        ctx.fill();
      } else if (p.kind === 'anger') {
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p.x - 4, p.y - 4);
        ctx.lineTo(p.x + 4, p.y + 4);
        ctx.moveTo(p.x + 4, p.y - 4);
        ctx.lineTo(p.x - 4, p.y + 4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
