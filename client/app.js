const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const state = { user: null, csrf: '', currency: 'INR', page: 'dashboard', listPage: 1, q: '', status: '', archived: false, sort: 'recent', data: null };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.currency, maximumFractionDigits: 2 }).format((value || 0) / 100);
const date = value => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
const isManager = () => ['Manager', 'Administrator'].includes(state.user?.role);
let toastTimer;
let generation = 0, sessionEpoch = 0, pendingReport;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4500); }
async function api(path, method = 'GET', body, key = crypto.randomUUID(), options = {}) {
  const epoch = sessionEpoch;
  const response = await fetch(`/api${path}`, { method, signal: options.signal, headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRF-Token': state.csrf, 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (epoch !== sessionEpoch) throw new DOMException('Session changed', 'AbortError');
  if (!response.ok) { if (response.status === 401 && path !== '/auth/login') login(); throw Object.assign(new Error(data.error || 'Request failed'), { status: response.status, code: data.code }); }
  return data;
}
const field = (label, name, value = '', type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${escape(value)}" type="${type}" ${extra} required></label>`;
const selectField = (label, name, values, selected) => `<label class="field"><span>${label}</span><select name="${name}">${values.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
function login() {
  ++generation; ++sessionEpoch; pendingReport?.abort(); pendingReport = null; closeNavigation(false);
  Object.assign(state, { user: null, csrf: '', page: 'dashboard', listPage: 1, q: '', status: '', archived: false, data: null }); modal.close();
  root.innerHTML = `<div class="login"><section class="login-art"><div class="brand">forma<span>.</span></div><h1>Business in motion.<br>Operations in order.</h1><p>A clear view of your customers, inventory, and sales. One connected workspace for the work that matters.</p></section><section class="login-form"><form id="login"><div class="eyebrow">Business Operations</div><h1>Welcome back</h1><p>Sign in to your business workspace.</p>${field('Email address', 'email', '', 'email', 'autocomplete="username"')}${field('Password', 'password', '', 'password', 'autocomplete="current-password"')}<p class="error" role="alert"></p><button class="primary" type="submit">Sign in</button><p class="secondary">Accounts are managed by your administrator.</p></form></section></div>`;
  document.querySelector('#login').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { const result = await api('/auth/login', 'POST', Object.fromEntries(new FormData(form))); Object.assign(state, result); await bootstrap(); } catch (e) { form.querySelector('.error').textContent = e.message; } finally { button.disabled = false; } };
}
const pages = { dashboard: ['Overview', '◈'], customers: ['Customers', '◎'], products: ['Catalog', '▦'], orders: ['Orders', '▤'], movements: ['Inventory history', '↔'], reports: ['Reports', '▥'], audit: ['Activity history', '◷'], users: ['Team & access', '♧'] };
const mobileNavigation = matchMedia('(max-width:700px)');
let navigationTrigger;
function closeNavigation(restoreFocus = true) {
  const drawer = document.querySelector('.sidebar');
  drawer?.classList.remove('open');
  drawer?.removeAttribute('role'); drawer?.removeAttribute('aria-modal'); drawer?.removeAttribute('aria-label');
  const workspace = document.querySelector('.workspace'); if (workspace) workspace.inert = false;
  const backdrop = document.querySelector('.nav-backdrop'); if (backdrop) backdrop.hidden = true;
  const close = document.querySelector('.nav-close'); if (close) close.hidden = true;
  document.querySelector('.mobile-menu')?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', navigationKeydown);
  if (restoreFocus && navigationTrigger?.isConnected && mobileNavigation.matches) navigationTrigger.focus();
  navigationTrigger = null;
}
function openNavigation() {
  if (!mobileNavigation.matches) return;
  if (document.querySelector('.sidebar.open')) { closeNavigation(); return; }
  navigationTrigger = document.querySelector('.mobile-menu');
  const drawer = document.querySelector('.sidebar'); drawer.classList.add('open');
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'Main navigation');
  document.querySelector('.workspace').inert = true;
  document.querySelector('.nav-backdrop').hidden = false;
  const close = drawer.querySelector('.nav-close'); close.hidden = false;
  navigationTrigger.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', navigationKeydown); close.focus();
}
function navigationKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeNavigation(); return; }
  if (event.key !== 'Tab') return;
  const buttons = [...document.querySelectorAll('.sidebar button:not([hidden]):not(:disabled)')];
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
mobileNavigation.addEventListener('change', () => closeNavigation(false));
function shell() {
  closeNavigation(false);
  root.innerHTML = `<div class="shell"><div class="nav-backdrop" hidden></div><aside class="sidebar" id="navigation-drawer"><button class="nav-close" aria-label="Close navigation" hidden>Close navigation</button><div class="brand">forma<span>.</span></div><div class="brand-note">BUSINESS OPERATIONS</div><nav class="nav" aria-label="Main navigation">${Object.entries(pages).filter(([key]) => !(['reports', 'movements', 'audit'].includes(key) && !isManager()) && !(key === 'users' && state.user.role !== 'Administrator')).map(([key, [label, icon]]) => `<button data-page="${key}" class="${key === state.page ? 'active' : ''}"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><strong>${escape(state.user.name)}</strong>${escape(state.user.role)}<br>Connected business workspace</div></aside><section class="workspace"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="mobile-menu" aria-label="Toggle navigation" aria-controls="navigation-drawer" aria-expanded="false">☰</button><span class="eyebrow">Your business workspace</span></div><div class="topbar-actions"><div class="avatar">${escape(state.user.name.slice(0, 1))}</div><button id="account">Account</button><button id="logout">Sign out</button></div></header><main id="main"></main></section></div>`;
  document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => navigate(button.dataset.page));
  document.querySelector('.mobile-menu').onclick = openNavigation;
  document.querySelector('.nav-close').onclick = () => closeNavigation();
  document.querySelector('.nav-backdrop').onclick = () => closeNavigation();
  document.querySelector('#logout').onclick = async () => { try { await api('/auth/logout', 'POST'); login(); } catch (e) { toast(e.message); } };
  document.querySelector('#account').onclick = () => formModal('Change password', `${field('Current password', 'current', '', 'password', 'autocomplete="current-password"')}${field('New password (at least 12 characters)', 'password', '', 'password', 'minlength="12" autocomplete="new-password"')}`, async data => { await api('/auth/password', 'POST', data); login(); toast('Password changed. Please sign in again.'); });
}
async function bootstrap() { const result = await api('/auth/me'); Object.assign(state, result); shell(); await load(); }
function heading(title, description, action = '') { return `<div class="page-heading"><div><div class="eyebrow">Business operations</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`; }
function table(headers, rows, empty = 'No records yet', hint = 'Create your first record to get started.') { return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}"><div class="empty"><strong>${empty}</strong>${hint}</div></td></tr>`}</tbody></table></div>`; }
function pagination(data) { return `<div class="pagination"><span>${data.total} record${data.total === 1 ? '' : 's'} · Page ${data.page} of ${Math.max(1, Math.ceil(data.total / data.limit))}</span><div><button id="previous" ${data.page <= 1 ? 'disabled' : ''}>Previous</button><button id="next" ${data.page * data.limit >= data.total ? 'disabled' : ''}>Next</button></div></div>`; }
function bindPagination() { const prev = document.querySelector('#previous'), next = document.querySelector('#next'); if (prev) prev.onclick = () => { state.listPage--; load(); }; if (next) next.onclick = () => { state.listPage++; load(); }; }
function navigate(page) { const drawerOpen = !!document.querySelector('.sidebar.open'); state.page = page; state.listPage = 1; state.q = ''; state.status = ''; state.archived = false; shell(); if (drawerOpen) document.querySelector('.mobile-menu').focus(); load(); }
async function load() {
  const main = document.querySelector('#main'); if (!main) return; const current = ++generation; pendingReport?.abort(); pendingReport = null;
  main.innerHTML = '<div class="loading" role="status">Loading your workspace…</div>';
  try {
    if (state.page === 'reports') { renderReports(); return; }
    const params = new URLSearchParams({ page: state.listPage, q: state.q, sort: state.sort, archived: state.archived, ...(state.status ? { status: state.status } : {}) });
    const data = await api(`/${state.page}?${params}`); if (current !== generation || !main.isConnected || !state.user) return; state.data = data;
    if (state.page === 'dashboard') renderDashboard(data); else if (['customers', 'products'].includes(state.page)) renderMaster(data); else if (state.page === 'orders') renderOrders(data); else renderHistory(data);
    bindPagination();
  } catch (e) { if (current !== generation || !main.isConnected || !state.user) return; main.innerHTML = `<div class="empty"><strong>We couldn’t load this page</strong>${escape(e.message)}<p><button id="retry">Try again</button></p></div>`; document.querySelector('#retry').onclick = load; }
}
function renderDashboard(data) {
  const cards = [['Confirmed sales', money(data.totals.sales), 'Confirmed and fulfilled orders'], ['Outstanding balance', money(data.totals.sales - data.totals.paid), 'Manual payment records'], ['Sales orders', data.totals.orders, 'Confirmed and fulfilled orders'], ['Customers', data.customers, 'Active customer records']];
  const max = Math.max(1, ...data.trend.map(d => d.total));
  document.querySelector('#main').innerHTML = `${heading('Business overview', 'A clear picture of your business, built from live records.', '<button class="primary" id="create-order">+ New order</button>')}<div class="cards">${cards.map(([label, value, foot]) => `<div class="card"><div class="card-label">${label}</div><div class="metric">${value}</div><div class="card-foot">${foot}</div></div>`).join('')}</div><div class="grid-two"><section class="panel"><div class="panel-head"><h2>Sales activity</h2><span class="tag">Last 30 days · ${escape(state.currency)}</span></div><div class="panel-body">${data.trend.length ? `<div class="chart" role="img" aria-label="Daily confirmed sales"><div class="sr-description" hidden>${escape(JSON.stringify(data.trend))}</div>${data.trend.map(d => `<div class="chart-column"><div class="chart-bar" style="height:${Math.max(2, d.total / max * 160)}px" title="${escape(d._id)}: ${escape(money(d.total))}"></div><span class="chart-label">${d._id.slice(5)}</span></div>`).join('')}</div><details><summary>View chart data</summary>${table(['Date', 'Sales'], data.trend.map(d => `<tr><td>${d._id}</td><td>${money(d.total)}</td></tr>`))}</details>` : '<div class="empty"><strong>Your sales story starts here</strong>Confirm an order to see real sales activity.</div>'}</div></section><section class="panel"><div class="panel-head"><h2>Stock attention</h2><span class="tag">${data.lowStock.length} shown</span></div><div class="panel-body">${data.lowStock.length ? data.lowStock.map(p => `<div class="work-item"><div><strong>${escape(p.name)}</strong><small>${escape(p.sku)} · Reorder threshold ${p.reorderLevel}</small></div><span class="tag confirmed">${p.stock} on hand</span></div>`).join('') : '<div class="empty"><strong>No low-stock items</strong>Inventory is above configured thresholds.</div>'}</div></section></div><section class="panel"><div class="panel-head"><h2>Pending fulfillment</h2><button id="view-orders">View orders →</button></div>${table(['Order', 'Customer', 'Total', 'Outstanding', 'Action'], data.pending.map(o => `<tr><td class="table-name">${escape(o.number)}</td><td>${escape(o.customerName)}</td><td>${money(o.total)}</td><td>${money(o.total - o.paid)}</td><td><button data-order="${o._id}">Review</button></td></tr>`), 'Nothing waiting for fulfillment', 'Confirmed orders will appear here.')}</section>`;
  const balances = document.createElement('section'); balances.className = 'panel'; balances.style.marginTop = '24px'; balances.innerHTML = `<div class="panel-head"><h2>Outstanding balances</h2><span class="tag">Up to 10 oldest orders</span></div>${table(['Order', 'Customer', 'Balance', 'Action'], data.outstanding.map(o => `<tr><td>${escape(o.number)}</td><td>${escape(o.customerName)}</td><td>${money(o.total - o.paid)}</td><td><button data-order="${o._id}">Review</button></td></tr>`), 'No outstanding balances', 'Confirmed orders with a balance will appear here.')}`; document.querySelector('#main').append(balances);
  document.querySelector('#create-order').onclick = createOrder; document.querySelector('#view-orders').onclick = () => navigate('orders'); bindOrderButtons();
}
function renderMaster(data) {
  const products = state.page === 'products';
  document.querySelector('#main').innerHTML = `${heading(products ? 'Products & services' : 'Customers', products ? 'A consistent catalog, with stock you can trust.' : 'Keep your business relationships organized.', !products || isManager() ? `<button class="primary" id="create">+ ${products ? 'Catalog item' : 'Customer'}</button>` : '')}<form id="filters" class="toolbar"><input name="q" aria-label="Search by name" placeholder="Search by name…" value="${escape(state.q)}"><select name="sort" aria-label="Sort records"><option value="recent">Newest first</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Name A–Z</option></select><select name="archived" aria-label="Record visibility"><option value="false">Active records</option><option value="true" ${state.archived ? 'selected' : ''}>Archived records</option></select><button>Apply</button></form><section class="panel">${table(products ? ['Item', 'SKU', 'Type', 'Unit price', 'Stock', 'Actions'] : ['Customer', 'Code', 'Email', 'Phone', 'Actions'], data.items.map(p => products ? `<tr><td class="table-name">${escape(p.name)}</td><td>${escape(p.sku)}</td><td><span class="tag">${p.type}</span></td><td>${money(p.price)}</td><td>${p.type === 'service' ? '—' : `${p.stock}${p.stock <= p.reorderLevel ? ' · Low' : ''}`}</td><td><div class="row-actions">${isManager() ? `<button data-edit="${p._id}">Edit</button>${p.type === 'product' && !p.archived ? `<button data-adjust="${p._id}">Adjust stock</button>` : ''}` : 'View only'}</div></td></tr>` : `<tr><td class="table-name">${escape(p.name)}</td><td>${escape(p.code)}</td><td>${escape(p.email) || '—'}</td><td>${escape(p.phone) || '—'}</td><td><button data-edit="${p._id}">Edit</button></td></tr>`))}${pagination(data)}</section>`;
  document.querySelector('#filters').onsubmit = event => { event.preventDefault(); const filters = Object.fromEntries(new FormData(event.currentTarget)); Object.assign(state, filters, { archived: filters.archived === 'true', listPage: 1 }); load(); };
  const create = document.querySelector('#create'); if (create) create.onclick = () => editMaster();
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editMaster(data.items.find(p => p._id === button.dataset.edit)));
  document.querySelectorAll('[data-adjust]').forEach(button => button.onclick = () => { const product = data.items.find(p => p._id === button.dataset.adjust); formModal(`Adjust stock · ${product.name}`, `<p>On hand: ${product.stock}. Enter a positive or negative quantity.</p>${field('Stock change', 'delta', '', 'number', 'step="1" min="-100000" max="100000"')}${field('Reason', 'reason')}`, async (form, key) => { await api(`/products/${product._id}/adjust`, 'POST', { delta: Number(form.delta), reason: form.reason }, key); }); });
}
function editMaster(record, edits = {}, reloaded = false) {
  const products = state.page === 'products', path = state.page, original = record;
  if (record) record = { ...record, ...edits };
  const fields = products ? `<div class="form-grid">${field('Item name', 'name', record?.name)}${field('SKU / code', 'sku', record?.sku)}${record ? field('Item type', 'type', record.type, 'text', 'readonly') : selectField('Item type', 'type', ['product', 'service'], 'product')}${field('Unit price (currency units)', 'price', record ? record.price / 100 : '', 'number', 'min="0" max="1000000" step="0.01"')}${field('Reorder threshold', 'reorderLevel', record?.reorderLevel || 0, 'number', 'min="0" max="100000" step="1"')}</div><p class="secondary">New products start with zero stock. Use Adjust stock to record opening inventory.</p>` : `<div class="form-grid">${field('Customer name', 'name', record?.name)}${field('Customer code', 'code', record?.code)}${field('Email (optional)', 'email', record?.email, 'email').replace(' required', '')}${field('Phone (optional)', 'phone', record?.phone).replace(' required', '')}</div>`;
  formModal(`${record ? 'Edit' : 'New'} ${products ? 'catalog item' : 'customer'}`, `${fields}${record ? selectField('Record visibility', 'archived', ['Active', 'Archived'], record.archived ? 'Archived' : 'Active') : ''}`, async (data, key) => {
    if (products) { data.price = decimalToMinor(data.price); data.reorderLevel = Number(data.reorderLevel); }
    if (record) data.archived = data.archived === 'Archived';
    if (data.archived && !record.archived && !confirm('Archive this record? Existing order history is preserved.')) throw new Error('Archival cancelled');
    if (record && !products) data.version = original.version;
    await api(`/${path}${record ? `/${record._id}` : ''}`, record ? 'PATCH' : 'POST', data, key);
  }, { onConflict: !products && record ? async form => {
    const draft = Object.fromEntries(new FormData(form)); draft.archived = draft.archived === 'Archived';
    const changes = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== original[key]));
    const latest = await api(`/customers/${original._id}`);
    if (form.isConnected && modal.open && state.user && state.page === path) editMaster(latest, changes, true);
  } : null });
  if (reloaded) { const notice = document.createElement('p'); notice.className = 'notice'; notice.setAttribute('role', 'status'); notice.textContent = 'Latest customer loaded. Your edits were kept; review before saving.'; document.querySelector('#modal-form').prepend(notice); }
}
function decimalToMinor(value) { if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Use a nonnegative amount with at most two decimals'); const [units, decimals = ''] = value.split('.'); return Number(units) * 100 + Number(decimals.padEnd(2, '0')); }
function renderOrders(data) {
  document.querySelector('#main').innerHTML = `${heading('Sales orders', 'From draft to fulfillment, with inventory and payments connected.', '<button class="primary" id="create-order">+ New order</button>')}<form class="toolbar" id="order-filter"><input type="search" name="q" aria-label="Search orders" placeholder="Search order or customer…" value="${escape(state.q)}"><label for="order-status">Order status</label><select id="order-status" name="status"><option value="">All statuses</option>${['draft', 'confirmed', 'fulfilled', 'cancelled'].map(s => `<option ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button>Apply</button></form><section class="panel">${table(['Order', 'Customer', 'Created', 'Status', 'Total', 'Payment', 'Action'], data.items.map(o => `<tr><td class="table-name">${escape(o.number)}</td><td>${escape(o.customerName)}</td><td>${date(o.createdAt)}</td><td><span class="tag ${o.status}">${o.status}</span></td><td>${money(o.total)}</td><td>${o.paid === o.total ? 'Paid' : o.paid === 0 ? 'Unpaid' : 'Partially paid'}</td><td><button data-order="${o._id}">Review</button></td></tr>`))}${pagination(data)}</section>`;
  document.querySelector('#create-order').onclick = createOrder; document.querySelector('#order-filter').onsubmit = e => { e.preventDefault(); const filters = new FormData(e.currentTarget); state.status = filters.get('status'); state.q = filters.get('q'); state.listPage = 1; load(); }; bindOrderButtons();
}
function bindOrderButtons() { document.querySelectorAll('[data-order]').forEach(button => button.onclick = () => viewOrder(button.dataset.order)); }
async function createOrder() {
  try {
    let customers = [], products = [];
    async function choices(path) { const data = await api(`/${path}?limit=100&sort=name`); return data; }
    const [c, p] = await Promise.all([choices('customers'), choices('products')]); customers = c.items; products = p.items;
    if (!customers.length || !products.length) { toast('Create an active customer and catalog item first.'); return; }
    let line = 0;
    const optionsFor = list => list.map(p => `<option value="${p._id}">${escape(p.name)} · ${money(p.price)}${p.type === 'product' ? ` · ${p.stock} available` : ''}</option>`).join('');
    const options = optionsFor(products);
    formModal('Create sales order', `<p>Prices are validated on the server. Stock is deducted only when the order is confirmed.</p><label class="field"><span>Find customer by name</span><input id="customer-search" type="search" placeholder="Type a name to narrow choices"></label><label class="field"><span>Customer</span><select name="customer" required>${customers.map(c => `<option value="${c._id}">${escape(c.name)} · ${escape(c.code)}</option>`).join('')}</select></label><p id="choice-hint" class="secondary">Showing up to 100 matches. Narrow your search for larger lists.</p><div id="order-lines" aria-describedby="order-lines-error"></div><p id="order-lines-error" class="error" role="alert"></p><button type="button" id="add-line">+ Add item</button><p id="draft-total"></p>`, async (data, key, form) => {
      const items = [...form.querySelectorAll('.line-item')].map(row => ({ product: row.querySelector('select').value, quantity: Number(row.querySelector('[type="number"]').value) }));
      if (!items.length) throw new Error('Add at least one item before saving this order.');
      await api('/orders', 'POST', { customer: data.customer, items }, key);
    }, { canSubmit: form => !!form.querySelector('.line-item') });
    function bindSearch(input, path, update) {
      let timer, sequence = 0;
      input.oninput = () => { clearTimeout(timer); const current = ++sequence; timer = setTimeout(async () => { try { const result = await api(`/${path}?limit=100&sort=name&q=${encodeURIComponent(input.value)}`); if (current === sequence && input.isConnected) { update(result.items); document.querySelector('#choice-hint').textContent = `${result.total} matches. Showing up to 100; narrow your search if needed.`; } } catch (e) { toast(e.message); } }, 250); };
    }
    bindSearch(document.querySelector('#customer-search'), 'customers', list => { document.querySelector('select[name="customer"]').innerHTML = list.map(c => `<option value="${c._id}">${escape(c.name)} · ${escape(c.code)}</option>`).join(''); });
    function total() { const rows = [...document.querySelectorAll('.line-item')]; const amount = rows.reduce((sum, row) => sum + (products.find(p => p._id === row.querySelector('select').value)?.price || 0) * Number(row.querySelector('[type="number"]').value), 0); document.querySelector('#draft-total').textContent = `Estimated total: ${money(amount)}`; document.querySelector('#order-lines-error').textContent = rows.length ? '' : 'Add at least one item before saving this order.'; document.querySelector('#modal-form [type="submit"]').disabled = !rows.length; }
    function addLine() { if (line >= 50) return; const row = document.createElement('div'); row.className = 'line-item'; row.innerHTML = `<div><input type="search" aria-label="Find catalog item" placeholder="Find item by name"><select aria-label="Catalog item" required>${options}</select></div><input type="number" aria-label="Quantity" value="1" min="1" max="100000" step="1" required><button type="button" aria-label="Remove item">×</button>`; row.querySelector('button').onclick = () => { row.remove(); line--; total(); }; row.onchange = total; document.querySelector('#order-lines').append(row); bindSearch(row.querySelector('[type="search"]'), 'products', list => { for (const p of list) { const existing = products.findIndex(item => item._id === p._id); if (existing < 0) products.push(p); else products[existing] = p; } row.querySelector('select').innerHTML = optionsFor(list); total(); }); line++; total(); }
    document.querySelector('#add-line').onclick = addLine; addLine();
  } catch (e) { toast(e.message); }
}
async function viewOrder(orderId, paymentPage = 1) {
  try {
    const o = await api(`/orders/${orderId}?paymentPage=${paymentPage}`);
    showModal(o.number, `<div class="modal-body"><p>${escape(o.customerName)} · ${date(o.createdAt)} · <span class="tag ${o.status}">${o.status}</span></p>${table(['Item', 'Quantity', 'Price', 'Amount'], o.items.map(i => `<tr><td>${escape(i.name)}</td><td>${i.quantity}</td><td>${money(i.price)}</td><td>${money(i.price * i.quantity)}</td></tr>`))}<div class="detail-totals"><span>Total ${money(o.total)}</span><span>Paid ${money(o.paid)}</span><span>Balance ${money(o.total - o.paid)}</span></div><div class="split-actions">${o.status === 'draft' ? '<button class="primary" data-transition="confirmed">Confirm order</button>' : ''}${isManager() && o.status === 'confirmed' ? '<button class="primary" data-transition="fulfilled">Mark fulfilled</button>' : ''}${isManager() && ['draft', 'confirmed'].includes(o.status) ? '<button class="danger" data-transition="cancelled">Cancel order</button>' : ''}${isManager() && ['confirmed', 'fulfilled'].includes(o.status) && o.paid < o.total ? '<button id="record-payment">Record payment</button>' : ''}</div><h3>Manual payment records</h3><p class="secondary">These records track payments reported by your team. No funds are processed.</p>${table(['Date', 'Amount', 'Reference', 'Action'], o.payments.map(p => `<tr><td>${date(p.createdAt)}</td><td>${money(p.amount)}</td><td>${escape(p.reference)}</td><td>${isManager() && !p.reversed && !p.reversalOf ? `<button data-reverse="${p._id}">Reverse</button>` : p.reversed ? 'Reversed' : 'Reversal'}</td></tr>`), 'No payment records', 'Record a received payment after confirming the order.')}</div>`);
    if (o.paymentTotal > 20) {
      const pager = document.createElement('div'); pager.className = 'pagination'; pager.innerHTML = `<span>Payment page ${o.paymentPage} · ${o.paymentTotal} records</span><div><button id="payment-prev" ${o.paymentPage <= 1 ? 'disabled' : ''}>Previous payments</button><button id="payment-next" ${o.paymentPage * 20 >= o.paymentTotal ? 'disabled' : ''}>Next payments</button></div>`;
      document.querySelector('#modal-content .modal-body').append(pager); pager.querySelector('#payment-prev').onclick = () => viewOrder(orderId, paymentPage - 1); pager.querySelector('#payment-next').onclick = () => viewOrder(orderId, paymentPage + 1);
    }
    document.querySelectorAll('[data-transition]').forEach(button => { const key = crypto.randomUUID(); button.onclick = async () => { if (!confirm(`${button.textContent}? ${button.dataset.transition === 'confirmed' ? 'Product stock will be deducted.' : button.dataset.transition === 'cancelled' ? 'Eligible stock will be restored.' : ''}`)) return; button.disabled = true; try { await api(`/orders/${orderId}/transition`, 'POST', { status: button.dataset.transition }, key); toast('Order updated'); await viewOrder(orderId); load(); } catch (e) { toast(e.message); button.disabled = false; } }; });
    const payment = document.querySelector('#record-payment'); if (payment) payment.onclick = () => formModal('Record received payment', `${field('Amount', 'amount', '', 'number', `min="0.01" step="0.01" max="${(o.total - o.paid) / 100}"`)}${field('Reference / note', 'reference')}`, async (data, key) => { await api(`/orders/${orderId}/payments`, 'POST', { amount: decimalToMinor(data.amount), reference: data.reference }, key); });
    document.querySelectorAll('[data-reverse]').forEach(button => button.onclick = () => formModal('Reverse payment record', '<p>This corrects the record only. It does not issue a bank refund.</p>' + field('Reason', 'reason'), async (data, key) => { await api(`/payments/${button.dataset.reverse}/reverse`, 'POST', data, key); }));
  } catch (e) { toast(e.message); }
}
function renderHistory(data) {
  const type = state.page;
  const rows = data.items.map(item => type === 'users' ? `<tr><td>${escape(item.name)}</td><td>${escape(item.email)}</td><td>${item.role}</td><td>${item.active ? 'Active' : 'Inactive'}</td><td>${item._id === state.user._id ? 'Your account' : `<button data-user="${item._id}">Manage</button>`}</td></tr>` : type === 'movements' ? `<tr><td>${date(item.createdAt)}</td><td>${escape(item.product?.name || 'Unavailable product')}</td><td>${item.delta > 0 ? '+' : ''}${item.delta}</td><td>${escape(item.reason)}</td><td>${escape(item.order?.number || 'Manual adjustment')}</td></tr>` : `<tr><td>${date(item.createdAt)}</td><td>${escape(item.action)}</td><td>${escape(item.entity)}</td><td>${escape(item.entityId)}</td><td>${escape(item.actor?.name || 'Unavailable user')}</td><td>${escape(item.detail) || '—'}</td></tr>`);
  document.querySelector('#main').innerHTML = `${heading(pages[type][0], type === 'users' ? 'Manage accounts and enforce clear responsibilities.' : 'A traceable history of business operations.', type === 'users' ? '<button id="create-user" class="primary">+ Team member</button>' : '')}<section class="panel">${table(type === 'users' ? ['Name', 'Email', 'Role', 'Status', 'Action'] : type === 'movements' ? ['Date', 'Product', 'Change', 'Reason', 'Order'] : ['Date', 'Action', 'Entity', 'Record ID', 'Actor', 'Detail'], rows, 'No history yet', 'Recorded operations will appear here.')}${pagination(data)}</section>`;
  if (type === 'users') {
    document.querySelector('#create-user').onclick = () => formModal('Add team member', `${field('Full name', 'name')}${field('Email', 'email', '', 'email')}${field('Initial password (12+ characters)', 'password', '', 'password', 'minlength="12" autocomplete="new-password"')}${selectField('Role', 'role', ['Staff', 'Manager', 'Administrator'], 'Staff')}`, async (data, key) => { await api('/users', 'POST', data, key); });
    document.querySelectorAll('[data-user]').forEach(button => button.onclick = () => { const user = data.items.find(u => u._id === button.dataset.user); formModal(`Manage ${user.name}`, `${selectField('Role', 'role', ['Staff', 'Manager', 'Administrator'], user.role)}${selectField('Account status', 'active', ['Active', 'Inactive'], user.active ? 'Active' : 'Inactive')}`, async (data, key) => { if (!confirm('Update access and revoke existing sessions?')) throw new Error('Update cancelled'); await api(`/users/${user._id}`, 'PATCH', { role: data.role, active: data.active === 'Active' }, key); }); });
  }
}
function renderReports() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const pageGeneration = generation;
  document.querySelector('#main').innerHTML = `${heading('Operational reports', 'Confirmed sales and recorded payments, in a bounded date range.')}<div class="notice">Amounts reflect current order and payment status for orders created in the selected period. This is an operational report, not an accounting ledger.</div><form id="report-form" class="toolbar"><select name="mode" aria-label="Report type"><option value="sales">Sales</option><option value="outstanding">Outstanding balances</option><option value="inventory">Inventory snapshot</option></select><label for="start">From</label><input style="max-width:180px" id="start" name="start" type="date" value="${today.slice(0, 8)}01" required><label for="end">Through</label><input style="max-width:180px" id="end" name="end" type="date" value="${today}" required><button class="primary">Run report</button></form><div id="report-results" aria-live="polite"></div>`;
  const form = document.querySelector('#report-form'), target = document.querySelector('#report-results');
  const button = form.querySelector('button'), mode = form.elements.mode;
  let sequence = 0, controller;
  const current = request => request === sequence && generation === pageGeneration && state.page === 'reports' && state.user && form.isConnected && target.isConnected;
  function invalidate() {
    ++sequence; controller?.abort(); button.disabled = false; target.replaceChildren();
  }
  form.onchange = () => {
    invalidate(); form.querySelectorAll('[type="date"]').forEach(input => { input.disabled = mode.value === 'inventory'; });
  };
  async function runReport(page = 1) {
    controller?.abort(); controller = new AbortController(); pendingReport = controller;
    const ownController = controller, request = ++sequence, inventory = mode.value === 'inventory';
    button.disabled = true; target.innerHTML = '<div class="loading" role="status">Loading report?</div>';
    try {
      const params = new URLSearchParams(new FormData(form));
      const path = inventory ? `/reports/inventory?page=${page}` : `/reports?${params}`;
      const data = await api(path, 'GET', undefined, undefined, { signal: ownController.signal });
      if (!current(request)) return;
      if (inventory) {
        target.innerHTML = `<section class="panel"><div class="panel-head"><h2>Inventory snapshot</h2><span class="tag">Current stock ? ${data.total} products</span></div>${table(['Product', 'SKU', 'On hand', 'Reorder threshold', 'Attention'], data.items.map(p => `<tr><td>${escape(p.name)}</td><td>${escape(p.sku)}</td><td>${p.stock}</td><td>${p.reorderLevel}</td><td>${p.stock <= p.reorderLevel ? 'Reorder review' : 'Above threshold'}</td></tr>`))}${pagination(data)}</section>`;
        target.querySelector('#previous').onclick = () => runReport(page - 1);
        target.querySelector('#next').onclick = () => runReport(page + 1);
      } else {
        target.innerHTML = `<div class="report-summary"><div><span>Sales</span><strong>${money(data.summary.sales)}</strong></div><div><span>Recorded payments</span><strong>${money(data.summary.paid)}</strong></div><div><span>Outstanding</span><strong>${money(data.summary.sales - data.summary.paid)}</strong></div><div><span>Orders</span><strong>${data.summary.count}</strong></div></div><section class="panel"><div class="panel-head"><h2>Sales detail</h2><button id="export">Export CSV</button></div>${data.truncated ? '<p class="notice">Only the latest 1,000 rows are shown and exported. Summary includes all matching orders.</p>' : ''}${table(['Order', 'Customer', 'Created', 'Status', 'Sales', 'Outstanding'], data.items.map(o => `<tr><td>${escape(o.number)}</td><td>${escape(o.customerName)}</td><td>${date(o.createdAt)}</td><td>${o.status}</td><td>${money(o.total)}</td><td>${money(o.total - o.paid)}</td></tr>`), 'No matching orders', 'Try another date range.')}</section>`;
        target.querySelector('#export').onclick = () => exportCsv(data.items);
      }
    } catch (e) {
      if (e.name !== 'AbortError' && current(request)) target.innerHTML = `<div class="empty" role="alert">${escape(e.message)}</div>`;
    } finally {
      if (current(request)) button.disabled = false;
      if (pendingReport === ownController) pendingReport = null;
    }
  }
  form.onsubmit = event => { event.preventDefault(); runReport(); };
  form.requestSubmit();
}
function exportCsv(items) {
  const cell = value => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const rows = [['Order', 'Customer', 'Date', 'Status', 'Total minor units', 'Paid minor units'], ...items.map(o => [o.number, o.customerName, o.createdAt, o.status, o.total, o.paid])];
  const url = URL.createObjectURL(new Blob([rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'sales-report.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showModal(title, content) { document.querySelector('#modal-content').innerHTML = `<div class="modal-head"><h2 id="dialog-title">${escape(title)}</h2><button id="close-modal" aria-label="Close dialog">×</button></div>${content}`; modal.setAttribute('aria-labelledby', 'dialog-title'); document.querySelector('#close-modal').onclick = () => modal.close(); if (!modal.open) modal.showModal(); document.querySelector('#modal-content input')?.focus(); }
function formModal(title, fields, submit, options = {}) {
  showModal(title, `<form id="modal-form" class="modal-body">${fields}<p id="form-error" class="error" role="alert"></p><div class="modal-actions"><button type="button" id="cancel-modal">Cancel</button><button class="primary" type="submit">Save</button></div></form>`);
  document.querySelector('#cancel-modal').onclick = () => modal.close(); const form = document.querySelector('#modal-form'); let retryKey = crypto.randomUUID(); let submittedBody;
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form)); const signature = JSON.stringify(data) + [...form.querySelectorAll('.line-item')].map(r => `${r.querySelector('select').value}:${r.querySelector('[type="number"]').value}`).join('|');
    if (submittedBody !== signature) retryKey = crypto.randomUUID(); submittedBody = signature;
    button.disabled = true; const error = form.querySelector('#form-error'); error.replaceChildren();
    try { await submit(data, retryKey, form); if (!form.isConnected || !state.user) return; modal.close(); toast('Saved successfully'); await load(); }
    catch (e) {
      if (!form.isConnected) return; error.textContent = e.message;
      if (e.code === 'EDIT_CONFLICT' && options.onConflict) {
        const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Reload latest customer'; error.append(document.createElement('br'), reload);
        reload.onclick = async () => { reload.disabled = true; try { await options.onConflict(form); } catch (failure) { if (form.isConnected) error.textContent = failure.message; } finally { reload.disabled = false; } };
      }
    } finally { button.disabled = options.canSubmit ? !options.canSubmit(form) : false; }
  };
}
try { await bootstrap(); } catch { login(); }
