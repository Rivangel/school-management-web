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

describe('FormularioMateria', () => {
  let http: HttpTestingController;
  let dialogo: MatDialog;
  let cerrado: Promise<boolean | undefined>;

  /** Abre el diálogo y responde con los maestros, que se piden siempre al montar. */
  async function abrir(id?: number, maestros: Pagina<Maestro> = MAESTROS): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.inject(MatDialog);

    const referencia = dialogo.open(FormularioMateria, { data: { id } });
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
    http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(maestros);
    await asentar();
  }

  /** Abre la edición y responde con la materia, que es el punto de partida normal. */
  async function editar(id = 7, materia = MATERIA): Promise<void> {
    await abrir(id);
    http.expectOne(`${URL}/${id}`).flush(materia);
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

  /** El desplegable se dibuja en un overlay colgado del `body`, no en el diálogo. */
  async function abrirMaestros(): Promise<void> {
    (contenedor().querySelector('mat-select') as HTMLElement).click();
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
    it('abre vacío y sólo pide los maestros del desplegable', async () => {
      await abrir();

      expect(texto()).toContain('Nueva materia');
      expect(campo('nombre').value).toBe('');
      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
    });

    it('ofrece los maestros por apellido', async () => {
      await abrir();
      await abrirMaestros();

      expect(opciones()).toEqual(['Pérez, Nombre 1', 'Gómez, Nombre 2']);
    });

    it('registra con POST, mandando el maestro por id y el nombre recortado', async () => {
      await abrir();
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
      await asentar();
    });

    it('no envía un formulario incompleto y marca los campos', async () => {
      await abrir();
      await enviar();

      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
      expect(texto()).toContain('El nombre es obligatorio');
      expect(texto()).toContain('Los créditos son obligatorios');
      expect(texto()).toContain('Elige el maestro que la imparte');
    });

    it('no manda unos créditos fuera de lo que acepta la API', async () => {
      // El `@Max(20)` de la API los devolvería como un 400 después del viaje.
      await abrir();
      await rellenar('Álgebra', '30');
      await enviar();

      http.expectNone((solicitud) => solicitud.url.startsWith(URL));
      expect(texto()).toContain('Los créditos no pueden pasar de 20');
    });

    it('cierra el diálogo con `true` al guardar, para que el listado recargue', async () => {
      await abrir();
      await rellenar();
      await enviar();
      guardado().flush(MATERIA, { status: 201, statusText: 'Created' });
      await asentar();

      expect(await cerrado).toBe(true);
    });

    it('confirma el alta', async () => {
      await abrir();
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
      expect(contenedor().querySelector('mat-select')!.textContent).toContain('Gómez');
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
      await asentar();
    });

    it('ofrece el maestro que ya tenía aunque no venga en la lista', async () => {
      // La API devuelve como mucho cien maestros: en una escuela grande el de
      // esta materia puede quedarse fuera. Sin la opción de respaldo el
      // desplegable se dibujaría vacío, como si la materia no tuviera maestro, y
      // editarla para cambiar el nombre la reasignaría sin querer.
      await abrir(7, { ...MAESTROS, content: [maestro(1, 'Pérez')] });
      http.expectOne(`${URL}/7`).flush(MATERIA);
      await asentar();

      await abrirMaestros();
      expect(opciones()).toEqual(['Pérez, Nombre 1', 'Laura Gómez']);
    });

    it('explica el fallo de carga y deja reintentar', async () => {
      await abrir(7);
      http
        .expectOne(`${URL}/7`)
        .flush(
          { message: 'Materia con id 7 no encontrado' },
          { status: 404, statusText: 'Not Found' },
        );
      await asentar();

      expect(texto()).toContain('Materia con id 7 no encontrado');

      pulsar('Reintentar');
      await asentar();
      http.expectOne(`${URL}/7`).flush(MATERIA);
      await asentar();

      expect(campo('nombre').value).toBe('Bases de Datos');
    });

    it('cancelar cierra el diálogo con `false`, sin guardar nada', async () => {
      await editar();
      escribir('nombre', 'Otra cosa');

      pulsar('Cancelar');
      await asentar();

      expect(await cerrado).toBe(false);
    });
  });

  describe('errores de la API', () => {
    it('un maestro que ya no existe se explica en su campo y refresca la lista', async () => {
      // La API busca al maestro antes de guardar, así que responde 404 —no 400—
      // con "Maestro con id 2 no encontrado": un id que quien rellenó el
      // formulario nunca vio, porque eligió un nombre en una lista.
      await abrir();
      await rellenar();
      await enviar();
      guardado().flush(
        { status: 404, message: 'Maestro con id 2 no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
      await asentar();

      const select = contenedor().querySelector('mat-select') as HTMLElement;
      expect(select.closest('mat-form-field')!.textContent).toContain('Ese maestro ya no existe');
      expect(texto()).not.toContain('con id 2');

      // Y se vuelve a pedir la lista: sin eso, el desplegable seguiría
      // ofreciendo al maestro que acaba de desaparecer.
      http.expectOne((solicitud) => solicitud.url === URL_MAESTROS).flush(MAESTROS);
    });

    it('marca el campo que la API desglosa en detalles', async () => {
      await abrir();
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
    });

    it('enseña al pie lo que no sabe colocar en ningún campo', async () => {
      await abrir();
      await rellenar();
      await enviar();
      guardado().flush(null, { status: 500, statusText: 'Server Error' });
      await asentar();

      expect(texto()).toContain('No se pudo guardar la materia.');
    });
  });
});
