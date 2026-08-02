import * as THREE from 'three';
import {
  ENEMY_TYPES,
  buildEnemyVisual,
  getMuzzleLocalPosition,
  EnemyTypeId,
  EnemyTypeConfig,
} from './EnemyTypes';

/**
 * EnemyState
 *
 * The three AI states for the enemy state machine:
 *   - patrol: move between waypoints, pause at each
 *   - investigate: move to last known player position, look around
 *   - attack: chase player, fire weapon, strafe
 */
export type EnemyState = 'patrol' | 'investigate' | 'attack';

/**
 * ChargeState
 *
 * The melee charge state machine for Brute-type enemies:
 *   - idle: not charging, waiting for player to enter range
 *   - telegraph: warning phase before the charge (red line shown)
 *   - charging: moving toward the player at high speed
 *   - recovering: brief pause after the charge completes
 */
export type ChargeState = 'idle' | 'telegraph' | 'charging' | 'recovering';

/**
 * DashState
 *
 * The dash attack state machine for Reaper-type enemies:
 *   - idle: not dashing, waiting for player to enter range
 *   - telegraph: brief warning before the dash
 *   - dashing: moving toward the player at high speed with trail
 *   - recovering: brief pause after the dash completes
 */
export type DashState = 'idle' | 'telegraph' | 'dashing' | 'recovering';

/**
 * EnemyDeathCallback
 *
 * Callback invoked when an enemy dies. Used by EnemyManager to
 * update the enemy counter and kill feed.
 */
export interface EnemyDeathCallback {
  (enemy: Enemy): void;
}

/**
 * MeleeHitCallback
 *
 * Callback invoked when a melee enemy successfully hits the player.
 * The Game class wires this to apply player damage.
 */
export interface MeleeHitCallback {
  (damage: number): void;
}

/**
 * EnemyProjectile
 *
 * A projectile fired by an enemy. Travels in a straight line,
 * checks wall and player collisions, and expires after maxLife.
 */
interface EnemyProjectile {
  /** The visible mesh for the projectile */
  mesh: THREE.Mesh;
  /** The velocity vector (units per second) */
  velocity: THREE.Vector3;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * DeathParticle
 *
 * A single particle in the enemy's death explosion.
 * Has velocity, rotation velocity, and fades out over its life.
 */
interface DeathParticle {
  /** The visible mesh for the particle */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  /** The velocity vector (units per second) */
  velocity: THREE.Vector3;
  /** The rotation velocity (radians per second) */
  rotationVelocity: THREE.Vector3;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * TelegraphEffect
 *
 * A red warning line shown during a charge telegraph.
 * The line points from the enemy toward the player's position.
 */
interface TelegraphEffect {
  /** The visible mesh for the telegraph line */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * TrailParticle
 *
 * A single red particle spawned behind a dashing enemy.
 * Fades out over its life.
 */
interface TrailParticle {
  /** The visible mesh for the particle */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * Enemy
 *
 * Base enemy entity for the MAZE STRIKE game (Phase 8).
 * Implements the 3-state AI state machine (Patrol → Investigate → Attack)
 * with line-of-sight checks, hearing, alert propagation, health bars,
 * projectile weapons, death explosions, and the following Phase 8 behaviors:
 *
 *   - Burst Fire (Sentry MK-II): fires burstCount shots with burstDelay between
 *   - Melee Charge (Brute): telegraphs, then charges at the player
 *   - Dash Attack (Reaper): telegraphs, then dashes with a red trail
 *   - Shield Blocking (Warden): blocks frontal damage with a shield
 *   - Stealth (Phantom): invisible until it attacks
 *
 * All visuals are procedural THREE.js primitives. No external assets.
 */
export default class Enemy {
  /** Root group containing all enemy meshes */
  public group: THREE.Group = new THREE.Group();

  /** The enemy type identifier */
  public typeId: EnemyTypeId;

  /** The enemy type configuration (static stats) */
  public config: EnemyTypeConfig;

  /** Current health points */
  public health: number;

  /** Maximum health points */
  public maxHealth: number;

  /** Whether the enemy is alive (not destroyed) */
  public isAlive: boolean = true;

  /** Current AI state */
  public state: EnemyState = 'patrol';

  /** Last known player position (for investigate state) */
  public lastKnownPlayerPosition: THREE.Vector3 = new THREE.Vector3();

  /** Time remaining until the next shot can be fired (seconds) */
  public attackCooldown: number = 0;

  /** Timer for strafe direction changes (seconds) */
  public strafeTimer: number = 0;

  /** Current strafe direction: 1 = right, -1 = left */
  public strafeDirection: number = 1;

  /** Timer for line-of-sight checks (seconds) */
  public losTimer: number = 0;

  /** Timer for investigate state (seconds remaining to look around) */
  public investigateTimer: number = 0;

  /** Patrol waypoints (world coordinates) */
  public patrolWaypoints: THREE.Vector3[] = [];

  /** Index of the current patrol waypoint */
  public currentWaypointIndex: number = 0;

  /** Timer for patrol pause at waypoints (seconds) */
  public patrolPauseTimer: number = 0;

  /** Whether the enemy is currently pausing at a waypoint */
  public isPatrolPausing: boolean = false;

  /** Time remaining for the damage flash effect (seconds) */
  public damageFlashTimer: number = 0;

  /** Rotor spin speed for scout drone (radians per second) */
  public rotorSpinSpeed: number = 125.66;

  /** Active death particles */
  public deathParticles: DeathParticle[] = [];

  /** Death explosion light */
  public deathLight: THREE.PointLight | null = null;

  /** Death explosion duration in seconds */
  public deathDuration: number = 0.6;

  /** Gravity constant for death particles (units/s²) */
  public gravity: number = 9.8;

  /** Health bar sprite */
  public healthBarSprite: THREE.Sprite | null = null;

  /** Health bar canvas texture */
  public healthBarTexture: THREE.CanvasTexture | null = null;

  /** The Three.js scene reference */
  public scene: THREE.Scene;

  /** Walkability callback (returns true if position is walkable) */
  public isWalkable: (x: number, z: number) => boolean;

  /** Player position getter callback */
  public getPlayerPosition: () => THREE.Vector3;

  /** Death callback invoked when the enemy dies */
  public onDeath: EnemyDeathCallback;

  /** Melee hit callback invoked when a melee attack hits the player */
  public onMeleeHit: MeleeHitCallback;

  /** Ranged hit callback invoked when a projectile hits the player */
  public onPlayerHit: MeleeHitCallback;

  /** Whether dispose has been called */
  public disposed: boolean = false;

  /** Elapsed time for animations */
  public elapsedTime: number = 0;

  /** Active enemy projectiles */
  public enemyProjectiles: EnemyProjectile[] = [];

  // -------------------------------------------------------------------------
  // Phase 8: Burst Fire State (Sentry MK-II)
  // -------------------------------------------------------------------------

  /** Number of shots fired in the current burst */
  public burstShotCount: number = 0;

  /** Timer for the delay between burst shots (seconds) */
  public burstShotTimer: number = 0;

  // -------------------------------------------------------------------------
  // Phase 8: Melee Charge State (Brute)
  // -------------------------------------------------------------------------

  /** Current charge state */
  public chargeState: ChargeState = 'idle';

  /** Timer for the charge telegraph (seconds) */
  public chargeTelegraphTimer: number = 0;

  /** Timer for the charge duration (seconds) */
  public chargeTimer: number = 0;

  /** Timer for the charge recovery (seconds) */
  public chargeRecoverTimer: number = 0;

  /** Duration of the charge in seconds */
  public readonly chargeDuration: number = 0.6;

  /** Duration of the charge recovery in seconds */
  public readonly chargeRecoverDuration: number = 0.8;

  /** Direction of the charge (set when charge starts) */
  public chargeDirection: THREE.Vector3 = new THREE.Vector3();

  /** Whether the charge has already hit the player (prevents multi-hit) */
  public chargeHasHit: boolean = false;

  // -------------------------------------------------------------------------
  // Phase 8: Dash Attack State (Reaper)
  // -------------------------------------------------------------------------

  /** Current dash state */
  public dashState: DashState = 'idle';

  /** Timer for the dash telegraph (seconds) */
  public dashTelegraphTimer: number = 0;

  /** Timer for the dash duration (seconds) */
  public dashTimer: number = 0;

  /** Timer for the dash recovery (seconds) */
  public dashRecoverTimer: number = 0;

  /** Duration of the dash recovery in seconds */
  public readonly dashRecoverDuration: number = 0.5;

  /** Direction of the dash (set when dash starts) */
  public dashDirection: THREE.Vector3 = new THREE.Vector3();

  /** Whether the dash has already hit the player (prevents multi-hit) */
  public dashHasHit: boolean = false;

