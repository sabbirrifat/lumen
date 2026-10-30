// Lumen's sounds, synthesized with the Web Audio API: no audio files, every tone is our own.

type Ambient = { stop(): void };

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: GainNode | null = null;
  private enabled = true;
  private volume = 0.6;
  private ambient: Ambient | null = null;

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master) this.master.gain.value = this.level();
    if (!enabled) this.stopAmbient();
  }

  private level() {
    return this.volume * 0.55;
  }

  /** Created lazily: browsers only allow audio after a user gesture. */
  private audio(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.level();
      master.connect(ctx.destination);
      // A soft room: a decaying noise impulse through a convolver.
      const convolver = ctx.createConvolver();
      const length = ctx.sampleRate * 2.4;
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
      convolver.buffer = impulse;
      const send = ctx.createGain();
      send.gain.value = 0.35;
      send.connect(convolver).connect(master);
      this.ctx = ctx;
      this.master = master;
      this.reverb = send;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private envelope(ctx: AudioContext, when: number, peak: number, attack: number, decay: number, wet = 0) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    env.connect(this.master!);
    if (wet && this.reverb) {
      const send = ctx.createGain();
      send.gain.value = wet;
      env.connect(send).connect(this.reverb);
    }
    return env;
  }

  private tone(freq: number, opts: { at?: number; type?: OscillatorType; peak?: number; attack?: number; decay?: number; wet?: number } = {}) {
    const ctx = this.audio();
    if (!ctx) return;
    const when = ctx.currentTime + (opts.at ?? 0);
    const { peak = 0.12, attack = 0.005, decay = 0.12 } = opts;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;
    osc.connect(this.envelope(ctx, when, peak, attack, decay, opts.wet));
    osc.start(when);
    osc.stop(when + attack + decay + 0.05);
  }

  /** A soft FM bell: a sine whose brightness fades as it rings. */
  private bell(freq: number, at: number, decay: number, peak: number) {
    const ctx = this.audio();
    if (!ctx) return;
    const when = ctx.currentTime + at;
    const carrier = ctx.createOscillator();
    carrier.frequency.value = freq;
    const modulator = ctx.createOscillator();
    modulator.frequency.value = freq * 3.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(freq * 1.6, when);
    depth.gain.exponentialRampToValueAtTime(1, when + decay);
    modulator.connect(depth).connect(carrier.frequency);
    carrier.connect(this.envelope(ctx, when, peak, 0.008, decay, 0.6));
    carrier.start(when);
    modulator.start(when);
    carrier.stop(when + decay + 0.1);
    modulator.stop(when + decay + 0.1);
  }

  tick() {
    this.tone(1320, { type: 'triangle', peak: 0.05, decay: 0.05 });
  }

  toggle(on: boolean) {
    this.tone(on ? 660 : 990, { type: 'triangle', peak: 0.06, decay: 0.06 });
    this.tone(on ? 990 : 660, { type: 'triangle', peak: 0.06, decay: 0.08, at: 0.05 });
  }

  /** A slow rising chord as a scan begins. */
  scanStart() {
    [293.66, 440, 554.37, 659.25].forEach((f, i) => this.tone(f, { at: i * 0.06, peak: 0.05, attack: 0.35, decay: 0.9, wet: 0.5 }));
  }

  /** A quiet evolving pad under a scan or cleanup. */
  startAmbient() {
    const ctx = this.audio();
    if (!ctx || this.ambient) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 1.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(filter.frequency);
    filter.connect(out);
    out.connect(this.master!);
    if (this.reverb) out.connect(this.reverb);
    const voices = [146.83, 220, 329.63, 440].flatMap((f) =>
      [-6, 6].map((detune) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start();
        return osc;
      }),
    );
    lfo.start();
    this.ambient = {
      stop: () => {
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        [...voices, lfo].forEach((osc) => osc.stop(now + 1.3));
      },
    };
  }

  stopAmbient() {
    this.ambient?.stop();
    this.ambient = null;
  }

  /** Two rising notes when results are ready. */
  found() {
    this.bell(659.25, 0, 1.3, 0.09);
    this.bell(987.77, 0.14, 1.6, 0.08);
  }

  /** Filtered noise sweeping upward, as cleaning starts. */
  whoosh() {
    const ctx = this.audio();
    if (!ctx) return;
    const when = ctx.currentTime;
    const length = ctx.sampleRate * 1.4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(260, when);
    band.frequency.exponentialRampToValueAtTime(3200, when + 1.2);
    noise.connect(band).connect(this.envelope(ctx, when, 0.12, 0.35, 0.95, 0.4));
    noise.start(when);
  }

  /** A warm bell chord when a cleanup finishes. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(f, i * 0.08, 2.6, 0.07));
  }

  error() {
    this.tone(392, { type: 'triangle', peak: 0.07, decay: 0.15 });
    this.tone(311.13, { type: 'triangle', peak: 0.07, decay: 0.25, at: 0.12 });
  }
}

export const sound = new SoundEngine();
