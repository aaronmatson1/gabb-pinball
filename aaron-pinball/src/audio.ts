// Tiny 8-bit-style synth using WebAudio — no asset files.
// Square/triangle/saw oscillators with ADSR envelopes for SFX.
// A looping melody scheduler for background music.

type OscType = OscillatorType;

const NOTE: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5,
  REST: 0,
};

class GabbSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private musicTimer: number | null = null;
  private musicStarted = false;

  /** Lazily create the AudioContext — must be triggered by user gesture. */
  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.masterGain);
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }
  isMuted() { return this.muted; }

  private blip(opts: {
    freq: number; type?: OscType; dur?: number; attack?: number; release?: number;
    gain?: number; freqEnd?: number; dest?: AudioNode;
  }) {
    if (!this.ctx || !this.masterGain) return;
    const { freq, type = 'square', dur = 0.08, attack = 0.005, release = 0.05,
      gain = 0.4, freqEnd, dest } = opts;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.setValueAtTime(gain, t0 + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(env);
    env.connect(dest ?? this.masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  bumper() {
    this.blip({ freq: 880, freqEnd: 220, type: 'square', dur: 0.05, release: 0.08, gain: 0.45 });
  }
  target() {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.blip({ freq: f, type: 'square', dur: 0.07, gain: 0.45 }), i * 60),
    );
  }
  launch() {
    this.blip({ freq: 220, freqEnd: 880, type: 'sawtooth', dur: 0.25, release: 0.1, gain: 0.35 });
  }
  flipper() {
    this.blip({ freq: 140, freqEnd: 90, type: 'triangle', dur: 0.04, release: 0.02, gain: 0.25 });
  }
  drain() {
    [440, 330, 220, 165].forEach((f, i) =>
      setTimeout(() => this.blip({ freq: f, type: 'triangle', dur: 0.1, gain: 0.4 }), i * 90),
    );
  }
  mode() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.blip({ freq: f, type: 'square', dur: 0.1, gain: 0.5 }), i * 80),
    );
  }
  gameOver() {
    [659, 587, 523, 466, 392, 349, 294, 196].forEach((f, i) =>
      setTimeout(() => this.blip({ freq: f, type: 'square', dur: 0.14, gain: 0.45 }), i * 120),
    );
  }

  // ----- Background music: simple chiptune loop -----
  startMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    const melody: Array<[string, number]> = [
      // upbeat 4/4 kid-friendly hook — quarter-note units
      ['E4', 1], ['G4', 1], ['C5', 1], ['G4', 1],
      ['E4', 1], ['G4', 1], ['C5', 2],
      ['D5', 1], ['B4', 1], ['G4', 1], ['E4', 1],
      ['C4', 1], ['E4', 1], ['G4', 2],
      ['F4', 1], ['A4', 1], ['C5', 1], ['A4', 1],
      ['F4', 1], ['A4', 1], ['C5', 2],
      ['G4', 1], ['B4', 1], ['D5', 1], ['B4', 1],
      ['G4', 1], ['C5', 1], ['E5', 2],
    ];
    const bass: Array<[string, number]> = [
      ['C3', 2], ['G3', 2], ['C3', 2], ['G3', 2],
      ['F3', 2], ['C3', 2], ['G3', 2], ['C3', 2],
    ];
    const bpm = 132;
    const beatSec = 60 / bpm;

    const playLoop = () => {
      if (!this.ctx || !this.musicGain) return;
      let t = this.ctx.currentTime + 0.05;
      melody.forEach(([n, beats]) => {
        const f = NOTE[n];
        if (f > 0) this.scheduleNote(f, t, beats * beatSec * 0.95, 'square', 0.22);
        t += beats * beatSec;
      });
      // bass underneath, repeated to match
      let bt = this.ctx.currentTime + 0.05;
      const totalBeats = melody.reduce((s, [, b]) => s + b, 0);
      while (bt < this.ctx.currentTime + 0.05 + totalBeats * beatSec) {
        for (const [n, beats] of bass) {
          const f = NOTE[n];
          if (f > 0) this.scheduleNote(f, bt, beats * beatSec * 0.95, 'triangle', 0.28);
          bt += beats * beatSec;
          if (bt >= this.ctx.currentTime + 0.05 + totalBeats * beatSec) break;
        }
      }
      this.musicTimer = window.setTimeout(playLoop, totalBeats * beatSec * 1000);
    };
    playLoop();
  }

  stopMusic() {
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
    this.musicStarted = false;
  }

  private scheduleNote(freq: number, when: number, dur: number, type: OscType, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.01);
    env.gain.setValueAtTime(gain, when + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env);
    env.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
}

export const AUDIO = new GabbSynth();
