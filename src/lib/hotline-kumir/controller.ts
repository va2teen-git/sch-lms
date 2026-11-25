import { HOTLINE_KUMIR_LEVELS } from '../../data/hotline-kumir-levels.ts';
import { HotlineAudioSynth } from './audio-synth.ts';
import type { CameraMode } from './camera.ts';
import { HotlineGameEngine } from './game-engine.ts';
import { HotlineCanvasRenderer } from './renderer.ts';
import type { LevelResult, MaskId, WorldEvent, WorldSnapshot } from './types.ts';

declare global {
  interface Window {
    __HOTLINE_KUMIR_TEST__?: {
      getState: () => WorldSnapshot;
      getAudioState: () => ReturnType<HotlineAudioSynth['getAudioState']>;
      getRenderStats: () => ReturnType<HotlineCanvasRenderer['getRenderStats']>;
      getCameraState: () => ReturnType<HotlineCanvasRenderer['getCameraState']>;
      setCameraMode: (mode: CameraMode) => void;
      waitForAtlasReady: () => Promise<void>;
      flushAnimations: () => void;
      selectLevel: (id: number, mask?: MaskId) => void;
      setCode: (code: string) => void;
      runCode: () => Promise<void>;
      execLinux: (cmd: string) => { output: string; exitCode: number; snapshot: WorldSnapshot };
      forceTimeout: () => WorldSnapshot;
    };
    LMSTelemetry?: {
      create?: (opts: Record<string, unknown>) => {
        start: () => void;
        markActivity: () => void;
        send: (actionType: string, extra?: Record<string, unknown>) => Promise<unknown> | void;
        getTimeSpentSec: () => number;
      };
    };
  }
}

export interface HotlineControllerHooks {
  onMissionComplete?: (result: LevelResult, snap: WorldSnapshot) => void;
  onMissionStart?: (levelId: number, mask: MaskId) => void;
  onAlertTriggered?: (levelId: number, reason: string) => void;
}

const MASK_INFO: Record<MaskId, { name: string; perk: string }> = {
  richard: { name: 'Петух «Ричард»', perk: 'Эталонный баланс и чёткий маршрут' },
  rasmus: { name: 'Сова «Расмус»', perk: 'Прогноз зоны камер и шагов на +1 такт' },
  tony: { name: 'Волк «Тони»', perk: '+1 такт оглушения и быстрый рывок (1 ход)' },
  sprint: { name: 'Лис «Спринт»', perk: '+1 ход / +15 с к ETA ГБР и лимит IDS 4' },
};

