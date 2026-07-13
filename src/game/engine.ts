import {
  Fruit, SlicedHalf, Particle, SliceTrail, GameState, Vec2, FruitType,
} from './types';
import {
  GRAVITY, MAX_MISSED, TRAIL_LIFETIME, SHAKE_DECAY,
  FRUIT_DEFS, FRUIT_TYPES, COMBO_WINDOW,
} from './constants';

let nextId = 0;

interface BgFruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  emoji: string;
  opacity: number;
}

export class GameEngine {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;

  state: GameState = 'menu';
  score = 0;
  bestCombo = 0;
  missed = 0;
  combo = 0;
  lastSliceTime = 0;
  difficultyTimer = 0;
  spawnTimer = 0;
  spawnInterval = 1200;
  fruitSpeed = 1;
  bombChance = 0.08;
  pendingSpawns = 0;
  spawnAccum = 0;

  fruits: Fruit[] = [];
  slicedHalves: SlicedHalf[] = [];
  particles: Particle[] = [];
  trails: SliceTrail[] = [];
  currentTrail: Vec2[] = [];
  isPointerDown = false;
  pointerPos: Vec2 = { x: 0, y: 0 };
  prevPointerPos: Vec2 = { x: 0, y: 0 };

  shakeX = 0;
  shakeY = 0;
  shakeIntensity = 0;

  lastTime = 0;
  animFrame = 0;
  flashTimer = 0;
  flashColor = '';
  globalTime = 0;

  // Background decoration
  bgFruits: BgFruit[] = [];
  bgSpawnTimer = 0;

  highScores: { score: number; date: string }[] = [];

  onStateChange?: (state: GameState, prevState: GameState) => void;
  onScoreChange?: (score: number, combo: number, missed: number) => void;
  onStartRequest?: () => void;

  emojiCache: Map<string, HTMLCanvasElement> = new Map();
  bgGradient!: CanvasGradient;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.loadHighScores();
    this.setupInput();
    this.initBgFruits();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.emojiCache.clear();

