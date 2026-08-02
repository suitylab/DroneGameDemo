/**
 * LevelConfigs
 *
 * Central configuration module for the MAZE STRIKE game Phase 9.
 * Defines the LevelConfig interface and LEVEL_CONFIGS array with exactly
 * 10 level configurations matching design-doc.md Section 6.5.
 *
 * Each config specifies:
 *   - Level number (1-10)
 *   - Maze size category ('small' | 'medium' | 'large')
 *   - Room count (6, 8, or 10)
 *   - Enemy count (5-25)
 *   - Available enemy type IDs (subset of EnemyTypeId)
 *   - Available weapon IDs (subset of WeaponType)
 *   - Boss type (null or 'colossus' | 'vanguard' | 'overseer')
 *   - Health multiplier for difficulty scaling
 *
 * The module also exports convenience constants ALL_ENEMY_TYPES and
 * ALL_WEAPONS, and a getLevelConfig(level) helper function.
 */
import type { EnemyTypeId } from './EnemyTypes';
import type { WeaponType } from './WeaponConfigs';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * MazeSize
 *
 * String literal union type identifying the maze size category.
 * Determines the room count and overall maze dimensions.
 */
export type MazeSize = 'small' | 'medium' | 'large';

/**
 * BossType
 *
 * String literal union type identifying the boss type for a level.
 * null indicates no boss in the level.
 */
export type BossType = 'colossus' | 'vanguard' | 'overseer' | null;

/**
 * LevelConfig
 *
 * Complete static configuration for a single level.
 * All runtime state (enemy health, spawn positions, etc.) is managed
 * separately by the Game class and its subsystems.
 */
export interface LevelConfig {
  /** Level number (1-10) */
  level: number;

  /** Maze size category — determines room count and overall dimensions */
  mazeSize: MazeSize;

  /** Number of rooms in the maze (6, 8, or 10) */
  roomCount: number;

  /** Number of enemies to spawn (5-25) */
  enemyCount: number;

  /** Enemy type IDs available for spawning in this level */
  enemyTypes: EnemyTypeId[];

  /** Weapon IDs available as pickups in this level */
  weapons: WeaponType[];

  /** Boss type for this level, or null if no boss */
  boss: BossType;

  /** Health multiplier applied to all enemies in this level */
  healthMultiplier: number;
}

// ---------------------------------------------------------------------------
// Level Configurations
// ---------------------------------------------------------------------------

