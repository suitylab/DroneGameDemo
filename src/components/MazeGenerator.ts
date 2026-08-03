/**
 * MazeGenerator
 *
 * Procedural maze generation for MAZE STRIKE.
 * Generates a military-base themed layout with rooms, corridors, and doors,
 * and builds a grid-based collision map.
 *
 * Grid coordinate system:
 *   - x: column index (east-west, matches Three.js X axis)
 *   - z: row index (north-south, matches Three.js Z axis)
 *   - grid[z][x] is the cell at (x, z)
 *
 * Grid cell values:
 *   - 0: walkable floor
 *   - 1: solid wall
 *   - 2: door opening (walkable, but tracked separately for door entities)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Room size category */
export type RoomSize = 'small' | 'medium' | 'large';

/** Room type — 'start' and 'exit' override the size category for special rooms */
export type RoomType = RoomSize | 'start' | 'exit' | 'arena';

/** Boss arena type — determines the arena layout and boss to spawn */
export type ArenaType = 'colossus' | 'vanguard' | 'overseer';

/** A single room in the maze */
export interface Room {
  /** Grid X coordinate of the room's top-left corner */
  x: number;
  /** Grid Z coordinate of the room's top-left corner */
  z: number;
  /** Room width in grid cells (along X axis) */
  width: number;
  /** Room depth in grid cells (along Z axis) */
  depth: number;
  /** Room type: size category, or 'start'/'exit' for special rooms */
  type: RoomType;
}

/** Boss arena data for the dedicated boss fight room */
export interface BossArena {
  /** The type of boss arena (determines which boss to spawn) */
  arenaType: ArenaType;
  /** Grid X coordinate of the arena center */
  centerX: number;
  /** Grid Z coordinate of the arena center */
  centerZ: number;
  /** Arena width in grid cells (along X axis) */
  width: number;
  /** Arena depth in grid cells (along Z axis) */
  depth: number;
  /** Cover pillar positions (grid coordinates, 4 pillars) — for 'colossus' arenas */
  pillars: { x: number; z: number }[];
  /** Elevated platform positions (grid coordinates + height) — for 'vanguard' arenas */
  elevatedPlatforms: { x: number; z: number; width: number; depth: number; height: number }[];
  /** Destructible cover positions (grid coordinates) — for 'overseer' arenas */
  destructibleCover: { x: number; z: number; width: number; depth: number }[];
}

/** A door connecting a room to a corridor */
export interface Door {
  /** Grid X coordinate of the door cell */
  x: number;
  /** Grid Z coordinate of the door cell */
  z: number;
  /**
   * Door orientation:
   *   - 'horizontal': door is on a north/south wall (corridor approaches along Z)
   *   - 'vertical': door is on an east/west wall (corridor approaches along X)
   */
  orientation: 'horizontal' | 'vertical';
  /** Index of the room this door belongs to (into MazeData.rooms) */
  roomIndex: number;
}

/** A corridor segment connecting two rooms */
export interface Corridor {
  /** Grid X coordinate of the corridor's start */
  startX: number;
  /** Grid Z coordinate of the corridor's start */
  startZ: number;
  /** Grid X coordinate of the corridor's end */
  endX: number;
  /** Grid Z coordinate of the corridor's end */
  endZ: number;
  /** Corridor width in grid cells (always 3) */
  width: number;
}

