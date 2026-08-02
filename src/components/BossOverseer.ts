import * as THREE from 'three';
import Boss, { BossAttack, BossConfig } from './Boss';

/**
 * BossOverseer
 *
 * The Overseer boss implementation for the MAZE STRIKE game (Phase 8).
 * A giant black mech with glowing core fought at Level 10 with 2000 HP and 3 phases.
 *
 * Phase 1 (100-66%): Orbital laser strike (telegraphed) + shockwave nova.
 * Phase 2 (66-33%): Adds summoning of 2 Brutes.
 * Phase 3 (33-0%): All patterns, faster, continuous laser.
 *
 * The visual model is a giant black mech with:
 *   - Massive box torso with black metal material
 *   - Glowing purple/orange core (emissive sphere)
 *   - Orbital laser cannon on top (large cylinder barrel + glowing ring)
 *   - Heavy armor plates
 *   - Head with glowing purple visor
 *   - Armor cracks (emissive purple lines, brighter in later phases)
 *
 * Distinct visual changes per phase:
 *   - Core glows brighter
 *   - Armor cracks become visible
 *   - Color shifts toward purple/orange
 *
 * All visuals are procedural THREE.js primitives. No external binary assets.
 */

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/**
 * LaserProjectile
 *
 * The vertical laser beam mesh created during the orbital laser strike.
 */
interface LaserProjectile {
  /** The visible mesh for the laser (glowing cylinder) */
  mesh: THREE.Mesh;
  /** The material (for glow intensity control) */
  material: THREE.MeshStandardMaterial;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** The radius of the laser in world units */
  radius: number;
  /** Whether the player has been hit by this laser (prevents multi-hit) */
  hasHitPlayer: boolean;
}

/**
 * NovaRing
 *
 * The expanding ring mesh created during the shockwave nova attack.
 */
interface NovaRing {
  /** The visible mesh for the ring */
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
  /** Whether the player has been hit by this nova (prevents multi-hit) */
  hasHitPlayer: boolean;
}

/**
 * TrailParticle
 *
 * A single glowing particle spawned along the continuous laser's path.
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

/** Overseer configuration */
const OVERSEER_CONFIG: BossConfig = {
  name: 'OVERSEER',
  maxHealth: 2000,
  speed: 1.8,
  scale: 1.3333,
  height: 3.0,
  explosionColor: 0xaa00ff,
  glowColor: 0xaa00ff,
  phases: [
    {
      healthThreshold: 1.0,
      speedMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      transitionColor: 0xaa00ff,
      isEnraged: false,
    },
    {
      healthThreshold: 0.66,
      speedMultiplier: 1.1,
      attackSpeedMultiplier: 0.85,
      transitionColor: 0xcc00ff,
      isEnraged: false,
    },
    {
      healthThreshold: 0.33,
      speedMultiplier: 1.25,
      attackSpeedMultiplier: 0.6,
      transitionColor: 0xff6600,
      isEnraged: true,
    },
  ],
};

/** Orbital laser damage */
const LASER_DAMAGE = 30;

/** Orbital laser radius in world units */
const LASER_RADIUS = 2.5;

/** Orbital laser duration in seconds */
const LASER_DURATION = 1.0;

/** Orbital laser telegraph duration in seconds */
const LASER_TELEGRAPH_DURATION = 1.2;

/** Shockwave nova damage */
const NOVA_DAMAGE = 25;

/** Shockwave nova radius in world units */
const NOVA_RADIUS = 10;

/** Shockwave nova expansion speed in units per second */
const NOVA_EXPANSION_SPEED = 12;

/** Shockwave nova duration in seconds */
const NOVA_DURATION = 0.8;

/** Continuous laser damage */
const CONTINUOUS_LASER_DAMAGE = 20;

/** Continuous laser hit radius in world units */
const CONTINUOUS_LASER_HIT_RADIUS = 1.2;

/** Continuous laser length in world units */
const CONTINUOUS_LASER_LENGTH = 25;

/** Continuous laser duration in seconds */
const CONTINUOUS_LASER_DURATION = 3.0;

/** Trail particle life in seconds */
const TRAIL_PARTICLE_LIFE = 0.5;

/** Trail particle spawn interval in seconds */
const TRAIL_SPAWN_INTERVAL = 0.08;

/** Summon callback type */
export interface SummonBruteCallback {
  (x: number, z: number): void;
}

