/**
 * Espejo de `ErrorResponse`, el cuerpo que devuelve `GlobalExceptionHandler`.
 *
 * `detalles` sólo llega en los 400 de validación: es un mapa campo → mensaje,
 * que es lo que permite marcar el control equivocado en el formulario en vez de
 * enseñar un error genérico.
 *
 * Ojo: los 403 por rol los emite la cadena de filtros de Spring Security antes
 * de llegar al handler, así que **no traen este cuerpo**. Cualquier código que
 * lea un error tiene que tolerar que no haya JSON.
 */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  detalles?: Record<string, string>;
}
