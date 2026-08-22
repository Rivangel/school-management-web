import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import { Calificacion, CalificacionRequest, PATRON_PERIODO } from '../../../core/models';
import { AlumnoService } from '../../../core/services/alumno-service';
import { AuthService } from '../../../core/services/auth-service';
import { Avisos } from '../../../core/services/avisos';
import { CalificacionService } from '../../../core/services/calificacion-service';
import { PistaDeCampo, aplicarErroresDeApi } from '../../../core/services/errores-formulario';
import { MaestroService } from '../../../core/services/maestro-service';
import { MateriaService } from '../../../core/services/materia-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';
import { Confirmar, DatosConfirmacion } from '../../../shared/components/confirmar/confirmar';

/** Cuántos alumnos y materias caben en los desplegables; es el tope de la API. */
const EN_EL_SELECTOR = 100;

/** Los límites de `CalificacionRequest`. */
const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 10;

/** Decimales que guarda la columna (`precision = 4, scale = 2`). */
const DECIMALES = 2;

/**
 * Cómo repartir los errores que la API no desglosa por campo.
 *
 * El que de verdad importa es el **403**: un MAESTRO sólo puede calificar las
 * materias que imparte, y esa regla no la decide el rol sino el servidor,
 * materia a materia. Aunque el desplegable ya venga filtrado, el 403 sigue
 * siendo posible —la materia pudo cambiar de maestro entre que se cargó la
 * lista y se pulsó guardar—, así que se cuelga del campo que lo provocó.
 */
const PISTAS: readonly PistaDeCampo[] = [
  {
    patron: /materia/i,
    campo: 'materiaId',
    mensaje: 'No puedes registrar calificaciones de esta materia: no es tuya.',
  },
  { patron: /alumno/i, campo: 'alumnoId' },
  { patron: /periodo/i, campo: 'periodo' },
];

/**
 * Más de dos decimales no caben en la columna y se redondearían **en silencio**.
 *
 * No lo cubre ningún `@DecimalMin`/`@DecimalMax` de la API: un 9.567 se guarda
 * como 9.57 sin decir nada, y quien lo escribió no se entera hasta que vuelve a
 * abrir la nota.
 */
function decimalesValidos(control: AbstractControl): Record<string, true> | null {
  const valor: unknown = control.value;
  if (typeof valor !== 'number' || Number.isNaN(valor)) {
    return null;
  }
  const decimales = (valor.toString().split('.')[1] ?? '').length;
  return decimales > DECIMALES ? { decimales: true } : null;
}

/**
 * Registrar una calificación.
 *
 * Cuarto formulario del patrón y el primero que **no da de alta un registro**:
 * el `POST` de la API es un *upsert* por alumno, materia y periodo, y responde
 * 201 tanto si insertó como si pisó una nota que ya existía. Por el código de
 * estado no hay forma de distinguirlo, así que esta pantalla lo comprueba antes
 * de guardar y **pregunta**: reemplazar un 5.8 por un 9 no es lo mismo que
 * poner una nota donde no había ninguna, y no se puede deshacer.
 *
 * Tampoco es un alta en el otro sentido: no hay listado del que se venga ni al
 * que volver — se vuelve a `/calificaciones`.
 *
 * Y es, desde el Día 22, **también la pantalla de edición**: la API no tiene
 * `PUT`, así que corregir una nota es registrarla otra vez. La consulta por
 * materia enlaza aquí con los datos en la URL (`?alumnoId=1&materiaId=3&…`) y el
 * formulario abre relleno; el aviso de "vas a reemplazar" sigue saliendo, que es
 * literalmente lo que va a pasar.
 */
