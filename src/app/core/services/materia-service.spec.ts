import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Materia, Pagina } from '../models';
import { MateriaService } from './materia-service';

const URL = `${environment.apiUrl}/materias`;

const PAGINA: Pagina<Materia> = {
  content: [
    {
      id: 1,
      nombre: 'Bases de Datos',
      creditos: 8,
      maestroId: 2,
      maestroNombre: 'Laura Gómez',
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

describe('MateriaService', () => {
  let http: HttpTestingController;
  let servicio: MateriaService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(MateriaService);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide el listado sin parámetros cuando no se le dan', () => {
    let recibida: Pagina<Materia> | undefined;
    servicio.listar().subscribe((pagina) => (recibida = pagina));

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush(PAGINA);

    expect(recibida).toEqual(PAGINA);
  });

  it('traduce la consulta a page, size y sort', () => {
    servicio.listar({ page: 2, size: 50, sort: 'maestro.apellido,desc' }).subscribe();

    const peticion = http.expectOne((solicitud) => solicitud.url === URL);
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('size')).toBe('50');
    expect(peticion.request.params.get('sort')).toBe('maestro.apellido,desc');
    peticion.flush(PAGINA);
  });

  it('manda el filtro por maestro a la API, que es quien filtra', () => {
    // Filtrar en el cliente sólo alcanzaría a la página que ya está en memoria.
    servicio.listar({ maestroId: 2 }).subscribe();

    const peticion = http.expectOne((solicitud) => solicitud.url === URL);
    expect(peticion.request.params.get('maestroId')).toBe('2');
    peticion.flush(PAGINA);
  });

  it('sin filtro no manda el parámetro', () => {
    // Mandarlo vacío no es "todas": es un filtro vacío que la API tendría que
    // interpretar.
    servicio.listar({ page: 1 }).subscribe();

    const peticion = http.expectOne((solicitud) => solicitud.url === URL);
    expect(peticion.request.params.has('maestroId')).toBe(false);
    peticion.flush(PAGINA);
  });
});
