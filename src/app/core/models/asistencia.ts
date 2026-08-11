/**
 * Espejo de `AsistenciaResponse`.
 *
 * `fecha` es un `LocalDate` en Java y viaja como cadena ISO `AAAA-MM-DD`. Se
 * deja como string a propósito: convertirla a `Date` la reinterpreta en la zona
 * horaria del navegador y un día de asistencia puede acabar mostrándose como el
 * anterior.
 */
export interface Asistencia {
  id: number;
  alumnoId: number;
  alumnoNombre: string;
  materiaId: number;
  materiaNombre: string;
  fecha: string;
  presente: boolean;
}

/**
 * Espejo de `AsistenciaRequest`. La fecha no puede ser futura y la API hace
 * *upsert* por alumno, materia y fecha.
 */
export interface AsistenciaRequest {
  alumnoId: number;
  materiaId: number;
  /** ISO `AAAA-MM-DD`. */
  fecha: string;
  presente: boolean;
}
