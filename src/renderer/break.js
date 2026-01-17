function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

const breakTime = document.getElementById('breakTime');
const btnEnd = document.getElementById('btnEnd');

function render(payload) {
  if (!payload) return;
  if (payload.phase !== 'break') return;
  breakTime.textContent = formatRemaining(payload.remainingMs);
}

btnEnd.addEventListener('click', async () => {
  await window.alarmApi.skipToWork();
});

window.alarmApi.onTick((payload) => render(payload));
window.alarmApi.onPhase((payload) => {
  // 当切换到 break，立即更新一次
  if (payload.phase === 'break') render(payload);
});

// 初次打开时，主动拉一次状态
window.alarmApi.getState().then((st) => render(st));

