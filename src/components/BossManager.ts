import * as THREE from 'three';
import Boss from './Boss';
import BossColossus from './BossColossus';
import BossVanguard from './BossVanguard';
import BossOverseer from './BossOverseer';
import type { EnemyTypeId } from './EnemyTypes';

/**
 * BossTypeId
 *
 * String literal union type identifying each boss type.
 * Used for type-safe boss references throughout the codebase.
 */
export type BossTypeId = 'colossus' | 'vanguard' | 'overseer';

/**
 * BossSpawnPoint
 *
 * Defines the world-space spawn position for the boss.
 */
export interface BossSpawnPoint {
  /** World X coordinate */
  x: number;
  /** World Z coordinate */
  z: number;
}

/**
 * BossHUD
 *
 * Minimal HUD interface required by BossManager for boss health bar wiring.
 * The actual HUD class implements these methods.
 */
export interface BossHUD {
  /** Shows the boss health bar with the given name and initial health */
  showBossBar(name: string, health: number, maxHealth: number): void;
  /** Updates the boss health bar with current health values */
  updateBossBar(health: number, maxHealth: number): void;
  /** Hides the boss health bar */
  hideBossBar(): void;
}

/**
 * SummonEnemyCallback
 *
 * Callback invoked when a boss summons minions.
 * The Game class wires this to the EnemyManager to spawn the correct enemy type.
 */
export interface SummonEnemyCallback {
  (typeId: EnemyTypeId, x: number, z: number): void;
}

/**
 * BossManager
 *
 * Manages the boss lifecycle for the MAZE STRIKE game (Phase 8).
 * Supports all 3 boss types: Colossus, Vanguard, and Overseer.
 *
 * Responsibilities:
 *   - Spawns the correct boss at the given arena position based on bossType
 *   - Updates the boss each frame
 *   - Wires the HUD boss health bar (show/update/hide)
 *   - Applies player damage from boss attacks via intensity mapping
 *   - Handles boss death (hide boss bar, invoke onBossDeath callback)
 *   - Provides a method to spawn summoned minions via the EnemyManager
 *
 * The manager acts as a facade between the boss entity, the HUD, and the
 * game's enemy/player systems.
 */
export default class BossManager {
  /** The active boss entity (null after death or disposal) */
  private boss: Boss | null = null;

  /** Whether the boss is currently alive */
  private isAlive: boolean = false;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /** The Three.js scene reference */
  private scene: THREE.Scene;

  /** The HUD instance for boss bar wiring */
  private hud: BossHUD;

  /** External callback invoked when the boss dies */
  private onBossDeath: () => void;

  /** External callback to spawn summoned minions */
  private onSummonEnemy: SummonEnemyCallback;

  /** External callback to apply damage to the player */
  private onPlayerDamage: (amount: number) => void;

  /** External callback for screen shake effects */
  private onScreenShake: (intensity: number, duration: number) => void;

  /**
   * Creates a new BossManager and spawns the specified boss.
   * @param scene - The THREE.Scene to add the boss to
   * @param bossType - The type of boss to spawn ('colossus' | 'vanguard' | 'overseer')
   * @param bossSpawnPoint - World-space spawn position for the boss
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onBossDeath - Callback invoked when the boss dies
   * @param onScreenShake - Callback for screen shake effects
   * @param onSummonEnemy - Callback to spawn summoned minions (typeId, x, z)
   * @param onPlayerDamage - Callback to apply damage to the player
   * @param hud - HUD instance with boss bar methods
   */
  constructor(
    scene: THREE.Scene,
    bossType: BossTypeId,
    bossSpawnPoint: BossSpawnPoint,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onBossDeath: () => void,
    onScreenShake: (intensity: number, duration: number) => void,
    onSummonEnemy: SummonEnemyCallback,
    onPlayerDamage: (amount: number) => void,
    hud: BossHUD
  ) {
    this.scene = scene;
    this.hud = hud;
    this.onBossDeath = onBossDeath;
    this.onScreenShake = onScreenShake;
    this.onSummonEnemy = onSummonEnemy;
    this.onPlayerDamage = onPlayerDamage;

    // Spawn the specified boss at the given position
    this.spawnBoss(bossType, bossSpawnPoint, isWalkable, getPlayerPosition);
  }

