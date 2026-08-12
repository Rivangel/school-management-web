import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from '../models';

const MENSAJE_GENERICO = 'Ocurrió un error inesperado. Vuelve a intentarlo.';

/**
 * Traduce un error de `HttpClient` a una frase que se pueda enseñar en pantalla.
 *
 * Existe porque no todos los errores traen cuerpo: el `status 0` es el navegador
 * diciendo que la petición ni salió (API apagada, CORS, red caída) y los 403 por
 * rol los emite la cadena de filtros de Spring Security **antes** del
 * `GlobalExceptionHandler`, así que llegan sin `ApiError` que leer. Dar por
 * hecho que hay un `message` es la forma más fácil de acabar mostrando
 * "undefined" al usuario.
 */
export function mensajeDeError(error: unknown, respaldo = MENSAJE_GENERICO): string {
  if (!(error instanceof HttpErrorResponse)) {
    return respaldo;
  }

  if (error.status === 0) {
    return 'No se pudo contactar con el servidor. Revisa que la API esté encendida.';
  }

  const cuerpo = error.error as Partial<ApiError> | null;
  if (typeof cuerpo?.message === 'string' && cuerpo.message.length > 0) {
    return cuerpo.message;
  }

  if (error.status === 403) {
    return 'No tienes permiso para hacer esto.';
  }

  return respaldo;
}
