'use strict';
// exportador.js — Fase 3 §3. Convierte los reportes de HABITIA a Excel (.xlsx) y CSV.
// Mantiene las monedas separadas (regla: no mezclar RD$ + USD).

const ExcelJS = require('exceljs');

function escCSV(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function num(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function txt(v) { return v === null || v === undefined ? '' : String(v); }

function hoja(wb, nombre, headers, filas) {
  const ws = wb.addWorksheet(nombre);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4C8C' } };
  ws.getRow(1).alignment = { vertical: 'middle' };
  ws.getRow(1).height = 20;
  filas.forEach((f) => {
    const r = ws.addRow(f.map((v) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) ? Number(v) : txt(v))));
    r.eachCell((c) => { c.alignment = { vertical: 'middle' }; });
  });
  ws.columns.forEach((c, i) => {
    const hLen = (c.header || '').length;
    const maxF = filas.reduce((m, f) => Math.max(m, String(f[i] == null ? '' : f[i]).length), 0);
    c.width = Math.max(9, Math.min(36, Math.max(hLen + 2, maxF + 2)));
  });
  if (filas.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: filas.length + 1, column: headers.length } };
  }
  return ws;
}

async function libro(x, titulo) {
  const wb = new ExcelJS.Workbook();
  wb.creator = x.empresa.nombre || 'HABITIA';
  const portada = wb.addWorksheet('Portada');
  portada.addRow([x.empresa.nombre || 'HABITIA']);
  portada.getRow(1).font = { size: 20, bold: true, color: { argb: 'FF2A4C8C' } };
  portada.addRow([titulo]);
  portada.getRow(2).font = { size: 13, color: { argb: 'FF5B6472' } };
  portada.addRow(['Generado el ' + new Date().toLocaleString('es-DO')]);
  x.hojas.forEach((h) => hoja(wb, h.nombre.slice(0, 31), h.headers, h.filas));
  return wb;
}
function aCSV(x) {
  const partes = [];
  x.hojas.forEach((h) => {
    partes.push(h.nombre);
    partes.push(h.headers.map(escCSV).join(','));
    h.filas.forEach((f) => partes.push(f.map(escCSV).join(',')));
    partes.push('');
  });
  return '\ufeff' + partes.join('\n');
}

