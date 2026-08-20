import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/** Lo que hace falta saber del segmento de la URL que identifica un registro. */
export interface IdDeRuta {
  /** El id, o `undefined` si el segmento falta o no es un número. */
  readonly id: Signal<number | undefined>;
  /** Hay algo escrito en el segmento, sea un id o no (`/alumnos/7/editar`). */
  readonly presente: Signal<boolean>;
  /** Hay algo escrito y **no** es un id (`/alumnos/abc/editar`). */
  readonly invalido: Signal<boolean>;
}

/**
 * El id que trae la URL, ya interpretado.
 *
 * Se lee del `paramMap` y no del `snapshot` porque el router **reutiliza** el
 * componente al navegar entre dos rutas que sólo se distinguen por el id: con el
 * snapshot, ir de `/maestros/7` a `/maestros/9` dejaría la pantalla enseñando al
 * anterior.
 *
 * Lo que justifica sacarlo de las pantallas es la distinción entre las tres
 * respuestas, que es fácil de perder al copiar: **no hay segmento** es un alta,
 * **hay un número** es una edición, y **hay algo que no es un número** no es
 * ninguna de las dos. Si `/alumnos/abc/editar` se confunde con un alta, el
 * formulario abre vacío y el primer guardado crea un registro que nadie pidió.
 *
 * Usa `inject()`, así que se llama desde el inicializador de un campo del
 * componente o desde su constructor.
 */
export function idDeRuta(parametro = 'id'): IdDeRuta {
  const ruta = inject(ActivatedRoute);
  const parametros = toSignal(ruta.paramMap, { initialValue: ruta.snapshot.paramMap });

  const crudo = computed(() => parametros().get(parametro));
  const id = computed(() => {
    const valor = crudo();
    return valor !== null && /^\d+$/.test(valor) ? Number(valor) : undefined;
  });

  return {
    id,
    presente: computed(() => crudo() !== null),
    invalido: computed(() => crudo() !== null && id() === undefined),
  };
}
