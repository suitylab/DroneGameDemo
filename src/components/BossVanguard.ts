import * as THREE from 'three';
import Boss, { BossAttack, BossConfig } from './Boss';

/**
 * BossVanguard
 *
 * The Vanguard boss implementation for the MAZE STRIKE game (Phase 8).
 * A blue quad-legged walker boss fought at Level 7 with 1200 HP and 2 phases.
 *
 * Phase 1 (100-50%): Plasma beam sweep + stomp (AoE).
 * Phase 2 (50-0%): Adds deployment of 3 Scout Drones, beam sweeps faster.
 *
 * The visual model is a blue quad-legged walker with:
 *   - 4 jointed legs (2 front, 2 back)
 *   - Box torso with blue metal material
 *   - Glowing blue core (emissive sphere)
 *   - Plasma cannon on top (cylinder barrel + glowing ring)
 *   - Heavy armor plates
 *   - Head with glowing blue visor
 *   - Armor cracks (emissive blue lines, brighter in phase 2)
 *
 * Distinct visual changes per phase:
 *   - Core glows brighter
 *   - Armor cracks become visible
 *
 * All visuals are procedural THREE.js primitives. No external binary assets.
 */

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/**
 * BeamProjectile
 *
 * The sweeping plasma beam mesh created during the beam sweep attack.
 */
interface BeamProjectile {
  /** The visible mesh for the beam (glowing cylinder) */
  mesh: THREE.Mesh;
  /** The material (for glow intensity control) */
  material: THREE.MeshStandardMaterial;
  /** The start angle of the sweep (radians, relative to boss facing) */
  startAngle: number;
  /** The end angle of the sweep (radians, relative to boss facing) */
  endAngle: number;
  /** Current sweep progress (0.0 to 1.0) */
  progress: number;
  /** Duration of the sweep in seconds */
  duration: number;
  /** The length of the beam in world units */
  length: number;
  /** The radius of the beam in world units */
  radius: number;
  /** Whether the player has been hit by this beam (prevents multi-hit per frame) */
  hasHitPlayer: boolean;
}

/**
 * TrailParticle
 *
 * A single glowing particle spawned along the beam's path during the sweep.
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

/** Vanguard configuration */
const VANGUARD_CONFIG: BossConfig = {
  name: 'VANGUARD',
  maxHealth: 1200,
  speed: 2.0,
  scale: 1.1667,
  height: 2.8,
  explosionColor: 0x00aaff,
  glowColor: 0x00ccff,
  phases: [
    {
      healthThreshold: 1.0,
      speedMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      transitionColor: 0x00aaff,
      isEnraged: false,
    },
    {
      healthThreshold: 0.5,
      speedMultiplier: 1.2,
      attackSpeedMultiplier: 0.8,
      transitionColor: 0x00ccff,
      isEnraged: true,
    },
  ],
};

/** Beam sweep damage */
const BEAM_DAMAGE = 20;

/** Beam sweep hit radius in world units */
const BEAM_HIT_RADIUS = 1.2;

/** Stomp AoE radius in world units */
const STOMP_RADIUS = 6;

/** Stomp damage */
const STOMP_DAMAGE = 30;

/** Stomp telegraph duration in seconds */
const STOMP_TELEGRAPH_DURATION = 1.0;

/** Trail particle life in seconds */
const TRAIL_PARTICLE_LIFE = 0.5;

/** Trail particle spawn interval in seconds */
const TRAIL_SPAWN_INTERVAL = 0.08;

/** Summon callback type */
export interface SummonScoutCallback {
  (x: number, z: number): void;
}

/**
 * BossVanguard
 *
 * The Vanguard boss implementation.
 */
export default class BossVanguard extends Boss {
  /** Callback to spawn Scout Drone minions */
  private onSummonScout: SummonScoutCallback;

  /** Active beam projectile (null when not sweeping) */
  private beamProjectile: BeamProjectile | null = null;

  /** Active trail particles from the beam sweep */
  private trailParticles: TrailParticle[] = [];

  /** Whether the beam sweep is currently active */
  private isBeamSweeping: boolean = false;

  /** Timer for the beam sweep (seconds remaining) */
  private beamSweepTimer: number = 0;