/** Complete maze data returned by the generator */
export interface MazeData {
  /** Random seed used for this maze (displayed on intro overlay) */
  seed: number;
  /** 2D collision grid: grid[z][x] = 0 (floor), 1 (wall), 2 (door) */
  grid: number[][];
  /** Grid width in cells (along X axis) */
  gridWidth: number;
    /** Grid height in cells (along Z axis) */
  gridHeight: number;
  /** Number of rooms in this maze */
  roomCount: number;
  /** All rooms in the maze */
  rooms: Room[];
  /** All doors in the maze */
  doors: Door[];
  /** All corridors connecting rooms */
  corridors: Corridor[];
  /** Player spawn point (center of start room) */
  spawnPoint: { x: number; z: number };
  /** Exit point (center of exit room) */
  exitPoint: { x: number; z: number };
  /** Target dummy spawn points (grid coordinates, one per eligible room) */
  dummySpawns: { x: number; z: number }[];
  /** Weapon pickup spawn points (grid coordinates + weapon type ID) */
  weaponSpawns: { x: number; z: number; weaponId: string }[];
  /** Enemy spawn points (grid coordinates + enemy type ID) */
  enemySpawns: { x: number; z: number; typeId: string }[];
  /** Boss arena data (null if no boss arena in this maze) */
  bossArena: BossArena | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Grid dimensions — fixed at 80x80, sufficient for 6 rooms + corridors */
const GRID_WIDTH = 80;
const GRID_HEIGHT = 80;

/** Corridor width in grid cells */
const CORRIDOR_WIDTH = 3;

/** Padding between rooms when placing (in grid cells) */
const ROOM_PADDING = 2;

/** Maximum placement attempts per room */
const MAX_PLACEMENT_ATTEMPTS = 500;

/** Size (width/depth) in grid cells for each room size category */
const ROOM_DIMENSIONS: Record<RoomSize, { width: number; depth: number }> = {
  small: { width: 8, depth: 8 },
  medium: { width: 12, depth: 12 },
  large: { width: 16, depth: 16 },
};

/** Size (width/depth) in grid cells for each boss arena type */
const ARENA_DIMENSIONS: Record<ArenaType, { width: number; depth: number }> = {
  colossus: { width: 20, depth: 20 },
  vanguard: { width: 24, depth: 24 },
  overseer: { width: 28, depth: 28 },
};

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------

/**
 * Creates a deterministic pseudo-random number generator from a seed.
 * Implements the mulberry32 algorithm — fast, small, and well-distributed.
 *
 * @param seed - 32-bit integer seed
 * @returns A function that returns a float in [0, 1)
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0; // Ensure unsigned 32-bit

  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// MazeGenerator
// ---------------------------------------------------------------------------

/**
 * Generates procedural maze layouts for MAZE STRIKE.
 *
  * The generator places rooms (6, 8, or 10 by default) on an 80x80 grid,
 * connects them with 3-unit-wide L-shaped corridors, adds doors at room
 * entrances, and builds a grid-based collision map. The room count can be
 * customized via the roomCount option (defaults to 6).
 *
 * The first room is marked as 'start' (player spawn) and the last as 'exit'.
 * When an arenaType is provided, the last room becomes a boss arena room
 * with arena-specific features (pillars, elevated platforms, or destructible cover).
 */
export default class MazeGenerator {
  /**
   * Generates a complete maze layout.
   *
   * @param seed - Optional seed for deterministic generation
      * @param options - Optional generation options
   * @param options.arenaType - When provided, the last room becomes a boss arena of this type
   * @param options.roomCount - Number of rooms to generate (defaults to 6)
   * @returns A MazeData object containing the grid, rooms, doors, corridors,
   *          spawn point, and exit point.
   */
    public generate(seed?: number, options?: { arenaType?: ArenaType; roomCount?: number }): MazeData {
    // 1. Generate a random seed (or use the provided one for deterministic generation)
    const effectiveSeed = seed ?? Math.floor(Math.random() * 1000000);

    // 2. Create deterministic RNG from seed
    const rng = mulberry32(effectiveSeed);

    // 3. Place rooms
    const arenaType = options?.arenaType ?? null;
    const roomCount = options?.roomCount ?? 6;
    const rooms = this.placeRooms(rng, arenaType, roomCount);

    // 4. Connect rooms with corridors
    const corridors = this.connectRooms(rooms, rng);

    // 5. Build the collision grid
    const grid = this.buildGrid(rooms, corridors);

    // 6. Detect doors where corridors meet rooms
    const doors = this.detectDoors(grid, rooms);

    // 7. Mark doors in the grid (2 = door)
    for (const door of doors) {
      grid[door.z][door.x] = 2;
    }

    // 8. Determine spawn and exit points
    const startRoom = rooms[0];
    const exitRoom = rooms[rooms.length - 1];

    const spawnPoint = {
      x: startRoom.x + Math.floor(startRoom.width / 2),
      z: startRoom.z + Math.floor(startRoom.depth / 2),
    };

    const exitPoint = {
      x: exitRoom.x + Math.floor(exitRoom.width / 2),
      z: exitRoom.z + Math.floor(exitRoom.depth / 2),
    };

    // 9. Calculate target dummy spawn points
    // Place 1 dummy in each room that is NOT the start room and NOT the exit room.
    // The dummy is placed at the room center plus a random offset of up to
    // 25% of the room's width/depth, ensuring it stays within the interior.
    const dummySpawns: { x: number; z: number }[] = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];

