import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { avisaGlobalmente } from '../interceptors/error-interceptor';
import { Asistencia, AsistenciaRequest } from '../models';
import { AsistenciaService } from './asistencia-service';

const URL = `${environment.apiUrl}/asistencia`;

const ASISTENCIA: Asistencia = {
  id: 1,
  alumnoId: 1,
  alumnoNombre: 'Ana López',
  materiaId: 3,
  materiaNombre: 'Bases de Datos',
  fecha: '2026-07-20',
  presente: true,
};

const DATOS: AsistenciaRequest = {
  alumnoId: 1,
  materiaId: 3,
  fecha: '2026-07-20',
  presente: true,
};

describe('AsistenciaService', () => {
  let http: HttpTestingController;
  let servicio: AsistenciaService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(AsistenciaService);
  });

  afterEach(() => {
    http.verify();
  });

  it('registra a un alumno con POST', () => {
    servicio.registrar(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(DATOS);
    peticion.flush(ASISTENCIA, { status: 201, statusText: 'Created' });
  });

  it('la fecha viaja como cadena ISO, no como Date', () => {
    // Convertirla la reinterpretaría en la zona horaria del navegador: una lista
    // del día 20 podría salir como del 19.
    servicio.registrar(DATOS).subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.body.fecha).toBe('2026-07-20');
    peticion.flush(ASISTENCIA, { status: 201, statusText: 'Created' });
  });

  it('pide lo registrado de una materia en una fecha', () => {
    servicio.listarPorMateriaYFecha(3, '2026-07-20').subscribe();

    const peticion = http.expectOne((s) => s.url === `${URL}/materia/3`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('fecha')).toBe('2026-07-20');
    peticion.flush([ASISTENCIA]);
  });

  it('pide la asistencia de un alumno', () => {
    let recibida: Asistencia[] | undefined;
    servicio.listarPorAlumno(1).subscribe((lista) => (recibida = lista));

    http.expectOne(`${URL}/alumno/1`).flush([ASISTENCIA]);

    expect(recibida).toEqual([ASISTENCIA]);
  });

  it('ninguna petición avisa por su cuenta', () => {
    servicio.registrar(DATOS).subscribe({ error: () => undefined });

    const peticion = http.expectOne(URL);
    expect(avisaGlobalmente(peticion.request.context)).toBe(false);
    peticion.flush(null, { status: 403, statusText: 'Forbidden' });
  });
});
