'use strict';
// HABITIA — lógica de negocio de alquileres de estudios.
// Estudios, inquilinos, cobros mensuales, gastos y resumen.

function rowToObj(db, sql, params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params || []);
    if (stmt.step()) return stmt.getAsObject();
    return null;
  } finally { stmt.free(); }
}
function allToObj(db, sql, params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params || []);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally { stmt.free(); }
}
function run(db, sql, params) { db.run(sql, params || []); }

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function hoy() { return new Date().toISOString().slice(0, 10); }
function mesHoy() { return hoy().slice(0, 7); }

function nombreCorto(s) {
  return String(s || '').trim();
}

// ---------- Empresa ----------
function getEmpresa(db) {
  return rowToObj(db, 'SELECT * FROM empresa WHERE id=1') || { id: 1, nombre: '', rnc: '', telefono: '', email: '', direccion: '' };
}
function saveEmpresa(db, data) {
  run(db,
    `INSERT INTO empresa (id,nombre,rnc,telefono,email,direccion)
     VALUES (1,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       nombre=excluded.nombre, rnc=excluded.rnc, telefono=excluded.telefono,
       email=excluded.email, direccion=excluded.direccion`,
    [String(data.nombre || ''), String(data.rnc || ''), String(data.telefono || ''),
     String(data.email || ''), String(data.direccion || '')]);
  return getEmpresa(db);
}

// ---------- Estudios ----------
const ESTADOS_ESTUDIO = ['ocupado', 'disponible', 'mantenimiento', 'fuera'];
function estadoEstudio(e) {
  const s = String((e && e.estado) || '').trim();
  if (ESTADOS_ESTUDIO.indexOf(s) >= 0) return s;
  return e && e.inquilino_id ? 'ocupado' : 'disponible';
}
function listEstudios(db, q) {
  const qs = '%' + String(q || '').trim() + '%';
  const filas = allToObj(db,
    `SELECT e.id, e.nombre, e.direccion, e.edificio, e.alquiler, e.deposito, e.inquilino_id,
            e.activo, e.creado, e.costo_inversion, e.foto, e.estado,
            i.nombre AS inquilino_nombre, i.whatsapp AS inquilino_whatsapp, i.telefono AS inquilino_telefono,
            COALESCE((SELECT SUM(g.monto) FROM gastos_estudio g WHERE g.estudio_id = e.id AND g.activo=1), 0) AS gastos_fijos
     FROM estudios e LEFT JOIN inquilinos i ON i.id = e.inquilino_id
     WHERE e.activo = 1 AND (e.nombre LIKE ? OR e.direccion LIKE ? OR i.nombre LIKE ?)
     ORDER BY e.nombre`, [qs, qs, qs]);
  return filas.map((e) => ({ ...e, estado: estadoEstudio(e) }));
}
function getEstudio(db, id) {
  const e = rowToObj(db,
    `SELECT e.id, e.nombre, e.direccion, e.edificio, e.alquiler, e.deposito, e.inquilino_id,
            e.activo, e.creado, e.costo_inversion, e.foto, e.estado,
            i.nombre AS inquilino_nombre, i.whatsapp AS inquilino_whatsapp, i.telefono AS inquilino_telefono,
            COALESCE((SELECT SUM(g.monto) FROM gastos_estudio g WHERE g.estudio_id = e.id AND g.activo=1), 0) AS gastos_fijos
     FROM estudios e LEFT JOIN inquilinos i ON i.id = e.inquilino_id WHERE e.id=?`, [Number(id)]);
  if (e) {
    e.estado = estadoEstudio(e);
    e.historial = allToObj(db, 'SELECT * FROM alquileres WHERE estudio_id=? ORDER BY mes DESC', [e.id]);
    e.gastos_estudio = listGastosEstudio(db, e.id);
  }
  return e;
}

// ---------- Gastos fijos por estudio (varios gastos por estudio) ----------
function sumaGastosEstudio(db, id) {
  return round2(rowToObj(db,
    'SELECT COALESCE(SUM(monto),0) AS s FROM gastos_estudio WHERE estudio_id=? AND activo=1', [Number(id)]).s || 0);
}
function listGastosEstudio(db, id) {
  return allToObj(db,
    'SELECT * FROM gastos_estudio WHERE estudio_id=? AND activo=1 ORDER BY id', [Number(id)]);
}
function saveGastosEstudio(db, estudioId, lista) {
  const id = Number(estudioId);
  if (!id) throw new Error('Falta el estudio');
  const actuales = listGastosEstudio(db, id);
  const entrantes = (Array.isArray(lista) ? lista : [])
    .map((g) => ({
      id: Number(g && g.id) || null,
      nombre: String((g && g.nombre) || '').trim(),
      monto: Math.max(0, round2(g && g.monto))
    }))
    .filter((g) => g.nombre || g.monto > 0);
  const idsEntrantes = new Set(entrantes.map((g) => g.id).filter(Boolean));
  for (const a of actuales) {
    if (!idsEntrantes.has(Number(a.id))) run(db, 'UPDATE gastos_estudio SET activo=0 WHERE id=?', [Number(a.id)]);
  }
  for (const g of entrantes) {
    if (g.id && idsEntrantes.has(g.id)) {
      run(db, 'UPDATE gastos_estudio SET nombre=?, monto=? WHERE id=? AND estudio_id=?', [g.nombre, g.monto, g.id, id]);
    } else {
      run(db, 'INSERT INTO gastos_estudio (estudio_id, nombre, monto) VALUES (?,?,?)', [id, g.nombre || 'Gasto fijo', g.monto]);
    }
  }
  return listGastosEstudio(db, id);
}
function saveEstudio(db, e) {
  const nombre = nombreCorto(e.nombre);
  if (!nombre) throw new Error('El nombre del estudio es obligatorio');
  const estado = ESTADOS_ESTUDIO.indexOf(e.estado) >= 0 ? e.estado : '';
const p = {
    nombre, direccion: String(e.direccion || ''),
    edificio: String(e.edificio || ''),
    alquiler: round2(e.alquiler), deposito: round2(e.deposito),
    gastosFijos: 0,
    costoInversion: round2(e.costo_inversion)
  };
  if (e.id) {
    run(db,
      `UPDATE estudios SET nombre=?,direccion=?,edificio=?,alquiler=?,deposito=?,gastos_fijos=?,costo_inversion=?,estado=? WHERE id=?`,
      [p.nombre, p.direccion, p.edificio, p.alquiler, p.deposito, p.gastosFijos, p.costoInversion, estado, Number(e.id)]);
    return Number(e.id);
  }
  run(db, `INSERT INTO estudios (nombre,direccion,edificio,alquiler,deposito,gastos_fijos,costo_inversion,estado) VALUES (?,?,?,?,?,?,?,?)`,
    [p.nombre, p.direccion, p.edificio, p.alquiler, p.deposito, p.gastosFijos, p.costoInversion, estado]);
  return Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
}
function deleteEstudio(db, id) {
  run(db, 'UPDATE estudios SET activo=0, inquilino_id=NULL WHERE id=?', [Number(id)]);
}

// Lista de edificios con subtotales (estudios, ocupación, cuota potencial y
// cobrado/porCobrar del mes actual).
function resumenEdificios(db) {
  const estudios = allToObj(db, 'SELECT * FROM estudios WHERE activo=1');
  const map = {};
  for (const e of estudios) {
    const k = String(e.edificio || '').trim() || 'Sin edificio';
    map[k] = map[k] || { edificio: k, estudios: 0, ocupados: 0, disponible: 0, potencial: 0, cobrado: 0, porCobrar: 0 };
    map[k].estudios++;
    if (e.inquilino_id) map[k].ocupados++; else map[k].disponible++;
    map[k].potencial = round2(map[k].potencial + Number(e.alquiler) + sumaGastosEstudio(db, e.id));
  }
  const cuotas = cobrosMes(db, mesHoy());
  for (const ed of Object.values(map)) {
    const ids = estudios
      .filter((x) => (String(x.edificio || '').trim() || 'Sin edificio') === ed.edificio)
      .map((x) => Number(x.id));
    const suyas = cuotas.filter((c) => ids.includes(Number(c.estudio_id)));
    ed.cobrado = round2(suyas.reduce((s, c) => s + Math.min(Number(c.monto), Number(c.pagado) === 1 ? Number(c.monto) : Number(c.abonado || 0)), 0));
    ed.porCobrar = round2(suyas.filter((c) => Number(c.pagado) !== 1)
      .reduce((s, c) => s + Math.max(0, Number(c.monto) - Number(c.abonado || 0)), 0));
  }
  return Object.values(map).sort((a, b) => (a.edificio < b.edificio ? -1 : 1));
}

// Estadísticas de ocupación: cuántos estudios en cada estado y
// ingreso potencial perdido por los no ocupados.
function resumenOcupacion(db) {
  const cont = { ocupado: 0, disponible: 0, mantenimiento: 0, fuera: 0 };
  let perdido = 0;
  let total = 0;
  for (const e of allToObj(db, 'SELECT * FROM estudios WHERE activo=1')) {
    const s = estadoEstudio(e);
    total++;
    cont[s] = (cont[s] || 0) + 1;
    if (s !== 'ocupado') perdido = round2(perdido + Number(e.alquiler));
  }
  return {
    total, ...cont,
    ocupacionPct: total > 0 ? Math.round((cont.ocupado / total) * 1000) / 10 : 0,
    ingresoPerdido: perdido
  };
}

