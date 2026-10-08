import { KITS, midiToFreq, type KitName } from './music';
import type { NoteEventLike } from './types';

// Karplus-Strong plucked-string synthesis, rendered into AudioBuffers once per
// pitch. Plus a generated exponential-decay noise impulse for reverb.
type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor {
  const w = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? AudioContext;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: ConvolverNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private live = new Set<AudioBufferSourceNode>();
  private kit: KitName = 'kalimba';
  private _muted = false;
  private listening = false;

  get muted() { return this._muted; }

  setKit(kit: KitName) {
    if (kit !== this.kit) { this.kit = kit; this.buffers.clear(); }
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.01);
  }

  get ready() { return !!this.ctx; }

  get state(): AudioContextState | 'missing' {
    return this.ctx?.state ?? 'missing';
  }

  unlock() {
    if (!this.ctx) {
      const ctx = new (audioContextCtor())();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.9;
      this.master.connect(ctx.destination);
      this.wet = ctx.createConvolver();
      this.wet.buffer = this.impulse(1.8, 2.6);
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.32;
      this.wet.connect(wetGain).connect(this.master);
      this.watchVisibility();
    }
    this.resume();
  }

  private resume() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'suspended') return;
    void ctx.resume().catch(() => {
      // Safari rejects when the user-activation window already closed.
    });
  }

  private watchVisibility() {
    if (this.listening || typeof document === 'undefined') return;
    this.listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.resume();
    });
  }

  private impulse(dur: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private pluck(midi: number): AudioBuffer {
    const ctx = this.ctx!;
    const key = `${this.kit}:${midi}`;
    const cached = this.buffers.get(key);
    if (cached) return cached;

    const k = KITS[this.kit];
    const freq = midiToFreq(midi);
    const sr = ctx.sampleRate;
    const dur = Math.min(2.2, k.stretch * 1.4 + 60 / freq);
    const len = Math.floor(sr * dur);
    const N = Math.max(2, Math.round(sr / freq));

    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const line = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const n = Math.random() * 2 - 1;
      line[i] = n * (i < N * 0.3 ? 1 : k.bright); // brighter attack = more highs
    }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      const nxt = line[(idx + 1) % N];
      const v = k.damp * 0.5 * (cur + nxt);
      line[idx] = v;
      out[i] = cur;
      idx = (idx + 1) % N;
    }
    // gentle fade tail
    const fade = Math.floor(sr * 0.06);
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;

    this.buffers.set(key, buf);
    return buf;
  }

  strike(midi: number, vel = 0.8, when = 0) {
    if (!this.ctx || !this.master || !this.wet) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pluck(midi);
    const g = ctx.createGain();
    const t = Math.max(ctx.currentTime, when || ctx.currentTime);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55 * vel + 0.1, t + 0.004);
    src.connect(g);
    g.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    g.connect(send).connect(this.wet);
    this.live.add(src);
    src.onended = () => this.live.delete(src);
    src.start(t);
  }

  // cancel every scheduled/playing pluck — used when a new drop supersedes one
  stopAll() {
    for (const src of this.live) {
      try { src.onended = null; src.stop(); } catch { /* already stopped */ }
    }
    this.live.clear();
  }

  // tiny detent click — dial notches, guide ticks
  tick(freq = 1400, gain = 0.05) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.035);
  }

  // paper tear for the share ticket — a band-passed noise rip
  tear() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.14);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  // wooden knock for basin landing + UI thunks
  knock(when = 0, freq = 220, gain = 0.4) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = Math.max(ctx.currentTime, when || ctx.currentTime);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  // schedule a whole melody; returns scheduled end time
  playEvents(events: NoteEventLike[], t0: number): number {
    for (const e of events) this.strike(e.midi, e.vel, t0 + e.t);
    return t0 + (events.length ? events[events.length - 1].t : 0) + 2.2;
  }

  now(): number { return this.ctx ? this.ctx.currentTime : 0; }
}
