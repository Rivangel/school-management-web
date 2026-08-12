import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth-service';

/**
 * Destino de `rolGuard` cuando hay sesión pero el rol no alcanza.
 *
 * Ofrece cerrar sesión porque el caso típico es entrar con la cuenta equivocada:
 * sin esa salida, el usuario se queda mirando el aviso sin forma de cambiar de
 * usuario más que borrando el almacenamiento a mano.
 */
@Component({
  selector: 'app-acceso-denegado',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './acceso-denegado.html',
  styleUrl: './acceso-denegado.scss',
})
export class AccesoDenegado {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rol = this.auth.rol;

  protected salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
