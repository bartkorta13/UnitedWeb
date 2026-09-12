import { DatePipe, DecimalPipe, NgClass, registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { Component, computed, effect, inject, LOCALE_ID, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeagueApiService, UNITED_TEAM_NAME } from '../../core/api/league-api.service';
import { MatchItem, PlayerItem, PlayerPosition, SetDetailItem, TeamStanding, TeamStatItem } from '../../core/api/league.models';
import { NewsApiService } from '../../core/api/news-api.service';
import { NewsCardComponent } from '../news/components/news-card.component';
import { environment } from '../../../environments/environment';

registerLocaleData(localePl, 'pl');
registerLocaleData(localePl, 'pl-PL');

export const ASSETS_CDN_URL: string = environment.cdnUrl;

export interface CountdownTime {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  isExpired: boolean;
  totalSeconds: number;
}

export interface PartnerItem {
  id: string;
  name: string;
  logoFilename: string;
  url?: string;
}

export interface ClubHistoryCard {
  id: string;
  year: string;
  watermark: string;
  badge: string;
  badgeClass: string;
  title: string;
  desc1: string;
  desc2: string;
  milestone: string;
  milestoneClass: string;
  shortLabel: string;
}

@Component({
  selector: 'app-home-view',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgClass, RouterLink, NewsCardComponent],
  providers: [
    { provide: LOCALE_ID, useValue: 'pl' },
  ],
  templateUrl: './home.view.html',
  styleUrl: './home.view.scss',
})
export class HomeView implements OnInit, OnDestroy {
  private readonly leagueApi = inject(LeagueApiService);
  private readonly newsApi = inject(NewsApiService);

  protected readonly menuOpen = signal(false);
  protected readonly activeFilter = signal<'all' | 'home' | 'away'>('all');
  protected readonly fixturesExpanded = signal(false);
  protected readonly resultsExpanded = signal(false);
  protected readonly heroHomeFlipped = signal(false);
  protected readonly heroAwayFlipped = signal(false);
  protected readonly flippedCardIds = signal<Set<string>>(new Set());
  protected readonly expandedResultIds = signal<Set<string>>(new Set());

  protected readonly countdown = signal<CountdownTime>({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    isExpired: false,
    totalSeconds: 0,
  });

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly fixtures = this.leagueApi.fixtures;
  protected readonly results = this.leagueApi.results;
  protected readonly allResults = this.leagueApi.allResults;
  protected readonly standings = this.leagueApi.standings;
  protected readonly roster = this.leagueApi.roster;
  protected readonly loading = this.leagueApi.loading;
  protected readonly error = this.leagueApi.error;

  // News signals
  protected readonly latestNews = this.newsApi.latestNews;
  protected readonly loadingNews = this.newsApi.loadingLatest;
  protected readonly errorNews = this.newsApi.errorLatest;

  // Club History Card Selector (25' | 26' | 27')
  protected readonly activeClubStep = signal<number>(1); // Default to 2026' (center)
  protected readonly isDraggingClub = signal<boolean>(false);
  protected readonly clubDragOffset = signal<number>(0);

  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTime = 0;
  private isHorizontalDrag = false;
  private isVerticalScroll = false;
  private hasDraggedFar = false;
  private activePointerId: number | null = null;
  private lastWheelTime = 0;

