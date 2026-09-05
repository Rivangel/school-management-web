import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Pagina } from '../core/models';
import { paramsDePagina } from '../core/paginacion';
import { listadoPaginado } from './listado-paginado';

const URL = '/api/pruebas';
const ORDENABLES = ['apellido', 'nombre'] as const;

interface Fila {
  readonly id: number;
}

/** Filtro propio de la pantalla, como el de maestro en el listado de materias. */
interface Filtros {
  maestroId?: number;
}

function pagina(contenido: Fila[], total = contenido.length, page = 0, size = 20): Pagina<Fila> {
  return {
    content: contenido,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    first: page === 0,
    last: (page + 1) * size >= total,
  };
}

/**
 * Una pantalla de listado reducida a lo que `listadoPaginado` necesita: un
 * servicio que hable HTTP y unos filtros que leer de la URL.
 *
 * No dibuja nada a propósito. Lo que se comprueba aquí es el estado —qué se
 * pide, cuándo y a dónde navega—, que es lo que comparten los cinco listados;
 * las columnas y los botones los prueba cada pantalla en su propio spec.
 */
@Component({ template: '' })
class Anfitrion {
  private readonly http = inject(HttpClient);

  readonly listado = listadoPaginado<Fila, Filtros>({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'apellido,asc',
    leerFiltros: (query: ParamMap) => {
      const crudo = Number(query.get('maestroId'));
      return Number.isInteger(crudo) && crudo > 0 ? { maestroId: crudo } : {};
    },
    cargar: ({ maestroId, ...consulta }) => {
      const params = paramsDePagina(consulta);
      return this.http.get<Pagina<Fila>>(URL, {
        params: maestroId === undefined ? params : params.set('maestroId', maestroId),
      });
    },
    mensajeDeFallo: 'No se pudo cargar el listado.',
  });
}

