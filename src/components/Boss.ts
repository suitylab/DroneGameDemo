import * as THREE from 'three';

/**
 * Boss
 *
 * Abstract base class for all boss entities in the MAZE STRIKE game (Phase 7).
 * Provides a comprehensive boss system with:
 *   - Multi-phase health thresholds with dramatic transition effects
 *   - Configurable attack patterns with telegraphs and cooldowns
 *   - Health bar sprite above the boss's head
 *   - Damage flash effect
 *   - Massive death explosion with particles and light
 *   - Phase transition shockwave + color flash
 *   - Attack pause during phase transitions
 *
 * Subclasses (BossColossus, BossVanguard, BossOverseer) define:
 *   - The visual model (buildVisual)
 *   - Attack patterns per phase (getAttackPatterns)
 *   - Phase-specific visual colors
 *
 * All visuals are procedural THREE.js primitives. No external binary assets.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * BossPhaseConfig
 *
 * Defines a single phase of the boss fight.
 * Phases are ordered from first (highest health) to last (lowest health).
 */
export interface BossPhaseConfig {
  /** Health threshold as a ratio (0.0 - 1.0). Phase activates when health <= threshold */
  healthThreshold: number;
  /** Movement speed multiplier for this phase */
  speedMultiplier: number;
  /** Attack cooldown multiplier (lower = faster attacks) */
  attackSpeedMultiplier: number;
  /** Color for the phase transition flash effect */
  transitionColor: number;
  /** Whether the boss is enraged in this phase (visual red glow) */
  isEnraged: boolean;
}

/**
 * BossAttack
 *
 * A single attack pattern definition.
 * Subclasses define attack patterns and execute them via the callback.
 */
export interface BossAttack {
  /** Unique attack identifier */
  id: string;
  /** Cooldown between uses in seconds */
  cooldown: number;
  /** Telegraph duration in seconds (warning before the attack executes) */
  telegraphDuration: number;
  /** Whether the attack is currently on cooldown */
  isOnCooldown: boolean;
  /** Current cooldown timer (seconds remaining) */
  cooldownTimer: number;
  /** Current telegraph timer (seconds remaining) */
  telegraphTimer: number;
  /** Whether the telegraph is currently active */
  isTelegraphing: boolean;
  /** Callback to execute the attack */
  execute: (boss: Boss) => void;
  /** Optional callback for the telegraph warning */
  onTelegraph?: (boss: Boss) => void;
  /** Optional callback to cancel the telegraph */
  onTelegraphCancel?: (boss: Boss) => void;
}

/**
 * BossConfig
 *
 * Base configuration for a boss type.
 */
export interface BossConfig {
  /** Display name shown on the HUD boss bar */
  name: string;
  /** Maximum health points */
  maxHealth: number;
  /** Base movement speed in units per second */
  speed: number;
  /** Scale multiplier for the visual model */
  scale: number;
  /** Height of the boss (for health bar positioning) */
  height: number;
  /** Color of the death explosion particles */
  explosionColor: number;
  /** Color of the boss's primary glow */
  glowColor: number;
  /** Phases ordered from first to last */
  phases: BossPhaseConfig[];
}

/**
 * BossDeathCallback
 *
 * Callback invoked when the boss dies.
 * Used by BossManager to update HUD and handle level completion.
 */
export interface BossDeathCallback {
  (boss: Boss): void;
}

/**
 * BossScreenShakeCallback
 *
 * Callback invoked for screen shake effects (e.g., on death explosion).
 */
export interface BossScreenShakeCallback {
  (intensity: number, duration: number): void;
}

// ---------------------------------------------------------------------------
// Internal Effect Interfaces
// ---------------------------------------------------------------------------

/**
 * DeathParticle
 *
 * A single particle in the boss's death explosion.
 */