  protected readonly clubCards: readonly ClubHistoryCard[] = [
    {
      id: 'step-25',
      year: '2025',
      watermark: "25'",
      badge: '2025',
      badgeClass: 'badge-past',
      title: 'Początki Klubu',
      desc1: 'Nasza historia zaczęła się w 2025 roku, kiedy to po raz pierwszy w historii przystąpiliśmy do dolnośląskich rozgrywek mężczyzn pod szyldem United Volley Wrocław.',
      desc2: 'W debiutanckim sezonie walka o awans toczyła się do ostatniej kolejki. Ostatecznie uplasowaliśmy się na 5-tym miejscu, z minimalną stratą do miejsc premiowanych awansem do fazy play-off.',
      milestone: 'Debiut w lidze • 5. miejsce',
      milestoneClass: 'milestone-past',
      shortLabel: 'Początki',
    },
    {
      id: 'step-26',
      year: '2026',
      watermark: "26'",
      badge: '2026 • TERAZ',
      badgeClass: 'badge-current',
      title: 'Nadchodzi Nowe',
      desc1: 'Po sezonie Klub przeszedł restrukturyzację i zdecydował się na przeprowadzkę. Nasze szeregi zostały zasilone przez nowych, ambitnych zawodników z dużym doświadczeniem.',
      desc2: 'Od sezonu 2026/27 dumnie reprezentujemy miasto Środa Śląska, budując nową tożsamość, silny zespół i lokalną społeczność kibiców.',
      milestone: 'Nowy dom: Środa Śląska',
      milestoneClass: 'milestone-current',
      shortLabel: 'Teraz',
    },
    {
      id: 'step-27',
      year: '2027',
      watermark: "27'",
      badge: '2027 • CEL',
      badgeClass: 'badge-future',
      title: 'Cele na 2026/27',
      desc1: 'Dzięki dużym wzmocnieniom zarówno na płaszczyźnie infrastruktury, jak i zawodniczej możemy mierzyć jeszcze wyżej.',
      desc2: 'Jako cel na obecny sezon postawiliśmy sobie zwycięstwo w II Lidze Dolnośląskiej i awans na wyższy szczebel rozgrywkowy. Gorąco zapraszamy do kibicowania i do zobaczenia na hali w Środzie!',
      milestone: 'Czy uda się wywalczyć awans?',
      milestoneClass: 'milestone-future',
      shortLabel: 'Cel',
    },
  ];

  protected setClubStep(step: number): void {
    this.activeClubStep.set(step);
  }

  protected prevClubStep(): void {
    this.activeClubStep.update(curr => (curr > 0 ? curr - 1 : 2));
  }

  protected nextClubStep(): void {
    this.activeClubStep.update(curr => (curr < 2 ? curr + 1 : 0));
  }

  protected getClubCardPosition(index: number): 'pos-center' | 'pos-left' | 'pos-right' {
    const current = this.activeClubStep();
    const rel = (index - current + 3) % 3;
    if (rel === 0) return 'pos-center';
    if (rel === 1) return 'pos-right';
    return 'pos-left';
  }

  protected onClubCardClick(index: number): void {
    if (this.hasDraggedFar) {
      return;
    }
    this.setClubStep(index);
  }

  protected onClubPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    // If another pointer is already active, or this touch is secondary (e.g. multi-touch pinch-to-zoom),
    // cancel drag immediately so the browser handles pinch-to-zoom cleanly.
    if (event.pointerType === 'touch' && (event.isPrimary === false || (this.activePointerId !== null && this.activePointerId !== event.pointerId))) {
      this.cancelClubDrag();
      return;
    }

