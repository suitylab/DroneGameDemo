import * as THREE from 'three';

/**
 * InputManager
 * 
 * Manages keyboard and mouse input for the MAZE STRIKE game.
 * Handles WASD/Arrow key movement and mouse aiming for the top-down drone.
 */
export default class InputManager {
  /** The renderer canvas used for mouse coordinate calculations */
  private canvas: HTMLCanvasElement;

  /** Set of currently pressed key codes */
  private keys: Set<string> = new Set();

  /** Mouse position in normalized device coordinates (-1 to 1) */
  private mouseNDC: THREE.Vector2 = new THREE.Vector2(0, 0);

  /** Raycaster for unprojecting mouse position to world coordinates */
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

    /** Reference to the y=0 plane for mouse-to-world conversion */
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  /** Whether a left-click is queued for consumption (edge-triggered) */
  private clickQueued: boolean = false;

  /** Whether the left mouse button is currently held down */
  private mouseDown: boolean = false;

  /** Position where the mouse was pressed (to detect drag vs click) */
  private mouseDownPosition: { x: number; y: number } | null = null;

    /** Timestamp when the mouse was pressed (to detect click duration) */
  private mouseDownTime: number = 0;

  /** Queued weapon slot index from Digit1-Digit6 keys (-1 when none) */
  private weaponSlotQueued: number = -1;

    /** Queued mouse wheel delta (0 when none) */
  private wheelDeltaQueued: number = 0;

  /** Whether the R key (manual reload) is queued for consumption (edge-triggered) */
  private reloadQueued: boolean = false;


  /**
   * Creates a new InputManager bound to the given canvas.
   * @param canvas - The Three.js renderer canvas
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  /**
   * Binds all keyboard and mouse event listeners.
   */
  private bindEvents(): void {
    // Keyboard events on window to capture input regardless of focus
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

        // Mouse events on canvas for accurate coordinate calculation
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    this.canvas.addEventListener('wheel', this.handleWheel);

    // Clear keys on window blur to prevent stuck keys
    window.addEventListener('blur', this.handleWindowBlur);
  }

  /**
   * Handles keydown events.
   * @param event - The keyboard event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
        // Prevent default for arrow keys and space to avoid page scroll
    if (event.key.startsWith('Arrow') || event.key === ' ') {
      event.preventDefault();
    }
    this.keys.add(event.code);

    // Detect Digit1-Digit6 keys for weapon switching (slot indices 0-5)
    if (event.code.startsWith('Digit')) {
      const digit = parseInt(event.code.replace('Digit', ''), 10);
            if (digit >= 1 && digit <= 6) {
        this.weaponSlotQueued = digit - 1;
      }
    }

    // Detect R key for manual reload
    if (event.code === 'KeyR') {
      this.reloadQueued = true;
    }
  };

  /**
   * Handles keyup events.
   * @param event - The keyboard event
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  /**
   * Handles mousemove events on the canvas.
   * @param event - The mouse event
   */
  private handleMouseMove = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();

    // Calculate NDC coordinates (-1 to 1)
    this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

    /**
   * Clears all pressed keys when the window loses focus.
   */
  private handleWindowBlur = (): void => {
    this.keys.clear();
  };

  /**
   * Handles mousedown events on the canvas.
   * Only tracks the left mouse button (button === 0).
   * Records the press position and time for click-vs-drag detection.
   * @param event - The mouse event
   */
  private handleMouseDown = (event: MouseEvent): void => {
    // Only handle left mouse button
    if (event.button !== 0) return;

    // Prevent default behavior (e.g., text selection)
    event.preventDefault();

    // Track mouse down state
    this.mouseDown = true;
    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
    this.mouseDownTime = performance.now();
  };

  /**
   * Handles mouseup events on the canvas.
   * Only tracks the left mouse button (button === 0).
   * Detects if the press-release was a click (not a drag):
   * movement < 5px and duration < 500ms.
   * If it's a click, queues it for consumption via consumeClick().
   * @param event - The mouse event
   */
  private handleMouseUp = (event: MouseEvent): void => {
    // Only handle left mouse button
    if (event.button !== 0) return;

    // Prevent default behavior
    event.preventDefault();

    // Reset mouse down state
    this.mouseDown = false;

    // Check if this was a click (not a drag)
    if (this.mouseDownPosition) {
      const dx = Math.abs(event.clientX - this.mouseDownPosition.x);
      const dy = Math.abs(event.clientY - this.mouseDownPosition.y);
      const duration = performance.now() - this.mouseDownTime;

      // Click threshold: movement < 5px and duration < 500ms
      if (dx < 5 && dy < 5 && duration < 500) {
        this.clickQueued = true;
      }
    }

    // Clear the press position
    this.mouseDownPosition = null;
  };

