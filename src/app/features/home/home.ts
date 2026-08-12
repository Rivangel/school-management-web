import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { menuPara } from '../../core/navegacion';
import { AuthService } from '../../core/services/auth-service';

/**
 * Portada de la aplicación, dentro del shell.
 *
 * Repite como tarjetas las secciones que el rol tiene permitidas: en pantalla
 * ancha el menú lateral ya está a la vista, pero en móvil está plegado y sin
 * esto la portada quedaría vacía. En el Día 26 la sustituye el dashboard con
 * estadísticas.
 */
@Component({
  selector: 'app-home',
  imports: [MatIconModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);

  protected readonly nombre = this.auth.nombre;
  protected readonly rol = this.auth.rol;
  protected readonly accesos = computed(() =>
    menuPara(this.rol()).filter((elemento) => elemento.ruta !== '/'),
  );
}