export function initHotlineKumirController(
  root: HTMLElement,
  hooks: HotlineControllerHooks = {}
): () => void {
  const params = new URLSearchParams(window.location.search);
  const initialLevel = Math.min(5, Math.max(1, parseInt(params.get('level') || '1', 10) || 1));
  const initialMaskParam = params.get('mask') as MaskId | null;
  let selectedMask: MaskId =
    initialMaskParam && MASK_INFO[initialMaskParam] ? initialMaskParam : 'richard';
  const baseSeed = parseInt(params.get('seed') || '1337', 10) || 1337;
  const fastAnim = params.get('fastAnim') === '1';
  const forceMute = params.get('mute') === '1';

  const canvas = root.querySelector<HTMLCanvasElement>('#hk-arena-canvas');
  const codeEditor = root.querySelector<HTMLTextAreaElement>('#hk-code-editor');
  const gutterEl = root.querySelector<HTMLPreElement>('#hk-line-gutter');
  const snippetsEl = root.querySelector<HTMLDivElement>('#hk-snippets');
  const errorBox = root.querySelector<HTMLDivElement>('#hk-error-box');

  const levelSelect = root.querySelector<HTMLSelectElement>('#hk-level-select');
  const maskLabelEl = root.querySelector<HTMLElement>('#hk-mask-badge');
  const phaseBadgeEl = root.querySelector<HTMLElement>('#hk-phase-badge');
  const turnTimerEl = root.querySelector<HTMLElement>('#hk-turn-timer');
  const etaTrackerEl = root.querySelector<HTMLElement>('#hk-gbr-tracker');
  const etaTextEl = root.querySelector<HTMLElement>('#hk-gbr-eta-text');
  const etaSegs = Array.from(root.querySelectorAll<HTMLElement>('[data-gbr-seg]'));
  const statusObjEl = root.querySelector<HTMLElement>('#hk-obj-status');
  const idsBadgeEl = root.querySelector<HTMLElement>('#hk-ids-badge');
  const hpBadgeEl = root.querySelector<HTMLElement>('#hk-hp-badge');
  const activeLineEl = root.querySelector<HTMLElement>('#hk-active-line-label');

  const btnRun = root.querySelector<HTMLButtonElement>('#hk-btn-run');
  const btnStep = root.querySelector<HTMLButtonElement>('#hk-btn-step');
  const btnReset = root.querySelector<HTMLButtonElement>('#hk-btn-reset');
  const btnMute = root.querySelector<HTMLButtonElement>('#hk-btn-mute');
  const btnOpenTerm = root.querySelector<HTMLButtonElement>('#hk-btn-open-term');

  // Camera & portrait controls
  const tileCoordsEl = root.querySelector<HTMLElement>('#hk-tile-coords');
  const btnCamFollow = root.querySelector<HTMLButtonElement>('#hk-btn-cam-follow');
  const btnCamOverview = root.querySelector<HTMLButtonElement>('#hk-btn-cam-overview');
  const btnCamZoomIn = root.querySelector<HTMLButtonElement>('#hk-btn-cam-zoom-in');
  const btnCamZoomOut = root.querySelector<HTMLButtonElement>('#hk-btn-cam-zoom-out');
  const briefingPortraitCanvas = root.querySelector<HTMLCanvasElement>('#hk-briefing-portrait');
  const gbrPortraitCanvas = root.querySelector<HTMLCanvasElement>('#hk-gbr-portrait');
  const maskPortraitCanvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('[data-mask-portrait]'));

  // Briefing overlay
  const briefingOverlay = root.querySelector<HTMLDivElement>('#hk-briefing-overlay');
  const briefingTitleEl = root.querySelector<HTMLElement>('#hk-briefing-title');
  const briefingTimeEl = root.querySelector<HTMLElement>('#hk-briefing-time');
  const briefingTextEl = root.querySelector<HTMLElement>('#hk-briefing-text');
  const briefingCurriculumEl = root.querySelector<HTMLElement>('#hk-briefing-curriculum');
  const maskButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mask-choice]'));
  const btnStartMission = root.querySelector<HTMLButtonElement>('#hk-btn-start-mission');

  // Terminal overlay
  const termOverlay = root.querySelector<HTMLDivElement>('#hk-terminal-overlay');
  const termOutputEl = root.querySelector<HTMLPreElement>('#hk-term-output');
  const termPromptEl = root.querySelector<HTMLElement>('#hk-term-prompt');
  const termInput = root.querySelector<HTMLInputElement>('#hk-term-input');
  const termHeaderStatus = root.querySelector<HTMLElement>('#hk-term-perimeter');
  const btnTermClose = root.querySelector<HTMLButtonElement>('#hk-term-close');
  const btnTermHint = root.querySelector<HTMLButtonElement>('#hk-term-hint');

  // Result overlay
  const resultOverlay = root.querySelector<HTMLDivElement>('#hk-result-overlay');
  const resultTitleEl = root.querySelector<HTMLElement>('#hk-result-title');
  const resultGradeEl = root.querySelector<HTMLElement>('#hk-result-grade');
  const resultStyleEl = root.querySelector<HTMLElement>('#hk-result-style');
  const resultStatsEl = root.querySelector<HTMLElement>('#hk-result-stats');
  const btnNextLevel = root.querySelector<HTMLButtonElement>('#hk-btn-next-level');
  const btnRetryLevel = root.querySelector<HTMLButtonElement>('#hk-btn-retry-level');

  if (!canvas || !codeEditor) {
    throw new Error('HotlineKumir DOM elements missing');
  }

  const renderer = new HotlineCanvasRenderer(canvas, fastAnim);
  const audio = new HotlineAudioSynth(forceMute);

  const renderPortraits = () => {
    if (briefingPortraitCanvas) {
      renderer.drawPortraitToCanvas(briefingPortraitCanvas, selectedMask);
    }
    if (gbrPortraitCanvas) {
      renderer.drawPortraitToCanvas(gbrPortraitCanvas, 'gbr');
    }
    for (const c of maskPortraitCanvases) {
      const m = c.dataset.maskPortrait as MaskId | undefined;
      if (m) renderer.drawPortraitToCanvas(c, m);
    }
  };
  renderer.onAtlasLoad(renderPortraits);

  const syncCameraButtons = () => {
    const mode = renderer.getCameraState().mode;
    if (btnCamFollow) {
      btnCamFollow.className =
        mode === 'FOLLOW'
          ? 'px-2 py-0.5 text-[11px] font-bold bg-cyan-950 border border-cyan-400 text-cyan-200 hover:bg-cyan-900 rounded-0 cursor-pointer'
          : 'px-2 py-0.5 text-[11px] font-bold bg-slate-900 border border-slate-600 text-slate-300 hover:border-cyan-400 rounded-0 cursor-pointer';
    }
    if (btnCamOverview) {
      btnCamOverview.className =
        mode === 'OVERVIEW'
          ? 'px-2 py-0.5 text-[11px] font-bold bg-pink-950 border border-pink-400 text-pink-200 hover:bg-pink-900 rounded-0 cursor-pointer'
          : 'px-2 py-0.5 text-[11px] font-bold bg-slate-900 border border-slate-600 text-slate-300 hover:border-pink-400 rounded-0 cursor-pointer';
    }
  };

  let currentLevelId = initialLevel;
  let engine = new HotlineGameEngine(currentLevelId, selectedMask, baseSeed);
  let execTimer: ReturnType<typeof setInterval> | null = null;
  let turnClockTimer: ReturnType<typeof setInterval> | null = null;
  let turnClockLeft = engine.getSnapshot().turnTimeMaxSec;
  let termHistIdx = -1;
  let missionReported = false;
  let alertReported = false;

  const stopExecutionLoop = () => {
    if (execTimer !== null) {
      clearInterval(execTimer);
      execTimer = null;
    }
  };

  const stopTurnClock = () => {
    if (turnClockTimer !== null) {
      clearInterval(turnClockTimer);
      turnClockTimer = null;
    }
  };

  const syncGutter = (activeLine: number | null) => {
    if (!gutterEl) return;
    const lines = codeEditor.value.split('\n').length;
    const out: string[] = [];
    for (let i = 1; i <= lines; i++) {
      out.push(activeLine === i ? `▶${String(i).padStart(2, ' ')}` : ` ${String(i).padStart(2, ' ')}`);
    }
    gutterEl.textContent = out.join('\n');
    if (activeLineEl) {
      activeLineEl.textContent = activeLine ? `Строка: ${activeLine}` : 'Готов';
    }
  };

  const renderSnippets = () => {
    if (!snippetsEl) return;
    const lvl = HOTLINE_KUMIR_LEVELS.find((l) => l.id === currentLevelId) || HOTLINE_KUMIR_LEVELS[0];
    snippetsEl.innerHTML = '';
    for (const snip of lvl.snippetPreset) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'px-2 py-1 text-[11px] font-mono bg-slate-900 border border-pink-500/60 text-cyan-300 hover:bg-pink-950/60 hover:border-pink-400 rounded-0 cursor-pointer transition-colors';
      btn.textContent = snip.split('\n')[0];
      btn.title = snip;
      btn.addEventListener('click', () => {
        audio.unlock();
        audio.playSfx('key');
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;
        const prefix = start > 0 && codeEditor.value[start - 1] !== '\n' ? '\n' : '';
        const insert = `${prefix}${snip}\n`;
        codeEditor.value = codeEditor.value.slice(0, start) + insert + codeEditor.value.slice(end);
        codeEditor.selectionStart = codeEditor.selectionEnd = start + insert.length;
        codeEditor.focus();
        syncGutter(null);
      });
      snippetsEl.appendChild(btn);
    }
  };

  const appendTermLine = (text: string, cls = 'text-cyan-200') => {
    if (!termOutputEl) return;
    const lineEl = document.createElement('div');
    lineEl.className = `${cls} whitespace-pre-wrap break-words`;
    lineEl.textContent = text;
    termOutputEl.appendChild(lineEl);
    termOutputEl.scrollTop = termOutputEl.scrollHeight;
  };

  const syncTerminalHeader = (snap: WorldSnapshot) => {
    if (termPromptEl) termPromptEl.textContent = engine.getLinuxEngine().getPrompt();
    if (termHeaderStatus) {
      const activeCams = snap.cameras.filter((c) => c.enabled).length;
      const activeLasers = snap.lasers.filter((l) => l.enabled).length;
      const etaLabel = snap.gbrSpawned
        ? 'ГБР В ЗДАНИИ!'
        : snap.alarmTriggered
          ? `ГБР ETA: ${snap.gbrEtaTurns} ход.`
          : 'ГБР: ОЖИДАНИЕ';
      termHeaderStatus.textContent = `КАМЕРЫ: ${activeCams} | ЛАЗЕРЫ: ${activeLasers} | IDS ШУМ: ${snap.idsNoise}/${snap.idsMaxNoise} | ${etaLabel}`;
    }
  };

  const openTerminalModal = () => {
    engine.enterTerminal();
    const snap = engine.getSnapshot();
    if (termOverlay) {
      termOverlay.classList.remove('hidden');
      termOverlay.classList.add('flex');
    }
    syncTerminalHeader(snap);
    if (termOutputEl && termOutputEl.childElementCount === 0) {
      appendTermLine(
        `[LINUX SANDBOX] Подключение к целевому узлу (Уровень ${snap.levelId}). Введите «help» или «ls -la».`,
        'text-pink-400 font-bold'
      );
    }
    setTimeout(() => termInput?.focus(), 20);
    updateUi(snap, []);
  };

  const closeTerminalModal = () => {
    if (termOverlay) {
      termOverlay.classList.add('hidden');
      termOverlay.classList.remove('flex');
    }
    const snap = engine.exitTerminal();
    updateUi(snap, []);
    codeEditor.focus();
  };

  const showResultModal = (snap: WorldSnapshot) => {
    stopExecutionLoop();
    stopTurnClock();
    if (!resultOverlay) return;
    resultOverlay.classList.remove('hidden');
    resultOverlay.classList.add('flex');

    if (snap.phase === 'MISSION_KO') {
      if (resultTitleEl) resultTitleEl.textContent = 'АГЕНТ ОГЛУШЁН ОЦЕПЛЕНИЕМ ГБР';
      if (resultGradeEl) resultGradeEl.textContent = 'KO';
      if (resultStyleEl) resultStyleEl.textContent = 'ПОРАЖЕНИЕ';
      if (resultStatsEl) {
        resultStatsEl.textContent =
          'Наряд ГБР перехватил агента. Нажми [R] или «Повторить» для мгновенного перезапуска сцены!';
      }
      if (btnNextLevel) btnNextLevel.classList.add('hidden');
      return;
    }

    const res = snap.lastResult;
    if (!res) return;
    if (resultTitleEl) resultTitleEl.textContent = `МИССИЯ ${res.levelId} ВЫПОЛНЕНА`;
    if (resultGradeEl) resultGradeEl.textContent = res.grade;
    if (resultStyleEl) {
      const styleMap = {
        GHOST: 'ПРИЗРАК (GHOST)',
        ESCAPE: 'СПРИНТЕР (ESCAPE)',
        COMBAT: 'ВЫШИБАЛА (COMBAT)',
      };
      resultStyleEl.textContent = styleMap[res.styleBadge];
    }
    if (resultStatsEl) {
      resultStatsEl.innerHTML = [
        `Счёт: <strong class="text-cyan-300">${res.score}</strong>`,
        `Строк кода (LOC): <strong class="text-white">${res.locCount}</strong> (норма ≤ ${res.parLoc})`,
        `Команд Linux: <strong class="text-white">${res.linuxCommandsCount}</strong>`,
        `Циклы: ${res.usedLoops ? 'ДА' : 'нет'} | Ветвления: ${res.usedConditions ? 'ДА' : 'нет'} | Алг: ${res.usedSubprograms ? 'ДА' : 'нет'}`,
      ].join('<br/>');
    }
    if (btnNextLevel) {
      if (res.levelId < 5) {
        btnNextLevel.classList.remove('hidden');
      } else {
        btnNextLevel.classList.add('hidden');
      }
    }
  };

  const playEventsAudio = (events: WorldEvent[]) => {
    for (const ev of events) {
      if (ev.type === 'ROBOT_MOVED') audio.playSfx('step');
      else if (ev.type === 'ROBOT_DASHED' || ev.type === 'DECOY_THROWN') audio.playSfx('dash');
      else if (ev.type === 'TILE_PAINTED') audio.playSfx('paint');
      else if (ev.type === 'DOOR_BROKEN') audio.playSfx('door_breach');
      else if (ev.type === 'ENEMY_STUNNED' || ev.type === 'ENEMY_OFFLINE' || ev.type === 'ENEMY_SHIELD_BROKEN')
        audio.playSfx('strike');
      else if (ev.type === 'ALERT_TRIGGERED' || ev.type === 'GBR_ARRIVED') audio.playSfx('alarm');
      else if (ev.type === 'TERMINAL_HACKED' || ev.type === 'DOOR_OPENED') audio.playSfx('terminal_ok');
      else if (ev.type === 'WALL_CRASH' || ev.type === 'PLAYER_KO') audio.playSfx('error');
      else if (ev.type === 'EXTRACTION') audio.playSfx('victory');
    }
  };

  const updateUi = (snap: WorldSnapshot, events: WorldEvent[] = []) => {
    renderer.renderSnapshot(snap, events);
    audio.setMood(snap.audioMood);
    playEventsAudio(events);

    syncGutter(snap.activeLine);

    if (maskLabelEl) maskLabelEl.textContent = MASK_INFO[snap.mask].name;
    if (hpBadgeEl) hpBadgeEl.textContent = `ЗДОРОВЬЕ: ${snap.player.hp}`;
    if (idsBadgeEl) idsBadgeEl.textContent = `IDS: ${snap.idsNoise}/${snap.idsMaxNoise}`;
    if (btnMute) btnMute.textContent = audio.isMuted() ? '🔇 ЗВУК: ВЫКЛ' : '🔊 ЗВУК: ВКЛ';

    if (turnTimerEl) {
      turnTimerEl.textContent = `${String(Math.max(0, Math.ceil(turnClockLeft))).padStart(2, '0')}с`;
      turnTimerEl.className =
        turnClockLeft <= 5
          ? 'px-3 py-1 font-mono text-xl font-black bg-red-950 border-2 border-red-500 text-red-400 rounded-0'
          : snap.alarmTriggered
            ? 'px-3 py-1 font-mono text-xl font-black bg-pink-950 border-2 border-pink-500 text-pink-300 rounded-0'
            : 'px-3 py-1 font-mono text-xl font-black bg-slate-950 border-2 border-cyan-400 text-cyan-300 rounded-0';
    }

    if (phaseBadgeEl) {
      const map: Record<WorldSnapshot['phase'], string> = {
        BRIEFING: 'БРИФИНГ',
        STEALTH: 'СТЕЛС',
        TERMINAL_HACK: 'LINUX ВЗЛОМ',
        ALERT_DISPATCH: 'ТРЕВОГА: ГБР ВЫЕХАЛ',
        ESCAPE_RACE: 'ПОБЕГ ОТ ГБР',
        GBR_BREACH_COMBAT: 'БОЙ С ГБР',
        EXTRACTION: 'ЭВАКУАЦИЯ',
        MISSION_KO: 'НОКАУТ',
      };
      phaseBadgeEl.textContent = map[snap.phase];
      phaseBadgeEl.className =
        snap.phase === 'GBR_BREACH_COMBAT' || snap.phase === 'MISSION_KO'
          ? 'px-2 py-0.5 text-xs font-mono font-bold bg-red-600 text-white border border-red-300 rounded-0'
          : snap.alarmTriggered
            ? 'px-2 py-0.5 text-xs font-mono font-bold bg-pink-600 text-white border border-pink-300 rounded-0'
            : 'px-2 py-0.5 text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500 rounded-0';
    }

    if (etaTrackerEl && etaTextEl) {
      if (snap.alarmTriggered || snap.gbrSpawned) {
        etaTrackerEl.classList.remove('hidden');
        etaTextEl.textContent = snap.gbrSpawned
          ? 'ГБР В ЗДАНИИ! ПРОРВИТЕ ЗАСЛОН К ВЫХОДУ (ВЫХ)'
          : `ГБР ПРИБУДЕТ ЧЕРЕЗ: ${snap.gbrEtaTurns} ХОД. (${snap.gbrEtaSec} С)`;
        const progressIdx = snap.gbrSpawned
          ? 4
          : Math.min(3, Math.max(0, Math.floor(((snap.gbrEtaMaxTurns - snap.gbrEtaTurns) / Math.max(1, snap.gbrEtaMaxTurns)) * 4)));
        etaSegs.forEach((seg, idx) => {
          seg.className =
            idx <= progressIdx
              ? 'px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white border border-red-300 rounded-0'
              : 'px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-700 rounded-0';
        });
      } else {
        etaTrackerEl.classList.add('hidden');
      }
    }

    if (statusObjEl) {
      const hackTxt = snap.hackCompleted ? 'ПК: ВЗЛОМАН ✓' : 'ПК: ЗАКРЫТ';
      const paintTxt = `РЕЛЕ *: ${snap.paintedCount}/${snap.requiredPaintCount}`;
      const exitTxt = snap.exitUnlocked ? 'ВЫХОД: ОТКРЫТ → E' : 'ВЫХОД: ЗАБЛОКИРОВАН';
      statusObjEl.textContent = `${hackTxt}  |  ${paintTxt}  |  ${exitTxt}`;
    }

    if (errorBox) {
      if (snap.lastError) {
        errorBox.textContent = snap.lastError.messageRu;
        errorBox.classList.remove('hidden');
      } else {
        errorBox.classList.add('hidden');
      }
    }

    syncTerminalHeader(snap);

    if (snap.alarmTriggered && !alertReported) {
      alertReported = true;
      hooks.onAlertTriggered?.(snap.levelId, snap.alarmReason || 'Тревога периметра');
    }

    if (snap.phase === 'EXTRACTION' && snap.lastResult) {
      if (!missionReported) {
        missionReported = true;
        hooks.onMissionComplete?.(snap.lastResult, snap);
      }
      showResultModal(snap);
    } else if (snap.phase === 'MISSION_KO') {
      showResultModal(snap);
    }
  };

  const resetTurnClock = () => {
    const snap = engine.getSnapshot();
    turnClockLeft = snap.turnTimeMaxSec;
  };

  const startTurnClockLoop = () => {
    stopTurnClock();
    turnClockTimer = setInterval(() => {
      const snap = engine.getSnapshot();
      if (
        snap.phase === 'BRIEFING' ||
        snap.phase === 'EXTRACTION' ||
        snap.phase === 'MISSION_KO' ||
        execTimer !== null
      ) {
        return;
      }
      turnClockLeft -= 1;
      if (turnClockLeft <= 0) {
        const timeoutRes = engine.handleTurnTimeout();
        resetTurnClock();
        updateUi(timeoutRes.snapshot, timeoutRes.events);
      } else if (turnTimerEl) {
        turnTimerEl.textContent = `${String(Math.ceil(turnClockLeft)).padStart(2, '0')}с`;
      }
    }, 1000);
  };

  const loadLevel = (levelId: number, mask: MaskId, showBriefing = true) => {
    stopExecutionLoop();
    stopTurnClock();
    currentLevelId = levelId;
    selectedMask = mask;
    missionReported = false;
    alertReported = false;
    engine = new HotlineGameEngine(levelId, mask, baseSeed + levelId);
    const lvlDef = HOTLINE_KUMIR_LEVELS.find((l) => l.id === levelId) || HOTLINE_KUMIR_LEVELS[0];

    if (levelSelect) levelSelect.value = String(levelId);
    codeEditor.value = lvlDef.starterCode;
    if (termOutputEl) termOutputEl.innerHTML = '';
    if (termOverlay) {
      termOverlay.classList.add('hidden');
      termOverlay.classList.remove('flex');
    }
    if (resultOverlay) {
      resultOverlay.classList.add('hidden');
      resultOverlay.classList.remove('flex');
    }

    renderSnippets();
    resetTurnClock();

    if (briefingOverlay && showBriefing) {
      briefingOverlay.classList.remove('hidden');
      briefingOverlay.classList.add('flex');
      if (briefingTitleEl) briefingTitleEl.textContent = `УРОВЕНЬ ${lvlDef.id}: ${lvlDef.title.toUpperCase()}`;
      if (briefingTimeEl) briefingTimeEl.textContent = `АВТООТВЕТЧИК // ${lvlDef.briefingTime}`;
      if (briefingTextEl) briefingTextEl.textContent = lvlDef.briefingText;
      if (briefingCurriculumEl) briefingCurriculumEl.textContent = lvlDef.curriculumRef;
      maskButtons.forEach((b) => {
        const isSel = b.dataset.maskChoice === selectedMask;
        b.className = isSel
          ? 'p-2 text-left border-2 border-cyan-400 bg-cyan-950/70 text-white rounded-0 cursor-pointer flex items-center gap-2.5'
          : 'p-2 text-left border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-pink-500 rounded-0 cursor-pointer flex items-center gap-2.5';
      });
    } else {
      if (briefingOverlay) {
        briefingOverlay.classList.add('hidden');
        briefingOverlay.classList.remove('flex');
      }
      engine.startMission();
      startTurnClockLoop();
      hooks.onMissionStart?.(currentLevelId, selectedMask);
    }

    renderPortraits();
    syncCameraButtons();
    updateUi(engine.getSnapshot(), []);
  };

  const runCode = async (): Promise<void> => {
    audio.unlock();
    if (renderer.getCameraState().mode === 'FREE') {
      renderer.setCameraMode('FOLLOW');
      syncCameraButtons();
    }
    const snapBefore = engine.getSnapshot();
    if (snapBefore.phase === 'BRIEFING') {
      engine.startMission();
      if (briefingOverlay) {
        briefingOverlay.classList.add('hidden');
        briefingOverlay.classList.remove('flex');
      }
      startTurnClockLoop();
    }

    stopExecutionLoop();
    const prep = engine.prepareProgramTurn(codeEditor.value);
    if (!prep.ok) {
      if (errorBox) {
        errorBox.textContent = prep.errors[0].messageRu;
        errorBox.classList.remove('hidden');
      }
      audio.playSfx('error');
      syncGutter(prep.errors[0].line);
      return;
    }

    if (fastAnim) {
      while (true) {
        const step = engine.stepNextAction();
        updateUi(step.snapshot, step.events);
        if (step.openedTerminal) {
          openTerminalModal();
          break;
        }
        if (step.done) {
          resetTurnClock();
          updateUi(step.snapshot, []);
          break;
        }
      }
      return;
    }

    await new Promise<void>((resolve) => {
      const tickFn = () => {
        const step = engine.stepNextAction();
        updateUi(step.snapshot, step.events);
        if (step.openedTerminal) {
          stopExecutionLoop();
          openTerminalModal();
          resolve();
          return;
        }
        if (step.done) {
          stopExecutionLoop();
          resetTurnClock();
          updateUi(step.snapshot, []);
          resolve();
        }
      };
      execTimer = setInterval(tickFn, 145);
      tickFn();
    });
  };

  // Event wiring
  btnStartMission?.addEventListener('click', () => {
    audio.unlock();
    if (briefingOverlay) {
      briefingOverlay.classList.add('hidden');
      briefingOverlay.classList.remove('flex');
    }
    const snap = engine.startMission();
    startTurnClockLoop();
    updateUi(snap, []);
    hooks.onMissionStart?.(currentLevelId, selectedMask);
    codeEditor.focus();
  });

  maskButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.maskChoice as MaskId;
      if (!chosen || !MASK_INFO[chosen]) return;
      selectedMask = chosen;
      loadLevel(currentLevelId, selectedMask, true);
    });
  });

  levelSelect?.addEventListener('change', () => {
    const nxt = parseInt(levelSelect.value, 10) || 1;
    loadLevel(nxt, selectedMask, true);
  });

  btnRun?.addEventListener('click', () => {
    void runCode();
  });

  btnStep?.addEventListener('click', () => {
    audio.unlock();
    const snap = engine.getSnapshot();
    if (snap.phase === 'BRIEFING') engine.startMission();
    const prep = engine.prepareProgramTurn(codeEditor.value);
    if (!prep.ok) {
      if (errorBox) {
        errorBox.textContent = prep.errors[0].messageRu;
        errorBox.classList.remove('hidden');
      }
      return;
    }
    const step = engine.stepNextAction();
    updateUi(step.snapshot, step.events);
    if (step.openedTerminal) openTerminalModal();
  });

  btnReset?.addEventListener('click', () => {
    loadLevel(currentLevelId, selectedMask, false);
  });

  btnRetryLevel?.addEventListener('click', () => {
    loadLevel(currentLevelId, selectedMask, false);
  });

  btnNextLevel?.addEventListener('click', () => {
    const nextLvl = Math.min(5, currentLevelId + 1);
    loadLevel(nextLvl, selectedMask, true);
  });

  btnMute?.addEventListener('click', () => {
    audio.toggleMute();
    updateUi(engine.getSnapshot(), []);
  });

  btnOpenTerm?.addEventListener('click', () => {
    openTerminalModal();
  });

  btnTermClose?.addEventListener('click', () => {
    closeTerminalModal();
  });

  btnTermHint?.addEventListener('click', () => {
    const lvl = HOTLINE_KUMIR_LEVELS.find((l) => l.id === currentLevelId);
    if (lvl) {
      appendTermLine(`[ПОДСКАЗКА]: ${lvl.linuxConfig.hints[0]}`, 'text-amber-300');
    }
  });

  codeEditor.addEventListener('input', () => syncGutter(null));

  codeEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter') {
      e.preventDefault();
      void runCode();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = codeEditor.selectionStart;
      const en = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.slice(0, s) + '  ' + codeEditor.value.slice(en);
      codeEditor.selectionStart = codeEditor.selectionEnd = s + 2;
      syncGutter(null);
      return;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
      const s = codeEditor.selectionStart;
      const before = codeEditor.value.slice(0, s);
      const lineStart = before.lastIndexOf('\n') + 1;
      const curLine = before.slice(lineStart).trim();
      const indentMatch = before.slice(lineStart).match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      let autoClose = '';
      if (/^нц(\s|$)/i.test(curLine)) autoClose = `\n${indent}  \n${indent}кц`;
      else if (/^если\s+.*\s+то$/i.test(curLine)) autoClose = `\n${indent}  \n${indent}все`;
      if (autoClose) {
        e.preventDefault();
        const after = codeEditor.value.slice(codeEditor.selectionEnd);
        codeEditor.value = before + autoClose + after;
        const cursorPos = before.length + 1 + indent.length + 2;
        codeEditor.selectionStart = codeEditor.selectionEnd = cursorPos;
        syncGutter(null);
      }
    }
  });

  termInput?.addEventListener('keydown', (e) => {
    const lx = engine.getLinuxEngine();
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTerminalModal();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = termInput.value;
      termInput.value = '';
      termHistIdx = -1;
      appendTermLine(`${lx.getPrompt()} ${cmd}`, 'text-slate-200');
      const res = engine.execLinuxCommand(cmd);
      if (res.result.clearScreen && termOutputEl) {
        termOutputEl.innerHTML = '';
      } else if (res.result.output) {
        appendTermLine(
          res.result.output,
          res.result.exitCode === 0 ? 'text-emerald-300' : 'text-rose-400'
        );
      }
      if (res.result.objectiveCompletedNow) {
        appendTermLine(
          '[УСПЕХ]: Задача узла выполнена! Закройте терминал и двигайтесь к эвакуации (ВЫХ).',
          'text-cyan-300 font-bold'
        );
      }
      updateUi(res.snapshot, res.events);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = lx.getHistory();
      if (hist.length === 0) return;
      if (termHistIdx === -1) termHistIdx = hist.length - 1;
      else termHistIdx = Math.max(0, termHistIdx - 1);
      termInput.value = hist[termHistIdx] || '';
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = lx.getHistory();
      if (termHistIdx === -1) return;
      termHistIdx++;
      if (termHistIdx >= hist.length) {
        termHistIdx = -1;
        termInput.value = '';
      } else {
        termInput.value = hist[termHistIdx] || '';
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const matches = lx.autocomplete(termInput.value);
      if (matches.length === 1) {
        const parts = termInput.value.split(/\s+/);
        if (parts.length <= 1) {
          termInput.value = matches[0] + ' ';
        } else {
          parts[parts.length - 1] = matches[0];
          termInput.value = parts.join(' ');
        }
      } else if (matches.length > 1) {
        appendTermLine(matches.join('  '), 'text-slate-400');
      }
    }
  });

  btnCamFollow?.addEventListener('click', () => {
    renderer.setCameraMode('FOLLOW');
    syncCameraButtons();
  });

  btnCamOverview?.addEventListener('click', () => {
    renderer.setCameraMode('OVERVIEW');
    syncCameraButtons();
  });

  btnCamZoomIn?.addEventListener('click', () => {
    renderer.zoomBy(1.18);
    syncCameraButtons();
  });

  btnCamZoomOut?.addEventListener('click', () => {
    renderer.zoomBy(0.84);
    syncCameraButtons();
  });

  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const onCanvasPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onCanvasPointerMove = (e: PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      renderer.panBy(dx, dy);
      syncCameraButtons();
    }
    if (tileCoordsEl) {
      const tile = renderer.getHoveredTile(e.clientX, e.clientY);
      const snap = engine.getSnapshot();
      if (tile && tile.x >= 0 && tile.y >= 0 && tile.x < snap.width && tile.y < snap.height) {
        tileCoordsEl.textContent = `x:${tile.x} y:${tile.y}`;
      } else {
        tileCoordsEl.textContent = 'x:— y:—';
      }
    }
  };

  const onCanvasPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore if capture already released
    }
  };

  const onCanvasWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    renderer.zoomBy(e.deltaY < 0 ? 1.12 : 0.89, sx, sy);
    syncCameraButtons();
  };

  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', onCanvasPointerUp);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(canvas.parentElement);
  }

  const globalKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && termOverlay && !termOverlay.classList.contains('hidden')) {
      e.preventDefault();
      closeTerminalModal();
      return;
    }
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const cur = renderer.getCameraState().mode;
      renderer.setCameraMode(cur === 'OVERVIEW' ? 'FOLLOW' : 'OVERVIEW');
      syncCameraButtons();
      return;
    }
    if (e.code === 'KeyM') {
      audio.toggleMute();
      updateUi(engine.getSnapshot(), []);
    } else if (e.code === 'KeyR') {
      loadLevel(currentLevelId, selectedMask, false);
    }
  };
  window.addEventListener('keydown', globalKeyHandler);

  // Test bridge for deterministic Playwright verification
  window.__HOTLINE_KUMIR_TEST__ = {
    getState: () => engine.getSnapshot(),
    getAudioState: () => audio.getAudioState(),
    getRenderStats: () => renderer.getRenderStats(),
    getCameraState: () => renderer.getCameraState(),
    setCameraMode: (mode: CameraMode) => {
      renderer.setCameraMode(mode);
      syncCameraButtons();
    },
    waitForAtlasReady: () => renderer.waitForAtlasReady(),
    flushAnimations: () => renderer.flushAnimations(),
    selectLevel: (id: number, mask?: MaskId) => loadLevel(id, mask ?? selectedMask, false),
    setCode: (code: string) => {
      codeEditor.value = code;
      syncGutter(null);
    },
    runCode: () => runCode(),
    execLinux: (cmd: string) => {
      const res = engine.execLinuxCommand(cmd);
      updateUi(res.snapshot, res.events);
      return {
        output: res.result.output,
        exitCode: res.result.exitCode,
        snapshot: res.snapshot,
      };
    },
    forceTimeout: () => {
      const res = engine.handleTurnTimeout();
      resetTurnClock();
      updateUi(res.snapshot, res.events);
      return res.snapshot;
    },
  };

  loadLevel(initialLevel, selectedMask, !params.has('skipBriefing'));

  return () => {
    stopExecutionLoop();
    stopTurnClock();
    window.removeEventListener('keydown', globalKeyHandler);
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('pointermove', onCanvasPointerMove);
    canvas.removeEventListener('pointerup', onCanvasPointerUp);
    canvas.removeEventListener('pointercancel', onCanvasPointerUp);
    canvas.removeEventListener('wheel', onCanvasWheel);
    resizeObserver?.disconnect();
    renderer.dispose();
    audio.dispose();
  };
}
