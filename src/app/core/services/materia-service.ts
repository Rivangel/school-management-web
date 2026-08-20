import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Materia, Pagina, ParametrosPagina } from '../models';
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
}
