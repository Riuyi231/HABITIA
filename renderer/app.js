'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Corrección de foco (Windows/Electron): a veces el primer clic sobre un cuadro
// de texto activa la ventana pero no le da el cursor. Se refuerza el foco del
// campo sobre el que se hizo clic.
window.addEventListener('mousedown', (e) => {
  const t = e.target;
  if (!t || !t.tagName || !t.matches) return;
  if (!t.matches('input, textarea, select')) return;
  setTimeout(() => {
    if (!t.disabled && !t.readOnly && document.activeElement !== t) t.focus({ preventScroll: true });
  }, 0);
});

const fmt = (n, dec = 0) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(n) || 0);
const RD$ = (n, dec = 2) => 'RD$ ' + fmt(n, dec);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let empresa = { nombre: '', rnc: '', telefono: '', email: '', direccion: '' };
let vistaActual = 'dashboard';
let mesActual = new Date().toISOString().slice(0, 7);

const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const hoyISO = () => new Date().toISOString().slice(0, 10);
const horaLarga = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || '');
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  return esHoy ? ('hoy · ' + hh + ':' + mm) : (dd + ' ' + mmm + ' · ' + hh + ':' + mm);
};
const sumarMeses = (fecha, n) => {
  const [y, m, d] = String(fecha).split('-').map(Number);
  const t = new Date(y, m - 1 + Number(n), d);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
};
const etiqMes = (mes) => {
  const [y, m] = String(mes).split('-');
  return `${NOMBRE_MES[Number(m) - 1]} ${y}`;
};
const CATEG_ETIQ = { luz: 'Electricidad', agua: 'Agua', internet: 'Internet', remodelacion: 'Remodelación', otros: 'Otros' };

const SUBCAT_ETIQ = {
  luz: ['generador', 'inversor', 'placas', 'alineamiento', 'luminarias', 'insumos'],
  agua: ['cisterna', 'bomba', 'tuberia', 'plomería', 'tanque'],
  internet: ['internet', 'cable', 'alarma'],
  remodelacion: ['pintura', 'construccion', 'herrería', 'carpintería', 'electricidad', 'plomería', 'impermeabilización', 'accesorios'],
  otros: ['impuestos', 'seguros', 'legal', 'publicidad', 'limpieza', 'varios']
};
const ESTADO_EST_ETIQ = { ocupado: 'Ocupado', disponible: 'Disponible', mantenimiento: 'En mantenimiento', fuera: 'Fuera de servicio' };
const ESTADO_EST_CLS = { ocupado: 'pagada', disponible: 'parcial', mantenimiento: 'vencida', fuera: 'pendiente' };
const PRIORIDAD_ETIQ = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
const PRIORIDAD_CLS = { baja: 'parcial', media: 'pendiente', alta: 'vencida', critica: 'pagada' };
const METODOS_PAGO = ['', 'efectivo', 'transferencia', 'deposito', 'tarjeta', 'cheque', 'otro'];
const METODO_ETIQ = { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito bancario', tarjeta: 'Tarjeta', cheque: 'Cheque', otro: 'Otro' };
const opcionesMetodo = (sel) => `<option value="">— seleccionar —</option>` + METODOS_PAGO.filter(Boolean).map((m) => `<option value="${m}" ${sel === m ? 'selected' : ''}>${METODO_ETIQ[m]}</option>`).join('');
const opcionesMoneda = (sel) => `<option value="RD$" ${(sel || 'RD$') === 'RD$' ? 'selected' : ''}>RD$ · Peso dominicano</option><option value="USD" ${sel === 'USD' ? 'selected' : ''}>USD · Dólar</option>`;
const MN$ = (n, moneda = 'RD$', dec = 2) => (monedaOkUI(moneda) + ' ' + fmt(n, dec));
const monedaOkUI = (m) => (['RD$', 'USD'].indexOf(m) >= 0 ? m : 'RD$');
const CATEG_CXP_ETIQ = { agua: 'Agua', electricidad: 'Electricidad', internet: 'Internet', mantenimiento: 'Mantenimiento', reparacion: 'Reparación', limpieza: 'Limpieza', seguridad: 'Seguridad', compra: 'Compra', impuestos: 'Impuestos', servicios: 'Servicios', otros: 'Otros' };
const ESTADO_CXP_ETIQ = { pendiente: 'Pendiente', pagada: 'Pagada', cancelada: 'Cancelada' };
const ESTADO_CXP_CLS = { pendiente: 'pendiente', pagada: 'pagada', cancelada: 'parcial' };
const ESTADO_ORDEN_ETIQ = { reportado: 'Reportado', en_revision: 'En revisión', aprobado: 'Aprobado', en_reparacion: 'En reparación', completado: 'Completado', cancelado: 'Cancelado', abierta: 'Reportado', cerrada: 'Completado' };
const ESTADO_ORDEN_CLS = { reportado: 'vencida', en_revision: 'parcial', aprobado: 'pendiente', en_reparacion: 'pendiente', completado: 'pagada', cancelado: 'parcial', abierta: 'vencida', cerrada: 'pagada' };
const FLUJO_DIAS = [7, 15, 30, 60, 90];
const BUCKET_ETIQ = { corriente: 'Al día', mes0: 'Este mes', mes1: '1 mes', mes2: '2 meses', mes3plus: '3+ meses' };
const BUCKET_CLS = { corriente: 'pagada', mes0: 'parcial', mes1: 'parcial', mes2: 'vencida', mes3plus: 'vencida' };

let __fichaId = null;
let __fichaDebido = 0;

function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- Actualización (overlay estético) ----------
const $upd = () => $('#update-root');

function updEstadoActual() {
  return window.__updEstado || null;
}

function updCerrar() {
  $upd().innerHTML = '';
  window.__updEstado = null;
}

function updMostrar(estado, datos) {
  window.__updEstado = estado;
  const root = $upd();
  const p = Math.max(0, Math.min(100, Math.round((datos && datos.porciento) || 0)));

  // Durante la descarga no se reconstruye el overlay (eso causaba parpadeo):
  // solo se actualiza la barra y el porcentaje.
  if (estado === 'descargando') {
    const barra = root.querySelector('.upd-barra > div');
    const pct = root.querySelector('.upd-porciento .upd-pct');
    if (barra) { barra.style.width = p + '%'; if (pct) pct.textContent = p + '%'; window.__updEstado = 'descargando'; return; }
  }

  let html = '<div class="upd-backdrop"><div class="upd-card">';

  if (estado === 'disponible') {
    html += `
      <div class="upd-hero">
        <button class="upd-cerrar" onclick="updCerrar()">×</button>
        <div class="upd-logo">H</div>
        <h2>¡Nueva versión!</h2>
        <p>Una versión más reciente de HABITIA está lista</p>
        <div class="upd-versiones">
          <span class="upd-ver actual">v${esc((datos && datos.versionActual) || '?')}</span>
          <span class="upd-flecha">→</span>
          <span class="upd-ver">v${esc((datos && datos.version) || '?')}</span>
        </div>
      </div>
      <div class="upd-body">
        <div class="upd-msg">La descarga empieza automáticamente. Tu información se conserva tal cual y podrás seguir trabajando apenas termine.</div>
      </div>`;
  } else if (estado === 'descargando') {
    html += `
      <div class="upd-hero">
        <button class="upd-cerrar" onclick="updCerrar()">×</button>
        <div class="upd-logo">H</div>
        <h2>Descargando actualización</h2>
        <p>Se está preparando una nueva versión para ti</p>
      </div>
      <div class="upd-body">
        <div class="upd-progreso">
          <div class="upd-barra"><div style="width:${p}%"></div></div>
          <div class="upd-porciento"><span>Descargando…</span><span class="upd-pct">${p}%</span></div>
        </div>
      </div>
      <div class="upd-foot"></div>`;
  } else if (estado === 'listo') {
    html += `
      <div class="upd-hero">
        <button class="upd-cerrar" onclick="updCerrar()">×</button>
        <div class="upd-logo">H</div>
        <h2>Actualización lista</h2>
        <p>La versión ${esc((datos && datos.version) || 'nueva')} está descargada</p>
      </div>
      <div class="upd-body">
        <div class="upd-msg">Reinicia HABITIA para aplicar la nueva versión. Es rápido y se cerrará automáticamente.</div>
      </div>
      <div class="upd-foot">
        <button class="upd-btn secundario" onclick="updCerrar()">Más tarde</button>
        <button class="upd-btn primario" onclick="updInstalar()">Reiniciar y actualizar</button>
      </div>`;
  } else if (estado === 'error') {
    html += `
      <div class="upd-hero" style="background:linear-gradient(135deg,#b91c1c,#e11d48)">
        <button class="upd-cerrar" onclick="updCerrar()">×</button>
        <div class="upd-logo">H</div>
        <h2>No se pudo actualizar</h2>
        <p>Ocurrió un problema al buscar la actualización</p>
      </div>
      <div class="upd-body">
        <div class="upd-chip err"><span>▼</span>${esc((datos && datos.error) || 'Error desconocido')}</div>
      </div>
      <div class="upd-foot">
        <button class="upd-btn secundario" onclick="updCerrar()">Entendido</button>
      </div>`;
  } else {
    root.innerHTML = '';
    return;
  }

  html += '</div></div>';
  root.innerHTML = html;
  if (estado === 'descargando') window.__updEstado = 'descargando';
}

async function updDescargar() {
  await window.api.updateDownload();
  updMostrar('descargando', { porciento: 2 });
}

async function updInstalar() {
  await window.api.updateInstall();
}

function initUpdates() {
  if (!window.api || !window.api.onUpdateStatus) return;
  window.api.onUpdateStatus((data) => {
    const e = data && data.estado;
    if (e === 'disponible') updMostrar('disponible', data);
    else if (e === 'descargando') updMostrar('descargando', data);
    else if (e === 'listo') updMostrar('listo', data);
    else if (e === 'error') updMostrar('error', data);
    else if (e === 'revisado') { /* silencioso */ }
  });
}

function modal(titulo, bodyHTML, footHTML = '', ancho = 640) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" style="width:${ancho}px">
        <div class="modal-head">
          <h2>${esc(titulo)}</h2>
          <button onclick="cerrarModal()">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
      </div>
    </div>`;
}
function cerrarModal() { $('#modal-root').innerHTML = ''; window.__reRenderModal = null; }

function titulo(t) {
  $('#page-title').textContent = t;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === vistaActual));
}

function selectorMes() {
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <button class="btn secundario pequeño" onclick="cambiarMes(-1)">◀</button>
      <span style="font-weight:700;min-width:150px;text-align:center">${etiqMes(mesActual)}</span>
      <button class="btn secundario pequeño" onclick="cambiarMes(1)">▶</button>
    </div>`;
}
function cambiarMes(delta) {
  const [y, m] = mesActual.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  mesActual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  visualizar();
}

// ---------- Paginador ----------
const POR_PAG = 15;
const __pag = {};
function paginar(col, arr) {
  const total = arr.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAG));
  __pag[col] = __pag[col] || 1;
  if (__pag[col] > paginas) __pag[col] = paginas;
  const p = __pag[col];
  const desde = (p - 1) * POR_PAG;
  return { p, paginas, total, desde, hasta: Math.min(desde + POR_PAG, total), filas: arr.slice(desde, desde + POR_PAG) };
}
function paginadorHTML(col, pg) {
  if ((pg.total || 0) <= POR_PAG || pg.paginas <= 1) return '';
  const btn = (n, txt, activo) => `<button type="button" class="pag${activo ? ' activo' : ''}" ${n < 1 || n > pg.paginas ? 'disabled' : ''} onclick="irPagina('${col}', ${n})">${txt}</button>`;
  let nums = '';
  const ini = Math.max(1, pg.p - 2);
  const fin = Math.min(pg.paginas, ini + 4);
  for (let i = ini; i <= fin; i++) nums += btn(i, i, i === pg.p);
  return `
    <div class="paginador">
      ${btn(pg.p - 1, '‹')}
      ${pg.p > 3 ? '<span class="pag-info">1…</span>' : ''}
      ${nums}
      ${pg.p < pg.paginas - 2 ? `<span class="pag-info">…${pg.paginas}</span>` : ''}
      ${btn(pg.p + 1, '›')}
      <span class="pag-info">${pg.total} resultados · ${pg.p} de ${pg.paginas}</span>
    </div>`;
}
function irPagina(col, p) {
  __pag[col] = p;
  if (window.__reRenderModal && $('#modal-root').children.length) { window.__reRenderModal(); return; }
  vista(vistaActual);
}

const NOM_CORTO = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
function graficaTendencia(data) {
  const W = 760, H = 210, padL = 52, padB = 24, padT = 10;
  const chartW = W - padL - 16, chartH = H - padT - padB;
  const max = Math.max(1, ...(data || []).map((d) => Math.max(Number(d.cobrado) || 0, Number(d.gastos) || 0)));
  const n = (data || []).length;
  const anchoG = chartW / Math.max(1, n);
  const barW = Math.min(10, Math.max(3, anchoG * 0.32));
  const y = (v) => padT + chartH - (chartH * v) / max;
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#d0d7e2"/>
    <line x1="${padL}" y1="${padT + chartH}" x2="${W - 16}" y2="${padT + chartH}" stroke="#d0d7e2"/>`;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    const yy = y(v);
    s += `<line x1="${padL}" y1="${yy}" x2="${W - 16}" y2="${yy}" stroke="#eef1f6"/>`;
    s += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#8a94a6">${fmt(v)}</text>`;
  }
  (data || []).forEach((d, i) => {
    const cx = padL + i * anchoG + anchoG / 2;
    const mm = Number(String(d.mes).split('-')[1]) - 1;
    const hC = (chartH * Number(d.cobrado)) / max;
    const hG = (chartH * Number(d.gastos)) / max;
    s += `<rect x="${(cx - barW - 2).toFixed(1)}" y="${y(Number(d.cobrado)).toFixed(1)}" width="${barW}" height="${Math.max(1, hC).toFixed(1)}" rx="2" fill="#16a34a"/>`;
    s += `<rect x="${(cx + 2).toFixed(1)}" y="${y(Number(d.gastos)).toFixed(1)}" width="${barW}" height="${Math.max(1, hG).toFixed(1)}" rx="2" fill="#e11d48"/>`;
    s += `<text x="${cx}" y="${H - 7}" text-anchor="middle" font-size="9" fill="#8a94a6">${NOM_CORTO[mm] || mm + 1}</text>`;
  });
  s += '</svg>';
  return s;
}

// ============================================================
//                     VISTAS
// ============================================================

async function loadBasicos() {
  try {
    const d = await window.api.reporteResumen(mesActual);
    if (d.ok) {
      const x = (await window.api.empresaGet()).data;
      empresa = { ...x };
      window.__usuarioActual = (await window.api.configGet('usuario_actual')) || 'Dueño';
      window.__diaPago = Number((await window.api.configGet('dia_pago')) || 5);
      window.__segLockMin = Number((await window.api.configGet('seg_lock_min')) || 0) || 0;
      $('#empresa-nombre').textContent = empresa.nombre || '—';
      $('#foot-info').textContent = `${d.data.estudios} estudios · ${d.data.ocupados} ocupados`;
    }
  } catch (_) {}
  actualizarBadgeAlertas();
}

async function viewDashboard() {
  vistaActual = 'dashboard';
  titulo('Resumen');
  const r = (await window.api.reporteResumen(mesActual)).data;
  const tend = (await window.api.reporteTendencia(12)).data;
  const ocup = (await window.api.ocupacionResumen()).data;
  const pend = (await window.api.centroPendientes()).data;
  const moro = (await window.api.morosidadDetalle({})).data;
  const ordenes = (await window.api.mantenimientoList()).data || [];
  const abiertas = ordenes.filter((o) => o.estado === 'abierta').length;
  const finF2 = (await window.api.dashboardFinanciero(mesActual)).data;
  const flujoF2 = (await window.api.flujoCajaGet(30)).data;
  const alertasF2 = (await window.api.alertasContar()).data;
  const cxpF2 = (await window.api.cuentasPagarList({ pendientes: true })).data || [];
  const auditReciente = (await window.api.auditReciente(10)).data || [];
  const montoPorMoneda = (obj) => Object.entries(obj || {}).map(([k, v]) => MN$(v, k, 0)).join(' + ') || '—';
  const cxpDetalle = {};
  cxpF2.forEach((c) => { cxpDetalle[monedaOkUI(c.moneda)] = round2sum(cxpDetalle[monedaOkUI(c.moneda)], c.monto); });

  $('#content').innerHTML = `
    <div class="btn-row">
      ${selectorMes()}
      <span style="flex:1"></span>
      <button class="btn secundario" onclick="exportarPDF('resumen')">PDF Resumen</button>
      <button class="btn secundario" onclick="exportarPDF('cobros')">PDF Cobros</button>
      <button class="btn secundario" onclick="exportarPDF('gastos')">PDF Gastos</button>
      <button class="btn secundario" onclick="exportarPDF('aging')">PDF Aging</button>
      <button class="btn secundario" onclick="exportarPDF('rentabilidad')">PDF Rentabilidad</button>
      <button class="btn secundario" onclick="exportarDato('resumen','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('resumen','csv')">CSV</button>
    </div>

    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card kpi positivo"><div class="label">Cobrado</div>
        <div class="valor">${RD$(r.cobrado)}</div>
        <div class="sub">${r.cobradoCuota} de ${r.estudios} estudios</div></div>
      <div class="card kpi negativo"><div class="label">Por cobrar</div>
        <div class="valor">${RD$(r.porCobrar)}</div>
        <div class="sub">${r.pendientes.length} alquileres pendientes</div></div>
      <div class="card kpi ${r.totalAtrasado > 0 ? 'negativo' : ''}"><div class="label">Atrasado (meses previos)</div>
        <div class="valor">${RD$(r.totalAtrasado)}</div>
        <div class="sub">deuda acumulada</div></div>
      <div class="card kpi ${moro && moro.mes3plus > 0 ? 'negativo' : ''}"><div class="label">Vencido 30/60/90</div>
        <div class="valor">${moro ? RD$(moro.total) : '—'} <button class="btn pequeño secundario" onclick="verMorosidad()">Ver</button></div>
        <div class="sub">${moro && moro.filas ? moro.filas.length : 0} cuotas con saldo</div></div>
      <div class="card kpi"><div class="label">Gastos del mes</div>
        <div class="valor">${RD$(r.gastos.total)}</div>
        <div class="sub">luz · agua · internet · arreglos</div></div>
      <div class="card kpi"><div class="label">Ocupación</div>
        <div class="valor">${ocup ? ocup.ocupacionPct : 0}%</div>
        <div class="sub">${ocup ? ocup.ocupado : 0}/${ocup ? ocup.total : 0} ocupados · ${ocup ? RD$(ocup.ingresoPerdido, 0) : '—'} no cobrables</div></div>
      <div class="card kpi"><div class="label">Inversión (CAPEX)</div>
        <div class="valor">${RD$(r.inversion)}</div>
        <div class="sub">costo de adquisición de estudios</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Finanzas · ${etiqMes(mesActual)} <span class="detalle" style="font-weight:400">(por moneda — no se mezclan RD$ y USD)</span>
        <button class="btn pequeño secundario" onclick="vista('flujo')">Flujo de caja</button>
      </h3>
      <div class="grid grid-2">
        ${(finF2 && Object.keys(finF2.porMoneda || {}).length)
          ? Object.entries(finF2.porMoneda).map(([md, c]) => `<div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                <span class="badge pagada">💰 Recaudado: <b>${MN$(c.recaudado, md, 0)}</b></span>
                <span class="badge ${c.pendiente ? 'pendiente' : 'pagada'}">Pendiente: <b>${MN$(c.pendiente, md, 0)}</b></span>
                ${c.vencido ? `<span class="badge vencida">Vencido: <b>${MN$(c.vencido, md, 0)}</b></span>` : ''}
                <span class="badge parcial">Gastos: <b>${MN$(c.gastos, md, 0)}</b></span>
                ${c.cxp ? `<span class="badge vencida">CxP: <b>${MN$(c.cxp, md, 0)}</b></span>` : ''}
              </div>
              <div class="detalle">Utilidad estimada del mes (recaudado − gastos): <b style="color:${Number(c.recaudado - c.gastos) >= 0 ? 'var(--verde)' : 'var(--rosado)'}">${MN$(Number(c.recaudado) - Number(c.gastos), md, 0)}</b></div>
            </div>`).join('')
          : `<div class="detalle">Sin movimientos con moneda registrada en este mes.</div>`}
      </div>
      ${finF2 && finF2.vencidosMonto > 0
        ? `<div class="detalle" style="margin-top:6px">💸 <b>${finF2.vencidos} vencido${finF2.vencidos === 1 ? '' : 's'}</b> en el mes · ${RD$(finF2.vencidosMonto, 0)} a gestionar <button class="btn pequeño secundario" onclick="vista('cobros');buscarMorosos()">Cobrar</button></div>`
        : ''}
      ${flujoF2 && Object.keys(flujoF2.porMoneda || {}).length
        ? `<div style="margin-top:8px;border-top:1px solid var(--borde-suave);padding-top:8px"><span class="detalle">📈 Proyección a 30 días: ${Object.entries(flujoF2.porMoneda).map(([md, c]) => `${md} <b style="color:${Number(c.proyectado) < 0 ? 'var(--rosado)' : 'var(--verde)'}">${fmt(c.proyectado, 0)}</b>`).join(' · ')}</span> <button class="btn pequeño secundario" onclick="vista('flujo')">Ver detalle</button></div>`
        : ''}
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Centro de pendientes <button class="btn pequeño secundario" onclick="verMorosidad()">Morosidad</button></h3>
      ${pend
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge ${pend.rentasVencidas ? 'vencida' : 'pagada'}">💸 ${pend.rentasVencidas} renta${pend.rentasVencidas === 1 ? '' : 's'} vencida${pend.rentasVencidas === 1 ? '' : 's'} · ${RD$(pend.rentasVencidasMonto, 0)}</span>
            <span class="badge ${pend.contratosVencen ? 'vencida' : 'pagada'}">📄 ${pend.contratosVencen} contrato${pend.contratosVencen === 1 ? '' : 's'} por vencer (60 días)</span>
            <span class="badge ${pend.mantenimientosAbiertos ? 'vencida' : 'pagada'}">🔧 ${pend.mantenimientosAbiertos} mantenimiento${pend.mantenimientosAbiertos === 1 ? '' : 's'} abierto${pend.mantenimientosAbiertos === 1 ? '' : 's'}</span>
            <span class="badge ${pend.disponibles ? 'pendiente' : 'pagada'}">🏠 ${pend.disponibles} estudio${pend.disponibles === 1 ? '' : 's'} disponible${pend.disponibles === 1 ? '' : 's'}</span>
            ${pend.estudiosVacios && pend.estudiosVacios.length ? `<span class="badge vencida">🕳 ${pend.estudiosVacios.length} vacío${pend.estudiosVacios.length === 1 ? '' : 's'} hace +90 días</span>` : ''}
            ${pend.deudasMedia ? `<span class="badge parcial">⏰ ${pend.deudasMedia} deuda${pend.deudasMedia === 1 ? '' : 's'} en 31–90 días</span>` : ''}
            ${pend.promesasProximas ? `<span class="badge pendiente">⏳ ${pend.promesasProximas} promesa${pend.promesasProximas === 1 ? '' : 's'} de pago próximas</span>` : ''}
            ${cxpF2.length ? `<span class="badge ${cxpF2.some((c) => c.vencida) ? 'vencida' : 'pendiente'}">🧾 ${cxpF2.length} cuenta${cxpF2.length === 1 ? '' : 's'} por pagar pendiente${cxpF2.length === 1 ? '' : 's'} · ${Object.entries(cxpDetalle).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}</span>` : ''}
            ${alertasF2 && alertasF2.noLeidas ? `<span class="badge vencida">🔔 ${alertasF2.noLeidas} alerta${alertasF2.noLeidas === 1 ? '' : 's'} sin leer</span>` : ''}
          </div>
          <div class="btn-row" style="margin-top:10px">
            ${pend.rentasVencidas ? `<button class="btn pequeño secundario" onclick="vista('cobros'); buscarMorosos()">Gestionar vencidos</button>` : ''}
            ${pend.contratosVencen ? `<button class="btn pequeño secundario" onclick="vista('contratos')">Revisar contratos</button>` : ''}
            ${pend.mantenimientosAbiertos ? `<button class="btn pequeño secundario" onclick="vista('mantenimiento')">Ver mantenimiento</button>` : ''}
            ${pend.estudiosVacios && pend.estudiosVacios.length ? `<button class="btn pequeño secundario" onclick="vista('estudios')">Ver estudios vacíos</button>` : ''}
            ${pend.deudasMedia ? `<button class="btn pequeño secundario" onclick="verMorosidad()">Cobrar 31–90 días</button>` : ''}
            ${cxpF2.length ? `<button class="btn pequeño secundario" onclick="vista('cxp')">Gestionar cuentas por pagar</button>` : ''}
            <span style="flex:1"></span>
            <button class="btn pequeño" onclick="recordatoriosWhatsApp()">📱 Enviar recordatorios WhatsApp</button>
          </div>`
        : ''}
    </div>

    <div class="card" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <b>🔧 Mantenimiento:</b>
      ${abiertas
        ? `<span style="color:var(--rosado)"><b>${abiertas}</b> órdene${abiertas === 1 ? 'n' : 'nes'} abierta${abiertas === 1 ? '' : 's'}</span>`
        : `<span style="color:var(--verde)">sin órdenes abiertas ✅</span>`}
      ${abiertas ? `<button class="btn pequeño" onclick="vista('mantenimiento')">Ver</button>` : `<button class="btn pequeño secundario" onclick="vista('mantenimiento')">Abrir</button>`}
      <span style="flex:1"></span>
      <span class="detalle">Los inquilinos pueden reportar averías y tú abres la orden de mantenimiento aquí.</span>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Tendencia: cobrado vs gastos <span class="detalle" style="font-weight:400">(últimos 12 meses)
        <span class="badge pagada" style="margin-left:10px">■ Cobrado</span>
        <span class="badge vencida">■ Gastos</span></span></h3>
      ${graficaTendencia(tend)}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>Ganancia neta del mes <span style="font-weight:700;color:${r.neto >= 0 ? 'var(--verde)' : 'var(--rosado)'};font-size:20px">${RD$(r.neto)}</span></h3>
        <div class="detalle">
          <b>Entradas:</b> ${RD$(r.cobrado)} cobrado + ${RD$(r.depositos)} en depósitos activos<br>
          <b>Salidas:</b> ${RD$(r.gastos.total)} en gastos<br>
          <b>Inversión (CAPEX):</b> ${RD$(r.inversion)} en estudios
        </div>
        ${Object.keys(r.gastos.porCategoria).length
          ? `<div style="margin-top:10px">${Object.entries(r.gastos.porCategoria).map(([k, v]) => `<span class="badge pendiente" style="margin-right:6px">${CATEG_ETIQ[k] || k}: ${RD$(v)}</span>`).join('')}</div>`
          : ''}
      </div>
      <div class="card">
        <h3>Quién debe <button class="btn pequeño secundario" onclick="vista('cobros')">Cobrar</button></h3>
        ${Object.keys(r.deudores).length
          ? `<table><thead><tr><th>Inquilino</th><th class="num">Debe</th></tr></thead>
             <tbody>${Object.entries(r.deudores).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num"><b>${RD$(v)}</b></td></tr>`).join('')}</tbody></table>`
          : `<div class="vacio">Nadie debe 🎉</div>`}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Atrasados de meses anteriores</h3>
      ${r.atrasados.length
        ? `<table><thead><tr><th>Mes</th><th>Estudio</th><th>Inquilino</th><th class="num">Monto</th></tr></thead>
           <tbody>${r.atrasados.map((a) => `<tr>
             <td>${etiqMes(a.mes)}</td><td>${esc(a.estudio_nombre)}</td><td>${esc(a.inquilino_nombre || '—')}</td>
             <td class="num"><b>${RD$(a.monto)}</b></td></tr>`).join('')}</tbody></table>`
        : `<div class="vacio">Sin atrasos.</div>`}
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Actividad reciente <button class="btn pequeño secundario" onclick="vista('auditoria')">Ver todo</button></h3>
      ${auditReciente.length
        ? `<div style="display:flex;flex-direction:column;gap:0">
             ${auditReciente.map((a) => `<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--borde-suave)">
               <span style="font-size:16px;line-height:20px">${AUDIT_ICONO[a.accion] || '•'}</span>
               <div style="flex:1;min-width:0">
                 <div style="font-size:13px">${esc(a.detalle || a.accion)}</div>
                 <div class="detalle" style="font-size:11.5px">${esc(a.usuario || '—')} · ${horaLarga(a.fecha)}</div>
               </div>
             </div>`).join('')}
           </div>`
        : `<div class="vacio">Sin actividad registrada todavía.</div>`}
    </div>`;
}