interface DeathParticle {
  /** The visible mesh for the particle */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshStandardMaterial;
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
 * SmokeParticle
 *
 * A dark smoke particle spawned during death explosion.
 * Rises upward and expands while fading out.
 */
interface SmokeParticle {
  /** The visible mesh for the particle */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshStandardMaterial;
  /** The velocity vector (units per second) */
  velocity: THREE.Vector3;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** Scale growth rate per second */
  scaleGrowth: number;
}

/**
 * ShockwaveRing
 *
 * An expanding ring effect spawned during death explosion.
 * Grows outward while fading out.
 */
interface ShockwaveRing {
  /** The visible mesh for the ring */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** Expansion speed (units per second) */
  expandSpeed: number;
  /** Whether this ring is vertical (standing upright) */
  vertical: boolean;
}

/**
 * ShockwaveEffect
 *
 * A ring mesh that expands outward and fades (phase transition effect).
 */
interface ShockwaveEffect {
  /** The ring mesh */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** Expansion speed in units per second */
  expansionSpeed: number;
  /** Initial radius */
  initialRadius: number;
  /** Maximum radius before fading */
  maxRadius: number;
}

/**
 * ColorFlashEffect
 *
 * A full-screen color flash overlay (phase transition effect).
 * Implemented as a large semi-transparent plane above the boss.
 */
interface ColorFlashEffect {
  /** The flash mesh */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * TelegraphEffect
 *
 * A red warning circle on the ground (attack telegraph).
 */
interface TelegraphEffect {
  /** The ring mesh */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

// ---------------------------------------------------------------------------
// Boss Class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all boss entities.
 *
 * Subclasses must implement:
 *   - buildVisual(): Construct the boss's 3D model
 *   - getAttackPatterns(): Return the attack patterns for the current phase
 *
 * The base class handles:
 *   - Phase management with health thresholds
 *   - Health bar sprite above the boss's head
 *   - Damage flash effect
 *   - Death explosion with particles and light
 *   - Phase transition effects (shockwave + color flash)
 *   - Attack pause during phase transitions
 *   - Attack cooldown and telegraph management
 */
export default abstract class Boss {
  /** Root group containing all boss meshes */
  public group: THREE.Group = new THREE.Group();

  /** The boss configuration */
  public config: BossConfig;

  /** Current health points */
  public health: number;

  /** Maximum health points */
  public maxHealth: number;

  /** Whether the boss is alive */
  public isAlive: boolean = true;

  /** Whether the boss is currently transitioning between phases */
  public isTransitioning: boolean = false;

  /** Current phase index (0-based) */
  public currentPhaseIndex: number = 0;

  /** Whether dispose has been called */
  public disposed: boolean = false;

  /** Elapsed time for animations */
  public elapsedTime: number = 0;

  /** The Three.js scene reference */
  protected scene: THREE.Scene;

  /** Walkability callback (returns true if position is walkable) */
  protected isWalkable: (x: number, z: number) => boolean;

  /** Player position getter callback */
  protected getPlayerPosition: () => THREE.Vector3;

  /** Death callback invoked when the boss dies */
  protected onDeath: BossDeathCallback;

  /** Screen shake callback for death explosion */
  protected onScreenShake: BossScreenShakeCallback;

  /** Active attack patterns for the current phase */
  protected attackPatterns: BossAttack[] = [];

  /** Timer for attack pause during phase transitions (seconds) */
  protected attackPauseTimer: number = 0;

  /** Duration of the attack pause during phase transitions (seconds) */
  protected readonly attackPauseDuration: number = 1.5;

  /** Timer for damage flash effect (seconds) */
  protected damageFlashTimer: number = 0;

  /** Duration of the damage flash in seconds */
  protected readonly damageFlashDuration: number = 0.1;

  /** Health bar sprite */
  protected healthBarSprite: THREE.Sprite | null = null;

  /** Health bar canvas texture */
  protected healthBarTexture: THREE.CanvasTexture | null = null;

  /** Active death particles */
  protected deathParticles: DeathParticle[] = [];

  /** Death explosion light */
  protected deathLight: THREE.PointLight | null = null;

  /** Death explosion duration in seconds */
  protected deathDuration: number = 1.2;

  /** Gravity constant for death particles (units/s²) */
  protected gravity: number = 9.8;

  /** Active shockwave effects (phase transitions) */
  protected shockwaves: ShockwaveEffect[] = [];

  /** Active color flash effects (phase transitions) */
  protected colorFlashes: ColorFlashEffect[] = [];

  /** Active telegraph effects (attack warnings) */
  protected telegraphs: TelegraphEffect[] = [];

  /** Collision radius for movement checks */
  protected readonly collisionRadius: number = 1.5;

    /** Shared geometry for death particles (disposed when effect expires) */
  protected deathParticleGeometry: THREE.BufferGeometry | null = null;

  /** Active smoke particles for death explosion */
  protected smokeParticles: SmokeParticle[] = [];

  /** Active shockwave rings for death explosion */
  protected shockwaveRings: ShockwaveRing[] = [];

  /** Smoke particle duration in seconds */
    protected smokeDuration: number = 3.0;

  /** Shockwave ring duration in seconds */
    protected shockwaveDuration: number = 1.5;

  /** Shared geometry for smoke particles */
  protected smokeGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for shockwave rings */
  protected shockwaveRingGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for shockwave rings */
  protected shockwaveGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for telegraph rings */
  protected telegraphGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for color flash planes */
  protected colorFlashGeometry: THREE.BufferGeometry | null = null;

