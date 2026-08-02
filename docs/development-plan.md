# MAZE STRIKE — Execution Roadmap (Development Plan)

**Version:** 1.0  
**Status:** Single Source of Truth (SSOT) for Execution  
**Last Updated:** 2025-01-01  
**Reference:** `docs/design-doc.md` (Product Vision & UX SSOT)

---

## 1. Planning Principles

- **Vertical Slicing:** Every phase delivers a complete, runnable feature slice — data + logic + presentation together. No horizontal layers.
- **Walking Skeleton First:** Phase 1 establishes the minimal runnable main loop. The project builds and runs after every phase.
- **Hardcode to Dynamic:** Build with hardcoded data first to verify the loop, then replace with dynamic systems in later phases.
- **Continuous Integration:** Integration happens in every phase. Never leave integration to a final standalone phase.
- **Atomic Granularity:** Each phase is small and focused. Entity variations and complex systems are staggered across phases.
- **Always Runnable:** The project must be in a functional, bug-free, runnable state at the completion of every phase.

---

## 2. Phase Overview

| Phase | Title | Core Deliverable |
|-------|-------|------------------|
| 1 | Walking Skeleton & Core Initialization | Runnable main loop with movable drone placeholder |
| 2 | Procedural Maze Generation | Rooms, doors, corridors, collision, minimap data |
| 3 | Shooting & Bullet Effects | Fire bullets with muzzle flash, tracers, impacts, casings |
| 4 | Weapons & Pickups | 6 weapon types, pickup interaction, switching, ammo |
| 5 | Enemy AI — Core Types | Scout Drone + Sentry MK-I with patrol/investigate/attack |
| 6 | HUD & UI Screens | Full HUD, main menu, level select, pause, game over, level complete |
| 7 | Boss Fights — Colossus | First boss with 3 phases in dedicated arena |
| 8 | Enemy Expansion & Remaining Bosses | 5 more enemy types + Vanguard + Overseer |
| 9 | Level Progression & Difficulty Scaling | 10 levels with scaling, unlock progression, victory screen |
| 10 | Visual Polish & Lighting | Military base aesthetics, dynamic lighting, fog, shadows, particles |

---

## 3. Phase 1: Walking Skeleton & Core Initialization

### Functional Feature Scope (User Experience & Visuals)
- A dark-themed window launches displaying a central 3D canvas.
- A placeholder drone (simple grey box with a glowing cyan core) is visible in the center of an empty dark room.
- The player moves the drone with **WASD / Arrow Keys** (relative to the top-down camera).
- The drone smoothly rotates to face the **mouse cursor** position.
- A minimal HUD overlay in the top-left corner displays the drone's **X / Y position** in real time.
- The camera is fixed top-down, directly above the drone, following its movement.

### Technical Tasks
- Scaffold the project with TypeScript + Vite + THREE.js.
- Set up the entry point that initializes the renderer, scene, and camera.
- Implement the main update/render loop (requestAnimationFrame).
- Create a placeholder drone mesh (box body + glowing core) with hover-bob animation.
- Implement keyboard input handling for movement (WASD/Arrows).
- Implement mouse input handling for facing direction (smooth rotation).
- Implement a simple HUD overlay (HTML/CSS) showing the drone's position.
- Add a basic grid floor to provide spatial reference.

### Prior Code Adjustments & Rewiring
- N/A — this is the foundation phase.

### Verification Goal
- The project compiles and runs without errors.
- The user sees a dark scene with a drone placeholder on a grid floor.
- The drone moves with WASD/Arrows, rotates to face the mouse, and the HUD position readout updates live.

---

## 4. Phase 2: Procedural Maze Generation

### Functional Feature Scope (User Experience & Visuals)
- The empty room is replaced by a **procedurally generated maze** composed of rooms, doors, and corridors.
- The maze is military-base themed: dark grey concrete floors, metal panel walls with rivets, and subtle grid lines.
- The player spawns in a starting room marked with a **green holographic pad**.
- Doors slide open when the drone approaches within 3 units.
- The drone collides with walls and cannot pass through them.
- A **minimap** appears in the top-right corner, showing explored areas, the player (white dot), and the exit (green arrow).
- A **level intro overlay** appears for 3 seconds showing "3... 2... 1... ENGAGE" and the random seed.

