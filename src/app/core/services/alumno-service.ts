import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Alumno, AlumnoRequest, Pagina, ParametrosPagina } from '../models';
import { paramsDePagina } from '../paginacion';

/**
 * Acceso a `/api/alumnos`.
 *
 * Sólo habla HTTP: no guarda el listado ni decide qué página se ve. El estado de
 * la pantalla vive en la URL y lo maneja el componente, así que el servicio se
 * puede llamar desde donde sea sin arrastrar contexto.
 *
 * Casi todo va con `sinAvisoGlobal()`: quien pide estos datos los enseña dentro
 * de una pantalla que ya tiene su aviso con botón de reintentar, o de un
 * formulario que marca el campo que la API objetó. El borrado es la excepción —
 * no tiene dónde pintar un fallo, así que lo cuenta el interceptor.
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
    return this.http.get<Pagina<Alumno>>(this.url, {
      params: paramsDePagina(parametros),
      context: sinAvisoGlobal(),
    });
  }

  /** Un alumno por id. La API responde 404 si no existe. */
  obtenerPorId(id: number): Observable<Alumno> {
    return this.http.get<Alumno>(`${this.url}/${id}`, { context: sinAvisoGlobal() });
  }

  /**
   * Alta. Responde 201 con el alumno ya guardado, que no es exactamente lo que
   * se envió: la API recorta espacios y pasa el email a minúsculas.
   */
  crear(datos: AlumnoRequest): Observable<Alumno> {
    return this.http.post<Alumno>(this.url, datos, { context: sinAvisoGlobal() });
  }

  /** Actualización completa: la API espera el registro entero, no un parche. */
  actualizar(id: number, datos: AlumnoRequest): Observable<Alumno> {
    return this.http.put<Alumno>(`${this.url}/${id}`, datos, { context: sinAvisoGlobal() });
  }

  /**
   * Baja. Responde 204 sin cuerpo.
   *
   * Es la única que **no** silencia el aviso global: si falla no hay formulario
   * ni listado donde enseñarlo, así que lo cuenta el interceptor.
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
