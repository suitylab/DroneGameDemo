import * as THREE from 'three';
import Drone from './Drone';
import InputManager from './InputManager';
import MazeGenerator from './MazeGenerator';
import MazeRenderer from './MazeRenderer';
import Minimap from './Minimap';
import LevelIntro from './LevelIntro';
import Weapon from './Weapon';
import BulletEffects from './BulletEffects';
import ShaderPrecompiler from './ShaderPrecompiler';
import AudioManager from './AudioManager';
import TargetDummy from './TargetDummy';
import WeaponInventory from './WeaponInventory';
import WeaponPickup from './WeaponPickup';
import ItemDrop from './ItemDrop';
import { WEAPON_CONFIGS, WEAPON_IDS, WeaponConfig, WeaponType } from './WeaponConfigs';
import type { MazeData, ArenaType } from './MazeGenerator';
import EnemyManager from './EnemyManager';
import type { EnemySpawnPoint } from './EnemyManager';
import Enemy from './Enemy';
import HUD from './HUD';
import UIManager from './UIManager';
import BossManager, { BossTypeId } from './BossManager';
import type { EnemyTypeId } from './EnemyTypes';
import LevelManager, { generateEnemyComposition } from './LevelManager';
import { getLevelConfig, LevelConfig } from './LevelConfigs';
import { ALL_WEAPONS } from './LevelConfigs';

/**
 * ProjectileEntity
 *
 * Represents a traveling projectile in the game world.
 * Used for rocket and plasma projectiles that have visible meshes
 * and travel through the world with collision detection.
 */
interface ProjectileEntity {
  /** The visible mesh for the projectile */
  mesh: THREE.Mesh;
  /** The velocity vector (units per second) */
  velocity: THREE.Vector3;
  /** The weapon config that fired this projectile */
  config: WeaponConfig;
  /** Whether this is a rocket (has AoE explosion) */
  isRocket: boolean;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
}

/**
 * Game
 *
 * Main orchestration module for the MAZE STRIKE game (Phase 8).
 * Integrates procedural maze generation, maze rendering, minimap,
 * level intro overlay, player collision, weapon inventory system,
 * weapon pickups, weapon switching, weapon-specific projectile
 * behavior, enemy AI, HUD, and UI screen management into the core game loop.
 */
export default class Game {
  /** The container div that holds the renderer canvas */
  private container: HTMLDivElement;

  /** The HUD manager for all HUD elements */
  private hud: HUD;

  /** The UI screen state manager */
  private uiManager: UIManager;

  /** The Three.js renderer */
  private renderer: THREE.WebGLRenderer;

  /** The Three.js scene */
  private scene: THREE.Scene;

  /** The perspective camera (top-down view) */
  private camera: THREE.PerspectiveCamera;

  /** The drone player character */
  private drone: Drone;

  /** The input manager for keyboard and mouse */
  private input: InputManager;

  /** The maze data (grid, rooms, doors, etc.) */
  private mazeData: MazeData;

  /** The maze renderer (3D meshes + collision) */
  private mazeRenderer: MazeRenderer;

  /** The minimap overlay */
  private minimap: Minimap;

  /** The level intro overlay */
  private levelIntro: LevelIntro;

  /** Flag indicating whether the intro countdown has completed */
  private introComplete: boolean = false;

  /** The player's weapon inventory system */
  private inventory: WeaponInventory;

  /** Visual bullet effects manager (muzzle flash, tracers, impacts, casings) */
  private bulletEffects: BulletEffects;

  /** Audio manager for sound effects and BGM */
  private audio: AudioManager;

  /** Active target dummy entities */
  private targetDummies: TargetDummy[] = [];

  /** Active weapon pickup entities */
  private weaponPickups: WeaponPickup[] = [];

  /** Active item drops (ammo packs, armor) */
  private itemDrops: ItemDrop[] = [];

  /** Enemy manager for Phase 5 enemy AI */
  private enemyManager: EnemyManager | null = null;

  /** Boss manager for Phase 7 boss fights */
  private bossManager: BossManager | null = null;

  /** Player health (100 max) */
  private playerHealth: number = 100;

  /** Player max health */
  private readonly maxPlayerHealth: number = 100;

  /** Player armor (100 max) */
  private playerArmor: number = 100;

  /** Player max armor */
  private readonly maxPlayerArmor: number = 100;

  /** Screen shake state */
  private screenShakeIntensity: number = 0;
  private screenShakeDuration: number = 0;
  private screenShakeTimer: number = 0;

  /** Active projectile entities (rockets, plasma orbs) */
  private projectiles: ProjectileEntity[] = [];

  /** Timer for crosshair expansion animation (seconds remaining) */
  private crosshairExpandTimer: number = 0;

  /** Timestamp of the last fired shot (for potential recoil/sound timing) */
  private lastFireTime: number = 0;

  /** Clock for delta time calculation */
  private clock: THREE.Clock = new THREE.Clock();

  /** The animation frame ID for cancellation */
  private frameId: number | null = null;

  /** Bound resize handler for cleanup */
  private resizeHandler: () => void;

  /** The current level number (1-10) */
  private level: number = 1;

  /** Time elapsed in the current level (seconds) */
  private levelTime: number = 0;

  /** Total shots fired in the current level */
  private shotsFired: number = 0;

  /** Total shots that hit an enemy in the current level */
  private shotsHit: number = 0;

  /** Total enemies destroyed in the current level */
  private enemiesDestroyed: number = 0;

  /** Whether the game is paused */
  private isPaused: boolean = false;

  /** Whether the game is over (drone destroyed) */
  private isGameOver: boolean = false;

  /** Whether the current level is complete */
  private isLevelComplete: boolean = false;

  /** Whether all enemies have been eliminated (waiting for player to reach exit) */
  private allEnemiesEliminated: boolean = false;

    /** Whether the game has been won (all levels cleared) */
  private isVictory: boolean = false;

  /** Level manager for progression and difficulty scaling */
  private levelManager: LevelManager = new LevelManager();