### Technical Tasks
- Implement the maze generation algorithm: place 6 rooms (8x8, 12x12, 16x16) non-overlapping on a grid, connect them with 3-unit-wide corridors, and add doors at room entrances.
- Build a grid-based collision map (2D array) from the generated maze layout.
- Create 3D wall meshes from the collision map (metal panels with rivets).
- Create floor meshes (concrete with grid lines) for rooms and corridors.
- Implement door entities that slide open when the player is within 3 units.
- Implement player collision against the grid map.
- Generate a random seed per level and display it on the intro overlay.
- Implement the minimap rendering from the same grid data as collision.
- Add the level intro overlay with countdown and seed display.

### Prior Code Adjustments & Rewiring
- **Phase 1 grid floor:** Replace the single flat grid floor with the procedural maze floors.
- **Phase 1 player movement:** Rewire the movement system to check collision against the grid map instead of free movement.
- **Phase 1 HUD:** Add the minimap element to the existing HUD overlay.

### Verification Goal
- The user sees a procedurally generated maze with rooms, corridors, and doors.
- The drone navigates the maze, collides with walls, and doors slide open on approach.
- The minimap updates as the player explores, showing the player position and exit location.
- The level intro overlay displays the countdown and seed.

---

## 5. Phase 3: Shooting & Bullet Effects

### Functional Feature Scope (User Experience & Visuals)
- The drone now has a **weapon mount** underneath its body.
- **Left mouse click** fires a bullet from the weapon mount toward the mouse cursor direction.
- Each shot produces:
  - **Muzzle flash:** A brief bright light and small glowing sprite at the weapon mount.
  - **Tracer:** A glowing orange line from the muzzle to the impact point.
  - **Impact:** 10–20 spark particles and a brief light flash on hitting a wall.
  - **Shell casing:** A small brass-colored casing ejected from the weapon and falling to the ground.
- **Target dummies** (simple grey humanoid shapes) are placed in some rooms. They take damage when hit and explode into particles when destroyed.
- The HUD shows a **crosshair** at the center of the screen that expands when firing.
- The HUD ammo display shows "M9 SIDEARM — 12 / 48".

### Technical Tasks
- Implement a hardcoded "M9 Sidearm" weapon config (damage 15, fire rate 300 RPM, magazine 12, reserve 48, projectile speed 60 u/s).
- Implement bullet spawning: raycast from the weapon mount toward the aim direction.
- Implement bullet travel as fast projectiles with hit detection.
- Implement muzzle flash (point light + sprite that fades in 50ms).
- Implement tracer rendering (glowing line from muzzle to impact).
- Implement impact effects (spark particles + brief light flash).
- Implement shell casing ejection (small brass box with gravity and bounce).
- Create target dummy entities with health that take damage and explode on death.
- Add the crosshair to the HUD with dynamic expansion on fire.
- Add the ammo display to the HUD.

### Prior Code Adjustments & Rewiring
- **Phase 1 drone model:** Add the weapon mount to the drone mesh.
- **Phase 2 maze:** Place target dummies in designated rooms during maze generation.
- **Phase 2 HUD:** Add the crosshair and ammo display to the existing HUD overlay.

### Verification Goal
- The user clicks to fire, sees muzzle flash, tracer, impact sparks, and shell casings.
- Target dummies take damage and explode when destroyed.
- The crosshair expands on fire, and the ammo counter decreases with each shot.

---

## 6. Phase 4: Weapons & Pickups

### Functional Feature Scope (User Experience & Visuals)
- **6 weapon types** are now available in the game:
  1. **M9 Sidearm** — small silver pistol with orange glow.
  2. **Viper SMG** — compact black SMG with cyan accents, high fire rate.
  3. **Titan Shotgun** — heavy shotgun with red hazard stripes, fires 8 pellets in a spread.
  4. **Longbow Rifle** — long green rifle, high damage and velocity.
  5. **Pulsar Plasma** — blue energy weapon with glowing coil, fires plasma orbs.
  6. **Havoc Rocket** — large launcher with yellow warhead, fires rockets with AoE explosion.
