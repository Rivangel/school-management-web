import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Alumno, AsistenciaRequest } from '../../../core/models';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AsistenciaService } from '../../../core/services/asistencia-service';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { MaestroService } from '../../../core/services/maestro-service';
import { MateriaService } from '../../../core/services/materia-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';

/** Cuántos alumnos y materias caben en los desplegables; el tope de la API. */
const EN_EL_SELECTOR = 100;

const COLUMNAS = ['alumno', 'grupo', 'asistencia'] as const;

/**
 * La fecha de hoy en formato ISO **local**.
 *
 * `toISOString()` da la fecha en UTC, así que a partir de media tarde en un huso
 * negativo devuelve el día siguiente: pasar lista un lunes por la noche la
 * guardaría como del martes, y con `@PastOrPresent` la API además la rechazaría
 * por futura. Se compone a mano con las partes locales.
 */
function isoLocal(fecha: Date): string {
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Interpreta `AAAA-MM-DD` como una fecha **local**, por lo mismo de arriba. */
function desdeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Una fila de la lista: el alumno y cómo está marcado ahora mismo. */
export interface FilaDeAsistencia {
  readonly alumno: Alumno;
  /** `undefined` es "sin marcar": no es lo mismo que ausente. */
  readonly presente: boolean | undefined;
}

/**
 * Pasar lista de una materia en una fecha.
 *
 * Es la primera pantalla que **escribe varios registros de una vez**, y la API
 * no tiene forma de recibirlos juntos: `POST /api/asistencia` guarda a un
 * alumno, así que una lista de treinta son treinta peticiones. Por eso sólo se
 * mandan **las que cambiaron** — volver a enviar la clase entera para corregir
 * una falta es gratis para quien mira la pantalla y no para el servidor.
 *
 * Tres estados por alumno, no dos: presente, ausente y **sin marcar**. Un
 * interruptor de dos posiciones confundiría "no he pasado lista todavía" con
 * "faltó", que es justo lo que no se quiere apuntar por descuido.
 */
@Component({
  selector: 'app-registro-asistencia',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
  ],
  // El adaptador de fechas vive aquí y no en `app.config.ts` para no meterlo en
  // el bundle inicial, que es el que carga el login.
  providers: [provideNativeDateAdapter()],
  templateUrl: './registro-asistencia.html',
  styleUrl: './registro-asistencia.scss',
})
export class RegistroAsistencia {
  private readonly asistencia = inject(AsistenciaService);
  private readonly alumnos = inject(AlumnoService);
  private readonly materias = inject(MateriaService);
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly columnas: string[] = [...COLUMNAS];

  /** Hoy, que es también el máximo que acepta la API (`@PastOrPresent`). */
  protected readonly hoy = new Date();

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /** La materia elegida, en la URL y validada como el resto de filtros. */
  protected readonly materiaId = computed(() => {
    const crudo = this.query().get('materiaId');
    return crudo !== null && /^\d+$/.test(crudo) && Number(crudo) > 0 ? Number(crudo) : undefined;
  });

  /**
   * El día del que se pasa lista, en la URL como cadena ISO.
   *
   * Sin fecha en la URL no se supone hoy: pasar lista es apuntar algo que
   * ocurrió un día concreto, y elegirlo por el usuario es la clase de ayuda que
   * acaba guardando faltas en el día equivocado.
   */
  protected readonly fecha = computed(() => {
    const crudo = this.query().get('fecha');
    return crudo !== null && ISO.test(crudo) && !Number.isNaN(desdeIso(crudo).getTime())
      ? crudo
      : undefined;
  });

  protected readonly fechaComoDate = computed(() => {
    const iso = this.fecha();
    return iso === undefined ? null : desdeIso(iso);
  });

  private readonly esMaestro = computed(() => this.auth.rol() === 'MAESTRO');

  /** Quién ha entrado, cuando es maestro. El ADMIN no lo pregunta (404). */
  private readonly maestroActual = rxResource({
    params: () => (this.esMaestro() ? true : undefined),
    stream: () => this.maestros.obtenerActual(),
  });

  /**
   * Las materias que se pueden pasar lista, acotadas al maestro que ha entrado.
   *
   * Aquí sí se acota —a diferencia de la consulta del Día 22— porque esta
   * pantalla **escribe**, y la API rechaza con un 403 la materia que no es suya.
   */
  private readonly paginaDeMaterias = rxResource({
    params: () => {
      if (!this.esMaestro()) {
        return { size: EN_EL_SELECTOR };
      }
      const yo = this.maestroActual.hasValue() ? this.maestroActual.value().id : undefined;
      return yo === undefined ? undefined : { size: EN_EL_SELECTOR, maestroId: yo };
    },
    stream: ({ params }) => this.materias.listar(params),
  });

  protected readonly opcionesDeMateria = computed(() =>
    this.paginaDeMaterias.hasValue() ? this.paginaDeMaterias.value().content : [],
  );

  /**
   * A quién se pasa lista: **todos los alumnos**.
   *
   * El esquema no tiene inscripciones —ninguna tabla dice quién cursa qué—, así
   * que la lista de clase es la escuela entera. Es una limitación del modelo, no
   * de esta pantalla, y por eso el aviso de "faltan N" importa aquí más que en
   * ningún otro sitio.
   */
  private readonly paginaDeAlumnos = rxResource({
    params: () =>
      this.listaVisible() ? { size: EN_EL_SELECTOR, sort: 'apellido,asc' } : undefined,
    stream: ({ params }) => this.alumnos.listar(params),
  });

