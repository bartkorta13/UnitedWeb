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
});
