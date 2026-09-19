/* Módulo 5: Precios de carta, con costo, utilidad y margen de cada producto */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h, E = window.DLEngine, F = DL.fmt;
  DL.views = DL.views || {};
  const local = { fam: '*', q: '', sinPrecio: false };

  const sugerido = (p) => { const obj = DL.Store.state.config.margenObjetivo; if (obj >= 1) return 0; const x = p.costoLlevar / (1 - obj); return Math.ceil(x * 2) / 2; };
  const priceInput = (pk, label) => DL.numInput({ value: E.precio(pk), label, placeholder: '0.00', onInput: (v) => { DL.Store.state.precios[pk] = v; DL.Store.changed(); } });
  const byPk = (pk) => E.products().find((p) => p.pk === pk);

  function tablaGenerica(prods) {
    const body = h('tbody');
    prods.forEach((p0) => {
      const P = () => E.productById(p0.id) || p0;
      const c = (fn, cls) => { const td = h('td', { class: 'num ' + (cls || '') }); DL.bind(td, fn); return td; };
      body.append(h('tr', { dataset: { q: E.norm(p0.nombre + ' ' + p0.seccion), s: p0.precio ? '1' : '0' } },
        h('td', {}, h('div', {}, p0.nombre), p0.seccion ? h('div', { class: 'tenue chico' }, p0.seccion) : null),
        h('td', { class: 'num' }, priceInput(p0.pk, 'Precio de ' + p0.nombre)),
        c(() => F.money(P().costoLlevar)),
        c(() => (P().precio ? F.money(P().utilLlevar) : '—')),
        h('td', { class: 'num' }, DL.badgeMargen(() => P().margenLlevar, () => P().precio)),
        c(() => F.money(sugerido(P())), 'tenue')));
    });
    return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), ['Precio de carta', 'Costo para llevar', 'Utilidad', 'Margen', 'Precio sugerido'].map((t) => h('th', { scope: 'col', class: 'num' }, t)))), body));
  }

  // Cuadrícula sabor × tamaño para pizzas
  function tablaPizzas() {
    const P = DL.Store.state.pizzas;
    const sabores = []; const seen = new Set();
    P.tamanos.forEach((t) => { const m = P.matrices[t.id + '|unico']; if (m) m.filas.forEach((f) => { if (!seen.has(E.slug(f.s))) { seen.add(E.slug(f.s)); sabores.push(f.s); } }); });
    const cell = (pk, id) => {
      const p = E.productById(id); if (!p) return h('td', { class: 'num tenue' }, '—');
      const bad = DL.badgeMargen(() => (E.productById(id) || p).margenLlevar, () => (E.productById(id) || p).precio);
      return h('td', { class: 'num celda-precio' }, priceInput(pk, p.nombre), bad);
    };
    const body = h('tbody');
    sabores.forEach((s) => body.append(h('tr', {}, h('th', { scope: 'row' }, s), P.tamanos.map((t) => cell('pz:' + t.id + ':' + E.slug(s), 'pz-' + t.id + '-u-' + E.slug(s))))));
    body.append(h('tr', { class: 'fila-sep' }, h('th', { scope: 'row' }, 'Dos sabores'), P.tamanos.map((t) => {
      const m = P.matrices[t.id + '|dos']; if (!m || !m.filas.length) return h('td', { class: 'num tenue' }, '—');
      const id = 'pz-' + t.id + '-d-' + E.slug(m.filas[0].s);
      return cell('pzdos:' + t.id, id);
    })));
    return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-precios' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Sabor'), P.tamanos.map((t) => h('th', { scope: 'col', class: 'num' }, t.nombre)))), body));
  }

  function tablaPasteles() {
    const D = window.DILETTO_DATA;
    const body = h('tbody');
    Object.keys(D.pasteles).forEach((id) => {
      const cell = (k) => { const pid = 'pa-' + id + '-' + k; const p = E.productById(pid);
        return h('td', { class: 'num celda-precio' }, priceInput('pa:' + id + ':' + k, D.pasteles[id].nombre + ' ' + k), DL.badgeMargen(() => E.productById(pid).margenLlevar, () => E.productById(pid).precio)); };
      body.append(h('tr', {}, h('th', { scope: 'row' }, D.pasteles[id].nombre), cell('entero'), cell('tajada'), cell('mayor')));
    });
    return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-precios' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Pastel'), ['Entero', 'Tajada', 'Por mayor (c/u, desde 3)'].map((t) => h('th', { scope: 'col', class: 'num' }, t)))), body));
  }

  DL.views.carta = {
    titulo: 'Precios de carta',
    sub: 'Precio de venta de cada producto con su utilidad y margen. Estos precios alimentan el módulo de Ventas.',
    render(host) {
      const st = DL.Store.state;
      host.append(DL.famPills({ active: local.fam, todos: true, onPick: (id) => { local.fam = id; DL.rerender(); } }));
      const obj = DL.numInput({ value: st.config.margenObjetivo * 100, label: 'Margen objetivo en porcentaje', placeholder: '50', onInput: (v) => { st.config.margenObjetivo = Math.min(95, Math.max(0, v)) / 100; DL.Store.changed(); } });
      host.append(h('div', { class: 'barra' },
        h('input', { type: 'search', class: 'buscar', placeholder: 'Buscar producto', 'aria-label': 'Buscar producto', value: local.q, oninput: (e) => { local.q = e.target.value; filtrar(); } }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: local.sinPrecio, onchange: (e) => { local.sinPrecio = e.target.checked; filtrar(); } }), 'Solo sin precio'),
        h('span', { class: 'espacio' }),
        h('label', { class: 'rinde' }, 'Margen objetivo', obj, h('span', { class: 'sufijo' }, '%'))));
      const grupos = window.DILETTO_DATA.grupos;
      const fams = window.DILETTO_DATA.familias.filter((f) => local.fam === '*' || f.id === local.fam);
      const secciones = [];
      grupos.forEach((g) => fams.filter((f) => f.grupo === g).forEach((f) => {
        const prods = E.products().filter((p) => p.fam === f.id);
        if (!prods.length) return;
        let cuerpo;
        if (f.id === 'pizzas') cuerpo = h('div', {}, tablaPizzas(), h('h3', { class: 'subtitulo' }, 'Por tajada'), tablaGenerica(prods.filter((p) => p.seccion === 'Por tajada')));
        else if (f.id === 'pasteles') cuerpo = tablaPasteles();
        else cuerpo = tablaGenerica(prods);
        const sec = h('section', { class: 'tarjeta', dataset: { fam: f.id } }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, f.nombre), h('p', { class: 'tenue' }, g)), cuerpo);
        secciones.push(sec); host.append(sec);
      }));
      if (!secciones.length) host.append(DL.empty('No hay productos en esta categoría'));
      host.append(h('p', { class: 'nota' }, 'El margen es (precio − costo para llevar) ÷ precio. El precio sugerido redondea hacia arriba al medio sol para alcanzar el margen objetivo. No incluye costos indirectos.'));
      function filtrar() {
        const q = E.norm(local.q);
        host.querySelectorAll('tbody tr[data-q]').forEach((tr) => { tr.hidden = !((!q || tr.dataset.q.includes(q)) && (!local.sinPrecio || tr.dataset.s === '0')); });
      }
      filtrar();
    },
  };
})();
