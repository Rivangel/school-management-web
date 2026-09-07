import { HttpErrorResponse } from '@angular/common/http';

import { t } from '../i18n/traducir';
import { ApiError } from '../models';

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
export function mensajeDeError(error: unknown, respaldo = t('errores.generico')): string {
  if (!(error instanceof HttpErrorResponse)) {
    return respaldo;
  }

  if (error.status === 0) {
    return t('errores.sinServidor');
  }

  const cuerpo = error.error as Partial<ApiError> | null;
  if (typeof cuerpo?.message === 'string' && cuerpo.message.length > 0) {
    return cuerpo.message;
  }

  if (error.status === 403) {
    return t('errores.sinPermiso');
  }

  return respaldo;
}
