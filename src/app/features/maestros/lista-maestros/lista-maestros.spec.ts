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
import { Maestro, Pagina } from '../../../core/models';
import { ListaMaestros } from './lista-maestros';

const URL = `${environment.apiUrl}/maestros`;

function maestro(id: number, apellido: string): Maestro {
  return {
    id,
    nombre: `Nombre ${id}`,
    apellido,
    email: `maestro${id}@escuela.com`,
    especialidad: 'Matemáticas',
  };
}

function pagina(contenido: Maestro[], total = contenido.length, page = 0): Pagina<Maestro> {
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

describe('ListaMaestros', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega a la pantalla y deja la primera petición **sin** responder. */
  async function abrir(url = '/maestros'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'maestros', component: ListaMaestros }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  async function montar(
    url = '/maestros',
    respuesta = pagina([maestro(1, 'Ruiz')]),
  ): Promise<void> {
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
    respuesta: Pagina<Maestro>,
    pendiente: TestRequest = peticion(),
  ): Promise<void> {
    pendiente.flush(respuesta);
    await harness.fixture.whenStable();
  }

  /**
   * Deja avanzar la navegación y la detección de cambios **sin** esperar a la
   * respuesta HTTP: con una petición en vuelo, `whenStable()` no vuelve.
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
    await abrir('/maestros');

    const pendiente = peticion();
    expect(pendiente.request.params.keys()).toEqual(['page', 'size']);
    await responder(pagina([]), pendiente);
  });

  it('dibuja una fila por maestro de la página', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz'), maestro(2, 'Fuentes')]));

    expect(filas()).toHaveLength(2);
    expect(texto()).toContain('Fuentes');
    expect(texto()).toContain('Matemáticas');
  });

  it('toma la página y el orden de la URL', async () => {
    await abrir('/maestros?page=2&size=50&sort=especialidad,desc');

    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('2');
    expect(pendiente.request.params.get('size')).toBe('50');
    expect(pendiente.request.params.get('sort')).toBe('especialidad,desc');
    await responder(pagina([], 200, 2), pendiente);
  });

  it('el paginador cuenta el total del servidor, no las filas recibidas', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz')], 137));

    expect(texto()).toContain('de 137');
  });

  it('cambiar de página se refleja en la URL y pide la nueva', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz')], 137));

    const siguiente = harness.fixture.nativeElement.querySelector(
      'button[aria-label="Página siguiente"]',
    ) as HTMLButtonElement;
    siguiente.click();
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([maestro(2, 'Fuentes')], 137, 1), pendiente);
  });

  it('ordenar por una columna vuelve a la primera página', async () => {
    await montar('/maestros?page=7', pagina([maestro(1, 'Ruiz')], 200, 7));

    const encabezado = harness.fixture.nativeElement.querySelector(
      'th[mat-sort-header]',
    ) as HTMLElement;
    encabezado.click();
    await asentar();

    const url = TestBed.inject(Router).url;
    expect(url).toContain('page=0');
    expect(url).toContain('sort=apellido');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('0');
    await responder(pagina([maestro(1, 'Ruiz')], 200), pendiente);
  });

  it('enseña un aviso cuando no hay maestros', async () => {
    await montar('/maestros', pagina([]));

    expect(filas()).toHaveLength(0);
    expect(texto()).toContain('Todavía no hay maestros registrados');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/maestros');
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

    await responder(pagina([maestro(1, 'Ruiz')]));
    expect(filas()).toHaveLength(1);
  });

  it('una página que se quedó fuera de rango cae en la última con datos', async () => {
    await abrir('/maestros?page=9');
    // Sin `responder`: la corrección encadena otra petición, y esperar la
    // estabilidad con una en vuelo cuelga el test hasta que expira.
    peticion().flush({ ...pagina([], 40, 9), totalPages: 2 });
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([maestro(1, 'Ruiz')], 40, 1), pendiente);
  });

  it('ignora un orden por una propiedad que no es columna', async () => {
    // Las columnas de esta tabla no son las de alumnos: `grupo` existe allá y
    // aquí no, y mandarlo haría que la API respondiera 400.
    await abrir('/maestros?sort=grupo,asc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('sort')).toBe(false);
    await responder(pagina([maestro(1, 'Ruiz')]), pendiente);
  });
});
