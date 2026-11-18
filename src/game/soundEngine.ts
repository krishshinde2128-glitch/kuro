import type { AudioCommand } from './petState';

// Procedural Web Audio synthesizer with master gain control and full-bodied output levels.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lofiTimer: number | null = null;
  private lofiPlaying = false;
  private rainPlaying = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private muted = false;
  private volume = 0.85;
  private step = 0;

  private ensureContext(): { ctx: AudioContext; out: GainNode } | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    return { ctx: this.ctx, out: this.masterGain };
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.04
      );
    }
    if (muted) {
      this.stopLofi();
      this.stopRain();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isLofiPlaying(): boolean {
    return this.lofiPlaying;
  }

  public isRainPlaying(): boolean {
    return this.rainPlaying;
  }

  public applyCommand(command: AudioCommand): 'lofi' | 'rain' | 'none' {
    if (command === 'play_lofi') {
      this.stopRain();
      if (!this.muted) this.startLofi();
      return this.muted ? 'none' : 'lofi';
    }
    if (command === 'play_rain_sounds') {
      this.stopLofi();
      if (!this.muted) this.startRain();
      return this.muted ? 'none' : 'rain';
    }
    if (command === 'stop_lofi') {
      this.stopLofi();
      this.stopRain();
      return 'none';
    }
    if (this.lofiPlaying) return 'lofi';
    if (this.rainPlaying) return 'rain';
    return 'none';
  }

  public playPurrChirp() {
    if (this.muted) return;
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playCoinEarned() {
    if (this.muted) return;
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const notes = [659.25, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.26, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playAlertTone() {
    if (this.muted) return;
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(170, now + 0.18);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public startRain() {
    if (this.muted || this.rainPlaying) return;
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Rich pink-noise rain waveform
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = Math.max(-0.95, Math.min(0.95, (b0 + b1 + b2 + white * 0.22) * 0.28));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.45);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start();

    this.rainSource = source;
    this.rainGain = gain;
    this.rainPlaying = true;
  }

  public stopRain() {
    this.rainPlaying = false;
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.rainSource = null;
    }
    if (this.rainGain) {
      try {
        this.rainGain.disconnect();
      } catch {
        // Ignore
      }
      this.rainGain = null;
    }
  }

  public startLofi() {
    if (this.muted || this.lofiPlaying) return;
    const audio = this.ensureContext();
    if (!audio) return;

    this.lofiPlaying = true;
    this.step = 0;

    // Warm jazz-7th chords (Fmaj7 -> Em7 -> Dm7 -> Cmaj7) + gentle top melody notes
    const chords = [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63],
      [130.81, 164.81, 196.0, 246.94],
    ];
    const leadNotes = [659.25, 587.33, 523.25, 440.0, 523.25, 659.25, 587.33, 493.88];

    const playTick = () => {
      if (!this.lofiPlaying || this.muted) return;
      const ensured = this.ensureContext();
      if (!ensured) return;
      const { ctx: audioCtx, out } = ensured;

      const now = audioCtx.currentTime;
      const barStep = this.step % 8;

      if (barStep === 0) {
        const chordIndex = Math.floor(this.step / 8) % chords.length;
        const chord = chords[chordIndex];
        chord.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const filter = audioCtx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.025);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1650, now);

          gain.gain.setValueAtTime(0.001, now + idx * 0.025);
          gain.gain.linearRampToValueAtTime(0.16, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.35);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(out);
          osc.start(now + idx * 0.025);
          osc.stop(now + 2.4);
        });
      }

      // Soft Rhodes bell melody on even beats
      if (barStep === 2 || barStep === 6) {
        const leadFreq = leadNotes[this.step % leadNotes.length];
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(leadFreq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.7);
      }

      // Warm lo-fi kick on beats 0 and 5
      if (barStep === 0 || barStep === 5) {
        const kick = audioCtx.createOscillator();
        const kGain = audioCtx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(115, now);
        kick.frequency.exponentialRampToValueAtTime(44, now + 0.14);
        kGain.gain.setValueAtTime(0.28, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kick.connect(kGain);
        kGain.connect(out);
        kick.start(now);
        kick.stop(now + 0.17);
      }

      this.step += 1;
    };

    playTick();
    this.lofiTimer = window.setInterval(playTick, 310);
  }

  public stopLofi() {
    this.lofiPlaying = false;
    if (this.lofiTimer !== null) {
      window.clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
