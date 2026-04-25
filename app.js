const db = new Dexie('DeudasLocalDB');
db.version(2).stores({
  deudas: 'id, cliente, estado, sync_status, fecha, moneda',
  pagos: 'id, deuda_id, amount, currency, date'
});

// Supabase client
const supabaseUrl = 'https://fxinubadirwbotnoynkw.supabase.co'; // Reemplaza con tu URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4aW51YmFkaXJ3Ym90bm95bmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTU0MzksImV4cCI6MjA5MjYzMTQzOX0.3msFK_93cssiGrrjcS5Y7i1t5Nt9qduO9FIcpwAN6Eo'; // Reemplaza con tu key
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// En Vercel usamos la misma raíz para la web y la API
const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
  resetItemRows(); // Asegurar que se ejecute inmediatamente
  initUI();
  loadData();
  registerServiceWorker();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', updateConnectionStatus);
});

const elements = {
  connectionStatus: document.getElementById('connectionStatus'),
  syncStatus: document.getElementById('syncStatus'),
  dailyRateInput: document.getElementById('dailyRateInput'),
  dailyRateDisplay: document.getElementById('dailyRateDisplay'),
  dailyRateHint: document.getElementById('dailyRateHint'),
  totalUsd: document.getElementById('totalUsd'),
  totalBs: document.getElementById('totalBs'),
  debtForm: document.getElementById('debtForm'),
  clienteInput: document.getElementById('clienteInput'),
  tasaTransaccionGroup: document.getElementById('tasaTransaccionGroup'),
  tasaTransaccionInput: document.getElementById('tasaTransaccionInput'),
  addItemButton: document.getElementById('addItemButton'),
  itemRowsContainer: document.getElementById('itemRowsContainer'),
  debtTotalDisplay: document.getElementById('debtTotalDisplay'),
  searchInput: document.getElementById('searchInput'),
  debtList: document.getElementById('debtList'),
  emptyState: document.getElementById('emptyState'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  debtModal: document.getElementById('debtModal'),
  modalClient: document.getElementById('modalClient'),
  modalTotalUsd: document.getElementById('modalTotalUsd'),
  modalTotalBs: document.getElementById('modalTotalBs'),
  modalItemsList: document.getElementById('modalItemsList'),
  modalCopyButton: document.getElementById('modalCopyButton'),
  modalCloseButton: document.getElementById('modalCloseButton'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  installButton: document.getElementById('installButton'),
  confirmModal: document.getElementById('confirmModal'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmCancel: document.getElementById('confirmCancel'),
  confirmAccept: document.getElementById('confirmAccept'),
  promptModal: document.getElementById('promptModal'),
  promptMessage: document.getElementById('promptMessage'),
  promptInput: document.getElementById('promptInput'),
  promptCancel: document.getElementById('promptCancel'),
  promptAccept: document.getElementById('promptAccept')
};

let currentFilter = 'ALL';
let dailyRate = 30.00;
let currentModalDebt = null;
let editingDebtId = null;
let deferredInstallPrompt = null;
let confirmResolve = null;
let promptResolve = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (elements.installButton) {
    elements.installButton.classList.remove('hidden');
  }
});

window.addEventListener('appinstalled', () => {
  if (elements.installButton) {
    elements.installButton.classList.add('hidden');
  }
});

function initUI() {
  resetItemRows(); // Asegurar que se ejecute primero
  updateConnectionStatus();
  if (!window.matchMedia('(display-mode: standalone)').matches && 'onbeforeinstallprompt' in window && elements.installButton) {
    elements.installButton.classList.remove('hidden');
  }
  elements.dailyRateInput.value = dailyRate.toFixed(2);
  elements.dailyRateDisplay.textContent = dailyRate.toFixed(2);
  elements.debtForm.addEventListener('submit', handleFormSubmit);
  elements.dailyRateInput.addEventListener('change', handleRateChange);
  elements.searchInput.addEventListener('input', renderDebtList);
  elements.addItemButton.addEventListener('click', addItemRow);
  elements.installButton.addEventListener('click', handleInstallClick);
  elements.modalCopyButton.addEventListener('click', copyDebtDetail);
  elements.modalCloseButton.addEventListener('click', closeDebtModal);
  elements.cancelEditBtn.addEventListener('click', cancelEditing);
  elements.debtModal.addEventListener('click', (event) => {
    if (event.target === elements.debtModal) {
      closeDebtModal();
    }
  });
  elements.confirmCancel.addEventListener('click', () => hideConfirmModal(false));
  elements.confirmAccept.addEventListener('click', () => hideConfirmModal(true));
  elements.promptCancel.addEventListener('click', () => hidePromptModal(null));
  elements.promptAccept.addEventListener('click', () => hidePromptModal(elements.promptInput.value));
  elements.confirmModal.addEventListener('click', (event) => {
    if (event.target === elements.confirmModal) {
      hideConfirmModal(false);
    }
  });
  elements.promptModal.addEventListener('click', (event) => {
    if (event.target === elements.promptModal) {
      hidePromptModal(null);
    }
  });
  document.querySelectorAll('input[name="moneda"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      toggleTransaccionField();
      updateFormTotal();
    });
  });
  elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      updateFilterUI(button);
      renderDebtList();
    });
  });
  updateFilterUI(document.querySelector('[data-filter="ALL"]'));
}

