// --- 1. LOAD SAVED DATA ---
let healthLogs = JSON.parse(localStorage.getItem('healthLogs')) || [];
let scheduleItems = JSON.parse(localStorage.getItem('scheduleItems')) || [];
let syncedGoogleEvents = JSON.parse(localStorage.getItem('syncedGoogleEvents')) || [];

const todayStr = new Date().toISOString().split('T')[0];
document.getElementById('log-date').value = todayStr;
document.getElementById('sched-date').value = todayStr;

let chartType = 'bar';
let selectedMetric = 'all';
let gcalMode = 'MONTH';
const metrics = [
  { key: 'productivity', label: 'Productivity', color: '#1DB954', active: true },
  { key: 'stress', label: 'Stress', color: '#FFA42B', active: true },
  { key: 'migraine', label: 'Migraine', color: '#E91429', active: true },
  { key: 'period', label: 'Period Flow', color: '#F573A0', active: true },
  { key: 'hormone', label: 'Hormone (LH)', color: '#9B51E0', active: true }
];

// --- 2. SCREEN SWITCHING ---
function switchScreen(targetId) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetId).classList.add('active');
  const activeNav = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
  if (activeNav) activeNav.classList.add('active');

  if (targetId === 'chart-view') {
    populatePieDates();
    renderReasons();
    renderChart();
  }
  if (targetId === 'schedule-view') {
    renderSchedule();
  }
}

document.querySelectorAll('.tile, .nav-btn').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.getAttribute('data-target');
    if (target) switchScreen(target);
  });
});

// --- 3. SEARCH BAR FILTER ---
document.getElementById('search-bar').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.tile').forEach(tile => {
    tile.style.display = tile.innerText.toLowerCase().includes(query) ? 'flex' : 'none';
  });
});

// --- 4. CHART CONTROLS ---
document.getElementById('metric-filter').addEventListener('change', (e) => {
  selectedMetric = e.target.value;
  updateControlVisibility();
  renderChart();
});

document.getElementById('btn-bar').addEventListener('click', () => {
  chartType = 'bar';
  document.getElementById('btn-bar').classList.add('active');
  document.getElementById('btn-pie').classList.remove('active');
  updateControlVisibility();
  renderChart();
});

document.getElementById('btn-pie').addEventListener('click', () => {
  chartType = 'pie';
  document.getElementById('btn-pie').classList.add('active');
  document.getElementById('btn-bar').classList.remove('active');
  updateControlVisibility();
  renderChart();
});

document.getElementById('pie-date-select').addEventListener('change', renderChart);

function updateControlVisibility() {
  const showToggles = selectedMetric === 'all';
  const showDatePicker = chartType === 'pie' && selectedMetric === 'all';
  document.getElementById('legend-toggles').style.display = showToggles ? 'flex' : 'none';
  document.getElementById('pie-date-row').style.display = showDatePicker ? 'block' : 'none';
}

function populatePieDates() {
  const select = document.getElementById('pie-date-select');
  const sorted = [...healthLogs].sort((a, b) => b.date.localeCompare(a.date));
  select.innerHTML = sorted.map(log => `<option value="${log.date}">${log.date}</option>`).join('');
}

function buildToggles() {
  const container = document.getElementById('legend-toggles');
  container.innerHTML = '';
  metrics.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-pill' + (m.active ? '' : ' off');
    btn.style.backgroundColor = m.color;
    btn.textContent = m.label;
    btn.addEventListener('click', () => {
      m.active = !m.active;
      btn.classList.toggle('off', !m.active);
      renderChart();
    });
    container.appendChild(btn);
  });
}

