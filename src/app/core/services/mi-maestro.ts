import { Injectable, Signal, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { ROLES_REGISTRO } from '../navegacion';
import { AuthService } from './auth-service';
import { MaestroService } from './maestro-service';

/**
 * Quién es el maestro que ha entrado, y qué materias son suyas.
 *
 * **Existe porque un rol no alcanza para decidir esto.** La API deja registrar
 * calificaciones y asistencia a cualquier MAESTRO, pero sólo **en las materias
 * que imparte**, y eso lo comprueba el servidor materia a materia: `ROLES_REGISTRO`
 * dice que un maestro registra, no en cuál. Enseñarle "Pasar lista" en la materia
 * de un compañero es ofrecerle un 403 con forma de botón.
 *
 * El id no viene en el token —que lleva email y rol—, así que hay que preguntarlo
 * a `/api/maestros/me`. Se pide **una sola vez para toda la aplicación** porque el
 * servicio es de raíz: antes lo preguntaba por su cuenta cada pantalla que lo
 * necesitaba.
 *
 * Un ADMIN no tiene registro de maestro y recibiría un 404, así que no se le
 * pregunta; y no le hace falta, porque puede registrar en cualquier materia.
 */
@Injectable({ providedIn: 'root' })
export class MiMaestro {
  private readonly auth = inject(AuthService);
  private readonly maestros = inject(MaestroService);

  private readonly esMaestro = computed(() => this.auth.rol() === 'MAESTRO');

  /**
   * El recurso se rehace cuando cambia el **email** de la sesión, no sólo el rol:
   * si un maestro sale y entra otro, el rol sigue siendo MAESTRO y el id cacheado
   * sería el del anterior — que es exactamente el error que deja a alguien viendo
   * las materias de un compañero como si fueran suyas.
   */
  private readonly recurso = rxResource({
    params: () => (this.esMaestro() ? this.auth.sesion()?.email : undefined),
    stream: () => this.maestros.obtenerActual(),
  });

  /** El id del maestro que ha entrado; `undefined` si no lo es o aún no llega. */
  readonly id: Signal<number | undefined> = computed(() =>
    this.recurso.hasValue() ? this.recurso.value().id : undefined,
  );

  /** Si todavía se está averiguando. Lo usan las pantallas para no decidir a ciegas. */
  readonly cargando = this.recurso.isLoading;

  /**
   * Por qué no se pudo averiguar, si es que falló.
   *
   * **Tiene que llegar a la pantalla.** Las que filtran sus materias por el id no
   * piden nada mientras no lo tengan, así que un fallo aquí no se manifiesta como
   * un error sino como un desplegable vacío para siempre — que es peor, porque
   * parece que el maestro no imparte nada.
   */
  readonly error = this.recurso.error;

  /** Vuelve a preguntar. Lo llama el "Reintentar" de las pantallas que dependen de esto. */
  recargar(): void {
    this.recurso.reload();
  }

  /**
   * Si la materia de ese maestro es suya.
   *
   * Para quien no es MAESTRO devuelve `false`: la pregunta no le aplica, y quien
   * decide por rol es {@link puedeRegistrarEn}.
   */
  esMia(maestroId: number | undefined): boolean {
    return maestroId !== undefined && this.id() === maestroId;
  }

  /**
   * Si quien ha entrado puede **registrar** notas o asistencia en esa materia.
   *
   * Junta las dos reglas que la API aplica por separado: el rol (`ROLES_REGISTRO`)
   * y, sólo para el MAESTRO, la propiedad de la materia. El ADMIN registra en
   * cualquiera; el ALUMNO en ninguna.
   *
   * Con `maestroId` en `undefined` —la ficha aún no ha cargado— responde `false`:
   * ante la duda no se ofrece la acción, que es el lado en el que equivocarse sólo
   * cuesta un botón que aparece un instante después.
   */
  puedeRegistrarEn(maestroId: number | undefined): boolean {
    if (!this.auth.tieneAlgunRol(...ROLES_REGISTRO)) {
      return false;
    }
    return this.esMaestro() ? this.esMia(maestroId) : true;
  }
}
