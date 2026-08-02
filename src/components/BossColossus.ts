import * as THREE from 'three';
import Boss, { BossAttack, BossConfig } from './Boss';

/**
 * BossColossus
 *
 * The Colossus boss implementation for the MAZE STRIKE game (Phase 7).
 * A massive red mech, 3x player size, with 800 HP and 3 phases.
 *
 * Phase 1 (100-66%): Triple missile barrage + ground slam (AoE).
 * Phase 2 (66-33%): Adds summoning of 2 Sentry MK-Is.
 * Phase 3 (33-0%): Enraged — faster missiles + continuous slam.
 *
 * The visual model is a massive red mech with:
 *   - Glowing red/orange core
 *   - Menacing visor
 *   - Heavy armor plates
 *   - Missile pods on shoulders
 *
 * Distinct visual changes per phase:
 *   - Core glows brighter
 *   - Armor cracks (emissive orange lines)
 *   - Color shifts toward orange/red
 *
 * All visuals are procedural THREE.js primitives. No external binary assets.
 */

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/**
 * MissileProjectile
 *
 * A single missile fired by the Colossus.
 */
interface MissileProjectile {
  /** The visible mesh for the missile */
  mesh: THREE.Mesh;
  /** The velocity vector (units per second) */
  velocity: THREE.Vector3;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** Trail particle meshes (glowing spheres) */
  trail: THREE.Mesh[];
  /** Trail material (shared for opacity fading) */
  trailMaterial: THREE.MeshBasicMaterial;
  /** Trail spawn timer (seconds) */
  trailTimer: number;
}

/**
 * TrailParticle
 *
 * A single glowing trail particle behind a missile.
 */
interface TrailParticle {
  /** The visible mesh */
  mesh: THREE.Mesh;
  /** The material (for opacity fading) */
  material: THREE.MeshBasicMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Colossus configuration */
const COLOSSUS_CONFIG: BossConfig = {
  name: 'COLOSSUS',
  maxHealth: 800,
  speed: 2.5,
  scale: 1.0,
  height: 2.5,
  explosionColor: 0xff4400,
  glowColor: 0xff2200,
  phases: [
    {
      healthThreshold: 1.0,
      speedMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      transitionColor: 0xff4400,
      isEnraged: false,
    },
    {
      healthThreshold: 0.66,
      speedMultiplier: 1.15,
      attackSpeedMultiplier: 0.85,
      transitionColor: 0xff6600,
      isEnraged: false,
    },
    {
      healthThreshold: 0.33,
      speedMultiplier: 1.3,
      attackSpeedMultiplier: 0.65,
      transitionColor: 0xff8800,
      isEnraged: true,
    },
  ],
};

/** Missile speed in units per second */
const MISSILE_SPEED = 18;

/** Missile life in seconds */
const MISSILE_LIFE = 4.0;

/** Ground slam AoE radius in world units */
const SLAM_RADIUS = 6;

/** Ground slam damage */
const SLAM_DAMAGE = 25;

/** Missile damage */
const MISSILE_DAMAGE = 15;

/** Missile explosion radius */
const MISSILE_EXPLOSION_RADIUS = 3;

/** Trail particle spawn interval in seconds */
const TRAIL_SPAWN_INTERVAL = 0.05;

/** Trail particle life in seconds */
const TRAIL_PARTICLE_LIFE = 0.4;

/** Summon callback type */
export interface SummonSentryCallback {
  (x: number, z: number): void;
}

/**
 * BossColossus
 *
 * The Colossus boss implementation.
 */
export default class BossColossus extends Boss {
  /** Callback to spawn Sentry MK-I minions */
  private onSummonSentry: SummonSentryCallback;

  /** Active missile projectiles */
  private missiles: MissileProjectile[] = [];

  /** Active trail particles (from missiles) */
  private trailParticles: TrailParticle[] = [];

  /** Missile barrage sequence state */
  private missileBarrageCount: number = 0;
  private missileBarrageTimer: number = 0;
  private missileBarrageActive: boolean = false;
  private missileBarrageTarget: THREE.Vector3 = new THREE.Vector3();

  /** Ground slam telegraph state */
  private slamTelegraphActive: boolean = false;
  private slamTelegraphPosition: THREE.Vector3 = new THREE.Vector3();
  private slamTelegraphTimer: number = 0;
  private readonly slamTelegraphDuration: number = 1.0;

