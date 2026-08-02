/**
 * LevelSelect
 *
 * Full-screen level select overlay for the MAZE STRIKE game (Phase 6).
 * Displays a 5x2 grid of 10 level tiles with locked/unlocked states,
 * a glowing cyan title, and a back button to the main menu.
 *
 * The overlay is built programmatically and appended to the provided container.
 * Level 1 is always unlocked; levels 2-10 unlock progressively as the player
 * completes previous levels.
 */

/**
 * Callbacks for the level select screen.
 */
export interface LevelSelectCallbacks {
  /** Invoked when an unlocked level tile is clicked */
  onSelectLevel: (level: number) => void;
  /** Invoked when the "BACK TO MAIN MENU" button is clicked */
  onBack: () => void;
}

/**
 * LevelSelect
 *
 * A full-screen overlay with a grid of level tiles.
 * Hidden by default; call show() to display.
 */
export default class LevelSelect {
  /** The container element to append the overlay to */
  private container: HTMLElement;

  /** Callbacks for tile and back button clicks */
  private callbacks: LevelSelectCallbacks;

  /** The root overlay div element */
  private overlay: HTMLDivElement;

  /** The grid container holding all level tiles */
  private gridContainer: HTMLDivElement;

  /** Array of tile button elements (index 0 = level 1) */
  private tiles: HTMLButtonElement[] = [];

  /** The highest unlocked level number (1-10) */
  private maxUnlockedLevel: number = 1;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /**
   * Creates a new LevelSelect overlay and appends it to the container.
   * The overlay is hidden by default; call show() to display it.
   *
   * @param container - The HTMLElement to append the overlay to
   * @param callbacks - Callbacks for tile and back button clicks
   */
  constructor(container: HTMLElement, callbacks: LevelSelectCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Build the overlay DOM structure
    this.overlay = this.buildOverlay();

    // Build the title
    this.buildTitle();

    // Build the grid container
    this.gridContainer = this.buildGridContainer();
    this.overlay.appendChild(this.gridContainer);

    // Build all 10 level tiles
    this.buildTiles();

    // Build the back button
    this.buildBackButton();

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
      background: rgba(5, 8, 12, 0.95);
      font-family: 'Courier New', monospace;
      display: none;
    `;

    // Add scanline overlay effect
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(0, 255, 204, 0.03) 0px,
        rgba(0, 255, 204, 0.03) 1px,
        transparent 1px,
        transparent 3px
      );
    `;
    overlay.appendChild(scanlines);

    // Add decorative corner brackets
    const bracketStyle = `
      position: absolute;
      width: 40px;
      height: 40px;
      border: 2px solid rgba(0, 255, 204, 0.3);
      pointer-events: none;
    `;

    const topLeft = document.createElement('div');
    topLeft.style.cssText = `${bracketStyle} top: 24px; left: 24px; border-right: none; border-bottom: none;`;
    overlay.appendChild(topLeft);

    const topRight = document.createElement('div');
    topRight.style.cssText = `${bracketStyle} top: 24px; right: 24px; border-left: none; border-bottom: none;`;
    overlay.appendChild(topRight);

    const bottomLeft = document.createElement('div');
    bottomLeft.style.cssText = `${bracketStyle} bottom: 24px; left: 24px; border-right: none; border-top: none;`;
    overlay.appendChild(bottomLeft);

    const bottomRight = document.createElement('div');
    bottomRight.style.cssText = `${bracketStyle} bottom: 24px; right: 24px; border-left: none; border-top: none;`;
    overlay.appendChild(bottomRight);

    return overlay;
  }

  /**
   * Builds and appends the title element to the overlay.
   */
  private buildTitle(): void {
    const title = document.createElement('div');
    title.textContent = 'SELECT MISSION';
    title.style.cssText = `
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #00ffcc;
      text-shadow: 0 0 20px rgba(0, 255, 204, 0.8), 0 0 40px rgba(0, 255, 204, 0.4);
      text-transform: uppercase;
      white-space: nowrap;
      pointer-events: none;
      animation: level-select-title-glow 2s ease-in-out infinite alternate;
    `;
    this.overlay.appendChild(title);
  }

