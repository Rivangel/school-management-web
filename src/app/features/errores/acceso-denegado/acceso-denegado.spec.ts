import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Rol } from '../../../core/models';
import { AuthService } from '../../../core/services/auth-service';
import { CLAVE_SESION, sembrarSesion } from '../../../core/services/testing/sesion-falsa';
import { AccesoDenegado } from './acceso-denegado';

describe('AccesoDenegado', () => {
  let fixture: ComponentFixture<AccesoDenegado>;

  async function montar(rol?: Rol): Promise<void> {
    if (rol) {
      sembrarSesion(rol);
    }
    TestBed.configureTestingModule({
      imports: [AccesoDenegado],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AccesoDenegado);
    fixture.detectChanges();
  }

  function texto(): string {
    return fixture.nativeElement.textContent as string;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('nombra el rol de la sesión que se quedó corto', async () => {
    await montar('ALUMNO');

    expect(texto()).toContain('Tu rol');
    expect(texto()).toContain('ALUMNO');
  });

  it('sin sesión no inventa un rol', async () => {
    await montar();

    expect(texto()).toContain('No tienes permiso para ver esta sección.');
  });

  it('cerrar sesión limpia la sesión y manda al login', async () => {
    await montar('MAESTRO');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const salir = [...fixture.nativeElement.querySelectorAll('button')].find((boton) =>
      (boton as HTMLElement).textContent!.includes('Cerrar sesión'),
    ) as HTMLButtonElement;
    salir.click();
    fixture.detectChanges();

    expect(TestBed.inject(AuthService).estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/login');
  });

  it('ofrece volver al inicio', async () => {
    await montar('ADMIN');

    const inicio = fixture.nativeElement.querySelector('a[routerLink="/"]') as HTMLAnchorElement;
    expect(inicio).not.toBeNull();
  });
});
