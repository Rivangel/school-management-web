import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Materia, Rol } from '../../../core/models';
import { MI_MAESTRO, atenderMiMaestro } from '../../../core/services/testing/mi-maestro-falso';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DatosDetalleMateria, DetalleMateria, ResultadoDetalleMateria } from './detalle-materia';

const URL = `${environment.apiUrl}/materias`;
const URL_MAESTROS = `${environment.apiUrl}/maestros`;

const MATERIA: Materia = {
  id: 7,
  nombre: 'Bases de Datos',
  creditos: 8,
  maestroId: 2,
  maestroNombre: 'Laura Gómez',
};

/** Destino de los enlaces a calificaciones/asistencia: aquí sólo interesa que se navegue. */
@Component({ template: 'destino' })
class DestinoFalso {}

describe('DetalleMateria', () => {
  let http: HttpTestingController;
  let dialogo: MatDialog;
  let cerrado: Promise<ResultadoDetalleMateria>;

  async function abrir(id = 7, rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      // `RouterLink` (enlaces a calificaciones/asistencia) necesita el
      // inyector del router aunque el test no navegue de verdad.
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'calificaciones/materia', component: DestinoFalso },
          { path: 'asistencia/registrar', component: DestinoFalso },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.inject(MatDialog);

    const referencia = dialogo.open<DetalleMateria, DatosDetalleMateria, ResultadoDetalleMateria>(
      DetalleMateria,
      { data: { id } },
    );
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
  }

  /** Lo de siempre: abrir la ficha y responder con la materia. */
  async function montar(url_id = 7, rol: Rol = 'ADMIN', materia: Materia = MATERIA): Promise<void> {
    await abrir(url_id, rol);
    http.expectOne(`${URL}/${url_id}`).flush(materia);
    // Un MAESTRO además pregunta quién es, para saber si la materia es suya.
    atenderMiMaestro(http);
    await asentar();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    TestBed.tick();
  }

  /**
   * Espera a que se abra un diálogo **anidado**, que llega tras un `import()`
   * dinámico. Sondea hasta que hay uno más de los que había, en vez de
   * esperar un tiempo fijo: cuánto tarda el `import()` varía con la carga de
   * la máquina.
   */
  async function asentarDialogoAnidado(): Promise<void> {
    const habiaAntes = document.querySelectorAll('mat-dialog-container').length;
    const limite = Date.now() + 2000;
    while (document.querySelectorAll('mat-dialog-container').length <= habiaAntes) {
      if (Date.now() > limite) {
        throw new Error('El diálogo anidado no llegó a abrirse a tiempo.');
      }
      await new Promise((listo) => setTimeout(listo, 15));
      TestBed.tick();
    }
  }

  function contenedor(): HTMLElement {
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  function texto(): string {
    return contenedor().textContent as string;
  }

  function pulsar(etiqueta: string, raiz: ParentNode = contenedor()): void {
    const boton = [...raiz.querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
  }

  async function pulsarEnElDialogoAnidado(etiqueta: string): Promise<void> {
    const cerradoAnidado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());
    const contenedores = [...document.querySelectorAll('mat-dialog-container')];
    const anidado = contenedores[contenedores.length - 1] as HTMLElement;
    const boton = [...anidado.querySelectorAll('button')].find((candidato) =>
      candidato.textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
    await cerradoAnidado;
    await asentar();
  }

  async function confirmarBorrado(): Promise<void> {
    pulsar('Eliminar');
    await asentar();
    await pulsarEnElDialogoAnidado('Eliminar');
  }

  afterEach(async () => {
    const d = TestBed.inject(MatDialog);
    if (d.openDialogs.length > 0) {
      const cerradoDelTodo = firstValueFrom(d.afterAllClosed);
      d.closeAll();
      await cerradoDelTodo;
    }
    http.verify();
  });

  it('enseña los datos de la materia', async () => {
    await montar();

    expect(texto()).toContain('Bases de Datos');
    expect(texto()).toContain('8');
    expect(texto()).toContain('Laura Gómez');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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

    expect(texto()).toContain('Bases de Datos');
  });

  it('pregunta nombrando la materia y a su maestro antes de eliminar', async () => {
    // Es lo que distingue dos "Álgebra" en una lista: una materia no tiene
    // matrícula ni ningún otro identificador humano.
    await montar();
    pulsar('Eliminar');
    await asentar();

    expect(document.body.textContent).toContain('Se va a eliminar Bases de Datos (Laura Gómez)');
  });

  it('cancelar no borra nada', async () => {
    await montar();
    pulsar('Eliminar');
    await asentar();

    await pulsarEnElDialogoAnidado('Cancelar');

    http.expectNone(() => true);
    expect(await Promise.race([cerrado, Promise.resolve('sigue-abierta')])).toBe('sigue-abierta');
  });

  it('confirmar borra y cierra la ficha avisando al listado de que recargue', async () => {
    await montar();
    await confirmarBorrado();

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(await cerrado).toBeUndefined();
  });

  it('el 409 nombra las dos causas posibles, sin adivinar una', async () => {
    // La API responde con su frase sobre restricciones de datos, que es exacta y
    // no le sirve a nadie. Desde aquí no se distingue si lo que estorba son las
    // calificaciones o las asistencias: mandar a buscar donde quizá no hay nada
    // sería peor que nombrar las dos.
    await montar();
    await confirmarBorrado();

    http.expectOne(`${URL}/7`).flush(
      {
        status: 409,
        message:
          'La operación viola una restricción de datos (valor duplicado o referencia inexistente)',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await asentar();

    expect(texto()).toContain('tiene calificaciones o asistencias registradas');
    expect(texto()).not.toContain('restricción de datos');
    expect(await Promise.race([cerrado, Promise.resolve('sigue-abierta')])).toBe('sigue-abierta');
  });

  it('el fallo se enseña en la ficha, no como aviso flotante', async () => {
    await montar();
    await confirmarBorrado();
    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    const enLaFicha = contenedor().querySelector('.ficha__error') as HTMLElement;
    expect(enLaFicha.textContent).toContain('tiene calificaciones o asistencias');
    expect(texto()).toContain('Bases de Datos');
  });

  it('otro fallo cualquiera se explica con el mensaje de la API', async () => {
    await montar();
    await confirmarBorrado();
    http
      .expectOne(`${URL}/7`)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await asentar();

    expect(texto()).toContain('La base de datos no responde');
  });

  it('el ALUMNO consulta la ficha pero no puede tocarla', async () => {
    await montar(7, 'ALUMNO');

    expect(texto()).toContain('Bases de Datos');
    expect(texto()).not.toContain('Eliminar');
  });

  it('el maestro es un botón que abre su ficha, para quien puede abrir esa sección', async () => {
    await montar(7, 'MAESTRO');

    pulsar('Laura Gómez');
    await asentarDialogoAnidado();
    http.expectOne(`${URL_MAESTROS}/2`).flush({
      id: 2,
      nombre: 'Laura',
      apellido: 'Gómez',
      especialidad: 'Bases de Datos',
      email: 'laura@escuela.com',
    });
    await asentar();

    const contenedores = [...document.querySelectorAll('mat-dialog-container')];
    expect(contenedores).toHaveLength(2);
    expect((contenedores[1] as HTMLElement).textContent).toContain('Laura Gómez');
  });

  it('para el ALUMNO el maestro es texto, no un botón: la sección le está cerrada', async () => {
    await montar(7, 'ALUMNO');

    expect(texto()).toContain('Laura Gómez');
    expect(contenedor().querySelector('.ficha__enlace-en-linea')).toBeNull();
  });

  it('enlaza a las calificaciones de la materia y cierra la ficha al ir', async () => {
    await montar();

    const enlace = contenedor().querySelector(
      'a[href^="/calificaciones/materia"]',
    ) as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toContain('materiaId=7');

    enlace.click();
    await asentar();
    expect(await cerrado).toBeUndefined();
  });

  it('el ALUMNO no ve ese enlace: son las notas de su grupo', async () => {
    await montar(7, 'ALUMNO');

    expect(contenedor().querySelector('a[href^="/calificaciones"]')).toBeNull();
  });

  it('enlaza a pasar lista de la materia', async () => {
    await montar();

    const enlace = contenedor().querySelector(
      'a[href^="/asistencia/registrar"]',
    ) as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toContain('materiaId=7');
  });

  it('editar cierra la ficha pidiendo el formulario, sin abrirlo ella misma', async () => {
    await montar();
    pulsar('Editar');
    await asentar();

    expect(await cerrado).toBe('editar');
  });

  describe('la regla de propiedad de la materia', () => {
    /** Como `montar`, pero eligiendo de quién es la materia. */
    async function montarMateriaDe(maestroId: number, rol: Rol = 'MAESTRO'): Promise<void> {
      await abrir(7, rol);
      http.expectOne(`${URL}/7`).flush({ ...MATERIA, maestroId });
      atenderMiMaestro(http);
      await asentar();
    }

    it('el MAESTRO puede pasar lista en la materia que imparte', async () => {
      await montarMateriaDe(MI_MAESTRO.id);

      expect(contenedor().querySelector('a[href^="/asistencia/registrar"]')).not.toBeNull();
      expect(texto()).toContain('Impartes esta materia');
    });

    it('en la de otro maestro no: la API responde 403 y el botón sería un error', async () => {
      await montarMateriaDe(MI_MAESTRO.id + 1);

      expect(contenedor().querySelector('a[href^="/asistencia/registrar"]')).toBeNull();
    });

    it('y se dice por qué, para que la ausencia no parezca una avería', async () => {
      await montarMateriaDe(MI_MAESTRO.id + 1);

      expect(texto()).toContain('la imparte otro maestro');
    });

    it('sigue pudiendo consultar sus calificaciones: leer sí lo deja la API', async () => {
      await montarMateriaDe(MI_MAESTRO.id + 1);

      expect(contenedor().querySelector('a[href^="/calificaciones/materia"]')).not.toBeNull();
    });

    it('al ADMIN no se le pregunta quién es y pasa lista en cualquiera', async () => {
      await abrir(7, 'ADMIN');
      http.expectOne(`${URL}/7`).flush({ ...MATERIA, maestroId: 99 });
      const preguntoQuienEs = atenderMiMaestro(http);
      await asentar();

      expect(preguntoQuienEs).toBe(false);
      expect(contenedor().querySelector('a[href^="/asistencia/registrar"]')).not.toBeNull();
      expect(texto()).not.toContain('la imparte otro maestro');
    });

    it('al ALUMNO no se le explica una regla que no es la suya', async () => {
      await abrir(7, 'ALUMNO');
      http.expectOne(`${URL}/7`).flush({ ...MATERIA, maestroId: 99 });
      atenderMiMaestro(http);
      await asentar();

      expect(texto()).not.toContain('la imparte otro maestro');
      expect(texto()).not.toContain('Impartes esta materia');
    });
  });
});