  /** Reference to the body material for damage flash */
  protected bodyMaterials: THREE.MeshStandardMaterial[] = [];

  /** Original emissive intensities of body materials */
  protected originalEmissiveIntensities: number[] = [];

  /** Whether the boss is currently enraged (visual red glow) */
  protected isEnraged: boolean = false;

  /**
   * Creates a new Boss at the given position.
   * @param scene - The THREE.Scene to add the boss to
   * @param config - The boss configuration
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onDeath - Death callback invoked when the boss dies
   * @param onScreenShake - Screen shake callback for death explosion
   */
  constructor(
    scene: THREE.Scene,
    config: BossConfig,
    x: number,
    z: number,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onDeath: BossDeathCallback,
    onScreenShake: BossScreenShakeCallback
  ) {
    this.scene = scene;
    this.config = config;
    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;
    this.isWalkable = isWalkable;
    this.getPlayerPosition = getPlayerPosition;
    this.onDeath = onDeath;
    this.onScreenShake = onScreenShake;

    // Build the visual model
    this.buildVisual();

    // Apply scale
    this.group.scale.setScalar(config.scale);

    // Position the boss on the ground plane
    this.group.position.set(x, 0, z);

    // Build the health bar
    this.buildHealthBar();

    // Initialize the first phase
    this.currentPhaseIndex = 0;
    this.applyPhaseConfig(this.config.phases[0]);

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Abstract method: Builds the boss's 3D model.
   * Subclasses must implement this to construct the visual hierarchy.
   * The model should be built at the origin (y=0 at ground level).
   * Store body materials in this.bodyMaterials for damage flash.
   */
  protected abstract buildVisual(): void;

  /**
   * Abstract method: Returns the attack patterns for the current phase.
   * Subclasses must implement this to define phase-specific attacks.
   * @param phaseIndex - The current phase index (0-based)
   * @returns Array of attack patterns
   */
  protected abstract getAttackPatterns(phaseIndex: number): BossAttack[];

  /**
   * Applies the phase configuration to the boss.
   * Updates speed multiplier, enrage state, and attack patterns.
   * @param phase - The phase configuration to apply
   */
  protected applyPhaseConfig(phase: BossPhaseConfig): void {
    // Update enrage state
    this.isEnraged = phase.isEnraged;

    // Update attack patterns for this phase
    this.attackPatterns = this.getAttackPatterns(this.currentPhaseIndex);

    // Apply enrage visual effect (red glow on body)
    if (this.isEnraged) {
      this.applyEnrageVisual();
    } else {
      this.clearEnrageVisual();
    }
  }

  /**
   * Applies the enrage visual effect (red glow on all body materials).
   */
  protected applyEnrageVisual(): void {
    for (const material of this.bodyMaterials) {
      material.emissive.setHex(0xff0000);
      material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.5);
    }
  }

  /**
   * Clears the enrage visual effect.
   */
  protected clearEnrageVisual(): void {
    for (let i = 0; i < this.bodyMaterials.length; i++) {
      const material = this.bodyMaterials[i];
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = this.originalEmissiveIntensities[i] || 0;
    }
  }

  /**
   * Builds the health bar sprite with a canvas texture.
   * The bar is green when full, transitioning to red as health decreases.
   * The sprite is positioned above the boss's head.
   */
  protected buildHealthBar(): void {
    // Create canvas for the health bar
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 24;
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
    // Scale the health bar based on boss size
    const barWidth = this.config.scale * 3.0;
    const barHeight = this.config.scale * 0.3;
    sprite.scale.set(barWidth, barHeight, 1);

    // Position above the boss's head
    const heightOffset = this.config.height * this.config.scale + 0.5;
    sprite.position.y = heightOffset;

    // Add to the boss group (moves with the boss)
    this.group.add(sprite);
    this.healthBarSprite = sprite;
  }

