import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import { t } from '../../../core/i18n/traducir';
import { Maestro } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { TAMANOS_PAGINA } from '../../../core/paginacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MaestroService } from '../../../core/services/maestro-service';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { PaginadorIntl } from '../../../shared/paginador-intl';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { seleccionDeFilas } from '../../../shared/seleccion';

/**
 * Columnas con datos, en orden, que son también los `sort` que acepta la API.
 * El apellido va primero porque es por donde ordena la API por defecto y por
 * donde se busca a una persona en una lista.
 */
const ORDENABLES = ['apellido', 'nombre', 'especialidad', 'email'] as const;

const abrirFormulario = () =>
  import('../formulario-maestro/formulario-maestro').then((m) => m.FormularioMaestro);
const abrirDetalle = () =>
  import('../detalle-maestro/detalle-maestro').then((m) => m.DetalleMaestro);

/**
 * Listado paginado de maestros.
 *
 * Segunda pantalla del patrón que fijó el listado de alumnos: paginar y ordenar
 * son del servidor y el estado vive en la URL. Alta, ficha y edición se abren
 * como diálogo: el listado nunca se desmonta, así que recargar tras guardar o
 * borrar es un `reintentar()`, no una navegación de vuelta.
 */
@Component({
  selector: 'app-lista-maestros',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule,
  ],
  // Se provee aquí y no en `app.config.ts` para no meter el paginador de
  // Material en el bundle inicial, que es el que carga el login.
  providers: [{ provide: MatPaginatorIntl, useClass: PaginadorIntl }],
  templateUrl: './lista-maestros.html',
  styleUrl: './lista-maestros.scss',
})
export class ListaMaestros {
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);

  protected readonly t = t;

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'apellido,asc',
    cargar: (consulta) => this.maestros.listar(consulta),
    mensajeDeFallo: () => t('maestros.lista.noSePudoCargar'),
  });

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Ocultar no es proteger —la API rechaza igual el POST de un MAESTRO—, pero
   * enseñar un botón que lleva a "acceso denegado" es peor que no enseñarlo.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /** La columna de selección sólo aparece para quien puede editar o borrar. */
  protected readonly columnas = computed<string[]>(() =>
    this.puedeEditar() ? ['seleccion', ...ORDENABLES] : [...ORDENABLES],
  );

  protected readonly seleccion = seleccionDeFilas<Maestro>();
  protected readonly borrando = signal(false);

  constructor() {
    // Cambiar de página, orden o filtro deja atrás filas que ya no se ven: sin
    // esto la barra de acciones seguiría hablando de alguien que ya no está en
    // la tabla.
    effect(() => {
      this.listado.consulta();
      this.seleccion.limpiar();
    });
  }

  protected nuevo(): void {
    abrirFormulario().then((Formulario) => this.abrirYRefrescar(this.dialogo.open(Formulario, { data: {} })));
  }

  protected verDetalle(maestro: Maestro): void {
    abrirDetalle().then((Detalle) => {
      const referencia = this.dialogo.open(Detalle, { data: { id: maestro.id } });
      referencia.afterClosed().subscribe((resultado) => {
        this.seleccion.limpiar();
        this.listado.reintentar();
        if (resultado === 'editar') {
          this.editar(maestro.id);
        }
      });
    });
  }

  protected editarSeleccionado(): void {
    const [maestro] = this.seleccion.marcadas(this.listado.filas());
    if (maestro !== undefined) {
      this.editar(maestro.id);
    }
  }

  private editar(id: number): void {
    abrirFormulario().then((Formulario) =>
      this.abrirYRefrescar(this.dialogo.open(Formulario, { data: { id } })),
    );
  }

  protected eliminarSeleccionados(): void {
    const seleccionados = this.seleccion.marcadas(this.listado.filas());
    if (seleccionados.length === 0 || this.borrando()) {
      return;
    }

    const datos: DatosConfirmacion =
      seleccionados.length === 1
        ? {
            titulo: t('maestros.lista.tituloEliminar'),
            mensaje: t('maestros.lista.mensajeEliminar', {
              nombre: `${seleccionados[0].nombre} ${seleccionados[0].apellido}`,
            }),
            confirmar: t('common.eliminar'),
            peligro: true,
          }
        : {
            titulo: t('maestros.lista.tituloEliminarVarios'),
            mensaje: t('maestros.lista.mensajeEliminarVarios', { n: seleccionados.length }),
            confirmar: t('common.eliminar'),
            peligro: true,
          };

    this.dialogo
      .open<Confirmar, DatosConfirmacion, boolean>(Confirmar, { data: datos })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado === true) {
          this.borrar(seleccionados);
        }
      });
  }

  /**
   * Borra uno a uno y espera a que terminen todos.
   *
   * No usa `forkJoin`: con uno solo, si falla, se pierde de vista cuáles de los
   * demás sí se borraron. Aquí se cuenta cuántos terminaron y, al final,
   * `reintentar()` enseña el estado real de la tabla sea cual sea el resultado.
   */
  private borrar(seleccionados: readonly Maestro[]): void {
    this.borrando.set(true);
    let pendientes = seleccionados.length;
    let algunFallo = false;

    const terminar = () => {
      pendientes -= 1;
      if (pendientes > 0) {
        return;
      }
      this.borrando.set(false);
      this.seleccion.limpiar();
      this.listado.reintentar();
      if (algunFallo) {
        this.avisos.error(t('maestros.lista.noSePudieronEliminarTodos'));
      } else {
        this.avisos.exito(
          seleccionados.length === 1
            ? t('maestros.lista.eliminado')
            : t('maestros.lista.eliminados', { n: seleccionados.length }),
        );
      }
    };

    for (const maestro of seleccionados) {
      this.maestros.eliminar(maestro.id).subscribe({
        next: terminar,
        error: () => {
          algunFallo = true;
          terminar();
        },
      });
    }
  }

  private abrirYRefrescar(referencia: MatDialogRef<unknown, boolean>): void {
    referencia.afterClosed().subscribe(() => {
      this.seleccion.limpiar();
      this.listado.reintentar();
    });
  }
}