- Weapons appear as **floating holographic models** on cyan holographic pads in armory rooms.
- The drone collects a weapon by flying over it. The weapon is added to the inventory.
- The player switches weapons with **1–6 keys** or the **mouse wheel**.
- Each weapon has distinct visuals, damage, fire rate, magazine, reserve ammo, and projectile speed.
- The HUD weapon display updates to show the current weapon name, magazine ammo (large), and reserve ammo (small).
- When the magazine is empty, the weapon auto-reloads (with a brief reload animation and "RELOADING" text).

### Technical Tasks
- Define 6 weapon configs with distinct stats (damage, RPM, magazine, reserve, projectile speed, special behavior).
- Implement a weapon inventory system (list of owned weapons, current weapon index).
- Implement weapon switching (keys 1–6 and mouse wheel).
- Implement weapon-specific firing behavior (shotgun pellet spread, rocket AoE, plasma orb visuals).
- Implement weapon pickup entities (floating holographic models on cyan pads).
- Implement ammo tracking per weapon (magazine + reserve) and auto-reload.
- Update the HUD weapon display to read from the inventory.
- Add the "RELOADING" text indicator during reload.

### Prior Code Adjustments & Rewiring
- **Phase 3 hardcoded M9:** Replace the single hardcoded weapon with the 6-weapon inventory system.
- **Phase 3 bullet spawning:** Rewire to use the current weapon's config for damage, fire rate, projectile speed, and visual effects.
- **Phase 3 HUD ammo display:** Rewire to read from the inventory's current weapon.
- **Phase 2 maze generation:** Add armory rooms with weapon pickup spawn points.

### Verification Goal
- The user picks up all 6 weapons, switches between them, and fires each with distinct visuals and stats.
- The HUD weapon display updates correctly, and reload works when the magazine is empty.
- The shotgun fires 8 pellets, the rocket explodes with AoE, and the plasma fires glowing orbs.

---

## 7. Phase 5: Enemy AI — Core Types

### Functional Feature Scope (User Experience & Visuals)
- **2 enemy types** are introduced:
  1. **Scout Drone** — small, fast, grey quadcopter. Patrols, flees when damaged, fires light lasers (5 dmg).
  2. **Sentry MK-I** — medium, green humanoid mech. Patrols, investigates noise/sight, fires rifles (10 dmg).
- Enemies spawn in rooms away from the player start.
- Enemies have a **3-state AI**:
  - **Patrol:** Move between 2–4 waypoints in their room, pausing 1–2 seconds at each.
  - **Investigate:** Move to the last known player position when they hear gunfire (within 10 units) or glimpse the player (sight cone 90 degrees, 15-unit range).
  - **Attack:** Chase the player, fire weapons, and strafe perpendicular every 2 seconds.
- Line-of-sight is checked via raycast every 0.1 seconds (blocked by walls).
- When an enemy enters Attack state, nearby enemies within 20 units are alerted and also enter Attack state.
- Enemies have health bars above their heads. When health reaches 0, they explode into particles and light.
- The HUD **enemy counter** shows "ENEMIES REMAINING: X" and updates live.
- The **kill feed** shows "ELIMINATED: SENTRY MK-I" when an enemy dies.

### Technical Tasks
- Implement the enemy AI state machine (Patrol → Investigate → Attack).
- Implement line-of-sight raycast checks.
- Implement alert propagation (within 20 units).
- Implement enemy health, damage taking, and death (explosion particles).
- Implement enemy movement (patrol waypoints, chase, strafe).
- Implement enemy attack behavior (Scout laser, Sentry rifle).
- Implement enemy spawn points in maze generation (away from player start).
- Add enemy health bars above enemies.
- Wire the HUD enemy counter and kill feed to the live enemy list.

### Prior Code Adjustments & Rewiring
- **Phase 2 maze generation:** Add enemy spawn points in rooms away from the player start.
- **Phase 3 target dummies:** Replace target dummies with real enemies in gameplay (keep dummies only in a debug mode).
- **Phase 4 HUD:** Add the enemy counter and kill feed elements.

### Verification Goal
- The user encounters Scout Drones and Sentry MK-Is that patrol, investigate gunfire, chase, and attack.
- Killing enemies updates the enemy counter and shows kill feed notifications.
- Alert propagation works: alerting one enemy alerts nearby ones.

---

## 8. Phase 6: HUD & UI Screens

