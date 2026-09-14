'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const negocio = require('./services/negocio');
const dbUtil = require('./services/db');
const reportes = require('./services/reportes');
const muestra = require('./services/muestra');

let mainWindow = null;
let db = null;
let dbFile = null;
let actualizando = false;
let saltoEstaVersion = false;

// ---------- Auto-actualización (GitHub Releases) ----------
function configurarAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const vActual = app.getVersion();
      mainWindow.webContents.send('update:status', { estado: 'disponible', version: info && info.version, versionActual: vActual });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:status', { estado: 'descargando', porciento: p.percent });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', { estado: 'listo', version: info && info.version });
    actualizando = true;
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:status', { estado: 'error', error: (err && err.message) || String(err) });
    }
    if (process.argv.includes('--smoke')) console.log('UPDATE ERROR:', (err && err.message) || err);
  });
}

// ---------- Segundo proceso (auto-update) ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function dataDir() {
  if (process.env.HABITIA_DATA_DIR) return process.env.HABITIA_DATA_DIR;
  if (app.isPackaged && process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
  }
  return path.join(app.getPath('userData'), 'data');
}
function dataFile() {
  return path.join(dataDir(), 'habitia.db');
}
function imgDir() {
  return path.join(dataDir(), 'img');
}

function noThrow(fn) {
  return async (_e, payload) => {
    try {
      const res = fn(payload);
      if (res && typeof res.then === 'function') return await res;
      return res;
    } catch (err) {
      return { ok: false, error: (err && err.message) || String(err) };
    }
  };
}

function ok(v) { return { ok: true, data: v }; }

function wrap(fn) {
  return noThrow(async (payload) => {
    return ok(await fn(payload));
  });
}

// Nombre del usuario que registra la operación (config impulsada desde la UI).
function usuarioActual() {
  return negocio.getConfig(db, 'usuario_actual') || 'Dueño';
}

