// ===== DATA LAYER =====
const STORAGE_KEY = 'financas503020';

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { salary: 0, months: {}, currentMonth: getCurrentMonthKey() };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName(key) {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function ensureMonth(data, key) {
  if (!data.months[key]) {
    data.months[key] = { expenses: [], salary: data.salary };
  }
  return data.months[key];
}

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===== APP STATE =====
let appData = loadData();
let selectedCategory = null;
let monthlyChart = null;

// ===== DOM REFS =====
const $ = id => document.getElementById(id);

// ===== SETUP SCREEN =====
const inputSalary = $('input-salary');
const btnStart = $('btn-start');
const splitPreview = $('split-preview');

inputSalary.addEventListener('input', () => {
  const v = parseFloat(inputSalary.value) || 0;
  if (v > 0) {
    const guardar = 200;
    const restante = Math.max(0, v - guardar);
    splitPreview.style.display = 'flex';
    $('preview-essencial').textContent = fmt(restante * 0.6);
    $('preview-lazer').textContent = fmt(restante * 0.4);
    $('preview-guardar').textContent = fmt(guardar);
    btnStart.disabled = false;
  } else {
    splitPreview.style.display = 'none';
    btnStart.disabled = true;
  }
});

btnStart.addEventListener('click', () => {
  const v = parseFloat(inputSalary.value);
  if (!v || v <= 0) return;
  appData.salary = v;
  appData.currentMonth = getCurrentMonthKey();
  ensureMonth(appData, appData.currentMonth);
  appData.months[appData.currentMonth].salary = v;
  saveData(appData);
  showDashboard();
});

// ===== SHOW DASHBOARD =====
function showDashboard() {
  $('screen-setup').classList.remove('active');
  $('screen-dashboard').classList.add('active');
  updateGreeting();
  renderAll();
}

function updateGreeting() {
  const h = new Date().getHours();
  let g = 'Boa noite!';
  if (h >= 5 && h < 12) g = 'Bom dia!';
  else if (h >= 12 && h < 18) g = 'Boa tarde!';
  $('greeting').textContent = g;
  $('current-month-label').textContent = getMonthName(appData.currentMonth);
}

// ===== RENDER ALL =====
function renderAll() {
  const mk = appData.currentMonth;
  const month = ensureMonth(appData, mk);
  const sal = month.salary || appData.salary;

  const guardarFixo = 200;
  const restante = Math.max(0, sal - guardarFixo);
  const lim = { essencial: restante * 0.6, lazer: restante * 0.4, guardar: guardarFixo };
  const spent = { essencial: 0, lazer: 0 };

  month.expenses.forEach(e => { spent[e.category] = (spent[e.category] || 0) + e.value; });

  const totalSpent = spent.essencial + spent.lazer;
  const totalRemaining = sal - totalSpent;

  // Salary card
  $('salary-display').textContent = fmt(sal);
  $('total-spent').textContent = fmt(totalSpent);
  $('total-remaining').textContent = fmt(totalRemaining);

  // Budget cards
  renderBudgetCard('essencial', spent.essencial, lim.essencial);
  renderBudgetCard('lazer', spent.lazer, lim.lazer);
  renderGuardarCard(lim.guardar, sal, totalSpent);

  // Chart
  renderChart();

  // Summary
  renderSummary();

  // Expenses list
  renderExpenses(month.expenses);

  // Month selector
  renderMonthSelector();
}

function renderBudgetCard(cat, spent, limit) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const remaining = limit - spent;
  $(`progress-${cat}`).style.width = pct + '%';
  $(`spent-${cat}`).textContent = fmt(spent);
  $(`limit-${cat}`).textContent = fmt(limit);
  $(`remaining-${cat}`).textContent = fmt(remaining);
  const card = $(`card-${cat}`);
  if (remaining < 0) card.classList.add('over');
  else card.classList.remove('over');
}