function updateFilterUI(activeButton) {
  elements.filterButtons.forEach((button) => {
    button.classList.toggle('bg-cyan-500/10', button === activeButton);
    button.classList.toggle('border-cyan-500/40', button === activeButton);
    button.classList.toggle('text-cyan-200', button === activeButton);
    button.classList.toggle('bg-slate-950', button !== activeButton);
  });
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) {
    await showConfirmModal('La instalación todavía no está disponible. Vuelve a intentarlo en unos segundos.');
    return;
  }
  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  if (choiceResult.outcome === 'accepted') {
    console.log('Instalación aceptada');
  }
  deferredInstallPrompt = null;
  if (elements.installButton) {
    elements.installButton.classList.add('hidden');
  }
}

function toggleTransaccionField() {
  const selected = document.querySelector('input[name="moneda"]:checked').value;
  elements.tasaTransaccionGroup.classList.toggle('hidden', selected !== 'BS');
  if (selected !== 'BS') {
    elements.tasaTransaccionInput.value = '';
  }
  updateFormTotal();
}

function updateFormTotal() {
  const items = getFormItems();
  const total = items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);
  const moneda = document.querySelector('input[name="moneda"]:checked').value;
  const formattedTotal = moneda === 'USD' ? formatCurrency(total, 'en-US', 'USD') : formatBs(total);
  elements.debtTotalDisplay.textContent = formattedTotal;
}

function createItemRow() {
  const row = document.createElement('div');
  row.className = 'item-row grid gap-3 sm:grid-cols-[2fr_1fr_1fr] sm:items-end';
  row.innerHTML = `
    <label class="block">
      <span class="text-sm text-slate-300">Producto / servicio</span>
      <input type="text" class="item-name mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Ej. Cuadernos" required />
    </label>
    <label class="block">
      <span class="text-sm text-slate-300">Cantidad</span>
      <input type="number" class="item-qty mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" min="1" value="1" required />
    </label>
    <label class="block">
      <span class="text-sm text-slate-300">Precio unitario</span>
      <input type="number" class="item-price mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" min="0.01" step="0.01" value="0.00" required />
    </label>
    <button type="button" class="remove-item-btn mt-2 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 sm:mt-0">Eliminar</button>
  `;

  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', updateFormTotal);
  });

  row.querySelector('.remove-item-btn').addEventListener('click', () => {
    row.remove();
    if (!elements.itemRowsContainer.children.length) {
      addItemRow();
    }
    updateFormTotal();
  });

  return row;
}

function addItemRow() {
  elements.itemRowsContainer.appendChild(createItemRow());
  updateFormTotal();
}

function resetItemRows() {
  elements.itemRowsContainer.innerHTML = '';
  addItemRow();
}

function getFormItems() {
  return Array.from(elements.itemRowsContainer.querySelectorAll('.item-row')).map((row) => ({
    detalle: row.querySelector('.item-name').value.trim(),
    cantidad: Number(row.querySelector('.item-qty').value) || 0,
    precio_unitario: Number(row.querySelector('.item-price').value) || 0
  }));
}

