import { NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

export const ASSETS_CDN_URL: string = environment.cdnUrl;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgClass, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected teamLogoUrl(teamName: string): string {
    if (!teamName) return '';
    const base = ASSETS_CDN_URL ? ASSETS_CDN_URL.replace(/\/$/, '') : '';
    const encodedName = encodeURIComponent(teamName.normalize('NFC'));
    return `${base}/logos/${encodedName}_logo.png`;
  }
}
