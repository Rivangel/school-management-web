import { signal } from '@angular/core';
import { Subject } from 'rxjs';

export type Idioma = 'es' | 'en';

/** Clave de `localStorage`. Lleva prefijo para no chocar con otra app del mismo host. */
const CLAVE_IDIOMA = 'school-management.idioma';

/**
 * Estado del idioma, fuera de la inyección de Angular a propósito.
 *
 * `t()` lo lee desde cualquier sitio —servicios, funciones sueltas como
 * `mensajeDeError`, no sólo componentes— y muchos de esos sitios no corren
 * dentro de un contexto de inyección (un `catchError`, un `subscribe`). Un
 * signal exportado se lee igual de bien desde los dos mundos; un servicio
 * `@Injectable` sólo desde el primero.
 */
const idioma = signal<Idioma>(leerInicial());

/** Sólo lectura hacia fuera: el único que cambia el idioma es `cambiarIdioma`. */
export const idiomaActual = idioma.asReadonly();

/**
 * Avisa a quien no puede depender de un signal —como `MatPaginatorIntl`, que
 * Material sólo sabe releer cuando su `changes` emite— de que el idioma cambió.
 */
export const idiomaCambio$ = new Subject<Idioma>();

export function cambiarIdioma(nuevo: Idioma): void {
  if (nuevo === idioma()) {
    return;
  }
  try {
    localStorage.setItem(CLAVE_IDIOMA, nuevo);
  } catch {
    // Un almacenamiento bloqueado (navegación privada, cuota agotada) no debería
    // impedir cambiar de idioma: sólo se pierde recordarlo para la próxima vez.
  }
  idioma.set(nuevo);
  // El lector de pantalla elige el acento con el que lee el texto a partir de
  // esto; dejarlo en "es" con la pantalla en inglés lo pronunciaría mal.
  document.documentElement.lang = nuevo;
  idiomaCambio$.next(nuevo);
}

export function alternarIdioma(): void {
  cambiarIdioma(idioma() === 'es' ? 'en' : 'es');
}

/** El idioma guardado, o español si no hay nada guardado (o no es válido). */
function leerInicial(): Idioma {
  try {
    return localStorage.getItem(CLAVE_IDIOMA) === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}