### Functional Feature Scope (User Experience & Visuals)
- **Full HUD** is implemented:
  - **Bottom-left:** "HULL" (green health bar) and "ARMOR" (blue armor bar). Armor absorbs damage before health.
  - **Bottom-right:** Weapon name, magazine ammo (large), reserve ammo (small).
  - **Top-center-left:** "ENEMIES REMAINING: X".
  - **Top-center:** "LEVEL X / 10".
  - **Top-right:** Minimap (circular, shows explored areas, player, enemies in line-of-sight as red dots, exit as green arrow).
  - **Center:** Crosshair (expands on fire).
  - **Screen edges:** Red pulsing vignette when the drone takes damage.
  - **Top-left:** Kill feed ("ELIMINATED: {enemyName}").
  - **Top-center (boss fights):** Boss health bar with boss name.
- **Main Menu** screen:
  - Title: "MAZE STRIKE" (glowing cyan text with animated scanline effect).
  - Buttons: "START MISSION", "HOW TO PLAY", "QUIT".
  - Background: animated procedural maze with fog and searchlights.
- **How to Play** overlay:
  - Title: "CONTROLS".
  - Lines: "WASD / ARROWS — MOVE", "MOUSE — AIM", "LEFT CLICK — FIRE", "1-6 / WHEEL — SWITCH WEAPON", "ESC — PAUSE".
- **Level Select** screen:
  - Title: "SELECT MISSION".
  - Grid of 10 tiles (5x2). Unlocked tiles are bright with glowing borders; locked tiles are dark with a lock icon.
  - Back button: "BACK TO MAIN MENU".
- **Pause** overlay:
  - Title: "PAUSED".
  - Buttons: "RESUME", "RESTART LEVEL", "QUIT TO MENU".
- **Level Complete** screen:
  - Title: "LEVEL CLEAR".
  - Stats: "TIME: MM:SS", "ENEMIES DESTROYED: X/Y", "ACCURACY: XX%".
  - Buttons: "NEXT LEVEL", "LEVEL SELECT".
- **Game Over** screen:
  - Title: "DRONE DESTROYED".
  - Buttons: "RETRY LEVEL", "MAIN MENU".
- **Victory** screen (level 10):
  - Title: "ALL HOSTILES ELIMINATED".
  - Subtitle: "MISSION COMPLETE. ALL 10 LEVELS CLEARED."
  - Stats: total time, total enemies destroyed, total accuracy.
  - Button: "BACK TO MAIN MENU".

### Technical Tasks
- Implement the full HUD with all elements (health/armor bars, weapon info, enemy counter, level indicator, minimap, crosshair, damage vignette, kill feed, boss bar).
- Implement the main menu screen with title, buttons, and animated background.
- Implement the how-to-play overlay.
- Implement the level select screen with 10 tiles (locked/unlocked states).
- Implement the pause overlay.
- Implement the level complete screen with stats.
- Implement the game over screen.
- Implement the victory screen.
- Implement screen state management (menu → level select → gameplay → pause → game over → level complete → victory).
- Implement level unlock progression (in-memory, resets on page reload).

### Prior Code Adjustments & Rewiring
- **Phase 1 HUD:** Replace the minimal position HUD with the full HUD.
- **Phase 2 level intro:** Wire the level intro overlay to the screen state manager.
- **Phase 4 HUD weapon display:** Integrate into the full HUD.
- **Phase 5 enemy counter/kill feed:** Integrate into the full HUD.
- **Phase 5 enemy spawn:** Wire the level select screen to start the selected level.

### Verification Goal
- The user navigates the full UI flow: main menu → level select → gameplay → pause → game over → level complete → victory.
- All HUD elements display correctly and update live.
- Level unlock progression works (level 1 unlocked, others locked; completing a level unlocks the next).

---

## 9. Phase 7: Boss Fights — Colossus

### Functional Feature Scope (User Experience & Visuals)
- **Colossus** boss is introduced at Level 4:
  - Massive red mech, 3x player size.
  - Health: 800.
  - **Phase 1 (100–66%):** Triple missile barrage + ground slam (AoE).
  - **Phase 2 (66–33%):** Adds summoning of 2 Sentry MK-Is.
  - **Phase 3 (33–0%):** Enraged — faster missiles + continuous slam.
