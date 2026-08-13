import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Alumno, Pagina, ParametrosPagina } from '../models';
import { paramsDePagina } from '../paginacion';

/**
 * Acceso a `/api/alumnos`.
 *
 * Sólo habla HTTP: no guarda el listado ni decide qué página se ve. El estado de
 * la pantalla vive en la URL y lo maneja el componente, así que el servicio se
 * puede llamar desde donde sea sin arrastrar contexto.
 */
@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/alumnos`;

  /**
   * Página de alumnos. Sin parámetros manda la petición pelada y responde la
   * API con sus valores por defecto: 20 alumnos ordenados por apellido y nombre.
   */
  listar(parametros: ParametrosPagina = {}): Observable<Pagina<Alumno>> {
    return this.http.get<Pagina<Alumno>>(this.url, { params: paramsDePagina(parametros) });
  }
}
