import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { Asistencia, AsistenciaRequest } from '../models';

/**
 * Acceso a `/api/asistencia`.
 *
 * Mismo trato que calificaciones —arreglos sin paginar, `POST` que hace *upsert*
 * (por alumno, materia y **fecha**) y ningún `PUT`— con una diferencia que se
 * paga al pasar lista: **no hay endpoint para registrar a un grupo entero de una
 * vez**. Cada alumno es una petición.
 */
@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/asistencia`;

  /**
   * Registra la asistencia de **un** alumno en una materia y fecha.
   *
   * Responde 403 si un MAESTRO la registra en una materia que no imparte, y 400
   * si la fecha es futura (`@PastOrPresent`).
   */
  registrar(datos: AsistenciaRequest): Observable<Asistencia> {
    return this.http.post<Asistencia>(this.url, datos, { context: sinAvisoGlobal() });
  }

  /** La asistencia de un alumno. Un ALUMNO sólo puede pedir la suya. */
  listarPorAlumno(alumnoId: number): Observable<Asistencia[]> {
    return this.http.get<Asistencia[]>(`${this.url}/alumno/${alumnoId}`, {
      context: sinAvisoGlobal(),
    });
  }

  /**
   * Lo ya registrado de una materia **en un día**.
   *
   * La fecha va como cadena ISO y no como `Date` a propósito: convertirla aquí
   * la reinterpretaría en la zona horaria del navegador, y una lista pasada el
   * día 20 podría viajar como del 19.
   */
  listarPorMateriaYFecha(materiaId: number, fecha: string): Observable<Asistencia[]> {
    return this.http.get<Asistencia[]>(`${this.url}/materia/${materiaId}`, {
      params: new HttpParams().set('fecha', fecha),
      context: sinAvisoGlobal(),
    });
  }
}
