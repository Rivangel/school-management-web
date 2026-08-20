import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Maestro, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DetalleMaestro } from './detalle-maestro';

const URL = `${environment.apiUrl}/maestros`;

const MAESTRO: Maestro = {
  id: 7,
  nombre: 'Carlos',
  apellido: 'Ruiz',
  email: 'carlos@escuela.com',
  especialidad: 'Matemáticas',
};

/** Destino de "Volver": aquí sólo interesa la URL a la que se llega. */
@Component({ template: 'listado' })
class ListadoFalso {}

describe('DetalleMaestro', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(url = '/maestros/7', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'maestros', component: ListadoFalso },
          { path: 'maestros/:id', component: DetalleMaestro },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);
  }

  /** Lo de siempre: abrir la ficha y responder con el maestro. */
  async function montar(url = '/maestros/7', rol: Rol = 'ADMIN'): Promise<void> {
    await abrir(url, rol);
    http.expectOne(`${URL}/7`).flush(MAESTRO);
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

  it('enseña los datos del maestro', async () => {
    await montar();

    expect(texto()).toContain('Carlos Ruiz');
    expect(texto()).toContain('Matemáticas');
    expect(texto()).toContain('carlos@escuela.com');
  });

  it('avisa cuando la dirección no apunta a un maestro', async () => {
    await abrir('/maestros/abc');

    expect(texto()).toContain('La dirección no apunta a ningún maestro');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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

    expect(texto()).toContain('Carlos Ruiz');
  });

  it('pregunta con el nombre dentro antes de eliminar', async () => {
    await montar();
    pulsar('Eliminar');
    await asentar();

    expect(document.body.textContent).toContain('Se va a eliminar a Carlos Ruiz (Matemáticas)');
  });

  it('cancelar no borra nada', async () => {
    await montar();
    pulsar('Eliminar');
    await asentar();

    await pulsarEnElDialogo('Cancelar');

    http.expectNone(() => true);
    expect(TestBed.inject(Router).url).toBe('/maestros/7');
  });

  it('confirmar borra y vuelve al listado, a la misma página', async () => {
    await montar('/maestros/7?page=2&sort=especialidad,desc');
    await confirmarBorrado();

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/maestros?page=2&sort=especialidad,desc');
  });

  it('el 409 se cuenta como lo que es: el maestro tiene materias', async () => {
    // La API responde con su frase sobre restricciones de datos, que es exacta y
    // no le sirve a nadie. La única forma de provocarla desde aquí es que el
    // maestro imparta alguna materia.
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

    expect(texto()).toContain('tiene materias a su cargo');
    expect(texto()).not.toContain('restricción de datos');
    expect(TestBed.inject(Router).url).toBe('/maestros/7');
  });

  it('el fallo se enseña en la ficha, no como aviso flotante', async () => {
    // Un mensaje que dice qué hacer y desaparece a los ocho segundos no sirve de
    // mucho: se queda junto al botón que lo provocó.
    await montar();
    await confirmarBorrado();
    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    const enLaFicha = harness.fixture.nativeElement.querySelector('.ficha__error') as HTMLElement;
    expect(enLaFicha.textContent).toContain('tiene materias a su cargo');
    expect(texto()).toContain('Carlos Ruiz');
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

  it('el MAESTRO consulta la ficha pero no puede tocarla', async () => {
    await montar('/maestros/7', 'MAESTRO');

    expect(texto()).toContain('Carlos Ruiz');
    expect(texto()).not.toContain('Eliminar');
    expect(harness.fixture.nativeElement.querySelector('a[href^="/maestros/7/editar"]')).toBeNull();
  });

  it('volver conserva la página del listado', async () => {
    await montar('/maestros/7?page=3&size=50');
    pulsar('Volver al listado');
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/maestros?page=3&size=50');
  });
});
