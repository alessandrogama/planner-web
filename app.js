/* ============================================================
   PLANEJAR PARA REALIZAR — app.js
   Expert implementation: Security, Portability & UX
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
  month: new Date().getMonth(),
  cells: {},      // key: "YYYY-MM-DD" → string
  tasks: [],      // [{id, text, done}]
  notes: '',
  meta: { mes: '', ano: '' }
};

const STORAGE_KEY = 'planejar_v1';

// ── UTILS ─────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// ── STORAGE ───────────────────────────────────────────────────
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge or ensure structure
      state = { ...state, ...parsed, meta: { ...state.meta, ...parsed.meta } };
    }
  } catch(e) {
    console.error('Falha ao carregar dados:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(e) {
    console.error('Falha ao salvar dados:', e);
  }
}

const debouncedSave = debounce(saveState, 500);

// ── DATA PORTABILITY (Security & Privacy) ──────────────────────
function exportData() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planner_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const imported = JSON.parse(re.target.result);
        if (confirm('Isso substituirá seus dados atuais. Continuar?')) {
          state = imported;
          saveState();
          location.reload();
        }
      } catch(err) {
        alert('Arquivo inválido.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllData() {
  if (confirm('⚠️ TEM CERTEZA? Todos os seus planos e tarefas serão apagados permanentemente.')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// ── DATE HELPERS ───────────────────────────────────────────────
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

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
  const startOffset = weekdayMon(firstDay.getDay());
  const today = todayKey();

  // leading empties
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    empty.setAttribute('aria-hidden', 'true');
    grid.appendChild(empty);
  }

  for (let d = 1; d <= totalDays; d++) {
    const key = dateKey(year, month, d);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', '0');
    
    if (key === today) {
      cell.classList.add('today');
      cell.setAttribute('aria-current', 'date');
    }
    
    if (state.cells[key]) cell.classList.add('has-content');
    cell.dataset.key = key;

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
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(key, d);
      }
    });
    grid.appendChild(cell);
  }

  document.getElementById('navLabel').textContent = `${MONTHS_PT[month]} ${year}`;

  // Update headers
  const inputMes = document.getElementById('input-mes');
  const inputAno = document.getElementById('input-ano');
  inputMes.placeholder = state.meta.mes || MONTHS_PT[month];
  inputAno.placeholder = state.meta.ano || String(year);
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

  document.getElementById('modalDate').textContent = `${d} de ${MONTHS_PT[m-1]}`;

  const badge = document.getElementById('modalDayBadge');
  badge.textContent = dayName;
  badge.style.background = color;
  badge.style.color = (cls === 'qua' || cls === 'dom') ? '#fff' : '#111';

  document.getElementById('modalTextarea').value = state.cells[key] || '';
  document.getElementById('modalOverlay').classList.add('open');
  
  // A11y focus trap entry
  setTimeout(() => document.getElementById('modalTextarea').focus(), 100);
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
    item.setAttribute('role', 'listitem');

    const check = document.createElement('button');
    check.className = 'task-check';
    check.setAttribute('aria-label', task.done ? 'Desmarcar tarefa' : 'Marcar como concluída');
    check.textContent = task.done ? '✓' : '';
    check.onclick = (e) => {
      e.stopPropagation();
      toggleTask(task.id);
    };

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.setAttribute('aria-label', 'Excluir tarefa');
    del.textContent = '✕';
    del.onclick = (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    };

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

// ── EVENT LISTENERS ───────────────────────────────────────────
function initEventListeners() {
  // Navigation
  document.getElementById('prevMonth').onclick = () => {
    state.month--;
    if (state.month < 0) { state.month = 11; state.year--; }
    saveState();
    renderCalendar();
  };

  document.getElementById('nextMonth').onclick = () => {
    state.month++;
    if (state.month > 11) { state.month = 0; state.year++; }
    saveState();
    renderCalendar();
  };

  document.getElementById('goToday').onclick = () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year = now.getFullYear();
    saveState();
    renderCalendar();
  };

  // Modal
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalSave').onclick = saveModal;
  document.getElementById('modalClear').onclick = clearModal;
  document.getElementById('modalOverlay').onclick = (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  };

  // Task Input
  const taskInput = document.getElementById('taskInput');
  const addTaskBtn = document.getElementById('taskAddBtn');
  const triggerAddTask = () => {
    addTask(taskInput.value);
    taskInput.value = '';
  };
  addTaskBtn.onclick = triggerAddTask;
  taskInput.onkeydown = (e) => { if (e.key === 'Enter') triggerAddTask(); };

  // Data Controls
  document.getElementById('exportData').onclick = exportData;
  document.getElementById('importData').onclick = importData;
  document.getElementById('clearAll').onclick = clearAllData;

  // Auto-save Fields (Debounced)
  const inputMes = document.getElementById('input-mes');
  const inputAno = document.getElementById('input-ano');
  const notesTop = document.getElementById('notesTop');

  inputMes.value = state.meta.mes || '';
  inputAno.value = state.meta.ano || '';
  notesTop.value = state.notes || '';

  inputMes.oninput = (e) => { state.meta.mes = e.target.value; debouncedSave(); };
  inputAno.oninput = (e) => { state.meta.ano = e.target.value; debouncedSave(); };
  notesTop.oninput = (e) => { state.notes = e.target.value; debouncedSave(); };

  // Global Shortcuts
  document.onkeydown = (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.ctrlKey && e.key === 's' && document.getElementById('modalOverlay').classList.contains('open')) {
      e.preventDefault();
      saveModal();
    }
  };
}

// ── INIT ───────────────────────────────────────────────────────
function init() {
  loadState();
  initEventListeners();
  renderCalendar();
  renderTasks();
}

window.onload = init;
