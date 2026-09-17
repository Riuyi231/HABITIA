'use strict';
// HABITIA — datos de ejemplo para probar la app, con borrado seguro.
// Solo se cargan cuando la base está vacía; cada fila insertada se guarda en
// la config `muestra` para poder eliminarla exactamente (sin tocar datos reales).
// El escenario incluye: multi-moneda (RD$ y USD), estados de estudio (ocupado,
// disponible, mantenimiento, fuera), morosidad en varias etapas, cuentas por
// pagar, proveedores, órdenes de mantenimiento, contratos, recibos y auditoría.

function lastId(db) {
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] || 0);
}

function seedMuestra(db) {
  const ya = db.exec('SELECT COUNT(*) AS n FROM estudios WHERE activo=1');
  if (ya[0] && ya[0].values[0][0] > 0) {
    return { yaCargados: true, error: 'Ya hay datos guardados: primero quita los de ejemplo o usa la app con tus datos reales.' };
  }

  const ids = {
    estudios: [], inquilinos: [], alquileres: [], abonos: [], gastos: [],
    ocupaciones: [], contratos: [], cuentas: [], proveedores: [], ordenes: [],
    promesas: [], recibos: [], notas: [], gastos_estudio: [], auditoria: []
  };
  const idPush = (arr, val) => { arr.push(Number(val)); return Number(val); };

  const emp = db.exec('SELECT nombre FROM empresa WHERE id=1');
  if (!emp[0] || !String(emp[0].values[0][0] || '').trim()) {
    db.run("INSERT INTO empresa (id,nombre) VALUES (1,'Pruebas HABITIA') ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre");
  }

  // ---- Fechas relativas a hoy ----
  const hoy = new Date();
  const mesDe = (off) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - off, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const diaDe = (off, day) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - off, Math.min(day, 28)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const masDias = (off) => { const d = new Date(hoy); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const hoyD = diaDe(0, hoy.getDate());
  const anio = hoy.getFullYear();

  // ---- E: estudios (9) ----
  const estudios = [
    { nombre: 'A-1 Studio Premium', direccion: 'Bloque A, Nivel 1', edificio: 'Bloque A', alquiler: 18500, deposito: 18500, costo: 950000, moneda: 'RD$' },
    { nombre: 'A-2 Estudio Deluxe', direccion: 'Bloque A, Nivel 2', edificio: 'Bloque A', alquiler: 16000, deposito: 16000, costo: 820000, moneda: 'RD$' },
    { nombre: 'B-1 Studio Familiar', direccion: 'Bloque B, Nivel 1', edificio: 'Bloque B', alquiler: 22000, deposito: 22000, costo: 1200000, moneda: 'RD$' },
    { nombre: 'B-2 Studio Compacto', direccion: 'Bloque B, Nivel 2', edificio: 'Bloque B', alquiler: 13000, deposito: 13000, costo: 700000, moneda: 'RD$' },
    { nombre: 'C-1 Estudio Vista', direccion: 'Bloque C, Nivel 1', edificio: 'Bloque C', alquiler: 17500, deposito: 17500, costo: 900000, moneda: 'RD$' },
    { nombre: 'C-2 Estudio Esquina', direccion: 'Bloque C, Nivel 2', edificio: 'Bloque C', alquiler: 480, deposito: 480, costo: 360000, moneda: 'USD', estado: 'ocupado' },
    { nombre: 'D-1 Estudio Reforma', direccion: 'Bloque D, Nivel 1', edificio: 'Bloque D', alquiler: 14000, deposito: 0, costo: 650000, moneda: 'RD$', estado: 'mantenimiento' },
    { nombre: 'D-2 Estudio Garaje', direccion: 'Bloque D, Nivel 2', edificio: 'Bloque D', alquiler: 9000, deposito: 0, costo: 250000, moneda: 'RD$', estado: 'fuera' },
    { nombre: 'E-1 Estudio Antiguo', direccion: 'Edificio E', edificio: 'Bloque E', alquiler: 12000, deposito: 0, costo: 500000, moneda: 'RD$', activo: 0 }
  ];
  const eIds = {};
  for (const e of estudios) {
    db.run('INSERT INTO estudios (nombre,direccion,edificio,alquiler,deposito,costo_inversion,moneda,estado,activo) VALUES (?,?,?,?,?,?,?,?,?)',
      [e.nombre, e.direccion, e.edificio || '', e.alquiler, e.deposito, e.costo, e.moneda, e.estado || '', e.activo === 0 ? 0 : 1]);
    eIds[e.nombre] = idPush(ids.estudios, lastId(db));
  }
  // Cuota mensual real = alquiler + gastos fijos.
  const cuotaDe = (e) => Number(e.alquiler) + (fijos[e.nombre] || []).reduce((s, g) => s + Number(g.monto), 0);

  // ---- Gastos fijos por estudio ----
  const fijos = {
    'A-1 Studio Premium': [{ nombre: 'Póliza de seguro', monto: 1200 }, { nombre: 'Servicio de basura', monto: 500 }],
    'C-1 Estudio Vista': [{ nombre: 'Servicio de basura', monto: 500 }]
  };
  for (const nm of Object.keys(fijos)) {
    for (const g of fijos[nm]) {
      db.run('INSERT INTO gastos_estudio (estudio_id,nombre,monto) VALUES (?,?,?)', [eIds[nm], g.nombre, g.monto]);
      ids.gastos_estudio.push(lastId(db));
    }
  }

  // ---- I: inquilinos (9 = 6 actuales + 2 históricos + 1 archivado) ----
  const inquilinos = [
    { nombre: 'María Fernández', telefono: '8093337712', whatsapp: '18093337712', estudio: 'A-1 Studio Premium', desde: '2025-11-15' },
    { nombre: 'José Martínez', telefono: '8295552231', whatsapp: '18295552231', estudio: 'A-2 Estudio Deluxe', desde: '2026-01-05' },
    { nombre: 'Carlos De la Cruz', telefono: '8097778899', whatsapp: '18097778899', estudio: 'B-1 Studio Familiar', desde: '2026-06-01' },
    { nombre: 'Carmen Peña', telefono: '8094445567', whatsapp: '18094445567', estudio: 'B-2 Studio Compacto', desde: '2025-10-01' },
    { nombre: 'Luis Rodríguez', telefono: '8295554411', whatsapp: '18295554411', estudio: 'C-1 Estudio Vista', desde: '2025-11-11' },
    { nombre: 'Ana Santos', telefono: '8095556677', whatsapp: '', estudio: 'C-2 Estudio Esquina', desde: '2026-01-15' }
  ];
  const iIds = {};
  for (const iq of inquilinos) {
    db.run('INSERT INTO inquilinos (nombre,telefono,whatsapp,email,notas) VALUES (?,?,?,?,?)',
      [iq.nombre, iq.telefono, iq.whatsapp, '', 'Inquilino de ejemplo']);
    iIds[iq.nombre] = idPush(ids.inquilinos, lastId(db));
    db.run('UPDATE estudios SET inquilino_id=? WHERE id=?', [iIds[iq.nombre], eIds[iq.estudio]]);
    db.run('INSERT INTO ocupaciones (estudio_id,inquilino_id,desde) VALUES (?,?,?)',
      [eIds[iq.estudio], iIds[iq.nombre], iq.desde]);
    ids.ocupaciones.push(lastId(db));
  }
  // Históricos (ya no ocupan).
  const historicos = [
    { nombre: 'Pedro Gómez', telefono: '8091112233', whatsapp: '18091112233', estudio: 'C-1 Estudio Vista', desde: '2024-03-01', hasta: '2025-11-10' },
    { nombre: 'Rosa Rivas', telefono: '8292221144', whatsapp: '18292221144', estudio: 'D-1 Estudio Reforma', desde: '2025-01-10', hasta: '2026-01-10' },
    { nombre: 'Lucía Marte', telefono: '8096663322', whatsapp: '', estudio: 'A-1 Studio Premium', desde: '2024-06-01', hasta: '2025-11-14' }
  ];
  for (const h of historicos) {
    db.run('INSERT INTO inquilinos (nombre,telefono,whatsapp,notas) VALUES (?,?,?,?)',
      [h.nombre, h.telefono, h.whatsapp, 'Histórico (ya no ocupa)']);
    const hi = idPush(ids.inquilinos, lastId(db));
    iIds[h.nombre] = hi;
    db.run('INSERT INTO ocupaciones (estudio_id,inquilino_id,desde,hasta) VALUES (?,?,?,?)',
      [eIds[h.estudio], hi, h.desde, h.hasta]);
    ids.ocupaciones.push(lastId(db));
  }
  // Inquilino archivado (para el registro de archivados).
  db.run("INSERT INTO inquilinos (nombre,telefono,notas,activo) VALUES (?,?,?,0)",
    ['Víctor Peña', '8099331144', 'Archivado de ejemplo']);
  ids.inquilinos.push(lastId(db));

  // ---- A: cuotas de alquiler de los últimos 5 meses ----
  const ocupados = [
    { e: 'A-1 Studio Premium', i: 'María Fernández' },
    { e: 'A-2 Estudio Deluxe', i: 'José Martínez' },
    { e: 'B-1 Studio Familiar', i: 'Carlos De la Cruz' },
    { e: 'B-2 Studio Compacto', i: 'Carmen Peña' },
    { e: 'C-1 Estudio Vista', i: 'Luis Rodríguez' },
    { e: 'C-2 Estudio Esquina', i: 'Ana Santos' }
  ];
  const cuota = {};
  for (const c of ocupados) {
    const e = estudios.find((x) => x.nombre === c.e);
    cuota[c.e] = cuotaDe(e);
  }
  // papel de pago por mes (0 = sí, 1 = no) dentro de los 5 meses: mes0..mes4.
  const papel = {
    'María Fernández': [1, 1, 1, 1, 1],
    'José Martínez': [0, 0, 1, 1, 1],
    'Carlos De la Cruz': [1, 1, 1, 1, 1],
    'Carmen Peña': [0, 0, 0, 0, 0],
    'Luis Rodríguez': [0, 0, 0, 0, 1],
    'Ana Santos': [1, 1, 1, 1, 1]
  };
  const aIds = {};
  for (let off = 0; off <= 4; off++) {
    for (const c of ocupados) {
      const estaPagado = papel[c.i][off] === 1;
      db.run('INSERT INTO alquileres (estudio_id,inquilino_id,mes,monto,pagado,fecha_pago,metodo_pago,moneda) VALUES (?,?,?,?,?,?,?,?)',
        [eIds[c.e], iIds[c.i], mesDe(off), cuota[c.e], estaPagado ? 1 : 0,
         estaPagado ? diaDe(off, 3 + (off % 4)) : '', estaPagado ? 'efectivo' : '', estudios.find((x) => x.nombre === c.e).moneda]);
      const id = lastId(db);
      ids.alquileres.push(id);
      if (off === 0) aIds[c.e] = id;
      if (off === 1 && c.i === 'José Martínez') aIds['A-2-m1'] = id;
      if (off === 2 && c.i === 'Carmen Peña') aIds['B-2-m2'] = id;
      if (off === 3 && c.i === 'Luis Rodríguez') aIds['C-1-m3'] = id;
    }
  }

  // ---- Abonos ----
  db.run('INSERT INTO abonos (alquiler_id,monto,fecha,notas,metodo_pago) VALUES (?,?,?,?,?)',
    [aIds['B-2 Studio Compacto'], 6000, diaDe(0, 8), 'Abono parcial', 'efectivo']);
  ids.abonos.push(lastId(db));
  db.run('INSERT INTO abonos (alquiler_id,monto,fecha,notas,metodo_pago) VALUES (?,?,?,?,?)',
    [aIds['C-1 Estudio Vista'], 5000, diaDe(0, 9), 'Abono parcial', 'efectivo']);
  ids.abonos.push(lastId(db));

  // ---- Recibos (solo de los pagos del mes actual) ----
  const recibos = [
    { alq: 'A-1 Studio Premium', numero: 'REC-' + anio + '-00001', monto: cuota['A-1 Studio Premium'], metodo: 'efectivo' },
    { alq: 'B-1 Studio Familiar', numero: 'REC-' + anio + '-00002', monto: cuota['B-1 Studio Familiar'], metodo: 'transferencia' },
    { alq: 'C-2 Estudio Esquina', numero: 'REC-' + anio + '-00003', monto: cuota['C-2 Estudio Esquina'], metodo: 'tarjeta' }
  ];
  for (const r of recibos) {
    db.run('INSERT INTO recibos (numero,tipo,alquiler_id,monto,fecha,metodo,referencia,moneda) VALUES (?,?,?,?,?,?,?,?)',
      [r.numero, 'cobro', aIds[r.alq], r.monto, diaDe(0, 3), r.metodo, '', estudios.find((x) => x.nombre === r.alq).moneda]);
    ids.recibos.push(lastId(db));
  }

  // ---- Contratos ----
  const contratos = [
    { e: 'A-1 Studio Premium', i: 'María Fernández', inicio: '2025-11-15', duracion: 12, renta: 18500, dep: 18500, dia: 5, inc: 5, aval: 'Rafael Fernández', avalT: '8092223344' },
    { e: 'A-2 Estudio Deluxe', i: 'José Martínez', inicio: '2026-01-05', duracion: 12, renta: 16000, dep: 16000, dia: 5, inc: 4, aval: '', avalT: '' },
    { e: 'B-1 Studio Familiar', i: 'Carlos De la Cruz', inicio: '2026-06-01', duracion: 6, renta: 22000, dep: 22000, dia: 5, inc: 0, aval: '', avalT: '' },
    { e: 'B-2 Studio Compacto', i: 'Carmen Peña', inicio: '2025-10-01', duracion: 12, renta: 13000, dep: 13000, dia: 5, inc: 3, aval: '', avalT: '' },
    { e: 'C-1 Estudio Vista', i: 'Luis Rodríguez', inicio: '2025-03-01', duracion: 12, renta: 17500, dep: 17500, dia: 5, inc: 6, aval: '', avalT: '' },
    { e: 'C-2 Estudio Esquina', i: 'Ana Santos', inicio: '2026-01-15', duracion: 12, renta: 480, dep: 480, dia: 5, inc: 0, aval: '', avalT: '', moneda: 'USD' }
  ];
  const vtoDe = (inicio, n) => { const [y, m, d] = inicio.split('-').map(Number); const v = new Date(y, m + n - 1, d); return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0'); };
  for (const c of contratos) {
    db.run('INSERT INTO contratos (estudio_id,inquilino_id,fecha_inicio,fecha_vencimiento,duracion_meses,renta,deposito,dia_pago,incremento_pct,aval_nombre,aval_telefono,estado,moneda) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [eIds[c.e], iIds[c.i], c.inicio, vtoDe(c.inicio, c.duracion), c.duracion, c.renta, c.dep, c.dia, c.inc, c.aval, c.avalT, '', c.moneda || 'RD$']);
    ids.contratos.push(lastId(db));
  }
  // Contrato terminado de Pedro (histórico en C-1).
  db.run("INSERT INTO contratos (estudio_id,inquilino_id,fecha_inicio,fecha_vencimiento,duracion_meses,renta,deposito,dia_pago,estado,moneda) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [eIds['C-1 Estudio Vista'], iIds['Pedro Gómez'], '2024-03-01', '2025-03-01', 12, 16000, 16000, 5, 'terminado', 'RD$']);
  ids.contratos.push(lastId(db));

  // ---- Proveedores (6) ----
  const proveedores = [
    { nombre: 'Edenorte', telefono: '8095424000', correo: 'cobros@edenorte.do', servicio: 'Energía eléctrica' },
    { nombre: 'INAPA', telefono: '8096822020', correo: '', servicio: 'Agua potable' },
    { nombre: 'Claro RD', telefono: '8092201111', correo: '', servicio: 'Internet y televisión' },
    { nombre: 'Plomero Gonzalo', telefono: '8093339876', correo: '', servicio: 'Plomería y emergencias' },
    { nombre: 'Almacén Suplidora', telefono: '8095551212', correo: 'ventas@suplidora.do', servicio: 'Materiales de construcción' },
    { nombre: 'Clima RD', telefono: '8297783344', correo: '', servicio: 'Aire acondicionado' }
  ];
  const prIds = {};
  for (const p of proveedores) {
    db.run('INSERT INTO proveedores (nombre,telefono,correo,servicio,direccion,notas) VALUES (?,?,?,?,?,?)',
      [p.nombre, p.telefono, p.correo, p.servicio, '', '']);
    prIds[p.nombre] = idPush(ids.proveedores, lastId(db));
  }

  // ---- G: gastos de los últimos 5 meses ----
  const gastos = [
    { mes: 0, dia: 3, cat: 'luz', concepto: 'Factura edenorte', monto: 4200, prov: 'Edenorte' },
    { mes: 0, dia: 5, cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, prov: 'Claro RD' },
    { mes: 0, dia: 7, cat: 'agua', concepto: 'Factura INAPA', monto: 1800, prov: 'INAPA', programado: 3 },
    { mes: 0, dia: 8, cat: 'otros', concepto: 'Servicio de basura', monto: 900, prov: '' },
    { mes: 0, dia: 9, cat: 'reparacion', concepto: 'Reparación de fuga (baño A-2)', monto: 2500, prov: 'Plomero Gonzalo', estudio: 'A-2 Estudio Deluxe' },
    { mes: 1, dia: 4, cat: 'luz', concepto: 'Factura edenorte', monto: 3900, prov: 'Edenorte' },
    { mes: 1, dia: 6, cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, prov: 'Claro RD' },
    { mes: 1, dia: 8, cat: 'agua', concepto: 'Factura INAPA', monto: 1700, prov: 'INAPA' },
    { mes: 1, dia: 10, cat: 'mantenimiento', concepto: 'Mantenimiento de plomería', monto: 4500, prov: 'Plomero Gonzalo', estudio: 'B-1 Studio Familiar' },
    { mes: 2, dia: 4, cat: 'luz', concepto: 'Factura edenorte', monto: 3800, prov: 'Edenorte' },
    { mes: 2, dia: 6, cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, prov: 'Claro RD' },
    { mes: 2, dia: 12, cat: 'compra', concepto: 'Compra de materiales', monto: 15000, prov: 'Almacén Suplidora' },
    { mes: 2, dia: 18, cat: 'mantenimiento', concepto: 'Limpieza de cisterna', monto: 3200, prov: '', estudio: 'D-1 Estudio Reforma' },
    { mes: 3, dia: 5, cat: 'luz', concepto: 'Factura edenorte', monto: 3600, prov: 'Edenorte' },
    { mes: 3, dia: 7, cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, prov: 'Claro RD' },
    { mes: 3, dia: 9, cat: 'agua', concepto: 'Factura INAPA', monto: 1600, prov: 'INAPA' },
    { mes: 3, dia: 20, cat: 'mantenimiento', concepto: 'Mantenimiento aire acondicionado', monto: 150, prov: 'Clima RD', estudio: 'C-1 Estudio Vista', moneda: 'USD' },
    { mes: 4, dia: 4, cat: 'luz', concepto: 'Factura edenorte', monto: 3500, prov: 'Edenorte' },
    { mes: 4, dia: 6, cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, prov: 'Claro RD' },
    { mes: 4, dia: 8, cat: 'agua', concepto: 'Factura INAPA', monto: 1550, prov: 'INAPA' },
    { mes: 4, dia: 22, cat: 'otros', concepto: 'Pintura general (D-1)', monto: 8000, prov: 'Almacén Suplidora', estudio: 'D-1 Estudio Reforma' }
  ];
  const idGasto = {};
  for (const g of gastos) {
    const fecha = diaDe(g.mes, g.dia);
    const esProg = !!g.programado;
    db.run('INSERT INTO gastos (categoria,concepto,monto,fecha,estudio_id,proveedor,moneda,estado,fecha_vencimiento) VALUES (?,?,?,?,?,?,?,?,?)',
      [g.cat, g.concepto, g.monto, fecha, g.estudio ? eIds[g.estudio] : null,
       g.prov || '', g.moneda || 'RD$', esProg ? 'programado' : 'pagado',
       esProg ? masDias(g.programado) : '']);
    const id = lastId(db);
    ids.gastos.push(id);
    const clave = (g.mes === 1 && g.cat === 'luz') ? 'luz-m1' : (g.mes === 2 && g.cat === 'compra') ? 'compra-m2' : '';
    if (clave) idGasto[clave] = id;
  }

  // ---- Cuentas por pagar (7) ----
  const cxp = [
    { prov: 'Edenorte', cat: 'electricidad', concepto: 'Factura edenorte', monto: 4200, mon: 'RD$', vto: 3, estado: 'pendiente', e: '' },
    { prov: 'Claro RD', cat: 'internet', concepto: 'Internet fibra óptica', monto: 2600, mon: 'RD$', vto: 2, estado: 'pendiente', e: '' },
    { prov: 'INAPA', cat: 'agua', concepto: 'Factura INAPA', monto: 1800, mon: 'RD$', vto: -6, estado: 'pendiente', e: 'D-1 Estudio Reforma' },
    { prov: 'Clima RD', cat: 'mantenimiento', concepto: 'Mantenimiento aire acondicionado', monto: 150, mon: 'USD', vto: -2, estado: 'pendiente', e: 'C-1 Estudio Vista' },
    { prov: 'Edenorte', cat: 'electricidad', concepto: 'Factura edenorte (mes anterior)', monto: 3900, mon: 'RD$', vto: 1, estado: 'pagada', e: '', pago: 'efectivo', gasto: 'luz-m1' },
    { prov: 'Almacén Suplidora', cat: 'compra', concepto: 'Compra de materiales', monto: 15000, mon: 'RD$', vto: 2, estado: 'pagada', e: '', pago: 'transferencia', gasto: 'compra-m2' },
    { prov: 'Claro RD', cat: 'servicios', concepto: 'Servicio de TV Claro', monto: 1200, mon: 'RD$', vto: 10, estado: 'cancelada', e: '' }
  ];
  for (const c of cxp) {
    const esPagada = c.estado === 'pagada';
    db.run('INSERT INTO cuentas_por_pagar (proveedor_id,categoria,concepto,estudio_id,monto,moneda,fecha_vencimiento,estado,pagado,fecha_pago,metodo_pago,referencia,gasto_id,notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [prIds[c.prov], c.cat, c.concepto, c.e ? eIds[c.e] : null, c.monto, c.mon,
       masDias(c.vto), c.estado, esPagada ? 1 : 0,
       esPagada ? diaDe(1, 8) : '', esPagada ? c.pago : '', '', esPagada ? idGasto[c.gasto] : null, '']);
    ids.cuentas.push(lastId(db));
  }

  // ---- Órdenes de mantenimiento (4) ----
  const ordenes = [
    { e: 'A-2 Estudio Deluxe', i: 'José Martínez', detalle: 'Fuga de agua en el baño', estado: 'reportado', prioridad: 'alta', costoE: 4500, prov: 'Plomero Gonzalo' },
    { e: 'B-1 Studio Familiar', i: 'Carlos De la Cruz', detalle: 'Aire acondicionado no enfría', estado: 'en_reparacion', prioridad: 'media', costoE: 12000, prov: 'Clima RD' },
    { e: 'C-1 Estudio Vista', i: 'Luis Rodríguez', detalle: 'Cambio de cerradura de la puerta', estado: 'completado', prioridad: 'baja', costoE: 0, costo: 2200, prov: 'Cerrajero Express' },
    { e: 'D-1 Estudio Reforma', i: null, detalle: 'Pintura general después de la reforma', estado: 'aprobado', prioridad: 'media', costoE: 25000, prov: 'Almacén Suplidora' }
  ];
  for (const o of ordenes) {
    db.run('INSERT INTO ordenes (estudio_id,inquilino_id,detalle,costo,estado,prioridad,costo_estimado,proveedor,moneda,fecha_cierre) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [eIds[o.e], o.i ? iIds[o.i] : null, o.detalle, o.costo || 0, o.estado, o.prioridad,
       o.costoE, o.prov, 'RD$', o.estado === 'completado' ? diaDe(1, 15) : '']);
    ids.ordenes.push(lastId(db));
  }

  // ---- Promesas de pago (2) ----
  db.run('INSERT INTO promesas (inquilino_id,alquiler_id,fecha_prometida,monto,notas,estado) VALUES (?,?,?,?,?,?)',
    [iIds['Luis Rodríguez'], aIds['C-1 Estudio Vista'], masDias(3), 18000, 'Prometió pagar la cuota pendiente.', 'pendiente']);
  ids.promesas.push(lastId(db));
  db.run('INSERT INTO promesas (inquilino_id,alquiler_id,fecha_prometida,monto,notas,estado) VALUES (?,?,?,?,?,?)',
    [iIds['Carmen Peña'], aIds['B-2 Studio Compacto'], masDias(5), 7000, 'Pagará el saldo restante.', 'pendiente']);
  ids.promesas.push(lastId(db));

  // ---- Notas (2) ----
  db.run("INSERT INTO notas (entidad,entidad_id,texto,usuario,fecha) VALUES ('estudio',?,?,?,?)",
    [eIds['C-1 Estudio Vista'], 'Revisar cuenta atrasada: el inquilino tiene promesa de pago para el ' + masDias(3) + '.', 'Dueño', diaDe(0, 2)]);
  ids.notas.push(lastId(db));
  db.run("INSERT INTO notas (entidad,entidad_id,texto,usuario,fecha) VALUES ('inquilino',?,?,?,?)",
    [iIds['Luis Rodríguez'], 'Cliente desde 2024. Hablar con él antes de aplicar mora alta.', 'Dueño', diaDe(0, 2)]);
  ids.notas.push(lastId(db));

  // ---- Auditoría (historial de ejemplo) ----
  const fe = (off, hh) => { const d = masDias(off); return d + ' ' + String(hh); };
  const log = (accion, entidad, detalle, dia) => {
    db.run('INSERT INTO actividad_log (fecha,accion,entidad,entidad_id,detalle,usuario) VALUES (?,?,?,?,?,?)',
      [fe(dia, '09:15:00'), accion, entidad, null, detalle, 'Dueño']);
    ids.auditoria.push(lastId(db));
  };
  log('iniciar', 'empresa', 'Se cargó el escenario de ejemplo de HABITIA.', 0);
  log('crear', 'estudio', 'Se creó el estudio D-1 Estudio Reforma.', 0);
  log('crear', 'estudio', 'Se creó el estudio C-2 Estudio Esquina (USD).', 0);
  log('archivar', 'propiedad', 'Se archivó el estudio E-1 Estudio Antiguo.', 0);
  log('crear', 'inquilino', 'Se registró el inquilino Carlos De la Cruz.', 0);
  log('pago', 'alquiler', 'Pago de RD$ ' + cuota['A-1 Studio Premium'].toFixed(2) + ' registrado (efectivo) · A-1 Studio Premium', 0);
  log('pago', 'alquiler', 'Pago de USD ' + cuota['C-2 Estudio Esquina'].toFixed(2) + ' registrado (tarjeta) · C-2 Estudio Esquina', 0);
  log('abono', 'alquiler', 'Abono parcial de RD$ 6000.00 · B-2 Studio Compacto', 0);
  log('gasto', 'gastos', 'Gasto de RD$ 4200.00 · Factura edenorte', 0);
  log('pagar', 'cuenta_pagar', 'Se pagó la cuenta Factura edenorte (mes anterior) · RD$ 3900.00 (efectivo)', 1);
  log('crear', 'cuenta_pagar', 'Cuenta por pagar de RD$ 1800.00 · Factura INAPA', 1);
  log('crear', 'proveedor', 'Se creó el proveedor Clima RD.', 2);
  log('crear', 'mantenimiento', 'Nueva orden: Fuga de agua en el baño (alta).', 2);
  log('terminar', 'mantenimiento', 'Orden terminada: Cambio de cerradura de la puerta.', 3);
  log('crear', 'contrato', 'Se creó el contrato de Ana Santos (USD).', 4);
  log('config', 'empresa', 'Se guardó la empresa Pruebas HABITIA.', 2);
  log('respaldo', 'backup', 'Copia de seguridad automática creada.', 0);
  log('config', 'seguridad', 'Seguridad configurada: bloqueo de pantalla automático.', 3);

  db.run('INSERT OR REPLACE INTO config (clave,valor) VALUES (?,?)', ['muestra', JSON.stringify(ids)]);
  return {
    ok: true,
    estudios: ids.estudios.length,
    deudores: 3,
    atrasados: 3,
    cuentas: ids.cuentas.length,
    proveedores: ids.proveedores.length,
    ordenes: ids.ordenes.length,
    contratos: ids.contratos.length,
    mes: mesDe(0),
    aviso: 'Datos de ejemplo cargados: 9 estudios, cuentas por pagar, órdenes, contratos y auditoría. Puedes quitarlos cuando quieras desde este mismo panel.'
  };
}

function clearMuestra(db) {
  let ids = null;
  try { ids = JSON.parse(db.exec("SELECT valor FROM config WHERE clave='muestra'")[0].values[0][0] || 'null'); } catch (_) { /* noop */ }
  if (!ids || !Array.isArray(ids.estudios)) {
    return { error: 'No hay datos de ejemplo que quitar.' };
  }
  const lista = (k) => (ids[k] || []).map(Number);
  const del = (sql, arr) => { for (const x of arr) db.run(sql, [x]); };
  // Orden con FK: hijos primero.
  del('DELETE FROM notas WHERE id=?', lista('notas'));
  del('DELETE FROM recibos WHERE id=?', lista('recibos'));
  del('DELETE FROM abonos WHERE id=?', lista('abonos'));
  del('DELETE FROM promesas WHERE id=?', lista('promesas'));
  del('DELETE FROM alquileres WHERE id=?', lista('alquileres'));
  del('DELETE FROM cuentas_por_pagar WHERE id=?', lista('cuentas'));
  del('DELETE FROM gastos WHERE id=?', lista('gastos'));
  del('DELETE FROM ordenes WHERE id=?', lista('ordenes'));
  del('DELETE FROM gastos_estudio WHERE id=?', lista('gastos_estudio'));
  del('DELETE FROM contratos WHERE id=?', lista('contratos'));
  del('DELETE FROM ocupaciones WHERE id=?', lista('ocupaciones'));
  del('DELETE FROM inquilinos WHERE id=?', lista('inquilinos'));
  del('DELETE FROM estudios WHERE id=?', lista('estudios'));
  del('DELETE FROM proveedores WHERE id=?', lista('proveedores'));
  del('DELETE FROM actividad_log WHERE id=?', lista('auditoria'));
  db.run("DELETE FROM config WHERE clave='muestra'");
  return { ok: true, aviso: 'Datos de ejemplo eliminados. La base volvió a estar vacía.' };
}

function muestraEstado(db) {
  let activo = false;
  try { activo = !!(db.exec("SELECT valor FROM config WHERE clave='muestra'")[0]); } catch (_) { /* noop */ }
  const n = db.exec('SELECT COUNT(*) AS n FROM estudios WHERE activo=1');
  return {
    activo,
    estudios: n[0] ? Number(n[0].values[0][0]) : 0
  };
}

module.exports = { seedMuestra, clearMuestra, muestraEstado };