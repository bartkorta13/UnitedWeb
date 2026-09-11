import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/auth/admin-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/home/home.view').then((m) => m.HomeView),
  },
  {
    path: 'aktualnosci',
    loadComponent: () => import('./views/news/news-list.view').then((m) => m.NewsListView),
  },
  {
    path: 'aktualnosci/:id',
    loadComponent: () => import('./views/news/news-detail.view').then((m) => m.NewsDetailView),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./views/admin/login/admin-login.view').then((m) => m.AdminLoginView),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./views/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'aktualnosci',
      },
      {
        path: 'aktualnosci',
        loadComponent: () => import('./views/admin/news-list/admin-news-list.view').then((m) => m.AdminNewsListView),
      },
      {
        path: 'aktualnosci/nowy',
        loadComponent: () => import('./views/admin/news-editor/admin-news-editor.view').then((m) => m.AdminNewsEditorView),
      },
      {
        path: 'aktualnosci/:id/edycja',
        loadComponent: () => import('./views/admin/news-editor/admin-news-editor.view').then((m) => m.AdminNewsEditorView),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
