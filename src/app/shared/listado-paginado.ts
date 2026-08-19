import { Signal, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import type { PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';

import { Pagina } from '../core/models';
import { ConsultaPagina, leerConsultaDeUrl, partirSort, sortDe } from '../core/paginacion';
import { mensajeDeError } from '../core/services/mensaje-error';

/** Lo que cambia de un listado a otro. Todo lo demás es igual en los cinco. */
export interface OpcionesListado<T> {
  /**
   * Propiedades por las que la API sabe ordenar, que son también las columnas
   * que se pueden pulsar. Es además la lista contra la que se valida el `sort`
   * que llega por la URL: lo que no esté aquí se descarta antes de viajar.
   */
  readonly ordenables: readonly string[];
  /**
   * El orden que aplica la API cuando no se le manda ninguno (`apellido,asc`).
   * Se usa sólo para marcar el encabezado, no se envía.
   */
  readonly ordenPorDefecto: string;
  /** La llamada al servicio del dominio. */
  readonly cargar: (consulta: ConsultaPagina) => Observable<Pagina<T>>;
  /** Qué decir si la petición falla sin explicación propia. */
  readonly mensajeDeFallo: string;
}

/** El estado que necesita una pantalla de listado, ya resuelto. */
export interface Listado<T> {
  /** Qué página y en qué orden, según la URL. */
  readonly consulta: Signal<ConsultaPagina>;
  readonly filas: Signal<T[]>;
  /** Total del servidor, no filas recibidas: es el `length` del paginador. */
  readonly total: Signal<number>;
  readonly vacio: Signal<boolean>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Columna y dirección que marca el encabezado. */
  readonly orden: Signal<{ activo: string; direccion: 'asc' | 'desc' | '' }>;
  paginar(evento: PageEvent): void;
  ordenar(evento: Sort): void;
  reintentar(): void;
}

/**
 * Estado de una pantalla de listado paginado por el servidor.
 *
 * Sale de `lista-alumnos` (Día 13) al llegar el segundo listado: de las ~120
 * líneas que tenía, lo único propio del dominio eran el nombre del servicio, las
 * columnas y el texto del error. Lo demás —leer la URL, no repetir la petición
 * cuando el router reemite sus params, ordenar volviendo a la página 0, corregir
 * una página fuera de rango— es la clase de detalle que se copia mal: basta que
 * una pantalla se deje el `equal` del `computed` para que pida cada página dos
 * veces, y nada lo delataría a simple vista.
 *
 * Se llama desde el inicializador de un campo del componente, porque usa
 * `inject()` y `effect()` y necesita contexto de inyección.
 *
 * Lo que **no** hace: dibujar. Cada pantalla pone sus columnas, su cabecera y
 * sus acciones, que es justo donde los listados se diferencian de verdad.
 */
export function listadoPaginado<T>(opciones: OpcionesListado<T>): Listado<T> {
  const ruta = inject(ActivatedRoute);
  const router = inject(Router);

  const query = toSignal(ruta.queryParamMap, { initialValue: ruta.snapshot.queryParamMap });

  // El `equal` no es un detalle de rendimiento: el router reemite el mapa de
  // query params en **cada** navegación, y sin comparar los valores cualquier
  // navegación ajena (abrir una ficha y volver) dispararía otro GET idéntico.
  const consulta = computed(() => leerConsultaDeUrl(query(), opciones.ordenables), {
    equal: (uno, otro) =>
      uno.page === otro.page && uno.size === otro.size && uno.sort === otro.sort,
  });

  const pagina = rxResource({
    params: () => consulta(),
    stream: ({ params }) => opciones.cargar(params),
  });

  // Pasa por `hasValue()` porque `value()` **lanza** si el recurso está en
  // estado de error: leerlo directo desde la plantilla convierte un 500 de la
  // API en una excepción durante la detección de cambios.
  const resultado = computed(() => (pagina.hasValue() ? pagina.value() : undefined));

  /** `null` borra el parámetro de la URL; `merge` conserva los que no se tocan. */
  const irA = (cambios: Partial<Record<keyof ConsultaPagina, number | string | null>>): void => {
    void router.navigate([], {
      relativeTo: ruta,
      queryParams: cambios,
      queryParamsHandling: 'merge',
    });
  };

  // Una página vacía por encima de la última suele venir de un borrado: se
  // vuelve de la ficha a `?page=4` y ya sólo quedan cuatro páginas. Corregirlo
  // aquí cubre además el `?page=99` escrito a mano, que si no deja la tabla en
  // blanco sin explicar nada.
  effect(() => {
    const recibida = resultado();
    if (recibida === undefined || recibida.content.length > 0) {
      return;
    }

    const ultima = Math.max(recibida.totalPages - 1, 0);
    if (recibida.page > ultima) {
      irA({ page: ultima });
    }
  });

  return {
    consulta,
    cargando: pagina.isLoading,
    filas: computed(() => resultado()?.content ?? []),
    total: computed(() => resultado()?.totalElements ?? 0),
    vacio: computed(() => resultado()?.totalElements === 0),
    error: computed(() => {
      const fallo = pagina.error();
      return fallo === undefined ? null : mensajeDeError(fallo, opciones.mensajeDeFallo);
    }),
    // Sin `sort` en la URL se enseña el de la API, que es el que realmente se
    // está viendo: dejar la tabla sin marcar sugeriría un orden arbitrario.
    orden: computed(() => partirSort(consulta().sort ?? opciones.ordenPorDefecto)),

    paginar: (evento) => irA({ page: evento.pageIndex, size: evento.pageSize }),

    // Cambiar el orden vuelve a la primera página: los registros se recolocan,
    // así que quedarse en la página 7 no enseña "lo mismo ordenado" y, si el
    // listado es corto, deja al usuario mirando una página vacía.
    ordenar: (evento) => irA({ page: 0, sort: sortDe(evento.active, evento.direction) ?? null }),

    reintentar: () => pagina.reload(),
  };
}
