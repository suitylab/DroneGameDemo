import * as THREE from 'three';

/**
 * EnemyTypes
 *
 * Central configuration and procedural visual builder module for the
 * MAZE STRIKE game (Phase 8). Defines all 7 enemy types:
 *   - Scout Drone
 *   - Sentry MK-I
 *   - Sentry MK-II
 *   - Brute
 *   - Reaper
 *   - Warden
 *   - Phantom
 *
 * Each type has a complete stat config and a polished procedural 3D model.
 * All visuals are constructed from THREE.js primitives with emissive
 * materials for glowing parts. No external binary assets are used.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * EnemyTypeId
 *
 * String literal union type identifying each enemy type by its unique ID.
 * Used for type-safe enemy references throughout the codebase.
 */
export type EnemyTypeId =
  | 'scout_drone'
  | 'sentry_mk1'
  | 'sentry_mk2'
  | 'brute'
  | 'reaper'
  | 'warden'
  | 'phantom';

/**
 * EnemyTypeConfig
 *
 * Complete static configuration for an enemy type. All runtime state
 * (health, position, AI state) is managed separately by the Enemy class.
 */
export interface EnemyTypeConfig {
  /** Unique enemy type identifier */
  id: EnemyTypeId;

  /** Display name shown in the kill feed */
  name: string;

  /** Maximum health points */
  health: number;

  /** Movement speed in units per second */
  speed: number;

  /** Damage dealt per projectile hit or melee attack */
  damage: number;

  /** Fire rate in rounds per minute (for ranged types) */
  fireRateRPM: number;

  /** Projectile travel speed in units per second (for ranged types) */
  projectileSpeed: number;

  /** Hexadecimal color of the projectile (for ranged types) */
  projectileColor: number;

  /** Radius of the projectile mesh in world units (for ranged types) */
  projectileSize: number;

  /** Sight range in world units */
  sightRange: number;

  /** Sight cone angle in degrees (total field of view) */
  sightConeDegrees: number;

  /** Hearing radius in world units (detects gunfire) */
  hearingRadius: number;

  /** Attack range in world units (max distance to engage player) */
  attackRange: number;

  /** Strafe interval in seconds (how often the enemy changes strafe direction) */
  strafeInterval: number;

  /** Minimum patrol pause duration at waypoints in seconds */
  patrolPauseMin: number;

  /** Maximum patrol pause duration at waypoints in seconds */
  patrolPauseMax: number;

  /** Hexadecimal color of the death explosion particles */
  explosionColor: number;

  /** Number of patrol waypoints (2-4) */
  patrolWaypointCount: number;

  /** Scale multiplier for the visual model */
  bodyScale: number;

  /** Whether this enemy is a melee attacker (no projectile) */
  isMelee: boolean;

  /** Whether this enemy fires in bursts (SMG-style) */
  isBurstFire: boolean;

  /** Number of shots in a burst (when isBurstFire is true) */
  burstCount: number;

  /** Delay between burst shots in seconds */
  burstDelay: number;

  /** Whether this enemy has a shield that blocks frontal damage */
  hasShield: boolean;

  /** Chance (0.0-1.0) that frontal damage is blocked by the shield */
  shieldBlockChance: number;

  /** Whether this enemy can stealth (become semi-transparent) */
  isStealth: boolean;

  /** Duration in seconds the enemy is revealed after attacking */
  stealthRevealDuration: number;

  /** Charge speed multiplier when performing a charge attack (brute) */
  chargeSpeed: number;

  /** Telegraph duration in seconds before a charge attack (brute) */
  chargeTelegraphDuration: number;

  /** Dash speed multiplier when performing a dash attack (reaper) */
  dashSpeed: number;

  /** Duration in seconds of the dash attack (reaper) */
  dashDuration: number;
}

// ---------------------------------------------------------------------------
// Enemy Type Configurations
// ---------------------------------------------------------------------------

/**
 * ENEMY_TYPES
 *
 * Record mapping each enemy type ID to its complete configuration.
 * These values are used by the Enemy class and EnemyManager for
 * spawning, AI behavior, and combat calculations.
 */