@Component({
  selector: 'app-formulario-calificacion',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './formulario-calificacion.html',
  styleUrl: './formulario-calificacion.scss',
})
export class FormularioCalificacion {
  private readonly calificaciones = inject(CalificacionService);
  private readonly alumnos = inject(AlumnoService);
  private readonly materias = inject(MateriaService);
  private readonly maestros = inject(MaestroService);
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly notaMinima = NOTA_MINIMA;
  protected readonly notaMaxima = NOTA_MAXIMA;

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    alumnoId: [null as number | null, Validators.required],
    materiaId: [null as number | null, Validators.required],
    calificacion: [
      null as number | null,
      [
        Validators.required,
        Validators.min(NOTA_MINIMA),
        Validators.max(NOTA_MAXIMA),
        decimalesValidos,
      ],
    ],
    periodo: ['', [Validators.required, Validators.pattern(PATRON_PERIODO)]],
  });

  private readonly ruta = inject(ActivatedRoute);

  private readonly query = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  /** Qué trae la URL para rellenar el formulario, ya validado. */
  private readonly prefijado = computed(() => leerPrefijado(this.query()));

  /**
   * Si esto es una corrección y no un alta.
   *
   * Lo dicen los tres campos que identifican una nota en la API (alumno, materia
   * y periodo): con los tres puestos, quien llega viene de una calificación que
   * ya existe. **La API no sabe distinguirlo** —su `POST` es el mismo y su 201
   * también—, así que esto es sólo lo que la pantalla puede decir con
   * honestidad: de dónde viene el usuario.
   */
  protected readonly corrigiendo = computed(() => {
    const prefijado = this.prefijado();
    return (
      prefijado.alumnoId !== undefined &&
      prefijado.materiaId !== undefined &&
      prefijado.periodo !== undefined
    );
  });

  private readonly esMaestro = computed(() => this.auth.rol() === 'MAESTRO');

  /**
   * Quién es el maestro que ha entrado, cuando lo es.
   *
   * El ADMIN no lo pregunta: no tiene registro de maestro y la API le
   * respondería 404. Con `params` en `undefined` el recurso no pide nada.
   */
  private readonly maestroActual = rxResource({
    params: () => (this.esMaestro() ? true : undefined),
    stream: () => this.maestros.obtenerActual(),
  });

  private readonly paginaDeAlumnos = rxResource({
    stream: () => this.alumnos.listar({ size: EN_EL_SELECTOR, sort: 'apellido,asc' }),
  });

  /**
   * Las materias del desplegable, **acotadas al maestro que ha entrado**.
   *
   * Un MAESTRO sólo puede calificar lo que imparte, y la API lo rechaza con un
   * 403; enseñarle las materias de los demás sería ofrecerle un error. Reutiliza
   * el filtro `?maestroId=` del Día 18 en vez de traerlas todas y descartarlas
   * aquí, que sólo alcanzaría a las cien de la primera página.
   *
   * Para el ADMIN no hay filtro: puede calificar cualquier materia.
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

  protected readonly opcionesDeAlumno = computed(() =>
    this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value().content : [],
  );

  protected readonly opcionesDeMateria = computed(() =>
    this.paginaDeMaterias.hasValue() ? this.paginaDeMaterias.value().content : [],
  );

  /**
   * Cuántos alumnos hay de más de los que caben en el desplegable.
   *
   * La API recorta en cien y una escuela puede pasar de ahí de sobra. Decirlo es
   * mejor que dejar creer que la lista está completa; el buscador que consulte
   * al escribir necesita un endpoint que hoy no existe.
   */
  protected readonly alumnosNoListados = computed(() => {
    const pagina = this.paginaDeAlumnos.hasValue() ? this.paginaDeAlumnos.value() : undefined;
    return pagina === undefined ? 0 : pagina.totalElements - pagina.content.length;
  });

  protected readonly cargando = computed(
    () =>
      this.paginaDeAlumnos.isLoading() ||
      this.paginaDeMaterias.isLoading() ||
      this.maestroActual.isLoading(),
  );

  protected readonly enviando = signal(false);

  /** Aviso al pie: lo que la API objetó y no se pudo colgar de ningún campo. */
  protected readonly error = signal<string | null>(null);

  /**
   * Fallo al averiguar qué materias imparte quien ha entrado.
   *
   * Sin eso el desplegable de materias queda vacío para siempre, y un
   * desplegable vacío no explica nada por sí solo.
   */
  protected readonly errorDeCarga = computed(() => {
    const fallo = this.maestroActual.error() ?? this.paginaDeMaterias.error();
    return fallo === undefined
      ? null
      : mensajeDeError(fallo, 'No se pudieron cargar las materias que puedes calificar.');
  });

  protected reintentar(): void {
    this.maestroActual.reload();
    this.paginaDeMaterias.reload();
  }

  constructor() {
    // Se aplica cuando **cambian** los valores, no en cada emisión del router:
    // el `paramMap` se reemite en cualquier navegación y volver a poner los
    // mismos datos borraría lo que el usuario estuviera escribiendo.
    let aplicado: string | null = null;
    effect(() => {
      const prefijado = this.prefijado();
      const clave = JSON.stringify(prefijado);
      if (clave === aplicado) {
        return;
      }
      aplicado = clave;
      this.formulario.patchValue(prefijado);
    });
  }

  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const datos = this.valores();
    this.enviando.set(true);
    this.error.set(null);

    // Antes de guardar, mirar si ya hay nota. La API no lo dice: su 201 es el
    // mismo para un alta y para un reemplazo.
    this.calificaciones.listarPorMateria(datos.materiaId).subscribe({
      next: (registradas) => this.confirmarSiPisa(datos, registradas),
      // La comprobación es una cortesía, no un requisito: si falla, guardar
      // sigue siendo lo que el usuario pidió. Bloquearlo por no haber podido
      // avisar sería peor.
      error: () => this.guardar(datos),
    });
  }

  protected volver(): void {
    void this.router.navigate(['/calificaciones']);
  }

  private confirmarSiPisa(datos: CalificacionRequest, registradas: Calificacion[]): void {
    const previa = registradas.find(
      (candidata) => candidata.alumnoId === datos.alumnoId && candidata.periodo === datos.periodo,
    );

    if (previa === undefined || previa.calificacion === datos.calificacion) {
      this.guardar(datos);
      return;
    }

    const confirmacion: DatosConfirmacion = {
      titulo: 'Ya hay una calificación',
      mensaje: `${previa.alumnoNombre} ya tiene ${previa.calificacion} en ${previa.materiaNombre} (${previa.periodo}). Se reemplazará por ${datos.calificacion}.`,
      confirmar: 'Reemplazar',
    };

    this.dialogo
      .open<Confirmar, DatosConfirmacion, boolean>(Confirmar, { data: confirmacion })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado === true) {
          this.guardar(datos);
        } else {
          this.enviando.set(false);
        }
      });
  }

  private guardar(datos: CalificacionRequest): void {
    this.calificaciones.registrar(datos).subscribe({
      next: (calificacion) => {
        this.enviando.set(false);
        this.avisos.exito(
          `${calificacion.calificacion} para ${calificacion.alumnoNombre} en ${calificacion.materiaNombre} (${calificacion.periodo}).`,
        );
        if (this.corrigiendo()) {
          // Quien viene a corregir una nota concreta viene de una tabla y quiere
          // volver a ella para ver el cambio, no encadenar altas.
          void this.router.navigate(['/calificaciones/materia'], {
            queryParams: { materiaId: calificacion.materiaId },
          });
          return;
        }

        // El formulario se queda abierto: quien califica lo hace de varias
        // personas seguidas, y volver a una pantalla vacía obligaría a elegir
        // otra vez materia y periodo para cada nota.
        this.formulario.controls.alumnoId.reset(null);
        this.formulario.controls.calificacion.reset(null);
      },
      error: (fallo: unknown) => {
        this.enviando.set(false);
        this.error.set(
          aplicarErroresDeApi(
            this.formulario,
            fallo,
            PISTAS,
            'No se pudo registrar la calificación.',
          ),
        );
      },
    });
  }

  /** Los dos ids y la nota salen validados; el `!` no esconde ninguna duda. */
  private valores(): CalificacionRequest {
    const { alumnoId, materiaId, calificacion, periodo } = this.formulario.getRawValue();
    return {
      alumnoId: alumnoId!,
      materiaId: materiaId!,
      calificacion: calificacion!,
      periodo: periodo.trim(),
    };
  }
}

/**
 * Lee de la URL lo que se puede prerrellenar, descartando lo que no vale.
 *
 * Es texto que cualquiera edita en la barra de direcciones, como el `sort` y los
 * filtros de los listados: un `?calificacion=veinte` no puede acabar en un campo
 * numérico, y un periodo con otro formato dejaría el formulario inválido desde
 * el principio sin que se entienda por qué.
 */
function leerPrefijado(query: ParamMap): {
  alumnoId?: number;
  materiaId?: number;
  calificacion?: number;
  periodo?: string;
} {
  const entero = (valor: string | null): number | undefined =>
    valor !== null && /^\d+$/.test(valor) && Number(valor) > 0 ? Number(valor) : undefined;

  const nota = Number(query.get('calificacion'));
  const periodo = query.get('periodo');

  return {
    alumnoId: entero(query.get('alumnoId')),
    materiaId: entero(query.get('materiaId')),
    calificacion:
      query.get('calificacion') !== null &&
      Number.isFinite(nota) &&
      nota >= NOTA_MINIMA &&
      nota <= NOTA_MAXIMA
        ? nota
        : undefined,
    periodo: periodo !== null && PATRON_PERIODO.test(periodo) ? periodo : undefined,
  };
}
