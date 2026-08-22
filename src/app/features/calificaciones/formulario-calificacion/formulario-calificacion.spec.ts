import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Alumno, Calificacion, Maestro, Materia, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { FormularioCalificacion } from './formulario-calificacion';

const URL = `${environment.apiUrl}/calificaciones`;
const URL_ALUMNOS = `${environment.apiUrl}/alumnos`;
const URL_MATERIAS = `${environment.apiUrl}/materias`;
const URL_MAESTRO_ME = `${environment.apiUrl}/maestros/me`;

const MAESTRO: Maestro = {
  id: 2,
  nombre: 'Laura',
  apellido: 'Gómez',
  email: 'maestro@escuela.com',
  especialidad: 'Ciencias',
};

function pagina<T>(contenido: T[], total = contenido.length): Pagina<T> {
  return {
    content: contenido,
    page: 0,
    size: 100,
    totalElements: total,
    totalPages: 1,
    first: true,
    last: true,
  };
}

const ALUMNOS: Pagina<Alumno> = pagina<Alumno>([
  {
    id: 1,
    nombre: 'Ana',
    apellido: 'López',
    matricula: 'A2026001',
    email: 'ana@escuela.com',
    grupo: 'A',
  },
  {
    id: 2,
    nombre: 'Carlos',
    apellido: 'Ramírez',
    matricula: 'A2026002',
    email: 'carlos@escuela.com',
    grupo: 'A',
  },
]);

const MATERIAS: Pagina<Materia> = pagina<Materia>([
  { id: 3, nombre: 'Bases de Datos', creditos: 8, maestroId: 2, maestroNombre: 'Laura Gómez' },
]);

const CALIFICACION: Calificacion = {
  id: 1,
  alumnoId: 1,
  alumnoNombre: 'Ana López',
  materiaId: 3,
  materiaNombre: 'Bases de Datos',
  calificacion: 9.5,
  periodo: '2026-1',
};

/** Destino de "Volver": aquí sólo interesa la URL a la que se llega. */
@Component({ template: 'calificaciones' })
class ConsultaFalsa {}

