/**
 * Espejo de `CalificacionResponse`.
 *
 * `calificacion` es un `BigDecimal` en Java y viaja como número JSON.
 */
export interface Calificacion {
  id: number;
  alumnoId: number;
  alumnoNombre: string;
  materiaId: number;
  materiaNombre: string;
  calificacion: number;
  /** Formato `AAAA-S`, con S igual a 1 o 2 (ej. `2026-1`). */
  periodo: string;
}

/**
 * Espejo de `CalificacionRequest`.
 *
 * La API hace *upsert*: si ya existe una calificación para el mismo alumno,
 * materia y periodo, la actualiza en vez de insertar otra — y responde 201 en
 * ambos casos, así que el frontend no puede distinguir alta de edición por el
 * código de estado.
 */
export interface CalificacionRequest {
  alumnoId: number;
  materiaId: number;
  /** Entre 0 y 10. */
  calificacion: number;
  periodo: string;
}

/** Formato que exige el `@Pattern` del periodo en la API. */
export const PATRON_PERIODO = /^\d{4}-[12]$/;
