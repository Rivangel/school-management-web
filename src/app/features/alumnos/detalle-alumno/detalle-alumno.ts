import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';

import { Alumno } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { ReporteService } from '../../../core/services/reporte-service';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { idDeRuta } from '../../../shared/id-de-ruta';

/**
 * Ficha de un alumno.
 *
 * Es la pantalla desde la que se borra, y no el listado a secas, porque borrar
 * desde una fila obliga a decidir sobre alguien de quien sólo se ven cinco
 * campos en una tabla. Aquí se está mirando a quien se va a eliminar.
 *
 * Comparte con el formulario el patrón de la ruta: el `?page=&size=&sort=` del
 * listado viaja en la URL, así que volver deja al usuario donde estaba.
 */
@Component({
  selector: 'app-detalle-alumno',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './detalle-alumno.html',
  styleUrl: './detalle-alumno.scss',
})
export class DetalleAlumno {
  private readonly alumnos = inject(AlumnoService);
  private readonly reportes = inject(ReporteService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly id = idDeRuta().id;
  protected readonly descargandoBoleta = signal(false);

  /**
   * `/alumnos/abc`: la dirección no apunta a ninguna ficha.
   *
   * Aquí basta con que no haya id — a diferencia del formulario, esta ruta no
   * tiene un modo "sin id" que valga la pena distinguir.
   */
  protected readonly idInvalido = computed(() => this.id() === undefined);

  private readonly recurso = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.alumnos.obtenerPorId(params),
  });

  /**
   * Se lee a través de `hasValue()` porque `value()` **lanza** con el recurso en
   * error: leerlo directo convierte un 404 en una excepción durante la detección
   * de cambios.
   */
  protected readonly alumno = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );

  protected readonly cargando = this.recurso.isLoading;
  protected readonly borrando = signal(false);
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  protected readonly error = computed(() => {
    const fallo = this.recurso.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar la ficha.');
  });

  protected reintentar(): void {
    this.recurso.reload();
  }

  /**
   * Pregunta antes de borrar, con el nombre dentro.
   *
   * La confirmación no es un trámite: nombrar a quien se va a eliminar es lo que
   * distingue "sí, a esta persona" de "sí, lo que sea que estuviera pulsando".
   */
  protected eliminar(): void {
    const alumno = this.alumno();
    if (alumno === undefined || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion = {
      titulo: 'Eliminar alumno',
      mensaje: `Se va a eliminar a ${nombreCompleto(alumno)} (${alumno.matricula}). Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };

    this.dialogo
      .open<Confirmar, DatosConfirmacion, boolean>(Confirmar, { data: datos })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado === true) {
          this.borrar(alumno);
        }
      });
  }

  /** Vuelve al listado tal y como estaba (`preserve` mantiene página y orden). */
  protected volver(): void {
    void this.router.navigate(['/alumnos'], { queryParamsHandling: 'preserve' });
  }

  protected descargarBoleta(alumnoId: number): void {
    if (this.descargandoBoleta()) {
      return;
    }
    this.descargandoBoleta.set(true);
    this.reportes.descargarBoleta(alumnoId).subscribe({
      next: (nombreArchivo) => {
        this.descargandoBoleta.set(false);
        this.avisos.exito(`Boleta descargada: ${nombreArchivo}`);
      },
      error: (err) => {
        this.descargandoBoleta.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo descargar la boleta en PDF.'));
      },
    });
  }

  private borrar(alumno: Alumno): void {
    this.borrando.set(true);
    this.alumnos.eliminar(alumno.id).subscribe({
      next: () => {
        this.avisos.exito(`Se eliminó a ${nombreCompleto(alumno)}.`);
        this.volver();
      },
      // El fallo lo cuenta el interceptor global; aquí sólo se reabre el botón.
      error: () => this.borrando.set(false),
    });
  }
}

function nombreCompleto(alumno: Alumno): string {
  return `${alumno.nombre} ${alumno.apellido}`;
}
