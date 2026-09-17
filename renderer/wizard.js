/* HABITIA · Asistente de primera ejecución (Fase 1)
 * Se muestra una sola vez (o hasta que el usuario lo marque como hecho).
 * Reutiliza las mismas APIs que el resto de la app (empresa/estudios/inquilinos/contratos).
 * Nunca inventa datos financieros: todo lo que escribe lo escribe el propio usuario.
 * Opciones en cada paso: «Configurar después» (marca como hecho y cierra), «Saltar» (solo este paso).
 */
'use strict';

const Wizard = (() => {
  let abierto = false;

  const FLAG_LISTO = 'primer_ejecucion_hecho';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function marcarHecho() {
    try { await window.api.configSet(FLAG_LISTO, '1'); } catch (_) { /* noop */ }
  }
  async function estaHecho() {
    try { const v = await window.api.configGet(FLAG_LISTO); return v && (v.data === '1' || v.value === '1'); } catch (_) { return false; }
  }

  function toast(msg, tipo = 'ok') {
    try {
      const el = document.createElement('div');
      el.className = 'toast ' + tipo;
      el.textContent = msg;
      const root = $('#toast-root');
      if (root) { root.appendChild(el); setTimeout(() => el.remove(), 3200); }
    } catch (_) { /* noop */ }
  }

  function cerrar() {
    abierto = false;
    const root = $('#wizard-root');
    if (root) root.innerHTML = '';
  }

  function base(contenido) {
    return `
      <div class="wz-capa">
        <div class="wz-tarjeta">
          <div class="wz-head">
            <div class="wz-logo">H</div>
            <div>
              <div class="wz-titulo">HABITIA — Puesta a punto</div>
              <div class="wz-sub" id="wz-sub">Te guiamos en los primeros pasos (lo puedes dejar para después).</div>
            </div>
          </div>
          <div class="wz-cuerpo" id="wz-cuerpo">${contenido}</div>
        </div>
      </div>`;
  }

  function pasoBienvenida() {
    const c = `
      <div class="wz-paso">
        <h3>¡Bienvenido a HABITIA!</h3>
        <p>Este pequeño asistente te ayuda a dejar listo tu negocio de alquileres en ~1 minuto: los datos de tu empresa, tu primera propiedad, un inquilino y su contrato.</p>
        <p class="wz-nota">No tienes que completarlo todo ahora: <b>“Configurar después”</b> no borra nada, solo lo pospone.</p>
        <div class="wz-acciones">
          <button class="btn" onclick="Wizard.abrirPaso('empresa')">Comenzar</button>
          <button class="btn secundario" onclick="Wizard.configurarDespues()">Configurar después</button>
          <button class="btn secundario" onclick="Wizard.cargarEjemplo()">Cargar datos de ejemplo</button>
        </div>
      </div>`;
    $('#wizard-root').innerHTML = base(c);
  }

  function pasoEmpresa() {
    const c = `
      <div class="wz-paso">
        <h3>Tu empresa / negocio</h3>
        <div class="wz-grid">
          <div class="campo"><label>Nombre del negocio *</label><input id="wz-emp-nombre" placeholder="Ej. Inversiones HABITIA"></div>
          <div class="campo"><label>RNC (opcional)</label><input id="wz-emp-rnc" placeholder="Si aplica"></div>
          <div class="campo"><label>Teléfono</label><input id="wz-emp-tel" placeholder="809-000-0000"></div>
          <div class="campo"><label>Correo</label><input id="wz-emp-email" type="email" placeholder="correo@dominio.com"></div>
          <div class="campo campo-ancho"><label>Dirección</label><input id="wz-emp-dir" placeholder="Calle, ciudad"></div>
        </div>
        <div class="wz-acciones">
          <button class="btn" onclick="Wizard.guardarEmpresa()">Guardar y continuar</button>
          <button class="btn secundario" onclick="Wizard.abrirPaso('primeraPropiedad')">Saltar este paso</button>
          <button class="btn secundario" onclick="Wizard.configurarDespues()">Configurar después</button>
        </div>
      </div>`;
    $('#wizard-root').innerHTML = base(c);
    setTimeout(() => { const e = $('#wz-emp-nombre'); if (e) e.focus(); }, 50);
  }

  function pasoPrimeraPropiedad() {
    const c = `
      <div class="wz-paso">
        <h3>Tu primera propiedad</h3>
        <p class="wz-nota">Cada propiedad es un edificio/estudio que alquilas. Puedes capturar solo lo esencial y completar el resto después desde el menú.</p>
        <div class="wz-grid">
          <div class="campo"><label>Nombre *</label><input id="wz-est-nombre" placeholder="Ej. Estudio Bella Vista"></div>
          <div class="campo"><label>Dirección</label><input id="wz-est-dir" placeholder="Calle, sector"></div>
          <div class="campo"><label>Edificio</label><input id="wz-est-edif" placeholder="Ej. Torre A"></div>
          <div class="campo"><label>Alquiler mensual (RD$)</label><input id="wz-est-alquiler" type="number" min="0" placeholder="0"></div>
          <div class="campo"><label>Estado</label>
            <select id="wz-est-estado">
              <option value="disponible">Disponible</option>
              <option value="ocupado">Ocupado</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="fuera">Fuera de servicio</option>
            </select>
          </div>
        </div>
        <div class="wz-acciones">
          <button class="btn" onclick="Wizard.guardarPrimeraPropiedad()">Guardar y continuar</button>
          <button class="btn secundario" onclick="Wizard.abrirPaso('primerInquilino')">Saltar este paso</button>
          <button class="btn secundario" onclick="Wizard.configurarDespues()">Configurar después</button>
        </div>
      </div>`;
    $('#wizard-root').innerHTML = base(c);
    setTimeout(() => { const e = $('#wz-est-nombre'); if (e) e.focus(); }, 50);
  }

  function pasoPrimerInquilino() {
    const c = `
      <div class="wz-paso">
        <h3>Un primer inquilino</h3>
        <div class="wz-grid">
          <div class="campo"><label>Nombre completo *</label><input id="wz-inq-nombre" placeholder="Nombre y apellido"></div>
          <div class="campo"><label>Teléfono</label><input id="wz-inq-tel" placeholder="809-000-0000"></div>
          <div class="campo"><label>WhatsApp</label><input id="wz-inq-wa" placeholder="Mismo o distinto"></div>
          <div class="campo"><label>Correo</label><input id="wz-inq-email" type="email" placeholder="correo@dominio.com"></div>
        </div>
        <div class="wz-acciones">
          <button class="btn" onclick="Wizard.guardarInquilino()">Guardar y continuar</button>
          <button class="btn secundario" onclick="Wizard.abrirPaso('contrato')">Saltar este paso</button>
          <button class="btn secundario" onclick="Wizard.configurarDespues()">Configurar después</button>
        </div>
      </div>`;
    $('#wizard-root').innerHTML = base(c);
    setTimeout(() => { const e = $('#wz-inq-nombre'); if (e) e.focus(); }, 50);
  }

  function pasoContrato() {
    async function cargarOpciones() {
      try {
        const estudios = ((await window.api.estudiosList({ q: '' })).data) || [];
        const inquilinos = ((await window.api.inquilinosList({ q: '' })).data) || [];
        const hoy = new Date();
        const mes = (hoy.getMonth() + 2) > 12 ? 1 : (hoy.getMonth() + 2);
        const anio = (hoy.getMonth() + 2) > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();
        const cuerpo = $('#wz-cuerpo');
        if (!cuerpo) return;
        cuerpo.innerHTML = `
          <h3>Contrato (opcional)</h3>
          <div class="wz-grid">
            <div class="campo"><label>Propiedad</label>
              <select id="wz-ctr-estudio">
                <option value="">— selecciona una propiedad —</option>
                ${(estudios || []).map((e) => `<option value="${e.id}">${esc(e.nombre || e.edificio || ('#' + e.id))}</option>`).join('')}
              </select>
            </div>
            <div class="campo"><label>Inquilino</label>
              <select id="wz-ctr-inquilino">
                <option value="">— selecciona un inquilino —</option>
                ${(inquilinos || []).map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('')}
              </select>
            </div>
            <div class="campo"><label>Alquiler mensual (RD$)</label><input id="wz-ctr-renta" type="number" min="0" placeholder="0"></div>
            <div class="campo"><label>Fecha inicio</label><input id="wz-ctr-inicio" type="date"></div>
            <div class="campo"><label>Día de pago</label>
              <select id="wz-ctr-dia">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
            </div>
          </div>
          <div class="wz-acciones">
            <button class="btn" onclick="Wizard.guardarContrato()">Guardar contrato</button>
            <button class="btn secundario" onclick="Wizard.configurarDespues()">Configurar después</button>
          </div>`;
        const fecIni = document.getElementById('wz-ctr-inicio');
        if (fecIni) {
          fecIni.value = hoy.toISOString().slice(0, 10);
          fecIni.min = new Date(anio, mes - 1, 1).toISOString().slice(0, 10);
        }
      } catch (_) { /* relleno mínimo */ }
    }
    const c = `<div class="wz-paso"><h3>Cargando...</h3></div>`;
    $('#wizard-root').innerHTML = base(c);
    cargarOpciones();
  }

  async function guardarEmpresa() {
    const nombre = ($('#wz-emp-nombre') || {}).value || '';
    if (!nombre.trim()) return toast('Escribe el nombre del negocio', 'error');
    const r = await window.api.empresaSave({
      id: 1, nombre: nombre.trim(),
      rnc: ($('#wz-emp-rnc') || {}).value || '',
      telefono: ($('#wz-emp-tel') || {}).value || '',
      email: ($('#wz-emp-email') || {}).value || '',
      direccion: ($('#wz-emp-dir') || {}).value || ''
    });
    if (!r.ok) return toast(r.error || 'No se pudo guardar', 'error');
    toast('Empresa guardada');
    window.__empresaActualizada && window.__empresaActualizada();
    Wizard.abrirPaso('primeraPropiedad');
  }

  async function guardarPrimeraPropiedad() {
    const nombre = ($('#wz-est-nombre') || {}).value || '';
    if (!nombre.trim()) return toast('Escribe el nombre de la propiedad', 'error');
    const r = await window.api.estudiosSave({
      id: null,
      nombre: nombre.trim(),
      direccion: ($('#wz-est-dir') || {}).value || '',
      edificio: ($('#wz-est-edif') || {}).value || '',
      gastos_fijos: 0,
      alquiler: Number(($('#wz-est-alquiler') || {}).value) || 0,
      deposito: 0,
      costo_inversion: 0,
      estado: ($('#wz-est-estado') || {}).value || 'disponible'
    });
    if (!r.ok) return toast(r.error || 'No se pudo guardar', 'error');
    toast('Propiedad creada');
    Wizard.abrirPaso('primerInquilino');
  }

  async function guardarInquilino() {
    const nombre = ($('#wz-inq-nombre') || {}).value || '';
    if (!nombre.trim()) return toast('Escribe el nombre del inquilino', 'error');
    const r = await window.api.inquilinosSave({
      id: null, nombre: nombre.trim(),
      telefono: ($('#wz-inq-tel') || {}).value || '',
      whatsapp: ($('#wz-inq-wa') || {}).value || '',
      email: ($('#wz-inq-email') || {}).value || '',
      notas: ''
    });
    if (!r.ok) return toast(r.error || 'No se pudo guardar', 'error');
    toast('Inquilino guardado');
    Wizard.abrirPaso('contrato');
  }

  async function guardarContrato() {
    const estudioId = Number(($('#wz-ctr-estudio') || {}).value) || null;
    const inquilinoId = Number(($('#wz-ctr-inquilino') || {}).value) || null;
    if (!estudioId || !inquilinoId) return toast('Selecciona propiedad e inquilino', 'error');
    const r = await window.api.contratosSave({
      id: null, estudio_id: estudioId, inquilino_id: inquilinoId,
      fecha_inicio: ($('#wz-ctr-inicio') || {}).value || '',
      fecha_vencimiento: '',
      duracion_meses: 12,
      renta: Number(($('#wz-ctr-renta') || {}).value) || 0,
      deposito: Number(($('#wz-ctr-renta') || {}).value) || 0,
      dia_pago: Number(($('#wz-ctr-dia') || {}).value) || 5,
      incremento_pct: 0,
      aval_nombre: '', aval_telefono: '', notas: ''
    });
    if (!r.ok) return toast(r.error || 'No se pudo guardar', 'error');
    toast('Contrato creado');
    await Wizard.terminar('¡Listo! Empezaste con buen pie.');
  }

  async function configurarDespues() {
    await marcarHecho();
    toast('Puedes configurarlo en cualquier momento desde el menú');
    cerrar();
  }

  async function cargarEjemplo() {
    try {
      const r = await window.api.muestraSeed();
      if (r && r.ok) {
        await marcarHecho();
        toast('Datos de ejemplo cargados');
        cerrar();
        if (window.__datosCambiaron) window.__datosCambiaron();
      } else { toast((r && r.error) || 'No se pudo cargar', 'error'); }
    } catch (_) { toast('No se pudo cargar', 'error'); }
  }

  async function terminar(msg) {
    await marcarHecho();
    toast(msg);
    cerrar();
  }

  async function abrirPaso(paso) {
    const fns = {
      'empresa': pasoEmpresa,
      'primeraPropiedad': pasoPrimeraPropiedad,
      'primerInquilino': pasoPrimerInquilino,
      'contrato': pasoContrato
    };
    if (fns[paso]) fns[paso]();
  }

  async function iniciar() {
    if (abierto) return;
    if (await estaHecho()) return;
    try {
      // Solo si la app está vacía (nada configurado) se muestra el asistente.
      const empresa = ((await window.api.empresaGet()).data) || {};
      const estudios = ((await window.api.estudiosList({ q: '' })).data) || [];
      const inquilinos = ((await window.api.inquilinosList({ q: '' })).data) || [];
      if (empresa && (empresa.nombre || '').trim()) return; // ya hay negocio configurado
      if (estudios.length || inquilinos.length) return;     // ya hay datos → no molestar
      abierto = true;
      pasoBienvenida();
    } catch (_) { /* si algo falla, no bloqueamos nunca la app */ }
  }

  return { iniciar, abrirPaso, guardarEmpresa, guardarPrimeraPropiedad, guardarInquilino, guardarContrato, configurarDespues, cargarEjemplo };
})();

window.Wizard = Wizard;
window.PrimerVez = Wizard;
if (typeof window.__wizardRegistrado === 'undefined') {
  window.__escucharListo = window.__escucharListo || [];
  window.__escucharListo.push(() => Wizard.iniciar());
  window.__wizardRegistrado = true;
}
