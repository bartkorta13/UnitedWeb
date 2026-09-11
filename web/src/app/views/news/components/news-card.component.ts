import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NewsSummary } from '../../../core/api/news.models';

@Component({
  selector: 'app-news-card',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <article class="news-card">
      <a [routerLink]="['/aktualnosci', news().id]" class="news-card-link" [attr.aria-label]="news().title">
        <div class="news-card-media">
          <img
            [src]="news().mainPhotoUrl"
            [alt]="news().title"
            class="news-card-img"
            loading="lazy"
          />
          <div class="media-overlay"></div>
          <time class="news-date-badge" [attr.datetime]="news().createdAt">
            {{ news().createdAt | date: 'd MMMM yyyy' : '' : 'pl' }}
          </time>
        </div>

        <div class="news-card-body">
          <h3 class="news-card-title">{{ news().title }}</h3>
          <p class="news-card-excerpt">{{ news().excerpt }}</p>
          <div class="news-card-footer">
            <span class="read-more-text">Czytaj więcej</span>
            <svg class="arrow-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fill-rule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>
      </a>
    </article>
  `,
  styleUrl: './news-card.scss',
})
export class NewsCardComponent {
  readonly news = input.required<NewsSummary>();
}