  /**
   * Draws the health bar on the canvas.
   * @param ctx - The 2D canvas context
   * @param healthRatio - Health percentage (0.0 to 1.0)
   */
  protected drawHealthBar(ctx: CanvasRenderingContext2D, healthRatio: number): void {
    const width = 256;
    const height = 24;

    // Clamp health ratio
    const ratio = THREE.MathUtils.clamp(healthRatio, 0, 1);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background (dark)
    ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Border (red for boss)
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Health fill (green to red based on ratio)
    const fillWidth = (width - 6) * ratio;
    const fillHeight = height - 6;

    // Color: green (high) → yellow (mid) → red (low)
    let fillColor: string;
    if (ratio > 0.66) {
      // Green to yellow
      const t = (1 - ratio) * 3; // 0 at full, 1 at 66%
      const r = Math.floor(0 + t * 255);
      const g = Math.floor(255 - t * 100);
      fillColor = `rgb(${r}, ${g}, 0)`;
    } else if (ratio > 0.33) {
      // Yellow to orange
      const t = (0.66 - ratio) * 3; // 0 at 66%, 1 at 33%
      const r = 255;
      const g = Math.floor(155 - t * 100);
      fillColor = `rgb(${r}, ${g}, 0)`;
    } else {
      // Orange to red
      const t = ratio * 3; // 1 at 33%, 0 at empty
      const r = 255;
      const g = Math.floor(55 * t);
      fillColor = `rgb(${r}, ${g}, 0)`;
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(3, 3, fillWidth, fillHeight);
  }

  /**
   * Updates the health bar sprite texture.
   */
  protected updateHealthBar(): void {
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
   * Applies damage to the boss.
   * @param amount - Amount of damage to apply
   */
  public takeDamage(amount: number): void {
    // Ignore if already dead or disposed
    if (!this.isAlive || this.disposed) return;

    // Clamp damage to non-negative
    const damage = Math.max(0, amount);

    // Apply damage
    this.health = Math.max(0, this.health - damage);

    // Trigger damage flash on body materials
    this.damageFlashTimer = this.damageFlashDuration;
    this.applyDamageFlash();

    // Update health bar
    this.updateHealthBar();

    // Check for phase transition
    this.checkPhaseTransition();

    // Check for death
    if (this.health <= 0) {
      this.die();
    }
  }

  /**
   * Applies the damage flash effect (red emissive on all body materials).
   */
  protected applyDamageFlash(): void {
    for (const material of this.bodyMaterials) {
      material.emissive.setHex(0xff0000);
      material.emissiveIntensity = 1.0;
    }
  }

  /**
   * Clears the damage flash effect.
   */
  protected clearDamageFlash(): void {
    for (let i = 0; i < this.bodyMaterials.length; i++) {
      const material = this.bodyMaterials[i];
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = this.originalEmissiveIntensities[i] || 0;
    }

    // Re-apply enrage visual if enraged
    if (this.isEnraged) {
      this.applyEnrageVisual();
    }
  }

  /**
   * Checks if the boss should transition to the next phase.
   * Triggers the phase transition effect when a threshold is crossed.
   */
  protected checkPhaseTransition(): void {
    // Don't transition if already transitioning or dead
    if (this.isTransitioning || !this.isAlive) return;

    // Check if we should move to the next phase
    const nextPhaseIndex = this.currentPhaseIndex + 1;
    if (nextPhaseIndex >= this.config.phases.length) return;

    // Check if health is below the next phase threshold
    const nextPhase = this.config.phases[nextPhaseIndex];
    const healthRatio = this.health / this.maxHealth;

    if (healthRatio <= nextPhase.healthThreshold) {
      // Trigger phase transition
      this.triggerPhaseTransition(nextPhaseIndex);
    }
  }

  /**
   * Triggers a phase transition with dramatic visual effects.
   * @param newPhaseIndex - The index of the new phase
   */
  protected triggerPhaseTransition(newPhaseIndex: number): void {
    // Set transitioning state
    this.isTransitioning = true;
    this.attackPauseTimer = this.attackPauseDuration;

    // Update phase index
    this.currentPhaseIndex = newPhaseIndex;

    // Apply new phase config
    this.applyPhaseConfig(this.config.phases[newPhaseIndex]);

    // Spawn shockwave effect
    this.spawnShockwave();

    // Spawn color flash effect
    const phase = this.config.phases[newPhaseIndex];
    this.spawnColorFlash(phase.transitionColor);

    // Reset all attack cooldowns
    for (const attack of this.attackPatterns) {
      attack.isOnCooldown = false;
      attack.cooldownTimer = 0;
      attack.isTelegraphing = false;
      attack.telegraphTimer = 0;
    }
  }

  /**
   * Spawns a shockwave ring effect at the boss's position.
   */
  protected spawnShockwave(): void {
    // Create shared geometry if not exists
    if (!this.shockwaveGeometry) {
      this.shockwaveGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
    }

    // Create material with phase transition color
    const phase = this.config.phases[this.currentPhaseIndex];
    const material = new THREE.MeshBasicMaterial({
      color: phase.transitionColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Create mesh
    const mesh = new THREE.Mesh(this.shockwaveGeometry, material);
    mesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
    mesh.position.copy(this.group.position);
    mesh.position.y = 0.1; // Slightly above ground

    this.scene.add(mesh);

    // Add to shockwaves array
    this.shockwaves.push({
      mesh,
      material,
      life: 0.8,
      maxLife: 0.8,
      expansionSpeed: 8,
      initialRadius: 1.0,
      maxRadius: 15,
    });
  }

  /**
   * Spawns a color flash effect at the boss's position.
   * @param color - The color of the flash
   */
  protected spawnColorFlash(color: number): void {
    // Create shared geometry if not exists
    if (!this.colorFlashGeometry) {
      this.colorFlashGeometry = new THREE.PlaneGeometry(30, 30);
    }

    // Create material
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Create mesh
    const mesh = new THREE.Mesh(this.colorFlashGeometry, material);
    mesh.position.copy(this.group.position);
    mesh.position.y = 3; // Above the boss

    this.scene.add(mesh);

    // Add to color flashes array
    this.colorFlashes.push({
      mesh,
      material,
      life: 0.5,
      maxLife: 0.5,
    });
  }

  /**
   * Spawns a telegraph warning circle at the given position.
   * @param position - World position for the telegraph
   * @param radius - Radius of the telegraph circle
   * @param duration - Duration of the telegraph in seconds
   */
  protected spawnTelegraph(position: THREE.Vector3, radius: number, duration: number): void {
    // Create shared geometry if not exists
    if (!this.telegraphGeometry) {
      this.telegraphGeometry = new THREE.RingGeometry(0.95, 1.0, 32);
    }

    // Create material
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Create mesh
    const mesh = new THREE.Mesh(this.telegraphGeometry, material);
    mesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
    mesh.position.copy(position);
    mesh.position.y = 0.05; // Slightly above ground
    mesh.scale.setScalar(radius);

    this.scene.add(mesh);

    // Add to telegraphs array
    this.telegraphs.push({
      mesh,
      material,
      life: duration,
      maxLife: duration,
    });
  }

  /**
   * Triggers the death explosion: spawns particles and a light flash,
   * then removes the boss from the scene and calls onDeath.
   */
  protected die(): void {
    // Mark as not alive
    this.isAlive = false;

    // --- Spawn Explosion Particles ---
    const particleCount = 30 + Math.floor(Math.random() * 21); // 30-50
        const particleGeometry = new THREE.TetrahedronGeometry(0.2);
    this.deathParticleGeometry = particleGeometry;

    for (let i = 0; i < particleCount; i++) {
      // Random direction (biased upward)
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.8 + 0.2, // Upward bias
        Math.random() * 2 - 1
      ).normalize();

      // Random speed (faster for boss)
            const speed = 4 + Math.random() * 5;

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
      particle.position.y += this.config.height * this.config.scale * 0.5;
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Store velocity and rotation velocity
      const velocity = direction.multiplyScalar(speed);
      const rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      this.scene.add(particle);

            this.deathParticles.push({
        mesh: particle,
        material,
        velocity,
        rotationVelocity,
                life: this.deathDuration * 1.5,
        maxLife: this.deathDuration * 1.5,
      });
    }

    // --- Spawn Spark Particles ---
    const sparkCount = 40 + Math.floor(Math.random() * 21); // 40-60
        const sparkGeometry = new THREE.TetrahedronGeometry(0.09);

    for (let i = 0; i < sparkCount; i++) {
      // Random direction (wider spread, less upward bias)
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.6 + 0.1,
        Math.random() * 2 - 1
      ).normalize();

      // Higher speed for sparks
            const speed = 7 + Math.random() * 6;

      // Bright orange-yellow-white spark material
      const sparkRoll = Math.random();
      const sparkColor = sparkRoll < 0.4 ? 0xff8800 : (sparkRoll < 0.75 ? 0xffcc00 : 0xffffff);
      const material = new THREE.MeshStandardMaterial({
        color: sparkColor,
        emissive: sparkColor,
        emissiveIntensity: 8.0,
        transparent: true,
        opacity: 1.0,
        roughness: 0.2,
        metalness: 0.1,
      });

      const spark = new THREE.Mesh(sparkGeometry, material);
      spark.position.copy(this.group.position);
      spark.position.y += this.config.height * this.config.scale * 0.5;

      const velocity = direction.multiplyScalar(speed);

      this.scene.add(spark);

      this.deathParticles.push({
        mesh: spark,
        material,
        velocity,
        rotationVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
                life: 0.5 + Math.random() * 0.4, // 0.5-0.9s
        maxLife: 0.5 + Math.random() * 0.4,
      });
    }

    // --- Spawn Smoke Particles ---
    const smokeCount = 20 + Math.floor(Math.random() * 11); // 20-30
    const smokeGeom = new THREE.SphereGeometry(0.15, 8, 8);
    this.smokeGeometry = smokeGeom;

    for (let i = 0; i < smokeCount; i++) {
      // Slight random offset from center
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.6
      );

      // Slow upward drift
            const velocity = new THREE.Vector3(
        Math.random() * 1.2,
        0.8 + Math.random() * 1.2,
        Math.random() * 1.2
      );

      // Dark smoke material
      const material = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        emissive: 0x111111,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
        roughness: 1.0,
        metalness: 0.0,
        depthWrite: false,
      });

      const smoke = new THREE.Mesh(smokeGeom, material);
      smoke.position.copy(this.group.position);
      smoke.position.y += this.config.height * this.config.scale * 0.5;
      smoke.position.add(offset);
            smoke.scale.setScalar(2.0 + Math.random() * 1.0);
      smoke.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      this.scene.add(smoke);

      this.smokeParticles.push({
        mesh: smoke,
        material,
        velocity,
        life: this.smokeDuration,
        maxLife: this.smokeDuration,
        scaleGrowth: 0.8 + Math.random() * 0.7,
      });
    }

