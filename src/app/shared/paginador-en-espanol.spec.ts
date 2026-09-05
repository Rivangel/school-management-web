import { paginadorEnEspanol } from './paginador-en-espanol';

describe('paginadorEnEspanol', () => {
  it('traduce las etiquetas que Material trae en inglés', () => {
    const intl = paginadorEnEspanol();

    expect(intl.itemsPerPageLabel).toBe('Filas por página:');
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.previousPageLabel).toBe('Página anterior');
    expect(intl.firstPageLabel).toBe('Primera página');
    expect(intl.lastPageLabel).toBe('Última página');
  });

  it('cuenta el rango en base 1, que es como se lee', () => {
    // La página 0 del servidor es la primera para quien mira la tabla.
    expect(paginadorEnEspanol().getRangeLabel(0, 20, 300)).toBe('1 – 20 de 300');
    expect(paginadorEnEspanol().getRangeLabel(2, 20, 300)).toBe('41 – 60 de 300');
  });

  it('no promete más filas de las que hay en la última página', () => {
    // Sin el tope se leería "41 – 60 de 45": el rango diría que hay quince
    // registros que la tabla no está enseñando.
    expect(paginadorEnEspanol().getRangeLabel(2, 20, 45)).toBe('41 – 45 de 45');
  });

  it('dice 0 de 0 cuando no hay nada que contar', () => {
    // Un listado vacío llega con `length` 0; sin este caso saldría "1 – 0 de 0".
    expect(paginadorEnEspanol().getRangeLabel(0, 20, 0)).toBe('0 de 0');
    expect(paginadorEnEspanol().getRangeLabel(0, 0, 300)).toBe('0 de 0');
  });

  it('cada listado recibe su propia instancia', () => {
    // Se provee por componente, no en `app.config.ts`: compartir la instancia
    // dejaría que una pantalla le cambiara los textos a las demás.
    expect(paginadorEnEspanol()).not.toBe(paginadorEnEspanol());
  });
});
