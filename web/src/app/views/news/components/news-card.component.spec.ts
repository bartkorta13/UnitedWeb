import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { NewsCardComponent } from './news-card.component';
import { NewsSummary } from '../../../core/api/news.models';

registerLocaleData(localePl, 'pl');

describe('NewsCardComponent', () => {
  const mockNews: NewsSummary = {
    id: 'test-news-1',
    title: 'Świetny mecz United',
    slug: 'swietny-mecz-united',
    mainPhotoUrl: 'https://cdn.example.com/news/1/main.png',
    excerpt: 'Krótki opis meczu...',
    createdAt: '2026-03-01T12:00:00Z',
    published: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsCardComponent],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'pl' },
      ],
    }).compileComponents();
  });

  it('should render news card details accurately', () => {
    const fixture = TestBed.createComponent(NewsCardComponent);
    fixture.componentRef.setInput('news', mockNews);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const titleEl = el.querySelector('.news-card-title');
    const excerptEl = el.querySelector('.news-card-excerpt');
    const imgEl = el.querySelector<HTMLImageElement>('.news-card-img');
    const linkEl = el.querySelector<HTMLAnchorElement>('.news-card-link');

    expect(titleEl?.textContent?.trim()).toBe('Świetny mecz United');
    expect(excerptEl?.textContent?.trim()).toBe('Krótki opis meczu...');
    expect(imgEl?.getAttribute('src')).toBe('https://cdn.example.com/news/1/main.png');
    expect(imgEl?.getAttribute('alt')).toBe('Świetny mecz United');
    expect(linkEl?.getAttribute('href')).toContain('/aktualnosci/test-news-1');
  });
});