    // --- Spawn Shockwave Rings ---
    const ringGeom = new THREE.RingGeometry(0.05, 0.6, 32);
    this.shockwaveRingGeometry = ringGeom;
    const centerPos = this.group.position.clone();
    centerPos.y += this.config.height * this.config.scale * 0.5;

    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: this.config.explosionColor,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const ring = new THREE.Mesh(ringGeom, material);
      ring.position.copy(centerPos);
      ring.position.y = 0.15; // Ground level with slight offset
      ring.rotation.x = -Math.PI / 2; // Lay flat on ground

      this.scene.add(ring);

      this.shockwaveRings.push({
        mesh: ring,
        material,
        life: this.shockwaveDuration,
        maxLife: this.shockwaveDuration,
                expandSpeed: 7 + i * 3, // Each ring slightly faster
        vertical: false,
      });
    }

    // --- Spawn Vertical Shockwave Ring ---
    const verticalMaterial = new THREE.MeshBasicMaterial({
      color: this.config.explosionColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const verticalRing = new THREE.Mesh(ringGeom, verticalMaterial);
    verticalRing.position.copy(centerPos);
    // No rotation - stands upright

    this.scene.add(verticalRing);

    this.shockwaveRings.push({
      mesh: verticalRing,
      material: verticalMaterial,
      life: this.shockwaveDuration,
      maxLife: this.shockwaveDuration,
            expandSpeed: 12,
      vertical: true,
    });

    // --- Spawn Bright Light Flash ---
    const light = new THREE.PointLight(this.config.explosionColor, 15, 20);
    light.position.copy(this.group.position);
    light.position.y = this.config.height * this.config.scale * 0.5;
    this.scene.add(light);
    this.deathLight = light;

    // --- Trigger Screen Shake ---
    this.onScreenShake(0.5, 0.8);

    // --- Remove Boss from Scene ---
    this.scene.remove(this.group);

    // --- Invoke Death Callback ---
    this.onDeath(this);
  }

  /**
   * Updates the boss's animations, AI, and effects.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Track elapsed time
    this.elapsedTime += deltaTime;

    // Update damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= deltaTime;
      if (this.damageFlashTimer <= 0) {
        this.clearDamageFlash();
      }
    }

    // Update death particles
    this.updateDeathParticles(deltaTime);

    // Update shockwaves
    this.updateShockwaves(deltaTime);

    // Update color flashes
    this.updateColorFlashes(deltaTime);

    // Update telegraphs
    this.updateTelegraphs(deltaTime);

    // Skip AI updates if dead
    if (!this.isAlive) return;

    // Update attack pause timer
    if (this.attackPauseTimer > 0) {
      this.attackPauseTimer -= deltaTime;
      if (this.attackPauseTimer <= 0) {
        this.isTransitioning = false;
      }
      // Skip attack updates during transition pause
      return;
    }

    // Update attacks
    this.updateAttacks(deltaTime);
  }

  /**
   * Updates all attack patterns (cooldowns and telegraphs).
   * @param deltaTime - Time since last frame in seconds
   */
  protected updateAttacks(deltaTime: number): void {
    for (const attack of this.attackPatterns) {
      // Update cooldown
      if (attack.isOnCooldown) {
        attack.cooldownTimer -= deltaTime;
        if (attack.cooldownTimer <= 0) {
          attack.isOnCooldown = false;
          attack.cooldownTimer = 0;
        }
      }

      // Update telegraph
      if (attack.isTelegraphing) {
        attack.telegraphTimer -= deltaTime;
        if (attack.telegraphTimer <= 0) {
          // Execute the attack
          attack.execute(this);
          attack.isTelegraphing = false;
          attack.telegraphTimer = 0;

          // Start cooldown
          attack.isOnCooldown = true;
          attack.cooldownTimer = attack.cooldown;
        }
      }

      // Check if attack should start telegraphing
      if (!attack.isOnCooldown && !attack.isTelegraphing && !this.isTransitioning) {
        // Start telegraph
        attack.isTelegraphing = true;
        attack.telegraphTimer = attack.telegraphDuration;

        // Call the telegraph callback
        if (attack.onTelegraph) {
          attack.onTelegraph(this);
        }
      }
    }
  }

  /**
   * Updates death particle physics and fading.
   * @param deltaTime - Time since last frame in seconds
   */
  protected updateDeathParticles(deltaTime: number): void {
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const particle = this.deathParticles[i];
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        // Remove from scene
        this.scene.remove(particle.mesh);

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

    // --- Update smoke particles ---
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const smoke = this.smokeParticles[i];
      smoke.life -= deltaTime;

      if (smoke.life <= 0) {
        this.scene.remove(smoke.mesh);
        smoke.mesh.geometry.dispose();
        smoke.material.dispose();
        this.smokeParticles.splice(i, 1);
        continue;
      }

      // Apply gentle gravity reduction (smoke rises then slows)
      if (smoke.velocity.y > 0) {
        smoke.velocity.y -= 0.8 * deltaTime;
      }

      // Update position
      smoke.mesh.position.add(smoke.velocity.clone().multiplyScalar(deltaTime));

      // Expand smoke volume over time
      const scaleIncrement = smoke.scaleGrowth * deltaTime;
      smoke.mesh.scale.x += scaleIncrement;
      smoke.mesh.scale.y += scaleIncrement;
      smoke.mesh.scale.z += scaleIncrement;

      // Fade opacity — smoke lingers longer before fading
      const smokeRatio = smoke.life / smoke.maxLife;
      smoke.material.opacity = smokeRatio * 0.8;
    }

    // --- Update shockwave rings ---
    for (let i = this.shockwaveRings.length - 1; i >= 0; i--) {
      const ring = this.shockwaveRings[i];
      ring.life -= deltaTime;

      if (ring.life <= 0) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.material.dispose();
        this.shockwaveRings.splice(i, 1);
        continue;
      }

      // Expand ring outward
      const expandAmount = ring.expandSpeed * deltaTime;
      if (ring.vertical) {
        ring.mesh.scale.x += expandAmount;
        ring.mesh.scale.z += expandAmount;
      } else {
        ring.mesh.scale.x += expandAmount;
        ring.mesh.scale.y += expandAmount;
        ring.mesh.scale.z += expandAmount;
      }

      // Fade opacity
      const ringRatio = ring.life / ring.maxLife;
      ring.material.opacity = ringRatio * 0.9;
    }

