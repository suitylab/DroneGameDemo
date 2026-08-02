/**
 * MainMenu
 *
 * Full-screen main menu overlay for the MAZE STRIKE game (Phase 6).
 * Features an animated procedural maze background rendered in THREE.js
 * with fog and rotating searchlights, a glowing cyan "MAZE STRIKE" title
 * with animated scanline effect, and three sci-fi styled buttons:
 * "START MISSION", "HOW TO PLAY", and "QUIT".
 *
 * The menu is built programmatically and appended to the provided container.
 * It manages its own THREE.js scene for the background animation.
 */
import * as THREE from 'three';
import Drone from './Drone';

/**
 * Callbacks for the main menu buttons.
 */
export interface MainMenuCallbacks {
  /** Invoked when the "START MISSION" button is clicked */
  onStartMission: () => void;
  /** Invoked when the "HOW TO PLAY" button is clicked */
  onHowToPlay: () => void;
  /** Invoked when the "QUIT" button is clicked */
  onQuit: () => void;
}

/**
 * MainMenu
 *
 * A full-screen overlay with an animated procedural maze background.
 * The menu is hidden by default and must be shown via show().
 */
export default class MainMenu {
  /** The container element to append the menu to */
  private container: HTMLElement;

  /** Callbacks for button clicks */
  private callbacks: MainMenuCallbacks;

  /** The root overlay div element */
  private overlay: HTMLDivElement;

  /** The content wrapper (title + buttons + version) */
  private contentWrapper: HTMLDivElement;

  /** The THREE.js renderer for the background */
  private renderer: THREE.WebGLRenderer;

  /** The THREE.js scene for the background */
  private scene: THREE.Scene;

  /** The THREE.js camera for the background */
  private camera: THREE.PerspectiveCamera;

  /** The THREE.js clock for delta time */
  private clock: THREE.Clock = new THREE.Clock();

  /** Array of searchlight spotlights for rotation */
  private searchlights: THREE.SpotLight[] = [];

  /** Array of searchlight target objects */
  private searchlightTargets: THREE.Object3D[] = [];

  /** The maze walls group for optional rotation */
  private mazeGroup: THREE.Group;

  /** The animation frame ID for the background loop */
  private animationFrameId: number | null = null;

  /** Whether the menu is currently visible */
  private isVisible: boolean = false;

    /** Whether dispose has been called */
  private disposed: boolean = false;

  /** The protagonist drone flying in orbit around the maze */
  private drone: Drone | null = null;

  /** Orbit radius of the drone around the maze center */
  private readonly orbitRadius: number = 7;

  /** Orbit height of the drone above the maze floor */
  private readonly orbitHeight: number = 3.8;

    /** Orbit speed in radians per second */
  private readonly orbitSpeed: number = 0.4;

  /** Spotlight that tracks and illuminates the orbiting drone */
  private droneSpotlight: THREE.SpotLight | null = null;

  /** Target object for the drone spotlight */
  private droneSpotlightTarget: THREE.Object3D | null = null;

  /** Pulsing point lights for dynamic scene illumination */
  private pulseLights: THREE.PointLight[] = [];

  /** Point light attached to the drone for a self-glow effect */
  private droneGlowLight: THREE.PointLight | null = null;

  /**
   * Creates a new MainMenu and appends it to the given container.
   * The menu is hidden by default; call show() to display it.
   *
   * @param container - The HTMLElement to append the menu to
   * @param callbacks - Button click callbacks
   */
  constructor(container: HTMLElement, callbacks: MainMenuCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Build the overlay DOM structure
    this.overlay = this.buildOverlay();

    // Build the THREE.js background scene
    this.renderer = this.createRenderer();
    this.scene = this.createScene();
    this.camera = this.createCamera();

    // Build the maze background
    this.mazeGroup = this.buildMaze();
    this.scene.add(this.mazeGroup);

    // Build the floor
    this.buildFloor();

        // Build the searchlights
    this.buildSearchlights();

        // Build the orbiting protagonist drone
    this.buildDrone();

    // Build dynamic lights to illuminate the scene and drone
    this.buildDynamicLights();

    // Build the content (title, buttons, version)
    this.contentWrapper = this.buildContent();
    this.overlay.appendChild(this.contentWrapper);

    // Append the overlay to the container
    this.container.appendChild(this.overlay);

    // Start hidden
    this.hide();
  }

