import * as THREE from 'three';
import Weapon from './Weapon';

/**
 * Drone
 * 
 * A polished placeholder combat drone for the MAZE STRIKE game (Phase 2).
 * Rendered procedurally using THREE.js primitives with a dark metal body,
 * glowing cyan core, spinning rotors, and hover-bob animation.
 * 
 * Supports collision detection against the maze grid map, with smooth
 * wall sliding along both axes.
 */
export default class Drone {
  /** Root group containing all drone meshes */
  private _group: THREE.Group = new THREE.Group();

  /** Movement speed in units per second */
  private readonly speed: number = 8;

  /** Turn rate in radians per second */
  private readonly turnRate: number = 10;

  /** Hover-bob amplitude */
  private readonly bobAmplitude: number = 0.2;

  /** Hover-bob frequency in Hz */
  private readonly bobFrequency: number = 2;

  /** Rotor spin speed in radians per second (20 rev/sec) */
  private readonly rotorSpinSpeed: number = 125.66;

    /** Collision radius in world units (drone body is 0.9 wide, half is 0.45, use 0.4 for tolerance) */
  private readonly collisionRadius: number = 0.4;

  /** Entity collision callback: returns true if the position would overlap an enemy */
  private entityCollisionCallback: ((x: number, z: number) => boolean) | null = null;

  /** References to rotor blades for animation */
  private rotorBlades: THREE.Group[] = [];

  /** Current facing angle (radians) */
  private currentAngle: number = 0;

    /** Elapsed time for hover-bob animation */
  private elapsedTime: number = 0;

  /** Current hover-bob offset value (computed by updateAnimation) */
  private bobOffsetValue: number = 0;

    /** Reference to the scene for cleanup */
  private scene: THREE.Scene;

    /** The attached weapon (null if none) */
  private weapon: Weapon | null = null;