function renderGuardarCard(target, salary, totalSpent) {
  // "Guardado" = salary - totalSpent - (what's in essencial + lazer spent)
  // Actually, guardado = salary's 20% that hasn't been touched
  // Show how much SHOULD be saved vs how much is actually left
  const actualSaved = salary - totalSpent;
  const savedPct = target > 0 ? Math.min((Math.max(0, target - Math.max(0, totalSpent - salary * 0.8)) / target) * 100, 100) : 0;
  $('progress-guardar').style.width = savedPct + '%';
  $('spent-guardar').textContent = fmt(Math.max(0, actualSaved >= target ? target : actualSaved));
  $('limit-guardar').textContent = fmt(target);
  const falta = target - Math.min(actualSaved, target);
  $('remaining-guardar').textContent = fmt(Math.max(0, falta));
}

function renderChart() {
  const keys = Object.keys(appData.months).sort();
  const labels = keys.map(getMonthName);
  const essData = [];
  const lazData = [];

  keys.forEach(k => {
    const m = appData.months[k];
    let e = 0, l = 0;
    (m.expenses || []).forEach(ex => {
      if (ex.category === 'essencial') e += ex.value;
      else if (ex.category === 'lazer') l += ex.value;
    });
    essData.push(e);
    lazData.push(l);
  });

  const ctx = $('chart-monthly').getContext('2d');
  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Essencial', data: essData, backgroundColor: 'rgba(108,92,231,0.7)', borderRadius: 6 },
        { label: 'Lazer', data: lazData, backgroundColor: 'rgba(255,107,107,0.7)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b92a8', font: { family: 'Inter', size: 11 } } }
      },
      scales: {
        x: { ticks: { color: '#555d75', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#555d75', font: { family: 'Inter', size: 10 }, callback: v => 'R$' + v }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderSummary() {
  let totalSalary = 0, totalSpent = 0, totalSavingsTarget = 0;
  Object.values(appData.months).forEach(m => {
    const s = m.salary || appData.salary;
    totalSalary += s;
    totalSavingsTarget += 200;
    (m.expenses || []).forEach(e => { totalSpent += e.value; });
  });
  const actualSaved = totalSalary - totalSpent;
  $('alltime-salary').textContent = fmt(totalSalary);
  $('alltime-spent').textContent = fmt(totalSpent);
  $('alltime-savings-target').textContent = fmt(totalSavingsTarget);
  $('alltime-savings-actual').textContent = fmt(Math.max(0, actualSaved));
}

function renderExpenses(expenses) {
  const list = $('expense-list');
  if (!expenses || expenses.length === 0) {
    list.innerHTML = '<div class="empty-state" id="empty-expenses"><span class="empty-icon">📝</span><span>Nenhum gasto registrado ainda</span></div>';
    return;
  }
  const sorted = [...expenses].reverse();
  list.innerHTML = sorted.map((e, i) => `
    <div class="expense-item">
      <div class="expense-cat-dot ${e.category}"></div>
      <div class="expense-info">
        <span class="expense-desc">${escapeHtml(e.description)}</span>
        <span class="expense-date">${e.category === 'essencial' ? '🏠 Essencial' : '🎮 Lazer'} • ${e.date}</span>
      </div>
      <span class="expense-value">-${fmt(e.value)}</span>
      <button class="expense-delete" data-idx="${expenses.length - 1 - i}" aria-label="Excluir">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.expense-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm('Excluir este gasto?')) {
        const month = appData.months[appData.currentMonth];
        month.expenses.splice(idx, 1);
        saveData(appData);
        renderAll();
        showToast('Gasto excluído!');
      }
    });
  });
}

function renderMonthSelector() {
  const sel = $('select-month');
  const keys = Object.keys(appData.months).sort().reverse();
  sel.innerHTML = keys.map(k => `<option value="${k}" ${k === appData.currentMonth ? 'selected' : ''}>${getMonthName(k)}</option>`).join('');
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// ===== ADD EXPENSE MODAL =====
const modalExpense = $('modal-expense');
const stepCategory = $('step-category');
const stepDetails = $('step-details');

$('btn-add-expense').addEventListener('click', () => {
  openModal(modalExpense);
  stepCategory.classList.remove('hidden');
  stepDetails.classList.add('hidden');
  updateModalRemaining();
});

function updateModalRemaining() {
  const mk = appData.currentMonth;
  const month = ensureMonth(appData, mk);
  const sal = month.salary || appData.salary;
  const spent = { essencial: 0, lazer: 0 };
  month.expenses.forEach(e => { spent[e.category] = (spent[e.category] || 0) + e.value; });
  const guardarFixo = 200;
  const restanteModal = Math.max(0, sal - guardarFixo);
  $('modal-remaining-essencial').textContent = `Resta: ${fmt(restanteModal * 0.6 - spent.essencial)}`;
  $('modal-remaining-lazer').textContent = `Resta: ${fmt(restanteModal * 0.4 - spent.lazer)}`;
}

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedCategory = btn.dataset.cat;
    stepCategory.classList.add('hidden');
    stepDetails.classList.remove('hidden');
    const badge = $('selected-cat-badge');
    if (selectedCategory === 'essencial') {
      badge.textContent = '🏠 Essencial';
      badge.style.background = 'rgba(108,92,231,0.15)';
      badge.style.color = '#6C5CE7';
    } else {
      badge.textContent = '🎮 Lazer';
      badge.style.background = 'rgba(255,107,107,0.15)';
      badge.style.color = '#FF6B6B';
    }
    $('input-expense-desc').value = '';
    $('input-expense-value').value = '';
    $('btn-save-expense').disabled = true;
    $('input-expense-desc').focus();
  });
});

$('btn-back-category').addEventListener('click', () => {
  stepDetails.classList.add('hidden');
  stepCategory.classList.remove('hidden');
});

function checkExpenseForm() {
  const desc = $('input-expense-desc').value.trim();
  const val = parseFloat($('input-expense-value').value);
  $('btn-save-expense').disabled = !(desc && val > 0);
}
$('input-expense-desc').addEventListener('input', checkExpenseForm);
$('input-expense-value').addEventListener('input', checkExpenseForm);

$('btn-save-expense').addEventListener('click', () => {
  const desc = $('input-expense-desc').value.trim();
  const val = parseFloat($('input-expense-value').value);
  if (!desc || !val || val <= 0 || !selectedCategory) return;

  const month = ensureMonth(appData, appData.currentMonth);
  const now = new Date();
  month.expenses.push({
    description: desc,
    value: val,
    category: selectedCategory,
    date: now.toLocaleDateString('pt-BR'),
    timestamp: now.getTime()
  });
  saveData(appData);
  closeModal(modalExpense);
  renderAll();
  showToast('Gasto adicionado! ✅');
});

$('btn-close-modal').addEventListener('click', () => closeModal(modalExpense));

// ===== SETTINGS MODAL =====
const modalSettings = $('modal-settings');

$('btn-settings').addEventListener('click', () => {
  $('input-edit-salary').value = appData.salary;
  openModal(modalSettings);
});

$('btn-close-settings').addEventListener('click', () => closeModal(modalSettings));

$('btn-save-salary').addEventListener('click', () => {
  const v = parseFloat($('input-edit-salary').value);
  if (!v || v <= 0) return;
  appData.salary = v;
  const month = ensureMonth(appData, appData.currentMonth);
  month.salary = v;
  saveData(appData);
  closeModal(modalSettings);
  renderAll();
  showToast('Salário atualizado! ✅');
});

$('select-month').addEventListener('change', (e) => {
  appData.currentMonth = e.target.value;
  saveData(appData);
  updateGreeting();
  renderAll();
});

$('btn-new-month').addEventListener('click', () => {
  const newKey = getCurrentMonthKey();
  appData.currentMonth = newKey;
  ensureMonth(appData, newKey);
  appData.months[newKey].salary = appData.salary;
  saveData(appData);
  closeModal(modalSettings);
  updateGreeting();
  renderAll();
  showToast('Novo mês iniciado! 📅');
});

$('btn-clear-data').addEventListener('click', () => {
  if (confirm('Tem certeza que deseja apagar TODOS os dados? Essa ação não pode ser desfeita.')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

// ===== MODAL HELPERS =====
function openModal(el) { setTimeout(() => el.classList.add('open'), 10); }
function closeModal(el) { el.classList.remove('open'); }

// Close modal on overlay click
[modalExpense, modalSettings].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
});

// ===== TOAST =====
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== INIT =====
function init() {
  if (appData.salary > 0) {
    showDashboard();
  }
}
init();