  /**
   * Creates a new Game instance.
   * @param container - The #app container div
   * @param hud - The HUD manager instance
   * @param uiManager - The UI screen state manager instance
   */
  constructor(container: HTMLDivElement, hud: HUD, uiManager: UIManager) {
    this.container = container;
    this.hud = hud;
    this.uiManager = uiManager;

    // Initialize all systems in order
    this.renderer = this.createRenderer();
    this.scene = this.createScene();
    this.camera = this.createCamera();
    this.addLights();

    // Create the drone (positioned at origin initially; startLevel positions it)
    this.drone = new Drone(this.scene);
    this.drone.position.set(0, 0, 0);

    // Create the bullet effects manager
    this.bulletEffects = new BulletEffects(this.scene);

    // Create the audio manager
    this.audio = new AudioManager();

                // Pre-compile all bullet effect shaders to eliminate first-shot stutter
    try {
      ShaderPrecompiler.precompile(this.renderer, this.scene, this.camera);
    } catch (error) {
      console.warn('Shader precompilation failed:', error);
    }

    // Create the weapon inventory (starts with M9 Sidearm)
    this.inventory = new WeaponInventory(this.scene);

    // Attach the current weapon to the drone's weapon mount
    const currentWeapon = this.inventory.getCurrentWeapon();
    if (currentWeapon) {
      this.drone.attachWeapon(currentWeapon);
    }

        // Set up the weapon switched callback to re-attach the new weapon
    this.inventory.setOnWeaponSwitched(() => {
      const newWeapon = this.inventory.getCurrentWeapon();
      if (newWeapon) {
        this.drone.attachWeapon(newWeapon);
      }
    });

    // Warm up shaders using real bullet effect code paths
    this.warmupShaders();

    this.input = new InputManager(this.renderer.domElement);

    // Bind resize handler
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);

    // Initialize HUD with initial values
    this.playerHealth = 100;
    this.hud.updateHealth(100, 100);
    this.hud.updateArmor(100, 100);
    this.hud.updateWeapon('M9 SIDEARM', 12, 48);
    this.hud.updateEnemyCount(0);
    this.hud.updateLevel(1);

    // Initialize audio system
    this.audio.init();

