import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { sinAvisoGlobal } from '../interceptors/error-interceptor';
import { AuthResponse, LoginRequest, RegisterRequest, Rol, Sesion, esRol } from '../models';
import { estaExpirado } from './jwt';

/** Clave de `localStorage`. Lleva prefijo para no chocar con otra app del mismo host. */
const CLAVE_SESION = 'school-management.sesion';

/**
 * Única fuente de verdad sobre quién está dentro.
 *
 * La sesión vive en `localStorage` (no en memoria) para sobrevivir a un F5, y se
 * expone como signal para que el shell y los guards reaccionen sin suscribirse a
 * nada.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly sesionActual = signal<Sesion | null>(recuperarSesion());

  readonly sesion = this.sesionActual.asReadonly();
  readonly estaAutenticado = computed(() => this.sesionActual() !== null);
  readonly rol = computed<Rol | null>(() => this.sesionActual()?.rol ?? null);
  readonly nombre = computed(() => this.sesionActual()?.nombre ?? '');

  /** Token vigente, o `null` si no hay sesión. Lo usa el interceptor. */
  token(): string | null {
    return this.sesionActual()?.token ?? null;
  }

  /** El 401 lo traduce el propio login ("correo o contraseña incorrectos"). */
  login(credenciales: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, credenciales, {
        context: sinAvisoGlobal(),
      })
      .pipe(tap((respuesta) => this.abrirSesion(respuesta)));
  }

  /** La API responde 201 y devuelve ya un token, así que registrarse deja al usuario dentro. */
  registrar(datos: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, datos, {
        context: sinAvisoGlobal(),
      })
      .pipe(tap((respuesta) => this.abrirSesion(respuesta)));
  }

  /**
   * Cierra la sesión localmente. No hay endpoint que llamar: el JWT no se guarda
   * en el servidor, deja de valer al borrarlo o al expirar.
   *
   * No navega a ningún lado a propósito — de eso se encargan el guard y el botón
   * de logout, que sí saben a qué ruta ir.
   */
  logout(): void {
    localStorage.removeItem(CLAVE_SESION);
    this.sesionActual.set(null);
  }

  /** Atajo para el menú y los guards de rol. */
  tieneAlgunRol(...roles: Rol[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }

  private abrirSesion(respuesta: AuthResponse): void {
    const sesion: Sesion = {
      token: respuesta.token,
      email: respuesta.email,
      nombre: respuesta.nombre,
      rol: respuesta.rol,
    };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    this.sesionActual.set(sesion);
  }
}

/**
 * Recupera la sesión guardada, descartándola si ya no sirve.
 *
 * La comprobación no es paranoia: sin ella, un token caducado (o un
 * `localStorage` editado a mano) deja al usuario viendo un shell de ADMIN
 * mientras cada petición vuelve con 401. Es mejor mandarlo al login de una vez.
 */
function recuperarSesion(): Sesion | null {
  const guardado = localStorage.getItem(CLAVE_SESION);
  if (guardado === null) {
    return null;
  }

  const sesion = interpretarSesion(guardado);
  if (sesion === null || estaExpirado(sesion.token)) {
    localStorage.removeItem(CLAVE_SESION);
    return null;
  }
  return sesion;
}

function interpretarSesion(guardado: string): Sesion | null {
  try {
    const valor: unknown = JSON.parse(guardado);
    if (valor === null || typeof valor !== 'object') {
      return null;
    }

    const { token, email, nombre, rol } = valor as Record<string, unknown>;
    if (
      typeof token !== 'string' ||
      typeof email !== 'string' ||
      typeof nombre !== 'string' ||
      !esRol(rol)
    ) {
      return null;
    }
    return { token, email, nombre, rol };
  } catch {
    return null;
  }
}
