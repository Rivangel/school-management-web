import { Diccionario } from './diccionario';
import { EN } from './en';
import { ES } from './es';
import { idiomaActual } from './estado';

const DICCIONARIOS: Record<string, Diccionario> = { es: ES, en: EN };

/**
 * El texto de una clave (`'alumnos.lista.titulo'`), en el idioma actual.
 *
 * Es una función suelta y no un servicio a propósito: la llaman sitios que no
 * corren dentro de un contexto de inyección —`mensajeDeError`, el `catchError`
 * del interceptor, un `computed`— y una función se llama igual desde
 * cualquiera de ellos. Leída dentro de una plantilla o de un `computed`, el
 * signal que consulta por debajo (`idiomaActual`) se registra como cualquier
 * otra lectura reactiva: cambiar el idioma vuelve a pintar sólo lo que
 * realmente lo usa.
 *
 * Si la clave no existe en el idioma actual cae al español, que es el
 * respaldo; si tampoco está ahí, se enseña la clave tal cual — visible de
 * inmediato en vez de un hueco en blanco que nadie nota hasta que alguien se
 * queja.
 */
export function t(clave: string, parametros?: Record<string, string | number>): string {
  const valor = resolver(DICCIONARIOS[idiomaActual()], clave) ?? resolver(ES, clave) ?? clave;
  return interpolar(valor, parametros);
}

function resolver(diccionario: Diccionario, clave: string): string | undefined {
  let nodo: string | Diccionario = diccionario;
  for (const parte of clave.split('.')) {
    if (typeof nodo !== 'object' || nodo === null || !(parte in nodo)) {
      return undefined;
    }
    nodo = nodo[parte];
  }
  return typeof nodo === 'string' ? nodo : undefined;
}

function interpolar(texto: string, parametros?: Record<string, string | number>): string {
  if (parametros === undefined) {
    return texto;
  }
  return texto.replace(/\{\{(\w+)\}\}/g, (coincidencia, nombre: string) =>
    nombre in parametros ? String(parametros[nombre]) : coincidencia,
  );
}