// Persistencia: la DB vive en memoria (sql.js) y se vuelca a disco tras cada
// mutación (debounced) y al cerrar la app.
let saveTimer = null;
function agendarGuardado() {
  if (!db || !dbFile) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { dbUtil.save(db, dbFile); } catch (e) { console.error('Fallo al guardar DB:', e); }
  }, 600);
}
function mutar(fn) {
  return noThrow(async (payload) => {
    const res = await fn(payload);
    agendarGuardado();
    return ok(res);
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'HABITIA',
    backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    show: !process.argv.includes('--smoke'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Corrección (Windows): cuando la ventana recupera el foco, asegura que el
  // contenido lo tenga también; si no, el primer clic sobre un campo lo activa
  // pero no enfoca el cuadro de texto (hay que minimizar/restaurar para que
  // vuelva a funcionar).
  const devolverFoco = () => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.focus(); };
  mainWindow.on('focus', devolverFoco);
  mainWindow.on('show', devolverFoco);
  if (process.argv.includes('--smoke')) runSmoke();
}

// Modo "smoke": abre la app en segundo plano, captura errores del renderer
// y termina solo tras unos segundos, devolviendo código de salida 1 si falló.
function runSmoke() {
  let errores = [];
  mainWindow.webContents.on('console-message', (_e, nivel, mensaje) => {
    if (nivel === 3 || nivel === 'error') errores.push(String(mensaje));
  });
  mainWindow.webContents.on('render-process-gone', (_e, det) => {
    errores.push('renderer murió: ' + (det && det.reason));
  });
  mainWindow.webContents.on('did-fail-load', (_e, codigo, desc) => {
    errores.push('did-fail-load: ' + codigo + ' ' + desc);
  });
  setTimeout(() => {
    if (errores.length) {
      console.error('SMOKE ERRORES:');
      errorsParaLoguear(errores);
      app.exit(1);
    } else {
      console.log('SMOKE OK: renderer sin errores de consola.');
      app.exit(0);
    }
  }, 15000);
  // Recorrer todas las vistas para renderizarlas y capturar cualquier error.
  const vistas = ['estudios', 'inquilinos', 'contratos', 'gastos', 'cobros', 'mantenimiento', 'empresa', 'dashboard', 'reporte'];
  let i = 0;
  const vueltas = setInterval(() => {
    if (i >= vistas.length) {
      clearInterval(vueltas);
      mainWindow.webContents.executeJavaScript("window.__reporteModo='anual';vista('reporte')")
        .catch((e) => errores.push('reporte anual: ' + e.message));
      return;
    }
    const v = vistas[i++];
    mainWindow.webContents.executeJavaScript("vista('" + v + "')").catch((e) => errores.push('vista ' + v + ': ' + e.message));
  }, 1200);
  mainWindow.webContents.once('render-process-gone', (_e, det) => {
    clearInterval(vueltas);
    errores.push('renderer murió: ' + (det && det.reason));
  });
}
function errorsParaLoguear(errores) {
  for (const e of errores) console.error('  -', e);
}

// ---------- IPC: empresas ----------
ipcMain.handle('empresa:get', noThrow(() => negocio.getEmpresa(db)));
ipcMain.handle('empresa:save', mutar((d) => negocio.saveEmpresa(db, d)));

// ---------- IPC: estudios ----------
ipcMain.handle('estudios:list', wrap((d) => negocio.listEstudios(db, (d && d.q) || '')));
ipcMain.handle('gastosestudio:save', mutar((d) => negocio.saveGastosEstudio(db, (d && d.id) || 0, (d && d.lista) || [])));
ipcMain.handle('estudios:get', wrap((d) => negocio.getEstudio(db, d.id)));
ipcMain.handle('estudios:save', mutar((d) => negocio.saveEstudio(db, d)));
ipcMain.handle('estudios:delete', mutar((d) => { negocio.deleteEstudio(db, d.id); return true; }));
ipcMain.handle('estudios:historial', wrap((d) => negocio.historialEstudio(db, d.id)));
ipcMain.handle('estudios:foto', noThrow(async (d) => {
  const e = negocio.getEstudio(db, d.id);
  if (!e) return { ok: false, error: 'Estudio no encontrado' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar foto del estudio',
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  });
  if (canceled || !filePaths.length) return { ok: true, data: { cancelado: true } };
  const src = filePaths[0];
  const ext = (path.extname(src) || '.png').toLowerCase();
  fs.mkdirSync(imgDir(), { recursive: true });
  const nombre = 'estudio-' + e.id + ext;
  const dest = path.join(imgDir(), nombre);
  fs.copyFileSync(src, dest);
  if (e.foto && e.foto !== nombre) {
    try { fs.unlinkSync(path.join(imgDir(), e.foto)); } catch (err) { /* noop */ }
  }
  negocio.setEstudioFoto(db, e.id, nombre);
  agendarGuardado();
  return { ok: true, data: { foto: nombre } };
}));
ipcMain.handle('estudios:foto-data', noThrow((d) => {
  const e = negocio.getEstudio(db, d.id);
  if (!e || !e.foto) return { ok: true, data: null };
  const ruta = path.join(imgDir(), e.foto);
  if (!fs.existsSync(ruta)) return { ok: true, data: null };
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(e.foto).toLowerCase()] || 'image/png';
  return { ok: true, data: 'data:' + mime + ';base64,' + fs.readFileSync(ruta).toString('base64') };
}));
ipcMain.handle('estudios:foto-borrar', mutar((d) => {
  const e = negocio.getEstudio(db, d.id);
  if (e && e.foto) {
    try { fs.unlinkSync(path.join(imgDir(), e.foto)); } catch (err) { /* noop */ }
  }
  negocio.setEstudioFoto(db, d.id, '');
  return true;
}));
ipcMain.handle('edificios:resumen', wrap(() => negocio.resumenEdificios(db)));

// ---------- IPC: inquilinos ----------
ipcMain.handle('inquilinos:list', wrap((d) => negocio.listInquilinos(db, (d && d.q) || '')));
ipcMain.handle('inquilinos:get', wrap((d) => negocio.getInquilino(db, d.id)));
ipcMain.handle('inquilinos:save', mutar((d) => negocio.saveInquilino(db, d)));
ipcMain.handle('inquilinos:delete', mutar((d) => { negocio.deleteInquilino(db, d.id); return true; }));

// ---------- IPC: cobros ----------
ipcMain.handle('cobros:mes', wrap((d) => negocio.cobrosMes(db, (d && d.mes) || undefined)));
ipcMain.handle('cobros:marcar', mutar((d) => {
  negocio.marcarPago(db, d.id, d.pagado, d.fecha, {
    metodo: d.metodo, referencia: d.referencia, registrado_por: usuarioActual()
  });
  return true;
}));

