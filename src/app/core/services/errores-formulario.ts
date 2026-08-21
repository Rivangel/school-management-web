import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';

import { ApiError } from '../models';
import { mensajeDeError } from './mensaje-error';

/** Clave con la que se guarda en un control lo que objetó la API. */
export const ERROR_SERVIDOR = 'servidor';

/**
 * Regla para adivinar a qué campo se refiere un error que la API no desglosa.
 *
 * Los 400 de negocio (matrícula o email repetidos) llegan como una frase suelta,
 * sin el mapa `detalles` de los 400 de validación, así que la única pista es el
 * texto del mensaje.
 */
export interface PistaDeCampo {
  readonly patron: RegExp;
  readonly campo: string;
  /**
   * Qué enseñar en lugar de la frase de la API.
   *
   * Sin esto se enseña la suya, que es lo normal: "Ya existe un maestro con el
   * email …" se lee perfectamente bajo el campo del email. Hace falta cuando la
   * API habla de algo que el usuario no ha visto — el formulario de materias
   * elige un maestro **por su nombre** en un desplegable y recibe de vuelta un
   * "Maestro con id 3 no encontrado".
   */
  readonly mensaje?: string;
}

/**
 * Reparte un error de la API entre los campos del formulario.
 *
 * Devuelve lo que **no** se pudo colgar de ningún campo, para enseñarlo como
 * aviso general; `null` significa que cada error quedó marcado donde toca.
 *
 * Dos formas de error, y la diferencia importa:
 *
 * - Los 400 de validación traen `detalles` (campo → mensaje). Ahí no hay nada
 *   que adivinar: cada mensaje se cuelga de su control.
 * - Los 400 de negocio ("Ya existe un alumno con la matrícula A-001") llegan
 *   como un `message` suelto. Para esos están las `pistas`, y por eso el caso sin
 *   coincidencia **devuelve el mensaje** en vez de descartarlo: si algún día
 *   cambia la redacción de la API, el error se degrada a aviso general en lugar
 *   de desaparecer de la pantalla.
 *
 * Lo que se marca aquí se borra solo en cuanto el usuario edita ese campo: cada
 * cambio de valor recalcula los validadores del control y **reemplaza** su mapa
 * de errores. De eso depende que el formulario no se quede bloqueado por una
 * objeción ya corregida, así que hay un test que lo fija.
 */
export function aplicarErroresDeApi(
  formulario: FormGroup,
  error: unknown,
  pistas: readonly PistaDeCampo[] = [],
  respaldo?: string,
): string | null {
  const detalles = detallesDe(error);
  if (detalles !== null) {
    const huerfanos: string[] = [];
    for (const [campo, mensaje] of Object.entries(detalles)) {
      const control = formulario.get(campo);
      if (control === null) {
        huerfanos.push(mensaje);
      } else {
        marcar(control, mensaje);
      }
    }
    return huerfanos.length > 0 ? huerfanos.join(' ') : null;
  }

  const mensaje = mensajeDeError(error, respaldo);
  const pista = pistas.find((candidata) => candidata.patron.test(mensaje));
  const control = pista === undefined ? null : formulario.get(pista.campo);
  if (control === null) {
    return mensaje;
  }

  marcar(control, pista?.mensaje ?? mensaje);
  return null;
}

/** Cuelga un mensaje de la API de un control, conservando sus otros errores. */
function marcar(control: AbstractControl, mensaje: string): void {
  control.setErrors({ ...control.errors, [ERROR_SERVIDOR]: mensaje });
  control.markAsTouched();
}

/**
 * El mapa campo → mensaje de un 400 de validación, o `null` si el error no lo
 * trae (un 403 de la cadena de filtros llega sin cuerpo, y el `status 0` ni
 * siquiera salió del navegador).
 */
function detallesDe(error: unknown): Record<string, string> | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const detalles = (error.error as Partial<ApiError> | null)?.detalles;
  if (detalles === undefined || detalles === null || typeof detalles !== 'object') {
    return null;
  }

  const utiles = Object.entries(detalles).filter(([, mensaje]) => typeof mensaje === 'string');
  return utiles.length > 0 ? Object.fromEntries(utiles) : null;
}
