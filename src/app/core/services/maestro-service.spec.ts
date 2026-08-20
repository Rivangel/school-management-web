import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { Maestro, MaestroRequest, Pagina } from '../models';
import { MaestroService } from './maestro-service';

const URL = `${environment.apiUrl}/maestros`;

const MAESTRO: Maestro = {
  id: 1,
  nombre: 'Carlos',
  apellido: 'Ruiz',
  email: 'carlos@escuela.com',
  especialidad: 'Matemáticas',
};

const DATOS: MaestroRequest = {
  nombre: 'Carlos',
  apellido: 'Ruiz',
  email: 'carlos@escuela.com',
  especialidad: 'Matemáticas',
};

const PAGINA: Pagina<Maestro> = {
  content: [MAESTRO],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

describe('MaestroService', () => {
  let http: HttpTestingController;
  let servicio: MaestroService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(MaestroService);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el listado sin parámetros cuando no se le dan', () => {
    // Mandar `page=0&size=20` a mano sería repetir aquí lo que ya decide la API,
    // y lo que hay que hacer el día que allá cambie el valor por defecto es nada.
    let recibida: Pagina<Maestro> | undefined;
    servicio.listar().subscribe((pagina) => (recibida = pagina));

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush(PAGINA);

    expect(recibida).toEqual(PAGINA);
  });

  it('traduce la consulta a page, size y sort', () => {
    servicio.listar({ page: 2, size: 50, sort: 'especialidad,desc' }).subscribe();

    const peticion = http.expectOne((solicitud) => solicitud.url === URL);
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('size')).toBe('50');
    expect(peticion.request.params.get('sort')).toBe('especialidad,desc');
    peticion.flush(PAGINA);
  });

  it('pide un maestro por id', () => {
    let recibido: Maestro | undefined;
    servicio.obtenerPorId(1).subscribe((maestro) => (recibido = maestro));

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(MAESTRO);

    expect(recibido).toEqual(MAESTRO);
  });

  it('crea un maestro con POST a la colección', () => {
    servicio.crear(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(MAESTRO, { status: 201, statusText: 'Created' });
  });

  it('actualiza con PUT al recurso, no a la colección', () => {
    servicio.actualizar(1, DATOS).subscribe();

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(MAESTRO);
  });

  it('elimina con DELETE al recurso', () => {
    let terminado = false;
    servicio.eliminar(1).subscribe(() => (terminado = true));

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });

    expect(terminado).toBe(true);
  });

  it('el borrado tampoco deja el fallo al aviso global', () => {
    // Es la diferencia con alumnos: el 409 por materias asignadas lo explica la
    // ficha, y sin esta marca el usuario leería además el mensaje genérico de la
    // API en un aviso flotante.
    servicio.eliminar(1).subscribe({ error: () => undefined });

    const peticion = http.expectOne(`${URL}/1`);
    expect(avisaGlobalmente(peticion.request.context)).toBe(false);
    peticion.flush(null, { status: 409, statusText: 'Conflict' });
  });
});