    /**
   * Prevents the right-click context menu from appearing.
   * @param event - The mouse event
   */
  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  /**
   * Handles mouse wheel events on the canvas.
   * Accumulates the wheel delta for weapon switching.
   * @param event - The wheel event
   */
  private handleWheel = (event: WheelEvent): void => {
    // Prevent default to avoid page scroll
    event.preventDefault();

    // Accumulate the wheel delta (positive = next weapon, negative = previous)
    this.wheelDeltaQueued += event.deltaY;
  };

  /**
   * Gets the normalized movement direction from WASD/Arrow keys.
   * W/Up = +Z (forward), S/Down = -Z, A/Left = -X, D/Right = +X.
   * @returns A normalized Vector3 representing movement direction, or (0,0,0) if no keys pressed
   */
  public getMoveDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, 0);

    // Forward (W / ArrowUp) - screen up = world -Z
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) {
      direction.z -= 1;
    }
    // Backward (S / ArrowDown) - screen down = world +Z
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) {
      direction.z += 1;
    }
    // Left (A / ArrowLeft)
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) {
      direction.x -= 1;
    }
    // Right (D / ArrowRight)
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) {
      direction.x += 1;
    }

    // Normalize if there's any movement, guard against zero-length vector
    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }

  /**
   * Gets the mouse position projected onto the y=0 plane in world coordinates.
   * @param camera - The camera used for raycasting
   * @returns A Vector3 of the mouse position on the ground plane
   */
  public getMouseWorldPosition(camera: THREE.Camera): THREE.Vector3 {
    // Set the raycaster from the camera through the mouse NDC position
    this.raycaster.setFromCamera(this.mouseNDC, camera);

    // Raycast against the ground plane
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);

    // Return the intersection point, or (0,0,0) if no intersection
    return hit ? intersection : new THREE.Vector3(0, 0, 0);
  }

    /**
   * Checks if a specific key is currently pressed.
   * @param code - The keyboard event code (e.g., 'KeyW', 'ArrowUp')
   * @returns True if the key is pressed, false otherwise
   */
  public isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Consumes a queued left-click event.
   * Edge-triggered: returns true only once per click, then resets.
   * @returns True if a click was queued (and resets the queue), false otherwise
   */
    public consumeClick(): boolean {
    if (this.clickQueued) {
      this.clickQueued = false;
      return true;
    }
    return false;
  }

  /**
   * Consumes a queued manual reload key press (R key).
   * Edge-triggered: returns true only once per press, then resets.
   * @returns True if the R key was pressed (and resets the queue), false otherwise
   */
  public consumeReloadKey(): boolean {
    if (this.reloadQueued) {
      this.reloadQueued = false;
      return true;
    }
    return false;
  }


    /**
   * Checks if the left mouse button is currently held down.
   * Used for continuous fire (hold-to-fire weapons).
   * @returns True if the left mouse button is held, false otherwise
   */
  public isMouseDown(): boolean {
    return this.mouseDown;
  }

  /**
   * Consumes a queued weapon slot switch request.
   * Edge-triggered: returns the queued slot index (0-5) and resets to -1.
   * @returns The queued weapon slot index, or -1 if none queued
   */
  public consumeWeaponSlot(): number {
    const slot = this.weaponSlotQueued;
    this.weaponSlotQueued = -1;
    return slot;
  }

  /**
   * Consumes the queued mouse wheel delta.
   * Edge-triggered: returns the accumulated delta and resets to 0.
   * @returns The queued wheel delta, or 0 if none queued
   */
  public consumeWheelDelta(): number {
    const delta = this.wheelDeltaQueued;
    this.wheelDeltaQueued = 0;
    return delta;
  }

  /**
   * Removes all event listeners and cleans up resources.
   */
  public dispose(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.keys.clear();

    // Reset mouse state
    this.clickQueued = false;
    this.mouseDown = false;
    this.mouseDownPosition = null;
    this.mouseDownTime = 0;

        // Reset weapon switching state
    this.weaponSlotQueued = -1;
    this.wheelDeltaQueued = 0;

    // Reset manual reload state
    this.reloadQueued = false;
  }
}