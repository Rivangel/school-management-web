import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Rol } from '../../core/models';
import { AuthService } from '../../core/services/auth-service';
import { CLAVE_SESION, sembrarSesion } from '../../core/services/testing/sesion-falsa';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  async function montar(rol: Rol): Promise<void> {
    sembrarSesion(rol);
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
  }

  function enlacesDelMenu(): string[] {
    // El título va en su propio span: el texto del enlace completo incluiría
    // también la ligadura del icono ("groupsAlumnos").
    return [...fixture.nativeElement.querySelectorAll('mat-nav-list a [matListItemTitle]')].map(
      (titulo) => (titulo as HTMLElement).textContent!.trim(),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('enseña todas las secciones al ADMIN', async () => {
    await montar('ADMIN');

    expect(enlacesDelMenu()).toEqual([
      'Inicio',
      'Alumnos',
      'Maestros',
      'Materias',
      'Calificaciones',
      'Asistencia',
      'Reportes',
    ]);
  });

  it('esconde al ALUMNO las secciones que la API le cierra', async () => {
    await montar('ALUMNO');

    const enlaces = enlacesDelMenu();
    expect(enlaces).not.toContain('Alumnos');
    expect(enlaces).not.toContain('Maestros');
    expect(enlaces).toContain('Calificaciones');
  });

  it('identifica al usuario con su nombre y sus iniciales', async () => {
    await montar('MAESTRO');

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Usuario MAESTRO');
    expect(fixture.nativeElement.querySelector('.shell__avatar').textContent.trim()).toBe('UM');
  });

  it('cierra la sesión y manda al login', async () => {
    await montar('ADMIN');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture.nativeElement.querySelector('.shell__usuario').click();
    await fixture.whenStable();
    const salir = document.querySelector('button[mat-menu-item]') as HTMLButtonElement;
    salir.click();
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).estaAutenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/login');
  });

  it('el menú arranca abierto en pantalla ancha', async () => {
    await montar('ADMIN');

    expect(fixture.nativeElement.querySelector('mat-sidenav').classList).toContain(
      'mat-drawer-opened',
    );
  });
});