    // Update death light
    if (this.deathLight) {
      const allEffectLife = Math.max(
        this.deathParticles.length > 0 ? this.deathParticles[0].life : 0,
        this.smokeParticles.length > 0 ? this.smokeParticles[0].life : 0,
        this.shockwaveRings.length > 0 ? this.shockwaveRings[0].life : 0
      );
      const allMaxLife = Math.max(
        this.deathParticles.length > 0 ? this.deathParticles[0].maxLife : 0,
        this.smokeParticles.length > 0 ? this.smokeParticles[0].maxLife : 0,
        this.shockwaveRings.length > 0 ? this.shockwaveRings[0].maxLife : 0
      );
      const ratio = allMaxLife > 0 ? allEffectLife / allMaxLife : 0;
      this.deathLight.intensity = 15 * ratio;

      // Remove light when all effects are gone
      const allDone =
        this.deathParticles.length === 0 &&
        this.smokeParticles.length === 0 &&
        this.shockwaveRings.length === 0;

      if (allDone) {
        this.scene.remove(this.deathLight);
        this.deathLight.dispose();
        this.deathLight = null;

        // Dispose the shared particle geometry
        if (this.deathParticleGeometry) {
          this.deathParticleGeometry.dispose();
          this.deathParticleGeometry = null;
        }
        if (this.smokeGeometry) {
          this.smokeGeometry.dispose();
          this.smokeGeometry = null;
        }
        if (this.shockwaveRingGeometry) {
          this.shockwaveRingGeometry.dispose();
          this.shockwaveRingGeometry = null;
        }
      }
    }
  }

