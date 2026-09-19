/* Estado de la aplicación, persistencia (localStorage + IndexedDB para PDFs) y respaldos. */
(function () {
  'use strict';
  const DL = window.DL;
  const E = window.DLEngine;
  const D = window.DILETTO_DATA;
  const KEY = 'diletto.estado.v1';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const Store = (DL.Store = { state: null, persistOK: true, _t: null });

  function catalogState() {
    return {
      insumos: clone(D.insumos),
      bloques: clone(D.bloques),
      pizzas: { tamanos: clone(D.pizzas.tamanos), masaG: clone(D.pizzas.masaG), matrices: clone(D.pizzas.matrices), tajada: clone(D.pizzas.tajada) },
      pasteles: Object.fromEntries(Object.keys(D.pasteles).map((k) => [k, { tajadas: D.pasteles[k].tajadas }])),
      precios: {},
    };
  }
  Store.defaultState = () => Object.assign({
    v: 1,
    config: { margenObjetivo: 0.5 },
    venta: { fecha: DL.isoToday(), lineas: [] },
    cierres: [],
    historial: [],
    ui: {},
  }, catalogState());

  function merge(saved) {
    const base = Store.defaultState();
    if (!saved || typeof saved !== 'object') return base;
    const s = Object.assign(base, saved);
    // Garantiza estructuras mínimas si el guardado es antiguo o está incompleto
    ['insumos', 'bloques', 'pizzas', 'pasteles', 'precios'].forEach((k) => { if (!saved[k]) s[k] = catalogState()[k]; });
    s.config = Object.assign({ margenObjetivo: 0.5 }, saved.config || {});
    s.venta = Object.assign({ fecha: DL.isoToday(), lineas: [] }, saved.venta || {});
    if (!Array.isArray(s.venta.lineas)) s.venta.lineas = [];
    if (!Array.isArray(s.cierres)) s.cierres = [];
    if (!Array.isArray(s.historial)) s.historial = [];
    if (!s.ui) s.ui = {};
    return s;
  }

  Store.load = () => {
    let saved = null;
    try { const raw = localStorage.getItem(KEY); if (raw) saved = JSON.parse(raw); } catch (e) { Store.persistOK = false; }
    Store.state = merge(saved);
    E.init(D, Store.state);
    return Store.state;
  };

  Store.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(Store.state)); Store.persistOK = true; DL.setSaved && DL.setSaved(true); }
    catch (e) { Store.persistOK = false; DL.setSaved && DL.setSaved(false); }
  };
  // Llamar después de cualquier modificación del estado.
  Store.changed = () => {
    E.touch();
    DL.refresh();
    DL.setSaved && DL.setSaved(null);
    clearTimeout(Store._t);
    Store._t = setTimeout(Store.save, 250);
  };

  // Restablece solo el catálogo (insumos, recetas, pizzas, precios). Conserva ventas, cierres y PDFs.
  Store.resetCatalog = () => {
    Object.assign(Store.state, catalogState());
    E.init(D, Store.state);
    Store.save();
  };

  /* ---------- Referencias de insumos ---------- */
  Store.refCount = (fam, name) => {
    const k = E.norm(name); let n = 0;
    (Store.state.bloques[fam] || []).forEach((b) => b.lineas.forEach((l) => { if (l.i && E.norm(l.i) === k) n++; }));
    if (fam === 'pizzas') {
      const P = Store.state.pizzas;
      Object.values(P.matrices).forEach((m) => { const j = m.cols.findIndex((c) => E.norm(c) === k); if (j >= 0) m.filas.forEach((f) => { if (E.num(f.g[j])) n++; }); });
      const j = P.tajada.cols.findIndex((c) => E.norm(c) === k); if (j >= 0) P.tajada.filas.forEach((f) => { if (E.num(f.g[j])) n++; });
    }
    return n;
  };
  Store.renameInsumo = (fam, oldName, newName) => {
    const k = E.norm(oldName);
    if (!k || k === E.norm(newName)) return;
    (Store.state.bloques[fam] || []).forEach((b) => b.lineas.forEach((l) => { if (l.i && E.norm(l.i) === k) l.i = newName; }));
    if (fam === 'pizzas') {
      const P = Store.state.pizzas;
      const fix = (m) => { m.cols = m.cols.map((c) => (E.norm(c) === k ? newName : c)); };
      Object.values(P.matrices).forEach(fix); fix(P.tajada);
    }
  };

  /* ---------- PDFs: IndexedDB con respaldo en memoria ---------- */
  const mem = new Map();
  const pdf = (Store.pdf = { persistent: true, _db: null });
  pdf.db = () => {
    if (pdf._db) return pdf._db;
    pdf._db = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB no disponible'));
      const r = indexedDB.open('diletto-pdfs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pdfs');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }).catch((e) => { pdf.persistent = false; return null; });
    return pdf._db;
  };
  const tx = (mode, fn) => pdf.db().then((db) => new Promise((res, rej) => {
    if (!db) return res(fn(null));
    const t = db.transaction('pdfs', mode); const st = t.objectStore('pdfs');
    const r = fn(st);
    t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
    t.onerror = () => rej(t.error);
  }));
  pdf.put = (id, blob) => tx('readwrite', (st) => { if (!st) { mem.set(id, blob); return null; } return st.put(blob, id); });
  pdf.get = (id) => pdf.db().then((db) => new Promise((res) => {
    if (!db) return res(mem.get(id) || null);
    const r = db.transaction('pdfs', 'readonly').objectStore('pdfs').get(id);
    r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
  }));
  pdf.del = (id) => tx('readwrite', (st) => { if (!st) { mem.delete(id); return null; } return st.delete(id); });
  pdf.persistRequest = () => { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ } };

  /* ---------- Respaldo ---------- */
  const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const b64ToBlob = (b64, type) => { const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: type || 'application/pdf' }); };

  Store.exportBackup = async () => {
    const pdfs = [];
    for (const m of Store.state.historial) {
      const b = await pdf.get(m.id);
      if (b) pdfs.push({ id: m.id, type: b.type, data: await blobToB64(b) });
    }
    return { app: 'diletto-artesanal', version: 1, exportadoEn: new Date().toISOString(), state: Store.state, pdfs };
  };
  Store.importBackup = async (obj) => {
    if (!obj || obj.app !== 'diletto-artesanal' || !obj.state) throw new Error('El archivo no es un respaldo de Diletto Artesanal.');
    Store.state = merge(obj.state);
    E.init(D, Store.state);
    for (const p of obj.pdfs || []) await pdf.put(p.id, b64ToBlob(p.data, p.type));
    Store.save();
  };
  Store.download = (name, blob) => {
    const a = DL.h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
