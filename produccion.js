/* Módulo 2: Costo de producción (recetas, empaques, pizzas por tamaño y sabor, pasteles) */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h, E = window.DLEngine, F = DL.fmt;
  DL.views = DL.views || {};
  const TIPO = { receta: 'Receta', empaque: 'Empaque y acompañamiento' };

  /* Tarjeta editable de un bloque (receta, empaque o acompañamiento) */
  function blockCard(b, fam, listId) {
    const rows = h('tbody');
    b.lineas.forEach((ln, i) => {
      if (ln.s) {
        rows.append(h('tr', { class: 'seccion' }, h('td', { colspan: 3 }, ln.s), h('td', { class: 'acciones' }, DL.iconBtn(DL.icons.borrar, 'Quitar título', () => { b.lineas.splice(i, 1); DL.Store.changed(); DL.rerender(); }, 'borrar'))));
        return;
      }
      const costo = h('span'); const falta = () => E.lineMissing(fam, ln);
      DL.bind(costo, () => (falta() ? 'Sin precio' : F.money(E.lineCost(fam, ln))));
      DL.bindCls(costo, () => (falta() ? 'falta' : ''));
      const unidad = h('span', { class: 'sufijo' });
      DL.bind(unidad, () => (ln.ref ? 'und' : E.insumoUnidad(fam, ln.i)));
      const nombre = ln.ref
        ? h('span', { class: 'nombre-fijo' }, ln.nombre || 'Lote')
        : DL.textInput({ value: ln.i, label: 'Insumo', placeholder: 'Escribe o elige un insumo', list: listId, onChange: (v) => { ln.i = v; DL.Store.changed(); } });
      rows.append(h('tr', {},
        h('td', { class: 'col-nombre' }, nombre),
        h('td', { class: 'num' }, h('div', { class: 'con-sufijo' }, DL.numInput({ value: ln.q, label: 'Cantidad', onInput: (v) => { ln.q = v; DL.Store.changed(); } }), unidad)),
        h('td', { class: 'num' }, costo),
        h('td', { class: 'acciones' }, DL.iconBtn(DL.icons.borrar, 'Quitar línea', () => { b.lineas.splice(i, 1); DL.Store.changed(); DL.rerender(); }, 'borrar'))));
    });
    const total = h('span'); DL.bind(total, () => F.money(E.blockTotal(b.id)));
    const foot = [h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'Total'), h('td', { class: 'num' }, total), h('td'))];
    if (b.rinde) {
      const pu = h('span'); DL.bind(pu, () => F.money4(E.perUnit(b.id)));
      foot.push(h('tr', { class: 'subtotal' }, h('td', { colspan: 2 }, 'Costo por ' + (b.unidad ? b.unidad.replace(/s$/, '') : 'unidad')), h('td', { class: 'num' }, pu), h('td')));
    }
    return h('section', { class: 'bloque bloque-' + b.tipo },
      h('header', { class: 'bloque-cab' },
        h('div', {}, h('h3', {}, b.titulo), h('span', { class: 'etiqueta' }, TIPO[b.tipo] || b.tipo)),
        b.rinde ? h('label', { class: 'rinde' }, 'Rinde', DL.numInput({ value: b.rinde, label: 'Rendimiento', onInput: (v) => { b.rinde = v; DL.Store.changed(); } }), h('span', { class: 'sufijo' }, b.unidad || '')) : null),
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-compacta' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Insumo'), h('th', { scope: 'col', class: 'num' }, 'Cantidad'), h('th', { scope: 'col', class: 'num' }, 'Costo'), h('th'))),
        rows, h('tfoot', {}, foot))),
      h('footer', { class: 'bloque-pie' }, h('button', { type: 'button', class: 'btn btn-suave', onclick: () => {
        b.lineas.push({ i: '', q: 0 }); DL.Store.changed();
        DL.rerender(() => { const c = document.querySelector('[data-bloque="' + b.id + '"] tbody tr:last-child .col-nombre input'); if (c) c.focus(); });
      } }, h('span', { html: DL.icons.mas_chico }), 'Agregar insumo')));
  }
  const wrapBlock = (b, fam, listId) => { const c = blockCard(b, fam, listId); c.dataset.bloque = b.id; return c; };

  function datalist(fam) {
    const names = []; const seen = new Set();
    (DL.Store.state.insumos[fam] || []).forEach((it) => [it.p, it.pu].forEach((n) => { if (n && !seen.has(E.norm(n))) { seen.add(E.norm(n)); names.push(n); } }));
    return h('datalist', { id: 'lista-' + fam }, names.map((n) => h('option', { value: n })));
  }

  /* Tabla resumen: costo de cada producto de la familia */
  function resumen(fam) {
    const prods = E.products().filter((p) => p.fam === fam);
    if (!prods.length) return null;
    const conSec = prods.some((p) => p.seccion);
    const P = (id) => E.productById(id);
    const body = h('tbody');
    prods.forEach((p0) => {
      const celda = (fn, cls) => { const td = h('td', { class: 'num ' + (cls || '') }); DL.bind(td, fn); return td; };
      const marg = h('td', { class: 'num' }, DL.badgeMargen(() => P(p0.id).margenLlevar, () => P(p0.id).precio));
      body.append(h('tr', {},
        h('td', {}, p0.nombre), conSec ? h('td', { class: 'tenue' }, p0.seccion) : null,
        celda(() => F.money(P(p0.id).costo)), celda(() => F.money(P(p0.id).empaque)),
        celda(() => F.money(P(p0.id).costoLlevar), 'fuerte'), celda(() => (P(p0.id).precio ? F.money(P(p0.id).precio) : 'Sin precio'), 'tenue'),
        celda(() => (P(p0.id).precio ? F.money(P(p0.id).utilLlevar) : '—')), marg));
    });
    return h('section', { class: 'tarjeta' },
      h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Costo por producto'), h('p', {}, 'Producción es el costo de insumos; para llevar suma el empaque. No incluye costos indirectos.')),
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), conSec ? h('th', { scope: 'col' }, 'Presentación') : null,
          ['Producción', 'Empaque', 'Costo para llevar', 'Precio de carta', 'Utilidad (llevar)', 'Margen'].map((t) => h('th', { scope: 'col', class: 'num' }, t)))), body)));
  }

  /* ---------- Pizzas ---------- */
  const pz = { tam: 'mediana', tipo: 'unico' };
  function matrixTable(m, opts) {
    // m: {cols, filas}. opts.rowInfo(fila) -> {costo, masa, empaque, pk, id}. Devuelve tarjeta con tabla editable.
    const head = h('tr', {}, h('th', { scope: 'col', class: 'pegado' }, 'Sabor'),
      opts.derivadas.map((d) => h('th', { scope: 'col', class: 'num derivada' }, d.t)),
      m.cols.map((c) => h('th', { scope: 'col', class: 'num ing', title: c }, c)), h('th'));
    const body = h('tbody');
    m.filas.forEach((f, r) => {
      const tds = opts.derivadas.map((d) => {
        const td = h('td', { class: 'num derivada ' + (d.cls || '') });
        if (d.badge) td.append(DL.badgeMargen(() => d.badge(f).m, () => d.badge(f).p)); else DL.bind(td, () => d.fn(f));
        return td;
      });
      const gs = m.cols.map((c, j) => h('td', { class: 'num ing' }, DL.numInput({ value: f.g[j], label: f.s + ': ' + c, onInput: (v) => { f.g[j] = v; DL.Store.changed(); } })));
      body.append(h('tr', {}, h('th', { scope: 'row', class: 'pegado' }, f.s), tds, gs,
        h('td', { class: 'acciones' }, DL.iconBtn(DL.icons.borrar, 'Quitar sabor', async () => {
          if (await DL.confirm({ titulo: 'Quitar "' + f.s + '"', mensaje: 'Se elimina la receta de este sabor.', ok: 'Quitar', peligro: true })) { m.filas.splice(r, 1); DL.Store.changed(); DL.rerender(); }
        }, 'borrar'))));
    });
    const nuevo = h('input', { type: 'text', class: 'celda', placeholder: 'Nuevo sabor', 'aria-label': 'Nombre del nuevo sabor' });
    const add = () => {
      const n = nuevo.value.trim(); if (!n) return nuevo.focus();
      if (m.filas.some((f) => E.norm(f.s) === E.norm(n))) return DL.toast('Ese sabor ya existe.', 'error');
      m.filas.push({ s: n, g: m.cols.map(() => 0) }); DL.Store.changed(); DL.rerender();
    };
    nuevo.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return [h('div', { class: 'tabla-scroll matriz' }, h('table', { class: 'tabla tabla-matriz' }, h('thead', {}, head), body)),
      h('div', { class: 'barra barra-pie' }, nuevo, h('button', { type: 'button', class: 'btn btn-suave', onclick: add }, h('span', { html: DL.icons.mas_chico }), 'Agregar sabor'))];
  }

  function renderPizzas(host) {
    const st = DL.Store.state, P = st.pizzas;
    const tam = P.tamanos.find((t) => t.id === pz.tam) || P.tamanos[0];
    const P_ = (id) => E.productById(id);
    host.append(resumenNota());
    host.append(h('div', { class: 'barra' },
      DL.segmented({ label: 'Tamaño', value: pz.tam, options: P.tamanos.map((t) => ({ v: t.id, t: t.nombre })), onPick: (v) => { pz.tam = v; DL.rerender(); } }),
      DL.segmented({ label: 'Tipo', value: pz.tipo, options: [{ v: 'unico', t: 'Sabor único' }, { v: 'dos', t: 'Dos sabores' }], onPick: (v) => { pz.tipo = v; DL.rerender(); } })));
    const m = P.matrices[pz.tam + '|' + pz.tipo];
    const idOf = (f) => 'pz-' + pz.tam + '-' + (pz.tipo === 'unico' ? 'u' : 'd') + '-' + E.slug(f.s);
    const cont = h('section', { class: 'tarjeta' }, h('header', { class: 'tarjeta-cab' },
      h('h2', {}, 'Ingredientes por sabor · pizza ' + tam.nombre.toLowerCase() + (pz.tipo === 'dos' ? ' de dos sabores' : '')),
      h('p', {}, 'Gramos de cada ingrediente por pizza. El costo se calcula con los precios de Abarrotes y materiales.')));
    if (!m) cont.append(DL.empty('No hay recetas para esta combinación'));
    else cont.append(...matrixTable(m, { derivadas: [
      { t: 'Ingredientes', fn: (f) => F.money(E.matrixRowCost(m.cols, f.g)) },
      { t: 'Masa', fn: () => F.money(E.masaCosto(pz.tam)) },
      { t: 'Empaque', fn: () => F.money(E.blockTotal('pizza-emp-' + pz.tam)) },
      { t: 'Costo para llevar', cls: 'fuerte', fn: (f) => F.money(P_(idOf(f)) ? P_(idOf(f)).costoLlevar : 0) },
      { t: 'Precio', cls: 'tenue', fn: (f) => (P_(idOf(f)) && P_(idOf(f)).precio ? F.money(P_(idOf(f)).precio) : 'Sin precio') },
      { t: 'Margen', badge: (f) => ({ m: P_(idOf(f)) ? P_(idOf(f)).margenLlevar : null, p: P_(idOf(f)) ? P_(idOf(f)).precio : 0 }) },
    ] }));
    host.append(cont);

    // Masa madre + gramos por tamaño
    const masaG = h('tbody');
    P.tamanos.forEach((t) => {
      const c = h('span'); DL.bind(c, () => F.money(E.masaCosto(t.id)));
      masaG.append(h('tr', {}, h('td', {}, t.nombre), h('td', { class: 'num' }, h('div', { class: 'con-sufijo' }, DL.numInput({ value: P.masaG[t.id], label: 'Masa ' + t.nombre, onInput: (v) => { P.masaG[t.id] = v; DL.Store.changed(); } }), h('span', { class: 'sufijo' }, 'g'))), h('td', { class: 'num' }, c)));
    });
    const gramo = h('span'); DL.bind(gramo, () => F.money4(E.masaGramo()) + ' por gramo');
    const bloqMasa = wrapBlock(E.block('pizza-masa'), 'pizzas', 'lista-pizzas');
    const tamMasa = h('section', { class: 'bloque' }, h('header', { class: 'bloque-cab' }, h('div', {}, h('h3', {}, 'Masa por tamaño'), h('span', { class: 'etiqueta' }, 'Gramos de masa por pizza'))),
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-compacta' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Tamaño'), h('th', { scope: 'col', class: 'num' }, 'Masa'), h('th', { scope: 'col', class: 'num' }, 'Costo'))), masaG)),
      h('footer', { class: 'bloque-pie tenue' }, gramo));
    host.append(h('div', { class: 'rejilla' }, bloqMasa, tamMasa, wrapBlock(E.block('pizza-emp-' + pz.tam), 'pizzas', 'lista-pizzas')));

    // Tajadas
    const T = P.tajada;
    const idT = (f) => 'pt-' + E.slug(f.s);
    const secT = h('section', { class: 'tarjeta' }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Pizza por tajada'),
      h('p', {}, 'Gramos por tajada. La masa de cada tajada se calcula con la masa de la pizza familiar dividida entre las tajadas por pizza.')),
      h('div', { class: 'barra' }, h('label', { class: 'rinde' }, 'Tajadas por pizza', DL.numInput({ value: T.tajadasPorPizza, label: 'Tajadas por pizza', onInput: (v) => { T.tajadasPorPizza = v; DL.Store.changed(); } }))));
    secT.append(...matrixTable(T, { derivadas: [
      { t: 'Ingredientes + masa + acomp.', fn: (f) => F.money(P_(idT(f)) ? P_(idT(f)).costo : 0) },
      { t: 'Empaque', fn: () => F.money(E.blockTotal('pizza-emp-tajada')) },
      { t: 'Precio', cls: 'tenue', fn: (f) => (P_(idT(f)) && P_(idT(f)).precio ? F.money(P_(idT(f)).precio) : 'Sin precio') },
      { t: 'Margen', badge: (f) => ({ m: P_(idT(f)) ? P_(idT(f)).margenLlevar : null, p: P_(idT(f)) ? P_(idT(f)).precio : 0 }) },
    ] }));
    host.append(secT);
    host.append(h('div', { class: 'rejilla' }, wrapBlock(E.block('pizza-emp-tajada'), 'pizzas', 'lista-pizzas'), wrapBlock(E.block('pizza-acomp-tajada'), 'pizzas', 'lista-pizzas'), wrapBlock(E.block('pizza-salsa'), 'pizzas', 'lista-pizzas')));
  }
  const resumenNota = () => h('p', { class: 'nota nota-alta' }, 'Los costos de las pizzas suman ingredientes, masa y, para llevar, caja y acompañamientos. La salsa de tomate queda como referencia porque en el Excel aún está en cero.');

  DL.views.produccion = {
    titulo: 'Costo de producción',
    sub: 'Recetas, empaques y acompañamientos por producto. Cambia una cantidad y verás el costo y el margen al instante.',
    render(host) {
      const st = DL.Store.state;
      let fam = st.ui.prodFam && st.ui.prodFam !== 'bebidas' && st.insumos[st.ui.prodFam] ? st.ui.prodFam : 'pizzas';
      st.ui.prodFam = fam;
      host.append(DL.famPills({ active: fam, exclude: ['bebidas'], onPick: (id) => { st.ui.prodFam = id; DL.rerender(); } }));
      host.append(datalist(fam));
      if (fam === 'pizzas') {
        renderPizzas(host);
        return;
      }
      const res = resumen(fam); if (res) host.append(res);
      if (fam === 'pasteles') {
        const filas = h('tbody');
        Object.keys(window.DILETTO_DATA.pasteles).forEach((id) => {
          const d = window.DILETTO_DATA.pasteles[id]; const s = st.pasteles[id];
          filas.append(h('tr', {}, h('td', {}, d.nombre), h('td', { class: 'num' }, DL.numInput({ value: s.tajadas, label: 'Tajadas de ' + d.nombre, onInput: (v) => { s.tajadas = v; DL.Store.changed(); } }))));
        });
        host.append(h('section', { class: 'tarjeta' }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Tajadas por pastel'), h('p', {}, 'Se usa para calcular el costo de cada tajada.')),
          h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-compacta' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Pastel'), h('th', { scope: 'col', class: 'num' }, 'Tajadas'))), filas))));
      }
      host.append(h('div', { class: 'rejilla' }, (st.bloques[fam] || []).map((b) => wrapBlock(b, fam, 'lista-' + fam))));
    },
  };
})();
