import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Textos del paginador en español.
 *
 * Material los trae en inglés y no hay forma de traducirlos desde la plantilla:
 * el componente los lee de este servicio. Es un apaño hasta el Día 31 (i18n),
 * que traducirá la aplicación entera; mientras tanto evita que la única frase en
 * inglés de la pantalla sea justo la del pie de la tabla.
 *
 * Se provee **en cada componente de listado**, no en `app.config.ts`: importar
 * el paginador desde la configuración raíz lo metería en el bundle inicial, que
 * es el que carga la pantalla de login.
 */
export function paginadorEnEspanol(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Filas por página:';
  intl.nextPageLabel = 'Página siguiente';
  intl.previousPageLabel = 'Página anterior';
  intl.firstPageLabel = 'Primera página';
  intl.lastPageLabel = 'Última página';
  intl.getRangeLabel = (page, pageSize, length) => {
    if (length === 0 || pageSize === 0) {
      return '0 de 0';
    }
    const desde = page * pageSize;
    // El total puede quedarse corto si otro usuario borró registros mientras
    // tanto: sin este tope se vería "41 – 60 de 45".
    const hasta = Math.min(desde + pageSize, Math.max(length, desde));
    return `${desde + 1} – ${hasta} de ${length}`;
  };
  return intl;
}
