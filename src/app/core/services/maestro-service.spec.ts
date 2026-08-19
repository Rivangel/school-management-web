import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Maestro, Pagina } from '../models';
import { MaestroService } from './maestro-service';

const URL = `${environment.apiUrl}/maestros`;

const PAGINA: Pagina<Maestro> = {
  content: [
    {
      id: 1,
      nombre: 'Carlos',
      apellido: 'Ruiz',
      email: 'carlos@escuela.com',
      especialidad: 'Matemáticas',
    },
  ],
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
});
