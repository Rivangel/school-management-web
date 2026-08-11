/** Espejo de `AlumnoResponse`. */
export interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  matricula: string;
  email: string;
  grupo: string;
}

/**
 * Espejo de `AlumnoRequest`.
 *
 * Los límites que valida la API: nombre y apellido 100, matrícula 20, email 120
 * y grupo 10 caracteres; el email además debe tener formato válido. La API
 * recorta espacios y pasa el email a minúsculas por su cuenta, así que la
 * respuesta puede traer el email escrito distinto a como se envió.
 */
export interface AlumnoRequest {
  nombre: string;
  apellido: string;
  matricula: string;
  email: string;
  grupo: string;
}