  /**
   * Builds the grid container for the level tiles.
   * @returns The grid container div
   */
  private buildGridContainer(): HTMLDivElement {
    const grid = document.createElement('div');
    grid.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 16px;
      width: 720px;
      max-width: 90vw;
      padding: 24px;
      background: rgba(10, 14, 20, 0.6);
      border: 1px solid rgba(0, 255, 204, 0.2);
      border-radius: 8px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      box-shadow: 0 0 30px rgba(0, 255, 204, 0.1), inset 0 0 20px rgba(0, 255, 204, 0.05);
    `;
    return grid;
  }

  /**
   * Builds all 10 level tile buttons and appends them to the grid.
   */
  private buildTiles(): void {
    for (let level = 1; level <= 10; level++) {
      const tile = this.createTile(level);
      this.gridContainer.appendChild(tile);
      this.tiles.push(tile);
    }
  }

  /**
   * Creates a single level tile button.
   * @param level - The level number (1-10)
   * @returns The configured tile button
   */
  private createTile(level: number): HTMLButtonElement {
    const tile = document.createElement('button');
    tile.dataset.level = String(level);

    // Base styles for all tiles
    tile.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 14px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 20px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease-out;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 100px;
      position: relative;
      overflow: hidden;
    `;

    // Add click handler
    tile.addEventListener('click', () => this.handleTileClick(level));

    return tile;
  }

  /**
   * Handles a tile click.
   * Only invokes the callback if the tile is unlocked.
   * @param level - The level number of the clicked tile
   */
  private handleTileClick(level: number): void {
    if (this.disposed) return;

    // Only allow clicking unlocked levels
    if (level <= this.maxUnlockedLevel) {
      this.callbacks.onSelectLevel(level);
    }
  }

