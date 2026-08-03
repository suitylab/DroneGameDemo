import * as THREE from 'three';
import Enemy from './Enemy';
import type { EnemyTypeId } from './EnemyTypes';

/**
 * EnemySpawnPoint
 *
 * Defines a spawn location for an enemy in the maze.
 * Coordinates are in world space (x, z on the ground plane).
 */
export interface EnemySpawnPoint {
  /** World X coordinate */
  x: number;
  /** World Z coordinate */
  z: number;
  /** The enemy type to spawn */
  typeId: EnemyTypeId;
}

/**
 * EnemyManager
 *
 * Manages all enemy entities for the MAZE STRIKE game (Phase 5).
 * Handles spawning, updating, alert propagation, death handling,
 * and HUD wiring (enemy counter + kill feed).
 *
 * The manager creates Enemy instances from spawn points, updates them
 * each frame, propagates alerts between nearby enemies, and cleans up
 * dead enemies with proper disposal.
 */
export default class EnemyManager {
  /** The Three.js scene reference */
  private scene: THREE.Scene;

  /** All active enemy entities */
  private enemies: Enemy[] = [];

  /** Spawn points for enemies */
  private spawnPoints: EnemySpawnPoint[];

  /** Walkability callback (returns true if position is walkable) */
  private isWalkable: (x: number, z: number) => boolean;

  /** Player position getter callback */
  private getPlayerPosition: () => THREE.Vector3;

  /** Callback invoked when the alive enemy count changes */
  private onEnemyCounterChange: (count: number) => void;

  /** Callback invoked when an enemy is eliminated (kill feed) */
  private onKillFeed: (message: string) => void;

  /** Callback invoked when an enemy projectile hits the player */
  private onPlayerHit: (damage: number) => void;

  /** Callback invoked when an enemy dies (for audio, etc.) */
  private onEnemyDeathCallback: () => void;

  /** Callback invoked when an enemy dies with position (for item drops) */
  private onEnemyPositionDeath: (x: number, z: number) => void;

  /** Radius for alert propagation in world units */
  private alertRadius: number = 20;

    /** Whether dispose has been called */
  private disposed: boolean = false;

  /** Health multiplier for difficulty scaling */
  private healthMultiplier: number = 1.0;

  /**
   * Creates a new EnemyManager.
   * @param scene - The THREE.Scene to add enemies to
   * @param spawnPoints - Spawn points for enemies (world coordinates)
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onEnemyCounterChange - Callback invoked when the alive enemy count changes
   * @param onKillFeed - Callback invoked when an enemy is eliminated (kill feed)
   */
    constructor(
    scene: THREE.Scene,
    spawnPoints: EnemySpawnPoint[],
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onEnemyCounterChange: (count: number) => void,
    onKillFeed: (message: string) => void,
    onPlayerHit: (damage: number) => void,
    onEnemyDeathCallback: () => void,
    onEnemyPositionDeath: (x: number, z: number) => void,
    healthMultiplier: number = 1.0
  ) {
    this.scene = scene;
    this.spawnPoints = spawnPoints;
    this.isWalkable = isWalkable;
    this.getPlayerPosition = getPlayerPosition;
    this.onEnemyCounterChange = onEnemyCounterChange;
    this.onKillFeed = onKillFeed;
    this.onPlayerHit = onPlayerHit;
    this.onEnemyDeathCallback = onEnemyDeathCallback;
    this.onEnemyPositionDeath = onEnemyPositionDeath;
    this.healthMultiplier = healthMultiplier;

    // Spawn all enemies from the provided spawn points
    this.spawnEnemies();
  }

