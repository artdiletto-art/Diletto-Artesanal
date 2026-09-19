/* Módulo 4: Historial de ventas. Carga de reportes PDF clasificados por mes y por día de atención
   (jueves, viernes, sábado, domingo). Los archivos se guardan en este navegador (IndexedDB). */
(function () {
  'use strict';
  const DL = window.DL, h = DL.h, E = window.DLEngine, F = DL.fmt;
  DL.views = DL.views || {};
  const MAX_MB = 30;
  const local = { sel: null, abiertos: new Set(), q: '' }; // sel: {key, dia}

  const key = (m) => m.anio * 100 + m.mes;
  const keyLabel = (k) => DL.MESES[(k % 100) - 1] + ' ' + Math.floor(k / 100);
  const esPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

  /* Formulario de clasificación reutilizable (subida y edición) */
  function formClasificacion(rec) {
    const box = h('div', { class: 'clasif' });
    const now = new Date();
    const build = () => {
      DL.clear(box);
      const anioIn = h('input', { type: 'number', class: 'celda num', min: 2020, max: 2100, value: rec.anio, 'aria-label': 'Año', onchange: (e) => { rec.anio = Math.round(E.num(e.target.value)) || now.getFullYear(); } });
      box.append(
        h('div', { class: 'campo' }, h('span', { class: 'campo-etq' }, 'Tipo de reporte'),
          DL.segmented({ label: 'Tipo de reporte', value: rec.tipo, options: [{ v: 'Diario', t: 'Diario' }, { v: 'Semanal', t: 'Semanal' }], onPick: (v) => { rec.tipo = v; if (v === 'Diario' && rec.dias.length > 1) rec.dias = rec.dias.slice(0, 1); build(); } })),
        h('div', { class: 'campo' }, h('label', { class: 'campo-etq' }, 'Fecha del reporte (opcional)'),
          h('input', { type: 'date', class: 'celda', value: rec.fecha || '', onchange: (e) => {
            rec.fecha = e.target.value;
            if (rec.fecha) {
              const p = DL.isoParts(rec.fecha); rec.mes = p.m; rec.anio = p.y;
              const nombre = DL.DIA_SEMANA[p.dow];
              if (DL.DIAS.includes(nombre)) { if (rec.tipo === 'Diario') rec.dias = [nombre]; else if (!rec.dias.includes(nombre)) rec.dias.push(nombre); }
              else DL.toast(nombre + ' no es día de atención. Elige el día manualmente.', 'error');
            }
            build();
          } }),
          h('span', { class: 'campo-ayuda' }, 'Si eliges una fecha, el mes y el día se completan solos.')),
        h('div', { class: 'campo campo-fila' },
          h('div', {}, h('label', { class: 'campo-etq' }, 'Mes'), DL.select({ value: String(rec.mes), label: 'Mes', options: DL.MESES.map((m, i) => ({ v: String(i + 1), t: m })), onChange: (v) => { rec.mes = +v; } })),
          h('div', {}, h('label', { class: 'campo-etq' }, 'Año'), anioIn)),
        h('div', { class: 'campo' }, h('span', { class: 'campo-etq' }, rec.tipo === 'Semanal' ? 'Días de atención que cubre' : 'Día de atención'),
          h('div', { class: 'chips', role: 'group', 'aria-label': 'Días de atención' }, DL.DIAS.map((d) => {
            const on = rec.dias.includes(d);
            return h('button', { type: 'button', class: 'chip' + (on ? ' activo' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: () => {
              if (rec.tipo === 'Diario') rec.dias = on ? [] : [d]; else rec.dias = on ? rec.dias.filter((x) => x !== d) : DL.DIAS.filter((x) => rec.dias.includes(x) || x === d);
              build();
            } }, d);
          }))));
    };
    build();
    return box;
  }

  /* Diálogo de subida */
  function abrirSubida(files) {
    const now = new Date();
    const pend = [];
    const rechazados = [];
    Array.from(files || []).forEach((f) => {
      if (!esPdf(f)) rechazados.push(f.name + ' (no es PDF)');
      else if (f.size > MAX_MB * 1048576) rechazados.push(f.name + ' (supera ' + MAX_MB + ' MB)');
      else pend.push({ file: f, tipo: 'Diario', mes: now.getMonth() + 1, anio: now.getFullYear(), dias: [], fecha: '' });
    });
    if (rechazados.length) DL.toast('No se agregó: ' + rechazados.join(', '), 'error');
    if (!pend.length && files && files.length) return;

    const dlg = h('dialog', { class: 'dialogo dialogo-ancho' });
    if (typeof dlg.showModal !== 'function') return DL.toast('Este navegador no admite el diálogo de carga. Actualízalo.', 'error');
    const lista = h('div', { class: 'pend-lista' });
    const btnGuardar = h('button', { type: 'button', class: 'btn btn-primario' }, 'Guardar reportes');
    const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, class: 'oculto', onchange: (e) => { agregar(e.target.files); e.target.value = ''; } });

    function agregar(fs) {
      Array.from(fs).forEach((f) => {
        if (!esPdf(f)) return DL.toast(f.name + ' no es un PDF.', 'error');
        if (f.size > MAX_MB * 1048576) return DL.toast(f.name + ' supera ' + MAX_MB + ' MB.', 'error');
        pend.push({ file: f, tipo: 'Diario', mes: now.getMonth() + 1, anio: now.getFullYear(), dias: [], fecha: '' });
      });
      pintar();
    }
    function pintar() {
      DL.clear(lista);
      if (!pend.length) lista.append(DL.empty('Aún no elegiste archivos', 'Selecciona uno o varios PDF para clasificarlos.'));
      pend.forEach((r, i) => lista.append(h('article', { class: 'pend' },
        h('header', {}, h('span', { class: 'pend-ico', html: DL.icons.pdf }), h('div', { class: 'pend-nombre' }, h('strong', {}, r.file.name), h('span', { class: 'tenue chico' }, F.bytes(r.file.size))),
          DL.iconBtn(DL.icons.x, 'Quitar archivo', () => { pend.splice(i, 1); pintar(); })),
        formClasificacion(r))));
      btnGuardar.disabled = !pend.length; btnGuardar.textContent = pend.length > 1 ? 'Guardar ' + pend.length + ' reportes' : 'Guardar reporte';
    }
    btnGuardar.addEventListener('click', async () => {
      const sinDia = pend.find((r) => !r.dias.length);
      if (sinDia) return DL.toast('Elige al menos un día de atención para "' + sinDia.file.name + '".', 'error');
      btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…';
      try {
        let ult = null;
        for (const r of pend) {
          const id = DL.uid();
          await DL.Store.pdf.put(id, r.file);
          DL.Store.state.historial.push({ id, nombre: r.file.name, tam: r.file.size, tipo: r.tipo, mes: r.mes, anio: r.anio, dias: r.dias.slice(), fecha: r.fecha || '', subido: new Date().toISOString() });
          ult = { key: r.anio * 100 + r.mes, dia: r.dias[0] };
        }
        local.sel = ult; local.abiertos.add(ult.key);
        DL.Store.pdf.persistRequest(); DL.Store.changed();
        dlg.close(); dlg.remove(); DL.rerender();
        DL.toast(pend.length > 1 ? pend.length + ' reportes guardados.' : 'Reporte guardado.');
        if (!DL.Store.pdf.persistent) DL.toast('Este navegador no permite guardar archivos de forma permanente. Los PDF se perderán al cerrar la pestaña.', 'error');
      } catch (e) { console.error(e); DL.toast('No se pudo guardar el archivo. Revisa el espacio disponible del navegador.', 'error'); btnGuardar.disabled = false; }
    });
    dlg.append(h('header', { class: 'dialogo-cab' }, h('h2', {}, 'Subir reportes de ventas'), DL.iconBtn(DL.icons.x, 'Cerrar', () => { dlg.close(); dlg.remove(); })),
      h('div', { class: 'dialogo-cuerpo' },
        h('div', { class: 'zona' }, h('span', { html: DL.icons.subir }), h('p', {}, 'Arrastra PDF aquí o'), h('button', { type: 'button', class: 'btn', onclick: () => input.click() }, 'Elegir archivos'), input),
        lista),
      h('footer', { class: 'dialogo-pie' }, h('button', { type: 'button', class: 'btn', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cancelar'), btnGuardar));
    dlg.addEventListener('dragover', (e) => e.preventDefault());
    dlg.addEventListener('drop', (e) => { e.preventDefault(); agregar(e.dataTransfer.files); });
    dlg.addEventListener('cancel', () => dlg.remove());
    document.body.append(dlg); pintar(); dlg.showModal();
  }

  function editar(m) {
    const rec = { tipo: m.tipo, mes: m.mes, anio: m.anio, dias: m.dias.slice(), fecha: m.fecha || '' };
    const dlg = h('dialog', { class: 'dialogo' });
    const cerrar = () => { dlg.close(); dlg.remove(); };
    dlg.append(h('header', { class: 'dialogo-cab' }, h('h2', {}, 'Cambiar clasificación'), DL.iconBtn(DL.icons.x, 'Cerrar', cerrar)),
      h('div', { class: 'dialogo-cuerpo' }, h('p', { class: 'tenue' }, m.nombre), formClasificacion(rec)),
      h('footer', { class: 'dialogo-pie' }, h('button', { type: 'button', class: 'btn', onclick: cerrar }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn btn-primario', onclick: () => {
          if (!rec.dias.length) return DL.toast('Elige al menos un día de atención.', 'error');
          Object.assign(m, { tipo: rec.tipo, mes: rec.mes, anio: rec.anio, dias: rec.dias, fecha: rec.fecha });
          local.sel = { key: key(m), dia: m.dias[0] }; local.abiertos.add(key(m));
          DL.Store.changed(); cerrar(); DL.rerender(); DL.toast('Clasificación actualizada.');
        } }, 'Guardar cambios')));
    dlg.addEventListener('cancel', () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  }

  async function ver(m) {
    const blob = await DL.Store.pdf.get(m.id);
    if (!blob) return DL.toast('No se encontró el archivo en este navegador.', 'error');
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const dlg = h('dialog', { class: 'dialogo dialogo-visor' });
    const cerrar = () => { dlg.close(); dlg.remove(); URL.revokeObjectURL(url); };
    dlg.append(h('header', { class: 'dialogo-cab' }, h('h2', {}, m.nombre),
      h('div', { class: 'cab-acciones' }, h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Abrir en pestaña'), DL.iconBtn(DL.icons.x, 'Cerrar', cerrar))),
      h('iframe', { class: 'visor', src: url, title: m.nombre }));
    dlg.addEventListener('cancel', () => { dlg.remove(); URL.revokeObjectURL(url); });
    document.body.append(dlg); dlg.showModal();
  }
  async function descargar(m) {
    const blob = await DL.Store.pdf.get(m.id);
    if (!blob) return DL.toast('No se encontró el archivo en este navegador.', 'error');
    DL.Store.download(m.nombre, new Blob([blob], { type: 'application/pdf' }));
  }
  async function eliminar(m) {
    if (!(await DL.confirm({ titulo: 'Eliminar reporte', mensaje: '"' + m.nombre + '" se borra de este navegador.', ok: 'Eliminar', peligro: true }))) return;
    await DL.Store.pdf.del(m.id);
    DL.Store.state.historial = DL.Store.state.historial.filter((x) => x.id !== m.id);
    DL.Store.changed(); DL.rerender();
  }

  function tarjetaArchivo(m) {
    return h('article', { class: 'archivo' },
      h('span', { class: 'archivo-ico', html: DL.icons.pdf }),
      h('div', { class: 'archivo-datos' }, h('strong', { class: 'archivo-nombre', title: m.nombre }, m.nombre),
        h('div', { class: 'archivo-meta tenue chico' }, h('span', { class: 'etiqueta ' + (m.tipo === 'Semanal' ? 'etiqueta-semanal' : '') }, m.tipo), m.fecha ? F.date(m.fecha) : null, F.bytes(m.tam), 'Subido ' + F.date(m.subido.slice(0, 10)))),
      h('div', { class: 'archivo-acc' },
        h('button', { type: 'button', class: 'btn btn-suave', onclick: () => ver(m) }, h('span', { html: DL.icons.ojo }), 'Ver'),
        DL.iconBtn(DL.icons.bajar, 'Descargar', () => descargar(m)), DL.iconBtn(DL.icons.editar, 'Cambiar clasificación', () => editar(m)), DL.iconBtn(DL.icons.borrar, 'Eliminar', () => eliminar(m), 'borrar')));
  }

  DL.views.historial = {
    titulo: 'Historial de ventas',
    sub: 'Reportes de ventas en PDF, ordenados por mes y por día de atención: jueves, viernes, sábado y domingo.',
    acciones(box) {
      box.append(h('button', { type: 'button', class: 'btn btn-primario', onclick: () => abrirSubida() }, h('span', { html: DL.icons.subir }), 'Subir reportes'));
    },
    render(host) {
      const st = DL.Store.state;
      const meses = new Map();
      st.historial.forEach((m) => { const k = key(m); if (!meses.has(k)) meses.set(k, []); meses.get(k).push(m); });
      const claves = Array.from(meses.keys()).sort((a, b) => b - a);
      if (!claves.length) {
        host.append(h('div', { class: 'zona zona-grande', ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); abrirSubida(e.dataTransfer.files); } },
          h('span', { html: DL.icons.subir }), h('p', { class: 'vacio-titulo' }, 'Aún no hay reportes'), h('p', { class: 'vacio-texto' }, 'Sube los PDF de tus ventas diarias o semanales y clasifícalos por mes y día de atención.'),
          h('button', { type: 'button', class: 'btn btn-primario', onclick: () => abrirSubida() }, 'Subir el primer reporte')));
        return;
      }
      if (!local.sel || !meses.has(local.sel.key)) { local.sel = { key: claves[0], dia: null }; local.abiertos.add(claves[0]); }

      // Panel lateral: acordeón de meses
      const lateral = h('nav', { class: 'meses', 'aria-label': 'Meses con reportes' });
      claves.forEach((k) => {
        const items = meses.get(k), abierto = local.abiertos.has(k);
        const cab = h('button', { type: 'button', class: 'mes-cab' + (local.sel.key === k && !local.sel.dia ? ' activo' : ''), 'aria-expanded': abierto ? 'true' : 'false', onclick: () => {
          if (local.abiertos.has(k) && local.sel.key === k && !local.sel.dia) local.abiertos.delete(k); else local.abiertos.add(k);
          local.sel = { key: k, dia: null }; DL.rerender();
        } }, h('span', { class: 'chev', html: DL.icons.chevron }), h('span', { class: 'mes-nombre' }, keyLabel(k)), h('span', { class: 'contador' }, items.length));
        const dias = h('ul', { class: 'mes-dias', hidden: !abierto }, DL.DIAS.map((d) => {
          const n = items.filter((m) => m.dias.includes(d)).length;
          return h('li', {}, h('button', { type: 'button', class: 'dia' + (local.sel.key === k && local.sel.dia === d ? ' activo' : '') + (n ? '' : ' vacio-dia'), onclick: () => { local.sel = { key: k, dia: d }; DL.rerender(); } }, h('span', {}, d), h('span', { class: 'contador' }, n)));
        }));
        lateral.append(h('div', { class: 'mes' }, cab, dias));
      });

      // Panel principal: archivos del mes o del día
      const items = meses.get(local.sel.key);
      const q = E.norm(local.q);
      const filtra = (arr) => arr.filter((m) => !q || E.norm(m.nombre).includes(q)).sort((a, b) => (a.fecha || a.subido) < (b.fecha || b.subido) ? 1 : -1);
      const panel = h('section', { class: 'archivos', ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); abrirSubida(e.dataTransfer.files); } });
      panel.append(h('header', { class: 'archivos-cab' }, h('h2', {}, keyLabel(local.sel.key) + (local.sel.dia ? ' · ' + local.sel.dia : '')),
        h('input', { type: 'search', class: 'buscar', placeholder: 'Buscar por nombre', 'aria-label': 'Buscar reporte', value: local.q, oninput: (e) => { local.q = e.target.value; DL.rerender(() => { const i = document.querySelector('.archivos .buscar'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); } })));
      const dias = local.sel.dia ? [local.sel.dia] : DL.DIAS;
      let alguno = false;
      dias.forEach((d) => {
        const arr = filtra(items.filter((m) => m.dias.includes(d)));
        if (!arr.length && !local.sel.dia) return;
        alguno = alguno || arr.length > 0;
        if (!local.sel.dia) panel.append(h('h3', { class: 'dia-titulo' }, d, h('span', { class: 'contador' }, arr.length)));
        if (!arr.length) panel.append(DL.empty('Sin reportes para este día', 'Puedes arrastrar un PDF aquí o usar "Subir reportes".'));
        else panel.append(h('div', { class: 'archivos-lista' }, arr.map(tarjetaArchivo)));
      });
      if (!alguno && !local.sel.dia) panel.append(DL.empty('No hay reportes que coincidan'));
      host.append(h('div', { class: 'historial' }, lateral, panel));
    },
  };
})();