    this.activePointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartTime = Date.now();
    this.isHorizontalDrag = false;
    this.isVerticalScroll = false;
    this.hasDraggedFar = false;
    this.isDraggingClub.set(false);
    this.clubDragOffset.set(0);
  }

  protected onClubPointerMove(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId || this.isVerticalScroll) return;

    // If a multi-touch gesture starts during move, abort drag
    if (event.pointerType === 'touch' && event.isPrimary === false) {
      this.cancelClubDrag();
      return;
    }

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    if (!this.isHorizontalDrag && !this.isVerticalScroll) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        this.isVerticalScroll = true;
        return;
      }
      if (Math.abs(deltaX) > 6) {
        this.isHorizontalDrag = true;
        this.isDraggingClub.set(true);
        this.hasDraggedFar = true;

        if (event.pointerType === 'mouse') {
          try {
            (event.currentTarget as HTMLElement)?.setPointerCapture(event.pointerId);
          } catch {}
        }
      }
    }

    if (this.isHorizontalDrag) {
      const maxDrag = 200;
      let dampedX = deltaX;
      if (Math.abs(deltaX) > maxDrag) {
        const excess = Math.abs(deltaX) - maxDrag;
        dampedX = (deltaX > 0 ? 1 : -1) * (maxDrag + excess * 0.25);
      }
      this.clubDragOffset.set(dampedX);
    }
  }

  protected onClubPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;

    if (this.isHorizontalDrag && event.pointerType === 'mouse') {
      try {
        (event.currentTarget as HTMLElement)?.releasePointerCapture(event.pointerId);
      } catch {}
    }

    const offset = this.clubDragOffset();
    const elapsed = Date.now() - this.dragStartTime;
    const isQuickFlick = elapsed < 450 && Math.abs(offset) > 18;
    const isDrag = Math.abs(offset) > 22;

    if (this.isHorizontalDrag && (isQuickFlick || isDrag)) {
      if (offset < 0) {
        this.nextClubStep();
      } else {
        this.prevClubStep();
      }
    }

    this.isDraggingClub.set(false);
    this.clubDragOffset.set(0);
    this.activePointerId = null;
    this.isHorizontalDrag = false;
    this.isVerticalScroll = false;

    if (this.hasDraggedFar) {
      setTimeout(() => {
        this.hasDraggedFar = false;
      }, 120);
    }
  }

  protected onClubPointerCancel(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;

    if (this.isHorizontalDrag && event.pointerType === 'mouse') {
      try {
        (event.currentTarget as HTMLElement)?.releasePointerCapture(event.pointerId);
      } catch {}
    }

    this.cancelClubDrag();

    setTimeout(() => {
      this.hasDraggedFar = false;
    }, 120);
  }

  private cancelClubDrag(): void {
    this.isDraggingClub.set(false);
    this.clubDragOffset.set(0);
    this.activePointerId = null;
    this.isHorizontalDrag = false;
    this.isVerticalScroll = false;
  }

  protected onClubWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaX) > 25 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const now = Date.now();
      if (now - this.lastWheelTime > 400) {
        this.lastWheelTime = now;
        if (event.deltaX > 0) {
          this.nextClubStep();
        } else {
          this.prevClubStep();
        }
      }
    }
  }

  protected onClubKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevClubStep();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextClubStep();
    }
  }

  constructor() {
    effect(() => {
      // Re-evaluate whenever nextMatch changes
      this.nextMatch();
      this.updateCountdown();
    });
  }

  ngOnInit(): void {
    this.newsApi.fetchLatestNews(3);
    this.updateCountdown();
    this.startCountdownTimer();
  }

  ngOnDestroy(): void {
    this.stopCountdownTimer();
  }

  protected getCountdownTargetDate(match: MatchItem | undefined | null): Date | null {
    if (!match?.date) return null;
    const cleanDate = match.date.trim().split(/[ T]/)[0];
    const dateMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      const parsed = new Date(match.date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);

    const hourStr = this.matchHour(match);
    let hours = 12;
    let minutes = 0;
    if (hourStr) {
      const [h, m] = hourStr.split(':').map((v) => parseInt(v, 10));
      if (!isNaN(h) && !isNaN(m)) {
        hours = h;
        minutes = m;
      }
    }
    return new Date(year, month, day, hours, minutes, 0, 0);
  }

  protected computeCountdown(nowMs: number = Date.now()): CountdownTime {
    const match = this.nextMatch();
    const target = this.getCountdownTargetDate(match);
    if (!target) {
      return { days: '00', hours: '00', minutes: '00', seconds: '00', isExpired: true, totalSeconds: 0 };
    }

    const diffMs = target.getTime() - nowMs;
    if (diffMs <= 0) {
      return { days: '00', hours: '00', minutes: '00', seconds: '00', isExpired: true, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: days.toString().padStart(2, '0'),
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
      isExpired: false,
      totalSeconds,
    };
  }

  protected updateCountdown(nowMs?: number): void {
    this.countdown.set(this.computeCountdown(nowMs));
  }

  private startCountdownTimer(): void {
    this.stopCountdownTimer();
    if (typeof window !== 'undefined') {
      this.countdownTimer = setInterval(() => {
        this.updateCountdown();
      }, 1000);
    }
  }

  private stopCountdownTimer(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  protected readonly activeRosterFilter = signal<string>('all');
  protected readonly rosterExpanded = signal<boolean>(false);

  protected readonly filteredRoster = computed(() => {
    const filter = this.activeRosterFilter();
    const all = this.roster();
    const filtered = filter === 'all' ? all : all.filter((p) => p.position === filter);
    return [...filtered].sort((a, b) => {
      const aIsCoach = a.position === 'COACH';
      const bIsCoach = b.position === 'COACH';
      if (aIsCoach && !bIsCoach) return 1;
      if (!aIsCoach && bIsCoach) return -1;
      return (a.number ?? 0) - (b.number ?? 0);
    });
  });

  protected readonly visibleRoster = computed(() => {
    const list = this.filteredRoster();
    const filter = this.activeRosterFilter();
    if (filter === 'all' && !this.rosterExpanded()) {
      return list.slice(0, 4);
    }
    return list;
  });

  protected setRosterFilter(filter: string): void {
    this.activeRosterFilter.set(filter);
    this.rosterExpanded.set(false);
  }

  protected toggleRosterExpand(): void {
    const isExpanding = !this.rosterExpanded();
    this.rosterExpanded.set(isExpanding);

    if (!isExpanding && typeof document !== 'undefined') {
      setTimeout(() => {
        const section = document.getElementById('sklad');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  protected positionLabel(position: PlayerPosition | string): string {
    switch (position) {
      case 'SETTER': return 'Rozgrywający';
      case 'OUTSIDE': return 'Przyjmujący';
      case 'OPPOSITE': return 'Atakujący';
      case 'MIDDLE': return 'Środkowy';
      case 'LIBERO': return 'Libero';
      case 'COACH': return 'Trener';
      default: return position;
    }
  }

  protected positionBadgeClass(position: PlayerPosition | string): string {
    switch (position) {
      case 'SETTER': return 'badge-setter';
      case 'OUTSIDE': return 'badge-outside';
      case 'OPPOSITE': return 'badge-opposite';
      case 'MIDDLE': return 'badge-middle';
      case 'LIBERO': return 'badge-libero';
      case 'COACH': return 'badge-coach';
      default: return '';
    }
  }

  protected readonly failedPlayerPhotos = signal<Set<string>>(new Set());

  protected playerPhotoUrl(playerId: string): string {
    if (!playerId) return '';
    const base = ASSETS_CDN_URL ? ASSETS_CDN_URL.replace(/\/$/, '') : '';
    return `${base}/roster/${encodeURIComponent(playerId)}.png`;
  }

  protected hasPlayerPhoto(playerId: string): boolean {
    return !this.failedPlayerPhotos().has(playerId);
  }

  protected onPlayerPhotoError(playerId: string): void {
    this.failedPlayerPhotos.update((set) => {
      const updated = new Set(set);
      updated.add(playerId);
      return updated;
    });
  }

  protected readonly failedTeamLogos = signal<Set<string>>(new Set());

  protected hasTeamLogo(teamName: string): boolean {
    return !this.failedTeamLogos().has(teamName);
  }

  protected onTeamLogoError(teamName: string): void {
    this.failedTeamLogos.update((set) => {
      const updated = new Set(set);
      updated.add(teamName);
      return updated;
    });
  }

  protected readonly partners: PartnerItem[] = [
    { id: 'partner-multitour', name: 'Multitour', logoFilename: 'multitour_logo.png' },
    { id: 'partner-sp3', name: 'SP3 w Środzie Śląskiej', logoFilename: 'sp3_logo.png' },
  ];

  protected readonly failedPartnerLogos = signal<Set<string>>(new Set());

  protected partnerLogoUrl(filename: string): string {
    if (!filename) return '';
    const base = ASSETS_CDN_URL ? ASSETS_CDN_URL.replace(/\/$/, '') : '';
    return `${base}/partners/${encodeURIComponent(filename)}`;
  }

  protected hasPartnerLogo(partnerId: string): boolean {
    return !this.failedPartnerLogos().has(partnerId);
  }

  protected onPartnerLogoError(partnerId: string): void {
    this.failedPartnerLogos.update((set) => {
      const updated = new Set(set);
      updated.add(partnerId);
      return updated;
    });
  }

  protected readonly nextMatch = computed<MatchItem | undefined>(() => {
    return this.fixtures().length > 0 ? this.fixtures()[0] : undefined;
  });

  protected readonly filteredFixtures = computed(() => {
    const filter = this.activeFilter();
    const all = this.fixtures();
    if (filter === 'home') {
      return all.filter((m) => this.isHome(m));
    }
    if (filter === 'away') {
      return all.filter((m) => !this.isHome(m));
    }
    return all;
  });

  protected readonly visibleFixtures = computed(() => {
    const list = this.filteredFixtures();
    return this.fixturesExpanded() ? list : list.slice(0, 3);
  });

  protected readonly visibleResults = computed(() => {
    const list = this.results();
    return this.resultsExpanded() ? list : list.slice(0, 3);
  });

  protected readonly unitedStanding = computed<TeamStanding | undefined>(() =>
    this.standings().find((s) => this.isUnited(s.teamName))
  );

  protected setFilter(filter: 'all' | 'home' | 'away'): void {
    this.activeFilter.set(filter);
    this.fixturesExpanded.set(false);
  }

  protected toggleFixturesExpand(): void {
    const isExpanding = !this.fixturesExpanded();
    this.fixturesExpanded.set(isExpanding);

    if (!isExpanding && typeof document !== 'undefined') {
      setTimeout(() => {
        const section = document.getElementById('mecze');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  protected toggleResultsExpand(): void {
    const isExpanding = !this.resultsExpanded();
    this.resultsExpanded.set(isExpanding);

    if (!isExpanding && typeof document !== 'undefined') {
      setTimeout(() => {
        const section = document.getElementById('wyniki');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  protected isTopFour(rank: number): boolean {
    return rank >= 1 && rank <= 4;
  }

  protected toggleHeroAvatar(side: 'home' | 'away'): void {
    if (side === 'home') {
      this.heroHomeFlipped.update((v) => !v);
    } else {
      this.heroAwayFlipped.update((v) => !v);
    }
  }

  protected teamStanding(name: string): TeamStanding | undefined {
    if (!name) return undefined;
    const isU = this.isUnited(name);
    const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim();
    const target = norm(name);
    return this.standings().find(
      (s) => (isU && this.isUnited(s.teamName)) || norm(s.teamName) === target
    );
  }

  protected teamStandingRankNumber(name: string): string | number {
    const standing = this.teamStanding(name);
    return standing?.rank ?? '--';
  }

  protected isTeamTopFour(name: string): boolean {
    const standing = this.teamStanding(name);
    return !!standing && this.isTopFour(standing.rank);
  }

  protected playedMatchesLabel(count: number): string {
    if (count === 1) {
      return 'Rozegrane spotkanie';
    }
    const rem10 = count % 10;
    const rem100 = count % 100;
    if (rem10 >= 2 && rem10 <= 4 && (rem100 < 10 || rem100 >= 20)) {
      return 'Rozegrane spotkania';
    }
    return 'Rozegranych spotkań';
  }

  protected remainingMatchesLabel(count: number): string {
    if (count === 1) {
      return 'Spotkanie pozostało';
    }
    const rem10 = count % 10;
    const rem100 = count % 100;
    if (rem10 >= 2 && rem10 <= 4 && (rem100 < 10 || rem100 >= 20)) {
      return 'Spotkania pozostały';
    }
    return 'Spotkań pozostało';
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected teamName(name: string): string {
    if (!name) return '';
    return name.replaceAll('_', ' ');
  }

  protected teamLogoUrl(teamName: string): string {
    if (!teamName) return '';
    const base = ASSETS_CDN_URL ? ASSETS_CDN_URL.replace(/\/$/, '') : '';
    const encodedName = encodeURIComponent(teamName.normalize('NFC'));
    return `${base}/logos/${encodedName}_logo.png`;
  }

  protected isUnited(name: string): boolean {
    if (!name) return false;
    return name.toLowerCase().includes('united') || name.toLowerCase() === UNITED_TEAM_NAME.toLowerCase();
  }

  protected matchHour(match: MatchItem): string | null {
    if (match?.hour) {
      const matchRegex = match.hour.trim().match(/^(\d{1,2}:\d{2})/);
      if (matchRegex) {
        return matchRegex[1];
      }
    }
    if (match?.date && match.date.includes(' ')) {
      const d = this.matchDate(match);
      if (d) {
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${hours}:${mins}`;
      }
    }
    return null;
  }

  protected hasSpecificTime(match: MatchItem): boolean {
    return !!this.matchHour(match);
  }

  protected matchDate(match: MatchItem): Date | null {
    if (!match?.date) return null;
    let iso: string;
    if (match.date.includes(' ')) {
      iso = match.date.replace(' ', 'T');
    } else if (match.hour && /^\d{1,2}:\d{2}/.test(match.hour.trim())) {
      iso = `${match.date}T${match.hour.trim()}:00`;
    } else {
      iso = `${match.date}T12:00:00`;
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private readonly datePipe = new DatePipe('pl');

  protected matchHourDisplay(match: MatchItem): string {
    const hour = this.matchHour(match);
    return hour ? `GODZINA: ${hour}` : 'ZAPLANOWANY';
  }

  protected matchHeroHour(match: MatchItem): string {
    return this.matchHour(match) || '--';
  }

  protected formatHeroDate(match: MatchItem): string {
    const d = this.matchDate(match);
    if (!d) return '';
    const raw = this.datePipe.transform(d, 'EEEE, d MMMM yyyy') || '';
    return raw.replace(/^(\p{L})/u, (m) => m.toUpperCase())
              .replace(/(\d+\s+)(\p{L})/u, (_m, p1, p2) => p1 + p2.toUpperCase());
  }

  protected matchPlace(match: MatchItem, defaultHome = 'Hala Środa Śląska', defaultAway = 'Mecz wyjazdowy'): string {
    if (match?.place && match.place.trim().length > 0) {
      return match.place.trim();
    }
    return this.isHome(match) ? defaultHome : defaultAway;
  }

  protected opponent(match: MatchItem): string {
    if (!match) return '';
    return this.isHome(match) ? match.awayTeamName : match.homeTeamName;
  }

  protected isHome(match: MatchItem): boolean {
    if (!match?.homeTeamName) return false;
    return this.isUnited(match.homeTeamName);
  }

  protected isUnitedWin(match: MatchItem): boolean {
    return this.isTeamWin(match, UNITED_TEAM_NAME);
  }

  protected cleanMatchScore(match: MatchItem): string {
    const parseScore = (str?: string): string | null => {
      if (!str) return null;
      const trimmed = str.trim();
      const simpleMatch = trimmed.match(/^([0-3])\s*:\s*([0-3])$/);
      if (simpleMatch) return `${simpleMatch[1]}:${simpleMatch[2]}`;
      const leadingMatch = trimmed.match(/^([0-3])\s*:\s*([0-3])(?:\s*\(.*)?$/);
      if (leadingMatch) return `${leadingMatch[1]}:${leadingMatch[2]}`;
      return null;
    };

    const finalScoreClean = parseScore(match.finalScore);
    if (finalScoreClean) return finalScoreClean;

    const scoreClean = parseScore(match.score);
    if (scoreClean) return scoreClean;

    const sets = this.extractSetsList(match);
    if (sets.length > 0) {
      let hWins = 0;
      let aWins = 0;
      for (const s of sets) {
        const [h, a] = s.split(':').map((p) => parseInt(p.trim(), 10));
        if (!isNaN(h) && !isNaN(a)) {
          if (h > a) hWins++;
          else if (a > h) aWins++;
        }
      }
      if (hWins > 0 || aWins > 0) return `${hWins}:${aWins}`;
    }

    return match.finalScore || match.score || '';
  }

  protected matchScoreDisplay(match: MatchItem): string {
    const clean = this.cleanMatchScore(match);
    if (clean && clean.includes(':')) {
      const [h, a] = clean.split(':').map((p) => p.trim());
      if (h && a) return `${h} : ${a}`;
    }
    return clean || '— : —';
  }

  protected isTeamWin(match: MatchItem, teamName: string): boolean {
    const scoreVal = this.cleanMatchScore(match);
    if (!scoreVal || !scoreVal.includes(':')) return false;
    const parts = scoreVal.split(':');
    const homeScore = parseInt(parts[0].trim(), 10);
    const awayScore = parseInt(parts[1].trim(), 10);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return false;

    const isU = this.isUnited(teamName);
    const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim();
    const target = norm(teamName);
    const isHome = (isU && this.isUnited(match.homeTeamName)) || norm(match.homeTeamName) === target;
    return isHome ? homeScore > awayScore : awayScore > homeScore;
  }

  protected getTeamForm(name: string): string[] {
    if (!name) return [];
    const standing = this.teamStanding(name);
    if (standing?.form && standing.form.length > 0) {
      return standing.form;
    }

    const isU = this.isUnited(name);
    const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim();
    const target = norm(name);

    const pool = this.allResults().length > 0 ? this.allResults() : this.results();
    const teamFinished = pool.filter(
      (m) => m.isFinished && ((isU && (this.isUnited(m.homeTeamName) || this.isUnited(m.awayTeamName))) ||
             norm(m.homeTeamName) === target || norm(m.awayTeamName) === target)
    );

    const sorted = [...teamFinished].sort((a, b) => {
      const tA = this.matchDate(a)?.getTime() ?? 0;
      const tB = this.matchDate(b)?.getTime() ?? 0;
      return tB - tA;
    });

    return sorted.slice(0, 5).map((m) => (this.isTeamWin(m, name) ? 'W' : 'P'));
  }

  protected toggleCardStats(matchId: string): void {
    this.flippedCardIds.update((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }

  protected isCardFlipped(matchId: string): boolean {
    return this.flippedCardIds().has(matchId);
  }

  protected toggleResultDetails(matchId: string): void {
    this.expandedResultIds.update((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }

  protected isResultExpanded(matchId: string): boolean {
    return this.expandedResultIds().has(matchId);
  }

  protected extractSetsList(match: MatchItem): string[] {
    if (match.sets && match.sets.length > 0) {
      return match.sets;
    }

    const parseFromStr = (str?: string): string[] => {
      if (!str) return [];
      const trimmed = str.trim();
      const parenMatch = trimmed.match(/\(([^)]+)\)/);
      const textToParse = parenMatch ? parenMatch[1] : trimmed;

      const setRegex = /(\d{1,3})\s*:\s*(\d{1,3})/g;
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = setRegex.exec(textToParse)) !== null) {
        matches.push(`${m[1]}:${m[2]}`);
      }
      if (matches.length === 0) return [];
      if (matches.length === 1) {
        const [h, a] = matches[0].split(':').map(Number);
        if (h <= 3 && a <= 3) return [];
        return matches;
      }
      const [firstH, firstA] = matches[0].split(':').map(Number);
      if (firstH <= 3 && firstA <= 3 && (firstH === 3 || firstA === 3) && matches.length > 2) {
        const remaining = matches.slice(1);
        if (remaining.some((s) => {
          const [h, a] = s.split(':').map(Number);
          return h > 3 || a > 3;
        })) {
          return remaining;
        }
      }
      return matches;
    };

    const fromScore = parseFromStr(match.score);
    if (fromScore.length > 0) return fromScore;

    return parseFromStr(match.finalScore);
  }

  protected getMatchSetDetails(match: MatchItem): SetDetailItem[] {
    const rawSets = this.extractSetsList(match);
    if (!rawSets || rawSets.length === 0) {
      return [];
    }

    const unitedIsHost = this.isHome(match);

    const parseSetStr = (setStr: string, index: number): SetDetailItem | null => {
      const parts = setStr.split(':').map((p) => parseInt(p.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const host = parts[0];
        const away = parts[1];
        const diff = Math.abs(host - away);
        const percent = Math.min(100, Math.round((diff / 25) * 100));
        const winner: 'host' | 'away' | 'none' = host > away ? 'host' : away > host ? 'away' : 'none';
        const unitedWon = (winner === 'host' && unitedIsHost) || (winner === 'away' && !unitedIsHost);
        return {
          setNumber: index + 1,
          hostScore: host,
          awayScore: away,
          scoreText: `${host} : ${away}`,
          difference: diff,
          winner,
          unitedWon,
          hostPercent: winner === 'host' ? percent : 0,
          awayPercent: winner === 'away' ? percent : 0,
        };
      }
      return null;
    };

    return rawSets
      .map((s, idx) => parseSetStr(s, idx))
      .filter((item): item is SetDetailItem => item !== null)
      .slice(0, 5);
  }

  private readonly decimalPipe = new DecimalPipe('pl');

  protected getMatchStats(match: MatchItem): TeamStatItem[] {
    const hostStand = this.teamStanding(match.homeTeamName);
    const awayStand = this.teamStanding(match.awayTeamName);

    const hMatches = hostStand?.matchesPlayed ?? 0;
    const aMatches = awayStand?.matchesPlayed ?? 0;

    const hPoints = hostStand?.points ?? 0;
    const aPoints = awayStand?.points ?? 0;

    const hWins = hostStand?.wins ?? 0;
    const aWins = awayStand?.wins ?? 0;

    const hSetsRatio = hostStand?.setsRatio ?? 0;
    const aSetsRatio = awayStand?.setsRatio ?? 0;

    const hPointRatio = hostStand?.pointRatio ?? 0;
    const aPointRatio = awayStand?.pointRatio ?? 0;

    const allStandings = this.standings();
    const maxMatchesInStandings = allStandings.length
      ? Math.max(...allStandings.map((s) => s.matchesPlayed), hMatches, aMatches, 1)
      : Math.max(hMatches, aMatches, 1);

    const maxPointsInStandings = allStandings.length
      ? Math.max(...allStandings.map((s) => s.points), hPoints, aPoints, 1)
      : Math.max(hPoints, aPoints, 1);

    const maxWinsInStandings = allStandings.length
      ? Math.max(...allStandings.map((s) => s.wins), hWins, aWins, 1)
      : Math.max(hWins, aWins, 1);

    let hMatchColor: 'green' | 'grey' = 'grey';
    let aMatchColor: 'green' | 'grey' = 'grey';
    if (hMatches !== aMatches) {
      if (hMatches < aMatches) {
        hMatchColor = 'green';
        aMatchColor = 'grey';
      } else {
        hMatchColor = 'grey';
        aMatchColor = 'green';
      }
    }
    const hMatchPct = maxMatchesInStandings > 0 && hMatches > 0 ? Math.round((hMatches / maxMatchesInStandings) * 100) : 0;
    const aMatchPct = maxMatchesInStandings > 0 && aMatches > 0 ? Math.round((aMatches / maxMatchesInStandings) * 100) : 0;

    const computeBarStat = (hVal: number, aVal: number, maxVal: number) => {
      let hColor: 'green' | 'grey' = 'grey';
      let aColor: 'green' | 'grey' = 'grey';

      if (hVal > aVal) {
        hColor = 'green';
        aColor = 'grey';
      } else if (aVal > hVal) {
        hColor = 'grey';
        aColor = 'green';
      }

      const hPct = maxVal > 0 && hVal > 0 ? Math.round((hVal / maxVal) * 100) : 0;
      const aPct = maxVal > 0 && aVal > 0 ? Math.round((aVal / maxVal) * 100) : 0;

      return { hColor, aColor, hPct, aPct };
    };

    const pointsBar = computeBarStat(hPoints, aPoints, maxPointsInStandings);
    const winsBar = computeBarStat(hWins, aWins, maxWinsInStandings);

    const computeRatioColors = (hVal: number, aVal: number) => {
      let hColor: 'green' | 'grey' = 'grey';
      let aColor: 'green' | 'grey' = 'grey';
      const diff = Math.round((hVal - aVal) * 1000) / 1000;
      if (diff > 0) {
        hColor = 'green';
        aColor = 'grey';
      } else if (diff < 0) {
        hColor = 'grey';
        aColor = 'green';
      }
      return { hColor, aColor };
    };

    const setsRatioColors = computeRatioColors(hSetsRatio, aSetsRatio);
    const pointRatioColors = computeRatioColors(hPointRatio, aPointRatio);

    const formatRatio = (val: number) => {
      return this.decimalPipe.transform(val, '1.2-2') || '0,00';
    };

    return [
      {
        label: 'Rozegrane mecze',
        hostValue: hMatches,
        awayValue: aMatches,
        hostColor: hMatchColor,
        awayColor: aMatchColor,
        hasBar: true,
        hostBarPercent: hMatchPct,
        awayBarPercent: aMatchPct,
      },
      {
        label: 'Punkty',
        hostValue: hPoints,
        awayValue: aPoints,
        hostColor: pointsBar.hColor,
        awayColor: pointsBar.aColor,
        hasBar: true,
        hostBarPercent: pointsBar.hPct,
        awayBarPercent: pointsBar.aPct,
      },
      {
        label: 'Wygrane mecze',
        hostValue: hWins,
        awayValue: aWins,
        hostColor: winsBar.hColor,
        awayColor: winsBar.aColor,
        hasBar: true,
        hostBarPercent: winsBar.hPct,
        awayBarPercent: winsBar.aPct,
      },
      {
        label: 'Stosunek setów',
        hostValue: formatRatio(hSetsRatio),
        awayValue: formatRatio(aSetsRatio),
        hostColor: setsRatioColors.hColor,
        awayColor: setsRatioColors.aColor,
        hasBar: false,
        hostBarPercent: 0,
        awayBarPercent: 0,
      },
      {
        label: 'Stosunek małych punktów',
        hostValue: formatRatio(hPointRatio),
        awayValue: formatRatio(aPointRatio),
        hostColor: pointRatioColors.hColor,
        awayColor: pointRatioColors.aColor,
        hasBar: false,
        hostBarPercent: 0,
        awayBarPercent: 0,
      },
    ];
  }

  protected refreshData(): void {
    this.leagueApi.refresh();
    this.newsApi.fetchLatestNews(3);
  }
}
