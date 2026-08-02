/**
 * UIManager
 *
 * Screen state manager for the MAZE STRIKE game (Phase 6).
 * Coordinates all UI screens and state transitions: main menu, level select,
 * how-to-play overlay, pause overlay, level complete screen, game over screen,
 * and victory screen.
 *
 * The UIManager manages the MainMenu and LevelSelect components and builds
 * the remaining overlays (how-to-play, pause, level complete, game over,
 * victory) programmatically with the sci-fi/military aesthetic.
 */
import MainMenu from './MainMenu';
import LevelSelect from './LevelSelect';

/**
 * Stats for the level complete screen.
 */
export interface LevelCompleteStats {
  /** Time taken to complete the level in seconds */
  time: number;
  /** Number of enemies destroyed */
  enemiesDestroyed: number;
  /** Total number of enemies in the level */
  totalEnemies: number;
  /** Accuracy percentage (0-100) */
  accuracy: number;
}

/**
 * Stats for the victory screen.
 */
export interface VictoryStats {
  /** Total time across all levels in seconds */
  totalTime: number;
  /** Total enemies destroyed across all levels */
  totalEnemiesDestroyed: number;
  /** Total accuracy percentage (0-100) */
  totalAccuracy: number;
}

/**
 * Callbacks for the UIManager.
 */
export interface UIManagerCallbacks {
  /** Invoked when a level is selected from the level select screen */
  onStartLevel: (level: number) => void;
  /** Invoked when the player restarts the current level */
  onRestartLevel: () => void;
  /** Invoked when the player quits to the main menu */
  onQuitToMenu: () => void;
}

/**
 * UIManager
 *
 * Manages all UI screens and state transitions for the MAZE STRIKE game.
 * Tracks level unlock progression, persisted to localStorage.
 */
export default class UIManager {
  /** localStorage key for saving unlocked level progress */
  private static readonly STORAGE_KEY = 'mazestrike_unlocked_level';
  /** The container element to append all overlays to */
  private container: HTMLElement;

  /** Callbacks for screen transitions */
  private callbacks: UIManagerCallbacks;

  /** The MainMenu component */
  private mainMenu: MainMenu;

  /** The LevelSelect component */
  private levelSelect: LevelSelect;

  /** The highest unlocked level (1-10), loaded from localStorage */
  private maxUnlockedLevel: number;

  /** The current level being played (1-10) */
  private currentLevel: number = 1;

  /** The how-to-play overlay element */
  private howToPlayOverlay: HTMLDivElement | null = null;

  /** The pause overlay element */
  private pauseOverlay: HTMLDivElement | null = null;

  /** The level complete overlay element */
  private levelCompleteOverlay: HTMLDivElement | null = null;

  /** The game over overlay element */
  private gameOverOverlay: HTMLDivElement | null = null;

  /** The victory overlay element */
  private victoryOverlay: HTMLDivElement | null = null;

  /** The loading overlay element */
  private loadingOverlay: HTMLDivElement | null = null;

  /** Whether dispose has been called */
  private disposed: boolean = false;

  /**
   * Creates a new UIManager.
   * @param container - The HTMLElement to append all overlays to
   * @param callbacks - Callbacks for screen transitions
   */
  constructor(container: HTMLElement, callbacks: UIManagerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Load saved unlock progress from localStorage
    this.maxUnlockedLevel = this.loadUnlockedLevel();

    // Create the MainMenu component (hidden by default)
    this.mainMenu = new MainMenu(container, {
      onStartMission: () => this.showLevelSelect(),
      onHowToPlay: () => this.showHowToPlay(),
      onQuit: () => {
        // Attempt to close the window (desktop only)
        if (typeof window !== 'undefined' && window.close) {
          window.close();
        }
      },
    });

    // Create the LevelSelect component (hidden by default)
    this.levelSelect = new LevelSelect(container, {
      onSelectLevel: (level) => {
        this.setCurrentLevel(level);
        // Show loading screen, then defer startLevel to the next frame
        // so the loading screen has time to render before the heavy work begins
        this.showLoading();
        setTimeout(() => {
          this.callbacks.onStartLevel(level);
        }, 50);
      },
      onBack: () => this.showMainMenu(),
    });

    // Build all internal overlays
    this.buildHowToPlayOverlay();
    this.buildPauseOverlay();
    this.buildLevelCompleteOverlay();
    this.buildGameOverOverlay();
    this.buildVictoryOverlay();
    this.buildLoadingOverlay();

    // Show the main menu by default
    this.showMainMenu();
  }

