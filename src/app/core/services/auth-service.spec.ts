import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models';
import { AuthService } from './auth-service';
import { tokenFalso } from './testing/token-falso';

const CLAVE_SESION = 'school-management.sesion';

const RESPUESTA_LOGIN: AuthResponse = {
  token: tokenFalso({ sub: 'admin@escuela.com', rol: 'ADMIN' }),
  tipo: 'Bearer',
  email: 'admin@escuela.com',
  nombre: 'Administrador',
  rol: 'ADMIN',
};

describe('AuthService', () => {
  let http: HttpTestingController;

  function crearServicio(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http?.verify();
    localStorage.clear();
  });

  it('arranca sin sesión cuando no hay nada guardado', () => {
    const servicio = crearServicio();

    expect(servicio.estaAutenticado()).toBe(false);
    expect(servicio.token()).toBeNull();
    expect(servicio.rol()).toBeNull();
  });

  it('guarda la sesión al iniciar sesión', () => {
    const servicio = crearServicio();

    servicio.login({ email: 'admin@escuela.com', password: 'admin123' }).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush(RESPUESTA_LOGIN);

    expect(servicio.estaAutenticado()).toBe(true);
    expect(servicio.token()).toBe(RESPUESTA_LOGIN.token);
    expect(servicio.rol()).toBe('ADMIN');
    expect(servicio.nombre()).toBe('Administrador');
    expect(localStorage.getItem(CLAVE_SESION)).not.toBeNull();
  });

  it('no abre sesión si el login falla', () => {
    const servicio = crearServicio();

    servicio.login({ email: 'admin@escuela.com', password: 'mala' }).subscribe({
      error: () => undefined,
    });
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(servicio.estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('recupera la sesión guardada al recargar', () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({
        token: tokenFalso({ sub: 'ana.lopez@escuela.com', rol: 'ALUMNO' }),
        email: 'ana.lopez@escuela.com',
        nombre: 'Ana López',
        rol: 'ALUMNO',
      }),
    );

    const servicio = crearServicio();

    expect(servicio.estaAutenticado()).toBe(true);
    expect(servicio.rol()).toBe('ALUMNO');
  });

  it('descarta un token expirado en vez de arrancar con sesión', () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({
        token: tokenFalso({ sub: 'admin@escuela.com', rol: 'ADMIN' }, -60),
        email: 'admin@escuela.com',
        nombre: 'Administrador',
        rol: 'ADMIN',
      }),
    );

    const servicio = crearServicio();

    expect(servicio.estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('descarta una sesión guardada con forma inválida', () => {
    localStorage.setItem(CLAVE_SESION, '{"token":"abc","rol":"SUPERADMIN"}');

    const servicio = crearServicio();

    expect(servicio.estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('borra la sesión al cerrar', () => {
    const servicio = crearServicio();
    servicio.login({ email: 'admin@escuela.com', password: 'admin123' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(RESPUESTA_LOGIN);

    servicio.logout();

    expect(servicio.estaAutenticado()).toBe(false);
    expect(servicio.token()).toBeNull();
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it('responde por los roles con tieneAlgunRol', () => {
    const servicio = crearServicio();
    servicio.login({ email: 'admin@escuela.com', password: 'admin123' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(RESPUESTA_LOGIN);

    expect(servicio.tieneAlgunRol('ADMIN', 'MAESTRO')).toBe(true);
    expect(servicio.tieneAlgunRol('ALUMNO')).toBe(false);

    servicio.logout();
    expect(servicio.tieneAlgunRol('ADMIN')).toBe(false);
  });
});
