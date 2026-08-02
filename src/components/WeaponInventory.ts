import * as THREE from 'three';
import Weapon from './Weapon';
import { WEAPON_CONFIGS, WEAPON_IDS, WeaponConfig, WeaponType } from './WeaponConfigs';

/**
 * WeaponInventory
 *
 * Manages the player's owned weapons, current weapon selection, ammo
 * tracking, and auto-reload for the MAZE STRIKE game.
 *
 * The inventory starts with the M9 Sidearm (slot 1) already owned.
 * Weapons are added via addWeapon() and switched via switchToSlot()
 * or switchByWheel(). The inventory handles auto-reload when the
 * current weapon's magazine is empty.
 */
export default class WeaponInventory {
  /** The THREE.Scene reference used to create Weapon instances */
  private scene: THREE.Scene;

  /** List of owned Weapon instances (index 0 = slot 1) */
  private weapons: Weapon[] = [];

  /** Index of the currently selected weapon */
  private currentIndex: number = 0;

  /** Time remaining for the current reload (seconds) */
  private reloadTimer: number = 0;

  /** Whether a reload is currently in progress */
  private isReloadingFlag: boolean = false;

  /** Callback invoked when the current weapon changes */
  private onWeaponSwitched: (() => void) | null = null;

  /**
   * Creates a new WeaponInventory.
   * @param scene - The THREE.Scene used to create Weapon instances
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Start with the M9 Sidearm already owned (slot 1)
    const m9Config = WEAPON_CONFIGS.find((c) => c.id === WEAPON_IDS.M9_SIDEARM);
    if (m9Config) {
      this.weapons.push(new Weapon(scene, m9Config));
    }
  }

  /**
   * Sets the callback invoked when the current weapon changes.
   * @param callback - The callback function, or null to clear
   */
  public setOnWeaponSwitched(callback: (() => void) | null): void {
    this.onWeaponSwitched = callback;
  }

  /**
   * Adds a weapon to the inventory.
   * @param config - The weapon configuration to add
   * @returns True if the weapon was added, false if already owned
   */
  public addWeapon(config: WeaponConfig): boolean {
    // Check if this weapon is already owned
    if (this.hasWeapon(config.id)) {
      return false;
    }

    // Create the weapon instance and add to inventory
    this.weapons.push(new Weapon(this.scene, config));
    return true;
  }

  /**
   * Switches to the weapon at the given slot index.
   * @param index - Slot index (0-5, where 0 = slot 1)
   * @returns True if the switch occurred, false otherwise
   */
  public switchToSlot(index: number): boolean {
    // Validate index range
    if (index < 0 || index >= 6) {
      return false;
    }

    // Check if the target slot has an owned weapon
    if (index >= this.weapons.length) {
      return false;
    }

    // Check if already on this weapon
    if (index === this.currentIndex) {
      return false;
    }

    // Switch to the new weapon
    this.currentIndex = index;

    // Cancel any in-progress reload
    this.cancelReload();

    // Notify the callback
    if (this.onWeaponSwitched) {
      this.onWeaponSwitched();
    }

    return true;
  }

  /**
   * Switches weapons based on mouse wheel direction.
   * @param delta - Mouse wheel delta (positive = next, negative = previous)
   * @returns True if the switch occurred, false otherwise
   */
  public switchByWheel(delta: number): boolean {
    // Ignore zero delta
    if (delta === 0) {
      return false;
    }

    // Determine direction: positive delta = next weapon, negative = previous
    const direction = delta > 0 ? 1 : -1;

    // Calculate the next index with wraparound
    const ownedCount = this.weapons.length;
    if (ownedCount <= 1) {
      return false; // Only one weapon, nothing to switch to
    }

    // Compute next index (wrap around)
    let nextIndex = (this.currentIndex + direction) % ownedCount;
    if (nextIndex < 0) {
      nextIndex += ownedCount;
    }

    // Switch to the next weapon
    return this.switchToSlot(nextIndex);
  }

  /**
   * Gets the currently selected weapon instance.
   * @returns The current Weapon, or null if no weapons owned
   */
  public getCurrentWeapon(): Weapon | null {
    if (this.weapons.length === 0) {
      return null;
    }
    return this.weapons[this.currentIndex];
  }

  /**
   * Gets the configuration of the currently selected weapon.
   * @returns The current WeaponConfig, or null if no weapons owned
   */
  public getCurrentConfig(): WeaponConfig | null {
    const weapon = this.getCurrentWeapon();
    return weapon ? weapon.getConfig() : null;
  }

