import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { Alumno, AlumnoRequest, Pagina } from '../models';
import { AlumnoService } from './alumno-service';

const URL = `${environment.apiUrl}/alumnos`;

const PAGINA: Pagina<Alumno> = {
  content: [
    {
      id: 1,
      nombre: 'Ana',
      apellido: 'López',
      matricula: 'A-001',
      email: 'ana@escuela.com',
      grupo: '1A',
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

const ALUMNO: Alumno = PAGINA.content[0];

const DATOS: AlumnoRequest = {
  nombre: 'Ana',
  apellido: 'López',
  matricula: 'A-001',
  email: 'ana@escuela.com',
  grupo: '1A',
};

describe('AlumnoService', () => {
  let http: HttpTestingController;
  let servicio: AlumnoService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(AlumnoService);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el listado sin parámetros cuando no se le dan', () => {
    let recibida: Pagina<Alumno> | undefined;
    servicio.listar().subscribe((pagina) => (recibida = pagina));

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush(PAGINA);

    expect(recibida).toEqual(PAGINA);
  });

  it('traduce la consulta a page, size y sort', () => {
    servicio.listar({ page: 2, size: 50, sort: 'apellido,desc' }).subscribe();

    const peticion = http.expectOne((solicitud) => solicitud.url === URL);
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('size')).toBe('50');
    expect(peticion.request.params.get('sort')).toBe('apellido,desc');
    peticion.flush(PAGINA);
  });

  it('pide un alumno por id', () => {
    let recibido: Alumno | undefined;
    servicio.obtenerPorId(7).subscribe((alumno) => (recibido = alumno));

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(ALUMNO);

    expect(recibido).toEqual(ALUMNO);
  });

  it('crea un alumno con POST a la colección', () => {
    servicio.crear(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(ALUMNO, { status: 201, statusText: 'Created' });
  });

  it('actualiza con PUT al recurso, no a la colección', () => {
    servicio.actualizar(7, DATOS).subscribe();

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush({ ...ALUMNO, id: 7 });
  });

  it('elimina con DELETE al recurso', () => {
    let terminado = false;
    servicio.eliminar(7).subscribe(() => (terminado = true));

    const peticion = http.expectOne(`${URL}/7`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });

    expect(terminado).toBe(true);
  });

  it('las lecturas y los envíos dejan el fallo a la pantalla', () => {
    // Cada uno tiene dónde enseñarlo: el listado su aviso con reintentar, el
    // formulario el campo que la API objetó. Sin la marca saldría además el
    // aviso flotante y el usuario leería el mismo error dos veces.
    servicio.listar().subscribe({ error: () => undefined });
    servicio.crear(DATOS).subscribe({ error: () => undefined });

    for (const peticion of http.match((solicitud) => solicitud.url === URL)) {
      expect(avisaGlobalmente(peticion.request.context)).toBe(false);
      peticion.flush(null, { status: 500, statusText: 'Server Error' });
    }
  });

  it('el borrado sí avisa, porque no tiene dónde pintar el fallo', () => {
    // Es la excepción de la sección: se pulsa desde el listado o la ficha, que
    // acto seguido navegan. Sin el aviso, un borrado que la API rechaza se
    // vería exactamente igual que uno que funcionó.
    servicio.eliminar(7).subscribe({ error: () => undefined });

    const peticion = http.expectOne(`${URL}/7`);
    expect(avisaGlobalmente(peticion.request.context)).toBe(true);
    peticion.flush(null, { status: 409, statusText: 'Conflict' });
  });

  it('pregunta por el alumno de la sesión con /me', () => {
    // Sus notas se piden por id y la sesión no lo lleva: sin esto, el único rol
    // que sólo ve lo suyo sería el que no puede nombrarlo.
    servicio.obtenerActual().subscribe();

    const peticion = http.expectOne(`${URL}/me`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(ALUMNO);
  });
});
