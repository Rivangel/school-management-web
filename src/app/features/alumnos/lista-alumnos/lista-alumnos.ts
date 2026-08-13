import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';

import {
  ConsultaPagina,
  TAMANOS_PAGINA,
  leerConsultaDeUrl,
  partirSort,
  sortDe,
} from '../../../core/paginacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { paginadorEnEspanol } from '../../../shared/paginador-en-espanol';

/**
 * Columnas de la tabla, en orden. Los identificadores son los nombres de las
 * propiedades de la entidad porque son también los que acepta el `sort` de la
 * API: así la columna que se pulsa y el criterio que se manda no se pueden
 * desincronizar.
 */
const COLUMNAS = ['matricula', 'apellido', 'nombre', 'grupo', 'email'] as const;

/**
 * Listado paginado de alumnos.
 *
 * Paginación y ordenamiento son **del servidor**: la tabla dibuja la página que
 * llega y nada más. Por eso no hay `MatTableDataSource` — el que trae paginador y
 * ordenamiento propios sólo sabe rebanar el arreglo que ya tiene en memoria, y
 * con datos paginados acabaría paginando 20 filas de un total de 300.
 */
@Component({
  selector: 'app-lista-alumnos',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule,
  ],
  // Se provee aquí y no en `app.config.ts` para no meter el paginador de
  // Material en el bundle inicial, que es el que carga el login.
  providers: [{ provide: MatPaginatorIntl, useFactory: paginadorEnEspanol }],
  templateUrl: './lista-alumnos.html',
  styleUrl: './lista-alumnos.scss',
})
export class ListaAlumnos {
  private readonly alumnos = inject(AlumnoService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Copias mutables: las entradas de `matHeaderRowDef` y `pageSizeOptions` piden
  // `string[]` / `number[]`, y las constantes son tuplas `readonly`.
  protected readonly columnas: string[] = [...COLUMNAS];
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /**
   * Qué página y en qué orden, según la URL.
   *
   * El `equal` no es un detalle de rendimiento: el router reemite el mapa de
   * query params en **cada** navegación, y sin comparar los valores cualquier
   * navegación ajena (abrir la ficha de un alumno y volver) dispararía otro GET
   * idéntico.
   */
  protected readonly consulta = computed(() => leerConsultaDeUrl(this.query(), COLUMNAS), {
    equal: (uno, otro) =>
      uno.page === otro.page && uno.size === otro.size && uno.sort === otro.sort,
  });

  private readonly pagina = rxResource({
    params: () => this.consulta(),
    stream: ({ params }) => this.alumnos.listar(params),
  });

  /**
   * La página recibida, o `undefined` mientras no haya ninguna.
   *
   * Pasa por `hasValue()` porque `value()` **lanza** si el recurso está en
   * estado de error: leerlo directo desde la plantilla convierte un 500 de la
   * API en una excepción durante la detección de cambios.
   */
  private readonly resultado = computed(() =>
    this.pagina.hasValue() ? this.pagina.value() : undefined,
  );

  protected readonly cargando = this.pagina.isLoading;
  protected readonly filas = computed(() => this.resultado()?.content ?? []);
  protected readonly total = computed(() => this.resultado()?.totalElements ?? 0);
  protected readonly vacio = computed(() => this.resultado()?.totalElements === 0);

  protected readonly error = computed(() => {
    const fallo = this.pagina.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudo cargar el listado de alumnos.');
  });

  /**
   * Orden que marca el encabezado. Sin `sort` en la URL se enseña el de la API
   * (apellido ascendente), que es el que realmente se está viendo: dejar la
   * tabla sin marcar sugeriría un orden arbitrario.
   */
  protected readonly orden = computed(() => partirSort(this.consulta().sort ?? 'apellido,asc'));

  protected paginar(evento: PageEvent): void {
    this.irA({ page: evento.pageIndex, size: evento.pageSize });
  }

  /**
   * Cambiar el orden vuelve a la primera página: los registros se recolocan, así
   * que quedarse en la página 7 no enseña "lo mismo ordenado" y, si el listado
   * es corto, deja al usuario mirando una página vacía.
   */
  protected ordenar(evento: Sort): void {
    this.irA({ page: 0, sort: sortDe(evento.active, evento.direction) ?? null });
  }

  protected reintentar(): void {
    this.pagina.reload();
  }

  /** `null` borra el parámetro de la URL; `merge` conserva los que no se tocan. */
  private irA(cambios: Partial<Record<keyof ConsultaPagina, number | string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: cambios,
      queryParamsHandling: 'merge',
    });
  }
}