async function verMorosidad() {
  const m = (await window.api.morosidadDetalle({})).data;
  if (!m) return toast('No se pudo cargar la morosidad', 'error');
  window.__reRenderModal = () => verMorosidad();
  const pg = paginar('morosidad', m.filas || []);
  const buckets = [['corriente', m.corrientes], ['mes0', m.mes0], ['mes1', m.mes1], ['mes2', m.mes2], ['mes3plus', m.mes3plus]];
  modal('Morosidad · 30/60/90', `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${buckets.map(([k, v]) => `<span class="badge ${BUCKET_CLS[k]}">${BUCKET_ETIQ[k]}: ${RD$(v, 0)}</span>`).join('')}
    </div>
    <div class="detalle" style="margin-bottom:10px">Cuotas con saldo pendiente: <b>${pg.total}</b> · Total: <b>${RD$(m.total)}</b>
      <span class="detalle" style="color:var(--texto-suave)">El <b>vencimiento</b> se calcula con el día de pago configurado.</span></div>
    ${pg.total
      ? `<div class="tabla-scroll"><table><thead><tr><th>Cuota</th><th>Estudio</th><th>Inquilino</th><th class="num">Saldo</th><th>Días</th><th>Tramo</th><th></th></tr></thead>
         <tbody>${pg.filas.map((f) => `<tr>
           <td>${etiqMes(f.mes)}</td><td>${esc(f.estudio_nombre)}</td><td>${esc(f.inquilino_nombre || '—')}</td>
           <td class="num"><b ${f.bucket === 'mes3plus' || f.bucket === 'mes2' ? 'style="color:var(--rosado)"' : ''}>${RD$(f.saldo)}</b></td>
           <td class="num">${f.dias}</td>
           <td><span class="badge ${BUCKET_CLS[f.bucket]}">${BUCKET_ETIQ[f.bucket] || f.bucket}</span></td>
           <td style="text-align:right">
             ${f.whatsapp ? `<button class="btn pequeño secundario" onclick="enviarWhatsApp(${f.inquilino_id}, 'vencido', ${f.saldo})">WhatsApp</button>` : ''}
             <button class="btn pequeño" onclick="irACobrarMes('${f.mes}')">Cobrar</button>
           </td></tr>`).join('')}</tbody></table></div>
         ${paginadorHTML('morosidad', pg)}`
      : `<div class="vacio">Sin cuotas con saldo pendiente 🎉</div>`}`, `
      <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>
      <button class="btn secundario" onclick="exportarDato('aging','xlsx');cerrarModal()">Excel</button>
      <button class="btn secundario" onclick="exportarDato('aging','csv');cerrarModal()">CSV</button>`, 820);
}

async function irACobrarMes(mes) {
  mesActual = mes;
  cerrarModal();
  vista('cobros');
}