function startEditing(deuda) {
  editingDebtId = deuda.id;
  elements.clienteInput.value = deuda.cliente;
  const items = deuda.items || [{ detalle: deuda.producto || 'Producto', cantidad: deuda.cantidad || 0, precio_unitario: deuda.precio_unitario || 0 }];
  resetItemRows();
  elements.itemRowsContainer.innerHTML = '';
  items.forEach((item) => {
    const row = createItemRow();
    row.querySelector('.item-name').value = item.detalle;
    row.querySelector('.item-qty').value = item.cantidad;
    row.querySelector('.item-price').value = item.precio_unitario;
    elements.itemRowsContainer.appendChild(row);
  });
  document.querySelector(`input[name="moneda"][value="${deuda.moneda}"]`).checked = true;
  if (deuda.moneda === 'BS') {
    elements.tasaTransaccionInput.value = deuda.tasa_transaccion || dailyRate;
  }
  toggleTransaccionField();
  updateFormTotal();
  elements.debtForm.querySelector('button[type="submit"]').textContent = 'Actualizar deuda';
  elements.cancelEditBtn.classList.remove('hidden');
  elements.clienteInput.focus();
}

function cancelEditing() {
  editingDebtId = null;
  elements.debtForm.reset();
  resetItemRows();
  toggleTransaccionField();
  elements.debtForm.querySelector('button[type="submit"]').textContent = 'Agregar deuda';
  elements.cancelEditBtn.classList.add('hidden');
}

async function deleteDebt(debtId) {
  const confirmed = await showConfirmModal('¿Estás seguro de que quieres eliminar esta deuda? Esta acción no se puede deshacer.', 'Cancelar', 'Eliminar');
  if (!confirmed) return;
  if (navigator.onLine) {
    try {
      const { error } = await supabaseClient.from('deudas').delete().eq('id', debtId);
      if (error) throw error;
    } catch (error) {
      console.warn('No se pudo eliminar la deuda en Supabase:', error);
    }
  }
  await db.deudas.delete(debtId);
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

async function openDebtModal(deuda) {
  currentModalDebt = deuda;
  const items = deuda.items || [{ detalle: deuda.producto || 'Producto', cantidad: deuda.cantidad || 0, precio_unitario: deuda.precio_unitario || 0 }];
  const total = getDebtTotal(deuda);
  const totalUsd = deuda.moneda === 'USD' ? total : dailyRate ? total / dailyRate : 0;
  const totalBs = deuda.moneda === 'BS' ? total : total * dailyRate;

  elements.modalClient.textContent = deuda.cliente;
  elements.modalTotalUsd.textContent = deuda.moneda === 'USD'
    ? formatCurrency(totalUsd, 'en-US', 'USD')
    : dailyRate ? formatCurrency(totalUsd, 'en-US', 'USD') : 'N/A';
  elements.modalTotalBs.textContent = formatBs(totalBs);

  elements.modalItemsList.innerHTML = items.map((item) => {
    const lineTotal = item.cantidad * item.precio_unitario;
    return `
      <li class="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
        <p class="font-semibold text-white">${item.detalle}</p>
        <p class="text-slate-400 text-sm">${item.cantidad} x ${deuda.moneda === 'USD' ? formatCurrency(item.precio_unitario, 'en-US', 'USD') : formatBs(item.precio_unitario)}</p>
        <p class="mt-2 text-slate-200">Subtotal: <span class="font-semibold text-white">${deuda.moneda === 'USD' ? formatCurrency(lineTotal, 'en-US', 'USD') : formatBs(lineTotal)}</span></p>
      </li>
    `;
  }).join('');

  // Add payments
  const pagos = await db.pagos.where('deuda_id').equals(deuda.id).toArray();
  if (pagos.length > 0) {
    elements.modalItemsList.innerHTML += '<h3 class="text-white font-semibold mt-4">Abonos</h3>' + pagos.map((pago) => `
      <li class="rounded-3xl border border-green-700 bg-green-950/20 p-4">
        <p class="font-semibold text-green-200">${formatCurrency(pago.amount, 'en-US', pago.currency === 'USD' ? 'USD' : 'VES')} (${pago.currency})</p>
        <p class="text-slate-400 text-sm">${formatDate(pago.date)}</p>
      </li>
    `).join('');
  }

  elements.debtModal.classList.remove('hidden');
}

function closeDebtModal() {
  elements.debtModal.classList.add('hidden');
  currentModalDebt = null;
}

// Funciones para modales personalizados
function showConfirmModal(message, cancelText = 'Cancelar', acceptText = 'Aceptar') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    elements.confirmMessage.textContent = message;
    elements.confirmCancel.textContent = cancelText;
    elements.confirmAccept.textContent = acceptText;
    elements.confirmModal.classList.remove('hidden');
  });
}

