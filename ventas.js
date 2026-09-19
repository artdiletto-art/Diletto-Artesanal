/* Módulo 3: Ventas del día. Se eligen productos, se ingresan cantidades y se calculan
   subtotales, costos, utilidad y margen. Costos indirectos excluidos. */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h, E = window.DLEngine, F = DL.fmt;
  DL.views = DL.views || {};
  const local = { fam: '*', q: '', todos: false };
  const MOD = { consumo: 'Consumo', llevar: 'Llevar' };

  function totales(lineas) {
    const t = { venta: 0, costo: 0, util: 0, unidades: 0, mod: { consumo: { u: 0, v: 0, c: 0 }, llevar: { u: 0, v: 0, c: 0 } }, fam: {} };
    lineas.forEach((ln) => {
      const r = E.saleLine(ln); if (!r) return;
      t.venta += r.venta; t.costo += r.costo; t.util += r.util; t.unidades += r.q;
      const m = t.mod[ln.mod] || t.mod.consumo; m.u += r.q; m.v += r.venta; m.c += r.costo;
      const f = (t.fam[r.p.famNombre] = t.fam[r.p.famNombre] || { u: 0, v: 0, c: 0 }); f.u += r.q; f.v += r.venta; f.c += r.costo;
    });
    t.margen = t.venta > 0 ? t.util / t.venta : null;
    return t;
  }

  function addLine(pid) {
    const v = DL.Store.state.venta;
    const ex = v.lineas.find((l) => l.pid === pid && l.mod === 'consumo' && l.precio == null);
    if (ex) ex.q = E.num(ex.q) + 1; else v.lineas.push({ id: DL.uid(), pid, mod: 'consumo', q: 1 });
    DL.Store.changed(); DL.rerender();
  }

  function catalogo() {
    const st = DL.Store.state;
    const box = h('section', { class: 'tarjeta catalogo no-imprimir' });
    const lista = h('div', { class: 'catalogo-lista' });
    const pintar = () => {
      DL.clear(lista);
      const q = E.norm(local.q);
      const prods = E.products().filter((p) => (local.fam === '*' || p.fam === local.fam) && (local.todos || p.precio > 0) && (!q || E.norm(p.nombre + ' ' + p.seccion + ' ' + p.famNombre).includes(q)));
      if (!prods.length) return lista.append(DL.empty('No hay productos para mostrar', local.todos ? 'Prueba con otra búsqueda.' : 'Los productos sin precio están ocultos. Actívalos abajo o asigna su precio en Precios de carta.'));
      let fam = '', sec = null, grid = null;
      prods.forEach((p) => {
        if (p.famNombre !== fam || p.seccion !== sec) {
          if (p.famNombre !== fam) lista.append(h('h4', { class: 'catalogo-fam' }, p.famNombre));
          if (p.seccion) lista.append(h('h5', { class: 'catalogo-sec' }, p.seccion));
          fam = p.famNombre; sec = p.seccion; grid = h('div', { class: 'catalogo-grid' }); lista.append(grid);
        }
        grid.append(h('button', { type: 'button', class: 'producto', onclick: () => addLine(p.id), title: 'Agregar ' + p.nombre },
          h('span', { class: 'producto-nombre' }, p.nombre), h('span', { class: 'producto-precio' }, p.precio ? F.money(p.precio) : 'Sin precio')));
      });
    };
    box.append(h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Catálogo'), h('p', {}, 'Toca un producto para agregarlo a la venta.')),
      DL.famPills({ active: local.fam, todos: true, onPick: (id) => { local.fam = id; DL.rerender(); } }),
      h('div', { class: 'barra' },
        h('input', { type: 'search', class: 'buscar', placeholder: 'Buscar producto', 'aria-label': 'Buscar producto', value: local.q, oninput: (e) => { local.q = e.target.value; pintar(); } }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: local.todos, onchange: (e) => { local.todos = e.target.checked; pintar(); } }), 'Mostrar sin precio')),
      lista);
    pintar();
    return box;
  }

  function tablaLineas() {
    const v = DL.Store.state.venta;
    const body = h('tbody');
    v.lineas.forEach((ln, i) => {
      const p = E.productById(ln.pid);
      const R = () => E.saleLine(ln) || { venta: 0, costo: 0, util: 0, margen: null, precio: 0 };
      const c = (fn, cls) => { const td = h('td', { class: 'num ' + (cls || '') }); DL.bind(td, fn); return td; };
      const qty = DL.numInput({ value: ln.q, label: 'Cantidad', cls: 'cant', onInput: (x) => { ln.q = x; DL.Store.changed(); } });
      const step = (d) => () => { ln.q = Math.max(0, E.num(ln.q) + d); qty.value = F.input(ln.q); DL.Store.changed(); };
      const mods = ['consumo', 'llevar'].map((m) => { const b = h('button', { type: 'button', class: 'segmento', onclick: () => { ln.mod = m; DL.Store.changed(); } }, MOD[m]); DL.bindCls(b, () => (ln.mod === m ? 'activo' : '')); return b; });
      body.append(h('tr', {},
        h('td', {}, p ? h('div', {}, p.nombre) : h('div', { class: 'falta' }, 'Producto ya no existe'), p && p.seccion ? h('div', { class: 'tenue chico' }, p.seccion) : null),
        h('td', {}, h('div', { class: 'segmentos segmentos-chico', role: 'group', 'aria-label': 'Modalidad' }, mods)),
        h('td', { class: 'num' }, h('div', { class: 'stepper' }, DL.iconBtn(DL.icons.menos_chico, 'Restar uno', step(-1)), qty, DL.iconBtn(DL.icons.mas_chico, 'Sumar uno', step(1)))),
        h('td', { class: 'num' }, DL.numInput({ value: ln.precio == null ? (p ? p.precio : 0) : ln.precio, label: 'Precio unitario', placeholder: '0.00', onInput: (x) => { ln.precio = x; DL.Store.changed(); } })),
        c(() => F.money(R().costo), 'tenue'), c(() => F.money(R().venta)), c(() => F.money(R().util), 'fuerte'),
        h('td', { class: 'num' }, DL.badgeMargen(() => R().margen, () => R().venta)),
        h('td', { class: 'acciones no-imprimir' }, DL.iconBtn(DL.icons.borrar, 'Quitar de la venta', () => { v.lineas.splice(i, 1); DL.Store.changed(); DL.rerender(); }, 'borrar'))));
    });
    const T = () => totales(v.lineas);
    const pie = h('tfoot', {}, h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'Total de la venta'),
      (() => { const td = h('td', { class: 'num' }); DL.bind(td, () => F.dec(T().unidades) + ' u.'); return td; })(), h('td'),
      (() => { const td = h('td', { class: 'num' }); DL.bind(td, () => F.money(T().costo)); return td; })(),
      (() => { const td = h('td', { class: 'num' }); DL.bind(td, () => F.money(T().venta)); return td; })(),
      (() => { const td = h('td', { class: 'num' }); DL.bind(td, () => F.money(T().util)); return td; })(),
      h('td', { class: 'num' }, DL.badgeMargen(() => T().margen, () => T().venta)), h('td', { class: 'no-imprimir' })));
    return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-venta' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col' }, 'Modalidad'), h('th', { scope: 'col', class: 'num' }, 'Cantidad'), h('th', { scope: 'col', class: 'num' }, 'Precio'),
        h('th', { scope: 'col', class: 'num' }, 'Costo'), h('th', { scope: 'col', class: 'num' }, 'Venta'), h('th', { scope: 'col', class: 'num' }, 'Utilidad'), h('th', { scope: 'col', class: 'num' }, 'Margen'), h('th', { class: 'no-imprimir' }))),
      body, pie));
  }

  function resumenes(lineas) {
    const cont = h('div', { class: 'rejilla rejilla-2' });
    DL.bindFn(() => {
      const t = totales(lineas); DL.clear(cont);
      const fila = (n, o) => h('tr', {}, h('td', {}, n), h('td', { class: 'num' }, F.dec(o.u)), h('td', { class: 'num' }, F.money(o.v)), h('td', { class: 'num' }, F.money(o.v - o.c)));
      const tabla = (titulo, filas) => h('section', { class: 'tarjeta' }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, titulo)),
        filas.length ? h('table', { class: 'tabla tabla-compacta' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Unid.'), h('th', { class: 'num' }, 'Venta'), h('th', { class: 'num' }, 'Utilidad'))), h('tbody', {}, filas)) : h('p', { class: 'tenue' }, 'Sin datos todavía.'));
      cont.append(tabla('Por modalidad', lineas.length ? ['consumo', 'llevar'].map((m) => fila(MOD[m], t.mod[m])) : []),
        tabla('Por categoría', Object.keys(t.fam).sort().map((k) => fila(k, t.fam[k]))));
    });
    return cont;
  }

  function guardarCierre() {
    const st = DL.Store.state, v = st.venta;
    if (!v.lineas.length) return DL.toast('Agrega productos antes de guardar el cierre.', 'error');
    const guardar = () => {
      const lineas = v.lineas.map((ln) => { const r = E.saleLine(ln); return r && { nombre: r.p.nombre, seccion: r.p.seccion, mod: ln.mod, q: r.q, precio: r.precio, venta: r.venta, costo: r.costo, util: r.util }; }).filter(Boolean);
      const t = totales(v.lineas);
      st.cierres = st.cierres.filter((c) => c.fecha !== v.fecha);
      st.cierres.push({ id: DL.uid(), fecha: v.fecha, creado: new Date().toISOString(), lineas, totales: { venta: t.venta, costo: t.costo, util: t.util, unidades: t.unidades } });
      st.cierres.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      DL.Store.changed(); DL.rerender(); DL.toast('Cierre guardado.');
    };
    if (st.cierres.some((c) => c.fecha === v.fecha)) DL.confirm({ titulo: 'Ya existe un cierre para esta fecha', mensaje: 'Si continúas, se reemplaza por la venta actual.', ok: 'Reemplazar' }).then((ok) => ok && guardar());
    else guardar();
  }

  function cierres() {
    const st = DL.Store.state;
    const sec = h('section', { class: 'tarjeta no-imprimir' }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Cierres guardados'), h('p', {}, 'Resumen de cada día cerrado. Los montos quedan fijos aunque luego cambien los precios.')));
    if (!st.cierres.length) { sec.append(DL.empty('Todavía no hay cierres', 'Cuando termines el día, usa "Guardar cierre".')); return sec; }
    st.cierres.forEach((c) => {
      const p = DL.isoParts(c.fecha);
      sec.append(h('details', { class: 'cierre' },
        h('summary', {}, h('span', { class: 'cierre-fecha' }, DL.DIA_SEMANA[p.dow] + ' ' + F.date(c.fecha)), h('span', { class: 'tenue' }, F.dec(c.totales.unidades) + ' u.'), h('span', {}, F.money(c.totales.venta)), h('span', { class: 'fuerte' }, F.money(c.totales.util))),
        h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-compacta' },
          h('thead', {}, h('tr', {}, ['Producto', 'Modalidad', 'Cant.', 'Precio', 'Venta', 'Utilidad'].map((t, i) => h('th', { class: i > 1 ? 'num' : '' }, t)))),
          h('tbody', {}, c.lineas.map((l) => h('tr', {}, h('td', {}, l.nombre), h('td', {}, MOD[l.mod]), h('td', { class: 'num' }, F.dec(l.q)), h('td', { class: 'num' }, F.money(l.precio)), h('td', { class: 'num' }, F.money(l.venta)), h('td', { class: 'num' }, F.money(l.util))))))),
        h('div', { class: 'barra barra-pie' }, h('span', { class: 'espacio' }),
          h('button', { type: 'button', class: 'btn', onclick: () => { st.venta.fecha = c.fecha; st.venta.lineas = c.lineas.map((l) => { const pr = E.products().find((x) => x.nombre === l.nombre && x.seccion === l.seccion); return pr ? { id: DL.uid(), pid: pr.id, mod: l.mod, q: l.q, precio: l.precio } : null; }).filter(Boolean); DL.Store.changed(); DL.rerender(); window.scrollTo({ top: 0 }); } }, 'Cargar en la venta'),
          h('button', { type: 'button', class: 'btn btn-peligro-suave', onclick: async () => { if (await DL.confirm({ titulo: 'Eliminar cierre', mensaje: 'Se borra el cierre del ' + F.date(c.fecha) + '.', ok: 'Eliminar', peligro: true })) { st.cierres = st.cierres.filter((x) => x.id !== c.id); DL.Store.changed(); DL.rerender(); } } }, 'Eliminar'))));
    });
    return sec;
  }

  DL.views.ventas = {
    titulo: 'Ventas',
    sub: 'Registra lo vendido en el día. Consumo cobra solo el costo de producción; llevar suma además el empaque.',
    acciones(box) {
      const st = DL.Store.state;
      box.append(h('button', { type: 'button', class: 'btn', onclick: () => window.print() }, h('span', { html: DL.icons.imprimir }), 'Imprimir'),
        h('button', { type: 'button', class: 'btn btn-primario', onclick: guardarCierre }, 'Guardar cierre'));
    },
    render(host) {
      const st = DL.Store.state, v = st.venta;
      const T = () => totales(v.lineas);
      const dia = h('span', { class: 'tenue' });
      DL.bind(dia, () => { if (!v.fecha) return ''; const p = DL.isoParts(v.fecha); return DL.DIA_SEMANA[p.dow]; });
      host.append(h('div', { class: 'barra' },
        h('label', { class: 'rinde' }, 'Fecha', h('input', { type: 'date', class: 'celda', value: v.fecha, 'aria-label': 'Fecha de la venta', onchange: (e) => { v.fecha = e.target.value || DL.isoToday(); DL.Store.changed(); } }), dia),
        h('span', { class: 'espacio' }),
        h('button', { type: 'button', class: 'btn btn-suave no-imprimir', onclick: async () => { if (v.lineas.length && await DL.confirm({ titulo: 'Vaciar la venta actual', mensaje: 'Se quitan todos los productos de la tabla.', ok: 'Vaciar', peligro: true })) { v.lineas = []; DL.Store.changed(); DL.rerender(); } } }, 'Vaciar venta')));
      const item = (label, fn, cls) => { const s = h('span', { class: 'banda-valor' }); DL.bind(s, fn); return h('div', { class: 'banda-item ' + (cls || '') }, h('span', { class: 'banda-etiqueta' }, label), s); };
      host.append(h('div', { class: 'banda banda-grande' },
        item('Venta total', () => F.money(T().venta)), item('Costo total', () => F.money(T().costo)),
        item('Utilidad', () => F.money(T().util), 'destacado'), item('Margen', () => F.pct(T().margen)), item('Unidades', () => F.dec(T().unidades))));
      host.append(h('div', { class: 'ventas-cuerpo' }, catalogo(),
        h('section', { class: 'tarjeta venta-actual' }, h('header', { class: 'tarjeta-cab' }, h('h2', {}, 'Venta del día')),
          v.lineas.length ? tablaLineas() : DL.empty('Aún no hay productos en esta venta', 'Elige productos del catálogo para empezar.'))));
      if (v.lineas.length) host.append(resumenes(v.lineas));
      host.append(cierres());
    },
  };
})();
