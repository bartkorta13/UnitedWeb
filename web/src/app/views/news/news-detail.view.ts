import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NewsApiService } from '../../core/api/news-api.service';
import { NewsItem } from '../../core/api/news.models';

@Component({
  selector: 'app-news-detail-view',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './news-detail.view.html',
  styleUrl: './news-detail.view.scss',
})
export class NewsDetailView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly newsApi = inject(NewsApiService);

  readonly article = signal<NewsItem | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  // Lightbox Modal state
  readonly lightboxOpen = signal(false);
  readonly activePhotoIndex = signal(0);

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadArticle(id);
      } else {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  loadArticle(id: string): void {
    this.loading.set(true);
    this.error.set(false);

    this.newsApi.getNewsById(id).subscribe({
      next: (item) => {
        if (item) {
          this.article.set(item);
        } else {
          this.error.set(true);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching article details:', err);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  openLightbox(index: number): void {
    this.activePhotoIndex.set(index);
    this.lightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
    document.body.style.overflow = '';
  }

  nextPhoto(event?: Event): void {
    event?.stopPropagation();
    const photos = this.article()?.galleryPhotos ?? [];
    if (photos.length === 0) return;
    const nextIdx = (this.activePhotoIndex() + 1) % photos.length;
    this.activePhotoIndex.set(nextIdx);
  }

  prevPhoto(event?: Event): void {
    event?.stopPropagation();
    const photos = this.article()?.galleryPhotos ?? [];
    if (photos.length === 0) return;
    const prevIdx = (this.activePhotoIndex() - 1 + photos.length) % photos.length;
    this.activePhotoIndex.set(prevIdx);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.lightboxOpen()) return;

    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight') {
      this.nextPhoto();
    } else if (event.key === 'ArrowLeft') {
      this.prevPhoto();
    }
  }
}