function hideConfirmModal(result) {
  elements.confirmModal.classList.add('hidden');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function showPromptModal(message, defaultValue = '') {
  return new Promise((resolve) => {
    promptResolve = resolve;
    elements.promptMessage.textContent = message;
    elements.promptInput.value = defaultValue;
    elements.promptModal.classList.remove('hidden');
    elements.promptInput.focus();
  });
}

function hidePromptModal(result) {
  elements.promptModal.classList.add('hidden');
  if (promptResolve) {
    promptResolve(result);
    promptResolve = null;
  }
}

async function copyDebtDetail() {
  if (!currentModalDebt) return;
  const useUsd = await showConfirmModal('¿En qué moneda deseas copiar el detalle?', 'Bs', 'USD');
  const pagos = await db.pagos.where('deuda_id').equals(currentModalDebt.id).toArray();
  const text = buildCopyText(currentModalDebt, useUsd, pagos);
  navigator.clipboard.writeText(text).then(() => {
    alert(useUsd ? 'Detalle copiado en USD.' : 'Detalle copiado en Bs.');
  }).catch(() => {
    alert('No se pudo copiar en el portapapeles.');
  });
}

function buildCopyText(deuda, inUsd, pagos = []) {
  const items = deuda.items || [{ detalle: deuda.producto || 'Producto', cantidad: deuda.cantidad || 0, precio_unitario: deuda.precio_unitario || 0 }];
  const total = getDebtTotal(deuda);
  const totalUsd = deuda.moneda === 'USD' ? total : dailyRate ? total / dailyRate : 0;
  const totalBs = deuda.moneda === 'BS' ? total : total * dailyRate;

  const lines = [
    deuda.cliente,
    ''
  ];

  items.forEach((item) => {
    const itemTotal = item.cantidad * item.precio_unitario;
    const unitPriceUsd = deuda.moneda === 'USD' ? item.precio_unitario : dailyRate ? item.precio_unitario / dailyRate : 0;
    const itemTotalUsd = deuda.moneda === 'USD' ? itemTotal : dailyRate ? itemTotal / dailyRate : 0;
    const unitPriceText = formatCurrency(unitPriceUsd, 'en-US', 'USD');
    const itemTotalText = formatCurrency(itemTotalUsd, 'en-US', 'USD');

    lines.push(`${item.detalle}:`);
    lines.push(`${item.cantidad} x ${unitPriceText} = ${itemTotalText}`);
    lines.push('');
  });

  if (inUsd) {
    // Solo USD
    const totalText = formatCurrency(totalUsd, 'en-US', 'USD');
    lines.push(`Total deuda: ${totalText}`);
  } else {
    // Bs y USD
    const totalBsText = formatBs(totalBs);
    const totalUsdText = formatCurrency(totalUsd, 'en-US', 'USD');
    lines.push(`Total deuda: ${totalBsText}`);
    lines.push(`Total deuda: ${totalUsdText}`);
  }

  // Incluir abonos
  if (pagos.length > 0) {
    lines.push('');
    lines.push('Abonos realizados:');
    let totalAbonadoBs = 0;
    let totalAbonadoUsd = 0;
    pagos.forEach((pago) => {
      const pagoAmountBs = pago.currency === 'BS' ? pago.amount : pago.amount * dailyRate;
      const pagoAmountUsd = pago.currency === 'USD' ? pago.amount : dailyRate ? pago.amount / dailyRate : 0;
      totalAbonadoBs += pagoAmountBs;
      totalAbonadoUsd += pagoAmountUsd;
      const pagoBsText = formatBs(pagoAmountBs);
      const date = new Date(pago.date).toLocaleDateString('es-ES');
      lines.push(`${date}: ${pagoBsText}`);
    });
    const totalAbonadoBsText = formatBs(totalAbonadoBs);
    lines.push(`Total abonado: ${totalAbonadoBsText}`);

    const restanteBs = totalBs - totalAbonadoBs;
    const restanteUsd = totalUsd - totalAbonadoUsd;
    const restanteBsText = formatBs(Math.max(0, restanteBs));
    const restanteUsdText = formatCurrency(Math.max(0, restanteUsd), 'en-US', 'USD');

    if (inUsd) {
      lines.push(`Restante: ${restanteUsdText}`);
    } else {
      lines.push(`Restante: ${restanteBsText}`);
      lines.push(`Restante: ${restanteUsdText}`);
    }
  }

  return lines.join('\n');
}

function handleRateChange(event) {
  dailyRate = Number(event.target.value) || 0;
  elements.dailyRateDisplay.textContent = dailyRate.toFixed(2);
  elements.dailyRateHint.textContent = `Tasa actualizada a Bs ${dailyRate.toFixed(2)}.`;
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncRate();
  }
}

