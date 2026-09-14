// recibo.js — Recibo PDF individual por cobro (exportable/reimprimible).
// Se carga desde index.html con <script> tras app.js.
// Usa `export:pdf` (tipo 'recibo') para abrir el diálogo de guardado.

async function exportarRecibo(id, mes) {
  const mesC = mes || mesActual;
  const filas = (await window.api.cobrosMes(mesC)).data || [];
  const fila = filas.find((f) => Number(f.id) === Number(id));
  if (!fila) return toast('Cobro no encontrado', 'error');
  const r = await window.api.pdfExport('recibo', {
    obj: {
      cobro: fila,
      estudio: { id: fila.estudio_id, nombre: fila.estudio_nombre, direccion: fila.estudio_direccion },
      inquilino: { id: fila.inquilino_id, nombre: fila.inquilino_nombre }
    },
    filename: (fila.recibo_numero || 'recibo-' + id) + '.pdf'
  });
  if (r.ok) toast('Recibo guardado' + (fila.recibo_numero ? ' (' + fila.recibo_numero + ')' : ''));
  else if (r.error !== 'cancelado') toast(r.error || 'No se pudo generar el recibo', 'error');
}