  /** Lo ya registrado de esa materia ese día. Sin él sólo se podría resobrescribir. */
  private readonly registrada = rxResource({
    params: () => {
      const materiaId = this.materiaId();
      const fecha = this.fecha();
      return materiaId === undefined || fecha === undefined ? undefined : { materiaId, fecha };
    },
    stream: ({ params }) => this.asistencia.listarPorMateriaYFecha(params.materiaId, params.fecha),
  });

  protected readonly listaVisible = computed(
    () => this.materiaId() !== undefined && this.fecha() !== undefined,
  );

  /** Lo que dice el servidor: alumno → presente. Lo que no está, sin marcar. */
  private readonly marcasGuardadas = computed(() => {
    const guardadas = new Map<number, boolean>();
    if (this.registrada.hasValue()) {
      for (const registro of this.registrada.value()) {
        guardadas.set(registro.alumnoId, registro.presente);
      }
    }
    return guardadas;
  });

  /**
   * Lo que se ve en pantalla, que empieza siendo lo guardado.
   *
   * `linkedSignal` y no `signal`: al cambiar de materia o de día las marcas
   * anteriores **no** pueden quedarse: serían las de otra clase.
   */
  private readonly marcas = linkedSignal<Map<number, boolean>, Map<number, boolean>>({
    source: () => this.marcasGuardadas(),
    computation: (guardadas) => new Map(guardadas),
  });

  protected readonly filas = computed<FilaDeAsistencia[]>(() => {
    const marcas = this.marcas();
    const alumnos = this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value().content : [];
    return alumnos.map((alumno) => ({ alumno, presente: marcas.get(alumno.id) }));
  });

  protected readonly alumnosNoListados = computed(() => {
    const pagina = this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value() : undefined;
    return pagina === undefined ? 0 : pagina.totalElements - pagina.content.length;
  });

  /** Sólo lo que cambió respecto a lo guardado: lo demás no se vuelve a mandar. */
  protected readonly cambios = computed(() => {
    const guardadas = this.marcasGuardadas();
    return [...this.marcas().entries()].filter(
      ([alumnoId, presente]) => guardadas.get(alumnoId) !== presente,
    );
  });

  protected readonly guardando = signal(false);

  protected readonly cargando = computed(
    () =>
      this.paginaDeMaterias.isLoading() ||
      this.paginaDeAlumnos.isLoading() ||
      this.registrada.isLoading() ||
      this.maestroActual.isLoading(),
  );

  protected readonly error = computed(() => {
    const fallo =
      this.maestroActual.error() ?? this.paginaDeMaterias.error() ?? this.registrada.error();
    return fallo === undefined ? null : mensajeDeError(fallo, 'No se pudo cargar la lista.');
  });

  /** Lo que no se pudo guardar, para que se vea a quién hay que repetirle. */
  protected readonly fallidos = signal<string[]>([]);

  protected elegirMateria(materiaId: number | null): void {
    this.irA({ materiaId });
  }

  protected elegirFecha(fecha: Date | null): void {
    this.irA({ fecha: fecha === null ? null : isoLocal(fecha) });
  }

  protected marcar(alumnoId: number, presente: boolean): void {
    this.marcas.update((actuales) => new Map(actuales).set(alumnoId, presente));
  }

  /** Marca a todo el mundo presente, que es lo normal, y luego se corrigen las faltas. */
  protected marcarTodosPresentes(): void {
    this.marcas.update((actuales) => {
      const siguiente = new Map(actuales);
      for (const fila of this.filas()) {
        siguiente.set(fila.alumno.id, true);
      }
      return siguiente;
    });
  }

  protected reintentar(): void {
    this.maestroActual.reload();
    this.paginaDeMaterias.reload();
    this.registrada.reload();
  }

  protected guardar(): void {
    const materiaId = this.materiaId();
    const fecha = this.fecha();
    const cambios = this.cambios();
    if (materiaId === undefined || fecha === undefined || cambios.length === 0) {
      return;
    }

    this.guardando.set(true);
    this.fallidos.set([]);

    const nombres = new Map(this.filas().map((fila) => [fila.alumno.id, nombreDe(fila.alumno)]));

    // Una petición por alumno: la API no sabe recibir la lista entera. Cada una
    // se lleva su propio `catchError` para que un fallo no cancele las demás —
    // con `forkJoin` a secas, un 403 tiraría abajo la clase completa.
    const peticiones = cambios.map(([alumnoId, presente]) => {
      const datos: AsistenciaRequest = { alumnoId, materiaId, fecha, presente };
      return this.asistencia.registrar(datos).pipe(
        map(() => ({ alumnoId, guardado: true })),
        catchError(() => of({ alumnoId, guardado: false })),
      );
    });

    forkJoin(peticiones).subscribe((resultados) => {
      this.guardando.set(false);
      const fallidos = resultados.filter((resultado) => !resultado.guardado);
      this.fallidos.set(fallidos.map((fallido) => nombres.get(fallido.alumnoId) ?? 'Alumno'));

      const guardados = resultados.length - fallidos.length;
      if (guardados > 0) {
        this.avisos.exito(
          guardados === 1 ? 'Se guardó 1 registro.' : `Se guardaron ${guardados} registros.`,
        );
      }
      // Recargar deja la pantalla contando la verdad del servidor: lo que falló
      // sigue marcado como pendiente y lo que se guardó deja de contar como
      // cambio.
      this.registrada.reload();
    });
  }

  private irA(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: cambios,
      queryParamsHandling: 'merge',
    });
  }

  protected readonly idDe = (_indice: number, fila: FilaDeAsistencia): number => fila.alumno.id;
}

function nombreDe(alumno: Alumno): string {
  return `${alumno.nombre} ${alumno.apellido}`;
}
