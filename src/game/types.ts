export interface Vec2 {
  x: number;
  y: number;
}

export interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  type: FruitType;
  sliced: boolean;
  opacity: number;
  gravityMultiplier?: number;
}

export interface SlicedHalf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  type: FruitType;
  side: 'left' | 'right';
  opacity: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'juice' | 'spark' | 'text';
  text?: string;
  opacity: number;
}

export interface SliceTrail {
  points: Vec2[];
  life: number;
  maxLife: number;
}

export type FruitType = 'watermelon' | 'orange' | 'apple' | 'kiwi' | 'coconut' | 'bomb' | 'mango' | 'strawberry';

export interface FruitDef {
  emoji: string;
  color: string;
  innerColor: string;
  juiceColor: string;
  points: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export interface HighScore {
  score: number;
  date: string;
}
