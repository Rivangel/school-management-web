/**
 * Espejo de `PaginaResponse<T>`: el envoltorio de paginación de la API.
 *
 * La API devuelve este objeto en vez del `Page` de Spring Data justamente para
 * que el frontend pueda reflejarlo campo a campo sin depender de detalles
 * internos de Spring.
 */
export interface Pagina<T> {
  content: T[];
  /** Índice de página, empezando en 0. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/** Parámetros de listado que aceptan `/alumnos`, `/maestros` y `/materias`. */
export interface ParametrosPagina {
  page?: number;
  size?: number;
  /** Formato de Spring Data: `propiedad,asc` o `propiedad,desc`. */
  sort?: string;
}
