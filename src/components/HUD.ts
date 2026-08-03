/**
 * HUD
 *
 * Full HUD manager for the MAZE STRIKE game (Phase 6).
 * Manages all HUD elements: health/armor bars, weapon info, enemy counter,
 * level indicator, minimap, crosshair, damage vignette, kill feed, and boss health bar.
 *
 * All elements are built programmatically and appended to the provided container.
 * The HUD is a full-screen overlay with pointer-events: none.
 */
export default class HUD {
  /** The container element that holds the HUD */
  private container: HTMLElement;

  /** The root HUD overlay element */
  private root: HTMLDivElement;

  /** Health bar fill element */
  private healthFill: HTMLDivElement;

  /** Armor bar fill element */
  private armorFill: HTMLDivElement;

  /** Health bar container (for color transitions) */
  private healthBarContainer: HTMLDivElement;

  /** Armor bar container (for color transitions) */
  private armorBarContainer: HTMLDivElement;

  /** Weapon name element */
  private weaponName: HTMLDivElement;

  /** Magazine ammo element (large) */
  private magAmmo: HTMLDivElement;

  /** Reserve ammo element (small) */
  private reserveAmmo: HTMLDivElement;

  /** Enemy counter element */
  private enemyCounter: HTMLDivElement;

  /** Level indicator element */
  private levelIndicator: HTMLDivElement;

  /** Crosshair element */
  private crosshair: HTMLDivElement;

  /** Damage vignette element */
  private vignette: HTMLDivElement;

  /** Kill feed container element */
  private killFeed: HTMLDivElement;

  /** Boss bar container element */
  private bossBarContainer: HTMLDivElement;

  /** Boss name element */
  private bossName: HTMLDivElement;

  /** Boss health fill element */
  private bossHealthFill: HTMLDivElement;

  /** Reload indicator element */
  private reloadIndicator: HTMLDivElement;

  /** Reload progress bar fill element */
  private reloadBarFill: HTMLDivElement;

  /** Objective notification element */
  private objectiveNotification: HTMLDivElement;

  /** Array of active kill feed timers for cleanup */
  private killFeedTimers: number[] = [];

  /** Vignette animation frame ID */
  private vignetteFrameId: number | null = null;

  /** Vignette fade-out start time */
  private vignetteStartTime: number = 0;

  /** Vignette fade-out duration in ms */
  private readonly vignetteDuration: number = 500;

  /** Bound mousemove handler for crosshair tracking */
  private handleMouseMove: ((e: MouseEvent) => void) | null = null;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /**
   * Creates a new HUD and appends it to the given container.
   * @param container - The HTMLElement to append the HUD to
   */
  constructor(container: HTMLElement) {
    this.container = container;

    // Build the root overlay
    this.root = document.createElement('div');
    this.root.className = 'hud-root';
    this.root.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      overflow: hidden;
      font-family: 'Courier New', monospace;
    `;

    // Build all HUD sections in order
    this.buildHealthArmorBars();
    this.buildWeaponInfo();
    this.buildEnemyCounter();
    this.buildLevelIndicator();
    this.buildCrosshair();
    this.buildVignette();
    this.buildKillFeed();
    this.buildBossBar();
    this.buildReloadIndicator();
    this.buildObjectiveNotification();
    this.buildScanlines();

    // Append the root to the container
    this.container.appendChild(this.root);
  }

  /**
   * Builds the health and armor bars in the bottom-left corner.
   */
  private buildHealthArmorBars(): void {
    // Container for both bars
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 24px;
      width: 260px;
      z-index: 10;
    `;

    // --- Health Bar ---
    const healthLabel = document.createElement('div');
    healthLabel.textContent = 'HULL';
    healthLabel.style.cssText = `
      font-size: 10px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.7);
      text-transform: uppercase;
      margin-bottom: 2px;
      text-shadow: 0 0 4px rgba(0, 255, 204, 0.5);
    `;
    container.appendChild(healthLabel);

    this.healthBarContainer = document.createElement('div');
    this.healthBarContainer.style.cssText = `
      width: 100%;
      height: 14px;
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 255, 204, 0.3);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 8px;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    `;
    container.appendChild(this.healthBarContainer);

    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #00cc66, #00ff88);
      box-shadow: 0 0 8px rgba(0, 255, 136, 0.4);
      transition: width 0.2s ease-out;
    `;
    this.healthBarContainer.appendChild(this.healthFill);

    // --- Armor Bar ---
    const armorLabel = document.createElement('div');
    armorLabel.textContent = 'ARMOR';
    armorLabel.style.cssText = `
      font-size: 10px;
      letter-spacing: 2px;
      color: rgba(0, 150, 255, 0.7);
      text-transform: uppercase;
      margin-bottom: 2px;
      text-shadow: 0 0 4px rgba(0, 150, 255, 0.5);
    `;
    container.appendChild(armorLabel);

    this.armorBarContainer = document.createElement('div');
    this.armorBarContainer.style.cssText = `
      width: 100%;
      height: 14px;
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 150, 255, 0.3);
      border-radius: 2px;
      overflow: hidden;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    `;
    container.appendChild(this.armorBarContainer);

    this.armorFill = document.createElement('div');
    this.armorFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #0066cc, #0099ff);
      box-shadow: 0 0 8px rgba(0, 153, 255, 0.4);
      transition: width 0.2s ease-out;
    `;
    this.armorBarContainer.appendChild(this.armorFill);

