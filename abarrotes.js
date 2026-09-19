/* Módulo 1: Abarrotes y materiales */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h, E = window.DLEngine, F = DL.fmt;
  DL.views = DL.views || {};
  const local = { q: '', cat: '', sin: false };
  const CAT_LABEL = { ABARROTES: 'Abarrotes', MATERIALES: 'Materiales', BEBIDAS: 'Bebidas' };
  const UNITS = ['g', 'ml', 'UND', 'kg', 'L'];

  DL.views.abarrotes = {
    titulo: 'Abarrotes y materiales',
    sub: 'Precios de compra de cada insumo. Al cambiar un precio se actualizan al instante los costos de producción y los márgenes.',
    render(host) {
      const st = DL.Store.state;
      const fam = st.ui.abFam && st.insumos[st.ui.abFam] ? st.ui.abFam : 'pizzas';
      st.ui.abFam = fam;
      const list = st.insumos[fam];

      host.append(DL.famPills({ active: fam, onPick: (id) => { st.ui.abFam = id; local.q = ''; local.cat = ''; local.sin = false; DL.rerender(); } }));

      // Franja de indicadores
      const kv = (label, fn, cls) => { const v = h('span', { class: 'banda-valor' }); DL.bind(v, fn); return h('div', { class: 'banda-item ' + (cls || '') }, h('span', { class: 'banda-etiqueta' }, label), v); };
      const ver = () => list.filter((x) => x.v === 'SI').length;
      const sinv = () => list.filter((x) => x.v === 'NO').length;
      host.append(h('div', { class: 'banda' },
        kv('Insumos registrados', () => F.int(list.length)),
        kv('Verificados', () => F.int(ver())),
        kv('Pendientes de verificar', () => F.int(sinv()), 'atencion')));

      // Barra de herramientas
      const cats = Array.from(new Set(list.map((x) => x.c)));
      host.append(h('div', { class: 'barra' },
        h('input', { type: 'search', class: 'buscar', placeholder: 'Buscar insumo', 'aria-label': 'Buscar insumo', value: local.q, oninput: (e) => { local.q = e.target.value; filtrar(); } }),
        cats.length > 1 ? DL.select({ value: local.cat, label: 'Filtrar por categoría', options: [{ v: '', t: 'Todas las categorías' }].concat(cats.map((c) => ({ v: c, t: CAT_LABEL[c] || c }))), onChange: (v) => { local.cat = v; filtrar(); } }) : null,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: local.sin, onchange: (e) => { local.sin = e.target.checked; filtrar(); } }), 'Solo pendientes'),
        h('span', { class: 'espacio' }),
        h('button', { type: 'button', class: 'btn btn-primario', onclick: agregar }, h('span', { html: DL.icons.mas_chico }), 'Agregar insumo')));

      const units = Array.from(new Set(UNITS.concat(list.map((x) => x.u).filter(Boolean))));
      const cuerpo = h('tbody');
      const filas = [];
      list.forEach((it, i) => {
        const unidadTxt = h('span', { class: 'sufijo' });
        DL.bind(unidadTxt, () => { const q = E.num(it.q); return q > 0 ? F.money4(E.num(it.$) / q) + ' / ' + (it.u || 'und') : '—'; });
        const ver = h('button', { type: 'button', class: 'chip-toggle', 'aria-pressed': it.v === 'SI' ? 'true' : 'false', onclick: (e) => {
          it.v = it.v === 'SI' ? 'NO' : 'SI'; e.currentTarget.setAttribute('aria-pressed', it.v === 'SI' ? 'true' : 'false'); e.currentTarget.textContent = it.v === 'SI' ? 'Sí' : 'No'; e.currentTarget.closest('tr').dataset.v = it.v; DL.Store.changed();
        } }, it.v === 'SI' ? 'Sí' : it.v === 'NO' ? 'No' : '—');
        const tr = h('tr', { dataset: { q: E.norm(it.p + ' ' + it.pu), c: it.c, v: it.v } },
          h('td', {}, DL.select({ value: it.c, label: 'Categoría', options: Array.from(new Set(['ABARROTES', 'MATERIALES', it.c])).map((c) => ({ v: c, t: CAT_LABEL[c] || c })), onChange: (v) => { it.c = v; tr.dataset.c = v; DL.Store.changed(); } })),
          h('td', { class: 'col-nombre' }, DL.textInput({ value: it.p, label: 'Producto', placeholder: 'Nombre del insumo', onChange: (v) => {
            if (v && v !== it.p) { DL.Store.renameInsumo(fam, it.p, v); it.p = v; tr.dataset.q = E.norm(it.p + ' ' + it.pu); DL.Store.changed(); }
          } })),
          h('td', {}, DL.numInput({ value: it.q, label: 'Cantidad comprada', onInput: (v) => { it.q = v; DL.Store.changed(); } })),
          h('td', {}, DL.select({ value: it.u || 'g', label: 'Unidad', options: units, onChange: (v) => { it.u = v; DL.Store.changed(); } })),
          h('td', {}, DL.numInput({ value: it.$, label: 'Precio de compra', placeholder: '0.00', onInput: (v) => { it.$ = v; DL.Store.changed(); } })),
          h('td', { class: 'num tenue' }, unidadTxt),
          h('td', { class: 'col-nombre' }, DL.textInput({ value: it.pu, label: 'Nombre por unidad', placeholder: 'Opcional', onChange: (v) => { it.pu = v; tr.dataset.q = E.norm(it.p + ' ' + it.pu); DL.Store.changed(); } })),
          h('td', { class: 'centro' }, ver),
          h('td', { class: 'acciones' }, DL.iconBtn(DL.icons.borrar, 'Eliminar insumo', async () => {
            const n = DL.Store.refCount(fam, it.p);
            const ok = await DL.confirm({ titulo: 'Eliminar "' + (it.p || 'insumo') + '"', mensaje: n ? 'Este insumo se usa en ' + n + ' líneas de recetas. Esas líneas quedarán sin precio.' : 'Esta acción no se puede deshacer.', ok: 'Eliminar', peligro: true });
            if (ok) { list.splice(i, 1); DL.Store.changed(); DL.rerender(); }
          }, 'borrar')));
        filas.push(tr); cuerpo.append(tr);
      });

      function filtrar() {
        const q = E.norm(local.q); let vis = 0;
        filas.forEach((tr) => {
          const ok = (!q || tr.dataset.q.includes(q)) && (!local.cat || tr.dataset.c === local.cat) && (!local.sin || tr.dataset.v === 'NO');
          tr.hidden = !ok; if (ok) vis++;
        });
        vacio.hidden = vis > 0;
      }
      function agregar() {
        list.push({ c: cats.includes('ABARROTES') || !cats.length ? 'ABARROTES' : cats[0], p: '', q: 1, u: 'g', $: 0, pu: '', qu: 0, v: 'NO' });
        if (fam === 'bebidas') list[list.length - 1].c = 'BEBIDAS';
        DL.Store.changed();
        DL.rerender(() => { const rows = document.querySelectorAll('.tabla tbody tr'); const last = rows[rows.length - 1]; if (last) { last.scrollIntoView({ block: 'center' }); const i = last.querySelector('.col-nombre input'); if (i) i.focus(); } });
      }

      const vacio = DL.empty('No hay insumos que coincidan', 'Cambia la búsqueda o los filtros.');
      vacio.hidden = true;
      host.append(h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla tabla-insumos' },
        h('thead', {}, h('tr', {}, ['Categoría', 'Producto', 'Cantidad', 'Unidad', 'Precio (S/)', 'Precio por unidad', 'Nombre por unidad', 'Verificado', ''].map((t, i) => h('th', { scope: 'col', class: i >= 2 && i <= 5 ? 'num' : '' }, t)))),
        cuerpo)), vacio);
      if (!list.length) host.append(DL.empty('Esta categoría aún no tiene insumos', 'Usa "Agregar insumo" para registrar el primero.'));
      filtrar();
      host.append(h('p', { class: 'nota' }, 'El precio por unidad es el precio de compra dividido entre la cantidad comprada. Usa las mismas unidades (g, ml o UND) en las recetas que en la compra.'));
    },
  };
})();
