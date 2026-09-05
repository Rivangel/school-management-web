import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Alumno, Asistencia, Calificacion, Materia, Pagina } from '../../core/models';
import { AlumnoService } from '../../core/services/alumno-service';
import { AsistenciaService } from '../../core/services/asistencia-service';
import { AuthService } from '../../core/services/auth-service';
import { CalificacionService } from '../../core/services/calificacion-service';
import { MaestroService } from '../../core/services/maestro-service';
import { MateriaService } from '../../core/services/materia-service';
import { Home } from './home';

function pagina<T>(content: T[], totalElements = content.length): Pagina<T> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: 1,
    first: true,
    last: true,
  };
}

function materia(id: number, nombre: string): Materia {
  return { id, nombre, creditos: 8, maestroId: 1, maestroNombre: 'Juan Pérez' };
}

function nota(materiaId: number, materiaNombre: string, calificacion: number): Calificacion {
  return {
    id: materiaId * 100 + calificacion,
    alumnoId: 1,
    alumnoNombre: 'Ana López',
    materiaId,
    materiaNombre,
    calificacion,
    periodo: '2026-1',
  };
}

function asistencia(materiaId: number, materiaNombre: string, presente: boolean): Asistencia {
  return {
    id: materiaId * 10 + (presente ? 1 : 0),
    alumnoId: 1,
    alumnoNombre: 'Ana López',
    materiaId,
    materiaNombre,
    fecha: '2026-07-20',
    presente,
  };
}

const MI_FICHA: Alumno = {
  id: 1,
  nombre: 'Ana',
  apellido: 'López',
  matricula: 'A2026001',
  email: 'ana.lopez@escuela.com',
  grupo: 'A',
};

