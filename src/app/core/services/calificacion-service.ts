import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Calificacion, CalificacionRequest } from '../models';

/**
 * Acceso a `/api/calificaciones`.
 *
 * Dos cosas lo separan de los servicios de los tres primeros dominios:
 *
 * - **No hay paginación.** Las consultas devuelven un arreglo, no una página:
 *   son las notas de un alumno o las de una materia, no un catálogo. Por eso no
 *   hay `ParametrosPagina` ni `listadoPaginado` en estas pantallas.
 * - **Registrar es un *upsert*.** El `POST` inserta o actualiza según ya exista
 *   una calificación para el mismo alumno, materia y periodo, y responde **201
 *   en los dos casos**: por el código de estado no se puede saber si se creó
 *   algo o se pisó una nota anterior. Quien llame tiene que decidir qué hacer
 *   con eso; ver `formulario-calificacion`.
 *
 * No hay `PUT` ni `DELETE` en la API: corregir una nota es volver a registrarla.
 */
@Injectable({ providedIn: 'root' })
export class CalificacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/calificaciones`;

  /**
   * Registra o corrige una calificación.
   *
   * La API responde 404 si el alumno o la materia no existen, y **403 si un
   * MAESTRO intenta calificar una materia que no imparte** — esa regla la
   * comprueba el servidor materia a materia, no el rol.
   */
  registrar(datos: CalificacionRequest): Observable<Calificacion> {
    return this.http.post<Calificacion>(this.url, datos, { context: sinAvisoGlobal() });
  }

  /** Las notas de un alumno. Un ALUMNO sólo puede pedir las suyas (403 si no). */
  listarPorAlumno(alumnoId: number): Observable<Calificacion[]> {
    return this.http.get<Calificacion[]>(`${this.url}/alumno/${alumnoId}`, {
      context: sinAvisoGlobal(),
    });
  }

  /** Las notas de una materia, de todos sus alumnos y periodos. */
  listarPorMateria(materiaId: number): Observable<Calificacion[]> {
    return this.http.get<Calificacion[]>(`${this.url}/materia/${materiaId}`, {
      context: sinAvisoGlobal(),
    });
  }
}