  /**
   * Builds the root overlay div element.
   * @returns The overlay div
   */
  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 200;
      pointer-events: auto;
      user-select: none;
      overflow: hidden;
      background: #0a0e14;
      font-family: 'Courier New', monospace;
      display: none;
    `;
    return overlay;
  }

  /**
   * Creates the THREE.js WebGL renderer for the background.
   * @returns The configured renderer
   */
  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0e14, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Style the canvas to fill the overlay
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'none';

    // Append the canvas to the overlay
    this.overlay.appendChild(renderer.domElement);

    return renderer;
  }

  /**
   * Creates the THREE.js scene with fog.
   * @returns The configured scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.Fog(0x0a0e14, 15, 40);
    return scene;
  }

  /**
   * Creates the perspective camera for the background.
   * @returns The configured camera
   */
  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    // Position camera above the maze, looking down at an angle
    camera.position.set(0, 12, 12);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Builds the procedural maze walls.
   * Creates a grid of walls with random segments using BoxGeometry.
   * @returns The maze walls group
   */
  private buildMaze(): THREE.Group {
    const group = new THREE.Group();

    // Wall material: dark metal with slight emissive
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      metalness: 0.8,
      roughness: 0.4,
      emissive: 0x0a1a1a,
      emissiveIntensity: 0.2,
    });

    // Grid dimensions
    const gridSize = 10;
    const wallHeight = 2;
    const wallThickness = 0.4;

    // Use a seeded random for consistent generation
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Generate walls in a grid pattern
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Skip some cells to create openings
        if (random() < 0.3) continue;

        // Wall position (centered on grid)
        const x = (i - gridSize / 2) * 2;
        const z = (j - gridSize / 2) * 2;

        // Create wall segment
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness, wallHeight, wallThickness),
          wallMaterial
        );
        wall.position.set(x, wallHeight / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Add a glowing cyan strip on some walls
        if (random() < 0.15) {
          const stripMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffcc,
            emissiveIntensity: 1.5,
          });
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness + 0.02, 0.1, wallThickness + 0.02),
            stripMaterial
          );
          strip.position.set(x, wallHeight - 0.3, z);
          group.add(strip);
        }
      }
    }

    return group;
  }

  /**
   * Builds the dark floor plane.
   */
  private buildFloor(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.5,
      roughness: 0.8,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      floorMaterial
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Add subtle grid lines on the floor
    const gridHelper = new THREE.GridHelper(30, 15, 0x00ffcc, 0x00ffcc);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  /**
   * Builds the rotating searchlight spotlights.
   * Creates 3 spotlights that rotate around the maze.
   */
  private buildSearchlights(): void {
    // Searchlight configuration
    const searchlightCount = 3;
    const searchlightHeight = 8;
    const searchlightRadius = 8;

    for (let i = 0; i < searchlightCount; i++) {
      // Create the spotlight
      const spotlight = new THREE.SpotLight(
        0x00ffcc,
        2.0,
        20,
        Math.PI / 6,
        0.5,
        1
      );
      spotlight.castShadow = true;
      spotlight.shadow.mapSize.width = 512;
      spotlight.shadow.mapSize.height = 512;

      // Position the spotlight high above the maze
      const angle = (i / searchlightCount) * Math.PI * 2;
      spotlight.position.set(
        Math.cos(angle) * searchlightRadius,
        searchlightHeight,
        Math.sin(angle) * searchlightRadius
      );

      // Create a target object for the spotlight to look at
      const target = new THREE.Object3D();
      target.position.set(0, 0, 0);
      this.scene.add(target);
      spotlight.target = target;

      // Add the spotlight and its target to the scene
      this.scene.add(spotlight);
      this.searchlights.push(spotlight);
      this.searchlightTargets.push(target);

      // Add a small visible cone mesh for the searchlight beam
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2, 6, 16, 1, true),
        coneMaterial
      );
      cone.position.copy(spotlight.position);
      cone.rotation.x = Math.PI; // Point downward
      this.scene.add(cone);

      // Store the cone on the spotlight userData for rotation
      spotlight.userData.cone = cone;
    }

    // Add ambient light for base illumination
    const ambient = new THREE.AmbientLight(0x404860, 0.4);
    this.scene.add(ambient);

        // Add a subtle directional light for shadows
    const directional = new THREE.DirectionalLight(0xffffff, 0.3);
    directional.position.set(5, 10, 5);
    this.scene.add(directional);
  }

  /**
   * Builds the protagonist drone that flies in a circular orbit around the maze.
   * The drone is the same polished procedural drone used in gameplay.
   */
  private buildDrone(): void {
    // Instantiate the protagonist drone (adds itself to the scene)
    this.drone = new Drone(this.scene);

    // Position the drone at the start of its orbit
    const startAngle = 0;
    this.drone.group.position.set(
      Math.cos(startAngle) * this.orbitRadius,
      this.orbitHeight,
      Math.sin(startAngle) * this.orbitRadius
    );

        // Face the direction of travel (tangent to the circle)
    this.drone.group.rotation.y = startAngle + Math.PI / 2;
  }

  /**
   * Builds dynamic lights that illuminate the scene and make the drone clearly visible.
   * Includes a tracking spotlight that follows the drone, pulsing point lights,
   * and a glow light attached to the drone itself.
   */
  private buildDynamicLights(): void {
    // --- Tracking spotlight that follows the drone ---
    const spotlight = new THREE.SpotLight(0x00ffcc, 3.0, 25, Math.PI / 5, 0.6, 1.5);
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;
    spotlight.position.set(0, 10, 0);

    // Target object for the spotlight to follow the drone
    const target = new THREE.Object3D();
    target.position.set(this.orbitRadius, this.orbitHeight, 0);
    this.scene.add(target);
    spotlight.target = target;

    this.scene.add(spotlight);
    this.droneSpotlight = spotlight;
    this.droneSpotlightTarget = target;

    // --- Pulsing point lights for dynamic scene illumination ---
    const pulseColors = [0x00ffcc, 0x00aaff, 0x00ff88];
    const pulsePositions = [
      new THREE.Vector3(-6, 4, -6),
      new THREE.Vector3(6, 4, 6),
      new THREE.Vector3(-6, 4, 6)
    ];

    for (let i = 0; i < pulseColors.length; i++) {
      const light = new THREE.PointLight(pulseColors[i], 1.5, 15, 2);
      light.position.copy(pulsePositions[i]);
      this.scene.add(light);
      this.pulseLights.push(light);
    }

    // --- Glow light attached to the drone ---
    if (this.drone) {
      const glow = new THREE.PointLight(0x00ffcc, 2.0, 8, 2);
      glow.position.set(0, 0.3, 0);
      this.drone.group.add(glow);
      this.droneGlowLight = glow;
    }
  }

  /**
   * Builds the content wrapper with title, buttons, and version text.
   * @returns The content wrapper div
   */
  private buildContent(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    `;

