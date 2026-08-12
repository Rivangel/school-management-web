import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth-service';
import { mensajeDeError } from '../../../core/services/mensaje-error';

/**
 * Puerta de entrada a la aplicación.
 *
 * Sólo se encarga del formulario y del mensaje de error: guardar la sesión es
 * cosa de `AuthService`, y decidir quién puede ver qué, de los guards.
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** Los mínimos son los de `RegisterRequest` en la API: contraseña de 6 a 60. */
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(60)]],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verPassword = signal(false);

  /** En desarrollo se recuerdan las credenciales de prueba; en producción, no. */
  protected readonly mostrarAyuda = !environment.production;

  protected enviar(): void {
    if (this.formulario.invalid) {
      // Sin esto, un formulario vacío enviado con Enter no marca ningún campo:
      // los errores de Material sólo se pintan cuando el control está "touched".
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.auth.login(this.formulario.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigateByUrl(this.destino());
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(this.explicar(error));
      },
    });
  }

  /**
   * La API contesta 401 con "Credenciales inválidas", que es correcto pero no
   * dice qué hacer. El resto de errores (400 de validación, servidor caído) sí
   * valen tal como vienen.
   */
  private explicar(error: HttpErrorResponse): string {
    return error.status === 401
      ? 'Correo o contraseña incorrectos.'
      : mensajeDeError(error, 'No se pudo iniciar sesión. Vuelve a intentarlo.');
  }

  /**
   * A dónde ir tras entrar: la ruta que el usuario pedía, o la portada.
   *
   * El `returnUrl` viene de la barra de direcciones, así que se acepta sólo si es
   * una ruta **interna**. Sin esa comprobación, un enlace como
   * `/login?returnUrl=//sitio-falso.com` convierte el login en un redirector
   * abierto: el usuario entra con sus credenciales y acaba en otro dominio.
   */
  private destino(): string {
    const returnUrl = this.ruta.snapshot.queryParamMap.get('returnUrl');
    return returnUrl !== null && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/';
  }
}