    this.bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.h);
    this.bgGradient.addColorStop(0, '#0a0a2e');
    this.bgGradient.addColorStop(0.5, '#1a1a4e');
    this.bgGradient.addColorStop(1, '#0d0d3b');
  }

  initBgFruits() {
    const emojis = ['🍉', '🍊', '🍎', '🥝', '🥭', '🍓', '🥥'];
    for (let i = 0; i < 8; i++) {
      this.bgFruits.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.3,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.01,
        size: 30 + Math.random() * 25,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        opacity: 0.06 + Math.random() * 0.06,
      });
    }
  }

  setupInput() {
    const getPos = (e: MouseEvent | Touch): Vec2 => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      this.isPointerDown = true;
      this.pointerPos = getPos(e);
      this.prevPointerPos = { ...this.pointerPos };
      this.currentTrail = [{ ...this.pointerPos }];
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isPointerDown) return;
      this.prevPointerPos = { ...this.pointerPos };
      this.pointerPos = getPos(e);
      this.currentTrail.push({ ...this.pointerPos });
      if (this.currentTrail.length > 20) this.currentTrail.shift();
    });

    const onPointerUp = () => {
      this.isPointerDown = false;
      if (this.currentTrail.length > 1) {
        this.trails.push({
          points: [...this.currentTrail],
          life: TRAIL_LIFETIME,
          maxLife: TRAIL_LIFETIME,
        });
      }
      this.currentTrail = [];
    };

    this.canvas.addEventListener('mouseup', onPointerUp);
    this.canvas.addEventListener('mouseleave', () => {
      if (this.isPointerDown) onPointerUp();
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isPointerDown = true;
      this.pointerPos = getPos(e.touches[0]);
      this.prevPointerPos = { ...this.pointerPos };
      this.currentTrail = [{ ...this.pointerPos }];
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isPointerDown) return;
      this.prevPointerPos = { ...this.pointerPos };
      this.pointerPos = getPos(e.touches[0]);
      this.currentTrail.push({ ...this.pointerPos });
      if (this.currentTrail.length > 20) this.currentTrail.shift();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      onPointerUp();
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      onPointerUp();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (this.state === 'menu' || this.state === 'gameover') {
          if (this.onStartRequest) {
            this.onStartRequest();
          } else {
            this.startGame();
          }
        } else if (this.state === 'paused') {
          this.resume();
        }
      }
    });
  }

  startGame() {
    const prevState = this.state;
    this.state = 'playing';
    this.score = 0;
    this.missed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastSliceTime = 0;
    this.difficultyTimer = 0;
    this.spawnTimer = 1500; // Delay before first spawn
    this.spawnInterval = 2000; // Start slower
    this.fruitSpeed = 0.8; // Start slower
    this.bombChance = 0.05;
    this.pendingSpawns = 0;
    this.spawnAccum = 0;
    this.fruits = [];
    this.slicedHalves = [];
    this.particles = [];
    this.trails = [];
    this.currentTrail = [];
    this.shakeIntensity = 0;
    this.flashTimer = 0;
    this.lastTime = performance.now();
    this.onStateChange?.('playing', prevState);
    this.onScoreChange?.(0, 0, 0);
  }

  pause() {
    const prevState = this.state;
    this.state = 'paused';
    this.onStateChange?.('paused', prevState);
  }

  resume() {
    const prevState = this.state;
    this.state = 'playing';
    this.lastTime = performance.now();
    this.onStateChange?.('playing', prevState);
  }

  gameOver() {
    const prevState = this.state;
    this.state = 'gameover';
    this.saveHighScore(this.score);
    this.onStateChange?.('gameover', prevState);
  }

  spawnFruit() {
    if (this.state !== 'playing') return;

    const isBomb = Math.random() < this.bombChance;
    const type: FruitType = isBomb
      ? 'bomb'
      : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)] as FruitType;

    const side = Math.random();
    let x: number, vx: number;

    // Horizontal speed should scale with screen width so it crosses in the same relative time
    const baseVx = (this.w * 0.003) * this.fruitSpeed;

    if (side < 0.3) {
      x = Math.random() * this.w * 0.3;
      vx = baseVx * (0.8 + Math.random() * 0.5); // Move right
    } else if (side > 0.7) {
      x = this.w * 0.7 + Math.random() * this.w * 0.3;
      vx = -baseVx * (0.8 + Math.random() * 0.5); // Move left
    } else {
      x = this.w * 0.2 + Math.random() * this.w * 0.6;
      vx = (Math.random() - 0.5) * baseVx * 1.5; // Move slightly randomly
    }

    // Dynamic gravity based on fruitSpeed squared so parabola shape stays the same when it gets faster
    const fruitGravity = GRAVITY * (this.fruitSpeed * this.fruitSpeed);
    
    // Physics formula: v = sqrt(2 * g * h)
    // We want the fruit to peak at 10% to 40% from the top of the screen
    const targetPeakY = this.h * (0.1 + Math.random() * 0.3);
    const radius = type === 'watermelon' ? 38 : type === 'coconut' ? 34 : 28 + Math.random() * 8;
    const startY = this.h + radius + 10;
    const distanceToPeak = startY - targetPeakY;
    
    // Calculate required initial vertical velocity to perfectly reach the target peak
    const vy = -Math.sqrt(2 * fruitGravity * distanceToPeak);

    const fruit: Fruit = {
      id: nextId++,
      x,
      y: startY,
      vx,
      vy,
      gravityMultiplier: this.fruitSpeed * this.fruitSpeed, // Store multiplier so update loop uses it
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      type,
      sliced: false,
      opacity: 1,
    };

    this.fruits.push(fruit);
  }

  sliceFruit(fruit: Fruit) {
    if (fruit.sliced) return;
    fruit.sliced = true;

    const def = FRUIT_DEFS[fruit.type];
    const now = performance.now();

    if (fruit.type === 'bomb') {
      this.shakeIntensity = 25;
      this.flashTimer = 18;
      this.flashColor = 'rgba(255, 0, 0, 0.35)';
      this.missed = MAX_MISSED;
      this.spawnExplosion(fruit.x, fruit.y);
      this.gameOver();
      return;
    }

    // Combo logic
    if (now - this.lastSliceTime < COMBO_WINDOW) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastSliceTime = now;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    const comboMultiplier = this.combo >= 5 ? 3 : this.combo >= 3 ? 2 : 1;
    const points = def.points * comboMultiplier;
    this.score += points;

    // Juice feedback
    this.shakeIntensity = Math.min(this.shakeIntensity + 5, 14);
    this.flashTimer = 5;
    this.flashColor = this.combo >= 5 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)';

    // Spawn halves
    for (const side of ['left', 'right'] as const) {
      const dir = side === 'left' ? -1 : 1;
      this.slicedHalves.push({
        id: nextId++,
        x: fruit.x + dir * fruit.radius * 0.3,
        y: fruit.y,
        vx: fruit.vx + dir * (2.5 + Math.random() * 3),
        vy: fruit.vy - 1 - Math.random() * 2,
        rotation: fruit.rotation,
        rotationSpeed: dir * (0.06 + Math.random() * 0.12),
        radius: fruit.radius,
        type: fruit.type,
        side,
        opacity: 1,
        life: 70,
      });
    }

    // Juice splash particles
    const juiceCount = this.combo >= 3 ? 18 : 12;
    for (let i = 0; i < juiceCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      this.particles.push({
        x: fruit.x + (Math.random() - 0.5) * fruit.radius * 0.5,
        y: fruit.y + (Math.random() - 0.5) * fruit.radius * 0.5,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 2,
        life: 30 + Math.random() * 25,
        maxLife: 55,
        color: def.juiceColor,
        size: 3 + Math.random() * 6,
        type: 'juice',
        opacity: 1,
      });
    }

    // Spark particles along slice direction
    const sliceAngle = Math.atan2(
      this.pointerPos.y - this.prevPointerPos.y,
      this.pointerPos.x - this.prevPointerPos.x
    );
    for (let i = 0; i < 8; i++) {
      const a = sliceAngle + (Math.random() - 0.5) * 1.8;
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        x: fruit.x,
        y: fruit.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 15 + Math.random() * 12,
        maxLife: 27,
        color: '#ffffff',
        size: 1.5 + Math.random() * 2.5,
        type: 'spark',
        opacity: 1,
      });
    }

    // Score text particle
    const label = this.combo >= 3 ? `+${points} x${this.combo}!` : `+${points}`;
    this.particles.push({
      x: fruit.x,
      y: fruit.y - fruit.radius - 5,
      vx: 0,
      vy: -2.5,
      life: 50,
      maxLife: 50,
      color: this.combo >= 5 ? '#ffd700' : this.combo >= 3 ? '#ff6b6b' : '#ffffff',
      size: this.combo >= 5 ? 26 : this.combo >= 3 ? 22 : 18,
      type: 'text',
      text: label,
      opacity: 1,
    });

    // Combo text
    if (this.combo === 3 || this.combo === 5 || this.combo === 10) {
      const comboLabels: Record<number, string> = { 3: '🔥 COMBO!', 5: '⚡ SUPER!', 10: '💥 INSANE!' };
      this.particles.push({
        x: this.w / 2,
        y: this.h / 2 - 40,
        vx: 0,
        vy: -1,
        life: 60,
        maxLife: 60,
        color: '#ffd700',
        size: 36,
        type: 'text',
        text: comboLabels[this.combo] || '',
        opacity: 1,
      });
    }

    this.onScoreChange?.(this.score, this.combo, this.missed);
  }

  spawnExplosion(x: number, y: number) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 10;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 30 + Math.random() * 35,
        maxLife: 65,
        color: i % 4 === 0 ? '#ff4757' : i % 4 === 1 ? '#ff6b81' : i % 4 === 2 ? '#ffa502' : '#ffda79',
        size: 4 + Math.random() * 8,
        type: i % 3 === 0 ? 'spark' : 'juice',
        opacity: 1,
      });
    }
  }

  checkSlice() {
    if (!this.isPointerDown || this.state !== 'playing') return;

    const dx = this.pointerPos.x - this.prevPointerPos.x;
    const dy = this.pointerPos.y - this.prevPointerPos.y;
    const sliceSpeed = Math.sqrt(dx * dx + dy * dy);

    if (sliceSpeed < 2) return;

    // Check collision along the slice line segment for better accuracy
    for (const fruit of this.fruits) {
      if (fruit.sliced) continue;

      // Point-to-segment distance check for smoother slicing
      const dist = this.pointToSegDist(
        fruit.x, fruit.y,
        this.prevPointerPos.x, this.prevPointerPos.y,
        this.pointerPos.x, this.pointerPos.y
      );

      if (dist < fruit.radius + 8) {
        this.sliceFruit(fruit);
      }
    }
  }

  pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) return Math.sqrt(apx * apx + apy * apy);
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * abx;
    const cy = ay + t * aby;
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  updateBgFruits(dt: number) {
    for (const f of this.bgFruits) {
      f.x += f.vx * (dt / 16);
      f.y += f.vy * (dt / 16);
      f.rotation += f.rotSpeed * (dt / 16);

      // Wrap around
      if (f.y < -f.size) {
        f.y = this.h + f.size;
        f.x = Math.random() * this.w;
      }
      if (f.x < -f.size) f.x = this.w + f.size;
      if (f.x > this.w + f.size) f.x = -f.size;
    }
  }

  update(dt: number) {
    this.globalTime += dt;

    // Always update background
    this.updateBgFruits(dt);

    // Always decay shake (for game over)
    if (this.shakeIntensity > 0.5) {
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= SHAKE_DECAY;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeIntensity = 0;
    }

    if (this.flashTimer > 0) this.flashTimer--;

    // Always update visual particles (for game over effects)
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.type !== 'text') {
        p.vy += GRAVITY * 0.3;
      }
      p.life--;
      p.opacity = Math.max(0, p.life / p.maxLife);
      if (p.type === 'juice') {
        p.size *= 0.97;
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Always update sliced halves
    for (const h of this.slicedHalves) {
      h.x += h.vx;
      h.y += h.vy;
      h.vy += GRAVITY;
      h.rotation += h.rotationSpeed;
      h.life--;
      h.opacity = Math.max(0, h.life / 25);
    }
    this.slicedHalves = this.slicedHalves.filter(h => h.life > 0);

    // Always update trails
    for (const t of this.trails) {
      t.life--;
    }
    this.trails = this.trails.filter(t => t.life > 0);

    if (this.state !== 'playing') return;

    const ms = dt;

    // Difficulty ramp
    this.difficultyTimer += ms;
    if (this.difficultyTimer > 10000) { // Every 10 seconds
      this.difficultyTimer = 0;
      this.spawnInterval = Math.max(400, this.spawnInterval - 100);
      this.fruitSpeed = Math.min(1.8, this.fruitSpeed + 0.08);
      this.bombChance = Math.min(0.20, this.bombChance + 0.015);
    }

    // Spawn fruits (no setTimeout, use accumulator)
    this.spawnTimer += ms;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const count = 1 + (Math.random() < 0.3 ? 1 : 0) + (this.fruitSpeed > 1.3 && Math.random() < 0.25 ? 1 : 0);
      this.pendingSpawns += count;
      this.spawnAccum = 0;
    }

    // Stagger spawns
    if (this.pendingSpawns > 0) {
      this.spawnAccum += ms;
      if (this.spawnAccum >= 80) {
        this.spawnAccum = 0;
        this.pendingSpawns--;
        this.spawnFruit();
      }
    }

    // Update fruits
    for (const f of this.fruits) {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += GRAVITY * (f.gravityMultiplier || 1); // Use dynamic gravity
      f.rotation += f.rotationSpeed;

      // Missed fruit
      if (!f.sliced && f.y > this.h + f.radius + 50) {
        f.sliced = true;
        if (f.type !== 'bomb') {
          this.missed++;
          this.shakeIntensity = 8;
          // Missed flash
          this.flashTimer = 8;
          this.flashColor = 'rgba(255, 0, 0, 0.1)';
          this.onScoreChange?.(this.score, this.combo, this.missed);
          if (this.missed >= MAX_MISSED) {
            this.gameOver();
          }
        }
      }
    }

    // Remove out-of-bounds fruits
    this.fruits = this.fruits.filter(f => !(f.sliced && f.y > this.h + 100));

    // Check slice collisions
    this.checkSlice();
  }

  getEmojiCanvas(emoji: string, size: number): HTMLCanvasElement {
    const roundSize = Math.round(size);
    const key = `${emoji}-${roundSize}`;
    if (this.emojiCache.has(key)) return this.emojiCache.get(key)!;

    const c = document.createElement('canvas');
    const s = roundSize * 2.5;
    c.width = s * this.dpr;
    c.height = s * this.dpr;
    const cx = c.getContext('2d')!;
    cx.scale(this.dpr, this.dpr);
    cx.font = `${roundSize * 1.6}px serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(emoji, s / 2, s / 2);
    this.emojiCache.set(key, c);
    return c;
  }

  drawFruit(f: Fruit) {
    if (f.sliced) return;
    const ctx = this.ctx;
    const def = FRUIT_DEFS[f.type];

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);

    // Glow effect
    ctx.shadowColor = def.juiceColor;
    ctx.shadowBlur = 18;

    // Draw emoji
    const emojiCanvas = this.getEmojiCanvas(def.emoji, f.radius);
    const drawSize = f.radius * 2.5;
    ctx.drawImage(emojiCanvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawSlicedHalf(h: SlicedHalf) {
    const ctx = this.ctx;
    const def = FRUIT_DEFS[h.type];

    ctx.save();
    ctx.globalAlpha = h.opacity;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotation);

    // Draw half fruit (clipped)
    ctx.beginPath();
    if (h.side === 'left') {
      ctx.rect(-h.radius * 1.5, -h.radius * 1.5, h.radius * 1.5, h.radius * 3);
    } else {
      ctx.rect(0, -h.radius * 1.5, h.radius * 1.5, h.radius * 3);
    }
    ctx.clip();

    // Outer rind
    ctx.beginPath();
    ctx.arc(0, 0, h.radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();

    // Inner flesh
    ctx.beginPath();
    ctx.arc(0, 0, h.radius * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = def.innerColor;
    ctx.fill();

    // Seed dots for some fruits
    if (h.type === 'watermelon') {
      ctx.fillStyle = '#1a1a1a';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * h.radius * 0.38,
          Math.sin(a) * h.radius * 0.38,
          2, 3.5, a, 0, Math.PI * 2
        );
        ctx.fill();
      }
    } else if (h.type === 'kiwi') {
      ctx.fillStyle = '#2d5016';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = h.radius * (0.2 + Math.random() * 0.2);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (h.type === 'orange') {
      // Orange segments
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * h.radius * 0.7, Math.sin(a) * h.radius * 0.7);
        ctx.stroke();
      }
    }

    // Juice drip trail
    if (h.life > 40) {
      ctx.globalAlpha = h.opacity * 0.4;
      ctx.beginPath();
      const drip = h.side === 'left' ? -h.radius * 0.3 : h.radius * 0.3;
      ctx.arc(drip, h.radius * 0.5, 3, 0, Math.PI * 2);
      ctx.fillStyle = def.juiceColor;
      ctx.fill();
    }

    ctx.restore();
  }

  drawParticle(p: Particle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = p.opacity;

    if (p.type === 'text') {
      const scale = p.life > p.maxLife * 0.8 ? 1 + (1 - p.life / p.maxLife) * 2 : 1;
      ctx.font = `bold ${p.size * scale}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(p.text!, p.x, p.y);

      // Fill
      ctx.fillStyle = p.color;
      ctx.fillText(p.text!, p.x, p.y);
    } else if (p.type === 'juice') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else {
      // Spark with glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.restore();
  }

  drawTrail(trail: SliceTrail) {
    if (trail.points.length < 2) return;
    const ctx = this.ctx;
    const alpha = trail.life / trail.maxLife;

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;

    // Outer glow
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 6 * alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#00d2ff';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.moveTo(trail.points[0].x, trail.points[0].y);
    for (let i = 1; i < trail.points.length; i++) {
      ctx.lineTo(trail.points[i].x, trail.points[i].y);
    }
    ctx.stroke();

    // Inner white
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * alpha;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(trail.points[0].x, trail.points[0].y);
    for (let i = 1; i < trail.points.length; i++) {
      ctx.lineTo(trail.points[i].x, trail.points[i].y);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawCurrentTrail() {
    if (this.currentTrail.length < 2 || this.state !== 'playing') return;
    const ctx = this.ctx;

    const start = Math.max(0, this.currentTrail.length - 18);
    const pts = this.currentTrail.slice(start);
    if (pts.length < 2) return;

    // Outer glow blade
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Wide glowing blade
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#00d2ff';
    ctx.shadowBlur = 25;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // White core with taper
    for (let i = 1; i < pts.length; i++) {
      const alpha = i / pts.length;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 1 + alpha * 3;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = this.bgGradient;
    ctx.fillRect(0, 0, this.w, this.h);

    // Animated wave lines at bottom
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      for (let x = 0; x <= this.w; x += 5) {
        const y = this.h - 60 - w * 20 + Math.sin(x * 0.01 + this.globalTime * 0.001 + w) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Background floating fruits
    for (const f of this.bgFruits) {
      ctx.save();
      ctx.globalAlpha = f.opacity;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      const ec = this.getEmojiCanvas(f.emoji, f.size);
      ctx.drawImage(ec, -f.size * 1.25, -f.size * 1.25, f.size * 2.5, f.size * 2.5);
      ctx.restore();
    }

    // Vignette overlay
    const vignette = ctx.createRadialGradient(
      this.w / 2, this.h / 2, this.w * 0.25,
      this.w / 2, this.h / 2, this.w * 0.85
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawMissedIndicator() {
    const ctx = this.ctx;
    const size = 22;
    const padding = 15;
    const y = padding + 50;

    for (let i = 0; i < MAX_MISSED; i++) {
      const x = this.w - padding - (MAX_MISSED - 1 - i) * (size + 8) - size / 2;
      ctx.save();
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (i < this.missed) {
        ctx.globalAlpha = 0.3;
        ctx.fillText('💔', x, y);
      } else {
        ctx.globalAlpha = 0.9;
        ctx.fillText('❤️', x, y);
      }
      ctx.restore();
    }
  }

  render() {
    const ctx = this.ctx;

    ctx.save();

    // Apply screen shake
    ctx.translate(this.shakeX, this.shakeY);

    this.drawBackground();

    // Draw trails
    for (const trail of this.trails) {
      this.drawTrail(trail);
    }
    this.drawCurrentTrail();

    // Draw particles (juice behind fruits)
    for (const p of this.particles) {
      if (p.type === 'juice') this.drawParticle(p);
    }

    // Draw fruits
    for (const f of this.fruits) {
      this.drawFruit(f);
    }

    // Draw sliced halves
    for (const h of this.slicedHalves) {
      this.drawSlicedHalf(h);
    }

    // Draw particles (sparks and text in front)
    for (const p of this.particles) {
      if (p.type !== 'juice') this.drawParticle(p);
    }

    // Flash effect
    if (this.flashTimer > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    }

    // HUD
    if (this.state === 'playing' || this.state === 'paused') {
      ctx.save();

      // Score background pill
      const scoreText = `${this.score}`;
      ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
      const scoreW = ctx.measureText(`🍉 ${scoreText}`).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      const pillX = 8;
      const pillY = 8;
      const pillW = scoreW + 28;
      const pillH = 40;
      const pillR = 12;
      ctx.beginPath();
      ctx.moveTo(pillX + pillR, pillY);
      ctx.lineTo(pillX + pillW - pillR, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR, pillR);
      ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH, pillR);
      ctx.lineTo(pillX + pillR, pillY + pillH);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR, pillR);
      ctx.lineTo(pillX, pillY + pillR);
      ctx.arcTo(pillX, pillY, pillX + pillR, pillY, pillR);
      ctx.closePath();
      ctx.fill();

      // Score text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(`🍉 ${scoreText}`, 18, 30);

      // Combo indicator
      if (this.combo >= 2) {
        const pulse = 1 + Math.sin(this.globalTime * 0.012) * 0.06;
        const fontSize = 16 * pulse;
        ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillStyle = this.combo >= 5 ? '#ffd700' : this.combo >= 3 ? '#ff6b6b' : '#88eeff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fillText(`${this.combo}x COMBO`, 18, 62);
      }

      ctx.restore();

      this.drawMissedIndicator();
    }

    ctx.restore();
  }

  loop = (time: number) => {
    const dt = Math.min(time - this.lastTime, 33.33);
    this.lastTime = time;

    this.update(dt);
    this.render();

    this.animFrame = requestAnimationFrame(this.loop);
  };

  loadHighScores() {
    try {
      const data = localStorage.getItem('galibs_fruit_cutter_highscores');
      this.highScores = data ? JSON.parse(data) : [];
    } catch {
      this.highScores = [];
    }
  }

  saveHighScore(score: number) {
    if (score <= 0) return;
    this.highScores.push({
      score,
      date: new Date().toLocaleDateString(),
    });
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 10);
    try {
      localStorage.setItem('galibs_fruit_cutter_highscores', JSON.stringify(this.highScores));
    } catch { /* ignore */ }
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
  }
}