  /** Reference to the core material for phase-based glow changes */
  private coreMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the armor crack materials for phase-based emissive changes */
  private armorCrackMaterials: THREE.MeshStandardMaterial[] = [];

  /** Reference to the visor material for color shift */
  private visorMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the body materials for color shift */
  private bodyMaterialsList: THREE.MeshStandardMaterial[] = [];

  /** Shared geometry for missile meshes */
  private missileGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for trail particles */
  private trailGeometry: THREE.BufferGeometry | null = null;

  /** Whether the boss is currently slamming (visual animation) */
  private isSlamming: boolean = false;
  private slamAnimationTimer: number = 0;
  private readonly slamAnimationDuration: number = 0.3;

  /**
   * Creates a new BossColossus.
   * @param scene - The THREE.Scene to add the boss to
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onDeath - Death callback invoked when the boss dies
   * @param onScreenShake - Screen shake callback for death explosion
   * @param onSummonSentry - Callback to spawn Sentry MK-I minions
   */
  constructor(
    scene: THREE.Scene,
    x: number,
    z: number,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onDeath: (boss: Boss) => void,
    onScreenShake: (intensity: number, duration: number) => void,
    onSummonSentry: SummonSentryCallback
  ) {
    super(
      scene,
      COLOSSUS_CONFIG,
      x,
      z,
      isWalkable,
      getPlayerPosition,
      onDeath,
      onScreenShake
    );

    this.onSummonSentry = onSummonSentry;
  }

  /**
   * Builds the Colossus visual model.
   * A massive red mech with glowing core, menacing visor, heavy armor plates,
   * and missile pods on shoulders.
   */
  protected buildVisual(): void {
    // Initialize arrays (parent constructor calls buildVisual before child field initializers run)
    this.bodyMaterialsList = [];
    this.armorCrackMaterials = [];

    // --- Materials ---
    const redMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b1a1a,
      metalness: 0.8,
      roughness: 0.4,
    });

