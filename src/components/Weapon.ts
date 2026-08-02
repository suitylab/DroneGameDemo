import * as THREE from 'three';
import type { WeaponConfig } from './WeaponConfigs';

/**
 * Weapon
 *
 * Manages the runtime state of a weapon (magazine ammo, reserve ammo,
 * fire cooldown) and builds distinct procedural 3D models for all 6
 * weapon types in the MAZE STRIKE game.
 *
 * Each weapon model is oriented with the barrel pointing in the +Z
 * direction and positioned at y=0.1 (underneath the drone body).
 * The muzzle world position varies per weapon type and is used for
 * bullet spawning.
 */
export default class Weapon {
  /** The weapon configuration (static stats) */
  private config: WeaponConfig;

  /** Current ammo in the magazine */
  private magazineAmmo: number;

  /** Current reserve ammo (not in magazine) */
  private reserveAmmo: number;

  /** Time remaining until the next shot can be fired (seconds) */
  private fireCooldown: number = 0;

  /** The THREE.Group containing all weapon meshes */
  private group: THREE.Group = new THREE.Group();

  /** Reference to the scene for cleanup */
  private scene: THREE.Scene;

  /** Local muzzle position (relative to weapon group) */
  private muzzleLocalPosition: THREE.Vector3 = new THREE.Vector3(0, 0.08, 0.5);

  /**
   * Creates a new Weapon instance.
   * @param scene - The THREE.Scene to add the weapon mesh to
   * @param config - The weapon configuration
   */
  constructor(scene: THREE.Scene, config: WeaponConfig) {
    this.scene = scene;
    this.config = config;
    this.magazineAmmo = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;

    // Build the visual representation
    this.buildVisual();

    // Position the weapon underneath the drone body
    this.group.position.y = 0.1;

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Builds the weapon's visual representation based on its type.
   * Each weapon has a distinct procedural 3D model.
   */
  private buildVisual(): void {
    switch (this.config.id) {
      case 'm9_sidearm':
        this.buildM9Sidearm();
        break;
      case 'viper_smg':
        this.buildViperSMG();
        break;
      case 'titan_shotgun':
        this.buildTitanShotgun();
        break;
      case 'longbow_rifle':
        this.buildLongbowRifle();
        break;
      case 'pulsar_plasma':
        this.buildPulsarPlasma();
        break;
      case 'havoc_rocket':
        this.buildHavocRocket();
        break;
      default:
        // Fallback to M9 model for unknown types
        this.buildM9Sidearm();
        break;
    }
  }

  /**
   * Builds the M9 Sidearm model.
   * Small silver pistol with orange glow accents.
   */
  private buildM9Sidearm(): void {
    // --- Materials ---
    const silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c8d0,
      metalness: 0.9,
      roughness: 0.3,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.5,
    });

