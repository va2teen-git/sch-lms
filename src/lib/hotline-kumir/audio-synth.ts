import type { AudioMood } from './types.ts';

export type SfxCue =
  | 'step'
  | 'paint'
  | 'key'
  | 'terminal_ok'
  | 'door_breach'
  | 'strike'
  | 'dash'
  | 'alarm'
  | 'victory'
  | 'error';

export interface AudioSynthState {
  mood: AudioMood;
  muted: boolean;
  initialized: boolean;
  lastSfx: SfxCue | null;
}

const STORAGE_MUTE_KEY = 'hotline_kumir_muted';

export class HotlineAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mood: AudioMood = 'SILENT';
  private muted: boolean;
  private lastSfx: SfxCue | null = null;

  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(forceMute = false) {
    let savedMute = false;
    if (typeof localStorage !== 'undefined') {
      savedMute = localStorage.getItem(STORAGE_MUTE_KEY) === '1';
    }
    this.muted = forceMute || savedMute;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          void this.ctx.suspend().catch(() => {});
        } else if (!this.muted) {
          void this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  getAudioState(): AudioSynthState {
    return {
      mood: this.mood,
      muted: this.muted,
      initialized: this.ctx !== null,
      lastSfx: this.lastSfx,
    };
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_MUTE_KEY, muted ? '1' : '0');
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.24, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  unlock(): void {
    if (this.muted || typeof window === 'undefined') return;
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!this.ctx) {
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.24;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    this.ensureSequencerRunning();
  }

  setMood(nextMood: AudioMood): void {
    if (this.mood === nextMood) return;
    this.mood = nextMood;
    if (nextMood === 'SILENT') {
      this.stopSequencer();
    } else if (this.ctx && !this.muted) {
      this.ensureSequencerRunning();
    }
  }

  playSfx(cue: SfxCue): void {
    this.lastSfx = cue;
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (cue) {
      case 'step':
        this.triggerTone(140, 85, 0.06, 'triangle', 0.16, now);
        break;
      case 'paint':
        this.triggerTone(520, 880, 0.14, 'sine', 0.2, now);
        break;
      case 'key':
        this.triggerTone(920, 760, 0.035, 'square', 0.08, now);
        break;
      case 'terminal_ok':
        this.triggerTone(440, 440, 0.08, 'triangle', 0.18, now);
        this.triggerTone(660, 880, 0.14, 'triangle', 0.22, now + 0.08);
        break;
      case 'door_breach':
        this.triggerNoiseBurst(0.22, 650, 0.45, now);
        this.triggerTone(120, 38, 0.24, 'sawtooth', 0.4, now);
        break;
      case 'strike':
        this.triggerNoiseBurst(0.14, 1200, 0.35, now);
        this.triggerTone(220, 62, 0.16, 'sawtooth', 0.35, now);
        break;
      case 'dash':
        this.triggerNoiseBurst(0.11, 2200, 0.22, now);
        this.triggerTone(340, 720, 0.11, 'sine', 0.18, now);
        break;
      case 'alarm':
        this.triggerTone(640, 880, 0.18, 'sawtooth', 0.2, now);
        this.triggerTone(880, 640, 0.18, 'sawtooth', 0.2, now + 0.19);
        break;
      case 'victory':
        this.triggerTone(261.6, 261.6, 0.15, 'triangle', 0.24, now);
        this.triggerTone(329.6, 329.6, 0.15, 'triangle', 0.24, now + 0.1);
        this.triggerTone(392.0, 392.0, 0.22, 'triangle', 0.26, now + 0.2);
        this.triggerTone(523.2, 523.2, 0.35, 'triangle', 0.28, now + 0.32);
        break;
      case 'error':
        this.triggerTone(190, 95, 0.2, 'sawtooth', 0.26, now);
        break;
    }
  }

  dispose(): void {
    this.stopSequencer();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }

  private ensureSequencerRunning(): void {
    if (this.schedulerId !== null || !this.ctx || this.mood === 'SILENT') return;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.schedulerId = setInterval(() => {
      if (!this.ctx || this.muted || this.mood === 'SILENT' || this.ctx.state !== 'running') return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleStep(this.stepIndex, this.nextNoteTime);
        const bpm = this.mood === 'COMBAT' ? 128 : this.mood === 'ALERT' ? 116 : 92;
        const sixteenthSec = 60 / bpm / 4;
        this.nextNoteTime += sixteenthSec;
        this.stepIndex = (this.stepIndex + 1) % 16;
      }
    }, 25);
  }

  private stopSequencer(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private scheduleStep(step: number, when: number): void {
    if (!this.ctx || !this.masterGain) return;
    const bassNotes =
      this.mood === 'COMBAT'
        ? [55, 55, 110, 55, 65.4, 65.4, 130.8, 65.4]
        : [55, 55, 65.4, 55, 73.4, 55, 82.4, 55];

    if (step % 2 === 0) {
      const note = bassNotes[(step / 2) % bassNotes.length];
      this.triggerFilteredBass(note, this.mood === 'COMBAT' ? 0.16 : 0.1, when);
    }

    if (this.mood === 'STEALTH' && step % 4 === 0) {
      const arp = [220, 261.6, 329.6, 440];
      this.triggerTone(arp[(step / 4) % arp.length], arp[(step / 4) % arp.length], 0.09, 'triangle', 0.06, when);
    }

    if (this.mood === 'ALERT' && step % 8 === 0) {
      this.triggerTone(step === 0 ? 640 : 780, step === 0 ? 780 : 640, 0.12, 'sine', 0.06, when);
    }

    if (this.mood === 'COMBAT') {
      if (step % 4 === 0) {
        this.triggerTone(140, 42, 0.11, 'sine', 0.28, when);
      }
      if (step === 4 || step === 12) {
        this.triggerNoiseBurst(0.11, 1800, 0.2, when);
      }
    }
  }

  private triggerTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    when: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, when);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), when + durationSec);
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + durationSec + 0.02);
  }

  private triggerFilteredBass(freq: number, volume: number, when: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.mood === 'COMBAT' ? 680 : 340, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + 0.16);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private triggerNoiseBurst(durationSec: number, centerHz: number, volume: number, when: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerHz, when);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(when);
    src.stop(when + durationSec + 0.02);
  }
}