export const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeConfig> = {
  // -------------------------------------------------------------------------
  // 1. Scout Drone — Small, Fast, Light Laser
  // -------------------------------------------------------------------------
  scout_drone: {
    id: 'scout_drone',
    name: 'SCOUT DRONE',
    health: 30,
    speed: 10,
    damage: 5,
    fireRateRPM: 120,
    projectileSpeed: 45,
    projectileColor: 0xff4444,
    projectileSize: 0.06,
    sightRange: 15,
    sightConeDegrees: 90,
    hearingRadius: 10,
    attackRange: 14,
    strafeInterval: 2,
    patrolPauseMin: 1,
    patrolPauseMax: 2,
    explosionColor: 0x808890,
    patrolWaypointCount: 3,
    bodyScale: 0.8,
    isMelee: false,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 0,
    dashDuration: 0,
  },

  // -------------------------------------------------------------------------
  // 2. Sentry MK-I — Medium, Green Humanoid Mech, Rifle
  // -------------------------------------------------------------------------
  sentry_mk1: {
    id: 'sentry_mk1',
    name: 'SENTRY MK-I',
    health: 60,
    speed: 6,
    damage: 10,
    fireRateRPM: 90,
    projectileSpeed: 55,
    projectileColor: 0x00ff66,
    projectileSize: 0.08,
    sightRange: 15,
    sightConeDegrees: 90,
    hearingRadius: 10,
    attackRange: 16,
    strafeInterval: 2,
    patrolPauseMin: 1,
    patrolPauseMax: 2,
    explosionColor: 0x00ff66,
    patrolWaypointCount: 3,
    bodyScale: 1.0,
    isMelee: false,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 0,
    dashDuration: 0,
  },

  // -------------------------------------------------------------------------
  // 3. Sentry MK-II — Medium, Orange Humanoid Mech, SMG Burst
  // -------------------------------------------------------------------------
  sentry_mk2: {
    id: 'sentry_mk2',
    name: 'SENTRY MK-II',
    health: 80,
    speed: 7,
    damage: 8,
    fireRateRPM: 300,
    projectileSpeed: 65,
    projectileColor: 0xff8800,
    projectileSize: 0.07,
    sightRange: 15,
    sightConeDegrees: 90,
    hearingRadius: 10,
    attackRange: 16,
    strafeInterval: 1.8,
    patrolPauseMin: 1,
    patrolPauseMax: 2,
    explosionColor: 0xff8800,
    patrolWaypointCount: 3,
    bodyScale: 1.0,
    isMelee: false,
    isBurstFire: true,
    burstCount: 3,
    burstDelay: 0.08,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 0,
    dashDuration: 0,
  },

  // -------------------------------------------------------------------------
  // 4. Brute — Large, Red Heavy Mech, Melee Charge
  // -------------------------------------------------------------------------
  brute: {
    id: 'brute',
    name: 'BRUTE',
    health: 150,
    speed: 4,
    damage: 25,
    fireRateRPM: 0,
    projectileSpeed: 0,
    projectileColor: 0xff2200,
    projectileSize: 0,
    sightRange: 14,
    sightConeDegrees: 100,
    hearingRadius: 12,
    attackRange: 3,
    strafeInterval: 3,
    patrolPauseMin: 1.5,
    patrolPauseMax: 3,
    explosionColor: 0xff4400,
    patrolWaypointCount: 2,
    bodyScale: 1.6,
    isMelee: true,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 3.0,
    chargeTelegraphDuration: 0.8,
    dashSpeed: 0,
    dashDuration: 0,
  },

  // -------------------------------------------------------------------------
  // 5. Reaper — Medium, Black Mech, Scythe Dash
  // -------------------------------------------------------------------------
  reaper: {
    id: 'reaper',
    name: 'REAPER',
    health: 100,
    speed: 8,
    damage: 20,
    fireRateRPM: 0,
    projectileSpeed: 0,
    projectileColor: 0xff0000,
    projectileSize: 0,
    sightRange: 16,
    sightConeDegrees: 110,
    hearingRadius: 12,
    attackRange: 3.5,
    strafeInterval: 1.5,
    patrolPauseMin: 0.8,
    patrolPauseMax: 1.5,
    explosionColor: 0x880000,
    patrolWaypointCount: 3,
    bodyScale: 1.0,
    isMelee: true,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 3.5,
    dashDuration: 0.4,
  },

  // -------------------------------------------------------------------------
  // 6. Warden — Large, Blue Shield Mech, Rifle + Shield
  // -------------------------------------------------------------------------
  warden: {
    id: 'warden',
    name: 'WARDEN',
    health: 200,
    speed: 3,
    damage: 15,
    fireRateRPM: 75,
    projectileSpeed: 55,
    projectileColor: 0x00aaff,
    projectileSize: 0.09,
    sightRange: 15,
    sightConeDegrees: 90,
    hearingRadius: 10,
    attackRange: 16,
    strafeInterval: 2.5,
    patrolPauseMin: 1,
    patrolPauseMax: 2,
    explosionColor: 0x00aaff,
    patrolWaypointCount: 2,
    bodyScale: 1.4,
    isMelee: false,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: true,
    shieldBlockChance: 0.8,
    isStealth: false,
    stealthRevealDuration: 0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 0,
    dashDuration: 0,
  },

  // -------------------------------------------------------------------------
  // 7. Phantom — Medium, Purple Stealth Mech, Plasma
  // -------------------------------------------------------------------------
  phantom: {
    id: 'phantom',
    name: 'PHANTOM',
    health: 90,
    speed: 9,
    damage: 18,
    fireRateRPM: 150,
    projectileSpeed: 70,
    projectileColor: 0xaa00ff,
    projectileSize: 0.08,
    sightRange: 16,
    sightConeDegrees: 100,
    hearingRadius: 12,
    attackRange: 16,
    strafeInterval: 1.5,
    patrolPauseMin: 0.8,
    patrolPauseMax: 1.5,
    explosionColor: 0xaa00ff,
    patrolWaypointCount: 3,
    bodyScale: 1.0,
    isMelee: false,
    isBurstFire: false,
    burstCount: 1,
    burstDelay: 0,
    hasShield: false,
    shieldBlockChance: 0,
    isStealth: true,
    stealthRevealDuration: 2.0,
    chargeSpeed: 0,
    chargeTelegraphDuration: 0,
    dashSpeed: 0,
    dashDuration: 0,
  },
};

