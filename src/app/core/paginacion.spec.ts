import { convertToParamMap } from '@angular/router';

import { TAMANO_PAGINA, leerConsultaDeUrl, paramsDePagina, partirSort, sortDe } from './paginacion';

const ORDENABLES = ['matricula', 'apellido', 'nombre', 'grupo', 'email'];

const consultaDe = (query: Record<string, string>) =>
  leerConsultaDeUrl(convertToParamMap(query), ORDENABLES);

describe('paramsDePagina', () => {
  it('no manda nada cuando no se especifica nada', () => {
    expect(paramsDePagina({}).keys()).toEqual([]);
  });

  it('manda page, size y sort tal cual', () => {
    const params = paramsDePagina({ page: 2, size: 50, sort: 'apellido,desc' });

    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
    expect(params.get('sort')).toBe('apellido,desc');
  });

  it('manda page=0, que no es lo mismo que no mandarlo', () => {
    expect(paramsDePagina({ page: 0 }).get('page')).toBe('0');
  });

  it('omite un sort vacío en vez de mandar un criterio en blanco', () => {
    expect(paramsDePagina({ sort: '' }).has('sort')).toBe(false);
  });
});

describe('leerConsultaDeUrl', () => {
  it('sin query params usa la primera página y el tamaño por defecto', () => {
    expect(consultaDe({})).toEqual({ page: 0, size: TAMANO_PAGINA, sort: undefined });
  });

  it('lee la página, el tamaño y el orden de la URL', () => {
    expect(consultaDe({ page: '3', size: '50', sort: 'grupo,desc' })).toEqual({
      page: 3,
      size: 50,
      sort: 'grupo,desc',
    });
  });

  it.each(['-1', '1.5', 'dos', ''])('descarta una página inválida (%s)', (page) => {
    expect(consultaDe({ page }).page).toBe(0);
  });

  it('descarta un tamaño que no ofrece el selector', () => {
    // Un `size=5000` la API lo recorta en silencio a 100: el paginador creería
    // tener una sola página cuando en realidad hay muchas más.
    expect(consultaDe({ size: '5000' }).size).toBe(TAMANO_PAGINA);
  });

  it('descarta un orden por una propiedad que la API no conoce', () => {
    // La API responde 400 ante un `sort` desconocido, así que reenviarlo
    // convertiría una URL mal escrita en una pantalla de error.
    expect(consultaDe({ sort: 'promedio,asc' }).sort).toBeUndefined();
  });

  it('descarta una dirección de orden que no es asc ni desc', () => {
    expect(consultaDe({ sort: 'apellido,arriba' }).sort).toBeUndefined();
    expect(consultaDe({ sort: 'apellido' }).sort).toBeUndefined();
  });
});

describe('sortDe', () => {
  it('arma el formato de Spring Data', () => {
    expect(sortDe('apellido', 'desc')).toBe('apellido,desc');
  });

  it('sin dirección no hay orden: la tercera pulsada del encabezado lo limpia', () => {
    expect(sortDe('apellido', '')).toBeUndefined();
  });
});

describe('partirSort', () => {
  it('separa la propiedad de la dirección', () => {
    expect(partirSort('nombre,desc')).toEqual({ activo: 'nombre', direccion: 'desc' });
  });

  it('sin orden deja el encabezado sin marcar', () => {
    expect(partirSort(undefined)).toEqual({ activo: '', direccion: '' });
  });
});