// ---------- Inquilinos ----------
function listInquilinos(db, q) {
  const qs = '%' + String(q || '').trim() + '%';
  return allToObj(db,
    `SELECT i.*,
       (SELECT e.nombre FROM estudios e WHERE e.inquilino_id = i.id AND e.activo=1) AS estudio_nombre
     FROM inquilinos i
     WHERE i.activo = 1 AND (i.nombre LIKE ? OR i.telefono LIKE ? OR i.whatsapp LIKE ?)
     ORDER BY i.nombre`, [qs, qs, qs]);
}
function getAlquiler(db, id) {
  return rowToObj(db, `SELECT a.*, e.nombre AS estudio_nombre, e.direccion AS estudio_direccion, i.nombre AS inquilino_nombre
    FROM alquileres a LEFT JOIN estudios e ON e.id = a.estudio_id LEFT JOIN inquilinos i ON i.id = a.inquilino_id
    WHERE a.id=?`, [Number(id)]);
}
function getInquilino(db, id) {
  const i = rowToObj(db,
    `SELECT i.*, e.nombre AS estudio_nombre, e.id AS estudio_id
     FROM inquilinos i LEFT JOIN estudios e ON e.inquilino_id = i.id
     WHERE i.id=?`, [Number(id)]);
  if (i) i.alquileres = allToObj(db, 'SELECT * FROM alquileres WHERE inquilino_id=? ORDER BY mes DESC', [i.id]);
  return i;
}
function saveInquilino(db, iq) {
  const nombre = nombreCorto(iq.nombre);
  if (!nombre) throw new Error('El nombre del inquilino es obligatorio');
  const p = {
    nombre, telefono: String(iq.telefono || ''), whatsapp: String(iq.whatsapp || ''),
    email: String(iq.email || ''), notas: String(iq.notas || '')
  };
  let id;
  if (iq.id) {
    run(db,
      `UPDATE inquilinos SET nombre=?,telefono=?,whatsapp=?,email=?,notas=? WHERE id=?`,
      [p.nombre, p.telefono, p.whatsapp, p.email, p.notas, Number(iq.id)]);
    id = Number(iq.id);
  } else {
    run(db, `INSERT INTO inquilinos (nombre,telefono,whatsapp,email,notas) VALUES (?,?,?,?,?)`,
      [p.nombre, p.telefono, p.whatsapp, p.email, p.notas]);
    id = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
  }
  // (Des)ocupar estudio con registro de ocupaciones
  const estudioAsignar = iq.estudio_id ? Number(iq.estudio_id) : null;
  const prev = rowToObj(db, 'SELECT id FROM estudios WHERE inquilino_id=? AND activo=1', [id]);
  if (prev && (!estudioAsignar || Number(prev.id) !== estudioAsignar)) {
    liberarEstudio(db, prev.id);
  }
  run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE inquilino_id=?', ['disponible', id]);
  if (estudioAsignar) {
    run(db, 'UPDATE estudios SET inquilino_id=?, estado=? WHERE id=?', [id, 'ocupado', estudioAsignar]);
    registrarOcupacion(db, estudioAsignar, id);
  }
  return id;
}
function deleteInquilino(db, id) {
  const prev = rowToObj(db, 'SELECT id FROM estudios WHERE inquilino_id=? AND activo=1', [Number(id)]);
  if (prev) liberarEstudio(db, prev.id);
  run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE inquilino_id=?', ['disponible', Number(id)]);
  run(db, 'UPDATE inquilinos SET activo=0 WHERE id=?', [Number(id)]);
}

// ---------- Ocupaciones (historial de quién vivió en cada estudio) ----------
function registrarOcupacion(db, estudioId, inquilinoId) {
  const d = hoy();
  const exist = rowToObj(db,
    'SELECT id FROM ocupaciones WHERE estudio_id=? AND inquilino_id=? AND hasta IS NULL',
    [Number(estudioId), Number(inquilinoId)]);
  if (exist) return;
  run(db, 'UPDATE ocupaciones SET hasta=? WHERE estudio_id=? AND hasta IS NULL', [d, Number(estudioId)]);
  run(db, 'UPDATE ocupaciones SET hasta=? WHERE inquilino_id=? AND hasta IS NULL AND estudio_id<>?',
    [d, Number(inquilinoId), Number(estudioId)]);
  run(db, 'INSERT INTO ocupaciones (estudio_id,inquilino_id,desde) VALUES (?,?,?)',
    [Number(estudioId), Number(inquilinoId), d]);
}
function liberarEstudio(db, estudioId) {
  run(db, 'UPDATE ocupaciones SET hasta=? WHERE estudio_id=? AND hasta IS NULL', [hoy(), Number(estudioId)]);
}
function historialEstudio(db, estudioId) {
  return allToObj(db,
    `SELECT o.*, i.nombre AS inquilino_nombre
     FROM ocupaciones o LEFT JOIN inquilinos i ON i.id = o.inquilino_id
     WHERE o.estudio_id=? ORDER BY o.desde DESC, o.id DESC`, [Number(estudioId)]);
}
function setEstudioFoto(db, id, archivo) {
  run(db, 'UPDATE estudios SET foto=? WHERE id=?', [String(archivo || ''), Number(id)]);
}

