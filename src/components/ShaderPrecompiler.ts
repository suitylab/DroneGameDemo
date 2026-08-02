import * as THREE from 'three';

/**
 * ShaderPrecompiler
 *
 * Forces GPU shader compilation for all bullet/projectile/effect materials
 * BEFORE gameplay begins to eliminate the first-shot stutter.
 *
 * The class adds temporary meshes using every bullet-related material to
 * the ACTUAL game scene (which contains lights), renders once to force GPU
 * shader compilation, then removes the temp meshes while retaining the
 * materials so their compiled programs stay in the renderer's cache.
 *
 * IMPORTANT: The material property values (color, emissive, emissiveIntensity,
 * roughness, metalness, transparent, opacity, side, depthWrite) MUST match the
 * runtime materials EXACTLY. THREE.js WebGLProgram cache keys are derived from
 * these property values AND the scene's light configuration. If either differs,
 * the runtime materials will miss the cache and trigger recompilation.
 *
 * This module is self-contained and has no dependencies on other game
 * modules (only THREE.js).
 */
export default class ShaderPrecompiler {
  /**
   * Retained materials for the app lifetime.
   *
   * IMPORTANT: These materials are intentionally NOT disposed after precompilation.
   * Disposing a material evicts its compiled shader program from the renderer's
   * cache, defeating the purpose of precompilation. Keeping the materials alive
   * ensures the GPU programs stay cached and are reused by runtime clones.
   */
  private static retainedMaterials: THREE.Material[] = [];

  

  /**
   * Pre-compiles all shader programs used by bullet/projectile/effect materials.
   *
   * Adds temporary meshes with every bullet-related material to the ACTUAL game
   * scene (which contains lights), renders once to force GPU shader compilation,
   * then removes the temp meshes. The materials are retained so their compiled
   * programs stay cached.
   *
   * CRITICAL: Must use the actual game scene (not a temp scene) because
   * Three.js compiles different shader variants based on the scene's light
   * configuration. A temp scene with no lights would produce useless variants.
   *
   * @param renderer - The WebGL renderer to use for compilation
   * @param gameScene - The ACTUAL game scene (with lights) for correct shader variants
   * @param camera - The camera to use for rendering
   */
    public static precompile(renderer: THREE.WebGLRenderer, gameScene: THREE.Scene, camera: THREE.Camera): void {
    console.info('[ShaderPrecompiler] Starting shader precompilation...');

    // Use the actual game scene so compiled shaders include the correct light
    // configuration (ambient + directional + point lights). A temp scene with
    // no lights would produce shader variants that are never used at runtime.

    // Create a temporary group positioned off-screen (behind the camera's view)
    const tempGroup = new THREE.Group();
    // Position behind the top-down camera (camera looks from +Y toward origin)
    tempGroup.position.set(0, -100, 0);

    // Shared dummy geometry (tiny box, never visible)
    const dummyGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);

    // Track the number of materials compiled
    let materialCount = 0;

    /**
     * Helper function to create a mesh with the given material,
     * add it to the group, and increment the material count.
     */
    const addMaterial = (material: THREE.Material): void => {
      const mesh = new THREE.Mesh(dummyGeometry, material);
      mesh.position.set(0, 0, 0);
      mesh.frustumCulled = false;
      tempGroup.add(mesh);
      materialCount++;
      // Retain the material so its compiled shader program stays in the
      // renderer's cache for the app lifetime.
      ShaderPrecompiler.retainedMaterials.push(material);
    };

