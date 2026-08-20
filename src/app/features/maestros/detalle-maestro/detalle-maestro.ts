import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';

import { Maestro } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MaestroService } from '../../../core/services/maestro-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { idDeRuta } from '../../../shared/id-de-ruta';

/**
 * Ficha de un maestro.
 *
 * Misma forma que la de alumnos —se borra desde aquí y no desde una fila, porque
 * decidir sobre alguien de quien sólo se ven cuatro columnas es fácil de hacer
 * mal— con una diferencia que impone la base de datos: **un maestro con materias
 * a su cargo no se puede eliminar**, y ese caso lo explica esta pantalla en vez
 * de dejarlo al aviso global.
 */
@Component({
  selector: 'app-detalle-maestro',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './detalle-maestro.html',
  styleUrl: './detalle-maestro.scss',
})
export class DetalleMaestro {
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly id = idDeRuta().id;

  /** `/maestros/abc`: la dirección no apunta a ninguna ficha. */
  protected readonly idInvalido = computed(() => this.id() === undefined);

  private readonly recurso = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.maestros.obtenerPorId(params),
  });

  /** Por `hasValue()`: `value()` **lanza** con el recurso en estado de error. */
  protected readonly maestro = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );

  protected readonly cargando = this.recurso.isLoading;
  protected readonly borrando = signal(false);
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  protected readonly error = computed(() => {
    const fallo = this.recurso.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar la ficha.');
  });

  /** Por qué no se pudo borrar. Se queda en la tarjeta, junto al botón. */
  protected readonly errorAlBorrar = signal<string | null>(null);

  protected reintentar(): void {
    this.recurso.reload();
  }

  /** Pregunta antes de borrar, nombrando al maestro y su especialidad. */
  protected eliminar(): void {
    const maestro = this.maestro();
    if (maestro === undefined || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion = {
      titulo: 'Eliminar maestro',
      mensaje: `Se va a eliminar a ${nombreCompleto(maestro)} (${maestro.especialidad}). Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };

    this.dialogo
      .open<Confirmar, DatosConfirmacion, boolean>(Confirmar, { data: datos })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado === true) {
          this.borrar(maestro);
        }
      });
  }

  /** Vuelve al listado tal y como estaba (`preserve` mantiene página y orden). */
  protected volver(): void {
    void this.router.navigate(['/maestros'], { queryParamsHandling: 'preserve' });
  }

  private borrar(maestro: Maestro): void {
    this.borrando.set(true);
    this.errorAlBorrar.set(null);
    this.maestros.eliminar(maestro.id).subscribe({
      next: () => {
        this.avisos.exito(`Se eliminó a ${nombreCompleto(maestro)}.`);
        this.volver();
      },
      error: (fallo: unknown) => {
        this.borrando.set(false);
        this.errorAlBorrar.set(motivoDelFallo(fallo, maestro));
      },
    });
  }
}

function nombreCompleto(maestro: Maestro): string {
  return `${maestro.nombre} ${maestro.apellido}`;
}

/**
 * Por qué falló el borrado, dicho en términos de la escuela.
 *
 * El 409 llega de la restricción de clave foránea de `materias.maestro_id`, que
 * no admite nulos, y la API lo cuenta como "la operación viola una restricción
 * de datos (valor duplicado o referencia inexistente)": es exacto y no le sirve
 * a nadie. La única forma de provocarlo desde aquí es que el maestro imparta
 * alguna materia, así que la pantalla lo dice con esas palabras y explica qué
 * hacer.
 */
function motivoDelFallo(fallo: unknown, maestro: Maestro): string {
  if (fallo instanceof HttpErrorResponse && fallo.status === 409) {
    return `No se puede eliminar a ${nombreCompleto(maestro)}: tiene materias a su cargo. Asígnalas a otro maestro o elimínalas primero.`;
  }
  return mensajeDeError(fallo, 'No se pudo eliminar al maestro.');
}