  /**
   * Attempts to fire the current weapon.
   * @param deltaTime - Time since last frame in seconds
   * @returns True if the weapon fired, false otherwise
   */
  public tryFire(deltaTime: number): boolean {
    // Can't fire while reloading
    if (this.isReloadingFlag) {
      return false;
    }

    const weapon = this.getCurrentWeapon();
    if (!weapon) {
      return false;
    }

        return weapon.tryFire(deltaTime);
  }

  /**
   * Starts a manual reload for the current weapon.
   * @returns True if the reload started, false if it cannot (already reloading, no weapon, magazine full, or no reserve ammo)
   */
  public startReload(): boolean {
    // Can't start a reload if one is already in progress
    if (this.isReloadingFlag) {
      return false;
    }

    const weapon = this.getCurrentWeapon();
    if (!weapon) {
      return false;
    }

    const config = weapon.getConfig();

    // Don't reload if the magazine is already full
    if (weapon.getMagazineAmmo() >= config.magazineSize) {
      return false;
    }

    // Don't reload if there's no reserve ammo
    if (weapon.getReserveAmmo() <= 0) {
      return false;
    }

    // Start the reload
    this.isReloadingFlag = true;
    this.reloadTimer = config.reloadTime;
    return true;
  }

  /**
   * Updates the inventory, handling auto-reload logic.
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    const weapon = this.getCurrentWeapon();
    if (!weapon) {
      return;
    }

    const config = weapon.getConfig();

    // Check if auto-reload should start
    if (!this.isReloadingFlag) {
      const magazineEmpty = weapon.getMagazineAmmo() <= 0;
      const hasReserve = weapon.getReserveAmmo() > 0;
      const magazineNotFull = weapon.getMagazineAmmo() < config.magazineSize;

      if (magazineEmpty && hasReserve && magazineNotFull) {
        // Start reload
        this.isReloadingFlag = true;
        this.reloadTimer = config.reloadTime;
      }
    }

    // Update reload timer
    if (this.isReloadingFlag) {
      this.reloadTimer -= deltaTime;

      // Complete reload when timer expires
      if (this.reloadTimer <= 0) {
        weapon.reload();
        this.isReloadingFlag = false;
        this.reloadTimer = 0;
      }
    }
  }

  /**
   * Gets the formatted ammo display string for the current weapon.
   * @returns The ammo display string (e.g., "M9 SIDEARM — 12 / 48")
   */
  public getAmmoDisplay(): string {
    const weapon = this.getCurrentWeapon();
    return weapon ? weapon.getAmmoDisplay() : 'NO WEAPON';
  }

  /**
   * Checks if the inventory is currently reloading.
   * @returns True if reloading, false otherwise
   */
  public isReloading(): boolean {
    return this.isReloadingFlag;
  }

  /**
   * Gets the reload progress as a value from 0 to 1.
   * @returns Reload progress (0 = just started, 1 = complete)
   */
  public getReloadProgress(): number {
    if (!this.isReloadingFlag) {
      return 0;
    }

    const weapon = this.getCurrentWeapon();
    if (!weapon) {
      return 0;
    }

    const config = weapon.getConfig();
    if (config.reloadTime <= 0) {
      return 1;
    }

    // Progress from 0 to 1 as the timer counts down
    return Math.max(0, Math.min(1, 1 - this.reloadTimer / config.reloadTime));
  }

  /**
   * Gets the IDs of all owned weapons.
   * @returns Array of owned weapon type IDs
   */
  public getOwnedWeaponIds(): WeaponType[] {
    return this.weapons.map((w) => w.getConfig().id);
  }

  /**
   * Checks if a weapon of the given type is owned.
   * @param type - The weapon type to check
   * @returns True if owned, false otherwise
   */
  public hasWeapon(type: WeaponType): boolean {
    return this.weapons.some((w) => w.getConfig().id === type);
  }

  /**
   * Adds reserve ammo to all owned weapons as a percentage of their max.
   * Each weapon gets at least 1 ammo if the percentage rounds to 0.
   * @param percentage - The percentage of max reserve ammo to add (0-1)
   */
  public addAmmoToAll(percentage: number): void {
    for (const weapon of this.weapons) {
      const config = weapon.getConfig();
      const amount = Math.max(1, Math.floor(config.reserveAmmo * percentage));
      weapon.addReserveAmmo(amount);
    }
  }

  /**
   * Cancels any in-progress reload.
   */
  private cancelReload(): void {
    this.isReloadingFlag = false;
    this.reloadTimer = 0;
  }
}