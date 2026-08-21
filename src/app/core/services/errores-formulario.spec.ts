import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { ApiError } from '../models';
import { ERROR_SERVIDOR, PistaDeCampo, aplicarErroresDeApi } from './errores-formulario';

const PISTAS: readonly PistaDeCampo[] = [
  { patron: /matrícula/i, campo: 'matricula' },
  { patron: /email/i, campo: 'email' },
];

function formulario(): FormGroup {
  return new FormBuilder().nonNullable.group({ nombre: [''], matricula: [''], email: [''] });
}

/** 400 de validación: el que trae el mapa `detalles`. */
function errorDeValidacion(detalles: Record<string, string>): HttpErrorResponse {
  const cuerpo: ApiError = {
    timestamp: '2026-08-17T10:00:00',
    status: 400,
    error: 'Bad Request',
    message: 'Error de validación en los datos enviados',
    path: '/api/alumnos',
    detalles,
  };
  return new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: cuerpo });
}

/** 400 de negocio: una frase suelta, sin desglose por campo. */
function errorDeNegocio(message: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    statusText: 'Bad Request',
    error: { status: 400, message, path: '/api/alumnos' },
  });
}

describe('aplicarErroresDeApi', () => {
  it('cuelga cada detalle de su propio campo', () => {
    const form = formulario();

    const aviso = aplicarErroresDeApi(
      form,
      errorDeValidacion({
        nombre: 'El nombre es obligatorio',
        email: 'El email debe tener un formato válido',
      }),
    );

    expect(aviso).toBeNull();
    expect(form.controls['nombre'].getError(ERROR_SERVIDOR)).toBe('El nombre es obligatorio');
    expect(form.controls['email'].getError(ERROR_SERVIDOR)).toBe(
      'El email debe tener un formato válido',
    );
    expect(form.controls['matricula'].valid).toBe(true);
  });

  it('marca el campo como tocado para que el error se pinte', () => {
    // Material sólo enseña los `mat-error` de un control tocado: sin esto el
    // formulario queda inválido sin decir por qué.
    const form = formulario();

    aplicarErroresDeApi(form, errorDeValidacion({ nombre: 'El nombre es obligatorio' }));

    expect(form.controls['nombre'].touched).toBe(true);
  });

  it('devuelve como aviso los detalles de un campo que no está en el formulario', () => {
    // Si la API valida algo que la pantalla no muestra, el mensaje no se pierde.
    const form = formulario();

    const aviso = aplicarErroresDeApi(
      form,
      errorDeValidacion({ grupo: 'El grupo es obligatorio' }),
    );

    expect(aviso).toBe('El grupo es obligatorio');
  });

  it('usa las pistas para colocar un error que la API no desglosa', () => {
    const form = formulario();

    const aviso = aplicarErroresDeApi(
      form,
      errorDeNegocio('Ya existe un alumno con la matrícula A-001'),
      PISTAS,
    );

    expect(aviso).toBeNull();
    expect(form.controls['matricula'].getError(ERROR_SERVIDOR)).toBe(
      'Ya existe un alumno con la matrícula A-001',
    );
  });

  it('una pista con mensaje propio sustituye la frase de la API', () => {
    // Para cuando la API habla de algo que el usuario no ha visto: el
    // formulario de materias elige un maestro por su nombre en un desplegable y
    // recibe de vuelta un "Maestro con id 3 no encontrado".
    const form = formulario();

    const aviso = aplicarErroresDeApi(form, errorDeNegocio('Maestro con id 3 no encontrado'), [
      { patron: /maestro/i, campo: 'nombre', mensaje: 'Ese maestro ya no existe.' },
    ]);

    expect(aviso).toBeNull();
    expect(form.controls['nombre'].getError(ERROR_SERVIDOR)).toBe('Ese maestro ya no existe.');
  });

  it('enseña como aviso general el mensaje que ninguna pista reconoce', () => {
    // La degradación que importa: si cambia la redacción de la API el error deja
    // de marcar el campo, pero sigue viéndose en pantalla.
    const form = formulario();

    const aviso = aplicarErroresDeApi(
      form,
      errorDeNegocio('El alumno tiene calificaciones'),
      PISTAS,
    );

    expect(aviso).toBe('El alumno tiene calificaciones');
    expect(form.valid).toBe(true);
  });

  it('tolera un error sin cuerpo y responde con el respaldo', () => {
    // Los 403 por rol los emite la cadena de filtros antes del handler global,
    // así que no traen `ApiError` que leer.
    const form = formulario();
    const sinCuerpo = new HttpErrorResponse({ status: 403, statusText: 'Forbidden', error: null });

    expect(aplicarErroresDeApi(form, sinCuerpo, PISTAS, 'No se pudo guardar.')).toBe(
      'No tienes permiso para hacer esto.',
    );
    expect(form.valid).toBe(true);
  });

  it('conserva los errores propios del control al marcar el del servidor', () => {
    const form = formulario();
    form.controls['nombre'].setErrors({ maxlength: true });

    aplicarErroresDeApi(form, errorDeValidacion({ nombre: 'El nombre es obligatorio' }));

    expect(form.controls['nombre'].hasError('maxlength')).toBe(true);
    expect(form.controls['nombre'].hasError(ERROR_SERVIDOR)).toBe(true);
  });
});

describe('el error marcado por la API', () => {
  it('desaparece en cuanto se edita ese campo', () => {
    // De esto depende que el formulario no se quede bloqueado por una objeción
    // ya corregida: cambiar el valor recalcula los validadores del control y
    // reemplaza su mapa de errores, así que no hace falta limpiarlo a mano.
    const form = formulario();
    aplicarErroresDeApi(form, errorDeValidacion({ nombre: 'El nombre es obligatorio' }));
    expect(form.valid).toBe(false);

    form.controls['nombre'].setValue('Ana');

    expect(form.controls['nombre'].hasError(ERROR_SERVIDOR)).toBe(false);
    expect(form.valid).toBe(true);
  });

  it('sobrevive mientras se editan otros campos', () => {
    const form = formulario();
    aplicarErroresDeApi(
      form,
      errorDeValidacion({ nombre: 'El nombre es obligatorio', email: 'Email inválido' }),
    );

    form.controls['nombre'].setValue('Ana');

    expect(form.controls['email'].getError(ERROR_SERVIDOR)).toBe('Email inválido');
  });

  it('no se lleva por delante los errores de los validadores locales', () => {
    const form = new FormBuilder().nonNullable.group({
      nombre: ['Nombre larguísimo', Validators.maxLength(3)],
    });
    aplicarErroresDeApi(form, errorDeValidacion({ nombre: 'El nombre es obligatorio' }));

    form.controls.nombre.setValue('Sigue siendo largo');

    expect(form.controls.nombre.hasError('maxlength')).toBe(true);
    expect(form.controls.nombre.hasError(ERROR_SERVIDOR)).toBe(false);
  });
});
