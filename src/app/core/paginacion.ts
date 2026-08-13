import { HttpParams } from '@angular/common/http';
import { ParamMap } from '@angular/router';

import { ParametrosPagina } from './models';

/**
 * Tamaños de página que ofrece el selector.
 *
 * El tope es 100 porque la API recorta ahí (`spring.data.web.pageable.max-page-size`)
 * **en silencio**: pedir 500 no falla, devuelve 100 y el paginador se quedaría
 * calculando páginas que no existen.
 */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;

/** El mismo `size` que aplica la API cuando no se le manda ninguno. */
export const TAMANO_PAGINA = 20;

/** Consulta de listado ya resuelta: `page` y `size` siempre tienen valor. */
export interface ConsultaPagina extends ParametrosPagina {
  page: number;
  size: number;
}

/**
 * Traduce los parámetros de listado a query string.
 *
 * Lo que no se especifica **no se manda**, para que aplique el valor por defecto
 * de la API. Importa sobre todo con `sort`: mandarlo vacío no significa "el orden
 * de siempre", significa mandar un criterio de orden vacío.
 */
export function paramsDePagina(parametros: ParametrosPagina): HttpParams {
  let params = new HttpParams();
  if (parametros.page !== undefined) {
    params = params.set('page', parametros.page);
  }
  if (parametros.size !== undefined) {
    params = params.set('size', parametros.size);
  }
  if (parametros.sort !== undefined && parametros.sort !== '') {
    params = params.set('sort', parametros.sort);
  }
  return params;
}

/**
 * Lee la consulta de listado de los query params de la URL.
 *
 * La página vive en la URL y no en un signal del componente para que recargar
 * (F5), compartir el enlace o volver con el botón "atrás" caigan en la misma
 * página y el mismo orden. Al volver de la ficha de un alumno (Día 15) el
 * listado se reconstruye solo, sin guardar estado en ningún lado.
 *
 * A cambio, lo que llega es texto que cualquiera puede editar en la barra de
 * direcciones, así que se valida en vez de reenviarlo tal cual: un `page=-1` o
 * un `sort=cualquierCosa` los rechaza la API con un 400 y el usuario vería una
 * pantalla de error en lugar de un listado.
 *
 * @param ordenables propiedades por las que la API sabe ordenar (las columnas).
 */
export function leerConsultaDeUrl(query: ParamMap, ordenables: readonly string[]): ConsultaPagina {
  return {
    page: enteroNoNegativo(query.get('page')),
    size: tamanoValido(query.get('size')),
    sort: ordenValido(query.get('sort'), ordenables),
  };
}

/** Formato de orden de Spring Data: `propiedad,asc`. Sin dirección, no hay orden. */
export function sortDe(activo: string, direccion: string): string | undefined {
  return direccion === '' ? undefined : `${activo},${direccion}`;
}

/** Parte un `sort` en la propiedad y la dirección que espera `matSort`. */
export function partirSort(sort: string | undefined): {
  activo: string;
  direccion: 'asc' | 'desc' | '';
} {
  if (sort === undefined) {
    return { activo: '', direccion: '' };
  }
  const [activo, direccion] = sort.split(',');
  return { activo, direccion: direccion === 'desc' ? 'desc' : 'asc' };
}

function enteroNoNegativo(valor: string | null): number {
  const numero = Number(valor);
  return valor !== null && Number.isInteger(numero) && numero >= 0 ? numero : 0;
}

function tamanoValido(valor: string | null): number {
  const numero = Number(valor);
  return TAMANOS_PAGINA.some((tamano) => tamano === numero) ? numero : TAMANO_PAGINA;
}

function ordenValido(valor: string | null, ordenables: readonly string[]): string | undefined {
  if (valor === null) {
    return undefined;
  }
  const [propiedad, direccion] = valor.split(',');
  const aceptado = ordenables.includes(propiedad) && (direccion === 'asc' || direccion === 'desc');
  return aceptado ? `${propiedad},${direccion}` : undefined;
}
