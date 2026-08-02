/**
 * WeaponConfigs
 *
 * Central configuration module for all 6 weapons in the MAZE STRIKE game.
 * Defines the WeaponConfig interface, WeaponType union, WEAPON_IDS enum,
 * and the WEAPON_CONFIGS array containing all weapon definitions.
 *
 * Each weapon has distinct stats for damage, fire rate, magazine size,
 * reserve ammo, projectile speed, visual properties, and special behavior
 * flags for shotgun spread, rocket AoE, and plasma orb visuals.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * WeaponType
 *
 * String literal union type identifying each weapon by its unique ID.
 * Used for type-safe weapon references throughout the codebase.
 */
export type WeaponType =
  | 'm9_sidearm'
  | 'viper_smg'
  | 'titan_shotgun'
  | 'longbow_rifle'
  | 'pulsar_plasma'
  | 'havoc_rocket';

/**
 * WeaponConfig
 *
 * Complete static configuration for a weapon. All runtime state (magazine
 * ammo, reserve ammo, cooldown) is managed separately by the Weapon class.
 */
export interface WeaponConfig {
  /** Unique weapon identifier (matches WeaponType) */
  id: WeaponType;

  /** Display name shown in the HUD */
  name: string;

  /** Damage dealt per projectile hit */
  damage: number;

  /** Fire rate in rounds per minute */
  fireRateRPM: number;

  /** Maximum ammo capacity of the magazine */
  magazineSize: number;

  /** Starting reserve ammo (not in magazine) */
  reserveAmmo: number;

  /** Projectile travel speed in units per second */
  projectileSpeed: number;

  /** Hexadecimal color of the projectile tracer/glow */
  projectileColor: number;

  /** Radius of the projectile mesh in world units */
  projectileSize: number;

  /** True if the weapon fires a spread of pellets (shotgun) */
  isShotgun: boolean;

  /** True if the weapon fires rockets with area-of-effect damage */
  isRocket: boolean;

  /** True if the weapon fires glowing plasma orbs */
  isPlasma: boolean;

  /** Number of pellets fired per shot (shotgun only) */
  pelletCount: number;

  /** Spread angle in degrees for shotgun pellets */
  spreadAngle: number;

  /** Explosion radius in world units (rocket only) */
  explosionRadius: number;

  /** Time to reload in seconds */
  reloadTime: number;

  /** If true, weapon has unlimited ammo (no consumption, instant reload) */
  infiniteAmmo?: boolean;
}

// ---------------------------------------------------------------------------
// Weapon ID Enum
// ---------------------------------------------------------------------------

/**
 * WEAPON_IDS
 *
 * Enum of all weapon IDs for compile-time constant references.
 */
export enum WEAPON_IDS {
  M9_SIDEARM = 'm9_sidearm',
  VIPER_SMG = 'viper_smg',
  TITAN_SHOTGUN = 'titan_shotgun',
  LONGBOW_RIFLE = 'longbow_rifle',
  PULSAR_PLASMA = 'pulsar_plasma',
  HAVOC_ROCKET = 'havoc_rocket',
}

// ---------------------------------------------------------------------------
// Weapon Configurations
// ---------------------------------------------------------------------------

/**
 * WEAPON_CONFIGS
 *
 * Array of all 6 weapon configurations. The order in this array determines
 * the weapon slot number (index 0 = slot 1, index 5 = slot 6).
 */
export const WEAPON_CONFIGS: WeaponConfig[] = [
  // -------------------------------------------------------------------------
  // 1. M9 Sidearm — Balanced Starter Weapon
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.M9_SIDEARM,
    name: 'M9 SIDEARM',
    damage: 15,
    fireRateRPM: 300,
    magazineSize: 12,
    reserveAmmo: 48,
    projectileSpeed: 60,
    projectileColor: 0xff6600, // Orange glow
    projectileSize: 0.08,
    isShotgun: false,
    isRocket: false,
    isPlasma: false,
    pelletCount: 1,
    spreadAngle: 0,
    explosionRadius: 0,
    reloadTime: 1.5,
    infiniteAmmo: true,
  },

  // -------------------------------------------------------------------------
  // 2. Viper SMG — High Fire Rate, Low Damage
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.VIPER_SMG,
    name: 'VIPER SMG',
    damage: 10,
    fireRateRPM: 900,
    magazineSize: 30,
    reserveAmmo: 120,
    projectileSpeed: 70,
    projectileColor: 0x00ffcc, // Cyan accents
    projectileSize: 0.06,
    isShotgun: false,
    isRocket: false,
    isPlasma: false,
    pelletCount: 1,
    spreadAngle: 0,
    explosionRadius: 0,
    reloadTime: 2.0,
  },

  // -------------------------------------------------------------------------
  // 3. Titan Shotgun — Heavy Spread Damage
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.TITAN_SHOTGUN,
    name: 'TITAN SHOTGUN',
    damage: 25, // Per pellet (8 pellets = 200 max damage)
    fireRateRPM: 60,
    magazineSize: 6,
    reserveAmmo: 24,
    projectileSpeed: 50,
    projectileColor: 0xff3300, // Red hazard stripes
    projectileSize: 0.1,
    isShotgun: true,
    isRocket: false,
    isPlasma: false,
    pelletCount: 8,
    spreadAngle: 12, // Degrees of total spread
    explosionRadius: 0,
    reloadTime: 2.5,
  },

  // -------------------------------------------------------------------------
  // 4. Longbow Rifle — High Damage, High Velocity
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.LONGBOW_RIFLE,
    name: 'LONGBOW RIFLE',
    damage: 40,
    fireRateRPM: 150,
    magazineSize: 15,
    reserveAmmo: 60,
    projectileSpeed: 100,
    projectileColor: 0x00ff66, // Green
    projectileSize: 0.07,
    isShotgun: false,
    isRocket: false,
    isPlasma: false,
    pelletCount: 1,
    spreadAngle: 0,
    explosionRadius: 0,
    reloadTime: 1.8,
  },

  // -------------------------------------------------------------------------
  // 5. Pulsar Plasma — Energy Weapon with Plasma Orbs
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.PULSAR_PLASMA,
    name: 'PULSAR PLASMA',
    damage: 20,
    fireRateRPM: 400,
    magazineSize: 25,
    reserveAmmo: 100,
    projectileSpeed: 80,
    projectileColor: 0x00aaff, // Blue energy
    projectileSize: 0.15, // Larger glowing orb
    isShotgun: false,
    isRocket: false,
    isPlasma: true,
    pelletCount: 1,
    spreadAngle: 0,
    explosionRadius: 0,
    reloadTime: 2.2,
  },

  // -------------------------------------------------------------------------
  // 6. Havoc Rocket — Area-of-Effect Explosive
  // -------------------------------------------------------------------------
  {
    id: WEAPON_IDS.HAVOC_ROCKET,
    name: 'HAVOC ROCKET',
    damage: 100, // Direct hit damage (AoE damage may fall off)
    fireRateRPM: 30,
    magazineSize: 3,
    reserveAmmo: 9,
    projectileSpeed: 40,
    projectileColor: 0xffcc00, // Yellow warhead
    projectileSize: 0.25, // Large rocket
    isShotgun: false,
    isRocket: true,
    isPlasma: false,
    pelletCount: 1,
    spreadAngle: 0,
    explosionRadius: 3, // World units
    reloadTime: 3.0,
  },
];