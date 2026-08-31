import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AlumnoService } from '../../core/services/alumno-service';
import { AuthService } from '../../core/services/auth-service';
import { MaestroService } from '../../core/services/maestro-service';
import { MateriaService } from '../../core/services/materia-service';
import { Home } from './home';

describe('Home Component', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let alumnoService: AlumnoService;
  let maestroService: MaestroService;
  let materiaService: MateriaService;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    alumnoService = TestBed.inject(AlumnoService);
    maestroService = TestBed.inject(MaestroService);
    materiaService = TestBed.inject(MateriaService);
    authService = TestBed.inject(AuthService);
  });

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
});