// ---------- Cobros por mes ----------
function diaDePago(db) {
  const d = parseInt(getConfig(db, 'dia_pago'), 10);
  return d >= 1 && d <= 31 ? d : 5;
}
function fechaVencDe(mes, dia) {
  const d = Math.min(Math.max(dia || 5, 1), 31);
  return mes + '-' + String(d).padStart(2, '0');
}
// Estado de una cuota: pagado / abonado / vencido / pendiente.
function estadoCuota(c) {
  if (Number(c.pagado) === 1) return 'pagado';
  if (Number(c.abonado || 0) > 0) return 'abonado';
  if (c.fecha_vencimiento && c.fecha_vencimiento < hoy()) return 'vencido';
  return 'pendiente';
}
// Devuelve la cuota de cada estudio activo para `mes` ('YYYY-MM'),
// creándolas si aún no existen (monto = alquiler del estudio).
function cobrosMes(db, mes) {
  const m = String(mes || mesHoy());
  const estudios = allToObj(db,
    `SELECT e.*, i.nombre AS inquilino_nombre, i.whatsapp AS inquilino_whatsapp
     FROM estudios e LEFT JOIN inquilinos i ON i.id = e.inquilino_id
     WHERE e.activo = 1 ORDER BY e.nombre`);
  if (estudios.length) {
    const dia = diaDePago(db);
    run(db, `INSERT OR IGNORE INTO alquileres (estudio_id, inquilino_id, mes, monto, fecha_vencimiento)
             SELECT e.id, e.inquilino_id, ?, e.alquiler +
                    COALESCE((SELECT SUM(g.monto) FROM gastos_estudio g WHERE g.estudio_id = e.id AND g.activo=1), 0), ?
             FROM estudios e WHERE e.activo=1`,
      [m, fechaVencDe(m, dia)]);
    // Re-sincroniza las cuotas del mes que aún no se pagan: renta + total de gastos fijos.
    run(db, `UPDATE alquileres SET
             monto = (SELECT e.alquiler +
                     COALESCE((SELECT SUM(g.monto) FROM gastos_estudio g WHERE g.estudio_id = e.id AND g.activo=1), 0)
                     FROM estudios e WHERE e.id = alquileres.estudio_id),
             inquilino_id = (SELECT e.inquilino_id FROM estudios e WHERE e.id = alquileres.estudio_id),
             fecha_vencimiento = ?
             WHERE mes = ? AND pagado = 0`,
      [fechaVencDe(m, dia), m]);
  }
  const rows = allToObj(db,
    `SELECT a.*, e.nombre AS estudio_nombre, e.direccion AS estudio_direccion, e.edificio AS estudio_edificio,
            i.nombre AS inquilino_nombre, i.whatsapp AS inquilino_whatsapp,
            (SELECT COALESCE(SUM(ab.monto),0) FROM abonos ab WHERE ab.alquiler_id = a.id) AS abonado,
            (SELECT r.numero FROM recibos r WHERE r.alquiler_id = a.id AND r.anulado=0 ORDER BY r.id DESC LIMIT 1) AS recibo_numero,
            (SELECT r.id FROM recibos r WHERE r.alquiler_id = a.id AND r.anulado=0 ORDER BY r.id DESC LIMIT 1) AS recibo_id
     FROM alquileres a
     JOIN estudios e ON e.id = a.estudio_id
     LEFT JOIN inquilinos i ON i.id = a.inquilino_id
     WHERE a.mes = ? AND e.activo = 1
     ORDER BY e.nombre`, [m]);
  return rows.map((c) => ({
    ...c,
    abonado: round2(Number(c.abonado)),
    saldo: round2(Math.max(0, Number(c.monto) - Number(c.abonado))),
    estado: estadoCuota(c),
    vencido: estadoCuota(c) === 'vencido'
  }));
}
function marcarPago(db, alquilerId, pagado, fecha, opts) {
  const o = opts || {};
  const f = fecha || hoy();
  if (pagado) {
    const a = rowToObj(db, 'SELECT * FROM alquileres WHERE id=?', [Number(alquilerId)]);
    if (!a) throw new Error('Cobro no encontrado');
    const abonado = round2(rowToObj(db, 'SELECT COALESCE(SUM(monto),0) AS s FROM abonos WHERE alquiler_id=?', [Number(alquilerId)]).s || 0);
    const faltante = round2(Number(a.monto) - abonado);
    if (faltante > 0) {
      run(db, 'INSERT INTO abonos (alquiler_id,monto,fecha,notas,metodo_pago,referencia) VALUES (?,?,?,?,?,?)',
        [Number(alquilerId), faltante, f, 'Pago completo', String(o.metodo || ''), String(o.referencia || '')]);
    }
    run(db, 'UPDATE alquileres SET pagado=1, fecha_pago=?, metodo_pago=?, referencia_pago=?, registrado_por=? WHERE id=?',
      [f, String(o.metodo || ''), String(o.referencia || ''), String(o.registrado_por || ''), Number(alquilerId)]);
    registrarRecibo(db, { alquiler_id: Number(alquilerId), monto: round2(Number(a.monto)), fecha: f, metodo: String(o.metodo || ''), referencia: String(o.referencia || '') });
  } else {
    run(db, 'DELETE FROM abonos WHERE alquiler_id=?', [Number(alquilerId)]);
    run(db, "UPDATE alquileres SET pagado=0, fecha_pago='' WHERE id=?", [Number(alquilerId)]);
    run(db, 'UPDATE recibos SET anulado=1 WHERE alquiler_id=? AND anulado=0', [Number(alquilerId)]);
  }
}
// ---------- Recibos numerados ----------
function siguienteNumeroRecibo(db, fecha) {
  const f = fecha || hoy();
  const anio = f.slice(0, 4);
  const n = Number(rowToObj(db,
    `SELECT COUNT(*) AS n FROM recibos WHERE numero LIKE ?`, ['REC-' + anio + '-%']).n || 0);
  return 'REC-' + anio + '-' + String(n + 1).padStart(5, '0');
}
function registrarRecibo(db, d) {
  const fe = d.fecha || hoy();
  const numero = d.numero || siguienteNumeroRecibo(db, fe);
  const n = rowToObj(db, 'SELECT id FROM recibos WHERE numero=?', [numero]);
  if (n) throw new Error('El recibo ' + numero + ' ya existe');
  run(db, `INSERT INTO recibos (numero,tipo,alquiler_id,monto,fecha,metodo,referencia) VALUES (?,?,?,?,?,?,?)`,
    [numero, String(d.tipo || 'cobro'), d.alquiler_id || null, round2(d.monto || 0), fe,
     String(d.metodo || ''), String(d.referencia || '')]);
  const id = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
  return getRecibo(db, id);
}
function getRecibo(db, id) {
  return rowToObj(db,
    `SELECT r.*, a.mes, a.estudio_id, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM recibos r
     LEFT JOIN alquileres a ON a.id = r.alquiler_id
     LEFT JOIN estudios e ON e.id = a.estudio_id
     LEFT JOIN inquilinos i ON i.id = a.inquilino_id
     WHERE r.id=?`, [Number(id)]);
}
function recibosDeAlquiler(db, alquilerId) {
  return allToObj(db, 'SELECT * FROM recibos WHERE alquiler_id=? ORDER BY id', [Number(alquilerId)]);
}
function listarRecibos(db, mes) {
  const params = [];
  let w = '';
  if (mes) { w = 'WHERE strftime(\'%Y-%m\', r.fecha) = ?'; params.push(String(mes)); }
  return allToObj(db,
    `SELECT r.*, a.mes AS mes_cuota, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM recibos r
     LEFT JOIN alquileres a ON a.id = r.alquiler_id
     LEFT JOIN estudios e ON e.id = a.estudio_id
     LEFT JOIN inquilinos i ON i.id = a.inquilino_id
     ${w} ORDER BY r.fecha DESC, r.id DESC`, params);
}
function anularRecibo(db, id) {
  const r = getRecibo(db, id);
  if (!r) throw new Error('Recibo no encontrado');
  run(db, 'UPDATE recibos SET anulado=1 WHERE id=?', [Number(id)]);
  // Si este recibo fue el que completó el pago de su cuota y no queda otro
  // recibo vigente para ella, revierte la cuota a pendiente (conserva abonos parciales).
  if (r.alquiler_id) {
    const a = rowToObj(db, 'SELECT * FROM alquileres WHERE id=?', [r.alquiler_id]);
    if (a && Number(a.pagado) === 1) {
      const hayOtro = rowToObj(db,
        'SELECT id FROM recibos WHERE alquiler_id=? AND anulado=0 AND id<>?', [Number(r.alquiler_id), Number(id)]);
      if (!hayOtro) {
        run(db, "UPDATE alquileres SET pagado=0, fecha_pago='' WHERE id=?", [a.id]);
        run(db, "DELETE FROM abonos WHERE alquiler_id=? AND notas='Pago completo'", [a.id]);
      }
    }
  }
  return getRecibo(db, id);
}
function cobradoMes(db, mes) {
  const completos = rowToObj(db,
    `SELECT COALESCE(SUM(monto),0) AS s, COUNT(*) AS n FROM alquileres WHERE mes=? AND pagado=1`, [String(mes)]);
  const parciales = rowToObj(db,
    `SELECT COALESCE(SUM(ab.monto),0) AS s, COUNT(DISTINCT ab.alquiler_id) AS n
     FROM abonos ab JOIN alquileres a ON a.id = ab.alquiler_id
     WHERE strftime('%Y-%m', ab.fecha) = ? AND a.pagado = 0`, [String(mes)]);
  return { monto: round2(Number(completos.s) + Number(parciales.s)), cuantos: Number(completos.n) + Number(parciales.n) };
}

// ---------- Abonos (pagos parciales) ----------
function abonosAlquiler(db, alquilerId) {
  return allToObj(db, 'SELECT * FROM abonos WHERE alquiler_id=? ORDER BY fecha, id', [Number(alquilerId)]);
}
function abonadoAlquiler(db, alquilerId) {
  const r = rowToObj(db, 'SELECT COALESCE(SUM(monto),0) AS s FROM abonos WHERE alquiler_id=?', [Number(alquilerId)]);
  return round2((r && r.s) || 0);
}
function abonoAgregar(db, alquilerId, monto, fecha, notas, opts) {
  const o = opts || {};
  const m = round2(monto);
  if (!(m > 0)) throw new Error('El monto del abono debe ser mayor que 0');
  const a = rowToObj(db, 'SELECT * FROM alquileres WHERE id=?', [Number(alquilerId)]);
  if (!a) throw new Error('Cobro no encontrado');
  if (Number(a.pagado) === 1) throw new Error('Este alquiler ya está pagado');
  const abonado = abonadoAlquiler(db, alquilerId);
  const faltante = round2(Number(a.monto) - abonado);
  if (faltante <= 0) throw new Error('Este alquiler ya está pagado');
  const montoReal = Math.min(m, faltante);
  const f = fecha || hoy();
  run(db, 'INSERT INTO abonos (alquiler_id,monto,fecha,notas,metodo_pago,referencia) VALUES (?,?,?,?,?,?)',
    [Number(alquilerId), montoReal, f, String(notas || ''), String(o.metodo || ''), String(o.referencia || '')]);
  if (round2(abonado + montoReal) >= Number(a.monto)) {
    run(db, 'UPDATE alquileres SET pagado=1, fecha_pago=?, metodo_pago=?, referencia_pago=?, registrado_por=? WHERE id=?',
      [f, String(o.metodo || ''), String(o.referencia || ''), String(o.registrado_por || ''), Number(alquilerId)]);
    registrarRecibo(db, { alquiler_id: Number(alquilerId), monto: round2(Number(a.monto)), fecha: f, metodo: String(o.metodo || ''), referencia: String(o.referencia || '') });
  }
  return abonosAlquiler(db, alquilerId);
}
function abonoEliminar(db, abonoId) {
  const ab = rowToObj(db, 'SELECT * FROM abonos WHERE id=?', [Number(abonoId)]);
  if (!ab) throw new Error('Abono no encontrado');
  run(db, 'DELETE FROM abonos WHERE id=?', [Number(abonoId)]);
  const a = rowToObj(db, 'SELECT * FROM alquileres WHERE id=?', [ab.alquiler_id]);
  if (a && Number(a.pagado) === 1 && abonadoAlquiler(db, a.id) < Number(a.monto)) {
    run(db, "UPDATE alquileres SET pagado=0, fecha_pago='' WHERE id=?", [a.id]);
    run(db, 'UPDATE recibos SET anulado=1 WHERE alquiler_id=? AND anulado=0', [a.id]);
  }
  return { ok: true };
}

