import { Signal, computed, signal } from '@angular/core';

/** Algo con un `id` de servidor, que es lo único que la selección necesita. */
export interface ConId {
  readonly id: number;
}

/**
 * Selección de filas de una tabla paginada, por id y no por posición.
 *
 * Guarda ids y no las filas mismas: la fila que llega en la respuesta de
 * guardar puede no ser el mismo objeto que dibujaba la tabla, y comparar por
 * id es lo único que sigue funcionando tras un refresco de la página.
 */
export interface Seleccion<T extends ConId> {
  readonly cantidad: Signal<number>;
  estaMarcada(fila: T): boolean;
  /** De las filas dadas (la página actual), cuáles están marcadas. Conserva el orden. */
  marcadas(filas: readonly T[]): T[];
  /** Si todas las filas dadas están marcadas. `false` con la lista vacía. */
  todasMarcadas(filas: readonly T[]): boolean;
  algunaMarcada(filas: readonly T[]): boolean;
  alternar(fila: T): void;
  /** Marca todas las filas dadas, o las desmarca si ya lo estaban todas. */
  alternarTodas(filas: readonly T[]): void;
  limpiar(): void;
}

/** Estado de selección para una pantalla de listado. Un `signal` por pantalla. */
export function seleccionDeFilas<T extends ConId>(): Seleccion<T> {
  const ids = signal<ReadonlySet<number>>(new Set());

  return {
    cantidad: computed(() => ids().size),
    estaMarcada: (fila) => ids().has(fila.id),
    marcadas: (filas) => filas.filter((fila) => ids().has(fila.id)),
    todasMarcadas: (filas) => filas.length > 0 && filas.every((fila) => ids().has(fila.id)),
    algunaMarcada: (filas) => filas.some((fila) => ids().has(fila.id)),
    alternar: (fila) => {
      ids.update((actual) => {
        const copia = new Set(actual);
        if (copia.has(fila.id)) {
          copia.delete(fila.id);
        } else {
          copia.add(fila.id);
        }
        return copia;
      });
    },
    alternarTodas: (filas) => {
      const todas = filas.length > 0 && filas.every((fila) => ids().has(fila.id));
      ids.set(todas ? new Set() : new Set(filas.map((fila) => fila.id)));
    },
    limpiar: () => ids.set(new Set()),
  };
}
