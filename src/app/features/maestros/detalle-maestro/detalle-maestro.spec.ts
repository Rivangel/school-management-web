import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Maestro, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { DatosDetalleMaestro, DetalleMaestro, ResultadoDetalleMaestro } from './detalle-maestro';

const URL = `${environment.apiUrl}/maestros`;

const MAESTRO: Maestro = {
  id: 7,
  nombre: 'Carlos',
  apellido: 'Ruiz',
  email: 'carlos@escuela.com',
  especialidad: 'Matemáticas',
};

describe('DetalleMaestro', () => {
  let http: HttpTestingController;
  let dialogo: MatDialog;
  let cerrado: Promise<ResultadoDetalleMaestro>;

  async function abrir(id = 7, rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    dialogo = TestBed.inject(MatDialog);

    const referencia = dialogo.open<DetalleMaestro, DatosDetalleMaestro, ResultadoDetalleMaestro>(
      DetalleMaestro,
      { data: { id } },
    );
    cerrado = firstValueFrom(referencia.afterClosed());
    await asentar();
  }

  /** Lo de siempre: abrir la ficha y responder con el maestro. */
  async function montar(id = 7, rol: Rol = 'ADMIN'): Promise<void> {
    await abrir(id, rol);
    http.expectOne(`${URL}/7`).flush(MAESTRO);
    await asentar();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    TestBed.tick();
  }

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

  /** Pulsa un botón de un diálogo **anidado** (el de confirmar) y espera a que cierre. */
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

  it('enseña los datos del maestro', async () => {
    await montar();

    expect(texto()).toContain('Carlos Ruiz');
    expect(texto()).toContain('Matemáticas');
    expect(texto()).toContain('carlos@escuela.com');
  });

  it('explica el fallo de carga y deja reintentar', async () => {
    await abrir();
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
    expect(await Promise.race([cerrado, Promise.resolve('sigue-abierta')])).toBe('sigue-abierta');
  });

  it('el fallo se enseña en la ficha, no como aviso flotante', async () => {
    await montar();
    await confirmarBorrado();
    http.expectOne(`${URL}/7`).flush(null, { status: 409, statusText: 'Conflict' });
    await asentar();

    const enLaFicha = contenedor().querySelector('.ficha__error') as HTMLElement;
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
    await montar(7, 'MAESTRO');

    expect(texto()).toContain('Carlos Ruiz');
    expect(texto()).not.toContain('Eliminar');
    expect(texto()).not.toContain('Editar');
  });

  it('editar cierra la ficha pidiendo el formulario, sin abrirlo ella misma', async () => {
    await montar();
    pulsar('Editar');
    await asentar();

    expect(await cerrado).toBe('editar');
  });
});
