import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;

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
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be initialized unauthenticated when no stored token', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  it('should allow mock dev login when cognito clientId is empty/placeholder', (done) => {
    service.login({ email: 'admin@united.pl', password: 'password123' }).subscribe((success) => {
      expect(success).toBeTrue();
      expect(service.isAuthenticated()).toBeTrue();
      expect(service.currentUser()?.email).toBe('admin@united.pl');
      expect(service.getToken()).toBeTruthy();
      done();
    });
  });

  it('logout should clear credentials and reset state', () => {
    service.login({ email: 'admin@united.pl', password: 'password123' }).subscribe();
    expect(service.isAuthenticated()).toBeTrue();

    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
    expect(service.getToken()).toBeNull();
  });
});