async function recordatoriosWhatsApp() {
  const m = (await window.api.morosidadDetalle({})).data || { filas: [] };
  const deudores = [];
  for (const f of m.filas) {
    if (f.whatsapp && !deudores.some((d) => d.id === f.inquilino_id)) deudores.push({ id: f.inquilino_id, nombre: f.inquilino_nombre, whatsapp: f.whatsapp, saldo: f.saldo });
  }
  window.__reRenderModal = () => recordatoriosWhatsApp();
  const pg = paginar('recordatorios', deudores);
  modal('Recordatorios por WhatsApp', `
    <p class="detalle" style="margin-bottom:10px">Mensajes para enviar a los inquilinos con saldo pendiente. Se abre WhatsApp Web/móvil con el texto listo.</p>
    ${pg.total
      ? `<div class="tabla-scroll"><table><thead><tr><th>Inquilino</th><th class="num">Saldo</th><th></th></tr></thead>
         <tbody>${pg.filas.map((d) => `<tr>
           <td>${esc(d.nombre)}</td><td class="num">${RD$(d.saldo)}</td>
           <td style="text-align:right"><button class="btn pequeño secundario" onclick="enviarWhatsApp(${d.id}, 'vencido', ${d.saldo})">Enviar</button></td></tr>`).join('')}</tbody></table></div>
         ${paginadorHTML('recordatorios', pg)}`
      : `<div class="vacio">Sin deudores con WhatsApp configurado.</div>`}`, `
      <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 560);
}

async function enviarWhatsApp(inquilinoId, tipo, monto) {
  const f = (await window.api.fichaInquilino(inquilinoId)).data;
  const iq = f && f.inquilino;
  if (!iq || !iq.whatsapp) return toast('El inquilino no tiene WhatsApp registrado', 'error');
  const texto = tipo === 'vencido'
    ? `Hola ${iq.nombre || ''}, tu alquiler por RD$${monto || ''} está vencido. Por favor regulariza tu pago lo antes posible para evitar retrasos. Si ya pagaste, ignora este mensaje. ¡Gracias!`
    : `Hola ${iq.nombre || ''}, te saluda HABITIA. Te recordamos que puedes abonar o pagar el alquiler de tu estudio. ¡Gracias!`;
  await window.api.whatsappAbrir('https://wa.me/' + String(iq.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(texto));
}

const edificioDe = (e) => String(e.edificio || '').trim() || 'Sin edificio';
const porEdificio = (e, filtro) => filtro === 'todos' || edificioDe(e) === filtro;

async function viewEstudios() {
  vistaActual = 'estudios';
  titulo('Estudios');
  const rows = (await window.api.estudiosList(window.__busquedaEstudios || '')).data;
  const edif = (window.api.estudiosEdificios ? (await window.api.estudiosEdificios()).data : []) || [];
  const filtro = window.__filtroEdificio || 'todos';
  const visibles = rows.filter((e) => porEdificio(e, filtro));
  const pg = paginar('estudios', visibles);
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formEstudio()">+ Nuevo estudio</button>
      <button class="btn secundario" onclick="importarExcel()">Importar desde Excel</button>
      <button class="btn secundario" onclick="descargarPlantilla()">Ver plantilla</button>
      <button class="btn secundario" onclick="exportarDato('ocupacion','xlsx')">Excel</button>
      <select id="edif-filtro" onchange="window.__filtroEdificio=this.value;__pag.estudios=1;viewEstudios()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="todos">Todos los edificios</option>
        ${edif.map((d) => `<option value="${esc(d.edificio)}" ${filtro === d.edificio ? 'selected' : ''}>${esc(d.edificio)} (${d.estudios} · ${RD$(d.cobrado, 0)} cobrado)</option>`).join('')}
      </select>
      <input class="buscar" placeholder="Buscar estudio o inquilino…" value="${esc(window.__busquedaEstudios || '')}" oninput="cargarEstudios(this.value)">
    </div>
    <div class="card" style="padding:10px 14px;margin-bottom:12px" id="conteo-estudios">
      ${conteoEstudiosHTML(visibles, pg, filtro)}
    </div>
    <div id="tabla-estudios">
      ${filasEstudios(pg.filas)}
      ${paginadorHTML('estudios', pg)}
    </div>`;
}
function conteoEstudiosHTML(visibles, pg, filtro) {
  const totAlq = visibles.reduce((s, e) => s + Number(e.alquiler) + Number(e.gastos_fijos || 0), 0);
  const totOcup = visibles.filter((e) => e.inquilino_id).length;
  return `<b>${pg.total}</b> estudios · <b>${totOcup}</b> ocupados · cuota mensual potencial <b>${RD$(totAlq)}</b>${filtro !== 'todos' ? ` · <b>${esc(filtro)}</b>` : ''}`;
}
async function descargarPlantilla() {
  const r = await window.api.plantillaDescargar();
  if (!r.ok) return toast(r.error, 'error');
  toast('Plantilla guardada. Llena una fila por estudio y luego usa "Importar desde Excel".');
}
async function importarExcel() {
  const r = await window.api.estudiosImport();
  if (!r.ok) return toast(r.error, 'error');
  if (r.data.cancelado) return;
  const d = r.data;
  const notas = d.errores && d.errores.length ? ` · ${d.errores.length} filas con error` : '';
  toast(`Importados: ${d.creados} nuevos, ${d.actualizados} actualizados, ${d.inquilinosCreados} inquilinos creados${notas}`);
  vista('estudios');
}
function filasEstudios(rows) {
  return `
    <div class="tabla-scroll">
    <table>
      <thead><tr><th>Estudio</th><th>Edificio</th><th>Dirección</th><th class="num">Alquiler</th><th class="num">Gastos fijos</th><th>Inquilino</th><th>Estado</th><th class="num">Depósito</th><th></th></tr></thead>
      <tbody>
        ${rows.map((e) => `<tr>
          <td><b>${esc(e.nombre)}</b></td>
          <td>${e.edificio ? `<span class="badge parcial">${esc(e.edificio)}</span>` : '—'}</td>
          <td>${esc(e.direccion || '—')}</td>
          <td class="num">${RD$(e.alquiler)}</td>
          <td class="num">${Number(e.gastos_fijos || 0) > 0 ? RD$(e.gastos_fijos) : '—'}</td>
          <td>${esc(e.inquilino_nombre || '<i style="color:var(--texto-suave)">libre</i>')}</td>
          <td><span class="badge ${ESTADO_EST_CLS[e.estado] || 'pendiente'}">${ESTADO_EST_ETIQ[e.estado] || '—'}</span></td>
          <td class="num">${e.deposito ? RD$(e.deposito) : '—'}</td>
          <td style="text-align:right">
            <button class="btn pequeño secundario" onclick="formEstudio(${e.id})">Editar</button>
            ${e.inquilino_id ? `<button class="btn pequeño secundario" onclick="verFichaInquilino(${e.inquilino_id})">Ficha</button>` : `<button class="btn pequeño secundario" onclick="formInquilinoDeEstudio(${e.id})">Inquilino</button>`}
            <button class="btn pequeño secundario" onclick="verHistorialEstudio(${e.id})">Historial</button>
            <button class="btn pequeño secundario" onclick="verGastosEstudio(${e.id})">Gastos</button>
            <button class="btn pequeño secundario" onclick="contratoEstudio(${e.id})">Contrato</button>
            <button class="btn pequeño peligro" onclick="borrarEstudio(${e.id})">Eliminar</button>
          </td></tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}
async function cargarEstudios(q) {
  window.__busquedaEstudios = q;
  __pag.estudios = 1;
  const rows = (await window.api.estudiosList(q || '')).data;
  const filtro = window.__filtroEdificio || 'todos';
  const visibles = rows.filter((e) => porEdificio(e, filtro));
  const pg = paginar('estudios', visibles);
  $('#tabla-estudios').innerHTML = filasEstudios(pg.filas) + paginadorHTML('estudios', pg);
  const c = $('#conteo-estudios');
  if (c) c.innerHTML = conteoEstudiosHTML(visibles, pg, filtro);
}
function formEstudio(id) {
  (async () => {
    const e = id ? (await window.api.estudiosGet(id)).data : { nombre: '', direccion: '', edificio: '', alquiler: '', deposito: '', gastos_fijos: 0, estado: '', gastos_estudio: [] };
    __gastosPendientes = (e.gastos_estudio || []).map((g) => ({ id: g.id, nombre: g.nombre, monto: g.monto }));
    modal((id ? 'Editar ' : 'Nuevo ') + 'estudio', `
      <form onsubmit="guardarEstudio(event, ${id || 'null'})">
        <div class="campo"><label>Nombre o código *</label><input id="e-nombre" value="${esc(e.nombre)}" placeholder="Ej. Estudio 1, Edif. B – Apt 3" required autofocus></div>
        <div class="campo"><label>Edificio</label><input id="e-edificio" value="${esc(e.edificio || '')}" placeholder="Ej. Edificio A, Res. Los Laureles"></div>
        <div class="campo"><label>Dirección</label><input id="e-direccion" value="${esc(e.direccion)}"></div>
        <div class="form-grid">
          <div class="campo"><label>Alquiler mensual (RD$)</label><input id="e-alquiler" type="number" min="0" step="0.01" value="${e.alquiler || ''}" placeholder="15000"></div>
          <div class="campo"><label>Depósito recibido (RD$)</label><input id="e-deposito" type="number" min="0" step="0.01" value="${e.deposito || ''}" placeholder="15000"></div>
          <div class="campo"><label>Inversión realizada (CAPEX, RD$)</label><input id="e-capex" type="number" min="0" step="0.01" value="${e.costo_inversion || ''}" placeholder="500000"></div>
          <div class="campo"><label>Estado</label>
            <select id="e-estado">
              <option value="" ${!e.estado ? 'selected' : ''}>— automático —</option>
              <option value="ocupado" ${e.estado === 'ocupado' ? 'selected' : ''}>Ocupado</option>
              <option value="disponible" ${e.estado === 'disponible' ? 'selected' : ''}>Disponible</option>
              <option value="mantenimiento" ${e.estado === 'mantenimiento' ? 'selected' : ''}>En mantenimiento</option>
              <option value="fuera" ${e.estado === 'fuera' ? 'selected' : ''}>Fuera de servicio</option>
            </select>
            <span class="detalle">Si lo dejas en automático, se calcula según el inquilino asignado.</span></div>
        </div>
        <div class="campo"><label>Gastos fijos del estudio (agua, luz, internet…)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="e-gastos-total" value="${RD$(Number(e.gastos_fijos || 0))}" readonly style="max-width:180px">
            <button type="button" class="btn pequeño secundario" onclick="editarGastosFijos()">Editar gastos</button>
          </div>
          <span class="detalle">Un mismo estudio puede tener varios gastos. Se suman a la cuota cada mes.</span></div>
        ${id ? `<div class="campo"><label>Foto del estudio</label>
          <div id="e-foto"></div>
          <div class="btn-row" style="margin:8px 0 0">
            <button type="button" class="btn pequeño secundario" onclick="cambiarFotoEstudio(${id})">Subir foto</button>
            <button type="button" class="btn pequeño secundario" onclick="quitarFotoEstudio(${id})">Quitar foto</button>
          </div></div>` : ''}
        <button class="btn" type="submit">Guardar</button>
      </form>`, '', 640);
    if (id) cargarFotoEstudio(id);
  })();
}
async function cargarFotoEstudio(id) {
  const box = $('#e-foto');
  if (!box) return;
  const r = await window.api.estudioFotoData(id);
  box.innerHTML = r.data
    ? `<img src="${r.data}" style="max-height:150px;border-radius:8px;border:1px solid var(--borde)" alt="foto">`
    : `<div class="detalle" style="color:var(--texto-suave)">Sin foto todavía. Puedes subir una imagen del estudio.</div>`;
}
async function cambiarFotoEstudio(id) {
  const r = await window.api.estudioFoto(id);
  if (!r.ok) return toast(r.error, 'error');
  if (r.data && r.data.cancelado) return;
  toast('Foto actualizada');
  cargarFotoEstudio(id);
}
async function quitarFotoEstudio(id) {
  if (!confirm('¿Quitar la foto de este estudio?')) return;
  await window.api.estudioFotoBorrar(id);
  toast('Foto eliminada');
  cargarFotoEstudio(id);
}
async function verHistorialEstudio(id) {
  const e = (await window.api.estudiosGet(id)).data;
  const h = (await window.api.estudioHistorial(id)).data || [];
  modal('Historial de ' + (e.nombre || 'estudio'), `
    ${h.length
      ? `<table>
          <thead><tr><th>Desde</th><th>Hasta</th><th>Inquilino</th></tr></thead>
          <tbody>${h.map((o) => `<tr>
            <td>${esc(o.desde || '—')}</td>
            <td>${esc(o.hasta || '<span style="color:var(--verde)">actual</span>')}</td>
            <td>${esc(o.inquilino_nombre || '<i style="color:var(--texto-suave)">libre</i>')}</td></tr>`).join('')}
          </tbody>
        </table>`
      : `<div class="vacio">Sin registros de ocupación.</div>`}`, `
      <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 560);
}
async function verGastosEstudio(id) {
  const e = (await window.api.estudiosGet(id)).data;
  const g = (await window.api.gastosList({ estudio_id: id })).data || [];
  const filas = g.filter((x) => !x.anulado);
  const total = filas.reduce((s, x) => s + Number(x.monto), 0);
  const fijos = e.gastos_estudio || [];
  modal('Gastos de ' + (e.nombre || 'estudio'), `
    <div class="detalle" style="margin:0 0 6px"><b>Gastos fijos del estudio</b> (se suman a la cuota cada mes): <b>${RD$(Number(e.gastos_fijos || 0))}</b>/mes</div>
    ${fijos.length
      ? `<table style="margin-bottom:16px">
          <thead><tr><th>Gasto</th><th class="num">Monto</th></tr></thead>
          <tbody>${fijos.map((x) => `<tr><td>${esc(x.nombre || '—')}</td><td class="num">${RD$(x.monto)}</td></tr>`).join('')}</tbody>
        </table>
        <div class="btn-row" style="margin:-8px 0 12px"><button class="btn pequeño secundario" onclick="cerrarModal();formEstudio(${id})">Editar gastos fijos</button></div>`
      : `<div class="vacio" style="margin-bottom:12px">Sin gastos fijos. Pulsa "Editar estudio" para agregarlos.</div>`}
    <div class="detalle" style="margin-bottom:6px">Registrados en la pestaña Gastos este año: <b>${RD$(total)}</b></div>
    ${filas.length
      ? `<table>
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Detalle</th><th class="num">Monto</th></tr></thead>
          <tbody>${filas.map((x) => `<tr>
            <td>${esc(x.fecha || '—')}</td>
            <td>${esc(x.categoria || '—')}</td>
            <td>${esc(x.detalle || '—')}</td>
            <td class="num">${RD$(x.monto)}</td></tr>`).join('')}</tbody>
        </table>`
      : `<div class="vacio">Este estudio no tiene gastos registrados. Los gastos se cargan en la pestaña "Gastos".</div>`}`, `
      <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 640);
}
async function contratoEstudio(id) {
  const e = (await window.api.estudiosGet(id)).data;
  const iq = e.inquilino_id ? (await window.api.inquilinosGet(e.inquilino_id)).data : null;
  const nombreArchivo = 'contrato-' + String(e.nombre || 'estudio').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf';
  const r = await window.api.pdfExport('contrato', {
    estudio: { nombre: e.nombre, direccion: e.direccion, alquiler: e.alquiler, deposito: e.deposito },
    inquilino: iq ? { nombre: iq.nombre, telefono: iq.telefono, whatsapp: iq.whatsapp, email: iq.email } : {},
    filename: nombreArchivo
  });
  if (r.ok) toast('Contrato PDF generado');
  else toast(r.error || 'No se pudo generar el contrato', 'error');
}
async function guardarEstudio(e, id) {
  e.preventDefault();
  const r = await window.api.estudiosSave({
    id, nombre: $('#e-nombre').value.trim(), direccion: $('#e-direccion').value,
    edificio: $('#e-edificio').value.trim(),
    gastos_fijos: __gastosPendientes.reduce((s, g) => s + Number(g.monto || 0), 0),
    alquiler: Number($('#e-alquiler').value) || 0, deposito: Number($('#e-deposito').value) || 0,
    costo_inversion: Number($('#e-capex').value) || 0, estado: $('#e-estado').value
  });
  if (!r.ok) return toast(r.error, 'error');
  const idFinal = Number(id || (r.data !== undefined && r.data !== null ? r.data : 0)) || 0;
  if (idFinal) await window.api.estudioGastosSave(idFinal, __gastosPendientes);
  cerrarModal(); toast('Estudio guardado'); vista('estudios');
}

// ---------- Editor de gastos fijos (varios gastos por estudio) ----------
let __gastosPendientes = [];
function editarGastosFijos() {
  const nombre = $('#e-nombre') ? $('#e-nombre').value.trim() : '';
  modal('Gastos fijos de ' + (nombre || 'estudio'), `
    <div class="detalle" style="margin-bottom:10px">Estos gastos se suman cada mes a la cuota que paga el inquilino. Un solo estudio puede tener varios (agua, luz, internet…).</div>
    <div id="gastos-editor"></div>
    <div class="btn-row" style="border-top:1px solid var(--borde);padding-top:12px">
      <button type="button" class="btn pequeño secundario" onclick="agregarFilaGasto()">+ Agregar gasto</button>
      <span style="flex:1"></span>
      <button class="btn" onclick="guardarGastosEditor()">Guardar gastos</button>
    </div>`, '', 540);
  renderGastosEditor();
}
function renderGastosEditor() {
  const box = $('#gastos-editor');
  if (!box) return;
  box.innerHTML = __gastosPendientes.length
    ? `<table>
        <thead><tr><th>Gasto</th><th class="num">Monto (RD$)</th><th></th></tr></thead>
        <tbody>${__gastosPendientes.map((g, i) => `<tr>
          <td><input id="ge-nombre-${i}" value="${esc(g.nombre || '')}" placeholder="Ej. Agua" style="width:100%"></td>
          <td class="num"><input id="ge-monto-${i}" type="number" min="0" step="0.01" value="${g.monto || ''}" placeholder="0" style="width:110px;text-align:right"></td>
          <td><button type="button" class="btn pequeño" style="background:transparent;color:var(--rosado);border:none" onclick="quitarFilaGasto(${i})" title="Quitar gasto">✕</button></td>
        </tr>`).join('')}</tbody>
      </table>`
    : `<div class="vacio">Sin gastos todavía. Pulsa "Agregar gasto" para poner el primero.</div>`;
}
function agregarFilaGasto() { __gastosPendientes.push({ nombre: '', monto: 0 }); renderGastosEditor(); }
function quitarFilaGasto(i) { __gastosPendientes.splice(i, 1); renderGastosEditor(); }
function guardarGastosEditor() {
  const lista = [];
  __gastosPendientes.forEach((_, i) => {
    const g = $('#ge-nombre-' + i);
    const m = $('#ge-monto-' + i);
    if (!g && !m) return;
    const nombre = g ? g.value.trim() : '';
    const monto = Number(m ? m.value : 0) || 0;
    if (nombre || monto > 0) lista.push({ id: __gastosPendientes[i].id, nombre, monto });
  });
  __gastosPendientes = lista;
  const t = $('#e-gastos-total');
  if (t) t.value = RD$(lista.reduce((s, g) => s + Number(g.monto || 0), 0));
  cerrarModal();
  toast('Gastos del estudio actualizados');
}
async function borrarEstudio(id) {
  if (!confirm('¿Eliminar este estudio? Se quita de la lista (no se borran sus cobros y gastos).')) return;
  await window.api.estudiosDelete(id);
  toast('Estudio eliminado'); vista('estudios');
}

function formInquilinoDeEstudio(estudioId) {
  (async () => {
    const e = (await window.api.estudiosGet(estudioId)).data;
    modal('Inquilino de ' + e.nombre, `
      <form onsubmit="guardarInquilino(event, null, ${estudioId})">
        <div class="campo"><label>Nombre *</label><input id="i-nombre" required autofocus></div>
        <div class="form-grid">
          <div class="campo"><label>Teléfono</label><input id="i-telefono"></div>
          <div class="campo"><label>Email</label><input id="i-email" type="email"></div>
        </div>
        <div class="form-grid">
          <div class="campo"><label>WhatsApp (cód. país+número)</label><input id="i-whatsapp" placeholder="18095550101"></div>
        </div>
        <div class="campo"><label>Notas</label><textarea id="i-notas" rows="2"></textarea></div>
        <input type="hidden" id="i-estudio" value="${estudioId}">
        <button class="btn" type="submit">Guardar</button>
      </form>`, '', 520);
  })();
}

async function viewInquilinos() {
  vistaActual = 'inquilinos';
  titulo('Inquilinos');
  const rows = (await window.api.inquilinosList(window.__busquedaInquilinos || '')).data;
  const pg = paginar('inquilinos', rows);
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formInquilino()">+ Nuevo inquilino</button>
      <input class="buscar" placeholder="Buscar…" value="${esc(window.__busquedaInquilinos || '')}" oninput="cargarInquilinos(this.value)">
    </div>
    <div id="tabla-inquilinos">
      ${filasInquilinos(pg.filas)}
      ${paginadorHTML('inquilinos', pg)}
    </div>`;
}
function filasInquilinos(rows) {
  return `
    <div class="tabla-scroll">
    <table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>WhatsApp</th><th>Estudio</th><th></th></tr></thead>
      <tbody>
        ${rows.map((i) => `<tr>
          <td><b>${esc(i.nombre)}</b></td>
          <td>${esc(i.telefono || '—')}</td>
          <td>${esc(i.whatsapp || '—')}</td>
          <td>${esc(i.estudio_nombre || '—')}</td>
          <td style="text-align:right">
            <button class="btn pequeño secundario" onclick="verFichaInquilino(${i.id})">Ficha completa</button>
            <button class="btn pequeño secundario" onclick="verEstadoCuenta(${i.id})">Estado cuenta</button>
            ${i.whatsapp ? `<button class="btn pequeño secundario" onclick="enviarWhatsApp(${i.id}, 'recordatorio', 0)">📱</button>` : ''}
            <button class="btn pequeño secundario" onclick="formInquilino(${i.id})">Editar</button>
            <button class="btn pequeño peligro" onclick="borrarInquilino(${i.id})">Eliminar</button>
          </td></tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}
async function cargarInquilinos(q) {
  window.__busquedaInquilinos = q;
  __pag.inquilinos = 1;
  const rows = (await window.api.inquilinosList(q || '')).data;
  const pg = paginar('inquilinos', rows);
  $('#tabla-inquilinos').innerHTML = filasInquilinos(pg.filas) + paginadorHTML('inquilinos', pg);
}
function formInquilino(id, estudioId) {
  (async () => {
    const i = id ? (await window.api.inquilinosGet(id)).data
      : { nombre: '', telefono: '', whatsapp: '', email: '', notas: '', estudio_id: estudioId || '' };
    const estudios = (await window.api.estudiosList('')).data;
    modal((id ? 'Editar ' : 'Nuevo ') + 'inquilino', `
      <form onsubmit="guardarInquilino(event, ${id || 'null'}, ${JSON.stringify(estudioId || null)})">
        <div class="campo"><label>Nombre *</label><input id="i-nombre" value="${esc(i.nombre)}" required autofocus></div>
        <div class="form-grid">
          <div class="campo"><label>Teléfono</label><input id="i-telefono" value="${esc(i.telefono)}"></div>
          <div class="campo"><label>WhatsApp (cód. país+número)</label><input id="i-whatsapp" value="${esc(i.whatsapp)}" placeholder="18095550101"></div>
        </div>
        <div class="form-grid">
          <div class="campo"><label>Email</label><input id="i-email" type="email" value="${esc(i.email || '')}"></div>
        </div>
        <div class="campo"><label>Estudio que ocupa</label>
          <select id="i-estudio">
            <option value="">— ninguno —</option>
            ${estudios.map((e) => `<option value="${e.id}" ${String(e.id) === String(i.estudio_id || estudioId || '') ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
          </select></div>
        <div class="campo"><label>Notas</label><textarea id="i-notas" rows="2">${esc(i.notas)}</textarea></div>
        <button class="btn" type="submit">Guardar</button>
      </form>`, '', 540);
  })();
}
async function guardarInquilino(e, id, estudioIdFijo) {
  e.preventDefault();
  const estudioId = estudioIdFijo != null && estudioIdFijo !== false ? estudioIdFijo : Number($('#i-estudio').value) || null;
  const r = await window.api.inquilinosSave({
    id, nombre: $('#i-nombre').value.trim(), telefono: $('#i-telefono').value, whatsapp: $('#i-whatsapp').value,
    email: $('#i-email').value.trim(), notas: $('#i-notas').value, estudio_id: estudioId
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Inquilino guardado'); vista('inquilinos');
}
async function borrarInquilino(id) {
  if (!confirm('¿Eliminar este inquilino? Queda sin estudio asignado.')) return;
  await window.api.inquilinosDelete(id);
  toast('Inquilino eliminado'); vista('inquilinos');
}

// ============================================================
//                    CONTRATOS
// ============================================================

async function viewContratos() {
  vistaActual = 'contratos';
  titulo('Contratos');
  const rows = (await window.api.contratosList({})).data || [];
  const estudios = (await window.api.estudiosList('')).data || [];
  const porVencer = (await window.api.contratosPorVencer(30)).data || [];
  const pg = paginar('contratos', rows);
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formContrato()">+ Nuevo contrato</button>
      <button class="btn secundario" onclick="exportarDato('contratos','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('contratos','csv')">CSV</button>
      <span style="flex:1"></span>
      ${porVencer.length ? `<span class="badge vencida" style="align-self:center">${porVencer.length} por vencer (30 días)</span>` : ''}
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="detalle">
        <b>Activos:</b> <span style="color:var(--verde)">${rows.filter((c) => c.estado === 'activo').length}</span> ·
        <b>Terminados:</b> ${rows.filter((c) => c.estado === 'terminado').length} ·
        <span class="detalle" style="color:var(--texto-suave)">Al renovar se aplica la nueva renta al estudio y se guarda el historial.</span>
      </div>
    </div>
    <div class="card">
      <div class="tabla-scroll">
      <table>
        <thead><tr><th>#</th><th>Estudio</th><th>Inquilino</th><th>Inicio</th><th>Vence</th><th class="num">Renta</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${pg.filas.map((c) => `<tr>
            <td><b>${c.id}</b></td>
            <td>${esc(c.estudio_nombre || '—')}</td>
            <td>${esc(c.inquilino_nombre || '—')}</td>
            <td>${esc(c.fecha_inicio || '—')}</td>
            <td>${esc(c.fecha_vencimiento || '—')}
              ${c.estado === 'activo' && c.dias_restantes !== null && c.dias_restantes <= 30 ? `<span class="badge vencida">${c.dias_restantes} días</span>` : ''}</td>
            <td class="num">${RD$(c.renta)}</td>
            <td><span class="badge ${c.estado === 'activo' ? 'pagada' : c.estado === 'terminado' ? 'pendiente' : 'parcial'}">${c.estado || '—'}</span></td>
            <td style="text-align:right">
              ${c.estado === 'activo' ? `<button class="btn pequeño secundario" onclick="renovarContrato(${c.id})">Renovar</button> <button class="btn pequeño secundario" onclick="terminarContrato(${c.id})">Terminar</button>` : ''}
              <button class="btn pequeño secundario" onclick="formContrato(${c.id})">${c.estado === 'activo' ? 'Editar' : 'Ver'}</button>
              ${c.estado === 'activo' ? `<button class="btn pequeño secundario" onclick="pdfContrato(${c.id})">PDF</button>` : ''}
              <button class="btn pequeño peligro" onclick="eliminarContratoUI(${c.id})">Eliminar</button>
            </td></tr>`).join('')}
        </tbody>
      </table>
      </div>
      ${paginadorHTML('contratos', pg)}
      ${rows.length ? '' : `<div class="vacio">Sin contratos. Crea el primero con "+ Nuevo contrato".</div>`}
    </div>`;
}

function formContrato(id) {
  (async () => {
    const c = id ? (await window.api.contratosGet(id)).data
      : { fecha_inicio: hoyISO(), fecha_vencimiento: '', renta: '', deposito: '', duracion_meses: 12, dia_pago: '', incremento_pct: 0 };
    const estudios = (await window.api.estudiosList('')).data || [];
    const inquilinos = (await window.api.inquilinosList('')).data || [];
    modal((id ? 'Editar contrato #' : 'Nuevo contrato') + (id ? id : ''), `
      <form onsubmit="guardarContrato(event, ${id || 'null'})">
        <div class="form-grid">
          <div class="campo"><label>Estudio *</label>
            <select id="c-estudio">
              <option value="">— seleccionar —</option>
              ${estudios.map((e) => `<option value="${e.id}" ${String(e.id) === String(c.estudio_id) ? 'selected' : ''}>${esc(e.nombre)}${e.inquilino_nombre ? ' (' + esc(e.inquilino_nombre) + ')' : ''}</option>`).join('')}
            </select></div>
          <div class="campo"><label>Inquilino *</label>
            <select id="c-inquilino" onchange="toggleNuevoInquilino()">
              <option value="">— elegir existente —</option>
              <option value="nuevo" ${!c.inquilino_id ? 'selected' : ''}>+ Crear inquilino nuevo…</option>
              ${inquilinos.map((i) => `<option value="${i.id}" ${String(i.id) === String(c.inquilino_id) ? 'selected' : ''}>${esc(i.nombre)}${i.estudio_nombre ? ' (' + esc(i.estudio_nombre) + ')' : ''}</option>`).join('')}
            </select></div>
          <div id="c-nuevo-inq" style="display:none">
            <div class="form-grid" style="margin-top:4px">
              <div class="campo"><label>Nombre del nuevo inquilino *</label><input id="c-nq-nombre" placeholder="Nombre completo"></div>
              <div class="campo"><label>Teléfono</label><input id="c-nq-tel" placeholder="809-000-0000"></div>
              <div class="campo"><label>WhatsApp</label><input id="c-nq-wa" placeholder="18090000000"></div>
            </div>
          </div>
          <div class="campo"><label>Fecha de inicio</label><input id="c-inicio" type="date" value="${esc(c.fecha_inicio)}"></div>
          <div class="campo"><label>Fecha de vencimiento</label><input id="c-venc" type="date" value="${esc(c.fecha_vencimiento)}"></div>
          <div class="campo"><label>Duración (meses)</label><input id="c-meses" type="number" min="1" value="${c.duracion_meses || 12}"></div>
          <div class="campo"><label>Renta mensual (RD$) *</label><input id="c-renta" type="number" min="0" step="0.01" value="${c.renta || ''}" required></div>
          <div class="campo"><label>Depósito (RD$)</label><input id="c-deposito" type="number" min="0" step="0.01" value="${c.deposito || ''}"></div>
          <div class="campo"><label>Día de pago</label><input id="c-dia" type="number" min="1" max="28" value="${c.dia_pago || ''}" placeholder="5"></div>
          <div class="campo"><label>Incremento anual (%)</label><input id="c-inc" type="number" min="0" step="0.01" value="${c.incremento_pct || 0}"></div>
        </div>
        <div class="form-grid">
          <div class="campo"><label>Aval (nombre)</label><input id="c-aval" value="${esc(c.aval_nombre || '')}"></div>
          <div class="campo"><label>Aval (teléfono)</label><input id="c-aval-tel" value="${esc(c.aval_telefono || '')}"></div>
        </div>
        <div class="campo"><label>Notas</label><textarea id="c-notas" rows="2">${esc(c.notas || '')}</textarea></div>
        <div class="detalle" style="margin:6px 0 12px;color:var(--texto-suave)">Al guardar: el inquilino queda asignado a este estudio (estado "ocupado"), la renta/depósito se aplican, el día de pago se vuelve el predeterminado y la cuota del mes se actualiza con los nuevos datos.</div>
        <button class="btn" type="submit">Guardar contrato</button>
      </form>`, '', 700);
    toggleNuevoInquilino();
  })();
}

function toggleNuevoInquilino() {
  const nuevo = $('#c-inquilino') && $('#c-inquilino').value === 'nuevo';
  const box = $('#c-nuevo-inq');
  if (box) box.style.display = nuevo ? 'block' : 'none';
}

async function guardarContrato(e, id) {
  e.preventDefault();
  const selInq = $('#c-inquilino').value;
  let payload = {
    id,
    estudio_id: Number($('#c-estudio').value) || null,
    inquilino_id: selInq && selInq !== 'nuevo' ? Number(selInq) : null,
    fecha_inicio: $('#c-inicio').value,
    fecha_vencimiento: $('#c-venc').value,
    duracion_meses: $('#c-meses').value,
    renta: Number($('#c-renta').value) || 0,
    deposito: Number($('#c-deposito').value) || 0,
    dia_pago: $('#c-dia').value,
    incremento_pct: Number($('#c-inc').value) || 0,
    aval_nombre: $('#c-aval').value.trim(),
    aval_telefono: $('#c-aval-tel').value.trim(),
    notas: $('#c-notas').value
  };
  if (selInq === 'nuevo') {
    const nombre = $('#c-nq-nombre').value.trim();
    if (!nombre) return toast('Escribe el nombre del nuevo inquilino', 'error');
    payload.nuevo_inquilino = {
      nombre,
      telefono: $('#c-nq-tel').value.trim(),
      whatsapp: $('#c-nq-wa').value.trim()
    };
  }
  const r = await window.api.contratosSave(payload);
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Contrato guardado'); vista('contratos');
}

function renovarContrato(id) {
  (async () => {
    const c = (await window.api.contratosGet(id)).data;
    if (!c) return toast('Contrato no encontrado', 'error');
    const pct = Number(c.incremento_pct) || 0;
    const sugerida = Math.round(Number(c.renta) * (1 + pct / 100) * 100) / 100;
    const duracion = Math.max(1, Number(c.duracion_meses) || 12);
    modal('Renovar contrato #' + id, `
      <form onsubmit="guardarRenovacion(event, ${id})">
        <p class="detalle" style="margin-bottom:10px">
          Se creará un contrato nuevo a partir del actual (renta <b>${RD$(c.renta)}</b>, ${duracion} meses).
          El contrato actual queda terminado y se guarda el historial.
          ${pct ? `El contrato tiene un incremento de <b>${pct}%</b>: renta sugerida <b>${RD$(sugerida)}</b>.` : ''}
        </p>
        <div class="form-grid">
          <div class="campo"><label>Inicia</label><input type="date" value="${hoyISO()}" disabled></div>
          <div class="campo"><label>Vence (nueva)</label><input id="c-nueva-venc" type="date" value="${c.fecha_vencimiento || sumarMeses(hoyISO(), duracion)}" required></div>
        </div>
        <div class="form-grid">
          <div class="campo"><label>Nueva renta (RD$)</label><input id="c-nueva-renta" type="number" min="0" step="0.01" value="${sugerida || c.renta || ''}"></div>
          <div class="campo"><label>Término (meses)</label><input id="c-nueva-meses" type="number" min="1" max="120" value="${duracion}" onchange="document.getElementById('c-nueva-venc').value = sumarMeses(hoyISO(), this.value || 12)"></div>
        </div>
        <button class="btn" type="submit">Renovar contrato (1 clic)</button>
      </form>`, '', 560);
  })();
}
async function guardarRenovacion(e, id) {
  e.preventDefault();
  const fv = $('#c-nueva-venc').value;
  if (!fv) return toast('Indica la fecha de vencimiento de la renovación', 'error');
  const r = await window.api.contratosRenovar(id, fv, Number($('#c-nueva-renta').value) || 0, Number($('#c-nueva-meses').value) || 12);
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Contrato renovado → #' + r.data.id);
  vista('contratos');
}
async function terminarContrato(id) {
  if (!confirm('¿Terminar el contrato #' + id + '?')) return;
  const r = await window.api.contratosTerminar(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Contrato terminado'); vista('contratos');
}
async function eliminarContratoUI(id) {
  if (!confirm('¿Eliminar definitivamente el contrato #' + id + '?\n\nSe quitará del historial de contratos. Esta acción no se puede deshacer.')) return;
  if (!confirm('Esta operación es irreversible. ¿Continuar de todos modos?')) return;
  const r = await window.api.contratosDelete(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Contrato eliminado'); vista('contratos');
}
async function pdfContrato(id) {
  const c = (await window.api.contratosGet(id)).data;
  if (!c) return toast('Contrato no encontrado', 'error');
  const r = await window.api.pdfExport('contrato', {
    contrato: c,
    estudio: { nombre: c.estudio_nombre, direccion: c.estudio_direccion || '', alquiler: c.renta, deposito: c.deposito },
    inquilino: { nombre: c.inquilino_nombre, telefono: c.inquilino_telefono || '', whatsapp: '', email: '' },
    filename: 'contrato-' + c.id + '.pdf'
  });
  if (r.ok) toast('Contrato PDF generado');
  else toast(r.error || 'No se pudo generar el contrato', 'error');
}

async function verEstadoCuenta(id) {
  const r = await window.api.estadoCuentaGet(id);
  if (!r.ok) return toast(r.error, 'error');
  const e = r.data;
  const i = e.inquilino || {};
  window.__reRenderModal = () => verEstadoCuenta(id);
  const pg = paginar('estado-cuenta', e.movimientos || []);
  modal('Estado de cuenta · ' + i.nombre, `
    <div class="detalle" style="margin-bottom:10px">
      <b>Pagado:</b> <span style="color:var(--verde)">${RD$(e.pagado)}</span> ·
      <b>Pendiente:</b> <span style="color:${e.debido > 0 ? 'var(--rosado)' : 'var(--verde)'}">${RD$(e.debido)}</span>
    </div>
    ${pg.total
      ? `<div class="tabla-scroll"><table><thead><tr><th>Mes</th><th>Estudio</th><th class="num">Alquiler</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Estado</th></tr></thead>
         <tbody>${pg.filas.map((f) => `<tr>
           <td>${etiqMes(f.mes)}</td><td>${esc(f.estudio_nombre || '—')}</td>
           <td class="num">${RD$(f.monto)}</td><td class="num">${RD$(f.abonado)}</td>
           <td class="num"><b>${f.pendiente > 0 ? RD$(f.pendiente) : '—'}</b></td>
           <td><span class="badge ${f.estado === 'pagado' ? 'pagada' : f.estado === 'parcial' ? 'parcial' : 'pendiente'}">${f.estado === 'pagado' ? 'Pagado' : f.estado === 'parcial' ? 'Parcial' : 'Pendiente'}</span></td>
         </tr>`).join('')}</tbody></table></div>
         ${paginadorHTML('estado-cuenta', pg)}`
      : `<div class="vacio">Sin alquileres registrados.</div>`}`, `
      <button class="btn" onclick="exportEstadoCuenta(${i.id})">Exportar PDF</button>
      <button class="btn pequeño secundario" onclick="cerrarModal()">Cerrar</button>`, 760);
}
async function exportEstadoCuenta(id) {
  const r = await window.api.estadoCuentaPdf(id);
  if (r.ok) toast('PDF exportado');
  else if (r.error !== 'cancelado') toast(r.error || 'No se pudo exportar el PDF', 'error');
}

async function verFichaInquilino(id) {
  __fichaId = id;
  window.__reRenderModal = () => verFichaInquilino(id);
  const r = await window.api.fichaInquilino(id);
  if (!r.ok) return toast(r.error, 'error');
  const f = r.data;
  __fichaDebido = Number(f.debido) || 0;
  const i = f.inquilino || {};
  const mov = f.movimientos || [];
  const rec = f.recibos || [];
  const pgRec = paginar('ficha-recibos', rec);
  const con = f.contratos || [];
  const man = f.mantenimientos || [];
  const notas = f.notas || [];
  modal('Ficha de ' + i.nombre, `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <span class="badge pagada">${RD$(f.pagado)} pagado</span>
      <span class="badge ${f.debido > 0 ? 'vencida' : 'pagada'}">${RD$(f.debido)} pendiente</span>
      <span class="badge ${f.balance >= 0 ? 'parcial' : 'pendiente'}">saldo ${RD$(f.balance)}</span>
      ${i.estudio_nombre ? `<span class="badge pagada">🏠 ${esc(i.estudio_nombre)}</span>` : ''}
      ${i.whatsapp ? `<span class="badge parcial">📱 ${esc(i.whatsapp)}</span>` : ''}
      ${i.telefono ? `<span class="badge parcial">☎ ${esc(i.telefono)}</span>` : ''}
      ${i.email ? `<span class="badge parcial">✉ ${esc(i.email)}</span>` : ''}
    </div>
    <h4 style="margin:10px 0 6px">Resumen financiero</h4>
    ${mov.length
      ? `<div class="tabla-scroll"><table><thead><tr><th>Mes</th><th>Estudio</th><th class="num">Alquiler</th><th class="num">Pagado</th><th class="num">Pendiente</th><th>Estado</th></tr></thead>
         <tbody>${mov.slice(0, 24).map((m) => `<tr>
           <td>${etiqMes(m.mes)}</td><td>${esc(m.estudio_nombre || '—')}</td>
           <td class="num">${RD$(m.monto)}</td><td class="num">${RD$(m.abonado)}</td>
           <td class="num"><b ${m.pendiente > 0 ? 'style="color:var(--rosado)"' : ''}>${m.pendiente > 0 ? RD$(m.pendiente) : '—'}</b></td>
           <td><span class="badge ${m.estado === 'pagado' ? 'pagada' : m.estado === 'parcial' ? 'parcial' : m.pendiente > 0 ? 'vencida' : 'pendiente'}">${m.estado === 'pagado' ? 'Pagado' : m.estado === 'parcial' ? 'Parcial' : m.pendiente > 0 ? 'Con saldo' : 'Pendiente'}</span></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio" style="max-width:none">Sin movimientos.</div>`}
    ${f.debido > 0 ? `<div class="btn-row" style="margin-top:8px"><button class="btn pequeño" onclick="whatsappDeuda()">Recordatorio WhatsApp</button></div>` : ''}
    <h4 style="margin:14px 0 6px">Recibos emitidos (${rec.length})</h4>
    ${rec.length
      ? `<div class="tabla-scroll"><table><thead><tr><th>Número</th><th>Fecha</th><th class="num">Monto</th><th>Cuota</th><th>Método</th></tr></thead>
         <tbody>${pgRec.filas.map((m) => `<tr>
           <td><b>${esc(m.numero)}</b></td><td>${esc(m.fecha)}</td><td class="num">${RD$(m.monto)}</td>
           <td>${etiqMes(m.mes_cuota)}</td><td>${m.metodo ? esc(METODO_ETIQ[m.metodo] || m.metodo) : '—'}</td></tr>`).join('')}</tbody></table></div>
         ${paginadorHTML('ficha-recibos', pgRec)}`
      : `<div class="vacio" style="max-width:none">Sin recibos todavía.</div>`}
    <h4 style="margin:14px 0 6px">Contratos (${con.length})</h4>
    ${con.length
      ? `<table><thead><tr><th>#</th><th>Estudio</th><th>Inicio</th><th>Vence</th><th class="num">Renta</th><th>Estado</th><th></th></tr></thead>
         <tbody>${con.map((c) => `<tr>
           <td><b>${c.id}</b></td><td>${esc(c.estudio_nombre || '—')}</td>
           <td>${esc(c.fecha_inicio || '—')}</td><td>${esc(c.fecha_vencimiento || '—')}</td>
           <td class="num">${RD$(c.renta)}</td>
           <td><span class="badge ${c.estado === 'activo' ? 'pagada' : c.estado === 'terminado' ? 'pendiente' : 'parcial'}">${c.estado || '—'}</span></td>
           <td style="text-align:right">${c.estado === 'activo' && c.dias_restantes !== null && c.dias_restantes <= 30 ? `<span class="detalle" style="color:var(--rosado);font-size:11px">vence en ${c.dias_restantes} días</span>` : ''}</td></tr>`).join('')}</tbody></table>`
      : `<div class="vacio" style="max-width:none">Sin contratos.</div>`}
    <h4 style="margin:14px 0 6px">Mantenimiento (${man.length})</h4>
    ${man.length
      ? `<table><thead><tr><th>#</th><th>Estudio</th><th>Detalle</th><th>Estado</th><th class="num">Costo</th></tr></thead>
         <tbody>${man.map((m) => `<tr>
           <td><b>${m.id}</b></td><td>${esc(m.estudio_nombre || '—')}</td><td>${esc(m.detalle || '—')}</td>
           <td><span class="badge ${m.estado === 'abierta' ? 'vencida' : 'pagada'}">${m.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</span></td>
           <td class="num">${Number(m.costo) > 0 ? RD$(m.costo) : '—'}</td></tr>`).join('')}</tbody></table>`
      : `<div class="vacio" style="max-width:none">Sin órdenes de mantenimiento.</div>`}
    <h4 style="margin:14px 0 6px">Notas</h4>
    <div id="ficha-notas">
      ${notas.length
        ? notas.map((n) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--borde)">
             <span>${esc(n.texto)} <span class="detalle" style="font-size:11px">— ${esc(n.usuario || '')} · ${esc(n.fecha)}</span></span>
             <button class="btn pequeño peligro" onclick="borrarNota(${n.id})">✕</button></div>`).join('')
        : `<div class="vacio" style="max-width:none">Sin notas.</div>`}
    </div>
    <div class="btn-row" style="margin-top:8px">
      <input id="ficha-nota-texto" class="buscar" placeholder="Añadir nota…" style="flex:1">
      <button class="btn pequeño" onclick="agregarNotaFicha(${id})">Añadir</button>
      <button class="btn pequeño secundario" onclick="exportEstadoCuenta(${id})">PDF estado de cuenta</button>
    </div>`, `
      <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 900);
}

async function agregarNotaFicha(id) {
  const texto = $('#ficha-nota-texto').value.trim();
  if (!texto) return toast('Escribe una nota', 'error');
  const r = await window.api.notasAdd('inquilino', id, texto);
  if (!r.ok) return toast(r.error, 'error');
  toast('Nota añadida');
  verFichaInquilino(id);
}
async function borrarNota(id) {
  if (!confirm('¿Eliminar esta nota?')) return;
  await window.api.notasDelete(id);
  toast('Nota eliminada');
  if (__fichaId) verFichaInquilino(__fichaId);
}
async function whatsappDeuda() {
  cerrarModal();
  if (__fichaId) await enviarWhatsApp(__fichaId, 'vencido', __fichaDebido);
}

let filtroCobros = 'todos';
async function viewCobros() {
  vistaActual = 'cobros';
  titulo('Cobros del mes');
  const rows = (await window.api.cobrosMes(mesActual)).data;
  const cobrado = rows.filter((r) => r.pagado).reduce((s, r) => s + Number(r.monto), 0);
  const pendiente = rows.filter((r) => !r.pagado).reduce((s, r) => s + Number(r.saldo || 0), 0);
  const vencido = rows.filter((r) => r.vencido).reduce((s, r) => s + Number(r.saldo || 0), 0);
  const porMoneda = {};
  rows.forEach((r) => { const md = monedaOkUI(r.moneda); porMoneda[md] = round2sum(porMoneda[md], Number(r.monto)); });
  const ver = (r) => {
    if (filtroCobros === 'vencidos') return r.vencido;
    if (filtroCobros === 'pendientes') return !r.pagado && !r.vencido && Number(r.abonado) === 0;
    if (filtroCobros === 'parciales') return !r.pagado && Number(r.abonado) > 0;
    if (filtroCobros === 'cobrados') return r.pagado;
    return true;
  };
  const visibles = rows.filter(ver);
  const pg = paginar('cobros', visibles);

  $('#content').innerHTML = `
    <div class="btn-row">
      ${selectorMes()}
      <span style="flex:1"></span>
      <select id="cobros-filtro" onchange="filtroCobros=this.value;__pag.cobros=1;viewCobros()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="todos" ${filtroCobros === 'todos' ? 'selected' : ''}>Todos</option>
        <option value="vencidos" ${filtroCobros === 'vencidos' ? 'selected' : ''}>Vencidos</option>
        <option value="pendientes" ${filtroCobros === 'pendientes' ? 'selected' : ''}>Pendientes</option>
        <option value="parciales" ${filtroCobros === 'parciales' ? 'selected' : ''}>Parciales</option>
        <option value="cobrados" ${filtroCobros === 'cobrados' ? 'selected' : ''}>Cobrados</option>
      </select>
      <button class="btn secundario" onclick="exportarPDF('cobros')">PDF Cobros</button>
      <button class="btn secundario" onclick="exportarDato('cobros','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('cobros','csv')">CSV</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="detalle">
        <b>Cobrado:</b> <span style="color:var(--verde)">${Object.entries(porMoneda).map(([k, v]) => MN$(v, k)).join(' · ')}</span> ·
        <b>Pendiente:</b> <span style="color:${pendiente ? 'var(--rosado)' : 'var(--verde)'}">${MN$(pendiente, 'RD$')}</span>
        ${vencido > 0 ? ` · <b>Vencido:</b> <span style="color:var(--rosado)">${MN$(vencido, 'RD$')}</span>` : ''}
        <span class="detalle" style="margin-left:12px;color:var(--texto-suave)">Al registrar un pago se genera el recibo numerado automáticamente. Cada cuenta indica su moneda (RD$ / USD).</span>
      </div>
    </div>
    <div class="card">
      <div class="tabla-scroll">
      <table>
        <thead><tr><th>Estudio</th><th>Inquilino</th><th class="num">Alquiler</th><th class="num">Abonado</th><th class="num">Saldo</th><th>Vence</th><th>Estado</th><th>Recibo</th><th></th></tr></thead>
        <tbody>
          ${pg.filas.map((r) => `<tr>
            <td><b>${esc(r.estudio_nombre)}</b><br><span style="color:var(--texto-suave);font-size:12px">${esc(r.estudio_direccion || '')}</span></td>
            <td>${esc(r.inquilino_nombre || '<i style="color:var(--texto-suave)">libre</i>')}
              ${r.inquilino_id && r.inquilino_whatsapp ? `<button class="btn pequeño secundario" style="margin-left:6px" onclick="enviarWhatsApp(${r.inquilino_id}, 'recordatorio', ${Math.max(0, Number(r.monto) - Number(r.abonado))})">📱</button>` : ''}</td>
            <td class="num">${MN$(r.monto, r.moneda)}</td>
            <td class="num">${Number(r.abonado) > 0 ? MN$(r.abonado, r.moneda) : '—'}</td>
            <td class="num"><b ${Number(r.saldo) > 0 ? 'style="color:var(--rosado)"' : ''}>${Number(r.saldo) > 0 ? MN$(r.saldo, r.moneda) : '—'}</b></td>
            <td>${r.fecha_vencimiento ? esc(r.fecha_vencimiento) + (r.vencido ? ' <span class="badge vencida">vencido</span>' : '') : '—'}</td>
            <td><span class="badge ${estadoCobro(r)}">${etiquetaCobro(r)}</span></td>
            <td>${r.recibo_numero ? `<span class="detalle" style="font-size:11px">${esc(r.recibo_numero)}</span>` : '—'}</td>
            <td style="text-align:right">
              ${r.pagado
                ? `<button class="btn pequeño secundario" onclick="marcarPendiente(${r.id})">Desmarcar</button> <button class="btn pequeño secundario" onclick="exportarRecibo(${r.id})">Recibo PDF</button>${r.recibo_id ? `<button class="btn pequeño peligro" onclick="anularReciboUI(${r.id})">Anular recibo</button>` : ''}${r.metodo_pago ? `<br><span class="detalle" style="font-size:11px;color:var(--texto-suave)">${METODO_ETIQ[r.metodo_pago] || r.metodo_pago || ''}${r.referencia_pago ? ' · ' + esc(r.referencia_pago) : ''}</span>` : ''}`
                : `<button class="btn pequeño secundario" onclick="abonarCobro(${r.id})">Abonar</button> <button class="btn pequeño" onclick="pagarCobro(${r.id})">✓ Cobrar</button>`}
              ${!r.pagado && Number(r.abonado) > 0 ? `<button class="btn pequeño secundario" onclick="verAbonos(${r.id})">Abonos</button>` : ''}
            </td></tr>`).join('')}
        </tbody>
      </table>
      </div>
      ${paginadorHTML('cobros', pg)}
      ${visibles.length ? '' : `<div class="vacio">Sin cobros que coincidan con el filtro.</div>`}
    </div>`;
}

function buscarMorosos() {
  filtroCobros = 'vencidos';
  viewCobros();
}

function estadoCobro(r) {
  if (r.pagado) return 'pagada';
  if (Number(r.abonado) > 0) return 'parcial';
  return r.vencido ? 'vencida' : 'pendiente';
}
function etiquetaCobro(r) {
  if (r.pagado) return 'Cobrado';
  if (Number(r.abonado) > 0) return 'Parcial';
  return r.vencido ? 'Vencido' : 'Pendiente';
}

function pagarCobro(id) {
  (async () => {
    const fila = (await window.api.cobrosMes(mesActual)).data.find((f) => Number(f.id) === Number(id));
    if (!fila) return toast('Cobro no encontrado', 'error');
    modal('Cobrar alquiler · ' + (fila.estudio_nombre || 'estudio'), `
      <div class="detalle" style="margin-bottom:10px">
        Inquilino: <b>${esc(fila.inquilino_nombre || '—')}</b> · Alquiler: <b>${MN$(fila.monto, fila.moneda)}</b>
        ${Number(fila.abonado) > 0 ? ` · Ya abonado: <b>${MN$(fila.abonado, fila.moneda)}</b> · Falta: <b>${MN$(fila.saldo, fila.moneda)}</b>` : ''}
      </div>
      <form onsubmit="guardarPago(event, ${id})">
        <div class="form-grid">
          <div class="campo"><label>Fecha de pago</label><input id="p-fecha" type="date" value="${hoyISO()}"></div>
          <div class="campo"><label>Monto a cobrar (${esc(fila.moneda)})</label><input id="p-monto" type="number" min="0.01" step="0.01" value="${fila.saldo}" required></div>
          <div class="campo"><label>Método de pago</label>
            <select id="p-metodo">
              ${opcionesMetodo()}
            </select></div>
          <div class="campo"><label>Referencia (opcional)</label><input id="p-ref" placeholder="Ej. último 4 dígitos / No. de cheque"></div>
        </div>
        <div class="detalle" style="margin:6px 0 12px;color:var(--texto-suave)">Moneda: <b>${esc(fila.moneda)}</b>. Al confirmar se generará el recibo <b>numerado</b> y quedará guardado en el historial.</div>
        <button class="btn" type="submit">Confirmar cobro y generar recibo</button>
      </form>`, '', 560);
  })();
}

async function guardarPago(e, id) {
  e.preventDefault();
  const filaData = { r: (await window.api.cobrosMes(mesActual)).data.find((f) => Number(f.id) === Number(id)) };
  const monto = Number($('#p-monto').value);
  const saldo = filaData.r ? Number(filaData.r.saldo) : monto;
  if (monto < saldo) {
    const r = await window.api.abonoAdd({
      alquiler_id: id, monto, fecha: $('#p-fecha').value || hoyISO(),
      notas: 'Abono inicial de cobro', metodo: $('#p-metodo').value, referencia: $('#p-ref').value.trim()
    });
    if (!r.ok) return toast(r.error, 'error');
    toast('Abono registrado (' + RD$(monto) + '), falta ' + RD$(saldo - monto));
  } else {
    const r = await window.api.cobrosMarcar(id, true, $('#p-fecha').value || hoyISO(), $('#p-metodo').value, $('#p-ref').value.trim());
    if (!r.ok) return toast(r.error, 'error');
    toast('Cobro registrado ✓ Recibo generado');
  }
  cerrarModal(); vista('cobros');
}

function abonarCobro(id) {
  (async () => {
    const abonos = (await window.api.abonosList(id)).data || [];
    const fila = (await window.api.cobrosMes(mesActual)).data.find((f) => Number(f.id) === Number(id));
    const moneda = fila ? fila.moneda : 'RD$';
    const abonado = abonos.reduce((s, a) => s + Number(a.monto), 0);
    modal('Registrar abono', `
      <div class="detalle" style="margin-bottom:10px">Abonado hasta ahora: <b>${MN$(abonado, moneda)}</b> · Moneda: <b>${moneda}</b></div>
      <form onsubmit="guardarAbono(event, ${id})">
        <div class="form-grid">
          <div class="campo"><label>Monto (${moneda}) *</label><input id="a-monto" type="number" min="1" step="0.01" required autofocus></div>
          <div class="campo"><label>Fecha</label><input id="a-fecha" type="date" value="${hoyISO()}"></div>
          <div class="campo"><label>Método de pago</label>
            <select id="a-metodo">
              ${opcionesMetodo()}
            </select></div>
          <div class="campo"><label>Referencia (opcional)</label><input id="a-ref" placeholder="Ej. último 4 dígitos / No. de cheque"></div>
        </div>
        <div class="campo"><label>Notas</label><input id="a-notas" placeholder="Ej. primera parte del mes"></div>
        <button class="btn" type="submit">Guardar abono</button>
      </form>`, '', 540);
  })();
}
async function guardarAbono(e, id) {
  e.preventDefault();
  const r = await window.api.abonoAdd({
    alquiler_id: id,
    monto: Number($('#a-monto').value),
    fecha: $('#a-fecha').value || hoyISO(),
    notas: $('#a-notas').value,
    metodo: $('#a-metodo').value,
    referencia: $('#a-ref').value.trim()
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Abono registrado'); vista('cobros');
}
async function verAbonos(id) {
  const abonos = (await window.api.abonosList(id)).data || [];
  modal('Abonos del cobro', `
    <table>
      <thead><tr><th>Fecha</th><th class="num">Monto</th><th>Método</th><th>Referencia</th><th>Notas</th><th></th></tr></thead>
      <tbody>${abonos.map((a) => `<tr>
        <td>${esc(a.fecha)}</td><td class="num">${RD$(a.monto)}</td>
        <td>${a.metodo_pago ? esc(METODO_ETIQ[a.metodo_pago] || a.metodo_pago) : '—'}</td>
        <td>${esc(a.referencia || '—')}</td>
        <td>${esc(a.notas || '—')}</td>
        <td style="text-align:right"><button class="btn pequeño peligro" onclick="borrarAbono(${a.id})">Eliminar</button></td></tr>`).join('')}
      </tbody>
    </table>`, `<button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 680);
}
async function borrarAbono(id) {
  if (!confirm('¿Eliminar este abono? Si era la última parte del pago, el alquiler volverá a quedar pendiente y el recibo se anulará.')) return;
  await window.api.abonoDelete(id);
  toast('Abono eliminado'); cerrarModal(); vista('cobros');
}
async function marcarPendiente(id) {
  if (!confirm('¿Marcar este cobro como pendiente? Se borrarán los abonos y el recibo generado quedará anulado.')) return;
  const r = await window.api.cobrosMarcar(id, false, '');
  if (!r.ok) return toast(r.error, 'error');
  toast('Marcado como pendiente');
  vista('cobros');
}

async function anularReciboUI(id) {
  const fila = (await window.api.cobrosMes(mesActual)).data.find((f) => Number(f.id) === Number(id));
  if (!fila) return toast('Cobro no encontrado', 'error');
  const num = fila.recibo_numero ? ' <b>' + esc(fila.recibo_numero) + '</b>' : '';
  if (!confirm('¿Anular el recibo' + num + ' de ' + (fila.estudio_nombre || 'este alquiler') + '?\n\nEl alquiler volverá a quedar pendiente (se conservan los abonos parciales). Esta acción no se puede deshacer.')) return;
  const r = await window.api.recibosAnular(fila.recibo_id);
  if (!r.ok) return toast(r.error || 'No se pudo anular el recibo', 'error');
  toast('Recibo anulado');
  vista('cobros');
}

async function viewGastos() {
  vistaActual = 'gastos';
  titulo('Gastos');
  const gF = window.__gastosFiltro || {};
  const gastos = (await window.api.gastosList({ mes: mesActual, categoria: gF.categoria || '', subcategoria: gF.subcategoria || '', proveedor: gF.proveedor || '', moneda: gF.moneda || '', estado: gF.estado || '' })).data;
  const pg = paginar('gastos', gastos);
  const totales = {};
  gastos.forEach((g) => { totales[monedaOkUI(g.moneda)] = round2sum(totales[monedaOkUI(g.moneda)], g.monto); });
  $('#content').innerHTML = `
    <div class="btn-row">
      ${selectorMes()}
      <button class="btn" onclick="formGasto()">+ Nuevo gasto</button>
      <select id="g-filtro-cat" onchange="window.__gastosFiltro={categoria:this.value,subcategoria:'',proveedor:(window.__gastosFiltro||{}).proveedor||''};__pag.gastos=1;viewGastos()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="">Todas las categorías</option>
        ${Object.keys(SUBCAT_ETIQ).map((c) => `<option value="${c}" ${gF.categoria === c ? 'selected' : ''}>${CATEG_ETIQ[c]}</option>`).join('')}
      </select>
      <select id="g-filtro-sub" onchange="window.__gastosFiltro={categoria:(window.__gastosFiltro||{}).categoria||'',subcategoria:this.value,proveedor:(window.__gastosFiltro||{}).proveedor||''};__pag.gastos=1;viewGastos()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="">Subcategoría</option>
        ${(SUBCAT_ETIQ[gF.categoria] || []).map((s) => `<option value="${s}" ${gF.subcategoria === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <select id="g-filtro-mo" onchange="window.__gastosFiltro={categoria:(window.__gastosFiltro||{}).categoria||'',subcategoria:'',proveedor:(window.__gastosFiltro||{}).proveedor||'',moneda:this.value,estado:(window.__gastosFiltro||{}).estado||''};__pag.gastos=1;viewGastos()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="" ${!gF.moneda ? 'selected' : ''}>Todas las monedas</option>
        <option value="RD$" ${gF.moneda === 'RD$' ? 'selected' : ''}>RD$</option>
        <option value="USD" ${gF.moneda === 'USD' ? 'selected' : ''}>USD</option>
      </select>
      <select id="g-filtro-est" onchange="window.__gastosFiltro={categoria:(window.__gastosFiltro||{}).categoria||'',subcategoria:'',proveedor:(window.__gastosFiltro||{}).proveedor||'',moneda:(window.__gastosFiltro||{}).moneda||'',estado:this.value};__pag.gastos=1;viewGastos()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="" ${!gF.estado ? 'selected' : ''}>Estado</option>
        <option value="pagado" ${gF.estado === 'pagado' ? 'selected' : ''}>Pagado</option>
        <option value="programado" ${gF.estado === 'programado' ? 'selected' : ''}>Programado</option>
      </select>
      <input class="buscar" placeholder="Proveedor…" value="${esc(gF.proveedor || '')}" style="max-width:160px" onchange="window.__gastosFiltro={categoria:(window.__gastosFiltro||{}).categoria||'',subcategoria:(window.__gastosFiltro||{}).subcategoria||'',proveedor:this.value};__pag.gastos=1;viewGastos()">
      <button class="btn secundario" onclick="exportarPDF('gastos')">PDF Gastos</button>
      <button class="btn secundario" onclick="exportarDato('gastos','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('gastos','csv')">CSV</button>
    </div>
    <div class="card">
      <div class="tabla-scroll">
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Estudio</th><th>Proveedor</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${pg.filas.map((g) => `<tr>
            <td>${esc(g.fecha)}${g.fecha_vencimiento ? `<div class="detalle" style="font-size:11px">vence ${esc(g.fecha_vencimiento)}</div>` : ''}</td>
            <td><span class="badge pendiente">${CATEG_ETIQ[g.categoria] || g.categoria}</span>${g.subcategoria ? ` <span class="detalle" style="font-size:11px">${esc(g.subcategoria)}</span>` : ''}</td>
            <td>${esc(g.estudio_nombre || '—')}</td>
            <td>${esc(g.proveedor || '—')}</td>
            <td>${esc(g.concepto || '—')}</td>
            <td>${g.metodo_pago ? esc(METODO_ETIQ[g.metodo_pago] || g.metodo_pago) + (g.referencia ? ' <span class="detalle" style="font-size:11px">' + esc(g.referencia) + '</span>' : '') : '—'}</td>
            <td class="num"><b>${MN$(g.monto, g.moneda)}</b></td>
            <td><span class="badge ${g.estado === 'programado' ? 'pendiente' : 'pagada'}">${g.estado === 'programado' ? 'Programado' : 'Pagado'}</span></td>
            <td style="text-align:right">
              ${g.comprobante ? `<button class="btn pequeño secundario" onclick="verComprobante(${g.id})">Comprobante</button>` : ''}
              <button class="btn pequeño peligro" onclick="borrarGasto(${g.id})">Eliminar</button></td></tr>`).join('')}
        </tbody>
      </table>
      </div>
      ${paginadorHTML('gastos', pg)}
      ${gastos.length ? `<div style="text-align:right;padding:10px 12px;font-weight:700">${Object.entries(totales).map(([k, v]) => `Total ${k}: ${MN$(v, k)}`).join(' · ')}</div>` : `<div class="vacio">Sin gastos para los filtros elegidos.</div>`}
    </div>`;
}
function verComprobante(id) {
  (async () => {
    const gs = (await window.api.gastosList({ id })).data;
    const g = (gs || []).find((x) => Number(x.id) === Number(id)) || {};
    modal('Comprobante del gasto', `
      <div class="detalle" style="margin-bottom:10px">Gasto de <b>${RD$(g.monto)}</b> · ${g.fecha || ''} · ${esc(g.concepto || '')}</div>
      <div class="campo"><label>Referencia / comprobante</label><textarea id="g-comp-valor" rows="3">${esc(g.comprobante || '')}</textarea></div>
      <button class="btn" type="button" onclick="guardarComprobante(${id})">Guardar</button>`, '', 480);
  })();
}
async function guardarComprobante(id) {
  const gs = (await window.api.gastosList({ id })).data;
  const g = (gs || []).find((x) => Number(x.id) === Number(id)) || {};
  const r = await window.api.gastosSave({ ...g, comprobante: $('#g-comp-valor').value.trim() });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Comprobante guardado'); vista('gastos');
}
function formGasto() {
  (async () => {
    const estudios = (await window.api.estudiosList('')).data;
    modal('Nuevo gasto', `
      <form onsubmit="guardarGasto(event)">
        <div class="form-grid">
          <div class="campo"><label>Tipo *</label>
            <select id="g-categoria" onchange="gastosSubcategoria()">
              ${Object.entries(CATEG_ETIQ).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select></div>
          <div class="campo"><label>Subcategoría</label><select id="g-subcategoria"><option value="">— ninguna —</option></select></div>
          <div class="campo"><label>Moneda *</label><select id="g-moneda">${opcionesMoneda()}</select></div>
          <div class="campo"><label>Monto *</label><input id="g-monto" type="number" min="0" step="0.01" required autofocus></div>
          <div class="campo"><label>Proveedor</label><input id="g-proveedor" placeholder="Ej. EDEeste, Técnico A/C…"></div>
          <div class="campo"><label>Tipo de gasto</label>
            <select id="g-estado">
              <option value="pagado" selected>Pagado</option>
              <option value="programado">Programado (a futuro)</option>
            </select></div>
        </div>
        <div class="campo"><label>Estudio (opcional)</label>
          <select id="g-estudio"><option value="">— general —</option>
            ${estudios.map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}
          </select></div>
        <div class="form-grid">
          <div class="campo"><label>Fecha</label><input id="g-fecha" type="date" value="${hoyISO()}"></div>
          <div class="campo"><label>Concepto</label><input id="g-concepto" placeholder="Ej. factura del mes"></div>
          <div class="campo"><label>Método de pago</label>
            <select id="g-metodo">
              ${opcionesMetodo()}
            </select></div>
          <div class="campo"><label>Referencia / NCF</label><input id="g-ref" placeholder="Ej. NCF, serie…"></div>
        </div>
        <div class="campo"><label>Comprobante (nota, folio o ruta del archivo)</label><input id="g-comprobante" placeholder="Ej. archivo factura-enero.pdf"></div>
        <button class="btn" type="submit">Guardar</button>
      </form>`, '', 640);
    gastosSubcategoria();
  })();
}
function gastosSubcategoria() {
  const sel = $('#g-subcategoria');
  if (!sel) return;
  const cat = $('#g-categoria').value;
  sel.innerHTML = `<option value="">— ninguna —</option>` + (SUBCAT_ETIQ[cat] || []).map((s) => `<option value="${s}">${esc(s)}</option>`).join('');
}
async function guardarGasto(e) {
  e.preventDefault();
  const r = await window.api.gastosSave({
    categoria: $('#g-categoria').value, monto: Number($('#g-monto').value) || 0,
    estudio_id: Number($('#g-estudio').value) || null, fecha: $('#g-fecha').value,
    concepto: $('#g-concepto').value.trim(), subcategoria: $('#g-subcategoria').value,
    proveedor: $('#g-proveedor').value.trim(), metodo_pago: $('#g-metodo').value,
    referencia: $('#g-ref').value.trim(), comprobante: $('#g-comprobante').value.trim(),
    moneda: $('#g-moneda').value, estado: $('#g-estado').value, fecha_vencimiento: $('#g-estado').value === 'programado' ? $('#g-fecha').value : ''
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Gasto registrado'); vista('gastos');
}
async function borrarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  await window.api.gastosDelete(id);
  toast('Gasto eliminado'); vista('gastos');
}

async function viewEmpresa() {
  vistaActual = 'empresa';
  titulo('Empresa y datos');
  const e = empresa;
  $('#content').innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <h3>Datos del negocio</h3>
        <form onsubmit="guardarEmpresa(event)">
          <div class="campo"><label>Nombre del negocio</label><input id="emp-nombre" value="${esc(e.nombre)}" placeholder="Ej. Inversiones HABITIA"></div>
          <div class="form-grid">
            <div class="campo"><label>RNC</label><input id="emp-rnc" value="${esc(e.rnc)}"></div>
            <div class="campo"><label>Teléfono</label><input id="emp-telefono" value="${esc(e.telefono)}"></div>
          </div>
          <div class="campo"><label>Email</label><input id="emp-email" value="${esc(e.email)}"></div>
          <div class="campo"><label>Dirección</label><input id="emp-direccion" value="${esc(e.direccion)}"></div>
          <button class="btn" type="submit">Guardar</button>
        </form>
      </div>
      <div class="card">
        <h3>Preferencias</h3>
        <form onsubmit="guardarPreferencias(event)">
          <div class="campo"><label>Encargado (quien cobra: aparece como "registrado por" en recibos y notas)</label><input id="pref-encargado" value="${esc(window.__usuarioActual || 'Dueño')}"></div>
          <div class="campo"><label>Día de pago predeterminado</label>
            <select id="pref-diapago" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
              ${Array.from({ length: 28 }, (_, i) => i + 1).map((d) => `<option value="${d}" ${Number(window.__diaPago || 5) === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="campo"><label>Auto-bloqueo por inactividad (solo con PIN activo)</label>
            <select id="pref-seg-lock" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
              <option value="0" ${!window.__segLockMin ? 'selected' : ''}>Desactivado</option>
              <option value="5" ${window.__segLockMin === 5 ? 'selected' : ''}>5 minutos</option>
              <option value="10" ${window.__segLockMin === 10 ? 'selected' : ''}>10 minutos</option>
              <option value="15" ${window.__segLockMin === 15 ? 'selected' : ''}>15 minutos</option>
              <option value="30" ${window.__segLockMin === 30 ? 'selected' : ''}>30 minutos</option>
              <option value="60" ${window.__segLockMin === 60 ? 'selected' : ''}>60 minutos</option>
            </select>
          </div>
          <button class="btn" type="submit">Guardar</button>
        </form>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Respaldos automáticos 🔄</h3>
      <p class="detalle">Al abrir HABITIA se crea un respaldo diario en este equipo. Ten todos los respaldos que quieras: <b>se guardan solos</b>; los más viejos se van eliminando según la retención que elijas.</p>
      <div id="backup-ruta" class="detalle" style="margin:10px 0 0;padding:10px 12px;background:var(--gris-fondo);border:1px solid var(--borde-suave);border-radius:10px;font-size:12.5px"></div>
      <div id="backup-estado" class="detalle" style="margin:10px 0"></div>
      <div id="backup-lista" style="margin:8px 0"></div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn secundario" onclick="backupCrear()">Crear respaldo ahora</button>
        <button class="btn secundario" onclick="backupRestaurarApp()">Restaurar desde un respaldo…</button>
        <button class="btn secundario" onclick="window.api.backupCarpeta()">Abrir carpeta de respaldos</button>
        <span style="flex:1"></span>
        <span class="detalle" style="align-self:center">Retención:
          <select id="backup-retencion" onchange="guardarRetencion(this.value)" style="border:1px solid var(--borde);border-radius:8px;padding:6px 8px;background:var(--fondo)">
            <option value="7">7 respaldos</option>
            <option value="15">15 respaldos</option>
            <option value="30">30 respaldos</option>
            <option value="60">60 respaldos</option>
            <option value="120">120 respaldos</option>
          </select></span>
      </div>
    </div>
    <div class="card" id="seguridad-pin-card" style="margin-top:16px">
      <h3>Seguridad 🔒</h3>
      <p class="detalle">Protege HABITIA con un PIN numérico. Al abrir la app, deberás ingresarlo antes de ver tus datos. El PIN se guarda con hash (sin texto plano).</p>
      <div id="seg-pin-estado" class="detalle" style="margin:8px 0"></div>
      <div class="btn-row">
        <div id="seg-pin-form" style="display:none;margin-bottom:10px;width:100%">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">PIN nuevo (4-6 dígitos)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="seg-pin-input" type="password" maxlength="6" placeholder="····" inputmode="numeric" style="max-width:120px;font-size:18px;letter-spacing:8px;text-align:center">
            <button class="btn" onclick="segPinGuardar()">Guardar PIN</button>
            <button class="btn secundario" onclick="$('#seg-pin-form').style.display='none'">Cancelar</button>
          </div>
        </div>
        <div id="seg-pin-clear-form" style="display:none;margin-bottom:10px;width:100%">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">PIN actual</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="seg-pin-clear" type="password" maxlength="6" placeholder="····" inputmode="numeric" style="max-width:120px;font-size:18px;letter-spacing:8px;text-align:center">
            <button class="btn peligro" onclick="segPinQuitar()">Eliminar PIN</button>
            <button class="btn secundario" onclick="$('#seg-pin-clear-form').style.display='none'">Cancelar</button>
          </div>
        </div>
        <button class="btn secundario" id="seg-pin-set" onclick="$('#seg-pin-form').style.display='block'">Establecer / cambiar PIN</button>
        <button class="btn secundario peligro" id="seg-pin-clear-btn" onclick="$('#seg-pin-clear-form').style.display='block'">Quitar PIN</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Datos de ejemplo (para probar)</h3>
      <p class="detalle">Carga un edificio de prueba con 6 estudios, 4 deudores, 1 atrasado y gastos, para probar los cobros, los reportes y los contratos. <b>No mezcla tus datos reales</b>: solo funciona si la base está vacía y puedes quitarlos cuando quieras.</p>
      <div id="muestra-estado" class="detalle" style="margin:8px 0"></div>
      <div class="btn-row">
        <button class="btn" id="muestra-cargar" onclick="cargarMuestra()">Cargar datos de ejemplo</button>
        <button class="btn peligro" id="muestra-quitar" onclick="quitarMuestra()" style="display:none">Quitar datos de ejemplo</button>
      </div>
    </div>`;
  refrescarMuestra();
  refrescarBackups();
  refrescarPinEstado();
}
async function refrescarPinEstado() {
  const e = $('#seg-pin-estado'); const clearBtn = $('#seg-pin-clear-btn'); const setBtn = $('#seg-pin-set');
  if (!e) return;
  const r = (await window.api.seguridadPinActivo()).data;
  if (r && r.activo) {
    e.textContent = '✓ PIN activo — la app está protegida.';
    e.style.color = 'var(--verde)';
    clearBtn.style.display = 'inline-block';
  } else {
    e.textContent = 'PIN no configurado — la app se abre sin protección.';
    e.style.color = 'var(--texto-suave)';
    clearBtn.style.display = 'none';
  }
}
async function segPinGuardar() {
  const pin = ($('#seg-pin-input').value || '').trim();
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) return toast('El PIN debe tener 4 a 6 dígitos', 'error');
  const r = await window.api.seguridadSetPin(pin);
  if (!r.ok) return toast(r.error || 'Error al guardar PIN', 'error');
  toast('PIN configurado correctamente');
  __pinActivo = true;
  $('#seg-pin-form').style.display = 'none';
  refrescarPinEstado();
}
async function segPinQuitar() {
  const pin = ($('#seg-pin-clear').value || '').trim();
  if (!pin) return toast('Ingresa tu PIN actual para confirmar', 'error');
  const r = await window.api.seguridadVerificarPin(pin);
  if (!r.ok || !r.data || !r.data.ok) return toast('PIN incorrecto', 'error');
  await window.api.seguridadClearPin();
  toast('PIN eliminado');
  __pinActivo = false;
  $('#seg-pin-clear-form').style.display = 'none';
  refrescarPinEstado();
}
async function refrescarMuestra() {
  const box = $('#muestra-estado');
  const cargar = $('#muestra-cargar');
  const quitar = $('#muestra-quitar');
  if (!box) return;
  const e = (await window.api.muestraEstado()).data;
  if (e.activo) {
    box.textContent = '✓ Hay datos de ejemplo cargados (' + e.estudios + ' estudios). Puedes quitarlos cuando termines de probar.';
    cargar.style.display = 'none';
    quitar.style.display = 'inline-block';
  } else {
    box.textContent = e.estudios > 0 ? 'Tienes ' + e.estudios + ' estudios guardados (datos reales): la opción de ejemplo queda desactivada para no tocarlos.' : 'No hay datos cargados todavía.';
    quitar.style.display = 'none';
  }
}
async function cargarMuestra() {
  const r = (await window.api.muestraSeed()).data;
  if (r.error) return toast(r.error, 'error');
  toast('Datos de ejemplo cargados. Ya puedes probar todo.');
  visualizar();
}
async function quitarMuestra() {
  const r = (await window.api.muestraClear()).data;
  toast(r.error || 'Datos de ejemplo eliminados. La base quedó vacía.');
  visualizar();
}
async function guardarEmpresa(e) {
  e.preventDefault();
  const r = await window.api.empresaSave({
    nombre: $('#emp-nombre').value.trim(), rnc: $('#emp-rnc').value.trim(),
    telefono: $('#emp-telefono').value.trim(), email: $('#emp-email').value.trim(),
    direccion: $('#emp-direccion').value.trim()
  });
  if (!r.ok) return toast(r.error, 'error');
  empresa = r.data;
  toast('Datos guardados');
}
async function backupCrear() {
  const r = await window.api.backupCrear();
  if (r.ok) toast('Respaldo creado: ' + splitPop(r.data) + ' → en Documentos\\HABITIA\\respaldos');
  else toast(r.error || 'No se pudo crear el respaldo', 'error');
  refrescarBackups();
}
function splitPop(s) { return String(s || '—').split(/[\\/]/).pop(); }
async function backupRestaurarApp() {
  if (!confirm('Restaurar reemplazará todos tus datos actuales con el contenido del respaldo.\n\n¿Quieres elegir un respaldo y continuar?')) return;
  const r = await window.api.backupRestaurar();
  if (!r.ok) return toast(r.error || 'No se pudo restaurar', 'error');
  if (r.data && r.data.cancelado) return;
  toast('Datos restaurados ✓');
  await loadBasicos();
  visualizar();
}
async function refrescarBackups() {
  const box = $('#backup-estado');
  const lista = $('#backup-lista');
  if (!box) return;
  const e = (await window.api.backupEstado()).data || {};
  $('#backup-retencion').value = String(e.retencion || 30);
  const rutaBox = $('#backup-ruta');
  if (rutaBox) {
    const carpeta = e.carpeta || '—';
    const corta = carpeta.split(/[\\/]/).filter(Boolean).slice(-3).join(String.fromCharCode(92));
    rutaBox.innerHTML = `<b>📍 Carpeta de respaldos:</b> <code style="background:#fff;border:1px solid var(--borde);border-radius:6px;padding:2px 7px;font-size:12px">${esc(carpeta)}</code>
      <span class="detalle" style="color:var(--texto-suave)">(<i>Documentos${corta === 'respaldos' ? '' : String.fromCharCode(92) + corta}</i>) · puedes copiar esa carpeta a un pendrive para tenerlos a salvo.</span>`;
  }
  if (!e.lista || !e.lista.length) {
    box.innerHTML = `<span class="detalle" style="color:var(--texto-suave)">Todavía no hay respaldos. Haz clic en "Crear respaldo ahora" para el primero.</span>`;
    lista.innerHTML = '';
    return;
  }
  box.innerHTML = e.desactualizado
    ? `<span class="badge vencida">El respaldo de hoy aún no existe</span> <span class="detalle">Se creará la próxima vez que abras la aplicación (o usa "Crear respaldo ahora").</span>`
    : `<span class="badge pagada">Respaldo de hoy creado ✔</span> <span class="detalle">Último: ${esc(e.ultimo ? e.ultimo.nombre : '—')}</span>`;
  lista.innerHTML = `<div class="detalle" style="margin:6px 0"><b>Respaldos guardados:</b></div>
    <table><thead><tr><th>Archivo</th><th>Fecha</th><th class="num">Tamaño</th></tr></thead>
    <tbody>${e.lista.map((b) => `<tr>
      <td><b>${esc(b.nombre)}</b></td>
      <td>${esc(new Date(b.fecha).toLocaleString())}</td>
      <td class="num">${Math.round(b.tamano / 1024)} KB</td></tr>`).join('')}</tbody></table>`;
}
async function guardarRetencion(v) {
  const r = await window.api.backupRetencion(Number(v) || 30);
  if (r.ok) toast('Retención guardada');
  else toast(r.error || 'No se pudo guardar', 'error');
}

// ---------- Preferencias ----------
async function guardarPreferencias(e) {
  e.preventDefault();
  await window.api.configSet('usuario_actual', $('#pref-encargado').value.trim() || 'Dueño');
  await window.api.configSet('dia_pago', Number($('#pref-diapago').value) || 5);
  window.__usuarioActual = $('#pref-encargado').value.trim() || 'Dueño';
  const segLockMin = Number($('#pref-seg-lock') ? $('#pref-seg-lock').value : 0) || 0;
  await window.api.configSet('seg_lock_min', String(segLockMin));
  window.__segLockMin = segLockMin;
  toast('Preferencias guardadas');
  window.__diaPago = Number($('#pref-diapago').value) || 5;
}

// ============================================================
//                    MANTENIMIENTO
// ============================================================

async function viewMantenimiento() {
  vistaActual = 'mantenimiento';
  titulo('Mantenimiento');
  const ordenes = (await window.api.mantenimientoList()).data || [];
  const ABIERTAS = ['abierta', 'reportado', 'en_revision', 'aprobado', 'en_reparacion'];
  const abiertas = ordenes.filter((o) => ABIERTAS.indexOf(o.estado) >= 0);
  const costoAcumulado = ordenes.filter((o) => o.estado === 'cerrada' || o.estado === 'completado').reduce((s, o) => s + Number(o.costo || 0), 0);
  const filtro = (window.__mantFiltro || 'todos');
  const ver = (o) => (filtro === 'abiertas' ? ABIERTAS.indexOf(o.estado) >= 0 : filtro === 'cerradas' ? ABIERTAS.indexOf(o.estado) < 0 : true);
  const visibles = ordenes.filter(ver);
  const pg = paginar('mantenimiento', visibles);
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formOrden()">+ Nueva orden</button>
      <button class="btn secundario" onclick="exportarDato('mantenimiento','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('mantenimiento','csv')">CSV</button>
      <select id="mant-filtro" onchange="window.__mantFiltro=this.value;__pag.mantenimiento=1;viewMantenimiento()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="todos" ${filtro === 'todos' ? 'selected' : ''}>Todas</option>
        <option value="abiertas" ${filtro === 'abiertas' ? 'selected' : ''}>Abiertas / en proceso</option>
        <option value="cerradas" ${filtro === 'cerradas' ? 'selected' : ''}>Completadas / canceladas</option>
      </select>
      <span style="flex:1"></span>
      <span class="detalle" style="align-self:center">${abiertas.length} abiertas · ${ordenes.length - abiertas.length} cerradas · costo total ${MN$(costoAcumulado, 'RD$', 0)}</span>
    </div>
    <div class="card">
      ${visibles.length
        ? `<div class="tabla-scroll"><table><thead><tr><th>#</th><th>Estudio</th><th>Inquilino</th><th>Detalle</th><th>Prioridad</th><th>Proveedor</th><th class="num">Est. costo</th><th class="num">Costo real</th><th>Estado</th><th></th></tr></thead>
           <tbody>${pg.filas.map((o) => `<tr>
             <td><b>${o.id}</b></td>
             <td>${esc(o.estudio_nombre || '—')}</td>
             <td>${esc(o.inquilino_nombre || '—')}</td>
             <td>${esc(o.detalle || '—')}</td>
             <td><span class="badge ${PRIORIDAD_CLS[o.prioridad] || 'pendiente'}">${PRIORIDAD_ETIQ[o.prioridad] || '—'}</span></td>
             <td>${esc(o.proveedor || '—')}</td>
             <td class="num">${Number(o.costo_estimado) > 0 ? MN$(o.costo_estimado, o.moneda) : '—'}</td>
             <td class="num"><b ${Number(o.costo) > 0 ? 'style="color:var(--rosado)"' : ''}>${Number(o.costo) > 0 ? MN$(o.costo, o.moneda) : '—'}</b></td>
             <td><span class="badge ${ESTADO_ORDEN_CLS[o.estado] || 'pendiente'}">${ESTADO_ORDEN_ETIQ[o.estado] || o.estado}</span></td>
             <td style="text-align:right">
               ${ABIERTAS.indexOf(o.estado) >= 0 ? `<select class="ord-avanzar" onchange="avanzarOrden(${o.id}, this.value)">
                 <option value="">Avanzar…</option>
                 ${['en_revision', 'aprobado', 'en_reparacion', 'completado', 'cancelado'].filter((s) => s !== o.estado).map((s) => `<option value="${s}">${ESTADO_ORDEN_ETIQ[s]}</option>`).join('')}
               </select>` : ''}
               ${o.estudio_id ? `<button class="btn pequeño secundario" onclick="verMantenimientoEstudio(${o.estudio_id})">Resumen estudio</button>` : ''}
               <button class="btn pequeño peligro" onclick="borrarOrden(${o.id})">Eliminar</button>
             </td></tr>`).join('')}</tbody></table></div>
           ${paginadorHTML('mantenimiento', pg)}`
        : `<div class="vacio">Sin órdenes de mantenimiento. Usa "+ Nueva orden" para registrar una avería.</div>`}
    </div>`;
}
async function avanzarOrden(id, estado) {
  if (!estado) return;
  let costo = 0;
  if (estado === 'completado') {
    const o = (await window.api.mantenimientoList({})).data.find((x) => Number(x.id) === Number(id)) || {};
    costo = o.costo_estimado || 0;
  }
  const r = await window.api.mantenimientoEstado(id, estado, costo);
  if (!r.ok) return toast(r.error, 'error');
  toast('Orden #' + id + ' → ' + (ESTADO_ORDEN_ETIQ[estado] || estado) + (estado === 'completado' && costo > 0 ? ' · costo ' + MN$(costo, 'RD$', 0) + ' registrado como gasto' : ''));
  vista('mantenimiento');
}
async function verMantenimientoEstudio(estudioId) {
  if (!estudioId) { toast('Esta orden no tiene estudio asociado', 'error'); return; }
  const s = (await window.api.mantenimientoResumenEstudio(estudioId)).data;
  const e = (await window.api.estudiosGet(estudioId)).data;
  modal('Mantenimiento · ' + (e ? e.nombre : 'estudio'), `
    <div class="detalle" style="margin-bottom:10px">
      Órdenes totales: <b>${s.n}</b> · Abiertas ahora: <b style="color:${s.abiertas ? 'var(--rosado)' : 'var(--verde)'}">${s.abiertas}</b> ·
      Costo acumulado: <b>${RD$(s.costoT)}</b>
    </div>
    ${s.ultimo_detalle
      ? `<div class="campo"><label>Última reparación cerrada</label><div class="detalle">${esc(s.ultimo_detalle)}<br>${esc(s.ultima_fecha || '')} · Costo: ${RD$(s.ultimo_costo)}</div></div>`
      : `<div class="vacio">Sin reparaciones cerradas en este estudio.</div>`}`,
    `<button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 560);
}
function formOrden() {
  (async () => {
    const estudios = (await window.api.estudiosList('')).data || [];
    modal('Nueva orden de mantenimiento', `
      <form onsubmit="guardarOrden(event)">
        <div class="campo"><label>Estudio afectado</label>
          <select id="o-estudio"><option value="">— sin estudio —</option>
            ${estudios.map((e) => `<option value="${e.id}">${esc(e.nombre)}${e.inquilino_nombre ? ' (' + esc(e.inquilino_nombre) + ')' : ''}</option>`).join('')}
          </select></div>
        <div class="campo"><label>Detalle de la avería *</label>
          <textarea id="o-detalle" rows="3" placeholder="Ej. Fuga de agua en el baño, aire acondicionado sin enfriar…" required autofocus></textarea></div>
        <div class="form-grid">
          <div class="campo"><label>Prioridad</label>
            <select id="o-prioridad">
              <option value="media" selected>Media</option>
              <option value="baja">Baja</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select></div>
          <div class="campo"><label>Costo estimado (RD$)</label><input id="o-costo" type="number" min="0" step="0.01" placeholder="0"></div>
        </div>
        <div class="campo"><label>Proveedor / técnico (opcional)</label><input id="o-proveedor" placeholder="Ej. Técnico de aires, plomero…"></div>
        <button class="btn" type="submit">Abrir orden</button>
      </form>`, '', 580);
  })();
}
async function guardarOrden(e) {
  e.preventDefault();
  const estudio_id = Number($('#o-estudio').value) || null;
  const r = await window.api.mantenimientoSave({
    estudio_id, detalle: $('#o-detalle').value.trim(),
    prioridad: $('#o-prioridad').value, costo_estimado: Number($('#o-costo').value) || 0,
    proveedor: $('#o-proveedor').value.trim()
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Orden #' + r.data.id + ' reportada'); vista('mantenimiento');
}
function cerrarOrden(id) {
  (async () => {
    const o = (await window.api.mantenimientoList({})).data.find((x) => Number(x.id) === Number(id)) || {};
    modal('Cerrar orden #' + id, `
      <form onsubmit="guardarCierre(event, ${id})">
        <div class="form-grid">
          <div class="campo"><label>Costo real de la reparación (RD$)</label><input id="o-costo-real" type="number" min="0" step="0.01" value="${o.costo_estimado || ''}"></div>
        </div>
        <div class="campo"><label>Notas del cierre (opcional)</label><textarea id="o-notas" rows="2" placeholder="Ej. Repuesto usado, garantía, próxima revisión…">${esc(o.detalle || '')}</textarea></div>
        <button class="btn" type="submit">Cerrar orden y guardar</button>
      </form>`, '', 500);
  })();
}
async function guardarCierre(e, id) {
  e.preventDefault();
  const c = Number($('#o-costo-real').value) || 0;
  const r = await window.api.mantenimientoCerrar(id, c, $('#o-notas').value.trim());
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Orden #' + id + ' cerrada' + (c > 0 ? ' · costo ' + RD$(c, 0) : ''));
  vista('mantenimiento');
}
async function borrarOrden(id) {
  if (!confirm('¿Eliminar la orden #' + id + '?')) return;
  await window.api.mantenimientoDelete(id);
  toast('Orden eliminada'); vista('mantenimiento');
}

// ============================================================
//                    REPORTE FINANCIERO DEL MES
// ============================================================
function cambiarModoReporte(modo) {
  window.__reporteModo = modo;
  viewReporte();
}
async function viewReporte() {
  vistaActual = 'reporte';
  const modo = window.__reporteModo || 'mensual';
  titulo(modo === 'anual' ? 'Reporte anual' : 'Reporte financiero del mes');
  const anioSel = window.__anioReporte || new Date().getFullYear();
  const aniosDispon = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const f = (await window.api.reporteFinanciero(mesActual)).data;
  const k = f.enLetras || {};
  const filasGas = Object.entries(f.porCategoria || {});
  const pgRec = paginar('reporte-recibos', f.recibos || []);
  const cuerpoMensual = `
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card kpi positivo"><div class="label">Recaudado</div>
        <div class="valor">${RD$(k.cobrado)}</div>
        <div class="sub">${k.recibos || 0} recibos emitidos</div></div>
      <div class="card kpi ${Number(k.porCobrar) > 0 ? 'negativo' : ''}"><div class="label">Por cobrar</div>
        <div class="valor">${RD$(k.porCobrar)}</div>
        <div class="sub">${Number(k.porCobrar) > 0 ? 'pendiente del mes' : 'al día 🎉'}</div></div>
      <div class="card kpi ${Number(k.totalAtrasado) > 0 ? 'negativo' : ''}"><div class="label">Atrasado</div>
        <div class="valor">${RD$(k.totalAtrasado)}</div>
        <div class="sub">de meses anteriores</div></div>
      <div class="card kpi"><div class="label">Gastos del mes</div>
        <div class="valor">${RD$(k.gastos)}</div>
        <div class="sub">${k.estudios || 0} estudios · ${k.ocupados || 0} ocupados</div></div>
      <div class="card kpi ${Number(k.neto) >= 0 ? 'positivo' : 'negativo'}"><div class="label">Ganancia neta</div>
        <div class="valor">${RD$(k.neto)}</div>
        <div class="sub">recaudado − gastos del mes</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:16px">
      <div class="card">
        <h3>Gastos por categoría</h3>
        ${filasGas.length
          ? `<table><thead><tr><th>Categoría</th><th class="num">Monto</th></tr></thead>
             <tbody>${filasGas.map(([cat, v]) => `<tr><td>${esc(CATEG_ETIQ[cat] || cat)}</td><td class="num">${RD$(v)}</td></tr>`).join('')}</tbody></table>`
          : `<div class="vacio">Sin gastos este mes.</div>`}
      </div>
      <div class="card">
        <h3>Principales deudores</h3>
        ${f.topDeudores && f.topDeudores.length
          ? `<table><thead><tr><th>Inquilino</th><th class="num">Debe</th></tr></thead>
             <tbody>${f.topDeudores.map((d) => `<tr><td>${esc(d.nombre)}</td><td class="num"><b style="color:var(--rosado)">${RD$(d.monto)}</b></td></tr>`).join('')}</tbody></table>`
          : `<div class="vacio">Nadie debe 🎉</div>`}
        ${f.aging ? `<div class="detalle" style="margin-top:8px;color:var(--texto-suave)">Atraso: 1–30 días ${RD$(f.aging.totalMes1, 0)} · 31–60 ${RD$(f.aging.totalMes2, 0)} · 60+ ${RD$(f.aging.totalMes3plus, 0)}</div>` : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Recibos del mes (${k.recibos || 0})</h3>
      ${f.recibos && f.recibos.length
        ? `<div class="tabla-scroll"><table>
            <thead><tr><th>Recibo</th><th>Fecha</th><th>Inquilino</th><th>Estudio</th><th>Método</th><th class="num">Monto</th><th></th></tr></thead>
            <tbody>${pgRec.filas.map((r) => `<tr>
              <td><b>${esc(r.numero)}</b></td>
              <td>${esc(r.fecha || '—')}</td>
              <td>${esc(r.inquilino_nombre || '—')}</td>
              <td>${esc(r.estudio_nombre || '—')}</td>
              <td>${r.metodo ? esc(METODO_ETIQ[r.metodo] || r.metodo) : '—'}</td>
              <td class="num">${RD$(r.monto)}</td>
              <td style="text-align:right">
                ${r.alquiler_id ? `<button class="btn pequeño secundario" onclick="exportarRecibo(${r.alquiler_id})">Reimprimir</button> <button class="btn pequeño peligro" onclick="anularReciboUI(${r.alquiler_id})">Anular</button>` : ''}
              </td></tr>`).join('')}</tbody>
          </table></div>
          ${paginadorHTML('reporte-recibos', pgRec)}`
        : `<div class="vacio">No hay recibos emitidos en ${etiqMes(mesActual)}.</div>`}
    </div>

    <div class="card">
      <h3>Tendencia (últimos 6 meses) <span class="detalle" style="font-weight:400">
        <span class="badge pagada">■ Cobrado</span> <span class="badge vencida">■ Gastos</span></span></h3>
      ${graficaTendencia(f.tendencia || [])}
    </div>`;
  const a = modo === 'anual' ? (await window.api.reporteAnual(anioSel)).data : null;
  $('#content').innerHTML = `
    <div class="btn-row" style="margin-bottom:16px">
      <div class="segment">
        <button type="button" class="seg${modo === 'mensual' ? ' activo' : ''}" onclick="cambiarModoReporte('mensual')">Mensual</button>
        <button type="button" class="seg${modo === 'anual' ? ' activo' : ''}" onclick="cambiarModoReporte('anual')">Anual</button>
      </div>
      <span style="flex:1"></span>
      ${modo === 'anual'
        ? `<select id="anio-filtro" onchange="window.__anioReporte=Number(this.value);viewReporte()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
             ${aniosDispon.map((y) => `<option value="${y}" ${Number(anioSel) === y ? 'selected' : ''}>Año ${y}</option>`).join('')}
           </select>
           <button class="btn" onclick="exportarPDF('anual', { anio: window.__anioReporte || ${new Date().getFullYear()} })">PDF del año</button>
           <button class="btn secundario" onclick="exportarDato('anual','xlsx',{ anio: window.__anioReporte || ${new Date().getFullYear()} })">Excel</button>
           <button class="btn secundario" onclick="exportarDato('anual','csv',{ anio: window.__anioReporte || ${new Date().getFullYear()} })">CSV</button>`
        : `${selectorMes()}
           <button class="btn" onclick="exportarPDF('financiero')">PDF del mes</button>
           <button class="btn secundario" onclick="exportarDato('financiero','xlsx')">Excel</button>
           <button class="btn secundario" onclick="exportarDato('financiero','csv')">CSV</button>`}
    </div>
    ${modo === 'anual' ? cuerpoReporteAnual(a, anioSel) : cuerpoMensual}`;
}

function cuerpoReporteAnual(a, anioSel) {
  const at = a.totales || {};
  const cmp = a.comparativa || {};
  const pctTxt = (v) => (v === null || v === undefined) ? '—' : (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v) + '% vs año anterior';
  return `
    <div class="card" style="margin-bottom:16px">
      <h3>📅 Resumen del año ${anioSel} <span class="detalle" style="font-weight:400">comparado con ${cmp.anioPrev || Number(anioSel) - 1}</span></h3>
      <div class="grid grid-4" style="margin-bottom:12px">
        <div class="card kpi positivo"><div class="label">Recaudado en el año</div><div class="valor">${RD$(at.cobrado)}</div><div class="sub">${pctTxt(cmp.diffCobradoPct)}</div></div>
        <div class="card kpi"><div class="label">Gastos</div><div class="valor">${RD$(at.gastos)}</div><div class="sub">${pctTxt(cmp.diffGastosPct)}</div></div>
        <div class="card kpi ${Number(at.neto) >= 0 ? 'positivo' : 'negativo'}"><div class="label">Ganancia neta del año</div><div class="valor">${RD$(at.neto)}</div><div class="sub">${pctTxt(cmp.diffNetoPct)}</div></div>
        <div class="card kpi"><div class="label">Por cobrar anual</div>
          <div class="valor" style="${Number(at.porCobrarAnual) > 0 ? 'color:var(--rosado)' : ''}">${RD$(at.porCobrarAnual)}</div>
          <div class="sub">cuota total − recaudado</div></div>
      </div>
      <div class="detalle" style="margin-bottom:10px">
        <b>Cuota generada:</b> ${RD$(at.cuota)} · <b>Recibos:</b> ${at.recibos || 0} (${RD$(at.montoRecibos)}) · <b>Ocupación promedio:</b> ${at.ocupacionPromedio || 0}%
      </div>
      <table>
        <thead><tr><th>Mes</th><th class="num">Cuota</th><th class="num">Cobrado</th><th class="num">Gastos</th><th class="num">Neto</th></tr></thead>
        <tbody>${(a.meses || []).map((m) => `<tr>
          <td><b>${etiqMes(m.mes)}</b></td>
          <td class="num">${RD$(m.cuota, 0)}</td>
          <td class="num" style="color:var(--verde)">${RD$(m.cobrado, 0)}</td>
          <td class="num">${RD$(m.gastos, 0)}</td>
          <td class="num"><b style="color:${Number(m.neto) >= 0 ? 'var(--verde)' : 'var(--rosado)'}">${RD$(m.neto, 0)}</b></td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function exportarPDF(tipo, extra) {
  const hoy = hoyISO();
  const archivos = { resumen: 'resumen', cobros: 'cobros', gastos: 'gastos', aging: 'aging', rentabilidad: 'rentabilidad', financiero: 'financiero', anual: 'anual' };
  const r = await window.api.pdfExport(tipo, { ...(extra || {}), mes: mesActual, filename: archivos[tipo] + '-' + hoy + '.pdf' });
  if (r.ok) toast('PDF exportado');
  else toast(r.error || 'No se pudo exportar el PDF', 'error');
}
async function exportarDato(tipo, formato, extra) {
  const r = await window.api.exportDato(tipo, formato, { ...(extra || {}), mes: mesActual });
  if (r.ok) toast('Archivo exportado');
  else if (r.error !== 'cancelado') toast(r.error || 'No se pudo exportar', 'error');
}

// ============================================================
//                    ROUTER
// ============================================================

async function visualizar() {
  await loadBasicos();
  try {
    switch (vistaActual) {
      case 'dashboard': return viewDashboard();
      case 'estudios': return viewEstudios();
      case 'inquilinos': return viewInquilinos();
      case 'cobros': return viewCobros();
      case 'cxp': return viewCxp();
      case 'proveedores': return viewProveedores();
      case 'calendario': return viewCalendario();
      case 'flujo': return viewFlujo();
      case 'contratos': return viewContratos();
      case 'gastos': return viewGastos();
      case 'reporte': return viewReporte();
      case 'estadisticas': return viewEstadisticas();
      case 'mantenimiento': return viewMantenimiento();
      case 'auditoria': return viewAuditoria();
      case 'empresa': return viewEmpresa();
    }
  } catch (err) {
    console.error(err);
    toast('Error al abrir la vista: ' + (err && err.message), 'error');
  }
}
function vista(nombre) { vistaActual = nombre; visualizar(); }

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (nav) vista(nav.dataset.vista || nav.dataset.view);
});

// ============================================================
//              FASE 2: CUENTAS POR PAGAR
// ============================================================
async function viewCxp() {
  vistaActual = 'cxp';
  titulo('Cuentas por pagar');
  const f = window.__cxpFiltro || {};
  const cxp = (await window.api.cuentasPagarList({ estado: f.estado || '', categoria: f.categoria || '', pendientes: f.pendientes ? true : undefined })).data || [];
  const pendientes = cxp.filter((c) => c.estado === 'pendiente');
  const pg = paginar('cxp', cxp);
  const totalPendiente = pendientes.reduce((s, c) => s + Number(c.monto), 0);
  const porMoneda = {};
  pendientes.forEach((c) => { porMoneda[c.moneda] = round2sum(porMoneda[c.moneda], c.monto); });
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formCuentaPagar()">+ Nueva cuenta</button>
      <button class="btn secundario" onclick="exportarDato('cxp','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('cxp','csv')">CSV</button>
      <select id="cxp-filtro-est" onchange="setCxpFiltro('estado',this.value)" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="" ${!f.estado ? 'selected' : ''}>Todos los estados</option>
        <option value="pendiente" ${f.estado === 'pendiente' ? 'selected' : ''}>Pendientes</option>
        <option value="pagada" ${f.estado === 'pagada' ? 'selected' : ''}>Pagadas</option>
        <option value="cancelada" ${f.estado === 'cancelada' ? 'selected' : ''}>Canceladas</option>
      </select>
      <select id="cxp-filtro-cat" onchange="setCxpFiltro('categoria',this.value)" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="">Todas las categorías</option>
        ${Object.entries(CATEG_CXP_ETIQ).map(([k, v]) => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <span style="flex:1"></span>
      <span class="detalle" style="align-self:center">${pendientes.length} pendientes · ${Object.entries(porMoneda).map(([k, v]) => `<b>${k} ${fmt(v)}</b>`).join(' · ')}</span>
    </div>
    <div class="card">
      ${cxp.length
        ? `<div class="tabla-scroll"><table>
            <thead><tr><th>Vence</th><th>Categoría</th><th>Concepto</th><th>Proveedor</th><th>Propiedad</th><th class="num">Monto</th><th>Estado</th><th>Forma de pago</th><th></th></tr></thead>
            <tbody>${pg.filas.map((c) => `<tr>
              <td>${esc(c.fecha_vencimiento || '—')}${c.vencida ? ' <span class="badge vencida">vencida</span>' : ''}</td>
              <td><span class="badge pendiente">${CATEG_CXP_ETIQ[c.categoria] || c.categoria}</span></td>
              <td><b>${esc(c.concepto || '—')}</b>${c.notas ? `<div class="detalle" style="font-size:11px">${esc(c.notas)}</div>` : ''}</td>
              <td>${esc(c.proveedor_nombre || '—')}</td>
              <td>${esc(c.estudio_nombre || '—')}</td>
              <td class="num"><b ${c.estado === 'pendiente' && c.vencida ? 'style="color:var(--rosado)"' : ''}>${MN$(c.monto, c.moneda)}</b>${c.comprobante ? `<div class="detalle" style="font-size:11px">📎 ${esc(c.comprobante)}</div>` : ''}</td>
              <td><span class="badge ${ESTADO_CXP_CLS[c.estado]}">${ESTADO_CXP_ETIQ[c.estado] || c.estado}</span></td>
              <td>${c.metodo_pago ? esc(METODO_ETIQ[c.metodo_pago] || c.metodo_pago) + (c.fecha_pago ? ' <span class="detalle" style="font-size:11px">' + esc(c.fecha_pago) + '</span>' : '') : '—'}</td>
              <td style="text-align:right">
                ${c.estado === 'pendiente'
                  ? `<button class="btn pequeño" onclick="pagarCuentaUI(${c.id})">✓ Pagar</button> <button class="btn pequeño secundario" onclick="formCuentaPagar(${c.id})">Editar</button> <button class="btn pequeño secundario" onclick="cancelarCuentaUI(${c.id})">Cancelar</button>`
                  : ''}
                ${c.estado === 'cancelada' || c.estado === 'pendiente' ? `<button class="btn pequeño peligro" onclick="borrarCuentaUI(${c.id})">Eliminar</button>` : ''}
              </td></tr>`).join('')}</tbody></table></div>
          ${paginadorHTML('cxp', pg)}`
        : `<div class="vacio">Sin cuentas por pagar. Usa "+ Nueva cuenta" para registrar un compromiso de pago a futuro.</div>`}
    </div>`;
}
function round2sum(a, b) { return Math.round((Number(a || 0) + Number(b)) * 100) / 100; }
function setCxpFiltro(campo, valor) {
  const f = window.__cxpFiltro || {};
  f[campo] = valor;
  window.__cxpFiltro = f;
  __pag.cxp = 1;
  viewCxp();
}
function formCuentaPagar(idFila) {
  (async () => {
    const proveedores = (await window.api.proveedoresList('')).data || [];
    const estudios = (await window.api.estudiosList('')).data || [];
    const fila = idFila ? (await window.api.cuentasPagarGet(idFila)).data : null;
    if (idFila && !fila) return toast('Cuenta no encontrada', 'error');
    modal(fila ? 'Editar cuenta por pagar' : 'Nueva cuenta por pagar', `
      <form onsubmit="guardarCuentaPagar(event${fila ? ', ' + fila.id : ''})">
        <div class="form-grid">
          <div class="campo"><label>Proveedor</label>
            <select id="cxp-proveedor"><option value="">— seleccionar —</option>
              ${proveedores.map((p) => `<option value="${p.id}" ${fila && Number(fila.proveedor_id) === Number(p.id) ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}
            </select></div>
          <div class="campo"><label>Categoría *</label>
            <select id="cxp-categoria">
              ${Object.entries(CATEG_CXP_ETIQ).map(([k, v]) => `<option value="${k}" ${fila && fila.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></div>
          <div class="campo"><label>Moneda *</label>
            <select id="cxp-moneda">${opcionesMoneda(fila && fila.moneda)}</select></div>
          <div class="campo"><label>Monto *</label><input id="cxp-monto" type="number" min="0.01" step="0.01" value="${fila ? fila.monto : ''}" required autofocus></div>
          <div class="campo"><label>Fecha de vencimiento</label><input id="cxp-vence" type="date" value="${fila && fila.fecha_vencimiento ? fila.fecha_vencimiento : ''}"></div>
          <div class="campo"><label>Propiedad (opcional)</label>
            <select id="cxp-estudio"><option value="">— general —</option>
              ${estudios.map((e) => `<option value="${e.id}" ${fila && Number(fila.estudio_id) === Number(e.id) ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
            </select></div>
        </div>
        <div class="campo"><label>Concepto *</label><input id="cxp-concepto" value="${esc(fila ? (fila.concepto || '') : '')}" placeholder="Ej. Factura EDEeste, Comisión banco…" required></div>
        <div class="campo"><label>Comprobante (opcional)</label><input id="cxp-comprobante" value="${esc(fila ? (fila.comprobante || '') : '')}" placeholder="Ej. No. de factura"></div>
        <div class="campo"><label>Notas</label><input id="cxp-notas" value="${esc(fila ? (fila.notas || '') : '')}"></div>
        <button class="btn" type="submit">${fila ? 'Guardar cambios' : 'Registrar cuenta'}</button>
      </form>`, '', 620);
  })();
}
async function guardarCuentaPagar(e, idFila) {
  e.preventDefault();
  const r = await window.api.cuentasPagarSave({
    id: idFila || null,
    proveedor_id: Number($('#cxp-proveedor').value) || null,
    categoria: $('#cxp-categoria').value,
    moneda: $('#cxp-moneda').value,
    monto: Number($('#cxp-monto').value) || 0,
    fecha_vencimiento: $('#cxp-vence').value,
    estudio_id: Number($('#cxp-estudio').value) || null,
    concepto: $('#cxp-concepto').value.trim(),
    comprobante: $('#cxp-comprobante').value.trim(),
    notas: $('#cxp-notas').value.trim()
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast(idFila ? 'Cuenta actualizada' : 'Cuenta registrada'); vista('cxp');
}
function pagarCuentaUI(id) {
  (async () => {
    const c = (await window.api.cuentasPagarGet(id)).data;
    if (!c) return toast('Cuenta no encontrada', 'error');
    modal('Pagar cuenta por pagar', `
      <div class="detalle" style="margin-bottom:10px">
        <b>${esc(c.concepto || 'Cuenta')}</b> · ${esc(c.proveedor_nombre || 'Proveedor')} · <b>${MN$(c.monto, c.moneda)}</b>
        <div class="detalle" style="color:var(--texto-suave)">Al pagar se registra automáticamente el gasto realizado.</div>
      </div>
      <form onsubmit="guardarPagoCuenta(event, ${id})">
        <div class="form-grid">
          <div class="campo"><label>Fecha de pago</label><input id="cp-fecha" type="date" value="${hoyISO()}"></div>
          <div class="campo"><label>Método de pago</label>
            <select id="cp-metodo">${opcionesMetodo()}</select></div>
        </div>
        <div class="campo"><label>Referencia (opcional)</label><input id="cp-ref" placeholder="Ej. NCF, última parte del No. de cuenta…"></div>
        <div class="detalle" style="margin:6px 0 12px;color:var(--texto-suave)">Se generará un registro de gasto con el monto indicado y quedará vinculado a esta cuenta.</div>
        <button class="btn" type="submit">Confirmar pago</button>
      </form>`, '', 520);
  })();
}
async function guardarPagoCuenta(e, id) {
  e.preventDefault();
  const r = await window.api.cuentasPagarPagar(id, $('#cp-fecha').value || hoyISO(), $('#cp-metodo').value, $('#cp-ref').value.trim());
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast('Cuenta pagada · gasto registrado ✓'); vista('cxp');
}
async function cancelarCuentaUI(id) {
  if (!confirm('¿Cancelar esta cuenta por pagar? No generará ningún gasto.')) return;
  const c = (await window.api.cuentasPagarGet(id)).data;
  const r = await window.api.cuentasPagarSave({ ...c, estado: 'cancelada' });
  if (!r.ok) return toast(r.error, 'error');
  toast('Cuenta cancelada'); vista('cxp');
}
async function borrarCuentaUI(id) {
  const c = (await window.api.cuentasPagarGet(id)).data;
  if (c && c.estado === 'pagada') return toast('Una cuenta pagada solo se elimina borrando el gasto vinculado', 'error');
  if (!confirm('¿Eliminar esta cuenta por pagar?')) return;
  const r = await window.api.cuentasPagarDelete(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Cuenta eliminada'); vista('cxp');
}

// ============================================================
//              FASE 2: PROVEEDORES
// ============================================================
async function viewProveedores() {
  vistaActual = 'proveedores';
  titulo('Proveedores');
  const provs = (await window.api.proveedoresList(window.__provQ || '')).data || [];
  const pg = paginar('prov', provs);
  $('#content').innerHTML = `
    <div class="btn-row">
      <button class="btn" onclick="formProveedor()">+ Nuevo proveedor</button>
      <button class="btn secundario" onclick="exportarDato('proveedores','xlsx')">Excel</button>
      <button class="btn secundario" onclick="exportarDato('proveedores','csv')">CSV</button>
      <input class="buscar" placeholder="Buscar por nombre, servicio, teléfono…" style="max-width:260px" value="${esc(window.__provQ || '')}" onchange="window.__provQ=this.value;__pag.prov=1;viewProveedores()">
      <span style="flex:1"></span>
      <span class="detalle" style="align-self:center">${provs.length} proveedores registrados</span>
    </div>
    <div class="card">
      ${provs.length
        ? `<div class="tabla-scroll"><table>
            <thead><tr><th>Nombre</th><th>Servicio</th><th>Teléfono</th><th>Correo</th><th class="num">Deuda pendiente</th><th></th></tr></thead>
            <tbody>${pg.filas.map((p) => `<tr>
              <td><b>${esc(p.nombre)}</b>${p.direccion ? `<div class="detalle" style="font-size:11px">${esc(p.direccion)}</div>` : ''}</td>
              <td>${esc(p.servicio || '—')}</td>
              <td>${esc(p.telefono || '—')}</td>
              <td>${esc(p.correo || '—')}</td>
              <td class="num">${Number(p.deuda_pendiente) > 0 ? `<b style="color:var(--rosado)">${MN$(p.deuda_pendiente, 'RD$')}</b>` : '<span style="color:var(--verde)">Al día</span>'}</td>
              <td style="text-align:right">
                <button class="btn pequeño secundario" onclick="proveedorCuentas(${p.id})">Cuentas</button>
                <button class="btn pequeño secundario" onclick="formProveedor(${p.id})">Editar</button>
                <button class="btn pequeño peligro" onclick="borrarProveedor(${p.id})">Eliminar</button>
              </td></tr>`).join('')}</tbody></table></div>
          ${paginadorHTML('prov', pg)}`
        : `<div class="vacio">Sin proveedores registrados. Los proveedores agrupan tus cuentas por pagar y gastos.</div>`}
    </div>`;
}
function formProveedor(idFila) {
  (async () => {
    const fila = idFila ? (await window.api.proveedoresGet(idFila)).data : null;
    if (idFila && !fila) return toast('Proveedor no encontrado', 'error');
    modal(fila ? 'Editar proveedor' : 'Nuevo proveedor', `
      <form onsubmit="guardarProveedor(event${fila ? ', ' + fila.id : ''})">
        <div class="form-grid">
          <div class="campo"><label>Nombre *</label><input id="pr-nombre" value="${esc(fila ? (fila.nombre || '') : '')}" required autofocus></div>
          <div class="campo"><label>Servicio</label><input id="pr-servicio" value="${esc(fila ? (fila.servicio || '') : '')}" placeholder="Ej. Plomería, pintura, electricidad…"></div>
          <div class="campo"><label>Teléfono</label><input id="pr-telefono" value="${esc(fila ? (fila.telefono || '') : '')}"></div>
          <div class="campo"><label>Correo</label><input id="pr-correo" type="email" value="${esc(fila ? (fila.correo || '') : '')}"></div>
        </div>
        <div class="campo"><label>Dirección</label><input id="pr-direccion" value="${esc(fila ? (fila.direccion || '') : '')}"></div>
        <div class="campo"><label>Notas</label><textarea id="pr-notas" rows="2">${esc(fila ? (fila.notas || '') : '')}</textarea></div>
        <button class="btn" type="submit">${fila ? 'Guardar cambios' : 'Registrar proveedor'}</button>
      </form>`, '', 540);
  })();
}
async function guardarProveedor(e, idFila) {
  e.preventDefault();
  const r = await window.api.proveedoresSave({
    id: idFila || null,
    nombre: $('#pr-nombre').value.trim(),
    servicio: $('#pr-servicio').value.trim(),
    telefono: $('#pr-telefono').value.trim(),
    correo: $('#pr-correo').value.trim(),
    direccion: $('#pr-direccion').value.trim(),
    notas: $('#pr-notas').value.trim()
  });
  if (!r.ok) return toast(r.error, 'error');
  cerrarModal(); toast(idFila ? 'Proveedor actualizado' : 'Proveedor registrado'); vista('proveedores');
}
async function borrarProveedor(id) {
  if (!confirm('¿Eliminar este proveedor?\n\nSolo se permite si no tiene cuentas por pagar pendientes.')) return;
  const r = await window.api.proveedoresDelete(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Proveedor eliminado'); vista('proveedores');
}
async function proveedorCuentas(id) {
  const p = (await window.api.proveedoresGet(id)).data;
  if (!p) return toast('Proveedor no encontrado', 'error');
  window.__reRenderModal = () => proveedorCuentas(id);
  const cuentas = p.cuentas || [];
  const pg = paginar('provcuentas', cuentas);
  modal('Cuentas de ' + p.nombre, `
    ${cuentas.length
      ? `<div class="tabla-scroll"><table>
          <thead><tr><th>Vence</th><th>Concepto</th><th class="num">Monto</th><th>Estado</th></tr></thead>
          <tbody>${pg.filas.map((cu) => `<tr>
            <td>${esc(cu.fecha_vencimiento || '—')}</td>
            <td>${esc(cu.concepto || '—')}</td>
            <td class="num">${MN$(cu.monto, cu.moneda)}</td>
            <td><span class="badge ${ESTADO_CXP_CLS[cu.estado]}">${ESTADO_CXP_ETIQ[cu.estado] || cu.estado}</span></td></tr>`).join('')}</tbody></table></div>
          ${paginadorHTML('provcuentas', pg)}`
      : `<div class="vacio">Sin cuentas registradas para este proveedor.</div>`}`,
    `<button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 640);
}

// ============================================================
//              FASE 2: CALENDARIO
// ============================================================
let __calMes = new Date().toISOString().slice(0, 7);
async function viewCalendario() {
  vistaActual = 'calendario';
  titulo('Calendario');
  const mesSel = __calMes;
  const eventos = (await window.api.calendarioEventos(mesSel + '-28')).data || [];
  const porDia = {};
  eventos.forEach((ev) => { (porDia[ev.fecha] = porDia[ev.fecha] || []).push(ev); });
  const [yy, mm] = mesSel.split('-').map(Number);
  const primerDia = new Date(yy, mm - 1, 1).getDay();
  const totalDias = new Date(yy, mm, 0).getDate();
  const hoyStr = hoyISO();
  const nombreDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  let celdas = '';
  for (let b = 0; b < primerDia; b++) celdas += `<div class="cal-vacio"></div>`;
  for (let d = 1; d <= totalDias; d++) {
    const fecha = `${mesSel.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    const evs = porDia[fecha] || [];
    const esHoy = fecha === hoyStr;
    celdas += `<div class="cal-dia ${esHoy ? 'hoy' : ''}">
      <div class="cal-num">${d}</div>
      ${evs.map((ev) => `<div class="cal-ev ${ev.estado === 'pagado' ? 'ok' : ev.estado === 'aviso' || ev.estado === 'vencida' ? 'alerta' : ev.estado === 'info' ? 'info' : 'pend'}" title="${esc(ev.titulo + ' · ' + (ev.subtitulo || '') + (ev.monto ? ' · ' + MN$(ev.monto, ev.moneda) : ''))}">
        ${ev.tipo === 'alquiler' ? '🏠' : ev.tipo === 'pago' ? '✅' : ev.tipo === 'cuenta' ? '🧾' : ev.tipo === 'contrato_fin' ? '📄' : ev.tipo === 'contrato' ? '🖊' : '🔧'} ${esc(ev.titulo || '')}${ev.monto ? ` <b>${MN$(ev.monto, ev.moneda, 0)}</b>` : ''}</div>`).join('')}
    </div>`;
  }
  const leyenda = [
    ['alerta', 'Vence / vencido'], ['info', 'Contrato'], ['pend', 'Pendiente'], ['ok', 'Pagado']
  ];
  $('#content').innerHTML = `
    <div class="btn-row">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn secundario pequeño" onclick="cambiarCalMes(-1)">◀</button>
        <span style="font-weight:700;min-width:170px;text-align:center">${etiqMes(mesSel)}</span>
        <button class="btn secundario pequeño" onclick="cambiarCalMes(1)">▶</button>
        <button class="btn secundario pequeño" onclick="volverCalHoy()">Hoy</button>
      </div>
      <span style="flex:1"></span>
      <span style="display:flex;gap:10px;align-items:center">${leyenda.map(([k, v]) => `<span style="display:flex;align-items:center;gap:5px;font-size:12px"><span class="cal-leyenda ${k}"></span>${v}</span>`).join('')}</span>
    </div>
    <div class="cal-grid">
      ${nombreDias.map((n) => `<div class="cal-head">${n}</div>`).join('')}
      ${celdas}
    </div>
    <div class="detalle" style="margin-top:10px;color:var(--texto-suave)">Vencimientos de alquiler y cuentas por pagar · pagos registrados · inicios y vencimientos de contrato · mantenimientos activos.</div>`;
}
function cambiarCalMes(d) {
  const [y, m] = __calMes.split('-').map(Number);
  const t = new Date(y, m - 1 + d, 1);
  __calMes = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  viewCalendario();
}
function volverCalHoy() { __calMes = hoyISO().slice(0, 7); viewCalendario(); }

// ============================================================
//              FASE 2: FLUJO DE CAJA
// ============================================================
async function viewFlujo() {
  vistaActual = 'flujo';
  titulo('Flujo de caja');
  const dias = window.__flujoDias || 30;
  const f = (await window.api.flujoCajaGet(dias)).data;
  $('#content').innerHTML = `
    <div class="btn-row">
      <span style="display:flex;gap:6px;align-items:center">
        ${FLUJO_DIAS.map((d) => `<button class="btn ${d === dias ? '' : 'secundario'} pequeño" onclick="window.__flujoDias=${d};viewFlujo()">${d} días</button>`).join('')}
      </span>
      <span style="flex:1"></span>
      <span class="detalle" style="align-self:center">Proyección del ${esc(f.desde)} al ${esc(f.hasta)}</span>
    </div>
    <div class="card">
      <h3>⚠️ Importante</h3>
      <div class="detalle">El <b>disponible</b> solo considera lo ya cobrado y pagado. Los <b>cobros esperados</b> son dinero que aún no has recibido: no se muestran como disponible. No se suman monedas distintas.</div>
    </div>
    <div class="grid grid-2">
      ${Object.entries(f.porMoneda || {}).map(([md, c]) => `
        <div class="card">
          <h3>${md} <span class="detalle" style="font-weight:400">(${md === 'RD$' ? 'Peso dominicano' : 'Dólar'})</span></h3>
          <div class="grid grid-2" style="margin-bottom:10px">
            <div class="card kpi positivo"><div class="label">Disponible hoy</div><div class="valor">${MN$(c.disponible, md, 0)}</div></div>
            <div class="card kpi ${c.proyectado < 0 ? 'negativo' : ''}"><div class="label">Proyectado ${dias}d</div><div class="valor">${MN$(c.proyectado, md, 0)}</div></div>
          </div>
          <table>
            <tbody>
              <tr><td>✅ Cobrado hasta hoy</td><td class="num">+ ${MN$(c.cobrado, md, 0)}</td></tr>
              <tr><td>🧩 Abonos (en cuotas parciales)</td><td class="num">+ ${MN$(c.abonado, md, 0)}</td></tr>
              <tr><td>💸 Gastos pagados hasta hoy</td><td class="num">− ${MN$(c.gastado, md, 0)}</td></tr>
              <tr><td style="border-top:1px solid var(--borde-suave)"><b>Disponible</b></td><td class="num" style="border-top:1px solid var(--borde-suave)"><b>${MN$(c.disponible, md, 0)}</b></td></tr>
              <tr><td>⏳ Cobros esperados (vence en ${dias} días)</td><td class="num">+ ${MN$(c.cobros_esperados, md, 0)}</td></tr>
              <tr><td>🧾 Cuentas por pagar en ${dias} días</td><td class="num">− ${MN$(c.cxp, md, 0)}</td></tr>
              <tr><td>📅 Gastos programados</td><td class="num">− ${MN$(c.gastos_programados, md, 0)}</td></tr>
              <tr><td style="border-top:1px solid var(--borde-suave)"><b>Proyectado</b></td><td class="num" style="border-top:1px solid var(--borde-suave)"><b style="color:${c.proyectado < 0 ? 'var(--rosado)' : 'var(--verde)'}">${MN$(c.proyectado, md, 0)}</b></td></tr>
            </tbody>
          </table>
        </div>`).join('') || '<div class="vacio">Sin movimientos en ninguna moneda.</div>'}
    </div>`;
}

// ============================================================
//              FASE 2: ALERTAS
// ============================================================
async function actualizarBadgeAlertas() {
  try {
    const r = (await window.api.alertasContar()).data;
    const b = $('#alerta-badge');
    if (!b) return;
    const n = Number(r && r.noLeidas) || 0;
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n > 0 ? 'flex' : 'none';
  } catch (_) {}
}
async function abrirAlertas() {
  const list = (await window.api.alertasList(false)).data || [];
  const r = (await window.api.alertasContar()).data || {};
  window.__reRenderModal = () => abrirAlertas();
  const TIPO_ETIQ = { alquiler_vencido: 'Alquiler vencido', alquiler_proximo: 'Vence pronto', cxp_vencida: 'Cuenta vencida', contrato_vence: 'Contrato por vencer', mantenimiento_pendiente: 'Mantenimiento', unidad_disponible: 'Unidad disponible' };
  const TIPO_CLS = { alquiler_vencido: 'vencida', cxp_vencida: 'vencida', mantenimiento_pendiente: 'parcial', alquiler_proximo: 'pendiente', contrato_vence: 'pendiente', unidad_disponible: 'parcial' };
  modal('Alertas', `
    ${list.length
      ? `<div class="alerta-lista">${list.map((a) => `<div class="alerta-item ${a.leida ? 'leida' : ''}">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(a.titulo)}</b><span class="badge ${TIPO_CLS[a.tipo] || 'pendiente'}">${TIPO_ETIQ[a.tipo] || a.tipo}</span></div>
            <div class="detalle" style="margin-top:3px">${esc(a.mensaje)}</div>
          </div>
          <button class="btn pequeño secundario" onclick="leerAlerta(${a.id})">Marcar leída</button>
        </div>`).join('')}</div>`
      : `<div class="vacio">Sin alertas. Todo en orden. 🎉</div>`}`,
    `<span class="detalle">${Number(r.noLeidas) || 0} sin leer</span><span style="flex:1"></span>
     ${list.some((a) => !a.leida) ? `<button class="btn secundario" onclick="leerTodasAlertas()">Marcar todas leídas</button>` : ''}
     <button class="btn" onclick="cerrarModal()">Cerrar</button>`, 620);
}
async function leerAlerta(id) {
  await window.api.alertasMarcarLeidas([id]);
  actualizarBadgeAlertas();
  abrirAlertas();
}
async function leerTodasAlertas() {
  const list = (await window.api.alertasList(false)).data || [];
  await window.api.alertasMarcarLeidas(list.map((a) => a.id));
  actualizarBadgeAlertas();
  abrirAlertas();
}

// ============================================================
//                    BUSCADOR GLOBAL (Ctrl+K)
// ============================================================

function abrirBuscador() {
  modal('Buscar en HABITIA', `
    <input id="buscador-input" class="buscar" placeholder="Estudio, inquilino, recibo, contrato, deuda…" autocomplete="off" style="width:100%;margin-bottom:10px" oninput="buscarGlobalUI(this.value)">
    <div id="buscador-resultados"></div>`, `
      <span class="detalle">Usa Ctrl+K para abrir y el botón × para cerrar</span>
      <span style="flex:1"></span>
      <button class="btn pequeño secundario" onclick="cerrarModal()">Cerrar</button>`, 680);
  setTimeout(() => { const i = $('#buscador-input'); if (i) i.focus(); }, 60);
}

async function buscarGlobalUI(q) {
  const box = $('#buscador-resultados');
  if (!box) return;
  const res = (await window.api.buscarGlobal(q)).data;
  if (!res) return;
  const grupo = (titulo, filas, html) => filas.length
    ? `<div style="margin-top:8px"><b class="detalle">${titulo}</b>${filas.map(html).join('')}</div>` : '';
  box.innerHTML =
    grupo('Estudios', res.estudios || [], (e) => `<div class="busc-item" onclick="irBuscador('estudios')">🏠 <b>${esc(e.nombre)}</b> <span class="detalle">${esc(e.direccion || '')} ${e.inquilino_nombre ? '· ' + esc(e.inquilino_nombre) : ''}</span></div>`) +
    grupo('Inquilinos', res.inquilinos || [], (i) => `<div class="busc-item" onclick="verFichaInquilino(${i.id});cerrarModal()">👤 <b>${esc(i.nombre)}</b> <span class="detalle">${esc(i.estudio_nombre || '')}${i.whatsapp ? ' · 📱' + esc(i.whatsapp) : ''}</span></div>`) +
    grupo('Deudas', res.deudas || [], (d) => `<div class="busc-item" onclick="cerrarModal();irACobrar('${d.mes}')">💸 <b>${esc(d.inquilino_nombre || '')}</b> ${esc(d.estudio_nombre || '')} · <b style="color:var(--rosado)">${RD$(Number(d.monto) - Number(d.abonado || 0))}</b> <span class="detalle">${etiqMes(d.mes)}</span></div>`) +
    grupo('Recibos', res.recibos || [], (r) => `<div class="busc-item" onclick="cerrarModal();irBuscadorRecibo(${r.id})">🧾 <b>${esc(r.numero)}</b> ${RD$(r.monto)} <span class="detalle">${esc(r.inquilino_nombre || '')} · ${esc(r.fecha)}</span></div>`) +
    grupo('Contratos', res.contratos || [], (c) => `<div class="busc-item" onclick="cerrarModal();vista('contratos')">📄 <b>#${c.id}</b> ${esc(c.estudio_nombre || '')} — ${esc(c.inquilino_nombre || '')} <span class="detalle">${c.estado}</span></div>`) +
    grupo('Mantenimiento', res.mantenimientos || [], (o) => `<div class="busc-item" onclick="cerrarModal();vista('mantenimiento')">🔧 <b>#${o.id}</b> ${esc(o.detalle || '')} <span class="detalle">${esc(o.estudio_nombre || '')}</span></div>`);
  if (!res.estudios.length && !res.inquilinos.length && !res.deudas.length && !res.recibos.length && !res.contratos.length && !res.mantenimientos.length) {
    box.innerHTML = q.trim() ? `<div class="vacio">Sin resultados para "${esc(q)}".</div>` : '<div class="vacio">Escribe para buscar en toda la aplicación.</div>';
  }
}
function irBuscador(vistaNombre) { cerrarModal(); vista(vistaNombre); }
function irACobrar(mes) { mesActual = mes; vista('cobros'); }
async function irBuscadorRecibo(id) {
  cerrarModal();
  toast('Recibo cargado en Cobros del mes');
  vista('cobros');
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
    e.preventDefault();
    abrirBuscador();
  }
});

// ============================================================
//              FASE 3 §5: AUDITORÍA
// ============================================================
const AUDIT_ICONO = { crear: '➕', editar: '✏️', archivar: '🗄', eliminar: '🗑', pago: '✅', abono: '💵', revertir: '↩️', gasto: '💸', pagar: '💳', terminar: '📄', actualizar: '🔄', iniciar: '🚀', respaldo: '🔄', restaurar: '📦', config: '⚙️', factura: '🧾' };
const AUDIT_ACCION_ETIQ = { crear: 'crear', editar: 'editar', archivar: 'archivar', eliminar: 'eliminar', pago: 'pago', abono: 'abono', revertir: 'revertir', gasto: 'gasto', pagar: 'pagar', terminar: 'terminar', actualizar: 'actualizar', iniciar: 'iniciar', respaldo: 'respaldo', restaurar: 'restaurar', config: 'config' };
const AUDIT_ACCION_CLS = { crear: 'pagada', editar: 'info_azul', archivar: 'parcial', eliminar: 'vencida', pago: 'pagada', abono: 'pagada', revertir: 'vencida', gasto: 'parcial', pagar: 'pagada', terminar: 'parcial', actualizar: 'info_azul', iniciar: '', respaldo: 'pagada', restaurar: 'parcial', config: '' };
const AUDIT_ENTIDAD_ETIQ = { alquiler: 'Cobro', estudio: 'Estudio', propiedad: 'Propiedad', inquilino: 'Inquilino', gastos: 'Gasto', contrato: 'Contrato', mantenimiento: 'Mantenimiento', proveedor: 'Proveedor', cuenta_pagar: 'Cuenta por pagar', empresa: 'Empresa', backup: 'Respaldo', seguridad: 'Seguridad' };
let __auditFiltro = {};
async function viewAuditoria() {
  vistaActual = 'auditoria';
  titulo('Auditoría');
  const f = window.__auditFiltro || {};
  const resumen = (await window.api.auditResumen()).data || {};
  const acciones = resumen.acciones || [];
  const logs = (await window.api.auditList({ accion: f.accion || '', entidad: f.entidad || '', q: f.q || '' })).data || [];
  const pg = paginar('auditoria', logs);
  $('#content').innerHTML = `
    <div class="btn-row">
      <input class="buscar" placeholder="Buscar en auditoría…" value="${esc(f.q || '')}" style="max-width:240px" onchange="window.__auditFiltro={accion:(window.__auditFiltro||{}).accion||'',entidad:(window.__auditFiltro||{}).entidad||'',q:this.value};__pag.auditoria=1;viewAuditoria()">
      <select id="aud-filtro-accion" onchange="window.__auditFiltro={accion:this.value,entidad:(window.__auditFiltro||{}).entidad||'',q:(window.__auditFiltro||{}).q||''};__pag.auditoria=1;viewAuditoria()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="">Toda acción</option>
        ${Object.entries(AUDIT_ACCION_ETIQ).map(([k, v]) => `<option value="${k}" ${f.accion === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <select id="aud-filtro-ent" onchange="window.__auditFiltro={accion:(window.__auditFiltro||{}).accion||'',entidad:this.value,q:(window.__auditFiltro||{}).q||''};__pag.auditoria=1;viewAuditoria()" style="border:1px solid var(--borde);border-radius:8px;padding:8px 10px;background:var(--fondo)">
        <option value="">Toda entidad</option>
        ${Object.entries(AUDIT_ENTIDAD_ETIQ).map(([k, v]) => `<option value="${k}" ${f.entidad === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <span style="flex:1"></span>
      <button class="btn secundario pequeño" onclick="verArchivados()">🗄 Archivos</button>
      <span class="detalle" style="align-self:center">${resumen.total} eventos · ${resumen.hoy} hoy</span>
    </div>
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card kpi"><div class="label">Eventos totales</div><div class="valor">${resumen.total}</div></div>
      <div class="card kpi"><div class="label">Hoy</div><div class="valor">${resumen.hoy}</div></div>
      <div class="card kpi"><div class="label">Pagos registrados</div><div class="valor">${(acciones.find((a) => a.accion === 'pago') || {}).n || 0}</div></div>
      <div class="card kpi"><div class="label">Gastos registrados</div><div class="valor">${(acciones.find((a) => a.accion === 'gasto') || {}).n || 0}</div></div>
    </div>
    <div class="card">
      ${logs.length
        ? `${acciones && acciones.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${acciones.slice(0, 8).map((a) => `<span class="badge ${AUDIT_ACCION_CLS[a.accion] || 'pendiente'}">${AUDIT_ACCION_ETIQ[a.accion] || a.accion}: <b>${a.n}</b></span>`).join('')}</div>` : ''}
        <div class="tabla-scroll"><table><thead><tr><th>Fecha y hora</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>Usuario</th></tr></thead>
          <tbody>${pg.filas.map((l) => `<tr>
            <td style="white-space:nowrap">${esc(l.fecha)}</td>
            <td><span class="badge ${AUDIT_ACCION_CLS[l.accion] || 'pendiente'}">${AUDIT_ACCION_ETIQ[l.accion] || esc(l.accion)}</span></td>
            <td>${AUDIT_ENTIDAD_ETIQ[l.entidad] || esc(l.entidad)}${l.entidad_id ? ` <span class="detalle">#${l.entidad_id}</span>` : ''}</td>
            <td>${esc(l.detalle || '—')}</td>
            <td>${esc(l.usuario || '—')}</td></tr>`).join('')}</tbody></table></div>
          ${paginadorHTML('auditoria', pg)}`
        : `<div class="vacio">Sin eventos. La auditoría registra automáticamente pagos, gastos, contratos, mantenimiento y más.</div>`}
    </div>`;
}

// ============================================================
//              FASE 3 §2: ESTADÍSTICAS
// ============================================================
function graficaSerie(puntos, cols, mn) {
  const W = 780, H = 240, padL = 58, padB = 26, padT = 14, padR = 18;
  const cW = W - padL - padR, cH = H - padT - padB;
  const serie = (k) => (puntos || []).map((p) => Number(p[k] || 0));
  const valores = [].concat(...cols.map((c) => serie(c.key)));
  const max = Math.max(0.0001, ...valores);
  const n = (puntos || []).length;
  const step = n > 1 ? cW / (n - 1) : 0;
  const X = (i) => padL + i * step;
  const Y = (v) => padT + cH - (cH * Number(v)) / max;
  const pathP = (k) => (puntos || []).map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join('');
  const pathA = (k) => {
    const pts = (puntos || []).map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ');
    return pts + ` L${(padL + (n - 1) * step).toFixed(1)},${(padT + cH).toFixed(1)} L${(padL).toFixed(1)},${(padT + cH).toFixed(1)} Z`;
  };
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Gráfica ${mn}">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#d0d7e2"/>
    <line x1="${padL}" y1="${padT + cH}" x2="${padL + cW}" y2="${padT + cH}" stroke="#d0d7e2"/>`;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    const yy = Y(v);
    s += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${padL + cW}" y2="${yy.toFixed(1)}" stroke="#eef1f6"/>`;
    s += `<text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#8a94a6">${fmt(v, 0)}</text>`;
  }
  cols.forEach((c) => { s += `<path d="${pathA(c.key)}" fill="${c.color}" fill-opacity="0.10"/>`; });
  cols.forEach((c) => { s += `<path d="${pathP(c.key)}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; });
  (puntos || []).forEach((p, i) => {
    s += `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#8a94a6">${etiqMesCorto(p.mes)}</text>`;
    cols.forEach((c) => {
      s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(p[c.key]).toFixed(1)}" r="2.4" fill="#fff" stroke="${c.color}" stroke-width="1.6"/>`;
    });
  });
  s += `<g transform="translate(${padL} ${H - 2})">
    ${cols.map((c, i) => `<g transform="translate(${i * 130} 0)">
      <rect x="0" y="-8" width="10" height="10" rx="2" fill="${c.color}"/>
      <text x="16" y="0" font-size="10" fill="#5b6472">${c.label}</text></g>`).join('')}</g>`;
  s += '</svg>';
  return s;
}
function graficaDonut(items, size) {
  const sz = size || 150, r = sz / 2 - 12, cx = sz / 2, cy = sz / 2, es = sz / 2;
  const total = Math.max(0.0001, items.reduce((s, i) => s + Number(i.value || 0), 0));
  const circ = 2 * Math.PI * r;
  let acum = 0, s = '';
  const segs = items.filter((i) => Number(i.value || 0) > 0);
  if (!segs.length) segs.push({ label: 'Sin datos', value: 1, color: '#d0d7e2' });
  segs.forEach((i) => {
    const frac = Number(i.value) / total;
    const dash = frac * circ;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i.color}" stroke-width="16"
      stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"
      stroke-dashoffset="${(-acum * circ).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acum += frac;
  });
  s += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="800" fill="#1c2333">${fmt(total, 0)}</text>`;
  s += `<text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="9" fill="#8a94a6">unidades</text>`;
  s += `<g transform="translate(0 ${sz + 6})">${items.map((i, ix) => `<g transform="translate(0 ${ix * 18})">
    <rect x="${cx - es}" y="-8" width="10" height="10" rx="2" fill="${i.color}"/>
    <text x="${cx - es + 16}" y="0" font-size="10" fill="#5b6472">${esc(i.label)}: <tspan font-weight="700" fill="#1c2333">${fmt(i.value, 0)}</tspan></text></g>`).join('')}</g>`;
  return `<svg viewBox="0 ${(-6)} ${sz} ${sz + 6 + items.length * 18}" width="${sz + 20}" style="max-width:100%">${s}</svg>`;
}
const etiqMesCorto = (m) => {
  if (!m) return '';
  const [, mm] = String(m).split('-');
  if (!mm) return String(m);
  return ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][Number(mm) - 1] || mm;
};
async function verArchivados() {
  const a = (await window.api.archivadosList()).data || { estudio: [], inquilino: [], proveedor: [] };
  const sec = (titulo, icono, items, accion) => `<h3 style="margin:14px 0 6px">${icono} ${titulo} <span class="detalle">(${items.length})</span></h3>
    ${items.length
      ? `<table><tbody>${items.map((i) => `<tr>
           <td><b>${esc(i.nombre || '—')}</b>${i.direccion || i.telefono || i.edificio ? `<div class="detalle" style="font-size:11.5px">${esc(i.direccion || i.edificio || i.telefono || '')}</div>` : ''}</td>
           <td style="text-align:right">${accion ? `${accion(i)}` : ''}</td></tr>`).join('')}</tbody></table>`
      : `<div class="detalle">Sin registros archivados.</div>`}`;
  modal('Archivados (histórico)', `
    <p class="detalle">Los borrados no se eliminan: los registros quedan <b>archivados</b> para conservar el historial. Aquí puedes consultarlos.</p>
    ${sec('Estudios', '🏠', a.estudio, (i) => `<button class="btn pequeño secundario" onclick="cerrarModal();verHistorialEstudio(${i.id})">Historial</button>`)}
    ${sec('Inquilinos', '👤', a.inquilino, () => '')}
    ${sec('Proveedores', '🛠️', a.proveedor, () => '')}`, `
    <button class="btn secundario" onclick="cerrarModal()">Cerrar</button>`, 620);
}
const CATEG_COLOR = { agua: '#0ea5e9', luz: '#f59e0b', internet: '#8b5cf6', gas: '#f97316', impuesto_sep: '#64748b', seguro: '#14b8a6', mantenimiento: '#e11d48', otros: '#94a3b8' };
async function viewEstadisticas() {
  vistaActual = 'estadisticas';
  titulo('Estadísticas');
  const n = Number(window.__estMes || 12) || 12;
  const e = (await window.api.estadisticasGet(n)).data;
  const monedas = Object.keys(e.seriePorMoneda || {});
  const mn = window.__estMoneda && monedas.includes(window.__estMoneda) ? window.__estMoneda : (e.monedaPrincipal || monedas[0] || 'RD$');
  const serie = (e.seriePorMoneda || {})[mn] || [];
  const tot = (e.totales || {})[mn] || {};
  const montoTotalLabel = mn;
  const moroBUCK = [['mes0', '30 días', 'parcial'], ['mes1', '60 días', 'pendiente'], ['mes2', '90 días', 'vencida'], ['mes3plus', '90+ días', 'vencida']];
  const maxMoro = Math.max(0.0001, e.morosidad.mes0, e.morosidad.mes1, e.morosidad.mes2, e.morosidad.mes3plus);
  const ocupT = e.ocupacion ? Number(e.ocupacion.total || 0) : 0;
  const ocupD = e.ocupacion ? Number(e.ocupacion.disponible || 0) : 0;
  const ocupO = e.ocupacion ? Number(e.ocupacion.ocupado || 0) : 0;
  const rend = e.rendimiento || {};
  $('#content').innerHTML = `
    <div class="btn-row" style="margin-bottom:14px">
      <span class="detalle" style="align-self:center">Rango:</span>
      ${[3, 6, 12, 24].map((m) => `<button class="btn ${m === n ? '' : 'secundario'} pequeño" onclick="window.__estMes=${m};vista('estadisticas')">${m}m</button>`).join(' ')}
      ${monedas.length > 1 ? `<span class="detalle" style="align-self:center;margin-left:14px">Moneda:</span>
        ${monedas.map((m) => `<button class="btn ${m === mn ? '' : 'secundario'} pequeño" onclick="window.__estMoneda='${m}';vista('estadisticas')">${m}</button>`).join(' ')}` : ''}
      <span style="flex:1"></span>
      <button class="btn secundario pequeño" onclick="exportarEstadisticasCSV()">⬇ CSV</button>
    </div>
    <div class="grid grid-4">
      <div class="card kpi"><div class="label">Renta promedio</div><div class="valor">${MN$(rend.rentaPromedio || 0, mn, 0)}</div><div class="detalle">por estudio</div></div>
      <div class="card kpi"><div class="label">Tasa de cobro (mes)</div><div class="valor">${fmt(rend.tasaCobroMes || 0, 0)}%</div><div class="detalle">cobrado sobre facturado</div></div>
      <div class="card kpi"><div class="label">Ocupación</div><div class="valor">${fmt(rend.ocupados || 0, 0)} / ${fmt(rend.estudios || 0, 0)}</div><div class="detalle">estudios</div></div>
      <div class="card kpi"><div class="label">Cobrado promedio/mes</div><div class="valor">${MN$(rend.cobradoPromedio || 0, mn, 0)}</div><div class="detalle">últimos ${n} meses · ${mn}</div></div>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <h3>Evolución ${n} meses · ${mn} <span class="detalle" style="font-weight:400">(cobrado, gastos y utilidad)</span></h3>
        ${graficaSerie(serie, [
          { key: 'cobrado', color: '#16a34a', label: 'Cobrado' },
          { key: 'gastos', color: '#e11d48', label: 'Gastos' },
          { key: 'utilidad', color: '#2563eb', label: 'Utilidad' }
        ], mn)}
      </div>
      <div class="card">
        <h3>Resumen del período · ${mn}</h3>
        <table><tbody>
          <tr><td>Facturado (${n} meses)</td><td class="num"><b>${MN$(tot.facturado || 0, mn, 0)}</b></td></tr>
          <tr><td>Cobrado</td><td class="num"><b style="color:var(--verde)">${MN$(tot.cobrado || 0, mn, 0)}</b></td></tr>
          <tr><td>Pendiente por cobrar</td><td class="num"><b style="color:var(--rosado)">${MN$(tot.pendiente || 0, mn, 0)}</b></td></tr>
          <tr><td>Gastos</td><td class="num"><b style="color:var(--rosado)">${MN$(tot.gastos || 0, mn, 0)}</b></td></tr>
          <tr><td>Utilidad neta estimada</td><td class="num"><b style="color:${(tot.utilidad || 0) >= 0 ? 'var(--verde)' : 'var(--rosado)'}">${MN$(tot.utilidad || 0, mn, 0)}</b></td></tr>
        </tbody></table>
        ${monedas.length > 1 ? `<div class="detalle" style="margin-top:10px">Otras monedas: ${monedas.filter((m) => m !== mn).map((m) => `${m} ${fmt((e.totales || {})[m] ? (e.totales)[m].cobrado : 0, 0)}`).join(' · ')}</div>` : ''}
      </div>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <h3>Morosidad por antigüedad</h3>
        ${e.morosidad.total > 0
          ? `<div style="display:flex;flex-direction:column;gap:10px">
              ${moroBUCK.map(([k, etiq, cls]) => `<div>
                <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                  <span>${etiq} ${k === 'mes0' ? '(vencen este mes)' : ''}</span>
                  <b>${MN$(e.morosidad[k] || 0, mn, 0)}</b>
                </div>
                <div style="height:12px;background:var(--gris-fondo);border-radius:6px;overflow:hidden">
                  <div style="width:${Math.round(((e.morosidad[k] || 0) / maxMoro) * 100)}%;height:100%;background:${k === 'mes3plus' || k === 'mes2' ? 'var(--rosado)' : 'var(--azul)'};border-radius:6px"></div>
                </div>
              </div>`).join('')}
              <div class="detalle">${e.morosidad.deudores} deudores · ${e.morosidad.filas} cuotas con saldo pendiente · total ${MN$(e.morosidad.total || 0, mn, 0)}</div>
            </div>`
          : `<div class="vacio">Sin morosidad 🎉</div>`}
      </div>
      <div class="card" style="display:flex;flex-direction:column;align-items:center">
        <h3>Ocupación</h3>
        ${ocupT > 0 ? graficaDonut([
          { label: 'Ocupados', value: ocupO, color: '#16a34a' },
          { label: 'Disponibles', value: ocupD, color: '#f59e0b' }
        ], 160) : `<div class="vacio">Sin estudios registrados.</div>`}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Detalle mensual · ${mn}</h3>
      <div class="tabla-scroll"><table><thead><tr><th>Mes</th><th class="num">Facturado</th><th class="num">Cobrado</th><th class="num">Pendiente</th><th class="num">Gastos</th><th class="num">Utilidad</th></tr></thead>
        <tbody>${serie.map((p) => `<tr>
          <td>${etiqMesLargo(p.mes)}</td>
          <td class="num">${MN$(p.facturado || 0, mn, 0)}</td>
          <td class="num">${MN$(p.cobrado || 0, mn, 0)}</td>
          <td class="num" style="color:var(--rosado)">${MN$(p.pendiente || 0, mn, 0)}</td>
          <td class="num">${MN$(p.gastos || 0, mn, 0)}</td>
          <td class="num"><b style="color:${(p.utilidad || 0) >= 0 ? 'var(--verde)' : 'var(--rosado)'}">${MN$(p.utilidad || 0, mn, 0)}</b></td>
        </tr>`).join('')}</tbody></table></div>
    </div>`;
}
const etiqMesLargo = (m) => {
  if (!m) return '';
  const [aa, mm] = String(m).split('-');
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (nombres[Number(mm) - 1] || mm) + ' ' + aa;
};
async function exportarEstadisticasCSV() {
  const n = Number(window.__estMes || 12) || 12;
  const e = (await window.api.estadisticasGet(n)).data;
  const mn = e.monedaPrincipal || 'RD$';
  const serie = (e.seriePorMoneda || {})[mn] || [];
  const cols = ['Mes', 'Facturado', 'Cobrado', 'Pendiente', 'Gastos', 'Utilidad'];
  const filas = serie.map((p) => [p.mes, p.facturado, p.cobrado, p.pendiente, p.gastos, p.utilidad].join(','));
  const csv = 'sep=,\n' + cols.join(',') + '\n' + filas.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'estadisticas-' + mn + '-' + n + 'm.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
}

// ============================================================
//              FASE 3 §6: SEGURIDAD (bloqueo por PIN)
// ============================================================
let __pinActivo = false;
let __idleTimer = null;
let __resolverLock = null;
async function segIniciar() {
  try { __pinActivo = Boolean((await window.api.seguridadPinActivo()).data.activo); }
  catch (_) { __pinActivo = false; }
  if (__pinActivo) await segBloquearYEsperar();
  segReiniciarIdle();
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((ev) =>
    document.addEventListener(ev, segReiniciarIdle, { passive: true }));
}
function segReiniciarIdle() {
  if (__idleTimer) clearTimeout(__idleTimer);
  if (!__pinActivo) return;
  const min = Number(window.__segLockMin || 15) || 15;
  __idleTimer = setTimeout(() => { if (__pinActivo) segBloquear(); }, Math.max(1, min) * 60000);
}
function segBloquear() {
  if ($('#lock-overlay')) return;
  const root = $('#lock-root');
  root.innerHTML = `
    <div id="lock-overlay" class="lock-capa">
      <div class="lock-tarjeta">
        <div class="lock-logo">H</div>
        <div class="lock-titulo">HABITIA</div>
        <div class="lock-sub">Ingresa tu PIN para continuar</div>
        <div class="lock-pin" id="lock-pin">
          ${[0, 1, 2, 3, 4, 5].map((i) => `<span class="lock-dot" data-i="${i}"></span>`).join('')}
        </div>
        <div class="lock-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="lock-key" data-k="${n}">${n}</button>`).join('')}
          <button class="lock-key lock-key-sec" data-k="del">⌫</button>
          <button class="lock-key" data-k="0">0</button>
          <button class="lock-key lock-key-ok" data-k="ok">✓</button>
        </div>
        <div class="lock-err" id="lock-err"></div>
      </div>
    </div>`;
  let buf = '';
  const pintar = () => { document.querySelectorAll('#lock-pin .lock-dot').forEach((d, i) => d.classList.toggle('on', i < Math.min(buf.length, 6))); };
  const err = (m) => { const e = $('#lock-err'); if (e) { e.textContent = m || ''; setTimeout(() => { if (e.textContent === m) e.textContent = ''; }, 2500); } };
  const intentar = async () => {
    if (!buf) return;
    const r = await window.api.seguridadVerificarPin(buf);
    if (r.ok && r.data && r.data.ok) {
      __pinActivo = true;
      root.innerHTML = '';
      segReiniciarIdle();
      if (__resolverLock) { const fn = __resolverLock; __resolverLock = null; fn(); }
    } else {
      err('PIN incorrecto');
      buf = '';
      pintar();
    }
  };
  root.querySelectorAll('.lock-key').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'del') { buf = buf.slice(0, -1); pintar(); return; }
      if (k === 'ok') { intentar(); return; }
      if (buf.length < 6) { buf += k; pintar(); }
      if (buf.length === 6) setTimeout(intentar, 120);
    });
  });
  document.addEventListener('keydown', lockTeclado);
  function lockTeclado(e) {
    if (!$('#lock-overlay')) { document.removeEventListener('keydown', lockTeclado); return; }
    if (/^[0-9]$/.test(e.key) && buf.length < 6) { buf += e.key; pintar(); if (buf.length === 6) setTimeout(intentar, 120); }
    else if (e.key === 'Backspace') { buf = buf.slice(0, -1); pintar(); }
    else if (e.key === 'Enter') intentar();
  }
}
function segBloquearYEsperar() {
  return new Promise((resolve) => { __resolverLock = resolve; segBloquear(); });
}

// ============================================================
//                    INICIO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Barra lateral colapsable. El estado se recuerda entre sesiones.
  const sidebar = $('#sidebar');
  if (sidebar && localStorage.getItem('habitia_sidebar_colapsada') === '1') {
    sidebar.classList.add('colapsada');
  }
  const toggle = $('#sidebar-toggle');
  if (sidebar && toggle) {
    toggle.addEventListener('click', () => {
      const colapsada = sidebar.classList.toggle('colapsada');
      localStorage.setItem('habitia_sidebar_colapsada', colapsada ? '1' : '0');
    });
  }

  window.api.onDatosRecargados(() => {
    toast('Datos restaurados');
    loadBasicos().then(() => visualizar());
  });
  initUpdates();
  segIniciar().then(() => visualizar());
  // Asistente de primera ejecución (Fase 1). Nunca bloquea la app.
  setTimeout(() => { try { (window.PrimerVez || (() => {})).iniciar(); } catch (e) { console.error('Wizard primera vez:', e); } }, 600);
});