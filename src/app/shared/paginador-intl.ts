import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { t } from '../core/i18n/traducir';
import { idiomaCambio$ } from '../core/i18n/estado';

/**
 * Textos del paginador de Material en el idioma actual.
 *
 * Material los trae sólo en inglés y no hay forma de traducirlos desde la
 * plantilla: el componente los lee de este servicio, y sólo sabe volver a
 * pintarlos cuando su `changes` emite. Por eso no basta con leer `t()` una vez
 * en el constructor — hay que releerlo y avisar cada vez que cambie el
 * idioma, y no hay un signal que Angular pueda rastrear aquí dentro (esto no
 * es una plantilla ni un `computed`), así que la suscripción a `idiomaCambio$`
 * hace ese trabajo a mano.
 *
 * Se provee **en cada componente de listado**, no en `app.config.ts`: importar
 * el paginador desde la configuración raíz lo metería en el bundle inicial, que
 * es el que carga la pantalla de login.
 */
@Injectable()
export class PaginadorIntl extends MatPaginatorIntl {
  private readonly suscripcion = idiomaCambio$.subscribe(() => {
    this.actualizar();
    this.changes.next();
  });

  constructor() {
    super();
    this.actualizar();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 ${t('paginador.de')} 0`;
    }
    const desde = page * pageSize;
    // El total puede quedarse corto si otro usuario borró registros mientras
    // tanto: sin este tope se vería "41 – 60 de 45".
    const hasta = Math.min(desde + pageSize, Math.max(length, desde));
    return `${desde + 1} – ${hasta} ${t('paginador.de')} ${length}`;
  };

  /** Se llama al construir y cada vez que cambia el idioma. */
  private actualizar(): void {
    this.itemsPerPageLabel = t('paginador.filasPorPagina');
    this.nextPageLabel = t('paginador.paginaSiguiente');
    this.previousPageLabel = t('paginador.paginaAnterior');
    this.firstPageLabel = t('paginador.primeraPagina');
    this.lastPageLabel = t('paginador.ultimaPagina');
  }

  /** Angular la llama al destruir el componente que la provee: sin esto la
   * suscripción sobreviviría a la pantalla que la abrió. */
  ngOnDestroy(): void {
    this.suscripcion.unsubscribe();
  }
}
