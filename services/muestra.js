'use strict';
// HABITIA — datos de ejemplo para probar la app, con borrado seguro.
// Solo se cargan cuando la base está vacía; cada fila insertada se guarda en
// la config `muestra` para poder eliminarla exactamente (sin tocar datos reales).

function lastId(db) {
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] || 0);
}

function seedMuestra(db) {
  const ya = db.exec('SELECT COUNT(*) AS n FROM estudios WHERE activo=1');
  if (ya[0] && ya[0].values[0][0] > 0) {
    return { yaCargados: true, error: 'Ya hay datos guardados: primero quita los de ejemplo o usa la app con tus datos reales.' };
  }

  const ids = { estudios: [], inquilinos: [], alquileres: [], abonos: [], gastos: [], ocupaciones: [] };

  const emp = db.exec('SELECT nombre FROM empresa WHERE id=1');
  if (!emp[0] || !String(emp[0].values[0][0] || '').trim()) {
    db.run("INSERT INTO empresa (id,nombre) VALUES (1,'Pruebas HABITIA') ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre");
  }

  // E: estudios (6) | I: inquilinos (5 ocupando 5, 1 libre)
  const estudios = [
    { nombre: 'A-1 Studio Premium', direccion: 'Bloque A, Nivel 1', alquiler: 18500, deposito: 18500, costo: 950000 },
    { nombre: 'A-2 Estudio Deluxe', direccion: 'Bloque A, Nivel 2', alquiler: 16000, deposito: 16000, costo: 820000 },
    { nombre: 'B-1 Studio Familiar', direccion: 'Bloque B, Nivel 1', alquiler: 22000, deposito: 22000, costo: 1200000 },
    { nombre: 'B-2 Studio Compacto', direccion: 'Bloque B, Nivel 2', alquiler: 13000, deposito: 13000, costo: 700000 },
    { nombre: 'C-1 Estudio Vista', direccion: 'Bloque C, Nivel 1', alquiler: 17500, deposito: 17500, costo: 900000 },
    { nombre: 'C-2 Estudio Esquina', direccion: 'Bloque C, Nivel 2', alquiler: 15000, deposito: 15000, costo: 780000 }
  ];
  const eIds = {};
  for (const e of estudios) {
    db.run('INSERT INTO estudios (nombre,direccion,alquiler,deposito,costo_inversion) VALUES (?,?,?,?,?)',
      [e.nombre, e.direccion, e.alquiler, e.deposito, e.costo]);
    eIds[e.nombre] = lastId(db);
    ids.estudios.push(eIds[e.nombre]);
  }

  const inquilinos = [
    { nombre: 'María Fernández', telefono: '8093337712', whatsapp: '18093337712', estudio: 'A-1 Studio Premium' },
    { nombre: 'José Martínez', telefono: '8295552231', whatsapp: '18295552231', estudio: 'A-2 Estudio Deluxe' },
    { nombre: 'Carmen Peña', telefono: '8094445567', whatsapp: '18094445567', estudio: 'B-2 Studio Compacto' },
    { nombre: 'Luis Rodríguez', telefono: '8295554411', whatsapp: '18295554411', estudio: 'C-1 Estudio Vista' },
    { nombre: 'Ana Santos', telefono: '8095556677', whatsapp: '', estudio: 'C-2 Estudio Esquina' }
  ];
  const iIds = {};
  for (const iq of inquilinos) {
    db.run('INSERT INTO inquilinos (nombre,telefono,whatsapp,email,notas) VALUES (?,?,?,?,?)',
      [iq.nombre, iq.telefono, iq.whatsapp, '', 'Inquilino de ejemplo']);
    iIds[iq.nombre] = lastId(db);
    ids.inquilinos.push(iIds[iq.nombre]);
    const e = eIds[iq.estudio];
    db.run('UPDATE estudios SET inquilino_id=? WHERE id=?', [iIds[iq.nombre], e]);
    db.run('INSERT INTO ocupaciones (estudio_id,inquilino_id,desde) VALUES (?,?,?)',
      [e, iIds[iq.nombre], '2025-11-15']);
    ids.ocupaciones.push(Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]));
  }

  // Historial: un inquilino anterior en C-1 (ya se fue) para la vista de ocupantes.
  db.run('INSERT INTO inquilinos (nombre,telefono,whatsapp) VALUES (?,?,?)', ['Pedro Gómez', '8091112233', '18091112233']);
  const pedro = lastId(db);
  ids.inquilinos.push(pedro);
  db.run('INSERT INTO ocupaciones (estudio_id,inquilino_id,desde,hasta) VALUES (?,?,?,?)',
    [eIds['C-1 Estudio Vista'], pedro, '2024-03-01', '2025-11-10']);
  ids.ocupaciones.push(Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]));

  const hoy = new Date();
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  const dAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesPrev = dAnterior.getFullYear() + '-' + String(dAnterior.getMonth() + 1).padStart(2, '0');

  // A: alquileres del mes actual (B-1 libre queda sin cuota el resto lo paga el sistema).
  const cm = [
    { e: 'A-1 Studio Premium', i: 'María Fernández', monto: 18500, pagado: 1 },
    { e: 'A-2 Estudio Deluxe', i: 'José Martínez', monto: 16000, pagado: 0 },
    { e: 'B-2 Studio Compacto', i: 'Carmen Peña', monto: 13000, pagado: 0 },
    { e: 'C-1 Estudio Vista', i: 'Luis Rodríguez', monto: 17500, pagado: 0 },
    { e: 'C-2 Estudio Esquina', i: 'Ana Santos', monto: 15000, pagado: 0 }
  ];
  for (const c of cm) {
    db.run('INSERT INTO alquileres (estudio_id,inquilino_id,mes,monto,pagado,fecha_pago) VALUES (?,?,?,?,?,?)',
      [eIds[c.e], iIds[c.i], mesActual, c.monto, c.pagado, c.pagado ? hoy.toISOString().slice(0, 10) : '']);
    ids.alquileres.push(lastId(db));
  }
  // Abono parcial de Carmen (intenta pagar a medias).
  const abonoMes = db.exec(
    'SELECT id FROM alquileres WHERE mes=? AND inquilino_id=?', [mesActual, iIds['Carmen Peña']])[0].values[0][0];
  db.run('INSERT INTO abonos (alquiler_id,monto,fecha,notas) VALUES (?,?,?,?)',
    [abonoMes, 6000, hoy.toISOString().slice(0, 10), 'Abono parcial']);
  ids.abonos.push(lastId(db));

  // Mes anterior: solo Luis (C-1) quedó sin pagar → atrasado para el aging.
  const pm = [
    { e: 'A-1 Studio Premium', i: 'María Fernández', monto: 18500, pagado: 1 },
    { e: 'A-2 Estudio Deluxe', i: 'José Martínez', monto: 16000, pagado: 1 },
    { e: 'B-2 Studio Compacto', i: 'Carmen Peña', monto: 13000, pagado: 1 },
    { e: 'C-1 Estudio Vista', i: 'Luis Rodríguez', monto: 17500, pagado: 0 }
  ];
  for (const c of pm) {
    db.run('INSERT INTO alquileres (estudio_id,inquilino_id,mes,monto,pagado,fecha_pago) VALUES (?,?,?,?,?,?)',
      [eIds[c.e], iIds[c.i], mesPrev, c.monto, c.pagado, c.pagado ? dAnterior.toISOString().slice(0, 10) : '']);
    ids.alquileres.push(lastId(db));
  }

  // G: gastos de este mes y del anterior (para tendencia y consultas de gastos).
  const gastos = [
    { mes: mesActual, dia: 3, cat: 'luz', concepto: 'Factura edenorte', monto: 4200 },
    { mes: mesActual, dia: 6, cat: 'agua', concepto: 'Factura INAPA', monto: 1800 },
    { mes: mesActual, dia: 10, cat: 'internet', concepto: 'Internet fibra', monto: 2600 },
    { mes: mesPrev, dia: 4, cat: 'luz', concepto: 'Factura edenorte', monto: 3900 },
    { mes: mesPrev, dia: 7, cat: 'agua', concepto: 'Factura INAPA', monto: 1700 }
  ];
  for (const g of gastos) {
    const fecha = `${g.mes}-${String(g.dia).padStart(2, '0')}`;
    db.run('INSERT INTO gastos (categoria,concepto,monto,fecha) VALUES (?,?,?,?)',
      [g.cat, g.concepto, g.monto, fecha]);
    ids.gastos.push(lastId(db));
  }

  db.run('INSERT OR REPLACE INTO config (clave,valor) VALUES (?,?)', ['muestra', JSON.stringify(ids)]);
  return {
    ok: true,
    estudios: ids.estudios.length,
    deudores: 4,
    atrasados: 1,
    mes: mesActual,
    aviso: 'Datos de ejemplo cargados. Puedes quitarlos cuando quieras desde este mismo panel.'
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
  for (const id of lista('abonos')) db.run('DELETE FROM abonos WHERE id=?', [id]);
  // Orden con FK: abonos → alquileres → ocupaciones → gastos → inquilinos → estudios.
  del('DELETE FROM alquileres WHERE id=?', lista('alquileres'));
  del('DELETE FROM ocupaciones WHERE id=?', lista('ocupaciones'));
  del('DELETE FROM gastos WHERE id=?', lista('gastos'));
  del('DELETE FROM inquilinos WHERE id=?', lista('inquilinos'));
  del('DELETE FROM estudios WHERE id=?', lista('estudios'));
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