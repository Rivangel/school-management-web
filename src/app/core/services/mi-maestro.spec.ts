import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Maestro, Sesion } from '../models';
import { AuthService } from './auth-service';
import { MaestroService } from './maestro-service';
import { MiMaestro } from './mi-maestro';

const JUAN: Maestro = {
  id: 1,
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan.perez@escuela.com',
  especialidad: 'Matemáticas',
};

const LAURA: Maestro = {
  id: 2,
  nombre: 'Laura',
  apellido: 'Gómez',
  email: 'laura.gomez@escuela.com',
  especialidad: 'Ciencias de la Computación',
};

function sesion(email: string, rol: Sesion['rol']): Sesion {
  return { token: 'x.y.z', email, nombre: email, rol };
}

describe('MiMaestro', () => {
  let auth: AuthService;
  let maestros: MaestroService;
  /**
   * La sesión de mentira es una **señal**, no un `mockReturnValue`.
   *
   * Un `mockReturnValue` sustituye la señal por una función que siempre devuelve
   * lo mismo: deja de haber nada que observar, así que el recurso no se entera de
   * un cambio de sesión y el test que lo comprueba fallaría por el molde y no por
   * el código.
   */
  let sesionActual: ReturnType<typeof signal<Sesion | null>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    maestros = TestBed.inject(MaestroService);

    sesionActual = signal<Sesion | null>(null);
    vi.spyOn(auth, 'sesion').mockImplementation(() => sesionActual());
    vi.spyOn(auth, 'rol').mockImplementation(() => sesionActual()?.rol ?? null);
    vi.spyOn(auth, 'tieneAlgunRol').mockImplementation((...roles) => {
      const rol = sesionActual()?.rol;
      return rol !== undefined && roles.includes(rol);
    });
  });

  /** Monta el servicio ya con la sesión puesta y el recurso resuelto. */
  function conSesion(actual: Sesion | null, ficha: Maestro = JUAN): MiMaestro {
    sesionActual.set(actual);
    vi.spyOn(maestros, 'obtenerActual').mockReturnValue(of(ficha));

    const servicio = TestBed.inject(MiMaestro);
    TestBed.tick();
    return servicio;
  }

  it('un MAESTRO averigua su id, que el token no trae', () => {
    const mio = conSesion(sesion(JUAN.email, 'MAESTRO'), JUAN);

    expect(mio.id()).toBe(JUAN.id);
  });

  it('a un ADMIN no se le pregunta: no tiene registro de maestro y sería un 404', () => {
    const consulta = vi.spyOn(maestros, 'obtenerActual');
    const mio = conSesion(sesion('admin@escuela.com', 'ADMIN'));

    expect(consulta).not.toHaveBeenCalled();
    expect(mio.id()).toBeUndefined();
  });

  it('el MAESTRO reconoce su materia y no la del compañero', () => {
    const mio = conSesion(sesion(JUAN.email, 'MAESTRO'), JUAN);

    expect(mio.esMia(JUAN.id)).toBe(true);
    expect(mio.esMia(LAURA.id)).toBe(false);
  });

  it('el MAESTRO sólo registra en la suya: es la regla que la API comprueba una a una', () => {
    const mio = conSesion(sesion(JUAN.email, 'MAESTRO'), JUAN);

    expect(mio.puedeRegistrarEn(JUAN.id)).toBe(true);
    expect(mio.puedeRegistrarEn(LAURA.id)).toBe(false);
  });

  it('el ADMIN registra en cualquier materia', () => {
    const mio = conSesion(sesion('admin@escuela.com', 'ADMIN'));

    expect(mio.puedeRegistrarEn(LAURA.id)).toBe(true);
    expect(mio.puedeRegistrarEn(undefined)).toBe(true);
  });

  it('el ALUMNO no registra en ninguna', () => {
    const mio = conSesion(sesion('ana.lopez@escuela.com', 'ALUMNO'));

    expect(mio.puedeRegistrarEn(JUAN.id)).toBe(false);
  });

  it('con la materia aún sin cargar no ofrece la acción: ante la duda, no', () => {
    const mio = conSesion(sesion(JUAN.email, 'MAESTRO'), JUAN);

    expect(mio.puedeRegistrarEn(undefined)).toBe(false);
  });

  it('al entrar otro maestro vuelve a preguntar: el rol no cambia, la persona sí', () => {
    const consulta = vi.spyOn(maestros, 'obtenerActual').mockReturnValue(of(JUAN));
    const mio = conSesion(sesion(JUAN.email, 'MAESTRO'), JUAN);

    expect(mio.id()).toBe(JUAN.id);

    consulta.mockReturnValue(of(LAURA));
    sesionActual.set(sesion(LAURA.email, 'MAESTRO'));
    // Dos vueltas: una para que el recurso vea el email nuevo y vuelva a pedir,
    // otra para que llegue la respuesta.
    TestBed.tick();
    TestBed.tick();

    expect(consulta).toHaveBeenCalledTimes(2);
    expect(mio.id()).toBe(LAURA.id);
    expect(mio.esMia(JUAN.id)).toBe(false);
  });
});
