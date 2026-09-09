import { EMPTY, Observable, expand, reduce } from 'rxjs';

import { Pagina } from '../core/models';
import { ConsultaPagina } from '../core/paginacion';

/**
 * El mismo tope que `spring.data.web.pageable.max-page-size` en la API: pedir
 * más no trae más, lo recorta en silencio (ver `TAMANOS_PAGINA`).
 */
const TAMANO_POR_PETICION = 100;

/**
 * Trae **todas** las páginas de un listado, no sólo la que se está viendo.
 *
 * Hace falta para exportar: la tabla enseña una página de hasta cien filas,
 * pero un CSV que sólo llevara eso mentiría sobre lo que dice exportar. Como la
 * API no tiene un `?size=todo`, la única forma de traer el resto es pedir
 * página tras página con el mismo filtro y el mismo orden hasta que la propia
 * respuesta diga que ya no hay más (`last`).
 */
export function paginaCompleta<T, F extends object = Record<never, never>>(
  cargar: (consulta: ConsultaPagina & F) => Observable<Pagina<T>>,
  consulta: ConsultaPagina & F,
): Observable<T[]> {
  const primera = { ...consulta, page: 0, size: TAMANO_POR_PETICION };

  return cargar(primera).pipe(
    expand((pagina) => (pagina.last ? EMPTY : cargar({ ...primera, page: pagina.page + 1 }))),
    reduce<Pagina<T>, T[]>((acumulado, pagina) => [...acumulado, ...pagina.content], []),
  );
}
