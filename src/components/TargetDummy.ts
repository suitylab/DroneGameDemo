import * as THREE from 'three';

/**
 * TargetDummy
 *
 * A target dummy entity for the MAZE STRIKE game (Phase 3).
 * Rendered procedurally using THREE.js primitives with a grey humanoid
 * shape, target indicator, and health bar. Takes damage, flashes red
 * when hit, and explodes into particles when destroyed.
 */
export default class TargetDummy {
  /** Root group containing all dummy meshes */
  private group: THREE.Group = new THREE.Group();

  /** The Three.js scene to add the dummy to */
  private scene: THREE.Scene;

  /** Current health points */
  private health: number = 50;

  /** Maximum health points */
  private readonly maxHealth: number = 50;

  /** Whether the dummy is alive (not destroyed) */
  private isAlive: boolean = true;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /** Reference to the body material for damage flash */
  private bodyMaterial: THREE.MeshStandardMaterial;

  /** Original emissive intensity of the body material */
  private readonly originalEmissiveIntensity: number = 0;

  /** Time remaining for the damage flash effect (seconds) */
  private damageFlashTimer: number = 0;

  /** Duration of the damage flash in seconds */
  private readonly damageFlashDuration: number = 0.1;

  /** Health bar sprite */
  private healthBarSprite: THREE.Sprite | null = null;

  /** Health bar canvas texture */
  private healthBarTexture: THREE.CanvasTexture | null = null;