      // Room center (grid coordinates)
      const centerX = room.x + room.width / 2;
      const centerZ = room.z + room.depth / 2;

      // Random offset within 25% of room dimensions
      const offsetX = (rng() * 2 - 1) * room.width * 0.25;
      const offsetZ = (rng() * 2 - 1) * room.depth * 0.25;

      // Clamp to room interior (keep at least 1 cell away from walls)
      const dummyX = Math.max(
        room.x + 1,
        Math.min(room.x + room.width - 1, centerX + offsetX)
      );
      const dummyZ = Math.max(
        room.z + 1,
        Math.min(room.z + room.depth - 1, centerZ + offsetZ)
      );

      dummySpawns.push({ x: dummyX, z: dummyZ });
    }

    // 9.5 Calculate weapon pickup spawn points
    // Designate 2-3 intermediate rooms (not start, not exit) as armory rooms
    // and assign the 5 non-M9 weapon type IDs to spawn points in those rooms.
    // Each weapon is placed at the room center with a small random offset,
    // clamped to stay within the room interior.
    const weaponSpawns: { x: number; z: number; weaponId: string }[] = [];

    // The 5 non-M9 weapon type IDs (string literals to avoid circular imports)
    const armoryWeaponIds = [
      'viper_smg',
      'titan_shotgun',
      'longbow_rifle',
      'pulsar_plasma',
      'havoc_rocket',
    ];