  /**
   * Builds the how-to-play overlay.
   */
  private buildHowToPlayOverlay(): void {
    const overlay = this.createBaseOverlay(300);

    // Title
    const title = this.createOverlayTitle('CONTROLS');
    overlay.appendChild(title);

    // Controls list
    const controlsList = document.createElement('div');
    controlsList.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 32px 48px;
      background: rgba(10, 14, 20, 0.9);
      border: 1px solid rgba(0, 255, 204, 0.3);
      border-radius: 8px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      box-shadow: 0 0 30px rgba(0, 255, 204, 0.1), inset 0 0 20px rgba(0, 255, 204, 0.05);
      min-width: 400px;
    `;
    overlay.appendChild(controlsList);

    // Control lines
    const controlLines = [
      'WASD / ARROWS — MOVE',
      'MOUSE — AIM',
      'LEFT CLICK — FIRE',
      '1-6 / WHEEL — SWITCH WEAPON',
      'ESC — PAUSE',
    ];

    for (const line of controlLines) {
      const controlLine = document.createElement('div');
      controlLine.textContent = line;
      controlLine.style.cssText = `
        font-size: 16px;
        letter-spacing: 2px;
        color: rgba(0, 255, 204, 0.8);
        text-shadow: 0 0 6px rgba(0, 255, 204, 0.4);
        text-align: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(0, 255, 204, 0.1);
      `;
      controlsList.appendChild(controlLine);
    }

    // Back button
    const backButton = this.createSciFiButton('BACK', () => this.hideHowToPlay());
    backButton.style.position = 'absolute';
    backButton.style.bottom = '60px';
    backButton.style.left = '50%';
    backButton.style.transform = 'translateX(-50%)';
    overlay.appendChild(backButton);

    // Append to container
    this.container.appendChild(overlay);
    this.howToPlayOverlay = overlay;
  }

  /**
   * Builds the pause overlay.
   */
  private buildPauseOverlay(): void {
    const overlay = this.createBaseOverlay(300);

    // Title
    const title = this.createOverlayTitle('PAUSED');
    overlay.appendChild(title);

    // Buttons container
    const buttonsContainer = this.createButtonsContainer();
    overlay.appendChild(buttonsContainer);

    // Resume button
    const resumeButton = this.createSciFiButton('RESUME', () => this.showGameplay());
    buttonsContainer.appendChild(resumeButton);

    // Restart level button
    const restartButton = this.createSciFiButton('RESTART LEVEL', () => {
      this.callbacks.onRestartLevel();
    });
    buttonsContainer.appendChild(restartButton);

    // Quit to menu button
    const quitButton = this.createSciFiButton('QUIT TO MENU', () => {
      this.callbacks.onQuitToMenu();
    });
    buttonsContainer.appendChild(quitButton);

    // Append to container
    this.container.appendChild(overlay);
    this.pauseOverlay = overlay;
  }

  /**
   * Builds the level complete overlay.
   */
  private buildLevelCompleteOverlay(): void {
    const overlay = this.createBaseOverlay(300);

    // Title
    const title = this.createOverlayTitle('LEVEL CLEAR');
    overlay.appendChild(title);

    // Stats container
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px 48px;
      background: rgba(10, 14, 20, 0.9);
      border: 1px solid rgba(0, 255, 204, 0.3);
      border-radius: 8px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      box-shadow: 0 0 30px rgba(0, 255, 204, 0.1), inset 0 0 20px rgba(0, 255, 204, 0.05);
      min-width: 360px;
    `;
    overlay.appendChild(statsContainer);

    // Stats lines (will be populated on show)
    const timeStat = document.createElement('div');
    timeStat.className = 'level-complete-time';
    timeStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(timeStat);

    const enemiesStat = document.createElement('div');
    enemiesStat.className = 'level-complete-enemies';
    enemiesStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(enemiesStat);

    const accuracyStat = document.createElement('div');
    accuracyStat.className = 'level-complete-accuracy';
    accuracyStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(accuracyStat);

    // Buttons container
    const buttonsContainer = this.createButtonsContainer();
    buttonsContainer.style.top = '65%';
    overlay.appendChild(buttonsContainer);

    // Next level button
    const nextLevelButton = this.createSciFiButton('NEXT LEVEL', () => {
      const nextLevel = this.currentLevel + 1;
      if (nextLevel <= 10) {
        this.setCurrentLevel(nextLevel);
        this.showLoading();
        setTimeout(() => {
          this.callbacks.onStartLevel(nextLevel);
        }, 50);
      } else {
        // Should not happen - victory screen handles level 10
        this.showVictory({
          totalTime: 0,
          totalEnemiesDestroyed: 0,
          totalAccuracy: 0,
        });
      }
    });
    buttonsContainer.appendChild(nextLevelButton);

    // Level select button
    const levelSelectButton = this.createSciFiButton('LEVEL SELECT', () => {
      this.showLevelSelect();
    });
    buttonsContainer.appendChild(levelSelectButton);

    // Append to container
    this.container.appendChild(overlay);
    this.levelCompleteOverlay = overlay;
  }

