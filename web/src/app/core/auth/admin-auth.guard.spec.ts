import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';

describe('adminAuthGuard', () => {
  let authService: AdminAuthService;
  let router: Router;

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
    authService = TestBed.inject(AdminAuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should redirect to /admin/login if not authenticated', () => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/admin/aktualnosci' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => adminAuthGuard(route, state));
    expect(result instanceof UrlTree).toBeTrue();
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/admin/login?returnUrl=%2Fadmin%2Faktualnosci');
  });

  it('should allow access if authenticated', () => {
    authService.isAuthenticated.set(true);
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/admin/aktualnosci' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => adminAuthGuard(route, state));
    expect(result).toBeTrue();
  });
});
