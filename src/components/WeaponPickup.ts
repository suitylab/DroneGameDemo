import * as THREE from 'three';
import type { WeaponConfig } from './WeaponConfigs';

/**
 * WeaponPickup
 *
 * A floating holographic weapon pickup for the MAZE STRIKE game.
 * Appears on a cyan holographic pad in armory rooms. The weapon model
 * gently bobs and rotates above the pad, with a glowing outline and
 * vertical light beam for visibility.
 *
 * The pickup is collected when the drone flies over it. Once collected,
 * it is removed from the scene and marked as collected.
 */
export default class WeaponPickup {
  /** Root group containing all pickup meshes */
  private group: THREE.Group = new THREE.Group();

  /** The Three.js scene to add the pickup to */
  private scene: THREE.Scene;

  /** The weapon configuration for this pickup */
  private config: WeaponConfig;

  /** Whether the pickup has been collected */
  private collected: boolean = false;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /** Reference to the floating weapon group (for animation) */
  private weaponGroup: THREE.Group = new THREE.Group();

  /** Reference to the outline mesh (for animation) */
  private outlineMesh: THREE.Mesh | null = null;

  /** Elapsed time for animation */
  private elapsedTime: number = 0;

  /** Bob amplitude in world units */
  private readonly bobAmplitude: number = 0.15;

  /** Bob frequency in Hz */
  private readonly bobFrequency: number = 1.5;

  /** Rotation speed in radians per second */
  private readonly rotationSpeed: number = 1.2;

  /** Base Y position of the floating weapon */
  private readonly baseWeaponY: number = 1.2;

  /**
   * Creates a new WeaponPickup at the given position.
   * @param scene - The THREE.Scene to add the pickup to
   * @param config - The weapon configuration for this pickup
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   */
  constructor(scene: THREE.Scene, config: WeaponConfig, x: number, z: number) {
    this.scene = scene;
    this.config = config;

    // Build all visual elements in order
    this.buildPad();
    this.buildWeaponModel();
    this.buildOutline();
    this.buildLightBeam();

    // Position the pickup group at the given coordinates
    this.group.position.set(x, 0, z);

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Builds the cyan holographic pad at ground level.
   */
  private buildPad(): void {
    // --- Glowing Circle (base) ---
    const circleGeometry = new THREE.CircleGeometry(1.2, 32);
    const circleMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.02;
    this.group.add(circle);

    // --- Outer Ring ---
    const outerRingGeometry = new THREE.RingGeometry(1.2, 1.35, 32);
    const outerRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.03;
    this.group.add(outerRing);

    // --- Inner Ring (pulsing) ---
    const innerRingGeometry = new THREE.RingGeometry(0.6, 0.75, 32);
    const innerRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.04;
    this.group.add(innerRing);

    // --- Small glowing dots around the pad ---
    const dotMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dotGeometry = new THREE.SphereGeometry(0.04, 8, 8);
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(
        Math.cos(angle) * 1.1,
        0.05,
        Math.sin(angle) * 1.1
      );
      this.group.add(dot);
    }
  }

  /**
   * Builds the floating holographic weapon model.
   * The model is built per weapon type with holographic materials.
   */
  private buildWeaponModel(): void {
    // Position the weapon group at the base height
    this.weaponGroup.position.y = this.baseWeaponY;

    // Build the weapon model based on config id
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
        this.buildM9Sidearm();
        break;
    }

