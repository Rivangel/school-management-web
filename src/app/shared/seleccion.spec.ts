import { seleccionDeFilas } from './seleccion';

interface Fila {
  readonly id: number;
}

const A: Fila = { id: 1 };
const B: Fila = { id: 2 };
const C: Fila = { id: 3 };

describe('seleccionDeFilas', () => {
  it('empieza sin nada marcado', () => {
    const seleccion = seleccionDeFilas<Fila>();

    expect(seleccion.cantidad()).toBe(0);
    expect(seleccion.estaMarcada(A)).toBe(false);
    expect(seleccion.marcadas([A, B])).toEqual([]);
  });

  it('alternar marca y desmarca por id', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternar(A);
    expect(seleccion.estaMarcada(A)).toBe(true);
    expect(seleccion.cantidad()).toBe(1);

    seleccion.alternar(A);
    expect(seleccion.estaMarcada(A)).toBe(false);
    expect(seleccion.cantidad()).toBe(0);
  });

  it('marcadas conserva el orden de las filas dadas, no el de selección', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternar(C);
    seleccion.alternar(A);

    expect(seleccion.marcadas([A, B, C])).toEqual([A, C]);
  });

  it('todasMarcadas y algunaMarcada', () => {
    const seleccion = seleccionDeFilas<Fila>();

    expect(seleccion.todasMarcadas([A, B])).toBe(false);
    expect(seleccion.algunaMarcada([A, B])).toBe(false);

    seleccion.alternar(A);
    expect(seleccion.todasMarcadas([A, B])).toBe(false);
    expect(seleccion.algunaMarcada([A, B])).toBe(true);

    seleccion.alternar(B);
    expect(seleccion.todasMarcadas([A, B])).toBe(true);
  });

  it('todasMarcadas es falso con la lista vacía, aunque no haya nada que marcar', () => {
    const seleccion = seleccionDeFilas<Fila>();

    expect(seleccion.todasMarcadas([])).toBe(false);
  });

  it('alternarTodas marca las que faltan; si ya estaban todas, las quita todas', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternarTodas([A, B]);
    expect(seleccion.todasMarcadas([A, B])).toBe(true);

    seleccion.alternarTodas([A, B]);
    expect(seleccion.cantidad()).toBe(0);
  });

  it('alternarTodas con una marcada a medias marca las que faltan, no las quita', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternar(A);
    seleccion.alternarTodas([A, B]);

    expect(seleccion.todasMarcadas([A, B])).toBe(true);
  });

  it('limpiar vacía la selección', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternar(A);
    seleccion.alternar(B);
    seleccion.limpiar();

    expect(seleccion.cantidad()).toBe(0);
  });

  it('selecciona por id: una fila distinta con el mismo id cuenta como marcada', () => {
    const seleccion = seleccionDeFilas<Fila>();

    seleccion.alternar(A);

    expect(seleccion.estaMarcada({ id: 1 })).toBe(true);
  });
});
