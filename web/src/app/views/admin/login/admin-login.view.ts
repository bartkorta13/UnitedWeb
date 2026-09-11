import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../../core/auth/admin-auth.service';

@Component({
  selector: 'app-admin-login-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.view.html',
  styleUrl: './admin-login.view.scss',
})
export class AdminLoginView {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email().trim() || !this.password()) {
      this.errorMessage.set('Wprowadź adres e-mail i hasło.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth
      .login({
        email: this.email().trim(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          const returnUrl =
            this.route.snapshot.queryParams['returnUrl'] || '/admin/aktualnosci';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err.message || 'Wystąpił błąd podczas logowania.');
        },
      });
  }
}
