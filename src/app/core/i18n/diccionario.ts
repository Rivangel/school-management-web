/** Un nodo del diccionario: o el texto final, o otro nivel de agrupación. */
export type Diccionario = { readonly [clave: string]: string | Diccionario };
