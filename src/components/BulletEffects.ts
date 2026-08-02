import * as THREE from 'three';

/**
 * BulletEffects
 *
 * Manages all visual bullet effects for the MAZE STRIKE game.
 * Muzzle flashes, tracer lines, impact spark particles, impact debris,
 * and shell casings.
 *
 * All effects are procedurally generated using THREE.js primitives with
 * emissive materials for a visceral, polished feel. Effects are transient —
 * they spawn, animate, fade, and are automatically removed from the scene.
 *
 * Geometries and material templates are pre-cached in the constructor to
 * avoid runtime shader compilation stalls (the "first-shot stutter").
 */
export default class BulletEffects {
  /** The Three.js scene to add effects to */
  private scene: THREE.Scene;

  // --- Pre-cached geometries (shared, never disposed until dispose()) ---
  private readonly muzzlePrimaryGeom = new THREE.SphereGeometry(0.12, 8, 8);
  private readonly muzzleSecondaryGeom = new THREE.SphereGeometry(0.2, 8, 8);
  private readonly sparkGeom = new THREE.TetrahedronGeometry(0.06);
  private readonly debrisGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
  private readonly casingGeom = new THREE.BoxGeometry(0.04, 0.04, 0.08);

  // --- Pre-cached material templates (compiled once, cloned per effect) ---
  private readonly muzzlePrimaryMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 4.0,
    transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
  });
  private readonly muzzleSecondaryMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2.5,
    transparent: true, opacity: 0.6, roughness: 0.5, metalness: 0.1,
  });
  private readonly tracerMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 3.0,
    transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
  });
  private readonly sparkMat = new THREE.MeshStandardMaterial({
    color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 4.0,
    transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
  });
  private readonly debrisMat = new THREE.MeshStandardMaterial({
    color: 0x6a7078, roughness: 0.8, metalness: 0.4,
    transparent: true, opacity: 1.0,
  });
  private readonly casingMat = new THREE.MeshStandardMaterial({
    color: 0xb8860b, metalness: 0.9, roughness: 0.4,
  });

  /** Active muzzle flash effects */
  private muzzleFlashes: {
    light: THREE.PointLight;
    sprite: THREE.Mesh;
    secondarySprite: THREE.Mesh;
    spriteMat: THREE.MeshStandardMaterial;
    secondaryMat: THREE.MeshStandardMaterial;
    life: number;
    maxLife: number;
  }[] = [];

  /** Active tracer effects */
  private tracers: {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    life: number;
    maxLife: number;
  }[] = [];

  /** Active impact effects */
  private impacts: {
    sparks: THREE.Mesh[];
    sparkMaterials: THREE.MeshStandardMaterial[];
    debris: DebrisParticle[];
    light: THREE.PointLight;
    life: number;
    maxLife: number;
  }[] = [];

  /** Active shell casings */
  private shellCasings: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotationVelocity: THREE.Vector3;
    life: number;
    resting: boolean;
  }[] = [];

  /** Gravity constant in units/s² */
  private readonly gravity: number = 9.8;

  /** Ground bounce damping factor (0-1, higher = more bounce) */
  private readonly bounceDamping: number = 0.5;

  /** Minimum velocity threshold for a shell casing to come to rest */
  private readonly restVelocityThreshold: number = 0.5;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Force-compiles all shader programs used by bullet effects.
   * Creates temporary meshes (one per material type), renders them once
   * via renderer.render() to trigger GPU shader compilation, then removes
   * them. Call once during game init to eliminate first-shot stutter.
   */
  public warmup(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const dummyGeom = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const mats = [
      this.muzzlePrimaryMat,
      this.muzzleSecondaryMat,
      this.tracerMat,
      this.sparkMat,
      this.debrisMat,
      this.casingMat,
    ];

    const dummy = new THREE.Object3D();
    for (const mat of mats) {
      const m = new THREE.Mesh(dummyGeom, mat);
      m.position.set(-1000, -1000, -1000);
      m.frustumCulled = false;
      dummy.add(m);
    }
    this.scene.add(dummy);

    renderer.render(this.scene, camera);

    this.scene.remove(dummy);
    dummyGeom.dispose();
  }

  public spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
    const light = new THREE.PointLight(0xffaa44, 8, 10);
    light.position.copy(position);
    this.scene.add(light);

    const spriteMat = this.muzzlePrimaryMat.clone();
    const sprite = new THREE.Mesh(this.muzzlePrimaryGeom, spriteMat);
    sprite.position.copy(position);
    this.scene.add(sprite);

    const secondaryMat = this.muzzleSecondaryMat.clone();
    const secondarySprite = new THREE.Mesh(this.muzzleSecondaryGeom, secondaryMat);
    secondarySprite.position.copy(position);
    this.scene.add(secondarySprite);

    this.muzzleFlashes.push({
      light, sprite, secondarySprite, spriteMat, secondaryMat,
      life: 0.05, maxLife: 0.05,
    });
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length < 0.01) return;
    direction.normalize();

    const geometry = new THREE.CylinderGeometry(0.015, 0.015, length, 6);
    const material = this.tracerMat.clone();
    const mesh = new THREE.Mesh(geometry, material);

    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    mesh.quaternion.copy(quaternion);

    this.scene.add(mesh);

    this.tracers.push({ mesh, material, life: 0.1, maxLife: 0.1 });
  }

  public spawnImpact(position: THREE.Vector3, normal: THREE.Vector3): void {
    const sparkCount = 14 + Math.floor(Math.random() * 11);
    const sparks: THREE.Mesh[] = [];
    const sparkMaterials: THREE.MeshStandardMaterial[] = [];

    for (let i = 0; i < sparkCount; i++) {
      const randomDir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      const dir = randomDir.add(normal.clone().multiplyScalar(1.5)).normalize();
      const speed = 3 + Math.random() * 5;

      const material = this.sparkMat.clone();
      const spark = new THREE.Mesh(this.sparkGeom, material);
      spark.position.copy(position);
      spark.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      spark.userData.velocity = dir.multiplyScalar(speed);
      spark.userData.rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      this.scene.add(spark);
      sparks.push(spark);
      sparkMaterials.push(material);
    }

    const debrisCount = 4 + Math.floor(Math.random() * 5);
    const debris: DebrisParticle[] = [];

    for (let i = 0; i < debrisCount; i++) {
      const randomDir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.8 + 0.2,
        Math.random() * 2 - 1
      ).normalize();

      const dir = randomDir.add(normal.clone().multiplyScalar(0.5)).normalize();
      const speed = 1.5 + Math.random() * 2.5;

      const material = this.debrisMat.clone();
      const mesh = new THREE.Mesh(this.debrisGeom, material);
      mesh.position.copy(position);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      debris.push({
        mesh, material,
        velocity: dir.multiplyScalar(speed),
        rotationVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15
        ),
        life: 0.5, maxLife: 0.5, resting: false,
      });
    }

    const light = new THREE.PointLight(0xff8800, 5, 6);
    light.position.copy(position);
    this.scene.add(light);

    this.impacts.push({
      sparks, sparkMaterials, debris, light,
      life: 0.3, maxLife: 0.3,
    });
  }

  public spawnShellCasing(position: THREE.Vector3, direction: THREE.Vector3): void {
    const material = this.casingMat.clone();
    const mesh = new THREE.Mesh(this.casingGeom, material);
    mesh.position.copy(position);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    this.scene.add(mesh);

    const velocity = direction.clone().multiplyScalar(2.5);
    velocity.y = 2.0 + Math.random() * 1.5;

    this.shellCasings.push({
      mesh, velocity,
      rotationVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      ),
      life: 5.0, resting: false,
    });
  }

  public update(deltaTime: number): void {
    this.updateMuzzleFlashes(deltaTime);
    this.updateTracers(deltaTime);
    this.updateImpacts(deltaTime);
    this.updateShellCasings(deltaTime);
  }

  private updateMuzzleFlashes(deltaTime: number): void {
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const effect = this.muzzleFlashes[i];
      effect.life -= deltaTime;

      if (effect.life <= 0) {
        this.scene.remove(effect.light);
        this.scene.remove(effect.sprite);
        this.scene.remove(effect.secondarySprite);
        effect.light.dispose();
        effect.spriteMat.dispose();
        effect.secondaryMat.dispose();
        this.muzzleFlashes.splice(i, 1);
      } else {
        const ratio = effect.life / effect.maxLife;
        effect.spriteMat.opacity = ratio;
        effect.secondaryMat.opacity = ratio * 0.6;
        effect.light.intensity = 8 * ratio;
      }
    }
  }

  private updateTracers(deltaTime: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const effect = this.tracers[i];
      effect.life -= deltaTime;

      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        effect.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        effect.material.opacity = effect.life / effect.maxLife;
      }
    }
  }

  private updateImpacts(deltaTime: number): void {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const effect = this.impacts[i];
      effect.life -= deltaTime;

      if (effect.life <= 0) {
        for (const spark of effect.sparks) {
          this.scene.remove(spark);
        }
        for (const mat of effect.sparkMaterials) {
          mat.dispose();
        }

        for (const debris of effect.debris) {
          this.scene.remove(debris.mesh);
          debris.material.dispose();
        }

        this.scene.remove(effect.light);
        effect.light.dispose();
        this.impacts.splice(i, 1);
      } else {
        const ratio = effect.life / effect.maxLife;
        for (const mat of effect.sparkMaterials) {
          mat.opacity = ratio;
        }
        effect.light.intensity = 5 * ratio;

        for (const spark of effect.sparks) {
          const velocity = spark.userData.velocity as THREE.Vector3;
          const rotationVelocity = spark.userData.rotationVelocity as THREE.Vector3;
          spark.position.add(velocity.clone().multiplyScalar(deltaTime));
          spark.rotation.x += rotationVelocity.x * deltaTime;
          spark.rotation.y += rotationVelocity.y * deltaTime;
          spark.rotation.z += rotationVelocity.z * deltaTime;
        }

        this.updateDebris(effect.debris, deltaTime);
      }
    }
  }

  private updateDebris(debris: DebrisParticle[], deltaTime: number): void {
    for (let i = debris.length - 1; i >= 0; i--) {
      const particle = debris[i];
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.material.dispose();
        debris.splice(i, 1);
        continue;
      }

      if (particle.resting) continue;

      particle.velocity.y -= this.gravity * deltaTime;
      particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      particle.mesh.rotation.x += particle.rotationVelocity.x * deltaTime;
      particle.mesh.rotation.y += particle.rotationVelocity.y * deltaTime;
      particle.mesh.rotation.z += particle.rotationVelocity.z * deltaTime;

      if (particle.mesh.position.y <= 0.02) {
        particle.mesh.position.y = 0.02;
        if (particle.velocity.y < -this.restVelocityThreshold) {
          particle.velocity.y = -particle.velocity.y * this.bounceDamping;
          particle.velocity.x *= 0.7;
          particle.velocity.z *= 0.7;
          particle.rotationVelocity.multiplyScalar(0.5);
        } else {
          particle.velocity.set(0, 0, 0);
          particle.rotationVelocity.set(0, 0, 0);
          particle.resting = true;
        }
      }

      particle.material.opacity = particle.life / particle.maxLife;
    }
  }

  private updateShellCasings(deltaTime: number): void {
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const casing = this.shellCasings[i];
      casing.life -= deltaTime;

      if (casing.life <= 0) {
        this.scene.remove(casing.mesh);
        (casing.mesh.material as THREE.MeshStandardMaterial).dispose();
        this.shellCasings.splice(i, 1);
        continue;
      }

      if (casing.resting) continue;

      casing.velocity.y -= this.gravity * deltaTime;
      casing.mesh.position.add(casing.velocity.clone().multiplyScalar(deltaTime));
      casing.mesh.rotation.x += casing.rotationVelocity.x * deltaTime;
      casing.mesh.rotation.y += casing.rotationVelocity.y * deltaTime;
      casing.mesh.rotation.z += casing.rotationVelocity.z * deltaTime;

      if (casing.mesh.position.y <= 0.02) {
        casing.mesh.position.y = 0.02;
        if (casing.velocity.y < -this.restVelocityThreshold) {
          casing.velocity.y = -casing.velocity.y * this.bounceDamping;
          casing.velocity.x *= 0.7;
          casing.velocity.z *= 0.7;
          casing.rotationVelocity.multiplyScalar(0.5);
        } else {
          casing.velocity.set(0, 0, 0);
          casing.rotationVelocity.set(0, 0, 0);
          casing.resting = true;
        }
      }
    }
  }

  public dispose(): void {
    for (const effect of this.muzzleFlashes) {
      this.scene.remove(effect.light);
      this.scene.remove(effect.sprite);
      this.scene.remove(effect.secondarySprite);
      effect.light.dispose();
      effect.spriteMat.dispose();
      effect.secondaryMat.dispose();
    }
    this.muzzleFlashes = [];

    for (const effect of this.tracers) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.material.dispose();
    }
    this.tracers = [];

    for (const effect of this.impacts) {
      for (const spark of effect.sparks) {
        this.scene.remove(spark);
      }
      for (const mat of effect.sparkMaterials) {
        mat.dispose();
      }
      for (const debris of effect.debris) {
        this.scene.remove(debris.mesh);
        debris.material.dispose();
      }
      this.scene.remove(effect.light);
      effect.light.dispose();
    }
    this.impacts = [];

    for (const casing of this.shellCasings) {
      this.scene.remove(casing.mesh);
      (casing.mesh.material as THREE.MeshStandardMaterial).dispose();
    }
    this.shellCasings = [];

    this.muzzlePrimaryGeom.dispose();
    this.muzzleSecondaryGeom.dispose();
    this.sparkGeom.dispose();
    this.debrisGeom.dispose();
    this.casingGeom.dispose();
    this.muzzlePrimaryMat.dispose();
    this.muzzleSecondaryMat.dispose();
    this.tracerMat.dispose();
    this.sparkMat.dispose();
    this.debrisMat.dispose();
    this.casingMat.dispose();
  }
}

interface DebrisParticle {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  rotationVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
  resting: boolean;
}
