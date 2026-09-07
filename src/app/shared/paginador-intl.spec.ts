import { cambiarIdioma } from '../core/i18n/estado';
import { PaginadorIntl } from './paginador-intl';

describe('PaginadorIntl', () => {
  afterEach(() => cambiarIdioma('es'));

  it('traduce las etiquetas al español por defecto', () => {
    const intl = new PaginadorIntl();

    expect(intl.itemsPerPageLabel).toBe('Filas por página:');
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.previousPageLabel).toBe('Página anterior');
    expect(intl.firstPageLabel).toBe('Primera página');
    expect(intl.lastPageLabel).toBe('Última página');

    intl.ngOnDestroy();
  });

  it('cuenta el rango en base 1, que es como se lee', () => {
    const intl = new PaginadorIntl();
    // La página 0 del servidor es la primera para quien mira la tabla.
    expect(intl.getRangeLabel(0, 20, 300)).toBe('1 – 20 de 300');
    expect(intl.getRangeLabel(2, 20, 300)).toBe('41 – 60 de 300');
    intl.ngOnDestroy();
  });

  it('no promete más filas de las que hay en la última página', () => {
    const intl = new PaginadorIntl();
    // Sin el tope se leería "41 – 60 de 45": el rango diría que hay quince
    // registros que la tabla no está enseñando.
    expect(intl.getRangeLabel(2, 20, 45)).toBe('41 – 45 de 45');
    intl.ngOnDestroy();
  });

  it('dice 0 de 0 cuando no hay nada que contar', () => {
    const intl = new PaginadorIntl();
    expect(intl.getRangeLabel(0, 20, 0)).toBe('0 de 0');
    expect(intl.getRangeLabel(0, 0, 300)).toBe('0 de 0');
    intl.ngOnDestroy();
  });

  it('cada listado recibe su propia instancia', () => {
    const uno = new PaginadorIntl();
    const otro = new PaginadorIntl();
    expect(uno).not.toBe(otro);
    uno.ngOnDestroy();
    otro.ngOnDestroy();
  });

  it('cambia al inglés cuando cambia el idioma, y avisa por "changes"', () => {
    const intl = new PaginadorIntl();
    let avisos = 0;
    const suscripcion = intl.changes.subscribe(() => avisos++);

    cambiarIdioma('en');

    expect(intl.itemsPerPageLabel).toBe('Rows per page:');
    expect(intl.getRangeLabel(0, 20, 300)).toBe('1 – 20 of 300');
    expect(avisos).toBe(1);

    suscripcion.unsubscribe();
    intl.ngOnDestroy();
  });

  it('deja de escuchar cambios de idioma tras destruirse', () => {
    const intl = new PaginadorIntl();
    intl.ngOnDestroy();

    cambiarIdioma('en');

    // Sigue en español: la suscripción ya no estaba viva para actualizarlo.
    expect(intl.itemsPerPageLabel).toBe('Filas por página:');
  });
});