// ---------- IPC: abonos (pagos parciales) ----------
ipcMain.handle('abonos:list', wrap((d) => negocio.abonosAlquiler(db, d.id)));
ipcMain.handle('abonos:add', mutar((d) => negocio.abonoAgregar(db, d.alquiler_id, d.monto, d.fecha, d.notas, {
  metodo: d.metodo, referencia: d.referencia, registrado_por: usuarioActual()
})));
ipcMain.handle('abonos:delete', mutar((d) => { negocio.abonoEliminar(db, d.id); return true; }));

// ---------- IPC: gastos ----------
ipcMain.handle('gastos:list', wrap((d) => negocio.listGastos(db, d || {})));
ipcMain.handle('gastos:save', mutar((d) => negocio.saveGasto(db, d)));
ipcMain.handle('gastos:delete', mutar((d) => { negocio.deleteGasto(db, d.id); return true; }));

// ---------- IPC: importación desde Excel ----------
const ALIAS_CAMPOS = {
  estudio: ['estudio', 'codigo', 'unidad', 'apartamento', 'apt'],
  direccion: ['direccion', 'ubicacion'],
  alquiler: ['alquiler', 'renta', 'monto', 'precio', 'cuota'],
  deposito: ['deposito', 'garantia'],
  inquilino: ['inquilino', 'arrendatario', 'nombre'],
  telefono: ['telefono', 'celular', 'cel'],
  whatsapp: ['whatsapp', 'wa']
};
function normalizarH(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function mapearEncabezados(ws) {
  const mapeo = {};
  const fila1 = (ws.getRow(1).values || []);
  fila1.forEach((v, i) => {
    const h = normalizarH(v);
    if (!h) return;
    for (const [clave, alias] of Object.entries(ALIAS_CAMPOS)) {
      if (mapeo[clave]) continue;
      const cuadra = alias.some((a) => h.includes(a));
      if (clave === 'inquilino' && h.includes('estudio')) continue;
      if (cuadra) mapeo[clave] = i;
    }
  });
  return (mapeo.estudio && Object.keys(mapeo).length >= 2) ? mapeo : null;
}
function filasDeHoja(ws, mapeo) {
  const filas = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const celdas = row.values || [];
    const fila = {};
    for (const [clave, idx] of Object.entries(mapeo)) fila[clave] = celdas[idx];
    if (String(fila.estudio || '').trim()) filas.push(fila);
  });
  return filas;
}
ipcMain.handle('import:estudios', noThrow(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar el Excel con los estudios',
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx'] }, { name: 'Todos los archivos', extensions: ['*'] }]
  });
  if (canceled || !filePaths.length) return { ok: true, data: { cancelado: true } };
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePaths[0]);
  const ws = wb.worksheets[0];
  const mapeo = mapearEncabezados(ws);
  if (!mapeo) return { ok: false, error: 'No encontré las columnas esperadas. Descarga la plantilla y copia tus datos ahí.' };
  const res = negocio.importarEstudios(db, filasDeHoja(ws, mapeo));
  agendarGuardado();
  return { ok: true, data: res };
}));
ipcMain.handle('import:plantilla', noThrow(async () => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Estudios');
  ws.addRow(['Estudio', 'Dirección', 'Alquiler', 'Depósito', 'Inquilino', 'Teléfono', 'WhatsApp']);
  ws.addRow(['Estudio 1', 'Calle X #1', 15000, 15000, 'Nombre del inquilino', '809-000-0000', '18090000000']);
  ws.addRow(['Estudio 2', 'Calle Y #2', 12000, '', '', '', '']);
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).eachCell((cell) => { cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
  ws.columns.forEach((c) => { c.width = 22; });
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar la plantilla de estudios',
    defaultPath: 'plantilla-estudios.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return { ok: false, error: 'cancelado' };
  await wb.xlsx.writeFile(filePath);
  return { ok: true, path: filePath };
}));

// ---------- IPC: reportes ----------
ipcMain.handle('reporte:resumen', wrap((d) => negocio.resumenMes(db, (d && d.mes) || undefined)));
ipcMain.handle('reporte:financiero', wrap((d) => negocio.reporteFinanciero(db, (d && d.mes) || undefined)));
ipcMain.handle('reporte:anual', wrap((d) => negocio.reporteAnual(db, (d && d.anio) || undefined)));
ipcMain.handle('reporte:tendencia', wrap((d) => negocio.tendencia(db, (d && d.meses) || 12)));

// ---------- IPC: configuración ----------
ipcMain.handle('config:get', wrap((d) => negocio.getConfig(db, d.clave)));
ipcMain.handle('config:set', mutar((d) => { negocio.setConfig(db, d.clave, d.valor); return true; }));