  /**
   * Spawns all enemies from the spawn points.
   * Generates patrol waypoints for each enemy and creates Enemy instances.
   */
  private spawnEnemies(): void {
    for (const spawnPoint of this.spawnPoints) {
      // Generate patrol waypoints in a circle around the spawn point
      const waypoints = this.generatePatrolWaypoints(spawnPoint.x, spawnPoint.z);

      // Create the enemy instance
                    const enemy = new Enemy(
        this.scene,
        spawnPoint.typeId,
        spawnPoint.x,
        spawnPoint.z,
        waypoints,
        this.isWalkable,
        this.getPlayerPosition,
        this.onEnemyDeath.bind(this),
        undefined,
        this.onPlayerHit,
        this.healthMultiplier
      );

            // Wire the entity collision callback so this enemy blocks movement
      // into other enemies instead of being pushed out of them
      enemy.setEntityCollisionCallback((x, z) => this.isPositionBlockedByEnemy(x, z, enemy));

      // Add to the enemies array
      this.enemies.push(enemy);
    }

    // Update the enemy counter after spawning
    this.updateEnemyCounter();
  }

  /**
   * Generates patrol waypoints in a circle around the spawn position.
   * Creates 2-4 waypoints with random radius between 3-5 units.
   *
   * @param x - Spawn X coordinate
   * @param z - Spawn Z coordinate
   * @returns Array of waypoint positions
   */
  private generatePatrolWaypoints(x: number, z: number): THREE.Vector3[] {
    // Random waypoint count between 2 and 4
    const count = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4

    // Random base radius between 3 and 5
    const baseRadius = 3 + Math.random() * 2;

    const waypoints: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      // Distribute evenly around the circle
      const angle = (i / count) * Math.PI * 2;

      // Add slight random variation to the radius for organic patrol paths
      const radius = baseRadius + (Math.random() - 0.5) * 1.5;

      const wx = x + Math.cos(angle) * radius;
      const wz = z + Math.sin(angle) * radius;

      waypoints.push(new THREE.Vector3(wx, 0, wz));
    }

