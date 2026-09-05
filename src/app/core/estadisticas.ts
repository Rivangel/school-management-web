import { Asistencia, Calificacion } from './models';

/**
 * Agregados del dashboard, como funciones puras.
 *
 * **Se calculan aquí porque la API no los da.** Sus consultas devuelven filas
 * —las notas de una materia, la asistencia de un alumno—, no promedios, así que
 * el resumen sale de recorrerlas en el cliente. Es el mismo trato que ya reciben
 * las pantallas de los Días 21 a 24, y tiene el mismo techo: sólo se resume lo
 * que se ha pedido. El endpoint de estadísticas del Día 35 es lo que permitirá
 * quitar de aquí las cuentas y pedirlas hechas.
 *
 * Viven sueltas y sin dependencias, no dentro del componente, porque son la
 * parte que de verdad puede equivocarse: un promedio mal ponderado o un
 * porcentaje que divide entre cero no se ve en la pantalla, se ve en un test.
 */

/** Una barra de una gráfica: qué mide, cuánto y qué poner en la etiqueta. */
export interface Barra {
  readonly etiqueta: string;
  readonly valor: number;
  /** Lo que se lee en la barra y en su descripción accesible. */
  readonly texto: string;
}

/** Nota máxima que admite la API; es también el tope del eje de promedios. */
export const NOTA_MAXIMA = 10;

/** Redondeo a dos decimales sin arrastrar el error binario de `toFixed`. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Promedio de una lista de notas. Devuelve `null` si no hay ninguna. */
export function promedio(notas: readonly number[]): number | null {
  if (notas.length === 0) {
    return null;
  }
  return redondear(notas.reduce((suma, nota) => suma + nota, 0) / notas.length);
}

/**
 * Promedio de cada materia, de mayor a menor.
 *
 * Agrupa por `materiaId` y no por nombre: dos materias distintas pueden
 * llamarse igual y quedarían fundidas en una barra que no es de ninguna.
 *
 * Las materias sin ninguna nota **no salen**. Una barra en cero se lee como "el
 * grupo va fatal" cuando lo que pasa es que aún no se ha calificado.
 */
export function promedioPorMateria(calificaciones: readonly Calificacion[]): Barra[] {
  const porMateria = new Map<number, { nombre: string; notas: number[] }>();

  for (const calificacion of calificaciones) {
    const acumulado = porMateria.get(calificacion.materiaId);
    if (acumulado === undefined) {
      porMateria.set(calificacion.materiaId, {
        nombre: calificacion.materiaNombre,
        notas: [calificacion.calificacion],
      });
    } else {
      acumulado.notas.push(calificacion.calificacion);
    }
  }

  return [...porMateria.values()]
    .map(({ nombre, notas }) => ({ nombre, media: promedio(notas) }))
    .filter((fila): fila is { nombre: string; media: number } => fila.media !== null)
    .sort((a, b) => b.media - a.media || a.nombre.localeCompare(b.nombre, 'es'))
    .map(({ nombre, media }) => ({
      etiqueta: nombre,
      valor: media,
      texto: media.toFixed(2),
    }));
}

/** Tramos de la distribución de notas, en el orden en que se dibujan. */
const TRAMOS: readonly { readonly etiqueta: string; readonly desde: number }[] = [
  { etiqueta: '0 – 5.9', desde: 0 },
  { etiqueta: '6 – 6.9', desde: 6 },
  { etiqueta: '7 – 7.9', desde: 7 },
  { etiqueta: '8 – 8.9', desde: 8 },
  { etiqueta: '9 – 10', desde: 9 },
];

/**
 * Cuántas notas caen en cada tramo.
 *
 * Los tramos salen **siempre los cinco**, incluso vacíos: en un histograma el
 * hueco es el dato — que nadie esté reprobando se ve porque la primera barra
 * está a cero, no porque falte.
 */
export function distribucionDeNotas(calificaciones: readonly Calificacion[]): Barra[] {
  const conteo = new Array<number>(TRAMOS.length).fill(0);

  for (const { calificacion } of calificaciones) {
    // Del último tramo hacia atrás: el primero cuyo mínimo alcanza la nota. Si
    // ninguno lo hace (una nota negativa, que la API no deja pasar) cae en el 0.
    let tramo = 0;
    for (let indice = TRAMOS.length - 1; indice >= 0; indice -= 1) {
      if (calificacion >= TRAMOS[indice].desde) {
        tramo = indice;
        break;
      }
    }
    conteo[tramo] += 1;
  }

  return TRAMOS.map((tramo, indice) => ({
    etiqueta: tramo.etiqueta,
    valor: conteo[indice],
    texto: String(conteo[indice]),
  }));
}

/** Resumen de asistencia de una materia. */
export interface AsistenciaDeMateria {
  readonly materiaId: number;
  readonly materiaNombre: string;
  readonly presentes: number;
  readonly total: number;
  /** Porcentaje de asistencia, 0–100, con dos decimales. */
  readonly porcentaje: number;
}

/**
 * Porcentaje de asistencia por materia, de menor a mayor.
 *
 * **De menor a mayor a propósito**, al revés que los promedios: aquí lo que se
 * busca es la materia a la que se está faltando, y esa tiene que salir primero.
 */
export function asistenciaPorMateria(asistencias: readonly Asistencia[]): AsistenciaDeMateria[] {
  const porMateria = new Map<number, { nombre: string; presentes: number; total: number }>();

  for (const asistencia of asistencias) {
    const acumulado = porMateria.get(asistencia.materiaId) ?? {
      nombre: asistencia.materiaNombre,
      presentes: 0,
      total: 0,
    };
    acumulado.presentes += asistencia.presente ? 1 : 0;
    acumulado.total += 1;
    porMateria.set(asistencia.materiaId, acumulado);
  }

  return [...porMateria.entries()]
    .map(([materiaId, { nombre, presentes, total }]) => ({
      materiaId,
      materiaNombre: nombre,
      presentes,
      total,
      porcentaje: redondear((presentes / total) * 100),
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje || a.materiaNombre.localeCompare(b.materiaNombre, 'es'));
}

/** Las mismas cifras de asistencia, ya como barras de porcentaje. */
export function barrasDeAsistencia(asistencias: readonly Asistencia[]): Barra[] {
  return asistenciaPorMateria(asistencias).map((materia) => ({
    etiqueta: materia.materiaNombre,
    valor: materia.porcentaje,
    texto: `${materia.porcentaje}% (${materia.presentes}/${materia.total})`,
  }));
}

/** Totales de asistencia de todo lo consultado. */
export interface ResumenAsistencia {
  readonly presentes: number;
  readonly ausentes: number;
  readonly total: number;
  /** 0–100 con dos decimales; `null` cuando no hay ningún registro. */
  readonly porcentaje: number | null;
}

export function resumenDeAsistencia(asistencias: readonly Asistencia[]): ResumenAsistencia {
  const presentes = asistencias.filter((asistencia) => asistencia.presente).length;
  const total = asistencias.length;
  return {
    presentes,
    ausentes: total - presentes,
    total,
    // Sin registros no hay porcentaje. Un 0% diría que se faltó a todo.
    porcentaje: total === 0 ? null : redondear((presentes / total) * 100),
  };
}
