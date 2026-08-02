/**
 * LevelIntro
 *
 * Full-screen intro overlay for the MAZE STRIKE game.
 * Displays a 3-second countdown ("3... 2... 1... ENGAGE") with the level
 * number and random seed, styled with the sci-fi/military aesthetic.
 *
 * The overlay auto-dismisses after the countdown completes and invokes
 * the provided onComplete callback.
 */
export default class LevelIntro {
  /** The container element to append the overlay to */
  private container: HTMLElement;

  /** The random seed for this level (displayed on the overlay) */
  private seed: number;

  /** The level number (displayed on the overlay) */
  private level: number;

  /** Callback invoked when the intro completes */
  private onComplete: () => void;

  /** The root overlay div element */
  private overlay: HTMLDivElement | null = null;

  /** The countdown text element */
  private countdownText: HTMLDivElement | null = null;

  /** Array of active timers for cleanup */
  private timers: number[] = [];

  /** Flag to prevent double-start */
  private started: boolean = false;

  /** Flag to prevent double-dispose */
  private disposed: boolean = false;

  /**
   * Creates a new LevelIntro overlay.
   * @param container - The HTMLElement to append the overlay to
   * @param seed - The random seed for this level
   * @param level - The level number
   * @param onComplete - Callback invoked when the intro completes
   */
  constructor(
    container: HTMLElement,
    seed: number,
    level: number,
    onComplete: () => void
  ) {
    this.container = container;
    this.seed = seed;
    this.level = level;
    this.onComplete = onComplete;

    // Build the overlay DOM structure
    this.buildOverlay();
  }

  /**
   * Builds the complete overlay DOM structure and appends it to the container.
   */
  private buildOverlay(): void {
    // --- Root overlay div ---
    const overlay = document.createElement('div');
    overlay.className = 'level-intro-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1000;
      pointer-events: none;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(5, 8, 12, 0.92);
      opacity: 0;
      transition: opacity 0.4s ease-in-out;
      font-family: 'Courier New', monospace;
    `;

    // --- Scanline effect (subtle horizontal lines) ---
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(0, 255, 204, 0.04) 0px,
        rgba(0, 255, 204, 0.04) 1px,
        transparent 1px,
        transparent 3px
      );
    `;
    overlay.appendChild(scanlines);

    // --- Center content wrapper ---
    const content = document.createElement('div');
    content.style.cssText = `
      position: relative;
      text-align: center;
      z-index: 1;
    `;
    overlay.appendChild(content);

    // --- Level label (above countdown) ---
    const levelLabel = document.createElement('div');
    levelLabel.textContent = `LEVEL ${this.level}`;
    levelLabel.style.cssText = `
      font-size: 18px;
      letter-spacing: 6px;
      color: rgba(0, 255, 204, 0.8);
      text-shadow: 0 0 8px rgba(0, 255, 204, 0.5);
      margin-bottom: 24px;
      text-transform: uppercase;
    `;
    content.appendChild(levelLabel);

    // --- Countdown text (large, glowing) ---
    const countdown = document.createElement('div');
    countdown.textContent = '3';
    countdown.style.cssText = `
      font-size: 96px;
      font-weight: bold;
      color: #00ffcc;
      text-shadow: 0 0 20px rgba(0, 255, 204, 0.8), 0 0 40px rgba(0, 255, 204, 0.4);
      line-height: 1.2;
      transition: opacity 0.25s ease-in-out;
      opacity: 1;
    `;
    content.appendChild(countdown);
    this.countdownText = countdown;

    // --- Seed text (below countdown) ---
    const seedText = document.createElement('div');
    seedText.textContent = `SEED: ${this.seed}`;
    seedText.style.cssText = `
      font-size: 14px;
      letter-spacing: 3px;
      color: rgba(0, 255, 204, 0.5);
      text-shadow: 0 0 4px rgba(0, 255, 204, 0.3);
      margin-top: 24px;
    `;
    content.appendChild(seedText);

    // --- Decorative corner brackets (frame) ---
    const bracketStyle = `
      position: absolute;
      width: 40px;
      height: 40px;
      border: 2px solid rgba(0, 255, 204, 0.4);
      pointer-events: none;
    `;

    // Top-left bracket
    const topLeft = document.createElement('div');
    topLeft.style.cssText = `${bracketStyle} top: 24px; left: 24px; border-right: none; border-bottom: none;`;
    overlay.appendChild(topLeft);

    // Top-right bracket
    const topRight = document.createElement('div');
    topRight.style.cssText = `${bracketStyle} top: 24px; right: 24px; border-left: none; border-bottom: none;`;
    overlay.appendChild(topRight);

    // Bottom-left bracket
    const bottomLeft = document.createElement('div');
    bottomLeft.style.cssText = `${bracketStyle} bottom: 24px; left: 24px; border-right: none; border-top: none;`;
    overlay.appendChild(bottomLeft);

    // Bottom-right bracket
    const bottomRight = document.createElement('div');
    bottomRight.style.cssText = `${bracketStyle} bottom: 24px; right: 24px; border-left: none; border-top: none;`;
    overlay.appendChild(bottomRight);

    // Append overlay to container
    this.container.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Begins the countdown animation sequence.
   * If already started, this method does nothing.
   */
  public start(): void {
    if (this.started || this.disposed) return;
    this.started = true;

    // Fade the overlay in
    if (this.overlay) {
      this.overlay.style.opacity = '1';
    }

    // Countdown sequence timing (in milliseconds)
    const sequence = [
      { text: '3', delay: 0 },
      { text: '2', delay: 1000 },
      { text: '1', delay: 2000 },
      { text: 'ENGAGE', delay: 3000 },
    ];

    // Schedule each countdown step
    for (const step of sequence) {
      const timer = window.setTimeout(() => {
        this.showCountdownText(step.text);
      }, step.delay);
      this.timers.push(timer);
    }

    // Fade out the overlay after ENGAGE (at 3800ms)
    const fadeOutTimer = window.setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '0';
      }
    }, 3800);
    this.timers.push(fadeOutTimer);

    // Invoke onComplete after the overlay has faded out (at 4200ms)
    const completeTimer = window.setTimeout(() => {
      if (!this.disposed) {
        this.onComplete();
      }
    }, 4200);
    this.timers.push(completeTimer);
  }

  /**
   * Updates the countdown text with a fade-out/fade-in transition.
   * @param text - The new countdown text to display
   */
  private showCountdownText(text: string): void {
    if (!this.countdownText || this.disposed) return;

    // Fade out, change text, fade back in
    this.countdownText.style.opacity = '0';

    const fadeTimer = window.setTimeout(() => {
      if (!this.countdownText || this.disposed) return;
      this.countdownText.textContent = text;
      this.countdownText.style.opacity = '1';
    }, 250); // Match the CSS transition duration
    this.timers.push(fadeTimer);
  }

  /**
   * Removes the overlay from the DOM and cleans up all resources.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Clear all pending timers
    for (const timer of this.timers) {
      window.clearTimeout(timer);
    }
    this.timers = [];

    // Remove the overlay from the DOM
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }

    // Nullify references
    this.overlay = null;
    this.countdownText = null;
  }
}