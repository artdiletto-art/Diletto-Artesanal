/* Arranque: navegación de 5 secciones, cabecera, respaldo y transición entre vistas. */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h;
  const NAV = [
    { id: 'abarrotes', label: 'Abarrotes y materiales', icon: 'abarrotes' },
    { id: 'produccion', label: 'Costo de producción', icon: 'produccion' },
    { id: 'ventas', label: 'Ventas', icon: 'ventas' },
    { id: 'historial', label: 'Historial de ventas', icon: 'historial' },
    { id: 'carta', label: 'Precios de carta', icon: 'carta' },
  ];
  let current = null;

  function renderMenu() {
    const menu = document.getElementById('menu'); DL.clear(menu);
    NAV.forEach((n) => menu.append(h('button', { type: 'button', class: 'menu-item' + (n.id === current ? ' activo' : ''), 'aria-current': n.id === current ? 'page' : null, onclick: () => DL.go(n.id) },
      h('span', { class: 'menu-ico', html: DL.icons[n.icon] }), h('span', { class: 'menu-txt' }, n.label))));
  }

  function draw(keepScroll) {
    const view = DL.views[current];
    const host = document.getElementById('vista');
    const y = window.scrollY;
    if (keepScroll) host.classList.remove('entra');
    DL.resetBinds(); DL.clear(host);
    document.getElementById('tituloVista').textContent = view.titulo;
    document.getElementById('subVista').textContent = view.sub;
    const acc = DL.clear(document.getElementById('accionesVista'));
    if (view.acciones) view.acciones(acc);
    try { view.render(host); } catch (e) { console.error(e); host.append(DL.empty('No se pudo mostrar esta sección', 'Recarga la página. Si el problema continúa, exporta un respaldo y restablece los datos.')); }
    DL.refresh();
    if (keepScroll) window.scrollTo(0, y);
  }

  // Cambia de sección con una transición suave
  DL.go = (id) => {
    if (!DL.views[id]) id = 'ventas';
    const host = document.getElementById('vista');
    const cambio = id !== current;
    current = id; DL.Store.state.ui.view = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
    renderMenu();
    if (!cambio) return draw(true);
    host.classList.remove('entra'); void host.offsetWidth;
    draw(false); window.scrollTo(0, 0);
    host.classList.add('entra'); host.focus({ preventScroll: true });
    DL.Store.save();
  };
  DL.rerender = (after) => { draw(true); if (after) after(); };

  DL.setSaved = (ok) => {
    const el = document.getElementById('estadoGuardado'); if (!el) return;
    if (ok === null) { el.textContent = 'Guardando…'; el.className = 'estado'; return; }
    el.textContent = ok ? 'Guardado en este navegador' : 'No se pudo guardar. Exporta un respaldo.';
    el.className = 'estado' + (ok ? '' : ' error');
  };

  /* Menú de respaldo */
  function setupBackup() {
    const btn = document.getElementById('btnRespaldo'), menu = document.getElementById('menuRespaldo');
    const file = document.getElementById('archivoRespaldo');
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    menu.querySelector('[data-a="exportar"]').addEventListener('click', async () => {
      close();
      try {
        const data = await DL.Store.exportBackup();
        const hoy = DL.isoToday();
        DL.Store.download('diletto-respaldo-' + hoy + '.json', new Blob([JSON.stringify(data)], { type: 'application/json' }));
        DL.toast('Respaldo exportado.');
      } catch (e) { console.error(e); DL.toast('No se pudo exportar el respaldo.', 'error'); }
    });
    menu.querySelector('[data-a="importar"]').addEventListener('click', () => { close(); file.click(); });
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      if (!(await DL.confirm({ titulo: 'Importar respaldo', mensaje: 'Reemplaza todos los datos actuales por los del archivo, incluidos los PDF.', ok: 'Importar', peligro: true }))) return;
      try { await DL.Store.importBackup(JSON.parse(await f.text())); DL.go(DL.Store.state.ui.view || 'ventas'); DL.toast('Respaldo importado.'); }
      catch (e) { console.error(e); DL.toast(e.message || 'El archivo no es válido.', 'error'); }
    });
    menu.querySelector('[data-a="restablecer"]').addEventListener('click', async () => {
      close();
      if (!(await DL.confirm({ titulo: 'Restablecer datos del Excel', mensaje: 'Vuelven los insumos, recetas y precios originales. Se conservan tus ventas, cierres y PDF.', ok: 'Restablecer', peligro: true }))) return;
      DL.Store.resetCatalog(); DL.rerender(); DL.toast('Datos restablecidos.');
    });
  }

  function start() {
    DL.Store.load();
    const hash = (location.hash || '').replace('#', '');
    current = DL.views[hash] ? hash : (DL.views[DL.Store.state.ui.view] ? DL.Store.state.ui.view : 'ventas');
    renderMenu(); setupBackup(); draw(false);
    document.getElementById('vista').classList.add('entra');
    window.addEventListener('hashchange', () => { const id = location.hash.replace('#', ''); if (DL.views[id] && id !== current) DL.go(id); });
    if (!DL.Store.persistOK) DL.toast('Tu navegador bloquea el almacenamiento: los cambios no se guardarán.', 'error');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
