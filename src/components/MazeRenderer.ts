import * as THREE from 'three';
import type { MazeData, Door, Room } from './MazeGenerator';

/**
 * MazeRenderer
 *
 * Converts MazeData from MazeGenerator into polished 3D meshes for the
 * MAZE STRIKE game. Builds walls, floors, doors, emissive strips, spawn pad,
 * exit marker, procedural props (crates, tech panels, pipes), holographic
 * exit arrows, and dynamic lighting (flickering corridor lights, rotating
 * searchlights) using procedural canvas textures and THREE.js primitives.
 *
 * All meshes are added to the provided THREE.Scene. The renderer provides
 * collision checking against the grid and door animation updates.
 */
export default class MazeRenderer {
  /** The Three.js scene to add meshes to */
  private scene: THREE.Scene;

  /** The maze data (grid, rooms, doors, etc.) */
  private mazeData: MazeData;

  /** All created meshes for disposal tracking */
  private meshes: THREE.Object3D[] = [];

  /** Door entities with their animation state */
  private doorEntities: {
    group: THREE.Group;
    door: Door;
    currentY: number;
    targetY: number;
  }[] = [];

  /** Wall height in world units */
  private readonly wallHeight: number = 3;

  /** Door slide distance (into ceiling) */
  private readonly doorSlideDistance: number = 3;

  /** Door activation radius in world units */
  private readonly doorActivationRadius: number = 3;

  /** Door animation speed (units per second) */
  private readonly doorSpeed: number = 4;

  /** Procedural textures created for disposal */
  private textures: THREE.Texture[] = [];

  /** Elapsed time for animations (flicker, searchlights, arrows) */
  private elapsedTime: number = 0;

  /** Flickering corridor lights for dynamic lighting */
  private flickerLights: {
    light: THREE.PointLight;
    baseIntensity: number;
    phase: number;
    speed: number;
  }[] = [];

  /** Rotating searchlights in large rooms */
  private searchlights: {
    light: THREE.SpotLight;
    pivot: THREE.Object3D;
    radius: number;
    height: number;
    speed: number;
    angle: number;
  }[] = [];

  /** Holographic arrow meshes for bobbing animation */
  private arrowMeshes: THREE.Mesh[] = [];

  /**
   * Creates a new MazeRenderer and builds all meshes.
   * @param scene - The THREE.Scene to add meshes to
   * @param mazeData - The maze data from MazeGenerator
   */
  constructor(scene: THREE.Scene, mazeData: MazeData) {
    this.scene = scene;
    this.mazeData = mazeData;

    // Build all visual elements in order
    this.buildFloors();
    this.buildWalls();
    this.buildDoors();
    this.buildEmissiveStrips();
    this.buildProps();
    this.buildExitArrows();
    this.buildDynamicLights();
    this.buildSpawnPad();
    this.buildExitMarker();
  }

  /**
   * Creates a procedural metal panel texture with rivets.
   * @returns A CanvasTexture for wall surfaces
   */
  private createWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base dark grey metal
    ctx.fillStyle = '#2a2f36';
    ctx.fillRect(0, 0, 256, 256);

    // Panel seams (horizontal and vertical lines)
    ctx.strokeStyle = '#1a1e24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();

