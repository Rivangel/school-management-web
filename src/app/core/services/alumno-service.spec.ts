import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Alumno, Pagina } from '../models';
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
});
