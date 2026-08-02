/**
 * AudioManager
 *
 * Procedural audio system for the MAZE STRIKE game.
 * Generates all sound effects and background music using the Web Audio API
 * with no external audio files required.
 *
 * Sounds are synthesized from oscillators, noise buffers, and filters.
 */
export default class AudioManager {
  /** The Web Audio API context */
  private ctx: AudioContext | null = null;

  /** Master gain node for global volume control */
  private masterGain: GainNode | null = null;

  /** Whether audio is enabled */
  private enabled: boolean = true;

  /** BGM state */
  private bgmPlaying: boolean = false;
  private bgmNodes: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }[] = [];
  private bgmInterval: number | null = null;
  private bgmGain: GainNode | null = null;

  /** Cached noise buffer for reuse */
  private noiseBuffer: AudioBuffer | null = null;

  /**
   * Initializes the audio context. Must be called after a user gesture.
   */
  public init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(2);
    } catch {
      console.warn('[AudioManager] Web Audio API not available');
      this.enabled = false;
    }
  }

  /**
   * Resumes the audio context (required after user gesture on Chrome).
   */
  public resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Sets the master volume (0-1). */
  public setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /** Enables or disables all audio. */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBGM();
    }
  }

  // -----------------------------------------------------------------------
  // Sound Effects
  // -----------------------------------------------------------------------

  /** Gunshot sound — short noise burst with high-pass filter. */
  public playShoot(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Noise burst
    const source = this.createNoiseSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1.5;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.08);

    // Low thud layer
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Hit/damage sound — short low thud with distortion. */
  public playHit(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Noise click
    const source = this.createNoiseSource();
    const nGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    nGain.gain.setValueAtTime(0.15, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    source.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.05);
  }

  /** Explosion sound — noise with low-pass sweep + low sine boom. */
  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Noise layer
    const source = this.createNoiseSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.6);

    // Low boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Pickup sound — quick ascending tone. */
  public playPickup(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** All enemies eliminated — rising two-note chime. */
  public playAllEnemiesEliminated(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // First note
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 523; // C5
    g1.gain.setValueAtTime(0.2, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note (higher)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 784; // G5
    g2.gain.setValueAtTime(0, now + 0.15);
    g2.gain.linearRampToValueAtTime(0.2, now + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  }

  /** Level complete — ascending three-note fanfare. */
  public playLevelComplete(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /** Game over — descending minor chord. */
  public playGameOver(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const notes = [392, 330, 262, 196]; // G4, E4, C4, G3
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.2;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  // -----------------------------------------------------------------------
  // Background Music
  // -----------------------------------------------------------------------

  /** Starts the procedural BGM loop. */
  public startBGM(): void {
    if (!this.ctx || !this.masterGain || !this.enabled || this.bgmPlaying) return;
    this.bgmPlaying = true;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.08;
    this.bgmGain.connect(this.masterGain);

    // Ambient pad drone (two detuned oscillators)
    this.startBGMPad();
    // Rhythmic pulse
    this.startBGMRhythm();
  }

  /** Stops the BGM. */
  public stopBGM(): void {
    this.bgmPlaying = false;
    for (const node of this.bgmNodes) {
      try { node.osc.stop(); } catch { /* already stopped */ }
      node.osc.disconnect();
      node.gain.disconnect();
      node.filter.disconnect();
    }
    this.bgmNodes = [];
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
  }

  private startBGMPad(): void {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;

    const notes = [130.81, 196.00, 261.63]; // C3, G3, C4

    for (const freq of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 10;

      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 0.5;

      gain.gain.value = 0.3;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain!);
      osc.start();

      this.bgmNodes.push({ osc, gain, filter });
    }
  }

  private startBGMRhythm(): void {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;

    // Subtle rhythmic pulse every ~1.5 seconds
    this.bgmInterval = window.setInterval(() => {
      if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 80;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.bgmGain!);
      osc.start(now);
      osc.stop(now + 0.35);
    }, 1500);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Creates a white noise AudioBufferSourceNode. */
  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = false;
    return source;
  }

  /** Creates a filled white noise AudioBuffer. */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Cleans up all audio resources. */
  public dispose(): void {
    this.stopBGM();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.noiseBuffer = null;
  }
}
