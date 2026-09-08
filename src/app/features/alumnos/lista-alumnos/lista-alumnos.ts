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
import { Alumno } from '../../../core/models';
import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { TAMANOS_PAGINA } from '../../../core/paginacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { PaginadorIntl } from '../../../shared/paginador-intl';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { seleccionDeFilas } from '../../../shared/seleccion';

/**
 * Columnas con datos, en orden. Los identificadores son los nombres de las
 * propiedades de la entidad porque son también los que acepta el `sort` de la
 * API: así la columna que se pulsa y el criterio que se manda no se pueden
 * desincronizar.
 *
 * La columna de selección queda **fuera** de esta lista a propósito: esto es
 * además lo que se acepta como `sort` en la URL, y `?sort=seleccion,asc` sería
 * un criterio que la API no conoce y devolvería como un 400.
 */
const ORDENABLES = ['matricula', 'apellido', 'nombre', 'grupo', 'email'] as const;

const abrirFormulario = () =>
  import('../formulario-alumno/formulario-alumno').then((m) => m.FormularioAlumno);
const abrirDetalle = () => import('../detalle-alumno/detalle-alumno').then((m) => m.DetalleAlumno);

/**
 * Listado paginado de alumnos.
 *
 * Paginación y ordenamiento son **del servidor**: la tabla dibuja la página que
 * llega y nada más. Por eso no hay `MatTableDataSource` — el que trae paginador y
 * ordenamiento propios sólo sabe rebanar el arreglo que ya tiene en memoria, y
 * con datos paginados acabaría paginando 20 filas de un total de 300.
 *
 * El estado (qué página, en qué orden, si cargó o falló) lo lleva
 * `listadoPaginado`, que lo comparte con las demás pantallas de listado.
 *
 * Alta, ficha y edición se abren como diálogo en vez de navegar a una pantalla
 * nueva: el listado nunca se desmonta, así que recargar la página tras guardar
 * o borrar es un `reintentar()`, no una navegación de vuelta.
 */
@Component({
  selector: 'app-lista-alumnos',
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
  templateUrl: './lista-alumnos.html',
  styleUrl: './lista-alumnos.scss',
})
export class ListaAlumnos {
  private readonly alumnos = inject(AlumnoService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);

  protected readonly t = t;

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'apellido,asc',
    cargar: (consulta) => this.alumnos.listar(consulta),
    mensajeDeFallo: () => t('alumnos.lista.noSePudoCargar'),
  });

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Ocultar no es proteger —la API rechaza igual el POST de un MAESTRO—, pero
   * enseñar un botón que lleva a "acceso denegado" es peor que no enseñarlo. Lee
   * la misma lista que el guard que protegía las rutas del formulario cuando
   * todavía eran rutas.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /**
   * La columna de selección sólo aparece para quien puede editar o borrar:
   * marcar filas no sirve de nada sin esas acciones, y enseñar casillas que no
   * llevan a ningún sitio es peor que no enseñarlas.
   */
  protected readonly columnas = computed<string[]>(() =>
    this.puedeEditar() ? ['seleccion', ...ORDENABLES] : [...ORDENABLES],
  );

  protected readonly seleccion = seleccionDeFilas<Alumno>();
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
    abrirFormulario().then((Formulario) =>
      this.abrirYRefrescar(this.dialogo.open(Formulario, { data: {} })),
    );
  }

  protected verDetalle(alumno: Alumno): void {
    abrirDetalle().then((Detalle) => {
      const referencia = this.dialogo.open(Detalle, { data: { id: alumno.id } });
      referencia.afterClosed().subscribe((resultado) => {
        this.seleccion.limpiar();
        this.listado.reintentar();
        // La ficha no abre el formulario ella misma: sólo pide que se abra,
        // ya cerrada, para no tener dos diálogos decidiendo quién refresca.
        if (resultado === 'editar') {
          this.editar(alumno.id);
        }
      });
    });
  }

  protected editarSeleccionado(): void {
    const [alumno] = this.seleccion.marcadas(this.listado.filas());
    if (alumno !== undefined) {
      this.editar(alumno.id);
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
            titulo: t('alumnos.lista.tituloEliminar'),
            mensaje: t('alumnos.lista.mensajeEliminar', {
              nombre: `${seleccionados[0].nombre} ${seleccionados[0].apellido}`,
            }),
            confirmar: t('common.eliminar'),
            peligro: true,
          }
        : {
            titulo: t('alumnos.lista.tituloEliminarVarios'),
            mensaje: t('alumnos.lista.mensajeEliminarVarios', { n: seleccionados.length }),
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
  private borrar(seleccionados: readonly Alumno[]): void {
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
        this.avisos.error(t('alumnos.lista.noSePudieronEliminarTodos'));
      } else {
        this.avisos.exito(
          seleccionados.length === 1
            ? t('alumnos.lista.eliminado')
            : t('alumnos.lista.eliminados', { n: seleccionados.length }),
        );
      }
    };

    for (const alumno of seleccionados) {
      this.alumnos.eliminar(alumno.id).subscribe({
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
