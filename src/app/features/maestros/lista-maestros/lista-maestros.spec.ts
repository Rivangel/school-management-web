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
import { Maestro, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
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
  async function abrir(url = '/maestros', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

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
    rol: Rol = 'ADMIN',
  ): Promise<void> {
    await abrir(url, rol);
    await responder(respuesta);
  }

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

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(async () => {
    const dialogo = TestBed.inject(MatDialog);
    if (dialogo.openDialogs.length > 0) {
      const cerradoDelTodo = firstValueFrom(dialogo.afterAllClosed);
      dialogo.closeAll();
      await cerradoDelTodo;
    }
    http.verify();
  });

  it('pide la primera página sin imponer un orden propio', async () => {
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

    boton('Reintentar').click();
    await asentar();

    await responder(pagina([maestro(1, 'Ruiz')]));
    expect(filas()).toHaveLength(1);
  });

  it('una página que se quedó fuera de rango cae en la última con datos', async () => {
    await abrir('/maestros?page=9');
    peticion().flush({ ...pagina([], 40, 9), totalPages: 2 });
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([maestro(1, 'Ruiz')], 40, 1), pendiente);
  });

  it('ignora un orden por una propiedad que no es columna', async () => {
    await abrir('/maestros?sort=seleccion,asc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('sort')).toBe(false);
    await responder(pagina([maestro(1, 'Ruiz')]), pendiente);
  });

  it('el MAESTRO no ve las acciones de escritura ni la columna de selección', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz')]), 'MAESTRO');

    expect(texto()).not.toContain('Nuevo maestro');
    expect(harness.fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });

  it('el ADMIN abre el alta en un diálogo y recarga el listado al guardar', async () => {
    await montar();

    boton('Nuevo maestro').click();
    await asentarDialogo();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('Nuevo maestro');
    const cerrado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    for (const [campo, valor] of Object.entries({
      nombre: 'Elena',
      apellido: 'Cabrera',
      especialidad: 'Física',
      email: 'elena@escuela.com',
    })) {
      const input = dialogo.querySelector(`input[formControlName="${campo}"]`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }

    dialogo.querySelector('form')!.dispatchEvent(new Event('submit'));
    await asentar();

    http
      .expectOne(URL)
      .flush({ ...maestro(2, 'Cabrera'), nombre: 'Elena' }, { status: 201, statusText: 'Created' });
    await cerrado;
    await asentar();

    await responder(pagina([maestro(1, 'Ruiz'), maestro(2, 'Cabrera')]));
    expect(filas()).toHaveLength(2);
  });

  it('marcar una fila activa "editar" y "eliminar"; marcar otra más desactiva "editar"', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz'), maestro(2, 'Fuentes')]));

    expect(texto()).not.toContain('1 seleccionado');

    (casilla(0) as HTMLInputElement).click();
    await asentar();

    expect(texto()).toContain('1 seleccionado');
    expect(boton('Editar').disabled).toBe(false);
    expect(boton('Eliminar').disabled).toBe(false);

    (casilla(1) as HTMLInputElement).click();
    await asentar();

    expect(texto()).toContain('2 seleccionados');
    expect(boton('Editar').disabled).toBe(true);
    expect(boton('Eliminar').disabled).toBe(false);
  });

  it('eliminar una fila marcada pregunta, borra y recarga', async () => {
    await montar('/maestros', pagina([maestro(1, 'Ruiz')]));

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

  it('toda la fila abre la ficha del maestro', async () => {
    await montar();

    filas()[0].dispatchEvent(new Event('click', { bubbles: true }));
    await asentarDialogo();
    http.expectOne(`${URL}/1`).flush(maestro(1, 'Ruiz'));
    await asentar();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('Ruiz');
    const fichaCerrada = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    const cerrar = dialogo.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement;
    cerrar.click();
    await fichaCerrada;
    await asentar();

    await responder(pagina([maestro(1, 'Ruiz')]));
  });
});
