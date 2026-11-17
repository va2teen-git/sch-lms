export type LoginEasterEgg =
  | { kind: 'screamer' }
  | { kind: 'blocked-admin'; message: string }
  | { kind: 'matrix'; message: string }
  | { kind: 'legend'; message: string }
  | { kind: 'ai-uprising'; message: string };

/** Normalize name input for case- and whitespace-insensitive easter egg matching. */
export function normalizeNamePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Detect whether the submitted first/last name pair triggers a login easter egg. */
export function detectLoginEasterEgg(firstName: string, lastName: string): LoginEasterEgg | null {
  const fn = normalizeNamePart(firstName);
  const ln = normalizeNamePart(lastName);

  if ((fn === 'николай' && ln === 'ватутин') || (fn === 'ватутин' && ln === 'николай')) {
    return { kind: 'screamer' };
  }

  const blockedPairs = [
    ['admin', 'admin'],
    ['root', 'root'],
    ['админ', 'админ'],
    ['супер', 'админ'],
    ['хакер', 'хакер'],
  ];
  if (blockedPairs.some(([a, b]) => fn === a && ln === b)) {
    return {
      kind: 'blocked-admin',
      message: 'Доступ root отклонён! Пятёрки придётся зарабатывать честно.',
    };
  }

  if (
    (fn === 'томас' && ln === 'андерсон') ||
    (fn === 'нео' && ln === 'андерсон') ||
    (fn === 'нео' && ln === 'матрица')
  ) {
    return {
      kind: 'matrix',
      message: 'Wake up, Neo... Система распознала Избранного. Подключаем Матрицу уроков...',
    };
  }

  const legendPairs = [
    ['алан', 'тьюринг'],
    ['ада', 'лавлейс'],
    ['линус', 'торвальдс'],
    ['гвидо', 'ван россум'],
    ['павел', 'дуров'],
    ['билл', 'гейтс'],
    ['стив', 'джобс'],
  ];
  if (legendPairs.some(([a, b]) => fn === a && ln === b)) {
    return {
      kind: 'legend',
      message: 'Обнаружена легенда IT! Проверка авторитета пройдена, удачи на уроке!',
    };
  }

  const aiTokens = new Set(['chatgpt', 'skynet', 'скайнет', 'нейросеть']);
  if (aiTokens.has(fn) || aiTokens.has(ln)) {
    return {
      kind: 'ai-uprising',
      message: 'Внимание: обнаружен искусственный интеллект! Вход разрешён под присмотром учителя.',
    };
  }

  return null;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 44100;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** Play short retro Web Audio cues for non-screamer easter eggs. */
export function playToneCue(kind: 'blocked' | 'matrix' | 'legend' | 'ai'): void {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes: Record<typeof kind, Array<{ freq: number; dur: number; type: OscillatorType }>> = {
      blocked: [
        { freq: 220, dur: 0.14, type: 'sawtooth' },
        { freq: 146.83, dur: 0.24, type: 'sawtooth' },
      ],
      matrix: [
        { freq: 523.25, dur: 0.08, type: 'square' },
        { freq: 659.25, dur: 0.08, type: 'square' },
        { freq: 1046.5, dur: 0.16, type: 'square' },
      ],
      legend: [
        { freq: 440, dur: 0.07, type: 'triangle' },
        { freq: 554.37, dur: 0.07, type: 'triangle' },
        { freq: 659.25, dur: 0.07, type: 'triangle' },
        { freq: 880, dur: 0.18, type: 'triangle' },
      ],
      ai: [
        { freq: 780, dur: 0.06, type: 'square' },
        { freq: 420, dur: 0.06, type: 'square' },
        { freq: 920, dur: 0.12, type: 'square' },
      ],
    };

    let offset = 0;
    for (const note of notes[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + offset);
      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + note.dur + 0.02);
      offset += note.dur;
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, Math.ceil((offset + 0.2) * 1000));
  } catch {
    // Ignore audio errors in restricted headless environments.
  }
}

export interface ScreamerElements {
  overlay: HTMLElement;
  image: HTMLElement;
  flash: HTMLElement;
  closeButton: HTMLButtonElement;
}

/** Manages the full-screen screamer overlay, full-power Web Audio shriek, and strict close lock. */
export class ScreamerController {
  private elements: ScreamerElements;
  private active = false;
  private audioCtx: AudioContext | null = null;
  private pulseTimer: number | null = null;
  private activeAnimations: Animation[] = [];
  private keyGuard: ((e: KeyboardEvent) => void) | null = null;

  constructor(elements: ScreamerElements) {
    this.elements = elements;
  }

  public isActive(): boolean {
    return this.active;
  }

