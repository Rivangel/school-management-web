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

describe('FormularioMaestro', () => {
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

    const referencia = dialogo.open(FormularioMaestro, { data: { id } });
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
  }

  /** Abre la edición y responde con la ficha, que es el punto de partida normal. */
  async function editar(id = 7): Promise<void> {
    await abrir(id);
    http.expectOne(`${URL}/${id}`).flush(MAESTRO);
    await asentar();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    TestBed.tick();
  }

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
    const { id: _sinId, ...campos } = MAESTRO;
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

      expect(texto()).toContain('Nuevo maestro');
      expect(campo('nombre').value).toBe('');
    });

    it('registra con POST a la colección, con los campos recortados', async () => {
      await abrir();
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
      await asentar();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir();
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('La especialidad es obligatoria');
    });

    it('una especialidad de sólo espacios está vacía', async () => {
      // `Validators.required` la daría por buena y el `@NotBlank` de la API la
      // devolvería como un 400 después del viaje.
      await abrir();
      rellenar({ especialidad: '   ' });
      await enviar();

      http.expectNone(() => true);
      expect(texto()).toContain('La especialidad es obligatoria');
    });

    it('cierra el diálogo con `true` al guardar, para que el listado recargue', async () => {
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(MAESTRO, { status: 201, statusText: 'Created' });
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
      await asentar();
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir(7);
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Maestro no encontrado con id: 7' },
          { status: 404, statusText: 'Not Found' },
        );
      await asentar();

      expect(texto()).toContain('Maestro no encontrado con id: 7');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(MAESTRO);
      await asentar();

      expect(campo('nombre').value).toBe('Carlos');
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
    it('señala el correo repetido en su propio campo', async () => {
      // Es el único choque de negocio que comprueba la API de maestros, y llega
      // como una frase suelta, sin el mapa `detalles` de los 400 de validación.
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(
        { status: 400, message: 'Ya existe un maestro con el email carlos@escuela.com' },
        { status: 400, statusText: 'Bad Request' },
      );
      await asentar();

      const contenedorDelCampo = campo('email').closest('mat-form-field') as HTMLElement;
      expect(contenedorDelCampo.textContent).toContain('Ya existe un maestro con el email');
    });

    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir();
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
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir();
      rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar el maestro.');
    });
  });
});