  /** Timer for spawning dash trail particles (seconds) */
  public dashTrailTimer: number = 0;

  /** Interval between dash trail particle spawns (seconds) */
  public readonly dashTrailInterval: number = 0.05;

  // -------------------------------------------------------------------------
  // Phase 8: Shield Blocking State (Warden)
  // -------------------------------------------------------------------------

  /** Timer for the shield flash effect (seconds) */
  public shieldFlashTimer: number = 0;

  /** Duration of the shield flash in seconds */
  public readonly shieldFlashDuration: number = 0.15;

  /** Original shield emissive intensity (for reset) */
  public originalShieldEmissiveIntensity: number = 1.5;

  // -------------------------------------------------------------------------
  // Phase 8: Stealth State (Phantom)
  // -------------------------------------------------------------------------

  /** Whether the enemy is currently revealed (visible) */
  public isRevealed: boolean = false;

  /** Timer for the stealth reveal duration (seconds) */
  public stealthTimer: number = 0;

  /** Body materials for stealth opacity control */
  public bodyMaterials: THREE.MeshStandardMaterial[] = [];

  /** Original body material opacities (for reset) */
  public originalBodyOpacities: number[] = [];

  // -------------------------------------------------------------------------
  // Phase 8: Telegraph & Trail Effects
  // -------------------------------------------------------------------------

  /** Active telegraph effects (charge warning lines) */
  public telegraphs: TelegraphEffect[] = [];

  /** Active dash trail particles */
  public trailParticles: TrailParticle[] = [];

  /** Shared geometry for telegraph lines */
  public telegraphGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for trail particles */
  public trailGeometry: THREE.BufferGeometry | null = null;

  /** Reference to the body material for damage flash */
  private bodyMaterial: THREE.MeshStandardMaterial | null = null;

  /** Original emissive intensity of the body material */
  private readonly originalEmissiveIntensity: number = 0;

  /** Duration of the damage flash in seconds */
  private readonly damageFlashDuration: number = 0.1;

    /** Collision radius for movement checks */
  private readonly collisionRadius: number = 0.4;

  /** Entity collision callback: returns true if the position would overlap another entity */
  private entityCollisionCallback: ((x: number, z: number) => boolean) | null = null;

  /** Line-of-sight check interval in seconds */
  private readonly losCheckInterval: number = 0.1;

  /** Investigate look-around duration in seconds */
  private readonly investigateDuration: number = 3.0;

  /** Player lost timer for attack → investigate transition (seconds) */
  private playerLostTimer: number = 0;

  /** Player lost threshold in seconds */
  private readonly playerLostThreshold: number = 3.0;

  /** Shared geometry for death particles (disposed when effect expires) */
  private deathParticleGeometry: THREE.BufferGeometry | null = null;

  /**
   * Creates a new Enemy at the given position.
   * @param scene - The THREE.Scene to add the enemy to
   * @param typeId - The enemy type identifier
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   * @param waypoints - Patrol waypoints (world coordinates)
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
      * @param onDeath - Death callback invoked when the enemy dies
   * @param onMeleeHit - Optional callback invoked when a melee attack hits the player
   * @param onPlayerHit - Optional callback invoked when a ranged projectile hits the player
   * @param healthMultiplier - Difficulty scaling multiplier applied to the enemy's max health (defaults to 1.0)
   */
  constructor(
    scene: THREE.Scene,
    typeId: EnemyTypeId,
    x: number,
    z: number,
    waypoints: THREE.Vector3[],
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
        onDeath: EnemyDeathCallback,
    onMeleeHit?: MeleeHitCallback,
    onPlayerHit?: MeleeHitCallback,
    healthMultiplier: number = 1.0
  ) {
    this.scene = scene;
    this.typeId = typeId;
        this.config = ENEMY_TYPES[typeId];
    this.health = Math.round(this.config.health * healthMultiplier);
    this.maxHealth = this.health;
    this.isWalkable = isWalkable;
    this.getPlayerPosition = getPlayerPosition;
    this.onDeath = onDeath;
    this.onMeleeHit = onMeleeHit || (() => {});
    this.onPlayerHit = onPlayerHit || (() => {});

    // Build the visual model
    this.group = buildEnemyVisual(typeId);

    // Position the enemy on the ground plane
    this.group.position.set(x, 0, z);

    // Store patrol waypoints (if none provided, use a small circle around spawn)
    if (waypoints && waypoints.length >= 2) {
      this.patrolWaypoints = waypoints.map((wp) => wp.clone());
    } else {
      // Generate default waypoints in a small circle around the spawn
      this.generateDefaultWaypoints(x, z);
    }

    // Initialize last known player position to spawn
    this.lastKnownPlayerPosition = new THREE.Vector3(x, 0, z);

    // Build the health bar
    this.buildHealthBar();

    // Initialize Phase 8 behaviors
    this.initializePhase8Behaviors();

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Initializes Phase 8 behaviors based on the enemy type config.
   * Sets up stealth opacity, body material references, and shield references.
   */
  private initializePhase8Behaviors(): void {
    // --- Collect body materials for stealth and damage flash ---
    const storedBodyMaterials = this.group.userData.bodyMaterials as THREE.MeshStandardMaterial[] | undefined;
    if (storedBodyMaterials && storedBodyMaterials.length > 0) {
      this.bodyMaterials = storedBodyMaterials;
    } else {
      // Fallback: collect all non-emissive materials from the group
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material && material.emissive) {
            // Skip emissive materials (glowing parts stay visible in stealth)
            const emissiveHex = material.emissive.getHex();
            if (emissiveHex === 0x000000) {
              this.bodyMaterials.push(material);
            }
          }
        }
      });
    }

    // Store original opacities
    this.originalBodyOpacities = this.bodyMaterials.map((mat) => mat.opacity);

    // --- Initialize stealth (Phantom) ---
    if (this.config.isStealth) {
      this.applyStealthOpacity(0.15);
      this.isRevealed = false;
      this.stealthTimer = 0;
    }

    // --- Initialize shield reference (Warden) ---
    if (this.config.hasShield) {
      const shield = this.group.userData.shield as THREE.Mesh | undefined;
      if (shield) {
        const material = shield.material as THREE.MeshStandardMaterial;
        if (material) {
          this.originalShieldEmissiveIntensity = material.emissiveIntensity;
        }
      }
    }
  }

  /**
   * Applies stealth opacity to all body materials.
   * @param opacity - The opacity value to apply (0.0 - 1.0)
   */
  private applyStealthOpacity(opacity: number): void {
    for (const material of this.bodyMaterials) {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.9;
    }
  }

  /**
   * Generates default patrol waypoints in a small circle around the spawn.
   * @param x - Spawn X coordinate
   * @param z - Spawn Z coordinate
   */
  private generateDefaultWaypoints(x: number, z: number): void {
    const count = this.config.patrolWaypointCount;
    const radius = 3;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const wx = x + Math.cos(angle) * radius;
      const wz = z + Math.sin(angle) * radius;
      this.patrolWaypoints.push(new THREE.Vector3(wx, 0, wz));
    }
  }

  /**
   * Builds the health bar sprite with a canvas texture.
   * The bar is green when full, transitioning to red as health decreases.
   * The sprite is positioned above the enemy's head.
   */
  private buildHealthBar(): void {
    // Create canvas for the health bar
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw initial health bar (full green)
    this.drawHealthBar(ctx, 1.0);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.healthBarTexture = texture;

    // Create sprite material with depthTest disabled
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.6, 0.2, 1);

    // Position above the enemy (scout: 2.2, sentry: 2.6, larger enemies: higher)
    let heightOffset = 2.6;
    if (this.typeId === 'scout_drone') heightOffset = 2.2;
    if (this.typeId === 'brute') heightOffset = 3.2;
    if (this.typeId === 'warden') heightOffset = 3.0;
    sprite.position.y = heightOffset;