async function syncRate() {
  try {
    const { error } = await supabaseClient
      .from('tasas_diarias')
      .upsert({ fecha: new Date().toISOString().split('T')[0], tasa: dailyRate });
    if (error) throw error;
  } catch (error) {
    console.warn('Error sincronizando tasa:', error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const cliente = elements.clienteInput.value.trim();
  const items = getFormItems().filter((item) => item.detalle && item.cantidad > 0 && item.precio_unitario > 0);
  const moneda = document.querySelector('input[name="moneda"]:checked').value;
  const tasa_transaccion = moneda === 'BS' ? Number(elements.tasaTransaccionInput.value) || dailyRate : 0;

  if (!cliente || !items.length) {
    alert('Por favor completa el cliente y al menos un producto con valores válidos.');
    return;
  }

  const invalidItem = items.find((item) => item.cantidad <= 0 || item.precio_unitario <= 0 || !item.detalle);
  if (invalidItem) {
    alert('Verifica que cada producto tenga nombre, cantidad y precio unitario válidos.');
    return;
  }

  const total = items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);

  if (editingDebtId) {
    // Actualizar deuda existente
    await db.deudas.update(editingDebtId, {
      cliente,
      items,
      total,
      moneda,
      tasa_transaccion,
      sync_status: 0
    });
    cancelEditing();
    elements.syncStatus.textContent = '🟡 Cambios pendientes';
    elements.syncStatus.classList.add('text-amber-300');
    elements.syncStatus.classList.remove('text-emerald-300');
  } else {
    // Agregar nueva deuda
    const deuda = {
      id: crypto.randomUUID(),
      cliente,
      items,
      total,
      moneda,
      tasa_transaccion,
      fecha: new Date().toISOString(),
      estado: 'PENDIENTE',
      sync_status: 0
    };
    await db.deudas.add(deuda);
    elements.syncStatus.textContent = '🟡 Guardado localmente';
    elements.syncStatus.classList.add('text-amber-300');
    elements.syncStatus.classList.remove('text-emerald-300');
    elements.debtForm.reset();
    resetItemRows();
    toggleTransaccionField();
  }

  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

function formatCurrency(value, locale = 'es-VE', currency = 'USD') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

function formatBs(value) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(value).replace('VES', 'Bs');
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

function getDebtTotal(deuda) {
  if (typeof deuda.total === 'number') {
    return deuda.total;
  }
  if (Array.isArray(deuda.items)) {
    return deuda.items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);
  }
  return (deuda.cantidad || 0) * (deuda.precio_unitario || 0);
}

async function loadData() {
  await loadInitialRate();
  await syncFromServer(); // Cargar deudas desde Supabase
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

async function loadInitialRate() {
  if (!navigator.onLine) return;
  try {
    const { data, error } = await supabaseClient
      .from('tasas_diarias')
      .select('tasa')
      .eq('fecha', new Date().toISOString().split('T')[0])
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      dailyRate = Number(data[0].tasa);
      elements.dailyRateInput.value = dailyRate.toFixed(2);
      elements.dailyRateDisplay.textContent = dailyRate.toFixed(2);
    }
  } catch (error) {
    console.warn('No se pudo cargar la tasa inicial:', error);
  }
}

async function syncFromServer() {
  if (!navigator.onLine) return;
  try {
    const { data: deudasData, error: deudasError } = await supabaseClient
      .from('deudas')
      .select('*');
    if (deudasError) throw deudasError;

    const { data: pagosData, error: pagosError } = await supabaseClient
      .from('pagos')
      .select('*');
    if (pagosError) throw pagosError;

    // Insertar deudas en local DB si no existen
    for (const deuda of deudasData || []) {
      const existing = await db.deudas.get(deuda.id);
      if (!existing) {
        await db.deudas.add({
          id: deuda.id,
          cliente: deuda.cliente,
          items: JSON.parse(deuda.items || '[]'),
          total: deuda.total,
          moneda: deuda.moneda,
          tasa_transaccion: deuda.tasa_transaccion,
          fecha: deuda.fecha,
          estado: deuda.estado,
          sync_status: 1
        });
      }
    }

    // Insertar pagos en local DB si no existen
    for (const pago of pagosData || []) {
      const existing = await db.pagos.get(pago.id);
      if (!existing) {
        await db.pagos.add({
          id: pago.id,
          deuda_id: pago.deuda_id,
          amount: pago.amount,
          currency: pago.currency,
          date: pago.date
        });
      }
    }
  } catch (error) {
    console.warn('Error sincronizando desde servidor:', error);
  }
}

async function getFilteredDebts() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const allDeudas = await db.deudas.toArray();
  allDeudas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return allDeudas.filter((deuda) => {
    const matchSearch = deuda.cliente.toLowerCase().includes(searchTerm);
    const matchFilter = currentFilter === 'ALL' || deuda.estado === currentFilter;
    return matchSearch && matchFilter;
  });
}