- The boss appears in a **dedicated arena room** (large open room with 4 cover pillars).
- A **boss health bar** appears at the top-center of the screen with the boss name "COLOSSUS".
- Phase transitions trigger a dramatic visual effect (shockwave + color flash) and a brief pause in the boss's attacks.
- The boss's attacks are telegraphed (e.g., a red warning circle before the slam, missile launch animation).

### Technical Tasks
- Implement the boss entity with 800 HP and 3 phases (health thresholds at 66% and 33%).
- Implement the missile barrage attack (3 missiles fired in sequence toward the player).
- Implement the ground slam attack (AoE with telegraph warning circle).
- Implement the summon attack (spawns 2 Sentry MK-Is).
- Implement phase transition logic (change attack patterns, speed, and visuals).
- Add the boss arena room type to the maze generator (large open room with 4 pillars).
- Wire the boss health bar in the HUD to the boss entity.
- Implement the dramatic phase-transition visual effect.

### Prior Code Adjustments & Rewiring
- **Phase 2 maze generation:** Add the boss arena room type (large, with pillars) for level 4.
- **Phase 5 enemy AI:** Reuse the Sentry MK-I AI for the boss's summoned minions.
- **Phase 6 HUD:** Wire the boss health bar to the boss entity.

### Verification Goal
- The user fights Colossus in the arena, sees all 3 phases with distinct attack patterns, and the boss health bar updates correctly.
- The boss's attacks are telegraphed and dodgeable.
- Phase transitions trigger the dramatic visual effect.

---

## 10. Phase 8: Enemy Expansion & Remaining Bosses

### Functional Feature Scope (User Experience & Visuals)
- **5 more enemy types** are added:
  1. **Sentry MK-II** — medium, orange humanoid mech. Fires SMG bursts (8 dmg, 3-round burst).
  2. **Brute** — large, red heavy mech. Slow, charges at the player for melee (25 dmg).
  3. **Reaper** — medium, black mech with scythe arm. Fast, dashes at the player for melee (20 dmg).
  4. **Warden** — large, blue shield mech. Blocks frontal damage with a shield, fires rifles (15 dmg).
  5. **Phantom** — medium, purple stealth mech. Invisible until it attacks, fires plasma (18 dmg).
- **Vanguard** boss is introduced at Level 7:
  - Blue quad-legged walker. Health: 1200.
  - **Phase 1 (100–50%):** Plasma beam sweep + stomp (AoE).
  - **Phase 2 (50–0%):** Adds deployment of 3 Scout Drones, beam sweeps faster.
  - Arena: wide arena with elevated platforms.
- **Overseer** boss is introduced at Level 10:
  - Giant black mech with glowing core. Health: 2000.
  - **Phase 1 (100–66%):** Orbital laser strike (telegraphed) + shockwave nova.
  - **Phase 2 (66–33%):** Adds summoning of 2 Brutes.
  - **Phase 3 (33–0%):** All patterns, faster, continuous laser.
  - Arena: massive arena with destructible cover.

### Technical Tasks
- Implement the 5 new enemy types with distinct visuals, stats, and AI behaviors.
- Implement the Vanguard boss with 2 phases and its attack patterns.
- Implement the Overseer boss with 3 phases and its attack patterns.
- Add the boss arena room types for levels 7 and 10.
- Wire the boss health bar for Vanguard and Overseer.
- Balance enemy spawn composition per level (mix of types).

### Prior Code Adjustments & Rewiring
- **Phase 5 enemy AI:** Extend the AI state machine to support new behaviors (melee charge, dash, shield blocking, stealth).
- **Phase 7 boss system:** Generalize the boss system to support 3 boss types with configurable phases and attacks.
- **Phase 6 level select:** Unlock levels 7 and 10 when the previous level is completed.

### Verification Goal
- The user encounters all 7 enemy types with distinct behaviors and visuals.
- The user fights Vanguard and Overseer with their unique attack patterns and phases.
- The boss health bar displays correctly for all 3 bosses.

---

## 11. Phase 9: Level Progression & Difficulty Scaling

### Functional Feature Scope (User Experience & Visuals)
- **10 levels** are fully playable with scaling difficulty:
  - **Levels 1–3:** Small maze (6 rooms), 5–10 enemies, basic enemy types, weapons unlock progressively.
  - **Levels 4–7:** Medium maze (8 rooms), 12–18 enemies, all enemy types, all 6 weapons, bosses at levels 4 and 7.
  - **Levels 8–10:** Large maze (10 rooms), 20–25 enemies, all enemy types, all 6 weapons, boss at level 10.