    this.root.appendChild(container);
  }

  /**
   * Builds the weapon info display in the bottom-right corner.
   */
  private buildWeaponInfo(): void {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      bottom: 24px;
      right: 24px;
      text-align: right;
      z-index: 10;
    `;

    // Weapon name
    this.weaponName = document.createElement('div');
    this.weaponName.textContent = 'M9 SIDEARM';
    this.weaponName.style.cssText = `
      font-size: 12px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.8);
      text-shadow: 0 0 6px rgba(0, 255, 204, 0.5);
      margin-bottom: 4px;
      text-transform: uppercase;
    `;
    container.appendChild(this.weaponName);

    // Ammo row (magazine + reserve)
    const ammoRow = document.createElement('div');
    ammoRow.style.cssText = `
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: 8px;
    `;
    container.appendChild(ammoRow);

    // Magazine ammo (large)
    this.magAmmo = document.createElement('div');
    this.magAmmo.textContent = '12';
    this.magAmmo.style.cssText = `
      font-size: 36px;
      font-weight: bold;
      color: #00ffcc;
      text-shadow: 0 0 12px rgba(0, 255, 204, 0.6);
      line-height: 1;
    `;
    ammoRow.appendChild(this.magAmmo);

    // Reserve ammo (small)
    this.reserveAmmo = document.createElement('div');
    this.reserveAmmo.textContent = '/ 48';
    this.reserveAmmo.style.cssText = `
      font-size: 16px;
      color: rgba(0, 255, 204, 0.6);
      text-shadow: 0 0 6px rgba(0, 255, 204, 0.3);
    `;
    ammoRow.appendChild(this.reserveAmmo);

    this.root.appendChild(container);
  }

  /**
   * Builds the enemy counter in the top-center-left area.
   */
  private buildEnemyCounter(): void {
    this.enemyCounter = document.createElement('div');
    this.enemyCounter.textContent = 'ENEMIES REMAINING: 0';
    this.enemyCounter.style.cssText = `
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.9);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.5);
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 4px;
      padding: 6px 14px;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      white-space: nowrap;
      z-index: 10;
    `;
    this.root.appendChild(this.enemyCounter);
  }

  /**
   * Builds the level indicator in the top-center.
   */
  private buildLevelIndicator(): void {
    this.levelIndicator = document.createElement('div');
    this.levelIndicator.textContent = 'LEVEL 1 / 10';
    this.levelIndicator.style.cssText = `
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      letter-spacing: 3px;
      color: rgba(0, 255, 204, 0.8);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.5);
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 4px;
      padding: 6px 14px;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 10;
    `;
    this.root.appendChild(this.levelIndicator);
  }

  /**
   * Builds the crosshair in the center of the screen.
   */
  private buildCrosshair(): void {
    this.crosshair = document.createElement('div');
    this.crosshair.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 40px;
      height: 40px;
      transform: translate(-50%, -50%);
      z-index: 20;
      transition: transform 0.1s ease-out;
      pointer-events: none;
    `;

    // Crosshair lines
    const lineStyle = `
      position: absolute;
      background: #00ffcc;
      box-shadow: 0 0 4px rgba(0, 255, 204, 0.8), 0 0 8px rgba(0, 255, 204, 0.4);
      border-radius: 1px;
    `;

    // Top line
    const top = document.createElement('div');
    top.style.cssText = `${lineStyle} top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 10px;`;
    this.crosshair.appendChild(top);

    // Bottom line
    const bottom = document.createElement('div');
    bottom.style.cssText = `${lineStyle} bottom: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 10px;`;
    this.crosshair.appendChild(bottom);

    // Left line
    const left = document.createElement('div');
    left.style.cssText = `${lineStyle} left: 0; top: 50%; transform: translateY(-50%); width: 10px; height: 2px;`;
    this.crosshair.appendChild(left);

    // Right line
    const right = document.createElement('div');
    right.style.cssText = `${lineStyle} right: 0; top: 50%; transform: translateY(-50%); width: 10px; height: 2px;`;
    this.crosshair.appendChild(right);

    // Center dot
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #00ffcc;
      box-shadow: 0 0 4px rgba(0, 255, 204, 0.8), 0 0 8px rgba(0, 255, 204, 0.4);
    `;
    this.crosshair.appendChild(dot);

    this.root.appendChild(this.crosshair);

    // Track mouse movement to update crosshair position
    this.handleMouseMove = (e: MouseEvent) => {
      this.crosshair.style.left = `${e.clientX}px`;
      this.crosshair.style.top = `${e.clientY}px`;
    };
    document.addEventListener('mousemove', this.handleMouseMove);
  }

  /**
   * Builds the damage vignette overlay on the screen edges.
   */
  private buildVignette(): void {
    this.vignette = document.createElement('div');
    this.vignette.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 5;
      pointer-events: none;
      opacity: 0;
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        rgba(255, 0, 0, 0.4) 70%,
        rgba(255, 0, 0, 0.7) 100%
      );
      transition: opacity 0.1s ease-out;
    `;
    this.root.appendChild(this.vignette);
  }

  /**
   * Builds the kill feed container in the top-left.
   */
  private buildKillFeed(): void {
    this.killFeed = document.createElement('div');
    this.killFeed.style.cssText = `
      position: absolute;
      top: 80px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 10;
    `;
    this.root.appendChild(this.killFeed);
  }

  /**
   * Builds the boss health bar (hidden by default).
   */
  private buildBossBar(): void {
    this.bossBarContainer = document.createElement('div');
    this.bossBarContainer.style.cssText = `
      position: absolute;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      width: 400px;
      z-index: 10;
      display: none;
    `;

    // Boss name
    this.bossName = document.createElement('div');
    this.bossName.textContent = 'BOSS';
    this.bossName.style.cssText = `
      font-size: 14px;
      letter-spacing: 3px;
      color: rgba(255, 68, 68, 0.9);
      text-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
      text-align: center;
      margin-bottom: 4px;
      text-transform: uppercase;
    `;
    this.bossBarContainer.appendChild(this.bossName);

    // Boss health bar
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      width: 100%;
      height: 18px;
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(255, 68, 68, 0.5);
      border-radius: 2px;
      overflow: hidden;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    `;
    this.bossBarContainer.appendChild(barContainer);

    this.bossHealthFill = document.createElement('div');
    this.bossHealthFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #cc0000, #ff4444);
      box-shadow: 0 0 12px rgba(255, 68, 68, 0.6);
      transition: width 0.2s ease-out;
    `;
    barContainer.appendChild(this.bossHealthFill);

    this.root.appendChild(this.bossBarContainer);
  }

  /**
   * Builds the reload indicator (hidden by default).
   */
  private buildReloadIndicator(): void {
    this.reloadIndicator = document.createElement('div');
    this.reloadIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      font-weight: bold;
      color: #ff4444;
      text-shadow: 0 0 8px rgba(255, 68, 68, 0.9), 0 0 16px rgba(255, 68, 68, 0.6);
      background: rgba(10, 14, 20, 0.4);
      border: 1px solid rgba(255, 68, 68, 0.4);
      border-radius: 8px;
      padding: 12px 24px;
      letter-spacing: 4px;
      z-index: 10;
      display: none;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      flex-direction: column;
      align-items: center;
      gap: 8px;
      box-shadow: 0 0 15px rgba(255, 68, 68, 0.2);
    `;

    // Reload text
    const label = document.createElement('div');
    label.textContent = 'RELOADING';
    this.reloadIndicator.appendChild(label);

    // Progress bar container
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      width: 180px;
      height: 10px;
      background: rgba(255, 68, 68, 0.2);
      border-radius: 5px;
      overflow: hidden;
      border: 1px solid rgba(255, 68, 68, 0.3);
    `;

    // Progress bar fill
    this.reloadBarFill = document.createElement('div');
    this.reloadBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #ff4444, #ff6666);
      border-radius: 5px;
      transition: width 0.05s linear;
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.8), 0 0 20px rgba(255, 68, 68, 0.4);
    `;
    barContainer.appendChild(this.reloadBarFill);
    this.reloadIndicator.appendChild(barContainer);

    this.root.appendChild(this.reloadIndicator);
  }

  /**
   * Builds the scanline overlay effect across the entire screen.
   */
  private buildScanlines(): void {
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 999;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(0, 255, 255, 0.03) 0px,
        rgba(0, 255, 255, 0.03) 1px,
        transparent 1px,
        transparent 3px
      );
    `;
    this.root.appendChild(scanlines);
  }

  /**
   * Updates the health bar.
   * @param health - Current health value
   * @param maxHealth - Maximum health value
   */
  public updateHealth(health: number, maxHealth: number): void {
    if (this.disposed) return;

    // Clamp values to valid range
    const clampedHealth = Math.max(0, Math.min(health, maxHealth));
    const clampedMax = Math.max(1, maxHealth);

    // Calculate percentage
    const percentage = (clampedHealth / clampedMax) * 100;

    // Update the fill width
    this.healthFill.style.width = `${percentage}%`;

    // Color transition: green → yellow → red as health decreases
    if (percentage > 50) {
      this.healthFill.style.background = 'linear-gradient(to right, #00cc66, #00ff88)';
    } else if (percentage > 25) {
      this.healthFill.style.background = 'linear-gradient(to right, #ccaa00, #ffcc00)';
    } else {
      this.healthFill.style.background = 'linear-gradient(to right, #cc0000, #ff4444)';
    }
  }

  /**
   * Updates the armor bar.
   * @param armor - Current armor value
   * @param maxArmor - Maximum armor value
   */
  public updateArmor(armor: number, maxArmor: number): void {
    if (this.disposed) return;

    // Clamp values to valid range
    const clampedArmor = Math.max(0, Math.min(armor, maxArmor));
    const clampedMax = Math.max(1, maxArmor);

    // Calculate percentage
    const percentage = (clampedArmor / clampedMax) * 100;

    // Update the fill width
    this.armorFill.style.width = `${percentage}%`;

    // Dim the armor bar when empty
    if (percentage <= 0) {
      this.armorFill.style.opacity = '0.3';
    } else {
      this.armorFill.style.opacity = '1';
    }
  }

  /**
   * Updates the weapon info display.
   * @param name - Weapon name
   * @param magAmmo - Magazine ammo count
   * @param reserveAmmo - Reserve ammo count
   */
  public updateWeapon(name: string, magAmmo: number, reserveAmmo: number): void {
    if (this.disposed) return;

    this.weaponName.textContent = name;
    this.magAmmo.textContent = String(Math.max(0, Math.floor(magAmmo)));
    this.reserveAmmo.textContent = `/ ${reserveAmmo === Infinity ? '∞' : Math.max(0, Math.floor(reserveAmmo))}`;

    // Flash red when magazine is empty
    if (magAmmo <= 0) {
      this.magAmmo.style.color = '#ff4444';
      this.magAmmo.style.textShadow = '0 0 12px rgba(255, 68, 68, 0.8)';
    } else {
      this.magAmmo.style.color = '#00ffcc';
      this.magAmmo.style.textShadow = '0 0 12px rgba(0, 255, 204, 0.6)';
    }
  }

  /**
   * Updates the enemy counter.
   * @param count - Number of enemies remaining
   */
  public updateEnemyCount(count: number): void {
    if (this.disposed) return;
    this.enemyCounter.textContent = `ENEMIES REMAINING: ${Math.max(0, count)}`;
  }

  /**
   * Updates the level indicator.
   * @param level - Current level number (1-10)
   */
  public updateLevel(level: number): void {
    if (this.disposed) return;
    const clampedLevel = Math.max(1, Math.min(10, level));
    this.levelIndicator.textContent = `LEVEL ${clampedLevel} / 10`;
  }

  /**
   * Sets the crosshair expansion state.
   * @param expanded - Whether the crosshair should be expanded
   */
  public setCrosshairExpanded(expanded: boolean): void {
    if (this.disposed) return;

    if (expanded) {
      this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.3)';
    } else {
      this.crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }
  }

  /**
   * Triggers the damage vignette effect.
   * The vignette fades in briefly then fades out over time.
   */
  public triggerDamageVignette(): void {
    if (this.disposed) return;

    // Cancel any existing fade-out animation
    if (this.vignetteFrameId !== null) {
      cancelAnimationFrame(this.vignetteFrameId);
      this.vignetteFrameId = null;
    }

    // Set vignette to full opacity
    this.vignette.style.opacity = '1';

    // Start the fade-out animation
    this.vignetteStartTime = performance.now();
    this.animateVignetteFade();
  }

  /**
   * Animates the vignette fade-out using requestAnimationFrame.
   */
  private animateVignetteFade(): void {
    if (this.disposed) return;

    const elapsed = performance.now() - this.vignetteStartTime;
    const progress = Math.min(1, elapsed / this.vignetteDuration);

    // Ease-out: start fast, slow down
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Fade from 1 to 0
    this.vignette.style.opacity = String(1 - easedProgress);

    if (progress < 1) {
      // Continue animation
      this.vignetteFrameId = requestAnimationFrame(() => this.animateVignetteFade());
    } else {
      // Animation complete
      this.vignette.style.opacity = '0';
      this.vignetteFrameId = null;
    }
  }

  /**
   * Shows a kill feed entry with fade-out animation.
   * @param message - The kill feed message to display
   */
  public showKillFeed(message: string): void {
    if (this.disposed) return;

    // Create the kill feed entry element
    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry';
    entry.textContent = message;
    entry.style.cssText = `
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(255, 68, 68, 0.5);
      border-left: 3px solid rgba(0, 255, 204, 0.8);
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      letter-spacing: 1px;
      color: rgba(0, 255, 204, 0.9);
      text-shadow: 0 0 6px rgba(0, 255, 204, 0.5);
      margin-bottom: 4px;
      opacity: 1;
      transition: opacity 0.3s ease-out;
      animation: kill-feed-fade-in 0.3s ease-out;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      white-space: nowrap;
    `;

    // Append to the kill feed container
    this.killFeed.appendChild(entry);

    // Remove the entry after 3 seconds with a fade-out animation
    const timer = window.setTimeout(() => {
      // Add fade-out class for CSS transition
      entry.style.opacity = '0';

      // Remove from DOM after the fade-out animation completes (300ms)
      const removeTimer = window.setTimeout(() => {
        if (entry.parentElement === this.killFeed) {
          this.killFeed.removeChild(entry);
        }
      }, 300);
      this.killFeedTimers.push(removeTimer);
    }, 3000);
    this.killFeedTimers.push(timer);
  }

  /**
   * Shows the boss health bar.
   * @param name - Boss name
   * @param health - Current boss health
   * @param maxHealth - Maximum boss health
   */
  public showBossBar(name: string, health: number, maxHealth: number): void {
    if (this.disposed) return;

    this.bossBarContainer.style.display = 'block';
    this.bossName.textContent = name;
    this.updateBossBar(health, maxHealth);
  }

  /**
   * Hides the boss health bar.
   */
  public hideBossBar(): void {
    if (this.disposed) return;
    this.bossBarContainer.style.display = 'none';
  }

  /**
   * Updates the boss health bar.
   * @param health - Current boss health
   * @param maxHealth - Maximum boss health
   */
  public updateBossBar(health: number, maxHealth: number): void {
    if (this.disposed) return;

    // Clamp values to valid range
    const clampedHealth = Math.max(0, Math.min(health, maxHealth));
    const clampedMax = Math.max(1, maxHealth);

    // Calculate percentage
    const percentage = (clampedHealth / clampedMax) * 100;

    // Update the fill width
    this.bossHealthFill.style.width = `${percentage}%`;

    // Color transition: red → orange → yellow as health decreases
    if (percentage > 66) {
      this.bossHealthFill.style.background = 'linear-gradient(to right, #cc0000, #ff4444)';
    } else if (percentage > 33) {
      this.bossHealthFill.style.background = 'linear-gradient(to right, #cc6600, #ff8800)';
    } else {
      this.bossHealthFill.style.background = 'linear-gradient(to right, #cccc00, #ffff00)';
    }
  }

  /**
   * Shows the reload indicator.
   */
  public showReloadIndicator(): void {
    if (this.disposed) return;
    this.reloadIndicator.style.display = 'block';
  }

  /**
   * Hides the reload indicator.
   */
  public hideReloadIndicator(): void {
    if (this.disposed) return;
    this.reloadIndicator.style.display = 'none';
    this.reloadBarFill.style.width = '0%';
  }

  /**
   * Updates the reload progress bar.
   * @param progress - Reload progress from 0 to 1
   */
  public updateReloadProgress(progress: number): void {
    if (this.disposed) return;
    const clamped = Math.max(0, Math.min(1, progress));
    this.reloadBarFill.style.width = `${clamped * 100}%`;
  }

  /**
   * Builds the objective notification (persistent banner at top-center).
   */
  private buildObjectiveNotification(): void {
    this.objectiveNotification = document.createElement('div');
    this.objectiveNotification.textContent = '';
    this.objectiveNotification.style.cssText = `
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 16px;
      letter-spacing: 3px;
      color: #00ffcc;
      text-shadow: 0 0 12px rgba(0, 255, 204, 0.8), 0 0 24px rgba(0, 255, 204, 0.4);
      text-align: center;
      white-space: nowrap;
      z-index: 25;
      pointer-events: none;
      background: rgba(10, 14, 20, 0.85);
      border: 1px solid rgba(0, 255, 204, 0.4);
      border-radius: 4px;
      padding: 10px 24px;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      display: none;
      animation: objective-pulse 2s ease-in-out infinite alternate;
    `;
    this.root.appendChild(this.objectiveNotification);

    // Add pulse animation
    if (!document.getElementById('objective-keyframes')) {
      const style = document.createElement('style');
      style.id = 'objective-keyframes';
      style.textContent = `
        @keyframes objective-pulse {
          0% { box-shadow: 0 0 10px rgba(0, 255, 204, 0.2); }
          100% { box-shadow: 0 0 20px rgba(0, 255, 204, 0.5); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Shows a persistent objective notification banner.
   * @param message - The objective message to display
   */
  public showObjective(message: string): void {
    if (this.disposed) return;
    this.objectiveNotification.textContent = message;
    this.objectiveNotification.style.display = 'block';
  }

  /**
   * Hides the objective notification banner.
   */
  public hideObjective(): void {
    if (this.disposed) return;
    this.objectiveNotification.style.display = 'none';
  }

  /**
   * Disposes all resources and cleans up.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Cancel vignette animation
    if (this.vignetteFrameId !== null) {
      cancelAnimationFrame(this.vignetteFrameId);
      this.vignetteFrameId = null;
    }

    // Clear all kill feed timers
    for (const timer of this.killFeedTimers) {
      window.clearTimeout(timer);
    }
    this.killFeedTimers = [];

    // Remove crosshair mousemove listener
    if (this.handleMouseMove) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      this.handleMouseMove = null;
    }

    // Remove the root element from the DOM
    if (this.root.parentElement === this.container) {
      this.container.removeChild(this.root);
    }
  }
}