  /**
   * Builds the game over overlay.
   */
  private buildGameOverOverlay(): void {
    const overlay = this.createBaseOverlay(300);

    // Title (red tint for game over)
    const title = this.createOverlayTitle('DRONE DESTROYED');
    title.style.color = '#ff4444';
    title.style.textShadow = '0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 68, 68, 0.4)';
    overlay.appendChild(title);

    // Buttons container
    const buttonsContainer = this.createButtonsContainer();
    overlay.appendChild(buttonsContainer);

    // Retry level button
    const retryButton = this.createSciFiButton('RETRY LEVEL', () => {
      this.showLoading();
      setTimeout(() => {
        this.callbacks.onRestartLevel();
      }, 50);
    });
    buttonsContainer.appendChild(retryButton);

    // Main menu button
    const mainMenuButton = this.createSciFiButton('MAIN MENU', () => {
      this.callbacks.onQuitToMenu();
    });
    buttonsContainer.appendChild(mainMenuButton);

    // Append to container
    this.container.appendChild(overlay);
    this.gameOverOverlay = overlay;
  }

  /**
   * Builds the victory overlay.
   */
  private buildVictoryOverlay(): void {
    const overlay = this.createBaseOverlay(300);

    // Title
    const title = this.createOverlayTitle('ALL HOSTILES ELIMINATED');
    overlay.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = 'MISSION COMPLETE. ALL 10 LEVELS CLEARED.';
    subtitle.style.cssText = `
      position: absolute;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      font-size: 18px;
      letter-spacing: 4px;
      color: rgba(0, 255, 204, 0.7);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.4);
      text-align: center;
      white-space: nowrap;
    `;
    overlay.appendChild(subtitle);

    // Stats container
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px 48px;
      background: rgba(10, 14, 20, 0.9);
      border: 1px solid rgba(0, 255, 204, 0.3);
      border-radius: 8px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      box-shadow: 0 0 30px rgba(0, 255, 204, 0.1), inset 0 0 20px rgba(0, 255, 204, 0.05);
      min-width: 360px;
    `;
    overlay.appendChild(statsContainer);

    // Stats lines (will be populated on show)
    const timeStat = document.createElement('div');
    timeStat.className = 'victory-total-time';
    timeStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(timeStat);

    const enemiesStat = document.createElement('div');
    enemiesStat.className = 'victory-total-enemies';
    enemiesStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(enemiesStat);

    const accuracyStat = document.createElement('div');
    accuracyStat.className = 'victory-total-accuracy';
    accuracyStat.style.cssText = this.getStatStyle();
    statsContainer.appendChild(accuracyStat);

    // Back to main menu button
    const backButton = this.createSciFiButton('BACK TO MAIN MENU', () => {
      this.callbacks.onQuitToMenu();
    });
    backButton.style.position = 'absolute';
    backButton.style.bottom = '80px';
    backButton.style.left = '50%';
    backButton.style.transform = 'translateX(-50%)';
    overlay.appendChild(backButton);

    // Append to container
    this.container.appendChild(overlay);
    this.victoryOverlay = overlay;
  }

  /**
   * Builds the loading overlay with animated spinner.
   */
  private buildLoadingOverlay(): void {
    const overlay = this.createBaseOverlay(350);

    // Title
    const title = this.createOverlayTitle('INITIALIZING');
    overlay.appendChild(title);

    // Spinner container
    const spinnerContainer = document.createElement('div');
    spinnerContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    `;

    // Spinner ring
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 60px;
      height: 60px;
      border: 3px solid rgba(0, 255, 204, 0.15);
      border-top: 3px solid #00ffcc;
      border-radius: 50%;
      animation: loading-spin 1s linear infinite;
      box-shadow: 0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 15px rgba(0, 255, 204, 0.1);
    `;
    spinnerContainer.appendChild(spinner);

    // Loading text
    const loadingText = document.createElement('div');
    loadingText.textContent = 'LOADING ASSETS';
    loadingText.style.cssText = `
      font-size: 14px;
      letter-spacing: 4px;
      color: rgba(0, 255, 204, 0.6);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.3);
    `;
    spinnerContainer.appendChild(loadingText);

    overlay.appendChild(spinnerContainer);

    // Add CSS keyframes for the spinner animation
    if (!document.getElementById('loading-keyframes')) {
      const style = document.createElement('style');
      style.id = 'loading-keyframes';
      style.textContent = `
        @keyframes loading-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    // Append to container
    this.container.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  /**
   * Creates a base overlay div with the sci-fi/military aesthetic.
   * @param zIndex - The z-index for the overlay
   * @returns The configured overlay div
   */
  private createBaseOverlay(zIndex: number): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: ${zIndex};
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
   * Creates a styled overlay title element.
   * @param text - The title text
   * @returns The configured title div
   */
  private createOverlayTitle(text: string): HTMLDivElement {
    const title = document.createElement('div');
    title.textContent = text;
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
      animation: ui-title-glow 2s ease-in-out infinite alternate;
    `;
    return title;
  }

  /**
   * Creates a buttons container div.
   * @returns The configured buttons container div
   */
  private createButtonsContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 280px;
    `;
    return container;
  }