    // Collect intermediate room indices (skip start room at index 0 and exit room at last index)
    const intermediateRoomIndices: number[] = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      intermediateRoomIndices.push(i);
    }

    // Determine how many armory rooms to use (2-3, but no more than available intermediate rooms)
    const armoryRoomCount = Math.min(
      intermediateRoomIndices.length,
      2 + Math.floor(rng() * 2) // 2 or 3
    );

    // Shuffle intermediate room indices for random selection
    for (let i = intermediateRoomIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [intermediateRoomIndices[i], intermediateRoomIndices[j]] = [
        intermediateRoomIndices[j],
        intermediateRoomIndices[i],
      ];
    }

    // Select the first N rooms as armory rooms
    const armoryRooms = intermediateRoomIndices.slice(0, armoryRoomCount);

    // Distribute the 5 weapons across the armory rooms
    // Each armory room gets at least 1 weapon; remaining weapons are distributed round-robin
    for (let i = 0; i < armoryWeaponIds.length; i++) {
      // Pick the armory room for this weapon (round-robin across armory rooms)
      const roomIndex = armoryRooms[i % armoryRooms.length];
      const room = rooms[roomIndex];

      // Room center (grid coordinates)
      const centerX = room.x + room.width / 2;
      const centerZ = room.z + room.depth / 2;

      // Random offset within 20% of room dimensions (smaller than dummy offset
      // to keep weapons near the center of the pad)
      const offsetX = (rng() * 2 - 1) * room.width * 0.2;
      const offsetZ = (rng() * 2 - 1) * room.depth * 0.2;

      // Clamp to room interior (keep at least 1 cell away from walls)
      const weaponX = Math.max(
        room.x + 1,
        Math.min(room.x + room.width - 1, centerX + offsetX)
      );
      const weaponZ = Math.max(
        room.z + 1,
        Math.min(room.z + room.depth - 1, centerZ + offsetZ)
      );

      weaponSpawns.push({
        x: weaponX,
        z: weaponZ,
        weaponId: armoryWeaponIds[i],
      });
    }

    // 9.75 Calculate enemy spawn points
    // Place 4-6 enemies in intermediate rooms (not start, not exit).
    // Distribute them across 2-3 rooms with at least 2 enemies per room.
    // Use a mix of 'scout_drone' and 'sentry_mk1' type IDs.
    // Place at room centers with random offsets clamped to room interior.
    const enemySpawns: { x: number; z: number; typeId: string }[] = [];

    // The two Phase 5 enemy type IDs
    const enemyTypeIds = ['scout_drone', 'sentry_mk1'];

    // Collect intermediate room indices (skip start room at index 0 and exit room at last index)
    const enemyRoomIndices: number[] = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      enemyRoomIndices.push(i);
    }

    // Determine how many rooms get enemies (2-3, but no more than available intermediate rooms)
    const enemyRoomCount = Math.min(
      enemyRoomIndices.length,
      2 + Math.floor(rng() * 2) // 2 or 3
    );

    // Shuffle intermediate room indices for random selection
    for (let i = enemyRoomIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [enemyRoomIndices[i], enemyRoomIndices[j]] = [
        enemyRoomIndices[j],
        enemyRoomIndices[i],
      ];
    }

    // Select the first N rooms as enemy rooms
    const enemyRooms = enemyRoomIndices.slice(0, enemyRoomCount);

    // Determine total enemy count (4-6)
    const totalEnemyCount = 4 + Math.floor(rng() * 3); // 4, 5, or 6

    // Distribute enemies across the selected rooms (at least 2 per room)
    // First pass: assign 2 enemies to each room
    // Second pass: distribute remaining enemies round-robin
    const enemiesPerRoom: number[] = new Array(enemyRooms.length).fill(2);
    let remainingEnemies = totalEnemyCount - enemyRooms.length * 2;

    // Distribute remaining enemies round-robin
    let roomIdx = 0;
    while (remainingEnemies > 0) {
      enemiesPerRoom[roomIdx % enemyRooms.length]++;
      remainingEnemies--;
      roomIdx++;
    }

    // Generate enemy spawn points for each room
    for (let r = 0; r < enemyRooms.length; r++) {
      const roomIndex = enemyRooms[r];
      const room = rooms[roomIndex];
      const count = enemiesPerRoom[r];

      for (let e = 0; e < count; e++) {
        // Room center (grid coordinates)
        const centerX = room.x + room.width / 2;
        const centerZ = room.z + room.depth / 2;

        // Random offset within 30% of room dimensions (spread enemies out)
        const offsetX = (rng() * 2 - 1) * room.width * 0.3;
        const offsetZ = (rng() * 2 - 1) * room.depth * 0.3;

        // Clamp to room interior (keep at least 1 cell away from walls)
        const enemyX = Math.max(
          room.x + 1,
          Math.min(room.x + room.width - 1, centerX + offsetX)
        );
        const enemyZ = Math.max(
          room.z + 1,
          Math.min(room.z + room.depth - 1, centerZ + offsetZ)
        );

        // Randomly pick enemy type (mix of scout_drone and sentry_mk1)
        const typeId = enemyTypeIds[Math.floor(rng() * enemyTypeIds.length)];

        enemySpawns.push({
          x: enemyX,
          z: enemyZ,
          typeId,
        });
      }
    }

    // 9.9 Calculate boss arena data if requested
    let bossArena: BossArena | null = null;
    if (arenaType) {
      const arenaRoom = rooms[rooms.length - 1];
      const centerX = arenaRoom.x + Math.floor(arenaRoom.width / 2);
      const centerZ = arenaRoom.z + Math.floor(arenaRoom.depth / 2);

      // Generate arena-specific data based on the arena type
      const pillars: { x: number; z: number }[] = [];
      const elevatedPlatforms: { x: number; z: number; width: number; depth: number; height: number }[] = [];
      const destructibleCover: { x: number; z: number; width: number; depth: number }[] = [];

      switch (arenaType) {
        case 'colossus':
          // 4 pillars at (centerX ± 5, centerZ ± 5), clamped to room interior
          const pillarOffset = 5;
          pillars.push(
            {
              x: Math.max(arenaRoom.x + 1, Math.min(arenaRoom.x + arenaRoom.width - 1, centerX - pillarOffset)),
              z: Math.max(arenaRoom.z + 1, Math.min(arenaRoom.z + arenaRoom.depth - 1, centerZ - pillarOffset)),
            },
            {
              x: Math.max(arenaRoom.x + 1, Math.min(arenaRoom.x + arenaRoom.width - 1, centerX + pillarOffset)),
              z: Math.max(arenaRoom.z + 1, Math.min(arenaRoom.z + arenaRoom.depth - 1, centerZ - pillarOffset)),
            },
            {
              x: Math.max(arenaRoom.x + 1, Math.min(arenaRoom.x + arenaRoom.width - 1, centerX - pillarOffset)),
              z: Math.max(arenaRoom.z + 1, Math.min(arenaRoom.z + arenaRoom.depth - 1, centerZ + pillarOffset)),
            },
            {
              x: Math.max(arenaRoom.x + 1, Math.min(arenaRoom.x + arenaRoom.width - 1, centerX + pillarOffset)),
              z: Math.max(arenaRoom.z + 1, Math.min(arenaRoom.z + arenaRoom.depth - 1, centerZ + pillarOffset)),
            }
          );
          break;

        case 'vanguard':
          // 3 elevated platforms at varying heights (1.5, 2.5, 3.5 units)
          // positioned around the arena center
          const platformHeights = [1.5, 2.5, 3.5];
          const platformAngles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
          const platformRadius = Math.min(arenaRoom.width, arenaRoom.depth) * 0.25;

          for (let i = 0; i < 3; i++) {
            const angle = platformAngles[i];
            const px = centerX + Math.cos(angle) * platformRadius;
            const pz = centerZ + Math.sin(angle) * platformRadius;

            // Clamp to room interior (keep at least 2 cells away from walls)
            const platformX = Math.max(
              arenaRoom.x + 2,
              Math.min(arenaRoom.x + arenaRoom.width - 3, Math.round(px))
            );
            const platformZ = Math.max(
              arenaRoom.z + 2,
              Math.min(arenaRoom.z + arenaRoom.depth - 3, Math.round(pz))
            );

            elevatedPlatforms.push({
              x: platformX,
              z: platformZ,
              width: 4,
              depth: 4,
              height: platformHeights[i],
            });
          }
          break;

        case 'overseer':
          // 6-8 destructible cover crates/pillars scattered around the arena
          const coverCount = 6 + Math.floor(rng() * 3); // 6, 7, or 8
          const coverSizes = [2, 3]; // Small crates and larger pillars

          for (let i = 0; i < coverCount; i++) {
            // Random position within the arena interior (keep 2 cells from walls)
            const cx = arenaRoom.x + 2 + Math.floor(rng() * (arenaRoom.width - 4));
            const cz = arenaRoom.z + 2 + Math.floor(rng() * (arenaRoom.depth - 4));

            // Random size
            const size = coverSizes[Math.floor(rng() * coverSizes.length)];

            // Avoid placing cover too close to the center (keep center open)
            const distFromCenter = Math.sqrt(
              (cx - centerX) * (cx - centerX) + (cz - centerZ) * (cz - centerZ)
            );
            if (distFromCenter < 4) continue;

            destructibleCover.push({
              x: cx,
              z: cz,
              width: size,
              depth: size,
            });
          }
          break;
      }

      bossArena = {
        arenaType,
        centerX,
        centerZ,
        width: arenaRoom.width,
        depth: arenaRoom.depth,
        pillars,
        elevatedPlatforms,
        destructibleCover,
      };
    }

    // 10. Return complete maze data
        return {
      seed: effectiveSeed,
      grid,
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      roomCount,
      rooms,
      doors,
      corridors,
      spawnPoint,
      exitPoint,
      dummySpawns,
      weaponSpawns,
      enemySpawns,
      bossArena,
    };
  }

    /**
   * Builds the room size array for the given room count.
   *
   * Distributes rooms proportionally across size categories:
   *   - roomCount 6: 2 small, 2 medium, 2 large
   *   - roomCount 8: 2 small, 3 medium, 3 large
   *   - roomCount 10: 3 small, 3 medium, 4 large
   *   - Other counts: roughly 1/3 small, 1/3 medium, 1/3 large
   *
   * @param roomCount - The number of rooms to build sizes for
   * @returns An array of room sizes with length equal to roomCount
   */
  private buildRoomSizes(roomCount: number): RoomSize[] {
    let smallCount: number;
    let mediumCount: number;
    let largeCount: number;

    switch (roomCount) {
      case 6:
        smallCount = 2;
        mediumCount = 2;
        largeCount = 2;
        break;
      case 8:
        smallCount = 2;
        mediumCount = 3;
        largeCount = 3;
        break;
      case 10:
        smallCount = 3;
        mediumCount = 3;
        largeCount = 4;
        break;
      default:
        // Proportional distribution (roughly 1/3 each)
        smallCount = Math.round(roomCount / 3);
        mediumCount = Math.round(roomCount / 3);
        largeCount = roomCount - smallCount - mediumCount;
        break;
    }

    const sizes: RoomSize[] = [];
    for (let i = 0; i < smallCount; i++) sizes.push('small');
    for (let i = 0; i < mediumCount; i++) sizes.push('medium');
    for (let i = 0; i < largeCount; i++) sizes.push('large');
    return sizes;
  }

  /**
   * Places rooms on the grid without overlap.
   *
   * @param rng - The deterministic random number generator
   * @param arenaType - When provided, the last room becomes a boss arena of this type
   * @param roomCount - Number of rooms to place (defaults to 6)
   * @returns An array of placed rooms
   * @throws Error if a room cannot be placed after MAX_PLACEMENT_ATTEMPTS
   */
  private placeRooms(rng: () => number, arenaType: ArenaType | null = null, roomCount: number = 6): Room[] {
    const rooms: Room[] = [];
    const roomSizes = this.buildRoomSizes(roomCount);

    for (let i = 0; i < roomCount; i++) {
      const size = roomSizes[i];
      // Use arena dimensions for the last room when arenaType is provided
      const isArenaRoom = arenaType !== null && i === roomCount - 1;
      const dimensions = isArenaRoom
        ? ARENA_DIMENSIONS[arenaType]
        : ROOM_DIMENSIONS[size];
      const { width, depth } = dimensions;

      let placed = false;

      // Try up to MAX_PLACEMENT_ATTEMPTS times
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
        // Random position within grid bounds (with 1-cell margin)
        const x = 1 + Math.floor(rng() * (GRID_WIDTH - width - 2));
        const z = 1 + Math.floor(rng() * (GRID_HEIGHT - depth - 2));

        // Check for overlap with existing rooms (with padding)
        if (!this.overlapsAny(rooms, x, z, width, depth)) {
          // Determine room type: first = 'start', last = 'arena' (if arenaType) or 'exit', else size category
          let type: RoomType = size;
          if (i === 0) type = 'start';
                    if (i === roomSizes.length - 1) type = isArenaRoom ? 'arena' : 'exit';

          rooms.push({ x, z, width, depth, type });
          placed = true;
          break;
        }
      }

      if (!placed) {
        throw new Error(
          `MazeGenerator: Failed to place room ${i} (${size}) after ${MAX_PLACEMENT_ATTEMPTS} attempts. ` +
            `Grid may be too small for the requested room count.`
        );
      }
    }

    return rooms;
  }

  /**
   * Checks if a proposed room placement overlaps any existing room.
   *
   * @param rooms - Existing rooms
   * @param x - Proposed room X coordinate
   * @param z - Proposed room Z coordinate
   * @param width - Proposed room width
   * @param depth - Proposed room depth
   * @returns True if the proposed placement overlaps any existing room
   */
  private overlapsAny(
    rooms: Room[],
    x: number,
    z: number,
    width: number,
    depth: number
  ): boolean {
    for (const room of rooms) {
      // Check overlap with padding
      const noOverlap =
        x + width + ROOM_PADDING <= room.x ||
        room.x + room.width + ROOM_PADDING <= x ||
        z + depth + ROOM_PADDING <= room.z ||
        room.z + room.depth + ROOM_PADDING <= z;

      if (!noOverlap) {
        return true; // Overlaps
      }
    }
    return false; // No overlap
  }

  /**
   * Connects consecutive rooms with L-shaped corridors.
   *
   * For each pair (room i, room i+1), creates an L-shaped path from the center
   * of one to the center of the other. The path goes horizontally first, then
   * vertically (or vice versa, randomly chosen).
   *
   * @param rooms - The placed rooms
   * @param rng - The deterministic random number generator
   * @returns An array of corridors
   */
  private connectRooms(rooms: Room[], rng: () => number): Corridor[] {
    const corridors: Corridor[] = [];

    for (let i = 0; i < rooms.length - 1; i++) {
      const roomA = rooms[i];
      const roomB = rooms[i + 1];

      // Room centers
      const startX = roomA.x + Math.floor(roomA.width / 2);
      const startZ = roomA.z + Math.floor(roomA.depth / 2);
      const endX = roomB.x + Math.floor(roomB.width / 2);
      const endZ = roomB.z + Math.floor(roomB.depth / 2);

      // Randomly choose whether to go horizontal-first or vertical-first
      const horizontalFirst = rng() < 0.5;

      if (horizontalFirst) {
        // Horizontal segment: (startX, startZ) -> (endX, startZ)
        // Vertical segment: (endX, startZ) -> (endX, endZ)
        corridors.push({
          startX,
          startZ,
          endX,
          endZ,
          width: CORRIDOR_WIDTH,
        });
      } else {
        // Vertical segment: (startX, startZ) -> (startX, endZ)
        // Horizontal segment: (startX, endZ) -> (endX, endZ)
        corridors.push({
          startX,
          startZ,
          endX,
          endZ,
          width: CORRIDOR_WIDTH,
        });
      }
    }

    return corridors;
  }

  /**
   * Builds the collision grid from rooms and corridors.
   *
   * Grid values:
   *   - 0: walkable floor (room interior, corridor path)
   *   - 1: solid wall (everything else)
   *   - 2: door opening (set later by detectDoors)
   *
   * @param rooms - The placed rooms
   * @param corridors - The corridors connecting rooms
   * @returns A 2D grid array: grid[z][x]
   */
  private buildGrid(rooms: Room[], corridors: Corridor[]): number[][] {
    // Initialize grid with all walls (1)
    const grid: number[][] = [];
    for (let z = 0; z < GRID_HEIGHT; z++) {
      const row: number[] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        row.push(1);
      }
      grid.push(row);
    }

    // Carve rooms (fill interior with 0)
    for (const room of rooms) {
      for (let z = room.z; z < room.z + room.depth; z++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          // Bounds check (should always be in bounds, but be safe)
          if (z >= 0 && z < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
            grid[z][x] = 0;
          }
        }
      }
    }

    // Carve corridors (fill path with 0)
    for (const corridor of corridors) {
      this.carveCorridor(grid, corridor);
    }

    return grid;
  }

  /**
   * Carves a corridor path into the grid.
   *
   * The corridor is an L-shaped path from (startX, startZ) to (endX, endZ),
   * with a width of CORRIDOR_WIDTH cells. The path goes horizontally first,
   * then vertically.
   *
   * @param grid - The grid to carve into
   * @param corridor - The corridor to carve
   */
  private carveCorridor(grid: number[][], corridor: Corridor): void {
    const { startX, startZ, endX, endZ, width } = corridor;
    const halfWidth = Math.floor(width / 2);

    // Horizontal segment: from startX to endX at startZ
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    for (let x = minX; x <= maxX; x++) {
      for (let dz = -halfWidth; dz <= halfWidth; dz++) {
        const z = startZ + dz;
        if (z >= 0 && z < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
          grid[z][x] = 0;
        }
      }
    }

    // Vertical segment: from startZ to endZ at endX
    const minZ = Math.min(startZ, endZ);
    const maxZ = Math.max(startZ, endZ);
    for (let z = minZ; z <= maxZ; z++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = endX + dx;
        if (z >= 0 && z < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
          grid[z][x] = 0;
        }
      }
    }
  }

  /**
   * Detects doors where corridors meet rooms.
   *
   * Scans each room's boundary cells. A door exists where a corridor cell
   * (grid value 0) is adjacent to a room interior cell.
   *
   * @param grid - The collision grid (rooms and corridors carved)
   * @param rooms - The placed rooms
   * @returns An array of detected doors
   */
  private detectDoors(grid: number[][], rooms: Room[]): Door[] {
    const doors: Door[] = [];

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
      const room = rooms[roomIndex];

      // Scan the room's boundary cells (perimeter)
      for (let z = room.z; z < room.z + room.depth; z++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          // Only check boundary cells (not interior)
          const isBoundary =
            z === room.z ||
            z === room.z + room.depth - 1 ||
            x === room.x ||
            x === room.x + room.width - 1;

          if (!isBoundary) continue;

          // Check if this boundary cell is a corridor cell (walkable)
          if (grid[z][x] !== 0) continue;

          // Determine if this cell is adjacent to a room interior cell
          // (i.e., it's on the room's edge, not a corner)
          const isTopEdge = z === room.z;
          const isBottomEdge = z === room.z + room.depth - 1;
          const isLeftEdge = x === room.x;
          const isRightEdge = x === room.x + room.width - 1;

          // Check if this cell is a corner (skip corners — doors are on edges)
          const isCorner =
            (isTopEdge && isLeftEdge) ||
            (isTopEdge && isRightEdge) ||
            (isBottomEdge && isLeftEdge) ||
            (isBottomEdge && isRightEdge);

          if (isCorner) continue;

          // Determine orientation:
          // - If on top/bottom edge, the corridor approaches along Z → 'horizontal'
          // - If on left/right edge, the corridor approaches along X → 'vertical'
          let orientation: 'horizontal' | 'vertical';
          if (isTopEdge || isBottomEdge) {
            orientation = 'horizontal';
          } else {
            orientation = 'vertical';
          }

          // Add the door
          doors.push({
            x,
            z,
            orientation,
            roomIndex,
          });
        }
      }
    }

    return doors;
  }
}