import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ParamMap } from '@angular/router';

import { t } from '../../../core/i18n/traducir';
import { Materia } from '../../../core/models';
import { ROLES_ESCRITURA, rolesDe } from '../../../core/navegacion';
import { TAMANOS_PAGINA } from '../../../core/paginacion';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MaestroService } from '../../../core/services/maestro-service';
import { MateriaService } from '../../../core/services/materia-service';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { PaginadorIntl } from '../../../shared/paginador-intl';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';
import { seleccionDeFilas } from '../../../shared/seleccion';

/**
 * Columnas con datos, en orden, que son también los `sort` que acepta la API.
 *
 * `maestro.apellido` es una propiedad **anidada**: la API sabe ordenar por la
 * relación (`sort=maestro.apellido,asc`) y ordenar por `maestroNombre` —el campo
 * que de verdad se enseña— devolvería un 400, porque ese nombre lo compone el
 * DTO y no existe en la entidad.
 */
const ORDENABLES = ['nombre', 'creditos', 'maestro.apellido'] as const;

/** Cuántos maestros caben en el selector; es también el tope de la API. */
const MAESTROS_EN_EL_SELECTOR = 100;

/** El filtro que esta pantalla añade a la paginación de siempre. */
interface FiltroDeMaterias {
  maestroId?: number;
}

/**
 * Lee el filtro de la URL, validado.
 *
 * Un `maestroId` que no es un entero positivo se descarta en vez de viajar: la
 * API responde 400 a `?maestroId=abc`, y una dirección mal escrita se
 * convertiría en una pantalla de error en lugar de un listado.
 */
function leerFiltro(query: ParamMap): FiltroDeMaterias {
  const crudo = query.get('maestroId');
  if (crudo === null || !/^\d+$/.test(crudo) || Number(crudo) === 0) {
    return {};
  }
  return { maestroId: Number(crudo) };
}

const abrirFormulario = () =>
  import('../formulario-materia/formulario-materia').then((m) => m.FormularioMateria);
const abrirDetalle = () =>
  import('../detalle-materia/detalle-materia').then((m) => m.DetalleMateria);

/**
 * Listado paginado de materias, con filtro por maestro.
 *
 * Lo importante es dónde ocurre el filtrado: en la API, no aquí. Alta, ficha y
 * edición se abren como diálogo: el listado nunca se desmonta, así que
 * recargar tras guardar o borrar es un `reintentar()`, no una navegación de
 * vuelta.
 */
@Component({
  selector: 'app-lista-materias',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
  ],
  // Se provee aquí y no en `app.config.ts` para no meter el paginador de
  // Material en el bundle inicial, que es el que carga el login.
  providers: [{ provide: MatPaginatorIntl, useClass: PaginadorIntl }],
  templateUrl: './lista-materias.html',
  styleUrl: './lista-materias.scss',
})
export class ListaMaterias {
  private readonly materias = inject(MateriaService);
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);

  protected readonly t = t;

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'nombre,asc',
    leerFiltros: leerFiltro,
    cargar: (consulta) => this.materias.listar(consulta),
    mensajeDeFallo: () => t('materias.lista.noSePudoCargar'),
  });

  /**
   * Si esta sesión puede siquiera pedir la lista de maestros.
   *
   * El listado de materias lo ve **todo el mundo**, el de maestros no: la API lo
   * reserva a ADMIN y MAESTRO. Un ALUMNO que abriera esta pantalla se llevaba un
   * 403 silencioso —el servicio no avisa por su cuenta— y un desplegable vacío
   * con una sola opción, "Todos los maestros", que no filtra nada. Lee de
   * `MENU`, que es el espejo de `SecurityConfig`, y no una lista escrita aquí.
   */
  protected readonly puedeFiltrar = computed(() =>
    this.auth.tieneAlgunRol(...rolesDe('/maestros')),
  );

  /**
   * Los maestros que ofrece el selector.
   *
   * Se piden una sola vez y en una sola página: son la plantilla de una escuela,
   * no un catálogo. Con `params` en `undefined` el recurso **no pide nada**:
   * quien no puede leer maestros tampoco manda la petición que iba a volver
   * como 403.
   */
  private readonly recursoMaestros = rxResource({
    params: () => (this.puedeFiltrar() ? true : undefined),
    stream: () => this.maestros.listar({ size: MAESTROS_EN_EL_SELECTOR }),
  });

  protected readonly maestrosDelSelector = computed(() =>
    this.recursoMaestros.hasValue() ? this.recursoMaestros.value().content : [],
  );

  /** `null` es "todos": el `mat-select` no admite `undefined` como valor. */
  protected readonly maestroElegido = computed(() => this.listado.consulta().maestroId ?? null);

  protected readonly filtrando = computed(() => this.maestroElegido() !== null);

  protected filtrarPorMaestro(maestroId: number | null): void {
    this.listado.filtrar({ maestroId });
  }

  protected quitarFiltro(): void {
    this.filtrarPorMaestro(null);
  }

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Quién puede dar de alta, editar y borrar. Ocultar no es proteger —la API
   * rechaza igual el POST de un MAESTRO—, pero enseñar un botón que lleva a
   * "acceso denegado" es peor que no enseñarlo.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /** La columna de selección sólo aparece para quien puede editar o borrar. */
  protected readonly columnas = computed<string[]>(() =>
    this.puedeEditar() ? ['seleccion', ...ORDENABLES] : [...ORDENABLES],
  );

  protected readonly seleccion = seleccionDeFilas<Materia>();
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

  protected verDetalle(materia: Materia): void {
    abrirDetalle().then((Detalle) => {
      const referencia = this.dialogo.open(Detalle, { data: { id: materia.id } });
      referencia.afterClosed().subscribe((resultado) => {
        this.seleccion.limpiar();
        this.listado.reintentar();
        if (resultado === 'editar') {
          this.editar(materia.id);
        }
      });
    });
  }

  protected editarSeleccionado(): void {
    const [materia] = this.seleccion.marcadas(this.listado.filas());
    if (materia !== undefined) {
      this.editar(materia.id);
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
            titulo: t('materias.lista.tituloEliminar'),
            mensaje: t('materias.lista.mensajeEliminar', {
              nombre: seleccionados[0].nombre,
            }),
            confirmar: t('common.eliminar'),
            peligro: true,
          }
        : {
            titulo: t('materias.lista.tituloEliminarVarios'),
            mensaje: t('materias.lista.mensajeEliminarVarios', { n: seleccionados.length }),
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
   * Borra una a una y espera a que terminen todas.
   *
   * No usa `forkJoin`: con una sola, si falla, se pierde de vista cuáles de las
   * demás sí se borraron. Aquí se cuenta cuántas terminaron y, al final,
   * `reintentar()` enseña el estado real de la tabla sea cual sea el resultado.
   */
  private borrar(seleccionadas: readonly Materia[]): void {
    this.borrando.set(true);
    let pendientes = seleccionadas.length;
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
        this.avisos.error(t('materias.lista.noSePudieronEliminarTodas'));
      } else {
        this.avisos.exito(
          seleccionadas.length === 1
            ? t('materias.lista.eliminada')
            : t('materias.lista.eliminadas', { n: seleccionadas.length }),
        );
      }
    };

    for (const materia of seleccionadas) {
      this.materias.eliminar(materia.id).subscribe({
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