    // Add the weapon group to the pickup group
    this.group.add(this.weaponGroup);
  }

  /**
   * Creates a holographic material with the given color.
   * Semi-transparent cyan/blue tinted with emissive glow.
   * @param color - The base color for the material
   * @param emissiveIntensity - The emissive intensity
   * @returns A holographic MeshStandardMaterial
   */
  private createHoloMaterial(color: number, emissiveIntensity: number = 1.5): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: 0x00ffcc,
      emissiveIntensity: emissiveIntensity,
      transparent: true,
      opacity: 0.6,
      roughness: 0.3,
      metalness: 0.1,
    });
  }

  /**
   * Builds the M9 Sidearm holographic model.
   * Small silver pistol with orange glow accents.
   */
  private buildM9Sidearm(): void {
    const silver = this.createHoloMaterial(0xc0c8d0, 1.2);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const glow = this.createHoloMaterial(0xff6600, 2.0);

    // Slide / Body
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.5), silver);
    slide.position.set(0, 0.08, 0.05);
    this.weaponGroup.add(slide);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.4);
    this.weaponGroup.add(barrel);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), dark);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.08, 0.5);
    this.weaponGroup.add(muzzle);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.14), dark);
    grip.position.set(0, -0.06, -0.15);
    grip.rotation.x = 0.15;
    this.weaponGroup.add(grip);

    // Glow strip
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.3), glow);
    glowStrip.position.set(0, 0.13, 0.05);
    this.weaponGroup.add(glowStrip);

    // Glow ring
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 16), glow);
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.35);
    this.weaponGroup.add(glowRing);
  }

  /**
   * Builds the Viper SMG holographic model.
   * Compact black SMG with cyan accents.
   */
  private buildViperSMG(): void {
    const black = this.createHoloMaterial(0x1a1e24, 1.0);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const cyan = this.createHoloMaterial(0x00ffcc, 2.0);

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.55), black);
    body.position.set(0, 0.08, 0.05);
    this.weaponGroup.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.25, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.45);
    this.weaponGroup.add(barrel);

    // Muzzle Brake
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), dark);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.08, 0.6);
    this.weaponGroup.add(muzzleBrake);

    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.12), dark);
    magazine.position.set(0, -0.05, -0.1);
    magazine.rotation.x = 0.2;
    this.weaponGroup.add(magazine);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.2), black);
    stock.position.set(0, 0.06, -0.3);
    this.weaponGroup.add(stock);

    // Cyan glow strip
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.4), cyan);
    glowStrip.position.set(0, 0.14, 0.05);
    this.weaponGroup.add(glowStrip);

    // Cyan glow ring
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 16), cyan);
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.5);
    this.weaponGroup.add(glowRing);
  }

  /**
   * Builds the Titan Shotgun holographic model.
   * Heavy shotgun with red hazard stripes.
   */
  private buildTitanShotgun(): void {
    const heavy = this.createHoloMaterial(0x3a4048, 1.2);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const red = this.createHoloMaterial(0xff3300, 2.0);

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.6), heavy);
    body.position.set(0, 0.1, 0.05);
    this.weaponGroup.add(body);

    // Pump
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.3), dark);
    pump.position.set(0, 0.02, 0.35);
    this.weaponGroup.add(pump);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, 0.6);
    this.weaponGroup.add(barrel);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16), dark);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.12, 0.85);
    this.weaponGroup.add(muzzle);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.25), heavy);
    stock.position.set(0, 0.08, -0.35);
    this.weaponGroup.add(stock);

    // Red hazard stripes
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.04), red);
      stripe.position.set(0, 0.1, -0.05 + i * 0.12);
      this.weaponGroup.add(stripe);
    }

    // Red glow ring
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 8, 16), red);
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.12, 0.75);
    this.weaponGroup.add(glowRing);
  }

  /**
   * Builds the Longbow Rifle holographic model.
   * Long green rifle with scope.
   */
  private buildLongbowRifle(): void {
    const green = this.createHoloMaterial(0x2a5a3a, 1.2);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const greenGlow = this.createHoloMaterial(0x00ff66, 2.0);

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.8), green);
    body.position.set(0, 0.08, 0.05);
    this.weaponGroup.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.65);
    this.weaponGroup.add(barrel);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), dark);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.08, 0.95);
    this.weaponGroup.add(muzzle);

    // Scope
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), dark);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.16, 0.1);
    this.weaponGroup.add(scopeBody);

    // Scope lens
    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), greenGlow);
    scopeLens.rotation.y = Math.PI / 2;
    scopeLens.position.set(0, 0.16, 0.21);
    this.weaponGroup.add(scopeLens);

    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.2), dark);
    magazine.position.set(0, -0.04, -0.1);
    magazine.rotation.x = 0.1;
    this.weaponGroup.add(magazine);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), green);
    stock.position.set(0, 0.06, -0.4);
    this.weaponGroup.add(stock);

    // Green glow strip
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.5), greenGlow);
    glowStrip.position.set(0, 0.14, 0.2);
    this.weaponGroup.add(glowStrip);

    // Green glow ring
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 16), greenGlow);
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.08, 0.8);
    this.weaponGroup.add(glowRing);
  }

  /**
   * Builds the Pulsar Plasma holographic model.
   * Blue energy weapon with glowing coil.
   */
  private buildPulsarPlasma(): void {
    const blue = this.createHoloMaterial(0x2a4a6a, 1.2);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const blueGlow = this.createHoloMaterial(0x00aaff, 2.5);

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.6), blue);
    body.position.set(0, 0.09, 0.05);
    this.weaponGroup.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.09, 0.5);
    this.weaponGroup.add(barrel);

    // Glowing Coil (torus stack)
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), blueGlow);
      coil.rotation.y = Math.PI / 2;
      coil.position.set(0, 0.09, 0.4 + i * 0.08);
      this.weaponGroup.add(coil);
    }

    // Muzzle (energy emitter)
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), blueGlow);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.09, 0.7);
    this.weaponGroup.add(muzzle);

    // Energy Core
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), blueGlow);
    core.position.set(0, 0.09, 0.1);
    this.weaponGroup.add(core);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.2), blue);
    stock.position.set(0, 0.07, -0.3);
    this.weaponGroup.add(stock);

    // Blue glow strip
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.4), blueGlow);
    glowStrip.position.set(0, 0.16, 0.05);
    this.weaponGroup.add(glowStrip);
  }

  /**
   * Builds the Havoc Rocket holographic model.
   * Large launcher with yellow warhead.
   */
  private buildHavocRocket(): void {
    const olive = this.createHoloMaterial(0x4a4a2a, 1.2);
    const dark = this.createHoloMaterial(0x2a2f36, 1.0);
    const yellow = this.createHoloMaterial(0xffcc00, 2.0);

    // Main Tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 16), olive);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.12, 0.05);
    this.weaponGroup.add(tube);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, 0.6);
    this.weaponGroup.add(barrel);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), dark);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.12, 0.85);
    this.weaponGroup.add(muzzle);

    // Warhead (yellow cone)
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 16), yellow);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.12, 0.95);
    this.weaponGroup.add(warhead);

    // Grip Handle
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.2), dark);
    grip.position.set(0, -0.04, -0.1);
    this.weaponGroup.add(grip);

    // Rear Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), olive);
    stock.position.set(0, 0.1, -0.35);
    this.weaponGroup.add(stock);

    // Yellow glow ring
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 8, 16), yellow);
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(0, 0.12, 0.7);
    this.weaponGroup.add(glowRing);

    // Yellow glow strip
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.5), yellow);
    glowStrip.position.set(0, 0.19, 0.05);
    this.weaponGroup.add(glowStrip);
  }

  /**
   * Builds a glowing outline effect around the weapon.
   * Uses a slightly larger semi-transparent wireframe mesh.
   */
  private buildOutline(): void {
    // Create a bounding box around the weapon model
    // We'll use a simple wireframe box that encompasses the weapon
    const outlineGeometry = new THREE.BoxGeometry(0.6, 0.5, 1.4);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.y = this.baseWeaponY + 0.1;
    this.group.add(outline);
    this.outlineMesh = outline;
  }

  /**
   * Builds a vertical light beam from the pad upward.
   */
  private buildLightBeam(): void {
    // Vertical light beam (semi-transparent cylinder)
    const beamGeometry = new THREE.CylinderGeometry(0.15, 0.15, this.baseWeaponY + 0.3, 12, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = (this.baseWeaponY + 0.3) / 2;
    this.group.add(beam);

    // Inner bright beam
    const innerBeamGeometry = new THREE.CylinderGeometry(0.06, 0.06, this.baseWeaponY + 0.3, 8, 1, true);
    const innerBeamMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerBeam = new THREE.Mesh(innerBeamGeometry, innerBeamMaterial);
    innerBeam.position.y = (this.baseWeaponY + 0.3) / 2;
    this.group.add(innerBeam);
  }

  /**
   * Updates the pickup's animations.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Skip if collected or disposed
    if (this.collected || this.disposed) return;

    // Track elapsed time
    this.elapsedTime += deltaTime;

    // Bob the weapon group up and down
    const bobOffset = Math.sin(this.elapsedTime * 2 * Math.PI * this.bobFrequency) * this.bobAmplitude;
    this.weaponGroup.position.y = this.baseWeaponY + bobOffset;

    // Rotate the weapon group around Y axis
    this.weaponGroup.rotation.y += this.rotationSpeed * deltaTime;

    // Rotate the outline mesh with the weapon
    if (this.outlineMesh) {
      this.outlineMesh.rotation.y += this.rotationSpeed * deltaTime;
    }
  }

  /**
   * Gets the pickup's world position.
   * @returns A Vector3 of the pickup's position
   */
  public getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /**
   * Gets the weapon configuration for this pickup.
   * @returns The weapon config
   */
  public getConfig(): WeaponConfig {
    return this.config;
  }

  /**
   * Checks if the pickup has been collected.
   * @returns True if collected, false otherwise
   */
  public isCollected(): boolean {
    return this.collected;
  }

  /**
   * Marks the pickup as collected and removes it from the scene.
   * Safe to call multiple times.
   */
  public collect(): void {
    if (this.collected || this.disposed) return;

    this.collected = true;
    this.scene.remove(this.group);
  }

  /**
   * Removes the pickup from the scene and disposes all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove from scene
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