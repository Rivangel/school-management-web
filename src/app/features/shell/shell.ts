import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDrawerMode, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { menuPara } from '../../core/navegacion';
import { AuthService } from '../../core/services/auth-service';

/**
 * Ancho a partir del cual el menú cabe fijo al lado del contenido.
 *
 * No se usa `Breakpoints.Handset` porque sólo cubre teléfonos: una tablet en
 * vertical entra por debajo de este ancho y ahí un menú fijo de 15rem se come
 * media pantalla.
 */
const PANTALLA_ANGOSTA = '(max-width: 959.98px)';

/**
 * Marco de la aplicación: barra superior, menú lateral y el `router-outlet`
 * donde viven las pantallas.
 *
 * Se monta como componente de una ruta padre protegida por `authGuard`, así que
 * puede dar por hecho que hay sesión: si no la hubiera, nadie habría llegado
 * hasta aquí.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nombre = this.auth.nombre;
  protected readonly rol = this.auth.rol;
  protected readonly email = computed(() => this.auth.sesion()?.email ?? '');
  protected readonly iniciales = computed(() => iniciarDe(this.nombre()));
  protected readonly menu = computed(() => menuPara(this.rol()));

  private readonly esAngosta = toSignal(
    inject(BreakpointObserver)
      .observe(PANTALLA_ANGOSTA)
      .pipe(map((resultado) => resultado.matches)),
    { initialValue: false },
  );

  protected readonly modo = computed<MatDrawerMode>(() => (this.esAngosta() ? 'over' : 'side'));

  /**
   * `linkedSignal` y no `signal`: el estado por defecto depende del ancho, pero el
   * usuario puede forzarlo con el botón. Al cambiar el tamaño de la ventana vuelve
   * a mandar el ancho, que es lo que se espera al girar el móvil o maximizar.
   */
  protected readonly abierto = linkedSignal(() => !this.esAngosta());

  protected alternarMenu(): void {
    this.abierto.update((valor) => !valor);
  }

  /**
   * En pantalla angosta el menú tapa el contenido, así que hay que cerrarlo al
   * navegar; en pantalla ancha se queda, porque no estorba.
   */
  protected alNavegar(): void {
    if (this.esAngosta()) {
      this.abierto.set(false);
    }
  }

  protected salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}

/** Iniciales para el avatar: "Ana López" → "AL". */
function iniciarDe(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((parte) => parte.length > 0)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}