/**
 * LEVEL_CONFIGS
 *
 * Array of exactly 10 level configurations, ordered by level number (1-10).
 * Matches design-doc.md Section 6.5 Level Progression table.
 *
 * Level progression summary:
 *   - Levels 1-3: Small maze (6 rooms), basic enemy types, progressive weapon unlocks
 *   - Levels 4-7: Medium maze (8 rooms), expanded enemy roster, all 6 weapons
 *   - Levels 8-10: Large maze (10 rooms), all enemy types, all 6 weapons
 *
 * Bosses appear at levels 4 (Colossus), 7 (Vanguard), and 10 (Overseer).
 * Health multiplier scales from 1.0 (level 1) to 1.5 (level 10).
 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  // -------------------------------------------------------------------------
  // Level 1 — Small maze, basic enemies, starter weapons
  // -------------------------------------------------------------------------
  {
    level: 1,
    mazeSize: 'small',
    roomCount: 6,
    enemyCount: 5,
    enemyTypes: ['scout_drone', 'sentry_mk1'],
    weapons: ['m9_sidearm', 'viper_smg'],
    boss: null,
    healthMultiplier: 1.0,
  },

  // -------------------------------------------------------------------------
  // Level 2 — Small maze, adds Sentry MK-II and Titan Shotgun
  // -------------------------------------------------------------------------
  {
    level: 2,
    mazeSize: 'small',
    roomCount: 6,
    enemyCount: 8,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun'],
    boss: null,
    healthMultiplier: 1.05,
  },

  // -------------------------------------------------------------------------
  // Level 3 — Small maze, adds Brute and Longbow Rifle
  // -------------------------------------------------------------------------
  {
    level: 3,
    mazeSize: 'small',
    roomCount: 6,
    enemyCount: 10,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle'],
    boss: null,
    healthMultiplier: 1.1,
  },

  // -------------------------------------------------------------------------
  // Level 4 — Medium maze, all enemies except Phantom, all weapons, Colossus
  // -------------------------------------------------------------------------
  {
    level: 4,
    mazeSize: 'medium',
    roomCount: 8,
    enemyCount: 12,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: 'colossus',
    healthMultiplier: 1.15,
  },

  // -------------------------------------------------------------------------
  // Level 5 — Medium maze, all enemies except Phantom, all weapons, no boss
  // -------------------------------------------------------------------------
  {
    level: 5,
    mazeSize: 'medium',
    roomCount: 8,
    enemyCount: 14,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: null,
    healthMultiplier: 1.2,
  },

  // -------------------------------------------------------------------------
  // Level 6 — Medium maze, all enemy types, all weapons, no boss
  // -------------------------------------------------------------------------
  {
    level: 6,
    mazeSize: 'medium',
    roomCount: 8,
    enemyCount: 16,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden', 'phantom'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: null,
    healthMultiplier: 1.25,
  },

  // -------------------------------------------------------------------------
  // Level 7 — Medium maze, all enemy types, all weapons, Vanguard
  // -------------------------------------------------------------------------
  {
    level: 7,
    mazeSize: 'medium',
    roomCount: 8,
    enemyCount: 18,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden', 'phantom'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: 'vanguard',
    healthMultiplier: 1.3,
  },

  // -------------------------------------------------------------------------
  // Level 8 — Large maze, all enemy types, all weapons, no boss
  // -------------------------------------------------------------------------
  {
    level: 8,
    mazeSize: 'large',
    roomCount: 10,
    enemyCount: 20,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden', 'phantom'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: null,
    healthMultiplier: 1.35,
  },

  // -------------------------------------------------------------------------
  // Level 9 — Large maze, all enemy types, all weapons, no boss
  // -------------------------------------------------------------------------
  {
    level: 9,
    mazeSize: 'large',
    roomCount: 10,
    enemyCount: 22,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden', 'phantom'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: null,
    healthMultiplier: 1.4,
  },

  // -------------------------------------------------------------------------
  // Level 10 — Large maze, all enemy types, all weapons, Overseer
  // -------------------------------------------------------------------------
  {
    level: 10,
    mazeSize: 'large',
    roomCount: 10,
    enemyCount: 25,
    enemyTypes: ['scout_drone', 'sentry_mk1', 'sentry_mk2', 'brute', 'reaper', 'warden', 'phantom'],
    weapons: ['m9_sidearm', 'viper_smg', 'titan_shotgun', 'longbow_rifle', 'pulsar_plasma', 'havoc_rocket'],
    boss: 'overseer',
    healthMultiplier: 1.5,
  },
];

// ---------------------------------------------------------------------------
// Convenience Constants
// ---------------------------------------------------------------------------

/**
 * ALL_ENEMY_TYPES
 *
 * Array of all enemy type IDs available across all levels.
 * Derived from LEVEL_CONFIGS to ensure consistency with the configs.
 * Used for convenience when a level needs access to the full enemy roster.
 */
export const ALL_ENEMY_TYPES: EnemyTypeId[] = [
  'scout_drone',
  'sentry_mk1',
  'sentry_mk2',
  'brute',
  'reaper',
  'warden',
  'phantom',
];

/**
 * ALL_WEAPONS
 *
 * Array of all weapon IDs available across all levels.
 * Derived from LEVEL_CONFIGS to ensure consistency with the configs.
 * Used for convenience when a level needs access to the full weapon roster.
 */
export const ALL_WEAPONS: WeaponType[] = [
  'm9_sidearm',
  'viper_smg',
  'titan_shotgun',
  'longbow_rifle',
  'pulsar_plasma',
  'havoc_rocket',
];

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Gets the level configuration for the given level number.
 *
 * Clamps the input to the valid range [1, 10] to handle out-of-range
 * values gracefully. Returns the level 1 config as a fallback for
 * invalid inputs (NaN, negative, zero, etc.).
 *
 * @param level - The level number (1-10)
 * @returns The LevelConfig for the requested level
 */
export function getLevelConfig(level: number): LevelConfig {
  // Clamp to valid range [1, 10]
  const clampedLevel = Math.max(1, Math.min(10, Math.floor(level)));

  // Return the config at index (level - 1) since the array is 0-based
  return LEVEL_CONFIGS[clampedLevel - 1];
}