import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminNewsApiService } from '../../../core/api/admin-news-api.service';
import { TipTapEditorComponent } from '../components/tiptap-editor/tiptap-editor.component';
import { CreateNewsRequest, UpdateNewsRequest } from '../../../core/api/news.models';

function generateSlug(text: string): string {
  const polishMap: Record<string, string> = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
    Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
  };
  return text
    .split('')
    .map((c) => polishMap[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Component({
  selector: 'app-admin-news-editor-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TipTapEditorComponent],
  templateUrl: './admin-news-editor.view.html',
  styleUrl: './admin-news-editor.view.scss',
})
export class AdminNewsEditorView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminNewsApi = inject(AdminNewsApiService);

  readonly isEditMode = signal(false);
  readonly newsId = signal<string>('');
  readonly pageLoading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Form Fields
  readonly title = signal('');
  readonly slug = signal('');
  readonly mainPhotoUrl = signal('');
  readonly excerpt = signal('');
  readonly contentHtml = signal('');
  readonly galleryPhotos = signal<string[]>([]);
  readonly published = signal(true);

  // Upload progress states
  readonly uploadingMainPhoto = signal(false);
  readonly uploadingGalleryPhoto = signal(false);
  readonly uploadError = signal<string | null>(null);

  // Manual slug edit tracking
  private slugManuallyEdited = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.newsId.set(id);
      this.loadExistingArticle(id);
    } else {
      this.isEditMode.set(false);
      // Generate temporary unique ID for S3 uploads during creation
      this.newsId.set('news-' + Date.now());
      this.pageLoading.set(false);
    }
  }

  private loadExistingArticle(id: string): void {
    this.adminNewsApi.getNewsById(id).subscribe({
      next: (item) => {
        this.title.set(item.title);
        this.slug.set(item.slug);
        this.mainPhotoUrl.set(item.mainPhotoUrl);
        this.excerpt.set(item.excerpt || '');
        this.contentHtml.set(item.contentHtml || '');
        this.galleryPhotos.set(item.galleryPhotos || []);
        this.published.set(item.published);
        this.slugManuallyEdited = true;
        this.pageLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading article:', err);
        this.errorMessage.set('Nie udało się wczytać artykułu do edycji.');
        this.pageLoading.set(false);
      },
    });
  }

  onTitleChange(newTitle: string): void {
    this.title.set(newTitle);
    if (!this.slugManuallyEdited && !this.isEditMode()) {
      this.slug.set(generateSlug(newTitle));
    }
  }

  onSlugChange(newSlug: string): void {
    this.slugManuallyEdited = true;
    this.slug.set(newSlug);
  }

  // --- Main Photo Upload ---
  onMainPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.uploadMainPhoto(file);
    // Reset input value so the same file can be re-selected if needed
    input.value = '';
  }

  onMainPhotoDropped(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;

    const file = event.dataTransfer.files[0];
    this.uploadMainPhoto(file);
  }

  private uploadMainPhoto(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Możesz przesłać wyłącznie pliki graficzne (JPG, PNG, WEBP).');
      return;
    }

    this.uploadingMainPhoto.set(true);
    this.uploadError.set(null);

    this.adminNewsApi
      .uploadFileAndGetCdnUrl(this.newsId(), file, false)
      .subscribe({
        next: (cdnUrl) => {
          this.mainPhotoUrl.set(cdnUrl);
          this.uploadingMainPhoto.set(false);
        },
        error: (err) => {
          console.error('Main photo upload failed:', err);
          this.uploadError.set('Nie udało się przesłać zdjęcia głównego. Spróbuj ponownie.');
          this.uploadingMainPhoto.set(false);
        },
      });
  }

  removeMainPhoto(): void {
    this.mainPhotoUrl.set('');
  }

  // --- Gallery Photos Upload ---
  onGalleryPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    this.uploadGalleryFiles(files);
    input.value = '';
  }

  onGalleryPhotosDropped(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;

    const files = Array.from(event.dataTransfer.files);
    this.uploadGalleryFiles(files);
  }

  private uploadGalleryFiles(files: File[]): void {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.uploadError.set('Wybrane pliki nie są obrazami.');
      return;
    }

    this.uploadingGalleryPhoto.set(true);
    this.uploadError.set(null);

    let completed = 0;
    const newUrls: string[] = [];

    imageFiles.forEach((file) => {
      this.adminNewsApi
        .uploadFileAndGetCdnUrl(this.newsId(), file, true)
        .subscribe({
          next: (cdnUrl) => {
            newUrls.push(cdnUrl);
            completed++;
            if (completed === imageFiles.length) {
              this.galleryPhotos.update((existing) => [...existing, ...newUrls]);
              this.uploadingGalleryPhoto.set(false);
            }
          },
          error: (err) => {
            console.error('Gallery photo upload failed:', err);
            completed++;
            if (completed === imageFiles.length) {
              this.galleryPhotos.update((existing) => [...existing, ...newUrls]);
              this.uploadingGalleryPhoto.set(false);
            }
          },
        });
    });
  }

  removeGalleryPhoto(index: number): void {
    this.galleryPhotos.update((photos) => photos.filter((_, i) => i !== index));
  }

  // --- Save Article ---
  saveArticle(publishNow?: boolean): void {
    const currentTitle = this.title().trim();
    const currentPhoto = this.mainPhotoUrl().trim();

    if (!currentTitle) {
      this.errorMessage.set('Tytuł artykułu jest polem obowiązkowym.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!currentPhoto) {
      this.errorMessage.set('Zdjęcie główne jest polem obowiązkowym.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const isPublished = publishNow !== undefined ? publishNow : this.published();
    this.saving.set(true);
    this.errorMessage.set(null);

    if (this.isEditMode()) {
      const updateReq: UpdateNewsRequest = {
        title: currentTitle,
        mainPhotoUrl: currentPhoto,
        contentHtml: this.contentHtml(),
        excerpt: this.excerpt().trim() || undefined,
        galleryPhotos: this.galleryPhotos(),
        published: isPublished,
      };

      this.adminNewsApi.updateNews(this.newsId(), updateReq).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/admin/aktualnosci']);
        },
        error: (err) => {
          console.error('Update news failed:', err);
          this.saving.set(false);
          this.errorMessage.set('Nie udało się zapisać zmian w artykule.');
        },
      });
    } else {
      const createReq: CreateNewsRequest = {
        title: currentTitle,
        mainPhotoUrl: currentPhoto,
        contentHtml: this.contentHtml(),
        excerpt: this.excerpt().trim() || undefined,
        galleryPhotos: this.galleryPhotos(),
        published: isPublished,
      };

      this.adminNewsApi.createNews(createReq).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/admin/aktualnosci']);
        },
        error: (err) => {
          console.error('Create news failed:', err);
          this.saving.set(false);
          this.errorMessage.set('Nie udało się utworzyć nowego artykułu.');
        },
      });
    }
  }
}
