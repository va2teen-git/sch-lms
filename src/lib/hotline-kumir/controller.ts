import { HOTLINE_KUMIR_LEVELS } from '../../data/hotline-kumir-levels.ts';
import { HotlineAudioSynth } from './audio-synth.ts';
import type { CameraMode } from './camera.ts';
import { HotlineGameEngine } from './game-engine.ts';
import { KUMIR_HELP_SECTIONS, resolveHelpSectionId } from './kumir-help.ts';
import { HotlineCanvasRenderer } from './renderer.ts';
import { CyberTerminalView } from '../terminal/cyber-terminal-view.ts';
import type { LevelResult, MaskId, WorldEvent, WorldSnapshot } from './types.ts';

declare global {
  interface Window {
    __HOTLINE_KUMIR_TEST__?: {
      getState: () => WorldSnapshot;
      getAudioState: () => ReturnType<HotlineAudioSynth['getAudioState']>;
      getRenderStats: () => ReturnType<HotlineCanvasRenderer['getRenderStats']>;
      getCameraState: () => ReturnType<HotlineCanvasRenderer['getCameraState']>;
      getGbrAnimationState: () => ReturnType<HotlineCanvasRenderer['getGbrAnimationState']>;
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
  initialLevel?: number;
  initialMask?: MaskId;
  loadSavedProgress?: () => Promise<{
    currentLevel: number;
    completedCount: number;
    campaignCompleted: boolean;
    selectedMask?: MaskId;
  } | null>;
  onLevelChange?: (levelId: number, mask: MaskId) => void;
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
  const initialLevel = Math.min(5, Math.max(1, hooks.initialLevel ?? 1));
  const initialMaskParam = params.get('mask') as MaskId | null;
  let selectedMask: MaskId =
    initialMaskParam && MASK_INFO[initialMaskParam]
      ? initialMaskParam
      : hooks.initialMask && MASK_INFO[hooks.initialMask]
        ? hooks.initialMask
        : 'richard';
  const baseSeed = parseInt(params.get('seed') || '1337', 10) || 1337;
  const fastAnim = params.get('fastAnim') === '1';
  const forceMute = params.get('mute') === '1';

  const canvas = root.querySelector<HTMLCanvasElement>('#hk-arena-canvas');
  const codeEditor = root.querySelector<HTMLTextAreaElement>('#hk-code-editor');
  const gutterEl = root.querySelector<HTMLPreElement>('#hk-line-gutter');
  const errorBox = root.querySelector<HTMLDivElement>('#hk-error-box');
  const missionDescEl = root.querySelector<HTMLElement>('#hk-mission-desc');
  const missionObjectivesEl = root.querySelector<HTMLUListElement>('#hk-mission-objectives');
  const intelBoxEl = root.querySelector<HTMLDivElement>('#hk-intel-box');
  const hoverInfoEl = root.querySelector<HTMLElement>('#hk-hover-info');

  const helpOverlay = root.querySelector<HTMLDivElement>('#hk-help-overlay');
  const helpContentEl = root.querySelector<HTMLDivElement>('#hk-help-content');
  const btnHelpClose = root.querySelector<HTMLButtonElement>('#hk-help-close');

  const levelBadgeEl = root.querySelector<HTMLElement>('#hk-level-badge');
  const campaignBadgeEl = root.querySelector<HTMLElement>('#hk-campaign-badge');
  const maskLabelEl = root.querySelector<HTMLElement>('#hk-mask-badge');
  const phaseBadgeEl = root.querySelector<HTMLElement>('#hk-phase-badge');
  const turnTimerEl = root.querySelector<HTMLElement>('#hk-turn-timer');
  const etaTrackerEl = root.querySelector<HTMLElement>('#hk-gbr-tracker');
  const etaTextEl = root.querySelector<HTMLElement>('#hk-gbr-eta-text');
  const gbrVanMarkerEl = root.querySelector<HTMLElement>('#hk-gbr-van-marker');
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
  const termWindowEl = root.querySelector<HTMLElement>('#hk-term-window');
  const termTitleEl = root.querySelector<HTMLElement>('#hk-term-title');
  const termOutputEl = root.querySelector<HTMLPreElement>('#hk-term-output');
  const termPromptEl = root.querySelector<HTMLElement>('#hk-term-prompt');
  const termInput = root.querySelector<HTMLInputElement>('#hk-term-input');
  const termHeaderStatus = root.querySelector<HTMLElement>('#hk-term-perimeter');
  const btnTermClose = root.querySelector<HTMLButtonElement>('#hk-term-close');
  const btnTermHint = root.querySelector<HTMLButtonElement>('#hk-term-hint');

  const termView = new CyberTerminalView({
    windowEl: termWindowEl,
    outputEl: termOutputEl,
    inputEl: termInput,
    promptEl: termPromptEl,
    titleEl: termTitleEl,
  });

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
  let missionReported = false;
  let alertReported = false;
  let campaignCompleted = false;
  let levelOverriddenByTest = false;

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

  const renderHelpSections = (targetSectionId: string | null) => {
    if (!helpContentEl) return;
    helpContentEl.innerHTML = '';
    for (const sec of KUMIR_HELP_SECTIONS) {
      const card = document.createElement('section');
      card.dataset.helpSection = sec.id;
      const isTarget = targetSectionId === sec.id;
      card.className = `bg-[#090414] border ${isTarget ? 'border-amber-400 ring-1 ring-amber-400' : sec.accent.split(' ')[1] || 'border-slate-700'} p-3 space-y-2 rounded-0`;

      const heading = document.createElement('h3');
      heading.className = `text-xs font-black uppercase ${sec.accent.split(' ')[0] || 'text-cyan-300'}`;
      heading.textContent = sec.title;
      card.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'space-y-1.5';
      for (const entry of sec.entries) {
        const row = document.createElement('div');
        row.className = 'border-t border-slate-800/80 pt-1.5 first:border-t-0 first:pt-0';
        const syn = document.createElement('div');
        syn.className = 'font-bold text-cyan-200';
        syn.textContent = entry.syntax;
        const desc = document.createElement('div');
        desc.className = 'text-[11px] text-slate-300';
        desc.textContent = entry.desc;
        row.appendChild(syn);
        row.appendChild(desc);
        if (entry.example) {
          const ex = document.createElement('pre');
          ex.className = 'mt-1 px-2 py-1 bg-black border border-slate-800 text-[11px] text-emerald-300 whitespace-pre-wrap';
          ex.textContent = entry.example;
          row.appendChild(ex);
        }
        list.appendChild(row);
      }
      card.appendChild(list);
      helpContentEl.appendChild(card);
    }

    if (targetSectionId) {
      const targetEl = helpContentEl.querySelector<HTMLElement>(`[data-help-section="${targetSectionId}"]`);
      targetEl?.scrollIntoView?.({ block: 'start' });
    } else {
      helpContentEl.scrollTop = 0;
    }
  };

  const openHelpModal = (topic?: string) => {
    const targetId = resolveHelpSectionId(topic);
    renderHelpSections(targetId);
    if (helpOverlay) {
      helpOverlay.classList.remove('hidden');
      helpOverlay.classList.add('flex');
    }
  };

  const closeHelpModal = () => {
    if (helpOverlay) {
      helpOverlay.classList.add('hidden');
      helpOverlay.classList.remove('flex');
    }
    codeEditor.focus();
  };

  const syncTerminalHeader = (snap: WorldSnapshot) => {
    const prompt = engine.getLinuxEngine().getPrompt();
    termView.setPrompt(prompt);
    termView.setTitle(`${prompt.replace(/>$/, '')} — bash`);
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
      termView.appendLine(
        `// terminal://cyber-boy — узел уровня ${snap.levelId}. Введите «help» или «ls -la».`,
        'info',
        'ct-boot'
      );
    }
    setTimeout(() => termView.focus(), 20);
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
      else if (ev.type === 'TERMINAL_HACKED' || ev.type === 'DOOR_OPENED' || ev.type === 'OBJECT_INSPECTED')
        audio.playSfx('terminal_ok');
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
          ? 'px-2 py-0.5 font-mono text-base font-black bg-red-950 border-2 border-red-500 text-red-400 rounded-0'
          : snap.alarmTriggered
            ? 'px-2 py-0.5 font-mono text-base font-black bg-pink-950 border-2 border-pink-500 text-pink-300 rounded-0'
            : 'px-2 py-0.5 font-mono text-base font-black bg-slate-950 border-2 border-cyan-400 text-cyan-300 rounded-0';
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
          ? 'ГБР ПРОРВАЛСЯ ЧЕРЕЗ ГЛАВНЫЙ ВХОД! УХОДИТЕ В ЗАПАСНОЙ ВЫХОД (ВЫХ)'
          : `ГБР ПРИБУДЕТ ЧЕРЕЗ: ${snap.gbrEtaTurns} ХОД. (${snap.gbrEtaSec} С)`;
        const progressIdx = snap.gbrSpawned
          ? 4
          : Math.min(3, Math.max(0, Math.floor(((snap.gbrEtaMaxTurns - snap.gbrEtaTurns) / Math.max(1, snap.gbrEtaMaxTurns)) * 4)));
        if (gbrVanMarkerEl) {
          const pct = snap.gbrSpawned
            ? 85
            : Math.min(
                82,
                Math.max(
                  4,
                  Math.round(((snap.gbrEtaMaxTurns - snap.gbrEtaTurns) / Math.max(1, snap.gbrEtaMaxTurns)) * 82)
                )
              );
          gbrVanMarkerEl.style.left = `${pct}%`;
        }
        etaSegs.forEach((seg, idx) => {
          seg.className =
            idx <= progressIdx
              ? 'px-1.5 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white border border-red-300 rounded-0'
              : 'px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-700 rounded-0';
        });
      } else {
        etaTrackerEl.classList.add('hidden');
        if (gbrVanMarkerEl) gbrVanMarkerEl.style.left = '0%';
      }
    }

    if (campaignBadgeEl) {
      if (campaignCompleted) campaignBadgeEl.classList.remove('hidden');
      else campaignBadgeEl.classList.add('hidden');
    }

    if (statusObjEl) {
      const hackTxt = snap.hackCompleted ? 'ПК: ВЗЛОМАН ✓' : 'ПК: ЗАКРЫТ';
      const paintTxt = `МЕТКИ (*): ${snap.paintedCount}/${snap.requiredPaintCount}`;
      const exitTxt = snap.exitUnlocked ? 'ВЫХОД: ОТКРЫТ → E' : 'ВЫХОД: ЗАБЛОКИРОВАН';
      statusObjEl.textContent = `${hackTxt}  |  ${paintTxt}  |  ${exitTxt}`;
    }

    if (missionDescEl) {
      missionDescEl.textContent = snap.missionSummary;
    }

    if (missionObjectivesEl) {
      missionObjectivesEl.innerHTML = '';
      const rows: Array<{ done: boolean; text: string; tone?: string }> = [
        {
          done: snap.hackCompleted,
          text: snap.hackCompleted
            ? '✓ Взломан служебный ПК (T)'
            : '○ Подойти к ПК (T) и ввести «подключиться»',
        },
        {
          done: snap.paintedCount >= snap.requiredPaintCount,
          text:
            snap.paintedCount >= snap.requiredPaintCount
              ? `✓ ЭМИ-реле (*): ${snap.paintedCount}/${snap.requiredPaintCount}`
              : `○ ЭМИ-реле (*): ${snap.paintedCount}/${snap.requiredPaintCount} — команда «пометить»`,
        },
      ];
      if (snap.interactables.length > 0) {
        const reqDone =
          snap.requiredInteractableCount > 0 &&
          snap.interactables.filter((i) => i.required && i.inspected).length >= snap.requiredInteractableCount;
        rows.push({
          done: reqDone,
          text:
            snap.requiredInteractableCount > 0
              ? `○ Собрать улики [?]: ${snap.inspectedCount}/${snap.requiredInteractableCount} («осмотреть»)`
              : `• Объекты интерьера [?]: ${snap.inspectedCount}/${snap.interactables.length} («осмотреть»)`,
          tone: 'text-amber-300',
        });
      }
      rows.push({
        done: snap.exitUnlocked && snap.phase === 'EXTRACTION',
        text: snap.exitUnlocked
          ? '✓ Запасной выход (E) открыт — двигайся к эвакуации'
          : '○ Запасной выход (E) откроется после выполнения целей',
      });
      for (const r of rows) {
        const li = document.createElement('li');
        li.className = r.done ? 'text-emerald-300 font-bold' : r.tone || 'text-slate-300';
        li.textContent = r.text;
        missionObjectivesEl.appendChild(li);
      }
    }

    if (intelBoxEl) {
      if (snap.lastInspectMessage) {
        const extra = snap.collectedIntel.length > 1 ? ` (улик: ${snap.collectedIntel.length})` : '';
        intelBoxEl.textContent = `УЛИКА: ${snap.lastInspectMessage}${extra}`;
        intelBoxEl.classList.remove('hidden');
      } else {
        intelBoxEl.textContent = '';
        intelBoxEl.classList.add('hidden');
      }
    }

    if (errorBox) {
      if (snap.lastError) {
        errorBox.textContent = snap.lastError.messageRu;
        errorBox.classList.remove('hidden');
      } else if (!errorBox.textContent?.includes('Вставка отключена')) {
        errorBox.classList.add('hidden');
      }
    }

    syncTerminalHeader(snap);

    if (snap.alarmTriggered && !alertReported) {
      alertReported = true;
      hooks.onAlertTriggered?.(snap.levelId, snap.alarmReason || 'Тревога периметра');
    }

    if (snap.phase === 'EXTRACTION' && snap.lastResult) {
      if (snap.lastResult.levelId >= 5) {
        campaignCompleted = true;
      }
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
        execTimer !== null ||
        (helpOverlay && !helpOverlay.classList.contains('hidden')) ||
        (termOverlay && !termOverlay.classList.contains('hidden'))
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

    if (levelBadgeEl) levelBadgeEl.textContent = `Ур.${lvlDef.id}/5: ${lvlDef.title}`;
    codeEditor.value = lvlDef.starterCode;
    termView.clear();
    if (termOverlay) {
      termOverlay.classList.add('hidden');
      termOverlay.classList.remove('flex');
    }
    if (helpOverlay) {
      helpOverlay.classList.add('hidden');
      helpOverlay.classList.remove('flex');
    }
    if (resultOverlay) {
      resultOverlay.classList.add('hidden');
      resultOverlay.classList.remove('flex');
    }

    resetTurnClock();
    hooks.onLevelChange?.(levelId, mask);

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
        if (step.openedHelp) {
          openHelpModal(step.helpTopic);
          break;
        }
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
        if (step.openedHelp) {
          stopExecutionLoop();
          openHelpModal(step.helpTopic);
          resolve();
          return;
        }
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
    if (step.openedHelp) openHelpModal(step.helpTopic);
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

  btnHelpClose?.addEventListener('click', () => {
    closeHelpModal();
  });

  btnTermHint?.addEventListener('click', () => {
    const lvl = HOTLINE_KUMIR_LEVELS.find((l) => l.id === currentLevelId);
    if (lvl) {
      termView.appendLine(`[ПОДСКАЗКА]: ${lvl.linuxConfig.hints[0]}`, 'warn');
    }
  });

  const blockPasteOrDrop = (e: Event) => {
    e.preventDefault();
    audio.unlock();
    audio.playSfx('error');
    if (errorBox) {
      errorBox.textContent = 'Вставка отключена — вводи команды алгоритма вручную с клавиатуры!';
      errorBox.classList.remove('hidden');
    }
  };
  codeEditor.addEventListener('paste', blockPasteOrDrop);
  codeEditor.addEventListener('drop', blockPasteOrDrop);

  codeEditor.addEventListener('input', () => {
    if (errorBox && errorBox.textContent?.includes('Вставка отключена')) {
      errorBox.classList.add('hidden');
    }
    syncGutter(null);
  });

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
  });

  const unbindTerminal = termView.bindInteractive({
    onEscape: () => closeTerminalModal(),
    getPrompt: () => engine.getLinuxEngine().getPrompt(),
    getHistory: () => engine.getLinuxEngine().getHistory(),
    autocomplete: (val) => engine.getLinuxEngine().autocomplete(val),
    onCommand: (cmd) => {
      const lx = engine.getLinuxEngine();
      termView.appendCommand(lx.getPrompt(), cmd);
      const res = engine.execLinuxCommand(cmd);
      if (res.result.clearScreen) {
        termView.clear();
      } else if (res.result.output) {
        termView.appendLine(res.result.output, res.result.exitCode === 0 ? 'ok' : 'err');
        if (res.result.exitCode !== 0) {
          termView.flashError();
        }
      }
      if (res.result.objectiveCompletedNow) {
        termView.appendLine(
          '[УСПЕХ]: Задача узла выполнена! Закройте терминал и двигайтесь к эвакуации (ВЫХ).',
          'accent'
        );
      }
      updateUi(res.snapshot, res.events);
    },
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
    const rawTile = renderer.getHoveredTile(e.clientX, e.clientY);
    const snap = engine.getSnapshot();
    const validTile =
      rawTile && rawTile.x >= 0 && rawTile.y >= 0 && rawTile.x < snap.width && rawTile.y < snap.height
        ? rawTile
        : null;
    renderer.setHoveredTile(validTile);

    if (tileCoordsEl) {
      tileCoordsEl.textContent = validTile ? `x:${validTile.x} y:${validTile.y}` : 'x:— y:—';
    }
    if (hoverInfoEl) {
      if (!validTile) {
        hoverInfoEl.textContent = 'Наведи на объект';
      } else {
        const obj = snap.interactables.find((item) => item.x === validTile.x && item.y === validTile.y);
        const door = snap.doors.find((d) => d.x === validTile.x && d.y === validTile.y);
        const cam = snap.cameras.find((c) => c.x === validTile.x && c.y === validTile.y);
        const enemy = snap.enemies.find((en) => en.x === validTile.x && en.y === validTile.y && en.status !== 'offline');
        const t = snap.tiles[validTile.y][validTile.x];
        if (obj) {
          hoverInfoEl.textContent = obj.inspected ? `${obj.name} (осмотрено ✓)` : `${obj.name} → «осмотреть»`;
        } else if (t === 'TERMINAL') {
          hoverInfoEl.textContent = snap.hackCompleted ? 'Служебный ПК (взломан ✓)' : 'Служебный ПК → «подключиться»';
        } else if (t === 'RELAY') {
          hoverInfoEl.textContent = 'ЭМИ-реле (*) → «пометить»';
        } else if (t === 'COVER') {
          hoverInfoEl.textContent = 'Укрытие (C) → «укрыться»';
        } else if (t === 'EXIT') {
          hoverInfoEl.textContent = snap.exitUnlocked
            ? 'Запасная дверь (выход) открыта!'
            : 'Запасная дверь (выход) — заблокирована';
        } else if (t === 'GBR_SPAWN') {
          hoverInfoEl.textContent = 'Главный вход (дверь штурма ГБР)';
        } else if (door) {
          hoverInfoEl.textContent = door.open ? 'Проход открыт' : 'Электродверь (D) → ПК или «выбить дверь»';
        } else if (cam) {
          hoverInfoEl.textContent = cam.enabled ? 'Камера (K) → «отключить»' : 'Камера отключена';
        } else if (enemy) {
          hoverInfoEl.textContent =
            enemy.status === 'stunned' ? 'Оглушён → «обезвредить»' : 'Охрана → «бросить» / «оглушить»';
        } else if (t === 'WALL' || t === 'WINDOW') {
          hoverInfoEl.textContent = t === 'WINDOW' ? 'Стеклянная витрина' : 'Стена';
        } else {
          hoverInfoEl.textContent = 'Проходимая клетка';
        }
      }
    }
  };

  const onCanvasPointerLeave = () => {
    renderer.setHoveredTile(null);
    if (tileCoordsEl) tileCoordsEl.textContent = 'x:— y:—';
    if (hoverInfoEl) hoverInfoEl.textContent = 'Наведи на объект';
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
  canvas.addEventListener('pointerleave', onCanvasPointerLeave);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(canvas.parentElement);
  }

  const globalKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && helpOverlay && !helpOverlay.classList.contains('hidden')) {
      e.preventDefault();
      closeHelpModal();
      return;
    }
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
    getGbrAnimationState: () => renderer.getGbrAnimationState(),
    setCameraMode: (mode: CameraMode) => {
      renderer.setCameraMode(mode);
      syncCameraButtons();
    },
    waitForAtlasReady: () => renderer.waitForAtlasReady(),
    flushAnimations: () => renderer.flushAnimations(),
    selectLevel: (id: number, mask?: MaskId) => {
      levelOverriddenByTest = true;
      loadLevel(id, mask ?? selectedMask, false);
    },
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

  if (hooks.loadSavedProgress) {
    void hooks.loadSavedProgress().then((saved) => {
      if (!saved || levelOverriddenByTest) return;
      campaignCompleted = Boolean(saved.campaignCompleted);
      const snap = engine.getSnapshot();
      const untouched =
        snap.player.stepsTaken === 0 &&
        !snap.alarmTriggered &&
        !snap.hackCompleted &&
        snap.paintedCount === 0;
      if (!untouched) {
        updateUi(snap, []);
        return;
      }
      const targetLevel = Math.min(5, Math.max(1, saved.currentLevel || 1));
      const targetMask =
        !initialMaskParam && saved.selectedMask && MASK_INFO[saved.selectedMask]
          ? saved.selectedMask
          : selectedMask;
      if (targetLevel !== currentLevelId || targetMask !== selectedMask) {
        loadLevel(targetLevel, targetMask, !params.has('skipBriefing'));
      } else {
        updateUi(snap, []);
      }
    });
  }

  return () => {
    stopExecutionLoop();
    stopTurnClock();
    window.removeEventListener('keydown', globalKeyHandler);
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('pointermove', onCanvasPointerMove);
    canvas.removeEventListener('pointerup', onCanvasPointerUp);
    canvas.removeEventListener('pointercancel', onCanvasPointerUp);
    canvas.removeEventListener('pointerleave', onCanvasPointerLeave);
    canvas.removeEventListener('wheel', onCanvasWheel);
    codeEditor.removeEventListener('paste', blockPasteOrDrop);
    codeEditor.removeEventListener('drop', blockPasteOrDrop);
    unbindTerminal();
    resizeObserver?.disconnect();
    renderer.dispose();
    audio.dispose();
  };
}
