import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser, CognitoAuthResponse, LoginCredentials } from './auth.models';

const STORAGE_KEY_TOKEN = 'united_admin_id_token';
const STORAGE_KEY_EMAIL = 'united_admin_email';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isAuthenticated = signal<boolean>(false);
  readonly currentUser = signal<AdminUser | null>(null);

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      const email = localStorage.getItem(STORAGE_KEY_EMAIL);

      if (token && email) {
        const exp = this.getTokenExpiration(token);
        if (exp && exp * 1000 > Date.now()) {
          this.currentUser.set({ email, token, exp });
          this.isAuthenticated.set(true);
          return;
        }
      }
    } catch {
      // Storage access or JSON decode error
    }
    this.clearSession();
  }

  login(credentials: LoginCredentials): Observable<boolean> {
    const clientId = environment.cognito?.clientId;
    const region = environment.cognito?.region || 'eu-central-1';

    // Local development fallback if Cognito client ID is not configured
    if (!clientId || clientId === 'placeholder' || clientId === '') {
      if (!credentials.email || !credentials.password) {
        return throwError(() => new Error('Podaj adres e-mail i hasło.'));
      }
      const mockExp = Math.floor(Date.now() / 1000) + 86400;
      const mockToken = 'mock-dev-jwt-token-' + Date.now();
      this.saveSession(credentials.email, mockToken, mockExp);
      return of(true);
    }

    const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    });

    const body = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: credentials.email.trim(),
        PASSWORD: credentials.password,
      },
    };

    return this.http.post<CognitoAuthResponse>(endpoint, body, { headers }).pipe(
      map((res) => {
        const authResult = res.AuthenticationResult;
        if (!authResult || !authResult.IdToken) {
          throw new Error('Logowanie nie powiodło się. Brak tokenu w odpowiedzi.');
        }

        const idToken = authResult.IdToken;
        const exp = this.getTokenExpiration(idToken) || Math.floor(Date.now() / 1000) + (authResult.ExpiresIn || 3600);
        this.saveSession(credentials.email, idToken, exp);
        return true;
      }),
      catchError((err) => {
        let msg = 'Niepoprawny login lub hasło.';
        if (err.error?.message) {
          if (err.error.__type === 'NotAuthorizedException') {
            msg = 'Niepoprawny adres e-mail lub hasło.';
          } else if (err.error.__type === 'UserNotFoundException') {
            msg = 'Użytkownik o podanym adresie e-mail nie istnieje.';
          } else if (err.error.__type === 'PasswordResetRequiredException') {
            msg = 'Wymagany reset hasła w panelu AWS.';
          } else {
            msg = err.error.message;
          }
        }
        return throwError(() => new Error(msg));
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/admin/login']);
  }

  getToken(): string | null {
    const user = this.currentUser();
    if (!user) return null;
    if (user.exp * 1000 <= Date.now()) {
      this.clearSession();
      return null;
    }
    return user.token;
  }

  private saveSession(email: string, token: string, exp: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_EMAIL, email);
    } catch {}
    this.currentUser.set({ email, token, exp });
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_EMAIL);
    } catch {}
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private getTokenExpiration(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }
}
