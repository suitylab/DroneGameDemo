# MAZE STRIKE

> **This game are fully generated with SUITY Agentic, using DeepSeek V4 Flash.**

**MAZE STRIKE** is a top-down third-person shooter built with **TypeScript + Vite + THREE.js**. You pilot an advanced combat drone through a procedurally generated, high-tech military maze — hunting hostile mech units, scavenging powerful weapons, and fighting colossal bosses across **10 escalating levels**. Every visual element, from the neon-lit corridors to the muzzle flash of your plasma rifle, is rendered procedurally in real time.

---

## 🎮 Features

### Procedural Maze Generation
- Randomly generated mazes composed of **rooms, doors, and corridors** with a unique random seed per level.
- Military-base themed: dark grey concrete floors, metal panel walls with rivets, hazard stripes, and glowing emissive strips.
- Doors slide open as the drone approaches; a minimap tracks explored areas, enemies, and the exit.

### Drone Player Character
- **Keyboard (WASD / Arrows):** move the drone.
- **Mouse:** aim / face direction.
- **Left click:** fire the current weapon.
- Smooth rotation, hover-bob animation, spinning rotors, and wall collision.

### Rich Bullet Effects
- **Muzzle flash** (bright light + glowing sprite)
- **Tracer** (glowing line from muzzle to impact)
- **Impact sparks** (10–20 particles + light flash)
- **Shell casings** (brass casings ejected with gravity and bounce)
- Screen shake on heavy weapons

### 6 Pickable Weapons
| # | Weapon | Type | Special |
|---|--------|------|---------|
| 1 | **M9 Sidearm** | Pistol | Balanced starter |
| 2 | **Viper SMG** | SMG | High fire rate |
| 3 | **Titan Shotgun** | Shotgun | 8-pellet spread |
| 4 | **Longbow Rifle** | Rifle | High damage / velocity |
| 5 | **Pulsar Plasma** | Energy | Glowing plasma orbs |
| 6 | **Havoc Rocket** | Launcher | AoE explosion |

Weapons appear as floating holographic models on cyan pads. Switch with **1–6** keys or the **mouse wheel**. Auto-reload when the magazine is empty.

### 7 Mech Enemy Types
| # | Enemy | Behavior |
|---|-------|----------|
| 1 | **Scout Drone** | Fast quadcopter, flees when damaged |
| 2 | **Sentry MK-I** | Standard rifle mech |
| 3 | **Sentry MK-II** | SMG burst-fire mech |
| 4 | **Brute** | Slow heavy mech, melee charge |
| 5 | **Reaper** | Fast mech, dash attack |
| 6 | **Warden** | Shield mech, blocks frontal damage |
| 7 | **Phantom** | Stealth mech, invisible until it attacks |

Enemies use a **3-state AI** (Patrol → Investigate → Attack) with line-of-sight checks, hearing radius, and alert propagation — they search for you and attack when found.

### 3 Boss Types
| Boss | Level | Health | Signature Attacks |
|------|-------|--------|-------------------|
| **Colossus** | 4 | 800 | Missile barrage, ground slam, summons |
| **Vanguard** | 7 | 1200 | Plasma beam sweep, stomp, deploys drones |
| **Overseer** | 10 | 2000 | Orbital laser, shockwave nova, summons |

Each boss has **2–3 phases** with dramatic phase-transition effects, telegraphed attacks, and a dedicated arena.

### 10 Levels with Scaling Difficulty
- **Levels 1–3:** Small maze (6 rooms), 5–10 enemies, progressive weapon unlocks.
- **Levels 4–7:** Medium maze (8 rooms), 12–18 enemies, all weapons, bosses at 4 & 7.
- **Levels 8–10:** Large maze (10 rooms), 20–25 enemies, all weapons, boss at 10.
- Completing a level unlocks the next; the **Victory screen** appears after level 10.

### Cool HUD & UI
- **HULL** (green) and **ARMOR** (blue) bars
- Weapon name + magazine/reserve ammo
- **ENEMIES REMAINING** counter
- **LEVEL X / 10** indicator
- Circular **minimap** with fog-of-war
- Dynamic **crosshair** (expands on fire)
- Red **damage vignette**
- **Kill feed** notifications
- **Boss health bar**
- Full screens: **Main Menu**, **Level Select**, **Pause**, **Level Complete**, **Game Over**, **Victory**, and **How to Play**

### Visual Polish
- Military base aesthetics with high-tech neon accents
- Dynamic lighting: flickering corridor lights, rotating searchlights, muzzle flash illumination
- Shadows, fog, and emissive glow
- Procedural props: crates, tech panels, pipes
- Holographic arrows pointing to the exit
- Color-coded death explosions and particle-rich impacts

---

## 🛠 Tech Stack

- **TypeScript**
- **Vite**
- **THREE.js**
- All graphics are **procedural** (no external binary assets)

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Development mode (local preview)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Open the local URL (default `http://localhost:5173`) in your browser to play.

---

## 🎯 Controls

| Action | Key |
|--------|-----|
| Move | `WASD` / `Arrow Keys` |
| Aim | `Mouse` |
| Fire | `Left Click` |
| Switch Weapon | `1–6` / `Mouse Wheel` |
| Pause | `ESC` |

---

## 📁 Project Structure

```
├── docs/
│   ├── user-request.md        # Raw user requirement (SSOT)
│   ├── design-doc.md          # Product vision & UX design (SSOT)
│   └── development-plan.md    # Vertical-slice execution roadmap (SSOT)
├── src/
│   ├── main.ts                # Entry point
│   ├── style.css              # Global styles
│   └── components/            # Game modules (30+ TypeScript files)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 📚 Documentation

- [Design Document](docs/design-doc.md)
- [Development Plan](docs/development-plan.md)
- [Raw User Request](docs/user-request.md)

---

## ✅ Status

**Complete** — All 10 levels, 6 weapons, 7 enemy types, 3 bosses, full HUD/UI flow, and visual polish are implemented and verified. The project builds with **0 errors**.
