import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Calificacion, Materia, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { CalificacionesMateria } from './calificaciones-materia';

const URL = `${environment.apiUrl}/calificaciones`;
const URL_MATERIAS = `${environment.apiUrl}/materias`;

const MATERIAS: Pagina<Materia> = {
  content: [
    { id: 3, nombre: 'Bases de Datos', creditos: 8, maestroId: 2, maestroNombre: 'Laura Gómez' },
    { id: 1, nombre: 'Álgebra', creditos: 8, maestroId: 1, maestroNombre: 'Juan Pérez' },
  ],
  page: 0,
  size: 100,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

function nota(
  id: number,
  alumnoNombre: string,
  calificacion: number,
  periodo = '2026-1',
): Calificacion {
  return {
    id,
    alumnoId: id,
    alumnoNombre,
    materiaId: 3,
    materiaNombre: 'Bases de Datos',
    calificacion,
    periodo,
  };
}

describe('CalificacionesMateria', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url = '/calificaciones/materia', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'calificaciones/materia', component: CalificacionesMateria }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
    http.expectOne((s) => s.url === URL_MATERIAS).flush(MATERIAS);
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

  afterEach(() => {
    http.verify();
  });

  it('sin materia elegida no consulta nada', async () => {
    await abrir();

    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige una materia');
  });

  it('la materia elegida viaja en la URL y se consulta por ella', async () => {
    await abrir();

    (harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    await asentar();
    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes('Bases de Datos'),
    ) as HTMLElement;
    opcion.click();
    await asentar();

    expect(TestBed.inject(Router).url).toContain('materiaId=3');
    http.expectOne(`${URL}/materia/3`).flush([nota(1, 'Ana López', 9.5)]);
    await asentar();

    expect(filas()).toHaveLength(1);
    expect(texto()).toContain('Ana López');
  });

  it('ignora un materiaId que no es un número', async () => {
    await abrir('/calificaciones/materia?materiaId=abc');

    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige una materia');
  });

  it('ordena por periodo descendente y luego por alumno', async () => {
    await abrir('/calificaciones/materia?materiaId=3');
    http
      .expectOne(`${URL}/materia/3`)
      .flush([
        nota(1, 'Ana López', 9, '2026-1'),
        nota(2, 'Beatriz Ruiz', 8, '2026-2'),
        nota(3, 'Ana Díaz', 7, '2026-2'),
      ]);
    await asentar();

    const orden = filas().map((fila) => fila.textContent!.trim());
    expect(orden[0]).toContain('Ana Díaz');
    expect(orden[1]).toContain('Beatriz Ruiz');
    expect(orden[2]).toContain('Ana López');
  });

  it('calcula el promedio del grupo', async () => {
    await abrir('/calificaciones/materia?materiaId=3');
    http
      .expectOne(`${URL}/materia/3`)
      .flush([nota(1, 'Ana López', 9), nota(2, 'Carlos Ramírez', 8)]);
    await asentar();

    expect(texto()).toContain('promedio 8.5');
  });

  it('corregir lleva al formulario con la nota ya puesta', async () => {
    // La API no tiene PUT: corregir es registrar otra vez, así que el enlace va
    // al mismo formulario con los datos en la URL.
    await abrir('/calificaciones/materia?materiaId=3');
    http.expectOne(`${URL}/materia/3`).flush([nota(1, 'Ana López', 9.5)]);
    await asentar();

    // Dentro de la tabla: el botón de la cabecera lleva al mismo sitio sin
    // datos, y es el primero del documento.
    const enlace = harness.fixture.nativeElement.querySelector(
      'tbody a[href^="/calificaciones/registrar"]',
    ) as HTMLAnchorElement;
    const destino = enlace.getAttribute('href')!;
    expect(destino).toContain('alumnoId=1');
    expect(destino).toContain('materiaId=3');
    expect(destino).toContain('periodo=2026-1');
    expect(destino).toContain('calificacion=9.5');
  });

  it('una materia sin notas lo dice', async () => {
    await abrir('/calificaciones/materia?materiaId=3');
    http.expectOne(`${URL}/materia/3`).flush([]);
    await asentar();

    expect(texto()).toContain('Esta materia todavía no tiene calificaciones');
  });

  it('el MAESTRO ve todas las materias, no sólo las suyas', async () => {
    // Leer las notas de una materia no exige ser su maestro: la API no lo pide,
    // así que la pantalla no se inventa la restricción.
    await abrir('/calificaciones/materia', 'MAESTRO');

    (harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    await asentar();

    const opciones = [...document.querySelectorAll('mat-option')].map((o) => o.textContent!.trim());
    expect(opciones).toContain('Álgebra');
    expect(opciones).toContain('Bases de Datos');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/calificaciones/materia?materiaId=3');
    http
      .expectOne(`${URL}/materia/3`)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await asentar();

    expect(texto()).toContain('La base de datos no responde');

    const reintentar = [...harness.fixture.nativeElement.querySelectorAll('button')].find((boton) =>
      (boton as HTMLElement).textContent!.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    await asentar();
    http.expectOne(`${URL}/materia/3`).flush([nota(1, 'Ana López', 9.5)]);
    await asentar();

    expect(filas()).toHaveLength(1);
  });
});