    // -----------------------------------------------------------------------
    // A. BulletEffects materials (from BulletEffects.ts) - EXACT
    // -----------------------------------------------------------------------
    // muzzlePrimaryMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 4.0,
      transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
    }));
    // muzzleSecondaryMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2.5,
      transparent: true, opacity: 0.6, roughness: 0.5, metalness: 0.1,
    }));
    // tracerMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 3.0,
      transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
    }));
    // sparkMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 4.0,
      transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
    }));
    // debrisMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x6a7078, roughness: 0.8, metalness: 0.4,
      transparent: true, opacity: 1.0,
    }));
    // casingMat
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xb8860b, metalness: 0.9, roughness: 0.4,
    }));

    // -----------------------------------------------------------------------
    // B. Weapon projectile materials (from Game.ts spawnProjectileMesh + WeaponConfigs.ts) - EXACT
    // -----------------------------------------------------------------------
    // M9 Sidearm
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Viper SMG
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Titan Shotgun
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Longbow Rifle
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Pulsar Plasma (uses 2.5 intensity)
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 2.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Havoc Rocket (emissive 0xff6600)
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xffcc00, emissive: 0xff6600, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));

    // -----------------------------------------------------------------------
    // C. Enemy projectile materials (from Enemy.ts + EnemyTypes.ts) - EXACT
    // -----------------------------------------------------------------------
    // Ranged enemy types: scout_drone, sentry_mk1, sentry_mk2, warden, phantom
    const rangedEnemyColors = [
      { projectile: 0xff4444, explosion: 0x808890 }, // scout_drone
      { projectile: 0x00ff66, explosion: 0x00ff66 }, // sentry_mk1
      { projectile: 0xff8800, explosion: 0xff8800 }, // sentry_mk2
      { projectile: 0x00aaff, explosion: 0x00aaff }, // warden
      { projectile: 0xaa00ff, explosion: 0xaa00ff }, // phantom
    ];

    for (const colors of rangedEnemyColors) {
      // Projectile
      addMaterial(new THREE.MeshStandardMaterial({
        color: colors.projectile, emissive: colors.projectile, emissiveIntensity: 2.5,
        roughness: 0.3, metalness: 0.1,
      }));
      // Muzzle glow
      addMaterial(new THREE.MeshStandardMaterial({
        color: colors.projectile, emissive: colors.projectile, emissiveIntensity: 3.0,
        transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
      }));
      // Impact spark
      addMaterial(new THREE.MeshStandardMaterial({
        color: colors.projectile, emissive: colors.projectile, emissiveIntensity: 2.0,
        transparent: true, opacity: 1.0, roughness: 0.3, metalness: 0.1,
      }));
      // Death explosion particle
      addMaterial(new THREE.MeshStandardMaterial({
        color: colors.explosion, emissive: colors.explosion, emissiveIntensity: 2.0,
        transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
      }));
    }

    // Melee enemy explosion particles
    // brute
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 2.0,
      transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
    }));
    // reaper
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x880000, emissive: 0x880000, emissiveIntensity: 2.0,
      transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
    }));

    // -----------------------------------------------------------------------
    // D. Enemy telegraph/trail materials (from Enemy.ts) - EXACT
    // -----------------------------------------------------------------------
    // Telegraph line
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff0000, transparent: true, opacity: 0.6, depthWrite: false,
    }));
    // Dash trail (MeshBasicMaterial)
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.7, depthWrite: false,
    }));
    // Dash trail particle (MeshStandardMaterial)
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2.0,
      transparent: true, opacity: 0.8, roughness: 0.3, metalness: 0.1,
    }));

    // -----------------------------------------------------------------------
    // E. Drone death explosion materials (from Drone.ts) - EXACT
    // -----------------------------------------------------------------------
    // Cyan particle
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.5,
      transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
    }));
    // Orange particle
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2.5,
      transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
    }));

    // -----------------------------------------------------------------------
    // F. Boss attack materials (from BossColossus.ts, BossVanguard.ts, BossOverseer.ts) - EXACT
    // -----------------------------------------------------------------------
    // Colossus missile
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xffcc00, emissive: 0xff6600, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Colossus missile trail
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.8,
    }));
    // Vanguard beam
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 3.0,
      transparent: true, opacity: 0.9, roughness: 0.2, metalness: 0.1,
      side: THREE.DoubleSide,
    }));
    // Vanguard trail
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0x00ccff, transparent: true, opacity: 0.7, depthWrite: false,
    }));
    // Overseer laser
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xcc00ff, emissive: 0xcc00ff, emissiveIntensity: 3.0,
      transparent: true, opacity: 0.9, roughness: 0.2, metalness: 0.1,
      side: THREE.DoubleSide,
    }));
    // Overseer continuous laser
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 3.0,
      transparent: true, opacity: 0.9, roughness: 0.2, metalness: 0.1,
      side: THREE.DoubleSide,
    }));
    // Overseer nova ring
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xcc00ff, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    // Boss telegraph ring
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff0000, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    // Boss shockwave
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    // Boss color flash
    addMaterial(new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.4,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    // Boss death particles (3 bosses)
    const bossExplosionColors = [0xff4400, 0x00aaff, 0xaa00ff]; // colossus, vanguard, overseer
    for (const explosionColor of bossExplosionColors) {
      addMaterial(new THREE.MeshStandardMaterial({
        color: explosionColor, emissive: explosionColor, emissiveIntensity: 2.0,
        transparent: true, opacity: 1.0, roughness: 0.4, metalness: 0.6,
      }));
    }

    // -----------------------------------------------------------------------
    // G. Weapon model materials (from Weapon.ts, all 6 weapon types) - EXACT
    // -----------------------------------------------------------------------
    // Silver
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xc0c8d0, metalness: 0.9, roughness: 0.3,
    }));
    // Dark metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x2a2f36, metalness: 0.8, roughness: 0.5,
    }));
    // Grip
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x1a1e24, metalness: 0.6, roughness: 0.7,
    }));
    // Orange glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Black
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x1a1e24, metalness: 0.8, roughness: 0.4,
    }));
    // Cyan glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Heavy metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x3a4048, metalness: 0.8, roughness: 0.5,
    }));
    // Red glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Hazard
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 1.5,
      roughness: 0.4, metalness: 0.3,
    }));
    // Green
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x2a5a3a, metalness: 0.7, roughness: 0.4,
    }));
    // Green glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Blue metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x2a4a6a, metalness: 0.7, roughness: 0.4,
    }));
    // Blue glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 2.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Olive
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x4a4a2a, metalness: 0.6, roughness: 0.6,
    }));
    // Yellow glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));

    // -----------------------------------------------------------------------
    // H. Boss visual materials (from BossColossus.ts, BossVanguard.ts, BossOverseer.ts) - EXACT
    // -----------------------------------------------------------------------
    // Colossus red metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x8b1a1a, metalness: 0.8, roughness: 0.4,
    }));
    // Colossus dark red
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x5a1010, metalness: 0.8, roughness: 0.5,
    }));
    // Colossus core
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Colossus visor
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.5,
      roughness: 0.2, metalness: 0.1,
    }));
    // Colossus orange glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Vanguard blue metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x1a3a6a, metalness: 0.8, roughness: 0.4,
    }));
    // Vanguard dark blue
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x102040, metalness: 0.8, roughness: 0.5,
    }));
    // Vanguard core
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Vanguard visor
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 2.5,
      roughness: 0.2, metalness: 0.1,
    }));
    // Vanguard blue glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Overseer black metal
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, metalness: 0.9, roughness: 0.3,
    }));
    // Overseer core
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2.0,
      roughness: 0.3, metalness: 0.1,
    }));
    // Overseer visor
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xcc00ff, emissive: 0xcc00ff, emissiveIntensity: 2.5,
      roughness: 0.2, metalness: 0.1,
    }));
    // Overseer purple glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));
    // Overseer orange glow
    addMaterial(new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 1.5,
      roughness: 0.3, metalness: 0.1,
    }));

    // -----------------------------------------------------------------------
    // I. Enemy visual materials (from EnemyTypes.ts) - EXACT per enemy type
    // -----------------------------------------------------------------------
    // scout_drone
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.8, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.7, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.5, roughness: 0.6 }));

    // sentry_mk1
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a5a3a, metalness: 0.7, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));

    // sentry_mk2
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x8a4a1a, metalness: 0.7, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));

    // brute
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x8b1a1a, metalness: 0.8, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x5a1010, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));

    // reaper
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3.0, roughness: 0.2, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));

    // warden
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x1a3a6a, metalness: 0.7, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0088ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.3 }));

    // phantom
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x4a1a6a, metalness: 0.7, roughness: 0.4 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.5 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1 }));
    addMaterial(new THREE.MeshStandardMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1 }));

    // -----------------------------------------------------------------------
    // J. Drone visual materials (from Drone.ts) - EXACT
    // -----------------------------------------------------------------------
    // body
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.4 }));
    // core
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.5, roughness: 0.3, metalness: 0.1 }));
    // ring
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.1 }));
    // arm
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.7, roughness: 0.5 }));
    // blade
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.5, roughness: 0.6 }));
    // skid
    addMaterial(new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.7, roughness: 0.5 }));

    

    // -----------------------------------------------------------------------
    // Add the temp group to the game scene so materials are compiled with the
    // correct light configuration (ambient + directional + point lights).
    // -----------------------------------------------------------------------
    gameScene.add(tempGroup);

    // -----------------------------------------------------------------------
    // Compile shader variants for EACH PointLight count (1..N)
    // -----------------------------------------------------------------------
    // Three.js generates DIFFERENT shader variants based on the number of
    // PointLights in the scene. During gameplay, dynamic PointLights are added
    // by muzzle flashes, enemy projectiles, explosions, etc. If we only compile
    // shaders with the initial light count (1 PointLight), any material rendered
    // with more PointLights will trigger recompilation → stutter.
    //
    // We must compile variants for EACH intermediate light count by incrementally
    // adding dummy PointLights and calling renderer.compile() + renderer.render()
    // for each configuration. This ensures the cache contains all variants that
    // the runtime might need (1 PointLight, 2 PointLights, ..., N PointLights).
    const MAX_POINT_LIGHTS = 8; // Covers muzzle flash + enemy projectiles + impacts
    const dummyLights: THREE.PointLight[] = [];

    try {
      for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
        // Add one more dummy PointLight
        const light = new THREE.PointLight(0xffffff, 0.0, 1);
        light.position.set(0, -200 - i, 0); // Far off-screen, zero intensity
        gameScene.add(light);
        dummyLights.push(light);

        // Compile all materials with the current light count (1 + i PointLights)
        renderer.compile(gameScene, camera);
        // Render once to force GPU-side compilation for this variant
        renderer.render(gameScene, camera);
      }
    } catch (error) {
      console.warn('[ShaderPrecompiler] Pre-compilation failed:', error);
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------
    gameScene.remove(tempGroup);

    // Remove dummy lights
    for (const light of dummyLights) {
      gameScene.remove(light);
      light.dispose();
    }

    // IMPORTANT: Do NOT dispose materials here. Disposing materials evicts the
    // compiled shader programs from the renderer's cache, defeating the purpose
    // of precompilation. The materials are retained in retainedMaterials for
    // the app lifetime.
    tempGroup.clear();

    // Dispose the shared geometry (the meshes are gone, only the geometry is freed)
    dummyGeometry.dispose();

    // Log the compilation result with verification of the renderer's program cache
    const programCount = renderer.info.programs?.length ?? 0;
    console.info(`[ShaderPrecompiler] Pre-compiled ${materialCount} materials × ${MAX_POINT_LIGHTS} PointLight variants. Renderer program cache: ${programCount} programs.`);
  }

  /**
   * Checks whether shader precompilation has already run.
   * @returns True if at least one material was retained (precompilation ran), false otherwise
   */
  public static hasPrecompiled(): boolean {
    return ShaderPrecompiler.retainedMaterials.length > 0;
  }

  /**
   * Gets the number of retained materials (for debugging).
   * @returns The count of retained materials
   */
  public static getRetainedMaterialCount(): number {
    return ShaderPrecompiler.retainedMaterials.length;
  }
}

/**
 * Pre-compiles all shader programs used by bullet/projectile/effect materials.
 *
 * Convenience helper function that creates a ShaderPrecompiler and calls
 * precompile.
 *
 * @param renderer - The WebGL renderer to use for compilation
 * @param gameScene - The ACTUAL game scene (with lights) for correct shader variants
 * @param camera - The camera to use for rendering
 */
export function precompileAllShaders(renderer: THREE.WebGLRenderer, gameScene: THREE.Scene, camera: THREE.Camera): void {
  ShaderPrecompiler.precompile(renderer, gameScene, camera);
}