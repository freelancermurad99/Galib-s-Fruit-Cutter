import { FruitDef } from './types';

export const GRAVITY = 0.35;
export const FRUIT_SPAWN_INTERVAL_MIN = 600;
export const FRUIT_SPAWN_INTERVAL_MAX = 1400;
export const MAX_MISSED = 3;
export const TRAIL_LIFETIME = 12;
export const SHAKE_DECAY = 0.85;
export const COMBO_WINDOW = 500; // ms

export const FRUIT_DEFS: Record<string, FruitDef> = {
  watermelon: {
    emoji: '🍉',
    color: '#2d8a4e',
    innerColor: '#ff4757',
    juiceColor: '#ff6b81',
    points: 3,
  },
  orange: {
    emoji: '🍊',
    color: '#ff9f43',
    innerColor: '#ffa502',
    juiceColor: '#ffbe76',
    points: 1,
  },
  apple: {
    emoji: '🍎',
    color: '#ee5a24',
    innerColor: '#fffbe0',
    juiceColor: '#f8e8c0',
    points: 1,
  },
  kiwi: {
    emoji: '🥝',
    color: '#6ab04c',
    innerColor: '#badc58',
    juiceColor: '#c7ecee',
    points: 2,
  },
  mango: {
    emoji: '🥭',
    color: '#f0932b',
    innerColor: '#ffda79',
    juiceColor: '#f6e58d',
    points: 2,
  },
  strawberry: {
    emoji: '🍓',
    color: '#eb4d4b',
    innerColor: '#ff7979',
    juiceColor: '#e55039',
    points: 2,
  },
  coconut: {
    emoji: '🥥',
    color: '#8B6914',
    innerColor: '#ffffff',
    juiceColor: '#f1f2f6',
    points: 3,
  },
  bomb: {
    emoji: '💣',
    color: '#2c3e50',
    innerColor: '#e74c3c',
    juiceColor: '#e74c3c',
    points: -10,
  },
};

export const FRUIT_TYPES = Object.keys(FRUIT_DEFS).filter(k => k !== 'bomb');
