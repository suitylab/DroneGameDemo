import * as THREE from 'three';
import type { MazeData } from './MazeGenerator';

/**
 * Minimap
 *
 * A circular canvas minimap for the MAZE STRIKE game, positioned in the
 * top-right corner. Renders the maze grid with fog-of-war exploration,
 * showing explored areas, the player (white dot), and the exit (green arrow).
 *
 * The minimap uses the same grid data as the collision system, ensuring
 * visual consistency with the 3D maze.
 */
export default class Minimap {
  /** The canvas element for the minimap */
  private canvas: HTMLCanvasElement;

  /** The 2D rendering context */
  private ctx: CanvasRenderingContext2D;

  /** Reference to the maze data (grid, dimensions, exit point) */
  private mazeData: MazeData;

  /** 2D array tracking explored cells: explored[z][x] */
  private explored: boolean[][];

  /** CSS size of the minimap in pixels */
  private readonly cssSize: number = 180;

  /** Exploration radius in grid cells */
  private readonly explorationRadius: number = 6;

  /** Grid cell size in canvas pixels */
  private readonly cellSize: number;

  /** Grid centering offset (world → grid conversion) */
  private readonly gridOffsetX: number;
  private readonly gridOffsetZ: number;

  /**
   * Creates a new Minimap and appends its canvas to the given container.
   * @param container - The HTMLElement to append the canvas to
   * @param mazeData - The maze data from MazeGenerator
   */
  constructor(container: HTMLElement, mazeData: MazeData) {
    this.mazeData = mazeData;

    // Calculate grid centering offsets (same as MazeRenderer)
    this.gridOffsetX = mazeData.gridWidth / 2;
    this.gridOffsetZ = mazeData.gridHeight / 2;

    // Calculate cell size in canvas pixels
    this.cellSize = this.cssSize / mazeData.gridWidth;

    // Create the canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cssSize * window.devicePixelRatio;
    this.canvas.height = this.cssSize * window.devicePixelRatio;

    // Get the 2D context
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Minimap: Failed to get 2D rendering context.');
    }
    this.ctx = ctx;

    // Apply inline styles for robustness (position, size, circular shape)
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '16px';
    this.canvas.style.right = '16px';
    this.canvas.style.width = `${this.cssSize}px`;
    this.canvas.style.height = `${this.cssSize}px`;
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.zIndex = '10';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.opacity = '0.8';

    // Append to container
    container.appendChild(this.canvas);