// ---------------------------------------------------------------------------
// Default Muzzle Position
// ---------------------------------------------------------------------------

/**
 * Default muzzle local position for enemies without a stored muzzle.
 * Positioned in front of the enemy at weapon height.
 */
const DEFAULT_MUZZLE_LOCAL_POSITION = new THREE.Vector3(0, 0.5, 0.8);

// ---------------------------------------------------------------------------
// Visual Builders
// ---------------------------------------------------------------------------

/**
 * Builds the procedural 3D model for the given enemy type.
 *
 * The returned group is positioned at the origin (y=0 at ground level)
 * and is ready to be added to the scene. The group's userData contains
 * animation references:
 *   - Scout Drone: userData.rotors (array of rotor blade groups)
 *   - Sentry MK-I: userData.muzzleLocalPosition (rifle muzzle position)
 *   - Sentry MK-II: userData.muzzleLocalPosition (SMG muzzle position)
 *   - Brute: userData.core (glowing core mesh)
 *   - Reaper: userData.scytheArm (scythe arm group)
 *   - Warden: userData.shield (shield mesh), userData.muzzleLocalPosition
 *   - Phantom: userData.core (glowing core mesh), userData.bodyMaterials (for stealth opacity)
 *
 * @param typeId - The enemy type to build the visual for
 * @returns A THREE.Group containing the complete enemy model
 */
export function buildEnemyVisual(typeId: EnemyTypeId): THREE.Group {
  const group = new THREE.Group();

  switch (typeId) {
    case 'scout_drone':
      buildScoutDroneVisual(group);
      break;
    case 'sentry_mk1':
      buildSentryMK1Visual(group);
      break;
    case 'sentry_mk2':
      buildSentryMK2Visual(group);
      break;
    case 'brute':
      buildBruteVisual(group);
      break;
    case 'reaper':
      buildReaperVisual(group);
      break;
    case 'warden':
      buildWardenVisual(group);
      break;
    case 'phantom':
      buildPhantomVisual(group);
      break;
    default:
      // Fallback to scout drone for unknown types
      buildScoutDroneVisual(group);
      break;
  }

  // Apply the body scale from the config
  const config = ENEMY_TYPES[typeId];
  group.scale.setScalar(config.bodyScale);

  return group;
}

/**
 * Builds the Scout Drone visual model.
 *
 * A small grey quadcopter with:
 *   - Dark grey central body
 *   - 4 rotor arms with spinning blade groups (stored in userData.rotors)
 *   - Red sensor eye (emissive sphere)
 *   - Cyan thruster glow (emissive cylinder underneath)
 *
 * @param group - The root group to add meshes to
 */
function buildScoutDroneVisual(group: THREE.Group): void {
  // --- Materials ---
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a4048,
    metalness: 0.8,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.7,
    roughness: 0.5,
  });

  const redEyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0xff4444,
    emissiveIntensity: 2.5,
    roughness: 0.3,
    metalness: 0.1,
  });

  const cyanGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  // --- Central Body ---
  const bodyGeometry = new THREE.BoxGeometry(0.7, 0.3, 0.7);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.35;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- Red Sensor Eye (front) ---
  const eyeGeometry = new THREE.SphereGeometry(0.12, 12, 12);
  const eye = new THREE.Mesh(eyeGeometry, redEyeMaterial);
  eye.position.set(0, 0.4, 0.36);
  group.add(eye);

  // --- Cyan Thruster Glow (underneath) ---
  const thrusterGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12);
  const thruster = new THREE.Mesh(thrusterGeometry, cyanGlowMaterial);
  thruster.position.y = 0.04;
  group.add(thruster);

  // --- Rotor Arms ---
  const armMaterial = darkMetalMaterial;

  // Arm positions (diagonal from body corners)
  const armPositions = [
    new THREE.Vector3(-0.45, 0.35, -0.45),
    new THREE.Vector3(0.45, 0.35, -0.45),
    new THREE.Vector3(-0.45, 0.35, 0.45),
    new THREE.Vector3(0.45, 0.35, 0.45),
  ];

  // Arm angles (pointing outward diagonally)
  const armAngles = [
    Math.PI * 0.75, // Back-left
    Math.PI * 0.25, // Back-right
    -Math.PI * 0.75, // Front-left
    -Math.PI * 0.25, // Front-right
  ];

  // Store rotor blade groups for animation
  const rotors: THREE.Group[] = [];

  for (let i = 0; i < 4; i++) {
    // Arm cylinder
    const armGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.copy(armPositions[i]);
    arm.rotation.y = armAngles[i];
    arm.castShadow = true;
    group.add(arm);

    // Rotor hub
    const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12);
    const hub = new THREE.Mesh(hubGeometry, armMaterial);
    hub.position.copy(armPositions[i]);
    hub.position.y += 0.03;
    hub.castShadow = true;
    group.add(hub);

    // Rotor blade group (for spinning animation)
    const bladeGroup = new THREE.Group();
    bladeGroup.position.copy(armPositions[i]);
    bladeGroup.position.y += 0.06;

    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5058,
      metalness: 0.5,
      roughness: 0.6,
    });

    // Two crossed blades
    const blade1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.015, 0.06),
      bladeMaterial
    );
    blade1.position.x = 0.12;
    blade1.castShadow = true;
    bladeGroup.add(blade1);

    const blade2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.015, 0.06),
      bladeMaterial
    );
    blade2.position.x = -0.12;
    blade2.castShadow = true;
    bladeGroup.add(blade2);

    group.add(bladeGroup);
    rotors.push(bladeGroup);
  }

  // Store rotors in userData for animation
  group.userData.rotors = rotors;
}