/**
 * BossOverseer
 *
 * The Overseer boss implementation.
 */
export default class BossOverseer extends Boss {
  /** Callback to spawn Brute minions */
  private onSummonBrute: SummonBruteCallback;

  /** Active orbital laser projectiles */
  private lasers: LaserProjectile[] = [];

  /** Active nova rings */
  private novaRings: NovaRing[] = [];

  /** Active trail particles from the continuous laser */
  private trailParticles: TrailParticle[] = [];

  /** Continuous laser state */
  private continuousLaserActive: boolean = false;
  private continuousLaserTimer: number = 0;
  private continuousLaserMesh: THREE.Mesh | null = null;
  private continuousLaserMaterial: THREE.MeshStandardMaterial | null = null;
  private continuousLaserHasHit: boolean = false;
  private trailSpawnTimer: number = 0;

  /** Orbital laser telegraph state */
  private laserTelegraphActive: boolean = false;
  private laserTelegraphPosition: THREE.Vector3 = new THREE.Vector3();

  /** Reference to the core material for phase-based glow changes */
  private coreMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the armor crack materials for phase-based emissive changes */
  private armorCrackMaterials: THREE.MeshStandardMaterial[] = [];

  /** Reference to the visor material for phase-based glow changes */
  private visorMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the body materials for phase-based color shifts */
  private bodyMaterialsList: THREE.MeshStandardMaterial[] = [];

  /** Shared geometry for laser meshes */
  private laserGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for nova rings */
  private novaRingGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for trail particles */
  private trailGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for the continuous laser mesh */
  private continuousLaserGeometry: THREE.BufferGeometry | null = null;

  /**
   * Creates a new BossOverseer.
   * @param scene - The THREE.Scene to add the boss to
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onDeath - Death callback invoked when the boss dies
   * @param onScreenShake - Screen shake callback for death explosion and attack damage
   * @param onSummonBrute - Callback to spawn Brute minions
   */
  constructor(
    scene: THREE.Scene,
    x: number,
    z: number,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onDeath: (boss: Boss) => void,
    onScreenShake: (intensity: number, duration: number) => void,
    onSummonBrute: SummonBruteCallback
  ) {
    super(
      scene,
      OVERSEER_CONFIG,
      x,
      z,
      isWalkable,
      getPlayerPosition,
      onDeath,
      onScreenShake
    );

    this.onSummonBrute = onSummonBrute;
  }

