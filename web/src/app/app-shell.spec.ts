import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App (Shell)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app root shell', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should toggle and close mobile menu', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app['menuOpen']()).toBeFalse();

    app['toggleMenu']();
    expect(app['menuOpen']()).toBeTrue();

    app['toggleMenu']();
    expect(app['menuOpen']()).toBeFalse();

    app['toggleMenu']();
    expect(app['menuOpen']()).toBeTrue();

    app['closeMenu']();
    expect(app['menuOpen']()).toBeFalse();
  });

  it('should construct team logo URLs correctly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app['teamLogoUrl']('')).toBe('');
    expect(app['teamLogoUrl']('United_Środa_Śląska')).toContain('logos/United_%C5%9Aroda_%C5%9Al%C4%85ska_logo.png');
  });

  it('should have Zespół and Dla Partnerów in navbar and footer, and not have Skład or Najbliższy mecz', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const navText = compiled.querySelector('nav')?.textContent ?? '';
    const footerText = compiled.querySelector('.site-footer')?.textContent ?? '';

    expect(navText).toContain('Zespół');
    expect(navText).not.toContain('Skład');
    expect(navText).toContain('Dla Partnerów');
    expect(navText).not.toContain('Najbliższy mecz');

    expect(footerText).toContain('Zespół');
    expect(footerText).not.toContain('Skład');
    expect(footerText).toContain('Dla Partnerów');
  });
});
