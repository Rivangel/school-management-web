import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Alumno, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DetalleAlumno } from './detalle-alumno';

const URL = `${environment.apiUrl}/alumnos`;

const ALUMNO: Alumno = {
  id: 7,
  nombre: 'Ana',
  apellido: 'López',
  matricula: 'A-001',
  email: 'ana@escuela.com',
  grupo: '1A',
};

/** Destino de "Volver": aquí sólo interesa la URL a la que se llega. */
@Component({ template: 'listado' })
class ListadoFalso {}

describe('DetalleAlumno', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url = '/alumnos/7', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'alumnos', component: ListadoFalso },
          { path: 'alumnos/:id', component: DetalleAlumno },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Lo de siempre: abrir la ficha y responder con el alumno. */
  async function montar(url = '/alumnos/7', rol: Rol = 'ADMIN'): Promise<void> {
    await abrir(url, rol);
    http.expectOne(`${URL}/7`).flush(ALUMNO);
    await harness.fixture.whenStable();
  }

  /**
   * Deja avanzar la navegación y la detección de cambios **sin** esperar a la
   * respuesta HTTP, que como tarea pendiente colgaría `whenStable()`.
   */
  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
    TestBed.tick();
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

  /**
   * Pulsa un botón del diálogo, que vive en un overlay fuera del fixture, y
   * espera a que cierre de verdad.
   *
   * La espera no es cosmética: `afterClosed()` emite cuando termina la animación
   * de salida, así que sin ella el borrado todavía no se ha lanzado cuando el
   * test va a buscar la petición.
   */
  async function pulsarEnElDialogo(etiqueta: string): Promise<void> {
    const cerrado = firstValueFrom(TestBed.inject(MatDialog).afterAllClosed);
    const boton = [...document.querySelectorAll('mat-dialog-actions button')].find((candidato) =>
      candidato.textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
    await cerrado;
    await asentar();
  }

  afterEach(() => {
    http.verify();
  });

  it('enseña los datos del alumno', async () => {
    await montar();

    expect(texto()).toContain('Ana López');
    expect(texto()).toContain('A-001');
    expect(texto()).toContain('ana@escuela.com');
  });

  it('avisa cuando la dirección no apunta a un alumno', async () => {
    await abrir('/alumnos/abc');

    expect(texto()).toContain('La dirección no apunta a ningún alumno');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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

    await pulsarEnElDialogo('Cancelar');

    http.expectNone(() => true);
    expect(TestBed.inject(Router).url).toBe('/alumnos/7');
  });

  it('confirmar borra y vuelve al listado, a la misma página', async () => {
    await montar('/alumnos/7?page=2&sort=grupo,desc');
    pulsar('Eliminar');
    await asentar();

    await pulsarEnElDialogo('Eliminar');

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/alumnos?page=2&sort=grupo,desc');
  });

  it('un borrado fallido deja la ficha donde estaba', async () => {
    // Del mensaje se encarga el interceptor global; aquí lo que importa es que
    // no se navegue como si hubiera funcionado.
    await montar();
    pulsar('Eliminar');
    await asentar();
    await pulsarEnElDialogo('Eliminar');

    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/alumnos/7');
    expect(texto()).toContain('Ana López');
  });

  it('el MAESTRO consulta la ficha pero no puede tocarla', async () => {
    await montar('/alumnos/7', 'MAESTRO');

    expect(texto()).toContain('Ana López');
    expect(texto()).not.toContain('Eliminar');
    expect(harness.fixture.nativeElement.querySelector('a[href^="/alumnos/7/editar"]')).toBeNull();
  });

  it('volver conserva la página del listado', async () => {
    await montar('/alumnos/7?page=3&size=50');
    pulsar('Volver al listado');
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/alumnos?page=3&size=50');
  });

  it('enlaza a las calificaciones del alumno', async () => {
    // La consulta toma el alumno de la URL, así que desde aquí basta un enlace.
    await montar();

    const enlace = harness.fixture.nativeElement.querySelector(
      'a[href^="/calificaciones"]',
    ) as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toContain('alumnoId=7');
  });
});