// --- 5. RENDER BAR CHART OR PIE CHART ---
function renderChart() {
  const canvas = document.getElementById('correlationChart');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const sortedLogs = [...healthLogs].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedLogs.length === 0) {
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No entries yet — tap "+ Log" to add today!', w / 2, h / 2);
    return;
  }

  if (chartType === 'pie') {
    let slices = [];
    if (selectedMetric === 'all') {
      const chosenDate = document.getElementById('pie-date-select').value || sortedLogs[sortedLogs.length - 1].date;
      const dayLog = sortedLogs.find(l => l.date === chosenDate) || sortedLogs[sortedLogs.length - 1];
      slices = metrics
        .filter(m => m.active && (Number(dayLog[m.key]) || 0) > 0)
        .map(m => ({ label: `${m.label} (${dayLog[m.key]})`, value: Number(dayLog[m.key]), color: m.color }));
    } else {
      const m = metrics.find(item => item.key === selectedMetric);
      const dayColors = ['#1DB954', '#FFA42B', '#E91429', '#F573A0', '#9B51E0', '#509BF5', '#00C49F'];
      slices = sortedLogs.slice(-7)
        .filter(l => (Number(l[m.key]) || 0) > 0)
        .map((l, idx) => ({ label: `${l.date.slice(5)}: ${l[m.key]}`, value: Number(l[m.key]), color: dayColors[idx % dayColors.length] }));
    }

    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
      ctx.fillStyle = '#b3b3b3';
      ctx.textAlign = 'center';
      ctx.fillText('All values are 0 for this selection.', w / 2, h / 2);
      return;
    }

    const cx = w * 0.36;
    const cy = h * 0.5;
    const radius = Math.min(cx - 16, cy - 16);
    let startAngle = -Math.PI / 2;

    slices.forEach((s, i) => {
      const sliceAngle = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      startAngle += sliceAngle;

      const legendY = 30 + i * 24;
      ctx.fillRect(w * 0.68, legendY - 10, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, w * 0.68 + 18, legendY);
    });
    return;
  }

  const padLeft = 28, padRight = 10, padTop = 16, padBottom = 28;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  for (let v = 0; v <= 10; v += 2) {
    const y = padTop + plotH - (v / 10) * plotH;
    ctx.strokeStyle = '#2e2e2e';
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillStyle = '#b3b3b3';
    ctx.fillText(v, padLeft - 6, y + 4);
  }

  const recentLogs = sortedLogs.slice(-7);
  const activeMetrics = selectedMetric === 'all'
    ? metrics.filter(m => m.active)
    : metrics.filter(m => m.key === selectedMetric);

  if (activeMetrics.length === 0) return;

  const groupWidth = plotW / recentLogs.length;
  const barWidth = Math.min(24, (groupWidth * 0.72) / activeMetrics.length);

  recentLogs.forEach((log, i) => {
    const groupCenter = padLeft + groupWidth * i + groupWidth / 2;
    const totalBarsWidth = barWidth * activeMetrics.length + (activeMetrics.length - 1) * 2;
    let startX = groupCenter - totalBarsWidth / 2;

    activeMetrics.forEach(m => {
      const val = Number(log[m.key]) || 0;
      const barH = (val / 10) * plotH;
      const y = padTop + plotH - barH;
      ctx.fillStyle = m.color;
      ctx.fillRect(startX, y, barWidth, barH);
      startX += barWidth + 2;
    });

    ctx.fillStyle = '#b3b3b3';
    ctx.textAlign = 'center';
    ctx.fillText(log.date.slice(5), groupCenter, h - 8);
  });
}

// --- 6. RENDER DAILY REASONS & NOTES ---
function renderReasons() {
  const list = document.getElementById('reasons-list');
  const sorted = [...healthLogs].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.map(log => `
    <li class="reason-card">
      <strong>${log.date} • LH: ${log.hormone || 0}/10 • Migraine: ${log.migraine}/10 • Stress: ${log.stress}/10</strong>
      <span>${log.reason ? log.reason : 'No trigger/reason logged.'}</span>
    </li>
  `).join('');
}

// --- 7. SAVE DAILY LOG ---
document.getElementById('log-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    date: document.getElementById('log-date').value,
    productivity: Number(document.getElementById('log-prod').value),
    stress: Number(document.getElementById('log-stress').value),
    migraine: Number(document.getElementById('log-migraine').value),
    period: Number(document.getElementById('log-period').value),
    hormone: Number(document.getElementById('log-hormone').value),
    reason: document.getElementById('log-reason').value.trim(),
    calories: Number(document.getElementById('log-calories').value) || 0
  };

  const idx = healthLogs.findIndex(item => item.date === entry.date);
  if (idx > -1) healthLogs[idx] = entry;
  else healthLogs.push(entry);

  localStorage.setItem('healthLogs', JSON.stringify(healthLogs));
  e.target.reset();
  document.getElementById('log-date').value = todayStr;
  switchScreen('chart-view');
});

