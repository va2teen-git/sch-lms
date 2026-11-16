/**
 * School LMS — Единый клиентский хелпер телеметрии тренажёров (Issue #566, Этап 0).
 * Подключается через TaskLayout.astro или напрямую: <script src="/static/lms-telemetry.js"></script>
 *
 * Возможности:
 * - Автоматическое управление start_time (старт по первому действию или явному start(), без учёта скрытого монтажа)
 * - Подсчёт time_spent_sec, attempts_count, stage/total_stages, wave/total_waves
 * - Встроенная защита от двойной отправки level_complete
 * - Встроенная AFK-защита для Уровня 3: после 2 подряд таймаутов волны 1 без действий пользователя
 *   останавливает отправку спама и показывает экран/кнопку «Повторить».
 */
(function (global) {
  if (global.LMSTelemetry) return;

  function toPosInt(val) {
    if (val === undefined || val === null || val === '') return null;
    var n = parseInt(String(val), 10);
    return !isNaN(n) && n > 0 ? n : null;
  }

  function inferLevel(missionName, explicitLevel) {
    var lvl = toPosInt(explicitLevel);
    if (lvl && lvl >= 1 && lvl <= 3) return lvl;
    var m = String(missionName || '');
    if (/Уровень\s*1|Ур\s*1/i.test(m)) return 1;
    if (/Уровень\s*2|Ур\s*2/i.test(m)) return 2;
    if (/Уровень\s*3|Ур\s*3|Аркада/i.test(m)) return 3;
    return 1;
  }

  function createTracker(options) {
    var opts = options || {};
    var missionName = String(opts.missionName || opts.mission_name || '').trim();
    var level = inferLevel(missionName, opts.level);
    var defaultTotal = level === 1 ? 3 : (level === 2 ? 5 : 10);

    var initialStage = toPosInt(opts.stage) || 1;
    var totalStages = toPosInt(opts.totalStages || opts.total_stages || opts.totalWaves || opts.total_waves) || defaultTotal;
    var initialWave = level === 3 ? (toPosInt(opts.wave) || 1) : toPosInt(opts.wave);
    var totalWaves = level === 3
      ? (toPosInt(opts.totalWaves || opts.total_waves || opts.totalStages || opts.total_stages) || totalStages)
      : toPosInt(opts.totalWaves || opts.total_waves);

    if (level === 3 && totalWaves) {
      totalStages = totalWaves;
    }

    var afkMaxWave1Timeouts = toPosInt(opts.afkMaxWave1Timeouts) || 2;
    var targetWindow = opts.targetWindow || global.parent || global;

    var state = {
      missionName: missionName,
      level: level,
      started: false,
      startTimeMs: null,
      startTimeIso: null,
      attemptsCount: 0,
      stage: initialStage,
      totalStages: totalStages,
      wave: initialWave,
      totalWaves: totalWaves,
      completedSent: false,
      hasUserActivity: false,
      afkWave1Streak: 0,
      isAfkPaused: false
    };

    var overlayEl = null;
    var activityBound = false;

    function hideAfkOverlay() {
      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
      overlayEl = null;
    }

    function showAfkOverlay() {
      if (typeof document === 'undefined' || !document.body) return;
      if (overlayEl) return;

      var wrap = document.createElement('div');
      wrap.id = 'lms-afk-overlay';
      wrap.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 p-3';
      wrap.style.zIndex = '9999';

      var card = document.createElement('div');
      card.className = 'card bg-white text-dark shadow-lg border-0 p-4 text-center';
      card.style.maxWidth = '420px';
      card.style.width = '100%';

      var title = document.createElement('h4');
      title.className = 'fw-bold mb-2 text-dark';
      title.textContent = 'Пауза из-за бездействия';

      var desc = document.createElement('p');
      desc.className = 'text-secondary mb-4';
      desc.textContent = 'Таймер волны 1 истёк 2 раза подряд без действий. Нажмите «Повторить», чтобы продолжить попытку.';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'lms-afk-retry-btn';
      btn.className = 'btn btn-primary btn-lg fw-semibold px-4';
      btn.textContent = 'Повторить';
      btn.addEventListener('click', function () {
        resumeFromAfk();
      });

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      wrap.appendChild(card);
      document.body.appendChild(wrap);
      overlayEl = wrap;
    }

    function start() {
      if (!state.started) {
        state.started = true;
        state.startTimeMs = Date.now();
        state.startTimeIso = new Date(state.startTimeMs).toISOString();
      }
      state.isAfkPaused = false;
      return state.startTimeIso;
    }

    function resetTimer() {
      state.started = true;
      state.startTimeMs = Date.now();
      state.startTimeIso = new Date(state.startTimeMs).toISOString();
      return state.startTimeIso;
    }

    function markActivity() {
      if (!state.started) {
        start();
      }
      state.hasUserActivity = true;
      state.afkWave1Streak = 0;
    }

    function onActivityEvent() {
      if (state.isAfkPaused) return;
      markActivity();
    }

    function bindActivity() {
      if (activityBound || typeof document === 'undefined') return;
      activityBound = true;
      document.addEventListener('pointerdown', onActivityEvent, { passive: true, capture: true });
      document.addEventListener('keydown', onActivityEvent, { passive: true, capture: true });
    }

    function destroy() {
      if (activityBound && typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', onActivityEvent, { capture: true });
        document.removeEventListener('keydown', onActivityEvent, { capture: true });
        activityBound = false;
      }
      hideAfkOverlay();
    }

    if (opts.autoBindActivity !== false) {
      bindActivity();
    }

    function getTimeSpentSec() {
      if (!state.started || state.startTimeMs === null) return 0;
      return Math.max(0, Math.round((Date.now() - state.startTimeMs) / 1000));
    }

    function postEvent(payload) {
      try {
        if (targetWindow && typeof targetWindow.postMessage === 'function') {
          targetWindow.postMessage(payload, '*');
          return true;
        }
      } catch (e) {}
      return false;
    }

    function buildPayload(actionType, extra) {
      var ext = extra || {};
      if (!state.started && ext.start_time === undefined) {
        start();
      }
      var timeSpent = typeof ext.time_spent_sec === 'number'
        ? Math.max(0, Math.round(ext.time_spent_sec))
        : getTimeSpentSec();
      if (actionType === 'level_complete' && timeSpent < 1) {
        timeSpent = 1;
      }

      var stageVal = toPosInt(ext.stage) || state.stage;
      var totalStagesVal = toPosInt(ext.total_stages || ext.totalStages) || state.totalStages;
      var waveVal = toPosInt(ext.wave) || (state.level === 3 ? (state.wave || stageVal) : state.wave);
      var totalWavesVal = toPosInt(ext.total_waves || ext.totalWaves) || state.totalWaves;

      var payload = {
        type: 'TELEMETRY_EVENT',
        mission_name: ext.mission_name || state.missionName,
        action_type: actionType,
        status: ext.status || (actionType === 'level_complete' ? 'completed' : (actionType === 'in_progress' ? 'in_progress' : 'failed')),
        start_time: ext.start_time || state.startTimeIso || new Date().toISOString(),
        time_spent_sec: timeSpent,
        attempts_count: typeof ext.attempts_count === 'number' ? ext.attempts_count : state.attemptsCount,
        success: ext.success !== undefined ? Boolean(ext.success) : actionType === 'level_complete',
        stage: stageVal,
        total_stages: totalStagesVal
      };

      if (waveVal) {
        payload.wave = waveVal;
      }
      if (totalWavesVal) {
        payload.total_waves = totalWavesVal;
      }

      var logArr = ext.action_log;
      if (logArr === undefined) {
        var entry = {
          time: new Date().toISOString(),
          action: ext.logAction || actionType,
          stage: stageVal,
          total_stages: totalStagesVal
        };
        if (waveVal) entry.wave = waveVal;
        if (totalWavesVal) entry.total_waves = totalWavesVal;
        logArr = [entry];
      }
      payload.action_log = logArr;

      return payload;
    }

    function send(actionType, extra) {
      if (actionType === 'level_complete') {
        return complete(extra);
      }
      var payload = buildPayload(actionType, extra);
      postEvent(payload);
      return payload;
    }

    function setStage(nextStage, nextTotal) {
      var s = toPosInt(nextStage);
      var t = toPosInt(nextTotal);
      if (s) state.stage = s;
      if (t) state.totalStages = t;
    }

    function setWave(nextWave, nextTotal) {
      var w = toPosInt(nextWave);
      var t = toPosInt(nextTotal);
      if (w) {
        state.wave = w;
        if (state.level === 3) state.stage = w;
      }
      if (t) {
        state.totalWaves = t;
        if (state.level === 3) state.totalStages = t;
      }
    }

    function advanceStage(nextStage, extra) {
      markActivity();
      setStage(nextStage, extra && (extra.total_stages || extra.totalStages));
      return send('in_progress', Object.assign({ status: 'in_progress' }, extra || {}, {
        stage: state.stage,
        total_stages: state.totalStages
      }));
    }

    function advanceWave(nextWave, extra) {
      markActivity();
      setWave(nextWave, extra && (extra.total_waves || extra.totalWaves));
      return send('in_progress', Object.assign({ status: 'wave_complete' }, extra || {}, {
        stage: state.stage,
        total_stages: state.totalStages,
        wave: state.wave,
        total_waves: state.totalWaves
      }));
    }

    function progress(extra) {
      return send('in_progress', Object.assign({ status: 'in_progress' }, extra || {}));
    }

    function fail(extra) {
      var ext = extra || {};
      var actionType = ext.actionType || ext.action_type || 'hardcore_reset';
      var currentWave = toPosInt(ext.wave) || state.wave || 1;
      var currentStage = toPosInt(ext.stage) || (state.level === 3 ? currentWave : state.stage);

      if (state.level === 3 && currentWave <= 1 && (ext.isTimeout || !state.hasUserActivity)) {
        state.afkWave1Streak += 1;
        state.hasUserActivity = false;
        if (state.afkWave1Streak >= afkMaxWave1Timeouts) {
          state.isAfkPaused = true;
          var shouldShowOverlay = opts.showAfkOverlay !== undefined
            ? Boolean(opts.showAfkOverlay)
            : typeof opts.onAfkStop !== 'function';
          if (shouldShowOverlay) {
            showAfkOverlay();
          }
          if (typeof opts.onAfkStop === 'function') {
            try {
              opts.onAfkStop({ streak: state.afkWave1Streak, resume: resumeFromAfk });
            } catch (e) {}
          }
          return false;
        }
      } else {
        if (currentWave > 1) {
          state.afkWave1Streak = 0;
        }
        state.hasUserActivity = false;
      }

      if (ext.incrementAttempts !== false) {
        state.attemptsCount += 1;
      }

      var payload = buildPayload(actionType, Object.assign({}, ext, {
        stage: currentStage,
        wave: state.level === 3 ? currentWave : ext.wave,
        success: false,
        status: ext.status || 'failed'
      }));
      postEvent(payload);
      return payload;
    }

    function hardcoreReset(extra) {
      return fail(Object.assign({}, extra || {}, { actionType: 'hardcore_reset' }));
    }

    function levelFail(extra) {
      return fail(Object.assign({}, extra || {}, { actionType: 'level_fail' }));
    }

    function complete(extra) {
      if (state.completedSent) return false;
      state.completedSent = true;
      var ext = extra || {};
      var finalStage = toPosInt(ext.stage) || state.totalStages || state.stage;
      var finalWave = state.level === 3
        ? (toPosInt(ext.wave) || state.totalWaves || state.wave)
        : toPosInt(ext.wave);

      state.stage = finalStage;
      if (finalWave) state.wave = finalWave;

      var payload = buildPayload('level_complete', Object.assign({}, ext, {
        status: 'completed',
        success: true,
        stage: finalStage,
        total_stages: state.totalStages,
        wave: finalWave,
        total_waves: state.totalWaves
      }));
      postEvent(payload);
      return payload;
    }

    function resumeFromAfk() {
      state.afkWave1Streak = 0;
      state.isAfkPaused = false;
      state.hasUserActivity = true;
      hideAfkOverlay();
      resetTimer();
      if (typeof opts.onAfkRetry === 'function') {
        try {
          opts.onAfkRetry();
        } catch (e) {}
      }
      if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        global.dispatchEvent(new CustomEvent('lms-telemetry:afk-retry', { detail: { missionName: state.missionName } }));
      }
    }

    function reset(resetOpts) {
      var r = resetOpts || {};
      state.started = false;
      state.startTimeMs = null;
      state.startTimeIso = null;
      state.attemptsCount = 0;
      state.stage = initialStage;
      state.wave = initialWave;
      state.hasUserActivity = false;
      state.afkWave1Streak = 0;
      state.isAfkPaused = false;
      if (r.allowRecomplete) {
        state.completedSent = false;
      }
      hideAfkOverlay();
    }

    function getState() {
      return {
        missionName: state.missionName,
        level: state.level,
        started: state.started,
        startTimeIso: state.startTimeIso,
        timeSpentSec: getTimeSpentSec(),
        attemptsCount: state.attemptsCount,
        stage: state.stage,
        totalStages: state.totalStages,
        wave: state.wave,
        totalWaves: state.totalWaves,
        completedSent: state.completedSent,
        hasUserActivity: state.hasUserActivity,
        afkWave1Streak: state.afkWave1Streak,
        isAfkPaused: state.isAfkPaused
      };
    }

    return {
      start: start,
      resetTimer: resetTimer,
      markActivity: markActivity,
      getTimeSpentSec: getTimeSpentSec,
      setStage: setStage,
      setWave: setWave,
      advanceStage: advanceStage,
      advanceWave: advanceWave,
      progress: progress,
      fail: fail,
      hardcoreReset: hardcoreReset,
      levelFail: levelFail,
      complete: complete,
      send: send,
      resumeFromAfk: resumeFromAfk,
      reset: reset,
      destroy: destroy,
      getState: getState
    };
  }

  var api = {
    version: '1.0.0',
    create: createTracker,
    init: createTracker
  };

  global.LMSTelemetry = api;
  global.LmsTelemetry = api;
})(typeof window !== 'undefined' ? window : globalThis);
