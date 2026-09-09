import { DatePipe, DecimalPipe, NgClass, registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { Component, computed, inject, LOCALE_ID, signal } from '@angular/core';
import { LeagueApiService, UNITED_TEAM_NAME } from './core/api/league-api.service';
import { MatchItem, SetDetailItem, TeamStanding, TeamStatItem } from './core/api/league.models';

registerLocaleData(localePl, 'pl');
registerLocaleData(localePl, 'pl-PL');

// Set this to your CloudFront CDN URL from terraform output (e.g. 'https://d111111abcdef8.cloudfront.net')
// Leaving it empty ('') automatically serves logos from local `web/public/logos/`.
export const ASSETS_CDN_URL: string = 'https://d1rm5h55nlqrob.cloudfront.net';

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, NgClass],
  providers: [
    { provide: LOCALE_ID, useValue: 'pl' },
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly leagueApi = inject(LeagueApiService);

  protected readonly menuOpen = signal(false);
  protected readonly activeFilter = signal<'all' | 'home' | 'away'>('all');
  protected readonly fixturesExpanded = signal(false);
  protected readonly resultsExpanded = signal(false);
  protected readonly heroHomeFlipped = signal(false);
  protected readonly heroAwayFlipped = signal(false);
  protected readonly flippedCardIds = signal<Set<string>>(new Set());
  protected readonly expandedResultIds = signal<Set<string>>(new Set());

  protected readonly fixtures = this.leagueApi.fixtures;
  protected readonly results = this.leagueApi.results;
  protected readonly allResults = this.leagueApi.allResults;
  protected readonly standings = this.leagueApi.standings;
  protected readonly loading = this.leagueApi.loading;
  protected readonly error = this.leagueApi.error;

  protected readonly nextMatch = computed(() => this.fixtures()[0]);

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
        // Max advantage is 25 points, bar fills proportional to the difference
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

    // Reference max values from the whole standings
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

    // 1. Matches Played: if equal both grey, if not equal smaller green. Bar scaled to max in standings.
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

    // 2 & 3. Points and Won matches: longer bar green, shorter grey, if equal both grey. Bar scaled to max in standings.
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

    // 4 & 5. Sets Ratio & Points Ratio: if equal both grey, if not equal higher green, smaller grey
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
  }
}