// ---------- Gastos ----------
const CATEGORIAS = ['luz', 'agua', 'internet', 'remodelacion', 'otros'];
function listGastos(db, opts) {
  const o = opts || {};
  const where = [];
  const params = [];
  if (o.mes) { where.push("strftime('%Y-%m', fecha) = ?"); params.push(String(o.mes)); }
  if (o.categoria) { where.push('categoria = ?'); params.push(o.categoria); }
  if (o.subcategoria) { where.push('subcategoria = ?'); params.push(o.subcategoria); }
  if (o.estudio_id) { where.push('estudio_id = ?'); params.push(Number(o.estudio_id)); }
  if (o.proveedor) { where.push('proveedor LIKE ?'); params.push('%' + String(o.proveedor) + '%'); }
  if (o.desde) { where.push('fecha >= ?'); params.push(o.desde); }
  if (o.hasta) { where.push('fecha <= ?'); params.push(o.hasta); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return allToObj(db,
    `SELECT g.*, e.nombre AS estudio_nombre
     FROM gastos g LEFT JOIN estudios e ON e.id = g.estudio_id
     ${w} ORDER BY g.fecha DESC, g.id DESC`, params);
}
function getGasto(db, id) { return rowToObj(db, 'SELECT * FROM gastos WHERE id=?', [Number(id)]); }
function saveGasto(db, g) {
  const monto = round2(g.monto);
  if (!(monto > 0)) throw new Error('El monto debe ser mayor que 0');
  const cat = CATEGORIAS.indexOf(g.categoria) >= 0 ? g.categoria : 'otros';
  const fecha = g.fecha || hoy();
  const p = {
    categoria: cat, concepto: String(g.concepto || ''), monto,
    fecha, estudio_id: g.estudio_id ? Number(g.estudio_id) : null, notas: String(g.notas || ''),
    subcategoria: String(g.subcategoria || ''),
    proveedor: String(g.proveedor || ''),
    metodo_pago: String(g.metodo_pago || ''),
    referencia: String(g.referencia || ''),
    comprobante: String(g.comprobante || '')
  };
  if (g.id) {
    run(db,
      `UPDATE gastos SET categoria=?,concepto=?,monto=?,fecha=?,estudio_id=?,notas=?,
        subcategoria=?,proveedor=?,metodo_pago=?,referencia=?,comprobante=? WHERE id=?`,
      [p.categoria, p.concepto, p.monto, p.fecha, p.estudio_id, p.notas,
       p.subcategoria, p.proveedor, p.metodo_pago, p.referencia, p.comprobante, Number(g.id)]);
    return Number(g.id);
  }
  run(db, `INSERT INTO gastos (categoria,concepto,monto,fecha,estudio_id,notas,subcategoria,proveedor,metodo_pago,referencia,comprobante)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [p.categoria, p.concepto, p.monto, p.fecha, p.estudio_id, p.notas,
     p.subcategoria, p.proveedor, p.metodo_pago, p.referencia, p.comprobante]);
  const id = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
  return id;
}
function deleteGasto(db, id) { run(db, 'DELETE FROM gastos WHERE id=?', [Number(id)]); }
function gastosMes(db, mes) {
  const m = String(mes || mesHoy());
  const rows = allToObj(db,
    `SELECT categoria, SUM(monto) AS total FROM gastos WHERE strftime('%Y-%m',fecha)=? GROUP BY categoria`, [m]);
  const porCategoria = {};
  let total = 0;
  for (const r of rows) { porCategoria[r.categoria] = round2(r.total); total = round2(total + Number(r.total)); }
  return { porCategoria, total };
}

// ---------- Importación desde Excel (carga masiva de estudios) ----------
function numImport(v) {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
  const s = String(v).replace(/[^\d.,-]/g, '');
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
function importarEstudios(db, filas) {
  const res = { creados: 0, actualizados: 0, inquilinosCreados: 0, vinculados: 0, errores: [] };
  for (const f of filas) {
    try {
      const nombre = String(f.estudio || '').trim();
      if (!nombre) continue;
      const exist = rowToObj(db, 'SELECT * FROM estudios WHERE activo=1 AND nombre=? COLLATE NOCASE', [nombre]);
      const alquiler = numImport(f.alquiler);
      const deposito = numImport(f.deposito);
      const direccion = String(f.direccion || '').trim();
      let estudioId;
      if (exist) {
        run(db,
          `UPDATE estudios SET nombre=?, direccion=?, alquiler=?, deposito=? WHERE id=?`,
          [nombre, direccion || exist.direccion, alquiler == null ? exist.alquiler : alquiler,
           deposito == null ? exist.deposito : deposito, exist.id]);
        estudioId = exist.id;
        res.actualizados++;
      } else {
        run(db,
          `INSERT INTO estudios (nombre,direccion,alquiler,deposito) VALUES (?,?,?,?)`,
          [nombre, direccion, alquiler || 0, deposito || 0]);
        estudioId = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
        res.creados++;
      }
      const nombreIq = String(f.inquilino || '').trim();
      if (nombreIq) {
        const iq = rowToObj(db, 'SELECT * FROM inquilinos WHERE activo=1 AND nombre=? COLLATE NOCASE', [nombreIq]);
        let iqId;
        if (iq) iqId = iq.id;
        else {
          run(db, 'INSERT INTO inquilinos (nombre,telefono,whatsapp) VALUES (?,?,?)',
            [nombreIq, String(f.telefono || ''), String(f.whatsapp || '')]);
          iqId = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
          res.inquilinosCreados++;
        }
        run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE inquilino_id=?', ['disponible', iqId]);
        run(db, 'UPDATE estudios SET inquilino_id=?, estado=? WHERE id=?', [iqId, 'ocupado', estudioId]);
        res.vinculados++;
      }
    } catch (err) {
      res.errores.push((String(f.estudio || 'fila') + ': ' + ((err && err.message) || err)));
    }
  }
  return res;
}

// ---------- Aging: antigüedad de deudas (0 / 1 / 2 / 3+ meses) ----------
function agingMes(db, mes) {
  const m = String(mes || mesHoy());
  const [yA, mA] = m.split('-').map(Number);
  const filas = {};
  for (const c of allToObj(db, `SELECT a.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
    FROM alquileres a JOIN estudios e ON e.id = a.estudio_id
    LEFT JOIN inquilinos i ON i.id = a.inquilino_id
    WHERE a.pagado = 0 AND e.activo = 1 ORDER BY a.mes`)) {
    const k = c.inquilino_nombre || c.estudio_nombre;
    const [yC, mC] = String(c.mes).split('-').map(Number);
    const dif = (yA - yC) * 12 + (mA - mC);
    const cat = dif <= 0 ? 'mes0' : dif === 1 ? 'mes1' : dif === 2 ? 'mes2' : 'mes3plus';
    filas[k] = filas[k] || { nombre: k, mes0: 0, mes1: 0, mes2: 0, mes3plus: 0, total: 0 };
    filas[k][cat] = round2(filas[k][cat] + Number(c.monto));
    filas[k].total = round2(filas[k].total + Number(c.monto));
  }
  const lista = Object.values(filas).filter((f) => f.total > 0);
  const total = (k) => round2(lista.reduce((s, f) => s + f[k], 0));
  return {
    filas: lista,
    totalMes0: total('mes0'), totalMes1: total('mes1'), totalMes2: total('mes2'),
    totalMes3plus: total('mes3plus'), total: total('total')
  };
}

// ---------- Resumen / Dashboard ----------
function resumenMes(db, mes) {
  const m = String(mes || mesHoy());
  const cobros = cobrosMes(db, m);
  const cobrado = cobradoMes(db, m);
  const porCobrar = round2(cobros.filter((c) => !c.pagado).reduce((s, c) => s + Math.max(0, Number(c.monto) - Number(c.abonado || 0)), 0));
  const pendientes = cobros.filter((c) => !c.pagado);
  const gastos = gastosMes(db, m);

  const atrasados = allToObj(db,
    `SELECT a.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM alquileres a
     JOIN estudios e ON e.id = a.estudio_id
     LEFT JOIN inquilinos i ON i.id = a.inquilino_id
     WHERE a.mes < ? AND a.pagado = 0 AND e.activo = 1
     ORDER BY a.mes`, [m]);
  const totalAtrasado = round2(atrasados.reduce((s, a) => s + Number(a.monto), 0));

  const depositosRecibidos = round2(rowToObj(db,
    `SELECT COALESCE(SUM(deposito),0) AS s FROM estudios WHERE activo=1 AND deposito>0`).s || 0);

  const deudores = {};
  for (const c of [...pendientes, ...atrasados]) {
    const k = c.inquilino_nombre || c.estudio_nombre;
    deudores[k] = round2((deudores[k] || 0) + Number(c.monto));
  }

  const invCapex = rowToObj(db, 'SELECT SUM(costo_inversion) AS tot FROM estudios WHERE activo=1');
  const inversion = round2(invCapex && invCapex.tot ? invCapex.tot : 0);

  const vencido = round2(pendientes
    .filter((c) => c.fecha_vencimiento && c.fecha_vencimiento < hoy())
    .reduce((s, c) => s + Math.max(0, Number(c.monto) - Number(c.abonado || 0)), 0));

  return {
    empresa: getEmpresa(db).nombre,
    mes: m,
    estudios: countEstudios(db),
    ocupados: countOcupados(db),
    ocupacion: resumenOcupacion(db),
    cobrado: cobrado.monto,
    cobradoCuota: cobrado.cuantos,
    porCobrar,
    vencido,
    pendientes,
    gastos,
    totalAtrasado,
    atrasados,
    depositos: depositosRecibidos,
    inversion,
    neto: round2(cobrado.monto - gastos.total),
    deudores
  };
}
function countEstudios(db) { return Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM estudios WHERE activo=1').n || 0); }
function countOcupados(db) { return Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM estudios WHERE activo=1 AND inquilino_id IS NOT NULL').n || 0); }

// ---------- Tendencia: cobrado vs gastos de los últimos N meses ----------
function tendencia(db, n) {
  const nMes = Number(n) || 12;
  const base = new Date();
  const out = [];
  for (let i = nMes - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    out.push({ mes, cobrado: cobradoMes(db, mes).monto, gastos: gastosMes(db, mes).total });
  }
  return out;
}

// ---------- Reporte financiero consolidado del mes ----------
function reporteFinanciero(db, mes) {
  const m = String(mes || mesHoy());
  const base = resumenMes(db, m);
  const aging = agingMes(db, m);
  const recibos = listarRecibos(db, m).filter((r) => Number(r.anulado) !== 1);
  const topDeudores = Object.entries(base.deudores || {})
    .map(([nombre, monto]) => ({ nombre, monto: round2(monto) }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);
  const porCategoria = base.gastos.porCategoria || {};
  return {
    mes: m,
    base,
    enLetras: {
      cobrado: base.cobrado,
      porCobrar: base.porCobrar,
      totalAtrasado: base.totalAtrasado,
      gastos: base.gastos.total,
      neto: base.neto,
      recibos: recibos.length,
      ocupados: base.ocupados,
      estudios: base.estudios
    },
    porCategoria,
    recibos,
    topDeudores,
    aging: {
      total: aging.total, totalMes1: aging.totalMes1, totalMes2: aging.totalMes2, totalMes3plus: aging.totalMes3plus
    },
    tendencia: tendencia(db, 6)
  };
}

// ---------- Reporte anual (12 meses del año, totales y comparativa) ----------
// Calcula los 12 meses de un año y sus totales (sin recursión: usada para el
// año en curso y para la comparativa del año anterior).
function seriesAnio(db, anioN) {
  const meses = [];
  const deudores = {};
  let ocupacionAcum = 0;
  const cuotaMes = (mes) => round2(rowToObj(db,
    'SELECT COALESCE(SUM(monto),0) AS s FROM alquileres WHERE mes=?', [mes]).s || 0);
  for (let m = 1; m <= 12; m++) {
    const mes = anioN + '-' + String(m).padStart(2, '0');
    const r = resumenMes(db, mes);
    const neto = round2(Number(r.cobrado) - Number(r.gastos.total));
    meses.push({
      mes,
      cobrado: r.cobrado,
      gastos: Number(r.gastos.total),
      cuota: cuotaMes(mes),
      neto,
      ocupados: r.ocupados,
      estudios: r.estudios
    });
    ocupacionAcum += Number((r.ocupacion && r.ocupacion.ocupacionPct) || 0);
    for (const [nombre, monto] of Object.entries(r.deudores || {})) {
      deudores[nombre] = round2((deudores[nombre] || 0) + Number(monto));
    }
  }
  const tmp = (k) => meses.reduce((s, m) => s + Number(m[k]), 0);
  const rec = rowToObj(db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(monto),0) AS s FROM recibos
     WHERE anulado=0 AND strftime('%Y', fecha)=?`, [String(anioN)]);
  const topDeudores = Object.entries(deudores)
    .map(([nombre, monto]) => ({ nombre, monto: round2(monto) }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);
  const totCobrado = round2(tmp('cobrado'));
  const totGastos = round2(tmp('gastos'));
  return {
    meses,
    totales: {
      cobrado: totCobrado, gastos: totGastos, neto: round2(totCobrado - totGastos),
      cuota: round2(tmp('cuota')),
      porCobrarAnual: round2(tmp('cuota') - totCobrado),
      recibos: Number(rec.n || 0),
      montoRecibos: round2(rec.s || 0),
      ocupacionPromedio: round2(ocupacionAcum / 12)
    },
    topDeudores
  };
}
function reporteAnual(db, anio) {
  const enCurso = String(anio || new Date().getFullYear());
  const anioN = parseInt(enCurso, 10) || new Date().getFullYear();
  const actual = seriesAnio(db, anioN);
  const prev = seriesAnio(db, anioN - 1);
  const prevNeto = round2(Number(prev.totales.cobrado) - Number(prev.totales.gastos));
  const pct = (prevV, cur) => prevV > 0 ? round2(((cur - prevV) / prevV) * 100) : null;

  return {
    anio: anioN,
    meses: actual.meses,
    totales: actual.totales,
    topDeudores: actual.topDeudores,
    comparativa: {
      anioPrev: anioN - 1,
      cobrado: prev.totales.cobrado, gastos: prev.totales.gastos, neto: prevNeto,
      diffCobradoPct: pct(Number(prev.totales.cobrado), actual.totales.cobrado),
      diffGastosPct: pct(Number(prev.totales.gastos), actual.totales.gastos),
      diffNetoPct: pct(prevNeto, actual.totales.neto)
    }
  };
}

// ---------- Rentabilidad por estudio (cobrado histórico - gastos vs inversión) ----------
function rentabilidadEstudios(db) {
  const filas = allToObj(db, `SELECT e.id, e.nombre, e.alquiler, e.deposito, e.costo_inversion,
    (SELECT COALESCE(SUM(ab.monto),0) FROM alquileres a JOIN abonos ab ON ab.alquiler_id = a.id
       WHERE a.estudio_id = e.id) AS cobrado_abonos,
    (SELECT COALESCE(SUM(monto),0) FROM alquileres WHERE estudio_id = e.id AND pagado = 1
       AND NOT EXISTS (SELECT 1 FROM abonos b WHERE b.alquiler_id = alquileres.id)) AS cobrado_antiguo,
    (SELECT COALESCE(SUM(g.monto),0) FROM gastos g WHERE g.estudio_id = e.id) AS gastos_hist
    FROM estudios e WHERE e.activo = 1 ORDER BY e.nombre`);
  return filas.map((f) => {
    const cobrado = round2(Number(f.cobrado_abonos) + Number(f.cobrado_antiguo));
    const gastos = round2(Number(f.gastos_hist));
    const inversion = round2(Number(f.costo_inversion) || 0);
    const utilidad = round2(cobrado - gastos);
    return {
      id: f.id, nombre: f.nombre, alquiler: f.alquiler, deposito: f.deposito,
      costo_inversion: inversion, cobrado, gastos, utilidad,
      retorno: inversion > 0 ? round2((utilidad / inversion) * 100) : 0
    };
  });
}

// Deudas por mes, para recordatorios WhatsApp.
function deudasPorInquilino(db, mes) {
  const m = String(mes || mesHoy());
  const rows = allToObj(db,
    `SELECT i.id, i.nombre, i.whatsapp,
            SUM(CASE WHEN a.mes = ? THEN a.monto ELSE 0 END) AS mes_actual,
            SUM(CASE WHEN a.mes < ? AND a.pagado = 0 THEN a.monto ELSE 0 END) AS atrasado
     FROM alquileres a JOIN inquilinos i ON i.id = a.inquilino_id
     WHERE (a.mes = ? AND a.pagado = 0) OR (a.mes < ? AND a.pagado = 0)
     GROUP BY i.id, i.nombre, i.whatsapp
     HAVING mes_actual > 0 OR atrasado > 0
     ORDER BY i.nombre`, [m, m, m, m]);
  return rows.map((r) => ({ ...r, total: round2(Number(r.mes_actual) + Number(r.atrasado)) }));
}

// ---------- Config ----------
function getConfig(db, clave) {
  const r = rowToObj(db, 'SELECT valor FROM config WHERE clave=?', [clave]);
  return r ? r.valor : null;
}
function setConfig(db, clave, valor) {
  run(db, `INSERT INTO config (clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
    [clave, String(valor)]);
}

// ---------- Backup ----------
function backupInfo(db) {
  return {
    estudios: Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM estudios').n || 0),
    inquilinos: Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM inquilinos').n || 0),
    cobros: Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM alquileres').n || 0),
    gastos: Number(rowToObj(db, 'SELECT COUNT(*) AS n FROM gastos').n || 0)
  };
}

// ---------- Órdenes de mantenimiento ----------
function getOrden(db, id) { return rowToObj(db, 'SELECT * FROM ordenes WHERE id=?', [Number(id)]); }
function crearOrden(db, d) {
  run(db, `INSERT INTO ordenes (estudio_id,inquilino_id,detalle,estado,prioridad,costo_estimado,proveedor)
           VALUES (?,?,?,?,?,?,?)`,
    [d.estudio_id || null, d.inquilino_id || null, String(d.detalle || ''), 'abierta',
     String(d.prioridad || 'media'), round2(d.costo_estimado || 0), String(d.proveedor || '')]);
  const id = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  return getOrden(db, id);
}
function listOrdenes(db, opts) {
  const o = opts || {};
  const w = [];
  const params = [];
  if (o.estado) { w.push('o.estado = ?'); params.push(o.estado); }
  if (o.estudio_id) { w.push('o.estudio_id = ?'); params.push(Number(o.estudio_id)); }
  if (o.prioridad) { w.push('o.prioridad = ?'); params.push(o.prioridad); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  return allToObj(db, `SELECT o.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
    FROM ordenes o
    LEFT JOIN estudios e ON e.id = o.estudio_id
    LEFT JOIN inquilinos i ON i.id = o.inquilino_id
    ${where}
    ORDER BY CASE o.estado WHEN 'abierta' THEN 0 ELSE 1 END, o.id DESC`, params);
}
function ordenesAbiertas(db) {
  return allToObj(db, `SELECT o.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
    FROM ordenes o LEFT JOIN estudios e ON e.id = o.estudio_id LEFT JOIN inquilinos i ON i.id = o.inquilino_id
    WHERE o.estado = 'abierta' ORDER BY o.id DESC`);
}
function cerrarOrden(db, id, costo, notas) {
  run(db, `UPDATE ordenes SET estado='cerrada', costo=?, cerrado=datetime('now','localtime'),
          fecha_cierre=? WHERE id=?`, [round2(costo), hoy(), Number(id)]);
  if (notas) run(db, 'UPDATE ordenes SET detalle = ? WHERE id=?', [String(notas), Number(id)]);
  return getOrden(db, id);
}
function deleteOrden(db, id) { run(db, 'DELETE FROM ordenes WHERE id=?', [Number(id)]); }
function resumenMantenimientoEstudio(db, estudioId) {
  const r = rowToObj(db,
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN estado='cerrada' THEN costo ELSE 0 END),0) AS costoT,
            COUNT(CASE WHEN estado='abierta' THEN 1 END) AS abiertas,
            (SELECT detalle FROM ordenes WHERE estudio_id=? AND estado='cerrada' ORDER BY id DESC LIMIT 1) AS ultimo_detalle,
            (SELECT costo FROM ordenes WHERE estudio_id=? AND estado='cerrada' ORDER BY id DESC LIMIT 1) AS ultimo_costo,
            (SELECT fecha_cierre FROM ordenes WHERE estudio_id=? AND estado='cerrada' ORDER BY id DESC LIMIT 1) AS ultima_fecha
     FROM ordenes WHERE estudio_id=?`,
    [Number(estudioId), Number(estudioId), Number(estudioId), Number(estudioId)]);
  return {
    n: Number(r.n || 0), costoT: round2(r.costoT || 0), abiertas: Number(r.abiertas || 0),
    ultimo_detalle: r.ultimo_detalle || '', ultimo_costo: round2(r.ultimo_costo || 0),
    ultima_fecha: r.ultima_fecha || ''
  };
}

// ---------- Contratos ----------
function estadoContrato(c) {
  if (String(c.estado) === 'terminado') return 'terminado';
  const hoyD = hoy();
  if (!c.fecha_vencimiento) return 'activo';
  if (c.fecha_vencimiento < hoyD) return 'vencido';
  const v = new Date(c.fecha_vencimiento + 'T00:00:00');
  const h = new Date(hoyD + 'T00:00:00');
  const dias = Math.round((v.getTime() - h.getTime()) / 86400000);
  if (dias <= 30) return 'proximo';
  return 'activo';
}
function listarContratos(db, opts) {
  const o = opts || {};
  const w = [];
  const params = [];
  if (o.estudio_id) { w.push('c.estudio_id = ?'); params.push(Number(o.estudio_id)); }
  if (o.inquilino_id) { w.push('c.inquilino_id = ?'); params.push(Number(o.inquilino_id)); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const filas = allToObj(db,
    `SELECT c.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre, i.telefono AS inquilino_telefono,
            (SELECT renta FROM contratos WHERE id = c.renovado_de) AS renta_anterior
     FROM contratos c
     LEFT JOIN estudios e ON e.id = c.estudio_id
     LEFT JOIN inquilinos i ON i.id = c.inquilino_id
     ${where}
     ORDER BY c.id DESC`, params);
  return filas.map((c) => ({ ...c, estado: estadoContrato(c), dias_restantes: diasHasta(c.fecha_vencimiento) }));
}
function getContrato(db, id) {
  const c = rowToObj(db, `SELECT c.*, e.nombre AS estudio_nombre, e.direccion AS estudio_direccion,
    i.nombre AS inquilino_nombre, i.telefono AS inquilino_telefono, i.whatsapp AS inquilino_whatsapp,
    (SELECT renta FROM contratos WHERE id = c.renovado_de) AS renta_anterior
    FROM contratos c LEFT JOIN estudios e ON e.id = c.estudio_id LEFT JOIN inquilinos i ON i.id = c.inquilino_id
    WHERE c.id=?`, [Number(id)]);
  if (c) {
    c.estado = estadoContrato(c);
    c.promesas = allToObj(db,
      `SELECT p.*, a.mes, e.nombre AS estudio_nombre
       FROM promesas p JOIN alquileres a ON a.id = p.alquiler_id
       LEFT JOIN estudios e ON e.id = a.estudio_id
       WHERE p.inquilino_id=? ORDER BY p.fecha_prometida DESC`, [c.inquilino_id]);
  }
  return c;
}
function saveContrato(db, c) {
  if (!c.estudio_id) throw new Error('El estudio es obligatorio');
  const estudioId = Number(c.estudio_id);
  // Si vienen datos de un inquilino nuevo (sin id), créalo y asócialo al estudio.
  let inquilinoId = c.inquilino_id ? Number(c.inquilino_id) : null;
  const nq = c.nuevo_inquilino || {};
  const nqNombre = String(nq.nombre || '').trim();
  if (!inquilinoId && !nqNombre) throw new Error('El inquilino es obligatorio (elige uno o escribe el nombre del nuevo)');
  if (!inquilinoId) {
    inquilinoId = saveInquilino(db, {
      nombre: nq.nombre, telefono: nq.telefono, whatsapp: nq.whatsapp,
      estudio_id: estudioId
    });
  }
  const p = {
    estudio_id: estudioId, inquilino_id: inquilinoId,
    fecha_inicio: String(c.fecha_inicio || hoy()),
    fecha_vencimiento: String(c.fecha_vencimiento || ''),
    duracion_meses: parseInt(c.duracion_meses, 10) || 12,
    renta: round2(c.renta), deposito: round2(c.deposito),
    dia_pago: parseInt(c.dia_pago, 10) || 5,
    incremento_pct: round2(c.incremento_pct || 0),
    aval_nombre: String(c.aval_nombre || ''), aval_telefono: String(c.aval_telefono || ''),
    notas: String(c.notas || ''),
    renovado_de: c.renovado_de ? Number(c.renovado_de) : null
  };
  let id;
  if (c.id) {
    run(db, `UPDATE contratos SET estudio_id=?,inquilino_id=?,fecha_inicio=?,fecha_vencimiento=?,
      duracion_meses=?,renta=?,deposito=?,dia_pago=?,incremento_pct=?,aval_nombre=?,aval_telefono=?,notas=?,renovado_de=?
      WHERE id=?`,
      [p.estudio_id, p.inquilino_id, p.fecha_inicio, p.fecha_vencimiento, p.duracion_meses,
       p.renta, p.deposito, p.dia_pago, p.incremento_pct, p.aval_nombre, p.aval_telefono, p.notas,
       p.renovado_de, Number(c.id)]);
    id = Number(c.id);
  } else {
    run(db, `INSERT INTO contratos (estudio_id,inquilino_id,fecha_inicio,fecha_vencimiento,duracion_meses,
      renta,deposito,dia_pago,incremento_pct,aval_nombre,aval_telefono,notas,renovado_de) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.estudio_id, p.inquilino_id, p.fecha_inicio, p.fecha_vencimiento, p.duracion_meses,
       p.renta, p.deposito, p.dia_pago, p.incremento_pct, p.aval_nombre, p.aval_telefono, p.notas,
       p.renovado_de]);
    id = Number(rowToObj(db, 'SELECT last_insert_rowid() AS id').id);
  }
  // Correlación: el contrato es la fuente de verdad de quién ocupa el estudio.
  // Asignar este inquilino al estudio (y quitarlo de cualquier otro estudio) con
  // registro de ocupación, y dejar el estado acorde.
  const actual = rowToObj(db, 'SELECT inquilino_id FROM estudios WHERE id=?', [estudioId]);
  if (!actual || Number(actual.inquilino_id) !== inquilinoId) {
    if (actual && actual.inquilino_id) liberarEstudio(db, estudioId);
    run(db, 'UPDATE estudios SET inquilino_id=?, estado=? WHERE id=?', [inquilinoId, 'ocupado', estudioId]);
  }
  registrarOcupacion(db, estudioId, inquilinoId);
  run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE inquilino_id=? AND id<>?',
    ['disponible', inquilinoId, estudioId]);
  // Aplicar renta, depósito y día de pago al estudio.
  run(db, 'UPDATE estudios SET alquiler=?, deposito=? WHERE id=?', [p.renta, p.deposito, estudioId]);
  if (p.dia_pago) setConfig(db, 'dia_pago', String(p.dia_pago));
  // Sincronizar la cuota vigente del estudio (mes actual, sin pagar) con inquilino y renta.
  run(db, `UPDATE alquileres SET inquilino_id=?, monto=?, fecha_vencimiento=?
           WHERE estudio_id=? AND mes=? AND pagado=0`,
    [inquilinoId, p.renta, fechaVencDe(mesHoy(), p.dia_pago), estudioId, mesHoy()]);
  return getContrato(db, id);
}
function terminarContrato(db, id) {
  const c = getContrato(db, id);
  if (!c) throw new Error('Contrato no encontrado');
  run(db, "UPDATE contratos SET estado='terminado' WHERE id=?", [Number(id)]);
  // Correlación: si este contrato era el que ocupaba el estudio, liberarlo.
  const est = rowToObj(db, 'SELECT inquilino_id FROM estudios WHERE id=?', [c.estudio_id]);
  if (est && Number(est.inquilino_id) === Number(c.inquilino_id)) {
    liberarEstudio(db, Number(c.estudio_id));
    run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE id=?', ['disponible', Number(c.estudio_id)]);
  }
  return getContrato(db, id);
}
function eliminarContrato(db, id) {
  const c = getContrato(db, id);
  if (!c) throw new Error('Contrato no encontrado');
  // Si este contrato es el que ocupa el estudio, libéralo antes de borrarlo.
  const est = rowToObj(db, 'SELECT inquilino_id FROM estudios WHERE id=?', [c.estudio_id]);
  if (est && Number(est.inquilino_id) === Number(c.inquilino_id) && String(c.estado) !== 'terminado') {
    liberarEstudio(db, Number(c.estudio_id));
    run(db, 'UPDATE estudios SET inquilino_id=NULL, estado=? WHERE id=?', ['disponible', Number(c.estudio_id)]);
  }
  run(db, 'DELETE FROM contratos WHERE id=?', [Number(id)]);
  return { ok: true };
}
function renovarContrato(db, id, nuevaVencimiento, nuevaRenta, nuevaDuracion) {
  const c = getContrato(db, id);
  if (!c) throw new Error('Contrato no encontrado');
  let renta = Number(nuevaRenta);
  if (!isFinite(renta) || renta <= 0) renta = Number(c.renta);
  const duracion = Math.max(1, Number(nuevaDuracion) || Number(c.duracion_meses) || 12);
  const nuevo = {
    estudio_id: c.estudio_id, inquilino_id: c.inquilino_id,
    fecha_inicio: hoy(),
    fecha_vencimiento: nuevaVencimiento || '',
    duracion_meses: duracion, renta, deposito: c.deposito,
    dia_pago: c.dia_pago, incremento_pct: c.incremento_pct,
    aval_nombre: c.aval_nombre, aval_telefono: c.aval_telefono, notas: c.notas,
    renovado_de: Number(id)
  };
  run(db, "UPDATE contratos SET estado='terminado' WHERE id=?", [Number(id)]);
  const nuevoObj = saveContrato(db, nuevo);
  const nuevoId = nuevoObj ? Number(nuevoObj.id) : null;
  return getContrato(db, nuevoId);
}
function contratosPorVencer(db, dias) {
  const d = Number(dias) || 30;
  const limite = new Date();
  limite.setDate(limite.getDate() + d);
  const lim = limite.toISOString().slice(0, 10);
  return allToObj(db,
    `SELECT c.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM contratos c
     LEFT JOIN estudios e ON e.id = c.estudio_id
     LEFT JOIN inquilinos i ON i.id = c.inquilino_id
     WHERE c.estado = 'activo' AND c.fecha_vencimiento <> '' AND c.fecha_vencimiento <= ?
     ORDER BY c.fecha_vencimiento`, [lim])
    .map((c) => ({ ...c, estado: estadoContrato(c), dias_restantes: diasHasta(c.fecha_vencimiento) }));
}
function diasHasta(fecha) {
  if (!fecha) return null;
  const f = new Date(fecha + 'T00:00:00');
  const h = new Date(hoy() + 'T00:00:00');
  return Math.round((f.getTime() - h.getTime()) / 86400000);
}

// ---------- Notas ----------
function listNotas(db, entidad, entidadId) {
  return allToObj(db, 'SELECT * FROM notas WHERE entidad=? AND entidad_id=? ORDER BY id DESC',
    [String(entidad), Number(entidadId)]);
}
function agregarNota(db, entidad, entidadId, texto, usuario) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('La nota está vacía');
  run(db, 'INSERT INTO notas (entidad,entidad_id,texto,usuario) VALUES (?,?,?,?)',
    [String(entidad), Number(entidadId), t, String(usuario || '')]);
  return listNotas(db, entidad, entidadId);
}
function borrarNota(db, id) { run(db, 'DELETE FROM notas WHERE id=?', [Number(id)]); return { ok: true }; }

// ---------- WhatsApp ----------
// Normaliza un número dominicano para wa.me: 1 + 10 dígitos.
function normalizarWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  if (d.length === 11 && d[0] === '1') return d;
  return d;
}
function enlaceWhatsApp(tel) { return 'https://wa.me/' + normalizarWhatsApp(tel); }
const PLANTILLA_WHATSAPP = {
  amistoso: (iq, m) =>
    `Hola ${iq}, te saluda HABITIA. Te recordamos que puedes abonar o pagar el alquiler de tu estudio. Cualquier pendiente de RD$${m || ''} esperamos regularizarlo pronto. ¡Gracias!`,
  vencido: (iq, m) =>
    `Hola ${iq}, tu alquiler por RD$${m || ''} está vencido. Por favor regulariza tu pago lo antes posible para evitar retrasos. Si ya pagaste, ignora este mensaje. ¡Gracias!`,
  abono_pendiente: (iq, m) =>
    `Hola ${iq}, solo te faltaría RD$${m || ''} para completar el alquiler de este mes. Puedes depositarlo y enviarnos el comprobante. ¡Gracias!`,
  proximo_vencimiento: (iq, m, f) =>
    `Hola ${iq}, tu alquiler de RD$${m || ''} vence el día ${f || ''}. Te recordamos realizarlo a tiempo. ¡Gracias!`
};
function plantillaWhatsApp(tipo, inquilinoNombre, monto, fechaVenc) {
  const fn = PLANTILLA_WHATSAPP[tipo] || PLANTILLA_WHATSAPP.amistoso;
  return fn(inquilinoNombre || '', monto, fechaVenc || '');
}

// ---------- Pagos aplicados desde el bot/IA (estudio + mes) ----------
function aplicarPago(db, estudioId, mes, monto, notas) {
  const a = rowToObj(db, 'SELECT * FROM alquileres WHERE estudio_id=? AND mes=?', [Number(estudioId), String(mes)]);
  if (!a) throw new Error('No existe el alquiler de ' + mes + ' para ese estudio');
  if (Number(a.pagado) === 1) throw new Error('Ese alquiler (' + mes + ') ya está pagado');
  const abonado = abonadoAlquiler(db, a.id);
  const faltante = round2(Number(a.monto) - abonado);
  const montoReal = Math.min(Math.round((Number(monto) || 0) * 100) / 100, faltante);
  if (montoReal <= 0) throw new Error('Monto no válido');
  const completo = round2(abonado + montoReal) >= Number(a.monto);
  if (completo) {
    marcarPago(db, a.id, true, hoy());
  } else {
    abonoAgregar(db, a.id, montoReal, hoy(), notas || 'Pago por WhatsApp');
  }
  const pendiente = round2(Math.max(0, Number(a.monto) - round2(abonado + montoReal)));
  const e = getEstudio(db, a.estudio_id);
  return { alquiler_id: a.id, estudio_id: Number(estudioId), estudio_nombre: (e && e.nombre) || ('Estudio ' + estudioId), mes, monto: round2(montoReal), pagado_completo: completo, pendiente };
}

// ---------- Estado de cuenta por inquilino ----------
function estadoCuentaInquilino(db, inquilinoId) {
  const iq = getInquilino(db, Number(inquilinoId));
  if (!iq) throw new Error('Inquilino no encontrado');
  const filas = allToObj(db, `SELECT a.id AS alquiler_id, a.mes, a.monto, a.pagado, a.fecha_pago,
      e.id AS estudio_id, e.nombre AS estudio_nombre, e.alquiler AS alquiler_mensual
    FROM alquileres a JOIN estudios e ON e.id = a.estudio_id
    WHERE a.inquilino_id = ? ORDER BY a.mes, e.nombre`, [Number(inquilinoId)]);
  const movimientos = filas.map((f) => {
    const abonado = abonadoAlquiler(db, f.alquiler_id);
    const pendiente = round2(Math.max(0, Number(f.monto) - abonado));
    return {
      ...f,
      abonado,
      pendiente,
      estado: Number(f.pagado) === 1 ? 'pagado' : (abonado > 0 ? 'parcial' : 'pendiente')
    };
  });
  const pagado = round2(movimientos.reduce((s, f) => s + f.abonado, 0));
  const debido = round2(movimientos.reduce((s, f) => s + f.pendiente, 0));
  return { inquilino: iq, movimientos, pagado, debido };
}

// ---------- Promesas de pago ("pagaré el día X") ----------
function fechaPrometidaDe(dia) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dia).trim())) return String(dia).trim();
  const hoyD = new Date();
  let d = parseInt(String(dia).replace(/\D/g, ''), 10);
  if (!(d >= 1 && d <= 31)) d = hoyD.getDate();
  const candidato = new Date(hoyD.getFullYear(), hoyD.getMonth(), d);
  if (candidato.getTime() < hoyD.getTime()) candidato.setMonth(candidato.getMonth() + 1);
  return `${candidato.getFullYear()}-${String(candidato.getMonth() + 1).padStart(2, '0')}-${String(candidato.getDate()).padStart(2, '0')}`;
}
function promesaAgregar(db, inquilinoId, alquilerId, dia, notas) {
  const a = rowToObj(db, 'SELECT * FROM alquileres WHERE id=?', [Number(alquilerId)]);
  if (!a) throw new Error('Alquiler no encontrado');
  const fecha = fechaPrometidaDe(dia);
  run(db, 'INSERT INTO promesas (inquilino_id,alquiler_id,fecha_prometida,monto,notas,estado) VALUES (?,?,?,?,?,\'pendiente\')',
    [Number(inquilinoId), Number(alquilerId), fecha, round2(Number(a.monto)), String(notas || '')]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
function listPromesas(db) {
  return allToObj(db, `SELECT p.*, i.nombre AS inquilino_nombre, i.whatsapp,
    e.nombre AS estudio_nombre, a.mes
    FROM promesas p
    JOIN inquilinos i ON i.id = p.inquilino_id
    JOIN alquileres a ON a.id = p.alquiler_id
    LEFT JOIN estudios e ON e.id = a.estudio_id
    ORDER BY p.fecha_prometida, p.id`);
}
function promesasPendientes(db) {
  return listPromesas(db).filter((p) => p.estado === 'pendiente');
}
function promesaCerrar(db, id, estado) {
  run(db, "UPDATE promesas SET estado=? WHERE id=?", [estado || 'cumplida', Number(id)]);
}

// ---------- Morosidad con días (0-30 / 31-60 / 61-90 / 90+) ----------
function diasAtraso(fechaVen, mesCuota) {
  if (fechaVen) {
    const d = Math.round((new Date(hoy() + 'T00:00:00') - new Date(fechaVen + 'T00:00:00')) / 86400000);
    if (d >= 0) return d;
  }
  const [y, m] = String(mesCuota || '').split('-').map(Number);
  if (!y) return 0;
  const finMes = new Date(y, m, 1);
  return Math.max(0, Math.round((new Date(hoy() + 'T00:00:00') - finMes.getTime()) / 86400000));
}
function bucketDias(d) {
  if (d <= 0) return 'corriente';
  if (d <= 30) return 'mes0';
  if (d <= 60) return 'mes1';
  if (d <= 90) return 'mes2';
  return 'mes3plus';
}
function morosidadDetalle(db, filtro) {
  const f = filtro || {};
  const filas = allToObj(db,
    `SELECT a.*, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre, i.whatsapp, i.telefono
     FROM alquileres a
     JOIN estudios e ON e.id = a.estudio_id
     LEFT JOIN inquilinos i ON i.id = a.inquilino_id
     WHERE a.pagado = 0 AND e.activo = 1
     ORDER BY a.mes, e.nombre`);
  // Abonado total por cuota en una sola consulta (evita un SELECT por fila).
  const abonadoMap = new Map(allToObj(db,
    'SELECT alquiler_id, COALESCE(SUM(monto),0) AS s FROM abonos GROUP BY alquiler_id')
    .map((ab) => [Number(ab.alquiler_id), Number(ab.s)]));
  const abonadoDe = (id) => abonadoMap.get(Number(id)) || 0;
  let lista = filas.map((c) => {
    const abonado = abonadoDe(c.id);
    const saldo = round2(Math.max(0, Number(c.monto) - abonado));
    const dias = diasAtraso(c.fecha_vencimiento, c.mes);
    return { ...c, abonado: round2(abonado), saldo, dias, bucket: bucketDias(dias) };
  }).filter((r) => r.saldo > 0);
  if (f.estudio_id) lista = lista.filter((r) => Number(r.estudio_id) === Number(f.estudio_id));
  if (f.inquilino_id) lista = lista.filter((r) => Number(r.inquilino_id) === Number(f.inquilino_id));
  if (f.bucket) lista = lista.filter((r) => r.bucket === String(f.bucket));
  const sum = (k) => round2(lista.filter((r) => r.bucket === k).reduce((s, r) => s + r.saldo, 0));
  return {
    filas: lista,
    total: round2(lista.reduce((s, r) => s + r.saldo, 0)),
    corrientes: sum('corriente'), mes0: sum('mes0'), mes1: sum('mes1'), mes2: sum('mes2'), mes3plus: sum('mes3plus')
  };
}

// ---------- Centro de pendientes (alertas accionables) ----------
function centroPendientes(db) {
  const m = mesHoy();
  const cobros = cobrosMes(db, m);
  const vencidas = cobros.filter((c) => c.estado === 'vencido');
  const contratosVencen = contratosPorVencer(db, 60);
  const ocup = resumenOcupacion(db);
  const promesas = promesasPendientes(db).filter((p) => {
    if (!p.fecha_prometida) return false;
    return new Date(p.fecha_prometida + 'T00:00:00').getTime() <= new Date(hoy() + 'T00:00:00').getTime() + 7 * 86400000;
  });
  // Estudios desocupados hace 90+ días (o nunca ocupados): piden gestión.
  const limite90 = new Date();
  limite90.setDate(limite90.getDate() - 90);
  const lim90 = limite90.toISOString().slice(0, 10);
  const estudiosVacios = allToObj(db,
    `SELECT e.id, e.nombre,
            (SELECT MAX(o.desde) FROM ocupaciones o WHERE o.estudio_id = e.id) AS ultima_ocupacion
     FROM estudios e
     WHERE e.activo = 1 AND e.inquilino_id IS NULL
     ORDER BY e.nombre`)
    .filter((e) => !e.ultima_ocupacion || e.ultima_ocupacion < lim90);
  // Una sola pasada de morosidad y una sola de órdenes abiertas (antes se
  // repetían los mismos cálculos hasta tres veces).
  const morosidad = morosidadDetalle(db);
  const mantenimientos = ordenesAbiertas(db);
  const deudasMedia = morosidad.filas.filter((r) => r.bucket === 'mes1' || r.bucket === 'mes2').length;
  return {
    rentasVencidas: vencidas.length,
    rentasVencidasMonto: round2(vencidas.reduce((s, c) => s + c.saldo, 0)),
    contratosVencen: contratosVencen.length,
    mantenimientosAbiertos: mantenimientos.length,
    disponibles: ocup.disponible,
    enMantenimiento: ocup.mantenimiento,
    promesasProximas: promesas.length,
    estudiosVacios,
    deudasMedia,
    total: vencidas.length + contratosVencen.length + mantenimientos.length + promesas.length + estudiosVacios.length
  };
}

// ---------- Ficha completa del inquilino (historial financiero) ----------
function fichaInquilino(db, inquilinoId) {
  const base = estadoCuentaInquilino(db, Number(inquilinoId));
  return {
    ...base,
    recibos: allToObj(db,
      `SELECT r.*, a.mes AS mes_cuota, e.nombre AS estudio_nombre
       FROM recibos r
       LEFT JOIN alquileres a ON a.id = r.alquiler_id
       LEFT JOIN estudios e ON e.id = a.estudio_id
       WHERE r.alquiler_id IN (SELECT id FROM alquileres WHERE inquilino_id=?) AND r.anulado = 0
       ORDER BY r.fecha DESC`, [Number(inquilinoId)]),
    notas: listNotas(db, 'inquilino', inquilinoId),
    contratos: listarContratos(db, { inquilino_id: Number(inquilinoId) }),
    mantenimientos: allToObj(db,
      `SELECT o.*, e.nombre AS estudio_nombre
       FROM ordenes o LEFT JOIN estudios e ON e.id = o.estudio_id
       WHERE o.inquilino_id = ? OR o.estudio_id IN (SELECT estudio_id FROM contratos WHERE inquilino_id=?)
       ORDER BY o.id DESC`, [Number(inquilinoId), Number(inquilinoId)]),
    balance: round2(base.pagado - base.debido)
  };
}

// ---------- Buscador global (Ctrl+K) ----------
function buscarGlobal(db, q) {
  const s = '%' + String(q || '').trim() + '%';
  const out = { estudios: [], inquilinos: [], deudas: [], recibos: [], contratos: [], mantenimientos: [] };
  if (!String(q || '').trim()) return out;
  out.estudios = allToObj(db,
    `SELECT id, nombre, direccion, alquiler, (SELECT i.nombre FROM inquilinos i WHERE i.id = e.inquilino_id) AS inquilino_nombre
     FROM estudios e WHERE e.activo=1 AND (e.nombre LIKE ? OR e.direccion LIKE ?) ORDER BY e.nombre LIMIT 8`, [s, s]);
  out.inquilinos = allToObj(db,
    `SELECT i.id, i.nombre, i.telefono, i.whatsapp,
            (SELECT e.nombre FROM estudios e WHERE e.inquilino_id=i.id AND e.activo=1) AS estudio_nombre
     FROM inquilinos i WHERE i.activo=1 AND (i.nombre LIKE ? OR i.telefono LIKE ? OR i.whatsapp LIKE ?)
     ORDER BY i.nombre LIMIT 8`, [s, s, s]);
  out.deudas = allToObj(db,
    `SELECT a.id, a.mes, a.monto, a.pagado, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre,
            a.fecha_vencimiento, (SELECT COALESCE(SUM(ab.monto),0) FROM abonos ab WHERE ab.alquiler_id=a.id) AS abonado
     FROM alquileres a JOIN estudios e ON e.id=a.estudio_id LEFT JOIN inquilinos i ON i.id=a.inquilino_id
     WHERE a.pagado=0 AND (i.nombre LIKE ? OR e.nombre LIKE ?)
     ORDER BY a.mes DESC LIMIT 8`, [s, s]);
  out.recibos = allToObj(db,
    `SELECT r.id, r.numero, r.fecha, r.monto, e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM recibos r
     LEFT JOIN alquileres a ON a.id=r.alquiler_id
     LEFT JOIN estudios e ON e.id=a.estudio_id
     LEFT JOIN inquilinos i ON i.id=a.inquilino_id
     WHERE r.numero LIKE ? OR i.nombre LIKE ? OR e.nombre LIKE ?
     ORDER BY r.id DESC LIMIT 6`, [s, s, s]);
  out.contratos = allToObj(db,
    `SELECT c.id, c.fecha_inicio, c.fecha_vencimiento, c.renta, c.estado,
            e.nombre AS estudio_nombre, i.nombre AS inquilino_nombre
     FROM contratos c LEFT JOIN estudios e ON e.id=c.estudio_id LEFT JOIN inquilinos i ON i.id=c.inquilino_id
     WHERE e.nombre LIKE ? OR i.nombre LIKE ?
     ORDER BY c.id DESC LIMIT 6`, [s, s]);
  out.mantenimientos = allToObj(db,
    `SELECT o.id, o.detalle, o.estado, o.prioridad, o.costo, e.nombre AS estudio_nombre
     FROM ordenes o LEFT JOIN estudios e ON e.id=o.estudio_id
     WHERE o.detalle LIKE ? OR e.nombre LIKE ? OR CAST(o.id AS TEXT) LIKE ?
     ORDER BY o.id DESC LIMIT 6`, [s, s, s]);
  return out;
}

module.exports = {
  getEmpresa, saveEmpresa,
  listEstudios, getEstudio, saveEstudio, deleteEstudio, setEstudioFoto, resumenEdificios,
  estadoEstudio, resumenOcupacion,
  listInquilinos, getInquilino, getAlquiler, saveInquilino, deleteInquilino,
  cobrosMes, marcarPago, resumenMes, estadoCuota,
  abonosAlquiler, abonadoAlquiler, abonoAgregar, abonoEliminar,
  historialEstudio,
  siguienteNumeroRecibo, getRecibo, recibosDeAlquiler, listarRecibos, anularRecibo,
  listGastos, saveGasto, deleteGasto, gastosMes,
  importarEstudios,
  agingMes, tendencia, rentabilidadEstudios, reporteFinanciero, reporteAnual,
  listGastosEstudio, saveGastosEstudio,
  deudasPorInquilino,
  getConfig, setConfig,
  ordenesAbiertas, crearOrden, listOrdenes, cerrarOrden, getOrden, deleteOrden, resumenMantenimientoEstudio,
  aplicarPago, estadoCuentaInquilino, fichaInquilino,
  contratosPorVencer, listarContratos, getContrato, saveContrato, terminarContrato, eliminarContrato, renovarContrato,
  listNotas, agregarNota, borrarNota,
  normalizarWhatsApp, enlaceWhatsApp, plantillaWhatsApp,
  morosidadDetalle,
  centroPendientes,
  buscarGlobal,
  promesaAgregar, promesasPendientes, listPromesas, promesaCerrar,
  hoy
};