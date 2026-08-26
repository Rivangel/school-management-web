import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Alumno, Asistencia, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { AsistenciaAlumno } from './asistencia-alumno';

const URL = `${environment.apiUrl}/asistencia`;
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

const ANA = alumno(1, 'Ana', 'Lopez');

const ALUMNOS: Pagina<Alumno> = {
  content: [ANA, alumno(2, 'Carlos', 'Ramirez')],
  page: 0,
  size: 100,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

function registro(
  id: number,
  materiaNombre: string,
  presente: boolean,
  fecha = '2026-07-20',
): Asistencia {
  return {
    id,
    alumnoId: 1,
    alumnoNombre: 'Ana Lopez',
    materiaId: id,
    materiaNombre,
    fecha,
    presente,
  };
}

describe('AsistenciaAlumno', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega a la pantalla; deja sin responder lo que dependa del test. */
  async function abrir(url = '/asistencia', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'asistencia', component: AsistenciaAlumno }]),
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

    http.expectNone((s) => s.url.startsWith(URL + '/alumno'));
    expect(texto()).toContain('Elige un alumno');
  });

  it('el alumno elegido viaja en la URL y se consulta por el', async () => {
    await abrir();
    await elegirAlumno('Lopez');

    expect(TestBed.inject(Router).url).toContain('alumnoId=1');

    const peticion = http.expectOne(`${URL}/alumno/1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([registro(1, 'Bases de Datos', true)]);
    await asentar();

    expect(filas()).toHaveLength(1);
    expect(texto()).toContain('Bases de Datos');
  });

  it('un enlace con ?alumnoId= se abre ya consultado', async () => {
    await abrir('/asistencia?alumnoId=1');

    http.expectOne(`${URL}/alumno/1`).flush([registro(1, 'Bases de Datos', true)]);
    await asentar();

    expect(texto()).toContain('Asistencia de Ana Lopez');
  });

  it('ignora un alumnoId que no es un numero', async () => {
    // La API responderia 400 y la pantalla ensenaria un error donde deberia
    // haber un selector esperando.
    await abrir('/asistencia?alumnoId=abc');

    http.expectNone((s) => s.url.startsWith(URL + '/alumno'));
    expect(texto()).toContain('Elige un alumno');
  });

  it('ordena por fecha descendente y luego por materia', async () => {
    // Ordenar en el cliente es correcto: la pantalla tiene el arreglo entero,
    // no una pagina de un total mayor.
    await abrir('/asistencia?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush([
        registro(1, 'Algebra', true, '2026-07-10'),
        registro(2, 'Bases de Datos', false, '2026-07-20'),
        registro(3, 'Algebra II', true, '2026-07-20'),
      ]);
    await asentar();

    const orden = filas().map((fila) => fila.textContent!.trim());
    expect(orden[0]).toContain('Algebra II');
    expect(orden[1]).toContain('Bases de Datos');
    expect(orden[2]).toContain('Algebra');
  });

  it('calcula presentes y ausentes correctamente', async () => {
    await abrir('/asistencia?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush([
        registro(1, 'Algebra', true),
        registro(2, 'Bases de Datos', false),
        registro(3, 'Calculo', true),
      ]);
    await asentar();

    expect(texto()).toContain('3 registros');
    expect(texto()).toContain('2 presentes');
    expect(texto()).toContain('1 ausentes');
  });

  it('un alumno sin registros se explica sin resumen', async () => {
    await abrir('/asistencia?alumnoId=1');
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();

    expect(texto()).toContain('Este alumno no tiene asistencia registrada');
    expect(texto()).not.toContain('registros');
  });

  it('el ALUMNO ve lo suyo sin elegir nada', async () => {
    // La API solo le deja lo suyo: un desplegable prometeria algo que no puede hacer.
    await abrir('/asistencia', 'ALUMNO');

    expect(harness.fixture.nativeElement.querySelector('mat-select')).toBeNull();
    http.expectOne(`${URL}/alumno/1`).flush([registro(1, 'Bases de Datos', true)]);
    await asentar();

    expect(texto()).toContain('Tus registros de asistencia');
    expect(filas()).toHaveLength(1);
  });

  it('el ALUMNO no pide el listado de alumnos, que tiene cerrado', async () => {
    await abrir('/asistencia', 'ALUMNO');

    http.expectNone((s) => s.url === URL_ALUMNOS);
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();
  });

  it('para el ALUMNO, un ?alumnoId= ajeno se ignora', async () => {
    // Pedirlo solo conseguiria un 403: la pantalla ni lo intenta.
    await abrir('/asistencia?alumnoId=2', 'ALUMNO');

    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();
  });

  it('el ALUMNO no ve el boton de pasar lista', async () => {
    await abrir('/asistencia', 'ALUMNO');
    http.expectOne(`${URL}/alumno/1`).flush([]);
    await asentar();

    expect(texto()).not.toContain('Pasar lista');
  });

  it('el MAESTRO si puede pasar lista', async () => {
    // Es la diferencia con las otras secciones: aqui escribir no es solo del ADMIN.
    await abrir('/asistencia', 'MAESTRO');

    expect(texto()).toContain('Pasar lista');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/asistencia?alumnoId=1');
    http
      .expectOne(`${URL}/alumno/1`)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await asentar();

    expect(texto()).toContain('La base de datos no responde');

    const reintentar = [...harness.fixture.nativeElement.querySelectorAll('button')].find(
      (boton) => (boton as HTMLElement).textContent!.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    await asentar();

    http.expectOne(`${URL}/alumno/1`).flush([registro(1, 'Bases de Datos', true)]);
    await asentar();
    expect(filas()).toHaveLength(1);
  });
});
