function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function setRingProgress(el, progress01) {
  const p = clamp(progress01, 0, 1);
  el.style.setProperty('--p', String(p));
}

function saveLocalSettings(s) {
  localStorage.setItem('alarmSettings', JSON.stringify(s));
}

function loadLocalSettings() {
  try {
    const raw = localStorage.getItem('alarmSettings');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const els = {
  phaseBadge: document.getElementById('phaseBadge'),
  timeText: document.getElementById('timeText'),
  subText: document.getElementById('subText'),
  ring: document.getElementById('ring'),
  btnStart: document.getElementById('btnStart'),
  btnPause: document.getElementById('btnPause'),
  btnReset: document.getElementById('btnReset'),
  btnSkipBreak: document.getElementById('btnSkipBreak'),
  btnSkipWork: document.getElementById('btnSkipWork'),
  workMinutes: document.getElementById('workMinutes'),
  breakSeconds: document.getElementById('breakSeconds'),
  autoStartNext: document.getElementById('autoStartNext'),
  btnSave: document.getElementById('btnSave'),
  savedHint: document.getElementById('savedHint'),
};

let current = {
  phase: 'work',
  running: false,
  remainingMs: 0,
  settings: { workMinutes: 20, breakSeconds: 20, autoStartNext: true },
};

function totalMsForPhase(phase, settings) {
  return phase === 'work' ? settings.workMinutes * 60 * 1000 : settings.breakSeconds * 1000;
}

function render(payload) {
  current = {
    ...current,
    ...payload,
  };

  const { phase, running, remainingMs, settings } = current;
  els.phaseBadge.textContent = phase === 'work' ? '工作中' : '休息中';
  els.phaseBadge.classList.toggle('is-break', phase === 'break');
  els.timeText.textContent = formatRemaining(remainingMs);
  els.subText.textContent =
    phase === 'work'
      ? '保持专注，别忘了抬头放松'
      : '休息倒计时（也会弹出醒目提醒页）';

  const total = totalMsForPhase(phase, settings);
  const progress = total <= 0 ? 0 : 1 - remainingMs / total;
  setRingProgress(els.ring, progress);

  els.btnStart.disabled = running;
  els.btnPause.disabled = !running;

  // settings form
  els.workMinutes.value = String(settings.workMinutes);
  els.breakSeconds.value = String(settings.breakSeconds);
  els.autoStartNext.checked = Boolean(settings.autoStartNext);
}

function flashSaved() {
  els.savedHint.style.opacity = '1';
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => {
    els.savedHint.style.opacity = '0';
  }, 900);
}

async function init() {
  // 先用本地持久化覆盖默认值，再同步给主进程
  const local = loadLocalSettings();
  if (local) {
    await window.alarmApi.updateSettings(local);
  }

  const st = await window.alarmApi.getState();
  render(st);
}

// events
els.btnStart.addEventListener('click', async () => {
  await window.alarmApi.start();
});
els.btnPause.addEventListener('click', async () => {
  await window.alarmApi.pause();
});
els.btnReset.addEventListener('click', async () => {
  await window.alarmApi.reset();
});
els.btnSkipBreak.addEventListener('click', async () => {
  await window.alarmApi.skipToBreak();
});
els.btnSkipWork.addEventListener('click', async () => {
  await window.alarmApi.skipToWork();
});

els.btnSave.addEventListener('click', async () => {
  const next = {
    workMinutes: Number(els.workMinutes.value),
    breakSeconds: Number(els.breakSeconds.value),
    autoStartNext: Boolean(els.autoStartNext.checked),
  };
  saveLocalSettings(next);
  await window.alarmApi.updateSettings(next);
  flashSaved();
});

// ipc push updates
window.alarmApi.onTick((payload) => render(payload));
window.alarmApi.onPhase((payload) => render(payload));
window.alarmApi.onRunning((payload) => render(payload));
window.alarmApi.onSettingsUpdated(({ settings }) => {
  render({ settings });
});

init();

