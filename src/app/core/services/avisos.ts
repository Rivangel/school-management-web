import { Injectable, Injector, inject } from '@angular/core';

/** Un acierto se lee de un vistazo; un fallo hay que leerlo entero. */
const DURACION_EXITO = 5000;
const DURACION_ERROR = 8000;

/**
 * Los avisos efímeros de la aplicación, en un solo sitio.
 *
 * Existe para que el mensaje de "guardado" o de "no se pudo" salga igual venga
 * de donde venga: de una pantalla, de un diálogo o del interceptor de errores,
 * que no tiene componente desde el que abrir nada.
 *
 * Va en `core/` y no en `shared/` porque no se dibuja: es estado de la
 * aplicación entera y hay uno solo.
 *
 * **`MatSnackBar` se carga bajo demanda a propósito.** Este servicio lo alcanza
 * el interceptor de errores, que se registra en `app.config.ts`, así que un
 * `import` normal mete el aviso y todo el overlay del CDK en el grafo inicial —
 * el que carga el login, que no enseña ninguno. Importarlo dentro del método lo
 * deja en su propio chunk, que se pide la primera vez que hay algo que decir.
 */
@Injectable({ providedIn: 'root' })
export class Avisos {
  private readonly inyector = inject(Injector);

  exito(mensaje: string): void {
    void this.abrir(mensaje, DURACION_EXITO, 'aviso--exito');
  }

  error(mensaje: string): void {
    void this.abrir(mensaje, DURACION_ERROR, 'aviso--error');
  }

  private async abrir(mensaje: string, duration: number, panelClass: string): Promise<void> {
    try {
      const { MatSnackBar } = await import('@angular/material/snack-bar');
      this.inyector.get(MatSnackBar).open(mensaje, 'Cerrar', { duration, panelClass });
    } catch {
      // Ignorar si el inyector fue destruido en un test antes de resolver el import efímero
    }
  }
}
