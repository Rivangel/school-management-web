import { HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../../environments/environment';
import { Maestro } from '../../models';

/**
 * El maestro que responde `/api/maestros/me` en los tests.
 *
 * Imparte la materia 2, que es la de `Laura Gómez` en las fichas de prueba: así
 * un mismo test puede mirar una materia propia y una ajena sin inventar dos
 * maestros.
 */
export const MI_MAESTRO: Maestro = {
  id: 2,
  nombre: 'Laura',
  apellido: 'Gómez',
  email: 'maestro@escuela.com',
  especialidad: 'Ciencias de la Computación',
};

/**
 * Responde la consulta de identidad que hace {@link MiMaestro}.
 *
 * La lanza cualquier pantalla que decida por propiedad de la materia y **sólo
 * cuando quien entra es MAESTRO**, así que se busca con `match` en vez de
 * `expectOne`: en los tests de ADMIN o ALUMNO no hay ninguna, y exigirla los
 * rompería a todos.
 *
 * Devuelve si la había, para los tests que quieran comprobar justamente que un
 * ADMIN no la hace.
 */
export function atenderMiMaestro(
  http: HttpTestingController,
  ficha: Maestro = MI_MAESTRO,
): boolean {
  const peticiones = http.match(`${environment.apiUrl}/maestros/me`);
  for (const peticion of peticiones) {
    peticion.flush(ficha);
  }
  return peticiones.length > 0;
}
