'use strict';
// HABITIA — reportes PDF de alquileres (pdf-lib), con identidad de marca.

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Paleta HABITIA (azul, coincide con la interfaz)
const AZUL_MARCA = rgb(0.15, 0.39, 0.92);      // #2563eb
const AZUL_OSCURO = rgb(0.12, 0.23, 0.54);     // #1e3a8a
const AZUL_PALIDO = rgb(0.86, 0.92, 0.99);     // #dbeafe
const TINTA = rgb(0.09, 0.12, 0.16);
const GRIS_TXT = rgb(0.4, 0.42, 0.47);
const GRIS_BORDE = rgb(0.76, 0.78, 0.84);
const FONDO_ALT = rgb(0.965, 0.975, 0.99);
const BLANCO = rgb(1, 1, 1);
const ROJO = rgb(0.84, 0.16, 0.24);
const AZUL = rgb(0.19, 0.44, 0.87);
const AMBAR = rgb(0.86, 0.6, 0.08);

function fmt(n) { return new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0); }
const RD = (n) => 'RD$ ' + fmt(n);

// Monto en letras (español) para el recibo.
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function unidadesLetra(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return '';
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    if (n % 10 === 0) return DECENAS[Math.floor(n / 10)];
    if (n < 30) return 'veinti' + UNIDADES[n - 20];
    return DECENAS[Math.floor(n / 10)] + ' y ' + UNIDADES[n % 10];
  }
  if (n === 100) return 'cien';
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    return r ? CENTENAS[c] + ' ' + unidadesLetra(r) : CENTENAS[c];
  }
  return String(n);
}
function letraMonto(n) {
  n = Math.abs(Math.round(Number(n) || 0));
  if (n === 0) return 'cero';
  const partes = [];
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    partes.push(m === 1 ? 'un millón' : unidadesLetra(m) + ' millones');
    n %= 1000000;
  }
  if (n >= 1000) {
    const k = Math.floor(n / 1000);
    partes.push(k === 1 ? 'mil' : unidadesLetra(k) + ' mil');
    n %= 1000;
  }
  if (n > 0) partes.push(unidadesLetra(n));
  return partes.join(' ');
}

