import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminNewsApiService } from '../../../core/api/admin-news-api.service';
import { NewsSummary } from '../../../core/api/news.models';

@Component({
  selector: 'app-admin-news-list-view',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './admin-news-list.view.html',
  styleUrl: './admin-news-list.view.scss',
})
export class AdminNewsListView implements OnInit {
  private readonly adminNewsApi = inject(AdminNewsApiService);

  readonly newsList = signal<NewsSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Soft delete modal state
  readonly deleteModalOpen = signal(false);
  readonly itemToDelete = signal<NewsSummary | null>(null);
  readonly deleting = signal(false);
  readonly togglingPublishId = signal<string | null>(null);
  readonly notification = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.loadNews();
  }

  togglePublish(item: NewsSummary): void {
    const nextState = !item.published;
    this.togglingPublishId.set(item.id);

    this.adminNewsApi.updateNews(item.id, { published: nextState }).subscribe({
      next: (updated) => {
        this.togglingPublishId.set(null);
        this.newsList.update((list) =>
          list.map((n) => (n.id === item.id ? { ...n, published: updated.published } : n))
        );
        const actionText = nextState
          ? `Artykuł „${item.title}” został pomyślnie opublikowany.`
          : `Publikacja artykułu „${item.title}” została cofnięta.`;
        this.showNotification(actionText, 'success');
      },
      error: (err) => {
        this.togglingPublishId.set(null);
        console.error('Error toggling publish state:', err);
        this.showNotification('Wystąpił błąd podczas zmiany statusu publikacji.', 'error');
      },
    });
  }

  loadNews(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminNewsApi.getAllAdminNews().subscribe({
      next: (items) => {
        this.newsList.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading admin news:', err);
        this.error.set('Nie udało się pobrać listy aktualności.');
        this.loading.set(false);
      },
    });
  }

  openDeleteModal(item: NewsSummary): void {
    this.itemToDelete.set(item);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.itemToDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.itemToDelete();
    if (!item) return;

    this.deleting.set(true);
    this.adminNewsApi.deleteNews(item.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeDeleteModal();
        this.newsList.update((list) => list.filter((n) => n.id !== item.id));
        this.showNotification(`Artykuł "${item.title}" został pomyślnie przeniesiony do kosza (soft delete).`, 'success');
      },
      error: (err) => {
        this.deleting.set(false);
        console.error('Error deleting news:', err);
        this.showNotification('Wystąpił błąd podczas usuwania artykułu.', 'error');
      },
    });
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    this.notification.set({ message, type });
    setTimeout(() => {
      this.notification.set(null);
    }, 4000);
  }
}
