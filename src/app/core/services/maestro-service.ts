import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Maestro, MaestroRequest, Pagina, ParametrosPagina } from '../models';
import { paramsDePagina } from '../paginacion';

/**
 * Acceso a `/api/maestros`.
 *
 * Mismo trato que `AlumnoService`: sólo habla HTTP, no guarda el listado ni
 * decide qué página se ve — eso vive en la URL y lo lleva la pantalla.
 *
 * Todo va con `sinAvisoGlobal()`, **el borrado incluido**, y ahí se separa de
 * alumnos: un maestro con materias a su cargo no se puede borrar (la clave
 * foránea de `materias.maestro_id` no admite nulos) y la API responde con un 409
 * cuyo mensaje —"La operación viola una restricción de datos"— no le dice al
 * usuario ni a quién ni por qué. Ese caso no es raro, es el de cualquier maestro
 * que dé clase, así que lo explica la ficha con sus propias palabras en vez de
 * salir como aviso flotante.
 */
@Injectable({ providedIn: 'root' })
export class MaestroService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/maestros`;

  /**
   * Página de maestros. Sin parámetros manda la petición pelada y responde la
   * API con sus valores por defecto: 20 maestros ordenados por apellido y
   * nombre.
   */
  listar(parametros: ParametrosPagina = {}): Observable<Pagina<Maestro>> {
    return this.http.get<Pagina<Maestro>>(this.url, {
      params: paramsDePagina(parametros),
      context: sinAvisoGlobal(),
    });
  }

  /**
   * El maestro vinculado a la sesión abierta.
   *
   * La sesión guarda email, nombre y rol —lo que trae el token—, pero **no el id**
   * del registro, así que un MAESTRO no puede pedir "mis materias"
   * (`?maestroId=…`) sin preguntar antes quién es. Un ADMIN no tiene maestro
   * vinculado y recibe un 404: es la respuesta correcta, no una avería, y quien
   * llame tiene que contar con ella.
   */
  obtenerActual(): Observable<Maestro> {
    return this.http.get<Maestro>(`${this.url}/me`, { context: sinAvisoGlobal() });
  }

  /** Un maestro por id. La API responde 404 si no existe. */
  obtenerPorId(id: number): Observable<Maestro> {
    return this.http.get<Maestro>(`${this.url}/${id}`, { context: sinAvisoGlobal() });
  }

  /**
   * Alta. Responde 201 con el maestro ya guardado, que no es exactamente lo que
   * se envió: la API recorta espacios y pasa el email a minúsculas.
   */
  crear(datos: MaestroRequest): Observable<Maestro> {
    return this.http.post<Maestro>(this.url, datos, { context: sinAvisoGlobal() });
  }

  /** Actualización completa: la API espera el registro entero, no un parche. */
  actualizar(id: number, datos: MaestroRequest): Observable<Maestro> {
    return this.http.put<Maestro>(`${this.url}/${id}`, datos, { context: sinAvisoGlobal() });
  }

  /**
   * Baja. Responde 204 sin cuerpo, o 409 si el maestro tiene materias
   * asignadas.
   *
   * A diferencia de la de alumnos **no** deja el fallo al interceptor: el 409
   * llega con un mensaje genérico sobre restricciones de datos, y la ficha sabe
   * traducirlo a la única causa posible.
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: sinAvisoGlobal() });
  }
}