  /**
   * Creates a styled sci-fi button.
   * @param text - The button text
   * @param onClick - The click handler
   * @returns The configured button element
   */
  private createSciFiButton(text: string, onClick: () => void): HTMLButtonElement {
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
      white-space: nowrap;
    `;

    // Hover effects
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

    // Click handler
    button.addEventListener('click', onClick);

    return button;
  }

  /**
   * Gets the CSS style for a stat line.
   * @returns The CSS style string
   */
  private getStatStyle(): string {
    return `
      font-size: 16px;
      letter-spacing: 2px;
      color: rgba(0, 255, 204, 0.8);
      text-shadow: 0 0 6px rgba(0, 255, 204, 0.4);
      text-align: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 255, 204, 0.1);
    `;
  }

  /**
   * Formats a time value in seconds as MM:SS.
   * @param seconds - The time in seconds
   * @returns The formatted time string
   */
  private formatTime(seconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Formats an accuracy value as an integer percentage.
   * @param accuracy - The accuracy value (0-100)
   * @returns The formatted accuracy string
   */
  private formatAccuracy(accuracy: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(accuracy)));
    return `${clamped}%`;
  }

  /**
   * Hides all overlays managed by the UIManager.
   */
  private hideAllOverlays(): void {
    // Hide MainMenu and LevelSelect components
    this.mainMenu.hide();
    this.levelSelect.hide();

    // Hide internal overlays
    if (this.howToPlayOverlay) {
      this.howToPlayOverlay.style.display = 'none';
    }
    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = 'none';
    }
    if (this.levelCompleteOverlay) {
      this.levelCompleteOverlay.style.display = 'none';
    }
    if (this.gameOverOverlay) {
      this.gameOverOverlay.style.display = 'none';
    }
    if (this.victoryOverlay) {
      this.victoryOverlay.style.display = 'none';
    }
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'none';
    }
  }

  /**
   * Shows the main menu screen.
   */
  public showMainMenu(): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Show the main menu
    this.mainMenu.show();
  }

  /**
   * Shows the level select screen.
   */
  public showLevelSelect(): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Update the unlocked levels on the level select component
    this.levelSelect.setUnlockedLevels(this.maxUnlockedLevel);

    // Show the level select
    this.levelSelect.show();
  }

  /**
   * Shows the gameplay screen (hides all overlays).
   */
  public showGameplay(): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();
  }

  /**
   * Shows the pause overlay.
   */
  public showPause(): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Show the pause overlay
    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = 'block';
    }
  }

  /**
   * Shows the level complete screen with stats.
   * @param stats - The level completion stats
   */
  public showLevelComplete(stats: LevelCompleteStats): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Show the level complete overlay
    if (this.levelCompleteOverlay) {
      // Populate stats
      const timeStat = this.levelCompleteOverlay.querySelector('.level-complete-time');
      if (timeStat) {
        timeStat.textContent = `TIME: ${this.formatTime(stats.time)}`;
      }

      const enemiesStat = this.levelCompleteOverlay.querySelector('.level-complete-enemies');
      if (enemiesStat) {
        enemiesStat.textContent = `ENEMIES DESTROYED: ${stats.enemiesDestroyed}/${stats.totalEnemies}`;
      }

      const accuracyStat = this.levelCompleteOverlay.querySelector('.level-complete-accuracy');
      if (accuracyStat) {
        accuracyStat.textContent = `ACCURACY: ${this.formatAccuracy(stats.accuracy)}`;
      }

      // Show the overlay
      this.levelCompleteOverlay.style.display = 'block';
    }
  }

  /**
   * Shows the game over screen.
   */
  public showGameOver(): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Show the game over overlay
    if (this.gameOverOverlay) {
      this.gameOverOverlay.style.display = 'block';
    }
  }

  /**
   * Shows the victory screen with stats.
   * @param stats - The total stats across all levels
   */
  public showVictory(stats: VictoryStats): void {
    if (this.disposed) return;

    // Hide all overlays
    this.hideAllOverlays();

    // Show the victory overlay
    if (this.victoryOverlay) {
      // Populate stats
      const timeStat = this.victoryOverlay.querySelector('.victory-total-time');
      if (timeStat) {
        timeStat.textContent = `TOTAL TIME: ${this.formatTime(stats.totalTime)}`;
      }

      const enemiesStat = this.victoryOverlay.querySelector('.victory-total-enemies');
      if (enemiesStat) {
        enemiesStat.textContent = `TOTAL ENEMIES DESTROYED: ${stats.totalEnemiesDestroyed}`;
      }

      const accuracyStat = this.victoryOverlay.querySelector('.victory-total-accuracy');
      if (accuracyStat) {
        accuracyStat.textContent = `TOTAL ACCURACY: ${this.formatAccuracy(stats.totalAccuracy)}`;
      }

      // Show the overlay
      this.victoryOverlay.style.display = 'block';
    }
  }

  /**
   * Shows the how-to-play overlay.
   */
  public showHowToPlay(): void {
    if (this.disposed) return;

    // Show the how-to-play overlay on top of the current screen
    if (this.howToPlayOverlay) {
      this.howToPlayOverlay.style.display = 'block';
    }
  }

  /**
   * Hides the how-to-play overlay.
   */
  public hideHowToPlay(): void {
    if (this.disposed) return;

    // Hide the how-to-play overlay
    if (this.howToPlayOverlay) {
      this.howToPlayOverlay.style.display = 'none';
    }
  }

  /**
   * Shows the loading overlay with animated spinner.
   */
  public showLoading(): void {
    if (this.disposed) return;

    // Hide all overlays first
    this.hideAllOverlays();

    // Show the loading overlay
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'block';
    }
  }

  /**
   * Hides the loading overlay.
   */
  public hideLoading(): void {
    if (this.disposed) return;

    // Hide the loading overlay
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'none';
    }
  }

  /**
   * Gets the highest unlocked level.
   * @returns The highest unlocked level (1-10)
   */
  public getMaxUnlockedLevel(): number {
    return this.maxUnlockedLevel;
  }

  /**
   * Unlocks the next level after completing the current one.
   * Level 1 is always unlocked; completing a level unlocks the next.
   */
  public unlockNextLevel(): void {
    if (this.disposed) return;

    // Unlock the next level (clamp to 10)
    this.maxUnlockedLevel = Math.min(10, this.maxUnlockedLevel + 1);

    // Persist to localStorage
    this.saveUnlockedLevel();
  }

  /**
   * Sets the current level.
   * @param level - The level number (1-10)
   */
  public setCurrentLevel(level: number): void {
    if (this.disposed) return;

    // Clamp to valid range
    this.currentLevel = Math.max(1, Math.min(10, Math.floor(level)));
  }

  /**
   * Gets the current level.
   * @returns The current level number (1-10)
   */
  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Loads the saved unlocked level from localStorage.
   * @returns The saved max unlocked level, or 1 if not found/invalid
   */
  private loadUnlockedLevel(): number {
    try {
      const saved = localStorage.getItem(UIManager.STORAGE_KEY);
      if (saved !== null) {
        const level = parseInt(saved, 10);
        if (level >= 1 && level <= 10) {
          return level;
        }
      }
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
    return 1;
  }

  /**
   * Saves the current unlocked level to localStorage.
   */
  private saveUnlockedLevel(): void {
    try {
      localStorage.setItem(UIManager.STORAGE_KEY, String(this.maxUnlockedLevel));
    } catch {
      // localStorage may be unavailable — silently ignore
    }
  }

  /**
   * Disposes all resources and cleans up.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose the MainMenu component
    this.mainMenu.dispose();

    // Dispose the LevelSelect component
    this.levelSelect.dispose();

    // Remove internal overlays from the DOM
    const overlays = [
      this.howToPlayOverlay,
      this.pauseOverlay,
      this.levelCompleteOverlay,
      this.gameOverOverlay,
      this.victoryOverlay,
      this.loadingOverlay,
    ];

    for (const overlay of overlays) {
      if (overlay && overlay.parentElement === this.container) {
        this.container.removeChild(overlay);
      }
    }

    // Clear references
    this.howToPlayOverlay = null;
    this.pauseOverlay = null;
    this.levelCompleteOverlay = null;
    this.gameOverOverlay = null;
    this.victoryOverlay = null;
    this.loadingOverlay = null;
  }
}