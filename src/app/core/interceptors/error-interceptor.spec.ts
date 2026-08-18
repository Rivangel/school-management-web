import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { Avisos } from '../services/avisos';
import { AuthService } from '../services/auth-service';
import { sembrarSesion } from '../services/testing/sesion-falsa';
import { errorInterceptor, sinAvisoGlobal } from './error-interceptor';

const URL = `${environment.apiUrl}/alumnos`;

describe('errorInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let auth: AuthService;
  let avisar: ReturnType<typeof vi.spyOn>;
  let navegar: ReturnType<typeof vi.spyOn>;

  /** Monta el interceptor. Con `conSesion` ya hay alguien dentro. */
  function montar(conSesion = true): void {
    localStorage.clear();
    if (conSesion) {
      sembrarSesion('ADMIN');
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    avisar = vi.spyOn(TestBed.inject(Avisos), 'error').mockImplementation(() => undefined);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  /** Lanza una petición y recoge el error, que el interceptor debe reemitir. */
  function pedir(url = URL, contexto?: ReturnType<typeof sinAvisoGlobal>): { fallo: unknown } {
    const recogido: { fallo: unknown } = { fallo: undefined };
    cliente.get(url, contexto === undefined ? {} : { context: contexto }).subscribe({
      error: (error: unknown) => (recogido.fallo = error),
    });
    return recogido;
  }

  afterEach(() => {
    http.verify();
  });

  it('trata un 401 con sesión abierta como sesión caducada', () => {
    // Sin esto el usuario se queda mirando una pantalla que no carga, sin saber
    // que su token venció y tiene que volver a entrar.
    montar();
    pedir();
    http.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaAutenticado()).toBe(false);
    expect(avisar).toHaveBeenCalledWith('Tu sesión caducó. Vuelve a iniciar sesión.');
    expect(navegar).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: TestBed.inject(Router).url },
    });
  });

  it('no cierra la sesión por un 401 del login', () => {
    // Ahí un 401 significa "credenciales incorrectas", y lo explica el propio
    // formulario de login.
    montar();
    pedir(`${environment.apiUrl}/auth/login`);
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaAutenticado()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('no repite el aviso con las peticiones que iban en vuelo', () => {
    // Una pantalla suele pedir varias cosas a la vez: el primer 401 cierra la
    // sesión y los demás no deben apilar avisos ni navegaciones.
    montar();
    pedir();
    pedir(`${URL}/1`);
    http.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${URL}/1`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(avisar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledTimes(1);
  });

  it('avisa del resto de errores con el mensaje de la API', () => {
    montar();
    pedir();
    http
      .expectOne(URL)
      .flush(
        { message: 'Ya existe un alumno con la matrícula A-001' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(avisar).toHaveBeenCalledWith('Ya existe un alumno con la matrícula A-001');
  });

  it('se calla si la pantalla pinta el error por su cuenta', () => {
    // El listado enseña su propio aviso con botón de reintentar y el formulario
    // marca el campo: un aviso flotante encima sería el mismo fallo dos veces.
    montar();
    pedir(URL, sinAvisoGlobal());
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(avisar).not.toHaveBeenCalled();
  });

  it('vuelve a lanzar el error para quien lo pidió', () => {
    // Avisar no es manejarlo: la pantalla sigue necesitando enterarse.
    montar();
    const recogido = pedir();
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(recogido.fallo).toBeDefined();
  });
});