// ---------- IPC: auto-actualización ----------
ipcMain.handle('update:check', noThrow(async () => {
  if (!app.isPackaged) return { ok: true, data: { estado: 'dev' } };
  if (saltoEstaVersion) return { ok: true, data: { estado: 'omitido' } };
  try {
    const res = await autoUpdater.checkForUpdates();
    return { ok: true, data: { estado: 'revisado', info: res && res.updateInfo ? res.updateInfo : null } };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}));
ipcMain.handle('update:download', noThrow(async () => {
  if (saltoEstaVersion) saltoEstaVersion = false;
  try {
    autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}));
ipcMain.handle('update:install', noThrow(async () => {
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}));

// ---------- IPC: datos de ejemplo (para probar, siempre desechables) ----------
ipcMain.handle('muestra:seed', mutar(() => muestra.seedMuestra(db)));
ipcMain.handle('muestra:clear', mutar(() => muestra.clearMuestra(db)));
ipcMain.handle('muestra:estado', wrap(() => muestra.muestraEstado(db)));

// ---------- IPC: órdenes de mantenimiento ----------
ipcMain.handle('mantenimiento:list', wrap((d) => negocio.listOrdenes(db, d || {})));
ipcMain.handle('mantenimiento:save', mutar((d) => negocio.crearOrden(db, d)));
ipcMain.handle('mantenimiento:cerrar', mutar((d) => { negocio.cerrarOrden(db, d.id, d.costo || 0, d.notas); return true; }));
ipcMain.handle('mantenimiento:delete', mutar((d) => { negocio.deleteOrden(db, d.id); return true; }));
ipcMain.handle('mantenimiento:resumen-estudio', wrap((d) => negocio.resumenMantenimientoEstudio(db, d.id)));

// ---------- IPC: estado de cuenta por inquilino ----------
ipcMain.handle('estado-cuenta:get', wrap((d) => negocio.estadoCuentaInquilino(db, d.id)));
ipcMain.handle('estado-cuenta:pdf', noThrow(async (d) => {
  const estado = negocio.estadoCuentaInquilino(db, d.id);
  const buf = await reportes.reporteEstadoCuenta(negocio.getEmpresa(db), estado);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Estado de cuenta en PDF',
    defaultPath: 'Estado-de-cuenta-' + estado.inquilino.nombre.toLowerCase().replace(/\s+/g, '-') + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, error: 'cancelado' };
  await fs.promises.writeFile(filePath, Buffer.from(buf));
  return { ok: true, path: filePath };
}));

// ---------- IPC: exportación PDF ----------
ipcMain.handle('export:pdf', noThrow(async (payload) => {
  const empresa = negocio.getEmpresa(db);
  let buf;
  switch (payload.tipo) {
    case 'resumen': {
      const d = negocio.resumenMes(db, payload.mes);
      buf = await reportes.reporteResumen(empresa, d);
      break;
    }
    case 'cobros': {
      const c = negocio.cobrosMes(db, payload.mes);
      buf = await reportes.reporteCobros(empresa, c, payload.mes);
      break;
    }
    case 'gastos': {
      const g = negocio.listGastos(db, { mes: payload.mes });
      buf = await reportes.reporteGastos(empresa, g, payload.mes);
      break;
    }
    case 'aging': {
      const a = negocio.agingMes(db, payload.mes);
      buf = await reportes.reporteAging(empresa, a, payload.mes);
      break;
    }
    case 'rentabilidad': {
      buf = await reportes.reporteRentabilidad(empresa, negocio.rentabilidadEstudios(db));
      break;
    }
    case 'financiero': {
      buf = await reportes.reporteFinanciero(empresa, negocio.reporteFinanciero(db, payload.mes), payload.mes);
      break;
    }
    case 'anual': {
      const anio = parseInt(payload.anio, 10) || new Date().getFullYear();
      buf = await reportes.reporteAnual(empresa, negocio.reporteAnual(db, anio), anio);
      break;
    }
    case 'recibo': {
      const obj = payload.obj || {};
      buf = await reportes.reporteRecibo(empresa, obj.cobro || {}, obj.estudio || {}, obj.inquilino || {});
      break;
    }
    case 'contrato': {
      buf = await reportes.reporteContrato(empresa, payload.contrato || null, payload.estudio || {}, payload.inquilino || {});
      break;
    }
    case 'estado-cuenta': {
      const estado = negocio.estadoCuentaInquilino(db, payload.id);
      buf = await reportes.reporteEstadoCuenta(empresa, estado);
      break;
    }
    default:
      return { ok: false, error: 'tipo no soportado: ' + payload.tipo };
  }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar a PDF', defaultPath: payload.filename || 'reporte.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, error: 'cancelado' };
  await fs.promises.writeFile(filePath, Buffer.from(buf));
  return { ok: true, path: filePath };
}));

