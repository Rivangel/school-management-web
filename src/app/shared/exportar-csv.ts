import { descargarArchivo } from '../core/services/reporte-service';

/** Una columna del CSV: qué título lleva y de dónde saca su valor en cada fila. */
export interface ColumnaCsv<T> {
  readonly encabezado: string;
  readonly valor: (fila: T) => string | number;
}

/**
 * Arma un CSV con las columnas y filas dadas, y dispara su descarga.
 *
 * Separado por comas y con cada celda entre comillas (RFC 4180): un nombre con
 * una coma dentro —"García, S.A."— no puede correr la fila de columna. Lleva
 * además una marca BOM por delante porque, sin ella, Excel abre acentos y la
 * "ñ" como basura al asumir Latin-1 en vez de UTF-8.
 *
 * Reutiliza `descargarArchivo` de `ReporteService`: es el mismo mecanismo que
 * ya descarga la boleta en PDF (Día 25), sólo cambia el tipo de contenido.
 */
export function exportarCsv<T>(
  nombreArchivo: string,
  columnas: readonly ColumnaCsv<T>[],
  filas: readonly T[],
): void {
  const encabezado = columnas.map((columna) => columna.encabezado);
  const cuerpo = filas.map((fila) => columnas.map((columna) => columna.valor(fila)));
  const csv = [encabezado, ...cuerpo].map((renglon) => renglon.map(escaparCelda).join(',')).join('\r\n');

  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  descargarArchivo(blob, nombreArchivo);
}

function escaparCelda(valor: string | number): string {
  return `"${String(valor).replace(/"/g, '""')}"`;
}