  /**
   * Updates shockwave effects (expansion and fading).
   * @param deltaTime - Time since last frame in seconds
   */
  protected updateShockwaves(deltaTime: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const shockwave = this.shockwaves[i];
      shockwave.life -= deltaTime;

      if (shockwave.life <= 0) {
        // Remove from scene
        this.scene.remove(shockwave.mesh);
        shockwave.material.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Expand the ring
      const progress = 1 - shockwave.life / shockwave.maxLife;
      const radius = shockwave.initialRadius + progress * (shockwave.maxRadius - shockwave.initialRadius);
      shockwave.mesh.scale.setScalar(radius);

      // Fade opacity
      shockwave.material.opacity = 0.8 * (shockwave.life / shockwave.maxLife);
    }
  }

  /**
   * Updates color flash effects (fading).
   * @param deltaTime - Time since last frame in seconds
   */
  protected updateColorFlashes(deltaTime: number): void {
    for (let i = this.colorFlashes.length - 1; i >= 0; i--) {
      const flash = this.colorFlashes[i];
      flash.life -= deltaTime;

      if (flash.life <= 0) {
        // Remove from scene
        this.scene.remove(flash.mesh);
        flash.material.dispose();
        this.colorFlashes.splice(i, 1);
        continue;
      }

      // Fade opacity
      flash.material.opacity = 0.4 * (flash.life / flash.maxLife);
    }
  }