    // Initialize explored array (all false)
    this.explored = [];
    for (let z = 0; z < mazeData.gridHeight; z++) {
      const row: boolean[] = [];
      for (let x = 0; x < mazeData.gridWidth; x++) {
        row.push(false);
      }
      this.explored.push(row);
    }
  }

  /**
   * Updates the minimap: reveals explored cells near the player and re-renders.
   * @param playerPosition - The player's world position (THREE.Vector3)
   */
  public update(playerPosition: THREE.Vector3): void {
    // Convert player world position to grid coordinates
    const playerGridX = Math.floor(playerPosition.x + this.gridOffsetX);
    const playerGridZ = Math.floor(playerPosition.z + this.gridOffsetZ);

    // Reveal cells within exploration radius
    this.revealCells(playerGridX, playerGridZ);

    // Render the minimap
    this.render(playerGridX, playerGridZ);
  }

  /**
   * Reveals explored cells within the exploration radius of the player.
   * @param playerGridX - Player's grid X coordinate
   * @param playerGridZ - Player's grid Z coordinate
   */
  private revealCells(playerGridX: number, playerGridZ: number): void {
    const { gridWidth, gridHeight } = this.mazeData;
    const radius = this.explorationRadius;
    const radiusSq = radius * radius;

    // Iterate over the bounding box around the player
    const minX = Math.max(0, playerGridX - radius);
    const maxX = Math.min(gridWidth - 1, playerGridX + radius);
    const minZ = Math.max(0, playerGridZ - radius);
    const maxZ = Math.min(gridHeight - 1, playerGridZ + radius);

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        // Check if within circular radius
        const dx = x - playerGridX;
        const dz = z - playerGridZ;
        if (dx * dx + dz * dz <= radiusSq) {
          this.explored[z][x] = true;
        }
      }
    }
  }

  /**
   * Renders the minimap to the canvas.
   * @param playerGridX - Player's grid X coordinate
   * @param playerGridZ - Player's grid Z coordinate
   */
  private render(playerGridX: number, playerGridZ: number): void {
    const ctx = this.ctx;
    const size = this.cssSize;
    const dpr = window.devicePixelRatio;

    // Scale context for device pixel ratio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background circle (dark semi-transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.2)';
    ctx.fill();

        // Apply circular clipping path
    ctx.clip();

    // Translate so the player stays centered in the minimap
    const offsetX = size / 2 - (playerGridX + 0.5) * this.cellSize;
    const offsetZ = size / 2 - (playerGridZ + 0.5) * this.cellSize;
    ctx.translate(offsetX, offsetZ);

    // Draw grid cells
    this.drawGrid();

    // Draw exit arrow
    this.drawExitArrow();

    // Draw player dot
    this.drawPlayer(playerGridX, playerGridZ);

    // Restore context (remove clipping)
    ctx.restore();

    // Draw border ring (cyan with glow)
    this.drawBorder();
  }

  /**
   * Draws the maze grid cells (walls and floors) for explored areas.
   */
  private drawGrid(): void {
    const ctx = this.ctx;
    const { grid, gridWidth, gridHeight } = this.mazeData;
    const cellSize = this.cellSize;

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        // Skip unexplored cells
        if (!this.explored[z][x]) continue;

        const px = x * cellSize;
        const py = z * cellSize;

        // Determine cell color
        const cellValue = grid[z][x];
        let fillStyle: string;

        if (cellValue === 1) {
          // Wall: dark grey with transparency
          fillStyle = 'rgba(50, 60, 72, 0.9)';
        } else {
          // Floor: dim cyan-grey with transparency
          fillStyle = 'rgba(100, 170, 220, 1.0)';
        }

        ctx.fillStyle = fillStyle;
        ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5);
      }
    }
  }

  /**
   * Draws the exit arrow (green triangle pointing up) with a subtle glow.
   */
  private drawExitArrow(): void {
    const ctx = this.ctx;
    const { exitPoint, gridWidth, gridHeight } = this.mazeData;

    // Convert exit grid position to canvas pixel position
    const exitX = (exitPoint.x + 0.5) * this.cellSize;
    const exitZ = (exitPoint.z + 0.5) * this.cellSize;

    // Arrow dimensions
    const arrowSize = 8;
    const arrowHalf = arrowSize / 2;

    // Draw glow (radial gradient)
    const glowRadius = arrowSize * 2;
    const glowGradient = ctx.createRadialGradient(
      exitX, exitZ, 0,
      exitX, exitZ, glowRadius
    );
    glowGradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)');
    glowGradient.addColorStop(1, 'rgba(0, 255, 102, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(exitX, exitZ, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw arrow (triangle pointing up)
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.moveTo(exitX, exitZ - arrowHalf);
    ctx.lineTo(exitX - arrowHalf, exitZ + arrowHalf);
    ctx.lineTo(exitX + arrowHalf, exitZ + arrowHalf);
    ctx.closePath();
    ctx.fill();

    // Arrow outline for clarity
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Draws the player dot (white circle with subtle glow).
   * @param playerGridX - Player's grid X coordinate
   * @param playerGridZ - Player's grid Z coordinate
   */
  private drawPlayer(playerGridX: number, playerGridZ: number): void {
    const ctx = this.ctx;

    // Convert player grid position to canvas pixel position
    const playerX = (playerGridX + 0.5) * this.cellSize;
    const playerZ = (playerGridZ + 0.5) * this.cellSize;

    // Draw glow (radial gradient)
    const glowRadius = 10;
    const glowGradient = ctx.createRadialGradient(
      playerX, playerZ, 0,
      playerX, playerZ, glowRadius
    );
    glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(playerX, playerZ, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw player dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playerX, playerZ, 3, 0, Math.PI * 2);
    ctx.fill();

    // Subtle outline for contrast
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Draws the cyan border ring with a glow effect.
   */
  private drawBorder(): void {
    const ctx = this.ctx;
    const size = this.cssSize;
    const center = size / 2;
    const radius = size / 2 - 1;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(
      center, center, radius - 3,
      center, center, radius + 3
    );
    glowGradient.addColorStop(0, 'rgba(0, 255, 204, 0.6)');
    glowGradient.addColorStop(1, 'rgba(0, 255, 204, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(center, center, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // Main ring
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner subtle ring
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius - 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Removes the canvas from the DOM and cleans up resources.
   */
  public dispose(): void {
    // Remove canvas from its parent
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }

    // Clear references
    this.explored = [];
  }
}