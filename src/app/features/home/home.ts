import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { environment } from '../../../environments/environment';

/**
 * Pantalla de arranque provisional.
 *
 * Existe para tener algo visible mientras llegan el login (Día 11) y el shell con
 * sidenav (Día 12), y de paso verifica que el tema de Material y los iconos estén
 * bien cableados. Se sustituye en cuanto haya rutas reales.
 */
@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatToolbarModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly apiUrl = environment.apiUrl;
}