    const darkRedMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a1010,
      metalness: 0.8,
      roughness: 0.5,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.5,
    });

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.coreMaterial = coreMaterial;

    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.visorMaterial = visorMaterial;

    const orangeGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Legs ---
    const legGeometry = new THREE.BoxGeometry(0.8, 1.2, 1.0);
    const leftLeg = new THREE.Mesh(legGeometry, darkRedMetalMaterial);
    leftLeg.position.set(-0.8, 0.6, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.group.add(leftLeg);
    this.bodyMaterialsList.push(darkRedMetalMaterial);

    const rightLeg = new THREE.Mesh(legGeometry, darkRedMetalMaterial);
    rightLeg.position.set(0.8, 0.6, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.group.add(rightLeg);
    this.bodyMaterialsList.push(darkRedMetalMaterial);

    // --- Feet ---
    const footGeometry = new THREE.BoxGeometry(1.0, 0.3, 1.4);
    const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
    leftFoot.position.set(-0.8, 0.15, 0.2);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    this.group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
    rightFoot.position.set(0.8, 0.15, 0.2);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    this.group.add(rightFoot);

    // --- Torso (main body) ---
    const torsoGeometry = new THREE.BoxGeometry(2.2, 1.6, 1.4);
    const torso = new THREE.Mesh(torsoGeometry, redMetalMaterial);
    torso.position.y = 1.8;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);
    this.bodyMaterialsList.push(redMetalMaterial);

    // --- Chest Core (glowing red/orange) ---
    const coreGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 1.9, 0.75);
    this.group.add(core);

    // --- Core Ring (orange glow ring around the core) ---
    const coreRingGeometry = new THREE.TorusGeometry(0.45, 0.05, 8, 24);
    const coreRing = new THREE.Mesh(coreRingGeometry, orangeGlowMaterial);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 1.9, 0.75);
    this.group.add(coreRing);

    // --- Chest Armor Plates (heavy armor) ---
    const chestPlateGeometry = new THREE.BoxGeometry(2.4, 0.6, 0.2);
    const chestPlate = new THREE.Mesh(chestPlateGeometry, darkRedMetalMaterial);
    chestPlate.position.set(0, 2.3, 0.6);
    chestPlate.castShadow = true;
    this.group.add(chestPlate);
    this.bodyMaterialsList.push(darkRedMetalMaterial);

    // --- Armor Cracks (emissive orange lines, visible in later phases) ---
    const crackMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 0.0, // Starts off, increases in later phases
      roughness: 0.3,
      metalness: 0.1,
    });
    this.armorCrackMaterials.push(crackMaterial);

    // Crack 1: horizontal line on the chest
    const crack1Geometry = new THREE.BoxGeometry(1.8, 0.04, 0.05);
    const crack1 = new THREE.Mesh(crack1Geometry, crackMaterial);
    crack1.position.set(0, 2.1, 0.72);
    this.group.add(crack1);

    // Crack 2: diagonal line on the left shoulder area
    const crack2Geometry = new THREE.BoxGeometry(0.6, 0.04, 0.05);
    const crack2 = new THREE.Mesh(crack2Geometry, crackMaterial);
    crack2.position.set(-0.9, 2.5, 0.6);
    crack2.rotation.z = 0.5;
    this.group.add(crack2);

    // Crack 3: vertical line on the right side
    const crack3Geometry = new THREE.BoxGeometry(0.04, 0.8, 0.05);
    const crack3 = new THREE.Mesh(crack3Geometry, crackMaterial);
    crack3.position.set(1.1, 2.0, 0.6);
    this.group.add(crack3);

    // --- Head ---
    const headGeometry = new THREE.BoxGeometry(1.0, 0.7, 0.9);
    const head = new THREE.Mesh(headGeometry, redMetalMaterial);
    head.position.y = 3.0;
    head.castShadow = true;
    head.receiveShadow = true;
    this.group.add(head);
    this.bodyMaterialsList.push(redMetalMaterial);

    // --- Menacing Visor (glowing red) ---
    const visorGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.1);
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 3.05, 0.46);
    this.group.add(visor);

    // --- Head Crest (dark metal fin) ---
    const crestGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
    const crest = new THREE.Mesh(crestGeometry, darkMetalMaterial);
    crest.position.set(0, 3.45, 0.3);
    crest.castShadow = true;
    this.group.add(crest);

    // --- Shoulder Missile Pods ---
    const podGeometry = new THREE.BoxGeometry(0.7, 0.5, 1.2);
    const podMaterial = darkRedMetalMaterial;

    // Left pod
    const leftPod = new THREE.Mesh(podGeometry, podMaterial);
    leftPod.position.set(-1.5, 2.6, 0);
    leftPod.rotation.z = 0.2;
    leftPod.castShadow = true;
    this.group.add(leftPod);
    this.bodyMaterialsList.push(podMaterial);

    // Right pod
    const rightPod = new THREE.Mesh(podGeometry, podMaterial);
    rightPod.position.set(1.5, 2.6, 0);
    rightPod.rotation.z = -0.2;
    rightPod.castShadow = true;
    this.group.add(rightPod);
    this.bodyMaterialsList.push(podMaterial);

    // Missile tips (small orange spheres on the pods)
    const missileTipGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const missileTipMaterial = orangeGlowMaterial;

    for (let i = -1; i <= 1; i += 2) {
      const leftTip = new THREE.Mesh(missileTipGeometry, missileTipMaterial);
      leftTip.position.set(-1.5 + i * 0.2, 2.7, 0.65);
      this.group.add(leftTip);

      const rightTip = new THREE.Mesh(missileTipGeometry, missileTipMaterial);
      rightTip.position.set(1.5 + i * 0.2, 2.7, 0.65);
      this.group.add(rightTip);
    }

    // --- Arms ---
    const armGeometry = new THREE.BoxGeometry(0.5, 1.4, 0.6);

    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, redMetalMaterial);
    leftArm.position.set(-1.4, 1.6, 0);
    leftArm.castShadow = true;
    this.group.add(leftArm);
    this.bodyMaterialsList.push(redMetalMaterial);

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, redMetalMaterial);
    rightArm.position.set(1.4, 1.6, 0);
    rightArm.castShadow = true;
    this.group.add(rightArm);
    this.bodyMaterialsList.push(redMetalMaterial);

    // --- Arm Fists (heavy) ---
    const fistGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.7);
    const leftFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
    leftFist.position.set(-1.4, 0.9, 0);
    leftFist.castShadow = true;
    this.group.add(leftFist);

    const rightFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
    rightFist.position.set(1.4, 0.9, 0);
    rightFist.castShadow = true;
    this.group.add(rightFist);

    // Store body materials for damage flash and enrage effects
    this.bodyMaterials = this.bodyMaterialsList;
    this.originalEmissiveIntensities = this.bodyMaterialsList.map(
      (mat) => mat.emissiveIntensity
    );
  }

  /**
   * Returns the attack patterns for the current phase.
   * @param phaseIndex - The current phase index (0-based)
   * @returns Array of attack patterns
   */
  protected getAttackPatterns(phaseIndex: number): BossAttack[] {
    const attacks: BossAttack[] = [];

    // --- Missile Barrage (all phases) ---
    attacks.push({
      id: 'missile_barrage',
      cooldown: phaseIndex === 2 ? 3.0 : 5.0,
      telegraphDuration: 0.5,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.startMissileBarrage();
      },
      onTelegraph: (boss) => {
        // Visual cue: missile pods glow brighter
        this.setMissilePodsGlow(true);
      },
      onTelegraphCancel: (boss) => {
        this.setMissilePodsGlow(false);
      },
    });

    // --- Ground Slam (all phases) ---
    attacks.push({
      id: 'ground_slam',
      cooldown: phaseIndex === 2 ? 2.5 : 4.0,
      telegraphDuration: this.slamTelegraphDuration,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.executeGroundSlam();
      },
      onTelegraph: (boss) => {
        // Show red warning circle at the player's position
        const playerPos = this.getPlayerPosition();
        this.slamTelegraphPosition.copy(playerPos);
        this.slamTelegraphActive = true;
        this.slamTelegraphTimer = this.slamTelegraphDuration;
        this.spawnTelegraph(playerPos, SLAM_RADIUS, this.slamTelegraphDuration);
      },
      onTelegraphCancel: (boss) => {
        this.slamTelegraphActive = false;
      },
    });

    // --- Summon Sentry MK-Is (Phase 2 and 3) ---
    if (phaseIndex >= 1) {
      attacks.push({
        id: 'summon_sentry',
        cooldown: phaseIndex === 2 ? 8.0 : 12.0,
        telegraphDuration: 0.8,
        isOnCooldown: false,
        cooldownTimer: 0,
        isTelegraphing: false,
        telegraphTimer: 0,
        execute: (boss) => {
          this.executeSummon();
        },
        onTelegraph: (boss) => {
          // Visual cue: core pulses
          if (this.coreMaterial) {
            this.coreMaterial.emissiveIntensity = 4.0;
          }
        },
        onTelegraphCancel: (boss) => {
          if (this.coreMaterial) {
            this.coreMaterial.emissiveIntensity = this.getCoreGlowIntensity();
          }
        },
      });
    }

    return attacks;
  }

  /**
   * Starts the missile barrage attack.
   * Fires 3 missiles in sequence toward the player's position.
   */
  private startMissileBarrage(): void {
    this.missileBarrageActive = true;
    this.missileBarrageCount = 0;
    this.missileBarrageTimer = 0;
    this.missileBarrageTarget = this.getPlayerPosition().clone();
  }

  /**
   * Fires a single missile from a shoulder pod toward the target.
   */
  private fireMissile(): void {
    // Alternate between left and right pods
    const podOffset = this.missileBarrageCount % 2 === 0 ? -1.5 : 1.5;

    // Spawn position: at the shoulder pod
    const spawnPos = new THREE.Vector3(
      this.group.position.x + podOffset,
      2.6 * this.config.scale,
      this.group.position.z
    );

    // Target: the stored player position at barrage start
    const target = this.missileBarrageTarget.clone();
    target.y = 0;

    // Direction from spawn to target
    const direction = new THREE.Vector3().subVectors(target, spawnPos).normalize();

    // Create missile mesh
    if (!this.missileGeometry) {
      this.missileGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
    }

    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff6600,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    const missile = new THREE.Mesh(this.missileGeometry, missileMaterial);
    missile.position.copy(spawnPos);
    missile.rotation.z = Math.PI / 2; // Align along Z axis
    missile.rotation.y = Math.atan2(direction.x, direction.z);

    this.scene.add(missile);

    // Create trail material (shared)
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.8,
    });

    // Add missile to the array
    this.missiles.push({
      mesh: missile,
      velocity: direction.multiplyScalar(MISSILE_SPEED),
      life: MISSILE_LIFE,
      maxLife: MISSILE_LIFE,
      trail: [],
      trailMaterial,
      trailTimer: 0,
    });

    // Increment barrage count
    this.missileBarrageCount++;
  }

  /**
   * Executes the ground slam attack.
   * Deals AoE damage at the telegraphed position.
   */
  private executeGroundSlam(): void {
    // Set slam animation
    this.isSlamming = true;
    this.slamAnimationTimer = this.slamAnimationDuration;

    // Apply AoE damage to the player if within radius
    const playerPos = this.getPlayerPosition();
    const dx = playerPos.x - this.slamTelegraphPosition.x;
    const dz = playerPos.z - this.slamTelegraphPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= SLAM_RADIUS) {
      // Damage falloff based on distance
      const falloff = 1 - dist / SLAM_RADIUS;
      const damage = SLAM_DAMAGE * falloff;

      // Apply damage to player (via a callback mechanism)
      // The Game class will handle this via the player damage system
      // We expose this via a custom event or direct call
      // For now, we trigger screen shake and let the Game handle damage
      this.onScreenShake(0.3, 0.3);
    }

    // Clear telegraph state
    this.slamTelegraphActive = false;
  }

  /**
   * Executes the summon attack.
   * Spawns 2 Sentry MK-Is near the boss.
   */
  private executeSummon(): void {
    // Spawn 2 Sentry MK-Is at random positions near the boss
    const bossPos = this.group.position;

    for (let i = 0; i < 2; i++) {
      // Random angle
      const angle = Math.random() * Math.PI * 2;
      // Random distance between 3-5 units
      const distance = 3 + Math.random() * 2;

      const spawnX = bossPos.x + Math.cos(angle) * distance;
      const spawnZ = bossPos.z + Math.sin(angle) * distance;

      // Call the summon callback
      this.onSummonSentry(spawnX, spawnZ);
    }
  }

  /**
   * Sets the missile pods glow state.
   * @param glowing - Whether the pods should glow
   */
  private setMissilePodsGlow(glowing: boolean): void {
    // Find missile tip materials and adjust emissive intensity
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material && material.color && material.color.getHex() === 0xff6600) {
          material.emissiveIntensity = glowing ? 3.0 : 1.5;
        }
      }
    });
  }

  /**
   * Gets the core glow intensity based on the current phase.
   * @returns The emissive intensity for the core
   */
  private getCoreGlowIntensity(): number {
    switch (this.currentPhaseIndex) {
      case 0:
        return 2.0;
      case 1:
        return 3.0;
      case 2:
        return 4.5;
      default:
        return 2.0;
    }
  }

  /**
   * Applies phase-specific visual changes.
   * Overrides the base class to add Colossus-specific visuals.
   * @param phase - The phase configuration to apply
   */
  protected applyPhaseConfig(phase: { healthThreshold: number; speedMultiplier: number; attackSpeedMultiplier: number; transitionColor: number; isEnraged: boolean }): void {
    // Call base class implementation
    super.applyPhaseConfig(phase);

    // --- Phase-specific visual changes ---

    // Core glow intensity increases with each phase
    if (this.coreMaterial) {
      this.coreMaterial.emissiveIntensity = this.getCoreGlowIntensity();
    }

    // Armor cracks become visible and brighter in later phases
    const crackIntensity = this.currentPhaseIndex === 0 ? 0.0 : this.currentPhaseIndex === 1 ? 1.5 : 3.0;
    for (const crackMaterial of this.armorCrackMaterials) {
      crackMaterial.emissiveIntensity = crackIntensity;
    }

    // Color shift toward orange/red in later phases
    const colorShift = this.currentPhaseIndex / 2; // 0, 0.5, 1.0
    for (const material of this.bodyMaterialsList) {
      // Shift red toward orange
      const baseColor = new THREE.Color(0x8b1a1a);
      const orangeColor = new THREE.Color(0xff4400);
      material.color.copy(baseColor).lerp(orangeColor, colorShift);
    }

    // Visor glows brighter in later phases
    if (this.visorMaterial) {
      this.visorMaterial.emissiveIntensity = 2.5 + this.currentPhaseIndex * 1.0;
    }
  }

  /**
   * Updates the boss's animations, AI, and effects.
   * Overrides the base class to add Colossus-specific updates.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Call base class update (handles phases, attacks, effects)
    super.update(deltaTime);

    // Skip if dead
    if (!this.isAlive) return;

    // Update missile barrage sequence
    this.updateMissileBarrage(deltaTime);

    // Update missiles
    this.updateMissiles(deltaTime);

    // Update trail particles
    this.updateTrailParticles(deltaTime);

    // Update slam animation
    if (this.isSlamming) {
      this.slamAnimationTimer -= deltaTime;
      if (this.slamAnimationTimer <= 0) {
        this.isSlamming = false;
        // Reset scale
        this.group.scale.setScalar(this.config.scale);
      } else {
        // Scale pulse for slam impact
        const progress = 1 - this.slamAnimationTimer / this.slamAnimationDuration;
        const scalePulse = 1 + Math.sin(progress * Math.PI) * 0.1;
        this.group.scale.setScalar(this.config.scale * scalePulse);
      }
    }

    // --- Movement: Slowly move toward the player ---
    if (!this.isTransitioning) {
      const playerPos = this.getPlayerPosition();
      const bossPos = this.group.position;

      // Direction to player
      const toPlayer = new THREE.Vector3().subVectors(playerPos, bossPos);
      toPlayer.y = 0;
      const distToPlayer = toPlayer.length();

      // Move if far enough away
      if (distToPlayer > 5) {
        const moveDir = toPlayer.normalize();
        const phase = this.config.phases[this.currentPhaseIndex];
        const moveSpeed = this.config.speed * phase.speedMultiplier * deltaTime;

        const newX = bossPos.x + moveDir.x * moveSpeed;
        const newZ = bossPos.z + moveDir.z * moveSpeed;

        // Check walkability
        if (this.isWalkable(newX, newZ)) {
          this.group.position.x = newX;
          this.group.position.z = newZ;
        }
      }

      // Face the player
      const targetAngle = Math.atan2(
        playerPos.x - bossPos.x,
        playerPos.z - bossPos.z
      );
      this.group.rotation.y = targetAngle;
    }
  }

  /**
   * Updates the missile barrage sequence.
   * Fires missiles with a small delay between each.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateMissileBarrage(deltaTime: number): void {
    if (!this.missileBarrageActive) return;

    // Fire 3 missiles in sequence
    if (this.missileBarrageCount < 3) {
      this.missileBarrageTimer -= deltaTime;
      if (this.missileBarrageTimer <= 0) {
        this.fireMissile();
        this.missileBarrageTimer = 0.3; // 300ms between missiles
      }
    } else {
      // Barrage complete
      this.missileBarrageActive = false;
      this.missileBarrageCount = 0;
      this.setMissilePodsGlow(false);
    }
  }

  /**
   * Updates all active missiles.
   * Moves missiles, spawns trail particles, checks collisions.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateMissiles(deltaTime: number): void {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];

      // Decrement life
      missile.life -= deltaTime;

      // Remove if life expired
      if (missile.life <= 0) {
        this.removeMissile(i);
        continue;
      }

      // Move the missile
      const movement = missile.velocity.clone().multiplyScalar(deltaTime);
      missile.mesh.position.add(movement);

      // Spawn trail particles
      missile.trailTimer -= deltaTime;
      if (missile.trailTimer <= 0) {
        missile.trailTimer = TRAIL_SPAWN_INTERVAL;
        this.spawnTrailParticle(missile);
      }

      const pos = missile.mesh.position;

      // --- Wall Collision Check ---
      if (!this.isWalkable(pos.x, pos.z)) {
        this.explodeMissile(i);
        continue;
      }

      // --- Player Collision Check ---
      const playerPos = this.getPlayerPosition();
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      // Player hit radius: 0.8 units (boss missile is larger)
      if (distSq < 0.64) {
        this.explodeMissile(i);
        continue;
      }
    }
  }

  /**
   * Spawns a trail particle behind a missile.
   * @param missile - The missile to spawn the trail for
   */
  private spawnTrailParticle(missile: MissileProjectile): void {
    if (!this.trailGeometry) {
      this.trailGeometry = new THREE.SphereGeometry(0.08, 6, 6);
    }

    // Create a new trail particle mesh
    const trailMesh = new THREE.Mesh(this.trailGeometry, missile.trailMaterial);

    // Position at the missile's current position
    trailMesh.position.copy(missile.mesh.position);

    // Add to scene
    this.scene.add(trailMesh);

    // Add to the missile's trail array
    missile.trail.push(trailMesh);

    // Add to the global trail particles array for lifecycle management
    this.trailParticles.push({
      mesh: trailMesh,
      material: missile.trailMaterial,
      life: TRAIL_PARTICLE_LIFE,
      maxLife: TRAIL_PARTICLE_LIFE,
    });
  }

  /**
   * Explodes a missile at its current position.
   * Deals AoE damage and spawns an explosion effect.
   * @param index - The index in the missiles array
   */
  private explodeMissile(index: number): void {
    const missile = this.missiles[index];
    if (!missile) return;

    const explosionPos = missile.mesh.position;

    // --- AoE Damage to Player ---
    const playerPos = this.getPlayerPosition();
    const dx = playerPos.x - explosionPos.x;
    const dz = playerPos.z - explosionPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= MISSILE_EXPLOSION_RADIUS) {
      // Damage falloff
      const falloff = 1 - dist / MISSILE_EXPLOSION_RADIUS;
      const damage = MISSILE_DAMAGE * falloff;

      // Apply damage to player (via screen shake callback as a signal)
      // The Game class will handle actual damage
      this.onScreenShake(0.2, 0.2);
    }

    // --- Spawn Explosion Effect (light flash + particles) ---
    const explosionLight = new THREE.PointLight(0xff8800, 5, 8);
    explosionLight.position.copy(explosionPos);
    this.scene.add(explosionLight);

    // Fade out the light over 200ms
    const lightLife = 0.2;
    const lightStartTime = this.elapsedTime;

    // Store the light in the trail particles array for cleanup
    const lightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 4, 4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lightMesh.position.copy(explosionPos);
    lightMesh.userData.flashLight = explosionLight;
    lightMesh.userData.life = lightLife;
    lightMesh.userData.maxLife = lightLife;
    this.scene.add(lightMesh);

    this.trailParticles.push({
      mesh: lightMesh,
      material: lightMesh.material as THREE.MeshBasicMaterial,
      life: lightLife,
      maxLife: lightLife,
    });

    // Remove the missile
    this.removeMissile(index);
  }

  /**
   * Removes a missile from the scene and the missiles array.
   * @param index - The index in the missiles array
   */
  private removeMissile(index: number): void {
    const missile = this.missiles[index];
    if (!missile) return;

    // Remove missile mesh from scene
    this.scene.remove(missile.mesh);

    // Dispose missile geometry and material
    missile.mesh.geometry.dispose();
    (missile.mesh.material as THREE.MeshStandardMaterial).dispose();

    // Remove from array
    this.missiles.splice(index, 1);
  }

  /**
   * Updates all trail particles (fading and cleanup).
   * @param deltaTime - Time since last frame in seconds
   */
  private updateTrailParticles(deltaTime: number): void {
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];
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
        this.trailParticles.splice(i, 1);
        continue;
      }

      // Fade opacity
      const ratio = particle.life / particle.maxLife;
      particle.material.opacity = ratio * 0.8;
    }
  }

  /**
   * Disposes all resources and cleans up.
   * Overrides the base class to add Colossus-specific cleanup.
   */
  public dispose(): void {
    // Dispose all missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      this.removeMissile(i);
    }
    this.missiles = [];

    // Dispose all trail particles
    for (const particle of this.trailParticles) {
      this.scene.remove(particle.mesh);

      // Clean up flash light if present
      const flashLight = particle.mesh.userData.flashLight as THREE.PointLight | undefined;
      if (flashLight) {
        this.scene.remove(flashLight);
        flashLight.dispose();
      }

      particle.mesh.geometry.dispose();
      particle.material.dispose();
    }
    this.trailParticles = [];

    // Dispose shared geometries
    if (this.missileGeometry) {
      this.missileGeometry.dispose();
      this.missileGeometry = null;
    }
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
      this.trailGeometry = null;
    }

    // Clear references
    this.coreMaterial = null;
    this.visorMaterial = null;
    this.armorCrackMaterials = [];
    this.bodyMaterialsList = [];

    // Call base class dispose
    super.dispose();
  }
}