  /**
   * Builds and appends the back button to the overlay.
   */
  private buildBackButton(): void {
    const backButton = document.createElement('button');
    backButton.textContent = 'BACK TO MAIN MENU';
    backButton.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Courier New', monospace;
      font-size: 14px;
      letter-spacing: 3px;
      color: #00ffcc;
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 255, 204, 0.5);
      border-radius: 4px;
      padding: 12px 32px;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.2s ease-out;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      text-shadow: 0 0 6px rgba(0, 255, 204, 0.5);
      box-shadow: 0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05);
    `;

    // Hover effects
    backButton.addEventListener('mouseenter', () => {
      backButton.style.background = 'rgba(0, 255, 204, 0.15)';
      backButton.style.borderColor = 'rgba(0, 255, 204, 0.9)';
      backButton.style.boxShadow = '0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 12px rgba(0, 255, 204, 0.1)';
      backButton.style.color = '#ffffff';
    });
    backButton.addEventListener('mouseleave', () => {
      backButton.style.background = 'rgba(10, 14, 20, 0.85)';
      backButton.style.borderColor = 'rgba(0, 255, 204, 0.5)';
      backButton.style.boxShadow = '0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05)';
      backButton.style.color = '#00ffcc';
    });

    // Click handler
    backButton.addEventListener('click', () => {
      if (!this.disposed) {
        this.callbacks.onBack();
      }
    });

    this.overlay.appendChild(backButton);
  }

  /**
   * Updates the visual state of all tiles based on the current maxUnlockedLevel.
   */
  private updateTileStates(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      const level = i + 1;
      const isUnlocked = level <= this.maxUnlockedLevel;

      // Clear existing content
      tile.innerHTML = '';

      if (isUnlocked) {
        this.applyUnlockedStyle(tile, level);
      } else {
        this.applyLockedStyle(tile, level);
      }
    }
  }

  /**
   * Applies the unlocked tile style and content.
   * @param tile - The tile button element
   * @param level - The level number
   */
  private applyUnlockedStyle(tile: HTMLButtonElement, level: number): void {
    // Reset styles for unlocked state
    tile.style.background = 'rgba(10, 14, 20, 0.85)';
    tile.style.border = '1px solid rgba(0, 255, 204, 0.5)';
    tile.style.color = '#00ffcc';
    tile.style.textShadow = '0 0 6px rgba(0, 255, 204, 0.5)';
    tile.style.boxShadow = '0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05)';
    tile.style.opacity = '1';
    tile.style.cursor = 'pointer';
    tile.style.pointerEvents = 'auto';
    tile.disabled = false;

    // Level number text
    const levelText = document.createElement('span');
    levelText.textContent = `LEVEL ${level}`;
    levelText.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 2px;
    `;
    tile.appendChild(levelText);

    // Add hover effects
    tile.onmouseenter = () => {
      tile.style.background = 'rgba(0, 255, 204, 0.15)';
      tile.style.borderColor = 'rgba(0, 255, 204, 0.9)';
      tile.style.boxShadow = '0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 12px rgba(0, 255, 204, 0.1)';
      tile.style.color = '#ffffff';
      tile.style.transform = 'scale(1.05)';
    };
    tile.onmouseleave = () => {
      tile.style.background = 'rgba(10, 14, 20, 0.85)';
      tile.style.borderColor = 'rgba(0, 255, 204, 0.5)';
      tile.style.boxShadow = '0 0 12px rgba(0, 255, 204, 0.1), inset 0 0 8px rgba(0, 255, 204, 0.05)';
      tile.style.color = '#00ffcc';
      tile.style.transform = 'scale(1)';
    };
  }

  /**
   * Applies the locked tile style and content.
   * @param tile - The tile button element
   * @param level - The level number
   */
  private applyLockedStyle(tile: HTMLButtonElement, level: number): void {
    // Reset hover handlers
    tile.onmouseenter = null;
    tile.onmouseleave = null;

    // Styles for locked state
    tile.style.background = 'rgba(10, 14, 20, 0.4)';
    tile.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    tile.style.color = 'rgba(255, 255, 255, 0.3)';
    tile.style.textShadow = 'none';
    tile.style.boxShadow = 'none';
    tile.style.opacity = '0.6';
    tile.style.cursor = 'not-allowed';
    tile.style.pointerEvents = 'none';
    tile.style.transform = 'scale(1)';
    tile.disabled = true;

    // Level number text (dimmed)
    const levelText = document.createElement('span');
    levelText.textContent = `LEVEL ${level}`;
    levelText.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 2px;
    `;
    tile.appendChild(levelText);

    // Lock icon
    const lockIcon = document.createElement('span');
    lockIcon.textContent = '🔒';
    lockIcon.style.cssText = `
      font-size: 20px;
      opacity: 0.5;
    `;
    tile.appendChild(lockIcon);

    // LOCKED text
    const lockedText = document.createElement('span');
    lockedText.textContent = 'LOCKED';
    lockedText.style.cssText = `
      font-size: 10px;
      letter-spacing: 2px;
      opacity: 0.7;
    `;
    tile.appendChild(lockedText);
  }

  /**
   * Displays the level select screen.
   */
  public show(): void {
    if (this.disposed) return;
    this.overlay.style.display = 'block';
  }

  /**
   * Hides the level select screen.
   */
  public hide(): void {
    if (this.disposed) return;
    this.overlay.style.display = 'none';
  }

  /**
   * Sets the highest unlocked level and updates tile states.
   * Level 1 is always unlocked.
   * @param maxUnlocked - The highest unlocked level (1-10)
   */
  public setUnlockedLevels(maxUnlocked: number): void {
    if (this.disposed) return;

    // Clamp to valid range (1-10)
    this.maxUnlockedLevel = Math.max(1, Math.min(10, Math.floor(maxUnlocked)));

    // Update all tile states
    this.updateTileStates();
  }

  /**
   * Disposes all resources and cleans up.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove all tile click listeners
    for (const tile of this.tiles) {
      tile.onmouseenter = null;
      tile.onmouseleave = null;
      tile.onclick = null;
    }

    // Clear the tiles array
    this.tiles = [];

    // Remove the overlay from the DOM
    if (this.overlay.parentElement === this.container) {
      this.container.removeChild(this.overlay);
    }
  }
}