    return waypoints;
  }

  /**
   * Updates all enemies and handles alert propagation.
   * Removes dead enemies from the array.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Guard against updates after disposal
    if (this.disposed) return;

    // Update all enemies and remove dead ones
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // Skip if already disposed
      if (enemy.disposed) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Update the enemy
      enemy.update(deltaTime);

      // Remove dead enemies only after all death effects are complete
      if (!enemy.getIsAlive()) {
        const hasActiveEffects =
          enemy.deathParticles.length > 0 ||
          enemy.smokeParticles.length > 0 ||
          enemy.shockwaveRings.length > 0 ||
          enemy.deathLight !== null;
        if (!hasActiveEffects) {
          enemy.dispose();
          this.enemies.splice(i, 1);
        }
      }
    }

                        // Handle alert propagation between enemies
    this.handleAlertPropagation();

        // Update the enemy counter
    this.updateEnemyCounter();
  }

  /**
   * Handles alert propagation between enemies.
   * When an enemy is in attack state, alerts nearby enemies within alertRadius.
   */
  private handleAlertPropagation(): void {
    // Iterate over all alive enemies
    for (const enemy of this.enemies) {
      // Only propagate alerts from enemies in attack state
      if (enemy.state !== 'attack') continue;

      // Check all other alive enemies
      for (const other of this.enemies) {
        // Skip self and dead enemies
        if (other === enemy || !other.getIsAlive()) continue;

        // Skip enemies already in attack state
        if (other.state === 'attack') continue;

        // Calculate distance between enemies
        const dx = other.group.position.x - enemy.group.position.x;
        const dz = other.group.position.z - enemy.group.position.z;
        const distSq = dx * dx + dz * dz;

                // Alert if within radius
        if (distSq <= this.alertRadius * this.alertRadius) {
          other.alert();
        }
      }
    }
  }

    /**
   * Checks if a position would overlap any alive enemy other than the
   * enemy being checked. Used by the enemy's entity collision callback
   * to block movement instead of pushing enemies apart.
   *
   * @param x - The X coordinate to check
   * @param z - The Z coordinate to check
   * @param selfEnemy - The enemy performing the check (excluded from the test)
   * @returns True if the position would overlap another alive enemy
   */
    private isPositionBlockedByEnemy(x: number, z: number, selfEnemy: Enemy): boolean {
    // Minimum separation distance (0.4 + 0.4 collision radii)
    const minSeparation = 0.8;
    const minSeparationSq = minSeparation * minSeparation;

    // Get the self enemy's current position
    const selfPos = selfEnemy.group.position;

    // Iterate over all alive enemies
    for (const enemy of this.enemies) {
      // Skip self and dead enemies
      if (enemy === selfEnemy || !enemy.getIsAlive()) continue;

      const enemyPos = enemy.group.position;

      // Calculate distance between the proposed position and the enemy
      const dx = x - enemyPos.x;
      const dz = z - enemyPos.z;
      const newDistSq = dx * dx + dz * dz;

      // Skip if the proposed position is not overlapping
      if (newDistSq >= minSeparationSq) continue;

      // Calculate distance between the self enemy's current position and the enemy
      const curDx = selfPos.x - enemyPos.x;
      const curDz = selfPos.z - enemyPos.z;
      const currentDistSq = curDx * curDx + curDz * curDz;

      // Allow escape movement: if currently overlapping this enemy AND
      // the proposed position is farther from the enemy than the current
      // position, then this is an escape move and should be allowed.
      if (currentDistSq < minSeparationSq && newDistSq > currentDistSq) {
        continue;
      }

      // Otherwise, block the movement
      return true;
    }

    return false;
  }

        /**
   * Spawns a summoned enemy at the given position (used by boss summons).
   * Creates an enemy with patrol waypoints around the spawn position.
   *
   * @param typeId - The enemy type to spawn
   * @param x - World X coordinate
   * @param z - World Z coordinate
   */
  public spawnSummonedEnemy(typeId: EnemyTypeId, x: number, z: number): void {
    // Generate patrol waypoints in a circle around the spawn point
    const waypoints = this.generatePatrolWaypoints(x, z);

    // Create the enemy instance
                const enemy = new Enemy(
      this.scene,
      typeId,
      x,
      z,
      waypoints,
      this.isWalkable,
      this.getPlayerPosition,
      this.onEnemyDeath.bind(this),
      undefined,
      this.onPlayerHit,
      this.healthMultiplier
    );

        // Wire the entity collision callback so this enemy blocks movement
    // into other enemies instead of being pushed out of them
    enemy.setEntityCollisionCallback((x, z) => this.isPositionBlockedByEnemy(x, z, enemy));

    // Add to the enemies array
    this.enemies.push(enemy);

    // Update the enemy counter
    this.updateEnemyCounter();
  }

  /**
   * Notifies all alive enemies of gunfire at the given position.
   * Enemies within their hearing radius will investigate.
   *
   * @param position - World position of the gunfire
   */
  public hearGunfire(position: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      if (enemy.getIsAlive()) {
        enemy.hearGunfire(position);
      }
    }
  }

  /**
   * Gets the array of all enemies.
   * @returns The enemies array
   */
  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  /**
   * Gets the count of alive enemies.
   * @returns Number of alive enemies
   */
  public getAliveCount(): number {
    return this.enemies.filter((e) => e.getIsAlive()).length;
  }

  /**
   * Gets the total number of spawned enemies.
   * @returns Total spawned count
   */
  public getTotalCount(): number {
    return this.spawnPoints.length;
  }

  /**
   * Callback invoked when an enemy dies.
   * Updates the kill feed, disposes the enemy, and removes it from the array.
   *
   * @param enemy - The enemy that died
   */
  private onEnemyDeath(enemy: Enemy): void {
    // Show kill feed message
    this.onKillFeed(`ELIMINATED: ${enemy.config.name}`);

    // Notify Game.ts for audio
    this.onEnemyDeathCallback();

    // Notify Game.ts with position for item drops
    const pos = enemy.getPosition();
    this.onEnemyPositionDeath(pos.x, pos.z);

    // Update the enemy counter
    this.updateEnemyCounter();

    // Note: Do NOT dispose the enemy here.
    // The update loop will keep it alive until all death effects are complete,
    // then remove it from the array.
  }

  /**
   * Updates the enemy counter via the callback.
   */
  private updateEnemyCounter(): void {
    this.onEnemyCounterChange(this.getAliveCount());
  }

  /**
   * Disposes all enemies and clears arrays.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose all enemies
    for (const enemy of this.enemies) {
      enemy.dispose();
    }

    // Clear arrays
    this.enemies = [];
    this.spawnPoints = [];
  }
}