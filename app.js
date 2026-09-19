/* ==========================================================
   Diletto Artesanal – Gestión interna
   Aplicación estática (sin servidor). Los datos se guardan en
   el navegador: localStorage para tablas y IndexedDB para PDFs.
   ========================================================== */
(() => {
'use strict';

/* ---------- 1. Utilidades ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const money = n => {
  n = Number.isFinite(n) ? n : 0;
  const abs = Math.round((Math.abs(n) + 1e-9) * 100) / 100;
  return (n < 0 && abs > 0 ? '-' : '') + 'S/ ' + abs.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const pct = n => (Number.isFinite(n) ? n : 0).toFixed(1) + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (list, sel) => {
  const l = (!sel || list.includes(sel)) ? list : [...list, sel];
  return l.map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
};

const DIAS = ['Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HORARIOS = { Jueves: '19:30 a 22:30', Viernes: '19:30 a 22:30', 'Sábado': '19:30 a 22:30', Domingo: '16:30 a 20:30' };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const UNIDADES = ['kg', 'g', 'lt', 'ml', 'und', 'docena', 'paquete', 'caja', 'balón'];
const CATEGORIAS_INSUMO = ['Abarrotes', 'Carnes y lácteos', 'Frutas y verduras', 'Bebidas', 'Empaques y descartables', 'Materiales y servicios'];
const CATEGORIAS_PRODUCTO = [
  'Pizzas por tamaño', 'Pizzas por porción', 'Pollo al horno', 'Lasaña', 'Pan al ajo', 'Papa rellena',
  'Mollejitas', 'Pasteles por entero', 'Pasteles por tajada', 'Pasteles por mayor', 'Picarones',
  'Jugos', 'Sándwiches', 'Bebidas'
];
const MAX_PDF = 25 * 1024 * 1024;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diaDeFecha = iso => DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()];
const mesLabel = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1] || ym} ${y}`; };
const fmtFecha = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtSize = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

const ICON = {
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>'
};

/* ---------- 2. Datos de ejemplo ---------- */
function seedState() {
  const I = (id, nombre, categoria, unidad, cantidad, costoUnit) => ({ id, nombre, categoria, unidad, cantidad, costoUnit });
  const P = (id, nombre, categoria, rinde, ing, otros, precio) => ({
    id, nombre, categoria, rinde, otros, precio,
    ingredientes: ing.map(([insumoId, cantidad]) => ({ insumoId, cantidad }))
  });
  const insumos = [
    I('i_harina', 'Harina de trigo', 'Abarrotes', 'kg', 25, 3.2),
    I('i_levadura', 'Levadura seca', 'Abarrotes', 'kg', 0.5, 28),
    I('i_azucar', 'Azúcar rubia', 'Abarrotes', 'kg', 10, 3.6),
    I('i_aceite', 'Aceite vegetal', 'Abarrotes', 'lt', 10, 8.5),
    I('i_pasta', 'Pasta para lasaña', 'Abarrotes', 'kg', 3, 9),
    I('i_chancaca', 'Chancaca', 'Abarrotes', 'kg', 2, 8),
    I('i_pan', 'Pan', 'Abarrotes', 'und', 60, 0.3),
    I('i_salsa', 'Salsa de tomate', 'Abarrotes', 'kg', 5, 7),
    I('i_queso', 'Queso mozzarella', 'Carnes y lácteos', 'kg', 8, 26),
    I('i_jamon', 'Jamón', 'Carnes y lácteos', 'kg', 2, 24),
    I('i_mantequilla', 'Mantequilla', 'Carnes y lácteos', 'kg', 3, 22),
    I('i_huevos', 'Huevos', 'Carnes y lácteos', 'und', 90, 0.55),
    I('i_pollo', 'Pollo entero', 'Carnes y lácteos', 'und', 10, 17),
    I('i_pechuga', 'Pechuga de pollo', 'Carnes y lácteos', 'kg', 4, 14),
    I('i_carne', 'Carne molida', 'Carnes y lácteos', 'kg', 4, 24),
    I('i_molleja', 'Mollejas', 'Carnes y lácteos', 'kg', 3, 12),
    I('i_papa', 'Papa', 'Frutas y verduras', 'kg', 20, 2.5),
    I('i_camote', 'Camote', 'Frutas y verduras', 'kg', 6, 2.5),
    I('i_ajo', 'Ajo', 'Frutas y verduras', 'kg', 1, 12),
    I('i_fruta', 'Fruta para jugos', 'Frutas y verduras', 'kg', 15, 4.5),
    I('i_maiz', 'Maíz morado', 'Frutas y verduras', 'kg', 5, 6),
    I('i_gaseosa', 'Gaseosa personal', 'Bebidas', 'und', 24, 1.8),
    I('i_agua', 'Agua mineral', 'Bebidas', 'und', 24, 1.2),
    I('i_caja', 'Caja de pizza', 'Empaques y descartables', 'und', 50, 0.9),
    I('i_envase', 'Envase descartable', 'Empaques y descartables', 'und', 100, 0.3)
  ];
  const productos = [
    P('p_pizza_pers', 'Pizza personal', 'Pizzas por tamaño', 1, [['i_harina', .12], ['i_queso', .1], ['i_salsa', .05], ['i_jamon', .04], ['i_levadura', .002], ['i_caja', 1]], .5, 16),
    P('p_pizza_med', 'Pizza mediana', 'Pizzas por tamaño', 1, [['i_harina', .2], ['i_queso', .18], ['i_salsa', .08], ['i_jamon', .07], ['i_levadura', .003], ['i_caja', 1]], .8, 28),
    P('p_pizza_fam', 'Pizza familiar', 'Pizzas por tamaño', 1, [['i_harina', .3], ['i_queso', .28], ['i_salsa', .12], ['i_jamon', .1], ['i_levadura', .005], ['i_caja', 1]], 1.2, 42),
    P('p_pizza_porc', 'Porción de pizza', 'Pizzas por porción', 8, [['i_harina', .3], ['i_queso', .28], ['i_salsa', .12], ['i_jamon', .1], ['i_levadura', .005], ['i_envase', 8]], 1.2, 6),
    P('p_pollo_ent', 'Pollo al horno entero', 'Pollo al horno', 1, [['i_pollo', 1], ['i_ajo', .02], ['i_aceite', .03]], 2, 36),
    P('p_pollo_cuarto', 'Cuarto de pollo al horno', 'Pollo al horno', 4, [['i_pollo', 1], ['i_ajo', .02], ['i_aceite', .03], ['i_envase', 4]], 2, 10),
    P('p_lasana', 'Porción de lasaña', 'Lasaña', 8, [['i_pasta', .5], ['i_carne', .6], ['i_queso', .3], ['i_salsa', .4], ['i_mantequilla', .1], ['i_envase', 8]], 2, 12),
    P('p_pan_ajo', 'Pan al ajo', 'Pan al ajo', 6, [['i_pan', 6], ['i_mantequilla', .1], ['i_ajo', .03]], .6, 3),
    P('p_papa_rell', 'Papa rellena', 'Papa rellena', 16, [['i_papa', 2.5], ['i_carne', .8], ['i_huevos', 4], ['i_aceite', .5]], 3, 6),
    P('p_mollejitas', 'Porción de mollejitas', 'Mollejitas', 10, [['i_molleja', 1.5], ['i_ajo', .03], ['i_aceite', .1], ['i_envase', 10]], 1, 10),
    P('p_pastel_ent', 'Pastel entero', 'Pasteles por entero', 1, [['i_harina', .4], ['i_huevos', 6], ['i_azucar', .35], ['i_mantequilla', .25], ['i_envase', 1]], 3, 55),
    P('p_pastel_taj', 'Tajada de pastel', 'Pasteles por tajada', 12, [['i_harina', .4], ['i_huevos', 6], ['i_azucar', .35], ['i_mantequilla', .25], ['i_envase', 12]], 3, 6),
    P('p_pastel_may', 'Pastel por mayor', 'Pasteles por mayor', 1, [['i_harina', .4], ['i_huevos', 6], ['i_azucar', .35], ['i_mantequilla', .25], ['i_envase', 1]], 2, 40),
    P('p_picarones', 'Porción de picarones (4 und)', 'Picarones', 16, [['i_harina', .6], ['i_camote', .4], ['i_levadura', .01], ['i_azucar', .1], ['i_aceite', 1], ['i_chancaca', .6], ['i_envase', 16]], 2, 8),
    P('p_jugo_1', 'Jugo 1 lt', 'Jugos', 1, [['i_fruta', .35], ['i_azucar', .05]], .3, 8),
    P('p_jugo_4', 'Jugo 4 lt', 'Jugos', 1, [['i_fruta', 1.4], ['i_azucar', .2]], .6, 28),
    P('p_chicha_1', 'Chicha morada 1 lt', 'Jugos', 1, [['i_maiz', .12], ['i_azucar', .08], ['i_fruta', .1]], .3, 7),
    P('p_chicha_4', 'Chicha morada 4 lt', 'Jugos', 1, [['i_maiz', .48], ['i_azucar', .32], ['i_fruta', .4]], .6, 24),
    P('p_pan_pollo', 'Pan con pollo', 'Sándwiches', 10, [['i_pan', 10], ['i_pechuga', 1.2], ['i_aceite', .05], ['i_ajo', .02]], 2, 7),
    P('p_sand_mixto', 'Sándwich de jamón y queso', 'Sándwiches', 1, [['i_pan', 1], ['i_jamon', .04], ['i_queso', .04]], .3, 5),
    P('p_gaseosa', 'Gaseosa personal', 'Bebidas', 1, [['i_gaseosa', 1]], 0, 3.5),
    P('p_agua', 'Agua mineral', 'Bebidas', 1, [['i_agua', 1]], 0, 2.5)
  ];
  return normalize({ ejemplo: true, insumos, productos });
}

/* ---------- 3. Estado y almacenamiento ---------- */
const STORE_KEY = 'diletto-artesanal:v1';
let saveTimer = null;

function normalize(s) {
  s = s || {};
  const b = s.borrador || {};
  const cant = b.cant && typeof b.cant === 'object' ? b.cant : {};
  return {
    version: 1,
    ejemplo: !!s.ejemplo,
    ajustes: { margenObjetivo: s.ajustes && Number.isFinite(+s.ajustes.margenObjetivo) ? +s.ajustes.margenObjetivo : 60 },
    insumos: Array.isArray(s.insumos) ? s.insumos : [],
    productos: Array.isArray(s.productos)
      ? s.productos.map(p => ({ rinde: 1, otros: 0, precio: 0, ...p, ingredientes: Array.isArray(p.ingredientes) ? p.ingredientes : [] }))
      : [],
    ventas: Array.isArray(s.ventas) ? s.ventas : [],
    pdfs: Array.isArray(s.pdfs) ? s.pdfs : [],
    borrador: { fecha: Object.keys(cant).length && b.fecha ? b.fecha : todayISO(), cant }
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* almacenamiento bloqueado o dañado */ }
  return seedState();
}
function persistNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('No se pudo guardar en este navegador. Revisa el espacio o los permisos de almacenamiento.'); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, 250); }