// ---------- IPC: fichas (estado + historial financiero) ----------
ipcMain.handle('ficha:inquilino', wrap((d) => negocio.fichaInquilino(db, d.id)));

// ---------- IPC: morosidad y ocupación ----------
ipcMain.handle('morosidad:detalle', wrap((d) => negocio.morosidadDetalle(db, d || {})));
ipcMain.handle('ocupacion:resumen', wrap(() => negocio.resumenOcupacion(db)));
ipcMain.handle('pendientes:centro', wrap(() => negocio.centroPendientes(db)));

// ---------- IPC: recibos numerados ----------
ipcMain.handle('recibos:anular', mutar((d) => negocio.anularRecibo(db, d.id)));

// ---------- IPC: contratos ----------
ipcMain.handle('contratos:list', wrap((d) => negocio.listarContratos(db, d || {})));
ipcMain.handle('contratos:get', wrap((d) => negocio.getContrato(db, d.id)));
ipcMain.handle('contratos:save', mutar((d) => negocio.saveContrato(db, d)));
ipcMain.handle('contratos:terminar', mutar((d) => negocio.terminarContrato(db, d.id)));
ipcMain.handle('contratos:delete', mutar((d) => negocio.eliminarContrato(db, d.id)));
ipcMain.handle('contratos:renovar', mutar((d) => negocio.renovarContrato(db, d.id, d.fecha_vencimiento, d.renta, d.duracion_meses)));
ipcMain.handle('contratos:por-vencer', wrap((d) => negocio.contratosPorVencer(db, (d && d.dias) || 30)));

// ---------- IPC: notas ----------
ipcMain.handle('notas:add', mutar((d) =>
  negocio.agregarNota(db, d.entidad, d.entidad_id, d.texto, usuarioActual())));
ipcMain.handle('notas:delete', mutar((d) => negocio.borrarNota(db, d.id)));

