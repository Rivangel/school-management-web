import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Barra } from '../../../core/estadisticas';

/** Alto de una fila y hueco entre filas, en píxeles del `viewBox`. */
const ALTO_FILA = 28;
const HUECO = 8;

/** Ancho del `viewBox`. Es una unidad de trabajo: el SVG se escala al contenedor. */
const ANCHO = 100;

/** Una barra ya colocada en el SVG. */
interface BarraDibujada extends Barra {
  readonly y: number;
  /** Ancho de la barra, 0–100, ya proporcional al máximo. */
  readonly ancho: number;
}

/**
 * Gráfica de barras horizontales, en SVG.
 *
 * **Por qué no una librería de gráficas.** El plan proponía ngx-charts "por
 * ejemplo", y para dos gráficas de barras el ejemplo sale caro: arrastra d3 y
 * pide `@angular/animations` y `@angular/platform-browser-dynamic`, que este
 * proyecto no tiene. El dashboard es la primera pantalla tras el login, así que
 * ese peso lo paga todo el mundo en cada entrada — el mismo problema del Día 12
 * con el shell y el del Día 15 con el overlay del snackbar. Un `<svg>` con
 * `<rect>` no tiene ese coste y se pinta con los tokens del tema, así que el
 * modo oscuro del Día 34 no tendrá que tocarlo.
 *
 * **Barras horizontales y no verticales** porque lo que etiqueta cada barra es
 * el nombre de una materia: en vertical no cabe y acaba girado o recortado.
 *
 * **Accesible sin trucos.** El SVG es decorativo (`aria-hidden`) y quien lo
 * necesite lee la misma información en una tabla con `.solo-lectores`, que es
 * la que anuncia el lector de pantalla. Un `aria-label` con toda la serie
 * dentro se lee de una parrafada y no deja comparar valor por valor.
 */
@Component({
  selector: 'app-grafica-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grafica-barras.html',
  styleUrl: './grafica-barras.scss',
})
export class GraficaBarras {
  readonly barras = input.required<readonly Barra[]>();

  /** Título de la gráfica; encabeza también la tabla accesible. */
  readonly titulo = input.required<string>();

  /** Qué mide el eje, para la cabecera de la tabla accesible. */
  readonly unidad = input('Valor');

  /**
   * Tope del eje. Sin él manda el valor más alto de la serie.
   *
   * Importa fijarlo cuando la escala tiene un significado propio: con notas
   * sobre 10, un máximo automático dibujaría un 6 como barra llena y el grupo
   * parecería ir de sobresaliente.
   */
  readonly maximo = input<number | null>(null);

  /** Qué decir cuando no hay nada que dibujar. */
  readonly vacio = input('Todavía no hay datos que graficar.');

  protected readonly hayDatos = computed(() => this.barras().length > 0);

  /** El tope real del eje. Nunca cero: dividir por él da NaN y no pinta nada. */
  private readonly tope = computed(() => {
    const declarado = this.maximo();
    if (declarado !== null && declarado > 0) {
      return declarado;
    }
    return Math.max(...this.barras().map((barra) => barra.valor), 0) || 1;
  });

  protected readonly dibujadas = computed<BarraDibujada[]>(() =>
    this.barras().map((barra, indice) => ({
      ...barra,
      y: indice * (ALTO_FILA + HUECO),
      // Un valor real de cero deja un hilo visible en vez de nada: sin él la
      // fila parece un fallo de carga y no un cero.
      ancho: Math.max((Math.max(barra.valor, 0) / this.tope()) * ANCHO, barra.valor > 0 ? 1 : 0.4),
    })),
  );

  protected readonly alto = computed(() =>
    Math.max(this.barras().length * (ALTO_FILA + HUECO) - HUECO, ALTO_FILA),
  );

  protected readonly ancho = ANCHO;
  protected readonly altoFila = ALTO_FILA;
}