  /**
   * Updates telegraph effects (fading).
   * @param deltaTime - Time since last frame in seconds
   */
  protected updateTelegraphs(deltaTime: number): void {
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
      const pulse = Math.sin(this.elapsedTime * 10) * 0.2 + 0.6;
      telegraph.material.opacity = pulse;
    }
  }

  /**
   * Gets the boss's world position.
   * @returns A Vector3 of the boss's position
   */
  public getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Gets whether the boss is alive.
   * @returns True if alive, false if destroyed
   */
  public getIsAlive(): boolean {
    return this.isAlive;
  }

  /**
   * Gets the boss's health ratio (0.0 - 1.0).
   * @returns The health ratio
   */
  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  /**
   * Gets the current phase index (0-based).
   * @returns The current phase index
   */
  public getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex;
  }

  /**
   * Gets the total number of phases.
   * @returns The phase count
   */
  public getPhaseCount(): number {
    return this.config.phases.length;
  }

  /**
   * Checks whether the boss has any active death effects.
   * @returns True if death effects are still playing
   */
  public hasActiveDeathEffects(): boolean {
    return (
      this.deathParticles.length > 0 ||
      this.smokeParticles.length > 0 ||
      this.shockwaveRings.length > 0 ||
      this.deathLight !== null
    );
  }

  /**
   * Removes the boss from the scene and disposes all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove boss group from scene
    this.scene.remove(this.group);

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

    // Dispose active smoke particles
    for (const smoke of this.smokeParticles) {
      this.scene.remove(smoke.mesh);
      smoke.mesh.geometry.dispose();
      smoke.material.dispose();
    }
    this.smokeParticles = [];

    // Dispose active shockwave rings
    for (const ring of this.shockwaveRings) {
      this.scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      ring.material.dispose();
    }
    this.shockwaveRings = [];

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

    // Dispose shared smoke geometry
    if (this.smokeGeometry) {
      this.smokeGeometry.dispose();
      this.smokeGeometry = null;
    }

    // Dispose shared shockwave ring geometry
    if (this.shockwaveRingGeometry) {
      this.shockwaveRingGeometry.dispose();
      this.shockwaveRingGeometry = null;
    }

    // Dispose active shockwaves
    for (const shockwave of this.shockwaves) {
      this.scene.remove(shockwave.mesh);
      shockwave.material.dispose();
    }
    this.shockwaves = [];

    // Dispose shared shockwave geometry
    if (this.shockwaveGeometry) {
      this.shockwaveGeometry.dispose();
      this.shockwaveGeometry = null;
    }

    // Dispose active color flashes
    for (const flash of this.colorFlashes) {
      this.scene.remove(flash.mesh);
      flash.material.dispose();
    }
    this.colorFlashes = [];

    // Dispose shared color flash geometry
    if (this.colorFlashGeometry) {
      this.colorFlashGeometry.dispose();
      this.colorFlashGeometry = null;
    }

    // Dispose active telegraphs
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

    // Clear body materials
    this.bodyMaterials = [];
    this.originalEmissiveIntensities = [];

    // Clear attack patterns
    this.attackPatterns = [];

    // Clear group
    this.group.clear();
  }
}