  /**
   * Spawns the specified boss at the given position.
   * Wires the boss's callbacks to the manager's handlers.
   *
   * @param bossType - The type of boss to spawn
   * @param spawnPoint - World-space spawn position
   * @param isWalkable - Walkability callback
   * @param getPlayerPosition - Player position getter callback
   */
  private spawnBoss(
    bossType: BossTypeId,
    spawnPoint: BossSpawnPoint,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3
  ): void {
    switch (bossType) {
      case 'colossus':
        this.boss = new BossColossus(
          this.scene,
          spawnPoint.x,
          spawnPoint.z,
          isWalkable,
          getPlayerPosition,
          this.handleBossDeath.bind(this),
          this.handleScreenShake.bind(this),
          (x, z) => this.handleSummonEnemy('sentry_mk1', x, z)
        );
        break;

      case 'vanguard':
        this.boss = new BossVanguard(
          this.scene,
          spawnPoint.x,
          spawnPoint.z,
          isWalkable,
          getPlayerPosition,
          this.handleBossDeath.bind(this),
          this.handleScreenShake.bind(this),
          (x, z) => this.handleSummonEnemy('scout_drone', x, z)
        );
        break;

      case 'overseer':
        this.boss = new BossOverseer(
          this.scene,
          spawnPoint.x,
          spawnPoint.z,
          isWalkable,
          getPlayerPosition,
          this.handleBossDeath.bind(this),
          this.handleScreenShake.bind(this),
          (x, z) => this.handleSummonEnemy('brute', x, z)
        );
        break;

      default:
        // Fallback to Colossus for unknown boss types
        this.boss = new BossColossus(
          this.scene,
          spawnPoint.x,
          spawnPoint.z,
          isWalkable,
          getPlayerPosition,
          this.handleBossDeath.bind(this),
          this.handleScreenShake.bind(this),
          (x, z) => this.handleSummonEnemy('sentry_mk1', x, z)
        );
        break;
    }

    // Mark as alive
    this.isAlive = true;

    // Show the boss health bar
    if (this.boss) {
      this.hud.showBossBar(
        this.boss.config.name,
        this.boss.health,
        this.boss.maxHealth
      );
    }
  }

  /**
   * Handles the boss's screen shake callback.
   * Maps intensity to the correct player damage amount:
   *   - intensity >= 0.35: 30 damage (stomp, orbital laser)
   *   - intensity >= 0.3: 25 damage (nova, slam)
   *   - intensity >= 0.25: 20 damage (beam sweep, continuous laser)
   *   - intensity >= 0.2: 15 damage (missile)
   *
   * @param intensity - Shake intensity (maps to damage amount)
   * @param duration - Shake duration in seconds
   */
  private handleScreenShake(intensity: number, duration: number): void {
    // Forward to the external screen shake callback
    this.onScreenShake(intensity, duration);

    // Map intensity to player damage
    let damage = 0;
    if (intensity >= 0.35) {
      damage = 30; // Stomp, orbital laser
    } else if (intensity >= 0.3) {
      damage = 25; // Nova, slam
    } else if (intensity >= 0.25) {
      damage = 20; // Beam sweep, continuous laser
    } else if (intensity >= 0.2) {
      damage = 15; // Missile
    }

    // Apply damage to the player if any
    if (damage > 0) {
      this.onPlayerDamage(damage);
    }
  }

  /**
   * Handles the boss's summon callback.
   * Forwards the spawn request to the external summon callback
   * (which is wired to the EnemyManager).
   *
   * @param typeId - The enemy type to summon
   * @param x - World X coordinate for the summoned minion
   * @param z - World Z coordinate for the summoned minion
   */
  private handleSummonEnemy(typeId: EnemyTypeId, x: number, z: number): void {
    this.onSummonEnemy(typeId, x, z);
  }

  /**
   * Handles the boss's death callback.
   * Hides the boss bar, marks the boss as dead, and invokes the
   * external onBossDeath callback.
   *
   * @param boss - The boss that died
   */
  private handleBossDeath(boss: Boss): void {
    // Hide the boss health bar
    this.hud.hideBossBar();

    // Mark as not alive
    this.isAlive = false;

    // Keep the boss reference alive for death effects cleanup
    // The boss will be disposed after all death effects complete

    // Invoke the external death callback
    this.onBossDeath();
  }

  /**
   * Updates the boss each frame.
   * Also updates the HUD boss bar with the current health.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Guard against updates after disposal
    if (this.disposed) return;

    // Skip if no boss
    if (!this.boss) return;

    // Update the boss entity (including death effects after death)
    this.boss.update(deltaTime);

    // Update the HUD boss bar only if alive
    if (this.isAlive) {
      this.hud.updateBossBar(this.boss.health, this.boss.maxHealth);
    }

    // Dispose boss after all death effects are complete
    if (!this.isAlive) {
      if (!this.boss.hasActiveDeathEffects()) {
        this.boss.dispose();
        this.boss = null;
      }
    }
  }

  /**
   * Applies damage to the boss.
   * Passthrough to the boss entity's takeDamage method.
   *
   * @param amount - Amount of damage to apply
   */
  public takeDamage(amount: number): void {
    // Guard against damage after disposal or death
    if (this.disposed || !this.boss || !this.isAlive) return;

    // Apply damage to the boss
    this.boss.takeDamage(amount);
  }

  /**
   * Gets the boss entity reference.
   * @returns The boss entity, or null if dead/disposed
   */
  public getBoss(): Boss | null {
    return this.boss;
  }

  /**
   * Checks whether the boss is currently alive.
   * @returns True if the boss is alive, false otherwise
   */
  public getIsAlive(): boolean {
    return this.isAlive;
  }

  /**
   * Disposes all resources and cleans up.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose the boss entity if it still exists
    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }

    // Hide the boss bar if it's still visible
    this.hud.hideBossBar();

    // Clear state
    this.isAlive = false;
  }
}