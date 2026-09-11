import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NewsItem, NewsSummary } from './news.models';

@Injectable({ providedIn: 'root' })
export class NewsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl.replace(/\/+$/, '');

  readonly latestNews = signal<NewsSummary[]>([]);
  readonly loadingLatest = signal(false);
  readonly errorLatest = signal(false);

  /**
   * Fetches the latest N news summaries for display in the homepage section.
   */
  fetchLatestNews(limit: number = 3): void {
    this.loadingLatest.set(true);
    this.errorLatest.set(false);

    this.http
      .get<NewsSummary[]>(`${this.apiUrl}/news`, {
        params: { limit: limit.toString() },
      })
      .pipe(
        catchError((err) => {
          console.error('Error loading latest news:', err);
          this.errorLatest.set(true);
          return of<NewsSummary[]>([]);
        }),
        tap(() => this.loadingLatest.set(false))
      )
      .subscribe((items) => {
        this.latestNews.set(items);
      });
  }

  /**
   * Fetches all published news for the /aktualnosci page.
   */
  getAllNews(): Observable<NewsSummary[]> {
    return this.http.get<NewsSummary[]>(`${this.apiUrl}/news`).pipe(
      catchError((err) => {
        console.error('Error loading all news:', err);
        return of<NewsSummary[]>([]);
      })
    );
  }

  /**
   * Fetches a single news article by ID or slug for the /aktualnosci/:id page.
   */
  getNewsById(id: string): Observable<NewsItem | null> {
    return this.http.get<NewsItem>(`${this.apiUrl}/news/${encodeURIComponent(id)}`).pipe(
      catchError((err) => {
        console.error(`Error loading news article ${id}:`, err);
        return of<NewsItem | null>(null);
      })
    );
  }
}