async function renderDebtList() {
  const deudas = await getFilteredDebts();
  elements.debtList.innerHTML = '';

  if (!deudas.length) {
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');

  deudas.forEach((deuda) => {
    const items = deuda.items || [{ detalle: deuda.producto || 'Producto', cantidad: deuda.cantidad || 0, precio_unitario: deuda.precio_unitario || 0 }];
    const total = getDebtTotal(deuda);
    const monto = deuda.moneda === 'USD' ? formatCurrency(total, 'en-US', 'USD') : formatBs(total);
    const badge = deuda.moneda === 'USD' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-amber-500/15 text-amber-200';
    const stateColor = deuda.estado === 'PAGADO' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700/80 text-slate-100';
    const detailSummary = items.map((item) => `${item.detalle} x${item.cantidad}`).join(' • ');

    const card = document.createElement('article');
    card.className = 'rounded-3xl border border-slate-700 bg-slate-950/90 p-5 shadow-sm shadow-slate-950/10';
    card.innerHTML = `
      <div class="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">${deuda.cliente}</p>
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${badge}">${deuda.moneda}</span>
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${stateColor}">${deuda.estado}</span>
          </div>
          <h3 class="text-xl font-semibold text-white">Detalle de deuda</h3>
          <p class="text-slate-400">${detailSummary}</p>
          <p class="text-slate-400">Total deuda: <span class="font-semibold text-white">${monto}</span></p>
          <p class="text-sm text-slate-500">Registrado: ${formatDate(deuda.fecha)}</p>
        </div>
        <div class="flex flex-col items-start gap-3 sm:items-end">
          <p class="text-slate-400">Sync: ${deuda.sync_status === 1 ? 'Sí' : 'No'}</p>
          <div class="flex flex-wrap gap-3">
            <button data-id="${deuda.id}" class="view-detail-btn rounded-3xl border border-cyan-500/30 bg-slate-950 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10">Ver detalle</button>
            <button data-id="${deuda.id}" class="edit-btn rounded-3xl border border-amber-500/30 bg-slate-950 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/10">Editar</button>
            <button data-id="${deuda.id}" class="delete-btn rounded-3xl border border-rose-500/30 bg-slate-950 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10">Eliminar</button>
            <button data-id="${deuda.id}" class="abono-btn rounded-3xl border border-green-500/30 bg-slate-950 px-5 py-3 text-sm font-semibold text-green-200 transition hover:bg-green-500/10">Abonar</button>
            <button data-id="${deuda.id}" class="mark-paid-btn rounded-3xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 ${deuda.estado === 'PAGADO' ? 'opacity-50 cursor-not-allowed' : ''}">Marcar pagado</button>
          </div>
        </div>
      </div>
    `;

    elements.debtList.appendChild(card);
  });

  document.querySelectorAll('.view-detail-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const deuda = await db.deudas.get(id);
      if (!deuda) return;
      await openDebtModal(deuda);
    });
  });

  document.querySelectorAll('.edit-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const deuda = await db.deudas.get(id);
      if (!deuda) return;
      startEditing(deuda);
    });
  });

  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      await deleteDebt(id);
    });
  });

  document.querySelectorAll('.mark-paid-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const deuda = await db.deudas.get(id);
      if (!deuda || deuda.estado === 'PAGADO') return;
      await db.deudas.update(id, { estado: 'PAGADO', sync_status: 0 });
      elements.syncStatus.textContent = '🟡 Cambios pendientes';
      elements.syncStatus.classList.add('text-amber-300');
      elements.syncStatus.classList.remove('text-emerald-300');
      renderDebtList();
      calculateSummary();
      if (navigator.onLine) {
        syncPendingRecords();
      }
    });
  });

  document.querySelectorAll('.abono-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const deuda = await db.deudas.get(id);
      if (!deuda || deuda.estado === 'PAGADO') return;
      addAbono(deuda);
    });
  });
}