  /** Timer for trail particle spawning */
  private trailSpawnTimer: number = 0;

  /** Stomp telegraph state */
  private stompTelegraphActive: boolean = false;
  private stompTelegraphPosition: THREE.Vector3 = new THREE.Vector3();

  /** Reference to the core material for phase-based glow changes */
  private coreMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the armor crack materials for phase-based emissive changes */
  private armorCrackMaterials: THREE.MeshStandardMaterial[] = [];

  /** Reference to the visor material for phase-based glow changes */
  private visorMaterial: THREE.MeshStandardMaterial | null = null;

  /** Reference to the body materials for phase-based color shifts */
  private bodyMaterialsList: THREE.MeshStandardMaterial[] = [];

  /** Shared geometry for the beam mesh */
  private beamGeometry: THREE.BufferGeometry | null = null;

  /** Shared geometry for trail particles */
  private trailGeometry: THREE.BufferGeometry | null = null;

  /** Whether the boss is currently stomping (visual animation) */
  private isStomping: boolean = false;
  private stompAnimationTimer: number = 0;
  private readonly stompAnimationDuration: number = 0.3;

  /**
   * Creates a new BossVanguard.
   * @param scene - The THREE.Scene to add the boss to
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   * @param isWalkable - Walkability callback (returns true if position is walkable)
   * @param getPlayerPosition - Player position getter callback
   * @param onDeath - Death callback invoked when the boss dies
   * @param onScreenShake - Screen shake callback for death explosion and attack damage
   * @param onSummonScout - Callback to spawn Scout Drone minions
   */
  constructor(
    scene: THREE.Scene,
    x: number,
    z: number,
    isWalkable: (x: number, z: number) => boolean,
    getPlayerPosition: () => THREE.Vector3,
    onDeath: (boss: Boss) => void,
    onScreenShake: (intensity: number, duration: number) => void,
    onSummonScout: SummonScoutCallback
  ) {
    super(
      scene,
      VANGUARD_CONFIG,
      x,
      z,
      isWalkable,
      getPlayerPosition,
      onDeath,
      onScreenShake
    );

    this.onSummonScout = onSummonScout;
  }

