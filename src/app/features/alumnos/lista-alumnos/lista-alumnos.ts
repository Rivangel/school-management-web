import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import { ROLES_ESCRITURA } from '../../../core/navegacion';
import { TAMANOS_PAGINA } from '../../../core/paginacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { paginadorEnEspanol } from '../../../shared/paginador-en-espanol';

/**
 * Columnas con datos, en orden. Los identificadores son los nombres de las
 * propiedades de la entidad porque son también los que acepta el `sort` de la
 * API: así la columna que se pulsa y el criterio que se manda no se pueden
 * desincronizar.
 *
 * La columna de acciones queda **fuera** de esta lista a propósito: esto es
 * además lo que se acepta como `sort` en la URL, y `?sort=acciones,asc` sería un
 * criterio que la API no conoce y devolvería como un 400.
 */
const ORDENABLES = ['matricula', 'apellido', 'nombre', 'grupo', 'email'] as const;

/**
 * Listado paginado de alumnos.
 *
 * Paginación y ordenamiento son **del servidor**: la tabla dibuja la página que
 * llega y nada más. Por eso no hay `MatTableDataSource` — el que trae paginador y
 * ordenamiento propios sólo sabe rebanar el arreglo que ya tiene en memoria, y
 * con datos paginados acabaría paginando 20 filas de un total de 300.
 *
 * El estado (qué página, en qué orden, si cargó o falló) lo lleva
 * `listadoPaginado`, que lo comparte con las demás pantallas de listado.
 */
@Component({
  selector: 'app-lista-alumnos',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
  ],
  // Se provee aquí y no en `app.config.ts` para no meter el paginador de
  // Material en el bundle inicial, que es el que carga el login.
  providers: [{ provide: MatPaginatorIntl, useFactory: paginadorEnEspanol }],
  templateUrl: './lista-alumnos.html',
  styleUrl: './lista-alumnos.scss',
})
export class ListaAlumnos {
  private readonly alumnos = inject(AlumnoService);
  private readonly auth = inject(AuthService);

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'apellido,asc',
    cargar: (consulta) => this.alumnos.listar(consulta),
    mensajeDeFallo: 'No se pudo cargar el listado de alumnos.',
  });

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Ocultar no es proteger —la API rechaza igual el POST de un MAESTRO—, pero
   * enseñar un botón que lleva a "acceso denegado" es peor que no enseñarlo. Lee
   * la misma lista que el `rolGuard` de las rutas del formulario.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /** La columna de acciones está siempre: consultar la ficha lo puede todo el mundo. */
  protected readonly columnas: string[] = [...ORDENABLES, 'acciones'];
}
