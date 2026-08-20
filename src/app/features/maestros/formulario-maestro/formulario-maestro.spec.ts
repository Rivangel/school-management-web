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
import { Maestro } from '../../../core/models';
import { FormularioMaestro } from './formulario-maestro';

const URL = `${environment.apiUrl}/maestros`;

const MAESTRO: Maestro = {
  id: 7,
  nombre: 'Carlos',
  apellido: 'Ruiz',
  email: 'carlos@escuela.com',
  especialidad: 'Matemáticas',
};

/** Destino del "Cancelar" y del guardado: aquí sólo interesa la URL a la que va. */
@Component({ template: 'listado' })
class ListadoFalso {}

describe('FormularioMaestro', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'maestros', component: ListadoFalso },
          { path: 'maestros/nuevo', component: FormularioMaestro },
          { path: 'maestros/:id/editar', component: FormularioMaestro },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Abre la edición y responde con la ficha, que es el punto de partida normal. */
  async function editar(url = '/maestros/7/editar'): Promise<void> {
    await abrir(url);
    http.expectOne(`${URL}/7`).flush(MAESTRO);
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

  function rellenar(valores: Partial<Record<string, string>> = {}): void {
    const { id: _sinId, ...campos } = MAESTRO;
    const datos: Record<string, string> = { ...campos, ...valores };
    for (const [nombre, valor] of Object.entries(datos)) {
      escribir(nombre, valor);
    }
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
    it('abre el formulario vacío y sin pedir nada a la API', async () => {
      await abrir('/maestros/nuevo');

      expect(texto()).toContain('Nuevo maestro');
      expect(campo('nombre').value).toBe('');
    });

    it('registra con POST a la colección, con los campos recortados', async () => {
      await abrir('/maestros/nuevo');
      rellenar({ especialidad: '  Matemáticas  ' });
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.url).toBe(URL);
      expect(peticion.request.body).toEqual({
        nombre: 'Carlos',
        apellido: 'Ruiz',
        especialidad: 'Matemáticas',
        email: 'carlos@escuela.com',
      });
      peticion.flush(MAESTRO, { status: 201, statusText: 'Created' });
      await harness.fixture.whenStable();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir('/maestros/nuevo');
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('La especialidad es obligatoria');
    });

    it('una especialidad de sólo espacios está vacía', async () => {
      // `Validators.required` la daría por buena y el `@NotBlank` de la API la
      // devolvería como un 400 después del viaje.
      await abrir('/maestros/nuevo');
      rellenar({ especialidad: '   ' });
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('La especialidad es obligatoria');
    });

    it('vuelve al listado conservando la página desde la que se entró', async () => {
      await abrir('/maestros/nuevo?page=2&size=50&sort=especialidad,desc');
      rellenar();
      await enviar();
      guardado().flush(MAESTRO, { status: 201, statusText: 'Created' });
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/maestros?page=2&size=50&sort=especialidad,desc');
    });

    it('confirma el alta al volver', async () => {
      await abrir('/maestros/nuevo');
      rellenar();
      await enviar();
      // Nombre distinto al de los demás tests: el overlay del aviso cuelga del
      // `body` y sobrevive al fixture, así que uno de otro test lo daría por
      // bueno sin haber comprobado nada.
      guardado().flush(
        { ...MAESTRO, nombre: 'Elena', apellido: 'Cabrera' },
        { status: 201, statusText: 'Created' },
      );
      await asentar();

      expect(document.body.textContent).toContain('Maestro Elena Cabrera registrado.');
    });
  });

  describe('edición', () => {
    it('pide la ficha y precarga los campos', async () => {
      await editar();

      expect(texto()).toContain('Editar maestro');
      expect(campo('nombre').value).toBe('Carlos');
      expect(campo('especialidad').value).toBe('Matemáticas');
    });

    it('guarda con PUT al mismo recurso', async () => {
      await editar();
      escribir('especialidad', 'Física');
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.url).toBe(`${URL}/7`);
      expect(peticion.request.body.especialidad).toBe('Física');
      peticion.flush({ ...MAESTRO, especialidad: 'Física' });
      await harness.fixture.whenStable();
    });

    it('avisa cuando el id de la dirección no es un maestro', async () => {
      // Sin esta comprobación `/maestros/abc/editar` abriría un alta encubierta
      // y el primer guardado crearía un maestro que nadie pidió.
      await abrir('/maestros/abc/editar');

      expect(texto()).toContain('La dirección no apunta a ningún maestro');
      expect(harness.fixture.nativeElement.querySelector('form')).toBeNull();
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir('/maestros/7/editar');
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Maestro no encontrado con id: 7' },
          { status: 404, statusText: 'Not Found' },
        );
      await harness.fixture.whenStable();

      expect(texto()).toContain('Maestro no encontrado con id: 7');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(MAESTRO);
      await harness.fixture.whenStable();

      expect(campo('nombre').value).toBe('Carlos');
    });

    it('cancelar vuelve al listado sin guardar nada', async () => {
      await editar('/maestros/7/editar?page=3');
      escribir('nombre', 'Otro');

      pulsar('Cancelar');
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/maestros?page=3');
    });
  });

  describe('errores de la API', () => {
    it('señala el correo repetido en su propio campo', async () => {
      // Es el único choque de negocio que comprueba la API de maestros, y llega
      // como una frase suelta, sin el mapa `detalles` de los 400 de validación.
      await abrir('/maestros/nuevo');
      rellenar();
      await enviar();
      guardado().flush(
        { status: 400, message: 'Ya existe un maestro con el email carlos@escuela.com' },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      const contenedor = campo('email').closest('mat-form-field') as HTMLElement;
      expect(contenedor.textContent).toContain('Ya existe un maestro con el email');
    });

    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir('/maestros/nuevo');
      rellenar();
      await enviar();
      guardado().flush(
        {
          status: 400,
          message: 'Error de validación en los datos enviados',
          detalles: { especialidad: 'La especialidad no puede exceder 100 caracteres' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      expect(texto()).toContain('La especialidad no puede exceder 100 caracteres');
      expect(TestBed.inject(Router).url).toContain('/maestros/nuevo');
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir('/maestros/nuevo');
      rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar el maestro.');
    });
  });
});