// ---------- IPC: WhatsApp (wa.me, sin API) ----------
ipcMain.handle('whatsapp:abrir', noThrow((d) => {
  const url = d.url;
  if (!/^https:\/\/wa\.me\//.test(url)) return { ok: false, error: 'URL de WhatsApp no válida' };
  shell.openExternal(url);
  return { ok: true };
}));

// ---------- IPC: buscador global (Ctrl+K) ----------
ipcMain.handle('buscar:global', wrap((d) => negocio.buscarGlobal(db, (d && d.q) || '')));

// ---------- IPC: backups ----------
// Los respaldos se guardan en una carpeta fácil de encontrar: Documentos\HABITIA\respaldos.
// Si no existe la carpeta Documentos (usuario redirigido), cae a la carpeta de datos normal.
function carpetaRespaldo() {
  try {
    const docs = app.getPath('documents');
    if (docs) return path.join(docs, 'HABITIA', 'respaldos');
  } catch (e) { /* noop */ }
  return path.join(dataDir(), 'respaldos');
}
// Mueve los respaldos que quedaron en la ruta antigua ( AppData\...\data\backups )
// a la carpeta nueva, para que el usuario los encuentre en Documentos.
function migrarBackups() {
  try {
    const vieja = path.join(dataDir(), 'backups');
    if (!fs.existsSync(vieja)) return;
    const nueva = carpetaRespaldo();
    fs.mkdirSync(nueva, { recursive: true });
    for (const f of fs.readdirSync(vieja).filter((x) => x.endsWith('.db'))) {
      const origen = path.join(vieja, f);
      const destino = path.join(nueva, f);
      if (!fs.existsSync(destino)) fs.renameSync(origen, destino);
      else try { fs.unlinkSync(origen); } catch (e) { /* noop */ }
    }
  } catch (e) { console.error('[backup] no se pudo migrar la carpeta antigua:', (e && e.message) || e); }
}
function crearArchivoBackup() {
  fs.mkdirSync(carpetaRespaldo(), { recursive: true });
  const ts = new Date();
  const nombre = 'habitia-' + ts.toISOString().slice(0, 10) + '_' +
    String(ts.getHours()).padStart(2, '0') + String(ts.getMinutes()).padStart(2, '0') +
    String(ts.getSeconds()).padStart(2, '0') + '.db';
  const ruta = path.join(carpetaRespaldo(), nombre);
  dbUtil.save(db, ruta);
  return ruta;
}
function listarBackups() {
  if (!fs.existsSync(carpetaRespaldo())) return [];
  return fs.readdirSync(carpetaRespaldo())
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const ruta = path.join(carpetaRespaldo(), f);
      const st = fs.statSync(ruta);
      return { nombre: f, ruta, fecha: st.mtime.toISOString(), tamano: st.size };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
function podarBackups() {
  const retencion = Number(negocio.getConfig(db, 'backup_retencion') || '30') || 30;
  const todos = listarBackups();
  const sobrantes = todos.slice(retencion);
  for (const b of sobrantes) {
    try { fs.unlinkSync(b.ruta); } catch (e) { /* noop */ }
  }
}
ipcMain.handle('backup:crear', mutar(() => {
  const ruta = crearArchivoBackup();
  podarBackups();
  return ruta;
}));
ipcMain.handle('backup:estado', wrap(() => {
  const lista = listarBackups();
  const ultimo = lista[0] || null;
  const hoyD = new Date().toISOString().slice(0, 10);
  return {
    carpeta: carpetaRespaldo(),
    lista: lista.slice(0, 40),
    ultimo,
    desactualizado: !ultimo || ultimo.fecha.slice(0, 10) !== hoyD,
    retencion: Number(negocio.getConfig(db, 'backup_retencion') || '30') || 30
  };
}));
ipcMain.handle('backup:retencion', mutar((d) => {
  const n = Number(d.retencion);
  const v = n >= 1 && n <= 365 ? String(n) : '30';
  negocio.setConfig(db, 'backup_retencion', v);
  podarBackups();
  return { ok: true, valor: v };
}));
ipcMain.handle('backup:carpeta', noThrow(() => { shell.openPath(carpetaRespaldo()); return true; }));
ipcMain.handle('backup:restaurar', noThrow(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar un backup de HABITIA',
    properties: ['openFile'],
    filters: [{ name: 'Backups HABITIA', extensions: ['db'] }, { name: 'Todos los archivos', extensions: ['*'] }]
  });
  if (canceled || !filePaths.length) return { ok: true, data: { cancelado: true } };
  const ruta = filePaths[0];
  const nueva = await dbUtil.openDb(ruta);
  const tiene = dbUtil.SCHEMA && (function () {
    const r = nueva.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('estudios','empresa','alquileres')");
    return r[0] && r[0].values && r[0].values.length >= 2;
  })();
  if (!tiene) return { ok: false, error: 'El archivo no parece ser una base de HABITIA válida.' };
  db = nueva;
  dbUtil.makeDb(db);
  dbUtil.save(db, dbFile);
  agendarGuardado();
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('app:data-reload');
  return { ok: true, data: { restaurado: true } };
}));

app.whenReady().then(() => {
  fs.mkdirSync(dataDir(), { recursive: true });
  dbFile = dataFile();
  dbUtil.openDb(dbFile).then((d) => {
    db = d;
    dbUtil.makeDb(db);
    // Limpia configs heredadas de la antigua conexión al teléfono, si quedaron.
    for (const k of ['web_on', 'web_port', 'web_pass', 'app_pass', 'seg_lock_min']) negocio.setConfig(db, k, '');
    crearAutoBackup();
    createWindow();
  });
  configurarAutoUpdater();
  setTimeout(() => {
    if (app.isPackaged && !saltoEstaVersion) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[update] no se pudo consultar actualizaciones:', (err && err.message) || err);
      });
    }
  }, 8000);
});

// Crear un backup al abrir si no existe uno del día de hoy.
function crearAutoBackup() {
  try {
    migrarBackups();
    const lista = listarBackups();
    const hoyD = new Date().toISOString().slice(0, 10);
    const hayHoy = lista.some((b) => b.fecha.slice(0, 10) === hoyD);
    if (!hayHoy) {
      crearArchivoBackup();
      podarBackups();
    }
  } catch (e) { console.error('[backup] no se pudo crear el backup de apertura:', (e && e.message) || e); }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (db && dbFile) {
    clearTimeout(saveTimer);
    try { dbUtil.save(db, dbFile); } catch (e) { console.error('Fallo al guardar DB al salir:', e); }
  }
});