/**
 * LevelManager
 *
 * Level progression and difficulty scaling logic for the MAZE STRIKE game (Phase 9).
 * Manages the current level, unlocked levels, completed levels, and provides
 * access to level configuration data for gameplay systems.
 *
 * This module is self-contained with no dependencies on Game or other components.
 * It imports only type definitions and configuration data from LevelConfigs,
 * EnemyTypes, and WeaponConfigs.
 */
import { LEVEL_CONFIGS, getLevelConfig, LevelConfig } from './LevelConfigs';
import type { EnemyTypeId } from './EnemyTypes';
import type { WeaponType } from './WeaponConfigs';

/**
 * LevelManager
 *
 * Tracks level progression state and provides access to level configuration.
 * Level 1 is always unlocked. Completing a level unlocks the next.
 * Progress is persisted to localStorage across page reloads.
 */
export default class LevelManager {
  /** localStorage key for saving unlocked level progress */
  private static readonly STORAGE_KEY = 'mazestrike_unlocked_level';

  /** The current level number (1-10) */
  private currentLevel: number = 1;

  /** The highest unlocked level number (1-10), loaded from localStorage */
  private maxUnlockedLevel: number;

  /** Set of completed level numbers */
  private completedLevels: Set<number> = new Set<number>();

  constructor() {
    this.maxUnlockedLevel = LevelManager.loadUnlockedLevel();
  }

  /**
   * Loads the saved unlocked level from localStorage.
   * @returns The saved max unlocked level, or 1 if not found/invalid
   */
  private static loadUnlockedLevel(): number {
    try {
      const saved = localStorage.getItem(LevelManager.STORAGE_KEY);
      if (saved !== null) {
        const level = parseInt(saved, 10);
        if (level >= 1 && level <= 10) {
          return level;
        }
      }
    } catch {
      // localStorage may be unavailable
    }
    return 1;
  }

  /**
   * Saves the max unlocked level to localStorage.
   * @param level - The level to save
   */
  private static saveUnlockedLevel(level: number): void {
    try {
      localStorage.setItem(LevelManager.STORAGE_KEY, String(level));
    } catch {
      // localStorage may be unavailable — silently ignore
    }
  }

  /**
   * Gets the current level number.
   * @returns The current level (1-10)
   */
  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Gets the highest unlocked level number.
   * @returns The max unlocked level (1-10)
   */
  public getMaxUnlockedLevel(): number {
    return this.maxUnlockedLevel;
  }

  /**
   * Gets the configuration for the current level.
   * @returns The LevelConfig for the current level
   */
  public getCurrentConfig(): LevelConfig {
    return getLevelConfig(this.currentLevel);
  }

  /**
   * Checks whether the given level is unlocked.
   * Level 1 is always unlocked.
   * @param level - The level number to check (1-10)
   * @returns True if the level is unlocked, false otherwise
   */
  public isLevelUnlocked(level: number): boolean {
    // Clamp to valid range and check against max unlocked
    const clampedLevel = Math.max(1, Math.min(10, Math.floor(level)));
    return clampedLevel <= this.maxUnlockedLevel;
  }

  /**
   * Starts a level by setting it as the current level.
   * Validates that the level is within range and unlocked.
   * @param level - The level number to start (1-10)
   * @throws Error if the level is out of range or locked
   */
  public startLevel(level: number): void {
    // Clamp to valid range
    const clampedLevel = Math.max(1, Math.min(10, Math.floor(level)));

    // Validate the level is unlocked
    if (!this.isLevelUnlocked(clampedLevel)) {
      throw new Error(`Level ${clampedLevel} is locked. Max unlocked level is ${this.maxUnlockedLevel}.`);
    }

    // Set the current level
    this.currentLevel = clampedLevel;
  }

  /**
   * Marks the current level as complete and unlocks the next level.
   * @returns True if level 10 was completed (victory), false otherwise
   */
  public completeCurrentLevel(): boolean {
    // Add the current level to completed levels
    this.completedLevels.add(this.currentLevel);

    // Unlock the next level (clamp to 10)
    this.maxUnlockedLevel = Math.min(10, this.maxUnlockedLevel + 1);

    // Persist to localStorage
    LevelManager.saveUnlockedLevel(this.maxUnlockedLevel);

    // Return true if level 10 was completed (victory)
    return this.currentLevel === 10;
  }

