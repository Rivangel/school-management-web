import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ParamMap, RouterLink } from '@angular/router';

import { ROLES_ESCRITURA, rolesDe } from '../../../core/navegacion';
import { TAMANOS_PAGINA } from '../../../core/paginacion';
import { AuthService } from '../../../core/services/auth-service';
import { MaestroService } from '../../../core/services/maestro-service';
import { MateriaService } from '../../../core/services/materia-service';
import { listadoPaginado } from '../../../shared/listado-paginado';
import { paginadorEnEspanol } from '../../../shared/paginador-en-espanol';

/**
 * Columnas con datos, en orden, que son también los `sort` que acepta la API.
 *
 * `maestro.apellido` es una propiedad **anidada**: la API sabe ordenar por la
 * relación (`sort=maestro.apellido,asc`) y ordenar por `maestroNombre` —el campo
 * que de verdad se enseña— devolvería un 400, porque ese nombre lo compone el
 * DTO y no existe en la entidad.
 */
const ORDENABLES = ['nombre', 'creditos', 'maestro.apellido'] as const;

/** Cuántos maestros caben en el selector; es también el tope de la API. */
const MAESTROS_EN_EL_SELECTOR = 100;

/** El filtro que esta pantalla añade a la paginación de siempre. */
interface FiltroDeMaterias {
  maestroId?: number;
}

/**
 * Lee el filtro de la URL, validado.
 *
 * Un `maestroId` que no es un entero positivo se descarta en vez de viajar: la
 * API responde 400 a `?maestroId=abc`, y una dirección mal escrita se
 * convertiría en una pantalla de error en lugar de un listado.
 */
function leerFiltro(query: ParamMap): FiltroDeMaterias {
  const crudo = query.get('maestroId');
  if (crudo === null || !/^\d+$/.test(crudo) || Number(crudo) === 0) {
    return {};
  }
  return { maestroId: Number(crudo) };
}

/**
 * Listado paginado de materias, con filtro por maestro.
 *
 * Tercer listado del patrón, y el primero que **filtra**. Lo importante es dónde
 * ocurre el filtrado: en la API, no aquí. La tabla sólo tiene en memoria la
 * página que se está viendo, así que quedarse con las filas de un maestro sobre
 * ese puñado enseñaría "las materias de Laura que había en esta página" y un
 * paginador que sigue contando todas.
 *
 * El filtro vive en la URL (`?maestroId=2`) junto a `page`, `size` y `sort`, de
 * modo que el enlace se comparte y se recarga entero.
 */
@Component({
  selector: 'app-lista-materias',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
  ],
  // Se provee aquí y no en `app.config.ts` para no meter el paginador de
  // Material en el bundle inicial, que es el que carga el login.
  providers: [{ provide: MatPaginatorIntl, useFactory: paginadorEnEspanol }],
  templateUrl: './lista-materias.html',
  styleUrl: './lista-materias.scss',
})
export class ListaMaterias {
  private readonly materias = inject(MateriaService);
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);

  protected readonly listado = listadoPaginado({
    ordenables: ORDENABLES,
    ordenPorDefecto: 'nombre,asc',
    leerFiltros: leerFiltro,
    cargar: (consulta) => this.materias.listar(consulta),
    mensajeDeFallo: 'No se pudo cargar el listado de materias.',
  });

  /**
   * Si esta sesión puede siquiera pedir la lista de maestros.
   *
   * El listado de materias lo ve **todo el mundo**, el de maestros no: la API lo
   * reserva a ADMIN y MAESTRO. Un ALUMNO que abriera esta pantalla se llevaba un
   * 403 silencioso —el servicio no avisa por su cuenta— y un desplegable vacío
   * con una sola opción, "Todos los maestros", que no filtra nada. Lee de
   * `MENU`, que es el espejo de `SecurityConfig`, y no una lista escrita aquí.
   */
  protected readonly puedeFiltrar = computed(() =>
    this.auth.tieneAlgunRol(...rolesDe('/maestros')),
  );

  /**
   * Los maestros que ofrece el selector.
   *
   * Se piden una sola vez y en una sola página: son la plantilla de una escuela,
   * no un catálogo. Si algún día pasan de cien —el tope de la API— este `select`
   * se queda corto y habrá que cambiarlo por un buscador que consulte al
   * escribir; mientras tanto, un desplegable es más rápido que teclear.
   *
   * Con `params` en `undefined` el recurso **no pide nada**: quien no puede leer
   * maestros tampoco manda la petición que iba a volver como 403.
   */
  private readonly recursoMaestros = rxResource({
    params: () => (this.puedeFiltrar() ? true : undefined),
    stream: () => this.maestros.listar({ size: MAESTROS_EN_EL_SELECTOR }),
  });

  protected readonly maestrosDelSelector = computed(() =>
    this.recursoMaestros.hasValue() ? this.recursoMaestros.value().content : [],
  );

  /** `null` es "todos": el `mat-select` no admite `undefined` como valor. */
  protected readonly maestroElegido = computed(() => this.listado.consulta().maestroId ?? null);

  protected readonly filtrando = computed(() => this.maestroElegido() !== null);

  protected filtrarPorMaestro(maestroId: number | null): void {
    this.listado.filtrar({ maestroId });
  }

  protected quitarFiltro(): void {
    this.filtrarPorMaestro(null);
  }

  // Copia mutable: `pageSizeOptions` pide `number[]` y la constante es una tupla
  // `readonly`.
  protected readonly tamanos: number[] = [...TAMANOS_PAGINA];

  /**
   * Quién puede dar de alta, editar y borrar. Ocultar no es proteger —la API
   * rechaza igual el POST de un MAESTRO—, pero enseñar un botón que lleva a
   * "acceso denegado" es peor que no enseñarlo.
   *
   * Aquí se separa de las otras dos secciones: el listado lo ve **todo el
   * mundo**, así que la mayoría de quienes abren esta pantalla no verán ninguna
   * de estas acciones.
   */
  protected readonly puedeEditar = computed(() => this.auth.tieneAlgunRol(...ROLES_ESCRITURA));

  /**
   * La columna de acciones está siempre —la ficha la puede consultar cualquiera—
   * y **no** entra en `ORDENABLES`: esa lista es también lo que se acepta como
   * `sort` en la URL, y `?sort=acciones,asc` viajaría a la API como una
   * propiedad que no existe.
   */
  protected readonly columnas: string[] = [...ORDENABLES, 'acciones'];
}
