import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models';
import { AuthService } from '../services/auth-service';
import { tokenFalso } from '../services/testing/token-falso';
import { authInterceptor } from './auth-interceptor';

const TOKEN = tokenFalso({ sub: 'admin@escuela.com', rol: 'ADMIN' });

const RESPUESTA_LOGIN: AuthResponse = {
  token: TOKEN,
  tipo: 'Bearer',
  email: 'admin@escuela.com',
  nombre: 'Administrador',
  rol: 'ADMIN',
};

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function iniciarSesion(): void {
    auth.login({ email: 'admin@escuela.com', password: 'admin123' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(RESPUESTA_LOGIN);
  }

  it('no manda cabecera si no hay sesión', () => {
    cliente.get(`${environment.apiUrl}/alumnos`).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/alumnos`);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });

  it('añade el token a las peticiones a la API', () => {
    iniciarSesion();

    cliente.get(`${environment.apiUrl}/alumnos`).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/alumnos`);
    expect(peticion.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    peticion.flush({});
  });

  it('no filtra el token a hosts ajenos', () => {
    iniciarSesion();

    cliente.get('https://fonts.googleapis.com/css2?family=Roboto').subscribe();

    const peticion = http.expectOne('https://fonts.googleapis.com/css2?family=Roboto');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });

  it('no manda el token al login ni al registro', () => {
    iniciarSesion();

    cliente.post(`${environment.apiUrl}/auth/login`, {}).subscribe();
    const login = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(RESPUESTA_LOGIN);

    cliente.post(`${environment.apiUrl}/auth/register`, {}).subscribe();
    const registro = http.expectOne(`${environment.apiUrl}/auth/register`);
    expect(registro.request.headers.has('Authorization')).toBe(false);
    registro.flush(RESPUESTA_LOGIN);
  });

  it('deja de mandar el token tras cerrar sesión', () => {
    iniciarSesion();
    auth.logout();

    cliente.get(`${environment.apiUrl}/alumnos`).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/alumnos`);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });
});
