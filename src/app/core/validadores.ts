import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Obligatorio de verdad: un campo con sólo espacios no cuenta como lleno.
 *
 * `Validators.required` da por bueno `"   "` porque únicamente comprueba que la
 * cadena no esté vacía, pero la API valida con `@NotBlank`, que recorta antes de
 * mirar. Sin esto el formulario se envía, viaja hasta el servidor y vuelve como
 * un 400 que el usuario no tenía forma de anticipar.
 *
 * Devuelve la clave `required` a propósito: para quien rellena el formulario es
 * el mismo caso —el campo está vacío— y merece el mismo mensaje, así que las
 * plantillas no tienen que distinguirlos.
 */
export function textoRequerido(control: AbstractControl): ValidationErrors | null {
  const valor: unknown = control.value;
  return typeof valor === 'string' && valor.trim().length > 0 ? null : { required: true };
}
