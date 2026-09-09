import { Observable, of } from 'rxjs';

import { Pagina } from '../core/models';
import { ConsultaPagina } from '../core/paginacion';
import { paginaCompleta } from './pagina-completa';

interface Fila {
  readonly id: number;
}

function pagina(content: Fila[], page: number, last: boolean): Pagina<Fila> {
  return { content, page, size: 100, totalElements: 0, totalPages: 0, first: page === 0, last };
}

describe('paginaCompleta', () => {
  it('con una sola página, la devuelve tal cual', () => {
    const cargar = vi.fn((): Observable<Pagina<Fila>> => of(pagina([{ id: 1 }, { id: 2 }], 0, true)));

    let recibido: Fila[] | undefined;
    paginaCompleta(cargar, { page: 5, size: 20 }).subscribe((filas) => (recibido = filas));

    expect(recibido).toEqual([{ id: 1 }, { id: 2 }]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('encadena páginas hasta la que dice last y las concatena en orden', () => {
    const cargar = vi.fn((consulta: ConsultaPagina): Observable<Pagina<Fila>> => {
      if (consulta.page === 0) return of(pagina([{ id: 1 }, { id: 2 }], 0, false));
      if (consulta.page === 1) return of(pagina([{ id: 3 }, { id: 4 }], 1, false));
      return of(pagina([{ id: 5 }], 2, true));
    });

    let recibido: Fila[] | undefined;
    paginaCompleta(cargar, { page: 0, size: 100 }).subscribe((filas) => (recibido = filas));

    expect(recibido).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(cargar).toHaveBeenCalledTimes(3);
  });

  it('ignora la página y el tamaño de la consulta recibida: siempre empieza en 0 y pide el tope de la API', () => {
    const cargar = vi.fn((): Observable<Pagina<Fila>> => of(pagina([{ id: 1 }], 0, true)));

    paginaCompleta(cargar, { page: 7, size: 10 }).subscribe();

    expect(cargar).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 100 }));
  });

  it('conserva el filtro y el orden en cada página que pide', () => {
    interface Filtro {
      maestroId?: number;
    }
    const cargar = vi.fn((consulta: ConsultaPagina & Filtro): Observable<Pagina<Fila>> => {
      if (consulta.page === 0) return of(pagina([{ id: 1 }], 0, false));
      return of(pagina([{ id: 2 }], 1, true));
    });

    paginaCompleta(cargar, { page: 0, size: 20, sort: 'nombre,asc', maestroId: 3 }).subscribe();

    expect(cargar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sort: 'nombre,asc', maestroId: 3 }),
    );
    expect(cargar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sort: 'nombre,asc', maestroId: 3, page: 1 }),
    );
  });
});
