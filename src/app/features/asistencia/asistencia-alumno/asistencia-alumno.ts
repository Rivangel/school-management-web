import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Asistencia } from '../../../core/models';
import { ROLES_REGISTRO } from '../../../core/navegacion';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AsistenciaService } from '../../../core/services/asistencia-service';
import { AuthService } from '../../../core/services/auth-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';

/** Cuantos alumnos caben en el selector; es tambien el tope de la API. */
const ALUMNOS_EN_EL_SELECTOR = 100;

/** Columnas de la tabla. No hay sort de servidor: esto no viene paginado. */
const COLUMNAS = ['materia', 'fecha', 'asistencia'] as const;

/**
 * Asistencia de un alumno.
 *
 * Mismo patron que CalificacionesAlumno: la API devuelve el arreglo entero
 * sin paginar, asi que no hay mat-paginator ni sort que mandar al servidor.
 *
 * El comportamiento cambia segun el rol de quien entre, no solo que botones
 * se ensenian: el ADMIN y el MAESTRO eligen alumno con un selector; el ALUMNO
 * ve lo suyo sin selector, porque la API solo le deja lo suyo y un desplegable
 * solo prometeria algo que no puede hacer.
 */
@Component({
  selector: 'app-asistencia-alumno',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './asistencia-alumno.html',
  styleUrl: './asistencia-alumno.scss',
})
export class AsistenciaAlumno {
  private readonly asistencia = inject(AsistenciaService);
  private readonly alumnos = inject(AlumnoService);
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly columnas: string[] = [...COLUMNAS];

  protected readonly esAlumno = computed(() => this.auth.rol() === 'ALUMNO');

  /** Pasar lista escribe, y eso no lo hace el ALUMNO. */
  protected readonly puedePasarLista = computed(() =>
    this.auth.tieneAlgunRol(...ROLES_REGISTRO),
  );

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /**
   * El alumno elegido en el selector, leido de la URL y validado.
   *
   * Vive en la URL como el filtro de los listados: el enlace "asistencia de
   * Ana" se comparte y se recarga entero. Un valor que no es un entero positivo
   * se descarta en vez de viajar: la API lo devolveria como un 400.
   */
  private readonly alumnoDeLaUrl = computed(() => {
    const crudo = this.query().get('alumnoId');
    if (crudo === null || !/^\d+$/.test(crudo) || Number(crudo) === 0) {
      return undefined;
    }
    return Number(crudo);
  });

  /**
   * Quien es el alumno que ha entrado, cuando lo es.
   *
   * El ADMIN y el MAESTRO no lo preguntan: no tienen alumno vinculado y la API
   * les responderia 404.
   */
  private readonly alumnoActual = rxResource({
    params: () => (this.esAlumno() ? true : undefined),
    stream: () => this.alumnos.obtenerActual(),
  });

  /** Los alumnos del selector. Un ALUMNO no lo tiene y no los pide. */
  private readonly paginaDeAlumnos = rxResource({
    params: () => (this.esAlumno() ? undefined : true),
    stream: () => this.alumnos.listar({ size: ALUMNOS_EN_EL_SELECTOR, sort: 'apellido,asc' }),
  });

  protected readonly opcionesDeAlumno = computed(() =>
    this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value().content : [],
  );

  protected readonly alumnosNoListados = computed(() => {
    const pagina = this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value() : undefined;
    return pagina === undefined ? 0 : pagina.totalElements - pagina.content.length;
  });

  /**
   * De quien se ensenia la asistencia: el de la URL, o el propio si entro un alumno.
   *
   * Para un ALUMNO el ?alumnoId= de la URL se ignora a proposito: pedir el de
   * otro solo conseguiria un 403, asi que la pantalla no lo intenta.
   */
  private readonly alumnoConsultado = computed(() => {
    if (this.esAlumno()) {
      return this.alumnoActual.hasValue() ? this.alumnoActual.value().id : undefined;
    }
    return this.alumnoDeLaUrl();
  });

  /** null es "ninguno elegido": el mat-select no admite undefined. */
  protected readonly alumnoElegido = computed(() => this.alumnoDeLaUrl() ?? null);

  /** Nombre de quien se esta consultando, para la cabecera. */
  protected readonly nombreConsultado = computed(() => {
    if (this.esAlumno()) {
      const yo = this.alumnoActual.hasValue() ? this.alumnoActual.value() : undefined;
      return yo === undefined ? '' : `${yo.nombre} ${yo.apellido}`;
    }
    const id = this.alumnoDeLaUrl();
    const alumno = this.opcionesDeAlumno().find((candidato) => candidato.id === id);
    return alumno === undefined ? '' : `${alumno.nombre} ${alumno.apellido}`;
  });

  /** Sin alumno elegido no se pide nada: params en undefined. */
  private readonly recurso = rxResource({
    params: () => this.alumnoConsultado(),
    stream: ({ params }) => this.asistencia.listarPorAlumno(params),
  });

  /**
   * Los registros, ordenados aqui: fecha descendente, luego por materia.
   *
   * La API devuelve el arreglo entero (sin paginar), asi que ordenar en el
   * cliente es correcto: no hay paginador que descuadrar ni sort que el
   * servidor sepa interpretar.
   */
  protected readonly filas = computed(() => {
    const recibidos = this.recurso.hasValue() ? this.recurso.value() : [];
    return [...recibidos].sort(
      (uno, otro) =>
        otro.fecha.localeCompare(uno.fecha) ||
        uno.materiaNombre.localeCompare(otro.materiaNombre),
    );
  });

  protected readonly cargando = computed(
    () => this.recurso.isLoading() || this.alumnoActual.isLoading(),
  );

  protected readonly sinElegir = computed(() => this.alumnoConsultado() === undefined);

  protected readonly vacio = computed(
    () => !this.sinElegir() && !this.cargando() && this.filas().length === 0,
  );

  /**
   * Resumen de asistencia: cuantas veces estuvo presente y cuantas ausente.
   *
   * Se calcula sobre todos los registros que hay en la tabla. La API no
   * expone ningun porcentaje y este tampoco se guarda: es una cuenta de la pantalla.
   */
  protected readonly resumen = computed(() => {
    const filas = this.filas();
    if (filas.length === 0) {
      return null;
    }
    const presentes = filas.filter((fila) => fila.presente).length;
    return { total: filas.length, presentes, ausentes: filas.length - presentes };
  });

  protected readonly error = computed(() => {
    const fallo = this.recurso.error() ?? this.alumnoActual.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudo cargar la asistencia.');
  });

  protected elegirAlumno(alumnoId: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { alumnoId },
      queryParamsHandling: 'merge',
    });
  }

  protected reintentar(): void {
    this.alumnoActual.reload();
    this.recurso.reload();
  }

  /** Para el track de la tabla. */
  protected readonly idDe = (_indice: number, asistencia: Asistencia): number => asistencia.id;
}
