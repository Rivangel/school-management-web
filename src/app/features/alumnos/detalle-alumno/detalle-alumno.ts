import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { t } from '../../../core/i18n/traducir';
import { Alumno } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { ReporteService } from '../../../core/services/reporte-service';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';

/** Lo que trae el diálogo al abrirse: el alumno cuya ficha se enseña. */
export interface DatosDetalleAlumno {
  readonly id: number;
}

/**
 * Con qué se cierra la ficha.
 *
 * `'editar'` es un pedido, no una confirmación: quien abrió esta ficha (el
 * listado) es quien sabe abrir el formulario de edición, así que la ficha se
 * limita a cerrarse y pedirlo. Abrir el formulario **desde aquí**, encima de
 * este diálogo, no tiene ninguna ventaja y complica quién refresca qué.
 */
export type ResultadoDetalleAlumno = 'editar' | undefined;

/**
 * Ficha de un alumno, en un diálogo.
 *
 * Es la pantalla desde la que se borra, y no el listado a secas, porque borrar
 * desde una fila obliga a decidir sobre alguien de quien sólo se ven cinco
 * campos en una tabla. Aquí se está mirando a quien se va a eliminar.
 *
 * El listado que la abre recarga siempre al cerrarse, haya cambiado algo o no:
 * es un `GET` de más a cambio de no tener que distinguir por qué se cerró.
 */
@Component({
  selector: 'app-detalle-alumno',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './detalle-alumno.html',
  styleUrl: './detalle-alumno.scss',
})
export class DetalleAlumno {
  private readonly alumnos = inject(AlumnoService);
  private readonly reportes = inject(ReporteService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly datos = inject<DatosDetalleAlumno>(MAT_DIALOG_DATA);
  protected readonly dialogoRef = inject(MatDialogRef<DetalleAlumno, ResultadoDetalleAlumno>);

  protected readonly t = t;

  protected readonly id = this.datos.id;
  protected readonly descargandoBoleta = signal(false);

  private readonly recurso = rxResource({
    params: () => this.id,
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
    return fallo === undefined ? null : mensajeDeError(fallo, t('alumnos.detalle.noSePudoCargar'));
  });

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
      titulo: t('alumnos.detalle.tituloEliminar'),
      mensaje: t('alumnos.detalle.mensajeEliminar', {
        nombre: nombreCompleto(alumno),
        matricula: alumno.matricula,
      }),
      confirmar: t('common.eliminar'),
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

  protected descargarBoleta(alumnoId: number): void {
    if (this.descargandoBoleta()) {
      return;
    }
    this.descargandoBoleta.set(true);
    this.reportes.descargarBoleta(alumnoId).subscribe({
      next: (nombreArchivo) => {
        this.descargandoBoleta.set(false);
        this.avisos.exito(t('alumnos.detalle.boletaDescargada', { nombreArchivo }));
      },
      error: (err) => {
        this.descargandoBoleta.set(false);
        this.avisos.error(mensajeDeError(err, t('alumnos.detalle.noSePudoDescargarBoleta')));
      },
    });
  }

  private borrar(alumno: Alumno): void {
    this.borrando.set(true);
    this.alumnos.eliminar(alumno.id).subscribe({
      next: () => {
        this.avisos.exito(t('alumnos.detalle.eliminado', { nombre: nombreCompleto(alumno) }));
        this.dialogoRef.close();
      },
      // El fallo lo cuenta el interceptor global; aquí sólo se reabre el botón.
      error: () => this.borrando.set(false),
    });
  }
}

function nombreCompleto(alumno: Alumno): string {
  return `${alumno.nombre} ${alumno.apellido}`;
}
