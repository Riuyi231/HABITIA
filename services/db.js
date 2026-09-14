'use strict';
// HABITIA — capa de datos (sql.js / SQLite).
// Esquema: alquiler de estudios (departamentos), inquilinos, cobros y gastos.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let SQL = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS empresa (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL DEFAULT '',
  rnc TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  email TEXT DEFAULT '',
  direccion TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS estudios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  direccion TEXT DEFAULT '',
  edificio TEXT DEFAULT '',
  alquiler REAL DEFAULT 0,
  deposito REAL DEFAULT 0,
  gastos_fijos REAL DEFAULT 0,
  inquilino_id INTEGER,
  activo INTEGER DEFAULT 1,
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS gastos_estudio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudio_id INTEGER NOT NULL,
  nombre TEXT DEFAULT '',
  monto REAL DEFAULT 0,
  activo INTEGER DEFAULT 1,
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inquilinos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  activo INTEGER DEFAULT 1,
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS alquileres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudio_id INTEGER NOT NULL,
  inquilino_id INTEGER,
  mes TEXT NOT NULL,
  monto REAL DEFAULT 0,
  pagado INTEGER DEFAULT 0,
  fecha_pago TEXT,
  notas TEXT DEFAULT '',
  creado TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE (estudio_id, mes)
);

CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT NOT NULL,
  concepto TEXT DEFAULT '',
  monto REAL DEFAULT 0,
  fecha TEXT NOT NULL,
  estudio_id INTEGER,
  notas TEXT DEFAULT '',
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS abonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alquiler_id INTEGER NOT NULL,
  monto REAL NOT NULL,
  fecha TEXT NOT NULL,
  notas TEXT DEFAULT '',
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS ocupaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudio_id INTEGER NOT NULL,
  inquilino_id INTEGER,
  desde TEXT,
  hasta TEXT
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ordenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudio_id INTEGER,
  inquilino_id INTEGER,
  detalle TEXT DEFAULT '',
  costo REAL DEFAULT 0,
  estado TEXT DEFAULT 'abierta',
  creado TEXT DEFAULT (datetime('now','localtime')),
  cerrado TEXT
);

CREATE TABLE IF NOT EXISTS promesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquilino_id INTEGER,
  alquiler_id INTEGER,
  fecha_prometida TEXT,
  monto REAL DEFAULT 0,
  notas TEXT DEFAULT '',
  estado TEXT DEFAULT 'pendiente',
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS recibos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE,
  tipo TEXT DEFAULT 'cobro',
  alquiler_id INTEGER,
  monto REAL DEFAULT 0,
  fecha TEXT NOT NULL,
  metodo TEXT DEFAULT '',
  referencia TEXT DEFAULT '',
  anulado INTEGER DEFAULT 0,
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudio_id INTEGER,
  inquilino_id INTEGER,
  fecha_inicio TEXT,
  fecha_vencimiento TEXT,
  duracion_meses INTEGER DEFAULT 0,
  renta REAL DEFAULT 0,
  deposito REAL DEFAULT 0,
  dia_pago INTEGER DEFAULT 5,
  incremento_pct REAL DEFAULT 0,
  aval_nombre TEXT DEFAULT '',
  aval_telefono TEXT DEFAULT '',
  estado TEXT DEFAULT 'activo',
  renovado_de INTEGER,
  notas TEXT DEFAULT '',
  creado TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad TEXT NOT NULL,
  entidad_id INTEGER NOT NULL,
  texto TEXT DEFAULT '',
  usuario TEXT DEFAULT '',
  fecha TEXT DEFAULT (datetime('now','localtime'))
);
`;

function columnaExiste(db, tabla, col) {
  const r = db.exec('PRAGMA table_info(' + tabla + ')');
  if (!r[0] || !r[0].values) return false;
  return r[0].values.some((v) => v[1] === col);
}

function asegurarColumna(db, tabla, col, def) {
  if (!columnaExiste(db, tabla, col)) {
    db.run('ALTER TABLE ' + tabla + ' ADD COLUMN ' + col + ' ' + def);
  }
}

function makeDb(db) {
  db.run('PRAGMA foreign_keys = ON');
  db.run(SCHEMA);

  // Migraciones en bases ya existentes.
  asegurarColumna(db, 'estudios', 'edificio', "TEXT DEFAULT ''");
  asegurarColumna(db, 'estudios', 'gastos_fijos', 'REAL DEFAULT 0');
  asegurarColumna(db, 'estudios', 'costo_inversion', 'REAL DEFAULT 0');
  asegurarColumna(db, 'estudios', 'foto', "TEXT DEFAULT ''");
  asegurarColumna(db, 'estudios', 'estado', "TEXT DEFAULT ''");
  asegurarColumna(db, 'alquileres', 'fecha_vencimiento', "TEXT DEFAULT ''");
  asegurarColumna(db, 'alquileres', 'metodo_pago', "TEXT DEFAULT ''");
  asegurarColumna(db, 'alquileres', 'referencia_pago', "TEXT DEFAULT ''");
  asegurarColumna(db, 'alquileres', 'registrado_por', "TEXT DEFAULT ''");
  asegurarColumna(db, 'abonos', 'metodo_pago', "TEXT DEFAULT ''");
  asegurarColumna(db, 'abonos', 'referencia', "TEXT DEFAULT ''");
  asegurarColumna(db, 'gastos', 'subcategoria', "TEXT DEFAULT ''");
  asegurarColumna(db, 'gastos', 'proveedor', "TEXT DEFAULT ''");
  asegurarColumna(db, 'gastos', 'metodo_pago', "TEXT DEFAULT ''");
  asegurarColumna(db, 'gastos', 'referencia', "TEXT DEFAULT ''");
  asegurarColumna(db, 'gastos', 'comprobante', "TEXT DEFAULT ''");
  asegurarColumna(db, 'ordenes', 'prioridad', "TEXT DEFAULT 'media'");
  asegurarColumna(db, 'ordenes', 'costo_estimado', 'REAL DEFAULT 0');
  asegurarColumna(db, 'ordenes', 'proveedor', "TEXT DEFAULT ''");
  asegurarColumna(db, 'ordenes', 'fecha_cierre', "TEXT DEFAULT ''");

  // Migración: los gastos fijos pasaron de un monto único por estudio
  // (columna gastos_fijos) a una lista de gastos (tabla gastos_estudio).
  // Se traslada el monto existente a un gasto llamado "Gastos fijos".
  db.run(`INSERT INTO gastos_estudio (estudio_id, nombre, monto)
          SELECT id, 'Gastos fijos', gastos_fijos FROM estudios
          WHERE gastos_fijos > 0
            AND id NOT IN (SELECT estudio_id FROM gastos_estudio WHERE activo=1)`);
}

async function openDb(file) {
  if (!SQL) SQL = await initSqlJs();
  let db;
  if (file && fs.existsSync(file)) {
    db = new SQL.Database(fs.readFileSync(file));
  } else {
    db = new SQL.Database();
  }
  makeDb(db);
  return db;
}

function save(db, file) {
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = Buffer.from(db.export());
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

module.exports = { SCHEMA, openDb, save, makeDb };