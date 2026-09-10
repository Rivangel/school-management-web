import { signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

/** Clave de `localStorage`. Lleva prefijo para no chocar con otra app del mismo host. */
const CLAVE_TEMA = 'school-management.tema';

/** Atributo en `<html>` del que cuelgan las variables CSS del tema oscuro. */
const ATRIBUTO_TEMA = 'data-tema';

/**
 * Estado del tema, fuera de la inyección de Angular a propósito — mismo motivo
 * que el idioma (`core/i18n/estado.ts`): hay que poder leerlo y aplicarlo antes
 * de que arranque la inyección de Angular, para no pintar en claro y parpadear
 * a oscuro un instante después.
 */
const tema = signal<Tema>(leerInicial());

/** Sólo lectura hacia fuera: el único que cambia el tema es `cambiarTema`. */
export const temaActual = tema.asReadonly();

export function cambiarTema(nuevo: Tema): void {
  if (nuevo === tema()) {
    return;
  }
  try {
    localStorage.setItem(CLAVE_TEMA, nuevo);
  } catch {
    // Un almacenamiento bloqueado (navegación privada, cuota agotada) no debería
    // impedir cambiar de tema: sólo se pierde recordarlo para la próxima vez.
  }
  tema.set(nuevo);
  aplicar(nuevo);
}

export function alternarTema(): void {
  cambiarTema(tema() === 'claro' ? 'oscuro' : 'claro');
}

function aplicar(valor: Tema): void {
  document.documentElement.setAttribute(ATRIBUTO_TEMA, valor);
}

/**
 * El tema guardado; si no hay nada guardado, el del sistema operativo; si
 * tampoco se puede saber, claro (con el que se construyó la aplicación).
 */
function leerInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado === 'claro' || guardado === 'oscuro') {
      return guardado;
    }
  } catch {
    // Almacenamiento bloqueado: se sigue al valor del sistema.
  }
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

// Aplica el tema inicial en cuanto se importa este módulo (ver `main.ts`), antes
// de que Angular arranque, así el primer pintado ya sale en el tema correcto.
aplicar(tema());