  /**
   * Builds the Overseer visual model.
   * A giant black mech with massive torso, glowing purple/orange core,
   * orbital laser cannon on top, heavy armor plates, head with visor,
   * and armor cracks.
   */
  protected buildVisual(): void {
    // Initialize arrays (parent constructor calls buildVisual before child field initializers run)
    this.bodyMaterialsList = [];
    this.armorCrackMaterials = [];

    // --- Materials ---
    const blackMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.5,
    });

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa00ff,
      emissive: 0xaa00ff,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.coreMaterial = coreMaterial;

    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc00ff,
      emissive: 0xcc00ff,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.visorMaterial = visorMaterial;

    const purpleGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa00ff,
      emissive: 0xaa00ff,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    const orangeGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Legs (heavy) ---
    const legGeometry = new THREE.BoxGeometry(1.0, 1.5, 1.2);
    const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
    leftLeg.position.set(-1.0, 0.75, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.group.add(leftLeg);
    this.bodyMaterialsList.push(darkMetalMaterial);

    const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
    rightLeg.position.set(1.0, 0.75, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.group.add(rightLeg);
    this.bodyMaterialsList.push(darkMetalMaterial);

    // --- Feet (heavy) ---
    const footGeometry = new THREE.BoxGeometry(1.2, 0.3, 1.6);
    const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
    leftFoot.position.set(-1.0, 0.15, 0.2);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    this.group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
    rightFoot.position.set(1.0, 0.15, 0.2);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    this.group.add(rightFoot);

    // --- Torso (massive) ---
    const torsoGeometry = new THREE.BoxGeometry(3.0, 2.0, 1.8);
    const torso = new THREE.Mesh(torsoGeometry, blackMetalMaterial);
    torso.position.y = 2.2;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);
    this.bodyMaterialsList.push(blackMetalMaterial);

    // --- Chest Core (glowing purple/orange) ---
    const coreGeometry = new THREE.SphereGeometry(0.45, 16, 16);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 2.3, 0.95);
    this.group.add(core);

    // --- Core Ring (purple glow ring around the core) ---
    const coreRingGeometry = new THREE.TorusGeometry(0.55, 0.06, 8, 24);
    const coreRing = new THREE.Mesh(coreRingGeometry, purpleGlowMaterial);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 2.3, 0.95);
    this.group.add(coreRing);

    // --- Chest Armor Plates (heavy armor) ---
    const chestPlateGeometry = new THREE.BoxGeometry(3.2, 0.7, 0.25);
    const chestPlate = new THREE.Mesh(chestPlateGeometry, darkMetalMaterial);
    chestPlate.position.set(0, 2.8, 0.8);
    chestPlate.castShadow = true;
    this.group.add(chestPlate);
    this.bodyMaterialsList.push(darkMetalMaterial);

    // --- Armor Cracks (emissive purple lines, visible in later phases) ---
    const crackMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc00ff,
      emissive: 0xcc00ff,
      emissiveIntensity: 0.0, // Starts off, increases in later phases
      roughness: 0.3,
      metalness: 0.1,
    });
    this.armorCrackMaterials.push(crackMaterial);

    // Crack 1: horizontal line on the chest
    const crack1Geometry = new THREE.BoxGeometry(2.4, 0.05, 0.06);
    const crack1 = new THREE.Mesh(crack1Geometry, crackMaterial);
    crack1.position.set(0, 2.5, 0.92);
    this.group.add(crack1);

    // Crack 2: diagonal line on the left side
    const crack2Geometry = new THREE.BoxGeometry(0.8, 0.05, 0.06);
    const crack2 = new THREE.Mesh(crack2Geometry, crackMaterial);
    crack2.position.set(-1.3, 3.0, 0.8);
    crack2.rotation.z = 0.5;
    this.group.add(crack2);

    // Crack 3: vertical line on the right side
    const crack3Geometry = new THREE.BoxGeometry(0.05, 1.0, 0.06);
    const crack3 = new THREE.Mesh(crack3Geometry, crackMaterial);
    crack3.position.set(1.5, 2.5, 0.8);
    this.group.add(crack3);

    // --- Head ---
    const headGeometry = new THREE.BoxGeometry(1.2, 0.8, 1.0);
    const head = new THREE.Mesh(headGeometry, blackMetalMaterial);
    head.position.y = 3.6;
    head.castShadow = true;
    head.receiveShadow = true;
    this.group.add(head);
    this.bodyMaterialsList.push(blackMetalMaterial);

    // --- Glowing Purple Visor ---
    const visorGeometry = new THREE.BoxGeometry(1.0, 0.15, 0.1);
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 3.65, 0.52);
    this.group.add(visor);

    // --- Head Crest (dark metal fin) ---
    const crestGeometry = new THREE.BoxGeometry(0.4, 0.35, 0.1);
    const crest = new THREE.Mesh(crestGeometry, darkMetalMaterial);
    crest.position.set(0, 4.15, 0.4);
    crest.castShadow = true;
    this.group.add(crest);

    // --- Orbital Laser Cannon (on top of torso) ---
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(0, 3.2, 0.3);

    // Cannon base (dark metal cylinder)
    const cannonBaseGeometry = new THREE.CylinderGeometry(0.6, 0.7, 0.6, 12);
    const cannonBase = new THREE.Mesh(cannonBaseGeometry, darkMetalMaterial);
    cannonBase.position.y = 0.3;
    cannonBase.castShadow = true;
    cannonGroup.add(cannonBase);

    // Cannon barrel (large cylinder)
    const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2.0, 12);
    const barrel = new THREE.Mesh(barrelGeometry, blackMetalMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.2;
    barrel.castShadow = true;
    cannonGroup.add(barrel);
    this.bodyMaterialsList.push(blackMetalMaterial);

    // Cannon muzzle (glowing purple ring)
    const muzzleRingGeometry = new THREE.TorusGeometry(0.4, 0.07, 8, 16);
    const muzzleRing = new THREE.Mesh(muzzleRingGeometry, purpleGlowMaterial);
    muzzleRing.rotation.y = Math.PI / 2;
    muzzleRing.position.z = 2.2;
    cannonGroup.add(muzzleRing);

    // Cannon energy coil (glowing orange cylinder near the base)
    const coilGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12);
    const coil = new THREE.Mesh(coilGeometry, orangeGlowMaterial);
    coil.position.z = 0.5;
    cannonGroup.add(coil);

    this.group.add(cannonGroup);

    // --- Shoulder Armor Plates (massive) ---
    const shoulderGeometry = new THREE.BoxGeometry(0.7, 0.35, 1.0);
    const shoulderMaterial = darkMetalMaterial;

    const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    leftShoulder.position.set(-1.8, 2.9, 0);
    leftShoulder.castShadow = true;
    this.group.add(leftShoulder);
    this.bodyMaterialsList.push(shoulderMaterial);

    const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    rightShoulder.position.set(1.8, 2.9, 0);
    rightShoulder.castShadow = true;
    this.group.add(rightShoulder);
    this.bodyMaterialsList.push(shoulderMaterial);

    // --- Arms (thick) ---
    const armGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.8);
    const leftArm = new THREE.Mesh(armGeometry, blackMetalMaterial);
    leftArm.position.set(-1.7, 1.9, 0);
    leftArm.castShadow = true;
    this.group.add(leftArm);
    this.bodyMaterialsList.push(blackMetalMaterial);

    const rightArm = new THREE.Mesh(armGeometry, blackMetalMaterial);
    rightArm.position.set(1.7, 1.9, 0);
    rightArm.castShadow = true;
    this.group.add(rightArm);
    this.bodyMaterialsList.push(blackMetalMaterial);

    // --- Arm Fists (heavy) ---
    const fistGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.9);
    const leftFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
    leftFist.position.set(-1.7, 1.0, 0);
    leftFist.castShadow = true;
    this.group.add(leftFist);

    const rightFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
    rightFist.position.set(1.7, 1.0, 0);
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

    // --- Orbital Laser Strike (all phases) ---
    attacks.push({
      id: 'orbital_laser',
      cooldown: phaseIndex === 2 ? 3.5 : 6.0, // Faster in phase 3
      telegraphDuration: LASER_TELEGRAPH_DURATION,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.executeOrbitalLaser();
      },
      onTelegraph: (boss) => {
        // Show red warning circle at the player's position
        const playerPos = this.getPlayerPosition();
        this.laserTelegraphPosition.copy(playerPos);
        this.laserTelegraphActive = true;
        this.spawnTelegraph(playerPos, LASER_RADIUS, LASER_TELEGRAPH_DURATION);
      },
      onTelegraphCancel: (boss) => {
        this.laserTelegraphActive = false;
      },
    });

    // --- Shockwave Nova (all phases) ---
    attacks.push({
      id: 'shockwave_nova',
      cooldown: phaseIndex === 2 ? 4.0 : 7.0, // Faster in phase 3
      telegraphDuration: 0.8,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.executeShockwaveNova();
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

    // --- Summon Brutes (Phase 2 and 3) ---
    if (phaseIndex >= 1) {
      attacks.push({
        id: 'summon_brutes',
        cooldown: phaseIndex === 2 ? 10.0 : 14.0,
        telegraphDuration: 1.0,
        isOnCooldown: false,
        cooldownTimer: 0,
        isTelegraphing: false,
        telegraphTimer: 0,
        execute: (boss) => {
          this.executeSummonBrutes();
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

    // --- Continuous Laser (Phase 3 only) ---
    if (phaseIndex >= 2) {
      attacks.push({
        id: 'continuous_laser',
        cooldown: 8.0,
        telegraphDuration: 1.0,
        isOnCooldown: false,
        cooldownTimer: 0,
        isTelegraphing: false,
        telegraphTimer: 0,
        execute: (boss) => {
          this.startContinuousLaser();
        },
        onTelegraph: (boss) => {
          // Visual cue: cannon glows brighter
          this.setCannonGlow(true);
        },
        onTelegraphCancel: (boss) => {
          this.setCannonGlow(false);
        },
      });
    }

    return attacks;
  }

  /**
   * Executes the orbital laser strike.
   * Creates a vertical glowing cylinder at the telegraphed position.
   */
  private executeOrbitalLaser(): void {
    // Clear telegraph state
    this.laserTelegraphActive = false;

    // Create the laser mesh
    if (!this.laserGeometry) {
      this.laserGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
    }

    const laserMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc00ff,
      emissive: 0xcc00ff,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.9,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const laserMesh = new THREE.Mesh(this.laserGeometry, laserMaterial);

    // Position the laser at the telegraphed position
    laserMesh.position.copy(this.laserTelegraphPosition);
    laserMesh.position.y = 5; // Center of the laser beam

    // Scale the laser to be tall (from ground to high above)
    laserMesh.scale.set(1, 10, 1);

    this.scene.add(laserMesh);

    // Store the laser projectile
    this.lasers.push({
      mesh: laserMesh,
      material: laserMaterial,
      life: LASER_DURATION,
      maxLife: LASER_DURATION,
      radius: LASER_RADIUS,
      hasHitPlayer: false,
    });
  }

  /**
   * Executes the shockwave nova attack.
   * Creates an expanding ring mesh from the boss position.
   */
  private executeShockwaveNova(): void {
    // Create the nova ring mesh
    if (!this.novaRingGeometry) {
      this.novaRingGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
    }

    const novaMaterial = new THREE.MeshBasicMaterial({
      color: 0xcc00ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const novaMesh = new THREE.Mesh(this.novaRingGeometry, novaMaterial);
    novaMesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
    novaMesh.position.copy(this.group.position);
    novaMesh.position.y = 0.1; // Slightly above ground

    this.scene.add(novaMesh);

    // Store the nova ring
    this.novaRings.push({
      mesh: novaMesh,
      material: novaMaterial,
      life: NOVA_DURATION,
      maxLife: NOVA_DURATION,
      expansionSpeed: NOVA_EXPANSION_SPEED,
      initialRadius: 1.0,
      maxRadius: NOVA_RADIUS,
      hasHitPlayer: false,
    });
  }

  /**
   * Executes the summon brutes attack.
   * Spawns 2 Brutes near the boss.
   */
  private executeSummonBrutes(): void {
    const bossPos = this.group.position;

    for (let i = 0; i < 2; i++) {
      // Random angle
      const angle = Math.random() * Math.PI * 2;
      // Random distance between 4-6 units
      const distance = 4 + Math.random() * 2;

      const spawnX = bossPos.x + Math.cos(angle) * distance;
      const spawnZ = bossPos.z + Math.sin(angle) * distance;

      // Call the summon callback
      this.onSummonBrute(spawnX, spawnZ);
    }
  }

  /**
   * Starts the continuous laser attack (Phase 3).
   * Creates a beam that tracks the player.
   */
  private startContinuousLaser(): void {
    // Remove any existing continuous laser
    this.removeContinuousLaser();

    // Create the continuous laser mesh
    if (!this.continuousLaserGeometry) {
      this.continuousLaserGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 12, 1, true);
    }

    const laserMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.9,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const laserMesh = new THREE.Mesh(this.continuousLaserGeometry, laserMaterial);
    laserMesh.rotation.x = Math.PI / 2; // Align along Z axis
    laserMesh.position.copy(this.group.position);
    laserMesh.position.y = 3.2 * this.config.scale; // Cannon height

    // Scale the laser to the desired length
    laserMesh.scale.set(1, 1, CONTINUOUS_LASER_LENGTH);

    // Position the laser so it extends from the cannon forward
    laserMesh.position.z += CONTINUOUS_LASER_LENGTH / 2;

    this.scene.add(laserMesh);

    // Store the continuous laser state
    this.continuousLaserActive = true;
    this.continuousLaserTimer = CONTINUOUS_LASER_DURATION;
    this.continuousLaserMesh = laserMesh;
    this.continuousLaserMaterial = laserMaterial;
    this.continuousLaserHasHit = false;
    this.trailSpawnTimer = 0;

    // Reset cannon glow
    this.setCannonGlow(false);
  }

  /**
   * Updates the continuous laser (tracks the player).
   * @param deltaTime - Time since last frame in seconds
   */
  private updateContinuousLaser(deltaTime: number): void {
    if (!this.continuousLaserActive || !this.continuousLaserMesh) return;

    // Decrement the laser timer
    this.continuousLaserTimer -= deltaTime;

    // Remove the laser when the timer expires
    if (this.continuousLaserTimer <= 0) {
      this.removeContinuousLaser();
      return;
    }

    // Get the boss position and player position
    const bossPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Direction from boss to player
    const toPlayer = new THREE.Vector3()
      .subVectors(playerPos, bossPos)
      .setY(0);

    const distToPlayer = toPlayer.length();

    // Only track if the player is within the laser's length
    if (distToPlayer <= CONTINUOUS_LASER_LENGTH) {
      // Calculate the angle to the player
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);

      // Rotate the laser to face the player
      this.continuousLaserMesh.rotation.y = targetAngle;

      // Spawn trail particles
      this.trailSpawnTimer -= deltaTime;
      if (this.trailSpawnTimer <= 0) {
        this.trailSpawnTimer = TRAIL_SPAWN_INTERVAL;
        this.spawnTrailParticle(this.continuousLaserMesh);
      }

      // Check if the player is within the beam's hit radius
      const playerAngle = Math.atan2(toPlayer.x, toPlayer.z);
      let angleDiff = Math.abs(playerAngle - targetAngle);
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      // The beam has a radius of 0.3, so the angular width is approximately
      // atan(0.3 / distToPlayer)
      const angularWidth = Math.atan2(0.3, distToPlayer);

      if (angleDiff <= angularWidth) {
        // Player is in the beam path
        if (!this.continuousLaserHasHit) {
          // Apply damage via screen shake callback (intensity 0.25 signals beam damage of 20)
          this.onScreenShake(0.25, 0.1);
          this.continuousLaserHasHit = true;
        }
      } else {
        // Player is not in the beam path, reset hit flag
        this.continuousLaserHasHit = false;
      }
    }
  }

  /**
   * Removes the continuous laser from the scene.
   */
  private removeContinuousLaser(): void {
    if (this.continuousLaserMesh) {
      this.scene.remove(this.continuousLaserMesh);
      if (this.continuousLaserMaterial) {
        this.continuousLaserMaterial.dispose();
      }
      this.continuousLaserMesh = null;
      this.continuousLaserMaterial = null;
    }
    this.continuousLaserActive = false;
  }

  /**
   * Spawns a trail particle at the laser's tip.
   * @param laserMesh - The laser mesh to spawn the trail for
   */
  private spawnTrailParticle(laserMesh: THREE.Mesh): void {
    if (!this.trailGeometry) {
      this.trailGeometry = new THREE.SphereGeometry(0.15, 6, 6);
    }

    // Create trail material
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    // Create trail mesh
    const mesh = new THREE.Mesh(this.trailGeometry, material);

    // Position at the laser's tip
    const laserPos = laserMesh.position;
    const direction = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), laserMesh.rotation.y);

    mesh.position.copy(laserPos);
    mesh.position.add(direction.multiplyScalar(CONTINUOUS_LASER_LENGTH));

    this.scene.add(mesh);

    // Store the trail particle
    this.trailParticles.push({
      mesh,
      material,
      life: TRAIL_PARTICLE_LIFE,
      maxLife: TRAIL_PARTICLE_LIFE,
    });
  }

  /**
   * Sets the cannon glow state.
   * @param glowing - Whether the cannon should glow
   */
  private setCannonGlow(glowing: boolean): void {
    // Find cannon muzzle ring and energy coil materials and adjust emissive intensity
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material && material.color && (material.color.getHex() === 0xaa00ff || material.color.getHex() === 0xff6600)) {
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
   * Overrides the base class to add Overseer-specific visuals.
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

    // Color shift toward purple/orange in later phases
    const colorShift = this.currentPhaseIndex / 2; // 0, 0.5, 1.0
    for (const material of this.bodyMaterialsList) {
      // Shift black toward purple/orange
      const baseColor = new THREE.Color(0x1a1a1a);
      const purpleColor = new THREE.Color(0x4a1a6a);
      const orangeColor = new THREE.Color(0x8a4a1a);
      if (this.currentPhaseIndex === 2) {
        material.color.copy(baseColor).lerp(orangeColor, colorShift);
      } else {
        material.color.copy(baseColor).lerp(purpleColor, colorShift);
      }
    }

    // Visor glows brighter in later phases
    if (this.visorMaterial) {
      this.visorMaterial.emissiveIntensity = 2.5 + this.currentPhaseIndex * 1.0;
    }
  }

  /**
   * Updates the boss's animations, AI, and effects.
   * Overrides the base class to add Overseer-specific updates.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Call base class update (handles phases, attacks, effects)
    super.update(deltaTime);

    // Skip if dead
    if (!this.isAlive) return;

    // Update orbital lasers
    this.updateLasers(deltaTime);

    // Update nova rings
    this.updateNovaRings(deltaTime);

    // Update continuous laser
    this.updateContinuousLaser(deltaTime);

    // Update trail particles
    this.updateTrailParticles(deltaTime);

    // --- Movement: Slowly move toward the player ---
    if (!this.isTransitioning) {
      const playerPos = this.getPlayerPosition();
      const bossPos = this.group.position;

      // Direction to player
      const toPlayer = new THREE.Vector3().subVectors(playerPos, bossPos);
      toPlayer.y = 0;
      const distToPlayer = toPlayer.length();

      // Move if far enough away
      if (distToPlayer > 7) {
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
   * Updates all active orbital lasers.
   * Fades them out and checks player collision.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateLasers(deltaTime: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];

      // Decrement life
      laser.life -= deltaTime;

      // Remove if life expired
      if (laser.life <= 0) {
        this.scene.remove(laser.mesh);
        laser.material.dispose();
        this.lasers.splice(i, 1);
        continue;
      }

      // Fade opacity
      const ratio = laser.life / laser.maxLife;
      laser.material.opacity = ratio * 0.9;

      // Check if the player is within the laser's radius
      const playerPos = this.getPlayerPosition();
      const dx = playerPos.x - laser.mesh.position.x;
      const dz = playerPos.z - laser.mesh.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= laser.radius * laser.radius) {
        // Player is in the laser
        if (!laser.hasHitPlayer) {
          // Apply damage via screen shake callback (intensity 0.35 signals laser damage of 30)
          this.onScreenShake(0.35, 0.2);
          laser.hasHitPlayer = true;
        }
      } else {
        // Player is not in the laser, reset hit flag
        laser.hasHitPlayer = false;
      }
    }
  }

  /**
   * Updates all active nova rings.
   * Expands them and checks player collision.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateNovaRings(deltaTime: number): void {
    for (let i = this.novaRings.length - 1; i >= 0; i--) {
      const nova = this.novaRings[i];

      // Decrement life
      nova.life -= deltaTime;

      // Remove if life expired
      if (nova.life <= 0) {
        this.scene.remove(nova.mesh);
        nova.material.dispose();
        this.novaRings.splice(i, 1);
        continue;
      }

      // Expand the ring
      const progress = 1 - nova.life / nova.maxLife;
      const radius = nova.initialRadius + progress * (nova.maxRadius - nova.initialRadius);
      nova.mesh.scale.setScalar(radius);

      // Fade opacity
      nova.material.opacity = 0.8 * (nova.life / nova.maxLife);

      // Check if the player is within the nova's current radius
      const playerPos = this.getPlayerPosition();
      const bossPos = this.group.position;
      const dx = playerPos.x - bossPos.x;
      const dz = playerPos.z - bossPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Check if the player is within the ring's current radius
      // (between the ring's inner and outer edges)
      const innerRadius = radius * 0.9;
      const outerRadius = radius * 1.0;

      if (dist >= innerRadius && dist <= outerRadius) {
        // Player is in the nova ring
        if (!nova.hasHitPlayer) {
          // Apply damage via screen shake callback (intensity 0.3 signals nova damage of 25)
          this.onScreenShake(0.3, 0.2);
          nova.hasHitPlayer = true;
        }
      } else {
        // Player is not in the nova ring, reset hit flag
        nova.hasHitPlayer = false;
      }
    }
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
   * Disposes all resources and cleans up.
   * Overrides the base class to add Overseer-specific cleanup.
   */
  public dispose(): void {
    // Remove the continuous laser
    this.removeContinuousLaser();

    // Dispose all orbital lasers
    for (const laser of this.lasers) {
      this.scene.remove(laser.mesh);
      laser.material.dispose();
    }
    this.lasers = [];

    // Dispose all nova rings
    for (const nova of this.novaRings) {
      this.scene.remove(nova.mesh);
      nova.material.dispose();
    }
    this.novaRings = [];

    // Dispose all trail particles
    for (const particle of this.trailParticles) {
      this.scene.remove(particle.mesh);
      particle.material.dispose();
    }
    this.trailParticles = [];

    // Dispose shared geometries
    if (this.laserGeometry) {
      this.laserGeometry.dispose();
      this.laserGeometry = null;
    }
    if (this.novaRingGeometry) {
      this.novaRingGeometry.dispose();
      this.novaRingGeometry = null;
    }
    if (this.trailGeometry) {
      this.trailGeometry.dispose();
      this.trailGeometry = null;
    }
    if (this.continuousLaserGeometry) {
      this.continuousLaserGeometry.dispose();
      this.continuousLaserGeometry = null;
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