  /** Death explosion particles (spawned by explode()) */
  public deathParticles: {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    velocity: THREE.Vector3;
    rotationVelocity: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  /** Death explosion light flash */
  public deathLight: THREE.PointLight | null = null;

  /** Death explosion duration in seconds */
  public deathDuration: number = 0.8;

  /** Whether the drone has exploded */
  public isExploded: boolean = false;

  /** Gravity constant for particle physics (units/s²) */
  public readonly gravity: number = 9.8;

  /** Bounce damping factor for particles (0-1, higher = more bounce) */
  public readonly bounceDamping: number = 0.5;

  /**
   * Creates a new Drone and adds it to the given scene.
   * @param scene - The THREE.Scene to add the drone to
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildDrone();
    scene.add(this._group);
  }

  /**
   * Builds the complete drone mesh hierarchy.
   */
  private buildDrone(): void {
    // --- Central Body ---
    const bodyGeometry = new THREE.BoxGeometry(0.9, 0.35, 0.9);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.175; // Half height above ground
    this._group.add(body);

    // --- Glowing Cyan Core ---
    const coreGeometry = new THREE.SphereGeometry(0.16, 16, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.5,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.35; // On top of body
    this._group.add(core);

    // --- Cyan Ring (Polish) ---
    const ringGeometry = new THREE.TorusGeometry(0.22, 0.02, 8, 24);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 1.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.36;
    this._group.add(ring);

    // --- Rotor Arms ---
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.7,
      roughness: 0.5,
    });

    // Arm positions (diagonal from body corners)
    const armPositions = [
      new THREE.Vector3(-0.55, 0.2, -0.55),
      new THREE.Vector3(0.55, 0.2, -0.55),
      new THREE.Vector3(-0.55, 0.2, 0.55),
      new THREE.Vector3(0.55, 0.2, 0.55),
    ];

    // Arm angles (pointing outward diagonally)
    const armAngles = [
      Math.PI * 0.75, // Top-left (back-left)
      Math.PI * 0.25, // Top-right (back-right)
      -Math.PI * 0.75, // Bottom-left (front-left)
      -Math.PI * 0.25, // Bottom-right (front-right)
    ];

    for (let i = 0; i < 4; i++) {
      // Arm cylinder
      const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
      const arm = new THREE.Mesh(armGeometry, armMaterial);
      arm.position.copy(armPositions[i]);
      arm.rotation.y = armAngles[i];
      this._group.add(arm);

      // Rotor hub
      const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12);
      const hub = new THREE.Mesh(hubGeometry, armMaterial);
      hub.position.copy(armPositions[i]);
      hub.position.y += 0.03;
      this._group.add(hub);

      // Rotor blade (crossed flat boxes)
      const bladeGroup = new THREE.Group();
      bladeGroup.position.copy(armPositions[i]);
      bladeGroup.position.y += 0.06;

      const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a4048,
        metalness: 0.5,
        roughness: 0.6,
      });

      // Two crossed blades
      const blade1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.02, 0.08),
        bladeMaterial
      );
      blade1.position.x = 0.15;
      bladeGroup.add(blade1);

      const blade2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.02, 0.08),
        bladeMaterial
      );
      blade2.position.x = -0.15;
      bladeGroup.add(blade2);

      this._group.add(bladeGroup);
      this.rotorBlades.push(bladeGroup);
    }

    // --- Landing Skids ---
    const skidMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.7,
      roughness: 0.5,
    });

    const skidGeometry = new THREE.BoxGeometry(0.5, 0.04, 0.1);
    const skid1 = new THREE.Mesh(skidGeometry, skidMaterial);
    skid1.position.set(-0.25, 0.02, 0);
    this._group.add(skid1);

    const skid2 = new THREE.Mesh(skidGeometry, skidMaterial);
    skid2.position.set(0.25, 0.02, 0);
    this._group.add(skid2);
  }

    /**
   * Attaches a weapon to the drone's weapon mount.
   *
   * The weapon's group is added to the drone's root group at local
   * position (0, 0, 0). Since the weapon's own group is already
   * positioned at y=0.1 (underneath the drone body), it will sit
   * correctly below the drone and rotate with it.
   *
   * @param weapon - The Weapon instance to attach
   */
  public attachWeapon(weapon: Weapon): void {
    this.weapon = weapon;

    // Get the weapon's group and add it to the drone's group
    // so it rotates with the drone
    const weaponGroup = weapon.getGroup();
    weaponGroup.position.set(0, 0, 0);
    this._group.add(weaponGroup);
  }

  /**
   * Gets the weapon's muzzle world position for bullet spawning.
   *
   * @returns The muzzle position in world space, or null if no weapon attached
   */
  public getMuzzleWorldPosition(): THREE.Vector3 | null {
    if (!this.weapon) {
      return null;
    }
    return this.weapon.getMuzzleWorldPosition();
  }

  /**
   * Gets the attached weapon instance.
   *
   * @returns The attached weapon, or null if none
   */
  public getWeapon(): Weapon | null {
    return this.weapon;
  }

    /**
   * Sets the entity collision callback used to block movement when the
   * player would overlap with an enemy.
   *
   * @param callback - Returns true if the given position would overlap an enemy
   */
  public setEntityCollisionCallback(callback: (x: number, z: number) => boolean): void {
    this.entityCollisionCallback = callback;
  }

  /**
   * Checks if a position is walkable by verifying all 4 corners of the
   * drone's bounding box.
   * 
   * @param x - The X coordinate to check
   * @param z - The Z coordinate to check
   * @param isWalkable - The walkability callback
   * @returns True if all 4 corners are walkable, false otherwise
   */
  private isPositionWalkable(
    x: number,
    z: number,
    isWalkable: (x: number, z: number) => boolean
  ): boolean {
    const r = this.collisionRadius;

    // Check all 4 corners of the bounding box
    return (
      isWalkable(x - r, z - r) &&
      isWalkable(x + r, z - r) &&
      isWalkable(x - r, z + r) &&
      isWalkable(x + r, z + r)
    );
  }

    /**
   * Updates ONLY the hover-bob and rotor spin animations.
   * This is used by external code (e.g., the main menu) that drives the
   * drone's position/rotation manually but still wants the rotor spin
   * and hover-bob to play naturally.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  public updateAnimation(deltaTime: number): void {
    // Track elapsed time for hover-bob
    this.elapsedTime += deltaTime;

    // Compute and store the hover-bob offset
    this.bobOffsetValue =
      Math.sin(this.elapsedTime * 2 * Math.PI * this.bobFrequency) *
      this.bobAmplitude;

    // Apply the hover-bob to the group's Y position
    this._group.position.y = this.bobOffsetValue;

    // --- Rotor Spin ---
    for (const blade of this.rotorBlades) {
      blade.rotation.y += this.rotorSpinSpeed * deltaTime;
    }
  }

  /**
   * Updates the drone's position, rotation, and animations.
   * 
   * Movement is gated by the isWalkable callback:
   * - If isWalkable is null (during intro), the drone does not move
   * - If isWalkable is provided, collision checking is performed
   * 
   * X and Z movements are checked independently for smooth wall sliding.
   * 
   * @param deltaTime - Time since last frame in seconds
   * @param moveDirection - Normalized movement direction (X/Z plane)
   * @param mouseWorldPosition - Mouse position on the ground plane
   * @param camera - The camera (unused in this phase but kept for API consistency)
   * @param isWalkable - Collision callback: returns true if position is walkable, null during intro
   */
  public update(
    deltaTime: number,
    moveDirection: THREE.Vector3,
    mouseWorldPosition: THREE.Vector3,
    camera: THREE.Camera,
    isWalkable: ((x: number, z: number) => boolean) | null
    ): void {
    // Update hover-bob and rotor spin animations
    this.updateAnimation(deltaTime);

    // --- Movement (gated by isWalkable callback) ---
    if (isWalkable && moveDirection.lengthSq() > 0) {
      // Calculate proposed movement
      const moveX = moveDirection.x * this.speed * deltaTime;
      const moveZ = moveDirection.z * this.speed * deltaTime;

      // Current position (collision uses y=0 plane)
      const currentX = this._group.position.x;
      const currentZ = this._group.position.z;

            // --- X Axis Movement (independent check) ---
      const newX = currentX + moveX;
      if (
        this.isPositionWalkable(newX, currentZ, isWalkable) &&
        (!this.entityCollisionCallback || !this.entityCollisionCallback(newX, currentZ))
      ) {
        this._group.position.x = newX;
      }

      // --- Z Axis Movement (independent check) ---
      const newZ = currentZ + moveZ;
      if (
        this.isPositionWalkable(this._group.position.x, newZ, isWalkable) &&
        (!this.entityCollisionCallback || !this.entityCollisionCallback(this._group.position.x, newZ))
      ) {
        this._group.position.z = newZ;
      }
    }

    // --- Smooth Rotation Toward Mouse (always active) ---
    const targetAngle = Math.atan2(
      mouseWorldPosition.x - this._group.position.x,
      mouseWorldPosition.z - this._group.position.z
    );

    // Calculate shortest angular difference
    let angleDiff = targetAngle - this.currentAngle;
    // Wrap to [-PI, PI]
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

    // Lerp angle toward target
    const maxDelta = this.turnRate * deltaTime;
    const clampedDelta = THREE.MathUtils.clamp(angleDiff, -maxDelta, maxDelta);
    this.currentAngle += clampedDelta;

        // Apply rotation to group
    this._group.rotation.y = this.currentAngle;

    // --- Slight Tilt When Moving ---
    // Compute tilt based on movement direction relative to facing
    if (moveDirection.lengthSq() > 0) {
      // Convert movement to local space (relative to drone facing)
      const localMove = moveDirection.clone().applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -this.currentAngle
      );

      // Tilt forward/back (pitch) and left/right (roll)
      // Forward is +Z in local space
      const pitchTilt = -localMove.z * 0.15; // Tilt forward when moving forward
      const rollTilt = -localMove.x * 0.15; // Tilt sideways

      // Smoothly interpolate tilt
      this._group.rotation.x = THREE.MathUtils.lerp(
        this._group.rotation.x,
        pitchTilt,
        deltaTime * 5
      );
      this._group.rotation.z = THREE.MathUtils.lerp(
        this._group.rotation.z,
        rollTilt,
        deltaTime * 5
      );
    } else {
      // Return to level when not moving
      this._group.rotation.x = THREE.MathUtils.lerp(
        this._group.rotation.x,
        0,
        deltaTime * 5
      );
      this._group.rotation.z = THREE.MathUtils.lerp(
        this._group.rotation.z,
        0,
        deltaTime * 5
      );
    }
  }

    /**
   * Gets the drone's world position on the y=0 plane.
   */
  public get position(): THREE.Vector3 {
    return new THREE.Vector3(
      this._group.position.x,
      0,
      this._group.position.z
    );
  }

  /**
   * Sets the drone's world position.
   */
  public set position(value: THREE.Vector3) {
    this._group.position.copy(value);
  }

    /**
   * Gets the drone's root group.
   */
  public get group(): THREE.Group {
    return this._group;
  }

  /**
   * Gets the current hover-bob offset (the Y offset applied by the hover animation).
   * Useful for external code that wants to apply the bob on top of a base height.
   */
  public get bobOffset(): number {
    return this.bobOffsetValue;
  }

      /**
   * Triggers the drone death explosion.
   *
   * Spawns 20-30 bright cyan/orange particle meshes (TetrahedronGeometry)
   * that fly outward with random velocities and gravity, creates a bright
   * point light flash (intensity 10, radius 12), and removes the drone
   * group from the scene.
   *
   * The death particles are stored in this.deathParticles for the Game
   * class to update via updateDeathParticles().
   */
  public explode(): void {
    // Guard against double explosion
    if (this.isExploded) return;
    this.isExploded = true;

    // --- Spawn Death Particles (20-30) ---
    const particleCount = 20 + Math.floor(Math.random() * 11); // 20-30
    const particleGeometry = new THREE.TetrahedronGeometry(0.12);

    for (let i = 0; i < particleCount; i++) {
      // Random direction with upward bias
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.8 + 0.2, // Upward bias
        Math.random() * 2 - 1
      ).normalize();

      // Random speed (3-8 units/s)
      const speed = 3 + Math.random() * 5;

      // Alternate between cyan and orange colors
      const isCyan = i % 2 === 0;
      const color = isCyan ? 0x00ffcc : 0xff6600;

      // Create particle material
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 1.0,
        roughness: 0.4,
        metalness: 0.6,
      });

      // Create particle mesh
      const particle = new THREE.Mesh(particleGeometry, material);
      particle.position.copy(this._group.position);
      particle.position.y += 0.2; // Center of drone body
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

      // Add to scene
      this.scene.add(particle);

      // Store in death particles array
      this.deathParticles.push({
        mesh: particle,
        material,
        velocity,
        rotationVelocity,
        life: this.deathDuration,
        maxLife: this.deathDuration,
      });
    }

    // --- Spawn Bright Point Light Flash ---
    const light = new THREE.PointLight(0xffaa44, 10, 12);
    light.position.copy(this._group.position);
    light.position.y += 0.5;
    this.scene.add(light);
    this.deathLight = light;

    // --- Remove Drone Group from Scene ---
    this.scene.remove(this._group);
  }

  /**
   * Updates death explosion particles.
   *
   * Applies gravity, updates positions and rotations, fades opacity
   * based on life ratio, removes expired particles, and fades the
   * death light intensity.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  public updateDeathParticles(deltaTime: number): void {
    // Update particles
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const particle = this.deathParticles[i];
      particle.life -= deltaTime;

      // Remove if life expired
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.material.dispose();
        this.deathParticles.splice(i, 1);
        continue;
      }

      // Apply gravity
      particle.velocity.y -= this.gravity * deltaTime;

      // Update position
      particle.mesh.position.add(
        particle.velocity.clone().multiplyScalar(deltaTime)
      );

      // Update rotation
      particle.mesh.rotation.x += particle.rotationVelocity.x * deltaTime;
      particle.mesh.rotation.y += particle.rotationVelocity.y * deltaTime;
      particle.mesh.rotation.z += particle.rotationVelocity.z * deltaTime;

      // Fade opacity based on life ratio
      const ratio = particle.life / particle.maxLife;
      particle.material.opacity = ratio;
    }

    // Fade death light intensity
    if (this.deathLight) {
      // Calculate the average life ratio of remaining particles
      let totalRatio = 0;
      if (this.deathParticles.length > 0) {
        for (const particle of this.deathParticles) {
          totalRatio += particle.life / particle.maxLife;
        }
        totalRatio /= this.deathParticles.length;
      }

      // Fade light intensity proportionally
      this.deathLight.intensity = 10 * totalRatio;

      // Remove light when all particles are gone
      if (this.deathParticles.length === 0) {
        this.scene.remove(this.deathLight);
        this.deathLight.dispose();
        this.deathLight = null;
      }
    }
  }

  /**
   * Respawns the drone after death.
   * Re-adds the drone group to the scene and resets explosion state.
   */
  public respawn(): void {
    if (!this.isExploded) return;

    // Re-add the drone group to the scene
    this.scene.add(this._group);

    // Reset explosion state
    this.isExploded = false;

    // Clear any remaining death particles
    for (const particle of this.deathParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.material.dispose();
    }
    this.deathParticles = [];

    // Remove death light
    if (this.deathLight) {
      this.scene.remove(this.deathLight);
      this.deathLight = null;
    }
  }

  /**
   * Removes the drone from the scene and disposes all geometries and materials.
   */
  public dispose(): void {
    // Dispose the attached weapon if present
    if (this.weapon) {
      this.weapon.dispose();
      this.weapon = null;
    }

    this.scene.remove(this._group);

    // Traverse and dispose all geometries and materials
    this._group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

        // Clear references
    this.rotorBlades = [];

    // Dispose death explosion particles
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
  }
}