import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Alumno, Calificacion, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { CalificacionesAlumno } from './calificaciones-alumno';

const URL = `${environment.apiUrl}/calificaciones`;
const URL_ALUMNOS = `${environment.apiUrl}/alumnos`;
const URL_ALUMNO_ME = `${environment.apiUrl}/alumnos/me`;

function alumno(id: number, nombre: string, apellido: string): Alumno {
  return {
    id,
    nombre,
    apellido,
    matricula: `A202600${id}`,
    email: `${nombre.toLowerCase()}@escuela.com`,
    grupo: 'A',
  };
}

const ANA = alumno(1, 'Ana', 'López');

const ALUMNOS: Pagina<Alumno> = {
  content: [ANA, alumno(2, 'Carlos', 'Ramírez')],
  page: 0,
  size: 100,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

function nota(
  id: number,
  materiaNombre: string,
  calificacion: number,
  periodo = '2026-1',
): Calificacion {
  return {
    id,
    alumnoId: 1,
    alumnoNombre: 'Ana López',
    materiaId: id,
    materiaNombre,
    calificacion,
    periodo,
  };
}

describe('CalificacionesAlumno', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega a la pantalla; deja sin responder lo que dependa del test. */
  async function abrir(url = '/calificaciones', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'calificaciones', component: CalificacionesAlumno }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);

    if (rol === 'ALUMNO') {
      http.expectOne(URL_ALUMNO_ME).flush(ANA);
    } else {
      http.expectOne((s) => s.url === URL_ALUMNOS).flush(ALUMNOS);
    }
    await asentar();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
    TestBed.tick();
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

  function filas(): HTMLElement[] {
    return [...harness.fixture.nativeElement.querySelectorAll('tbody tr')];
  }

  async function elegirAlumno(etiqueta: string): Promise<void> {
    (harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    await asentar();
    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes(etiqueta),
    ) as HTMLElement;
    opcion.click();
    await asentar();
  }

  afterEach(() => {
    http.verify();
  });

  it('sin alumno elegido no pide nada y lo dice', async () => {
    await abrir();

    http.expectNone((s) => s.url.startsWith(URL));
    expect(texto()).toContain('Elige un alumno');
  });

  it('el alumno elegido viaja en la URL y se consulta por él', async () => {
    await abrir();
    await elegirAlumno('López');

    expect(TestBed.inject(Router).url).toContain('alumnoId=1');

    const peticion = http.expectOne(`${URL}/alumno/1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([nota(1, 'Bases de Datos', 9.5)]);
    await asentar();

    expect(filas()).toHaveLength(1);
    expect(texto()).toContain('Bases de Datos');
  });

  it('un enlace con ?alumnoId= se abre ya consultado', async () => {
    await abrir('/calificaciones?alumnoId=1');

    http.expectOne(`${URL}/alumno/1`).flush([nota(1, 'Bases de Datos', 9.5)]);
    await asentar();

    expect(texto()).toContain('Calificaciones de Ana López');
  });

  it('ignora un alumnoId que no es un número', async () => {
    // La API respondería 400 y la pantalla enseñaría un error donde debería
    // haber un selector esperando.
    await abrir('/calificaciones?alumnoId=abc');

    http.expectNone((s) => s.url.startsWith(URL));
    expect(texto()).toContain('Elige un alumno');
  });

  it('ordena por periodo descendente y luego por materia', async () => {
    // Ordenar en el cliente fue el error del Día 18 y aquí es lo correcto: la
    // pantalla tiene el arreglo entero, no una página de un total mayor.
    await abrir('/calificaciones?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush([
        nota(1, 'Álgebra', 8, '2026-1'),
        nota(2, 'Bases de Datos', 9, '2026-2'),
        nota(3, 'Álgebra II', 7, '2026-2'),
      ]);
    await asentar();

    const orden = filas().map((fila) => fila.textContent!.trim());
    expect(orden[0]).toContain('Álgebra II');
    expect(orden[1]).toContain('Bases de Datos');
    expect(orden[2]).toContain('Álgebra');
  });

  it('calcula el promedio de lo que enseña', async () => {
    await abrir('/calificaciones?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush([nota(1, 'Álgebra', 8), nota(2, 'Bases de Datos', 9.5)]);
    await asentar();

    expect(texto()).toContain('promedio 8.75');
  });

  it('el promedio se redondea a dos decimales', async () => {
    await abrir('/calificaciones?alumnoId=1');
    http.expectOne(`${URL}/alumno/1`).flush([nota(1, 'A', 9), nota(2, 'B', 8), nota(3, 'C', 8.5)]);
    await asentar();

    expect(texto()).toContain('promedio 8.5');
  });

  it('un alumno sin notas se explica sin promedio', async () => {
    await abrir('/calificaciones?alumnoId=1');
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();

    expect(texto()).toContain('Este alumno no tiene calificaciones registradas');
    expect(texto()).not.toContain('promedio');
  });

  it('el ALUMNO ve lo suyo sin elegir nada', async () => {
    // La API sólo le deja lo suyo: un desplegable prometería algo que no puede
    // hacer.
    await abrir('/calificaciones', 'ALUMNO');

    expect(harness.fixture.nativeElement.querySelector('mat-select')).toBeNull();
    http.expectOne(`${URL}/alumno/1`).flush([nota(1, 'Bases de Datos', 9.5)]);
    await asentar();

    expect(texto()).toContain('Tus calificaciones');
    expect(filas()).toHaveLength(1);
  });

  it('el ALUMNO no pide el listado de alumnos, que tiene cerrado', async () => {
    await abrir('/calificaciones', 'ALUMNO');

    http.expectNone((s) => s.url === URL_ALUMNOS);
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();
  });

  it('para el ALUMNO, un ?alumnoId= ajeno se ignora', async () => {
    // Pedirlo sólo conseguiría un 403: la pantalla ni lo intenta.
    await abrir('/calificaciones?alumnoId=2', 'ALUMNO');

    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();
  });

  it('el ALUMNO no ve el botón de registrar', async () => {
    await abrir('/calificaciones', 'ALUMNO');
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();

    expect(texto()).not.toContain('Registrar calificación');
  });

  it('el MAESTRO sí puede registrar', async () => {
    // Es la diferencia con las otras secciones: aquí escribir no es sólo del
    // ADMIN.
    await abrir('/calificaciones', 'MAESTRO');

    expect(texto()).toContain('Registrar calificación');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/calificaciones?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await asentar();

    expect(texto()).toContain('La base de datos no responde');

    const reintentar = [...harness.fixture.nativeElement.querySelectorAll('button')].find((boton) =>
      (boton as HTMLElement).textContent!.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    await asentar();

    http.expectOne(`${URL}/alumno/1`).flush([nota(1, 'Bases de Datos', 9.5)]);
    await asentar();
    expect(filas()).toHaveLength(1);
  });

  it('el ALUMNO tampoco ve la consulta por materia', async () => {
    // Vería las notas de sus compañeros.
    await abrir('/calificaciones', 'ALUMNO');
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();

    expect(texto()).not.toContain('Por materia');
  });
});
