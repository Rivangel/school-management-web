import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { t } from '../../../core/i18n/traducir';
import { Maestro } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MaestroService } from '../../../core/services/maestro-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';

/** Lo que trae el diálogo al abrirse: el maestro cuya ficha se enseña. */
export interface DatosDetalleMaestro {
  readonly id: number;
}

/**
 * `'editar'` es un pedido, no una confirmación: quien abrió esta ficha (el
 * listado) es quien sabe abrir el formulario de edición.
 */
export type ResultadoDetalleMaestro = 'editar' | undefined;

/**
 * Ficha de un maestro, en un diálogo.
 *
 * Misma forma que la de alumnos —se borra desde aquí y no desde una fila,
 * porque decidir sobre alguien de quien sólo se ven cuatro columnas es fácil
 * de hacer mal— con una diferencia que impone la base de datos: **un maestro
 * con materias a su cargo no se puede eliminar**, y ese caso lo explica esta
 * pantalla en vez de dejarlo al aviso global.
 *
 * El listado que la abre recarga siempre al cerrarse, haya cambiado algo o no.
 */
@Component({
  selector: 'app-detalle-maestro',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  templateUrl: './detalle-maestro.html',
  styleUrl: './detalle-maestro.scss',
})
export class DetalleMaestro {
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly datos = inject<DatosDetalleMaestro>(MAT_DIALOG_DATA);
  protected readonly dialogoRef = inject(MatDialogRef<DetalleMaestro, ResultadoDetalleMaestro>);

  protected readonly t = t;

  protected readonly id = this.datos.id;

  private readonly recurso = rxResource({
    params: () => this.id,
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
    return fallo === undefined ? null : mensajeDeError(fallo, t('maestros.detalle.noSePudoCargar'));
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

  /** Pregunta antes de borrar, nombrando al maestro y su especialidad. */
  protected eliminar(): void {
    const maestro = this.maestro();
    if (maestro === undefined || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion = {
      titulo: t('maestros.detalle.tituloEliminar'),
      mensaje: t('maestros.detalle.mensajeEliminar', {
        nombre: nombreCompleto(maestro),
        especialidad: maestro.especialidad,
      }),
      confirmar: t('common.eliminar'),
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

  private borrar(maestro: Maestro): void {
    this.borrando.set(true);
    this.errorAlBorrar.set(null);
    this.maestros.eliminar(maestro.id).subscribe({
      next: () => {
        this.avisos.exito(t('maestros.detalle.eliminado', { nombre: nombreCompleto(maestro) }));
        this.dialogoRef.close();
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
    return t('maestros.detalle.noSePudoEliminarTieneMaterias', { nombre: nombreCompleto(maestro) });
  }
  return mensajeDeError(fallo, t('maestros.detalle.noSePudoEliminar'));
}
