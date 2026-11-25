// Lightweight Web Audio API synthesizer with warm, pleasant marimba/bell tones (zero external audio files).

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setEnabled(value: boolean) {
    this.enabled = value;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playBell(freq: number, duration: number, volume: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();
    const hGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(freq * 2, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    hGain.gain.setValueAtTime(0.0001, start);
    hGain.gain.linearRampToValueAtTime(volume * 0.2, start + 0.008);
    hGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.55);

    osc.connect(gain);
    harmonic.connect(hGain);
    gain.connect(ctx.destination);
    hGain.connect(ctx.destination);

    osc.start(start);
    harmonic.start(start);
    osc.stop(start + duration + 0.02);
    harmonic.stop(start + duration + 0.02);
  }

  playWarmupHit(step = 0) {
    const scale = [392.0, 440.0, 493.88, 587.33, 659.25];
    const freq = scale[step % scale.length];
    this.playBell(freq, 0.22, 0.075);
  }

  playPickup(index = 1) {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = pentatonic[(index - 1) % pentatonic.length];
    this.playBell(freq, 0.2, 0.08);
    this.playBell(freq * 1.5, 0.14, 0.03, 0.04);
  }

  playCoin(index = 1) {
    const base = 783.99 + ((index - 1) % 5) * 40;
    this.playBell(base, 0.14, 0.07);
    this.playBell(base * 1.5, 0.18, 0.055, 0.055);
  }

  playKeyPickup() {
    this.playBell(659.25, 0.18, 0.08, 0);
    this.playBell(987.77, 0.25, 0.08, 0.07);
    this.playBell(1318.5, 0.3, 0.06, 0.14);
  }

  playDoorUnlock() {
    this.playBell(261.63, 0.24, 0.085, 0);
    this.playBell(392.0, 0.26, 0.08, 0.08);
    this.playBell(523.25, 0.34, 0.08, 0.16);
  }

  playJump() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.13);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playWallJump() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.11);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playShoot() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playMeleeSlash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playSlide() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.18);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playEnemyHit() {
    this.playBell(329.63, 0.12, 0.075);
  }

  playEnemyDefeat() {
    this.playBell(440, 0.14, 0.075, 0);
    this.playBell(659.25, 0.2, 0.07, 0.05);
  }

  playBump() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playFail() {
    this.playBell(329.63, 0.22, 0.07, 0);
    this.playBell(261.63, 0.3, 0.07, 0.12);
    this.playBell(196.0, 0.4, 0.07, 0.26);
  }

  playComplete() {
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
    chord.forEach((f, idx) => {
      this.playBell(f, 0.42, 0.075, idx * 0.075);
    });
  }
}

export const soundEngine = new SoundEngine();