  /**
   * Gets the next level number after the current level.
   * @returns The next level number, or null if at level 10
   */
  public getNextLevel(): number | null {
    if (this.currentLevel >= 10) {
      return null;
    }
    return this.currentLevel + 1;
  }

  /**
   * Gets the available enemy types for the current level.
   * @returns Array of enemy type IDs from the current level config
   */
  public getAvailableEnemyTypes(): EnemyTypeId[] {
    return [...this.getCurrentConfig().enemyTypes];
  }

  /**
   * Gets the available weapons for the current level.
   * @returns Array of weapon IDs from the current level config
   */
  public getAvailableWeapons(): WeaponType[] {
    return [...this.getCurrentConfig().weapons];
  }

  /**
   * Gets the enemy health multiplier for the current level.
   * @returns The health multiplier from the current level config
   */
  public getEnemyHealthMultiplier(): number {
    return this.getCurrentConfig().healthMultiplier;
  }

  /**
   * Gets the boss type for the current level.
   * @returns The boss type string, or null if no boss
   */
  public getBossType(): string | null {
    return this.getCurrentConfig().boss;
  }

  /**
   * Gets the room count for the current level.
   * @returns The number of rooms from the current level config
   */
  public getRoomCount(): number {
    return this.getCurrentConfig().roomCount;
  }

  /**
   * Gets the enemy count for the current level.
   * @returns The number of enemies from the current level config
   */
  public getEnemyCount(): number {
    return this.getCurrentConfig().enemyCount;
  }

  /**
   * Gets the maze size for the current level.
   * @returns The maze size string ('small' | 'medium' | 'large')
   */
  public getMazeSize(): string {
    return this.getCurrentConfig().mazeSize;
  }

  /**
   * Resets all progression state.
   * Resets maxUnlockedLevel to 1, clears completed levels, and resets current level to 1.
   */
  public resetProgress(): void {
    this.maxUnlockedLevel = 1;
    this.completedLevels.clear();
    this.currentLevel = 1;
    LevelManager.saveUnlockedLevel(1);
  }

  /**
   * Gets the array of completed level numbers (sorted ascending).
   * @returns Array of completed level numbers
   */
  public getCompletedLevels(): number[] {
    return Array.from(this.completedLevels).sort((a, b) => a - b);
  }

  /**
   * Gets the total number of completed levels.
   * @returns The count of completed levels
   */
  public getTotalCompletedCount(): number {
    return this.completedLevels.size;
  }
}

/**
 * Generates a balanced enemy composition for a level.
 *
 * Distributes enemies across the available types using a round-robin
 * approach so each type appears roughly equally. Heavier types
 * (brute, warden) appear slightly less frequently due to a weight
 * reduction factor.
 *
 * @param enemyTypes - The available enemy type IDs for the level
 * @param count - The total number of enemies to generate
 * @returns An array of enemy type IDs with balanced distribution
 */
export function generateEnemyComposition(
  enemyTypes: EnemyTypeId[],
  count: number
): EnemyTypeId[] {
  // Handle edge cases
  if (!enemyTypes || enemyTypes.length === 0 || count <= 0) {
    return [];
  }

  // Define weight reduction for heavy types (appear less frequently)
  const heavyTypes: EnemyTypeId[] = ['brute', 'warden'];
  const heavyWeight = 0.5; // Heavy types appear at half frequency

  // Build a weighted pool of enemy types
  // Each type appears in the pool proportional to its weight
  const weightedPool: EnemyTypeId[] = [];
  for (const type of enemyTypes) {
    const weight = heavyTypes.includes(type) ? heavyWeight : 1.0;
    // Add the type to the pool based on its weight (at least 1 entry)
    const entries = Math.max(1, Math.round(weight * 10));
    for (let i = 0; i < entries; i++) {
      weightedPool.push(type);
    }
  }

  // Generate the composition using round-robin distribution
  const composition: EnemyTypeId[] = [];
  let poolIndex = 0;

  for (let i = 0; i < count; i++) {
    // Pick from the weighted pool in round-robin fashion
    composition.push(weightedPool[poolIndex % weightedPool.length]);
    poolIndex++;
  }

  // Shuffle the composition for organic distribution
  // (Fisher-Yates shuffle)
  for (let i = composition.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [composition[i], composition[j]] = [composition[j], composition[i]];
  }

  return composition;
}