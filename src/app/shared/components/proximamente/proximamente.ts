import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Data } from '@angular/router';

/**
 * Marcador de posición de las secciones que aún no existen.
 *
 * Sirve para que el menú del shell sea navegable desde el primer día: cada ruta
 * ya está declarada con su `rolGuard`, y los días siguientes sólo cambian el
 * `loadComponent` por la pantalla real. Un menú con enlaces muertos obligaría a
 * probar la navegación por rol a mano, cuando esté todo hecho.
 *
 * Lee `titulo` y `dia` de los `data` de la ruta.
 */
@Component({
  selector: 'app-proximamente',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.scss',
})
export class Proximamente {
  private readonly datos = toSignal(inject(ActivatedRoute).data, { initialValue: {} as Data });

  protected readonly titulo = computed(() => (this.datos()['titulo'] as string | undefined) ?? '');
  protected readonly dia = computed(() => this.datos()['dia'] as number | undefined);
}