/**
 * Builds the Sentry MK-I visual model.
 *
 * A medium green humanoid mech with:
 *   - Box torso with green metal material
 *   - Head with glowing green visor (emissive box)
 *   - Shoulder armor plates
 *   - Arms holding a rifle (green box + barrel cylinder)
 *   - Legs
 *
 * The rifle muzzle local position is stored in userData.muzzleLocalPosition.
 *
 * @param group - The root group to add meshes to
 */
function buildSentryMK1Visual(group: THREE.Group): void {
  // --- Materials ---
  const greenMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a5a3a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.8,
    roughness: 0.5,
  });

  const greenGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff66,
    emissive: 0x00ff66,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  // --- Torso ---
  const torsoGeometry = new THREE.BoxGeometry(0.8, 0.9, 0.5);
  const torso = new THREE.Mesh(torsoGeometry, greenMetalMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Chest Detail (dark panel) ---
  const chestPanelGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.06);
  const chestPanel = new THREE.Mesh(chestPanelGeometry, darkMetalMaterial);
  chestPanel.position.set(0, 1.2, 0.26);
  chestPanel.castShadow = true;
  group.add(chestPanel);

  // --- Head ---
  const headGeometry = new THREE.BoxGeometry(0.4, 0.35, 0.4);
  const head = new THREE.Mesh(headGeometry, greenMetalMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // --- Glowing Green Visor ---
  const visorGeometry = new THREE.BoxGeometry(0.3, 0.08, 0.05);
  const visor = new THREE.Mesh(visorGeometry, greenGlowMaterial);
  visor.position.set(0, 1.82, 0.21);
  group.add(visor);

  // --- Shoulder Armor Plates ---
  const shoulderGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.4);
  const shoulderMaterial = darkMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.55, 1.5, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.55, 1.5, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Arms ---
  const armGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.2);

  // Left arm (holding rifle)
  const leftArm = new THREE.Mesh(armGeometry, greenMetalMaterial);
  leftArm.position.set(-0.5, 0.9, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  // Right arm (supporting rifle)
  const rightArm = new THREE.Mesh(armGeometry, greenMetalMaterial);
  rightArm.position.set(0.5, 0.9, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // --- Rifle ---
  const rifleGroup = new THREE.Group();

  // Rifle body (green box)
  const rifleBodyGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.6);
  const rifleBody = new THREE.Mesh(rifleBodyGeometry, greenMetalMaterial);
  rifleBody.position.set(0, 0, 0.2);
  rifleBody.castShadow = true;
  rifleGroup.add(rifleBody);

  // Rifle barrel (dark cylinder)
  const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
  const barrel = new THREE.Mesh(barrelGeometry, darkMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.7);
  barrel.castShadow = true;
  rifleGroup.add(barrel);

  // Rifle muzzle (green glow ring)
  const muzzleRingGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
  const muzzleRing = new THREE.Mesh(muzzleRingGeometry, greenGlowMaterial);
  muzzleRing.rotation.y = Math.PI / 2;
  muzzleRing.position.set(0, 0, 0.9);
  rifleGroup.add(muzzleRing);

  // Rifle stock (rear)
  const stockGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.15);
  const stock = new THREE.Mesh(stockGeometry, darkMetalMaterial);
  stock.position.set(0, 0, -0.2);
  stock.castShadow = true;
  rifleGroup.add(stock);

  // Position the rifle in front of the mech, held by both arms
  rifleGroup.position.set(0, 1.0, 0.45);
  group.add(rifleGroup);

  // Store the rifle muzzle local position (relative to the enemy group)
  group.userData.muzzleLocalPosition = new THREE.Vector3(0, 1.0, 1.35);

  // --- Legs ---
  const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.3);

  const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  leftLeg.position.set(-0.25, 0.4, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  rightLeg.position.set(0.25, 0.4, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet ---
  const footGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.4);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.25, 0.05, 0.05);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.25, 0.05, 0.05);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);
}

/**
 * Builds the Sentry MK-II visual model.
 *
 * A medium orange humanoid mech with:
 *   - Box torso with orange metal material
 *   - Head with glowing orange visor (emissive box)
 *   - Shoulder armor plates
 *   - Arms holding an SMG (orange box + short barrel)
 *   - Legs
 *
 * The SMG muzzle local position is stored in userData.muzzleLocalPosition.
 *
 * @param group - The root group to add meshes to
 */
