/* Motor de cálculo de Diletto Artesanal.
   Sin dependencias del DOM: recibe el estado y devuelve costos, precios y márgenes.
   Regla de costo de un insumo: cantidad usada × (precio de compra ÷ cantidad comprada).
   Los costos indirectos (luz, gas, agua, transporte, etc.) NO forman parte de ningún cálculo. */
(function (root) {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const slug = (s) => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const Engine = {
    norm, num, slug,
    data: null,          // datos originales (DILETTO_DATA)
    state: null,         // estado editable
    rev: 0,              // se incrementa con cada cambio para invalidar cachés
    _cache: {},

    init(data, state) { this.data = data; this.state = state; this.touch(); },
    touch() { this.rev++; this._cache = {}; },
    memo(key, fn) {
      const c = this._cache;
      if (!(key in c)) c[key] = fn();
      return c[key];
    },

    /* ---------- insumos ---------- */
    index(fam) {
      return this.memo('idx:' + fam, () => {
        const m = new Map();
        const list = (this.state.insumos[fam] || []);
        list.forEach((it) => { const k = norm(it.p); if (k && !m.has(k)) m.set(k, it); });
        list.forEach((it) => { const k = norm(it.pu); if (k && !m.has(k)) m.set(k, it); });
        return m;
      });
    },
    // precio por unidad base (g, ml o UND). null si el insumo no existe.
    unitPrice(fam, name) {
      const it = this.index(fam).get(norm(name));
      if (!it) return null;
      const q = num(it.q);
      return q > 0 ? num(it.$) / q : 0;
    },
    insumoUnidad(fam, name) {
      const it = this.index(fam).get(norm(name));
      return it ? (it.u || '') : '';
    },

    /* ---------- bloques (recetas, empaques, acompañamientos) ---------- */
    blockMap() {
      return this.memo('blocks', () => {
        const m = new Map();
        Object.keys(this.state.bloques).forEach((fam) => {
          this.state.bloques[fam].forEach((b) => m.set(b.id, { fam, block: b }));
        });
        return m;
      });
    },
    block(id) { const e = this.blockMap().get(id); return e ? e.block : null; },
    lineCost(fam, ln) {
      if (ln.s) return 0;
      if (ln.ref) {
        const e = this.blockMap().get(ln.ref);
        return e ? this.perUnit(ln.ref) * num(ln.q) : 0;
      }
      const p = this.unitPrice(fam, ln.i);
      return p == null ? 0 : p * num(ln.q);
    },
    lineMissing(fam, ln) { return !ln.s && !ln.ref && !!ln.i && this.unitPrice(fam, ln.i) == null; },
    blockTotal(id) {
      return this.memo('bt:' + id, () => {
        const e = this.blockMap().get(id);
        if (!e) return 0;
        return e.block.lineas.reduce((a, ln) => a + this.lineCost(e.fam, ln), 0);
      });
    },
    perUnit(id) {
      const e = this.blockMap().get(id);
      if (!e) return 0;
      const r = num(e.block.rinde);
      return r > 0 ? this.blockTotal(id) / r : this.blockTotal(id);
    },
    termCost(t) {
      const e = this.blockMap().get(t.b);
      if (!e) return 0;
      let div = 1;
      if (t.div === 'rinde') div = num(e.block.rinde) || 1;
      else if (t.div) div = num(t.div) || 1;
      return (this.blockTotal(t.b) / div) * (t.mult == null ? 1 : t.mult);
    },
    termsCost(list) { return (list || []).reduce((a, t) => a + this.termCost(t), 0); },

    /* ---------- pizzas ---------- */
    masaGramo() {
      const e = this.blockMap().get('pizza-masa');
      const r = e ? num(e.block.rinde) : 0;
      return r > 0 ? this.blockTotal('pizza-masa') / r : 0;
    },
    masaCosto(sizeId) { return num(this.state.pizzas.masaG[sizeId]) * this.masaGramo(); },
    matrixRowCost(cols, g) {
      let t = 0;
      for (let j = 0; j < cols.length; j++) {
        const q = num(g[j]);
        if (!q) continue;
        const p = this.unitPrice('pizzas', cols[j]);
        if (p != null) t += p * q;
      }
      return t;
    },
    matrixRowMissing(cols, g) {
      const out = [];
      for (let j = 0; j < cols.length; j++) if (num(g[j]) && this.unitPrice('pizzas', cols[j]) == null) out.push(cols[j]);
      return out;
    },

    /* ---------- catálogo de productos ---------- */
    defaultPrice(pk) {
      const d = this.data;
      let m;
      if ((m = /^p:(.+)$/.exec(pk))) { const p = d.productos.find((x) => x.id === m[1]); return p ? p.precio : 0; }
      if ((m = /^pz:([a-z]+):(.+)$/.exec(pk))) {
        const row = Object.keys(d.pizzas.carta).find((k) => slug(k) === m[2]);
        return row ? num(d.pizzas.carta[row][m[1]]) : 0;
      }
      if ((m = /^pzdos:([a-z]+)$/.exec(pk))) { const r = d.pizzas.carta['Dos Sabores']; return r ? num(r[m[1]]) : 0; }
      if ((m = /^pt:(.+)$/.exec(pk))) {
        const row = Object.keys(d.pizzas.cartaTajada).find((k) => slug(k) === m[1]);
        return row ? num(d.pizzas.cartaTajada[row]) : 0;
      }
      if ((m = /^pa:([a-z]+):([a-z]+)$/.exec(pk))) { const p = d.pasteles[m[1]]; return p ? num(p.precios[m[2]]) : 0; }
      if ((m = /^beb:(\d+)$/.exec(pk))) { const b = d.bebidas[+m[1]]; return b ? num(b.precio) : 0; }
      return 0;
    },
    precio(pk) {
      const v = this.state.precios[pk];
      return v == null ? this.defaultPrice(pk) : num(v);
    },

    products() {
      return this.memo('products', () => {
        const S = this.state, D = this.data, out = [];
        const famNombre = {}; const famGrupo = {};
        D.familias.forEach((f) => { famNombre[f.id] = f.nombre; famGrupo[f.id] = f.grupo; });
        const add = (o) => {
          o.grupo = famGrupo[o.fam];
          o.famNombre = famNombre[o.fam];
          o.precio = this.precio(o.pk);
          o.costoLlevar = o.costo + o.empaque;
          o.costoConsumo = o.costo;
          o.utilLlevar = o.precio - o.costoLlevar;
          o.utilConsumo = o.precio - o.costoConsumo;
          o.margenLlevar = o.precio > 0 ? o.utilLlevar / o.precio : null;
          o.margenConsumo = o.precio > 0 ? o.utilConsumo / o.precio : null;
          out.push(o);
        };

        // Productos con receta directa
        D.productos.forEach((p) => add({
          id: p.id, pk: 'p:' + p.id, fam: p.fam, nombre: p.nombre, seccion: '',
          costo: this.termsCost(p.costo), empaque: this.termsCost(p.empaque),
        }));

        // Pizzas
        const P = S.pizzas;
        P.tamanos.forEach((tam) => {
          const mu = P.matrices[tam.id + '|unico'];
          if (mu) mu.filas.forEach((f) => add({
            id: 'pz-' + tam.id + '-u-' + slug(f.s), pk: 'pz:' + tam.id + ':' + slug(f.s), fam: 'pizzas',
            nombre: 'Pizza ' + tam.nombre.toLowerCase() + ' ' + f.s.toLowerCase(), seccion: 'Sabor único · ' + tam.nombre,
            costo: this.matrixRowCost(mu.cols, f.g) + this.masaCosto(tam.id),
            empaque: this.blockTotal('pizza-emp-' + tam.id),
          }));
          const md = P.matrices[tam.id + '|dos'];
          if (md) md.filas.forEach((f) => add({
            id: 'pz-' + tam.id + '-d-' + slug(f.s), pk: 'pzdos:' + tam.id, fam: 'pizzas',
            nombre: 'Pizza ' + tam.nombre.toLowerCase() + ' ' + f.s.toLowerCase(), seccion: 'Dos sabores · ' + tam.nombre,
            costo: this.matrixRowCost(md.cols, f.g) + this.masaCosto(tam.id),
            empaque: this.blockTotal('pizza-emp-' + tam.id),
          }));
        });
        const T = P.tajada;
        const masaTajada = T.tajadasPorPizza > 0 ? this.masaCosto(T.masaTamano) / T.tajadasPorPizza : 0;
        const acompTajada = this.blockTotal('pizza-acomp-tajada');
        T.filas.forEach((f) => add({
          id: 'pt-' + slug(f.s), pk: 'pt:' + slug(f.s), fam: 'pizzas', nombre: 'Tajada de pizza ' + f.s.toLowerCase(),
          seccion: 'Por tajada', costo: this.matrixRowCost(T.cols, f.g) + masaTajada + acompTajada,
          empaque: this.blockTotal('pizza-emp-tajada'),
        }));

        // Pasteles
        const empE = this.blockTotal('pas-emp-entero'), empT = this.blockTotal('pas-emp-tajada');
        Object.keys(D.pasteles).forEach((pid) => {
          const d = D.pasteles[pid], st = S.pasteles[pid] || { tajadas: d.tajadas };
          const c = this.blockTotal(d.bloque);
          const nt = num(st.tajadas) > 0 ? num(st.tajadas) : 1;
          add({ id: 'pa-' + pid + '-entero', pk: 'pa:' + pid + ':entero', fam: 'pasteles', nombre: d.nombre, seccion: 'Entero', costo: c + empE, empaque: 0 });
          add({ id: 'pa-' + pid + '-tajada', pk: 'pa:' + pid + ':tajada', fam: 'pasteles', nombre: 'Tajada de ' + d.nombre.toLowerCase(), seccion: 'Por tajada', costo: c / nt, empaque: empT });
          add({ id: 'pa-' + pid + '-mayor', pk: 'pa:' + pid + ':mayor', fam: 'pasteles', nombre: d.nombre + ' (por mayor, c/u)', seccion: 'Por mayor (desde 3)', costo: c + empE, empaque: 0 });
        });

        // Bebidas (costo de compra = insumo de la familia "bebidas")
        D.bebidas.forEach((b, i) => {
          const up = this.unitPrice('bebidas', b.nombre);
          add({ id: 'beb-' + i, pk: 'beb:' + i, fam: 'bebidas', nombre: b.nombre, seccion: '', costo: up == null ? 0 : up, empaque: 0 });
        });
        return out;
      });
    },
    productById(id) { return this.products().find((p) => p.id === id) || null; },

    /* ---------- ventas ---------- */
    saleLine(ln) {
      const p = this.productById(ln.pid);
      if (!p) return null;
      const q = num(ln.q);
      const precio = ln.precio == null || ln.precio === '' ? p.precio : num(ln.precio);
      const costoU = ln.mod === 'llevar' ? p.costoLlevar : p.costoConsumo;
      const venta = precio * q, costo = costoU * q, util = venta - costo;
      return { p, q, precio, costoU, venta, costo, util, margen: venta > 0 ? util / venta : null };
    },
  };

  root.DLEngine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
