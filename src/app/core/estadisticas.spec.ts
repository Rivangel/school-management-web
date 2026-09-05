import {
  asistenciaPorMateria,
  barrasDeAsistencia,
  distribucionDeNotas,
  promedio,
  promedioPorMateria,
  resumenDeAsistencia,
} from './estadisticas';
import { Asistencia, Calificacion } from './models';

let siguienteId = 0;

function nota(materiaId: number, materiaNombre: string, calificacion: number): Calificacion {
  siguienteId += 1;
  return {
    id: siguienteId,
    alumnoId: 1,
    alumnoNombre: 'Ana López',
    materiaId,
    materiaNombre,
    calificacion,
    periodo: '2026-1',
  };
}

function registro(materiaId: number, materiaNombre: string, presente: boolean): Asistencia {
  siguienteId += 1;
  return {
    id: siguienteId,
    alumnoId: 1,
    alumnoNombre: 'Ana López',
    materiaId,
    materiaNombre,
    fecha: '2026-07-20',
    presente,
  };
}

describe('promedio', () => {
  it('es null sin notas, no cero: no es lo mismo un cero que no haber', () => {
    expect(promedio([])).toBeNull();
  });

  it('redondea a dos decimales', () => {
    expect(promedio([9.5, 8.7, 7.8])).toBe(8.67);
  });

  it('no arrastra el error binario de la suma', () => {
    expect(promedio([0.1, 0.2])).toBe(0.15);
  });
});

describe('promedioPorMateria', () => {
  it('agrupa por materia y ordena de mayor a menor', () => {
    const barras = promedioPorMateria([
      nota(1, 'Matemáticas I', 6),
      nota(2, 'Bases de Datos', 10),
      nota(1, 'Matemáticas I', 8),
    ]);

    expect(barras.map((barra) => barra.etiqueta)).toEqual(['Bases de Datos', 'Matemáticas I']);
    expect(barras[1].valor).toBe(7);
  });

  it('agrupa por id y no por nombre: dos materias pueden llamarse igual', () => {
    const barras = promedioPorMateria([nota(1, 'Taller', 4), nota(2, 'Taller', 10)]);

    expect(barras).toHaveLength(2);
    expect(barras.map((barra) => barra.valor)).toEqual([10, 4]);
  });

  it('desempata por nombre para que el orden no dependa del orden de llegada', () => {
    const barras = promedioPorMateria([nota(2, 'Química', 8), nota(1, 'Álgebra', 8)]);

    expect(barras.map((barra) => barra.etiqueta)).toEqual(['Álgebra', 'Química']);
  });

  it('escribe el valor con dos decimales fijos', () => {
    expect(promedioPorMateria([nota(1, 'Álgebra', 8)])[0].texto).toBe('8.00');
  });

  it('sin notas no hay barras', () => {
    expect(promedioPorMateria([])).toEqual([]);
  });
});

describe('distribucionDeNotas', () => {
  it('devuelve los cinco tramos aunque estén vacíos: el hueco es el dato', () => {
    const tramos = distribucionDeNotas([nota(1, 'Álgebra', 9)]);

    expect(tramos).toHaveLength(5);
    expect(tramos.map((tramo) => tramo.valor)).toEqual([0, 0, 0, 0, 1]);
  });

  it('coloca cada nota en su tramo, con los límites en el de arriba', () => {
    const tramos = distribucionDeNotas([
      nota(1, 'A', 5.9),
      nota(1, 'A', 6),
      nota(1, 'A', 6.9),
      nota(1, 'A', 7),
      nota(1, 'A', 8),
      nota(1, 'A', 9),
      nota(1, 'A', 10),
    ]);

    expect(tramos.map((tramo) => tramo.valor)).toEqual([1, 2, 1, 1, 2]);
  });

  it('un cero cae en el primer tramo', () => {
    expect(distribucionDeNotas([nota(1, 'A', 0)])[0].valor).toBe(1);
  });
});

describe('asistenciaPorMateria', () => {
  it('ordena de menor a mayor: la materia con faltas va primero', () => {
    const materias = asistenciaPorMateria([
      registro(1, 'Álgebra', true),
      registro(1, 'Álgebra', true),
      registro(2, 'Química', true),
      registro(2, 'Química', false),
    ]);

    expect(materias.map((materia) => materia.materiaNombre)).toEqual(['Química', 'Álgebra']);
    expect(materias[0].porcentaje).toBe(50);
    expect(materias[1].porcentaje).toBe(100);
  });

  it('cuenta presentes y total por materia', () => {
    const [quimica] = asistenciaPorMateria([
      registro(2, 'Química', false),
      registro(2, 'Química', false),
      registro(2, 'Química', true),
    ]);

    expect(quimica).toMatchObject({ presentes: 1, total: 3, porcentaje: 33.33 });
  });

  it('sin registros no hay materias', () => {
    expect(asistenciaPorMateria([])).toEqual([]);
  });
});

describe('barrasDeAsistencia', () => {
  it('escribe el porcentaje y el recuento que lo respalda', () => {
    const [barra] = barrasDeAsistencia([
      registro(1, 'Álgebra', true),
      registro(1, 'Álgebra', false),
    ]);

    expect(barra.valor).toBe(50);
    expect(barra.texto).toBe('50% (1/2)');
  });
});

describe('resumenDeAsistencia', () => {
  it('reparte el total entre presentes y ausentes', () => {
    expect(
      resumenDeAsistencia([
        registro(1, 'Álgebra', true),
        registro(1, 'Álgebra', false),
        registro(2, 'Química', true),
      ]),
    ).toEqual({ presentes: 2, ausentes: 1, total: 3, porcentaje: 66.67 });
  });

  it('sin registros el porcentaje es null, no cero: un 0% diría que se faltó a todo', () => {
    expect(resumenDeAsistencia([])).toEqual({
      presentes: 0,
      ausentes: 0,
      total: 0,
      porcentaje: null,
    });
  });
});
