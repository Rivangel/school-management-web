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
import { Alumno, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
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

  /**
   * Navega a la pantalla y deja la primera petición **sin** responder.
   *
   * La sesión se siembra antes de montar nada: `AuthService` lee
   * `localStorage` una sola vez, al construirse.
   */
  async function abrir(url = '/alumnos', rol: Rol = 'ADMIN'): Promise<void> {
    sembrarSesion(rol);
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

  /** La casilla de una fila, por posición (0 = la primera fila de la tabla). */
  function casilla(indice: number): HTMLElement {
    return filas()[indice].querySelectorAll('mat-checkbox input')[0] as HTMLElement;
  }

  /** El diálogo se dibuja en un overlay colgado del `body`, no en el fixture. */
  function contenedorDeDialogo(): HTMLElement {
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(async () => {
    // Espera a que el DOM del diálogo se retire de verdad: sin esto, el
    // contenedor de este test puede seguir siendo el primero que encuentra
    // `document.querySelector` en el siguiente.
    const dialogo = TestBed.inject(MatDialog);
    if (dialogo.openDialogs.length > 0) {
      const cerradoDelTodo = firstValueFrom(dialogo.afterAllClosed);
      dialogo.closeAll();
      await cerradoDelTodo;
    }
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

    boton('Reintentar').click();
    await asentar();

    await responder(pagina([alumno(1, 'López')]));
    expect(filas()).toHaveLength(1);
  });

  it('una página que se quedó fuera de rango cae en la última con datos', async () => {
    // Pasa al volver del detalle después de borrar —la página que se miraba ya
    // no existe— y con un `?page=99` escrito a mano. Sin esto la tabla se queda
    // en blanco sin explicar nada.
    await abrir('/alumnos?page=9');
    // Sin `responder`: la corrección encadena otra petición, y esperar la
    // estabilidad con una en vuelo cuelga el test hasta que expira.
    peticion().flush({ ...pagina([], 40, 9), totalPages: 2 });
    await asentar();

    expect(TestBed.inject(Router).url).toContain('page=1');
    const pendiente = peticion();
    expect(pendiente.request.params.get('page')).toBe('1');
    await responder(pagina([alumno(1, 'López')], 40, 1), pendiente);
  });

  it('no corrige la página cuando sencillamente no hay alumnos', async () => {
    await montar('/alumnos', { ...pagina([]), totalPages: 0 });

    expect(TestBed.inject(Router).url).toBe('/alumnos');
    expect(texto()).toContain('Todavía no hay alumnos registrados');
  });

  it('el MAESTRO no ve las acciones de escritura ni la columna de selección', async () => {
    // Ocultar no protege —la API le devuelve 403 igual—, pero un botón que sólo
    // lleva a "acceso denegado" sobra.
    await abrir('/alumnos', 'MAESTRO');
    await responder(pagina([alumno(1, 'López')]));

    expect(texto()).not.toContain('Nuevo alumno');
    expect(harness.fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });

  it('ignora un orden por una columna que no existe', async () => {
    // La columna de selección no entra en `ORDENABLES`: mandarla como `sort`
    // haría que la API respondiera 400 y la pantalla enseñara un error.
    await abrir('/alumnos?sort=seleccion,asc');

    const pendiente = peticion();
    expect(pendiente.request.params.has('sort')).toBe(false);
    await responder(pagina([alumno(1, 'López')]), pendiente);
  });

  it('el ADMIN abre el alta en un diálogo y recarga el listado al guardar', async () => {
    await montar();

    boton('Nuevo alumno').click();
    await asentarDialogo();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('Nuevo alumno');
    // Se captura aquí y no después de guardar: `afterClosed()` sólo emite lo
    // que pasa **desde este momento**, y esperar exactamente esto (en vez de
    // adivinar cuántas vueltas tarda la animación de cierre) es lo único que
    // garantiza no comprobar la recarga antes de que se haya pedido.
    const cerrado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    const nombre = dialogo.querySelector('input[formControlName="nombre"]') as HTMLInputElement;
    nombre.value = 'Beatriz';
    nombre.dispatchEvent(new Event('input'));

    // El resto de campos no importa para este test: sólo interesa que guardar
    // recarga el listado, no la validación del formulario (ver su propio spec).
    for (const [campo, valor] of Object.entries({
      apellido: 'Núñez',
      matricula: 'A-099',
      email: 'beatriz@escuela.com',
      grupo: '3C',
    })) {
      const input = dialogo.querySelector(`input[formControlName="${campo}"]`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }

    dialogo.querySelector('form')!.dispatchEvent(new Event('submit'));
    await asentar();

    http
      .expectOne(URL)
      .flush({ ...alumno(2, 'Núñez'), nombre: 'Beatriz' }, { status: 201, statusText: 'Created' });
    await cerrado;
    await asentar();

    // El listado recarga tras cerrarse el diálogo.
    await responder(pagina([alumno(1, 'López'), alumno(2, 'Núñez')]));
    expect(filas()).toHaveLength(2);
  });

  it('marcar una fila activa "editar" y "eliminar"; marcar otra más desactiva "editar"', async () => {
    await montar('/alumnos', pagina([alumno(1, 'López'), alumno(2, 'Ramírez')]));

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

  it('cambiar de página limpia la selección', async () => {
    await montar('/alumnos', pagina([alumno(1, 'López')], 137));

    (casilla(0) as HTMLInputElement).click();
    await asentar();
    expect(texto()).toContain('1 seleccionado');

    const siguiente = harness.fixture.nativeElement.querySelector(
      'button[aria-label="Página siguiente"]',
    ) as HTMLButtonElement;
    siguiente.click();
    await asentar();
    await responder(pagina([alumno(2, 'Ramírez')], 137, 1));

    expect(texto()).not.toContain('seleccionad');
  });

  it('eliminar una fila marcada pregunta, borra y recarga', async () => {
    await montar('/alumnos', pagina([alumno(1, 'López')]));

    (casilla(0) as HTMLInputElement).click();
    await asentar();
    boton('Eliminar').click();
    await asentar();

    // Se captura antes de confirmar: `afterClosed()` sólo emite lo que pasa
    // desde este momento, y es lo único que garantiza esperar exactamente lo
    // que tarda cerrarse (animación incluida) sin adivinar cuántas vueltas.
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

  it('toda la fila abre la ficha del alumno', async () => {
    await montar();

    filas()[0].dispatchEvent(new Event('click', { bubbles: true }));
    await asentarDialogo();
    http.expectOne(`${URL}/1`).flush(alumno(1, 'López'));
    await asentar();

    const dialogo = contenedorDeDialogo();
    expect(dialogo.textContent).toContain('López');
    const fichaCerrada = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

    const cerrar = dialogo.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement;
    cerrar.click();
    await fichaCerrada;
    await asentar();

    await responder(pagina([alumno(1, 'López')]));
  });

  describe('exportar', () => {
    let crear: ReturnType<typeof vi.spyOn>;
    let pulsado: HTMLAnchorElement[];

    /** A diferencia de `pagina()`, con el `size` que pide de verdad la exportación. */
    function paginaDeExportacion(
      contenido: Alumno[],
      opciones: { page?: number; last: boolean; total?: number },
    ): Pagina<Alumno> {
      const page = opciones.page ?? 0;
      return {
        content: contenido,
        page,
        size: 100,
        totalElements: opciones.total ?? contenido.length,
        totalPages: 1,
        first: page === 0,
        last: opciones.last,
      };
    }

    beforeEach(() => {
      // `URL` de jsdom es de verdad: se espía en vez de sustituirla.
      crear = vi.spyOn(globalThis.URL, 'createObjectURL');
      pulsado = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        pulsado.push(this);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('pide la página completa (size=100, no la de pantalla) y descarga un CSV con todas las columnas', async () => {
      await montar('/alumnos', pagina([alumno(1, 'López')]));

      boton('Exportar CSV').click();
      await asentar();

      const exportacion = http.expectOne((solicitud) => solicitud.url === URL);
      expect(exportacion.request.params.get('page')).toBe('0');
      expect(exportacion.request.params.get('size')).toBe('100');
      exportacion.flush(
        paginaDeExportacion([alumno(1, 'López'), alumno(2, 'García')], { last: true }),
      );
      await asentar();

      expect(pulsado).toHaveLength(1);
      expect(pulsado[0].download).toBe('alumnos.csv');
      const blob = crear.mock.calls[0][0] as Blob;
      const texto = await blob.text();
      expect(texto).toContain('"Matrícula","Apellido","Nombre","Grupo","Correo"');
      expect(texto).toContain('García');
    });

    it('recorre todas las páginas del servidor antes de exportar', async () => {
      await montar('/alumnos', pagina([alumno(1, 'López')]));

      boton('Exportar CSV').click();
      await asentar();

      http
        .expectOne((s) => s.url === URL)
        .flush(paginaDeExportacion([alumno(1, 'López')], { page: 0, last: false, total: 2 }));
      await asentar();

      const segunda = http.expectOne((s) => s.url === URL);
      expect(segunda.request.params.get('page')).toBe('1');
      segunda.flush(paginaDeExportacion([alumno(2, 'García')], { page: 1, last: true, total: 2 }));
      await asentar();

      expect(pulsado).toHaveLength(1);
      const blob = crear.mock.calls[0][0] as Blob;
      const texto = await blob.text();
      expect(texto).toContain('López');
      expect(texto).toContain('García');
    });

    it('si la petición falla, no descarga nada', async () => {
      await montar('/alumnos', pagina([alumno(1, 'López')]));

      boton('Exportar CSV').click();
      await asentar();

      http.expectOne((s) => s.url === URL).flush(null, { status: 500, statusText: 'Error' });
      await asentar();

      expect(pulsado).toHaveLength(0);
    });
  });
});