const ETIQUETA_MES = (mes) => {
  const [y, m] = String(mes || '').split('-');
  if (!y) return mes;
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${nombres[Number(m) - 1] || m} ${y}`;
};

function enLineas(font, texto, ancho, size) {
  const palabras = String(texto || '').split(/\s+/);
  const out = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (font.widthOfTextAtSize(prueba, size) > ancho && linea) { out.push(linea); linea = p; }
    else linea = prueba;
  }
  if (linea) out.push(linea);
  return out.length ? out : [''];
}

async function crearContexto(empresa, pie) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const W = 595 - M * 2;
  const nombre = (empresa && String(empresa.nombre).trim()) || 'HABITIA';
  const fechaGen = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });
  const rnc = empresa && empresa.rnc ? String(empresa.rnc).trim() : '';
  const tel = empresa && empresa.telefono ? String(empresa.telefono).trim() : '';
  const email = empresa && empresa.email ? String(empresa.email).trim() : '';
  const dir = empresa && empresa.direccion ? String(empresa.direccion).trim() : '';

  const ctx = { doc, font, bold, page: null, M, W, y: 842, pie: pie || '' };

  // Dibuja la barra de marca compacta arriba.
  function dibujarBarra(p) {
    p.drawRectangle({ x: 0, y: 842 - 42, width: 595, height: 42, color: AZUL_MARCA });
    p.drawRectangle({ x: 0, y: 842 - 46, width: 595, height: 4, color: AZUL_OSCURO });
    // Monograma
    p.drawEllipse({ x: 36, y: 842 - 21, xRadius: 13, yRadius: 13, color: BLANCO });
    p.drawText('H', { x: 36 - 5.5, y: 842 - 25.5, size: 15, font: ctx.bold, color: AZUL_MARCA });
    // Tipo de documento a la derecha
    if (ctx.pie) p.drawText(String(ctx.pie).toUpperCase(), { x: 595 - M - 180, y: 842 - 28, size: 8, font: ctx.bold, color: rgb(0.88, 0.95, 0.91) });
  }

  // Dibuja el bloque de identidad de la empresa debajo de la barra.
  function dibujarEmpresa(p, yBase) {
    const bloqAlt = 48;
    // Fondo del bloque empresa
    p.drawRectangle({ x: 0, y: yBase - bloqAlt, width: 595, height: bloqAlt, color: rgb(0.965, 0.975, 0.99) });
    // Línea inferior del bloque
    p.drawRectangle({ x: 0, y: yBase - bloqAlt, width: 595, height: 1.5, color: AZUL_MARCA });
    // Nombre de la empresa grande y destacado
    const nombreY = yBase - 18;
    p.drawText(String(nombre).toUpperCase(), { x: M, y: nombreY, size: 16, font: ctx.bold, color: AZUL_OSCURO });
    // Info secundaria: RNC, teléfono, email, dirección en una línea
    const partes = [];
    if (rnc) partes.push('RNC: ' + rnc);
    if (tel) partes.push('Tel: ' + tel);
    if (email) partes.push(email);
    if (dir) partes.push(dir);
    const linea2 = partes.join('   |   ');
    if (linea2) p.drawText(linea2, { x: M, y: yBase - 34, size: 8.5, font: ctx.font, color: GRIS_TXT });
    return yBase - bloqAlt;
  }

  ctx.dibujarCabecera = () => {
    const p = ctx.page;
    dibujarBarra(p);
    dibujarEmpresa(p, 842 - 46);
  };

  ctx.dibujarPie = () => {
    const p = ctx.page;
    p.drawRectangle({ x: 0, y: 0, width: 595, height: 24, color: FONDO_ALT });
    p.drawLine({ start: { x: 0, y: 24 }, end: { x: 595, y: 24 }, thickness: 1, color: GRIS_BORDE });
    p.drawText('Generado por HABITIA · ' + fechaGen, { x: ctx.M, y: 8, size: 7.5, font: ctx.font, color: GRIS_TXT });
    p.drawText('Página ' + ctx.doc.getPageCount(), { x: 595 - ctx.M - 60, y: 8, size: 7.5, font: ctx.bold, color: AZUL_MARCA });
  };

  ctx.addPage = () => {
    ctx.page = ctx.doc.addPage([595, 842]);
    ctx.dibujarCabecera();
    ctx.dibujarPie();
    ctx.y = 700;
  };

  // Título del documento con entrada de color y regla doble.
  ctx.titulo = (titulo, meta) => {
    const p = ctx.page;
    ctx.y = 700;
    p.drawText(String(titulo), { x: ctx.M, y: ctx.y, size: 17, font: ctx.bold, color: TINTA });
    if (meta) p.drawText(String(meta), { x: 595 - ctx.M - ctx.font.widthOfTextAtSize(String(meta), 9), y: ctx.y + 4, size: 9, font: ctx.font, color: GRIS_TXT });
    ctx.y -= 20;
    p.drawRectangle({ x: ctx.M, y: ctx.y, width: ctx.W, height: 1, color: GRIS_BORDE });
    ctx.y -= 8;
    p.drawRectangle({ x: ctx.M, y: ctx.y, width: 64, height: 3, color: AZUL_MARCA });
    ctx.y -= 16;
  };

  // Subtítulo seccional
  ctx.sub = (texto) => {
    ctx.y -= 6;
    ctx.page.drawText(String(texto).toUpperCase(), { x: ctx.M, y: ctx.y, size: 10, font: ctx.bold, color: AZUL_OSCURO });
    ctx.y -= 14;
  };

  ctx.page = ctx.doc.addPage([595, 842]);
  ctx.dibujarCabecera();
  ctx.dibujarPie();
  ctx.y = 700;
  return ctx;
}

// Tabla con encabezado de marca, filas alternas, celdas con salto de línea
// y números alineados a la derecha. Repite el encabezado al cambiar de página.
function dibujarTabla(ctx, headers, filas, opts = {}) {
  const x = ctx.M;
  const w = ctx.W;
  const anchos = opts.anchos || headers.map(() => w / headers.length);
  const colX = [];
  let acc = x;
  for (const aw of anchos) { colX.push(acc); acc += aw; }
  const size = opts.size || 9;
  const lh = size + 3.2;
  const pad = 5;
  const bandas = opts.bandas !== false;

  function textoCelda(v) { return (v && v.texto !== undefined) ? String(v.texto) : (v == null ? '' : String(v)); }

  function dibujarFilaPlana(celdas, esHead, y, meta) {
    const lins = celdas.map((v, i) => enLineas(ctx.font, textoCelda(v), anchos[i] - 14, size));
    const nLin = Math.max(1, ...lins.map((l) => l.length));
    const H = esHead ? lh + pad + 4 : lh * nLin + pad + 4;
    if (y - H < 68) { ctx.addPage(); y = ctx.y; if (!esHead) dibujarFilaPlana(headers, true, y, null); }
    const rell = esHead ? AZUL_MARCA : (meta && meta.fillcolor ? meta.fillcolor : null);
    const rellFila = rell || (!esHead && bandas ? FONDO_ALT : null);
    const p = ctx.page;
    if (rell && esHead) {
      p.drawRectangle({ x, y: y - H, width: w, height: H, color: rell });
    } else if (rellFila) {
      p.drawRectangle({ x, y: y - H, width: w, height: H, color: rellFila });
    }
    for (let i = 0; i < celdas.length; i++) {
      const v = celdas[i];
      const esNum = /^RD\$ /.test(textoCelda(v)) || (opts.numeric && opts.numeric[i]);
      const color = esHead ? BLANCO : (v && v.color) || TINTA;
      const f = esHead ? ctx.bold : (v && v.bold) ? ctx.bold : ctx.font;
      const siz = esHead ? size + 0.5 : size;
      const cx = esHead ? colX[i] + 8 : esNum ? colX[i] + anchos[i] - 8 : colX[i] + 8;
      const anchoCel = anchos[i] - (esNum ? 16 : 16);
      const lin = lins[i];
      for (let k = 0; k < lin.length; k++) {
        p.drawText(lin[k], {
          x: esNum && !esHead ? colX[i] + anchos[i] - 8 - ctx.font.widthOfTextAtSize(lin[k], siz) : cx,
          y: y - pad - (k + 1) * lh + lh * 0.72,
          size: siz, font: f, color, maxWidth: anchoCel
        });
      }
    }
    // líneas de cuadrícula
    p.drawLine({ start: { x, y: y - H }, end: { x: x + w, y: y - H }, thickness: 0.5, color: GRIS_BORDE });
    if (esHead) p.drawLine({ start: { x, y: y - H }, end: { x: x + w, y: y - H }, thickness: 1.2, color: AZUL_OSCURO });
    return y - H;
  }

  let y = ctx.y;
  y = dibujarFilaPlana(headers, true, y, null);
  for (const f of filas) {
    const meta = (f && f.celdas) ? f : null;
    const fila = meta ? f.celdas : f;
    y = dibujarFilaPlana(fila, false, y, meta);
  }
  ctx.page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 1.2, color: AZUL_MARCA });
  ctx.y = y - (opts.espacio === undefined ? 14 : opts.espacio);
}

// ---- Reportes ----
async function reporteCobros(empresa, cobros, mes) {
  const ctx = await crearContexto(empresa, 'Cobros de alquiler');
  ctx.titulo('Cobros de Alquiler', ETIQUETA_MES(mes));
  const filas = cobros.map((c) => ([
    c.estudio_nombre,
    c.inquilino_nombre || '—',
    RD(c.monto),
    { texto: c.pagado ? 'COBRADO' : 'PENDIENTE', color: c.pagado ? AZUL : ROJO, bold: true }
  ]));
  dibujarTabla(ctx, ['Estudio', 'Inquilino', 'Alquiler', 'Estado'], filas, {
    anchos: [ctx.W * 0.25, ctx.W * 0.35, ctx.W * 0.2, ctx.W * 0.2],
    numeric: [false, false, true, false]
  });
  const cobrado = cobros.filter((c) => c.pagado).reduce((s, c) => s + Number(c.monto), 0);
  const pendiente = cobros.filter((c) => !c.pagado).reduce((s, c) => s + Number(c.monto), 0);
  const filasResumen = [
    { celdas: ['Cobrado', RD(cobrado), 'Pendiente por cobrar', RD(pendiente)], inds: [0, 1, 2, 3] }
  ];
  ctx.y -= 6;
  ctx.sub('Resumen del mes');
  dibujarTabla(ctx, ['Concepto', 'Monto', 'Concepto', 'Monto'], filasResumen, {
    anchos: [ctx.W * 0.27, ctx.W * 0.23, ctx.W * 0.27, ctx.W * 0.23],
    numeric: [false, true, false, true], bandas: false
  });
  return Buffer.from(await ctx.doc.save());
}

async function reporteGastos(empresa, gastos, mes) {
  const ctx = await crearContexto(empresa, 'Gastos');
  ctx.titulo('Gastos del Mes', ETIQUETA_MES(mes));
  const ETIQ = { luz: 'Electricidad', agua: 'Agua', internet: 'Internet', remodelacion: 'Remodelación', otros: 'Otros' };
  const filasTot = [];
  let total = 0;
  for (const g of gastos) {
    filasTot.push([g.fecha, ETIQ[g.categoria] || g.categoria, g.estudio_nombre || '—', g.concepto || '', RD(g.monto)]);
    total += Number(g.monto);
  }
  dibujarTabla(ctx, ['Fecha', 'Tipo', 'Estudio', 'Concepto', 'Monto'], filasTot, {
    anchos: [ctx.W * 0.11, ctx.W * 0.15, ctx.W * 0.17, ctx.W * 0.32, ctx.W * 0.25],
    numeric: [false, false, false, false, true]
  });
  ctx.y -= 4;
  dibujarTabla(ctx, ['', ''], [[{ texto: 'TOTAL GASTOS', color: AZUL, bold: true }, { texto: RD(total), color: AZUL, bold: true, fillcolor: AZUL_PALIDO }]], {
    anchos: [ctx.W * 0.75, ctx.W * 0.25], numeric: [false, true], bandas: false
  });
  ctx.y -= 16;
  ctx.page.drawText('Reporte de gastos del período — incluye luz, agua, internet, remodelaciones y otros.', { x: ctx.M, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
  return Buffer.from(await ctx.doc.save());
}

async function reporteResumen(empresa, r) {
  const ctx = await crearContexto(empresa, 'Resumen mensual');
  ctx.titulo('Resumen del Mes', ETIQUETA_MES(r.mes));
  const filas = [
    ['Estudios en alquiler', String(r.estudios)],
    ['Estudios ocupados', String(r.ocupados)],
    ['Cobrado en el mes', { texto: RD(r.cobrado), color: AZUL }],
    ['Por cobrar este mes', { texto: RD(r.porCobrar), color: r.porCobrar > 0 ? AMBAR : AZUL }],
    ['Atrasado de meses anteriores', { texto: RD(r.totalAtrasado), color: r.totalAtrasado > 0 ? ROJO : AZUL }],
    ['Gastos del mes', RD(r.gastos.total)],
    ['Inversión acumulada (CAPEX)', RD(r.inversion)],
    ['Depósitos activos', RD(r.depositos)],
    { celdas: ['GANANCIA NETA (ingresos - gastos)', { texto: RD(r.neto), color: AZUL_OSCURO, bold: true }], fillcolor: AZUL_PALIDO }
  ];
  dibujarTabla(ctx, ['Concepto', 'Monto'], filas, {
    anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
  });
  if (r.deudores && Object.keys(r.deudores).length) {
    ctx.sub('Quienes deben');
    dibujarTabla(ctx, ['Inquilino', 'Monto'], Object.entries(r.deudores).map(([k, v]) => [k, { texto: RD(v), color: ROJO }]), {
      anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
    });
  }
  return Buffer.from(await ctx.doc.save());
}

// ---- Reporte financiero consolidado (recibos + gastos + deudores + tendencia) ----
async function reporteFinanciero(empresa, f, mes) {
  const ctx = await crearContexto(empresa, 'Estado financiero');
  ctx.titulo('Estado Financiero del Mes', ETIQUETA_MES(mes));
  const k = f.enLetras || {};
  const filasKpi = [
    ['Estudios', String(k.estudios || 0)],
    ['Estudios ocupados', String(k.ocupados || 0)],
    ['Recibos emitidos', String(k.recibos || 0)],
    ['Recaudado', { texto: RD(k.cobrado), color: AZUL }],
    ['Por cobrar este mes', { texto: RD(k.porCobrar), color: k.porCobrar > 0 ? AMBAR : AZUL }],
    ['Atrasado de otros meses', { texto: RD(k.totalAtrasado), color: k.totalAtrasado > 0 ? ROJO : AZUL }],
    ['Gastos del mes', RD(k.gastos)],
    { celdas: ['GANANCIA NETA (recaudado - gastos)', { texto: RD(k.neto), color: AZUL_OSCURO, bold: true }], fillcolor: AZUL_PALIDO }
  ];
  dibujarTabla(ctx, ['Concepto', 'Monto'], filasKpi, {
    anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
  });

  ctx.sub('Recibos del mes');
  const filasRec = f.recibos.map((r) => ([
    r.numero, r.fecha || '',
    r.inquilino_nombre || '—', r.estudio_nombre || '—',
    String(r.metodo || '—'), RD(r.monto)
  ]));
  if (filasRec.length) {
    dibujarTabla(ctx, ['Recibo', 'Fecha', 'Inquilino', 'Estudio', 'Método', 'Monto'], filasRec, {
      anchos: [ctx.W * 0.14, ctx.W * 0.1, ctx.W * 0.22, ctx.W * 0.22, ctx.W * 0.15, ctx.W * 0.17],
      numeric: [false, false, false, false, false, true]
    });
  } else {
    ctx.page.drawText('No hubo recibos en ' + ETIQUETA_MES(mes) + '.', { x: ctx.M, y: ctx.y, size: 9, font: ctx.font, color: GRIS_TXT });
    ctx.y -= 18;
  }

  ctx.sub('Gastos por categoría');
  dibujarTabla(ctx, ['Categoría', 'Monto'],
    Object.entries(f.porCategoria || {}).map(([cat, monto]) => [cat, RD(monto)]), {
      anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
    });

  if (f.topDeudores && f.topDeudores.length) {
    ctx.sub('Principales deudores');
    dibujarTabla(ctx, ['Inquilino', 'Monto'],
      f.topDeudores.map((d) => [d.nombre, { texto: RD(d.monto), color: ROJO }]), {
        anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
      });
    const a = f.aging || {};
    ctx.page.drawText('Deuda total: ' + RD(f.base.totalAtrasado) + ' atrasada · 31-60: ' + RD(a.totalMes1) + ' · 61-90: ' + RD(a.totalMes2) + ' · 90+: ' + RD(a.totalMes3plus),
      { x: ctx.M, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
    ctx.y -= 14;
  }

  ctx.sub('Tendencia (últimos 6 meses)');
  const filasTend = (f.tendencia || []).map((t) => ([
    ETIQUETA_MES(t.mes), RD(t.cobrado), RD(t.gastos), { texto: RD(Math.round((Number(t.cobrado) - Number(t.gastos)) * 100) / 100), color: Number(t.cobrado) >= Number(t.gastos) ? AZUL : ROJO }
  ]));
  dibujarTabla(ctx, ['Mes', 'Recaudado', 'Gastos', 'Neto'], filasTend, {
    anchos: [ctx.W * 0.3, ctx.W * 0.24, ctx.W * 0.24, ctx.W * 0.22], numeric: [false, true, true, true]
  });
  return Buffer.from(await ctx.doc.save());
}

// ---- Reporte anual (12 meses, totales del año y comparativa con el anterior) ----
async function reporteAnual(empresa, f, anio) {
  const ctx = await crearContexto(empresa, 'Reporte anual');
  ctx.titulo('Reporte Anual ' + anio, '1 enero – 31 diciembre');
  const t = f.totales || {};
  const filasKpi = [
    ['Cuota generada', RD(t.cuota)],
    ['Recaudado en el año', { texto: RD(t.cobrado), color: AZUL }],
    ['Gastos del año', RD(t.gastos)],
    ['Por cobrar anual', { texto: RD(t.porCobrarAnual), color: Number(t.porCobrarAnual) > 0 ? AMBAR : AZUL }],
    ['Recibos emitidos', String(t.recibos || 0)],
    ['Ocupación promedio', (t.ocupacionPromedio || 0) + '%'],
    { celdas: ['GANANCIA NETA del año', { texto: RD(t.neto), color: AZUL_OSCURO, bold: true }], fillcolor: AZUL_PALIDO }
  ];
  dibujarTabla(ctx, ['Concepto', 'Monto'], filasKpi, {
    anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
  });

  ctx.sub('Mes a mes');
  dibujarTabla(ctx, ['Mes', 'Cuota', 'Cobrado', 'Gastos', 'Neto'],
    f.meses.map((m) => ([
      ETIQUETA_MES(m.mes),
      RD(m.cuota),
      { texto: RD(m.cobrado), color: AZUL },
      RD(m.gastos),
      { texto: RD(m.neto), color: Number(m.neto) >= 0 ? AZUL : ROJO }
    ])), {
      anchos: [ctx.W * 0.22, ctx.W * 0.2, ctx.W * 0.2, ctx.W * 0.2, ctx.W * 0.18],
      numeric: [false, true, true, true, true]
    });

  const cPrevAnio = Number(anio) - 1;
  const c = f.comparativa || {};
  ctx.sub('Comparativa con ' + (c.anioPrev || cPrevAnio));
  const d = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v + '%');
  dibujarTabla(ctx, ['Concepto', 'Anterior', 'Actual', 'Variación'], [
    ['Recaudado', RD(c.cobrado), RD(t.cobrado), { texto: d(c.diffCobradoPct), color: c.diffCobradoPct >= 0 ? AZUL : ROJO }],
    ['Gastos', RD(c.gastos), RD(t.gastos), { texto: d(c.diffGastosPct), color: c.diffGastosPct <= 0 ? AZUL : ROJO }],
    ['Ganancia neta', RD(c.neto), RD(t.neto), { texto: d(c.diffNetoPct), color: c.diffNetoPct >= 0 ? AZUL : ROJO }]
  ], {
    anchos: [ctx.W * 0.32, ctx.W * 0.22, ctx.W * 0.22, ctx.W * 0.24],
    numeric: [false, true, true, false]
  });

  if (f.topDeudores && f.topDeudores.length) {
    ctx.sub('Principales deudores del año');
    dibujarTabla(ctx, ['Inquilino', 'Deuda acumulada'],
      f.topDeudores.map((d) => [d.nombre, { texto: RD(d.monto), color: ROJO }]), {
        anchos: [ctx.W * 0.62, ctx.W * 0.38], numeric: [false, true]
      });
  }
  return Buffer.from(await ctx.doc.save());
}

async function reporteRecibo(empresa, cobro, estudio, inquilino) {
  const ctx = await crearContexto(empresa, 'Recibo de pago');
  ctx.titulo('Recibo de Pago de Alquiler', 'No. ' + String(cobro.recibo_numero || cobro.id || '—'));

  const renglones = [
    ['Mes que cubre', ETIQUETA_MES(cobro.mes)],
    ['Fecha de pago', String(cobro.fecha_pago || cobro.fecha || '—')],
    ['Estudio', estudio && estudio.nombre ? String(estudio.nombre) : (cobro.estudio_nombre || '—')],
    ['Dirección', (estudio && estudio.direccion) || (cobro.estudio_direccion || '—')],
    ['Inquilino', (inquilino && inquilino.nombre) ? String(inquilino.nombre) : (cobro.inquilino_nombre || '—')],
    ['Alquiler mensual', RD(cobro.monto)],
    ['Método de pago', cobro.metodo_pago ? String(cobro.metodo_pago) : String(cobro.metodo || '—')],
    ['Referencia', String(cobro.referencia_pago || cobro.referencia || '—')]
  ];
  const pagadoCompleto = Number(cobro.pagado) === 1;
  const abonado = Number(cobro.abonado) || 0;
  const montoPagado = pagadoCompleto ? Number(cobro.monto) : abonado;
  ctx.y -= 4;
  for (const [lab, val] of renglones) {
    const y = ctx.y;
    ctx.page.drawText(String(lab).toUpperCase(), { x: ctx.M, y, size: 8, font: ctx.bold, color: GRIS_TXT });
    ctx.page.drawText(String(val), { x: ctx.M + 140, y, size: 9.5, font: ctx.font, color: TINTA });
    ctx.y -= 17;
    ctx.page.drawLine({ start: { x: ctx.M, y: ctx.y + 1 }, end: { x: ctx.M + ctx.W, y: ctx.y + 1 }, thickness: 0.4, color: GRIS_BORDE });
  }

  // Caja de total pagado
  ctx.y -= 8;
  const boxW = ctx.W;
  const boxH = 36;
  ctx.page.drawRectangle({ x: ctx.M, y: ctx.y - boxH, width: boxW, height: boxH, color: AZUL_PALIDO });
  ctx.page.drawRectangle({ x: ctx.M, y: ctx.y - boxH, width: boxW, height: boxH, borderColor: AZUL_MARCA, borderWidth: 1.2 });
  const etiqTotal = pagadoCompleto ? 'TOTAL PAGADO' : 'ABONO RECIBIDO';
  const badge = pagadoCompleto ? '' : '  ·  SALDO PENDIENTE ' + RD(Math.max(0, Number(cobro.monto) - abonado));
  ctx.page.drawText(etiqTotal, { x: ctx.M + 12, y: ctx.y - boxH / 2 - 5, size: 9, font: ctx.bold, color: AZUL_OSCURO });
  ctx.page.drawText(String(badge).toUpperCase(), { x: ctx.M + 12, y: ctx.y - boxH / 2 + 9, size: 7.5, font: ctx.bold, color: ROJO });
  ctx.page.drawText(RD(montoPagado), { x: ctx.M + boxW - 12 - ctx.bold.widthOfTextAtSize(RD(montoPagado), 15), y: ctx.y - boxH / 2 - 9, size: 15, font: ctx.bold, color: AZUL_OSCURO });
  ctx.y -= boxH + 14;

  ctx.page.drawText((pagadoCompleto ? 'Recibí del inquilino la suma de:' : 'Recibí del inquilino la suma de') + (pagadoCompleto ? '' : ' (abono a la renta):'), { x: ctx.M, y: ctx.y, size: 9, font: ctx.font, color: TINTA });
  ctx.y -= 14;
  ctx.page.drawText(RD(montoPagado) + '  (' + letraMonto(Number(montoPagado)) + ' pesos dominicanos con 00/100)', { x: ctx.M, y: ctx.y, size: 9, font: ctx.bold, color: TINTA });
  ctx.y -= 14;
  ctx.page.drawText('correspondiente al alquiler del mes de ' + ETIQUETA_MES(cobro.mes) + ' del ' +
    (estudio && estudio.nombre ? String(estudio.nombre) : 'estudio'), { x: ctx.M, y: ctx.y, size: 9, font: ctx.font, color: TINTA, maxWidth: ctx.W });

  ctx.y -= 34;
  // firmas lado a lado
  const colW = (ctx.W - 24) / 2;
  const f1 = ctx.M, f2 = ctx.M + ctx.W - colW;
  ctx.page.drawLine({ start: { x: f1, y: ctx.y }, end: { x: f1 + colW, y: ctx.y }, thickness: 0.8, color: GRIS_TXT });
  ctx.page.drawLine({ start: { x: f2, y: ctx.y }, end: { x: f2 + colW, y: ctx.y }, thickness: 0.8, color: GRIS_TXT });
  ctx.y -= 10;
  ctx.page.drawText('Firma del arrendador (dueño)', { x: f1, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
  ctx.page.drawText('Firma del arrendatario (inquilino)', { x: f2, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
  return Buffer.from(await ctx.doc.save());
}

// ---- Aging: antigüedad de las deudas de alquiler (este mes / 1 / 2 / 3+ meses) ----
async function reporteAging(empresa, aging, mes) {
  const ctx = await crearContexto(empresa, 'Aging de alquileres');
  ctx.titulo('Deudas por Antigüedad', ETIQUETA_MES(mes));
  const filas = aging.filas.map((f) => ([
    f.nombre,
    { texto: RD(f.mes0), color: f.mes0 > 0 ? AMBAR : TINTA },
    { texto: RD(f.mes1), color: f.mes1 > 0 ? AMBAR : TINTA },
    { texto: RD(f.mes2), color: f.mes2 > 0 ? ROJO : TINTA },
    { texto: RD(f.mes3plus), color: f.mes3plus > 0 ? ROJO : TINTA },
    { texto: RD(f.total), color: TINTA, bold: true }
  ]));
  filas.push([
    { texto: 'TOTAL', color: AZUL_OSCURO, bold: true },
    { texto: RD(aging.totalMes0 || 0), color: AZUL_OSCURO, bold: true },
    { texto: RD(aging.totalMes1 || 0), color: AZUL_OSCURO, bold: true },
    { texto: RD(aging.totalMes2 || 0), color: AZUL_OSCURO, bold: true },
    { texto: RD(aging.totalMes3plus || 0), color: AZUL_OSCURO, bold: true },
    { texto: RD(aging.total || 0), color: AZUL_OSCURO, bold: true, fillcolor: AZUL_PALIDO }
  ]);
  dibujarTabla(ctx, ['Inquilino', 'Este mes', '1 mes', '2 meses', '3+ meses', 'Total'], filas, {
    anchos: [ctx.W * 0.3, ctx.W * 0.14, ctx.W * 0.14, ctx.W * 0.14, ctx.W * 0.14, ctx.W * 0.18],
    numeric: [false, true, true, true, true, false]
  });
  ctx.y -= 4;
  ctx.page.drawText('3+ meses = deuda vencida hace 3 meses o más: prioridad de gestión.', { x: ctx.M, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
  return Buffer.from(await ctx.doc.save());
}

// ---- Rentabilidad por estudio (cobrado histórico - gastos vs inversión) ----
async function reporteRentabilidad(empresa, filas) {
  const ctx = await crearContexto(empresa, 'Rentabilidad por estudio');
  ctx.titulo('Rentabilidad por Estudio');
  let totC = 0, totG = 0, totI = 0, totU = 0;
  for (const f of filas) {
    totC += Number(f.cobrado); totG += Number(f.gastos); totI += Number(f.costo_inversion); totU += Number(f.utilidad);
  }
  const filasTabla = filas.map((f) => ([
    f.nombre,
    RD(f.cobrado), RD(f.gastos), RD(f.costo_inversion), RD(f.utilidad),
    { texto: (Number(f.retorno || 0).toFixed(1)) + '%', color: f.retorno >= 0 ? f.retorno >= 10 ? AZUL : AMBAR : ROJO, bold: true }
  ]));
  filasTabla.push([
    { texto: 'TOTAL', color: AZUL_OSCURO, bold: true },
    { texto: RD(totC), color: AZUL_OSCURO },
    { texto: RD(totG), color: AZUL_OSCURO },
    { texto: RD(totI), color: AZUL_OSCURO },
    { texto: RD(totU), color: AZUL_OSCURO, bold: true },
    { texto: '', color: AZUL_OSCURO }
  ]);
  dibujarTabla(ctx, ['Estudio', 'Cobrado', 'Gastos', 'Inversión', 'Utilidad', 'Retorno'], filasTabla, {
    anchos: [ctx.W * 0.2, ctx.W * 0.15, ctx.W * 0.15, ctx.W * 0.16, ctx.W * 0.18, ctx.W * 0.16],
    numeric: [false, true, true, true, true, false]
  });
  ctx.y -= 4;
  ctx.page.drawText('Utilidad = cobrado histórico - gastos asignados al estudio. Retorno = (utilidad / inversión) x 100.', { x: ctx.M, y: ctx.y, size: 8, font: ctx.font, color: GRIS_TXT });
  return Buffer.from(await ctx.doc.save());
}

// ---- Contrato de alquiler (PDF formal para estudio + inquilino) ----
function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return d ? Number(d) + ' de ' + (nombres[Number(m) - 1] || m) + ' de ' + y : '';
}
async function reporteContrato(empresa, contrato, estudio, inquilino) {
  const ctx = await crearContexto(empresa, 'Contrato de alquiler');
  const c = contrato || {};
  const fechaStr = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
  const arrendador = (empresa && empresa.nombre) || 'EL ARRENDADOR';
  const arrendatario = (inquilino && inquilino.nombre) || (c.inquilino_nombre) || '____________________________';
  const nomEstudio = (estudio && estudio.nombre) || (c.estudio_nombre) || '';
  const direccion = (estudio && estudio.direccion) || (c.estudio_direccion) || '';
  const monto = Number(c.renta != null ? c.renta : (estudio && estudio.alquiler)) || 0;
  const deposito = Number(c.deposito != null ? c.deposito : (estudio && estudio.deposito)) || 0;
  const diaPago = Number(c.dia_pago) || 5;
  const duracion = Number(c.duracion_meses) || 12;
  const inicio = fmtFecha(c.fecha_inicio) || '________________';
  const vencimiento = fmtFecha(c.fecha_vencimiento) || '________________';

  ctx.titulo('Contrato de Alquiler de Estudio');

  // Panel informativo en dos columnas
  const info = [
    ['ARRENDADOR', String(arrendador).toUpperCase()],
    ['ARRENDATARIO', String(arrendatario).toUpperCase()],
    ['ESTUDIO', nomEstudio || '(indicar)'],
    ['LUGAR', direccion || 'Santo Domingo, R.D.'],
    ['INICIO DEL ALQUILER', inicio],
    ['VENCIMIENTO', vencimiento],
    ['DURACIÓN', duracion + ' mes' + (duracion === 1 ? '' : 'es')],
    ['ALQUILER MENSUAL', RD(monto)],
    ['DÍA DE PAGO', 'día ' + diaPago + ' de cada mes'],
    ['DEPÓSITO DE GARANTÍA', RD(deposito)],
    ['INCREMENTO ANUAL', (Number(c.incremento_pct) || 0) + '%'],
    ['AVAL', (String(c.aval_nombre || '').trim() || '—') + (c.aval_telefono ? '  ·  ' + c.aval_telefono : '')]
  ];
  const colAncho = (ctx.W - 24) / 2;
  const renglonH = 19;
  const panelRows = Math.ceil(info.length / 2);
  const panelH = 10 + renglonH * panelRows;
  ctx.page.drawRectangle({ x: ctx.M, y: ctx.y - panelH, width: ctx.W, height: panelH, color: FONDO_ALT });
  ctx.page.drawRectangle({ x: ctx.M, y: ctx.y - panelH, width: ctx.W, height: panelH, borderColor: GRIS_BORDE, borderWidth: 0.8 });
  info.forEach(([lab, val], i) => {
    const fila = Math.floor(i / 2), col = i % 2;
    const x0 = ctx.M + 14 + col * (colAncho + 20);
    const yy = ctx.y - 18 - fila * renglonH;
    ctx.page.drawText(lab, { x: x0, y: yy, size: 8, font: ctx.bold, color: GRIS_TXT });
    ctx.page.drawText(String(val), { x: x0 + 92, y: yy, size: 8.5, font: ctx.font, color: TINTA, maxWidth: colAncho - 92 });
  });
  ctx.y -= panelH + 18;

  ctx.page.drawText('En la ciudad de Santo Domingo, a los ' + fechaStr + ', las partes arriba señaladas celebran el presente contrato de alquiler con arreglo a las siguientes cláusulas:',
    { x: ctx.M, y: ctx.y, size: 8.5, font: ctx.font, color: TINTA, maxWidth: ctx.W });
  ctx.y -= 24;

  ctx.sub('Cláusulas');

  const clausulas = [
    'PRIMERA — Objeto. El ARRENDADOR da en alquiler al ARRENDATARIO el estudio ' + (nomEstudio || '(indicar)') +
      (direccion ? ', ubicado en ' + direccion + ', ' : ', ') + 'para que lo habite como vivienda y lugar de estudios, por un término de ' +
      duracion + ' mes' + (duracion === 1 ? '' : 'es') + ' contados a partir del ' + inicio + '.',
    'SEGUNDA — Canon de alquiler. El arrendamiento se pacta por la suma de ' + RD(monto) +
      ' (' + letraMonto(monto) + ' pesos dominicanos con 00/100) mensuales, pagaderos por adelantado dentro de los primeros ' +
      diaPago + ' día' + (diaPago === 1 ? '' : 's') + ' de cada mes' +
      (Number(c.incremento_pct) ? ', con un incremento anual de ' + Number(c.incremento_pct) + '% sobre la renta vigente' : '') + '.',
    'TERCERA — Depósito de garantía. El ARRENDATARIO entrega la suma de ' + RD(deposito) +
      ' en concepto de depósito de garantía, que será devuelto a la terminación del contrato si el estudio se entrega en buen estado y libre de deudas.',
    'CUARTA — Servicios. El ARRENDATARIO cuenta con acceso a los servicios y áreas comunes del edificio. El consumo de electricidad, agua e internet se cobra conforme a lo acordado entre las partes.',
    'QUINTA — Mantenimiento. El ARRENDATARIO conservará el estudio en buen estado y dará aviso inmediato de cualquier avería. Los arreglos estructurales corresponden al ARRENDADOR y los de uso diario al ARRENDATARIO.',
    'SEXTA — Mora. El retraso en el pago faculta al ARRENDADOR a exigir el saldo adeudado y, de persistir, a reclamar los intereses y la restitución del estudio conforme a la legislación vigente.',
    'SÉPTIMA — Aval' + (String(c.aval_nombre || '').trim() ? ' (' + c.aval_nombre + (c.aval_telefono ? ', ' + c.aval_telefono : '') + ')' : '') + '. El aval responde solidariamente del cumplimiento de las obligaciones del ARRENDATARIO durante la vigencia de este contrato.',
    'OCTAVA — Domicilio. Las partes fijan como domicilio para toda notificación las direcciones consignadas en el presente contrato.',
    'NOVENA — Firma. El presente contrato se firma en dos (2) ejemplares de un mismo tenor y valor, uno para cada parte, en la fecha al inicio indicada.'
  ];

  // Dibuja cada cláusula con el número en negrita verde, saltando de página si hace falta.
  const anchoResto = ctx.W - 46;
  const compruebaMargen = () => { if (ctx.y < 96) ctx.addPage(); };
  for (const cl of clausulas) {
    const idx = cl.indexOf('—');
    const pref = cl.slice(0, idx + 1).trim();
    const resto = cl.slice(idx + 1).trim();
    ctx.y -= 2;
    const palabras = String(resto).split(/\s+/);
    let linea = '';
    for (const pal of palabras) {
      const prueba = linea ? linea + ' ' + pal : pal;
      if (ctx.font.widthOfTextAtSize(prueba, 8.5) > anchoResto && linea) {
        compruebaMargen();
        ctx.page.drawText(pref, { x: ctx.M, y: ctx.y, size: 8.5, font: ctx.bold, color: AZUL_OSCURO });
        ctx.page.drawText(linea, { x: ctx.M + 46, y: ctx.y, size: 8.5, font: ctx.font, color: TINTA, maxWidth: anchoResto });
        ctx.y -= 11;
        linea = pal;
      } else linea = prueba;
    }
    compruebaMargen();
    ctx.page.drawText(pref, { x: ctx.M, y: ctx.y, size: 8.5, font: ctx.bold, color: AZUL_OSCURO });
    ctx.page.drawText(linea, { x: ctx.M + 46, y: ctx.y, size: 8.5, font: ctx.font, color: TINTA, maxWidth: anchoResto });
    ctx.y -= 11;
  }

  compruebaMargen();
  ctx.y -= 12;
  ctx.page.drawText('En fe de lo cual, ambas partes firman:', { x: ctx.M, y: ctx.y, size: 8.5, font: ctx.font, color: TINTA });
  ctx.y -= 40;

  const colW = (ctx.W - 24) / 2;
  const f1 = ctx.M, f2 = ctx.M + ctx.W - colW;
  ctx.page.drawLine({ start: { x: f1, y: ctx.y }, end: { x: f1 + colW, y: ctx.y }, thickness: 0.8, color: GRIS_TXT });
  ctx.page.drawLine({ start: { x: f2, y: ctx.y }, end: { x: f2 + colW, y: ctx.y }, thickness: 0.8, color: GRIS_TXT });
  ctx.y -= 48;
  ctx.page.drawText('ARRENDADOR — ' + String(arrendador).toUpperCase(), { x: f1, y: ctx.y, size: 8, font: ctx.bold, color: TINTA });
  ctx.page.drawText('ARRENDATARIO — ' + String(arrendatario).toUpperCase(), { x: f2, y: ctx.y, size: 8, font: ctx.bold, color: TINTA });
  return Buffer.from(await ctx.doc.save());
}

// ---- Estado de cuenta por inquilino (historial de pagos y pendientes) ----
async function reporteEstadoCuenta(empresa, estado) {
  const ctx = await crearContexto(empresa, 'Estado de cuenta');
  const iq = estado.inquilino || {};
  ctx.titulo('Estado de Cuenta', (iq.nombre || '').toUpperCase());
  const mvs = estado.movimientos || [];
  const filas = mvs.map((f) => {
    let estTexto = 'PENDIENTE';
    let color = ROJO;
    if (f.estado === 'pagado') { estTexto = 'PAGADO'; color = AZUL; }
    else if (f.estado === 'parcial') { estTexto = 'ABONADO'; color = AMBAR; }
    return [ETIQUETA_MES(f.mes), f.estudio_nombre || ('Estudio ' + f.estudio_id), RD(f.monto), { texto: RD(f.abonado), color: TINTA }, { texto: RD(f.pendiente), color: f.pendiente > 0 ? ROJO : AZUL }, { texto: estTexto, color, bold: true }];
  });
  dibujarTabla(ctx, ['Mes', 'Estudio', 'Alquiler', 'Pagado', 'Pendiente', 'Estado'], filas, {
    anchos: [ctx.W * 0.13, ctx.W * 0.25, ctx.W * 0.16, ctx.W * 0.16, ctx.W * 0.15, ctx.W * 0.15],
    numeric: [false, false, true, true, true, false]
  });
  ctx.y -= 4;
  dibujarTabla(ctx, ['', ''], [
    [{ texto: 'Total pagado', color: AZUL_OSCURO, bold: true }, { texto: RD(estado.pagado), color: AZUL_OSCURO, bold: true }],
    [{ texto: 'Total pendiente', color: ROJO, bold: true, fillcolor: AZUL_PALIDO }, { texto: RD(estado.debido), color: ROJO, bold: true, fillcolor: AZUL_PALIDO }]
  ], { anchos: [ctx.W * 0.75, ctx.W * 0.25], numeric: [false, true], bandas: false });
  return Buffer.from(await ctx.doc.save());
}

module.exports = { reporteCobros, reporteGastos, reporteResumen, reporteRecibo, reporteAging, reporteContrato, reporteRentabilidad, reporteEstadoCuenta, reporteFinanciero, reporteAnual };