describe('listadoPaginado', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let anfitrion: Anfitrion;

  /** Abre la pantalla y deja la primera petición **sin** responder. */
  async function abrir(url = '/lista'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'lista', component: Anfitrion }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    anfitrion = await harness.navigateByUrl(url, Anfitrion);
  }

  /**
   * Deja avanzar la navegación y la detección de cambios **sin** esperar a la
   * respuesta HTTP: una petición pendiente cuenta como tarea en curso, así que
   * `whenStable()` antes de responderla bloquea el test hasta que expira.
   */
  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
  }

  /** Petición pendiente al listado. La **consume**: una por llamada. */
  function peticion(): TestRequest {
    return http.expectOne((solicitud) => solicitud.url === URL);
  }

  async function responder(respuesta: Pagina<Fila>): Promise<void> {
    peticion().flush(respuesta);
    await asentar();
  }

  /** Lo de siempre: abrir la pantalla y responderle con una página. */
  async function montar(url = '/lista'): Promise<void> {
    await abrir(url);
    await responder(pagina([{ id: 1 }]));
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http.verify();
  });

  it('pide la página, el tamaño y el orden que trae la URL', async () => {
    await abrir('/lista?page=2&size=50&sort=nombre,desc');

    const solicitud = peticion();
    expect(solicitud.request.params.get('page')).toBe('2');
    expect(solicitud.request.params.get('size')).toBe('50');
    expect(solicitud.request.params.get('sort')).toBe('nombre,desc');
    solicitud.flush(pagina([], 300, 2, 50));
    await asentar();
  });

  it('descarta un sort que la API no sabe aplicar', async () => {
    // La columna de acciones no está en `ordenables`, así que `?sort=acciones,asc`
    // escrito a mano volvería como un 400 en vez de como un listado.
    await abrir('/lista?sort=acciones,asc');

    const solicitud = peticion();
    expect(solicitud.request.params.has('sort')).toBe(false);
    solicitud.flush(pagina([{ id: 1 }]));
    await asentar();
  });

  it('reparte la respuesta en filas, total y vacío', async () => {
    await abrir('/lista');
    await responder(pagina([{ id: 1 }, { id: 2 }], 42));

    expect(anfitrion.listado.filas()).toEqual([{ id: 1 }, { id: 2 }]);
    // El total es el del servidor y no las filas recibidas: es el `length` del
    // paginador, y con las dos de esta página sólo habría una página.
    expect(anfitrion.listado.total()).toBe(42);
    expect(anfitrion.listado.vacio()).toBe(false);
  });

  it('no vuelve a pedir cuando la navegación no cambia la consulta', async () => {
    // El router reemite los query params en **cada** navegación: abrir una ficha
    // y volver dispararía un GET idéntico si no se compararan los valores.
    await montar('/lista?page=1');

    await harness.navigateByUrl('/lista?page=1&otro=x');
    await asentar();

    http.expectNone((solicitud) => solicitud.url === URL);
  });

  it('vuelve a pedir cuando se quita un filtro', async () => {
    // Un filtro que se quita desaparece del objeto: comparando sólo las claves
    // de uno, `{maestroId: 2}` y `{}` saldrían iguales y la tabla se quedaría
    // enseñando lo filtrado.
    await montar('/lista?maestroId=2');

    await harness.navigateByUrl('/lista');
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.has('maestroId')).toBe(false);
    solicitud.flush(pagina([{ id: 1 }]));
    await asentar();
  });

  it('corrige una página que ya no existe', async () => {
    // Se borra el último registro desde la ficha y se vuelve a `?page=4`, que
    // ahora está por encima de la última: sin esto la tabla queda en blanco sin
    // explicar por qué.
    await abrir('/lista?page=4');
    await responder(pagina([], 45, 4));
    // Dos pasadas: la primera deja que el efecto navegue a la última página, la
    // segunda es la que ve la URL ya cambiada y vuelve a pedir.
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.get('page')).toBe('2');
    solicitud.flush(pagina([{ id: 1 }], 45, 2));
    await asentar();
  });

  it('un listado sin registros no se corrige a sí mismo', async () => {
    // Vacío porque no hay nada es distinto de vacío porque la página se pasó:
    // confundirlos deja la pantalla navegando en círculos.
    await abrir('/lista');
    await responder(pagina([], 0));

    expect(anfitrion.listado.vacio()).toBe(true);
    http.expectNone((solicitud) => solicitud.url === URL);
  });

  it('paginar lleva la página y el tamaño a la URL', async () => {
    await montar();

    anfitrion.listado.paginar({ pageIndex: 3, pageSize: 50, length: 300, previousPageIndex: 0 });
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.get('page')).toBe('3');
    expect(solicitud.request.params.get('size')).toBe('50');
    solicitud.flush(pagina([{ id: 1 }], 300, 3, 50));
    await asentar();
  });

  it('ordenar vuelve a la primera página', async () => {
    // Al reordenar los registros se recolocan: quedarse en la página 3 no
    // enseña "lo mismo ordenado" y, si el listado es corto, no enseña nada.
    await montar('/lista?page=3');

    anfitrion.listado.ordenar({ active: 'nombre', direction: 'desc' });
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.get('page')).toBe('0');
    expect(solicitud.request.params.get('sort')).toBe('nombre,desc');
    solicitud.flush(pagina([{ id: 1 }]));
    await asentar();
  });

  it('quitar la dirección borra el sort de la URL', async () => {
    // El tercer clic de `matSort` no es "ascendente otra vez": es sin orden, y
    // mandar `nombre,` sería un criterio vacío en lugar de ninguno.
    await montar('/lista?sort=nombre,desc');

    anfitrion.listado.ordenar({ active: 'nombre', direction: '' });
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.has('sort')).toBe(false);
    solicitud.flush(pagina([{ id: 1 }]));
    await asentar();
  });

  it('filtrar vuelve a la primera página y null quita el filtro', async () => {
    await montar('/lista?page=2');

    anfitrion.listado.filtrar({ maestroId: 7 });
    await asentar();

    const conFiltro = peticion();
    expect(conFiltro.request.params.get('maestroId')).toBe('7');
    expect(conFiltro.request.params.get('page')).toBe('0');
    conFiltro.flush(pagina([{ id: 1 }]));
    await asentar();

    anfitrion.listado.filtrar({ maestroId: null });
    await asentar();

    const sinFiltro = peticion();
    expect(sinFiltro.request.params.has('maestroId')).toBe(false);
    sinFiltro.flush(pagina([{ id: 1 }]));
    await asentar();
  });

  it('marca el orden por defecto de la API mientras la URL no traiga otro', async () => {
    // Dejar la cabecera sin marcar sugeriría un orden arbitrario, cuando lo que
    // se está viendo es el que aplica el servidor.
    await montar();

    expect(anfitrion.listado.orden()).toEqual({ activo: 'apellido', direccion: 'asc' });
  });

  it('marca el orden que trae la URL', async () => {
    await montar('/lista?sort=nombre,desc');

    expect(anfitrion.listado.orden()).toEqual({ activo: 'nombre', direccion: 'desc' });
  });

  it('convierte un fallo en un mensaje y deja la tabla vacía', async () => {
    // `value()` **lanza** si el recurso está en error: leerlo sin pasar por
    // `hasValue()` volvería un 500 de la API una excepción al pintar.
    await abrir('/lista');
    peticion().flush(null, { status: 500, statusText: 'Server Error' });
    await asentar();

    expect(anfitrion.listado.error()).toBe('No se pudo cargar el listado.');
    expect(anfitrion.listado.filas()).toEqual([]);
    expect(anfitrion.listado.total()).toBe(0);
  });

  it('prefiere la explicación de la API al mensaje de la pantalla', async () => {
    await abrir('/lista');
    peticion().flush(
      { message: 'El parámetro sort no es válido' },
      { status: 400, statusText: 'Bad Request' },
    );
    await asentar();

    expect(anfitrion.listado.error()).toBe('El parámetro sort no es válido');
  });

  it('reintentar repite la petición sin tocar la URL', async () => {
    await abrir('/lista?page=1');
    peticion().flush(null, { status: 500, statusText: 'Server Error' });
    await asentar();

    anfitrion.listado.reintentar();
    await asentar();

    const solicitud = peticion();
    expect(solicitud.request.params.get('page')).toBe('1');
    solicitud.flush(pagina([{ id: 1 }], 40, 1));
    await asentar();

    expect(anfitrion.listado.error()).toBeNull();
    expect(anfitrion.listado.filas()).toEqual([{ id: 1 }]);
  });
});
