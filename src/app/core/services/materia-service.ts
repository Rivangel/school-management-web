import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Materia, MateriaRequest, Pagina, ParametrosPagina } from '../models';
import { paramsDePagina } from '../paginacion';

/** Lo que acepta `GET /api/materias`: la paginación de siempre más el filtro. */
export interface ParametrosMateria extends ParametrosPagina {
  /** Devuelve sólo las materias de este maestro. */
  maestroId?: number;
}

/**
 * Acceso a `/api/materias`.
 *
 * Como los demás servicios de listado: sólo habla HTTP y el estado de la
 * pantalla vive en la URL.
 *
 * Todo va con `sinAvisoGlobal()`, **el borrado incluido**, por lo mismo que en
 * maestros: una materia con calificaciones o asistencias registradas no se puede
 * borrar (ni `calificaciones.materia_id` ni `asistencias.materia_id` admiten
 * nulos) y la API responde con un 409 cuyo mensaje —"La operación viola una
 * restricción de datos"— no dice ni qué materia ni por qué. Lo explica la ficha
 * con sus propias palabras.
 */
@Injectable({ providedIn: 'root' })
export class MateriaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/materias`;

  /**
   * Página de materias, de un maestro o de todos.
   *
   * El filtro **lo aplica la API**, no la pantalla: filtrar en el cliente sólo
   * alcanzaría a las 20 filas de la página que se está viendo, así que "las
   * materias de Laura" serían en realidad "las de Laura que había en esta
   * página". Los totales que devuelve son ya los del filtro.
   */
  listar(parametros: ParametrosMateria = {}): Observable<Pagina<Materia>> {
    let params = paramsDePagina(parametros);
    if (parametros.maestroId !== undefined) {
      params = params.set('maestroId', parametros.maestroId);
    }

    return this.http.get<Pagina<Materia>>(this.url, {
      params,
      context: sinAvisoGlobal(),
    });
  }

  /** Una materia por id. La API responde 404 si no existe. */
  obtenerPorId(id: number): Observable<Materia> {
    return this.http.get<Materia>(`${this.url}/${id}`, { context: sinAvisoGlobal() });
  }

  /**
   * Alta. Responde 201 con la materia ya guardada, que trae además el
   * `maestroNombre` que compone el DTO y que el formulario no envió.
   *
   * Un `maestroId` que no existe **no** es un 400: la API busca al maestro y
   * responde 404 con "Maestro con id 3 no encontrado". Pasa cuando alguien borra
   * al maestro mientras otro tiene el formulario abierto.
   */
  crear(datos: MateriaRequest): Observable<Materia> {
    return this.http.post<Materia>(this.url, datos, { context: sinAvisoGlobal() });
  }

  /**
   * Actualización completa: la API espera el registro entero, no un parche.
   *
   * Aquí el 404 es ambiguo —puede faltar la materia o el maestro—, y lo único
   * que los distingue es el mensaje.
   */
  actualizar(id: number, datos: MateriaRequest): Observable<Materia> {
    return this.http.put<Materia>(`${this.url}/${id}`, datos, { context: sinAvisoGlobal() });
  }

  /**
   * Baja. Responde 204 sin cuerpo, o 409 si la materia tiene calificaciones o
   * asistencias registradas.
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: sinAvisoGlobal() });
  }
}
