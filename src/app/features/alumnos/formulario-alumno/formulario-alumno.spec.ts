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
import { Alumno } from '../../../core/models';
import { FormularioAlumno } from './formulario-alumno';

const URL = `${environment.apiUrl}/alumnos`;

const ALUMNO: Alumno = {
  id: 7,
  nombre: 'Ana',
  apellido: 'López',
  matricula: 'A-001',
  email: 'ana@escuela.com',
  grupo: '1A',
};

/** Destino del "Cancelar" y del guardado: aquí sólo interesa la URL a la que va. */
@Component({ template: 'listado' })
class ListadoFalso {}

/** Cuerpo de un 400 de validación, el único que trae desglose por campo. */
function errorDeValidacion(detalles: Record<string, string>) {
  return {
    status: 400,
    error: 'Bad Request',
    message: 'Error de validación en los datos enviados',
    path: '/api/alumnos',
    detalles,
  };
}

describe('FormularioAlumno', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'alumnos', component: ListadoFalso },
          { path: 'alumnos/nuevo', component: FormularioAlumno },
          { path: 'alumnos/:id/editar', component: FormularioAlumno },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Abre la edición y responde con la ficha, que es el punto de partida normal. */
  async function editar(url = '/alumnos/7/editar', ficha: Alumno = ALUMNO): Promise<void> {
    await abrir(url);
    http.expectOne(`${URL}/7`).flush(ficha);
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
    const { id: _sinId, ...campos } = ALUMNO;
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
      await abrir('/alumnos/nuevo');

      expect(texto()).toContain('Nuevo alumno');
      expect(campo('nombre').value).toBe('');
    });

    it('registra con POST a la colección', async () => {
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.url).toBe(URL);
      expect(peticion.request.body).toEqual({
        nombre: 'Ana',
        apellido: 'López',
        matricula: 'A-001',
        email: 'ana@escuela.com',
        grupo: '1A',
      });
      peticion.flush(ALUMNO, { status: 201, statusText: 'Created' });
      await harness.fixture.whenStable();
    });

    it('recorta los espacios antes de enviar', async () => {
      // La API recorta por su cuenta; esto evita que el alumno guardado difiera
      // de lo que se escribió.
      await abrir('/alumnos/nuevo');
      rellenar({ nombre: '  Ana  ', matricula: ' A-001 ' });
      await enviar();

      const peticion = guardado();
      expect(peticion.request.body.nombre).toBe('Ana');
      expect(peticion.request.body.matricula).toBe('A-001');
      peticion.flush(ALUMNO, { status: 201, statusText: 'Created' });
      await harness.fixture.whenStable();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir('/alumnos/nuevo');
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('El correo es obligatorio');
    });

    it('rechaza un campo que sólo tiene espacios', async () => {
      // `Validators.required` lo daría por bueno y el `@NotBlank` de la API lo
      // devolvería como un 400 después del viaje.
      await abrir('/alumnos/nuevo');
      rellenar({ nombre: '   ' });
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
    });

    it('vuelve al listado conservando la página desde la que se entró', async () => {
      // El listado guarda su estado en la URL: sin `preserve`, guardar devuelve
      // siempre a la primera página.
      await abrir('/alumnos/nuevo?page=2&size=50&sort=grupo,desc');
      rellenar();
      await enviar();
      guardado().flush(ALUMNO, { status: 201, statusText: 'Created' });
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/alumnos?page=2&size=50&sort=grupo,desc');
    });

    it('confirma el alta al volver', async () => {
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();
      guardado().flush(ALUMNO, { status: 201, statusText: 'Created' });
      await asentar();

      // El aviso vive en un overlay, fuera del elemento del componente.
      expect(document.body.textContent).toContain('Alumno Ana López registrado.');
    });
  });

  describe('edición', () => {
    it('pide la ficha y precarga los campos', async () => {
      await editar();

      expect(texto()).toContain('Editar alumno');
      expect(campo('nombre').value).toBe('Ana');
      expect(campo('matricula').value).toBe('A-001');
    });

    it('guarda con PUT al mismo recurso', async () => {
      await editar();
      escribir('grupo', '2B');
      await enviar();

      const peticion = guardado();
      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.url).toBe(`${URL}/7`);
      expect(peticion.request.body.grupo).toBe('2B');
      peticion.flush({ ...ALUMNO, grupo: '2B' });
      await harness.fixture.whenStable();
    });

    it('avisa cuando el id de la dirección no es un alumno', async () => {
      // Sin esta comprobación `/alumnos/abc/editar` abriría un alta encubierta y
      // el primer guardado crearía un alumno que nadie pidió.
      await abrir('/alumnos/abc/editar');

      expect(texto()).toContain('La dirección no apunta a ningún alumno');
      expect(harness.fixture.nativeElement.querySelector('form')).toBeNull();
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir('/alumnos/7/editar');
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Alumno no encontrado con id: 7' },
          { status: 404, statusText: 'Not Found' },
        );
      await harness.fixture.whenStable();

      expect(texto()).toContain('Alumno no encontrado con id: 7');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(ALUMNO);
      await harness.fixture.whenStable();

      expect(campo('nombre').value).toBe('Ana');
    });

    it('cancelar vuelve al listado sin guardar nada', async () => {
      await editar('/alumnos/7/editar?page=3');
      escribir('nombre', 'Otro');

      pulsar('Cancelar');
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/alumnos?page=3');
    });
  });

  describe('errores de la API', () => {
    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();
      guardado().flush(errorDeValidacion({ grupo: 'El grupo no puede exceder 10 caracteres' }), {
        status: 400,
        statusText: 'Bad Request',
      });
      await asentar();

      expect(texto()).toContain('El grupo no puede exceder 10 caracteres');
      expect(TestBed.inject(Router).url).toContain('/alumnos/nuevo');
    });

    it('señala la matrícula repetida en su propio campo', async () => {
      // Es un 400 de negocio: llega como una frase suelta, sin `detalles`.
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();
      guardado().flush(
        { status: 400, message: 'Ya existe un alumno con la matrícula A-001' },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      const contenedor = campo('matricula').closest('mat-form-field') as HTMLElement;
      expect(contenedor.textContent).toContain('Ya existe un alumno con la matrícula A-001');
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar el alumno.');
    });

    it('deja volver a enviar en cuanto se corrige el campo señalado', async () => {
      await abrir('/alumnos/nuevo');
      rellenar();
      await enviar();
      guardado().flush(
        { status: 400, message: 'Ya existe un alumno con la matrícula A-001' },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      escribir('matricula', 'A-002');
      await enviar();

      const peticion = guardado();
      expect(peticion.request.body.matricula).toBe('A-002');
      peticion.flush(ALUMNO, { status: 201, statusText: 'Created' });
      await harness.fixture.whenStable();
    });
  });
});