function buildSentryMK2Visual(group: THREE.Group): void {
  // --- Materials ---
  const orangeMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a4a1a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.8,
    roughness: 0.5,
  });

  const orangeGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    emissive: 0xff8800,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  // --- Torso ---
  const torsoGeometry = new THREE.BoxGeometry(0.8, 0.9, 0.5);
  const torso = new THREE.Mesh(torsoGeometry, orangeMetalMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Chest Detail (dark panel) ---
  const chestPanelGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.06);
  const chestPanel = new THREE.Mesh(chestPanelGeometry, darkMetalMaterial);
  chestPanel.position.set(0, 1.2, 0.26);
  chestPanel.castShadow = true;
  group.add(chestPanel);

  // --- Head ---
  const headGeometry = new THREE.BoxGeometry(0.4, 0.35, 0.4);
  const head = new THREE.Mesh(headGeometry, orangeMetalMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // --- Glowing Orange Visor ---
  const visorGeometry = new THREE.BoxGeometry(0.3, 0.08, 0.05);
  const visor = new THREE.Mesh(visorGeometry, orangeGlowMaterial);
  visor.position.set(0, 1.82, 0.21);
  group.add(visor);

  // --- Shoulder Armor Plates ---
  const shoulderGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.4);
  const shoulderMaterial = darkMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.55, 1.5, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.55, 1.5, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Arms ---
  const armGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.2);

  // Left arm (holding SMG)
  const leftArm = new THREE.Mesh(armGeometry, orangeMetalMaterial);
  leftArm.position.set(-0.5, 0.9, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  // Right arm (supporting SMG)
  const rightArm = new THREE.Mesh(armGeometry, orangeMetalMaterial);
  rightArm.position.set(0.5, 0.9, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // --- SMG ---
  const smgGroup = new THREE.Group();

  // SMG body (orange box, compact)
  const smgBodyGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.4);
  const smgBody = new THREE.Mesh(smgBodyGeometry, orangeMetalMaterial);
  smgBody.position.set(0, 0, 0.15);
  smgBody.castShadow = true;
  smgGroup.add(smgBody);

  // SMG barrel (dark cylinder, short)
  const barrelGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8);
  const barrel = new THREE.Mesh(barrelGeometry, darkMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.5);
  barrel.castShadow = true;
  smgGroup.add(barrel);

  // SMG muzzle (orange glow ring)
  const muzzleRingGeometry = new THREE.TorusGeometry(0.035, 0.008, 8, 16);
  const muzzleRing = new THREE.Mesh(muzzleRingGeometry, orangeGlowMaterial);
  muzzleRing.rotation.y = Math.PI / 2;
  muzzleRing.position.set(0, 0, 0.65);
  smgGroup.add(muzzleRing);

  // SMG magazine (dark box underneath)
  const magazineGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.1);
  const magazine = new THREE.Mesh(magazineGeometry, darkMetalMaterial);
  magazine.position.set(0, -0.12, 0.1);
  magazine.castShadow = true;
  smgGroup.add(magazine);

  // Position the SMG in front of the mech, held by both arms
  smgGroup.position.set(0, 1.0, 0.4);
  group.add(smgGroup);

  // Store the SMG muzzle local position (relative to the enemy group)
  group.userData.muzzleLocalPosition = new THREE.Vector3(0, 1.0, 1.05);

  // --- Legs ---
  const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.3);

  const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  leftLeg.position.set(-0.25, 0.4, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  rightLeg.position.set(0.25, 0.4, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet ---
  const footGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.4);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.25, 0.05, 0.05);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.25, 0.05, 0.05);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);
}

/**
 * Builds the Brute visual model.
 *
 * A large red heavy mech with:
 *   - Massive box torso with red metal material
 *   - Glowing red core (emissive sphere, stored in userData.core)
 *   - Small head with glowing red visor
 *   - Massive fists (large boxes)
 *   - Heavy legs
 *
 * @param group - The root group to add meshes to
 */