    // Subtle metal grain (random dots)
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const brightness = 30 + Math.random() * 20;
      ctx.fillStyle = `rgba(${brightness}, ${brightness + 5}, ${brightness + 10}, 0.3)`;
      ctx.fillRect(x, y, 1, 1);
    }

    // Rivets at panel corners
    const rivetPositions = [
      [32, 32], [224, 32], [32, 224], [224, 224],
      [32, 128], [224, 128], [128, 32], [128, 224],
    ];
    for (const [x, y] of rivetPositions) {
      // Rivet shadow
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#111418';
      ctx.fill();

      // Rivet highlight
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4a5058';
      ctx.fill();

      // Rivet center dot
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2f36';
      ctx.fill();
    }

    // Edge highlight (top-left light, bottom-right dark)
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.textures.push(texture);
    return texture;
  }

  /**
   * Creates a procedural concrete floor texture with grid lines.
   * @returns A CanvasTexture for floor surfaces
   */
  private createFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base dark grey concrete
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(0, 0, 256, 256);

    // Concrete texture noise
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const brightness = 20 + Math.random() * 15;
      ctx.fillStyle = `rgba(${brightness}, ${brightness + 2}, ${brightness + 4}, 0.4)`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Subtle cyan-tinted grid lines
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();

    // Faint expansion joints
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(256, 64);
    ctx.moveTo(0, 192);
    ctx.lineTo(256, 192);
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 256);
    ctx.moveTo(192, 0);
    ctx.lineTo(192, 256);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.textures.push(texture);
    return texture;
  }

  /**
   * Creates a hazard stripe texture (yellow/black diagonal stripes).
   * @returns A CanvasTexture for door frames
   */
  private createHazardTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Yellow base
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(0, 0, 64, 64);

    // Black diagonal stripes
    ctx.fillStyle = '#1a1a1a';
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-64, -16, 128, 32);
    ctx.fillRect(-64, 48, 128, 32);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.textures.push(texture);
    return texture;
  }

  /**
   * Creates a procedural crate texture (grey with orange stripes).
   * @returns A CanvasTexture for crate surfaces
   */
  private createCrateTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Base grey
    ctx.fillStyle = '#4a5058';
    ctx.fillRect(0, 0, 128, 128);

    // Panel border
    ctx.strokeStyle = '#2a2f36';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);

    // Inner panel
    ctx.fillStyle = '#3a4048';
    ctx.fillRect(12, 12, 104, 104);

    // Orange stripes (diagonal)
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(-64, -8, 128, 16);
    ctx.fillRect(-64, 24, 128, 16);
    ctx.restore();

    // Metal corner brackets
    ctx.fillStyle = '#2a2f36';
    ctx.fillRect(8, 8, 16, 16);
    ctx.fillRect(104, 8, 16, 16);
    ctx.fillRect(8, 104, 16, 16);
    ctx.fillRect(104, 104, 16, 16);

    // Subtle noise
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const brightness = 30 + Math.random() * 20;
      ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.3)`;
      ctx.fillRect(x, y, 1, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.textures.push(texture);
    return texture;
  }

  /**
   * Creates a procedural tech panel texture (dark with glowing screen).
   * @returns A CanvasTexture for tech panel surfaces
   */
  private createTechPanelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Dark panel base
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(0, 0, 128, 128);

    // Panel border
    ctx.strokeStyle = '#2a2f36';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);

    // Glowing screen area
    const gradient = ctx.createLinearGradient(16, 16, 112, 112);
    gradient.addColorStop(0, '#00ffcc');
    gradient.addColorStop(0.5, '#00aa88');
    gradient.addColorStop(1, '#006655');
    ctx.fillStyle = gradient;
    ctx.fillRect(16, 16, 96, 96);

    // Screen grid lines
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 96; i += 16) {
      ctx.beginPath();
      ctx.moveTo(16 + i, 16);
      ctx.lineTo(16 + i, 112);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 16 + i);
      ctx.lineTo(112, 16 + i);
      ctx.stroke();
    }

    // Screen data dots
    ctx.fillStyle = '#00ffcc';
    for (let i = 0; i < 20; i++) {
      const x = 20 + Math.random() * 88;
      const y = 20 + Math.random() * 88;
      ctx.fillRect(x, y, 2, 2);
    }

    // Small indicator lights
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(8, 8, 8, 8);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(112, 8, 8, 8);
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(8, 112, 8, 8);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(112, 112, 8, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.textures.push(texture);
    return texture;
  }

  /**
   * Builds floor meshes for all walkable areas (rooms and corridors).
   */
  private buildFloors(): void {
    const { grid, gridWidth, gridHeight } = this.mazeData;
    const floorTexture = this.createFloorTexture();
    floorTexture.repeat.set(4, 4);

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Build a single merged floor geometry from all walkable cells
    const cells: { x: number; z: number }[] = [];
    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[z][x] === 0 || grid[z][x] === 2) {
          cells.push({ x, z });
        }
      }
    }

    // Use InstancedMesh for performance
    const cellGeometry = new THREE.PlaneGeometry(1, 1);
    const instancedMesh = new THREE.InstancedMesh(
      cellGeometry,
      floorMaterial,
      cells.length
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      // Center the grid so origin is at the center of the maze
      position.set(
        cell.x - gridWidth / 2 + 0.5,
        0,
        cell.z - gridHeight / 2 + 0.5
      );
      matrix.compose(position, quaternion, scale);
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.receiveShadow = true;
    this.scene.add(instancedMesh);
    this.meshes.push(instancedMesh);

    // Dispose the temporary geometry (InstancedMesh has its own instance buffer)
    cellGeometry.dispose();
  }

  /**
   * Builds wall meshes from the collision grid.
   * Creates wall segments on the boundary between wall and walkable cells.
   */
  private buildWalls(): void {
    const { grid, gridWidth, gridHeight } = this.mazeData;
    const wallTexture = this.createWallTexture();
    wallTexture.repeat.set(1, 1);

    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.6,
    });

    // Collect wall segment data
    const segments: {
      x: number;
      z: number;
      width: number;
      depth: number;
      rotationY: number;
    }[] = [];

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        // Only process wall cells
        if (grid[z][x] !== 1) continue;

        const worldX = x - gridWidth / 2;
        const worldZ = z - gridHeight / 2;

        // Check 4 neighbors
        // North (z-1)
        if (z > 0 && (grid[z - 1][x] === 0 || grid[z - 1][x] === 2)) {
          segments.push({
            x: worldX + 0.5,
            z: worldZ,
            width: 1,
            depth: 0.2,
            rotationY: 0,
          });
        }
        // South (z+1)
        if (z < gridHeight - 1 && (grid[z + 1][x] === 0 || grid[z + 1][x] === 2)) {
          segments.push({
            x: worldX + 0.5,
            z: worldZ + 1,
            width: 1,
            depth: 0.2,
            rotationY: 0,
          });
        }
        // West (x-1)
        if (x > 0 && (grid[z][x - 1] === 0 || grid[z][x - 1] === 2)) {
          segments.push({
            x: worldX,
            z: worldZ + 0.5,
            width: 0.2,
            depth: 1,
            rotationY: 0,
          });
        }
        // East (x+1)
        if (x < gridWidth - 1 && (grid[z][x + 1] === 0 || grid[z][x + 1] === 2)) {
          segments.push({
            x: worldX + 1,
            z: worldZ + 0.5,
            width: 0.2,
            depth: 1,
            rotationY: 0,
          });
        }
      }
    }

    // Create wall meshes
    const wallGeometry = new THREE.BoxGeometry(1, this.wallHeight, 1);
    const instancedMesh = new THREE.InstancedMesh(
      wallGeometry,
      wallMaterial,
      segments.length
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      position.set(seg.x, this.wallHeight / 2, seg.z);
      quaternion.setFromEuler(new THREE.Euler(0, seg.rotationY, 0));
      scale.set(seg.width, 1, seg.depth);
      matrix.compose(position, quaternion, scale);
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    this.scene.add(instancedMesh);
    this.meshes.push(instancedMesh);

    wallGeometry.dispose();
  }

  /**
   * Builds door entities that slide open when the player approaches.
   */
  private buildDoors(): void {
    const { grid, gridWidth, gridHeight, doors } = this.mazeData;
    const wallTexture = this.createWallTexture();
    const hazardTexture = this.createHazardTexture();

    const doorMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: 0xcccccc,
      roughness: 0.5,
      metalness: 0.7,
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      map: hazardTexture,
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.4,
    });

    for (const door of doors) {
      const group = new THREE.Group();

      const worldX = door.x - gridWidth / 2;
      const worldZ = door.z - gridHeight / 2;

      // Door panel dimensions
      const doorWidth = door.orientation === 'horizontal' ? 1.2 : 1.2;
      const doorDepth = door.orientation === 'horizontal' ? 0.15 : 0.15;
      const doorHeight = this.wallHeight - 0.1;

      // Door panel
      const doorGeometry = new THREE.BoxGeometry(
        door.orientation === 'horizontal' ? doorWidth : doorDepth,
        doorHeight,
        door.orientation === 'horizontal' ? doorDepth : doorWidth
      );
      const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
      doorMesh.position.y = doorHeight / 2;
      doorMesh.castShadow = true;
      doorMesh.receiveShadow = true;
      group.add(doorMesh);

      // Door frame (hazard stripes) — two vertical posts
      const postGeometry = new THREE.BoxGeometry(0.15, this.wallHeight, 0.15);
      const post1 = new THREE.Mesh(postGeometry, frameMaterial);
      const post2 = new THREE.Mesh(postGeometry, frameMaterial);

      if (door.orientation === 'horizontal') {
        // Door on north/south wall — posts on east/west sides
        post1.position.set(-0.6, this.wallHeight / 2, 0);
        post2.position.set(0.6, this.wallHeight / 2, 0);
      } else {
        // Door on east/west wall — posts on north/south sides
        post1.position.set(0, this.wallHeight / 2, -0.6);
        post2.position.set(0, this.wallHeight / 2, 0.6);
      }
      post1.castShadow = true;
      post2.castShadow = true;
      group.add(post1);
      group.add(post2);

      // Position the door group at the door cell
      group.position.set(worldX + 0.5, 0, worldZ + 0.5);

      // Store door entity state
      this.doorEntities.push({
        group,
        door,
        currentY: 0,
        targetY: 0,
      });

      this.scene.add(group);
      this.meshes.push(group);
    }
  }

  /**
   * Checks if a grid cell is inside any room.
   * @param x - Grid X coordinate
   * @param z - Grid Z coordinate
   * @returns True if the cell is inside a room, false otherwise
   */
  private isCellInRoom(x: number, z: number): boolean {
    for (const room of this.mazeData.rooms) {
      if (
        x >= room.x &&
        x < room.x + room.width &&
        z >= room.z &&
        z < room.z + room.depth
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Builds glowing emissive strips along walls.
   * Cyan strips in corridors, orange strips in rooms.
   */
  private buildEmissiveStrips(): void {
    const { grid, gridWidth, gridHeight } = this.mazeData;

    const cyanStripMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    const orangeStripMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Collect strip positions (along wall faces at floor level)
    const cyanStrips: { x: number; z: number; rotationY: number }[] = [];
    const orangeStrips: { x: number; z: number; rotationY: number }[] = [];

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[z][x] !== 1) continue;

        const worldX = x - gridWidth / 2;
        const worldZ = z - gridHeight / 2;

        // Determine if this wall cell is adjacent to a room or corridor
        // Check neighbors to see if the adjacent walkable cell is in a room
        const isRoomAdjacent =
          (z > 0 && (grid[z - 1][x] === 0 || grid[z - 1][x] === 2) && this.isCellInRoom(x, z - 1)) ||
          (z < gridHeight - 1 && (grid[z + 1][x] === 0 || grid[z + 1][x] === 2) && this.isCellInRoom(x, z + 1)) ||
          (x > 0 && (grid[z][x - 1] === 0 || grid[z][x - 1] === 2) && this.isCellInRoom(x - 1, z)) ||
          (x < gridWidth - 1 && (grid[z][x + 1] === 0 || grid[z][x + 1] === 2) && this.isCellInRoom(x + 1, z));

        // Check neighbors for walkable cells
        if (z > 0 && (grid[z - 1][x] === 0 || grid[z - 1][x] === 2)) {
          const strip = { x: worldX + 0.5, z: worldZ + 0.05, rotationY: 0 };
          if (isRoomAdjacent) {
            orangeStrips.push(strip);
          } else {
            cyanStrips.push(strip);
          }
        }
        if (z < gridHeight - 1 && (grid[z + 1][x] === 0 || grid[z + 1][x] === 2)) {
          const strip = { x: worldX + 0.5, z: worldZ + 0.95, rotationY: 0 };
          if (isRoomAdjacent) {
            orangeStrips.push(strip);
          } else {
            cyanStrips.push(strip);
          }
        }
        if (x > 0 && (grid[z][x - 1] === 0 || grid[z][x - 1] === 2)) {
          const strip = { x: worldX + 0.05, z: worldZ + 0.5, rotationY: Math.PI / 2 };
          if (isRoomAdjacent) {
            orangeStrips.push(strip);
          } else {
            cyanStrips.push(strip);
          }
        }
        if (x < gridWidth - 1 && (grid[z][x + 1] === 0 || grid[z][x + 1] === 2)) {
          const strip = { x: worldX + 0.95, z: worldZ + 0.5, rotationY: Math.PI / 2 };
          if (isRoomAdjacent) {
            orangeStrips.push(strip);
          } else {
            cyanStrips.push(strip);
          }
        }
      }
    }

    // Create instanced strips for cyan (corridors)
    if (cyanStrips.length > 0) {
      const stripGeometry = new THREE.BoxGeometry(0.9, 0.06, 0.06);
      const instancedMesh = new THREE.InstancedMesh(
        stripGeometry,
        cyanStripMaterial,
        cyanStrips.length
      );

      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);

      for (let i = 0; i < cyanStrips.length; i++) {
        const strip = cyanStrips[i];
        position.set(strip.x, 0.05, strip.z);
        quaternion.setFromEuler(new THREE.Euler(0, strip.rotationY, 0));
        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
      }

      this.scene.add(instancedMesh);
      this.meshes.push(instancedMesh);
      stripGeometry.dispose();
    }

    // Create instanced strips for orange (rooms)
    if (orangeStrips.length > 0) {
      const stripGeometry = new THREE.BoxGeometry(0.9, 0.06, 0.06);
      const instancedMesh = new THREE.InstancedMesh(
        stripGeometry,
        orangeStripMaterial,
        orangeStrips.length
      );

      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);

      for (let i = 0; i < orangeStrips.length; i++) {
        const strip = orangeStrips[i];
        position.set(strip.x, 0.05, strip.z);
        quaternion.setFromEuler(new THREE.Euler(0, strip.rotationY, 0));
        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
      }

      this.scene.add(instancedMesh);
      this.meshes.push(instancedMesh);
      stripGeometry.dispose();
    }
  }

  /**
   * Builds procedural props: crates, tech panels, and pipes.
   */
  private buildProps(): void {
    const { grid, gridWidth, gridHeight, rooms } = this.mazeData;

    // --- Crates in intermediate rooms ---
    const crateTexture = this.createCrateTexture();
    const crateMaterial = new THREE.MeshStandardMaterial({
      map: crateTexture,
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.3,
    });

    // Place 1-2 crates in each intermediate room (not start, not exit)
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      const crateCount = 1 + Math.floor(Math.random() * 2); // 1-2 crates

      for (let c = 0; c < crateCount; c++) {
        // Random position within the room interior (keep 2 cells from walls)
        const crateX = room.x + 2 + Math.floor(Math.random() * (room.width - 4));
        const crateZ = room.z + 2 + Math.floor(Math.random() * (room.depth - 4));

        // Random crate size (0.6 - 1.0 units)
        const crateSize = 0.6 + Math.random() * 0.4;

        // World coordinates
        const worldX = crateX - gridWidth / 2;
        const worldZ = crateZ - gridHeight / 2;

        // Create crate mesh
        const crateGeometry = new THREE.BoxGeometry(crateSize, crateSize, crateSize);
        const crate = new THREE.Mesh(crateGeometry, crateMaterial);
        crate.position.set(worldX + 0.5, crateSize / 2, worldZ + 0.5);
        crate.rotation.y = Math.random() * Math.PI;
        crate.castShadow = true;
        crate.receiveShadow = true;

        this.scene.add(crate);
        this.meshes.push(crate);
      }
    }

    // --- Tech panels on room walls ---
    const techPanelTexture = this.createTechPanelTexture();
    const techPanelMaterial = new THREE.MeshStandardMaterial({
      map: techPanelTexture,
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.4,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.3,
    });

    // Place 1-2 tech panels on walls of each intermediate room
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      const panelCount = 1 + Math.floor(Math.random() * 2); // 1-2 panels

      for (let p = 0; p < panelCount; p++) {
        // Choose a random wall side (0=top, 1=bottom, 2=left, 3=right)
        const side = Math.floor(Math.random() * 4);

        // Random position along the wall
        let panelX: number;
        let panelZ: number;
        let rotationY: number;

        const margin = 2; // Keep away from corners
        const rangeX = room.width - margin * 2;
        const rangeZ = room.depth - margin * 2;

        switch (side) {
          case 0: // Top wall (north)
            panelX = room.x + margin + Math.floor(Math.random() * rangeX);
            panelZ = room.z;
            rotationY = 0;
            break;
          case 1: // Bottom wall (south)
            panelX = room.x + margin + Math.floor(Math.random() * rangeX);
            panelZ = room.z + room.depth - 1;
            rotationY = Math.PI;
            break;
          case 2: // Left wall (west)
            panelX = room.x;
            panelZ = room.z + margin + Math.floor(Math.random() * rangeZ);
            rotationY = -Math.PI / 2;
            break;
          default: // Right wall (east)
            panelX = room.x + room.width - 1;
            panelZ = room.z + margin + Math.floor(Math.random() * rangeZ);
            rotationY = Math.PI / 2;
            break;
        }

        // World coordinates
        const worldX = panelX - gridWidth / 2;
        const worldZ = panelZ - gridHeight / 2;

        // Create tech panel mesh (thin box on the wall)
        const panelGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.1);
        const panel = new THREE.Mesh(panelGeometry, techPanelMaterial);

        // Position the panel on the wall face
        if (side === 0) {
          panel.position.set(worldX + 0.5, 1.5, worldZ);
        } else if (side === 1) {
          panel.position.set(worldX + 0.5, 1.5, worldZ + 1);
        } else if (side === 2) {
          panel.position.set(worldX, 1.5, worldZ + 0.5);
        } else {
          panel.position.set(worldX + 1, 1.5, worldZ + 0.5);
        }

        panel.rotation.y = rotationY;
        panel.castShadow = true;
        panel.receiveShadow = true;

        this.scene.add(panel);
        this.meshes.push(panel);
      }
    }

    // --- Pipes along corridor walls ---
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      roughness: 0.6,
      metalness: 0.7,
    });

    // Place pipes along corridor wall segments
    // Scan for wall cells adjacent to corridor cells (not rooms)
    const pipePositions: { x: number; z: number; rotationY: number; length: number }[] = [];

    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[z][x] !== 1) continue;

        // Check if this wall cell is adjacent to a corridor (walkable, not in room)
        const isCorridorAdjacent =
          (z > 0 && (grid[z - 1][x] === 0 || grid[z - 1][x] === 2) && !this.isCellInRoom(x, z - 1)) ||
          (z < gridHeight - 1 && (grid[z + 1][x] === 0 || grid[z + 1][x] === 2) && !this.isCellInRoom(x, z + 1)) ||
          (x > 0 && (grid[z][x - 1] === 0 || grid[z][x - 1] === 2) && !this.isCellInRoom(x - 1, z)) ||
          (x < gridWidth - 1 && (grid[z][x + 1] === 0 || grid[z][x + 1] === 2) && !this.isCellInRoom(x + 1, z));

        if (!isCorridorAdjacent) continue;

        const worldX = x - gridWidth / 2;
        const worldZ = z - gridHeight / 2;

        // Place a pipe on the corridor-facing side
        if (z > 0 && (grid[z - 1][x] === 0 || grid[z - 1][x] === 2) && !this.isCellInRoom(x, z - 1)) {
          pipePositions.push({
            x: worldX + 0.5,
            z: worldZ + 0.1,
            rotationY: 0,
            length: 0.8,
          });
        }
        if (z < gridHeight - 1 && (grid[z + 1][x] === 0 || grid[z + 1][x] === 2) && !this.isCellInRoom(x, z + 1)) {
          pipePositions.push({
            x: worldX + 0.5,
            z: worldZ + 0.9,
            rotationY: 0,
            length: 0.8,
          });
        }
        if (x > 0 && (grid[z][x - 1] === 0 || grid[z][x - 1] === 2) && !this.isCellInRoom(x - 1, z)) {
          pipePositions.push({
            x: worldX + 0.1,
            z: worldZ + 0.5,
            rotationY: Math.PI / 2,
            length: 0.8,
          });
        }
        if (x < gridWidth - 1 && (grid[z][x + 1] === 0 || grid[z][x + 1] === 2) && !this.isCellInRoom(x + 1, z)) {
          pipePositions.push({
            x: worldX + 0.9,
            z: worldZ + 0.5,
            rotationY: Math.PI / 2,
            length: 0.8,
          });
        }
      }
    }

    // Limit the number of pipes to avoid overdraw
    const maxPipes = 200;
    const pipeCount = Math.min(pipePositions.length, maxPipes);

    // Randomly sample pipe positions
    const selectedPipes: typeof pipePositions = [];
    for (let i = 0; i < pipeCount; i++) {
      const idx = Math.floor(Math.random() * pipePositions.length);
      selectedPipes.push(pipePositions[idx]);
    }

    // Create pipe meshes
    for (const pipe of selectedPipes) {
      // Pipe is a cylinder along the wall
      const pipeGeometry = new THREE.CylinderGeometry(0.06, 0.06, pipe.length, 8);
      const pipeMesh = new THREE.Mesh(pipeGeometry, pipeMaterial);

      // Position the pipe at mid-height on the wall
      pipeMesh.position.set(pipe.x, 1.5, pipe.z);

      // Rotate the pipe to lie along the wall
      if (pipe.rotationY === 0) {
        // Pipe along X axis (horizontal)
        pipeMesh.rotation.z = Math.PI / 2;
      } else {
        // Pipe along Z axis (horizontal)
        pipeMesh.rotation.x = Math.PI / 2;
      }

      pipeMesh.castShadow = true;
      pipeMesh.receiveShadow = true;

      this.scene.add(pipeMesh);
      this.meshes.push(pipeMesh);
    }
  }

  /**
   * Builds holographic arrows pointing toward the exit.
   * Uses BFS to find a path from spawn to exit, then places arrows
   * every 4-5 cells along the path.
   */
  private buildExitArrows(): void {
    const { grid, gridWidth, gridHeight, spawnPoint, exitPoint } = this.mazeData;

    // --- BFS to find path from spawn to exit ---
    const startX = spawnPoint.x;
    const startZ = spawnPoint.z;
    const endX = exitPoint.x;
    const endZ = exitPoint.z;

    // BFS queue and visited set
    const queue: { x: number; z: number; parent: { x: number; z: number } | null }[] = [];
    const visited = new Set<string>();
    const parentMap = new Map<string, { x: number; z: number } | null>();

    queue.push({ x: startX, z: startZ, parent: null });
    visited.add(`${startX},${startZ}`);
    parentMap.set(`${startX},${startZ}`, null);

    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check if we reached the exit
      if (current.x === endX && current.z === endZ) {
        found = true;
        break;
      }

      // Check 4 neighbors
      const neighbors = [
        { x: current.x + 1, z: current.z },
        { x: current.x - 1, z: current.z },
        { x: current.x, z: current.z + 1 },
        { x: current.x, z: current.z - 1 },
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.z}`;
        if (visited.has(key)) continue;

        // Check bounds
        if (neighbor.x < 0 || neighbor.x >= gridWidth || neighbor.z < 0 || neighbor.z >= gridHeight) continue;

        // Check walkable
        if (grid[neighbor.z][neighbor.x] !== 0 && grid[neighbor.z][neighbor.x] !== 2) continue;

        visited.add(key);
        parentMap.set(key, { x: current.x, z: current.z });
        queue.push({ x: neighbor.x, z: neighbor.z, parent: { x: current.x, z: current.z } });
      }
    }

    // If no path found, skip arrows
    if (!found) return;

    // --- Reconstruct path ---
    const path: { x: number; z: number }[] = [];
    let current: { x: number; z: number } | null = { x: endX, z: endZ };

    while (current) {
      path.push(current);
      current = parentMap.get(`${current.x},${current.z}`) || null;
    }

    // Reverse to get path from start to exit
    path.reverse();

    // --- Place arrows every 4-5 cells ---
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    });

    const arrowStep = 4 + Math.floor(Math.random() * 2); // 4 or 5

    for (let i = arrowStep; i < path.length - 1; i += arrowStep) {
      const point = path[i];
      const nextPoint = path[Math.min(i + 1, path.length - 1)];

      // Calculate direction to next point
      const dx = nextPoint.x - point.x;
      const dz = nextPoint.z - point.z;
      const angle = Math.atan2(dx, dz);

      // World coordinates
      const worldX = point.x - gridWidth / 2;
      const worldZ = point.z - gridHeight / 2;

      // Create arrow group (cone + base cylinder)
      const arrowGroup = new THREE.Group();

      // Arrow head (cone)
      const coneGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
      const cone = new THREE.Mesh(coneGeometry, arrowMaterial);
      cone.position.y = 0.2;
      cone.castShadow = true;
      arrowGroup.add(cone);

      // Arrow base (small cylinder)
      const baseGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
      const base = new THREE.Mesh(baseGeometry, arrowMaterial);
      base.position.y = 0.075;
      base.castShadow = true;
      arrowGroup.add(base);

      // Position and orient the arrow
      arrowGroup.position.set(worldX + 0.5, 0.5, worldZ + 0.5);
      arrowGroup.rotation.y = angle;

      // Store the cone mesh for bobbing animation
      this.arrowMeshes.push(cone);

      this.scene.add(arrowGroup);
      this.meshes.push(arrowGroup);
    }
  }

  /**
   * Builds dynamic lighting: flickering corridor lights and rotating searchlights.
   */
  private buildDynamicLights(): void {
    const { grid, gridWidth, gridHeight, rooms } = this.mazeData;

    // --- Flickering corridor lights ---
    // Place point lights in corridors at regular intervals
    const corridorLightPositions: { x: number; z: number }[] = [];

    // Scan for corridor cells (walkable, not in room)
    for (let z = 0; z < gridHeight; z++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[z][x] !== 0) continue;
        if (this.isCellInRoom(x, z)) continue;

        // Place a light every 5 cells in corridors
        if ((x + z) % 5 === 0) {
          corridorLightPositions.push({ x, z });
        }
      }
    }

    // Limit the number of corridor lights
    const maxCorridorLights = 30;
    const corridorLightCount = Math.min(corridorLightPositions.length, maxCorridorLights);

    for (let i = 0; i < corridorLightCount; i++) {
      const pos = corridorLightPositions[i];
      const worldX = pos.x - gridWidth / 2;
      const worldZ = pos.z - gridHeight / 2;

      // Create flickering point light
      const light = new THREE.PointLight(0x00ffcc, 1.0, 8);
      light.position.set(worldX + 0.5, 2.5, worldZ + 0.5);
      light.castShadow = false;

      this.scene.add(light);

      // Store for animation
      this.flickerLights.push({
        light,
        baseIntensity: 0.8 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 3,
      });
    }

    // --- Rotating searchlights in large rooms ---
    // Find large rooms (medium or large size)
    for (const room of rooms) {
      // Skip start and exit rooms
      if (room.type === 'start' || room.type === 'exit' || room.type === 'arena') continue;

      // Only place searchlights in medium or large rooms
      const isLargeRoom = room.width >= 12 && room.depth >= 12;
      if (!isLargeRoom) continue;

      // Room center in world coordinates
      const centerX = room.x + room.width / 2 - gridWidth / 2;
      const centerZ = room.z + room.depth / 2 - gridHeight / 2;

      // Create a pivot object at the room center
      const pivot = new THREE.Object3D();
      pivot.position.set(centerX, 0, centerZ);
      this.scene.add(pivot);

      // Create the spotlight
      const spotlight = new THREE.SpotLight(0xff6600, 2.0, 15, Math.PI / 6, 0.5, 1);
      spotlight.castShadow = false;

      // Position the spotlight at a radius from the pivot
      const radius = Math.min(room.width, room.depth) * 0.3;
      const height = 4.0;

      spotlight.position.set(radius, height, 0);

      // Create a target for the spotlight
      const target = new THREE.Object3D();
      target.position.set(0, 0, 0);
      this.scene.add(target);
      spotlight.target = target;

      // Add the spotlight to the pivot (so it rotates with the pivot)
      pivot.add(spotlight);

      // Store for animation
      this.searchlights.push({
        light: spotlight,
        pivot,
        radius,
        height,
        speed: 0.5 + Math.random() * 0.5,
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Builds the green holographic spawn pad at the spawn point.
   */
  private buildSpawnPad(): void {
    const { spawnPoint, gridWidth, gridHeight } = this.mazeData;

    const worldX = spawnPoint.x - gridWidth / 2;
    const worldZ = spawnPoint.z - gridHeight / 2;

    // Holographic circle
    const circleGeometry = new THREE.CircleGeometry(1.5, 32);
    const circleMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(worldX + 0.5, 0.02, worldZ + 0.5);
    this.scene.add(circle);
    this.meshes.push(circle);

    // Outer ring
    const ringGeometry = new THREE.RingGeometry(1.5, 1.7, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 2.0,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(worldX + 0.5, 0.03, worldZ + 0.5);
    this.scene.add(ring);
    this.meshes.push(ring);

    // Inner ring (pulsing)
    const innerRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
    const innerRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.set(worldX + 0.5, 0.04, worldZ + 0.5);
    this.scene.add(innerRing);
    this.meshes.push(innerRing);
  }

  /**
   * Builds the green exit marker at the exit point.
   */
  private buildExitMarker(): void {
    const { exitPoint, gridWidth, gridHeight } = this.mazeData;

    const worldX = exitPoint.x - gridWidth / 2;
    const worldZ = exitPoint.z - gridHeight / 2;

    // Glowing pillar
    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 16);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(worldX + 0.5, 1.25, worldZ + 0.5);
    pillar.castShadow = true;
    this.scene.add(pillar);
    this.meshes.push(pillar);

    // Arrow on top (cone pointing up)
    const arrowGeometry = new THREE.ConeGeometry(0.4, 0.8, 16);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(worldX + 0.5, 2.9, worldZ + 0.5);
    arrow.castShadow = true;
    this.scene.add(arrow);
    this.meshes.push(arrow);

    // Base ring
    const baseRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
    const baseRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1,
    });
    const baseRing = new THREE.Mesh(baseRingGeometry, baseRingMaterial);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(worldX + 0.5, 0.02, worldZ + 0.5);
    this.scene.add(baseRing);
    this.meshes.push(baseRing);
  }

  /**
   * Updates door animations, dynamic lighting, and arrow bobbing.
   * @param deltaTime - Time since last frame in seconds
   * @param playerPosition - The player's world position
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // Track elapsed time for animations
    this.elapsedTime += deltaTime;

    // --- Door animations ---
    const { gridWidth, gridHeight } = this.mazeData;

    for (const entity of this.doorEntities) {
      // Calculate door world position
      const doorWorldX = entity.door.x - gridWidth / 2 + 0.5;
      const doorWorldZ = entity.door.z - gridHeight / 2 + 0.5;

      // Check distance from player to door
      const dx = playerPosition.x - doorWorldX;
      const dz = playerPosition.z - doorWorldZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Set target based on proximity
      entity.targetY = distance < this.doorActivationRadius ? this.doorSlideDistance : 0;

      // Smoothly animate door position
      const diff = entity.targetY - entity.currentY;
      const maxDelta = this.doorSpeed * deltaTime;
      const clampedDelta = THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
      entity.currentY += clampedDelta;

      // Apply to door group (door slides up into ceiling)
      entity.group.position.y = entity.currentY;
    }

    // --- Flickering corridor lights ---
    for (const flicker of this.flickerLights) {
      // Oscillate intensity using sin
      const oscillation = Math.sin(this.elapsedTime * flicker.speed + flicker.phase);
      const intensity = flicker.baseIntensity * (0.7 + 0.3 * oscillation);
      flicker.light.intensity = intensity;
    }

    // --- Rotating searchlights ---
    for (const searchlight of this.searchlights) {
      // Update rotation angle
      searchlight.angle += searchlight.speed * deltaTime;

      // Rotate the pivot around Y axis
      searchlight.pivot.rotation.y = searchlight.angle;

      // The spotlight is a child of the pivot, so it rotates with it
      // The spotlight position is already set relative to the pivot
    }

    // --- Bob holographic arrows ---
    for (const arrow of this.arrowMeshes) {
      // Bob the arrow up and down
      const bobOffset = Math.sin(this.elapsedTime * 2) * 0.1;
      arrow.position.y = 0.2 + bobOffset;
    }
  }

  /**
   * Checks if a position is walkable on the collision grid.
   * @param x - World X coordinate
   * @param z - World Z coordinate
   * @returns True if walkable (floor or door), false if wall or out of bounds
   */
  public isWalkable(x: number, z: number): boolean {
    const { grid, gridWidth, gridHeight } = this.mazeData;

    // Convert world coordinates to grid coordinates
    const gridX = Math.floor(x + gridWidth / 2);
    const gridZ = Math.floor(z + gridHeight / 2);

    // Bounds check
    if (gridX < 0 || gridX >= gridWidth || gridZ < 0 || gridZ >= gridHeight) {
      return false;
    }

    // 0 = floor, 2 = door opening (both walkable)
    const cell = grid[gridZ][gridX];
    return cell === 0 || cell === 2;
  }

  /**
   * Removes all meshes from the scene and disposes all resources.
   */
  public dispose(): void {
    // Remove all meshes from the scene
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);

      // Dispose geometries and materials
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    // Dispose flickering lights
    for (const flicker of this.flickerLights) {
      this.scene.remove(flicker.light);
      flicker.light.dispose();
    }
    this.flickerLights = [];

    // Dispose searchlights
    for (const searchlight of this.searchlights) {
      // Remove the pivot (which contains the spotlight)
      this.scene.remove(searchlight.pivot);
      searchlight.light.dispose();
    }
    this.searchlights = [];

    // Dispose textures
    for (const texture of this.textures) {
      texture.dispose();
    }

    // Clear references
    this.meshes = [];
    this.doorEntities = [];
    this.textures = [];
    this.arrowMeshes = [];
  }
}