import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminNewsApiService } from './admin-news-api.service';
import { AdminAuthService } from '../auth/admin-auth.service';
import { CreateNewsRequest, GenerateUploadUrlRequest, UpdateNewsRequest } from './news.models';

describe('AdminNewsApiService', () => {
  let service: AdminNewsApiService;
  let authService: AdminAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AdminNewsApiService,
        AdminAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AdminNewsApiService);
    authService = TestBed.inject(AdminAuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Mock an active session directly without HTTP
    authService.currentUser.set({
      email: 'admin@united.pl',
      token: 'fake-jwt-token',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    authService.isAuthenticated.set(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getAllAdminNews should make GET /admin/news request with Authorization header', (done) => {
    service.getAllAdminNews().subscribe((items) => {
      expect(items.length).toBe(1);
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/news'));
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBeTrue();
    req.flush([
      {
        id: 'news-1',
        title: 'Tytuł',
        slug: 'tytul',
        mainPhotoUrl: 'https://cdn.example.com/1.jpg',
        excerpt: 'Zajawka',
        createdAt: '2026-03-01T12:00:00Z',
        published: true,
      },
    ]);
  });

  it('createNews should make POST /admin/news request', (done) => {
    const payload: CreateNewsRequest = {
      title: 'Nowy artykuł',
      mainPhotoUrl: 'https://cdn.example.com/photo.jpg',
      contentHtml: '<p>Treść</p>',
      published: true,
    };

    service.createNews(payload).subscribe((res) => {
      expect(res.id).toBe('news-new');
      expect(res.title).toBe('Nowy artykuł');
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/news'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      id: 'news-new',
      slug: 'nowy-artykul',
      createdAt: '2026-03-01T12:00:00Z',
      galleryPhotos: [],
      ...payload,
    });
  });

  it('deleteNews should make DELETE /admin/news/:id request', (done) => {
    service.deleteNews('news-123').subscribe((res) => {
      expect(res.message).toBe('Deleted');
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/news/news-123'));
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Deleted', id: 'news-123' });
  });

  it('getUploadUrl should request S3 presigned URL', (done) => {
    const reqBody: GenerateUploadUrlRequest = {
      newsId: 'news-1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
    };

    service.getUploadUrl(reqBody).subscribe((res) => {
      expect(res.uploadUrl).toBe('https://s3.example.com/presigned');
      expect(res.cdnUrl).toBe('https://cdn.example.com/photo.jpg');
      done();
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/news/upload-url'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(reqBody);
    req.flush({
      uploadUrl: 'https://s3.example.com/presigned',
      cdnUrl: 'https://cdn.example.com/photo.jpg',
      key: 'assets/news/news-1/main/uuid.jpg',
    });
  });

  it('uploadToS3 should make PUT request without Authorization header', (done) => {
    const mockBlob = new Blob(['image content'], { type: 'image/jpeg' });
    const mockFile = new File([mockBlob], 'photo.jpg', { type: 'image/jpeg' });

    service.uploadToS3('https://s3.example.com/presigned', mockFile).subscribe(() => {
      done();
    });

    const req = httpMock.expectOne('https://s3.example.com/presigned');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('Content-Type')).toBe('image/jpeg');
    req.flush(null);
  });
});
