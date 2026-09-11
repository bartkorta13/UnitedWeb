import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let httpMock: HttpTestingController;

  const fakeExp = Math.floor(Date.now() / 1000) + 3600;
  const fakePayload = btoa(JSON.stringify({ exp: fakeExp, email: 'admin@united.pl' }));
  const fakeToken = `header.${fakePayload}.signature`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AdminAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AdminAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be initialized unauthenticated when no stored token', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  it('should restore session from localStorage when valid token exists', () => {
    localStorage.setItem('united_admin_id_token', fakeToken);
    localStorage.setItem('united_admin_email', 'admin@united.pl');

    const restoredService = TestBed.inject(AdminAuthService);
    restoredService['restoreSession']();

    expect(restoredService.isAuthenticated()).toBeTrue();
    expect(restoredService.currentUser()?.email).toBe('admin@united.pl');
    expect(restoredService.getToken()).toBe(fakeToken);
  });

  it('login should authenticate against Cognito and store tokens', (done) => {
    service.login({ email: 'admin@united.pl', password: 'password123' }).subscribe((success) => {
      expect(success).toBeTrue();
      expect(service.isAuthenticated()).toBeTrue();
      expect(service.currentUser()?.email).toBe('admin@united.pl');
      expect(service.getToken()).toBe(fakeToken);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.includes('cognito-idp'));
    expect(req.request.method).toBe('POST');
    req.flush({
      AuthenticationResult: {
        IdToken: fakeToken,
        AccessToken: 'fake-access-token',
        ExpiresIn: 3600,
        TokenType: 'Bearer',
      },
    });
  });

  it('logout should clear credentials and reset state', (done) => {
    service.login({ email: 'admin@united.pl', password: 'password123' }).subscribe(() => {
      expect(service.isAuthenticated()).toBeTrue();

      service.logout();
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.currentUser()).toBeNull();
      expect(service.getToken()).toBeNull();
      done();
    });

    const req = httpMock.expectOne((r) => r.url.includes('cognito-idp'));
    req.flush({
      AuthenticationResult: {
        IdToken: fakeToken,
        AccessToken: 'fake-access-token',
        ExpiresIn: 3600,
        TokenType: 'Bearer',
      },
    });
  });
});
