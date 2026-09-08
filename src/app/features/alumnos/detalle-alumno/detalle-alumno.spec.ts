import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Alumno, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DatosDetalleAlumno, DetalleAlumno, ResultadoDetalleAlumno } from './detalle-alumno';

const URL = `${environment.apiUrl}/alumnos`;

const ALUMNO: Alumno = {
  id: 7,
  nombre: 'Ana',
  apellido: 'López',
  matricula: 'A-001',
  email: 'ana@escuela.com',
  grupo: '1A',
};

describe('DetalleAlumno', () => {
  let http: HttpTestingController;
  let dialogo: MatDialog;
  let cerrado: Promise<ResultadoDetalleAlumno>;

  async function abrir(id = 7, rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      // `RouterLink` (enlaces a calificaciones/asistencia) necesita el
      // inyector del router aunque el test no navegue de verdad.
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.inject(MatDialog);

    const referencia = dialogo.open<DetalleAlumno, DatosDetalleAlumno, ResultadoDetalleAlumno>(
      DetalleAlumno,
      { data: { id } },
    );
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
  }

  /** Lo de siempre: abrir la ficha y responder con el alumno. */
  async function montar(id = 7, rol: Rol = 'ADMIN'): Promise<void> {
    await abrir(id, rol);
    http.expectOne(`${URL}/7`).flush(ALUMNO);
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

  function texto(): string {
    return contenedor().textContent as string;
  }

  function pulsar(etiqueta: string): void {
    const boton = [...contenedor().querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
  }

  /**
   * Pulsa un botón de un diálogo **anidado** (confirmar, o el formulario de
   * edición), que se abre encima de éste.
   *
   * La espera no es cosmética: `afterClosed()` emite cuando termina la
   * animación de salida, así que sin ella el borrado todavía no se ha lanzado
   * cuando el test va a buscar la petición.
   */
  async function pulsarEnElDialogoAnidado(etiqueta: string): Promise<void> {
    const contenedores = [...document.querySelectorAll('mat-dialog-container')];
    const anidado = contenedores[contenedores.length - 1] as HTMLElement;
    const cerradoAnidado = firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());
    const boton = [...anidado.querySelectorAll('button')].find((candidato) =>
      candidato.textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
    await cerradoAnidado;
    await asentar();
  }

  afterEach(async () => {
    // Espera a que el DOM del diálogo se retire de verdad: sin esto, el
    // contenedor del test anterior puede seguir siendo el primero que
    // encuentra `document.querySelector` en el siguiente.
    const dialogo = TestBed.inject(MatDialog);
    if (dialogo.openDialogs.length > 0) {
      const cerradoDelTodo = firstValueFrom(dialogo.afterAllClosed);
      dialogo.closeAll();
      await cerradoDelTodo;
    }
    http.verify();
  });

  it('enseña los datos del alumno', async () => {
    await montar();

    expect(texto()).toContain('Ana López');
    expect(texto()).toContain('A-001');
    expect(texto()).toContain('ana@escuela.com');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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

    expect(texto()).toContain('Ana López');
  });

  it('pregunta con el nombre dentro antes de eliminar', async () => {
    // Nombrar a quien se va a borrar es lo que distingue "sí, a esta persona"
    // de "sí, lo que sea que estuviera pulsando".
    await montar();
    pulsar('Eliminar');
    await asentar();

    expect(document.body.textContent).toContain('Se va a eliminar a Ana López (A-001)');
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
    pulsar('Eliminar');
    await asentar();

    await pulsarEnElDialogoAnidado('Eliminar');

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(await cerrado).toBeUndefined();
  });

  it('un borrado fallido deja la ficha donde estaba', async () => {
    // Del mensaje se encarga el interceptor global; aquí lo que importa es que
    // la ficha no se cierre como si hubiera funcionado.
    await montar();
    pulsar('Eliminar');
    await asentar();
    await pulsarEnElDialogoAnidado('Eliminar');

    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    expect(await Promise.race([cerrado, Promise.resolve('sigue-abierta')])).toBe('sigue-abierta');
    expect(texto()).toContain('Ana López');
  });

  it('el MAESTRO consulta la ficha pero no puede tocarla', async () => {
    await montar(7, 'MAESTRO');

    expect(texto()).toContain('Ana López');
    expect(texto()).not.toContain('Eliminar');
    expect(texto()).not.toContain('Editar');
  });

  it('enlaza a las calificaciones del alumno', async () => {
    // La consulta toma el alumno de la URL, así que desde aquí basta un enlace.
    await montar();

    const enlace = contenedor().querySelector('a[href^="/calificaciones"]') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toContain('alumnoId=7');
  });

  it('editar cierra la ficha pidiendo el formulario, sin abrirlo ella misma', async () => {
    // Abrir el formulario **encima** de la ficha no tiene ninguna ventaja y
    // complica quién refresca qué; la ficha se limita a pedirlo al cerrarse,
    // y es el listado (ver `lista-alumnos.spec.ts`) quien lo abre de verdad.
    await montar();
    pulsar('Editar');
    await asentar();

    expect(await cerrado).toBe('editar');
  });
});