// ---- Mapeo de cada reporte a hojas ----------
function datosDe(tipo, { negocio, db, mes, anio, empresa }) {
  const M = String(mes || negocio.hoy().slice(0, 7));
  const estadoCobro = (c) => (Number(c.pagado) === 1 ? 'Pagado' : (c.estado === 'vencido' || c.vencido ? 'Vencido' : 'Pendiente'));
  const buck = { corriente: 'Al día', mes0: '1-30 días', mes1: '31-60 días', mes2: '61-90 días', mes3plus: '90+ días' };

  const base = { mes: M, anio: Number(anio) || new Date().getFullYear(), empresa };
  switch (tipo) {
    case 'cobros': {
      const cobros = negocio.cobrosMes(db, M);
      return {
        ...base,
        nombreBase: 'cobros-' + M,
        titulo: 'Cobros del mes ' + M,
        hojas: [{
          nombre: 'Cobros',
          headers: ['Mes', 'Estudio', 'Inquilino', 'Moneda', 'Monto', 'Estado', 'Fecha de pago', 'Método'],
          filas: cobros.map((c) => [c.mes, txt(c.estudio_nombre), txt(c.inquilino_nombre), c.moneda, num(c.monto), estadoCobro(c), txt(c.fecha_pago), txt(c.metodo_pago)])
        }]
      };
    }
    case 'gastos': {
      const g = negocio.listGastos(db, { mes: M });
      return {
        ...base, nombreBase: 'gastos-' + M, titulo: 'Gastos del mes ' + M,
        hojas: [{
          nombre: 'Gastos',
          headers: ['Fecha', 'Categoría', 'Concepto', 'Proveedor', 'Moneda', 'Monto', 'Estado'],
          filas: g.map((r) => [txt(r.fecha), txt(r.categoria), txt(r.concepto), txt(r.proveedor), r.moneda, num(r.monto), txt(r.estado === 'programado' ? 'Programado' : 'Realizado')])
        }]
      };
    }
    case 'aging': {
      const moro = negocio.morosidadDetalle(db, {});
      return {
        ...base, nombreBase: 'morosidad', titulo: 'Morosidad por antigüedad',
        hojas: [
          {
            nombre: 'Resumen',
            headers: ['Tramo', 'Monto'],
            filas: [
              ['Al día (corriente)', num(moro.corrientes)],
              ['1-30 días', num(moro.mes0)],
              ['31-60 días', num(moro.mes1)],
              ['61-90 días', num(moro.mes2)],
              ['90+ días', num(moro.mes3plus)],
              ['Total', num(moro.total)]
            ]
          },
          {
            nombre: 'Detalle',
            headers: ['Mes', 'Estudio', 'Inquilino', 'Moneda', 'Saldo', 'Días', 'Tramo', 'Teléfono'],
            filas: (moro.filas || []).map((f) => [f.mes, txt(f.estudio_nombre), txt(f.inquilino_nombre), f.moneda, num(f.saldo), f.dias, buck[f.bucket] || txt(f.bucket), txt(f.inquilino_telefono || (f.telefono || ''))])
          }
        ]
      };
    }
    case 'rentabilidad': {
      const r = negocio.rentabilidadEstudios(db);
      return {
        ...base, nombreBase: 'rentabilidad', titulo: 'Rentabilidad por estudio',
        hojas: [{
          nombre: 'Rentabilidad',
          headers: ['Estudio', 'Renta', 'Depósito', 'Inversión', 'Cobrado', 'Gastos', 'Utilidad', 'Retorno %'],
          filas: r.map((e) => [txt(e.nombre), num(e.alquiler), num(e.deposito), num(e.costo_inversion), num(e.cobrado), num(e.gastos), num(e.utilidad), num(e.retorno)])
        }]
      };
    }
    case 'cxp': {
      const cxp = negocio.listCuentasPagar(db, {});
      return {
        ...base, nombreBase: 'cuentas-pagar', titulo: 'Cuentas por pagar',
        hojas: [{
          nombre: 'CxP',
          headers: ['Concepto', 'Categoría', 'Proveedor', 'Moneda', 'Monto', 'Vence', 'Estado', 'Pagada', 'Fecha de pago', 'Método'],
          filas: cxp.map((c) => [txt(c.concepto), txt(c.categoria), txt(c.proveedor_nombre || ''), c.moneda, num(c.monto), txt(c.fecha_vencimiento), txt(c.estado), Number(c.pagado) === 1 ? 'Sí' : 'No', txt(c.fecha_pago), txt(c.metodo_pago)])
        }]
      };
    }
    case 'proveedores': {
      const p = negocio.listProveedores(db, '');
      return {
        ...base, nombreBase: 'proveedores', titulo: 'Proveedores',
        hojas: [{
          nombre: 'Proveedores',
          headers: ['Nombre', 'Teléfono', 'Correo', 'Servicio', 'Dirección', 'Notas', 'Deuda pendiente'],
          filas: p.map((x) => [txt(x.nombre), txt(x.telefono), txt(x.correo), txt(x.servicio), txt(x.direccion), txt(x.notas), num(x.deuda_pendiente)])
        }]
      };
    }
    case 'ocupacion': {
      const estu = negocio.listEstudios(db, '');
      return {
        ...base, nombreBase: 'ocupacion', titulo: 'Ocupación de estudios',
        hojas: [{
          nombre: 'Ocupación',
          headers: ['Estudio', 'Dirección', 'Moneda', 'Renta', 'Estado', 'Inquilino'],
          filas: estu.map((e) => [txt(e.nombre), txt(e.direccion), e.moneda, num(e.alquiler), negocio.estadoEstudio(e), txt(e.inquilino_nombre || '')])
        }]
      };
    }
    case 'contratos': {
      const c = negocio.listarContratos(db, {});
      return {
        ...base, nombreBase: 'contratos', titulo: 'Contratos de alquiler',
        hojas: [{
          nombre: 'Contratos',
          headers: ['N°', 'Estudio', 'Inquilino', 'Inicio', 'Vence', 'Duración (meses)', 'Moneda', 'Renta', 'Depósito', 'Día de pago', 'Estado'],
          filas: c.map((x) => [x.id, txt(x.estudio_nombre), txt(x.inquilino_nombre), txt(x.fecha_inicio), txt(x.fecha_vencimiento), num(x.duracion_meses), x.moneda, num(x.renta), num(x.deposito), num(x.dia_pago), txt(x.estado)])
        }]
      };
    }
    case 'mantenimiento': {
      const o = negocio.listOrdenes(db, {});
      return {
        ...base, nombreBase: 'mantenimiento', titulo: 'Órdenes de mantenimiento',
        hojas: [{
          nombre: 'Mantenimiento',
          headers: ['N°', 'Estudio', 'Inquilino', 'Detalle', 'Prioridad', 'Estado', 'Creada', 'Costo', 'Moneda', 'Proveedor'],
          filas: o.map((x) => [x.id, txt(x.estudio_nombre), txt(x.inquilino_nombre), txt(x.detalle), txt(x.prioridad), txt(x.estado), txt(x.creado), num(x.costo), x.moneda, txt(x.proveedor)])
        }]
      };
    }
    case 'financiero': {
      const f = negocio.reporteFinanciero(db, M);
      const k = f.enLetras || {};
      const filasRec = (f.recibos || []).map((r) => [txt(r.numero), txt(r.fecha), txt(r.inquilino_nombre), txt(r.estudio_nombre), txt(r.metodo), r.moneda, num(r.monto)]);
      return {
        ...base, nombreBase: 'financiero-' + M, titulo: 'Estado financiero ' + M,
        hojas: [
          {
            nombre: 'Resumen',
            headers: ['Concepto', 'Monto'],
            filas: [
              ['Estudios', k.estudios || 0], ['Ocupados', k.ocupados || 0], ['Recibos emitidos', k.recibos || 0],
              ['Recaudado', num(k.cobrado)], ['Por cobrar', num(k.porCobrar)], ['Atrasado de otros meses', num(k.totalAtrasado)],
              ['Gastos', num(k.gastos)], ['Ganancia neta', num(k.neto)]
            ]
          },
          { nombre: 'Recibos', headers: ['Recibo', 'Fecha', 'Inquilino', 'Estudio', 'Método', 'Moneda', 'Monto'], filas: filasRec },
          {
            nombre: 'Gastos por categoría',
            headers: ['Categoría', 'Monto'],
            filas: Object.entries(f.porCategoria || {}).map(([cat, v]) => [cat, num(v)])
          },
          {
            nombre: 'Deudores',
            headers: ['Inquilino', 'Monto'],
            filas: (f.topDeudores || []).map((d) => [txt(d.nombre), num(d.monto)])
          },
          {
            nombre: 'Tendencia',
            headers: ['Mes', 'Cobrado', 'Gastos', 'Neto'],
            filas: (f.tendencia || []).map((t) => [t.mes, num(t.cobrado), num(t.gastos), num(Number(t.cobrado) - Number(t.gastos))])
          }
        ]
      };
    }
    case 'anual': {
      const a = negocio.reporteAnual(db, base.anio);
      const t = a.totales || {};
      return {
        ...base, nombreBase: 'anual-' + base.anio, titulo: 'Reporte anual ' + base.anio,
        hojas: [
          {
            nombre: 'Resumen',
            headers: ['Concepto', 'Monto'],
            filas: [
              ['Cuota generada', num(t.cuota)], ['Recaudado', num(t.cobrado)], ['Gastos', num(t.gastos)],
              ['Por cobrar anual', num(t.porCobrarAnual)], ['Recibos', t.recibos || 0], ['Ganancia neta', num(t.neto)]
            ]
          },
          {
            nombre: 'Meses',
            headers: ['Mes', 'Cuota', 'Cobrado', 'Gastos', 'Neto'],
            filas: (a.meses || []).map((m) => [m.mes, num(m.cuota), num(m.cobrado), num(m.gastos), num(m.neto)])
          }
        ]
      };
    }
    case 'resumen': {
      const r = negocio.resumenMes(db, M);
      return {
        ...base, nombreBase: 'resumen-' + M, titulo: 'Resumen mensual ' + M,
        hojas: [
          {
            nombre: 'Resumen',
            headers: ['Concepto', 'Monto'],
            filas: [
              ['Estudios', r.estudios || 0], ['Ocupados', r.ocupados || 0],
              ['Cobrado', num(r.cobrado)], ['Por cobrar', num(r.porCobrar)], ['Atrasado', num(r.totalAtrasado)],
              ['Gastos', num(r.gastos && r.gastos.total)], ['Inversión (CAPEX)', num(r.inversion)], ['Depósitos', num(r.depositos)],
              ['Ganancia neta', num(r.neto)]
            ]
          },
          {
            nombre: 'Deudores',
            headers: ['Inquilino', 'Monto'],
            filas: Object.entries(r.deudores || {}).map(([nombre, mnto]) => [nombre, num(mnto)])
          }
        ]
      };
    }
    default:
      throw new Error('tipo no soportado: ' + tipo);
  }
}

module.exports = { datosDe, libro, aCSV };