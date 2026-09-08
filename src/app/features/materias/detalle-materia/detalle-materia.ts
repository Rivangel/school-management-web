import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { t } from '../../../core/i18n/traducir';
import { Materia } from '../../../core/models';
import {
  ROLES_ESCRITURA,
  ROLES_NOTAS_DE_MATERIA,
  ROLES_REGISTRO,
  rolesDe,
} from '../../../core/navegacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MiMaestro } from '../../../core/services/mi-maestro';
import { MateriaService } from '../../../core/services/materia-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import type { DatosDetalleMaestro, DetalleMaestro } from '../../maestros/detalle-maestro/detalle-maestro';

/** Lo que trae el diálogo al abrirse: la materia cuya ficha se enseña. */
export interface DatosDetalleMateria {
  readonly id: number;
}

/**
 * `'editar'` es un pedido, no una confirmación: quien abrió esta ficha (el
 * listado) es quien sabe abrir el formulario de edición.
 */
export type ResultadoDetalleMateria = 'editar' | undefined;

const abrirDetalleMaestro = () =>
  import('../../maestros/detalle-maestro/detalle-maestro').then((m) => m.DetalleMaestro);

/**
 * Ficha de una materia, en un diálogo.
 *
 * Misma forma que las otras dos, con la trampa que ya avisó el listado:
 * **una materia con calificaciones o asistencias no se puede borrar**. La
 * consulta la puede todo el mundo —el ALUMNO incluido—, así que las acciones
 * de escritura y hasta el enlace al maestro se deciden por rol.
 *
 * El enlace al maestro abre su ficha en un diálogo **encima** de éste, en vez
 * de navegar: cerrar esta ficha para ver la de al lado sería perder de vista
 * la materia que se estaba mirando.
 */
@Component({
  selector: 'app-detalle-materia',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './detalle-materia.html',
  styleUrl: './detalle-materia.scss',
})
export class DetalleMateria {
  private readonly materias = inject(MateriaService);
  private readonly auth = inject(AuthService);
  private readonly miMaestro = inject(MiMaestro);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly datos = inject<DatosDetalleMateria>(MAT_DIALOG_DATA);
  protected readonly dialogoRef = inject(MatDialogRef<DetalleMateria, ResultadoDetalleMateria>);

  protected readonly t = t;

  protected readonly id = this.datos.id;

  private readonly recurso = rxResource({
    params: () => this.id,
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
   * El ALUMNO ve esta pantalla pero no la sección de maestros: para él el
   * enlace sería un viaje a "acceso denegado". Lee los roles de `MENU`, que es
   * donde los leen también el menú y el guard de esa ruta.
   */
  protected readonly puedeVerAlMaestro = computed(() =>
    this.auth.tieneAlgunRol(...rolesDe('/maestros')),
  );

  /**
   * Quién puede ver las notas de esta materia. El ALUMNO ve esta ficha —qué
   * materia es y quién la imparte— pero no las calificaciones de su grupo.
   */
  protected readonly puedeVerCalificaciones = computed(() =>
    this.auth.tieneAlgunRol(...ROLES_NOTAS_DE_MATERIA),
  );

  /**
   * Pasar lista **de esta materia**, que no es lo mismo que poder pasar lista.
   *
   * `ROLES_REGISTRO` dice que un MAESTRO registra; no dice en cuál. La API sólo
   * le deja hacerlo en las materias que imparte y responde 403 en las demás, así
   * que enseñar el botón en la materia de un compañero es ofrecer un error con
   * forma de botón. El ADMIN sí puede en cualquiera. Ver `MiMaestro`.
   */
  protected readonly puedePasarLista = computed(() =>
    this.miMaestro.puedeRegistrarEn(this.materia()?.maestroId),
  );

  /** Si esta materia es de quien la está mirando. Sólo para decirlo en la ficha. */
  protected readonly esMiMateria = computed(() => this.miMaestro.esMia(this.materia()?.maestroId));

  /** Para explicar la ausencia del botón sólo a quien le aplica la regla. */
  protected readonly esMaestro = computed(() => this.auth.rol() === 'MAESTRO');

  protected readonly error = computed(() => {
    const fallo = this.recurso.error();
    return fallo === undefined ? null : mensajeDeError(fallo, t('materias.detalle.noSePudoCargar'));
  });

  /** Por qué no se pudo borrar. Se queda en la tarjeta, junto al botón. */
  protected readonly errorAlBorrar = signal<string | null>(null);

  protected reintentar(): void {
    this.recurso.reload();
  }

  protected cerrar(): void {
    this.dialogoRef.close();
  }

  /** Pide al listado que abra la edición: cierra y se lo deja a quien la abrió. */
  protected editar(): void {
    this.dialogoRef.close('editar');
  }

  /** Abre la ficha del maestro encima de ésta. No hace falta cerrar la de aquí. */
  protected verAlMaestro(maestroId: number): void {
    abrirDetalleMaestro().then((Detalle) => {
      this.dialogo.open<DetalleMaestro, DatosDetalleMaestro, unknown>(Detalle, {
        data: { id: maestroId },
      });
    });
  }

  /** Pregunta antes de borrar, nombrando la materia y a su maestro. */
  protected eliminar(): void {
    const materia = this.materia();
    if (materia === undefined || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion = {
      titulo: t('materias.detalle.tituloEliminar'),
      // El maestro es lo que distingue dos "Álgebra" en una lista: una materia
      // no tiene matrícula ni ningún otro identificador humano.
      mensaje: t('materias.detalle.mensajeEliminar', {
        nombre: materia.nombre,
        maestroNombre: materia.maestroNombre,
      }),
      confirmar: t('common.eliminar'),
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

  private borrar(materia: Materia): void {
    this.borrando.set(true);
    this.errorAlBorrar.set(null);
    this.materias.eliminar(materia.id).subscribe({
      next: () => {
        this.avisos.exito(t('materias.detalle.eliminada', { nombre: materia.nombre }));
        this.dialogoRef.close();
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
    return t('materias.detalle.noSePudoEliminarTieneRegistros', { nombre: materia.nombre });
  }
  return mensajeDeError(fallo, t('materias.detalle.noSePudoEliminar'));
}