async function addAbono(deuda) {
  const amount = await showPromptModal('Monto del abono:');
  if (!amount || isNaN(amount) || amount <= 0) return;

  const currency = await showConfirmModal('¿En qué moneda es el abono?', 'Bs', 'USD') ? 'USD' : 'BS';

  let convertedAmount = Number(amount);
  if (deuda.moneda === 'USD' && currency === 'BS') {
    convertedAmount = amount / dailyRate;
  } else if (deuda.moneda === 'BS' && currency === 'USD') {
    convertedAmount = amount * dailyRate;
  }

  const newTotal = Math.max(0, deuda.total - convertedAmount);

  // Update debt
  await db.deudas.update(deuda.id, { total: newTotal, sync_status: 0 });

  // Add payment
  await db.pagos.add({
    id: crypto.randomUUID(),
    deuda_id: deuda.id,
    amount: Number(amount),
    currency,
    date: new Date().toISOString()
  });

  elements.syncStatus.textContent = '🟡 Cambios pendientes';
  elements.syncStatus.classList.add('text-amber-300');
  elements.syncStatus.classList.remove('text-emerald-300');
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

async function calculateSummary() {
  const allDeudas = await db.deudas.toArray();
  const pendientes = allDeudas.filter((deuda) => deuda.estado === 'PENDIENTE');
  const totalUsd = pendientes
    .filter((deuda) => deuda.moneda === 'USD')
    .reduce((sum, deuda) => sum + getDebtTotal(deuda), 0);
  const totalBsDirect = pendientes
    .filter((deuda) => deuda.moneda === 'BS')
    .reduce((sum, deuda) => sum + getDebtTotal(deuda), 0);
  const totalBsFromUsd = totalUsd * dailyRate;
  elements.totalUsd.textContent = formatCurrency(totalUsd, 'en-US', 'USD');
  elements.totalBs.textContent = formatBs(totalBsDirect + totalBsFromUsd);
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  elements.connectionStatus.textContent = online ? '🟢 Online' : '🔴 Offline';
  elements.connectionStatus.classList.toggle('text-emerald-300', online);
  elements.connectionStatus.classList.toggle('text-rose-400', !online);
}

async function handleOnline() {
  updateConnectionStatus();
  elements.syncStatus.textContent = '⏳ Sincronizando...';
  elements.syncStatus.classList.remove('text-emerald-300');
  elements.syncStatus.classList.remove('text-rose-400');
  elements.syncStatus.classList.add('text-amber-300');
  await syncPendingRecords();
}

async function syncPendingRecords() {
  const pending = await db.deudas.where('sync_status').equals(0).toArray();
  if (!pending.length) {
    elements.syncStatus.textContent = '✅ Sincronizado';
    elements.syncStatus.classList.add('text-emerald-300');
    elements.syncStatus.classList.remove('text-amber-300');
    return;
  }

  try {
    for (const deuda of pending) {
      const { error } = await supabaseClient
        .from('deudas')
        .upsert({
          id: deuda.id,
          cliente: deuda.cliente,
          items: JSON.stringify(deuda.items),
          total: deuda.total,
          moneda: deuda.moneda,
          tasa_transaccion: deuda.tasa_transaccion,
          fecha: deuda.fecha,
          estado: deuda.estado,
          sync_status: 1
        });
      if (error) throw error;
    }
    await Promise.all(pending.map((deuda) => db.deudas.update(deuda.id, { sync_status: 1 })));
    elements.syncStatus.textContent = '✅ Sincronizado';
    elements.syncStatus.classList.add('text-emerald-300');
    elements.syncStatus.classList.remove('text-amber-300');
    renderDebtList();
  } catch (error) {
    console.error('Error sincronizando:', error);
    elements.syncStatus.textContent = '❌ Error de sincronización';
    elements.syncStatus.classList.add('text-rose-400');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Service Worker no pudo registrarse:', error);
    });
  }
}
