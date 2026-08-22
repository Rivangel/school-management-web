import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { Calificacion, CalificacionRequest } from '../models';
import { CalificacionService } from './calificacion-service';

const URL = `${environment.apiUrl}/calificaciones`;

const CALIFICACION: Calificacion = {
  id: 1,
  alumnoId: 1,
  alumnoNombre: 'Ana López',
  materiaId: 3,
  materiaNombre: 'Bases de Datos',
  calificacion: 9.5,
  periodo: '2026-1',
};

const DATOS: CalificacionRequest = {
  alumnoId: 1,
  materiaId: 3,
  calificacion: 9.5,
  periodo: '2026-1',
};

describe('CalificacionService', () => {
  let http: HttpTestingController;
  let servicio: CalificacionService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(CalificacionService);
  });

  afterEach(() => {
    http.verify();
  });

  it('registra con POST a la colección', () => {
    servicio.registrar(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(CALIFICACION, { status: 201, statusText: 'Created' });
  });

  it('corregir una nota es el mismo POST, no un PUT', () => {
    // La API hace *upsert* por alumno, materia y periodo, y no tiene `PUT`.
    servicio.registrar({ ...DATOS, calificacion: 7 }).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ ...CALIFICACION, calificacion: 7 }, { status: 201, statusText: 'Created' });
  });

  it('pide las calificaciones de un alumno', () => {
    let recibidas: Calificacion[] | undefined;
    servicio.listarPorAlumno(1).subscribe((lista) => (recibidas = lista));

    const peticion = http.expectOne(`${URL}/alumno/1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([CALIFICACION]);

    expect(recibidas).toEqual([CALIFICACION]);
  });

  it('pide las calificaciones de una materia', () => {
    servicio.listarPorMateria(3).subscribe();

    const peticion = http.expectOne(`${URL}/materia/3`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([CALIFICACION]);
  });

  it('las consultas no vienen paginadas: son un arreglo', () => {
    // Son las notas de un alumno o de una materia, no un catálogo, así que estas
    // pantallas no usan `listadoPaginado`.
    let recibidas: Calificacion[] | undefined;
    servicio.listarPorAlumno(1).subscribe((lista) => (recibidas = lista));

    const peticion = http.expectOne(`${URL}/alumno/1`);
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush([CALIFICACION, { ...CALIFICACION, id: 2 }]);

    expect(recibidas).toHaveLength(2);
  });

  it('ninguna petición avisa por su cuenta', () => {
    // El 403 de "esa materia no es tuya" lo explica la propia pantalla.
    servicio.registrar(DATOS).subscribe({ error: () => undefined });

    const peticion = http.expectOne(URL);
    expect(avisaGlobalmente(peticion.request.context)).toBe(false);
    peticion.flush(null, { status: 403, statusText: 'Forbidden' });
  });
});