  public start(): void {
    if (this.active) return;
    this.active = true;

    const { overlay, image, flash, closeButton } = this.elements;
    overlay.classList.remove('hidden');
    closeButton.classList.remove('hidden');

    document.documentElement.requestFullscreen?.().catch(() => {});

    this.triggerVisuals(image, flash);
    this.startAudio();

    this.keyGuard = (e: KeyboardEvent) => {
      if (!this.active) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', this.keyGuard, true);
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;

    if (this.pulseTimer !== null) {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    for (const anim of this.activeAnimations) {
      anim.cancel();
    }
    this.activeAnimations = [];

    if (this.keyGuard) {
      window.removeEventListener('keydown', this.keyGuard, true);
      this.keyGuard = null;
    }

    this.elements.overlay.classList.add('hidden');
    this.elements.closeButton.classList.add('hidden');

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private triggerVisuals(image: HTMLElement, flash: HTMLElement): void {
    if (typeof flash.animate === 'function') {
      const flashAnim = flash.animate(
        [
          { opacity: 0.95, backgroundColor: '#ffffff' },
          { opacity: 0.75, backgroundColor: '#b91c1c', offset: 0.25 },
          { opacity: 0.25, backgroundColor: '#450a0a', offset: 0.65 },
          { opacity: 0, backgroundColor: '#000000' },
        ],
        { duration: 420, easing: 'ease-out', fill: 'forwards' }
      );
      this.activeAnimations.push(flashAnim);
    }

    if (typeof image.animate === 'function') {
      const jumpAnim = image.animate(
        [
          { transform: 'scale(0.92) translate(0, 0)', filter: 'contrast(1.6) brightness(1.4)' },
          { transform: 'scale(1.24) translate(-18px, 12px)', filter: 'contrast(1.9) brightness(1.1)', offset: 0.12 },
          { transform: 'scale(1.18) translate(16px, -14px)', filter: 'invert(0.15) contrast(2)', offset: 0.24 },
          { transform: 'scale(1.26) translate(-14px, -10px)', filter: 'contrast(1.8) brightness(1.2)', offset: 0.36 },
          { transform: 'scale(1.15) translate(12px, 14px)', filter: 'contrast(1.5)', offset: 0.5 },
          { transform: 'scale(1.2) translate(-8px, 6px)', filter: 'contrast(1.4)', offset: 0.72 },
          { transform: 'scale(1.06) translate(0, 0)', filter: 'contrast(1.25) brightness(1)' },
        ],
        { duration: 680, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      );
      this.activeAnimations.push(jumpAnim);
    }
  }

  private startAudio(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.audioCtx = ctx;
      ctx.resume().catch(() => {});

      // Compressor + full-scale master gain gives maximum loudness without harsh digital clipping.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, ctx.currentTime);
      compressor.knee.setValueAtTime(0, ctx.currentTime);
      compressor.ratio.setValueAtTime(20, ctx.currentTime);
      compressor.attack.setValueAtTime(0.001, ctx.currentTime);
      compressor.release.setValueAtTime(0.06, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.playScreamerBurst(ctx, compressor, 2.4);

      this.pulseTimer = window.setInterval(() => {
        if (!this.active || !this.audioCtx) return;
        this.playScreamerBurst(this.audioCtx, compressor, 0.9);
      }, 3600);
    } catch {
      // Ignore audio errors in environments without audio hardware.
    }
  }

  private playScreamerBurst(ctx: AudioContext, dest: AudioNode, durationSec: number): void {
    const now = ctx.currentTime;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(150);
    shaper.oversample = '2x';
    shaper.connect(dest);

    // Sub-bass impact slam
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + Math.min(0.45, durationSec));
    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.exponentialRampToValueAtTime(0.08, now + durationSec);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(now);
    subOsc.stop(now + durationSec + 0.05);

    // Dissonant shriek cluster with rapid LFO pitch modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(31, now);
    lfoGain.gain.setValueAtTime(75, now);
    lfo.connect(lfoGain);
    lfo.start(now);
    lfo.stop(now + durationSec + 0.05);

    const shriekVoices: Array<{ freq: number; type: OscillatorType; gain: number }> = [
      { freq: 739.99, type: 'sawtooth', gain: 0.45 },
      { freq: 783.99, type: 'square', gain: 0.4 },
      { freq: 1108.73, type: 'sawtooth', gain: 0.35 },
      { freq: 1567.98, type: 'square', gain: 0.3 },
    ];

    for (const voice of shriekVoices) {
      const osc = ctx.createOscillator();
      const vGain = ctx.createGain();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(voice.freq, now);
      osc.frequency.exponentialRampToValueAtTime(voice.freq * 0.72, now + durationSec);
      lfoGain.connect(osc.frequency);

      vGain.gain.setValueAtTime(voice.gain, now);
      vGain.gain.exponentialRampToValueAtTime(0.01, now + durationSec);
      osc.connect(vGain);
      vGain.connect(shaper);
      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    }

    // Filtered white-noise shriek
    const noiseLen = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(1.8, now);
    bandpass.frequency.setValueAtTime(1700, now);
    bandpass.frequency.linearRampToValueAtTime(3400, now + durationSec * 0.35);
    bandpass.frequency.exponentialRampToValueAtTime(950, now + durationSec);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.04, now + durationSec);

    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(shaper);
    noiseSrc.start(now);
    noiseSrc.stop(now + durationSec + 0.05);
  }
}
