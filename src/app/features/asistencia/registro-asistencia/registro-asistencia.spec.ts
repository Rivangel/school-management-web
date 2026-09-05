import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../environments/environment';
import { Alumno, Asistencia, Maestro, Materia, Pagina, Rol } from '../../../core/models';
import { sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { RegistroAsistencia } from './registro-asistencia';

const URL = `${environment.apiUrl}/asistencia`;
const URL_ALUMNOS = `${environment.apiUrl}/alumnos`;
const URL_MATERIAS = `${environment.apiUrl}/materias`;
const URL_MAESTRO_ME = `${environment.apiUrl}/maestros/me`;

const FECHA = '2026-07-20';
const CON_DATOS = `/asistencia/registrar?materiaId=3&fecha=${FECHA}`;

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

function alumno(id: number, nombre: string, apellido: string): Alumno {
  return {
    id,
    nombre,
    apellido,
    matricula: `A202600${id}`,
    email: `${nombre.toLowerCase()}@escuela.com`,
    grupo: 'A',
  };
}

const ALUMNOS = pagina([alumno(1, 'Ana', 'López'), alumno(2, 'Carlos', 'Ramírez')]);

const MATERIAS = pagina<Materia>([
  { id: 3, nombre: 'Bases de Datos', creditos: 8, maestroId: 2, maestroNombre: 'Laura Gómez' },
]);

function registro(alumnoId: number, presente: boolean): Asistencia {
  return {
    id: alumnoId * 10,
    alumnoId,
    alumnoNombre: 'Alumno',
    materiaId: 3,
    materiaNombre: 'Bases de Datos',
    fecha: FECHA,
    presente,
  };
}

describe('RegistroAsistencia', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  /** Navega y responde a las materias; el resto lo decide cada test. */
  async function abrir(url = '/asistencia/registrar', rol: Rol = 'ADMIN'): Promise<void> {
    localStorage.clear();
    sembrarSesion(rol);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'asistencia/registrar', component: RegistroAsistencia }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(url);

    if (rol === 'MAESTRO') {
      http.expectOne(URL_MAESTRO_ME).flush(MAESTRO);
      await asentar();
    }
    http.expectOne((s) => s.url === URL_MATERIAS).flush(MATERIAS);
    await asentar();
  }

  /** Abre con materia y fecha puestas y responde a la lista y a lo registrado. */
  async function conLista(
    yaRegistrada: Asistencia[] = [],
    alumnos = ALUMNOS,
    rol: Rol = 'ADMIN',
  ): Promise<void> {
    await abrir(CON_DATOS, rol);
    http.expectOne((s) => s.url === URL_ALUMNOS).flush(alumnos);
    http.expectOne((s) => s.url === `${URL}/materia/3`).flush(yaRegistrada);
    await asentar();
  }

  async function asentar(): Promise<void> {
    await new Promise((listo) => setTimeout(listo));
    harness.detectChanges();
    TestBed.tick();
  }

  function texto(): string {
    return harness.fixture.nativeElement.textContent as string;
  }

  function filas(): HTMLElement[] {
    return [...harness.fixture.nativeElement.querySelectorAll('tbody tr')];
  }

  /** Pulsa "Presente" o "Ausente" en la fila que ocupa esa posición. */
  async function marcar(indice: number, etiqueta: 'Presente' | 'Ausente'): Promise<void> {
    const boton = [...filas()[indice].querySelectorAll('mat-button-toggle button')].find(
      (candidato) => candidato.textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
    await asentar();
  }

  function pulsar(etiqueta: string): void {
    const boton = [...harness.fixture.nativeElement.querySelectorAll('button')].find((candidato) =>
      (candidato as HTMLElement).textContent!.includes(etiqueta),
    ) as HTMLButtonElement;
    boton.click();
  }

  afterEach(() => {
    http.verify();
  });

  it('sin materia y fecha no pide ninguna lista', async () => {
    await abrir();

    http.expectNone((s) => s.url === URL_ALUMNOS);
    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige la materia y el día');
  });

  it('con materia y fecha carga la lista y lo ya registrado', async () => {
    await abrir(CON_DATOS);

    http.expectOne((s) => s.url === URL_ALUMNOS).flush(ALUMNOS);
    const registrada = http.expectOne((s) => s.url === `${URL}/materia/3`);
    expect(registrada.request.params.get('fecha')).toBe(FECHA);
    registrada.flush([registro(1, true)]);
    await asentar();

    expect(filas()).toHaveLength(2);
  });

  it('empieza con lo que dice el servidor y sin cambios pendientes', async () => {
    await conLista([registro(1, true), registro(2, false)]);

    expect(texto()).not.toContain('cambios sin guardar');
    const guardar = [...harness.fixture.nativeElement.querySelectorAll('button')].find((boton) =>
      (boton as HTMLElement).textContent!.includes('Guardar'),
    ) as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);
  });

  it('sólo manda los alumnos cuya marca cambió', async () => {
    // La API guarda a uno por petición: reenviar la clase entera para corregir
    // una falta es gratis para quien mira la pantalla y no para el servidor.
    await conLista([registro(1, true), registro(2, true)]);

    await marcar(1, 'Ausente');
    expect(texto()).toContain('1 cambio sin guardar');

    pulsar('Guardar');
    await asentar();

    const peticion = http.expectOne(URL);
    expect(peticion.request.body).toEqual({
      alumnoId: 2,
      materiaId: 3,
      fecha: FECHA,
      presente: false,
    });
    peticion.flush(registro(2, false), { status: 201, statusText: 'Created' });
    await asentar();

    // Al terminar se recarga: la pantalla vuelve a contar la verdad del servidor.
    http
      .expectOne((s) => s.url === `${URL}/materia/3`)
      .flush([registro(1, true), registro(2, false)]);
    await asentar();
    expect(texto()).not.toContain('sin guardar');
  });

  it('una petición por alumno, y un fallo no cancela las demás', async () => {
    // Con `forkJoin` a secas, un 403 tiraría abajo la clase entera.
    await conLista();

    await marcar(0, 'Presente');
    await marcar(1, 'Presente');
    pulsar('Guardar');
    await asentar();

    const peticiones = http.match(URL);
    expect(peticiones).toHaveLength(2);
    peticiones[0].flush(registro(1, true), { status: 201, statusText: 'Created' });
    peticiones[1].flush(null, { status: 403, statusText: 'Forbidden' });
    await asentar();

    // Se dice a quién hay que repetirle, con nombre y no con un contador.
    expect(texto()).toContain('Carlos Ramírez');
    http.expectOne((s) => s.url === `${URL}/materia/3`).flush([registro(1, true)]);
    await asentar();
  });

  it('"marcar todos presentes" deja la clase lista de una vez', async () => {
    await conLista();

    pulsar('Marcar todos presentes');
    await asentar();

    expect(texto()).toContain('2 cambios sin guardar');
  });

  it('sin marcar no es lo mismo que ausente', async () => {
    // Un interruptor de dos posiciones apuntaría faltas por descuido.
    await conLista();

    const seleccionados = harness.fixture.nativeElement.querySelectorAll(
      'mat-button-toggle.mat-button-toggle-checked',
    );
    expect(seleccionados).toHaveLength(0);
    expect(texto()).not.toContain('sin guardar');
  });

  it('cambiar de día no arrastra las marcas del anterior', async () => {
    // Serían las de otra clase.
    await conLista([registro(1, true)]);
    await marcar(1, 'Ausente');
    expect(texto()).toContain('1 cambio sin guardar');

    void TestBed.inject(Router).navigate(['/asistencia/registrar'], {
      queryParams: { materiaId: 3, fecha: '2026-07-21' },
    });
    await asentar();

    http.expectOne((s) => s.url === `${URL}/materia/3`).flush([]);
    await asentar();

    expect(texto()).not.toContain('sin guardar');
  });

  it('ignora una fecha mal escrita en la URL', async () => {
    await abrir('/asistencia/registrar?materiaId=3&fecha=20-07-2026');

    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige la materia y el día');
  });

  it('sin fecha en la URL no se supone hoy', async () => {
    // Pasar lista es apuntar algo de un día concreto: elegirlo por el usuario
    // acaba guardando faltas en el día equivocado.
    await abrir('/asistencia/registrar?materiaId=3');

    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige la materia y el día');
  });

  it('el MAESTRO sólo pasa lista de sus materias', async () => {
    // Aquí sí se acota, a diferencia de la consulta: esta pantalla escribe y la
    // API rechaza con 403 la materia ajena.
    localStorage.clear();
    sembrarSesion('MAESTRO');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'asistencia/registrar', component: RegistroAsistencia }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/asistencia/registrar');

    http.expectOne(URL_MAESTRO_ME).flush(MAESTRO);
    await asentar();

    const materias = http.expectOne((s) => s.url === URL_MATERIAS);
    expect(materias.request.params.get('maestroId')).toBe('2');
    materias.flush(MATERIAS);
    await asentar();
  });

  it('si no se sabe quién es el maestro, lo dice en vez de quedarse en blanco', async () => {
    // Sin id no se piden materias —el filtro `?maestroId=` no se puede armar—, así
    // que un fallo aquí no aparecería como error sino como un desplegable vacío
    // para siempre, que se lee como "no impartes nada".
    localStorage.clear();
    sembrarSesion('MAESTRO');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'asistencia/registrar', component: RegistroAsistencia }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/asistencia/registrar');

    http
      .expectOne(URL_MAESTRO_ME)
      .flush({ message: 'Maestro no encontrado' }, { status: 404, statusText: 'Not Found' });
    await asentar();

    http.expectNone((s) => s.url === URL_MATERIAS);
    expect(texto()).toContain('Reintentar');
  });

  it('dice cuántos alumnos no caben en la lista', async () => {
    // Aquí importa más que en ningún otro sitio: es la lista de clase.
    await conLista([], pagina(ALUMNOS.content, 137));

    expect(texto()).toContain('faltan 135');
  });

  it('explica un fallo de carga y deja reintentar', async () => {
    await abrir(CON_DATOS);
    http.expectOne((s) => s.url === URL_ALUMNOS).flush(ALUMNOS);
    http
      .expectOne((s) => s.url === `${URL}/materia/3`)
      .flush({ message: 'La base de datos no responde' }, { status: 500, statusText: 'Error' });
    await asentar();

    expect(texto()).toContain('La base de datos no responde');

    pulsar('Reintentar');
    await asentar();
    http.expectOne((s) => s.url === URL_MATERIAS).flush(MATERIAS);
    http.expectOne((s) => s.url === `${URL}/materia/3`).flush([]);
    await asentar();

    expect(filas()).toHaveLength(2);
  });

  it('el campo de fecha es nativo y no admite días futuros', async () => {
    // Medido: el calendario de Material cargaba 120 kB en esta pantalla y
    // entregaba un `Date` que había que convertir a ISO con cuidado del huso.
    await abrir();

    const fecha = harness.fixture.nativeElement.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(fecha).not.toBeNull();
    expect(fecha.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('descarta un día que no existe en el calendario', async () => {
    await abrir('/asistencia/registrar?materiaId=3&fecha=2026-02-31');

    http.expectNone((s) => s.url.startsWith(`${URL}/materia`));
    expect(texto()).toContain('Elige la materia y el día');
  });
});
