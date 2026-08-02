import * as THREE from 'three';

/**
 * ItemDropType
 *
 * Type of item that can drop from enemies.
 */
export type ItemDropType = 'ammo' | 'armor';

/**
 * ItemDrop
 *
 * A floating, rotating item drop spawned when enemies are eliminated.
 * Ammo packs are green; armor pickups are blue. The item bobs and
 * rotates above the ground, with a glowing pad and light beam for
 * visibility. Collected when the drone flies over it.
 */
export default class ItemDrop {
  /** Root group containing all meshes */
  private group: THREE.Group = new THREE.Group();

  /** The Three.js scene */
  private scene: THREE.Scene;

  /** The item type */
  private type: ItemDropType;

  /** Whether the item has been collected */
  private collected: boolean = false;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /** The floating item model group */
  private itemGroup: THREE.Group = new THREE.Group();

  /** Elapsed time for animation */
  private elapsedTime: number = 0;

  /** Bob amplitude in world units */
  private readonly bobAmplitude: number = 0.12;

  /** Bob frequency in Hz */
  private readonly bobFrequency: number = 2;

  /** Rotation speed in radians per second */
  private readonly rotationSpeed: number = 2.0;

  /** Base Y position of the floating item */
  private readonly baseItemY: number = 0.6;

  /** Pickup radius in world units */
  private readonly pickupRadius: number = 0.8;

  /** Color for this item type */
  private readonly color: number;

  /** Emissive color for this item type */
  private readonly emissiveColor: number;

  /**
   * Creates a new ItemDrop at the given position.
   * @param scene - The THREE.Scene to add the drop to
   * @param type - The type of item ('ammo' or 'armor')
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   */
  constructor(scene: THREE.Scene, type: ItemDropType, x: number, z: number) {
    this.scene = scene;
    this.type = type;

    // Set colors based on type
    if (type === 'ammo') {
      this.color = 0x00cc66;
      this.emissiveColor = 0x00ff88;
    } else {
      this.color = 0x3388ff;
      this.emissiveColor = 0x44aaff;
    }

    // Build visual elements
    this.buildPad();
    this.buildItemModel();
    this.buildLightBeam();

    // Position the group
    this.group.position.set(x, 0, z);

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Builds the glowing pad at ground level.
   */
  private buildPad(): void {
    // Glowing circle
    const circleGeometry = new THREE.CircleGeometry(0.6, 24);
    const circleMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.emissiveColor,
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

    // Outer ring
    const ringGeometry = new THREE.RingGeometry(0.6, 0.7, 24);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.emissiveColor,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);
  }

  /**
   * Builds the floating item model.
   */
  private buildItemModel(): void {
    this.itemGroup.position.y = this.baseItemY;

    const mat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.emissiveColor,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
      metalness: 0.4,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      emissive: this.emissiveColor,
      emissiveIntensity: 0.5,
      roughness: 0.5,
      metalness: 0.6,
    });

    if (this.type === 'ammo') {
      // Ammo box — rectangular with bullet icon
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), mat);
      this.itemGroup.add(box);

      // Lid line
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.26), darkMat);
      line.position.y = 0.1;
      this.itemGroup.add(line);

      // Bullet icon (small cylinder on front)
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), darkMat);
      bullet.rotation.z = Math.PI / 2;
      bullet.position.set(0, 0, 0.13);
      this.itemGroup.add(bullet);
    } else {
      // Armor — hexagonal shield shape
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 6), mat);
      shield.rotation.x = Math.PI / 2;
      this.itemGroup.add(shield);

      // Inner ring
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 6), darkMat);
      innerRing.position.z = 0.04;
      this.itemGroup.add(innerRing);

      // Center dot
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), darkMat);
      dot.position.z = 0.04;
      this.itemGroup.add(dot);
    }

    this.group.add(this.itemGroup);
  }

  /**
   * Builds a vertical light beam from the pad upward.
   */
  private buildLightBeam(): void {
    const beamGeometry = new THREE.CylinderGeometry(0.08, 0.08, this.baseItemY + 0.2, 8, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = (this.baseItemY + 0.2) / 2;
    this.group.add(beam);
  }

  /**
   * Updates the item's animations.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    if (this.collected || this.disposed) return;

    this.elapsedTime += deltaTime;

    // Bob up and down
    const bobOffset = Math.sin(this.elapsedTime * 2 * Math.PI * this.bobFrequency) * this.bobAmplitude;
    this.itemGroup.position.y = this.baseItemY + bobOffset;

    // Rotate
    this.itemGroup.rotation.y += this.rotationSpeed * deltaTime;
  }

  /**
   * Gets the item's world position.
   * @returns A Vector3 of the item's position
   */
  public getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /**
   * Gets the item type.
   * @returns The item type string
   */
  public getType(): ItemDropType {
    return this.type;
  }

  /**
   * Gets the pickup radius.
   * @returns The pickup radius in world units
   */
  public getPickupRadius(): number {
    return this.pickupRadius;
  }

  /**
   * Checks if the item has been collected.
   * @returns True if collected, false otherwise
   */
  public isCollected(): boolean {
    return this.collected;
  }

  /**
   * Marks the item as collected and removes it from the scene.
   * Safe to call multiple times.
   */
  public collect(): void {
    if (this.collected || this.disposed) return;

    this.collected = true;
    this.scene.remove(this.group);
  }

  /**
   * Removes the item from the scene and disposes all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.scene.remove(this.group);

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

    this.group.clear();
  }
}
