import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NewsApiService } from './news-api.service';
import { NewsItem, NewsSummary } from './news.models';

describe('NewsApiService', () => {
  let service: NewsApiService;
  let httpMock: HttpTestingController;

  const mockNewsSummaries: NewsSummary[] = [
    {
      id: 'news-1',
      title: 'Wielkie zwycięstwo United!',
      slug: 'wielkie-zwyciestwo-united',
      createdAt: '2026-03-01T18:00:00Z',
      mainPhotoUrl: 'https://cdn.example.com/news/1/main.jpg',
      excerpt: 'United wygrało mecz 3:0...',
      published: true,
    },
    {
      id: 'news-2',
      title: 'Zapowiedź kolejnego meczu',
      slug: 'zapowiedz-kolejnego-meczu',
      createdAt: '2026-03-05T12:00:00Z',
      mainPhotoUrl: 'https://cdn.example.com/news/2/main.jpg',
      excerpt: 'W sobotę gramy u siebie...',
      published: true,
    },
  ];

  const mockNewsItem: NewsItem = {
    id: 'news-1',
    title: 'Wielkie zwycięstwo United!',
    slug: 'wielkie-zwyciestwo-united',
    createdAt: '2026-03-01T18:00:00Z',
    mainPhotoUrl: 'https://cdn.example.com/news/1/main.jpg',
    excerpt: 'United wygrało mecz 3:0...',
    contentHtml: '<p>Pełny opis meczu i relacja punkt po punkcie.</p>',
    galleryPhotos: ['https://cdn.example.com/news/1/gal1.jpg'],
    published: true,
    updatedAt: '2026-03-01T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NewsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NewsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.latestNews()).toEqual([]);
    expect(service.loadingLatest()).toBeFalse();
    expect(service.errorLatest()).toBeFalse();
  });

  it('fetchLatestNews should request latest news with limit param and update signals', () => {
    service.fetchLatestNews(3);
    expect(service.loadingLatest()).toBeTrue();

    const req = httpMock.expectOne((r) => r.url.endsWith('/news?limit=3') || (r.url.endsWith('/news') && r.params.get('limit') === '3'));
    expect(req.request.method).toBe('GET');

    req.flush(mockNewsSummaries);

    expect(service.loadingLatest()).toBeFalse();
    expect(service.errorLatest()).toBeFalse();
    expect(service.latestNews()).toEqual(mockNewsSummaries);
  });

  it('fetchLatestNews should handle error gracefully', () => {
    service.fetchLatestNews(3);
    expect(service.loadingLatest()).toBeTrue();

    const req = httpMock.expectOne((r) => r.url.endsWith('/news?limit=3') || (r.url.endsWith('/news') && r.params.get('limit') === '3'));
    req.error(new ProgressEvent('Network error'));

    expect(service.loadingLatest()).toBeFalse();
    expect(service.errorLatest()).toBeTrue();
    expect(service.latestNews()).toEqual([]);
  });

  it('getAllNews should return all news summaries', (done) => {
    service.getAllNews().subscribe((items) => {
      expect(items).toEqual(mockNewsSummaries);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/news') && !r.params.has('limit'));
    expect(req.request.method).toBe('GET');
    req.flush(mockNewsSummaries);
  });

  it('getNewsById should return a single news article', (done) => {
    service.getNewsById('news-1').subscribe((item) => {
      expect(item).toEqual(mockNewsItem);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/news/news-1'));
    expect(req.request.method).toBe('GET');
    req.flush(mockNewsItem);
  });

  it('getNewsById should return null on 404 error', (done) => {
    service.getNewsById('unknown-id').subscribe((item) => {
      expect(item).toBeNull();
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/news/unknown-id'));
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
  });
});