function buildBruteVisual(group: THREE.Group): void {
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
    emissiveIntensity: 2.5,
    roughness: 0.3,
    metalness: 0.1,
  });

  const redGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  // --- Legs (heavy) ---
  const legGeometry = new THREE.BoxGeometry(0.5, 1.0, 0.6);

  const leftLeg = new THREE.Mesh(legGeometry, darkRedMetalMaterial);
  leftLeg.position.set(-0.5, 0.5, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkRedMetalMaterial);
  rightLeg.position.set(0.5, 0.5, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet (heavy) ---
  const footGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.5, 0.1, 0.1);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.5, 0.1, 0.1);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);

  // --- Torso (massive) ---
  const torsoGeometry = new THREE.BoxGeometry(1.4, 1.2, 0.9);
  const torso = new THREE.Mesh(torsoGeometry, redMetalMaterial);
  torso.position.y = 1.5;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Glowing Red Core (chest) ---
  const coreGeometry = new THREE.SphereGeometry(0.25, 16, 16);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.set(0, 1.6, 0.5);
  group.add(core);

  // Store core in userData for animation
  group.userData.core = core;

  // --- Core Ring (glowing ring around the core) ---
  const coreRingGeometry = new THREE.TorusGeometry(0.35, 0.04, 8, 24);
  const coreRing = new THREE.Mesh(coreRingGeometry, redGlowMaterial);
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.set(0, 1.6, 0.5);
  group.add(coreRing);

  // --- Head (small, menacing) ---
  const headGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.5);
  const head = new THREE.Mesh(headGeometry, redMetalMaterial);
  head.position.y = 2.4;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // --- Glowing Red Visor ---
  const visorGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.06);
  const visor = new THREE.Mesh(visorGeometry, redGlowMaterial);
  visor.position.set(0, 2.45, 0.26);
  group.add(visor);

  // --- Shoulder Armor (massive) ---
  const shoulderGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.6);
  const shoulderMaterial = darkRedMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.9, 2.0, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.9, 2.0, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Arms (thick) ---
  const armGeometry = new THREE.BoxGeometry(0.35, 1.0, 0.4);

  const leftArm = new THREE.Mesh(armGeometry, redMetalMaterial);
  leftArm.position.set(-0.85, 1.2, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, redMetalMaterial);
  rightArm.position.set(0.85, 1.2, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // --- Massive Fists ---
  const fistGeometry = new THREE.BoxGeometry(0.5, 0.35, 0.5);

  const leftFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
  leftFist.position.set(-0.85, 0.6, 0);
  leftFist.castShadow = true;
  group.add(leftFist);

  const rightFist = new THREE.Mesh(fistGeometry, darkMetalMaterial);
  rightFist.position.set(0.85, 0.6, 0);
  rightFist.castShadow = true;
  group.add(rightFist);
}

/**
 * Builds the Reaper visual model.
 *
 * A medium black mech with:
 *   - Slim box torso with black metal material
 *   - Glowing red eye (emissive sphere)
 *   - Scythe arm (group stored in userData.scytheArm)
 *   - Normal arm
 *   - Legs
 *
 * @param group - The root group to add meshes to
 */
function buildReaperVisual(group: THREE.Group): void {
  // --- Materials ---
  const blackMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.8,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.8,
    roughness: 0.5,
  });

  const redEyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 3.0,
    roughness: 0.2,
    metalness: 0.1,
  });

  const redGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0xff2200,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  // --- Torso (slim) ---
  const torsoGeometry = new THREE.BoxGeometry(0.6, 0.9, 0.4);
  const torso = new THREE.Mesh(torsoGeometry, blackMetalMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Chest Detail (dark panel) ---
  const chestPanelGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.05);
  const chestPanel = new THREE.Mesh(chestPanelGeometry, darkMetalMaterial);
  chestPanel.position.set(0, 1.2, 0.21);
  chestPanel.castShadow = true;
  group.add(chestPanel);

  // --- Head (angular) ---
  const headGeometry = new THREE.BoxGeometry(0.35, 0.3, 0.35);
  const head = new THREE.Mesh(headGeometry, blackMetalMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // --- Glowing Red Eye (single, menacing) ---
  const eyeGeometry = new THREE.SphereGeometry(0.08, 12, 12);
  const eye = new THREE.Mesh(eyeGeometry, redEyeMaterial);
  eye.position.set(0, 1.82, 0.19);
  group.add(eye);

  // --- Shoulder Armor (angular) ---
  const shoulderGeometry = new THREE.BoxGeometry(0.3, 0.12, 0.35);
  const shoulderMaterial = darkMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.45, 1.5, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.45, 1.5, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Normal Arm (right side) ---
  const armGeometry = new THREE.BoxGeometry(0.15, 0.7, 0.15);

  const rightArm = new THREE.Mesh(armGeometry, blackMetalMaterial);
  rightArm.position.set(0.4, 0.9, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // --- Scythe Arm (left side) ---
  const scytheArmGroup = new THREE.Group();
  scytheArmGroup.position.set(-0.4, 0.9, 0);

  // Arm segment
  const scytheArmSegment = new THREE.Mesh(armGeometry, blackMetalMaterial);
  scytheArmSegment.castShadow = true;
  scytheArmGroup.add(scytheArmSegment);

  // Scythe blade (curved glowing blade)
  const bladeGeometry = new THREE.BoxGeometry(0.08, 0.6, 0.03);
  const blade = new THREE.Mesh(bladeGeometry, redGlowMaterial);
  blade.position.set(0, 0.35, 0);
  blade.rotation.z = 0.3;
  blade.castShadow = true;
  scytheArmGroup.add(blade);

  // Scythe tip (glowing point)
  const tipGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const tip = new THREE.Mesh(tipGeometry, redEyeMaterial);
  tip.position.set(0.05, 0.65, 0);
  scytheArmGroup.add(tip);

  group.add(scytheArmGroup);

  // Store scythe arm in userData for animation
  group.userData.scytheArm = scytheArmGroup;

  // --- Legs (slim) ---
  const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.25);

  const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet ---
  const footGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.35);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.2, 0.04, 0.05);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.2, 0.04, 0.05);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);
}

/**
 * Builds the Warden visual model.
 *
 * A large blue shield mech with:
 *   - Box torso with blue metal material
 *   - Head with glowing blue visor (emissive box)
 *   - Large energy shield on one arm (stored in userData.shield)
 *   - Rifle in the other arm
 *   - Heavy legs
 *
 * The rifle muzzle local position is stored in userData.muzzleLocalPosition.
 *
 * @param group - The root group to add meshes to
 */
