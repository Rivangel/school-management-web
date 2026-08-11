/** Espejo de `MateriaResponse`. */
export interface Materia {
  id: number;
  nombre: string;
  creditos: number;
  maestroId: number;
  /** Nombre completo del maestro, ya resuelto por la API. */
  maestroNombre: string;
}

/** Espejo de `MateriaRequest`. Nombre hasta 100 caracteres y créditos entre 1 y 20. */
export interface MateriaRequest {
  nombre: string;
  creditos: number;
  maestroId: number;
}
