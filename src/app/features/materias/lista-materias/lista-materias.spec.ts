import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Maestro, Materia, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { ListaMaterias } from './lista-materias';

const URL = `${environment.apiUrl}/materias`;
const URL_MAESTROS = `${environment.apiUrl}/maestros`;

function materia(id: number, nombre: string, maestroId = 2): Materia {
  return {
    id,
    nombre,
    creditos: 8,
    maestroId,
    maestroNombre: maestroId === 2 ? 'Laura Gómez' : 'Juan Pérez',
  };
}

function maestro(id: number, apellido: string): Maestro {
  return {
    id,
    nombre: `Nombre ${id}`,
    apellido,
    email: `maestro${id}@escuela.com`,
    especialidad: 'Matemáticas',
  };
}

function pagina<T>(contenido: T[], total = contenido.length, page = 0): Pagina<T> {
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

const MAESTROS = pagina([maestro(1, 'Pérez'), maestro(2, 'Gómez')]);

describe('ListaMaterias', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega a la pantalla y deja la petición del listado **sin** responder. */
  async function abrir(url = '/materias', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'materias', component: ListaMaterias }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
    // El selector pide sus maestros al montarse, en paralelo con el listado —
    // salvo para el ALUMNO, que no puede leerlos.
    if (rol !== 'ALUMNO') {
      http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(MAESTROS);
    }
  }

  async function montar(
    url = '/materias',
    respuesta = pagina([materia(1, 'Bases de Datos')]),
    rol: Rol = 'ADMIN',
  ): Promise<void> {
    await abrir(url, rol);
    await responder(respuesta);
  }

  /** Petición pendiente al listado. **Consume** la que encuentra. */
  function peticion(): TestRequest {
    return http.expectOne((solicitud) => solicitud.url === URL);
  }

  async function responder(
    respuesta: Pagina<Materia>,
    pendiente: TestRequest = peticion(),
  ): Promise<void> {
    pendiente.flush(respuesta);
    await harness.fixture.whenStable();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
    TestBed.tick();
  }

  /**
   * Espera a que se abra el diálogo pedido, que llega tras un `import()`
   * dinámico. **Sondea** en vez de esperar un tiempo fijo: cuánto tarda el
   * `import()` no es constante, varía con la carga de la máquina, y un tiempo
   * fijo que alcanza en solitario se queda corto corriendo la batería entera.
   */
  async function asentarDialogo(): Promise<void> {
    const limite = Date.now() + 2000;
    while (document.querySelector('mat-dialog-container') === null) {
      if (Date.now() > limite) {
        throw new Error('El diálogo no llegó a abrirse a tiempo.');
      }
      await new Promise((listo) => setTimeout(listo, 15));
      harness.detectChanges();
      TestBed.tick();
    }
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

  function filas(): HTMLElement[] {
    return [...harness.fixture.nativeElement.querySelectorAll('tbody tr')];
  }

  function boton(etiqueta: string, raiz: ParentNode = harness.fixture.nativeElement): HTMLButtonElement {
    return [...raiz.querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
  }

  function casilla(indice: number): HTMLElement {
    return filas()[indice].querySelectorAll('mat-checkbox input')[0] as HTMLElement;
  }

  function contenedorDeDialogo(): HTMLElement {
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  /** Abre el desplegable, que se dibuja en un overlay colgado del `body`. */
  async function abrirSelector(): Promise<void> {
    (harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    await asentar();
  }

  async function elegirEnElSelector(etiqueta: string): Promise<void> {
    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes(etiqueta),
    ) as HTMLElement;
    opcion.click();
    await asentar();
  }

  afterEach(async () => {
    const dialogo = TestBed.inject(MatDialog);
    if (dialogo.openDialogs.length > 0) {
      const cerradoDelTodo = firstValueFrom(dialogo.afterAllClosed);
      dialogo.closeAll();
      await cerradoDelTodo;
    }
    http.verify();
  });

  it('pide la primera página sin filtro ni orden propios', async () => {
    // Sin `sort` manda la API: por nombre ascendente.
    await abrir('/materias');

    const pendiente = peticion();
    expect(pendiente.request.params.keys()).toEqual(['page', 'size']);
    await responder(pagina([]), pendiente);
  });

  it('enseña la materia con el maestro que resolvió la API', async () => {
    await montar('/materias', pagina([materia(1, 'Bases de Datos'), materia(2, 'Álgebra', 1)]));

    expect(filas()).toHaveLength(2);
    expect(texto()).toContain('Laura Gómez');
    expect(texto()).toContain('Juan Pérez');
  });

  it('toma el filtro de la URL y lo manda a la API', async () => {
    // Filtrar es cosa del servidor: la pantalla sólo tiene en memoria la página
    // que está viendo.
    await abrir('/materias?maestroId=2');

    const pendiente = peticion();
    expect(pendiente.request.params.get('maestroId')).toBe('2');
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('elegir un maestro deja el filtro en la URL y vuelve a la primera página', async () => {
    await montar('/materias?page=3', pagina([materia(1, 'Bases de Datos')], 80, 3));

    await abrirSelector();
    await elegirEnElSelector('Gómez');

    const url = TestBed.inject(Router).url;
    expect(url).toContain('maestroId=2');
    expect(url).toContain('page=0');

    const pendiente = peticion();
    expect(pendiente.request.params.get('maestroId')).toBe('2');
    expect(pendiente.request.params.get('page')).toBe('0');
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('"todos los maestros" quita el filtro de la URL', async () => {
    await montar('/materias?maestroId=2', pagina([materia(1, 'Bases de Datos')]));

    await abrirSelector();
    await elegirEnElSelector('Todos los maestros');

    expect(TestBed.inject(Router).url).not.toContain('maestroId');
    const pendiente = peticion();
    expect(pendiente.request.params.has('maestroId')).toBe(false);
    await responder(pagina([materia(1, 'Bases de Datos'), materia(2, 'Álgebra', 1)]), pendiente);
  });

  it('ignora un maestroId que no es un número', async () => {
    // La API responde 400 a `?maestroId=abc`: una dirección mal escrita se
    // convertiría en pantalla de error en vez de listado.
    await abrir('/materias?maestroId=abc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('maestroId')).toBe(false);
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('el filtro se conserva al cambiar de página', async () => {
    await montar('/materias?maestroId=2', pagina([materia(1, 'Bases de Datos')], 60));

    const siguiente = harness.fixture.nativeElement.querySelector(
      'button[aria-label="Página siguiente"]',
    ) as HTMLButtonElement;
    siguiente.click();
    await asentar();

    const pendiente = peticion();
    expect(pendiente.request.params.get('maestroId')).toBe('2');
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([materia(2, 'Álgebra')], 60, 1), pendiente);
  });

  it('ordena por el apellido del maestro, no por el nombre compuesto', async () => {
    // `maestroNombre` lo arma el DTO y no existe en la entidad: mandarlo como
    // `sort` volvería como un 400.
    await abrir('/materias?sort=maestro.apellido,desc');

    const pendiente = peticion();
    expect(pendiente.request.params.get('sort')).toBe('maestro.apellido,desc');
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('ignora un orden por el nombre compuesto del maestro', async () => {
    await abrir('/materias?sort=maestroNombre,asc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('sort')).toBe(false);
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('un maestro sin materias se explica distinto que una escuela sin materias', async () => {
    await montar('/materias?maestroId=2', pagina([]));

    expect(texto()).toContain('Este maestro no tiene materias asignadas');
    expect(texto()).not.toContain('Todavía no hay materias registradas');
  });

  it('sin filtro, la lista vacía dice que no hay materias', async () => {
    await montar('/materias', pagina([]));

    expect(texto()).toContain('Todavía no hay materias registradas');
  });

  it('explica el fallo y deja reintentar', async () => {
    await abrir('/materias');
    peticion().flush(
      { message: 'La base de datos no responde' },
      { status: 500, statusText: 'Error' },
    );
    await harness.fixture.whenStable();

    expect(texto()).toContain('La base de datos no responde');

    boton('Reintentar').click();
    await asentar();

    await responder(pagina([materia(1, 'Bases de Datos')]));
    expect(filas()).toHaveLength(1);
  });

  it('una página que se quedó fuera de rango cae en la última con datos', async () => {
    await abrir('/materias?page=9');
    peticion().flush({ ...pagina([], 40, 9), totalPages: 2 });
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([materia(1, 'Bases de Datos')], 40, 1), pendiente);
  });

  it('el ALUMNO ve el listado sin pedir unos maestros que no puede leer', async () => {
    // La API abre el GET de materias a todos los roles y el de maestros sólo a
    // ADMIN y MAESTRO: pedirlos igualmente devolvía un 403 silencioso y dejaba
    // un desplegable con una única opción que no filtraba nada.
    await montar('/materias', pagina([materia(1, 'Bases de Datos')]), 'ALUMNO');

    // Por la clase del filtro y no por `mat-select` a secas: el paginador trae
    // el suyo para el tamaño de página.
    expect(harness.fixture.nativeElement.querySelector('.materias__filtro')).toBeNull();
    expect(filas()).toHaveLength(1);
  });

  it('el ALUMNO puede salir de un enlace que llega filtrado', async () => {
    // Sin selector no habría forma de volver al listado completo.
    await montar('/materias?maestroId=2', pagina([materia(1, 'Bases de Datos')]), 'ALUMNO');

    boton('Ver todas').click();
    await asentar();

    expect(TestBed.inject(Router).url).not.toContain('maestroId');
    await responder(pagina([materia(1, 'Bases de Datos'), materia(2, 'Álgebra', 1)]));
  });

  it('el ALUMNO no ve la columna de selección, sólo puede consultar', async () => {
    await montar('/materias', pagina([materia(1, 'Bases de Datos')]), 'ALUMNO');

    expect(harness.fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });

  it('el ADMIN tiene alta y edición; el MAESTRO sólo consulta', async () => {
    // La API abre el listado a todos los roles y reserva las escrituras al
    // ADMIN: un botón que lleva a "acceso denegado" es peor que no enseñarlo.
    await montar();
    expect(texto()).toContain('Nueva materia');
    expect(harness.fixture.nativeElement.querySelector('mat-checkbox')).not.toBeNull();

    await montar('/materias', pagina([materia(1, 'Bases de Datos')]), 'MAESTRO');
    expect(texto()).not.toContain('Nueva materia');
    expect(harness.fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });

  it('ignora un orden por una columna que no existe', async () => {
    // `ORDENABLES` valida también el `sort` de la URL, y `seleccion` no es una
    // propiedad de la entidad: la API lo devolvería como un 400.
    await abrir('/materias?sort=seleccion,asc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('sort')).toBe(false);
    await responder(pagina([materia(1, 'Bases de Datos')]), pendiente);
  });

  it('el ADMIN abre el alta en un diálogo y recarga el listado al guardar', async () => {
    await montar();

    boton('Nueva materia').click();
    await asentarDialogo();
    // El diálogo pide sus propios maestros, aparte de los del filtro.
    http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(MAESTROS);
    await asentar();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('Nueva materia');
    const cerrado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    const nombre = dialogo.querySelector('input[formControlName="nombre"]') as HTMLInputElement;
    nombre.value = 'Termodinámica';
    nombre.dispatchEvent(new Event('input'));
    const creditos = dialogo.querySelector('input[formControlName="creditos"]') as HTMLInputElement;
    creditos.value = '6';
    creditos.dispatchEvent(new Event('input'));

    (dialogo.querySelector('mat-select') as HTMLElement).click();
    await asentar();
    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes('Gómez'),
    ) as HTMLElement;
    opcion.click();
    await asentar();

    dialogo.querySelector('form')!.dispatchEvent(new Event('submit'));
    await asentar();

    http
      .expectOne(URL)
      .flush(materia(2, 'Termodinámica'), { status: 201, statusText: 'Created' });
    await cerrado;
    await asentar();

    await responder(pagina([materia(1, 'Bases de Datos'), materia(2, 'Termodinámica')]));
    expect(filas()).toHaveLength(2);
  });

  it('marcar una fila activa "editar" y "eliminar"; marcar otra más desactiva "editar"', async () => {
    await montar('/materias', pagina([materia(1, 'Bases de Datos'), materia(2, 'Álgebra', 1)]));

    expect(texto()).not.toContain('1 seleccionada');

    (casilla(0) as HTMLInputElement).click();
    await asentar();

    expect(texto()).toContain('1 seleccionada');
    expect(boton('Editar').disabled).toBe(false);
    expect(boton('Eliminar').disabled).toBe(false);

    (casilla(1) as HTMLInputElement).click();
    await asentar();

    expect(texto()).toContain('2 seleccionadas');
    expect(boton('Editar').disabled).toBe(true);
    expect(boton('Eliminar').disabled).toBe(false);
  });

  it('eliminar una fila marcada pregunta, borra y recarga', async () => {
    await montar('/materias', pagina([materia(1, 'Bases de Datos')]));

    (casilla(0) as HTMLInputElement).click();
    await asentar();
    boton('Eliminar').click();
    await asentar();

    const confirmarCerrado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());
    const confirmar = boton('Eliminar', document.querySelector('mat-dialog-container')!);
    confirmar.click();
    await confirmarCerrado;
    await asentar();

    const borrado = http.expectOne(`${URL}/1`);
    expect(borrado.request.method).toBe('DELETE');
    borrado.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    await responder(pagina([]));
    expect(texto()).not.toContain('seleccionad');
  });

  it('toda la fila abre la ficha de la materia, con el filtro puesto', async () => {
    await montar('/materias?maestroId=2', pagina([materia(1, 'Bases de Datos')]));

    filas()[0].dispatchEvent(new Event('click', { bubbles: true }));
    await asentarDialogo();
    http.expectOne(`${URL}/1`).flush(materia(1, 'Bases de Datos'));
    await asentar();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('Bases de Datos');
    const fichaCerrada = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    const cerrar = dialogo.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement;
    cerrar.click();
    await fichaCerrada;
    await asentar();

    // El filtro sigue puesto: recargar con `reintentar()` no toca la URL.
    expect(TestBed.inject(Router).url).toContain('maestroId=2');
    await responder(pagina([materia(1, 'Bases de Datos')]));
  });
});
