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
import { AuthService } from '../../../core/services/auth-service';
import { MaestroService } from '../../../core/services/maestro-service';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { paginadorEnEspanol } from '../../../shared/paginador-en-espanol';

/**
 * Columnas con datos, en orden. Los identificadores son los nombres de las
 * propiedades de la entidad porque son también los que acepta el `sort` de la
 * API, así la columna que se pulsa y el criterio que se manda no se pueden
 * desincronizar. Esta lista es además la que valida el `sort` que llega por la
 * URL: lo que no esté aquí no viaja.
 *
 * El apellido va primero porque es por donde ordena la API por defecto y por
 * donde se busca a una persona en una lista.
 */
const ORDENABLES = ['apellido', 'nombre', 'especialidad', 'email'] as const;

/**
 * Listado paginado de maestros.
 *
 * Segunda pantalla del patrón que fijó el listado de alumnos: paginar y ordenar
 * son del servidor y el estado vive en la URL, todo dentro de `listadoPaginado`.
 * Aquí sólo quedan las columnas y los textos.
 *
 * Las escrituras son sólo del ADMIN, así que el botón de alta lee
 * `ROLES_ESCRITURA` — la misma lista que protege la ruta a la que lleva.
 */
@Component({
  selector: 'app-lista-maestros',
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
  templateUrl: './lista-maestros.html',
  styleUrl: './lista-maestros.scss',
})
export class ListaMaestros {
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'apellido,asc',
    cargar: (consulta) => this.maestros.listar(consulta),
    mensajeDeFallo: 'No se pudo cargar el listado de maestros.',
  });

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Ocultar no es proteger —la API rechaza igual el POST de un MAESTRO—, pero
   * enseñar un botón que lleva a "acceso denegado" es peor que no enseñarlo. Lee
   * la misma lista que el `rolGuard` de las rutas de escritura.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  protected readonly columnas: string[] = [...ORDENABLES];
}