        // Show the main menu
    this.uiManager.showMainMenu();
  }

  /**
   * Warms up shader programs by firing actual bullet effects during initialization.
   * This forces THREE.js to compile all bullet-related shaders using the REAL
   * material instances and rendering paths, guaranteeing no first-shot stutter.
   */
  private warmupShaders(): void {
    try {
      // Log the precompiler state for debugging
      console.info(`[Warmup] ShaderPrecompiler retained materials: ${ShaderPrecompiler.getRetainedMaterialCount()}`);
      console.info(`[Warmup] Renderer program cache before warmup: ${this.renderer.info.programs?.length ?? 0} programs`);

      // Fire a test shot at a position far away from the player
      const testPosition = new THREE.Vector3(0, 0.5, 5);
      const testDirection = new THREE.Vector3(0, 0, 1);

      // Spawn muzzle flash
      this.bulletEffects.spawnMuzzleFlash(testPosition, testDirection);

      // Spawn tracer
      const tracerEnd = testPosition.clone().add(testDirection.clone().multiplyScalar(3));
      this.bulletEffects.spawnTracer(testPosition, tracerEnd);

      // Spawn impact
      this.bulletEffects.spawnImpact(tracerEnd, new THREE.Vector3(0, 1, 0));

      // Spawn shell casing
      this.bulletEffects.spawnShellCasing(testPosition, new THREE.Vector3(0.5, 1, 0));

            // Create test projectile meshes for ALL 6 weapon types
      // This ensures every weapon's projectile material is compiled
      for (const config of WEAPON_CONFIGS) {
        const projectileGeometry = new THREE.SphereGeometry(config.projectileSize, 8, 8);
        const projectileMaterial = new THREE.MeshStandardMaterial({
          color: config.projectileColor,
          emissive: config.projectileColor,
          emissiveIntensity: config.isPlasma ? 2.5 : config.isRocket ? 2.0 : 1.5,
          roughness: 0.3,
          metalness: 0.1,
        });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.position.copy(testPosition);
        this.scene.add(projectile);

        // Render a frame to force shader compilation for this weapon
        this.renderer.render(this.scene, this.camera);

        // Clean up the test projectile (dispose geometry only, NOT the material)
        // Disposing the material would evict its compiled shader from the cache
        this.scene.remove(projectile);
        projectileGeometry.dispose();
        // Intentionally NOT disposing projectileMaterial to keep the compiled
        // shader program in the renderer's cache for reuse at runtime
      }

      // Update bullet effects to trigger their update paths
      this.bulletEffects.update(0.016);

      // Render a few more frames
      for (let i = 0; i < 3; i++) {
        this.renderer.render(this.scene, this.camera);
      }

      // Log the result
      console.info(`[Warmup] Renderer program cache after warmup: ${this.renderer.info.programs?.length ?? 0} programs`);
    } catch (error) {
      console.warn('[Warmup] Shader warmup failed:', error);
    }
  }

  /**
   * Creates and configures the WebGL renderer.
   * @returns The configured renderer
   */
  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    // Set pixel ratio for sharp rendering on high-DPI displays
    renderer.setPixelRatio(window.devicePixelRatio);

    // Set size to container dimensions
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);

    // Enable shadows with PCF soft shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Set dark clear color
    renderer.setClearColor(0x0a0e14, 1);

    // Append canvas to container
    this.container.appendChild(renderer.domElement);

    return renderer;
  }

  /**
   * Creates the scene with background color and fog.
   * @returns The configured scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);

    // Subtle dark blue fog for depth
    scene.fog = new THREE.Fog(0x0a0e14, 20, 60);

    return scene;
  }

  /**
   * Creates the top-down perspective camera.
   * @returns The configured camera
   */
  private createCamera(): THREE.PerspectiveCamera {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);

    // Position camera directly above the origin, looking down
    camera.position.set(0, 18, 0);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Adds all lighting to the scene.
   */
  private addLights(): void {
    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0x404860, 0.6);
    this.scene.add(ambient);

    // Directional light casting shadows
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(10, 20, 10);
    directional.castShadow = true;

    // Configure shadow camera bounds
    directional.shadow.camera.left = -20;
    directional.shadow.camera.right = 20;
    directional.shadow.camera.top = 20;
    directional.shadow.camera.bottom = -20;
    directional.shadow.camera.near = 0.1;
    directional.shadow.camera.far = 50;

    // Shadow map resolution
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;

    this.scene.add(directional);

    // Subtle cyan point light for high-tech accent glow
    const pointLight = new THREE.PointLight(0x00ffcc, 0.5, 15);
    pointLight.position.set(0, 5, 0);
    this.scene.add(pointLight);
  }

  /**
   * Handles window resize events.
   */
  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Update renderer size
    this.renderer.setSize(width, height);

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Spawns a projectile mesh in the scene.
   *
   * Creates a sphere mesh with the weapon's projectile color and size.
   * For rockets, uses a larger mesh with yellow/orange glow.
   * For plasma, uses a glowing blue orb with emissive material.
   *
   * @param position - The spawn position
   * @param config - The weapon config for visual properties
   * @returns The created projectile mesh
   */
  private spawnProjectileMesh(position: THREE.Vector3, config: WeaponConfig): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshStandardMaterial;

    if (config.isRocket) {
      // Rocket: larger mesh with yellow/orange glow
      geometry = new THREE.SphereGeometry(config.projectileSize, 12, 12);
      material = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xff6600,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.1,
      });
    } else if (config.isPlasma) {
      // Plasma: glowing blue orb with emissive material
      geometry = new THREE.SphereGeometry(config.projectileSize, 12, 12);
      material = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x00aaff,
        emissiveIntensity: 2.5,
        roughness: 0.3,
        metalness: 0.1,
      });
    } else {
      // Normal projectile: small sphere with weapon color
      geometry = new THREE.SphereGeometry(config.projectileSize, 8, 8);
      material = new THREE.MeshStandardMaterial({
        color: config.projectileColor,
        emissive: config.projectileColor,
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.1,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Fires the current weapon toward the mouse cursor position.
   *
   * Uses the inventory's tryFire method to respect cooldown and ammo.
   * Implements weapon-specific firing behavior:
   * - Shotgun: fires multiple pellets in a spread
   * - Rocket: spawns a rocket projectile with AoE explosion
   * - Plasma: spawns glowing orb projectiles
   * - Normal: fires a single tracer with raycast
   *
   * @param deltaTime - Time since last frame in seconds
   */
  private fireWeapon(deltaTime: number): void {
    // Attempt to fire the weapon (respects cooldown, ammo, and reload state)
    if (!this.inventory.tryFire(deltaTime)) {
      return;
    }

    // Play shoot sound
    this.audio.playShoot();

    // Get the current weapon config
    const config = this.inventory.getCurrentConfig();
    if (!config) {
      return;
    }

    // Get the muzzle world position from the drone's weapon mount
    const muzzlePosition = this.drone.getMuzzleWorldPosition();
    if (!muzzlePosition) {
      return;
    }

    // Get the mouse world position on the ground plane
    const mouseWorldPosition = this.input.getMouseWorldPosition(this.camera);
    if (!mouseWorldPosition) {
      return;
    }

    // Compute aim direction from muzzle toward mouse ground position
    const aimDirection = new THREE.Vector3()
      .subVectors(mouseWorldPosition, muzzlePosition)
      .normalize();

    // --- Weapon-Specific Firing Behavior ---

    if (config.isShotgun) {
      // --- Shotgun: Fire multiple pellets in a spread ---
      const pelletCount = config.pelletCount;
      const spreadAngleRad = config.spreadAngle * (Math.PI / 180);

      for (let i = 0; i < pelletCount; i++) {
        // Calculate spread angle for this pellet (evenly distributed)
        const angle = (i / (pelletCount - 1) - 0.5) * spreadAngleRad;

        // Rotate the aim direction by this angle around the Y axis
        const pelletDirection = aimDirection.clone().applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          angle
        );

        // Raycast this pellet
        this.raycastShot(muzzlePosition, pelletDirection, config);
      }
    } else if (config.isRocket) {
      // --- Rocket: Spawn a rocket projectile ---
      const projectileMesh = this.spawnProjectileMesh(muzzlePosition, config);
      const velocity = aimDirection.clone().multiplyScalar(config.projectileSpeed);

      this.projectiles.push({
        mesh: projectileMesh,
        velocity,
        config,
        isRocket: true,
        life: 3.0,
        maxLife: 3.0,
      });
    } else if (config.isPlasma) {
      // --- Plasma: Spawn glowing orb projectiles ---
      const projectileMesh = this.spawnProjectileMesh(muzzlePosition, config);
      const velocity = aimDirection.clone().multiplyScalar(config.projectileSpeed);

      this.projectiles.push({
        mesh: projectileMesh,
        velocity,
        config,
        isRocket: false,
        life: 3.0,
        maxLife: 3.0,
      });
    } else {
      // --- Normal Weapon: Fire a single tracer with raycast ---
      this.raycastShot(muzzlePosition, aimDirection, config);
    }

    // --- Common Visual Effects for All Weapon Types ---

    // Muzzle flash at the muzzle position
    this.bulletEffects.spawnMuzzleFlash(muzzlePosition, aimDirection);

    // Shell casing ejected to the right side of the drone
    const rightVector = new THREE.Vector3(aimDirection.z, 0, -aimDirection.x).normalize();
    this.bulletEffects.spawnShellCasing(muzzlePosition, rightVector);

    // Notify enemies of gunfire (hearing radius)
    this.enemyManager?.hearGunfire(muzzlePosition);

    // --- HUD Feedback ---

    // Track shots fired
    this.shotsFired++;

    // Trigger crosshair expansion
    this.crosshairExpandTimer = 0.15;
    this.hud.setCrosshairExpanded(true);

    // Record fire time
    this.lastFireTime = performance.now();

    // Update ammo display
    const weapon = this.inventory.getCurrentWeapon();
    if (weapon) {
      this.hud.updateWeapon(
        config.name,
        weapon.getMagazineAmmo(),
        weapon.getReserveAmmo()
      );
    }
  }

  /**
   * Performs a raycast shot for a single projectile direction.
   *
   * Marches along the ray in small steps to find the impact point
   * (wall or target dummy). Spawns a tracer and applies damage.
   *
   * @param muzzlePosition - The starting position of the ray
   * @param direction - The normalized direction of the ray
   * @param config - The weapon config (for damage)
   */
  private raycastShot(
    muzzlePosition: THREE.Vector3,
    direction: THREE.Vector3,
    config: WeaponConfig
  ): void {
    // --- Raycast to find impact point ---
    const maxRange = 50;
    const stepSize = 0.1;
    const steps = Math.floor(maxRange / stepSize);

    let impactPoint: THREE.Vector3 | null = null;
    let hitEnemy: Enemy | null = null;
    let hitBoss = false;

    // March along the ray in small steps
    for (let i = 1; i <= steps; i++) {
      const t = i * stepSize;
      const samplePoint = muzzlePosition.clone().add(direction.clone().multiplyScalar(t));

      // Check if the sample point is inside a wall (not walkable)
      if (!this.mazeRenderer.isWalkable(samplePoint.x, samplePoint.z)) {
        impactPoint = samplePoint;
        break;
      }

      // Check if the ray passes near any alive enemy
      if (this.enemyManager) {
        for (const enemy of this.enemyManager.getEnemies()) {
          if (!enemy.getIsAlive()) continue;

          const enemyPos = enemy.getPosition();
          const dx = samplePoint.x - enemyPos.x;
          const dz = samplePoint.z - enemyPos.z;
          const distSq = dx * dx + dz * dz;

          // Enemy hit radius: 0.6 units (horizontal distance check)
          if (distSq < 0.36) {
            impactPoint = samplePoint;
            hitEnemy = enemy;
            break;
          }
        }
      }

      // Stop if we hit an enemy
      if (hitEnemy) break;

      // Check if the ray passes near the boss
      if (this.bossManager && this.bossManager.getIsAlive()) {
        const boss = this.bossManager.getBoss();
        if (boss) {
          const bossPos = boss.getPosition();
          const dx = samplePoint.x - bossPos.x;
          const dz = samplePoint.z - bossPos.z;
          const distSq = dx * dx + dz * dz;

          // Boss hit radius: 2.0 units (large target)
          if (distSq < 4.0) {
            impactPoint = samplePoint;
            hitBoss = true;
            break;
          }
        }
      }
    }

    // If no impact found within range, use the max range point
    if (!impactPoint) {
      impactPoint = muzzlePosition
        .clone()
        .add(direction.clone().multiplyScalar(maxRange));
    }

    // --- Apply damage to hit enemy ---
    if (hitEnemy) {
      hitEnemy.takeDamage(config.damage);

      // Track shots hit for accuracy
      this.shotsHit++;
    }

    // --- Apply damage to hit boss ---
    if (hitBoss) {
      this.bossManager?.takeDamage(config.damage);
      this.shotsHit++;
    }

    // --- Spawn Tracer ---
    this.bulletEffects.spawnTracer(muzzlePosition, impactPoint);

    // --- Spawn Impact Sparks ---
    const impactNormal = muzzlePosition.clone().sub(impactPoint).normalize();
    this.bulletEffects.spawnImpact(impactPoint, impactNormal);
  }

  /**
   * Updates all active projectiles.
   *
   * Moves projectiles by velocity * deltaTime, checks wall collisions,
   * checks dummy collisions, handles rocket explosions, and removes
   * expired projectiles.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  private updateProjectiles(deltaTime: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Decrement life
      projectile.life -= deltaTime;

      // Remove if life expired
      if (projectile.life <= 0) {
        this.removeProjectile(i);
        continue;
      }

      // Move the projectile
      const movement = projectile.velocity.clone().multiplyScalar(deltaTime);
      projectile.mesh.position.add(movement);

      const pos = projectile.mesh.position;

      // --- Wall Collision Check ---
      if (!this.mazeRenderer.isWalkable(pos.x, pos.z)) {
        if (projectile.isRocket) {
          this.explodeRocket(projectile, i);
        } else {
          // Spawn impact effect
          const impactNormal = projectile.velocity.clone().negate().normalize();
          this.bulletEffects.spawnImpact(pos, impactNormal);
          this.removeProjectile(i);
        }
        continue;
      }

      // --- Enemy Collision Check ---
      let hitEnemy: Enemy | null = null;
      if (this.enemyManager) {
        for (const enemy of this.enemyManager.getEnemies()) {
          if (!enemy.getIsAlive()) continue;

          const enemyPos = enemy.getPosition();
          const dx = pos.x - enemyPos.x;
          const dz = pos.z - enemyPos.z;
          const distSq = dx * dx + dz * dz;

          // Check if projectile is within hit radius of enemy
          const hitRadius = 0.6 + projectile.config.projectileSize;
          if (distSq < hitRadius * hitRadius) {
            hitEnemy = enemy;
            break;
          }
        }
      }

      // --- Boss Collision Check ---
      let hitBoss = false;
      if (this.bossManager && this.bossManager.getIsAlive()) {
        const boss = this.bossManager.getBoss();
        if (boss) {
          const bossPos = boss.getPosition();
          const dx = pos.x - bossPos.x;
          const dz = pos.z - bossPos.z;
          const distSq = dx * dx + dz * dz;

          // Boss hit radius: 2.0 units (large target)
          if (distSq < 4.0) {
            hitBoss = true;
          }
        }
      }

      if (hitEnemy) {
        if (projectile.isRocket) {
          this.explodeRocket(projectile, i);
        } else {
          // Apply damage to the enemy
          hitEnemy.takeDamage(projectile.config.damage);

          // Track shots hit for accuracy
          this.shotsHit++;

          // Spawn impact effect
          const impactNormal = projectile.velocity.clone().negate().normalize();
          this.bulletEffects.spawnImpact(pos, impactNormal);

          // Remove the projectile
          this.removeProjectile(i);
        }
        continue;
      }

            // Apply damage to boss if hit
      if (hitBoss) {
        if (projectile.isRocket) {
          this.explodeRocket(projectile, i);
        } else {
          // Apply damage to the boss
          this.bossManager?.takeDamage(projectile.config.damage);

          // Track shots hit for accuracy
          this.shotsHit++;

          // Spawn impact effect
          const impactNormal = projectile.velocity.clone().negate().normalize();
          this.bulletEffects.spawnImpact(pos, impactNormal);

          // Remove the projectile
          this.removeProjectile(i);
        }
        continue;
      }
    }
  }

    /**
   * Checks if a position would overlap any alive enemy.
   * Used by the drone's entity collision callback to block movement
   * instead of pushing the player out of enemies.
   *
   * @param x - The X coordinate to check
   * @param z - The Z coordinate to check
   * @returns True if the position would overlap an alive enemy
   */
    private isPositionBlockedByEnemy(x: number, z: number): boolean {
    // Skip if no enemy manager or game is over/level complete
    if (!this.enemyManager || this.isGameOver || this.isLevelComplete) return false;

    // Minimum separation distance (0.4 player + 0.4 enemy collision radii)
    const minSeparation = 0.8;
    const minSeparationSq = minSeparation * minSeparation;

    // Get the player's current position (returns a copy)
    const playerPos = this.drone.position;

    // Iterate over all alive enemies
    for (const enemy of this.enemyManager.getEnemies()) {
      if (!enemy.getIsAlive()) continue;

      const enemyPos = enemy.getPosition();

      // Calculate distance between the proposed position and the enemy
      const dx = x - enemyPos.x;
      const dz = z - enemyPos.z;
      const newDistSq = dx * dx + dz * dz;

      // Skip if the proposed position is not overlapping
      if (newDistSq >= minSeparationSq) continue;

      // Calculate distance between the player's current position and the enemy
      const curDx = playerPos.x - enemyPos.x;
      const curDz = playerPos.z - enemyPos.z;
      const currentDistSq = curDx * curDx + curDz * curDz;

      // Allow escape movement: if currently overlapping this enemy AND
      // the proposed position is farther from the enemy than the current
      // position, then this is an escape move and should be allowed.
      if (currentDistSq < minSeparationSq && newDistSq > currentDistSq) {
        continue;
      }

      // Otherwise, block the movement
      return true;
    }

    return false;
  }

      /**
   * Explodes a rocket projectile.
   *
   * Applies area-of-effect damage to all dummies within the explosion
   * radius (with falloff), spawns an explosion effect, and removes
   * the rocket from the scene.
   *
   * @param projectile - The rocket projectile to explode
   * @param index - The index in the projectiles array
   */
  private explodeRocket(projectile: ProjectileEntity, index: number): void {
    const explosionRadius = projectile.config.explosionRadius;
    const explosionPos = projectile.mesh.position;

    // Apply AoE damage to all enemies within radius
    if (this.enemyManager) {
      for (const enemy of this.enemyManager.getEnemies()) {
        if (!enemy.getIsAlive()) continue;

        const enemyPos = enemy.getPosition();
        const dx = enemyPos.x - explosionPos.x;
        const dz = enemyPos.z - explosionPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Check if enemy is within explosion radius
        if (dist <= explosionRadius) {
          // Apply damage with falloff
          const falloff = 1 - dist / explosionRadius;
          const damage = projectile.config.damage * falloff;
          enemy.takeDamage(damage);
        }
      }
    }

    // Spawn explosion effect (larger impact)
    this.bulletEffects.spawnImpact(explosionPos, new THREE.Vector3(0, 1, 0));

    // Remove the rocket
    this.removeProjectile(index);
  }

  /**
   * Removes a projectile from the scene and the projectiles array.
   * @param index - The index in the projectiles array
   */
  private removeProjectile(index: number): void {
    const projectile = this.projectiles[index];
    if (!projectile) return;

    // Remove mesh from scene
    this.scene.remove(projectile.mesh);

    // Dispose geometry and material
    projectile.mesh.geometry.dispose();
    (projectile.mesh.material as THREE.MeshStandardMaterial).dispose();

    // Remove from array
    this.projectiles.splice(index, 1);
  }

  /**
   * Handles weapon switching input.
   *
   * Consumes queued weapon slot switches (keys 1-6) and mouse wheel
   * deltas, and applies them to the inventory.
   */
  private handleWeaponSwitching(): void {
    // Check for queued weapon slot switch (keys 1-6)
    const slot = this.input.consumeWeaponSlot();
    if (slot >= 0) {
      this.inventory.switchToSlot(slot);
    }

    // Check for queued mouse wheel delta
    const wheelDelta = this.input.consumeWheelDelta();
    if (wheelDelta !== 0) {
      this.inventory.switchByWheel(wheelDelta);
    }
  }

  /**
   * Updates weapon pickups and checks for collection.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateWeaponPickups(deltaTime: number): void {
    for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
      const pickup = this.weaponPickups[i];

      // Update pickup animation
      pickup.update(deltaTime);

      // Skip if already collected
      if (pickup.isCollected()) {
        continue;
      }

      // Check collection distance from drone
      const pickupPos = pickup.getPosition();
      const dronePos = this.drone.position;
      const dx = pickupPos.x - dronePos.x;
      const dz = pickupPos.z - dronePos.z;
      const distSq = dx * dx + dz * dz;

      // Collection radius: 1.5 units
      if (distSq < 1.5 * 1.5) {
        // Collect the pickup
        pickup.collect();
        this.audio.playPickup();

        // Add the weapon to the inventory
        const config = pickup.getConfig();
        this.inventory.addWeapon(config);

        // Dispose the pickup (removes from scene)
        pickup.dispose();
        this.weaponPickups.splice(i, 1);
      }
    }
  }

  /**
   * Starts the main render loop and begins the level intro countdown.
   */
  public start(): void {
    if (this.frameId !== null) return; // Already running

    const animate = () => {
      // Calculate delta time, clamped to avoid large jumps
      const delta = Math.min(this.clock.getDelta(), 0.05);

      // --- Pause Toggle (ESC key) ---
      if (this.input.isKeyDown('Escape') && this.introComplete && !this.isGameOver && !this.isLevelComplete) {
        if (!this.isPaused) {
          this.pauseGame();
        } else {
          this.resumeGame();
        }
      }

      // --- Track Level Time ---
      if (!this.isPaused && this.introComplete && !this.isGameOver && !this.isLevelComplete) {
        this.levelTime += delta;
      }

      // --- Skip updates when paused ---
      if (!this.isPaused) {
        // Get input
        const moveDirection = this.input.getMoveDirection();
        const mouseWorldPosition = this.input.getMouseWorldPosition(this.camera);

                // Update drone (movement gated by introComplete)
        this.drone.update(
          delta,
          moveDirection,
          mouseWorldPosition,
          this.camera,
          this.introComplete && this.mazeRenderer ? this.mazeRenderer.isWalkable.bind(this.mazeRenderer) : null
        );

                        // Update drone death explosion particles (if exploded)
        if (this.drone.isExploded) {
          this.drone.updateDeathParticles(delta);
        }

                // --- Phase 4: Weapon System Update ---

        // Update inventory (auto-reload logic)
        this.inventory.update(delta);

                // Handle weapon switching input
        this.handleWeaponSwitching();

        // Manual reload on R key (edge-triggered)
        if (this.input.consumeReloadKey()) {
          this.inventory.startReload();
        }

        // Fire on click (edge-triggered) or while holding the mouse button
        if (this.introComplete) {
          if (this.input.consumeClick() || this.input.isMouseDown()) {
            this.fireWeapon(delta);
          }
        }

        // Update bullet effects (muzzle flashes, tracers, impacts, casings)
        this.bulletEffects.update(delta);

        // Update target dummies and remove dead ones
        for (let i = this.targetDummies.length - 1; i >= 0; i--) {
          const dummy = this.targetDummies[i];
          dummy.update(delta);
          if (!dummy.getIsAlive()) {
            // Dispose the dummy (removes from scene and cleans up)
            dummy.dispose();
            this.targetDummies.splice(i, 1);
          }
        }

        // Update enemies (AI state machine, projectiles, alert propagation)
        this.enemyManager?.update(delta);

        // Update boss manager
        this.bossManager?.update(delta);

        // Update screen shake
        if (this.screenShakeTimer > 0) {
          this.screenShakeTimer -= delta;
          const shakeProgress = this.screenShakeTimer / this.screenShakeDuration;
          const shakeAmount = this.screenShakeIntensity * shakeProgress;
          this.camera.position.x = this.drone.position.x + (Math.random() - 0.5) * shakeAmount * 2;
          this.camera.position.z = this.drone.position.z + (Math.random() - 0.5) * shakeAmount * 2;
        }

        // Update weapon pickups and check collection
        this.updateWeaponPickups(delta);

        // Update item drops and check collection
        this.updateItemDrops(delta);

        // Update projectiles
        this.updateProjectiles(delta);

                // Update maze renderer (door animations)
        if (this.mazeRenderer) {
          this.mazeRenderer.update(delta, this.drone.position);
        }

        // Update minimap
        if (this.minimap) {
          this.minimap.update(this.drone.position);
        }

        // Camera follows drone (top-down view) - skip during screen shake
        if (this.screenShakeTimer <= 0) {
          this.camera.position.x = this.drone.position.x;
          this.camera.position.z = this.drone.position.z;
        }
        this.camera.lookAt(this.drone.position.x, 0, this.drone.position.z);
      }

      // --- HUD Updates (always active) ---

      // Update crosshair expansion animation
      if (this.crosshairExpandTimer > 0) {
        this.crosshairExpandTimer -= delta;
        if (this.crosshairExpandTimer <= 0) {
          this.hud.setCrosshairExpanded(false);
        }
      }

      // Update ammo display from inventory
      const weapon = this.inventory.getCurrentWeapon();
      const config = this.inventory.getCurrentConfig();
      if (weapon && config) {
        this.hud.updateWeapon(
          config.name,
          weapon.getMagazineAmmo(),
          weapon.getReserveAmmo()
        );
      }

      // Show/hide reload indicator and update progress
      if (this.inventory.isReloading()) {
        this.hud.showReloadIndicator();
        this.hud.updateReloadProgress(this.inventory.getReloadProgress());
      } else {
        this.hud.hideReloadIndicator();
      }

      // Update HUD level indicator
      this.hud.updateLevel(this.level);

      // --- Check: All Enemies Eliminated ---
      if (
        this.introComplete &&
        !this.allEnemiesEliminated &&
        !this.isLevelComplete &&
        !this.isGameOver &&
        this.enemyManager &&
        this.enemyManager.getAliveCount() === 0 &&
        this.enemyManager.getTotalCount() > 0 &&
        (!this.bossManager || !this.bossManager.getIsAlive())
      ) {
        this.allEnemiesEliminated = true;
        this.audio.playAllEnemiesEliminated();
        // Show objective notification
        this.hud.showObjective('ALL HOSTILES ELIMINATED \u2014 REACH THE EXIT');
      }

      // --- Check: Player Reached Exit (Level Complete) ---
      if (
        this.allEnemiesEliminated &&
        !this.isLevelComplete &&
        !this.isGameOver
      ) {
        // Convert exitPoint from grid to world coordinates
        const exitWorldX = this.mazeData.exitPoint.x - this.mazeData.gridWidth / 2 + 0.5;
        const exitWorldZ = this.mazeData.exitPoint.z - this.mazeData.gridHeight / 2 + 0.5;
        const dx = this.drone.position.x - exitWorldX;
        const dz = this.drone.position.z - exitWorldZ;
        const distToExit = Math.sqrt(dx * dx + dz * dz);

        // Trigger level complete when player is within 1.5 units of the exit
        if (distToExit < 1.5) {
          this.isLevelComplete = true;
          this.hud.hideObjective();
          this.audio.playLevelComplete();
          this.audio.stopBGM();

          // Calculate accuracy
          const accuracy = this.shotsFired > 0 ? (this.shotsHit / this.shotsFired) * 100 : 0;

          // Show level complete screen
          this.uiManager.showLevelComplete({
            time: this.levelTime,
            enemiesDestroyed: this.enemiesDestroyed,
            totalEnemies: this.enemyManager!.getTotalCount(),
            accuracy: accuracy,
          });

          // Complete the level and check for victory
          const isVictory = this.levelManager.completeCurrentLevel();
          this.uiManager.unlockNextLevel();
          if (isVictory) {
            this.uiManager.showVictory({
              totalTime: this.levelTime,
              totalEnemiesDestroyed: this.enemiesDestroyed,
              totalAccuracy: accuracy,
            });
          }
        }
      }

      // Render the scene
      this.renderer.render(this.scene, this.camera);

      // Schedule next frame
      this.frameId = requestAnimationFrame(animate);
    };

    // Start the loop
    this.frameId = requestAnimationFrame(animate);
  }

  /**
   * Returns the available enemy types for the given level.
   * @param level - The level number (1-10)
   * @returns An array of enemy type IDs available for this level
   */
    private getEnemyTypesForLevel(level: number): EnemyTypeId[] {
    return this.levelManager.getAvailableEnemyTypes();
  }

  /**
   * Returns the number of enemies to spawn for the given level.
   * @param level - The level number (1-10)
   * @returns The number of enemies to spawn
   */
    private getEnemyCountForLevel(level: number): number {
    return this.levelManager.getEnemyCount();
  }

  /**
   * Gets the level manager instance.
   * @returns The LevelManager instance
   */
  public getLevelManager(): LevelManager {
    return this.levelManager;
  }

  /**
   * Generates enemy spawn points for the given level.
   * Distributes enemies across intermediate rooms (not start, not exit).
   * @param level - The level number (1-10)
   * @param mazeData - The maze data containing room information
   * @returns An array of enemy spawn points
   */
  private generateEnemySpawns(level: number, mazeData: MazeData): EnemySpawnPoint[] {
        const enemyTypes = this.getEnemyTypesForLevel(level);
    const enemyCount = this.getEnemyCountForLevel(level);
    const composition = generateEnemyComposition(enemyTypes, enemyCount);
    const spawnPoints: EnemySpawnPoint[] = [];

    // Collect intermediate room indices (skip start room at index 0 and exit room at last index)
    const intermediateRoomIndices: number[] = [];
    for (let i = 1; i < mazeData.rooms.length - 1; i++) {
      intermediateRoomIndices.push(i);
    }

    if (intermediateRoomIndices.length === 0) {
      // Fallback: use the start room if no intermediate rooms exist
      intermediateRoomIndices.push(0);
    }

    // Distribute enemies across the intermediate rooms
    for (let i = 0; i < enemyCount; i++) {
      // Pick a random intermediate room
      const roomIndex = intermediateRoomIndices[Math.floor(Math.random() * intermediateRoomIndices.length)];
      const room = mazeData.rooms[roomIndex];

      // Room center (grid coordinates)
      const centerX = room.x + room.width / 2;
      const centerZ = room.z + room.depth / 2;

      // Random offset within 30% of room dimensions (spread enemies out)
      const offsetX = (Math.random() * 2 - 1) * room.width * 0.3;
      const offsetZ = (Math.random() * 2 - 1) * room.depth * 0.3;

      // Clamp to room interior (keep at least 1 cell away from walls)
      const enemyX = Math.max(
        room.x + 1,
        Math.min(room.x + room.width - 1, centerX + offsetX)
      );
      const enemyZ = Math.max(
        room.z + 1,
        Math.min(room.z + room.depth - 1, centerZ + offsetZ)
      );

            // Use the pre-generated composition for balanced enemy distribution
      const typeId = composition[i];

                  spawnPoints.push({
        x: enemyX - mazeData.gridWidth / 2 + 0.5,
        z: enemyZ - mazeData.gridHeight / 2 + 0.5,
        typeId,
      });
    }

    return spawnPoints;
  }

  /**
   * Starts a level with the given level number.
   * Regenerates the maze, spawns enemies and pickups, and begins the intro.
   * @param level - The level number to start (1-10)
   */
    public startLevel(level: number): void {
    // Start the level through the level manager (validates unlock state)
    try {
      this.levelManager.startLevel(level);
    } catch (error) {
      console.error(`Cannot start level ${level}:`, error);
      return;
    }

        // Set the current level
    this.level = Math.max(1, Math.min(10, Math.floor(level)));

    // Sync the UIManager's current level
    this.uiManager.setCurrentLevel(this.level);

    // Get the level config for this level
    const config = this.levelManager.getCurrentConfig();

    // Update HUD level indicator
    this.hud.updateLevel(this.level);

    // Reset level state
    this.levelTime = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.enemiesDestroyed = 0;
    this.introComplete = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.isLevelComplete = false;
    this.isVictory = false;
    this.allEnemiesEliminated = false;

    // Dispose old level-specific entities
    if (this.mazeRenderer) {
      this.mazeRenderer.dispose();
    }
    if (this.minimap) {
      this.minimap.dispose();
    }
    if (this.levelIntro) {
      this.levelIntro.dispose();
    }
    if (this.enemyManager) {
      this.enemyManager.dispose();
      this.enemyManager = null;
    }

    // Dispose old boss manager
    if (this.bossManager) {
      this.bossManager.dispose();
      this.bossManager = null;
    }

    // Dispose all weapon pickups
    for (const pickup of this.weaponPickups) {
      pickup.dispose();
    }
    this.weaponPickups = [];

    // Dispose all item drops
    for (const drop of this.itemDrops) {
      drop.dispose();
    }
    this.itemDrops = [];

    // Dispose all target dummies
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    this.targetDummies = [];

    // Clean up projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i);
    }
    this.projectiles = [];

        // Determine boss arena type and boss type from level config
    let arenaType: ArenaType | undefined;
    let bossType: BossTypeId | null = null;

    switch (config.boss) {
      case 'colossus':
        arenaType = 'colossus';
        bossType = 'colossus';
        break;
      case 'vanguard':
        arenaType = 'vanguard';
        bossType = 'vanguard';
        break;
      case 'overseer':
        arenaType = 'overseer';
        bossType = 'overseer';
        break;
      default:
        // No boss for this level
        break;
    }

        // Generate maze data with random seed, room count, and arena type
    const mazeGenerator = new MazeGenerator();
    const seed = Math.floor(Math.random() * 1000000);
    this.mazeData = mazeGenerator.generate(seed, {
      roomCount: config.roomCount,
      ...(arenaType ? { arenaType } : {}),
    });

    // Create the maze renderer
    this.mazeRenderer = new MazeRenderer(this.scene, this.mazeData);

    // Create the minimap (appended to the HUD container)
    this.minimap = new Minimap(this.container, this.mazeData);

    // Create the level intro overlay
    this.levelIntro = new LevelIntro(
      this.container,
      this.mazeData.seed,
      this.level,
      () => {
        this.introComplete = true;
      }
    );

    // Reset player health
    this.playerHealth = this.maxPlayerHealth;
    this.hud.updateHealth(this.playerHealth, this.maxPlayerHealth);

    // Reset player armor
    this.playerArmor = this.maxPlayerArmor;
    this.hud.updateArmor(this.playerArmor, this.maxPlayerArmor);

    // Respawn drone (re-add to scene if previously exploded)
    this.drone.respawn();

            // Position the drone at the spawn point (direct assignment triggers the setter)
    // +0.5 aligns with floor cell centers (MazeRenderer places cells at x - gridWidth/2 + 0.5)
    this.drone.position = new THREE.Vector3(
      this.mazeData.spawnPoint.x - this.mazeData.gridWidth / 2 + 0.5,
      0,
      this.mazeData.spawnPoint.z - this.mazeData.gridHeight / 2 + 0.5
    );

    // Generate enemy spawn points based on level
    const enemySpawnPoints = this.generateEnemySpawns(this.level, this.mazeData);

            // Create the enemy manager with HUD callbacks and health multiplier
    this.enemyManager = new EnemyManager(
      this.scene,
      enemySpawnPoints,
      this.mazeRenderer.isWalkable.bind(this.mazeRenderer),
      () => this.drone.position,
      (count) => {
        this.hud.updateEnemyCount(count);
      },
      (message) => {
        this.hud.showKillFeed(message);
      },
      (damage) => {
        this.applyPlayerDamage(damage);
      },
      () => {
        this.audio.playExplosion();
      },
      (x, z) => {
        this.spawnItemDrop(x, z);
      },
      config.healthMultiplier
    );

    // Wire the entity collision callback to the drone so it blocks movement
    // into enemies instead of being pushed out of them
    this.drone.setEntityCollisionCallback((x, z) => this.isPositionBlockedByEnemy(x, z));


    // Spawn the boss for levels 4, 7, and 10
    if (bossType && this.mazeData.bossArena) {
      const arena = this.mazeData.bossArena;
            const bossSpawnX = arena.centerX - this.mazeData.gridWidth / 2 + 0.5;
      const bossSpawnZ = arena.centerZ - this.mazeData.gridHeight / 2 + 0.5;

      this.bossManager = new BossManager(
        this.scene,
        bossType,
        { x: bossSpawnX, z: bossSpawnZ },
        this.mazeRenderer.isWalkable.bind(this.mazeRenderer),
        () => this.drone.position,
        () => {
          // Boss death: update enemy counter and check level completion
          this.hud.updateEnemyCount(this.enemyManager ? this.enemyManager.getAliveCount() : 0);
        },
        (intensity, duration) => {
          // Screen shake
          this.screenShakeIntensity = intensity;
          this.screenShakeDuration = duration;
          this.screenShakeTimer = duration;
        },
        (typeId, x, z) => {
          // Summon enemies via EnemyManager
          if (this.enemyManager) {
            this.enemyManager.spawnSummonedEnemy(typeId, x, z);
          }
        },
        (amount) => {
          // Player damage from boss attacks
          this.applyPlayerDamage(amount);
        },
        this.hud
      );
    }

        // Spawn weapon pickups from maze data (filtered by level config)
    for (const spawn of this.mazeData.weaponSpawns) {
      // Skip weapons not available in this level
            if (!config.weapons.includes(spawn.weaponId as WeaponType)) continue;

      // Look up the weapon config by ID
      const weaponConfig = WEAPON_CONFIGS.find((c) => c.id === spawn.weaponId);
      if (!weaponConfig) continue;

            // Convert grid coordinates to world coordinates (+0.5 aligns with floor cell centers)
      const worldX = spawn.x - this.mazeData.gridWidth / 2 + 0.5;
      const worldZ = spawn.z - this.mazeData.gridHeight / 2 + 0.5;

      // Create the weapon pickup
      this.weaponPickups.push(new WeaponPickup(this.scene, weaponConfig, worldX, worldZ));
    }

    // Update HUD enemy count
    if (this.enemyManager) {
      this.hud.updateEnemyCount(this.enemyManager.getAliveCount());
    }

    // Show gameplay (hide all overlays)
    this.uiManager.showGameplay();

    // Resume audio context and start BGM
    this.audio.resume();
    this.audio.startBGM();

    // Re-run shader precompilation for the new level's scene configuration.
    // Dynamic PointLights from the previous level were removed during dispose.
    // This ensures all shader variants are cached for the current light count.
    try {
      ShaderPrecompiler.precompile(this.renderer, this.scene, this.camera);
    } catch (error) {
      console.warn('Level shader precompilation failed:', error);
    }

    // Start the level intro countdown
    this.levelIntro.start();
  }

  /**
   * Applies damage to the player from boss attacks.
   * @param amount - Amount of damage to apply
   */
  private applyPlayerDamage(amount: number): void {
    if (this.isGameOver || this.isLevelComplete) return;

    // Armor absorbs damage first
    if (this.playerArmor > 0) {
      const absorbed = Math.min(this.playerArmor, amount);
      this.playerArmor -= absorbed;
      amount -= absorbed;
      this.hud.updateArmor(this.playerArmor, this.maxPlayerArmor);
    }

    // Apply remaining damage to health
    this.playerHealth = Math.max(0, this.playerHealth - amount);

    // Play hit sound
    this.audio.playHit();

    // Update HUD
    this.hud.updateHealth(this.playerHealth, this.maxPlayerHealth);

    // Trigger damage vignette
    this.hud.triggerDamageVignette();

        // Check for game over
    if (this.playerHealth <= 0) {
      this.isGameOver = true;
      this.hud.hideObjective();
      this.audio.playGameOver();
      this.audio.stopBGM();
      // Trigger the drone death explosion
      this.drone.explode();
      // Add screen shake for dramatic effect
      this.screenShakeIntensity = 0.8;
      this.screenShakeDuration = 0.6;
      this.screenShakeTimer = 0.6;
      // Show game over after a brief delay to let the explosion play
      setTimeout(() => {
        if (this.isGameOver) {
          this.uiManager.showGameOver();
        }
      }, 800);
    }
  }

  /**
   * Adds armor to the player, capped at maxPlayerArmor.
   * @param amount - The amount of armor to add
   */
  public addArmor(amount: number): void {
    this.playerArmor = Math.min(this.maxPlayerArmor, this.playerArmor + amount);
    this.hud.updateArmor(this.playerArmor, this.maxPlayerArmor);
  }

  /**
   * Spawns an item drop at the given position with a random chance.
   * 30% chance for ammo pack, 15% chance for armor.
   * @param x - World X coordinate
   * @param z - World Z coordinate
   */
  private spawnItemDrop(x: number, z: number): void {
    const roll = Math.random();
    let type: 'ammo' | 'armor' | null = null;

    if (roll < 0.30) {
      type = 'ammo';
    } else if (roll < 0.45) {
      type = 'armor';
    }

    if (type) {
      const drop = new ItemDrop(this.scene, type, x, z);
      this.itemDrops.push(drop);
    }
  }

  /**
   * Updates all active item drops and checks for pickup collection.
   * @param deltaTime - Time since last frame in seconds
   */
  private updateItemDrops(deltaTime: number): void {
    const dronePos = this.drone.position;

    for (let i = this.itemDrops.length - 1; i >= 0; i--) {
      const drop = this.itemDrops[i];

      // Update animation
      drop.update(deltaTime);

      // Check pickup distance
      const dropPos = drop.getPosition();
      const dx = dronePos.x - dropPos.x;
      const dz = dronePos.z - dropPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < drop.getPickupRadius()) {
        // Collect the item
        drop.collect();

        if (drop.getType() === 'ammo') {
          // Add 25% ammo to all weapons
          this.inventory.addAmmoToAll(0.25);
        } else {
          // Add 25% armor
          this.addArmor(Math.max(1, Math.floor(this.maxPlayerArmor * 0.25)));
        }

        // Play pickup sound
        this.audio.playPickup();

        // Remove from array
        this.itemDrops.splice(i, 1);
      }
    }
  }

  /**
   * Pauses the game and shows the pause overlay.
   */
  public pauseGame(): void {
    if (this.isPaused || this.isGameOver || this.isLevelComplete) return;
    this.isPaused = true;
    this.uiManager.showPause();
  }

  /**
   * Resumes the game from pause.
   */
  public resumeGame(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.uiManager.showGameplay();
  }

  /**
   * Restarts the current level.
   */
  public restartLevel(): void {
    this.startLevel(this.level);
  }

  /**
   * Quits to the main menu.
   */
  public quitToMenu(): void {
    this.isPaused = false;
    this.isGameOver = false;
    this.isLevelComplete = false;

    // Stop BGM
    this.audio.stopBGM();

    // Dispose old level-specific entities
    if (this.mazeRenderer) {
      this.mazeRenderer.dispose();
      this.mazeRenderer = null;
    }
    if (this.minimap) {
      this.minimap.dispose();
      this.minimap = null;
    }
    if (this.levelIntro) {
      this.levelIntro.dispose();
      this.levelIntro = null;
    }
    if (this.enemyManager) {
      this.enemyManager.dispose();
      this.enemyManager = null;
    }
    if (this.bossManager) {
      this.bossManager.dispose();
      this.bossManager = null;
    }

    // Dispose all weapon pickups
    for (const pickup of this.weaponPickups) {
      pickup.dispose();
    }
    this.weaponPickups = [];

    // Dispose all item drops
    for (const drop of this.itemDrops) {
      drop.dispose();
    }
    this.itemDrops = [];

    // Dispose all target dummies
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    this.targetDummies = [];

    // Clean up projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i);
    }
    this.projectiles = [];

    // Show the main menu
    this.uiManager.showMainMenu();
  }

  /**
   * Called when the drone takes damage.
   * Triggers the damage vignette effect on the HUD.
   */
  public onDroneDamaged(): void {
    this.hud.triggerDamageVignette();
  }

  /**
   * Disposes all resources and cleans up.
   */
  public dispose(): void {
    // Cancel animation frame
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    // Remove resize listener
    window.removeEventListener('resize', this.resizeHandler);

    // Dispose drone (also disposes the attached weapon)
    this.drone.dispose();

    // Dispose bullet effects
    this.bulletEffects.dispose();

    // Dispose audio
    this.audio.dispose();

    // Dispose all target dummies
    for (const dummy of this.targetDummies) {
      dummy.dispose();
    }
    this.targetDummies = [];

    // Dispose the enemy manager
    this.enemyManager?.dispose();
    this.enemyManager = null;

    // Dispose the boss manager
    this.bossManager?.dispose();
    this.bossManager = null;

    // Dispose all weapon pickups
    for (const pickup of this.weaponPickups) {
      pickup.dispose();
    }
    this.weaponPickups = [];

    // Dispose all item drops
    for (const drop of this.itemDrops) {
      drop.dispose();
    }
    this.itemDrops = [];

    // Clean up projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i);
    }
    this.projectiles = [];

    // Dispose input manager
    this.input.dispose();

    // Dispose maze renderer
    if (this.mazeRenderer) {
      this.mazeRenderer.dispose();
    }

    // Dispose minimap
    if (this.minimap) {
      this.minimap.dispose();
    }

    // Dispose level intro
    if (this.levelIntro) {
      this.levelIntro.dispose();
    }

    // Dispose HUD
    this.hud.dispose();

    // Dispose UIManager
    this.uiManager.dispose();

    // Remove canvas from DOM
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    // Dispose renderer
    this.renderer.dispose();
  }
}