- Level unlock progression: completing a level unlocks the next. Progress resets on page reload.
- The level select screen shows all 10 tiles with locked/unlocked states.
- The level intro overlay shows the level number, seed, and countdown.
- The level complete screen shows stats (time, enemies destroyed, accuracy) and offers "NEXT LEVEL" or "LEVEL SELECT".
- The victory screen appears after completing level 10.

### Technical Tasks
- Define 10 level configs (maze size, room count, enemy count, enemy types, weapon availability, boss type).
- Implement level progression logic (load the selected level, track completion, unlock the next).
- Implement difficulty scaling (enemy count, health multiplier, spawn composition).
- Implement weapon availability per level (which weapons spawn in armory rooms).
- Wire the level select screen to load the selected level.
- Wire the level complete screen to unlock the next level.
- Implement the victory screen after level 10.

### Prior Code Adjustments & Rewiring
- **Phase 2 maze generation:** Parameterize by level config (room count, maze size).
- **Phase 4 weapon pickups:** Spawn only the weapons available for the current level.
- **Phase 5 enemy spawn:** Spawn the enemy types and counts defined by the level config.
- **Phase 6 level select:** Wire all 10 tiles to load the corresponding level config.
- **Phase 6 level complete:** Wire "NEXT LEVEL" to load the next level config.

### Verification Goal
- The user plays all 10 levels with scaling difficulty.
- Completing a level unlocks the next; the victory screen appears after level 10.
- Weapon availability and enemy composition match the level config.

---

## 12. Phase 10: Visual Polish & Lighting

### Functional Feature Scope (User Experience & Visuals)
- **Military base aesthetics** are fully realized:
  - Floors: dark grey concrete with subtle grid lines.
  - Walls: metal panels with rivets and panel seams.
  - Accents: yellow/black hazard stripes on door frames and edges.
  - Props: procedural crates (grey with orange stripes), tech panels (dark with glowing green/cyan screens), pipes along walls.
- **High-tech elements:**
  - Glowing cyan and orange emissive strips along walls and floors.
  - Holographic weapon pickups and holographic arrows pointing to the exit.
  - Neon cyan point lights in corridors, orange spotlights in rooms.
- **Dynamic lighting:**
  - Shadows enabled (directional light casts shadows; all objects cast and receive).
  - Subtle dark blue fog for depth.
  - Flickering corridor lights (intensity oscillates).
  - Rotating searchlights in large rooms.
  - Muzzle flash illumination (light illuminates nearby walls and enemies).
- **Particle richness:**
  - Enhanced impact effects (more sparks, debris).
  - Drone death explosion (bright flash + particle burst).
  - Enemy death explosions (color-coded by enemy type).
- **Balance tuning:** Adjust weapon damage, enemy health, and spawn rates for a satisfying difficulty curve.

### Technical Tasks
- Replace placeholder materials with polished procedural materials (concrete, metal, hazard stripes, emissive strips).
- Add procedural props (crates, tech panels, pipes) to rooms and corridors.
- Implement dynamic lighting (flickering lights, searchlights, muzzle flash illumination).
- Enable shadows and fog.
- Enhance particle effects (impacts, explosions, death).
- Add holographic arrows pointing to the exit.
- Tune weapon and enemy balance across all 10 levels.
- Clean up debug logs, temporary stubs, and hardcoded placeholders.

### Prior Code Adjustments & Rewiring
- **Phase 2 maze visuals:** Replace placeholder wall/floor materials with polished procedural materials.
- **Phase 3 bullet effects:** Enhance with richer particles and muzzle flash illumination.
- **Phase 4 weapon pickups:** Add holographic visual treatment.
- **Phase 5 enemy death:** Enhance with color-coded explosion particles.
- **Phase 6 main menu background:** Enhance with animated maze, fog, and searchlights.
- **Phase 7/8 boss arenas:** Add arena-specific props and lighting.

### Verification Goal
- The game matches the design doc vision: military base aesthetics, high-tech accents, dynamic lighting, fog, shadows, and rich particle effects.
- All 10 levels are playable with balanced difficulty.
- The project builds and runs flawlessly with no debug artifacts.