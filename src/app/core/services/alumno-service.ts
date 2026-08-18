import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Alumno, AlumnoRequest, Pagina, ParametrosPagina } from '../models';
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

  /** Un alumno por id. La API responde 404 si no existe. */
  obtenerPorId(id: number): Observable<Alumno> {
    return this.http.get<Alumno>(`${this.url}/${id}`);
  }

  /**
   * Alta. Responde 201 con el alumno ya guardado, que no es exactamente lo que
   * se envió: la API recorta espacios y pasa el email a minúsculas.
   */
  crear(datos: AlumnoRequest): Observable<Alumno> {
    return this.http.post<Alumno>(this.url, datos);
  }

  /** Actualización completa: la API espera el registro entero, no un parche. */
  actualizar(id: number, datos: AlumnoRequest): Observable<Alumno> {
    return this.http.put<Alumno>(`${this.url}/${id}`, datos);
  }
}