// --- 8. LIVE GOOGLE CALENDAR EMBED & QUICK BLOCKS ---
function renderSchedule() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = '';

  const allEvents = [...scheduleItems, ...syncedGoogleEvents];
  const sortedEvents = allEvents.sort((a, b) =>
    `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)
  );

  if (sortedEvents.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No schedule blocks yet.';
    list.appendChild(emptyItem);
    return;
  }

  sortedEvents.forEach(item => {
    const cleanDate = item.date.replace(/-/g, '');
    const cleanTime = (item.time || '09:00').replace(':', '') + '00';
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.title)}&dates=${cleanDate}T${cleanTime}/${cleanDate}T${cleanTime}`;

    const li = document.createElement('li');
    li.className = 'schedule-item';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('small');
    meta.textContent = `${item.category} • ${item.date} at ${item.time || 'All Day'}`;
    details.append(title, meta);

    const calendarLink = document.createElement('a');
    calendarLink.href = gcalUrl;
    calendarLink.target = '_blank';
    calendarLink.rel = 'noopener noreferrer';
    calendarLink.className = 'gcal-link';
    calendarLink.textContent = '+ Push to Phone Cal';
    li.append(details, calendarLink);
    list.appendChild(li);
  });
}

document.getElementById('schedule-form').addEventListener('submit', (e) => {
  e.preventDefault();
  scheduleItems.push({
    date: document.getElementById('sched-date').value,
    time: document.getElementById('sched-time').value,
    title: document.getElementById('sched-title').value,
    category: document.getElementById('sched-category').value
  });
  localStorage.setItem('scheduleItems', JSON.stringify(scheduleItems));
  e.target.reset();
  document.getElementById('sched-date').value = todayStr;
  renderSchedule();
});

function isGoogleCalendarEmbedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'calendar.google.com' &&
      url.pathname.includes('/embed');
  } catch (error) {
    return false;
  }
}

function updateGcalModeButtons() {
  document.querySelectorAll('#gcal-mode-switch [data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === gcalMode);
  });
}

function setGcalMode(mode) {
  if (!['MONTH', 'WEEK', 'AGENDA'].includes(mode)) {
    alert('Choose Month, Week, or Agenda view.');
    return;
  }

  const iframe = document.getElementById('gcal-iframe');
  const url = new URL(iframe.src);
  url.searchParams.set('mode', mode);
  url.searchParams.set('showTitle', '0');
  url.searchParams.set('showPrint', '0');
  url.searchParams.set('showCalendars', '0');
  gcalMode = mode;
  iframe.src = url.href;
  document.getElementById('gcal-embed-url').value = url.href;
  localStorage.setItem('gcalEmbedUrl', url.href);
  updateGcalModeButtons();
}

document.getElementById('save-embed-btn').addEventListener('click', () => {
  const input = document.getElementById('gcal-embed-url');
  const urlValue = input.value.trim();
  if (!isGoogleCalendarEmbedUrl(urlValue)) {
    alert('Enter a valid Google Calendar embed URL (https://calendar.google.com/.../embed).');
    return;
  }

  const url = new URL(urlValue);
  url.searchParams.set('mode', gcalMode);
  url.searchParams.set('showTitle', '0');
  url.searchParams.set('showPrint', '0');
  url.searchParams.set('showCalendars', '0');
  input.value = url.href;
  document.getElementById('gcal-iframe').src = url.href;
  localStorage.setItem('gcalEmbedUrl', url.href);
  alert('Google Calendar link updated!');
});

// --- 9. EXPORT JSON BACKUP ---
document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ healthLogs, scheduleItems }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-backup-${todayStr}.json`;
  a.click();
});

// --- 10. INITIAL STARTUP ---
const savedEmbedUrl = localStorage.getItem('gcalEmbedUrl');
if (savedEmbedUrl && isGoogleCalendarEmbedUrl(savedEmbedUrl)) {
  const url = new URL(savedEmbedUrl);
  const savedMode = url.searchParams.get('mode');
  if (['MONTH', 'WEEK', 'AGENDA'].includes(savedMode)) {
    gcalMode = savedMode;
  }
  url.searchParams.set('mode', gcalMode);
  document.getElementById('gcal-embed-url').value = url.href;
  document.getElementById('gcal-iframe').src = url.href;
}
setGcalMode(gcalMode);
updateGcalModeButtons();
buildToggles();
updateControlVisibility();
renderSchedule();
window.addEventListener('resize', () => {
  if (document.getElementById('chart-view').classList.contains('active')) renderChart();
});

