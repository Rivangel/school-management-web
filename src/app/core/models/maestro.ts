/** Espejo de `MaestroResponse`. */
export interface Maestro {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  especialidad: string;
}

/** Espejo de `MaestroRequest`. Nombre, apellido y especialidad hasta 100; email hasta 120. */
export interface MaestroRequest {
  nombre: string;
  apellido: string;
  email: string;
  especialidad: string;
}