describe('Home Component', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let alumnoService: AlumnoService;
  let maestroService: MaestroService;
  let materiaService: MateriaService;
  let authService: AuthService;
  let calificacionService: CalificacionService;
  let asistenciaService: AsistenciaService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    alumnoService = TestBed.inject(AlumnoService);
    maestroService = TestBed.inject(MaestroService);
    materiaService = TestBed.inject(MateriaService);
    authService = TestBed.inject(AuthService);
    calificacionService = TestBed.inject(CalificacionService);
    asistenciaService = TestBed.inject(AsistenciaService);
  });

  /** Monta el componente ya con los cambios aplicados. */
  function montar(): Home {
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  it('se crea correctamente', () => {
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('muestra conteos de alumnos, maestros y materias para ADMIN o MAESTRO', () => {
    vi.spyOn(authService, 'rol').mockReturnValue('ADMIN');
    vi.spyOn(alumnoService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 42, totalPages: 42, first: true, last: false }),
    );
    vi.spyOn(maestroService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 12, totalPages: 12, first: true, last: false }),
    );
    vi.spyOn(materiaService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 8, totalPages: 8, first: true, last: false }),
    );

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['totalAlumnos']()).toBe(42);
    expect(component['totalMaestros']()).toBe(12);
    expect(component['totalMaterias']()).toBe(8);
  });

  it('solo consulta materias y omite alumnos/maestros para ALUMNO', () => {
    vi.spyOn(authService, 'rol').mockReturnValue('ALUMNO');
    const spyAlumnos = vi.spyOn(alumnoService, 'listar');
    const spyMaestros = vi.spyOn(maestroService, 'listar');
    vi.spyOn(materiaService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 5, totalPages: 5, first: true, last: false }),
    );

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(spyAlumnos).not.toHaveBeenCalled();
    expect(spyMaestros).not.toHaveBeenCalled();
    expect(component['totalMaterias']()).toBe(5);
    expect(component['totalAlumnos']()).toBeNull();
    expect(component['totalMaestros']()).toBeNull();
  });

  it('maneja el error cuando falla la carga de conteos', () => {
    vi.spyOn(authService, 'rol').mockReturnValue('ADMIN');
    vi.spyOn(alumnoService, 'listar').mockReturnValue(
      throwError(() => new Error('Fallo de red')),
    );
    vi.spyOn(maestroService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, first: true, last: true }),
    );
    vi.spyOn(materiaService, 'listar').mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, first: true, last: true }),
    );

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['errorCarga']()).toContain('No se pudieron cargar los conteos');
  });

  describe('gráficas del ADMIN y el MAESTRO', () => {
    beforeEach(() => {
      vi.spyOn(authService, 'rol').mockReturnValue('ADMIN');
      vi.spyOn(alumnoService, 'listar').mockReturnValue(of(pagina([], 3)));
      vi.spyOn(maestroService, 'listar').mockReturnValue(of(pagina([], 2)));
    });

    it('junta las notas de cada materia y las grafica por promedio', () => {
      vi.spyOn(materiaService, 'listar').mockReturnValue(
        of(pagina([materia(1, 'Álgebra'), materia(2, 'Química')], 2)),
      );
      vi.spyOn(calificacionService, 'listarPorMateria').mockImplementation((id) =>
        of(
          id === 1
            ? [nota(1, 'Álgebra', 6), nota(1, 'Álgebra', 8)]
            : [nota(2, 'Química', 10)],
        ),
      );

      montar();

      expect(component['barrasDePromedio']()).toEqual([
        { etiqueta: 'Química', valor: 10, texto: '10.00' },
        { etiqueta: 'Álgebra', valor: 7, texto: '7.00' },
      ]);
      expect(component['promedioGeneral']()).toBe(8);
      expect(component['notasContadas']()).toBe(3);
    });

    it('pide una consulta por materia: es lo único que ofrece la API', () => {
      vi.spyOn(materiaService, 'listar').mockReturnValue(
        of(pagina([materia(1, 'Álgebra'), materia(2, 'Química')], 2)),
      );
      const porMateria = vi
        .spyOn(calificacionService, 'listarPorMateria')
        .mockReturnValue(of([]));

      montar();

      expect(porMateria).toHaveBeenCalledTimes(2);
      expect(porMateria).toHaveBeenCalledWith(1);
      expect(porMateria).toHaveBeenCalledWith(2);
    });

    it('sin materias no consulta notas ni se queda colgado', () => {
      vi.spyOn(materiaService, 'listar').mockReturnValue(of(pagina([], 0)));
      const porMateria = vi.spyOn(calificacionService, 'listarPorMateria');

      montar();

      expect(porMateria).not.toHaveBeenCalled();
      expect(component['barrasDePromedio']()).toEqual([]);
      expect(component['promedioGeneral']()).toBeNull();
      expect(component['cargandoGraficas']()).toBe(false);
    });

    it('grafica también el reparto de las notas', () => {
      vi.spyOn(materiaService, 'listar').mockReturnValue(of(pagina([materia(1, 'Álgebra')], 1)));
      vi.spyOn(calificacionService, 'listarPorMateria').mockReturnValue(
        of([nota(1, 'Álgebra', 5), nota(1, 'Álgebra', 9), nota(1, 'Álgebra', 10)]),
      );

      montar();

      expect(component['barrasDeDistribucion']().map((barra) => barra.valor)).toEqual([
        1, 0, 0, 0, 2,
      ]);
    });

    it('no pide nada de asistencia: la API no la da agregada', () => {
      vi.spyOn(materiaService, 'listar').mockReturnValue(of(pagina([materia(1, 'Álgebra')], 1)));
      vi.spyOn(calificacionService, 'listarPorMateria').mockReturnValue(of([]));
      const porAlumno = vi.spyOn(asistenciaService, 'listarPorAlumno');

      montar();

      expect(porAlumno).not.toHaveBeenCalled();
    });

    it('un fallo de las gráficas no borra los conteos que sí llegaron', () => {
      vi.spyOn(materiaService, 'listar').mockImplementation((parametros) =>
        parametros?.size === 1
          ? of(pagina([], 7))
          : throwError(() => new Error('Fallo de red')),
      );

      montar();

      expect(component['errorGraficas']()).toContain('No se pudieron cargar las gráficas');
      expect(component['errorCarga']()).toBeNull();
      expect(component['totalMaterias']()).toBe(7);
    });
  });

  describe('gráficas del ALUMNO', () => {
    beforeEach(() => {
      vi.spyOn(authService, 'rol').mockReturnValue('ALUMNO');
      vi.spyOn(materiaService, 'listar').mockReturnValue(of(pagina([], 3)));
      vi.spyOn(alumnoService, 'obtenerActual').mockReturnValue(of(MI_FICHA));
    });

    it('pregunta primero cuál es su id: el token lleva email, no número', () => {
      const misNotas = vi.spyOn(calificacionService, 'listarPorAlumno').mockReturnValue(of([]));
      vi.spyOn(asistenciaService, 'listarPorAlumno').mockReturnValue(of([]));

      montar();

      expect(misNotas).toHaveBeenCalledWith(MI_FICHA.id);
    });

    it('grafica sus promedios y su asistencia por materia', () => {
      vi.spyOn(calificacionService, 'listarPorAlumno').mockReturnValue(
        of([nota(1, 'Álgebra', 9), nota(2, 'Química', 7)]),
      );
      vi.spyOn(asistenciaService, 'listarPorAlumno').mockReturnValue(
        of([
          asistencia(1, 'Álgebra', true),
          asistencia(2, 'Química', true),
          asistencia(2, 'Química', false),
        ]),
      );

      montar();

      expect(component['barrasDePromedio']().map((barra) => barra.etiqueta)).toEqual([
        'Álgebra',
        'Química',
      ]);
      expect(component['barrasDeMiAsistencia']()[0]).toEqual({
        etiqueta: 'Química',
        valor: 50,
        texto: '50% (1/2)',
      });
      expect(component['miAsistencia']()).toMatchObject({ presentes: 2, total: 3 });
    });

    it('nunca consulta las notas de una materia entera: vería las de sus compañeros', () => {
      vi.spyOn(calificacionService, 'listarPorAlumno').mockReturnValue(of([]));
      vi.spyOn(asistenciaService, 'listarPorAlumno').mockReturnValue(of([]));
      const porMateria = vi.spyOn(calificacionService, 'listarPorMateria');

      montar();

      expect(porMateria).not.toHaveBeenCalled();
    });

    it('sin asistencia registrada el porcentaje es null, no un 0% que diría que faltó a todo', () => {
      vi.spyOn(calificacionService, 'listarPorAlumno').mockReturnValue(of([]));
      vi.spyOn(asistenciaService, 'listarPorAlumno').mockReturnValue(of([]));

      montar();

      expect(component['miAsistencia']().porcentaje).toBeNull();
      expect(component['barrasDeMiAsistencia']()).toEqual([]);
    });
  });
});
