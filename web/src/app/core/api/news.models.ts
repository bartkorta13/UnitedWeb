export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  mainPhotoUrl: string;
  excerpt: string;
  contentHtml: string;
  galleryPhotos: string[];
  createdAt: string;
  updatedAt?: string;
  published: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface NewsSummary {
  id: string;
  title: string;
  slug: string;
  mainPhotoUrl: string;
  excerpt: string;
  createdAt: string;
  published: boolean;
}

export interface GenerateUploadUrlRequest {
  newsId: string;
  fileName: string;
  contentType: string;
  isGallery?: boolean;
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  cdnUrl: string;
  key: string;
}

export interface CreateNewsRequest {
  title: string;
  mainPhotoUrl: string;
  contentHtml?: string;
  excerpt?: string;
  galleryPhotos?: string[];
  published?: boolean;
}

export interface UpdateNewsRequest {
  title?: string;
  mainPhotoUrl?: string;
  contentHtml?: string;
  excerpt?: string;
  galleryPhotos?: string[];
  published?: boolean;
}
