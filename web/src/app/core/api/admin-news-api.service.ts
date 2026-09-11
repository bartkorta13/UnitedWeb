import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAuthService } from '../auth/admin-auth.service';
import {
  CreateNewsRequest,
  GenerateUploadUrlRequest,
  GenerateUploadUrlResponse,
  NewsItem,
  NewsSummary,
  UpdateNewsRequest,
} from './news.models';

@Injectable({ providedIn: 'root' })
export class AdminNewsApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AdminAuthService);
  private readonly apiUrl = environment.apiUrl.replace(/\/+$/, '');

  private getAuthHeaders(): HttpHeaders {
    const token = this.auth.getToken() || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /**
   * Fetches all news articles (including drafts and unpublished) for the admin table.
   */
  getAllAdminNews(): Observable<NewsSummary[]> {
    return this.http.get<NewsSummary[]>(`${this.apiUrl}/admin/news`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Fetches a single news item by ID.
   */
  getNewsById(id: string): Observable<NewsItem> {
    return this.http.get<NewsItem>(`${this.apiUrl}/news/${encodeURIComponent(id)}`);
  }

  /**
   * Creates a new news article.
   */
  createNews(request: CreateNewsRequest): Observable<NewsItem> {
    return this.http.post<NewsItem>(`${this.apiUrl}/admin/news`, request, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Updates an existing news article.
   */
  updateNews(id: string, request: UpdateNewsRequest): Observable<NewsItem> {
    return this.http.put<NewsItem>(
      `${this.apiUrl}/admin/news/${encodeURIComponent(id)}`,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Soft-deletes a news article (marks isDeleted = true).
   */
  deleteNews(id: string): Observable<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(
      `${this.apiUrl}/admin/news/${encodeURIComponent(id)}`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Generates an AWS S3 pre-signed upload URL for direct media upload.
   */
  getUploadUrl(request: GenerateUploadUrlRequest): Observable<GenerateUploadUrlResponse> {
    return this.http.post<GenerateUploadUrlResponse>(
      `${this.apiUrl}/admin/news/upload-url`,
      request,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Directly uploads binary file data to S3 using the pre-signed PUT URL.
   * NOTE: Does NOT include Authorization header to avoid AWS SigV4 signature collision.
   */
  uploadToS3(uploadUrl: string, file: File): Observable<void> {
    const headers = new HttpHeaders({
      'Content-Type': file.type,
    });
    return this.http.put<void>(uploadUrl, file, { headers });
  }

  /**
   * Helper method that combines getUploadUrl and uploadToS3 in one flow,
   * returning the public CloudFront CDN URL.
   */
  uploadFileAndGetCdnUrl(
    newsId: string,
    file: File,
    isGallery: boolean = false
  ): Observable<string> {
    return this.getUploadUrl({
      newsId,
      fileName: file.name,
      contentType: file.type,
      isGallery,
    }).pipe(
      switchMap((res) => {
        return this.uploadToS3(res.uploadUrl, file).pipe(
          // Return the public CloudFront CDN URL
          switchMap(() => [res.cdnUrl])
        );
      })
    );
  }
}
