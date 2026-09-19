/* Utilidades de interfaz: creación de DOM, formatos, enlaces reactivos, avisos y diálogos. */
(function () {
  'use strict';
  const DL = (window.DL = window.DL || {});
  const E = window.DLEngine;

  /* ---------- DOM ---------- */
  DL.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v; // solo para SVG estáticos propios
        else if (k === 'value') value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = !!v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    if (value !== undefined) el.value = value; // después de crear las opciones
    return el;
  };
  const h = DL.h;
  DL.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- Formatos ---------- */
  const nf = (min, max) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: min, maximumFractionDigits: max });
  const nf2 = nf(2, 2), nf4 = nf(2, 4), nf1 = nf(0, 1), nf0 = nf(0, 0);
  DL.fmt = {
    money: (n) => 'S/ ' + nf2.format(Number.isFinite(n) ? n : 0),
    money4: (n) => 'S/ ' + nf4.format(Number.isFinite(n) ? n : 0),
    pct: (n) => (n == null || !Number.isFinite(n) ? '—' : nf1.format(n * 100) + ' %'),
    int: (n) => nf0.format(Number.isFinite(n) ? n : 0),
    dec: (n, max = 2) => nf(0, max).format(Number.isFinite(n) ? n : 0),
    input: (n) => (!n ? '' : String(+Number(n).toFixed(4))),
    date: (iso) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-').map(Number);
      return d + ' ' + DL.MESES[m - 1].slice(0, 3).toLowerCase() + ' ' + y;
    },
    bytes: (b) => (b < 1024 ? b + ' B' : b < 1048576 ? nf1.format(b / 1024) + ' KB' : nf1.format(b / 1048576) + ' MB'),
  };
  DL.MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  DL.DIAS = ['Jueves', 'Viernes', 'Sábado', 'Domingo'];
  DL.DIA_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  DL.isoToday = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  DL.isoParts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d, dow: new Date(y, m - 1, d).getDay() }; };
  DL.uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  /* ---------- Enlaces reactivos ----------
     Cada vista registra funciones que se reevalúan tras cualquier cambio de datos.
     Así los totales se actualizan mientras se escribe, sin perder el foco. */
  DL._binds = [];
  DL.resetBinds = () => { DL._binds = []; };
  DL.bind = (node, fn) => { DL._binds.push({ node, fn }); node.textContent = fn(); return node; };
  DL.bindCls = (node, fn) => {
    let prev = '';
    const apply = () => { const c = fn() || ''; if (c !== prev) { if (prev) prev.split(' ').forEach((x) => x && node.classList.remove(x)); if (c) c.split(' ').forEach((x) => x && node.classList.add(x)); prev = c; } };
    DL._binds.push({ node, apply }); apply(); return node;
  };
  DL.bindFn = (fn) => { DL._binds.push({ fn, call: true }); fn(); };
  DL.refresh = () => {
    DL._binds = DL._binds.filter((b) => b.call || b.node.isConnected);
    DL._binds.forEach((b) => {
      try {
        if (b.call) b.fn();
        else if (b.apply) b.apply();
        else { const t = b.fn(); if (b.node.textContent !== t) b.node.textContent = t; }
      } catch (e) { console.error(e); }
    });
  };

  /* Clase de color para un margen según el margen objetivo */
  DL.margenClase = (m, precio) => {
    if (!precio) return 'm-nulo';
    const obj = DL.Store.state.config.margenObjetivo;
    if (m < 0) return 'm-neg';
    return m >= obj ? 'm-ok' : 'm-bajo';
  };
  DL.badgeMargen = (getMargen, getPrecio) => {
    const s = h('span', { class: 'insignia' });
    DL.bind(s, () => DL.fmt.pct(getMargen()));
    DL.bindCls(s, () => DL.margenClase(getMargen(), getPrecio()));
    return s;
  };

  /* ---------- Campos ---------- */
  // Campo numérico: escribe en el estado con cada tecla (onInput) y normaliza al salir.
  DL.numInput = ({ value, onInput, onChange, cls = '', label = '', placeholder = '0', width }) => {
    const inp = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'celda num ' + cls, placeholder, 'aria-label': label,
      value: DL.fmt.input(value),
      onfocus: (e) => e.target.select(),
      oninput: (e) => { if (onInput) onInput(E.num(e.target.value), e); },
      onchange: (e) => { const v = E.num(e.target.value); e.target.value = DL.fmt.input(v); if (onChange) onChange(v, e); },
    });
    if (width) inp.style.width = width;
    return inp;
  };
  DL.textInput = ({ value, onChange, onInput, cls = '', label = '', placeholder = '', list }) =>
    h('input', {
      type: 'text', autocomplete: 'off', class: 'celda ' + cls, placeholder, 'aria-label': label, list, value: value || '',
      oninput: onInput ? (e) => onInput(e.target.value, e) : null,
      onchange: onChange ? (e) => onChange(e.target.value.trim(), e) : null,
    });
  DL.select = ({ value, options, onChange, cls = '', label = '' }) =>
    h('select', { class: 'celda sel ' + cls, 'aria-label': label, value, onchange: (e) => onChange(e.target.value, e) },
      options.map((o) => { const v = typeof o === 'string' ? o : o.v, t = typeof o === 'string' ? o : o.t; return h('option', { value: v }, t); }));

  DL.iconBtn = (icon, label, onClick, cls = '') =>
    h('button', { type: 'button', class: 'btn-icono ' + cls, 'aria-label': label, title: label, onclick: onClick, html: icon });

  /* Pastillas de familias, agrupadas como en el menú del Excel */
  DL.famPills = ({ active, onPick, exclude = [], todos = false }) => {
    const D = window.DILETTO_DATA;
    const wrap = h('div', { class: 'familias', role: 'tablist' });
    if (todos) wrap.append(h('div', { class: 'fam-grupo' }, h('button', { type: 'button', role: 'tab', 'aria-selected': active === '*' ? 'true' : 'false', class: 'pildora' + (active === '*' ? ' activa' : ''), onclick: () => onPick('*') }, 'Todos')));
    D.grupos.forEach((g) => {
      const fams = D.familias.filter((f) => f.grupo === g && !exclude.includes(f.id));
      if (!fams.length) return;
      wrap.append(h('div', { class: 'fam-grupo' }, h('span', { class: 'fam-grupo-nombre' }, g),
        h('div', { class: 'fam-lista' }, fams.map((f) =>
          h('button', { type: 'button', role: 'tab', 'aria-selected': active === f.id ? 'true' : 'false', class: 'pildora' + (active === f.id ? ' activa' : ''), onclick: () => onPick(f.id) }, f.nombre)))));
    });
    return wrap;
  };

  DL.segmented = ({ value, options, onPick, label = '' }) =>
    h('div', { class: 'segmentos', role: 'group', 'aria-label': label },
      options.map((o) => h('button', { type: 'button', class: 'segmento' + (o.v === value ? ' activo' : ''), 'aria-pressed': o.v === value ? 'true' : 'false', onclick: () => onPick(o.v) }, o.t)));

  DL.empty = (titulo, texto, accion) => h('div', { class: 'vacio' }, h('p', { class: 'vacio-titulo' }, titulo), texto ? h('p', { class: 'vacio-texto' }, texto) : null, accion || null);

  /* ---------- Avisos y diálogos ---------- */
  DL.toast = (msg, kind = '') => {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = h('div', { class: 'aviso ' + kind, role: 'status' }, msg);
    host.append(t);
    setTimeout(() => t.classList.add('sale'), 3200);
    setTimeout(() => t.remove(), 3600);
  };
  DL.confirm = ({ titulo, mensaje, ok = 'Confirmar', peligro = false }) =>
    new Promise((resolve) => {
      const dlg = h('dialog', { class: 'dialogo dialogo-chico' });
      if (typeof dlg.showModal !== 'function') return resolve(window.confirm(titulo + '\n' + (mensaje || '')));
      const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.append(h('h2', {}, titulo), mensaje ? h('p', {}, mensaje) : null,
        h('div', { class: 'dialogo-pie' },
          h('button', { type: 'button', class: 'btn', onclick: () => done(false) }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn ' + (peligro ? 'btn-peligro' : 'btn-primario'), onclick: () => done(true) }, ok)));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
      document.body.append(dlg);
      dlg.showModal();
    });

  /* ---------- Iconos (SVG propios, trazo 1.6) ---------- */
  const svg = (p) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  DL.icons = {
    abarrotes: svg('<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>'),
    produccion: svg('<path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M8 11V9a4 4 0 0 1 8 0v2M3 11h18"/>'),
    ventas: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    historial: svg('<path d="M4 5h16v4H4zM6 9v10h12V9"/><path d="M10 13h4"/>'),
    carta: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M9 8h7M9 12h5"/>'),
    mas: svg('<path d="M12 5v14M5 12h14"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    mas_chico: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    menos_chico: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    mas_opciones: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    subir: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
    pdf: svg('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 14h6M9 17h4"/>'),
    ojo: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    bajar: svg('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
    editar: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    chevron: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    imprimir: svg('<path d="M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v7H7z"/>'),
  };
})();
