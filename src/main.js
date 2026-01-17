const { app, BrowserWindow, ipcMain, Notification, nativeTheme } = require('electron');
const path = require('path');

/**
 * 基础目标：
 * - 默认 20 分钟工作提醒休息
 * - 休息 20 秒
 * - 可调整时长；自动循环
 * - mac/windows 跨平台（Electron）
 * - 休息页面醒目（独立 alwaysOnTop 窗口）
 */

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let breakWindow = null;

const DEFAULT_SETTINGS = {
  workMinutes: 20,
  breakSeconds: 20,
  autoStartNext: true,
};

let settings = { ...DEFAULT_SETTINGS };

let phase = 'work'; // 'work' | 'break'
let running = false;
let remainingMs = settings.workMinutes * 60 * 1000;
let lastTickAt = 0;

function msForPhase(p) {
  if (p === 'work') return settings.workMinutes * 60 * 1000;
  return settings.breakSeconds * 1000;
}

function formatPhaseLabel(p) {
  return p === 'work' ? '工作中' : '休息中';
}

function sendToAllWindows(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.webContents.send(channel, payload);
  }
}

function showNativeNotification(title, body) {
  try {
    new Notification({ title, body, silent: false }).show();
  } catch {
    // 忽略：某些环境下通知权限/实现差异
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    // 主窗口默认加大，保证主界面不需要滚动即可完整看到所有设置
    width: 480,
    height: 860,
    minWidth: 480,
    minHeight: 860,
    resizable: true,
    title: '休息闹钟',
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) return;

  breakWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#ff2d55',
    alwaysOnTop: true,
    fullscreenable: true,
    skipTaskbar: true,
    movable: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  breakWindow.removeMenu();
  breakWindow.loadFile(path.join(__dirname, 'renderer', 'break.html'));

  breakWindow.on('closed', () => {
    breakWindow = null;
  });
}

function openBreakWindow() {
  createBreakWindow();
  if (!breakWindow) return;

  breakWindow.show();
  breakWindow.focus();
  try {
    breakWindow.setAlwaysOnTop(true, 'screen-saver');
    breakWindow.maximize();
  } catch {
    // noop
  }
}

function closeBreakWindow() {
  if (!breakWindow || breakWindow.isDestroyed()) return;
  breakWindow.close();
}

function setPhase(nextPhase) {
  phase = nextPhase;
  remainingMs = msForPhase(phase);

  sendToAllWindows('timer:phase', {
    phase,
    phaseLabel: formatPhaseLabel(phase),
    remainingMs,
    settings,
    running,
  });

  if (phase === 'break') {
    openBreakWindow();
    showNativeNotification('该休息啦', `休息 ${settings.breakSeconds} 秒，放松一下眼睛/颈椎。`);
  } else {
    closeBreakWindow();
    showNativeNotification('休息结束', '开始新一轮专注工作。');
  }

  if (!settings.autoStartNext) {
    running = false;
  }
}

function tick() {
  if (!running) {
    lastTickAt = Date.now();
    return;
  }

  const now = Date.now();
  const delta = Math.max(0, now - lastTickAt);
  lastTickAt = now;

  remainingMs -= delta;
  if (remainingMs <= 0) {
    const next = phase === 'work' ? 'break' : 'work';
    setPhase(next);
    return;
  }

  sendToAllWindows('timer:tick', {
    phase,
    phaseLabel: formatPhaseLabel(phase),
    remainingMs,
    settings,
    running,
  });
}

function start() {
  if (running) return;
  running = true;
  lastTickAt = Date.now();
  sendToAllWindows('timer:running', { running });
}

function pause() {
  if (!running) return;
  running = false;
  sendToAllWindows('timer:running', { running });
}

function reset() {
  pause();
  phase = 'work';
  remainingMs = msForPhase('work');
  closeBreakWindow();
  sendToAllWindows('timer:phase', {
    phase,
    phaseLabel: formatPhaseLabel(phase),
    remainingMs,
    settings,
    running,
  });
}

function updateSettings(next) {
  settings = {
    ...settings,
    ...next,
  };

  // 修正非法值
  settings.workMinutes = Math.min(180, Math.max(1, Number(settings.workMinutes) || DEFAULT_SETTINGS.workMinutes));
  settings.breakSeconds = Math.min(600, Math.max(5, Number(settings.breakSeconds) || DEFAULT_SETTINGS.breakSeconds));
  settings.autoStartNext = Boolean(settings.autoStartNext);

  // 若当前阶段剩余时长超出新时长，直接截断；否则保持进度
  const maxMs = msForPhase(phase);
  remainingMs = Math.min(remainingMs, maxMs);

  sendToAllWindows('settings:updated', { settings });
  sendToAllWindows('timer:tick', {
    phase,
    phaseLabel: formatPhaseLabel(phase),
    remainingMs,
    settings,
    running,
  });
}

app.whenReady().then(() => {
  // 跟随系统暗色模式，让 UI 更舒服
  nativeTheme.themeSource = 'system';

  createMainWindow();

  // 主循环 tick
  setInterval(tick, 200);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 常见行为：不退出；这里为了更符合“闹钟常驻”，也不强制退出。
  // 如果你希望关闭最后一个窗口就退出，可改为：if (process.platform !== 'darwin') app.quit();
  if (process.platform !== 'darwin') app.quit();
});

// IPC
ipcMain.handle('settings:get', async () => {
  return { settings };
});

ipcMain.handle('timer:getState', async () => {
  return {
    settings,
    phase,
    phaseLabel: formatPhaseLabel(phase),
    running,
    remainingMs,
  };
});

ipcMain.handle('settings:update', async (_evt, nextSettings) => {
  updateSettings(nextSettings || {});
  return { settings };
});

ipcMain.handle('timer:start', async () => {
  start();
  return { running };
});

ipcMain.handle('timer:pause', async () => {
  pause();
  return { running };
});

ipcMain.handle('timer:reset', async () => {
  reset();
  return { ok: true };
});

ipcMain.handle('timer:skipToBreak', async () => {
  setPhase('break');
  return { ok: true };
});

ipcMain.handle('timer:skipToWork', async () => {
  setPhase('work');
  return { ok: true };
});