function buildWardenVisual(group: THREE.Group): void {
  // --- Materials ---
  const blueMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.8,
    roughness: 0.5,
  });

  const blueGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 2.0,
    roughness: 0.3,
    metalness: 0.1,
  });

  const shieldMaterial = new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: 0x0088ff,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.7,
    roughness: 0.2,
    metalness: 0.3,
  });

  // --- Legs (heavy) ---
  const legGeometry = new THREE.BoxGeometry(0.4, 0.9, 0.5);

  const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  leftLeg.position.set(-0.4, 0.45, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  rightLeg.position.set(0.4, 0.45, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet ---
  const footGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.6);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.4, 0.08, 0.1);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.4, 0.08, 0.1);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);

  // --- Torso ---
  const torsoGeometry = new THREE.BoxGeometry(1.0, 1.1, 0.7);
  const torso = new THREE.Mesh(torsoGeometry, blueMetalMaterial);
  torso.position.y = 1.4;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Chest Detail (dark panel) ---
  const chestPanelGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.06);
  const chestPanel = new THREE.Mesh(chestPanelGeometry, darkMetalMaterial);
  chestPanel.position.set(0, 1.5, 0.36);
  chestPanel.castShadow = true;
  group.add(chestPanel);

  // --- Head ---
  const headGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.5);
  const head = new THREE.Mesh(headGeometry, blueMetalMaterial);
  head.position.y = 2.2;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  // --- Glowing Blue Visor ---
  const visorGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.06);
  const visor = new THREE.Mesh(visorGeometry, blueGlowMaterial);
  visor.position.set(0, 2.25, 0.26);
  group.add(visor);

  // --- Shoulder Armor ---
  const shoulderGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.5);
  const shoulderMaterial = darkMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.65, 1.8, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.65, 1.8, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Left Arm (shield arm) ---
  const armGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);

  const leftArm = new THREE.Mesh(armGeometry, blueMetalMaterial);
  leftArm.position.set(-0.6, 1.1, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  // --- Large Energy Shield (on left arm) ---
  const shieldGeometry = new THREE.BoxGeometry(0.1, 1.2, 0.8);
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.position.set(-0.6, 1.2, 0.3);
  shield.castShadow = true;
  group.add(shield);

  // Shield edge glow (blue)
  const shieldEdgeGeometry = new THREE.BoxGeometry(0.12, 1.2, 0.8);
  const shieldEdge = new THREE.Mesh(shieldEdgeGeometry, blueGlowMaterial);
  shieldEdge.position.set(-0.6, 1.2, 0.3);
  shieldEdge.castShadow = true;
  group.add(shieldEdge);

  // Store shield in userData for animation
  group.userData.shield = shield;

  // --- Right Arm (rifle arm) ---
  const rightArm = new THREE.Mesh(armGeometry, blueMetalMaterial);
  rightArm.position.set(0.6, 1.1, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // --- Rifle ---
  const rifleGroup = new THREE.Group();

  // Rifle body (blue box)
  const rifleBodyGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.6);
  const rifleBody = new THREE.Mesh(rifleBodyGeometry, blueMetalMaterial);
  rifleBody.position.set(0, 0, 0.2);
  rifleBody.castShadow = true;
  rifleGroup.add(rifleBody);

  // Rifle barrel (dark cylinder)
  const barrelGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8);
  const barrel = new THREE.Mesh(barrelGeometry, darkMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.7);
  barrel.castShadow = true;
  rifleGroup.add(barrel);

  // Rifle muzzle (blue glow ring)
  const muzzleRingGeometry = new THREE.TorusGeometry(0.045, 0.01, 8, 16);
  const muzzleRing = new THREE.Mesh(muzzleRingGeometry, blueGlowMaterial);
  muzzleRing.rotation.y = Math.PI / 2;
  muzzleRing.position.set(0, 0, 0.9);
  rifleGroup.add(muzzleRing);

  // Rifle stock (rear)
  const stockGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.15);
  const stock = new THREE.Mesh(stockGeometry, darkMetalMaterial);
  stock.position.set(0, 0, -0.2);
  stock.castShadow = true;
  rifleGroup.add(stock);

  // Position the rifle in front of the mech, held by the right arm
  rifleGroup.position.set(0.6, 1.2, 0.45);
  group.add(rifleGroup);

  // Store the rifle muzzle local position (relative to the enemy group)
  group.userData.muzzleLocalPosition = new THREE.Vector3(0.6, 1.2, 1.35);
}

/**
 * Builds the Phantom visual model.
 *
 * A medium purple stealth mech with:
 *   - Box torso with purple metal material
 *   - Glowing purple core (emissive sphere, stored in userData.core)
 *   - Head with glowing purple visor
 *   - Arms holding a plasma rifle
 *   - Legs
 *
 * The plasma rifle muzzle local position is stored in userData.muzzleLocalPosition.
 * Body materials are stored in userData.bodyMaterials for stealth opacity control.
 *
 * @param group - The root group to add meshes to
 */
