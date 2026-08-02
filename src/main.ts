/**
 * MAZE STRIKE — Entry Point (Phase 6)
 *
 * Bootstraps the game by creating the HUD and UIManager instances,
 * passing them to the Game constructor, and starting the render loop.
 * This is a side-effect module executed once on page load.
 */
import Game from './components/Game';
import HUD from './components/HUD';
import UIManager from './components/UIManager';
import './style.css';

// Query the DOM for the required container element
const appContainer = document.getElementById('app') as HTMLDivElement;

// Validate that the container exists before proceeding
if (!appContainer) {
  throw new Error(
    'MAZE STRIKE: Critical initialization failed — #app container element not found in the DOM.'
  );
}

// Create the HUD manager (full-screen overlay with all HUD elements)
const hud = new HUD(appContainer);

// Declare the game variable before creating the UIManager so its
// callbacks can reference the game instance (safe because UIManager's
// constructor only stores callbacks, it does not invoke them).
let game: Game;

// Create the UI screen state manager with callbacks that reference the game
const uiManager = new UIManager(appContainer, {
  onStartLevel: (level: number) => {
    game.startLevel(level);
  },
  onRestartLevel: () => {
    game.restartLevel();
  },
  onQuitToMenu: () => {
    game.quitToMenu();
  },
});

// Create the game instance with the container, HUD, and UIManager
game = new Game(appContainer, hud, uiManager);

// Start the render loop
game.start();