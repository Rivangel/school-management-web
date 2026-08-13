import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Alumno, Pagina } from '../../../core/models';
import { ListaAlumnos } from './lista-alumnos';

const URL = `${environment.apiUrl}/alumnos`;

function alumno(id: number, apellido: string): Alumno {
  return {
    id,
    nombre: `Nombre ${id}`,
    apellido,
    matricula: `A-00${id}`,
    email: `alumno${id}@escuela.com`,
    grupo: '1A',
  };
}

function pagina(contenido: Alumno[], total = contenido.length, page = 0): Pagina<Alumno> {
  return {
    content: contenido,
    page,
    size: 20,
    totalElements: total,
    totalPages: Math.max(Math.ceil(total / 20), 1),
    first: page === 0,
    last: (page + 1) * 20 >= total,
  };
}

describe('ListaAlumnos', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega a la pantalla y deja la primera petición **sin** responder. */
  async function abrir(url = '/alumnos'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'alumnos', component: ListaAlumnos }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Lo de siempre: abrir la pantalla y responderle con una página. */
  async function montar(url = '/alumnos', respuesta = pagina([alumno(1, 'López')])): Promise<void> {
    await abrir(url);
    await responder(respuesta);
  }

  /**
   * Petición pendiente al listado. **Consume** la que encuentra, así que se pide
   * una sola vez por petición y se responde con esa misma.
   */
  function peticion(): TestRequest {
    return http.expectOne((solicitud) => solicitud.url === URL);
  }

  async function responder(
    respuesta: Pagina<Alumno>,
    pendiente: TestRequest = peticion(),
  ): Promise<void> {
    pendiente.flush(respuesta);
    await harness.fixture.whenStable();
  }

  /**
   * Deja avanzar la navegación y la detección de cambios **sin** esperar a la
   * respuesta HTTP.
   *
   * `whenStable()` no sirve aquí: una petición pendiente cuenta como tarea en
   * curso, así que esperar la estabilidad antes de responderla bloquea el test
   * hasta que expira el tiempo.
   */
  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

  function filas(): HTMLElement[] {
    return [...harness.fixture.nativeElement.querySelectorAll('tbody tr')];
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http.verify();
  });

  it('pide la primera página sin imponer un orden propio', async () => {
    // Sin `sort` manda la API: apellido y nombre ascendente. Es el orden que la
    // tabla marca en el encabezado.
    await abrir('/alumnos');

    const pendiente = peticion();
    expect(pendiente.request.params.keys()).toEqual(['page', 'size']);
    await responder(pagina([]), pendiente);
  });

  it('dibuja una fila por alumno de la página', async () => {
    await montar('/alumnos', pagina([alumno(1, 'López'), alumno(2, 'Ramírez')]));

    expect(filas()).toHaveLength(2);
    expect(texto()).toContain('López');
    expect(texto()).toContain('A-002');
  });

  it('toma la página y el orden de la URL', async () => {
    // Recargar (F5) o compartir el enlace cae en la misma página y el mismo
    // orden: el estado del listado vive en la URL.
    await abrir('/alumnos?page=2&size=50&sort=grupo,desc');

    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('2');
    expect(pendiente.request.params.get('size')).toBe('50');
    expect(pendiente.request.params.get('sort')).toBe('grupo,desc');
    await responder(pagina([], 200, 2), pendiente);
  });

  it('el paginador cuenta el total del servidor, no las filas recibidas', async () => {
    // Es la diferencia entre paginar en el servidor o en el cliente: con 20
    // filas en mano el paginador tiene que saber que hay 137 en total.
    await montar('/alumnos', pagina([alumno(1, 'López')], 137));

    expect(texto()).toContain('de 137');
  });

  it('cambiar de página se refleja en la URL y pide la nueva', async () => {
    await montar('/alumnos', pagina([alumno(1, 'López')], 137));

    const siguiente = harness.fixture.nativeElement.querySelector(
      'button[aria-label="Página siguiente"]',
    ) as HTMLButtonElement;
    siguiente.click();
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([alumno(2, 'Ramírez')], 137, 1), pendiente);
  });

  it('ordenar por una columna vuelve a la primera página', async () => {
    // Sin esto, ordenar desde la página 7 deja al usuario en una página que tras
    // el reordenamiento puede no tener nada que enseñar.
    await montar('/alumnos?page=7', pagina([alumno(1, 'López')], 200, 7));

    const encabezado = harness.fixture.nativeElement.querySelector(
      'th[mat-sort-header]',
    ) as HTMLElement;
    encabezado.click();
    await asentar();

    const url = TestBed.inject(Router).url;
    expect(url).toContain('page=0');
    expect(url).toContain('sort=matricula');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('0');
    await responder(pagina([alumno(1, 'López')], 200), pendiente);
  });

  it('enseña un aviso cuando no hay alumnos', async () => {
    await montar('/alumnos', pagina([]));

    expect(filas()).toHaveLength(0);
    expect(texto()).toContain('Todavía no hay alumnos registrados');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/alumnos');
    http
      .expectOne((solicitud) => solicitud.url === URL)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await harness.fixture.whenStable();

    expect(texto()).toContain('La base de datos no responde');

    const reintentar = [...harness.fixture.nativeElement.querySelectorAll('button')].find((boton) =>
      (boton as HTMLElement).textContent!.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    await asentar();

    await responder(pagina([alumno(1, 'López')]));
    expect(filas()).toHaveLength(1);
  });
});
