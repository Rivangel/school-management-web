import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Materia, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DetalleMateria } from './detalle-materia';

const URL = `${environment.apiUrl}/materias`;

const MATERIA: Materia = {
  id: 7,
  nombre: 'Bases de Datos',
  creditos: 8,
  maestroId: 2,
  maestroNombre: 'Laura Gómez',
};

/** Destino de "Volver": aquí sólo interesa la URL a la que se llega. */
@Component({ template: 'listado' })
class ListadoFalso {}

describe('DetalleMateria', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url = '/materias/7', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'materias', component: ListadoFalso },
          { path: 'materias/:id', component: DetalleMateria },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Lo de siempre: abrir la ficha y responder con la materia. */
  async function montar(url = '/materias/7', rol: Rol = 'ADMIN'): Promise<void> {
    await abrir(url, rol);
    http.expectOne(`${URL}/7`).flush(MATERIA);
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
   * espera a que cierre de verdad: `afterClosed()` emite cuando termina la
   * animación de salida, así que sin la espera el borrado todavía no se ha
   * lanzado cuando el test va a buscar la petición.
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

  /** Abre la confirmación y confirma, que es el camino al DELETE. */
  async function confirmarBorrado(): Promise<void> {
    pulsar('Eliminar');
    await asentar();
    await pulsarEnElDialogo('Eliminar');
  }

  afterEach(() => {
    http.verify();
  });

  it('enseña los datos de la materia', async () => {
    await montar();

    expect(texto()).toContain('Bases de Datos');
    expect(texto()).toContain('8');
    expect(texto()).toContain('Laura Gómez');
  });

  it('avisa cuando la dirección no apunta a una materia', async () => {
    await abrir('/materias/abc');

    expect(texto()).toContain('La dirección no apunta a ninguna materia');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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

    await pulsarEnElDialogo('Cancelar');

    http.expectNone(() => true);
    expect(TestBed.inject(Router).url).toBe('/materias/7');
  });

  it('confirmar borra y vuelve al listado, con el filtro y la página puestos', async () => {
    await montar('/materias/7?page=2&maestroId=2');
    await confirmarBorrado();

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/materias?page=2&maestroId=2');
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
    expect(TestBed.inject(Router).url).toBe('/materias/7');
  });

  it('el fallo se enseña en la ficha, no como aviso flotante', async () => {
    await montar();
    await confirmarBorrado();
    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    const enLaFicha = harness.fixture.nativeElement.querySelector('.ficha__error') as HTMLElement;
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
    await montar('/materias/7', 'ALUMNO');

    expect(texto()).toContain('Bases de Datos');
    expect(texto()).not.toContain('Eliminar');
    expect(harness.fixture.nativeElement.querySelector('a[href^="/materias/7/editar"]')).toBeNull();
  });

  it('el maestro es enlace para quien puede abrir su sección', async () => {
    await montar('/materias/7', 'MAESTRO');

    const enlace = harness.fixture.nativeElement.querySelector('a[href="/maestros/2"]');
    expect(enlace).not.toBeNull();
  });

  it('para el ALUMNO el maestro es texto, no un viaje a "acceso denegado"', async () => {
    // La API le cierra la sección de maestros, así que el enlace sólo lo
    // llevaría al rechazo del guard.
    await montar('/materias/7', 'ALUMNO');

    expect(harness.fixture.nativeElement.querySelector('a[href="/maestros/2"]')).toBeNull();
    expect(texto()).toContain('Laura Gómez');
  });

  it('volver conserva la página del listado', async () => {
    await montar('/materias/7?page=3&size=50');
    pulsar('Volver al listado');
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/materias?page=3&size=50');
  });
});
