import { HttpErrorResponse } from '@angular/common/http';

import { mensajeDeError } from './mensaje-error';

/** Un fallo de la API tal y como llega a `HttpClient`. */
function fallo(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, url: '/api/alumnos' });
}

describe('mensajeDeError', () => {
  it('prefiere el message que manda la API', () => {
    // Es el caso normal: el `GlobalExceptionHandler` ya redactó una frase
    // pensada para leerse, y cualquier texto propio la empeoraría.
    const texto = mensajeDeError(fallo(409, { message: 'La matrícula A-001 ya está registrada' }));

    expect(texto).toBe('La matrícula A-001 ya está registrada');
  });

  it('explica que la API no respondió cuando el status es 0', () => {
    // El 0 no es una respuesta: es el navegador diciendo que la petición ni
    // salió. Decir "error inesperado" mandaría a buscar el fallo donde no está.
    expect(mensajeDeError(fallo(0))).toBe(
      'No se pudo contactar con el servidor. Revisa que la API esté encendida.',
    );
  });

  it('nombra la falta de permiso en un 403 sin cuerpo', () => {
    // Los 403 por rol los emite la cadena de filtros de Spring Security antes
    // del handler, así que llegan sin `ApiError` que leer.
    expect(mensajeDeError(fallo(403))).toBe('No tienes permiso para hacer esto.');
  });

  it('usa el respaldo de la pantalla cuando el error no explica nada', () => {
    expect(mensajeDeError(fallo(500), 'No se pudo cargar el listado de alumnos.')).toBe(
      'No se pudo cargar el listado de alumnos.',
    );
  });

  it('cae en el mensaje genérico si la pantalla no da respaldo', () => {
    expect(mensajeDeError(fallo(500))).toBe('Ocurrió un error inesperado. Vuelve a intentarlo.');
  });

  it('ignora un cuerpo sin message legible en vez de enseñar undefined', () => {
    // El cuerpo puede ser el HTML de un proxy o un JSON con otra forma: dar por
    // hecho que hay `message` es la vía rápida a un aviso que dice "undefined".
    expect(mensajeDeError(fallo(500, '<html>502 Bad Gateway</html>'), 'Respaldo')).toBe('Respaldo');
    expect(mensajeDeError(fallo(500, { message: '' }), 'Respaldo')).toBe('Respaldo');
    expect(mensajeDeError(fallo(500, { message: 42 }), 'Respaldo')).toBe('Respaldo');
  });

  it('el message de la API gana también en un 403', () => {
    // Sólo el 403 pelado es de rol; el que trae explicación la trae por algo.
    expect(mensajeDeError(fallo(403, { message: 'No impartes esta materia' }))).toBe(
      'No impartes esta materia',
    );
  });

  it('trata lo que no es un error HTTP como error desconocido', () => {
    // `rxResource` entrega el error tal cual venga: un fallo del propio `map`
    // llega aquí como `Error`, y leerle `status` daría undefined.
    expect(mensajeDeError(new Error('boom'), 'Respaldo')).toBe('Respaldo');
    expect(mensajeDeError(undefined, 'Respaldo')).toBe('Respaldo');
  });
});
