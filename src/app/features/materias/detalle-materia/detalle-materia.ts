import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';

import { Materia } from '../../../core/models';
import { ROLES_ESCRITURA, rolesDe } from '../../../core/navegacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MateriaService } from '../../../core/services/materia-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { idDeRuta } from '../../../shared/id-de-ruta';

/**
 * Ficha de una materia.
 *
 * Misma forma que las otras dos, con la trampa que ya avisó el Día 17 y que aquí
 * se cumple: **una materia con calificaciones o asistencias no se puede
 * borrar**. Es el segundo dominio que la sufre, y por segunda vez la explicación
 * se queda dentro de la tarjeta en vez de salir como aviso flotante.
 *
 * La consulta la puede todo el mundo —el ALUMNO incluido, que aquí ve qué
 * materias hay y quién las imparte—, así que las acciones de escritura y hasta
 * el enlace al maestro se deciden por rol.
 */
@Component({
  selector: 'app-detalle-materia',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './detalle-materia.html',
  styleUrl: './detalle-materia.scss',
})
export class DetalleMateria {
  private readonly materias = inject(MateriaService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly id = idDeRuta().id;

  /** `/materias/abc`: la dirección no apunta a ninguna ficha. */
  protected readonly idInvalido = computed(() => this.id() === undefined);

  private readonly recurso = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.materias.obtenerPorId(params),
  });

  /** Por `hasValue()`: `value()` **lanza** con el recurso en estado de error. */
  protected readonly materia = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );

  protected readonly cargando = this.recurso.isLoading;
  protected readonly borrando = signal(false);
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /**
   * Si el nombre del maestro puede ser un enlace a su ficha.
   *
   * El ALUMNO ve esta pantalla pero no la sección de maestros: para él el enlace
   * sería un viaje a "acceso denegado". Lee los roles de `MENU`, que es donde
   * los leen también el menú y el `rolGuard` de esa ruta.
   */
  protected readonly puedeVerAlMaestro = computed(() =>
    this.auth.tieneAlgunRol(...rolesDe('/maestros')),
  );

  protected readonly error = computed(() => {
    const fallo = this.recurso.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar la materia.');
  });

  /** Por qué no se pudo borrar. Se queda en la tarjeta, junto al botón. */
  protected readonly errorAlBorrar = signal<string | null>(null);

  protected reintentar(): void {
    this.recurso.reload();
  }

  /** Pregunta antes de borrar, nombrando la materia y a su maestro. */
  protected eliminar(): void {
    const materia = this.materia();
    if (materia === undefined || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion = {
      titulo: 'Eliminar materia',
      // El maestro es lo que distingue dos "Álgebra" en una lista: una materia
      // no tiene matrícula ni ningún otro identificador humano.
      mensaje: `Se va a eliminar ${materia.nombre} (${materia.maestroNombre}). Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    };

    this.dialogo
      .open<Confirmar, DatosConfirmacion, boolean>(Confirmar, { data: datos })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado === true) {
          this.borrar(materia);
        }
      });
  }

  /** Vuelve al listado tal y como estaba (`preserve` mantiene página y filtro). */
  protected volver(): void {
    void this.router.navigate(['/materias'], { queryParamsHandling: 'preserve' });
  }

  private borrar(materia: Materia): void {
    this.borrando.set(true);
    this.errorAlBorrar.set(null);
    this.materias.eliminar(materia.id).subscribe({
      next: () => {
        this.avisos.exito(`Se eliminó ${materia.nombre}.`);
        this.volver();
      },
      error: (fallo: unknown) => {
        this.borrando.set(false);
        this.errorAlBorrar.set(motivoDelFallo(fallo, materia));
      },
    });
  }
}

/**
 * Por qué falló el borrado, dicho en términos de la escuela.
 *
 * El 409 sale de las claves foráneas de `calificaciones.materia_id` y
 * `asistencias.materia_id`, ninguna de las dos anulable, y la API lo cuenta como
 * "la operación viola una restricción de datos (valor duplicado o referencia
 * inexistente)". A diferencia del maestro, aquí hay **dos** causas posibles y
 * desde el frontend no se distinguen: el mensaje las nombra a las dos en vez de
 * adivinar una, que sería mandar al usuario a buscar donde quizá no hay nada.
 */
function motivoDelFallo(fallo: unknown, materia: Materia): string {
  if (fallo instanceof HttpErrorResponse && fallo.status === 409) {
    return `No se puede eliminar ${materia.nombre}: tiene calificaciones o asistencias registradas. Elimínalas primero.`;
  }
  return mensajeDeError(fallo, 'No se pudo eliminar la materia.');
}