    // --- Title ---
    const title = document.createElement('div');
    title.textContent = 'MAZE STRIKE';
    title.style.cssText = `
      font-size: 64px;
      font-weight: bold;
      letter-spacing: 12px;
      color: #00ffcc;
      text-shadow: 0 0 20px rgba(0, 255, 204, 0.8), 0 0 40px rgba(0, 255, 204, 0.4);
            margin-bottom: 12px;
      text-transform: uppercase;
      animation: maze-strike-title-glow 2s ease-in-out infinite alternate;
      pointer-events: none;
    `;
        wrapper.appendChild(title);

    // --- Footer text (below title) ---
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 16px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.6);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.3);
      pointer-events: none;
      text-align: center;
    `;

    const footerLine1 = document.createElement('div');
    footerLine1.textContent = 'SUITY Agentic - Full Game Generation DEMO.';
    footer.appendChild(footerLine1);

    const footerLine2 = document.createElement('div');
    footerLine2.textContent = 'Generated by DeepSeek V4 Flash';
    footer.appendChild(footerLine2);

    wrapper.appendChild(footer);

    // --- Scanline overlay for the title ---
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(0, 255, 204, 0.04) 0px,
        rgba(0, 255, 204, 0.04) 1px,
        transparent 1px,
        transparent 3px
      );
      animation: maze-strike-scanline-move 8s linear infinite;
    `;
    wrapper.appendChild(scanlines);

    // --- Buttons container ---
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      pointer-events: auto;
    `;
    wrapper.appendChild(buttonsContainer);

    // --- Button factory ---
    const createButton = (text: string, onClick: () => void): HTMLButtonElement => {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 16px;
        letter-spacing: 4px;
        color: #00ffcc;
        background: rgba(10, 14, 20, 0.85);
        border: 1px solid rgba(0, 255, 204, 0.5);
        border-radius: 4px;
        padding: 14px 48px;
        cursor: pointer;
        text-transform: uppercase;
        transition: all 0.2s ease-out;
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        text-shadow: 0 0 6px rgba(0, 255, 204, 0.5);
        box-shadow: 0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05);
      `;
      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(0, 255, 204, 0.15)';
        button.style.borderColor = 'rgba(0, 255, 204, 0.9)';
        button.style.boxShadow = '0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 12px rgba(0, 255, 204, 0.1)';
        button.style.color = '#ffffff';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(10, 14, 20, 0.85)';
        button.style.borderColor = 'rgba(0, 255, 204, 0.5)';
        button.style.boxShadow = '0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05)';
        button.style.color = '#00ffcc';
      });
      button.addEventListener('click', onClick);
      return button;
    };

    // Create the three buttons
    const startButton = createButton('START MISSION', () => this.callbacks.onStartMission());
    const howToPlayButton = createButton('HOW TO PLAY', () => this.callbacks.onHowToPlay());
    const quitButton = createButton('QUIT', () => this.callbacks.onQuit());

    buttonsContainer.appendChild(startButton);
    buttonsContainer.appendChild(howToPlayButton);
    buttonsContainer.appendChild(quitButton);

    // --- Version text ---
    const version = document.createElement('div');
    version.textContent = 'v1.0';
    version.style.cssText = `
      position: absolute;
      bottom: 16px;
      right: 24px;
      font-size: 12px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.4);
      text-shadow: 0 0 4px rgba(0, 255, 204, 0.2);
      pointer-events: none;
    `;
            wrapper.appendChild(version);

    return wrapper;
  }

  /**
   * Displays the menu and starts the background animation.
   */
  public show(): void {
    if (this.disposed) return;

    // Show the overlay
    this.overlay.style.display = 'block';
    this.isVisible = true;

    // Start the animation loop if not already running
    if (this.animationFrameId === null) {
      this.clock.start();
      this.animate();
    }
  }

  /**
   * Hides the menu and stops the background animation.
   */
  public hide(): void {
    if (this.disposed) return;

    // Hide the overlay
    this.overlay.style.display = 'none';
    this.isVisible = false;

    // Stop the animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * The main animation loop for the background.
   * Rotates searchlights and orbits the camera.
   */
  private animate(): void {
    if (this.disposed || !this.isVisible) return;

    // Calculate delta time
    const delta = this.clock.getDelta();

    // Rotate searchlights around the maze
    const rotationSpeed = 0.3; // radians per second
    for (let i = 0; i < this.searchlights.length; i++) {
      const spotlight = this.searchlights[i];
      const target = this.searchlightTargets[i];

      // Rotate the spotlight position around the Y axis
      const angle = rotationSpeed * delta * (i % 2 === 0 ? 1 : -1);
      const currentPos = spotlight.position.clone();
      const rotatedPos = currentPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      spotlight.position.copy(rotatedPos);

      // Update the cone mesh position
      if (spotlight.userData.cone) {
        spotlight.userData.cone.position.copy(spotlight.position);
      }

      // Keep the target at the center
      target.position.set(0, 0, 0);
    }

    // Slowly orbit the camera around the maze
    const cameraOrbitSpeed = 0.05; // radians per second
    const cameraRadius = 16;
    const cameraHeight = 12;

    // Calculate the camera angle based on time
    const cameraAngle = this.clock.elapsedTime * cameraOrbitSpeed;
    this.camera.position.set(
      Math.cos(cameraAngle) * cameraRadius,
      cameraHeight,
      Math.sin(cameraAngle) * cameraRadius
    );
        this.camera.lookAt(0, 0, 0);

    // Update the drone's orbit around the maze
    if (this.drone) {
      // Compute the orbit angle based on elapsed time
      const angle = this.clock.elapsedTime * this.orbitSpeed;

      // Set the drone's orbit position (x/z on the circle)
      this.drone.group.position.x = Math.cos(angle) * this.orbitRadius;
      this.drone.group.position.z = Math.sin(angle) * this.orbitRadius;

      // Update the drone's hover-bob and rotor spin animations
      this.drone.updateAnimation(delta);

      // Apply the orbit height plus the hover-bob offset
      this.drone.group.position.y = this.orbitHeight + this.drone.bobOffset;

      // Face the direction of travel (tangent to the circular orbit)
      // For a counter-clockwise orbit, the tangent is angle + PI/2
            const targetAngle = angle + Math.PI / 2;
      this.drone.group.rotation.y = targetAngle;
    }

    // Update dynamic lights
    if (this.drone && this.droneSpotlight && this.droneSpotlightTarget) {
      // Position the tracking spotlight above the drone, slightly offset
      this.droneSpotlight.position.set(
        this.drone.group.position.x,
        this.drone.group.position.y + 6,
        this.drone.group.position.z
      );
      // Point the spotlight at the drone
      this.droneSpotlightTarget.position.copy(this.drone.group.position);
    }

    // Pulse the point lights for dynamic illumination
    const pulseTime = this.clock.elapsedTime;
    for (let i = 0; i < this.pulseLights.length; i++) {
      const light = this.pulseLights[i];
      // Oscillate intensity between 0.8 and 2.2 with different phases per light
      const phase = (i / this.pulseLights.length) * Math.PI * 2;
      light.intensity = 1.5 + Math.sin(pulseTime * 1.5 + phase) * 0.7;
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Schedule the next frame
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Disposes all resources and cleans up.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Stop the animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dispose all THREE resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

            // Dispose the drone
    if (this.drone) {
      this.drone.dispose();
      this.drone = null;
    }

    // Dispose dynamic lights
    if (this.droneSpotlight) {
      this.scene.remove(this.droneSpotlight);
      this.droneSpotlight = null;
    }
    if (this.droneSpotlightTarget) {
      this.scene.remove(this.droneSpotlightTarget);
      this.droneSpotlightTarget = null;
    }
    for (const light of this.pulseLights) {
      this.scene.remove(light);
    }
    this.pulseLights = [];
    if (this.droneGlowLight) {
      this.droneGlowLight = null;
    }

    // Dispose the renderer
    this.renderer.dispose();

    // Remove the overlay from the DOM
    if (this.overlay.parentElement === this.container) {
      this.container.removeChild(this.overlay);
    }

    // Clear references
    this.searchlights = [];
    this.searchlightTargets = [];
  }
}