  /**
   * Builds the Vanguard visual model.
   * A blue quad-legged walker with jointed legs, box torso, glowing blue core,
   * plasma cannon on top, heavy armor plates, head with visor, and armor cracks.
   */
  protected buildVisual(): void {
    // Initialize arrays (parent constructor calls buildVisual before child field initializers run)
    this.bodyMaterialsList = [];
    this.armorCrackMaterials = [];

    // --- Materials ---
    const blueMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a3a6a,
      metalness: 0.8,
      roughness: 0.4,
    });

    const darkBlueMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x102040,
      metalness: 0.8,
      roughness: 0.5,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.5,
    });

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x00aaff,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.coreMaterial = coreMaterial;

    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x00ccff,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.visorMaterial = visorMaterial;

    const blueGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      emissive: 0x00aaff,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Legs (4 jointed legs) ---
    const legSegmentGeometry = new THREE.BoxGeometry(0.35, 0.8, 0.35);
    const legFootGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.6);

    // Leg positions: front-left, front-right, back-left, back-right
    const legPositions = [
      { x: -0.9, z: -0.8, angle: 0.3 },  // Front-left
      { x: 0.9, z: -0.8, angle: -0.3 },  // Front-right
      { x: -0.9, z: 0.8, angle: -0.3 },  // Back-left
      { x: 0.9, z: 0.8, angle: 0.3 },    // Back-right
    ];

    for (const legPos of legPositions) {
      // Upper leg segment
      const upperLeg = new THREE.Mesh(legSegmentGeometry, darkBlueMetalMaterial);
      upperLeg.position.set(legPos.x, 0.9, legPos.z);
      upperLeg.rotation.x = legPos.angle;
      upperLeg.castShadow = true;
      upperLeg.receiveShadow = true;
      this.group.add(upperLeg);
      this.bodyMaterialsList.push(darkBlueMetalMaterial);

      // Lower leg segment (slightly offset)
      const lowerLeg = new THREE.Mesh(legSegmentGeometry, darkBlueMetalMaterial);
      lowerLeg.position.set(legPos.x, 0.3, legPos.z + legPos.angle * 0.3);
      lowerLeg.rotation.x = -legPos.angle * 0.5;
      lowerLeg.castShadow = true;
      lowerLeg.receiveShadow = true;
      this.group.add(lowerLeg);
      this.bodyMaterialsList.push(darkBlueMetalMaterial);

      // Foot
      const foot = new THREE.Mesh(legFootGeometry, darkMetalMaterial);
      foot.position.set(legPos.x, 0.1, legPos.z);
      foot.castShadow = true;
      foot.receiveShadow = true;
      this.group.add(foot);
    }

    // --- Torso (main body) ---
    const torsoGeometry = new THREE.BoxGeometry(2.4, 1.2, 1.8);
    const torso = new THREE.Mesh(torsoGeometry, blueMetalMaterial);
    torso.position.y = 1.8;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);
    this.bodyMaterialsList.push(blueMetalMaterial);

    // --- Chest Core (glowing blue) ---
    const coreGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 1.9, 0.95);
    this.group.add(core);

    // --- Core Ring (blue glow ring around the core) ---
    const coreRingGeometry = new THREE.TorusGeometry(0.45, 0.05, 8, 24);
    const coreRing = new THREE.Mesh(coreRingGeometry, blueGlowMaterial);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 1.9, 0.95);
    this.group.add(coreRing);

    // --- Chest Armor Plates (heavy armor) ---
    const chestPlateGeometry = new THREE.BoxGeometry(2.6, 0.5, 0.2);
    const chestPlate = new THREE.Mesh(chestPlateGeometry, darkBlueMetalMaterial);
    chestPlate.position.set(0, 2.2, 0.8);
    chestPlate.castShadow = true;
    this.group.add(chestPlate);
    this.bodyMaterialsList.push(darkBlueMetalMaterial);

    // --- Armor Cracks (emissive blue lines, visible in phase 2) ---
    const crackMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x00ccff,
      emissiveIntensity: 0.0, // Starts off, increases in phase 2
      roughness: 0.3,
      metalness: 0.1,
    });
    this.armorCrackMaterials.push(crackMaterial);

    // Crack 1: horizontal line on the chest
    const crack1Geometry = new THREE.BoxGeometry(1.8, 0.04, 0.05);
    const crack1 = new THREE.Mesh(crack1Geometry, crackMaterial);
    crack1.position.set(0, 2.0, 0.92);
    this.group.add(crack1);

    // Crack 2: diagonal line on the left side
    const crack2Geometry = new THREE.BoxGeometry(0.6, 0.04, 0.05);
    const crack2 = new THREE.Mesh(crack2Geometry, crackMaterial);
    crack2.position.set(-1.0, 2.3, 0.8);
    crack2.rotation.z = 0.5;
    this.group.add(crack2);

    // Crack 3: vertical line on the right side
    const crack3Geometry = new THREE.BoxGeometry(0.04, 0.8, 0.05);
    const crack3 = new THREE.Mesh(crack3Geometry, crackMaterial);
    crack3.position.set(1.2, 2.0, 0.8);
    this.group.add(crack3);

    // --- Head ---
    const headGeometry = new THREE.BoxGeometry(1.0, 0.6, 0.8);
    const head = new THREE.Mesh(headGeometry, blueMetalMaterial);
    head.position.y = 2.8;
    head.castShadow = true;
    head.receiveShadow = true;
    this.group.add(head);
    this.bodyMaterialsList.push(blueMetalMaterial);

    // --- Glowing Blue Visor ---
    const visorGeometry = new THREE.BoxGeometry(0.8, 0.12, 0.08);
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 2.85, 0.42);
    this.group.add(visor);

    // --- Head Crest (dark metal fin) ---
    const crestGeometry = new THREE.BoxGeometry(0.3, 0.25, 0.08);
    const crest = new THREE.Mesh(crestGeometry, darkMetalMaterial);
    crest.position.set(0, 3.2, 0.3);
    crest.castShadow = true;
    this.group.add(crest);

    // --- Plasma Cannon (on top of torso) ---
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(0, 2.6, 0.2);

    // Cannon base (dark metal cylinder)
    const cannonBaseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 12);
    const cannonBase = new THREE.Mesh(cannonBaseGeometry, darkMetalMaterial);
    cannonBase.position.y = 0.2;
    cannonBase.castShadow = true;
    cannonGroup.add(cannonBase);

    // Cannon barrel (blue metal cylinder)
    const barrelGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.2, 12);
    const barrel = new THREE.Mesh(barrelGeometry, blueMetalMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.7;
    barrel.castShadow = true;
    cannonGroup.add(barrel);
    this.bodyMaterialsList.push(blueMetalMaterial);

    // Cannon muzzle (glowing blue ring)
    const muzzleRingGeometry = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
    const muzzleRing = new THREE.Mesh(muzzleRingGeometry, blueGlowMaterial);
    muzzleRing.rotation.y = Math.PI / 2;
    muzzleRing.position.z = 1.3;
    cannonGroup.add(muzzleRing);

    // Cannon energy coil (glowing blue cylinder near the base)
    const coilGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 12);
    const coil = new THREE.Mesh(coilGeometry, blueGlowMaterial);
    coil.position.z = 0.3;
    cannonGroup.add(coil);

    this.group.add(cannonGroup);

    // --- Shoulder Armor Plates ---
    const shoulderGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.7);
    const shoulderMaterial = darkBlueMetalMaterial;

    const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    leftShoulder.position.set(-1.4, 2.3, 0);
    leftShoulder.castShadow = true;
    this.group.add(leftShoulder);
    this.bodyMaterialsList.push(shoulderMaterial);

    const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    rightShoulder.position.set(1.4, 2.3, 0);
    rightShoulder.castShadow = true;
    this.group.add(rightShoulder);
    this.bodyMaterialsList.push(shoulderMaterial);

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

    // --- Plasma Beam Sweep (all phases) ---
    attacks.push({
      id: 'plasma_beam_sweep',
      cooldown: phaseIndex === 1 ? 4.0 : 6.0, // Faster in phase 2
      telegraphDuration: 1.0,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.startBeamSweep();
      },
      onTelegraph: (boss) => {
        // Visual cue: cannon glows brighter
        this.setCannonGlow(true);
      },
      onTelegraphCancel: (boss) => {
        this.setCannonGlow(false);
      },
    });

    // --- Stomp (AoE) (all phases) ---
    attacks.push({
      id: 'stomp',
      cooldown: phaseIndex === 1 ? 3.5 : 5.0,
      telegraphDuration: STOMP_TELEGRAPH_DURATION,
      isOnCooldown: false,
      cooldownTimer: 0,
      isTelegraphing: false,
      telegraphTimer: 0,
      execute: (boss) => {
        this.executeGroundStomp();
      },
      onTelegraph: (boss) => {
        // Show red warning circle at the player's position
        const playerPos = this.getPlayerPosition();
        this.stompTelegraphPosition.copy(playerPos);
        this.stompTelegraphActive = true;
        this.spawnTelegraph(playerPos, STOMP_RADIUS, STOMP_TELEGRAPH_DURATION);
      },
      onTelegraphCancel: (boss) => {
        this.stompTelegraphActive = false;
      },
    });

    // --- Deploy Scout Drones (Phase 2 only) ---
    if (phaseIndex >= 1) {
      attacks.push({
        id: 'deploy_scouts',
        cooldown: 10.0,
        telegraphDuration: 0.8,
        isOnCooldown: false,
        cooldownTimer: 0,
        isTelegraphing: false,
        telegraphTimer: 0,
        execute: (boss) => {
          this.executeDeployScouts();
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
   * Starts the plasma beam sweep attack.
   * Creates a glowing cylinder beam and sets up the sweep angles.
   */
  private startBeamSweep(): void {
    // Remove any existing beam
    this.removeBeam();

    // Get the boss's facing direction
    const bossPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Direction from boss to player
    const toPlayer = new THREE.Vector3()
      .subVectors(playerPos, bossPos)
      .setY(0)
      .normalize();

    // Base angle (boss facing direction)
    const baseAngle = Math.atan2(toPlayer.x, toPlayer.z);

    // Sweep from -60° to +60° relative to the player direction
    const sweepHalfAngle = Math.PI / 3; // 60 degrees

    // Create the beam mesh
    if (!this.beamGeometry) {
      this.beamGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 12, 1, true);
    }

    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x00aaff,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.9,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const beamMesh = new THREE.Mesh(this.beamGeometry, beamMaterial);
    beamMesh.rotation.x = Math.PI / 2; // Align along Z axis
    beamMesh.position.copy(bossPos);
    beamMesh.position.y = 2.6 * this.config.scale; // Cannon height

    // Beam length: 20 units
    const beamLength = 20;
    beamMesh.scale.set(1, 1, beamLength);

    // Position the beam so it extends from the cannon forward
    beamMesh.position.z += beamLength / 2;

    this.scene.add(beamMesh);

    // Store the beam projectile
    this.beamProjectile = {
      mesh: beamMesh,
      material: beamMaterial,
      startAngle: baseAngle - sweepHalfAngle,
      endAngle: baseAngle + sweepHalfAngle,
      progress: 0,
      duration: 2.0, // 2 seconds for the full sweep
      length: beamLength,
      radius: 0.3,
      hasHitPlayer: false,
    };

    // Set beam sweeping state
    this.isBeamSweeping = true;
    this.beamSweepTimer = this.beamProjectile.duration;
    this.trailSpawnTimer = 0;

    // Reset cannon glow
    this.setCannonGlow(false);
  }

  /**
   * Updates the beam sweep animation and damage checks.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateBeamSweep(deltaTime: number): void {
    if (!this.isBeamSweeping || !this.beamProjectile) return;

    const beam = this.beamProjectile;

    // Update sweep progress
    beam.progress += deltaTime / beam.duration;

    // Clamp progress
    if (beam.progress >= 1.0) {
      // Sweep complete
      this.removeBeam();
      this.isBeamSweeping = false;
      return;
    }

    // Calculate current angle (ease-in-out for smooth sweep)
    const t = beam.progress;
    const easedT = t * t * (3 - 2 * t); // Smoothstep
    const currentAngle = beam.startAngle + (beam.endAngle - beam.startAngle) * easedT;

    // Update beam rotation
    beam.mesh.rotation.y = currentAngle;

    // Spawn trail particles
    this.trailSpawnTimer -= deltaTime;
    if (this.trailSpawnTimer <= 0) {
      this.trailSpawnTimer = TRAIL_SPAWN_INTERVAL;
      this.spawnTrailParticle(beam);
    }

    // Check if the player is within the beam's hit radius
    const bossPos = this.group.position;
    const playerPos = this.getPlayerPosition();

    // Direction from boss to player
    const toPlayer = new THREE.Vector3()
      .subVectors(playerPos, bossPos)
      .setY(0);

    const distToPlayer = toPlayer.length();

    // Only check if the player is within the beam's length
    if (distToPlayer <= beam.length) {
      // Calculate the angle of the player relative to the boss
      const playerAngle = Math.atan2(toPlayer.x, toPlayer.z);

      // Calculate the angular difference between the beam and the player
      let angleDiff = Math.abs(playerAngle - currentAngle);
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      // Check if the player is within the beam's angular width
      // The beam has a radius of 0.3, so the angular width is approximately
      // atan(0.3 / distToPlayer)
      const angularWidth = Math.atan2(beam.radius, distToPlayer);

      if (angleDiff <= angularWidth) {
        // Player is in the beam path
        if (!beam.hasHitPlayer) {
          // Apply damage via screen shake callback (intensity 0.25 signals beam damage of 20)
          this.onScreenShake(0.25, 0.1);
          beam.hasHitPlayer = true;
        }
      } else {
        // Player is not in the beam path, reset hit flag
        beam.hasHitPlayer = false;
      }
    }
  }

  /**
   * Spawns a trail particle at the beam's tip.
   * @param beam - The beam projectile to spawn the trail for
   */
  private spawnTrailParticle(beam: BeamProjectile): void {
    if (!this.trailGeometry) {
      this.trailGeometry = new THREE.SphereGeometry(0.15, 6, 6);
    }

    // Create trail material
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    // Create trail mesh
    const mesh = new THREE.Mesh(this.trailGeometry, material);

    // Position at the beam's tip
    const beamPos = beam.mesh.position;
    const direction = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), beam.mesh.rotation.y);

    mesh.position.copy(beamPos);
    mesh.position.add(direction.multiplyScalar(beam.length));

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
   * Removes the beam projectile from the scene.
   */
  private removeBeam(): void {
    if (this.beamProjectile) {
      this.scene.remove(this.beamProjectile.mesh);
      this.beamProjectile.material.dispose();
      this.beamProjectile = null;
    }
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
        if (material && material.color && material.color.getHex() === 0x00aaff) {
          material.emissiveIntensity = glowing ? 3.0 : 1.5;
        }
      }
    });
  }

  /**
   * Executes the ground stomp attack.
   * Deals AoE damage at the telegraphed position.
   */
  private executeGroundStomp(): void {
    // Set stomp animation
    this.isStomping = true;
    this.stompAnimationTimer = this.stompAnimationDuration;

    // Apply AoE damage to the player if within radius
    const playerPos = this.getPlayerPosition();
    const dx = playerPos.x - this.stompTelegraphPosition.x;
    const dz = playerPos.z - this.stompTelegraphPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= STOMP_RADIUS) {
      // Damage falloff based on distance
      const falloff = 1 - dist / STOMP_RADIUS;
      const damage = STOMP_DAMAGE * falloff;

      // Apply damage via screen shake callback (intensity 0.35 signals stomp damage of 30)
      this.onScreenShake(0.35, 0.3);
    }

    // Clear telegraph state
    this.stompTelegraphActive = false;
  }

  /**
   * Executes the deploy scouts attack.
   * Spawns 3 Scout Drones near the boss.
   */
  private executeDeployScouts(): void {
    const bossPos = this.group.position;

    for (let i = 0; i < 3; i++) {
      // Random angle
      const angle = Math.random() * Math.PI * 2;
      // Random distance between 3-5 units
      const distance = 3 + Math.random() * 2;

      const spawnX = bossPos.x + Math.cos(angle) * distance;
      const spawnZ = bossPos.z + Math.sin(angle) * distance;

      // Call the summon callback
      this.onSummonScout(spawnX, spawnZ);
    }
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
        return 3.5;
      default:
        return 2.0;
    }
  }

  /**
   * Applies phase-specific visual changes.
   * Overrides the base class to add Vanguard-specific visuals.
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

    // Armor cracks become visible and brighter in phase 2
    const crackIntensity = this.currentPhaseIndex === 0 ? 0.0 : 2.5;
    for (const crackMaterial of this.armorCrackMaterials) {
      crackMaterial.emissiveIntensity = crackIntensity;
    }

    // Visor glows brighter in phase 2
    if (this.visorMaterial) {
      this.visorMaterial.emissiveIntensity = 2.5 + this.currentPhaseIndex * 1.0;
    }
  }

  /**
   * Updates the boss's animations, AI, and effects.
   * Overrides the base class to add Vanguard-specific updates.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Call base class update (handles phases, attacks, effects)
    super.update(deltaTime);

    // Skip if dead
    if (!this.isAlive) return;

    // Update beam sweep
    this.updateBeamSweep(deltaTime);

    // Update trail particles
    this.updateTrailParticles(deltaTime);

    // Update stomp animation
    if (this.isStomping) {
      this.stompAnimationTimer -= deltaTime;
      if (this.stompAnimationTimer <= 0) {
        this.isStomping = false;
        // Reset scale
        this.group.scale.setScalar(this.config.scale);
      } else {
        // Scale pulse for stomp impact
        const progress = 1 - this.stompAnimationTimer / this.stompAnimationDuration;
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
      if (distToPlayer > 6) {
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
   * Overrides the base class to add Vanguard-specific cleanup.
   */
  public dispose(): void {
    // Remove the beam projectile
    this.removeBeam();
    this.isBeamSweeping = false;

    // Dispose all trail particles
    for (const particle of this.trailParticles) {
      this.scene.remove(particle.mesh);
      particle.material.dispose();
    }
    this.trailParticles = [];

    // Dispose shared geometries
    if (this.beamGeometry) {
      this.beamGeometry.dispose();
      this.beamGeometry = null;
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