    const gripMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.6,
      roughness: 0.7,
    });

    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Slide / Body ---
    const slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.5),
      silverMaterial
    );
    slide.position.set(0, 0.08, 0.05);
    slide.castShadow = true;
    this.group.add(slide);

    // --- Barrel ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.4);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Muzzle ---
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12),
      darkMetalMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.08, 0.5);
    this.group.add(muzzle);

    // --- Grip ---
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 0.14),
      gripMaterial
    );
    grip.position.set(0, -0.06, -0.15);
    grip.rotation.x = 0.15;
    grip.castShadow = true;
    this.group.add(grip);

    // --- Trigger Guard ---
    const guard = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI),
      darkMetalMaterial
    );
    guard.rotation.y = Math.PI / 2;
    guard.rotation.z = Math.PI;
    guard.position.set(0, 0.02, -0.05);
    this.group.add(guard);

    // --- Orange Glow Accents ---
    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.01, 0.3),
      glowMaterial
    );
    glowStrip.position.set(0, 0.13, 0.05);
    this.group.add(glowStrip);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.008, 8, 16),
      glowMaterial
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.35);
    this.group.add(glowRing);

    const glowDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      glowMaterial
    );
    glowDot.position.set(0, -0.02, -0.22);
    this.group.add(glowDot);

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.08, 0.55);
  }

  /**
   * Builds the Viper SMG model.
   * Compact black SMG with cyan accents.
   */
  private buildViperSMG(): void {
    // --- Materials ---
    const blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.8,
      roughness: 0.4,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.7,
      roughness: 0.5,
    });

    const cyanGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Main Body (compact) ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.1, 0.55),
      blackMaterial
    );
    body.position.set(0, 0.08, 0.05);
    body.castShadow = true;
    this.group.add(body);

    // --- Barrel (shorter, wider) ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.25, 12),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.45);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Muzzle Brake ---
    const muzzleBrake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12),
      darkMetalMaterial
    );
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.08, 0.6);
    this.group.add(muzzleBrake);

    // --- Magazine (curved box) ---
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.18, 0.12),
      darkMetalMaterial
    );
    magazine.position.set(0, -0.05, -0.1);
    magazine.rotation.x = 0.2;
    magazine.castShadow = true;
    this.group.add(magazine);

    // --- Stock (rear) ---
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.2),
      blackMaterial
    );
    stock.position.set(0, 0.06, -0.3);
    stock.castShadow = true;
    this.group.add(stock);

    // --- Cyan Glow Accents ---
    // Glow strip along the top
    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.01, 0.4),
      cyanGlowMaterial
    );
    glowStrip.position.set(0, 0.14, 0.05);
    this.group.add(glowStrip);

    // Glow ring around the barrel
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.008, 8, 16),
      cyanGlowMaterial
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.5);
    this.group.add(glowRing);

    // Glow dots on the side
    for (let i = 0; i < 3; i++) {
      const glowDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        cyanGlowMaterial
      );
      glowDot.position.set(0.13, 0.08, -0.1 + i * 0.12);
      this.group.add(glowDot);
    }

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.08, 0.65);
  }

  /**
   * Builds the Titan Shotgun model.
   * Heavy shotgun with red hazard stripes.
   */
  private buildTitanShotgun(): void {
    // --- Materials ---
    const heavyMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.8,
      roughness: 0.5,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.7,
      roughness: 0.6,
    });

    const redGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    const hazardMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      emissiveIntensity: 1.5,
      roughness: 0.4,
      metalness: 0.3,
    });

    // --- Main Body (heavy, wide) ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.6),
      heavyMetalMaterial
    );
    body.position.set(0, 0.1, 0.05);
    body.castShadow = true;
    this.group.add(body);

    // --- Pump (under barrel) ---
    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.1, 0.3),
      darkMetalMaterial
    );
    pump.position.set(0, 0.02, 0.35);
    pump.castShadow = true;
    this.group.add(pump);

    // --- Barrel (thick, long) ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, 0.6);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Muzzle (wide) ---
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16),
      darkMetalMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.12, 0.85);
    this.group.add(muzzle);

    // --- Stock (rear, heavy) ---
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.12, 0.25),
      heavyMetalMaterial
    );
    stock.position.set(0, 0.08, -0.35);
    stock.castShadow = true;
    this.group.add(stock);

    // --- Red Hazard Stripes (on body) ---
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.02, 0.04),
        hazardMaterial
      );
      stripe.position.set(0, 0.1, -0.05 + i * 0.12);
      this.group.add(stripe);
    }

    // --- Red Glow Accents ---
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.01, 8, 16),
      redGlowMaterial
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.12, 0.75);
    this.group.add(glowRing);

    const glowDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 8),
      redGlowMaterial
    );
    glowDot.position.set(0, 0.05, 0.2);
    this.group.add(glowDot);

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.12, 0.9);
  }

  /**
   * Builds the Longbow Rifle model.
   * Long green rifle with scope.
   */
  private buildLongbowRifle(): void {
    // --- Materials ---
    const greenMaterial = new THREE.MeshStandardMaterial({
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

    // --- Main Body (long) ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 0.8),
      greenMaterial
    );
    body.position.set(0, 0.08, 0.05);
    body.castShadow = true;
    this.group.add(body);

    // --- Barrel (long, thin) ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.65);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Muzzle ---
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12),
      darkMetalMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.08, 0.95);
    this.group.add(muzzle);

    // --- Scope (on top) ---
    const scopeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12),
      darkMetalMaterial
    );
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.16, 0.1);
    this.group.add(scopeBody);

    const scopeLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 12),
      greenGlowMaterial
    );
    scopeLens.rotation.y = Math.PI / 2;
    scopeLens.position.set(0, 0.16, 0.21);
    this.group.add(scopeLens);

    // --- Magazine (long) ---
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.15, 0.2),
      darkMetalMaterial
    );
    magazine.position.set(0, -0.04, -0.1);
    magazine.rotation.x = 0.1;
    magazine.castShadow = true;
    this.group.add(magazine);

    // --- Stock (rear) ---
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, 0.2),
      greenMaterial
    );
    stock.position.set(0, 0.06, -0.4);
    stock.castShadow = true;
    this.group.add(stock);

    // --- Green Glow Accents ---
    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.01, 0.5),
      greenGlowMaterial
    );
    glowStrip.position.set(0, 0.14, 0.2);
    this.group.add(glowStrip);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.006, 8, 16),
      greenGlowMaterial
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.8);
    this.group.add(glowRing);

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.08, 0.98);
  }

  /**
   * Builds the Pulsar Plasma model.
   * Blue energy weapon with glowing coil.
   */
  private buildPulsarPlasma(): void {
    // --- Materials ---
    const blueMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a4a6a,
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
      emissiveIntensity: 2.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Main Body ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.12, 0.6),
      blueMetalMaterial
    );
    body.position.set(0, 0.09, 0.05);
    body.castShadow = true;
    this.group.add(body);

    // --- Barrel (with coil) ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.09, 0.5);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Glowing Coil (torus stack) ---
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.012, 8, 16),
        blueGlowMaterial
      );
      coil.rotation.y = Math.PI / 2;
      coil.position.set(0, 0.09, 0.4 + i * 0.08);
      this.group.add(coil);
    }

    // --- Muzzle (energy emitter) ---
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12),
      blueGlowMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.09, 0.7);
    this.group.add(muzzle);

    // --- Energy Core (sphere in body) ---
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      blueGlowMaterial
    );
    core.position.set(0, 0.09, 0.1);
    this.group.add(core);

    // --- Stock (rear) ---
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.1, 0.2),
      blueMetalMaterial
    );
    stock.position.set(0, 0.07, -0.3);
    stock.castShadow = true;
    this.group.add(stock);

    // --- Blue Glow Accents ---
    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.01, 0.4),
      blueGlowMaterial
    );
    glowStrip.position.set(0, 0.16, 0.05);
    this.group.add(glowStrip);

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.09, 0.75);
  }

  /**
   * Builds the Havoc Rocket model.
   * Large launcher with yellow warhead.
   */
  private buildHavocRocket(): void {
    // --- Materials ---
    const oliveMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a2a,
      metalness: 0.6,
      roughness: 0.6,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.5,
    });

    const yellowGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffcc00,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Main Tube (large) ---
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.7, 16),
      oliveMaterial
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.12, 0.05);
    tube.castShadow = true;
    this.group.add(tube);

    // --- Barrel (thick) ---
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16),
      darkMetalMaterial
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, 0.6);
    barrel.castShadow = true;
    this.group.add(barrel);

    // --- Muzzle (wide) ---
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16),
      darkMetalMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.12, 0.85);
    this.group.add(muzzle);

    // --- Warhead (yellow cone at front) ---
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.2, 16),
      yellowGlowMaterial
    );
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.12, 0.95);
    this.group.add(warhead);

    // --- Grip Handle (underneath) ---
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.2),
      darkMetalMaterial
    );
    grip.position.set(0, -0.04, -0.1);
    grip.castShadow = true;
    this.group.add(grip);

    // --- Rear Stock ---
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.2),
      oliveMaterial
    );
    stock.position.set(0, 0.1, -0.35);
    stock.castShadow = true;
    this.group.add(stock);

    // --- Yellow Glow Accents ---
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.01, 8, 16),
      yellowGlowMaterial
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.12, 0.7);
    this.group.add(glowRing);

    const glowStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.01, 0.5),
      yellowGlowMaterial
    );
    glowStrip.position.set(0, 0.19, 0.05);
    this.group.add(glowStrip);

    // Muzzle local position
    this.muzzleLocalPosition = new THREE.Vector3(0, 0.12, 1.05);
  }

  /**
   * Attempts to fire the weapon.
   *
   * Checks if the fire cooldown has elapsed and if there is ammo in the
   * magazine. If both conditions are met, decrements ammo, resets the
   * cooldown, and returns true. Otherwise returns false.
   *
   * @param deltaTime - Time since last frame in seconds
   * @returns True if the weapon fired, false otherwise
   */
  public tryFire(deltaTime: number): boolean {
    // Decrement the fire cooldown
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);

    // Check if we can fire: cooldown elapsed AND ammo available
    if (this.fireCooldown <= 0 && this.magazineAmmo > 0) {
      // Fire the weapon
      this.magazineAmmo--;

      // Reset cooldown based on fire rate (RPM → seconds between shots)
      this.fireCooldown = 60 / this.config.fireRateRPM;

      return true;
    }

    return false;
  }

  /**
   * Reloads the weapon by transferring ammo from reserve to magazine.
   *
   * The magazine is filled to capacity (or as much as reserve allows).
   * Returns true if any ammo was transferred, false otherwise.
   *
   * @returns True if the weapon was reloaded, false if magazine is full or no reserve ammo
   */
  public reload(): boolean {
    // Check if reload is needed
    if (this.magazineAmmo >= this.config.magazineSize) {
      return false;
    }

    // Infinite ammo: instantly fill magazine, reserve never decreases
    if (this.config.infiniteAmmo) {
      this.magazineAmmo = this.config.magazineSize;
      return true;
    }

    // Check if reserve ammo is available
    if (this.reserveAmmo <= 0) {
      return false;
    }

    // Calculate how much ammo to transfer
    const needed = this.config.magazineSize - this.magazineAmmo;
    const transfer = Math.min(needed, this.reserveAmmo);

    // Transfer ammo
    this.magazineAmmo += transfer;
    this.reserveAmmo -= transfer;

    return true;
  }

  /**
   * Gets the formatted ammo display string.
   *
   * Format: "M9 SIDEARM — 12 / 48"
   *
   * @returns The formatted ammo display string
   */
  public getAmmoDisplay(): string {
    return `${this.config.name} — ${this.magazineAmmo} / ${this.reserveAmmo}`;
  }

  /**
   * Gets the current magazine ammo count.
   * @returns The current ammo in the magazine
   */
  public getMagazineAmmo(): number {
    return this.magazineAmmo;
  }

  /**
   * Gets the current reserve ammo count.
   * @returns The current reserve ammo
   */
  public getReserveAmmo(): number {
    return this.config.infiniteAmmo ? Infinity : this.reserveAmmo;
  }

  /**
   * Adds reserve ammo to the weapon, capped at the config's reserveAmmo max.
   * @param amount - The amount of ammo to add
   */
  public addReserveAmmo(amount: number): void {
    this.reserveAmmo = Math.min(this.config.reserveAmmo, this.reserveAmmo + amount);
  }

  /**
   * Gets the weapon configuration.
   * @returns The weapon config object
   */
  public getConfig(): WeaponConfig {
    return this.config;
  }

  /**
   * Gets the weapon's THREE.Group for positioning in the scene.
   * @returns The weapon's root group
   */
  public getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Gets the weapon's world position.
   * @returns A Vector3 of the weapon's position
   */
  public get position(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Gets the weapon's muzzle world position (for bullet spawning).
   *
   * The muzzle local position is stored per weapon type and converted
   * to world space using the group's matrixWorld. This requires the
   * group to be in the scene graph with an updated matrixWorld.
   *
   * @returns A Vector3 of the muzzle position in world space
   */
  public getMuzzleWorldPosition(): THREE.Vector3 {
    // Ensure matrixWorld is up to date
    this.group.updateMatrixWorld();

    // Convert local muzzle position to world space
    return this.muzzleLocalPosition.clone().applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Removes the weapon from the scene and disposes all geometries and materials.
   */
  public dispose(): void {
    // Remove from scene (safe even if re-parented to drone — removes from current parent)
    this.scene.remove(this.group);

    // Traverse and dispose all geometries and materials
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

    // Clear the group
    this.group.clear();
  }
}