import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthResponse } from '../../../core/models';
import { AuthService } from '../../../core/services/auth-service';
import { tokenFalso } from '../../../core/services/testing/token-falso';
import { Login } from './login';

const RESPUESTA_LOGIN: AuthResponse = {
  token: tokenFalso({ sub: 'admin@escuela.com', rol: 'ADMIN' }),
  tipo: 'Bearer',
  email: 'admin@escuela.com',
  nombre: 'Administrador',
  rol: 'ADMIN',
};

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  async function montar(returnUrl: string | null = null): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }),
            },
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
  }

  function escribir(selector: string, valor: string): void {
    const campo = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  async function enviar(email = 'admin@escuela.com', password = 'admin123'): Promise<void> {
    escribir('input[formControlName="email"]', email);
    escribir('input[formControlName="password"]', password);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  function texto(): string {
    return fixture.nativeElement.textContent as string;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('pinta el formulario con sus dos campos', async () => {
    await montar();

    expect(fixture.nativeElement.querySelector('input[formControlName="email"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[formControlName="password"]')).toBeTruthy();
  });

  it('no llama a la API si el formulario está incompleto', async () => {
    await montar();

    await enviar('no-es-un-correo', '123');

    http.expectNone(`${environment.apiUrl}/auth/login`);
    fixture.detectChanges();
    expect(texto()).toContain('Escribe un correo con formato válido.');
  });

  it('envía las credenciales y abre la sesión', async () => {
    await montar();

    await enviar();

    const peticion = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ email: 'admin@escuela.com', password: 'admin123' });
    peticion.flush(RESPUESTA_LOGIN);
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).estaAutenticado()).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('vuelve a la ruta que el usuario pedía antes del login', async () => {
    await montar('/alumnos/7?tab=notas');

    await enviar();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(RESPUESTA_LOGIN);
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/alumnos/7?tab=notas');
  });

  it('ignora un returnUrl que apunte fuera de la aplicación', async () => {
    await montar('//sitio-falso.com');

    await enviar();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(RESPUESTA_LOGIN);
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('explica un 401 sin dejar la sesión abierta', async () => {
    await montar();

    await enviar('admin@escuela.com', 'contrasena-mala');
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(
        { status: 401, message: 'Credenciales inválidas' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Correo o contraseña incorrectos.');
    expect(TestBed.inject(AuthService).estaAutenticado()).toBe(false);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('avisa cuando la API no responde', async () => {
    await montar();

    await enviar();
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .error(new ProgressEvent('error'), { status: 0 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo contactar con el servidor.');
  });

  it('deja ver la contraseña y volver a ocultarla', async () => {
    await montar();

    const campo = fixture.nativeElement.querySelector(
      'input[formControlName="password"]',
    ) as HTMLInputElement;
    const boton = fixture.nativeElement.querySelector(
      'button[mat-icon-button]',
    ) as HTMLButtonElement;
    expect(campo.type).toBe('password');

    boton.click();
    await fixture.whenStable();
    expect(campo.type).toBe('text');

    boton.click();
    await fixture.whenStable();
    expect(campo.type).toBe('password');
  });
});
