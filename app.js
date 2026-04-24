const db = new Dexie('DeudasLocalDB');
db.version(1).stores({
  deudas: 'id, cliente, estado, sync_status, fecha, moneda'
});

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
  cancelEditBtn: document.getElementById('cancelEditBtn')
};

let currentFilter = 'ALL';
let dailyRate = 30.00;
let currentModalDebt = null;
let editingDebtId = null;

function initUI() {
  resetItemRows(); // Asegurar que se ejecute primero
  updateConnectionStatus();
  elements.dailyRateInput.value = dailyRate.toFixed(2);
  elements.dailyRateDisplay.textContent = dailyRate.toFixed(2);
  elements.debtForm.addEventListener('submit', handleFormSubmit);
  elements.dailyRateInput.addEventListener('change', handleRateChange);
  elements.searchInput.addEventListener('input', renderDebtList);
  elements.addItemButton.addEventListener('click', addItemRow);
  elements.modalCopyButton.addEventListener('click', copyDebtDetail);
  elements.modalCloseButton.addEventListener('click', closeDebtModal);
  elements.cancelEditBtn.addEventListener('click', cancelEditing);
  elements.debtModal.addEventListener('click', (event) => {
    if (event.target === elements.debtModal) {
      closeDebtModal();
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
  if (!confirm('¿Estás seguro de que quieres eliminar esta deuda? Esta acción no se puede deshacer.')) return;
  await db.deudas.delete(debtId);
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

function openDebtModal(deuda) {
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

  elements.debtModal.classList.remove('hidden');
}

function closeDebtModal() {
  elements.debtModal.classList.add('hidden');
  currentModalDebt = null;
}

function copyDebtDetail() {
  if (!currentModalDebt) return;
  const useUsd = confirm('¿Deseas copiar el detalle en USD? Presiona Aceptar para USD, Cancelar para Bs.');
  const text = buildCopyText(currentModalDebt, useUsd);
  navigator.clipboard.writeText(text).then(() => {
    alert(useUsd ? 'Detalle copiado en USD.' : 'Detalle copiado en Bs.');
  }).catch(() => {
    alert('No se pudo copiar en el portapapeles.');
  });
}

function buildCopyText(deuda, inUsd) {
  const items = deuda.items || [{ detalle: deuda.producto || 'Producto', cantidad: deuda.cantidad || 0, precio_unitario: deuda.precio_unitario || 0 }];
  const total = getDebtTotal(deuda);
  const convertedTotal = inUsd
    ? deuda.moneda === 'USD'
      ? total
      : dailyRate ? total / dailyRate : 0
    : deuda.moneda === 'BS'
      ? total
      : total * dailyRate;
  const currencySymbol = inUsd ? '$' : 'Bs';
  const totalText = inUsd
    ? (dailyRate ? formatCurrency(convertedTotal, 'en-US', 'USD') : 'N/A')
    : formatBs(convertedTotal);

  const lines = [
    deuda.cliente,
    ''
  ];

  items.forEach((item) => {
    const itemTotal = item.cantidad * item.precio_unitario;
    const unitPrice = inUsd
      ? deuda.moneda === 'USD'
        ? item.precio_unitario
        : dailyRate ? item.precio_unitario / dailyRate : 0
      : deuda.moneda === 'BS'
        ? item.precio_unitario
        : item.precio_unitario * dailyRate;
    const lineTotal = inUsd
      ? deuda.moneda === 'USD'
        ? itemTotal
        : dailyRate ? itemTotal / dailyRate : 0
      : deuda.moneda === 'BS'
        ? itemTotal
        : itemTotal * dailyRate;
    const unitPriceText = inUsd
      ? formatCurrency(unitPrice, 'en-US', 'USD')
      : formatBs(unitPrice);
    const lineTotalText = inUsd
      ? formatCurrency(lineTotal, 'en-US', 'USD')
      : formatBs(lineTotal);

    lines.push(`${item.detalle}:`);
    lines.push(`${item.cantidad} x ${unitPriceText} = ${lineTotalText}`);
    lines.push('');
  });

  lines.push(`Total deuda: ${totalText}`);

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
    await fetch(`${API_BASE}/api/tasa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasa: dailyRate }),
    });
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
  renderDebtList();
  calculateSummary();
  if (navigator.onLine) {
    syncPendingRecords();
  }
}

async function loadInitialRate() {
  if (!navigator.onLine) return;
  try {
    const response = await fetch(`${API_BASE}/api/tasa`);
    if (response.ok) {
      const data = await response.json();
      dailyRate = Number(data.tasa);
      elements.dailyRateInput.value = dailyRate.toFixed(2);
      elements.dailyRateDisplay.textContent = dailyRate.toFixed(2);
    }
  } catch (error) {
    console.warn('No se pudo cargar la tasa inicial:', error);
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
      openDebtModal(deuda);
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
    const response = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pending),
    });
    if (!response.ok) throw new Error('Error en sincronización');
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
