import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Maestro, Pagina, ParametrosPagina } from '../models';
import { paramsDePagina } from '../paginacion';

/**
 * Acceso a `/api/maestros`.
 *
 * Mismo trato que `AlumnoService`: sólo habla HTTP, no guarda el listado ni
 * decide qué página se ve — eso vive en la URL y lo lleva la pantalla.
 *
 * `sinAvisoGlobal()` porque quien pide estos datos los enseña en una pantalla
 * que ya tiene su aviso con botón de reintentar; un mensaje flotante encima
 * contaría dos veces el mismo fallo.
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
}
