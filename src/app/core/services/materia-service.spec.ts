import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { Materia, MateriaRequest, Pagina } from '../models';
import { MateriaService } from './materia-service';

const URL = `${environment.apiUrl}/materias`;

const MATERIA: Materia = {
  id: 1,
  nombre: 'Bases de Datos',
  creditos: 8,
  maestroId: 2,
  maestroNombre: 'Laura Gómez',
};

/** Lo que viaja: el maestro va por id, el nombre lo compone la API. */
const DATOS: MateriaRequest = {
  nombre: 'Bases de Datos',
  creditos: 8,
  maestroId: 2,
};

const PAGINA: Pagina<Materia> = {
  content: [MATERIA],
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

  it('pide una materia por id', () => {
    let recibida: Materia | undefined;
    servicio.obtenerPorId(1).subscribe((materia) => (recibida = materia));

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(MATERIA);

    expect(recibida).toEqual(MATERIA);
  });

  it('crea con POST a la colección', () => {
    servicio.crear(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(MATERIA, { status: 201, statusText: 'Created' });
  });

  it('actualiza con PUT al recurso, mandando el registro entero', () => {
    // La API espera un `MateriaRequest` completo, no un parche.
    servicio.actualizar(1, { ...DATOS, creditos: 6 }).subscribe();

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ ...DATOS, creditos: 6 });
    peticion.flush({ ...MATERIA, creditos: 6 });
  });

  it('borra con DELETE al recurso', () => {
    servicio.eliminar(1).subscribe();

    const peticion = http.expectOne(`${URL}/1`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('ninguna petición avisa por su cuenta, tampoco el borrado', () => {
    // El 409 del borrado llega con la frase genérica de las restricciones de
    // datos: la traduce la ficha, no un aviso flotante.
    servicio.eliminar(1).subscribe({ error: () => undefined });

    const peticion = http.expectOne(`${URL}/1`);
    expect(avisaGlobalmente(peticion.request.context)).toBe(false);
    peticion.flush(null, { status: 409, statusText: 'Conflict' });
  });
});