function buildPhantomVisual(group: THREE.Group): void {
  // --- Materials ---
  const purpleMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1a6a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    metalness: 0.8,
    roughness: 0.5,
  });

  const purpleGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xaa00ff,
    emissive: 0xaa00ff,
    emissiveIntensity: 2.5,
    roughness: 0.3,
    metalness: 0.1,
  });

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xaa00ff,
    emissive: 0xaa00ff,
    emissiveIntensity: 2.5,
    roughness: 0.3,
    metalness: 0.1,
  });

  // Store body materials for stealth opacity control
  const bodyMaterials: THREE.MeshStandardMaterial[] = [];

  // --- Torso ---
  const torsoGeometry = new THREE.BoxGeometry(0.7, 0.9, 0.45);
  const torso = new THREE.Mesh(torsoGeometry, purpleMetalMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);
  bodyMaterials.push(purpleMetalMaterial);

  // --- Glowing Purple Core (chest) ---
  const coreGeometry = new THREE.SphereGeometry(0.15, 12, 12);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.set(0, 1.2, 0.24);
  group.add(core);

  // Store core in userData for animation
  group.userData.core = core;

  // --- Head ---
  const headGeometry = new THREE.BoxGeometry(0.35, 0.3, 0.35);
  const head = new THREE.Mesh(headGeometry, purpleMetalMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);
  bodyMaterials.push(purpleMetalMaterial);

  // --- Glowing Purple Visor ---
  const visorGeometry = new THREE.BoxGeometry(0.25, 0.07, 0.05);
  const visor = new THREE.Mesh(visorGeometry, purpleGlowMaterial);
  visor.position.set(0, 1.82, 0.19);
  group.add(visor);

  // --- Shoulder Armor ---
  const shoulderGeometry = new THREE.BoxGeometry(0.3, 0.12, 0.35);
  const shoulderMaterial = darkMetalMaterial;

  const leftShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  leftShoulder.position.set(-0.45, 1.5, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
  rightShoulder.position.set(0.45, 1.5, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // --- Arms ---
  const armGeometry = new THREE.BoxGeometry(0.18, 0.7, 0.18);

  // Left arm (holding plasma rifle)
  const leftArm = new THREE.Mesh(armGeometry, purpleMetalMaterial);
  leftArm.position.set(-0.4, 0.9, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  bodyMaterials.push(purpleMetalMaterial);

  // Right arm (supporting plasma rifle)
  const rightArm = new THREE.Mesh(armGeometry, purpleMetalMaterial);
  rightArm.position.set(0.4, 0.9, 0);
  rightArm.castShadow = true;
  group.add(rightArm);
  bodyMaterials.push(purpleMetalMaterial);

  // --- Plasma Rifle ---
  const rifleGroup = new THREE.Group();

  // Rifle body (purple box)
  const rifleBodyGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.5);
  const rifleBody = new THREE.Mesh(rifleBodyGeometry, purpleMetalMaterial);
  rifleBody.position.set(0, 0, 0.15);
  rifleBody.castShadow = true;
  rifleGroup.add(rifleBody);

  // Rifle barrel (dark cylinder)
  const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
  const barrel = new THREE.Mesh(barrelGeometry, darkMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.55);
  barrel.castShadow = true;
  rifleGroup.add(barrel);

  // Rifle muzzle (purple glow ring)
  const muzzleRingGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
  const muzzleRing = new THREE.Mesh(muzzleRingGeometry, purpleGlowMaterial);
  muzzleRing.rotation.y = Math.PI / 2;
  muzzleRing.position.set(0, 0, 0.75);
  rifleGroup.add(muzzleRing);

  // Rifle stock (rear)
  const stockGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.12);
  const stock = new THREE.Mesh(stockGeometry, darkMetalMaterial);
  stock.position.set(0, 0, -0.15);
  stock.castShadow = true;
  rifleGroup.add(stock);

  // Position the rifle in front of the mech, held by both arms
  rifleGroup.position.set(0, 1.0, 0.4);
  group.add(rifleGroup);

  // Store the rifle muzzle local position (relative to the enemy group)
  group.userData.muzzleLocalPosition = new THREE.Vector3(0, 1.0, 1.15);

  // --- Legs ---
  const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.25);

  const leftLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, darkMetalMaterial);
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  group.add(rightLeg);

  // --- Feet ---
  const footGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.35);

  const leftFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  leftFoot.position.set(-0.2, 0.04, 0.05);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeometry, darkMetalMaterial);
  rightFoot.position.set(0.2, 0.04, 0.05);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);

  // Store body materials in userData for stealth opacity control
  group.userData.bodyMaterials = bodyMaterials;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Gets the muzzle local position for an enemy visual group.
 *
 * Reads the stored muzzle position from the group's userData. If not
 * present, returns a default position in front of the enemy at weapon
 * height.
 *
 * @param group - The enemy visual group (from buildEnemyVisual)
 * @returns The muzzle position in local space (relative to the group)
 */
export function getMuzzleLocalPosition(group: THREE.Group): THREE.Vector3 {
  const stored = group.userData.muzzleLocalPosition;
  if (stored instanceof THREE.Vector3) {
    return stored.clone();
  }
  return DEFAULT_MUZZLE_LOCAL_POSITION.clone();
}