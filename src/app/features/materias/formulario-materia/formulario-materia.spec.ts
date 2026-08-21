import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Maestro, Materia, Pagina } from '../../../core/models';
import { FormularioMateria } from './formulario-materia';

const URL = `${environment.apiUrl}/materias`;
const URL_MAESTROS = `${environment.apiUrl}/maestros`;

const MATERIA: Materia = {
  id: 7,
  nombre: 'Bases de Datos',
  creditos: 8,
  maestroId: 2,
  maestroNombre: 'Laura Gómez',
};

function maestro(id: number, apellido: string): Maestro {
  return {
    id,
    nombre: `Nombre ${id}`,
    apellido,
    email: `maestro${id}@escuela.com`,
    especialidad: 'Matemáticas',
  };
}

const MAESTROS: Pagina<Maestro> = {
  content: [maestro(1, 'Pérez'), maestro(2, 'Gómez')],
  page: 0,
  size: 100,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

/** Destino del "Cancelar" y del guardado: aquí sólo interesa la URL a la que va. */
@Component({ template: 'listado' })
class ListadoFalso {}

describe('FormularioMateria', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega y responde con los maestros, que se piden siempre al montar. */
  async function abrir(url: string, maestros: Pagina<Maestro> = MAESTROS): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'materias', component: ListadoFalso },
          { path: 'materias/nueva', component: FormularioMateria },
          { path: 'materias/:id/editar', component: FormularioMateria },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
    http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(maestros);
    // `asentar` y no `whenStable`: en una edición la ficha ya va en vuelo, y una
    // petición pendiente cuelga la espera hasta que el test expira.
    await asentar();
  }

  /** Abre la edición y responde con la materia, que es el punto de partida normal. */
  async function editar(url = '/materias/7/editar', materia = MATERIA): Promise<void> {
    await abrir(url);
    http.expectOne(`${URL}/7`).flush(materia);
    await harness.fixture.whenStable();
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

  function campo(nombre: string): HTMLInputElement {
    return harness.fixture.nativeElement.querySelector(`input[formControlName="${nombre}"]`);
  }

  function escribir(nombre: string, valor: string): void {
    const input = campo(nombre);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  /** El desplegable se dibuja en un overlay colgado del `body`, no en el fixture. */
  async function abrirMaestros(): Promise<void> {
    (harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    await asentar();
  }

  function opciones(): string[] {
    return [...document.querySelectorAll('mat-option')].map((opcion) => opcion.textContent!.trim());
  }

  async function elegirMaestro(etiqueta: string): Promise<void> {
    await abrirMaestros();
    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes(etiqueta),
    ) as HTMLElement;
    opcion.click();
    await asentar();
  }

  /** Rellena el alta entera: los dos campos de texto y el desplegable. */
  async function rellenar(nombre = 'Bases de Datos', creditos = '8'): Promise<void> {
    escribir('nombre', nombre);
    escribir('creditos', creditos);
    await elegirMaestro('Gómez');
  }

  async function enviar(): Promise<void> {
    harness.fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await asentar();
  }

  function guardado(): TestRequest {
    return http.expectOne((solicitud) => solicitud.url.startsWith(URL));
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

  function pulsar(etiqueta: string): void {
    const boton = [...harness.fixture.nativeElement.querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http.verify();
  });

  describe('alta', () => {
    it('abre vacío y sólo pide los maestros del desplegable', async () => {
      await abrir('/materias/nueva');

      expect(texto()).toContain('Nueva materia');
      expect(campo('nombre').value).toBe('');
      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
    });

    it('ofrece los maestros por apellido', async () => {
      await abrir('/materias/nueva');
      await abrirMaestros();

      expect(opciones()).toEqual(['Pérez, Nombre 1', 'Gómez, Nombre 2']);
    });

    it('registra con POST, mandando el maestro por id y el nombre recortado', async () => {
      await abrir('/materias/nueva');
      await rellenar('  Bases de Datos  ');
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.url).toBe(URL);
      expect(peticion.request.body).toEqual({
        nombre: 'Bases de Datos',
        creditos: 8,
        maestroId: 2,
      });
      peticion.flush(MATERIA, { status: 201, statusText: 'Created' });
      await harness.fixture.whenStable();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir('/materias/nueva');
      await enviar();

      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('Los créditos son obligatorios');
      expect(texto()).toContain('Elige el maestro que la imparte');
    });

    it('no manda unos créditos fuera de lo que acepta la API', async () => {
      // El `@Max(20)` de la API los devolvería como un 400 después del viaje.
      await abrir('/materias/nueva');
      await rellenar('Álgebra', '30');
      await enviar();

      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
      expect(texto()).toContain('Los créditos no pueden pasar de 20');
    });

    it('vuelve al listado conservando la página desde la que se entró', async () => {
      await abrir('/materias/nueva?page=2&size=50&sort=creditos,desc');
      await rellenar();
      await enviar();
      guardado().flush(MATERIA, { status: 201, statusText: 'Created' });
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/materias?page=2&size=50&sort=creditos,desc');
    });

    it('confirma el alta al volver', async () => {
      await abrir('/materias/nueva');
      await rellenar();
      await enviar();
      // Nombre distinto al de los demás tests: el overlay del aviso cuelga del
      // `body` y sobrevive al fixture, así que uno de otro test lo daría por
      // bueno sin haber comprobado nada.
      guardado().flush(
        { ...MATERIA, nombre: 'Termodinámica' },
        { status: 201, statusText: 'Created' },
      );
      await asentar();

      expect(document.body.textContent).toContain('Materia Termodinámica registrada.');
    });
  });

  describe('edición', () => {
    it('pide la ficha y precarga los campos, el maestro incluido', async () => {
      await editar();

      expect(texto()).toContain('Editar materia');
      expect(campo('nombre').value).toBe('Bases de Datos');
      expect(campo('creditos').value).toBe('8');
      expect(harness.fixture.nativeElement.querySelector('mat-select').textContent).toContain(
        'Gómez',
      );
    });

    it('guarda con PUT al mismo recurso', async () => {
      await editar();
      escribir('creditos', '6');
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.url).toBe(`${URL}/7`);
      expect(peticion.request.body).toEqual({
        nombre: 'Bases de Datos',
        creditos: 6,
        maestroId: 2,
      });
      peticion.flush({ ...MATERIA, creditos: 6 });
      await harness.fixture.whenStable();
    });

    it('ofrece el maestro que ya tenía aunque no venga en la lista', async () => {
      // La API devuelve como mucho cien maestros: en una escuela grande el de
      // esta materia puede quedarse fuera. Sin la opción de respaldo el
      // desplegable se dibujaría vacío, como si la materia no tuviera maestro, y
      // editarla para cambiar el nombre la reasignaría sin querer.
      await abrir('/materias/7/editar', { ...MAESTROS, content: [maestro(1, 'Pérez')] });
      http.expectOne(`${URL}/7`).flush(MATERIA);
      await harness.fixture.whenStable();

      await abrirMaestros();
      expect(opciones()).toEqual(['Pérez, Nombre 1', 'Laura Gómez']);
    });

    it('avisa cuando el id de la dirección no es una materia', async () => {
      // Sin esta comprobación `/materias/abc/editar` abriría un alta encubierta
      // y el primer guardado crearía una materia que nadie pidió.
      await abrir('/materias/abc/editar');

      expect(texto()).toContain('La dirección no apunta a ninguna materia');
      expect(harness.fixture.nativeElement.querySelector('form')).toBeNull();
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir('/materias/7/editar');
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Materia con id 7 no encontrado' },
          { status: 404, statusText: 'Not Found' },
        );
      await harness.fixture.whenStable();

      expect(texto()).toContain('Materia con id 7 no encontrado');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(MATERIA);
      await harness.fixture.whenStable();

      expect(campo('nombre').value).toBe('Bases de Datos');
    });

    it('cancelar vuelve al listado sin guardar nada', async () => {
      await editar('/materias/7/editar?page=3');
      escribir('nombre', 'Otra cosa');

      pulsar('Cancelar');
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/materias?page=3');
    });
  });

  describe('errores de la API', () => {
    it('un maestro que ya no existe se explica en su campo y refresca la lista', async () => {
      // La API busca al maestro antes de guardar, así que responde 404 —no 400—
      // con "Maestro con id 2 no encontrado": un id que quien rellenó el
      // formulario nunca vio, porque eligió un nombre en una lista.
      await abrir('/materias/nueva');
      await rellenar();
      await enviar();
      guardado().flush(
        { status: 404, message: 'Maestro con id 2 no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
      await asentar();

      const contenedor = harness.fixture.nativeElement.querySelector('mat-select') as HTMLElement;
      expect(contenedor.closest('mat-form-field')!.textContent).toContain(
        'Ese maestro ya no existe',
      );
      expect(texto()).not.toContain('con id 2');

      // Y se vuelve a pedir la lista: sin eso, el desplegable seguiría
      // ofreciendo al maestro que acaba de desaparecer.
      http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(MAESTROS);
    });

    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir('/materias/nueva');
      await rellenar();
      await enviar();
      guardado().flush(
        {
          status: 400,
          message: 'Error de validación en los datos enviados',
          detalles: { nombre: 'El nombre no puede exceder 100 caracteres' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      expect(texto()).toContain('El nombre no puede exceder 100 caracteres');
      expect(TestBed.inject(Router).url).toContain('/materias/nueva');
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir('/materias/nueva');
      await rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar la materia.');
    });
  });
});