  /** Active death particles */
  private deathParticles: {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    velocity: THREE.Vector3;
    rotationVelocity: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  /** Death explosion light */
  private deathLight: THREE.PointLight | null = null;

  /** Death explosion duration in seconds */
  private readonly deathDuration: number = 0.5;

  /** Gravity constant for death particles (units/s²) */
  private readonly gravity: number = 9.8;

  /**
   * Creates a new TargetDummy at the given position.
   * @param scene - The THREE.Scene to add the dummy to
   * @param x - World X coordinate on the ground plane
   * @param z - World Z coordinate on the ground plane
   */
  constructor(scene: THREE.Scene, x: number, z: number) {
    this.scene = scene;

    // Build the dummy visual hierarchy
    this.buildDummy();

    // Position the dummy on the ground plane
    this.group.position.set(x, 0, z);

    // Add to scene
    scene.add(this.group);
  }

  /**
   * Builds the complete target dummy mesh hierarchy.
   */
  private buildDummy(): void {
    // --- Materials ---
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x808890,
      metalness: 0.7,
      roughness: 0.4,
    });
    this.bodyMaterial = bodyMaterial;

    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x505860,
      metalness: 0.6,
      roughness: 0.5,
    });

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.8,
      roughness: 0.5,
    });

    const targetMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    });

    // --- Base / Stand ---
    const baseGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.15, 16);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.075;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    // --- Body (box torso) ---
    const bodyGeometry = new THREE.BoxGeometry(0.7, 1.0, 0.4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // --- Target Indicator (orange/red circle on chest) ---
    const targetGeometry = new THREE.CircleGeometry(0.18, 24);
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.position.set(0, 0.85, 0.21); // Slightly in front of body
    this.group.add(target);

    // --- Inner target ring ---
    const innerRingGeometry = new THREE.RingGeometry(0.08, 0.12, 24);
    const innerRing = new THREE.Mesh(innerRingGeometry, targetMaterial);
    innerRing.position.set(0, 0.85, 0.22);
    this.group.add(innerRing);

    // --- Head (sphere) ---
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.6;
    head.castShadow = true;
    this.group.add(head);

    // --- Health Bar (sprite above head) ---
    this.buildHealthBar();
  }

  /**
   * Builds the health bar sprite with a canvas texture.
   * The bar is green when full, transitioning to red as health decreases.
   */
  private buildHealthBar(): void {
    // Create canvas for the health bar
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw initial health bar (full green)
    this.drawHealthBar(ctx, 1.0);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.healthBarTexture = texture;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.6, 0.2, 1);
    sprite.position.y = 2.0; // Above the head (head at 1.6, radius 0.25)
    this.group.add(sprite);
    this.healthBarSprite = sprite;
  }

  /**
   * Draws the health bar on the canvas.
   * @param ctx - The 2D canvas context
   * @param healthRatio - Health percentage (0.0 to 1.0)
   */
  private drawHealthBar(ctx: CanvasRenderingContext2D, healthRatio: number): void {
    const width = 128;
    const height = 16;

    // Clamp health ratio
    const ratio = THREE.MathUtils.clamp(healthRatio, 0, 1);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background (dark)
    ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Health fill (green to red based on ratio)
    const fillWidth = (width - 4) * ratio;
    const fillHeight = height - 4;

    // Color: green (high) → yellow (mid) → red (low)
    let fillColor: string;
    if (ratio > 0.5) {
      // Green to yellow
      const t = (1 - ratio) * 2; // 0 at full, 1 at 50%
      const r = Math.floor(0 + t * 255);
      const g = Math.floor(255 - t * 100);
      fillColor = `rgb(${r}, ${g}, 0)`;
    } else {
      // Yellow to red
      const t = ratio * 2; // 1 at 50%, 0 at empty
      const r = 255;
      const g = Math.floor(155 * t);
      fillColor = `rgb(${r}, ${g}, 0)`;
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(2, 2, fillWidth, fillHeight);
  }

  /**
   * Applies damage to the dummy.
   * @param amount - Amount of damage to apply
   */
  public takeDamage(amount: number): void {
    // Ignore if already destroyed or disposed
    if (!this.isAlive || this.disposed) return;

    // Clamp damage to non-negative
    const damage = Math.max(0, amount);

    // Apply damage
    this.health = Math.max(0, this.health - damage);

    // Trigger damage flash
    this.damageFlashTimer = this.damageFlashDuration;
    this.bodyMaterial.emissive.setHex(0xff0000);
    this.bodyMaterial.emissiveIntensity = 1.0;

    // Update health bar
    this.updateHealthBar();

    // Check for death
    if (this.health <= 0) {
      this.explode();
    }
  }

  /**
   * Updates the health bar sprite texture.
   */
  private updateHealthBar(): void {
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
   * Triggers the death explosion: spawns particles and a light flash,
   * then removes the dummy from the scene.
   */
  private explode(): void {
    // Mark as not alive
    this.isAlive = false;

    // --- Spawn Explosion Particles ---
    const particleCount = 10 + Math.floor(Math.random() * 11); // 10-20
    const particleGeometry = new THREE.TetrahedronGeometry(0.08);

    for (let i = 0; i < particleCount; i++) {
      // Random direction (biased upward)
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.8 + 0.2, // Upward bias
        Math.random() * 2 - 1
      ).normalize();

      // Random speed
      const speed = 3 + Math.random() * 4;

      // Random color: grey or orange
      const isOrange = Math.random() < 0.5;
      const material = new THREE.MeshStandardMaterial({
        color: isOrange ? 0xff6600 : 0x808890,
        emissive: isOrange ? 0xff6600 : 0x404040,
        emissiveIntensity: isOrange ? 2.0 : 0.5,
        transparent: true,
        opacity: 1.0,
        roughness: 0.4,
        metalness: 0.6,
      });

      // Create particle mesh
      const particle = new THREE.Mesh(particleGeometry, material);
      particle.position.copy(this.group.position);
      particle.position.y += 1.0; // Center of dummy
      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Store velocity and rotation velocity
      const velocity = direction.multiplyScalar(speed);
      const rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );

      this.scene.add(particle);

      this.deathParticles.push({
        mesh: particle,
        material,
        velocity,
        rotationVelocity,
        life: this.deathDuration,
        maxLife: this.deathDuration,
      });
    }

    // Dispose the shared geometry (each mesh references it, disposed when effect expires)
    (this as any).deathParticleGeometry = particleGeometry;

    // --- Spawn Light Flash ---
    const light = new THREE.PointLight(0xff8800, 5, 8);
    light.position.copy(this.group.position);
    light.position.y = 1.0;
    this.scene.add(light);
    this.deathLight = light;

    // --- Remove Dummy from Scene ---
    this.scene.remove(this.group);
  }

  /**
   * Updates the dummy's animations and death effects.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    // Update damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= deltaTime;
      if (this.damageFlashTimer <= 0) {
        // Reset emissive to original (no glow)
        this.bodyMaterial.emissive.setHex(0x000000);
        this.bodyMaterial.emissiveIntensity = this.originalEmissiveIntensity;
      }
    }

    // Update death particles
    this.updateDeathParticles(deltaTime);
  }

  /**
   * Updates death particle physics and fading.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateDeathParticles(deltaTime: number): void {
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const particle = this.deathParticles[i];
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        // Remove from scene
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.material.dispose();
        this.deathParticles.splice(i, 1);
        continue;
      }

      // Apply gravity
      particle.velocity.y -= this.gravity * deltaTime;

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

    // Update death light
    if (this.deathLight) {
      const ratio = this.deathParticles.length > 0
        ? this.deathParticles[0].life / this.deathParticles[0].maxLife
        : 0;
      this.deathLight.intensity = 5 * ratio;

      // Remove light when all particles are gone
      if (this.deathParticles.length === 0) {
        this.scene.remove(this.deathLight);
        this.deathLight.dispose();
        this.deathLight = null;

        // Dispose the shared particle geometry
        const geometry = (this as any).deathParticleGeometry;
        if (geometry) {
          geometry.dispose();
          (this as any).deathParticleGeometry = null;
        }
      }
    }
  }

  /**
   * Gets whether the dummy is alive.
   * @returns True if alive, false if destroyed
   */
  public getIsAlive(): boolean {
    return this.isAlive;
  }

  /**
   * Gets the dummy's world position.
   * @returns A Vector3 of the dummy's position
   */
  public get position(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Gets the dummy's root group.
   * @returns The dummy's root group
   */
  public getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Removes the dummy from the scene and disposes all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove dummy group from scene
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

    // Dispose death light
    if (this.deathLight) {
      this.scene.remove(this.deathLight);
      this.deathLight.dispose();
      this.deathLight = null;
    }

    // Dispose shared particle geometry
    const geometry = (this as any).deathParticleGeometry;
    if (geometry) {
      geometry.dispose();
      (this as any).deathParticleGeometry = null;
    }

    // Clear group
    this.group.clear();
  }
}