describe('FormularioCalificacion', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /**
   * Navega y responde a lo que la pantalla pide al montarse: los alumnos, las
   * materias y —sólo si ha entrado un MAESTRO— quién es.
   */
  async function abrir(
    rol: Rol = 'ADMIN',
    alumnos = ALUMNOS,
    url = '/calificaciones/registrar',
  ): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'calificaciones', component: ConsultaFalsa },
          { path: 'calificaciones/materia', component: ConsultaFalsa },
          { path: 'calificaciones/registrar', component: FormularioCalificacion },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);

    http.expectOne((s) => s.url === URL_ALUMNOS).flush(alumnos);
    if (rol === 'MAESTRO') {
      http.expectOne(URL_MAESTRO_ME).flush(MAESTRO);
      await asentar();
    }
    http.expectOne((s) => s.url === URL_MATERIAS).flush(MATERIAS);
    await asentar();
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

  function campo(nombre: string): HTMLInputElement {
    return harness.fixture.nativeElement.querySelector(`input[formControlName="${nombre}"]`);
  }

  function escribir(nombre: string, valor: string): void {
    const input = campo(nombre);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  /** Elige en uno de los dos desplegables, que se dibujan fuera del fixture. */
  async function elegir(formControlName: string, etiqueta: string): Promise<void> {
    const select = harness.fixture.nativeElement.querySelector(
      `mat-select[formControlName="${formControlName}"]`,
    ) as HTMLElement;
    select.click();
    await asentar();

    const opcion = [...document.querySelectorAll('mat-option')].find((candidata) =>
      candidata.textContent!.includes(etiqueta),
    ) as HTMLElement;
    opcion.click();
    await asentar();
  }

  /** Rellena los cuatro campos con una nota para Ana López. */
  async function rellenar(nota = '9.5', periodo = '2026-1'): Promise<void> {
    await elegir('alumnoId', 'López');
    await elegir('materiaId', 'Bases de Datos');
    escribir('calificacion', nota);
    escribir('periodo', periodo);
  }

  async function enviar(): Promise<void> {
    harness.fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await asentar();
  }

  /** La comprobación previa: qué notas hay ya en esa materia. */
  function comprobacion(): TestRequest {
    return http.expectOne(`${URL}/materia/3`);
  }

  function guardado(): TestRequest {
    return http.expectOne(URL);
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

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

  it('registra con POST cuando no había nota previa', async () => {
    await abrir();
    await rellenar();
    await enviar();

    comprobacion().flush([]);
    await asentar();

    const peticion = guardado();
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      alumnoId: 1,
      materiaId: 3,
      calificacion: 9.5,
      periodo: '2026-1',
    });
    peticion.flush(CALIFICACION, { status: 201, statusText: 'Created' });
    await asentar();
  });

  it('pregunta antes de pisar una nota que ya existía', async () => {
    // El 201 de la API es el mismo para un alta y para un reemplazo: sin esta
    // comprobación, sustituir un 5.8 por un 9 pasaría inadvertido.
    await abrir();
    await rellenar('9');
    await enviar();

    comprobacion().flush([{ ...CALIFICACION, calificacion: 5.8 }]);
    await asentar();

    expect(document.body.textContent).toContain('Ana López ya tiene 5.8');
    expect(document.body.textContent).toContain('Se reemplazará por 9');

    await pulsarEnElDialogo('Reemplazar');
    guardado().flush({ ...CALIFICACION, calificacion: 9 }, { status: 201, statusText: 'Created' });
    await asentar();
  });

  it('cancelar en esa pregunta no guarda nada', async () => {
    await abrir();
    await rellenar('9');
    await enviar();
    comprobacion().flush([{ ...CALIFICACION, calificacion: 5.8 }]);
    await asentar();

    await pulsarEnElDialogo('Cancelar');

    http.expectNone(URL);
    // Y el formulario queda utilizable, no bloqueado en "Guardando…".
    expect(texto()).toContain('Registrar calificación');
  });

  it('no pregunta si la nota es la misma que ya estaba', async () => {
    await abrir();
    await rellenar('9.5');
    await enviar();
    comprobacion().flush([CALIFICACION]);
    await asentar();

    guardado().flush(CALIFICACION, { status: 201, statusText: 'Created' });
    await asentar();
  });

  it('una nota de otro periodo no cuenta como pisada', async () => {
    await abrir();
    await rellenar('7', '2026-2');
    await enviar();
    comprobacion().flush([CALIFICACION]);
    await asentar();

    guardado().flush(
      { ...CALIFICACION, calificacion: 7, periodo: '2026-2' },
      { status: 201, statusText: 'Created' },
    );
    await asentar();
  });

  it('si la comprobación falla, guarda igual', async () => {
    // Avisar es una cortesía: no poder hacerlo no es motivo para descartar lo
    // que el usuario pidió.
    await abrir();
    await rellenar();
    await enviar();
    comprobacion().flush(null, { status: 500, statusText: 'Server Error' });
    await asentar();

    guardado().flush(CALIFICACION, { status: 201, statusText: 'Created' });
    await asentar();
  });

  it('el MAESTRO sólo ve sus materias, y el ADMIN no pregunta quién es', async () => {
    await abrir('MAESTRO');
    // La petición de materias del `abrir` llevaba ya el filtro; se comprueba
    // volviendo a montar y mirando los parámetros.
    localStorage.clear();
    sembrarSesion('MAESTRO');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'calificaciones/registrar', component: FormularioCalificacion }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/calificaciones/registrar');

    http.expectOne((s) => s.url === URL_ALUMNOS).flush(ALUMNOS);
    http.expectOne(URL_MAESTRO_ME).flush(MAESTRO);
    await asentar();

    const materias = http.expectOne((s) => s.url === URL_MATERIAS);
    expect(materias.request.params.get('maestroId')).toBe('2');
    materias.flush(MATERIAS);
    await asentar();
  });

  it('el ADMIN pide todas las materias y no pregunta por /me', async () => {
    await abrir('ADMIN');

    // `abrir` ya consumió las peticiones; que no haya pendientes lo comprueba el
    // `http.verify()` del `afterEach`, y `/me` nunca se pidió.
    http.expectNone(URL_MAESTRO_ME);
    expect(texto()).toContain('Registrar calificación');
  });

  it('no envía un formulario incompleto', async () => {
    await abrir();
    await enviar();

    http.expectNone(() => true);
    expect(texto()).toContain('Elige al alumno');
    expect(texto()).toContain('El periodo es obligatorio');
  });

  it('rechaza un periodo con otro formato antes de mandarlo', async () => {
    // El `@Pattern` de la API lo devolvería como un 400 después del viaje.
    await abrir();
    await rellenar('8', 'primer semestre');
    await enviar();

    http.expectNone(() => true);
    expect(texto()).toContain('AAAA-S');
  });

  it('rechaza más de dos decimales, que la columna redondearía en silencio', async () => {
    await abrir();
    await rellenar('9.567');
    await enviar();

    http.expectNone(() => true);
    expect(texto()).toContain('dos decimales');
  });

  it('rechaza una nota fuera de 0 a 10', async () => {
    await abrir();
    await rellenar('11');
    await enviar();

    http.expectNone(() => true);
    expect(texto()).toContain('La calificación máxima es 10');
  });

  it('el 403 de una materia ajena se explica en su campo', async () => {
    // Puede pasar aunque el desplegable venga filtrado: la materia pudo cambiar
    // de maestro entre que se cargó la lista y se pulsó guardar.
    await abrir('MAESTRO');
    await rellenar();
    await enviar();
    comprobacion().flush([]);
    await asentar();

    guardado().flush(
      {
        status: 403,
        message: 'Un maestro solo puede registrar información de sus propias materias',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await asentar();

    expect(texto()).toContain('no es tuya');
  });

  it('avisa del alta y deja el formulario listo para la siguiente nota', async () => {
    // Quien califica lo hace de varias personas seguidas: vaciar materia y
    // periodo obligaría a elegirlos otra vez para cada una.
    await abrir();
    await rellenar();
    await enviar();
    comprobacion().flush([]);
    await asentar();
    guardado().flush(CALIFICACION, { status: 201, statusText: 'Created' });
    await asentar();

    expect(document.body.textContent).toContain('9.5 para Ana López en Bases de Datos');
    expect(campo('periodo').value).toBe('2026-1');
    expect(campo('calificacion').value).toBe('');
  });

  it('dice cuántos alumnos se quedan fuera del desplegable', async () => {
    // La API recorta en cien y una escuela puede pasar de ahí: callarlo dejaría
    // creer que la lista está completa.
    await abrir('ADMIN', pagina(ALUMNOS.content, 137));

    expect(texto()).toContain('faltan 135');
  });

  it('explica que no se pudo saber qué materias imparte quien entró', async () => {
    localStorage.clear();
    sembrarSesion('MAESTRO');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'calificaciones/registrar', component: FormularioCalificacion }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/calificaciones/registrar');

    http.expectOne((s) => s.url === URL_ALUMNOS).flush(ALUMNOS);
    http
      .expectOne(URL_MAESTRO_ME)
      .flush(
        { message: 'No hay ningún maestro vinculado a x@escuela.com' },
        { status: 404, statusText: 'Not Found' },
      );
    await asentar();

    // Sin esto el desplegable de materias se queda vacío para siempre y sin
    // explicar por qué.
    expect(texto()).toContain('No hay ningún maestro vinculado');
    expect(harness.fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('volver lleva a la consulta de calificaciones', async () => {
    await abrir();
    const boton = [...harness.fixture.nativeElement.querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes('Volver'),
    ) as HTMLButtonElement;
    boton.click();
    await asentar();

    expect(TestBed.inject(Router).url).toBe('/calificaciones');
  });

  describe('corregir una nota que ya existe', () => {
    const EDICION =
      '/calificaciones/registrar?alumnoId=1&materiaId=3&periodo=2026-1&calificacion=9.5';

    it('abre con los datos de la URL puestos', async () => {
      // No hay pantalla de edición: la API sólo tiene el POST que hace *upsert*,
      // así que corregir es registrar otra vez con lo que ya había.
      await abrir('ADMIN', ALUMNOS, EDICION);

      expect(texto()).toContain('Corregir calificación');
      expect(campo('periodo').value).toBe('2026-1');
      expect(campo('calificacion').value).toBe('9.5');
    });

    it('guardar avisa igual de que reemplaza, porque eso es lo que hace', async () => {
      await abrir('ADMIN', ALUMNOS, EDICION);
      escribir('calificacion', '7');
      await enviar();

      comprobacion().flush([CALIFICACION]);
      await asentar();

      expect(document.body.textContent).toContain('Se reemplazará por 7');
      await pulsarEnElDialogo('Reemplazar');
      guardado().flush(
        { ...CALIFICACION, calificacion: 7 },
        { status: 201, statusText: 'Created' },
      );
      await asentar();
    });

    it('al guardar vuelve a la tabla de la materia', async () => {
      // Quien corrige una nota concreta viene de una tabla y quiere ver el
      // cambio, no encadenar altas.
      await abrir('ADMIN', ALUMNOS, EDICION);
      escribir('calificacion', '7');
      await enviar();
      comprobacion().flush([]);
      await asentar();
      guardado().flush(
        { ...CALIFICACION, calificacion: 7 },
        { status: 201, statusText: 'Created' },
      );
      await asentar();

      expect(TestBed.inject(Router).url).toBe('/calificaciones/materia?materiaId=3');
    });

    it('descarta lo que llega mal escrito en la URL', async () => {
      // Es texto que cualquiera edita en la barra de direcciones: un periodo con
      // otro formato dejaría el formulario inválido desde el principio sin que
      // se entienda por qué.
      await abrir(
        'ADMIN',
        ALUMNOS,
        '/calificaciones/registrar?alumnoId=abc&periodo=primer%20semestre&calificacion=20',
      );

      expect(texto()).toContain('Registrar calificación');
      expect(campo('periodo').value).toBe('');
      expect(campo('calificacion').value).toBe('');
    });

    it('sin los tres campos que identifican una nota, esto sigue siendo un alta', async () => {
      // La API no distingue alta de corrección: lo único que la pantalla puede
      // decir con honestidad es de dónde viene el usuario.
      await abrir('ADMIN', ALUMNOS, '/calificaciones/registrar?materiaId=3');

      expect(texto()).toContain('Registrar calificación');
      expect(texto()).not.toContain('Corregir calificación');
    });
  });
});
