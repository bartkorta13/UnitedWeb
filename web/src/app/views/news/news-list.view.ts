import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsApiService } from '../../core/api/news-api.service';
import { NewsSummary } from '../../core/api/news.models';
import { NewsCardComponent } from './components/news-card.component';

@Component({
  selector: 'app-news-list-view',
  standalone: true,
  imports: [RouterLink, NewsCardComponent],
  templateUrl: './news-list.view.html',
  styleUrl: './news-list.view.scss',
})
export class NewsListView implements OnInit {
  private readonly newsApi = inject(NewsApiService);

  readonly newsItems = signal<NewsSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.fetchNews();
  }

  fetchNews(): void {
    this.loading.set(true);
    this.error.set(false);

    this.newsApi.getAllNews().subscribe({
      next: (items) => {
        this.newsItems.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading news list:', err);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