    // Add to the enemy group (moves with the enemy)
    this.group.add(sprite);
    this.healthBarSprite = sprite;
  }

  /**
   * Draws the health bar on the canvas.
   * @param ctx - The 2D canvas context
   * @param healthRatio - Health percentage (0.0 to 1.0)
   */
  private drawHealthBar(ctx: CanvasRenderingContext2D, healthRatio: number): void {
    const width = 128;
    const height = 16;

    // Clamp health ratio
    const ratio = THREE.MathUtils.clamp(healthRatio, 0, 1);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background (dark)
    ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Border (cyan)
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Health fill (green to red based on ratio)
    const fillWidth = (width - 4) * ratio;
    const fillHeight = height - 4;

    // Color: green (high) → yellow (mid) → red (low)
    let fillColor: string;
    if (ratio > 0.5) {
      // Green to yellow
      const t = (1 - ratio) * 2; // 0 at full, 1 at 50%
      const r = Math.floor(0 + t * 255);
      const g = Math.floor(255 - t * 100);
      fillColor = `rgb(${r}, ${g}, 0)`;
    } else {
      // Yellow to red
      const t = ratio * 2; // 1 at 50%, 0 at empty
      const r = 255;
      const g = Math.floor(155 * t);
      fillColor = `rgb(${r}, ${g}, 0)`;
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(2, 2, fillWidth, fillHeight);
  }

  /**
   * Updates the health bar sprite texture.
   */
  private updateHealthBar(): void {
    if (!this.healthBarTexture || !this.healthBarSprite) return;

    const canvas = this.healthBarTexture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw with current health ratio
    const ratio = this.health / this.maxHealth;
    this.drawHealthBar(ctx, ratio);

    // Notify texture of update
    this.healthBarTexture.needsUpdate = true;
  }

  /**
   * Applies damage to the enemy.
   * Handles shield blocking (Warden) before applying damage.
   * @param amount - Amount of damage to apply
   */
  public takeDamage(amount: number): void {
    // Ignore if already dead or disposed
    if (!this.isAlive || this.disposed) return;

    // Clamp damage to non-negative
    let damage = Math.max(0, amount);

    // --- Shield Blocking (Warden) ---
    if (this.config.hasShield && this.config.shieldBlockChance > 0) {
      // Check if the damage comes from the front (within 90 degrees of facing)
      const enemyPos = this.group.position;
      const playerPos = this.getPlayerPosition();

      // Direction from enemy to player
      const toPlayer = new THREE.Vector3()
        .subVectors(playerPos, enemyPos)
        .setY(0)
        .normalize();

      // Enemy forward direction (facing +Z by default, rotated by group rotation)
      const forward = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y)
        .normalize();

      // Dot product: 1 = directly in front, -1 = directly behind
      const dot = forward.dot(toPlayer);

      // Front is within 90 degrees (dot > 0)
      if (dot > 0) {
        // Roll for shield block chance
        if (Math.random() < this.config.shieldBlockChance) {
          // Block 80% of the damage
          damage = Math.floor(damage * 0.2);

          // Trigger shield flash effect
          this.triggerShieldFlash();
        }
      }
    }

    // Apply damage
    this.health = Math.max(0, this.health - damage);

    // Trigger damage flash on body materials
    this.damageFlashTimer = this.damageFlashDuration;
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material && material.emissive) {
          material.emissive.setHex(0xff0000);
          material.emissiveIntensity = 1.0;
        }
      }
    });

    // Update health bar
    this.updateHealthBar();

    // Scout Drone flee behavior: when damaged, move away from player
    if (this.typeId === 'scout_drone' && this.health > 0) {
      const playerPos = this.getPlayerPosition();
      const enemyPos = this.group.position;

      // Direction away from player
      const fleeDirection = new THREE.Vector3()
        .subVectors(enemyPos, playerPos)
        .normalize();

      // Set last known player position to a point away from the player
      this.lastKnownPlayerPosition = enemyPos
        .clone()
        .add(fleeDirection.multiplyScalar(5));

      // Switch to investigate state
      this.state = 'investigate';
      this.investigateTimer = this.investigateDuration;
    }

    // Check for death
    if (this.health <= 0) {
      this.die();
    }
  }

  /**
   * Triggers the shield flash effect (Warden).
   * Pulses the shield material's emissive intensity briefly.
   */
  private triggerShieldFlash(): void {
    this.shieldFlashTimer = this.shieldFlashDuration;

    const shield = this.group.userData.shield as THREE.Mesh | undefined;
    if (shield) {
      const material = shield.material as THREE.MeshStandardMaterial;
      if (material) {
        material.emissive.setHex(0x00ccff);
        material.emissiveIntensity = 3.0;
      }
    }
  }

  /**
   * Updates the shield flash effect (fades back to normal).
   * @param deltaTime - Time since last frame in seconds
   */
  private updateShieldFlash(deltaTime: number): void {
    if (this.shieldFlashTimer <= 0) return;

    this.shieldFlashTimer -= deltaTime;

    if (this.shieldFlashTimer <= 0) {
      // Reset shield material
      const shield = this.group.userData.shield as THREE.Mesh | undefined;
      if (shield) {
        const material = shield.material as THREE.MeshStandardMaterial;
        if (material) {
          material.emissive.setHex(0x0088ff);
          material.emissiveIntensity = this.originalShieldEmissiveIntensity;
        }
      }
    }
  }

  /**
   * Triggers the death explosion: spawns particles and a light flash,
   * then removes the enemy from the scene and calls onDeath.
   */
  private die(): void {
    // Mark as not alive
    this.isAlive = false;

    // --- Spawn Explosion Particles ---
    const particleCount = 12 + Math.floor(Math.random() * 9); // 12-20
    const particleGeometry = new THREE.TetrahedronGeometry(0.08);
    this.deathParticleGeometry = particleGeometry;

    for (let i = 0; i < particleCount; i++) {
      // Random direction (biased upward)
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.8 + 0.2, // Upward bias
        Math.random() * 2 - 1
      ).normalize();

      // Random speed
      const speed = 3 + Math.random() * 4;

      // Create material with config explosion color
      const material = new THREE.MeshStandardMaterial({
        color: this.config.explosionColor,
        emissive: this.config.explosionColor,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 1.0,
        roughness: 0.4,
        metalness: 0.6,
      });

      // Create particle mesh
      const particle = new THREE.Mesh(particleGeometry, material);
      particle.position.copy(this.group.position);
      particle.position.y += 1.0; // Center of enemy
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Store velocity and rotation velocity
      const velocity = direction.multiplyScalar(speed);
      const rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );

      this.scene.add(particle);

      this.deathParticles.push({
        mesh: particle,
        material,
        velocity,
        rotationVelocity,
        life: this.deathDuration,
        maxLife: this.deathDuration,
      });
    }

    // --- Spawn Light Flash ---
    const light = new THREE.PointLight(this.config.explosionColor, 5, 8);
    light.position.copy(this.group.position);
    light.position.y = 1.0;
    this.scene.add(light);
    this.deathLight = light;

    // --- Remove Enemy from Scene ---
    this.scene.remove(this.group);

    // --- Invoke Death Callback ---
    this.onDeath(this);
  }

  /**
   * Updates the enemy's animations, AI, and projectiles.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Track elapsed time
    this.elapsedTime += deltaTime;

    // Update damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= deltaTime;
      if (this.damageFlashTimer <= 0) {
        // Reset emissive to original (no glow)
        this.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshStandardMaterial;
            if (material && material.emissive) {
              material.emissive.setHex(0x000000);
              material.emissiveIntensity = this.originalEmissiveIntensity;
            }
          }
        });
      }
    }

    // Update death particles
    this.updateDeathParticles(deltaTime);

    // Skip AI updates if dead
    if (!this.isAlive) return;

    // Update shield flash (Warden)
    this.updateShieldFlash(deltaTime);

    // Update stealth (Phantom)
    this.updateStealth(deltaTime);

    // Update telegraph effects
    this.updateTelegraphs(deltaTime);

    // Update dash trail particles
    this.updateTrailParticles(deltaTime);

    // Health bar always faces camera (billboard)
    if (this.healthBarSprite) {
      // Sprites automatically face the camera in Three.js
      // No manual billboard needed
    }

    // Rotor spin for scout drone
    if (this.typeId === 'scout_drone') {
      const rotors = this.group.userData.rotors as THREE.Group[] | undefined;
      if (rotors) {
        for (const rotor of rotors) {
          rotor.rotation.y += this.rotorSpinSpeed * deltaTime;
        }
      }
    }

    // Scythe arm animation for reaper
    if (this.typeId === 'reaper') {
      const scytheArm = this.group.userData.scytheArm as THREE.Group | undefined;
      if (scytheArm) {
        // Subtle swaying animation
        scytheArm.rotation.z = Math.sin(this.elapsedTime * 2) * 0.05;
      }
    }

    // Core pulse animation for brute and phantom
    if (this.typeId === 'brute' || this.typeId === 'phantom') {
      const core = this.group.userData.core as THREE.Mesh | undefined;
      if (core) {
        const material = core.material as THREE.MeshStandardMaterial;
        if (material) {
          material.emissiveIntensity = 2.0 + Math.sin(this.elapsedTime * 3) * 0.5;
        }
      }
    }

    // Line-of-sight check every 0.1s
    this.losTimer -= deltaTime;
    if (this.losTimer <= 0) {
      this.losTimer = this.losCheckInterval;
      this.checkLineOfSight();
    }

    // Update AI state machine
    this.updateAI(deltaTime);

    // Update attack cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // Update strafe timer
    this.strafeTimer -= deltaTime;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = this.config.strafeInterval;
      this.strafeDirection *= -1;
    }

    // Update burst fire state (Sentry MK-II)
    this.updateBurstFire(deltaTime);

    // Update charge state (Brute)
    this.updateChargeState(deltaTime);

    // Update dash state (Reaper)
    this.updateDashState(deltaTime);

    // Update enemy projectiles
    this.updateEnemyProjectiles(deltaTime);
  }

  /**
   * Updates the AI state machine.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateAI(deltaTime: number): void {
    switch (this.state) {
      case 'patrol':
        this.updatePatrol(deltaTime);
        break;
      case 'investigate':
        this.updateInvestigate(deltaTime);
        break;
      case 'attack':
        this.updateAttack(deltaTime);
        break;
    }
  }

  /**
   * Patrol state: move toward current waypoint, pause at each.
   * @param deltaTime - Time since last frame in seconds
   */
  private updatePatrol(deltaTime: number): void {
    // Check if player is visible → attack
    if (this.canSeePlayer()) {
      this.state = 'attack';
      this.playerLostTimer = 0;
      return;
    }

    // Check if player is glimpsed (within sight range but not LOS) → investigate
    const playerPos = this.getPlayerPosition();
    const enemyPos = this.group.position;
    const distToPlayer = enemyPos.distanceTo(playerPos);
    if (distToPlayer <= this.config.sightRange) {
      // Player is within sight range but not in LOS (canSeePlayer returned false)
      // This is a glimpse → investigate
      this.lastKnownPlayerPosition = playerPos.clone();
      this.state = 'investigate';
      this.investigateTimer = this.investigateDuration;
      return;
    }

    // If pausing at a waypoint
    if (this.isPatrolPausing) {
      this.patrolPauseTimer -= deltaTime;
      if (this.patrolPauseTimer <= 0) {
        this.isPatrolPausing = false;
        // Advance to next waypoint
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.patrolWaypoints.length;
      }
      return;
    }

    // Move toward current waypoint
    const target = this.patrolWaypoints[this.currentWaypointIndex];
    const toTarget = new THREE.Vector3().subVectors(target, enemyPos);
    toTarget.y = 0;

    // Check if reached the waypoint
    if (toTarget.length() < 0.5) {
      // Start pausing
      this.isPatrolPausing = true;
      this.patrolPauseTimer = this.config.patrolPauseMin +
        Math.random() * (this.config.patrolPauseMax - this.config.patrolPauseMin);
      return;
    }

    // Move toward waypoint
    const moveDir = toTarget.normalize();
    const moveSpeed = this.config.speed * deltaTime;
    const newX = enemyPos.x + moveDir.x * moveSpeed;
    const newZ = enemyPos.z + moveDir.z * moveSpeed;

            // Move with sliding collision
    this.tryMove(newX, newZ);
  }

  /**
   * Investigate state: move to last known player position, look around.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateInvestigate(deltaTime: number): void {
    // Check if player is visible → attack
    if (this.canSeePlayer()) {
      this.state = 'attack';
      this.playerLostTimer = 0;
      return;
    }

    // Decrement investigate timer
    this.investigateTimer -= deltaTime;

    // If timer expires → patrol
    if (this.investigateTimer <= 0) {
      this.state = 'patrol';
      this.isPatrolPausing = false;
      return;
    }

    // Move toward last known player position
    const enemyPos = this.group.position;
    const toTarget = new THREE.Vector3().subVectors(this.lastKnownPlayerPosition, enemyPos);
    toTarget.y = 0;

    // Check if reached the last known position
    if (toTarget.length() < 0.5) {
      // Look around (stay in place, timer will expire)
      return;
    }

    // Move toward last known position
    const moveDir = toTarget.normalize();
    const moveSpeed = this.config.speed * deltaTime;
    const newX = enemyPos.x + moveDir.x * moveSpeed;
    const newZ = enemyPos.z + moveDir.z * moveSpeed;

            // Move with sliding collision
    this.tryMove(newX, newZ);
  }

  /**
   * Attack state: chase player, strafe, fire weapon or melee attack.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateAttack(deltaTime: number): void {
    const playerPos = this.getPlayerPosition();
    const enemyPos = this.group.position;

    // Check if player is still visible
    if (this.canSeePlayer()) {
      // Reset player lost timer
      this.playerLostTimer = 0;
    } else {
      // Increment player lost timer
      this.playerLostTimer += deltaTime;

      // If player lost for 3 seconds → investigate
      if (this.playerLostTimer >= this.playerLostThreshold) {
        this.lastKnownPlayerPosition = playerPos.clone();
        this.state = 'investigate';
        this.investigateTimer = this.investigateDuration;
        return;
      }
    }

    // Calculate direction to player
    const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    // --- Melee Enemy Behavior (Brute, Reaper) ---
    if (this.config.isMelee) {
      // Face the player
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
      this.group.rotation.y = targetAngle;

      // Handle melee attack based on type
      if (this.config.chargeSpeed > 0) {
        // Brute: charge attack
        this.handleChargeAttack(distToPlayer, deltaTime);
      } else if (this.config.dashSpeed > 0) {
        // Reaper: dash attack
        this.handleDashAttack(distToPlayer, deltaTime);
      }

      // If not charging or dashing, move toward the player
      if (this.chargeState === 'idle' && this.dashState === 'idle') {
        // Move toward player
        const moveDir = toPlayer.clone().normalize();
        const moveSpeed = this.config.speed * deltaTime;
        const newX = enemyPos.x + moveDir.x * moveSpeed;
        const newZ = enemyPos.z + moveDir.z * moveSpeed;

                        // Move with sliding collision
        this.tryMove(newX, newZ);
      }

      return;
    }

    // --- Ranged Enemy Behavior ---

    // --- Movement: Maintain Shooting Distance + Strafe ---
    // When within shooting range, stop chasing and only strafe to dodge.
    // When beyond shooting range, chase toward the player.
    // preferredRange = 60% of attackRange — the ideal distance to engage from.
    const preferredRange = this.config.attackRange * 0.6;
    const moveDir = new THREE.Vector3();

    if (distToPlayer > this.config.attackRange) {
      // Too far: chase toward player + strafe
      if (distToPlayer > 0.1) {
        moveDir.add(toPlayer.clone().normalize());
      }
      const strafeDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      moveDir.add(strafeDir.multiplyScalar(this.strafeDirection * 0.7));
    } else if (distToPlayer < preferredRange) {
      // Too close: strafe only (move perpendicular to player)
      const strafeDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      moveDir.add(strafeDir.multiplyScalar(this.strafeDirection));
      // Add slight retreat component (move away from player)
      if (distToPlayer > 0.1) {
        moveDir.add(toPlayer.clone().normalize().multiplyScalar(-0.3));
      }
    } else {
      // In the sweet spot: strafe only, hold position
      const strafeDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      moveDir.add(strafeDir.multiplyScalar(this.strafeDirection * 0.8));
    }

    // Normalize movement direction
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    // Apply movement with collision check
    const moveSpeed = this.config.speed * deltaTime;
    const newX = enemyPos.x + moveDir.x * moveSpeed;
    const newZ = enemyPos.z + moveDir.z * moveSpeed;

            // Move with sliding collision
    this.tryMove(newX, newZ);

    // Face the player
    const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
    this.group.rotation.y = targetAngle;

    // --- Attack: Fire Weapon ---
    if (distToPlayer <= this.config.attackRange && this.canSeePlayer()) {
      this.fireWeapon();
    }
  }

  /**
   * Handles the charge attack for Brute-type enemies.
   * @param distToPlayer - Distance from the enemy to the player
   * @param deltaTime - Time since last frame in seconds
   */
  private handleChargeAttack(distToPlayer: number, deltaTime: number): void {
    switch (this.chargeState) {
      case 'idle':
        // Start telegraph when player is within attack range
        if (distToPlayer <= this.config.attackRange) {
          this.chargeState = 'telegraph';
          this.chargeTelegraphTimer = this.config.chargeTelegraphDuration;
          this.chargeHasHit = false;

          // Spawn the telegraph warning line
          this.spawnChargeTelegraph();
        }
        break;

      case 'telegraph':
        // Count down the telegraph
        this.chargeTelegraphTimer -= deltaTime;
        if (this.chargeTelegraphTimer <= 0) {
          // Start charging
          this.chargeState = 'charging';
          this.chargeTimer = this.chargeDuration;

          // Set charge direction toward the player
          const playerPos = this.getPlayerPosition();
          const enemyPos = this.group.position;
          this.chargeDirection = new THREE.Vector3()
            .subVectors(playerPos, enemyPos)
            .setY(0)
            .normalize();

          // Clear telegraph effects
          this.clearTelegraphs();
        }
        break;

      case 'charging':
        // Move in the charge direction at charge speed
        const chargeSpeed = this.config.speed * this.config.chargeSpeed * deltaTime;
        const newX = this.group.position.x + this.chargeDirection.x * chargeSpeed;
        const newZ = this.group.position.z + this.chargeDirection.z * chargeSpeed;

                        if (!this.tryMove(newX, newZ)) {
          // Hit a wall or entity - stop charging
          this.chargeState = 'recovering';
          this.chargeRecoverTimer = this.chargeRecoverDuration;
          break;
        }

        // Check if we hit the player
        if (!this.chargeHasHit) {
          const playerPos = this.getPlayerPosition();
          const dx = this.group.position.x - playerPos.x;
          const dz = this.group.position.z - playerPos.z;
          const distSq = dx * dx + dz * dz;

          // Player hit radius: 0.8 units
          if (distSq < 0.64) {
            // Apply melee damage
            this.applyMeleeDamage();
            this.chargeHasHit = true;

            // Stop charging after hitting the player
            this.chargeState = 'recovering';
            this.chargeRecoverTimer = this.chargeRecoverDuration;
          }
        }

        // Decrement charge timer
        this.chargeTimer -= deltaTime;
        if (this.chargeTimer <= 0) {
          this.chargeState = 'recovering';
          this.chargeRecoverTimer = this.chargeRecoverDuration;
        }
        break;

      case 'recovering':
        // Count down recovery
        this.chargeRecoverTimer -= deltaTime;
        if (this.chargeRecoverTimer <= 0) {
          this.chargeState = 'idle';
        }
        break;
    }
  }

  /**
   * Handles the dash attack for Reaper-type enemies.
   * @param distToPlayer - Distance from the enemy to the player
   * @param deltaTime - Time since last frame in seconds
   */
  private handleDashAttack(distToPlayer: number, deltaTime: number): void {
    switch (this.dashState) {
      case 'idle':
        // Start telegraph when player is within attack range
        if (distToPlayer <= this.config.attackRange) {
          this.dashState = 'telegraph';
          this.dashTelegraphTimer = 0.3; // Brief telegraph
          this.dashHasHit = false;

          // Spawn the telegraph warning line
          this.spawnChargeTelegraph();
        }
        break;

      case 'telegraph':
        // Count down the telegraph
        this.dashTelegraphTimer -= deltaTime;
        if (this.dashTelegraphTimer <= 0) {
          // Start dashing
          this.dashState = 'dashing';
          this.dashTimer = this.config.dashDuration;
          this.dashTrailTimer = 0;

          // Set dash direction toward the player
          const playerPos = this.getPlayerPosition();
          const enemyPos = this.group.position;
          this.dashDirection = new THREE.Vector3()
            .subVectors(playerPos, enemyPos)
            .setY(0)
            .normalize();

          // Clear telegraph effects
          this.clearTelegraphs();
        }
        break;

      case 'dashing':
        // Move in the dash direction at dash speed
        const dashSpeed = this.config.speed * this.config.dashSpeed * deltaTime;
        const newX = this.group.position.x + this.dashDirection.x * dashSpeed;
        const newZ = this.group.position.z + this.dashDirection.z * dashSpeed;

                        if (!this.tryMove(newX, newZ)) {
          // Hit a wall or entity - stop dashing
          this.dashState = 'recovering';
          this.dashRecoverTimer = this.dashRecoverDuration;
          break;
        }

        // Spawn trail particles
        this.dashTrailTimer -= deltaTime;
        if (this.dashTrailTimer <= 0) {
          this.dashTrailTimer = this.dashTrailInterval;
          this.spawnDashTrail();
        }

        // Check if we hit the player
        if (!this.dashHasHit) {
          const playerPos = this.getPlayerPosition();
          const dx = this.group.position.x - playerPos.x;
          const dz = this.group.position.z - playerPos.z;
          const distSq = dx * dx + dz * dz;

          // Player hit radius: 0.8 units
          if (distSq < 0.64) {
            // Apply melee damage
            this.applyMeleeDamage();
            this.dashHasHit = true;

            // Stop dashing after hitting the player
            this.dashState = 'recovering';
            this.dashRecoverTimer = this.dashRecoverDuration;
          }
        }

        // Decrement dash timer
        this.dashTimer -= deltaTime;
        if (this.dashTimer <= 0) {
          this.dashState = 'recovering';
          this.dashRecoverTimer = this.dashRecoverDuration;
        }
        break;

      case 'recovering':
        // Count down recovery
        this.dashRecoverTimer -= deltaTime;
        if (this.dashRecoverTimer <= 0) {
          this.dashState = 'idle';
        }
        break;
    }
  }

  /**
   * Applies melee damage to the player via the onMeleeHit callback.
   */
  private applyMeleeDamage(): void {
    this.onMeleeHit(this.config.damage);
  }

  /**
   * Spawns a red warning line from the enemy toward the player.
   * Used for both charge and dash telegraphs.
   */
  private spawnChargeTelegraph(): void {
    const enemyPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Direction from enemy to player
    const direction = new THREE.Vector3()
      .subVectors(playerPos, enemyPos)
      .setY(0);

    const distance = direction.length();
    if (distance < 0.1) return;

    direction.normalize();

    // Create the telegraph line (thin red box)
    if (!this.telegraphGeometry) {
      this.telegraphGeometry = new THREE.BoxGeometry(0.15, 0.05, 1);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.telegraphGeometry, material);

    // Position the line at the midpoint between enemy and player
    const midpoint = enemyPos.clone().add(playerPos).multiplyScalar(0.5);
    midpoint.y = 0.3; // Slightly above ground
    mesh.position.copy(midpoint);

    // Scale the line to span the distance
    mesh.scale.set(1, 1, distance);

    // Rotate the line to point toward the player
    const angle = Math.atan2(direction.x, direction.z);
    mesh.rotation.y = angle;

    // Add to scene
    this.scene.add(mesh);

    // Store the telegraph effect
    const duration = this.config.chargeTelegraphDuration > 0
      ? this.config.chargeTelegraphDuration
      : 0.3;

    this.telegraphs.push({
      mesh,
      material,
      life: duration,
      maxLife: duration,
    });
  }

  /**
   * Spawns a red trail particle behind the enemy during a dash.
   */
  private spawnDashTrail(): void {
    if (!this.trailGeometry) {
      this.trailGeometry = new THREE.SphereGeometry(0.12, 6, 6);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.trailGeometry, material);

    // Position at the enemy's current position, slightly behind
    mesh.position.copy(this.group.position);
    mesh.position.y = 0.5;

    this.scene.add(mesh);

    // Store the trail particle
    const life = 0.4;
    this.trailParticles.push({
      mesh,
      material,
      life,
      maxLife: life,
    });
  }

  /**
   * Clears all active telegraph effects.
   */
  private clearTelegraphs(): void {
    for (const telegraph of this.telegraphs) {
      this.scene.remove(telegraph.mesh);
      telegraph.material.dispose();
    }
    this.telegraphs = [];
  }

  /**
   * Updates all active telegraph effects (fading).
   * @param deltaTime - Time since last frame in seconds
   */
  private updateTelegraphs(deltaTime: number): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const telegraph = this.telegraphs[i];
      telegraph.life -= deltaTime;

      if (telegraph.life <= 0) {
        // Remove from scene
        this.scene.remove(telegraph.mesh);
        telegraph.material.dispose();
        this.telegraphs.splice(i, 1);
        continue;
      }

      // Pulse opacity
      const pulse = Math.sin(this.elapsedTime * 15) * 0.2 + 0.6;
      telegraph.material.opacity = pulse;
    }
  }

  /**
   * Updates all active dash trail particles (fading).
   * @param deltaTime - Time since last frame in seconds
   */
  private updateTrailParticles(deltaTime: number): void {
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        // Remove from scene
        this.scene.remove(particle.mesh);
        particle.material.dispose();
        this.trailParticles.splice(i, 1);
        continue;
      }

      // Fade opacity
      const ratio = particle.life / particle.maxLife;
      particle.material.opacity = ratio * 0.7;
    }
  }

  /**
   * Updates the burst fire state (Sentry MK-II).
   * Handles the delay between burst shots.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateBurstFire(deltaTime: number): void {
    if (!this.config.isBurstFire) return;

    // If we have burst shots remaining and the burst timer is active
    if (this.burstShotCount > 0 && this.burstShotTimer > 0) {
      this.burstShotTimer -= deltaTime;

      // When the timer expires, fire the next burst shot
      if (this.burstShotTimer <= 0) {
        this.fireBurstShot();
      }
    }
  }

    /**
   * Updates the melee charge state machine (Brute).
   * Handles the idle → telegraph → charging → recovering cycle.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateChargeState(deltaTime: number): void {
    // Only Brute-type enemies charge
    if (this.typeId !== 'brute') return;

    switch (this.chargeState) {
      case 'idle': {
        // Check if player is within attack range to start telegraph
        const playerPos = this.getPlayerPosition();
        const enemyPos = this.group.position;
        const distSq = playerPos.distanceToSquared(enemyPos);
        const attackRangeSq = this.config.attackRange * this.config.attackRange;

        if (distSq <= attackRangeSq && this.canSeePlayer()) {
          this.chargeState = 'telegraph';
          this.chargeTelegraphTimer = this.config.chargeTelegraphDuration;
          this.chargeHasHit = false;
        }
        break;
      }

      case 'telegraph': {
        this.chargeTelegraphTimer -= deltaTime;
        if (this.chargeTelegraphTimer <= 0) {
          // Start charging toward the player
          this.chargeState = 'charging';
          this.chargeTimer = this.chargeDuration;

          // Lock direction toward player at charge start
          const playerPos = this.getPlayerPosition();
          this.chargeDirection
            .subVectors(playerPos, this.group.position)
            .setY(0)
            .normalize();
        }
        break;
      }

      case 'charging': {
        this.chargeTimer -= deltaTime;

        // Move at charge speed in locked direction
        const chargeSpeed = this.config.chargeSpeed * this.config.speed;
        const moveAmount = chargeSpeed * deltaTime;
        const newX = this.group.position.x + this.chargeDirection.x * moveAmount;
        const newZ = this.group.position.z + this.chargeDirection.z * moveAmount;

                        // Move with sliding collision
        this.tryMove(newX, newZ);

        // Check for player collision (melee hit)
        if (!this.chargeHasHit) {
          const playerPos = this.getPlayerPosition();
          const distSq = this.group.position.distanceToSquared(playerPos);
          const hitRangeSq = 1.5 * 1.5;
          if (distSq <= hitRangeSq) {
            this.chargeHasHit = true;
            this.onMeleeHit(this.config.damage);
          }
        }

        // Charge complete
        if (this.chargeTimer <= 0) {
          this.chargeState = 'recovering';
          this.chargeRecoverTimer = this.chargeRecoverDuration;
        }
        break;
      }

      case 'recovering': {
        this.chargeRecoverTimer -= deltaTime;
        if (this.chargeRecoverTimer <= 0) {
          this.chargeState = 'idle';
        }
        break;
      }
    }
  }

  /**
   * Updates the dash attack state machine (Reaper).
   * Handles the idle → telegraph → dashing → recovering cycle.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateDashState(deltaTime: number): void {
    // Only Reaper-type enemies dash
    if (this.typeId !== 'reaper') return;

    switch (this.dashState) {
      case 'idle': {
        // Check if player is within attack range to start telegraph
        const playerPos = this.getPlayerPosition();
        const enemyPos = this.group.position;
        const distSq = playerPos.distanceToSquared(enemyPos);
        const attackRangeSq = this.config.attackRange * this.config.attackRange;

        if (distSq <= attackRangeSq && this.canSeePlayer()) {
          this.dashState = 'telegraph';
          this.dashTelegraphTimer = 0.3; // Brief telegraph
          this.dashHasHit = false;
        }
        break;
      }

      case 'telegraph': {
        this.dashTelegraphTimer -= deltaTime;
        if (this.dashTelegraphTimer <= 0) {
          // Start dashing toward the player
          this.dashState = 'dashing';
          this.dashTimer = this.config.dashDuration;

          // Lock direction toward player at dash start
          const playerPos = this.getPlayerPosition();
          this.dashDirection
            .subVectors(playerPos, this.group.position)
            .setY(0)
            .normalize();
        }
        break;
      }

      case 'dashing': {
        this.dashTimer -= deltaTime;

        // Move at dash speed in locked direction
        const dashSpeed = this.config.dashSpeed * this.config.speed;
        const moveAmount = dashSpeed * deltaTime;
        const newX = this.group.position.x + this.dashDirection.x * moveAmount;
        const newZ = this.group.position.z + this.dashDirection.z * moveAmount;

                        // Move with sliding collision
        this.tryMove(newX, newZ);

        // Spawn dash trail particles
        this.dashTrailTimer -= deltaTime;
        if (this.dashTrailTimer <= 0) {
          this.dashTrailTimer = this.dashTrailInterval;
          this.spawnDashTrailParticle();
        }

        // Check for player collision (melee hit)
        if (!this.dashHasHit) {
          const playerPos = this.getPlayerPosition();
          const distSq = this.group.position.distanceToSquared(playerPos);
          const hitRangeSq = 1.5 * 1.5;
          if (distSq <= hitRangeSq) {
            this.dashHasHit = true;
            this.onMeleeHit(this.config.damage);
          }
        }

        // Dash complete
        if (this.dashTimer <= 0) {
          this.dashState = 'recovering';
          this.dashRecoverTimer = this.dashRecoverDuration;
        }
        break;
      }

      case 'recovering': {
        this.dashRecoverTimer -= deltaTime;
        if (this.dashRecoverTimer <= 0) {
          this.dashState = 'idle';
        }
        break;
      }
    }
  }

  /**
   * Spawns a trail particle behind the Reaper during a dash.
   */
  private spawnDashTrailParticle(): void {
    // Create a small glowing particle at the enemy's position
    const particleGeometry = new THREE.SphereGeometry(0.08, 6, 6);
    const particleMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    });

    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(this.group.position);
    particle.position.y = 1.0;
    this.scene.add(particle);

    // Store as a projectile with zero velocity and short life
    this.enemyProjectiles.push({
      mesh: particle,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.3,
      maxLife: 0.3,
    });
  }

  /**
   * Fires a single burst shot (Sentry MK-II).
   * Called by updateBurstFire when the burst timer expires.
   */
  private fireBurstShot(): void {
    // Get muzzle world position
    const muzzlePos = this.getMuzzleWorldPosition();

    // Get player position
    const playerPos = this.getPlayerPosition();

    // Calculate direction to player
    const direction = new THREE.Vector3().subVectors(playerPos, muzzlePos).normalize();

    // --- Spawn Projectile ---
    const projectileGeometry = new THREE.SphereGeometry(this.config.projectileSize, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: this.config.projectileColor,
      emissive: this.config.projectileColor,
      emissiveIntensity: 2.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.position.copy(muzzlePos);
    this.scene.add(projectile);

    // Calculate velocity
    const velocity = direction.clone().multiplyScalar(this.config.projectileSpeed);

    // Store projectile
    this.enemyProjectiles.push({
      mesh: projectile,
      velocity,
      life: 3.0,
      maxLife: 3.0,
    });

    // --- Spawn Muzzle Flash Light ---
    const flashLight = new THREE.PointLight(this.config.projectileColor, 3, 5);
    flashLight.position.copy(muzzlePos);
    this.scene.add(flashLight);

    // --- Spawn Small Glow at Muzzle ---
    const glowGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: this.config.projectileColor,
      emissive: this.config.projectileColor,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 1.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(muzzlePos);
    this.scene.add(glow);

    // Fade out the glow and light over 50ms
    const fadeDuration = 0.05;

    // Store in the projectiles array with zero velocity
    this.enemyProjectiles.push({
      mesh: glow,
      velocity: new THREE.Vector3(0, 0, 0),
      life: fadeDuration,
      maxLife: fadeDuration,
    });

    // Add the light to the glow's userData for cleanup
    glow.userData.flashLight = flashLight;

    // Decrement burst shot count
    this.burstShotCount--;

    // If we have more shots in the burst, set the timer
    if (this.burstShotCount > 0) {
      this.burstShotTimer = this.config.burstDelay;
    } else {
      // Burst complete - set a longer cooldown based on fire rate
      this.attackCooldown = 60 / this.config.fireRateRPM;
    }
  }

  /**
   * Checks line of sight from the enemy to the player.
   * Samples points along the line every 0.5 units and checks walkability.
   * @returns True if the line is unobstructed, false otherwise
   */
  private checkLineOfSight(): boolean {
    const enemyPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Calculate direction and distance
    const direction = new THREE.Vector3().subVectors(playerPos, enemyPos);
    direction.y = 0;
    const distance = direction.length();

    // If distance is 0, LOS is true
    if (distance < 0.01) return true;

    // Normalize direction
    const dir = direction.clone().normalize();

    // Sample points along the line every 0.5 units
    const stepSize = 0.5;
    const steps = Math.floor(distance / stepSize);

    for (let i = 1; i <= steps; i++) {
      const t = i * stepSize;
      const sampleX = enemyPos.x + dir.x * t;
      const sampleZ = enemyPos.z + dir.z * t;

      // Check if the sample point is walkable
      if (!this.isWalkable(sampleX, sampleZ)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the enemy can see the player.
   * Conditions: distance <= sightRange AND angle within sightConeDegrees/2 AND LOS.
   * @returns True if the player is visible, false otherwise
   */
  private canSeePlayer(): boolean {
    const enemyPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Calculate distance
    const dx = playerPos.x - enemyPos.x;
    const dz = playerPos.z - enemyPos.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    // Check distance
    if (dist > this.config.sightRange) {
      return false;
    }

    // Check angle within sight cone
    // Enemy faces +Z direction by default
    // Calculate angle between enemy forward (+Z) and direction to player
    const forward = new THREE.Vector3(0, 0, 1);
    const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();

    // Account for enemy rotation
    const enemyForward = forward.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.group.rotation.y
    );

    const angle = enemyForward.angleTo(toPlayer);
    const halfCone = (this.config.sightConeDegrees * Math.PI) / 360;

    if (angle > halfCone) {
      return false;
    }

    // Check line of sight
    return this.checkLineOfSight();
  }

  /**
   * Called by Game when the player fires a weapon.
   * If the gunfire is within hearing radius, the enemy investigates.
   * @param gunfirePosition - World position of the gunfire
   */
  public hearGunfire(gunfirePosition: THREE.Vector3): void {
    // Ignore if dead or disposed
    if (!this.isAlive || this.disposed) return;

    // Calculate distance to gunfire
    const enemyPos = this.group.position;
    const dx = gunfirePosition.x - enemyPos.x;
    const dz = gunfirePosition.z - enemyPos.z;
    const distSq = dx * dx + dz * dz;

    // Check if within hearing radius
    if (distSq <= this.config.hearingRadius * this.config.hearingRadius) {
      // Set last known player position and switch to investigate
      this.lastKnownPlayerPosition = gunfirePosition.clone();
      this.state = 'investigate';
      this.investigateTimer = this.investigateDuration;
    }
  }

  /**
   * Called by EnemyManager for alert propagation.
   * Switches the enemy to attack state.
   */
  public alert(): void {
    // Ignore if dead or disposed
    if (!this.isAlive || this.disposed) return;

    // Switch to attack state
    this.state = 'attack';
    this.playerLostTimer = 0;
  }

  /**
   * Fires the enemy's weapon toward the player.
   * Handles burst fire (Sentry MK-II) and stealth reveal (Phantom).
   */
  private fireWeapon(): void {
    // Check attack cooldown
    if (this.attackCooldown > 0) return;

    // --- Burst Fire (Sentry MK-II) ---
    if (this.config.isBurstFire) {
      // Start a new burst
      if (this.burstShotCount === 0) {
        this.burstShotCount = this.config.burstCount;
        this.burstShotTimer = 0; // Fire first shot immediately
        this.attackCooldown = 0; // No cooldown during burst
      }
      return; // Burst shots are fired by updateBurstFire
    }

    // --- Standard Fire ---
    // Set cooldown based on fire rate
    this.attackCooldown = 60 / this.config.fireRateRPM;

    // Get muzzle world position
    const muzzlePos = this.getMuzzleWorldPosition();

    // Get player position
    const playerPos = this.getPlayerPosition();

    // Calculate direction to player
    const direction = new THREE.Vector3().subVectors(playerPos, muzzlePos).normalize();

    // --- Stealth Reveal (Phantom) ---
    if (this.config.isStealth) {
      this.isRevealed = true;
      this.stealthTimer = this.config.stealthRevealDuration;
      this.applyStealthOpacity(1.0);
    }

    // --- Spawn Projectile ---
    const projectileGeometry = new THREE.SphereGeometry(this.config.projectileSize, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: this.config.projectileColor,
      emissive: this.config.projectileColor,
      emissiveIntensity: 2.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.position.copy(muzzlePos);
    this.scene.add(projectile);

    // Calculate velocity
    const velocity = direction.clone().multiplyScalar(this.config.projectileSpeed);

    // Store projectile
    this.enemyProjectiles.push({
      mesh: projectile,
      velocity,
      life: 3.0,
      maxLife: 3.0,
    });

    // --- Spawn Muzzle Flash Light ---
    const flashLight = new THREE.PointLight(this.config.projectileColor, 3, 5);
    flashLight.position.copy(muzzlePos);
    this.scene.add(flashLight);

    // --- Spawn Small Glow at Muzzle ---
    const glowGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: this.config.projectileColor,
      emissive: this.config.projectileColor,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 1.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(muzzlePos);
    this.scene.add(glow);

    // Fade out the glow and light over 50ms
    const fadeDuration = 0.05;

    // Store in the projectiles array with zero velocity
    this.enemyProjectiles.push({
      mesh: glow,
      velocity: new THREE.Vector3(0, 0, 0),
      life: fadeDuration,
      maxLife: fadeDuration,
    });

    // Add the light to the glow's userData for cleanup
    glow.userData.flashLight = flashLight;
  }

  /**
   * Updates the stealth state (Phantom).
   * Re-stealths the enemy after the reveal duration expires.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateStealth(deltaTime: number): void {
    if (!this.config.isStealth) return;

    // If revealed, count down the reveal timer
    if (this.isRevealed) {
      this.stealthTimer -= deltaTime;

      // Re-stealth when the timer expires
      if (this.stealthTimer <= 0) {
        this.isRevealed = false;
        this.applyStealthOpacity(0.15);
      }
    }
  }

  /**
   * Updates all enemy projectiles.
   * Moves projectiles, checks wall and player collisions, spawns impacts.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateEnemyProjectiles(deltaTime: number): void {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.enemyProjectiles[i];

      // Decrement life
      projectile.life -= deltaTime;

      // Remove if life expired
      if (projectile.life <= 0) {
        // Remove the mesh
        this.scene.remove(projectile.mesh);

        // Dispose resources
        projectile.mesh.geometry.dispose();
        (projectile.mesh.material as THREE.MeshStandardMaterial).dispose();

        // Clean up flash light if present
        const flashLight = projectile.mesh.userData.flashLight as THREE.PointLight | undefined;
        if (flashLight) {
          this.scene.remove(flashLight);
          flashLight.dispose();
        }

        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Skip movement for zero-velocity projectiles (muzzle glow)
      if (projectile.velocity.lengthSq() < 0.01) {
        // Fade out the glow
        const material = projectile.mesh.material as THREE.MeshStandardMaterial;
        material.opacity = projectile.life / projectile.maxLife;
        continue;
      }

      // Move the projectile
      const movement = projectile.velocity.clone().multiplyScalar(deltaTime);
      projectile.mesh.position.add(movement);

      const pos = projectile.mesh.position;

      // --- Wall Collision Check ---
      if (!this.isWalkable(pos.x, pos.z)) {
        // Spawn impact effect
        this.spawnImpactEffect(pos, projectile.velocity.clone().negate().normalize());

        // Remove projectile
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        (projectile.mesh.material as THREE.MeshStandardMaterial).dispose();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // --- Player Collision Check ---
      const playerPos = this.getPlayerPosition();
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      // Player hit radius: 0.6 units
      if (distSq < 0.36) {
        // Apply damage to player via callback
        this.onPlayerHit(this.config.damage);

        // Spawn impact effect
        this.spawnImpactEffect(pos, projectile.velocity.clone().negate().normalize());

        // Remove projectile
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        (projectile.mesh.material as THREE.MeshStandardMaterial).dispose();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
    }
  }

  /**
   * Spawns a small impact effect (glowing sparks + light flash).
   * @param position - World position of the impact
   * @param normal - Surface normal at the impact point
   */
  private spawnImpactEffect(position: THREE.Vector3, normal: THREE.Vector3): void {
    // --- Spark Particles ---
    const sparkCount = 6 + Math.floor(Math.random() * 5); // 6-10
    const sparkGeometry = new THREE.TetrahedronGeometry(0.04);

    for (let i = 0; i < sparkCount; i++) {
      // Random direction biased away from the surface normal
      const randomDir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      // Blend random direction with normal
      const direction = randomDir
        .add(normal.clone().multiplyScalar(1.5))
        .normalize();

      // Random speed
      const speed = 2 + Math.random() * 3;

      // Create spark material
      const material = new THREE.MeshStandardMaterial({
        color: this.config.projectileColor,
        emissive: this.config.projectileColor,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 1.0,
        roughness: 0.3,
        metalness: 0.1,
      });

      // Create spark mesh
      const spark = new THREE.Mesh(sparkGeometry, material);
      spark.position.copy(position);
      spark.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Store velocity in userData
      spark.userData.velocity = direction.multiplyScalar(speed);
      spark.userData.rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      spark.userData.life = 0.3;
      spark.userData.maxLife = 0.3;

      this.scene.add(spark);

      // Add to death particles for update (reuse the same update loop)
      this.deathParticles.push({
        mesh: spark,
        material,
        velocity: spark.userData.velocity as THREE.Vector3,
        rotationVelocity: spark.userData.rotationVelocity as THREE.Vector3,
        life: 0.3,
        maxLife: 0.3,
      });
    }

    // --- Brief Point Light Flash ---
    const light = new THREE.PointLight(this.config.projectileColor, 2, 4);
    light.position.copy(position);
    this.scene.add(light);

    // Store the light in a temporary effect
    const lightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 4, 4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lightMesh.position.copy(position);
    lightMesh.userData.flashLight = light;
    lightMesh.userData.life = 0.15;
    lightMesh.userData.maxLife = 0.15;
    this.scene.add(lightMesh);

    // Add to death particles for cleanup
    this.deathParticles.push({
      mesh: lightMesh,
      material: lightMesh.material,
      velocity: new THREE.Vector3(0, 0, 0),
      rotationVelocity: new THREE.Vector3(0, 0, 0),
      life: 0.15,
      maxLife: 0.15,
    });
  }

  /**
   * Updates death particle physics and fading.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateDeathParticles(deltaTime: number): void {
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const particle = this.deathParticles[i];
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        // Remove from scene
        this.scene.remove(particle.mesh);

        // Clean up flash light if present
        const flashLight = particle.mesh.userData.flashLight as THREE.PointLight | undefined;
        if (flashLight) {
          this.scene.remove(flashLight);
          flashLight.dispose();
        }

        // Dispose resources
        particle.mesh.geometry.dispose();
        particle.material.dispose();
        this.deathParticles.splice(i, 1);
        continue;
      }

      // Apply gravity (only for particles with upward velocity)
      if (particle.velocity.y > -5) {
        particle.velocity.y -= this.gravity * deltaTime;
      }

      // Update position
      particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

      // Update rotation
      particle.mesh.rotation.x += particle.rotationVelocity.x * deltaTime;
      particle.mesh.rotation.y += particle.rotationVelocity.y * deltaTime;
      particle.mesh.rotation.z += particle.rotationVelocity.z * deltaTime;

      // Fade opacity
      const ratio = particle.life / particle.maxLife;
      particle.material.opacity = ratio;
    }

    // Update death light
    if (this.deathLight) {
      const ratio = this.deathParticles.length > 0
        ? this.deathParticles[0].life / this.deathParticles[0].maxLife
        : 0;
      this.deathLight.intensity = 5 * ratio;

      // Remove light when all particles are gone
      if (this.deathParticles.length === 0) {
        this.scene.remove(this.deathLight);
        this.deathLight.dispose();
        this.deathLight = null;

        // Dispose the shared particle geometry
        if (this.deathParticleGeometry) {
          this.deathParticleGeometry.dispose();
          this.deathParticleGeometry = null;
        }
      }
    }
  }

  /**
   * Gets the muzzle position in world space.
   * Uses the stored muzzle local position from the visual builder.
   * @returns The muzzle position in world space
   */
  private getMuzzleWorldPosition(): THREE.Vector3 {
    // Get the local muzzle position
    const localMuzzle = getMuzzleLocalPosition(this.group);

    // Convert to world space
    this.group.updateMatrixWorld();
    return localMuzzle.applyMatrix4(this.group.matrixWorld);
  }

      /**
   * Sets the entity collision callback used to block movement when the
   * enemy would overlap with another entity (player or another enemy).
   *
   * @param callback - Returns true if the given position would overlap an entity
   */
  public setEntityCollisionCallback(callback: (x: number, z: number) => boolean): void {
    this.entityCollisionCallback = callback;
  }

  /**
   * Attempts to move the enemy to the given position with sliding.
   * Tries the full move first; if blocked, tries moving along only the
   * X axis, then only the Z axis. Returns true if any movement occurred,
   * false if the move was fully blocked.
   *
   * @param newX - The target X coordinate
   * @param newZ - The target Z coordinate
   * @returns True if any movement occurred, false if fully blocked
   */
  private tryMove(newX: number, newZ: number): boolean {
    const currentX = this.group.position.x;
    const currentZ = this.group.position.z;

    // Try full move (both axes)
    if (
      this.isPositionWalkable(newX, newZ) &&
      (!this.entityCollisionCallback || !this.entityCollisionCallback(newX, newZ))
    ) {
      this.group.position.x = newX;
      this.group.position.z = newZ;
      return true;
    }

    // Try X-only move (slide along X)
    if (
      this.isPositionWalkable(newX, currentZ) &&
      (!this.entityCollisionCallback || !this.entityCollisionCallback(newX, currentZ))
    ) {
      this.group.position.x = newX;
      return true;
    }

    // Try Z-only move (slide along Z)
    if (
      this.isPositionWalkable(currentX, newZ) &&
      (!this.entityCollisionCallback || !this.entityCollisionCallback(currentX, newZ))
    ) {
      this.group.position.z = newZ;
      return true;
    }

    // Fully blocked - no movement
    return false;
  }

  /**
   * Checks if a position is walkable by verifying all 4 corners of the
   * enemy's bounding box.
   * @param x - The X coordinate to check
   * @param z - The Z coordinate to check
   * @returns True if all 4 corners are walkable, false otherwise
   */
  private isPositionWalkable(x: number, z: number): boolean {
    const r = this.collisionRadius;

    // Check all 4 corners of the bounding box
    return (
      this.isWalkable(x - r, z - r) &&
      this.isWalkable(x + r, z - r) &&
      this.isWalkable(x - r, z + r) &&
      this.isWalkable(x + r, z + r)
    );
  }

  /**
   * Gets the enemy's world position.
   * @returns A Vector3 of the enemy's position
   */
  public getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Gets whether the enemy is alive.
   * @returns True if alive, false if destroyed
   */
  public getIsAlive(): boolean {
    return this.isAlive;
  }

  /**
   * Gets the enemy type identifier.
   * @returns The enemy type ID
   */
  public getTypeId(): EnemyTypeId {
    return this.typeId;
  }

  /**
   * Removes the enemy from the scene and disposes all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove enemy group from scene
    this.scene.remove(this.group);

    // Reset stealth opacity (restore original opacities)
    for (let i = 0; i < this.bodyMaterials.length; i++) {
      const material = this.bodyMaterials[i];
      material.opacity = this.originalBodyOpacities[i] !== undefined
        ? this.originalBodyOpacities[i]
        : 1.0;
      material.depthWrite = true;
    }

    // Dispose all geometries and materials in the group
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Dispose health bar texture
    if (this.healthBarTexture) {
      this.healthBarTexture.dispose();
      this.healthBarTexture = null;
    }

    // Dispose health bar sprite material
    if (this.healthBarSprite) {
      const material = this.healthBarSprite.material as THREE.SpriteMaterial;
      material.dispose();
      this.healthBarSprite = null;
    }

    // Dispose active death particles
    for (const particle of this.deathParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.material.dispose();
    }
    this.deathParticles = [];

    // Dispose death light
    if (this.deathLight) {
      this.scene.remove(this.deathLight);
      this.deathLight.dispose();
      this.deathLight = null;
    }

    // Dispose shared particle geometry
    if (this.deathParticleGeometry) {
      this.deathParticleGeometry.dispose();
      this.deathParticleGeometry = null;
    }

    // Dispose active enemy projectiles
    for (const projectile of this.enemyProjectiles) {
      this.scene.remove(projectile.mesh);
      projectile.mesh.geometry.dispose();
      (projectile.mesh.material as THREE.MeshStandardMaterial).dispose();

      // Clean up flash light if present
      const flashLight = projectile.mesh.userData.flashLight as THREE.PointLight | undefined;
      if (flashLight) {
        this.scene.remove(flashLight);
        flashLight.dispose();
      }
    }
    this.enemyProjectiles = [];

    // Dispose active telegraph effects
    for (const telegraph of this.telegraphs) {
      this.scene.remove(telegraph.mesh);
      telegraph.material.dispose();
    }
    this.telegraphs = [];

    // Dispose shared telegraph geometry
    if (this.telegraphGeometry) {
      this.telegraphGeometry.dispose();
      this.telegraphGeometry = null;
    }

    // Dispose active dash trail particles
    for (const particle of this.trailParticles) {
      this.scene.remove(particle.mesh);
      particle.material.dispose();
    }
    this.trailParticles = [];

    // Dispose shared trail geometry
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
      this.trailGeometry = null;
    }

    // Clear body materials
    this.bodyMaterials = [];
    this.originalBodyOpacities = [];

    // Clear group
    this.group.clear();
  }
}