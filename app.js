/* ============================================================
   PLANEJAR PARA REALIZAR — app.js
   Storage: localStorage (Netlify-ready, sem backend)
   ============================================================ */

const DAYS_PT = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAY_CLASSES = ['seg','ter','qua','qui','sex','sab','dom'];
const DAY_COLORS = {
  seg: '#F7C948', ter: '#E94F7F', qua: '#9B5FD4',
  qui: '#3ABDE8', sex: '#2DD4A4', sab: '#F4A261', dom: '#EC6B6B'
};

// ── STATE ─────────────────────────────────────────────────────
let state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-indexed
  cells: {},      // key: "YYYY-MM-DD" → string
  tasks: [],      // [{id, text, done}]
  notes: '',
  meta: { mes: '', ano: '' }
};

const STORAGE_KEY = 'planejar_v1';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = { ...state, ...JSON.parse(saved) };
  } catch(e) { console.warn('Load failed', e); }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(e) { console.warn('Save failed', e); }
}

// ── DATE HELPERS ───────────────────────────────────────────────
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// Returns weekday 0=Mon...6=Sun  (JS getDay: 0=Sun)
function weekdayMon(jsDay) {
  return (jsDay + 6) % 7;
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

// ── CALENDAR RENDER ────────────────────────────────────────────
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const { year, month } = state;
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = weekdayMon(firstDay.getDay()); // 0-6
  const today = todayKey();

  // leading empties
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= totalDays; d++) {
    const key = dateKey(year, month, d);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (key === today) cell.classList.add('today');
    if (state.cells[key]) cell.classList.add('has-content');
    cell.dataset.key = key;
    cell.dataset.day = d;

    const num = document.createElement('span');
    num.className = 'cell-num';
    num.textContent = d;
    cell.appendChild(num);

    if (state.cells[key]) {
      const preview = document.createElement('div');
      preview.className = 'cell-preview';
      preview.textContent = state.cells[key];
      cell.appendChild(preview);
    }

    cell.addEventListener('click', () => openModal(key, d));
    grid.appendChild(cell);
  }

  // update nav
  document.getElementById('navLabel').textContent =
    `${MONTHS_PT[month]} ${year}`;

  // update header inputs only if empty
  const inputMes = document.getElementById('input-mes');
  const inputAno = document.getElementById('input-ano');
  if (!state.meta.mes) inputMes.placeholder = MONTHS_PT[month];
  if (!state.meta.ano) inputAno.placeholder = String(year);
}

// ── MODAL ──────────────────────────────────────────────────────
let currentKey = null;

function openModal(key, dayNum) {
  currentKey = key;
  const [y, m, d] = key.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const wdIdx = weekdayMon(dateObj.getDay());
  const dayName = DAYS_PT[wdIdx];
  const cls = DAY_CLASSES[wdIdx];
  const color = DAY_COLORS[cls];

  document.getElementById('modalDate').textContent =
    `${d} de ${MONTHS_PT[m-1]}`;

  const badge = document.getElementById('modalDayBadge');
  badge.textContent = dayName;
  badge.style.background = color;
  badge.style.color = (cls === 'qua' || cls === 'dom') ? '#fff' : '#111';

  document.getElementById('modalTextarea').value = state.cells[key] || '';
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('modalTextarea').focus(), 250);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  currentKey = null;
}

function saveModal() {
  if (!currentKey) return;
  const val = document.getElementById('modalTextarea').value.trim();
  if (val) {
    state.cells[currentKey] = val;
  } else {
    delete state.cells[currentKey];
  }
  saveState();
  renderCalendar();
  closeModal();
}

function clearModal() {
  document.getElementById('modalTextarea').value = '';
}

// ── TASKS ──────────────────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  list.innerHTML = '';
  state.tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.done ? ' done' : '');
    item.dataset.id = task.id;

    const check = document.createElement('div');
    check.className = 'task-check';
    check.textContent = task.done ? '✓' : '';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTask(task.id);
    });

    const text = document.createElement('div');
    text.className = 'task-text';
    text.textContent = task.text;

    const del = document.createElement('div');
    del.className = 'task-delete';
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function addTask(text) {
  if (!text.trim()) return;
  state.tasks.push({ id: Date.now(), text: text.trim(), done: false });
  saveState();
  renderTasks();
}

function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (t) t.done = !t.done;
  saveState();
  renderTasks();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderTasks();
}

// ── NOTES ──────────────────────────────────────────────────────
function initNotes() {
  const ta = document.getElementById('notesTop');
  ta.value = state.notes || '';
  ta.addEventListener('input', () => {
    state.notes = ta.value;
    saveState();
  });
}

// ── META INPUTS ────────────────────────────────────────────────
function initMeta() {
  const inputMes = document.getElementById('input-mes');
  const inputAno = document.getElementById('input-ano');
  inputMes.value = state.meta.mes || '';
  inputAno.value = state.meta.ano || '';
  inputMes.addEventListener('input', () => {
    state.meta.mes = inputMes.value;
    saveState();
  });
  inputAno.addEventListener('input', () => {
    state.meta.ano = inputAno.value;
    saveState();
  });
}

// ── NAVIGATION ─────────────────────────────────────────────────
document.getElementById('prevMonth').addEventListener('click', () => {
  state.month--;
  if (state.month < 0) { state.month = 11; state.year--; }
  saveState();
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  state.month++;
  if (state.month > 11) { state.month = 0; state.year++; }
  saveState();
  renderCalendar();
});

document.getElementById('goToday').addEventListener('click', () => {
  const now = new Date();
  state.month = now.getMonth();
  state.year = now.getFullYear();
  saveState();
  renderCalendar();
});

// ── MODAL EVENTS ───────────────────────────────────────────────
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalSave').addEventListener('click', saveModal);
document.getElementById('modalClear').addEventListener('click', clearModal);

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('modalTextarea').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveModal();
});

// ── TASK EVENTS ────────────────────────────────────────────────
document.getElementById('taskAddBtn').addEventListener('click', () => {
  const input = document.getElementById('taskInput');
  addTask(input.value);
  input.value = '';
});

document.getElementById('taskInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTask(e.target.value);
    e.target.value = '';
  }
});

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('open')) {
    closeModal();
  }
});

// ── INIT ───────────────────────────────────────────────────────
loadState();
initMeta();
initNotes();
renderCalendar();
renderTasks();
