const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onDatosRecargados: (cb) => ipcRenderer.on('app:data-reload', () => cb()),

  empresaGet: () => ipcRenderer.invoke('empresa:get'),
  empresaSave: (d) => ipcRenderer.invoke('empresa:save', d),

  estudiosList: (q) => ipcRenderer.invoke('estudios:list', { q }),
  estudioGastosSave: (id, lista) => ipcRenderer.invoke('gastosestudio:save', { id, lista }),
  estudiosGet: (id) => ipcRenderer.invoke('estudios:get', { id }),
  estudiosSave: (d) => ipcRenderer.invoke('estudios:save', d),
  estudiosDelete: (id) => ipcRenderer.invoke('estudios:delete', { id }),
  estudiosEdificios: () => ipcRenderer.invoke('edificios:resumen'),
  estudioHistorial: (id) => ipcRenderer.invoke('estudios:historial', { id }),
  estudioFoto: (id) => ipcRenderer.invoke('estudios:foto', { id }),
  estudioFotoData: (id) => ipcRenderer.invoke('estudios:foto-data', { id }),
  estudioFotoBorrar: (id) => ipcRenderer.invoke('estudios:foto-borrar', { id }),

  inquilinosList: (q) => ipcRenderer.invoke('inquilinos:list', { q }),
  inquilinosGet: (id) => ipcRenderer.invoke('inquilinos:get', { id }),
  inquilinosSave: (d) => ipcRenderer.invoke('inquilinos:save', d),
  inquilinosDelete: (id) => ipcRenderer.invoke('inquilinos:delete', { id }),

  cobrosMes: (mes) => ipcRenderer.invoke('cobros:mes', { mes }),
  cobrosMarcar: (id, pagado, fecha, metodo, referencia) =>
    ipcRenderer.invoke('cobros:marcar', { id, pagado, fecha, metodo, referencia }),

  abonosList: (alquilerId) => ipcRenderer.invoke('abonos:list', { id: alquilerId }),
  abonoAdd: (d) => ipcRenderer.invoke('abonos:add', d),
  abonoDelete: (id) => ipcRenderer.invoke('abonos:delete', { id }),

  gastosList: (d) => ipcRenderer.invoke('gastos:list', d),
  gastosSave: (d) => ipcRenderer.invoke('gastos:save', d),
  gastosDelete: (id) => ipcRenderer.invoke('gastos:delete', { id }),

  estudiosImport: () => ipcRenderer.invoke('import:estudios'),
  plantillaDescargar: () => ipcRenderer.invoke('import:plantilla'),

  reporteResumen: (mes) => ipcRenderer.invoke('reporte:resumen', { mes }),
  reporteFinanciero: (mes) => ipcRenderer.invoke('reporte:financiero', { mes }),
  reporteAnual: (anio) => ipcRenderer.invoke('reporte:anual', { anio }),
  reporteTendencia: (meses) => ipcRenderer.invoke('reporte:tendencia', { meses }),

  muestraSeed: () => ipcRenderer.invoke('muestra:seed'),
  muestraClear: () => ipcRenderer.invoke('muestra:clear'),
  muestraEstado: () => ipcRenderer.invoke('muestra:estado'),

  configGet: (clave) => ipcRenderer.invoke('config:get', { clave }),
  configSet: (clave, valor) => ipcRenderer.invoke('config:set', { clave, valor }),

  mantenimientoList: (opts) => ipcRenderer.invoke('mantenimiento:list', opts),
  mantenimientoSave: (d) => ipcRenderer.invoke('mantenimiento:save', d),
  mantenimientoCerrar: (id, costo, notas) => ipcRenderer.invoke('mantenimiento:cerrar', { id, costo, notas }),
  mantenimientoEstado: (id, estado, costo) => ipcRenderer.invoke('mantenimiento:estado', { id, estado, costo }),
  mantenimientoDelete: (id) => ipcRenderer.invoke('mantenimiento:delete', { id }),
  mantenimientoResumenEstudio: (id) => ipcRenderer.invoke('mantenimiento:resumen-estudio', { id }),

  estadoCuentaGet: (id) => ipcRenderer.invoke('estado-cuenta:get', { id }),
  estadoCuentaPdf: (id) => ipcRenderer.invoke('estado-cuenta:pdf', { id }),

  fichaInquilino: (id) => ipcRenderer.invoke('ficha:inquilino', { id }),
  morosidadDetalle: (filtro) => ipcRenderer.invoke('morosidad:detalle', filtro),
  ocupacionResumen: () => ipcRenderer.invoke('ocupacion:resumen'),
  centroPendientes: () => ipcRenderer.invoke('pendientes:centro'),

  recibosAnular: (id) => ipcRenderer.invoke('recibos:anular', { id }),

  contratosList: (filtros) => ipcRenderer.invoke('contratos:list', filtros),
  contratosGet: (id) => ipcRenderer.invoke('contratos:get', { id }),
  contratosSave: (d) => ipcRenderer.invoke('contratos:save', d),
  contratosTerminar: (id) => ipcRenderer.invoke('contratos:terminar', { id }),
  contratosDelete: (id) => ipcRenderer.invoke('contratos:delete', { id }),
  contratosRenovar: (id, fecha, renta, duracionMeses) => ipcRenderer.invoke('contratos:renovar', { id, fecha_vencimiento: fecha, renta, duracion_meses: duracionMeses }),
  contratosPorVencer: (dias) => ipcRenderer.invoke('contratos:por-vencer', { dias }),

  notasAdd: (entidad, entidadId, texto) => ipcRenderer.invoke('notas:add', { entidad, entidad_id: entidadId, texto }),
  notasDelete: (id) => ipcRenderer.invoke('notas:delete', { id }),

  proveedoresList: (q) => ipcRenderer.invoke('proveedores:list', { q }),
  proveedoresGet: (id) => ipcRenderer.invoke('proveedores:get', { id }),
  proveedoresSave: (d) => ipcRenderer.invoke('proveedores:save', d),
  proveedoresDelete: (id) => ipcRenderer.invoke('proveedores:delete', { id }),

  cuentasPagarList: (opts) => ipcRenderer.invoke('cxp:list', opts),
  cuentasPagarGet: (id) => ipcRenderer.invoke('cxp:get', { id }),
  cuentasPagarSave: (d) => ipcRenderer.invoke('cxp:save', d),
  cuentasPagarPagar: (id, fecha, metodo, referencia) => ipcRenderer.invoke('cxp:pagar', { id, fecha, metodo, referencia }),
  cuentasPagarDelete: (id) => ipcRenderer.invoke('cxp:delete', { id }),

  alertasList: (incluirLeidas) => ipcRenderer.invoke('alertas:list', { incluir_leidas: incluirLeidas }),
  alertasContar: () => ipcRenderer.invoke('alertas:contar'),
  alertasMarcarLeidas: (ids) => ipcRenderer.invoke('alertas:leidas', { ids }),
  alertasEliminar: (id) => ipcRenderer.invoke('alertas:eliminar', { id }),

  calendarioEventos: (mes) => ipcRenderer.invoke('calendario:eventos', { mes }),
  flujoCajaGet: (dias) => ipcRenderer.invoke('flujo:caja', { dias }),
  dashboardFinanciero: (mes) => ipcRenderer.invoke('dashboard:financiero', { mes }),
  auditList: (opts) => ipcRenderer.invoke('audit:list', opts),
  auditResumen: () => ipcRenderer.invoke('audit:resumen'),
  auditReciente: (limite) => ipcRenderer.invoke('audit:reciente', { limite }),
  archivadosList: () => ipcRenderer.invoke('archivados:list'),
  estadisticasGet: (meses) => ipcRenderer.invoke('estadisticas:get', { meses }),
  seguridadSetPin: (pin) => ipcRenderer.invoke('seguridad:setPin', { pin }),
  seguridadVerificarPin: (pin) => ipcRenderer.invoke('seguridad:verificarPin', { pin }),
  seguridadPinActivo: () => ipcRenderer.invoke('seguridad:pinActivo'),
  seguridadClearPin: () => ipcRenderer.invoke('seguridad:clearPin'),
  historialPropiedad: (id) => ipcRenderer.invoke('historial:propiedad', { id }),
  historialInquilino: (id) => ipcRenderer.invoke('historial:inquilino', { id }),

  whatsappAbrir: (url) => ipcRenderer.invoke('whatsapp:abrir', { url }),
  buscarGlobal: (q) => ipcRenderer.invoke('buscar:global', { q }),

  backupCrear: () => ipcRenderer.invoke('backup:crear'),
  backupEstado: () => ipcRenderer.invoke('backup:estado'),
  backupRetencion: (n) => ipcRenderer.invoke('backup:retencion', { retencion: n }),
  backupCarpeta: () => ipcRenderer.invoke('backup:carpeta'),
backupRestaurar: () => ipcRenderer.invoke('backup:restaurar'),

  pdfExport: (tipo, payload) => ipcRenderer.invoke('export:pdf', { tipo, ...(payload || { }) }),
  exportDato: (tipo, formato, payload) => ipcRenderer.invoke('export:data', { tipo, formato, ...(payload || { }) }),

  onUpdateStatus: (cb) => ipcRenderer.on('update:status', (_e, data) => cb(data)),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install')
});