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

// ── SECURITY (Encryption) ──────────────────────────────────────
// Usamos sessionStorage para manter a senha durante a sessão (evita pedir a cada refresh)
let userPassphrase = sessionStorage.getItem('planner_pass');

const strToBuf = (str) => new TextEncoder().encode(str);
const bufToStr = (buf) => new TextDecoder().decode(buf);

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey("raw", strToBuf(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, strToBuf(data));
  return {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
}

async function decryptData(encryptedObj, password) {
  const salt = new Uint8Array(atob(encryptedObj.salt).split("").map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(encryptedObj.iv).split("").map(c => c.charCodeAt(0)));
  const data = new Uint8Array(atob(encryptedObj.data).split("").map(c => c.charCodeAt(0)));
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return bufToStr(decrypted);
}

// ── STORAGE ───────────────────────────────────────────────────
let isLocked = false;

async function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    
    // CASO 1: Primeira vez (sem dados)
    if (!saved) {
      document.getElementById('setupOverlay').classList.add('open');
      return;
    }

    let parsed = JSON.parse(saved);
    if (parsed._encrypted) {
      isLocked = true;
      
      // Tentar auto-unlock se a senha estiver no sessionStorage
      if (userPassphrase) {
        try {
          const decrypted = await decryptData(parsed, userPassphrase);
          state = JSON.parse(decrypted);
          isLocked = false;
          renderAfterLoad();
          return;
        } catch(e) {
          sessionStorage.removeItem('planner_pass');
          userPassphrase = null;
        }
      }
      
      // Se falhou auto-unlock ou não tem senha, mostrar overlay
      document.getElementById('unlockOverlay').classList.add('open');
      return;
    }

    state = { ...state, ...parsed, meta: { ...state.meta, ...parsed.meta } };
    renderAfterLoad();
  } catch(e) { console.error('Falha ao carregar:', e); }
}

async function saveState() {
  if (isLocked && !userPassphrase) return;
  try {
    let dataToSave = JSON.stringify(state);
    if (userPassphrase) {
      const encrypted = await encryptData(dataToSave, userPassphrase);
      dataToSave = JSON.stringify({ _encrypted: true, ...encrypted });
    }
    localStorage.setItem(STORAGE_KEY, dataToSave);
  } catch(e) { console.error('Falha ao salvar:', e); }
}

const debouncedSave = debounce(saveState, 500);

function renderAfterLoad() {
  renderCalendar();
  renderTasks();
  document.getElementById('notesTop').value = state.notes || '';
}

// ── DATA CONTROLS ──────────────────────────────────────────────
function clearAllData() {
  if (confirm('⚠️ TEM CERTEZA? Todos os seus planos e tarefas serão apagados permanentemente.')) {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('planner_pass');
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
  
  // Update header text
  document.getElementById('header-mes').textContent = MONTHS_PT[month];
  document.getElementById('header-ano').textContent = year;
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

  // Modals
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalSave').onclick = saveModal;
  document.getElementById('modalClear').onclick = clearModal;
  document.getElementById('modalOverlay').onclick = (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  };

  // Setup Flow
  document.getElementById('setupBtn').onclick = async () => {
    const pass = document.getElementById('setupPass').value;
    if (pass.length < 4) return alert('Escolha uma senha mais segura (min 4 caracteres)');
    userPassphrase = pass;
    sessionStorage.setItem('planner_pass', pass);
    await saveState();
    document.getElementById('setupOverlay').classList.remove('open');
    renderAfterLoad();
  };

  // Unlock Flow
  document.getElementById('unlockBtn').onclick = async () => {
    const passInput = document.getElementById('unlockPass');
    const pass = passInput.value;
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      const decrypted = await decryptData(JSON.parse(saved), pass);
      const decryptedState = JSON.parse(decrypted);
      state = { ...state, ...decryptedState, meta: { ...state.meta, ...decryptedState.meta }, cells: { ...decryptedState.cells }, tasks: [...(decryptedState.tasks || [])] };
      userPassphrase = pass;
      sessionStorage.setItem('planner_pass', pass);
      isLocked = false;
      passInput.value = '';
      document.getElementById('unlockOverlay').classList.remove('open');
      renderAfterLoad();
    } catch(err) {
      alert('Senha incorreta!');
    }
  };

  document.getElementById('forgotPass').onclick = () => {
    if (confirm('🆘 Resetar App? Todos os dados serão perdidos.')) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('planner_pass');
      location.reload();
    }
  };

  // Task Input
  const taskInput = document.getElementById('taskInput');
  const addTaskBtn = document.getElementById('taskAddBtn');
  const triggerAddTask = () => { addTask(taskInput.value); taskInput.value = ''; };
  addTaskBtn.onclick = triggerAddTask;
  taskInput.onkeydown = (e) => { if (e.key === 'Enter') triggerAddTask(); };

  // Data Controls
  document.getElementById('clearAll').onclick = clearAllData;

  // Auto-save Fields
  const notesTop = document.getElementById('notesTop');
  notesTop.oninput = (e) => { state.notes = e.target.value; debouncedSave(); };

  // Shortcuts
  document.onkeydown = (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.ctrlKey && e.key === 's' && document.getElementById('modalOverlay').classList.contains('open')) {
      e.preventDefault(); saveModal();
    }
  };
}

// ── INIT ───────────────────────────────────────────────────────
async function init() {
  await loadState();
  initEventListeners();
}

window.onload = init;