let state = loadState();
const ui = { view: 'ventas', costoSel: null, ventasMes: 'todos', openMonths: null, histFiles: [], hMes: todayISO().slice(0, 7) };

/* ---------- 4. IndexedDB (archivos PDF) ---------- */
let dbPromise = null;
const idb = () => dbPromise || (dbPromise = new Promise((res, rej) => {
  const r = indexedDB.open('diletto-artesanal', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('pdfs');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const idbTx = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('pdfs', mode);
    const req = fn(tx.objectStore('pdfs'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
};
const idbPut = (id, blob) => idbTx('readwrite', s => s.put(blob, id));
const idbGet = id => idbTx('readonly', s => s.get(id));
const idbDel = id => idbTx('readwrite', s => s.delete(id));

/* ---------- 5. Cálculos ---------- */
const insumoById = id => state.insumos.find(i => i.id === id);
const prod = id => state.productos.find(p => p.id === id);
const costoLote = p => p.ingredientes.reduce((s, r) => {
  const i = insumoById(r.insumoId);
  return s + (i ? num(r.cantidad) * num(i.costoUnit) : 0);
}, 0) + num(p.otros);
const costoUnit = p => num(p.rinde) > 0 ? costoLote(p) / num(p.rinde) : 0;
const margenPct = p => num(p.precio) > 0 ? (num(p.precio) - costoUnit(p)) / num(p.precio) * 100 : 0;
const margenClase = m => {
  const obj = num(state.ajustes.margenObjetivo);
  return m >= obj ? 'good' : m >= obj - 15 ? 'warn' : 'bad';
};
const sugerido = p => {
  const cu = costoUnit(p), obj = num(state.ajustes.margenObjetivo);
  if (cu <= 0 || obj >= 100) return 0;
  return Math.ceil(cu / (1 - obj / 100) * 2) / 2;
};
function groupByCategory(list) {
  const order = [...CATEGORIAS_PRODUCTO];
  list.forEach(p => { if (!order.includes(p.categoria)) order.push(p.categoria); });
  return order.map(c => [c, list.filter(p => p.categoria === c)]).filter(([, items]) => items.length);
}
const kpi = (label, value, sub = '', cls = '') =>
  `<div class="kpi card"><div class="kpi-l">${esc(label)}</div><div class="kpi-v ${cls}">${esc(value)}</div><div class="kpi-s">${esc(sub)}</div></div>`;

/* ---------- 6. Navegación ---------- */
const TITULOS = { abarrotes: 'Abarrotes y materiales', costos: 'Costo de producción', ventas: 'Ventas', historial: 'Historial de ventas', precios: 'Precios de carta' };
const VIEWS = { abarrotes: renderAbarrotes, costos: renderCostos, ventas: renderVentas, historial: renderHistorial, precios: renderPrecios };
const AFTER = { abarrotes: recalcAbarrotes, costos: recalcCostos, ventas: recalcVentas, historial: bindHistorial, precios: recalcPrecios };
let showTimer = null;

function show(view, { instant = false } = {}) {
  if (!VIEWS[view]) view = 'ventas';
  ui.view = view;
  document.title = `${TITULOS[view]} – Diletto Artesanal`;
  $$('#nav .nav-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const el = $('#view');
  clearTimeout(showTimer);
  const paint = () => {
    el.innerHTML = VIEWS[view]();
    AFTER[view] && AFTER[view]();
    el.classList.add('in');
    window.scrollTo({ top: 0 });
  };
  el.classList.remove('in');
  renderBanner();
  if (instant) paint(); else showTimer = setTimeout(paint, 140);
}
function rerender() {
  $('#view').innerHTML = VIEWS[ui.view]();
  AFTER[ui.view] && AFTER[ui.view]();
}
const routeFromHash = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : 'ventas'; };

function renderBanner() {
  const b = $('#banner');
  if (!state.ejemplo) { b.innerHTML = ''; return; }
  b.innerHTML = `<div class="banner no-print">
    <p><strong>Estás viendo datos de ejemplo.</strong> Los precios, cantidades y recetas son de muestra: reemplázalos con los tuyos o empieza en blanco.</p>
    <div class="row"><button type="button" class="btn" data-act="ej-blank">Empezar en blanco</button><button type="button" class="btn" data-act="ej-keep">Ocultar aviso</button></div>
  </div>`;
}

/* ---------- 7. Modal, confirmación y avisos ---------- */
let modalOnClose = null, pendingOk = null, toastTimer = null;

function openModal(html, { wide = false, onClose = null } = {}) {
  $('#modal-card').className = 'modal-card' + (wide ? ' wide' : '');
  $('#modal-body').innerHTML = html;
  $('#modal').hidden = false;
  document.body.classList.add('modal-open');
  modalOnClose = onClose;
  requestAnimationFrame(() => {
    $('#modal').classList.add('show');
    const f = $('#modal-body input:not([type=hidden]), #modal-body select') || $('#modal-body .btn.primary, #modal-body .btn.danger');
    if (f) f.focus();
  });
}
function closeModal() {
  const m = $('#modal');
  m.classList.remove('show');
  document.body.classList.remove('modal-open');
  setTimeout(() => { if (!m.classList.contains('show')) { m.hidden = true; $('#modal-body').innerHTML = ''; } }, 200);
  if (modalOnClose) { const fn = modalOnClose; modalOnClose = null; fn(); }
}
function formModal({ title, intro = '', fields, submitLabel = 'Guardar', onSubmit }) {
  const inputs = fields.map(f => {
    const control = f.type === 'select'
      ? `<select class="input" id="mf-${f.key}">${opts(f.options, f.value)}</select>`
      : `<input class="input" id="mf-${f.key}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}"${f.min != null ? ` min="${f.min}"` : ''}${f.type === 'number' ? ' step="any" inputmode="decimal"' : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`;
    return `<div class="field"><label for="mf-${f.key}">${esc(f.label)}</label>${control}</div>`;
  }).join('');
  openModal(`<form id="modal-form" novalidate>
    <h2>${esc(title)}</h2>${intro ? `<p class="muted">${esc(intro)}</p>` : ''}
    ${inputs}
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">${esc(submitLabel)}</button></div>
  </form>`);
  $('#modal-form').addEventListener('submit', e => {
    e.preventDefault();
    const vals = {};
    fields.forEach(f => { vals[f.key] = $('#mf-' + f.key).value.trim(); });
    if (onSubmit(vals) !== false) closeModal();
  });
}
function confirmModal({ title, message, okLabel = 'Confirmar', danger = false, onOk }) {
  pendingOk = onOk;
  openModal(`<div><h2>${esc(title)}</h2><p class="muted">${esc(message)}</p>
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-act="modal-ok">${esc(okLabel)}</button></div></div>`);
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}

/* ==========================================================
   MÓDULO 1 – ABARROTES Y MATERIALES
   ========================================================== */
function rowInsumo(i) {
  return `<tr data-row="ins" data-id="${i.id}" data-name="${esc((i.nombre || '').toLowerCase())}">
    <td><input class="cell" data-k="nombre" value="${esc(i.nombre)}" placeholder="Nombre del insumo" aria-label="Insumo"></td>
    <td><select class="cell" data-k="categoria" aria-label="Categoría">${opts(CATEGORIAS_INSUMO, i.categoria)}</select></td>
    <td><select class="cell" data-k="unidad" aria-label="Unidad">${opts(UNIDADES, i.unidad)}</select></td>
    <td class="r"><input class="cell num" type="number" min="0" step="any" inputmode="decimal" data-k="cantidad" value="${i.cantidad}" aria-label="Cantidad"></td>
    <td class="r"><input class="cell num" type="number" min="0" step="any" inputmode="decimal" data-k="costoUnit" value="${i.costoUnit}" aria-label="Costo unitario"></td>
    <td class="r calc" data-sub></td>
    <td class="r"><button type="button" class="icon-btn" data-act="ins-del" aria-label="Eliminar insumo" title="Eliminar">${ICON.x}</button></td>
  </tr>`;
}
function renderAbarrotes() {
  return `
  <header class="page-head">
    <div><h1>Abarrotes y materiales</h1>
    <p>Registra lo que compras con su costo unitario. Las recetas de Costo de producción usan estos precios para calcular cuánto cuesta cada producto.</p></div>
    <div class="page-actions"><button type="button" class="btn primary" data-act="ins-add">Agregar insumo</button></div>
  </header>
  <div class="kpis" id="ins-kpis"></div>
  <div class="grid-2">
    <section class="card">
      <div class="card-head">
        <h2>Lista de insumos</h2>
        <input type="search" class="search" id="ins-search" placeholder="Buscar insumo" aria-label="Buscar insumo">
      </div>
      <div class="tbl-wrap"><table class="tbl" id="ins-table">
        <thead><tr><th>Insumo</th><th>Categoría</th><th>Unidad</th><th class="r">Cantidad</th><th class="r">Costo unitario (S/)</th><th class="r">Subtotal</th><th></th></tr></thead>
        <tbody>${state.insumos.map(rowInsumo).join('')}</tbody>
        <tfoot><tr><td colspan="5">Total invertido</td><td class="r" id="ins-total"></td><td></td></tr></tfoot>
      </table></div>
      ${state.insumos.length ? '' : '<div class="empty">Aún no hay insumos. Agrega el primero con “Agregar insumo”.</div>'}
    </section>
    <aside class="card" id="ins-cats"></aside>
  </div>`;
}
function recalcAbarrotes() {
  let total = 0;
  const porCat = {};
  state.insumos.forEach(i => {
    const s = num(i.cantidad) * num(i.costoUnit);
    total += s;
    porCat[i.categoria] = (porCat[i.categoria] || 0) + s;
    const tr = $(`#ins-table tr[data-id="${i.id}"]`);
    if (tr) $('[data-sub]', tr).textContent = money(s);
  });
  $('#ins-total').textContent = money(total);
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const top = cats[0];
  $('#ins-kpis').innerHTML =
    kpi('Total invertido', money(total), 'Suma de todos los subtotales') +
    kpi('Insumos registrados', String(state.insumos.length), `${cats.length} ${cats.length === 1 ? 'categoría' : 'categorías'}`) +
    kpi('Mayor gasto', top ? top[0] : '—', top ? money(top[1]) : '');
  $('#ins-cats').innerHTML = `<h2>Gasto por categoría</h2><div class="cat-list">${
    cats.length ? cats.map(([c, v]) => `<div class="cat-item"><div class="top"><span>${esc(c)}</span><span>${money(v)}</span></div><div class="bar"><span style="width:${total ? (v / total * 100).toFixed(1) : 0}%"></span></div></div>`).join('')
      : '<p class="muted">Sin datos todavía.</p>'}</div>`;
}
function filtrarInsumos(q) {
  q = q.trim().toLowerCase();
  $$('#ins-table tbody tr').forEach(tr => { tr.hidden = q && !(tr.dataset.name || '').includes(q); });
}
function onInsumoInput(t, row) {
  const i = insumoById(row.dataset.id); if (!i) return;
  const k = t.dataset.k;
  i[k] = t.type === 'number' ? num(t.value) : t.value;
  if (k === 'nombre') row.dataset.name = t.value.toLowerCase();
  save(); recalcAbarrotes();
}

/* ==========================================================
   MÓDULO 2 – COSTO DE PRODUCCIÓN
   ========================================================== */
const selProd = () => prod(ui.costoSel);

function plItem(p) {
  const priced = num(p.precio) > 0, mg = margenPct(p);
  return `<button type="button" class="pl-item${p.id === ui.costoSel ? ' sel' : ''}" data-act="costo-pick" data-id="${p.id}">
    <span class="pl-name">${esc(p.nombre || 'Sin nombre')}</span>
    <span class="pl-sub"><span data-pl-cost>Costo ${money(costoUnit(p))}</span><span class="m ${priced ? margenClase(mg) : 'neutral'}" data-pl-m>${priced ? 'Margen ' + pct(mg) : 'Sin precio'}</span></span>
  </button>`;
}
const plistHTML = () => groupByCategory(state.productos)
  .map(([c, items]) => `<div class="pl-cat">${esc(c)}</div>${items.map(plItem).join('')}`).join('')
  || '<div class="empty">Aún no hay productos.</div>';

const insumoOptions = sel => '<option value="">Elegir insumo</option>' +
  [...state.insumos].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    .map(i => `<option value="${i.id}"${i.id === sel ? ' selected' : ''}>${esc(i.nombre || 'Sin nombre')} (${esc(i.unidad)})</option>`).join('');

const ingRow = (r, idx) => `<tr data-row="ing" data-idx="${idx}">
  <td><select class="cell" data-k="insumoId" aria-label="Insumo">${insumoOptions(r.insumoId)}</select></td>
  <td class="r"><input class="cell num" type="number" min="0" step="any" inputmode="decimal" data-k="cantidad" value="${r.cantidad}" aria-label="Cantidad"></td>
  <td class="calc" data-unit></td>
  <td class="r calc" data-cu></td>
  <td class="r calc" data-sub></td>
  <td class="r"><button type="button" class="icon-btn" data-act="ing-del" data-idx="${idx}" aria-label="Quitar insumo" title="Quitar">${ICON.x}</button></td>
</tr>`;

function detalleHTML() {
  const p = selProd();
  if (!p) return '<div class="card empty">Aún no hay productos. Crea el primero con “Nuevo producto”.</div>';
  return `
  <div class="kpis" id="cost-kpis"></div>
  <section class="card">
    <div class="card-head">
      <div class="head-fields">
        <input class="title-input" data-row="prod" data-id="${p.id}" data-k="nombre" value="${esc(p.nombre)}" aria-label="Nombre del producto" placeholder="Nombre del producto">
        <select class="cell" data-row="prod" data-id="${p.id}" data-k="categoria" aria-label="Categoría">${opts(CATEGORIAS_PRODUCTO, p.categoria)}</select>
      </div>
      <button type="button" class="btn danger-ghost" data-act="prod-del" data-id="${p.id}">Eliminar producto</button>
    </div>
    <div class="fields">
      <div class="field"><label for="f-rinde">Rinde (unidades que salen de esta receta)</label>
        <input class="input" id="f-rinde" type="number" min="0" step="any" inputmode="decimal" data-row="prod" data-id="${p.id}" data-k="rinde" value="${p.rinde}"></div>
      <div class="field"><label for="f-otros">Otros costos del lote: gas, mano de obra (S/)</label>
        <input class="input" id="f-otros" type="number" min="0" step="any" inputmode="decimal" data-row="prod" data-id="${p.id}" data-k="otros" value="${p.otros}"></div>
    </div>
    <div class="tbl-wrap"><table class="tbl" id="rec-table">
      <thead><tr><th>Insumo</th><th class="r">Cantidad</th><th>Unidad</th><th class="r">Costo unitario</th><th class="r">Subtotal</th><th></th></tr></thead>
      <tbody>${p.ingredientes.map(ingRow).join('')}</tbody>
      <tfoot>
        <tr class="light"><td colspan="4">Insumos</td><td class="r" id="rec-ins"></td><td></td></tr>
        <tr class="light"><td colspan="4">Otros costos</td><td class="r" id="rec-otros"></td><td></td></tr>
        <tr><td colspan="4">Costo del lote</td><td class="r" id="rec-lote"></td><td></td></tr>
      </tfoot>
    </table></div>
    <p class="hint" style="padding-top:12px">La cantidad se expresa en la unidad del insumo (por ejemplo, kg o und). El costo unitario viene de Abarrotes y materiales.</p>
    <div class="card-foot"><button type="button" class="btn" data-act="ing-add">Agregar insumo a la receta</button></div>
  </section>`;
}
function renderCostos() {
  if (!prod(ui.costoSel)) ui.costoSel = state.productos[0] ? state.productos[0].id : null;
  const sel = state.productos.map(p => `<option value="${p.id}"${p.id === ui.costoSel ? ' selected' : ''}>${esc(p.nombre || 'Sin nombre')}</option>`).join('');
  return `
  <header class="page-head">
    <div><h1>Costo de producción</h1>
    <p>Arma la receta de cada producto para saber cuánto cuesta producirlo y qué margen te deja frente al precio de carta.</p></div>
    <div class="page-actions"><button type="button" class="btn primary" data-act="prod-add">Nuevo producto</button></div>
  </header>
  <div class="psel"><div class="field"><label for="psel">Producto</label><select class="input" id="psel">${sel}</select></div></div>
  <div class="split">
    <aside class="card plist-card" id="plist">${plistHTML()}</aside>
    <div id="pdetail">${detalleHTML()}</div>
  </div>`;
}
function pickProducto(id) {
  ui.costoSel = id;
  $('#plist').innerHTML = plistHTML();
  $('#pdetail').innerHTML = detalleHTML();
  const s = $('#psel'); if (s) s.value = id;
  recalcCostos();
}
function recalcCostos() {
  const p = selProd(); if (!p) return;
  let insTotal = 0;
  $$('#rec-table tr[data-row="ing"]').forEach(tr => {
    const r = p.ingredientes[+tr.dataset.idx];
    const ins = r && insumoById(r.insumoId);
    const sub = ins ? num(r.cantidad) * num(ins.costoUnit) : 0;
    insTotal += sub;
    $('[data-unit]', tr).textContent = ins ? ins.unidad : '—';
    $('[data-cu]', tr).textContent = ins ? money(num(ins.costoUnit)) : '—';
    $('[data-sub]', tr).textContent = money(sub);
  });
  $('#rec-ins').textContent = money(insTotal);
  $('#rec-otros').textContent = money(num(p.otros));
  $('#rec-lote').textContent = money(insTotal + num(p.otros));
  const cu = costoUnit(p), pr = num(p.precio), ut = pr - cu, mg = margenPct(p);
  $('#cost-kpis').innerHTML =
    kpi('Costo del lote', money(costoLote(p)), `Rinde ${num(p.rinde)} und`) +
    kpi('Costo por unidad', money(cu), 'Lote dividido entre lo que rinde') +
    kpi('Precio de carta', pr > 0 ? money(pr) : 'Sin precio', 'Se edita en Precios de carta') +
    kpi('Utilidad por unidad', pr > 0 ? money(ut) : '—', pr > 0 ? 'Precio menos costo' : '') +
    kpi('Margen', pr > 0 ? pct(mg) : '—', `Objetivo ${pct(num(state.ajustes.margenObjetivo))}`, pr > 0 ? margenClase(mg) : '');
  const it = $(`.pl-item[data-id="${p.id}"]`);
  if (it) it.outerHTML = plItem(p);
}
function onProdInput(t) {
  const p = prod(t.dataset.id); if (!p) return;
  const k = t.dataset.k;
  p[k] = (k === 'rinde' || k === 'otros') ? num(t.value) : t.value;
  save();
  if (k === 'categoria') $('#plist').innerHTML = plistHTML();
  recalcCostos();
}
function onIngInput(t, row) {
  const p = selProd(); if (!p) return;
  const r = p.ingredientes[+row.dataset.idx]; if (!r) return;
  r[t.dataset.k] = t.dataset.k === 'cantidad' ? num(t.value) : t.value;
  save(); recalcCostos();
}

/* ==========================================================
   MÓDULO 3 – VENTAS
   ========================================================== */
function ventaRow(p) {
  const q = num(state.borrador.cant[p.id]);
  return `<tr data-row="vt" data-id="${p.id}">
    <td>${esc(p.nombre || 'Sin nombre')}</td>
    <td class="r calc">${num(p.precio) > 0 ? money(num(p.precio)) : '<span class="muted">Sin precio</span>'}</td>
    <td class="r"><div class="stepper">
      <button type="button" data-act="qty-dec" data-id="${p.id}" aria-label="Restar una unidad de ${esc(p.nombre)}">−</button>
      <input type="number" min="0" step="1" inputmode="numeric" data-k="cant" value="${q || ''}" placeholder="0" aria-label="Cantidad vendida de ${esc(p.nombre)}">
      <button type="button" data-act="qty-inc" data-id="${p.id}" aria-label="Sumar una unidad de ${esc(p.nombre)}">+</button>
    </div></td>
    <td class="r calc" data-sub></td>
    <td class="r calc" data-ut></td>
  </tr>`;
}
function renderVentas() {
  const rows = groupByCategory(state.productos)
    .map(([c, items]) => `<tr class="cat-row"><td colspan="5">${esc(c)}</td></tr>${items.map(ventaRow).join('')}`).join('');
  return `
  <div class="print-title" id="print-title"></div>
  <header class="page-head">
    <div><h1>Ventas</h1>
    <p>Registra las cantidades vendidas en la jornada. Los subtotales, el costo y la utilidad se calculan al instante.</p></div>
  </header>
  <div class="sales">
    <section class="card">
      <div class="card-head sale-head">
        <div class="field"><label for="v-fecha">Fecha</label><input type="date" class="input" id="v-fecha" value="${esc(state.borrador.fecha)}"></div>
        <div class="day-info" id="v-dia"></div>
      </div>
      <div class="tbl-wrap"><table class="tbl" id="v-table">
        <thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Cantidad</th><th class="r">Subtotal</th><th class="r">Utilidad</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">Aún no hay productos. Créalos en Costo de producción.</td></tr>'}</tbody>
      </table></div>
    </section>
    <aside class="card sum-card">
      <h2>Resumen del día</h2>
      <dl class="sum">
        <div><dt>Unidades vendidas</dt><dd id="s-un"></dd></div>
        <div><dt>Ventas</dt><dd class="big" id="s-total"></dd></div>
        <div><dt>Costo de producción</dt><dd id="s-costo"></dd></div>
        <div><dt>Utilidad bruta</dt><dd id="s-ut"></dd></div>
        <div><dt>Margen</dt><dd id="s-mg"></dd></div>
      </dl>
      <div class="sum-actions no-print">
        <button type="button" class="btn primary block" data-act="v-save">Guardar venta del día</button>
        <div class="row"><button type="button" class="btn" data-act="v-clear">Limpiar</button><button type="button" class="btn" data-act="v-print">Imprimir o guardar PDF</button></div>
      </div>
    </aside>
  </div>
  ${savedHTML()}`;
}
function recalcVentas() {
  if (!$('#v-table')) return;
  let un = 0, total = 0, costo = 0;
  $$('#v-table tr[data-row="vt"]').forEach(tr => {
    const p = prod(tr.dataset.id); if (!p) return;
    const q = num(state.borrador.cant[p.id]);
    const sub = q * num(p.precio), c = q * costoUnit(p);
    un += q; total += sub; costo += c;
    $('[data-sub]', tr).textContent = q ? money(sub) : '—';
    $('[data-ut]', tr).textContent = q ? money(sub - c) : '—';
    tr.classList.toggle('is-zero', !q);
  });
  let lastCat = null, any = false;
  $$('#v-table tbody tr').forEach(tr => {
    if (tr.classList.contains('cat-row')) { if (lastCat) lastCat.classList.toggle('is-zero', !any); lastCat = tr; any = false; }
    else if (!tr.classList.contains('is-zero')) any = true;
  });
  if (lastCat) lastCat.classList.toggle('is-zero', !any);

  const ut = total - costo;
  $('#s-un').textContent = String(un);
  $('#s-total').textContent = money(total);
  $('#s-costo').textContent = money(costo);
  $('#s-ut').textContent = money(ut);
  $('#s-mg').textContent = total > 0 ? pct(ut / total * 100) : '—';

  const f = state.borrador.fecha, dia = diaDeFecha(f), oper = DIAS.includes(dia);
  $('#v-dia').innerHTML = `<span class="chip ${oper ? 'good' : 'warn'}">${dia}</span>` +
    (oper ? `<span class="muted">Horario de atención: ${HORARIOS[dia]}</span>` : '<span class="muted">No es día de atención (jueves a domingo). Puedes guardarlo igual.</span>');
  $('#print-title').textContent = `Diletto Artesanal – Reporte de ventas, ${dia} ${fmtFecha(f)}`;
}
function onVentaInput(t, row) {
  state.borrador.cant[row.dataset.id] = Math.max(0, num(t.value));
  save(); recalcVentas();
}
function stepQty(id, delta) {
  const q = Math.max(0, num(state.borrador.cant[id]) + delta);
  state.borrador.cant[id] = q;
  const inp = $(`#v-table tr[data-id="${id}"] input`);
  if (inp) inp.value = q || '';
  save(); recalcVentas();
}
function guardarVenta() {
  const f = state.borrador.fecha;
  const items = state.productos
    .map(p => ({ p, q: num(state.borrador.cant[p.id]) })).filter(x => x.q > 0)
    .map(({ p, q }) => ({ productoId: p.id, nombre: p.nombre, categoria: p.categoria, cantidad: q, precio: num(p.precio), costo: costoUnit(p) }));
  if (!items.length) { toast('Ingresa al menos una cantidad vendida.'); return; }
  const total = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const costo = items.reduce((s, i) => s + i.cantidad * i.costo, 0);
  const venta = { id: uid(), fecha: f, dia: diaDeFecha(f), items, unidades: items.reduce((s, i) => s + i.cantidad, 0), total, costo, utilidad: total - costo };
  const commit = () => {
    const idx = state.ventas.findIndex(v => v.fecha === f);
    if (idx >= 0) state.ventas[idx] = venta; else state.ventas.push(venta);
    state.borrador.cant = {};
    persistNow(); rerender();
    toast(`Venta guardada: ${venta.dia} ${fmtFecha(f)}.`);
  };
  if (state.ventas.some(v => v.fecha === f)) {
    confirmModal({ title: 'Ya existe una venta en esta fecha', message: `Ya guardaste la venta del ${fmtFecha(f)}. Si continúas, se reemplazará con las cantidades actuales.`, okLabel: 'Reemplazar', onOk: commit });
  } else commit();
}
function savedHTML() {
  const meses = [...new Set(state.ventas.map(v => v.fecha.slice(0, 7)))].sort().reverse();
  if (ui.ventasMes !== 'todos' && !meses.includes(ui.ventasMes)) ui.ventasMes = 'todos';
  const lista = state.ventas.filter(v => ui.ventasMes === 'todos' || v.fecha.startsWith(ui.ventasMes)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sum = (arr, k) => arr.reduce((s, v) => s + num(v[k]), 0);
  const tiles = DIAS.map(d => {
    const l = lista.filter(v => v.dia === d);
    return `<div class="tile"><b>${d}</b><strong>${money(sum(l, 'total'))}</strong><span>${l.length} ${l.length === 1 ? 'jornada' : 'jornadas'}</span></div>`;
  }).join('');
  const rows = lista.map(v => `<tr>
    <td>${fmtFecha(v.fecha)}</td><td>${esc(v.dia)}</td><td class="r">${v.unidades}</td>
    <td class="r">${money(v.total)}</td><td class="r">${money(v.costo)}</td><td class="r">${money(v.utilidad)}</td>
    <td class="r">${v.total > 0 ? pct(v.utilidad / v.total * 100) : '—'}</td>
    <td class="r"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap">
      <button type="button" class="btn tiny" data-act="v-load" data-id="${v.id}">Cargar</button>
      <button type="button" class="icon-btn" data-act="v-del" data-id="${v.id}" aria-label="Eliminar venta" title="Eliminar">${ICON.x}</button></div></td>
  </tr>`).join('');
  const tu = sum(lista, 'total');
  return `<section class="card no-print" id="saved">
    <div class="card-head"><h2>Ventas guardadas</h2>
      <label class="inline-field"><span>Mes</span><select class="input" id="v-mes"><option value="todos"${ui.ventasMes === 'todos' ? ' selected' : ''}>Todos</option>${
        meses.map(m => `<option value="${m}"${ui.ventasMes === m ? ' selected' : ''}>${mesLabel(m)}</option>`).join('')}</select></label>
    </div>
    ${lista.length ? `<div class="day-tiles">${tiles}</div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Día</th><th class="r">Unidades</th><th class="r">Ventas</th><th class="r">Costo</th><th class="r">Utilidad</th><th class="r">Margen</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="r">${sum(lista, 'unidades')}</td><td class="r">${money(tu)}</td><td class="r">${money(sum(lista, 'costo'))}</td><td class="r">${money(sum(lista, 'utilidad'))}</td><td class="r">${tu > 0 ? pct(sum(lista, 'utilidad') / tu * 100) : '—'}</td><td></td></tr></tfoot>
    </table></div>` : '<div class="empty">Aún no hay ventas guardadas. Registra las cantidades y usa “Guardar venta del día”.</div>'}
  </section>`;
}
const refreshSaved = () => { const s = $('#saved'); if (s) s.outerHTML = savedHTML(); };

/* ==========================================================
   MÓDULO 4 – HISTORIAL DE VENTAS (PDF)
   ========================================================== */
function renderHistorial() {
  return `
  <header class="page-head">
    <div><h1>Historial de ventas</h1>
    <p>Sube los reportes en PDF y guárdalos por mes y día de atención. Después ábrelos o descárgalos desde el mes correspondiente.</p></div>
  </header>
  <div class="hist">
    <section class="card upload">
      <h2>Subir reporte</h2>
      <label class="drop" id="drop" for="pdf-input">${ICON.upload}<strong>Arrastra tus PDF aquí</strong><span>o haz clic para elegirlos</span></label>
      <input type="file" id="pdf-input" accept="application/pdf,.pdf" multiple hidden>
      <ul class="picked" id="picked"></ul>
      <div class="field"><label for="h-mes">Mes del reporte</label><input type="month" class="input" id="h-mes" value="${esc(ui.hMes)}"></div>
      <div class="field"><span class="lbl" id="dia-lbl">Día de atención</span>
        <div class="seg" role="radiogroup" aria-labelledby="dia-lbl">${DIAS.map(d => `<label><input type="radio" name="h-dia" value="${d}"><span>${d}</span></label>`).join('')}</div></div>
      <div class="field"><label for="h-nota">Nota (opcional)</label><input type="text" class="input" id="h-nota" placeholder="Ej. Semana 2"></div>
      <button type="button" class="btn primary block" data-act="h-upload">Subir PDF</button>
    </section>
    <section id="h-browser">${historialHTML()}</section>
  </div>`;
}
function historialHTML() {
  const meses = [...new Set(state.pdfs.map(p => p.mes))].sort().reverse();
  if (!meses.length) return '<div class="card empty-lg"><h2>Aún no hay reportes</h2><p>Cuando subas un PDF aparecerá aquí, ordenado por mes y por día de atención.</p></div>';
  if (ui.openMonths === null) ui.openMonths = new Set([meses[0]]);
  return `<div class="acc">${meses.map(monthHTML).join('')}</div>`;
}
function monthHTML(m) {
  const files = state.pdfs.filter(p => p.mes === m), open = ui.openMonths.has(m);
  return `<article class="acc-item${open ? ' open' : ''}">
    <button type="button" class="acc-head" data-act="h-toggle" data-month="${m}" aria-expanded="${open}">
      <span class="acc-title">${esc(mesLabel(m))}</span>
      <span class="acc-meta"><span class="chip neutral">${files.length} ${files.length === 1 ? 'reporte' : 'reportes'}</span>${ICON.chev}</span>
    </button>
    <div class="acc-body"><div class="acc-inner"><div class="days">${DIAS.map(d => dayHTML(m, d)).join('')}</div></div></div>
  </article>`;
}
function dayHTML(m, d) {
  const files = state.pdfs.filter(p => p.mes === m && p.dia === d).sort((a, b) => b.subido.localeCompare(a.subido));
  return `<div class="day">
    <div class="day-head"><h3>${d}</h3><span class="muted">${files.length ? files.length + (files.length === 1 ? ' PDF' : ' PDF') : 'Sin reportes'}</span></div>
    ${files.length ? `<ul class="files">${files.map(fileHTML).join('')}</ul>` : ''}
  </div>`;
}
function fileHTML(f) {
  return `<li class="file">
    <span class="file-ic">${ICON.pdf}</span>
    <div class="file-txt"><strong title="${esc(f.nombre)}">${esc(f.nombre)}</strong>
      <span class="muted">${f.nota ? esc(f.nota) + ' – ' : ''}${fmtSize(f.size)} – subido el ${fmtFecha(f.subido.slice(0, 10))}</span></div>
    <div class="file-actions">
      <button type="button" class="btn tiny" data-act="h-view" data-id="${f.id}">Ver</button>
      <button type="button" class="btn tiny" data-act="h-dl" data-id="${f.id}">Descargar</button>
      <button type="button" class="btn tiny" data-act="h-move" data-id="${f.id}">Mover</button>
      <button type="button" class="icon-btn" data-act="h-del" data-id="${f.id}" aria-label="Eliminar reporte" title="Eliminar">${ICON.x}</button>
    </div>
  </li>`;
}
const refreshBrowser = () => { const b = $('#h-browser'); if (b) b.innerHTML = historialHTML(); };

function bindHistorial() {
  const input = $('#pdf-input'), drop = $('#drop');
  if (!input || !drop) return;
  input.addEventListener('change', () => { addPicked(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addPicked(e.dataTransfer.files));
  renderPicked();
}
function addPicked(list) {
  let rechazados = 0;
  Array.from(list).forEach(f => {
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { rechazados++; return; }
    if (f.size > MAX_PDF) { toast(`“${f.name}” supera los ${fmtSize(MAX_PDF)}.`); return; }
    if (!ui.histFiles.some(x => x.name === f.name && x.size === f.size)) ui.histFiles.push(f);
  });
  if (rechazados) toast('Solo se aceptan archivos PDF.');
  renderPicked();
}
function renderPicked() {
  const ul = $('#picked'); if (!ul) return;
  ul.innerHTML = ui.histFiles.map((f, i) => `<li><span class="file-ic">${ICON.pdf}</span><span class="pk-name" title="${esc(f.name)}">${esc(f.name)}</span><span class="muted">${fmtSize(f.size)}</span><button type="button" class="icon-btn" data-act="h-unpick" data-idx="${i}" aria-label="Quitar archivo">${ICON.x}</button></li>`).join('');
}
async function subirPDFs(btn) {
  const mes = $('#h-mes').value, dia = ($('input[name="h-dia"]:checked') || {}).value, nota = $('#h-nota').value.trim();
  if (!ui.histFiles.length) return toast('Elige al menos un archivo PDF.');
  if (!mes) return toast('Indica el mes del reporte.');
  if (!dia) return toast('Elige el día de atención: jueves, viernes, sábado o domingo.');
  btn.disabled = true;
  let n = 0;
  try {
    for (const f of ui.histFiles) {
      const id = uid();
      await idbPut(id, f);
      state.pdfs.push({ id, nombre: f.name, mes, dia, nota, size: f.size, subido: new Date().toISOString() });
      n++;
    }
  } catch (e) {
    toast('No se pudo guardar el archivo en este navegador.');
  }
  btn.disabled = false;
  if (!n) return;
  ui.hMes = mes;
  ui.histFiles = [];
  if (ui.openMonths === null) ui.openMonths = new Set();
  ui.openMonths.add(mes);
  persistNow(); rerender();
  toast(`${n} ${n === 1 ? 'reporte guardado' : 'reportes guardados'} en ${mesLabel(mes)}, ${dia}.`);
}
async function verPDF(id) {
  const meta = state.pdfs.find(p => p.id === id); if (!meta) return;
  let blob;
  try { blob = await idbGet(id); } catch (e) { blob = null; }
  if (!blob) return toast('No se encontró el archivo en este navegador.');
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  setTimeout(() => URL.revokeObjectURL(url), 15 * 60 * 1000);
  openModal(`<div class="pdf-head"><div><h2>${esc(meta.nombre)}</h2><p class="muted">${esc(mesLabel(meta.mes))}, ${esc(meta.dia)}</p></div>
    <div class="row"><a class="btn" href="${url}" download="${esc(meta.nombre)}">Descargar</a><a class="btn" href="${url}" target="_blank" rel="noopener">Abrir en pestaña nueva</a><button type="button" class="btn" data-close>Cerrar</button></div></div>
    <iframe class="pdf-frame" src="${url}" title="${esc(meta.nombre)}"></iframe>`, { wide: true });
}
async function descargarPDF(id) {
  const meta = state.pdfs.find(p => p.id === id); if (!meta) return;
  let blob;
  try { blob = await idbGet(id); } catch (e) { blob = null; }
  if (!blob) return toast('No se encontró el archivo en este navegador.');
  downloadBlob(new Blob([blob], { type: 'application/pdf' }), meta.nombre);
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ==========================================================
   MÓDULO 5 – PRECIOS DE CARTA
   ========================================================== */
function renderPrecios() {
  const rows = groupByCategory(state.productos).map(([c, items]) =>
    `<tr class="cat-row"><td colspan="6">${esc(c)}</td></tr>` + items.map(p => `<tr data-row="pr" data-id="${p.id}">
      <td><input class="cell" data-k="nombre" value="${esc(p.nombre)}" aria-label="Producto"></td>
      <td class="r"><button type="button" class="link" data-act="goto-costo" data-id="${p.id}" title="Ver receta y costos"><span data-cu></span></button></td>
      <td class="r"><input class="cell num" type="number" min="0" step="any" inputmode="decimal" data-k="precio" value="${num(p.precio) || ''}" placeholder="0.00" aria-label="Precio de carta"></td>
      <td class="r calc" data-ut></td>
      <td class="r"><span class="chip neutral" data-mg></span></td>
      <td class="r calc"><span data-sug></span> <button type="button" class="btn tiny" data-act="apply-sug" data-id="${p.id}">Usar</button></td>
    </tr>`).join('')).join('');
  return `
  <header class="page-head">
    <div><h1>Precios de carta</h1>
    <p>Define el precio de venta de cada producto y revisa cuánto te deja. El costo viene de Costo de producción.</p></div>
    <div class="page-actions">
      <label class="inline-field"><span>Margen objetivo</span><input type="number" class="input" id="obj" min="0" max="95" step="1" inputmode="decimal" value="${num(state.ajustes.margenObjetivo)}"><span class="suffix">%</span></label>
      <button type="button" class="btn primary" data-act="prod-add">Agregar producto</button>
    </div>
  </header>
  <div class="kpis" id="pr-kpis"></div>
  <section class="card"><div class="tbl-wrap"><table class="tbl" id="pr-table">
    <thead><tr><th>Producto</th><th class="r">Costo unitario</th><th class="r">Precio de carta (S/)</th><th class="r">Utilidad</th><th class="r">Margen</th><th class="r">Precio sugerido</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="empty">Aún no hay productos. Agrega el primero con “Agregar producto”.</td></tr>'}</tbody>
  </table></div></section>`;
}
function recalcPrecios() {
  if (!$('#pr-table')) return;
  const obj = num(state.ajustes.margenObjetivo);
  let priced = 0, sumMg = 0, bajo = 0;
  state.productos.forEach(p => {
    const tr = $(`#pr-table tr[data-id="${p.id}"]`); if (!tr) return;
    const cu = costoUnit(p), pr = num(p.precio), ut = pr - cu, mg = margenPct(p);
    $('[data-cu]', tr).textContent = money(cu);
    $('[data-ut]', tr).textContent = pr > 0 ? money(ut) : '—';
    const chip = $('[data-mg]', tr);
    if (pr > 0) { chip.textContent = pct(mg); chip.className = 'chip ' + margenClase(mg); priced++; sumMg += mg; if (mg < obj) bajo++; }
    else { chip.textContent = 'Sin precio'; chip.className = 'chip neutral'; }
    const sg = sugerido(p);
    $('[data-sug]', tr).textContent = sg ? money(sg) : '—';
    $('[data-act="apply-sug"]', tr).disabled = !sg || Math.abs(sg - pr) < 0.005;
  });
  $('#pr-kpis').innerHTML =
    kpi('Productos con precio', `${priced} de ${state.productos.length}`, 'En la carta actual') +
    kpi('Margen promedio', priced ? pct(sumMg / priced) : '—', `Objetivo ${pct(obj)}`) +
    kpi('Bajo el objetivo', String(bajo), bajo ? 'Revisa precio o receta' : 'Todo dentro del objetivo', bajo ? 'warn' : '');
}
function onPrecioInput(t, row) {
  const p = prod(row.dataset.id); if (!p) return;
  if (t.dataset.k === 'precio') p.precio = num(t.value); else p.nombre = t.value;
  save(); recalcPrecios();
}

/* ---------- 8. Respaldo ---------- */
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

async function exportBackup() {
  try {
    toast('Preparando respaldo…');
    const pdfs = [];
    for (const m of state.pdfs) {
      const b = await idbGet(m.id);
      if (b) pdfs.push({ id: m.id, data: await blobToDataURL(b) });
    }
    const payload = JSON.stringify({ app: 'diletto-artesanal', version: 1, exportado: new Date().toISOString(), state, pdfs });
    downloadBlob(new Blob([payload], { type: 'application/json' }), `respaldo-diletto-${todayISO()}.json`);
    toast('Respaldo descargado.');
  } catch (e) { toast('No se pudo crear el respaldo.'); }
}
async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data.app !== 'diletto-artesanal' || !data.state) throw new Error('formato');
  } catch (e) { toast('El archivo no es un respaldo válido de Diletto Artesanal.'); return; }
  confirmModal({
    title: 'Restaurar respaldo',
    message: 'Se reemplazarán los datos y los PDF guardados en este navegador por los del respaldo.',
    okLabel: 'Restaurar',
    onOk: async () => {
      try {
        for (const m of state.pdfs) { try { await idbDel(m.id); } catch (e) { /* ya no existía */ } }
        for (const f of data.pdfs || []) { await idbPut(f.id, await (await fetch(f.data)).blob()); }
        state = normalize(data.state);
        ui.openMonths = null; ui.costoSel = null;
        persistNow(); show(ui.view, { instant: true });
        toast('Respaldo restaurado.');
      } catch (e) { toast('No se pudo restaurar el respaldo.'); }
    }
  });
}

/* ---------- 9. Acciones (clics) ---------- */
const ACTIONS = {
  'modal-ok'() { const fn = pendingOk; pendingOk = null; closeModal(); if (fn) fn(); },

  'ej-keep'() { state.ejemplo = false; persistNow(); renderBanner(); },
  'ej-blank'() {
    confirmModal({
      title: 'Empezar en blanco', danger: true, okLabel: 'Borrar datos de ejemplo',
      message: 'Se quitarán los insumos, las recetas y los precios de ejemplo. Los productos y categorías se conservan para que los completes.',
      onOk: () => {
        state.insumos = [];
        state.productos.forEach(p => { p.ingredientes = []; p.otros = 0; p.precio = 0; p.rinde = 1; });
        state.ejemplo = false;
        persistNow(); renderBanner(); rerender();
        toast('Listo. Empieza cargando tus insumos y recetas.');
      }
    });
  },
  'backup-export': exportBackup,
  'backup-import'() { $('#backup-input').click(); },

  /* Abarrotes */
  'ins-add'() {
    state.insumos.push({ id: uid(), nombre: '', categoria: 'Abarrotes', unidad: 'kg', cantidad: 0, costoUnit: 0 });
    save(); rerender();
    const rows = $$('#ins-table tbody tr'); const last = rows[rows.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); $('input', last).focus(); }
  },
  'ins-del'(t) {
    const id = t.closest('tr').dataset.id, ins = insumoById(id); if (!ins) return;
    const usos = state.productos.filter(p => p.ingredientes.some(r => r.insumoId === id)).length;
    confirmModal({
      title: 'Eliminar insumo', danger: true, okLabel: 'Eliminar',
      message: usos
        ? `“${ins.nombre || 'Sin nombre'}” se usa en ${usos} ${usos === 1 ? 'receta' : 'recetas'}. Si lo eliminas, se quitará de esas recetas.`
        : `¿Eliminar “${ins.nombre || 'este insumo'}” de la lista?`,
      onOk: () => {
        state.insumos = state.insumos.filter(i => i.id !== id);
        state.productos.forEach(p => { p.ingredientes = p.ingredientes.filter(r => r.insumoId !== id); });
        save(); rerender();
      }
    });
  },

  /* Productos y recetas */
  'prod-add'() {
    formModal({
      title: 'Nuevo producto', submitLabel: 'Crear producto',
      fields: [
        { key: 'nombre', label: 'Nombre', placeholder: 'Ej. Pizza personal' },
        { key: 'categoria', label: 'Categoría', type: 'select', options: CATEGORIAS_PRODUCTO, value: CATEGORIAS_PRODUCTO[0] },
        { key: 'rinde', label: 'Unidades que rinde la receta', type: 'number', value: 1, min: 0 }
      ],
      onSubmit: v => {
        if (!v.nombre) { toast('Escribe el nombre del producto.'); return false; }
        const p = { id: uid(), nombre: v.nombre, categoria: v.categoria, rinde: num(v.rinde) || 1, otros: 0, precio: 0, ingredientes: [] };
        state.productos.push(p); ui.costoSel = p.id;
        save(); rerender();
        if (ui.view === 'precios') { const tr = $(`#pr-table tr[data-id="${p.id}"]`); if (tr) { tr.scrollIntoView({ block: 'center' }); $('input[data-k="precio"]', tr).focus(); } }
        toast(`“${p.nombre}” agregado. Completa su receta en Costo de producción.`);
      }
    });
  },
  'prod-del'(t) {
    const p = prod(t.dataset.id); if (!p) return;
    confirmModal({
      title: 'Eliminar producto', danger: true, okLabel: 'Eliminar',
      message: `Se eliminará “${p.nombre || 'este producto'}” con su receta y su precio de carta. Las ventas ya guardadas no cambian.`,
      onOk: () => {
        state.productos = state.productos.filter(x => x.id !== p.id);
        delete state.borrador.cant[p.id];
        ui.costoSel = null; persistNow(); rerender();
      }
    });
  },
  'costo-pick'(t) { pickProducto(t.dataset.id); },
  'goto-costo'(t) { ui.costoSel = t.dataset.id; location.hash = 'costos'; },
  'ing-add'() {
    const p = selProd(); if (!p) return;
    p.ingredientes.push({ insumoId: '', cantidad: 0 });
    save(); $('#pdetail').innerHTML = detalleHTML(); recalcCostos();
    const rows = $$('#rec-table tbody tr'); const last = rows[rows.length - 1];
    if (last) $('select', last).focus();
  },
  'ing-del'(t) {
    const p = selProd(); if (!p) return;
    p.ingredientes.splice(+t.dataset.idx, 1);
    save(); $('#pdetail').innerHTML = detalleHTML(); recalcCostos();
  },

  /* Precios */
  'apply-sug'(t) {
    const p = prod(t.dataset.id); if (!p) return;
    const sg = sugerido(p); if (!sg) return;
    p.precio = sg;
    const inp = $(`#pr-table tr[data-id="${p.id}"] input[data-k="precio"]`); if (inp) inp.value = sg;
    save(); recalcPrecios();
  },

  /* Ventas */
  'qty-inc'(t) { stepQty(t.dataset.id, 1); },
  'qty-dec'(t) { stepQty(t.dataset.id, -1); },
  'v-save': guardarVenta,
  'v-clear'() { state.borrador.cant = {}; save(); rerender(); },
  'v-print'() { window.print(); },
  'v-load'(t) {
    const v = state.ventas.find(x => x.id === t.dataset.id); if (!v) return;
    state.borrador.fecha = v.fecha;
    state.borrador.cant = {};
    v.items.forEach(i => { if (prod(i.productoId)) state.borrador.cant[i.productoId] = i.cantidad; });
    persistNow(); rerender(); window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Venta cargada. Ajusta las cantidades y guarda para actualizarla.');
  },
  'v-del'(t) {
    const v = state.ventas.find(x => x.id === t.dataset.id); if (!v) return;
    confirmModal({
      title: 'Eliminar venta guardada', danger: true, okLabel: 'Eliminar',
      message: `Se eliminará la venta del ${v.dia} ${fmtFecha(v.fecha)} (${money(v.total)}).`,
      onOk: () => { state.ventas = state.ventas.filter(x => x.id !== v.id); persistNow(); refreshSaved(); }
    });
  },

  /* Historial */
  'h-upload'(t) { subirPDFs(t); },
  'h-unpick'(t) { ui.histFiles.splice(+t.dataset.idx, 1); renderPicked(); },
  'h-toggle'(t) {
    const art = t.closest('.acc-item'), m = t.dataset.month;
    const open = !art.classList.contains('open');
    art.classList.toggle('open', open);
    t.setAttribute('aria-expanded', String(open));
    if (open) ui.openMonths.add(m); else ui.openMonths.delete(m);
  },
  'h-view'(t) { verPDF(t.dataset.id); },
  'h-dl'(t) { descargarPDF(t.dataset.id); },
  'h-move'(t) {
    const meta = state.pdfs.find(p => p.id === t.dataset.id); if (!meta) return;
    formModal({
      title: 'Mover reporte', intro: meta.nombre, submitLabel: 'Mover',
      fields: [
        { key: 'mes', label: 'Mes', type: 'month', value: meta.mes },
        { key: 'dia', label: 'Día de atención', type: 'select', options: DIAS, value: meta.dia }
      ],
      onSubmit: v => {
        if (!v.mes) { toast('Indica el mes.'); return false; }
        meta.mes = v.mes; meta.dia = v.dia;
        ui.openMonths.add(v.mes);
        persistNow(); refreshBrowser();
        toast(`Reporte movido a ${mesLabel(v.mes)}, ${v.dia}.`);
      }
    });
  },
  'h-del'(t) {
    const meta = state.pdfs.find(p => p.id === t.dataset.id); if (!meta) return;
    confirmModal({
      title: 'Eliminar reporte', danger: true, okLabel: 'Eliminar',
      message: `Se eliminará “${meta.nombre}” de ${mesLabel(meta.mes)}, ${meta.dia}. Esta acción no se puede deshacer.`,
      onOk: async () => {
        try { await idbDel(meta.id); } catch (e) { /* ya no estaba */ }
        state.pdfs = state.pdfs.filter(p => p.id !== meta.id);
        persistNow(); refreshBrowser();
      }
    });
  }
};

/* ---------- 10. Eventos globales ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-close],[data-view],[data-act]');
  if (!t) return;
  if (t.hasAttribute('data-close')) { closeModal(); return; }
  if (t.dataset.view) { if (location.hash.slice(1) === t.dataset.view) show(t.dataset.view); else location.hash = t.dataset.view; return; }
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  switch (t.id) {
    case 'ins-search': return filtrarInsumos(t.value);
    case 'psel': return pickProducto(t.value);
    case 'obj': state.ajustes.margenObjetivo = Math.min(95, Math.max(0, num(t.value))); save(); return recalcPrecios();
    case 'v-fecha': state.borrador.fecha = t.value || todayISO(); save(); return recalcVentas();
    case 'v-mes': ui.ventasMes = t.value; return refreshSaved();
    case 'h-mes': ui.hMes = t.value; return;
  }
  const row = t.closest('[data-row]');
  if (!row || !t.dataset.k) return;
  const h = { ins: onInsumoInput, prod: onProdInput, ing: onIngInput, pr: onPrecioInput, vt: onVentaInput }[row.dataset.row];
  if (h) h(t, row);
});

document.addEventListener('focusin', e => {
  if (e.target.matches && e.target.matches('input[type=number]')) e.target.select();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});
$('#backup-input').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) importBackup(f);
});
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
window.addEventListener('hashchange', () => show(routeFromHash()));
window.addEventListener('beforeunload', persistNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });

/* ---------- 11. Inicio ---------- */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
show(routeFromHash(), { instant: true });

})();
