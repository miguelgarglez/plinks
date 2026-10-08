import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './audio';

type State = AudioContextState;

class FakeCtx {
  state: State = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createGain() {
    return {
      gain: { value: 1, setTargetAtTime: vi.fn() },
      connect: vi.fn(function (this: unknown) { return this; }),
    };
  }
  createConvolver() {
    return {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(function (this: unknown) { return this; }),
    };
  }
  createBuffer(channels: number, length: number, rate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate: rate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }
}

describe('AudioEngine.unlock', () => {
  let last: FakeCtx | null = null;

  beforeEach(() => {
    last = null;
    vi.stubGlobal('AudioContext', class {
      constructor() {
        last = new FakeCtx();
        return last as unknown as AudioContext;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resumes a brand-new suspended context in the same unlock call', () => {
    const eng = new AudioEngine();
    eng.unlock();
    expect(last).not.toBeNull();
    expect(last!.resume).toHaveBeenCalledTimes(1);
    expect(eng.state).toBe('running');
    expect(eng.ready).toBe(true);
  });

  it('resumes again when a later unlock finds the context suspended', async () => {
    const eng = new AudioEngine();
    eng.unlock();
    last!.state = 'suspended';
    eng.unlock();
    expect(last!.resume).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    expect(eng.state).toBe('running');
  });
});
