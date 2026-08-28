import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';

export interface ReportePdf {
  readonly blob: Blob;
  readonly nombreArchivo: string;
}

/**
 * Dispara la descarga de un archivo Blob en el navegador.
 */
export function descargarArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

/**
 * Acceso a `/api/reportes`.
 *
 * Se encarga de solicitar reportes en formato PDF como Blob y ofrecer la
 * posibilidad de descargarlos con el nombre de archivo enviado por el servidor
 * en la cabecera `Content-Disposition`.
 */
@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reportes`;

  /**
   * Obtiene la boleta en PDF del alumno indicado.
   *
   * Lee la cabecera `Content-Disposition` para obtener el nombre del archivo
   * (p. ej. `boleta-A12345.pdf`), usando un respaldo si no viniera.
   */
  obtenerBoleta(alumnoId: number): Observable<ReportePdf> {
    return this.http
      .get(`${this.url}/boleta/${alumnoId}`, {
        observe: 'response',
        responseType: 'blob',
        context: sinAvisoGlobal(),
      })
      .pipe(
        map((respuesta) => {
          const disposition = respuesta.headers.get('Content-Disposition');
          let nombreArchivo = `boleta-${alumnoId}.pdf`;
          if (disposition) {
            const coincidencia = /filename="?([^";]+)"?/.exec(disposition);
            if (coincidencia && coincidencia[1]) {
              nombreArchivo = coincidencia[1];
            }
          }
          return {
            blob: respuesta.body ?? new Blob(),
            nombreArchivo,
          };
        }),
      );
  }

  /**
   * Pide la boleta y la descarga en el navegador.
   */
  descargarBoleta(alumnoId: number): Observable<string> {
    return this.obtenerBoleta(alumnoId).pipe(
      map((reporte) => {
        descargarArchivo(reporte.blob, reporte.nombreArchivo);
        return reporte.nombreArchivo;
      }),
    );
  }
}
