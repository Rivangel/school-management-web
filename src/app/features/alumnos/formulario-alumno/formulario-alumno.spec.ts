import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

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
  let dialogo: MatDialog;
  let cerrado: Promise<boolean | undefined>;

  /** Abre el diálogo. Sin `id` es un alta; con `id`, una edición. */
  async function abrir(id?: number): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.inject(MatDialog);

    const referencia = dialogo.open(FormularioAlumno, { data: { id } });
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
  }

  /** Abre la edición y responde con la ficha, que es el punto de partida normal. */
  async function editar(id = 7, ficha: Alumno = ALUMNO): Promise<void> {
    await abrir(id);
    http.expectOne(`${URL}/${id}`).flush(ficha);
    await asentar();
  }

  /** Deja avanzar los `Promise` pendientes y fuerza una detección de cambios global. */
  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    TestBed.tick();
  }

  /** El diálogo se dibuja en un overlay colgado del `body`, no en ningún fixture. */
  function contenedor(): HTMLElement {
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  function campo(nombre: string): HTMLInputElement {
    return contenedor().querySelector(`input[formControlName="${nombre}"]`) as HTMLInputElement;
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
    contenedor().querySelector('form')!.dispatchEvent(new Event('submit'));
    await asentar();
  }

  function guardado(): TestRequest {
    return http.expectOne((solicitud) => solicitud.url.startsWith(URL));
  }

  function texto(): string {
    return contenedor().textContent as string;
  }

  function pulsar(etiqueta: string): void {
    const boton = [...contenedor().querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
  }

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  describe('alta', () => {
    it('abre el formulario vacío y sin pedir nada a la API', async () => {
      await abrir();

      expect(texto()).toContain('Nuevo alumno');
      expect(campo('nombre').value).toBe('');
    });

    it('registra con POST a la colección', async () => {
      await abrir();
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
      await asentar();
    });

    it('recorta los espacios antes de enviar', async () => {
      // La API recorta por su cuenta; esto evita que el alumno guardado difiera
      // de lo que se escribió.
      await abrir();
      rellenar({ nombre: '  Ana  ', matricula: ' A-001 ' });
      await enviar();

      const peticion = guardado();
      expect(peticion.request.body.nombre).toBe('Ana');
      expect(peticion.request.body.matricula).toBe('A-001');
      peticion.flush(ALUMNO, { status: 201, statusText: 'Created' });
      await asentar();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir();
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('El correo es obligatorio');
    });

    it('rechaza un campo que sólo tiene espacios', async () => {
      // `Validators.required` lo daría por bueno y el `@NotBlank` de la API lo
      // devolvería como un 400 después del viaje.
      await abrir();
      rellenar({ nombre: '   ' });
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
    });

    it('cierra el diálogo con `true` al guardar, para que el listado recargue', async () => {
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(ALUMNO, { status: 201, statusText: 'Created' });
      await asentar();

      expect(await cerrado).toBe(true);
    });

    it('confirma el alta', async () => {
      await abrir();
      rellenar();
      await enviar();
      // Nombre distinto al de los demás tests: el overlay del aviso cuelga del
      // `body` y sobrevive al fixture, así que uno de otro test lo daría por
      // bueno sin haber comprobado nada.
      guardado().flush(
        { ...ALUMNO, nombre: 'Beatriz', apellido: 'Núñez' },
        { status: 201, statusText: 'Created' },
      );
      await asentar();

      expect(document.body.textContent).toContain('Alumno Beatriz Núñez registrado.');
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
      await asentar();
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir(7);
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Alumno no encontrado con id: 7' },
          { status: 404, statusText: 'Not Found' },
        );
      await asentar();

      expect(texto()).toContain('Alumno no encontrado con id: 7');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(ALUMNO);
      await asentar();

      expect(campo('nombre').value).toBe('Ana');
    });

    it('cancelar cierra el diálogo con `false`, sin guardar nada', async () => {
      await editar();
      escribir('nombre', 'Otro');

      pulsar('Cancelar');
      await asentar();

      expect(await cerrado).toBe(false);
    });
  });

  describe('errores de la API', () => {
    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(errorDeValidacion({ grupo: 'El grupo no puede exceder 10 caracteres' }), {
        status: 400,
        statusText: 'Bad Request',
      });
      await asentar();

      expect(texto()).toContain('El grupo no puede exceder 10 caracteres');
    });

    it('señala la matrícula repetida en su propio campo', async () => {
      // Es un 400 de negocio: llega como una frase suelta, sin `detalles`.
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(
        { status: 400, message: 'Ya existe un alumno con la matrícula A-001' },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      const contenedorDelCampo = campo('matricula').closest('mat-form-field') as HTMLElement;
      expect(contenedorDelCampo.textContent).toContain('Ya existe un alumno con la matrícula A-001');
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar el alumno.');
    });

    it('deja volver a enviar en cuanto se corrige el campo señalado', async () => {
      await abrir();
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
      await asentar();
    });
  });
});
