import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { App } from './app';
import { LeagueApiService } from './core/api/league-api.service';
import { MatchItem } from './core/api/league.models';

registerLocaleData(localePl, 'pl');
registerLocaleData(localePl, 'pl-PL');

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'pl' },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should clean team names properly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['teamName']('United_Środa_Śląska')).toBe('United Środa Śląska');
    expect(app['teamName']('JKS_SPARTAKUS_Jawor')).toBe('JKS SPARTAKUS Jawor');
  });

  it('should identify United correctly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['isUnited']('United_Środa_Śląska')).toBeTrue();
    expect(app['isUnited']('KPS_FARAON_Ziębice')).toBeFalse();
  });

  it('should identify top 4 teams correctly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['isTopFour'](1)).toBeTrue();
    expect(app['isTopFour'](2)).toBeTrue();
    expect(app['isTopFour'](3)).toBeTrue();
    expect(app['isTopFour'](4)).toBeTrue();
    expect(app['isTopFour'](5)).toBeFalse();
    expect(app['isTopFour'](7)).toBeFalse();
    expect(app['isTopFour'](0)).toBeFalse();
  });

  it('should handle fixtures expansion and collapse correctly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['fixturesExpanded']()).toBeFalse();

    app['toggleFixturesExpand']();
    expect(app['fixturesExpanded']()).toBeTrue();

    app['toggleFixturesExpand']();
    expect(app['fixturesExpanded']()).toBeFalse();

    // Changing filter should reset expansion to false
    app['toggleFixturesExpand']();
    expect(app['fixturesExpanded']()).toBeTrue();
    app['setFilter']('home');
    expect(app['fixturesExpanded']()).toBeFalse();
  });

  it('should handle results expansion and collapse correctly', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['resultsExpanded']()).toBeFalse();

    app['toggleResultsExpand']();
    expect(app['resultsExpanded']()).toBeTrue();

    app['toggleResultsExpand']();
    expect(app['resultsExpanded']()).toBeFalse();
  });

  it('should pluralize played matches label correctly according to count', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['playedMatchesLabel'](0)).toBe('Rozegranych spotkań');
    expect(app['playedMatchesLabel'](1)).toBe('Rozegrane spotkanie');
    expect(app['playedMatchesLabel'](2)).toBe('Rozegrane spotkania');
    expect(app['playedMatchesLabel'](3)).toBe('Rozegrane spotkania');
    expect(app['playedMatchesLabel'](4)).toBe('Rozegrane spotkania');
    expect(app['playedMatchesLabel'](5)).toBe('Rozegranych spotkań');
    expect(app['playedMatchesLabel'](12)).toBe('Rozegranych spotkań');
    expect(app['playedMatchesLabel'](22)).toBe('Rozegrane spotkania');
  });

  it('should pluralize remaining matches label correctly according to count', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app['remainingMatchesLabel'](0)).toBe('Spotkań pozostało');
    expect(app['remainingMatchesLabel'](1)).toBe('Spotkanie pozostało');
    expect(app['remainingMatchesLabel'](2)).toBe('Spotkania pozostały');
    expect(app['remainingMatchesLabel'](3)).toBe('Spotkania pozostały');
    expect(app['remainingMatchesLabel'](4)).toBe('Spotkania pozostały');
    expect(app['remainingMatchesLabel'](5)).toBe('Spotkań pozostało');
    expect(app['remainingMatchesLabel'](12)).toBe('Spotkań pozostało');
    expect(app['remainingMatchesLabel'](23)).toBe('Spotkania pozostały');
  });

  it('should format matchHourDisplay correctly when hour is known or unknown', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Known hour directly in match.hour
    expect(app['matchHourDisplay']({
      matchId: '1',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      hour: '17:00',
    })).toBe('GODZINA: 17:00');

    // Unknown hour ("zawiadamia gospodarz") -> ZAPLANOWANY
    expect(app['matchHourDisplay']({
      matchId: '2',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      hour: 'zawiadamia gospodarz',
    })).toBe('ZAPLANOWANY');

    // Missing hour -> ZAPLANOWANY
    expect(app['matchHourDisplay']({
      matchId: '3',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
    })).toBe('ZAPLANOWANY');

    // Hour present in date string
    expect(app['matchHourDisplay']({
      matchId: '4',
      date: '2026-10-03 18:30',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
    })).toBe('GODZINA: 18:30');

    // Helper matchHour returns raw hour or null
    expect(app['matchHour']({
      matchId: '1',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      hour: '17:00',
    })).toBe('17:00');

    expect(app['matchHour']({
      matchId: '2',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      hour: 'zawiadamia gospodarz',
    })).toBeNull();
  });

  it('should resolve matchPlace with fallback to home or away default', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Scraped place is present
    expect(app['matchPlace']({
      matchId: '1',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      place: 'SP5 Armii Krajowej 9 Jawor',
    })).toBe('SP5 Armii Krajowej 9 Jawor');

    // Fallback home
    expect(app['matchPlace']({
      matchId: '2',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
    })).toBe('Hala Środa Śląska');

    // Fallback away
    expect(app['matchPlace']({
      matchId: '3',
      date: '2026-10-03',
      homeTeamName: 'Rywal',
      awayTeamName: 'United_Środa_Śląska',
      score: '',
      isFinished: false,
    })).toBe('Mecz wyjazdowy');
  });

  it('should format calendar dates in Polish locale', () => {
    const fixture = TestBed.createComponent(App);
    const datePipe = new DatePipe('pl');
    const date = new Date('2026-10-03T17:00:00');

    // Month abbreviation in Polish (październik -> paź)
    const month = datePipe.transform(date, 'LLL');
    expect(month?.toLowerCase()).toBe('paź');

    // Day of week and full date in Polish
    const fullDate = datePipe.transform(date, 'EEEE, d MMMM yyyy');
    expect(fullDate?.toLowerCase()).toContain('października');
    expect(fullDate?.toLowerCase()).toContain('sobota');
  });

  it('should format hero match hour and capitalize both weekday and month in hero date', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const matchWithTime = {
      matchId: '1',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
      hour: '17:00',
    };

    const matchWithoutTime = {
      matchId: '2',
      date: '2026-10-03',
      homeTeamName: 'United_Środa_Śląska',
      awayTeamName: 'Rywal',
      score: '',
      isFinished: false,
    };

    // matchHeroHour
    expect(app['matchHeroHour'](matchWithTime)).toBe('17:00');
    expect(app['matchHeroHour'](matchWithoutTime)).toBe('--');

    // formatHeroDate capitalizes both weekday and month
    const formattedDate = app['formatHeroDate'](matchWithTime);
    expect(formattedDate).toBe('Sobota, 3 Października 2026');
  });

  it('should toggle hero avatar and display standing rank and MSC when clicked', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const api = TestBed.inject(LeagueApiService);

    api.standings.set([
      {
        rank: 1,
        teamName: 'United_Środa_Śląska',
        matchesPlayed: 10,
        points: 27,
        wins: 9,
        setsWon: 27,
        setsLost: 5,
        pointsWon: 700,
        pointsLost: 500,
        setsRatio: 5.4,
        pointRatio: 1.4,
      },
      {
        rank: 6,
        teamName: 'Rywal_Jawor',
        matchesPlayed: 10,
        points: 12,
        wins: 4,
        setsWon: 15,
        setsLost: 20,
        pointsWon: 600,
        pointsLost: 650,
        setsRatio: 0.75,
        pointRatio: 0.92,
      },
    ]);

    api.fixtures.set([
      {
        matchId: '100',
        date: '2026-10-03',
        homeTeamName: 'United_Środa_Śląska',
        awayTeamName: 'Rywal_Jawor',
        score: '',
        isFinished: false,
        hour: '17:00',
      },
    ]);

    fixture.detectChanges();

    // Check rank numbers
    expect(app['teamStandingRankNumber']('United_Środa_Śląska')).toBe(1);
    expect(app['teamStandingRankNumber']('Rywal_Jawor')).toBe(6);
    expect(app['teamStandingRankNumber']('Nieznany_Klub')).toBe('--');

    // Check top 4
    expect(app['isTeamTopFour']('United_Środa_Śląska')).toBeTrue();
    expect(app['isTeamTopFour']('Rywal_Jawor')).toBeFalse();

    // Flip states initial
    expect(app['heroHomeFlipped']()).toBeFalse();
    expect(app['heroAwayFlipped']()).toBeFalse();

    // Toggle home avatar
    app['toggleHeroAvatar']('home');
    expect(app['heroHomeFlipped']()).toBeTrue();
    expect(app['heroAwayFlipped']()).toBeFalse();

    // Toggle back
    app['toggleHeroAvatar']('home');
    expect(app['heroHomeFlipped']()).toBeFalse();

    // Toggle away avatar
    app['toggleHeroAvatar']('away');
    expect(app['heroAwayFlipped']()).toBeTrue();

    // In DOM, check .team-avatar elements
    fixture.detectChanges();
    const avatarButtons = fixture.nativeElement.querySelectorAll('.team-avatar');
    expect(avatarButtons.length).toBe(2);

    // Away is flipped
    expect(avatarButtons[1].classList.contains('is-flipped')).toBeTrue();
    expect(avatarButtons[1].querySelector('.standing-rank-num')?.textContent?.trim().replace(/\s+/g, '')).toBe('#6');
    expect(avatarButtons[1].querySelector('.standing-rank-label')?.textContent?.trim()).toBe('MSC');

    // Clicking home button in DOM toggles it
    avatarButtons[0].click();
    fixture.detectChanges();
    expect(app['heroHomeFlipped']()).toBeTrue();
    expect(avatarButtons[0].classList.contains('is-flipped')).toBeTrue();
    expect(avatarButtons[0].querySelector('.standing-rank-num')?.textContent?.trim().replace(/\s+/g, '')).toBe('#1');
    expect(avatarButtons[0].querySelector('.standing-rank-label')?.textContent?.trim()).toBe('MSC');
  });

  describe('Nadchodzące mecze - Match card stats comparison', () => {
    it('should toggle card flip state for specific match ids', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app['isCardFlipped']('m1')).toBeFalse();
      expect(app['isCardFlipped']('m2')).toBeFalse();

      app['toggleCardStats']('m1');
      expect(app['isCardFlipped']('m1')).toBeTrue();
      expect(app['isCardFlipped']('m2')).toBeFalse();

      app['toggleCardStats']('m2');
      expect(app['isCardFlipped']('m1')).toBeTrue();
      expect(app['isCardFlipped']('m2')).toBeTrue();

      app['toggleCardStats']('m1');
      expect(app['isCardFlipped']('m1')).toBeFalse();
      expect(app['isCardFlipped']('m2')).toBeTrue();
    });

    it('should calculate stats with correct colors and horizontal bars scaling against whole standings max', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      api.standings.set([
        {
          rank: 1,
          teamName: 'Lider_Ligi',
          matchesPlayed: 10,
          points: 25,
          wins: 8,
          setsWon: 24,
          setsLost: 4,
          pointsWon: 700,
          pointsLost: 500,
          setsRatio: 6.0,
          pointRatio: 1.4,
        },
        {
          rank: 2,
          teamName: 'United_Środa_Śląska',
          matchesPlayed: 8,
          points: 20,
          wins: 7,
          setsWon: 21,
          setsLost: 5,
          pointsWon: 620,
          pointsLost: 480,
          setsRatio: 4.2,
          pointRatio: 1.29,
        },
        {
          rank: 3,
          teamName: 'Rywal_Wrocław',
          matchesPlayed: 9,
          points: 16,
          wins: 5,
          setsWon: 18,
          setsLost: 10,
          pointsWon: 590,
          pointsLost: 510,
          setsRatio: 1.8,
          pointRatio: 1.15,
        },
      ]);

      const match = {
        matchId: 'm1',
        date: '2026-10-15',
        homeTeamName: 'United_Środa_Śląska',
        awayTeamName: 'Rywal_Wrocław',
        score: '',
        isFinished: false,
      };

      const stats = app['getMatchStats'](match);
      expect(stats.length).toBe(5);

      // Max in standings: matches = 10, points = 25, wins = 8

      // 1. Matches Played: 8 vs 9 -> smaller (8) is green, larger (9) is grey. Scaled to max 10.
      expect(stats[0].label).toBe('Rozegrane mecze');
      expect(stats[0].hostValue).toBe(8);
      expect(stats[0].awayValue).toBe(9);
      expect(stats[0].hostColor).toBe('green');
      expect(stats[0].awayColor).toBe('grey');
      expect(stats[0].hasBar).toBeTrue();
      expect(stats[0].hostBarPercent).toBe(80); // 8/10
      expect(stats[0].awayBarPercent).toBe(90); // 9/10

      // 2. Points: 20 vs 16 -> longer (20) is green, shorter (16) is grey. Scaled to max 25.
      expect(stats[1].label).toBe('Punkty');
      expect(stats[1].hostValue).toBe(20);
      expect(stats[1].awayValue).toBe(16);
      expect(stats[1].hostColor).toBe('green');
      expect(stats[1].awayColor).toBe('grey');
      expect(stats[1].hasBar).toBeTrue();
      expect(stats[1].hostBarPercent).toBe(80); // 20/25
      expect(stats[1].awayBarPercent).toBe(64); // 16/25

      // 3. Won matches: 7 vs 5 -> longer (7) is green, shorter (5) is grey. Scaled to max 8 (user example).
      expect(stats[2].label).toBe('Wygrane mecze');
      expect(stats[2].hostValue).toBe(7);
      expect(stats[2].awayValue).toBe(5);
      expect(stats[2].hostColor).toBe('green');
      expect(stats[2].awayColor).toBe('grey');
      expect(stats[2].hasBar).toBeTrue();
      expect(stats[2].hostBarPercent).toBe(88); // 7/8 = 87.5% -> 88%
      expect(stats[2].awayBarPercent).toBe(63); // 5/8 = 62.5% -> 63%

      // 4. Sets Ratio: 4.2 vs 1.8 -> higher is green, smaller is grey
      expect(stats[3].label).toBe('Stosunek setów');
      expect(stats[3].hostColor).toBe('green');
      expect(stats[3].awayColor).toBe('grey');
      expect(stats[3].hasBar).toBeFalse();

      // 5. Points Ratio: 1.29 vs 1.15 -> higher is green, smaller is grey
      expect(stats[4].label).toBe('Stosunek małych punktów');
      expect(stats[4].hostColor).toBe('green');
      expect(stats[4].awayColor).toBe('grey');
      expect(stats[4].hasBar).toBeFalse();
    });

    it('should handle equal stats by making both grey, and fallback to 0 and grey when standing is missing', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      // Team with identical stats
      api.standings.set([
        {
          rank: 3,
          teamName: 'Druzyna_A',
          matchesPlayed: 10,
          points: 15,
          wins: 5,
          setsWon: 15,
          setsLost: 15,
          pointsWon: 500,
          pointsLost: 500,
          setsRatio: 1.0,
          pointRatio: 1.0,
        },
        {
          rank: 4,
          teamName: 'Druzyna_B',
          matchesPlayed: 10,
          points: 15,
          wins: 5,
          setsWon: 15,
          setsLost: 15,
          pointsWon: 500,
          pointsLost: 500,
          setsRatio: 1.0,
          pointRatio: 1.0,
        },
      ]);

      const tieMatch = {
        matchId: 'tie1',
        date: '2026-10-20',
        homeTeamName: 'Druzyna_A',
        awayTeamName: 'Druzyna_B',
        score: '',
        isFinished: false,
      };

      const tieStats = app['getMatchStats'](tieMatch);
      // All stats should be grey when equal
      for (const stat of tieStats) {
        expect(stat.hostColor).toBe('grey');
        expect(stat.awayColor).toBe('grey');
        if (stat.hasBar) {
          expect(stat.hostBarPercent).toBe(stat.awayBarPercent);
        }
      }

      // Fallback match: teams not in standings
      const missingMatch = {
        matchId: 'miss1',
        date: '2026-10-25',
        homeTeamName: 'Nieznana_1',
        awayTeamName: 'Nieznana_2',
        score: '',
        isFinished: false,
      };

      const fallbackStats = app['getMatchStats'](missingMatch);
      expect(fallbackStats.length).toBe(5);
      for (const stat of fallbackStats) {
        expect(stat.hostColor).toBe('grey');
        expect(stat.awayColor).toBe('grey');
        if (stat.hasBar) {
          expect(stat.hostBarPercent).toBe(0);
          expect(stat.awayBarPercent).toBe(0);
        }
      }
      expect(fallbackStats[0].hostValue).toBe(0);
      expect(fallbackStats[0].awayValue).toBe(0);
      expect(fallbackStats[1].hostValue).toBe(0);
      expect(fallbackStats[1].awayValue).toBe(0);
    });

    it('should flip card when clicked in the DOM and display team logos and stats on the back face', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      api.standings.set([
        {
          rank: 1,
          teamName: 'United_Środa_Śląska',
          matchesPlayed: 5,
          points: 15,
          wins: 5,
          setsWon: 15,
          setsLost: 2,
          pointsWon: 400,
          pointsLost: 300,
          setsRatio: 7.5,
          pointRatio: 1.33,
        },
        {
          rank: 5,
          teamName: 'Rywal_Oława',
          matchesPlayed: 6,
          points: 8,
          wins: 2,
          setsWon: 8,
          setsLost: 12,
          pointsWon: 350,
          pointsLost: 380,
          setsRatio: 0.67,
          pointRatio: 0.92,
        },
      ]);

      api.fixtures.set([
        {
          matchId: 'f1',
          date: '2026-11-01',
          homeTeamName: 'United_Środa_Śląska',
          awayTeamName: 'Rywal_Oława',
          score: '',
          isFinished: false,
          hour: '18:00',
        },
      ]);

      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.fixtures-grid .match-card') as HTMLElement;
      expect(card).toBeTruthy();
      expect(card.classList.contains('is-flipped')).toBeFalse();

      // Verify hint text on card front
      expect(card.querySelector('.card-flip-hint .hint-text')?.textContent?.trim()).toBe('Kliknij aby sprawdzić statystyki przedmeczowe');

      // Click on card to flip
      card.click();
      fixture.detectChanges();

      expect(app['isCardFlipped']('f1')).toBeTrue();
      expect(card.classList.contains('is-flipped')).toBeTrue();

      // On back face: team logos on top (host on left, away on right, separated, no team names, no squares, no capital letters)
      const topBar = card.querySelector('.card-face-back .stats-top-bar');
      expect(topBar).toBeTruthy();

      const hostLogo = topBar?.querySelector('.stats-team-logo.host-logo');
      const awayLogo = topBar?.querySelector('.stats-team-logo.away-logo');
      expect(hostLogo).toBeTruthy();
      expect(awayLogo).toBeTruthy();

      // No square box wrapper and no fallback letter span
      expect(topBar?.querySelector('.stats-logo-box')).toBeNull();
      expect(topBar?.querySelector('.stats-logo-fallback')).toBeNull();

      // Ensure no team name text inside stats-top-bar
      expect(topBar?.textContent).not.toContain('United Środa Śląska');
      expect(topBar?.textContent).not.toContain('Rywal Oława');

      // Verify stats rows on back face (Forma + 5 stats)
      const statRows = card.querySelectorAll('.card-face-back .stat-row');
      expect(statRows.length).toBe(6);

      // Check stat labels in Polish including FORMA
      const labels = Array.from(statRows).map(r => r.querySelector('.stat-name')?.textContent?.trim());
      expect(labels).toEqual([
        'FORMA',
        'Rozegrane mecze',
        'Punkty',
        'Wygrane mecze',
        'Stosunek setów',
        'Stosunek małych punktów',
      ]);

      // Check bars for Matches played, Points and Won matches (3 bars)
      const bars = card.querySelectorAll('.card-face-back .stat-bar-track');
      expect(bars.length).toBe(3);

      // Host has 15 pts vs 8 pts -> host bar should be green, away bar grey
      const pointsBarFills = statRows[2].querySelectorAll('.bar-fill');
      expect(pointsBarFills[0].classList.contains('fill-green')).toBeTrue();
      expect(pointsBarFills[1].classList.contains('fill-grey')).toBeTrue();

      // Click again to flip back
      card.click();
      fixture.detectChanges();
      expect(app['isCardFlipped']('f1')).toBeFalse();
      expect(card.classList.contains('is-flipped')).toBeFalse();
    });

    it('should return live form from standing if present or compute from finished matches', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      // 1. Standing with pre-populated form
      api.standings.set([
        {
          rank: 1,
          teamName: 'United_Środa_Śląska',
          matchesPlayed: 5,
          points: 15,
          wins: 5,
          setsWon: 15,
          setsLost: 2,
          pointsWon: 400,
          pointsLost: 300,
          setsRatio: 7.5,
          pointRatio: 1.33,
          form: ['W', 'W', 'P', 'W', 'W'],
        },
      ]);

      expect(app['getTeamForm']('United_Środa_Śląska')).toEqual(['W', 'W', 'P', 'W', 'W']);

      // 2. Standing without form, but results are available in results()
      api.standings.set([
        {
          rank: 2,
          teamName: 'Rywal_Wrocław',
          matchesPlayed: 4,
          points: 9,
          wins: 3,
          setsWon: 10,
          setsLost: 6,
          pointsWon: 350,
          pointsLost: 320,
          setsRatio: 1.67,
          pointRatio: 1.09,
        },
      ]);

      api.results.set([
        {
          matchId: '1',
          date: '2026-10-01',
          homeTeamName: 'Rywal_Wrocław',
          awayTeamName: 'Inny_Zespół',
          score: '3:1',
          isFinished: true,
        },
        {
          matchId: '2',
          date: '2026-10-08',
          homeTeamName: 'Inny_Zespół',
          awayTeamName: 'Rywal_Wrocław',
          score: '3:0',
          isFinished: true,
        },
        {
          matchId: '3',
          date: '2026-10-15',
          homeTeamName: 'Rywal_Wrocław',
          awayTeamName: 'Trzeci_Zespół',
          score: '3:2',
          isFinished: true,
        },
      ]);

      // Most recent first: 2026-10-15 (W, 3:2), 2026-10-08 (P, away 0:3), 2026-10-01 (W, 3:1)
      expect(app['getTeamForm']('Rywal_Wrocław')).toEqual(['W', 'P', 'W']);

      // 3. Team form calculated from allResults even when results only contains United matches
      api.results.set([
        {
          matchId: '10',
          date: '2026-10-01',
          homeTeamName: 'United_Środa_Śląska',
          awayTeamName: 'Inny_Zespół',
          score: '3:0',
          isFinished: true,
        },
      ]);
      api.allResults.set([
        {
          matchId: '20',
          date: '2026-10-05',
          homeTeamName: 'KPS_FARAON_Ziębice',
          awayTeamName: 'JKS_SPARTAKUS_Jawor',
          score: '3:1',
          isFinished: true,
        },
        {
          matchId: '21',
          date: '2026-10-12',
          homeTeamName: 'JKS_SPARTAKUS_Jawor',
          awayTeamName: 'KPS_FARAON_Ziębice',
          score: '0:3',
          isFinished: true,
        },
      ]);
      api.standings.set([
        {
          rank: 2,
          teamName: 'KPS_FARAON_Ziębice',
          matchesPlayed: 2,
          points: 6,
          wins: 2,
          setsWon: 6,
          setsLost: 1,
          pointsWon: 175,
          pointsLost: 140,
          setsRatio: 6.0,
          pointRatio: 1.25,
        },
      ]);

      expect(app['getTeamForm']('KPS_FARAON_Ziębice')).toEqual(['W', 'W']);
    });

    it('should render FORMA column in the standings table', () => {
      const fixture = TestBed.createComponent(App);
      const api = TestBed.inject(LeagueApiService);

      api.standings.set([
        {
          rank: 1,
          teamName: 'United_Środa_Śląska',
          matchesPlayed: 3,
          points: 9,
          wins: 3,
          setsWon: 9,
          setsLost: 1,
          pointsWon: 250,
          pointsLost: 180,
          setsRatio: 9.0,
          pointRatio: 1.39,
          form: ['W', 'W', 'P'],
        },
      ]);

      fixture.detectChanges();

      const table = fixture.nativeElement.querySelector('.sports-table');
      expect(table).toBeTruthy();

      const formHeader = table.querySelector('thead th.th-form');
      expect(formHeader?.textContent?.trim()).toBe('FORMA');

      const formBadges = table.querySelectorAll('tbody td.td-form .form-badge');
      expect(formBadges.length).toBe(3);
      expect(formBadges[0].textContent?.trim()).toBe('W');
      expect(formBadges[0].classList.contains('form-win')).toBeTrue();
      expect(formBadges[0].classList.contains('is-latest')).toBeTrue();
      expect(formBadges[0].getAttribute('title')).toBe('Ostatni mecz: Wygrana');
      expect(formBadges[1].textContent?.trim()).toBe('W');
      expect(formBadges[1].classList.contains('is-latest')).toBeFalse();
      expect(formBadges[1].getAttribute('title')).toBe('Wygrana');
      expect(formBadges[2].textContent?.trim()).toBe('P');
      expect(formBadges[2].classList.contains('form-loss')).toBeTrue();
      expect(formBadges[2].classList.contains('is-latest')).toBeFalse();
    });

    it('should mark the newest match badge with is-latest in pre-match card', () => {
      const fixture = TestBed.createComponent(App);
      const api = TestBed.inject(LeagueApiService);

      api.standings.set([
        {
          rank: 1,
          teamName: 'United_Środa_Śląska',
          matchesPlayed: 3,
          points: 9,
          wins: 3,
          setsWon: 9,
          setsLost: 1,
          pointsWon: 250,
          pointsLost: 180,
          setsRatio: 9.0,
          pointRatio: 1.39,
          form: ['W', 'P'],
        },
        {
          rank: 2,
          teamName: 'Rywal_Wrocław',
          matchesPlayed: 3,
          points: 6,
          wins: 2,
          setsWon: 6,
          setsLost: 4,
          pointsWon: 230,
          pointsLost: 210,
          setsRatio: 1.5,
          pointRatio: 1.1,
          form: ['P', 'W', 'W'],
        },
      ]);

      api.fixtures.set([
        {
          matchId: '100',
          date: '2026-11-20',
          homeTeamName: 'United_Środa_Śląska',
          awayTeamName: 'Rywal_Wrocław',
          score: '-:-',
          isFinished: false,
        },
      ]);

      fixture.detectChanges();

      const hostBadges = fixture.nativeElement.querySelectorAll('.form-badges-inline.host-form .form-badge-mini');
      expect(hostBadges.length).toBe(2);
      expect(hostBadges[0].classList.contains('is-latest')).toBeTrue();
      expect(hostBadges[0].getAttribute('title')).toBe('Ostatni mecz: Wygrana');
      expect(hostBadges[1].classList.contains('is-latest')).toBeFalse();

      const awayBadges = fixture.nativeElement.querySelectorAll('.form-badges-inline.away-form .form-badge-mini');
      expect(awayBadges.length).toBe(3);
      expect(awayBadges[0].classList.contains('is-latest')).toBeTrue();
      expect(awayBadges[0].getAttribute('title')).toBe('Ostatni mecz: Porażka');
      expect(awayBadges[1].classList.contains('is-latest')).toBeFalse();
    });

    it('should calculate set-by-set details with max 25pts bar proportion', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      const matchWithSets: MatchItem = {
        matchId: '10',
        date: '2026-10-15',
        homeTeamName: 'United_Środa_Śląska',
        awayTeamName: 'Rywal_Wrocław',
        score: '3:2',
        finalScore: '3:2',
        isFinished: true,
        sets: ['25:20', '23:25', '25:15', '25:27', '15:10'],
      };

      const sets = app['getMatchSetDetails'](matchWithSets);
      expect(sets.length).toBe(5);

      // Set 1: 25:20 -> host won by 5 pts -> (5 / 25) * 100 = 20%
      expect(sets[0].setNumber).toBe(1);
      expect(sets[0].hostScore).toBe(25);
      expect(sets[0].awayScore).toBe(20);
      expect(sets[0].difference).toBe(5);
      expect(sets[0].winner).toBe('host');
      expect(sets[0].hostPercent).toBe(20);
      expect(sets[0].awayPercent).toBe(0);

      // Set 2: 23:25 -> away won by 2 pts -> (2 / 25) * 100 = 8%
      expect(sets[1].setNumber).toBe(2);
      expect(sets[1].hostScore).toBe(23);
      expect(sets[1].awayScore).toBe(25);
      expect(sets[1].difference).toBe(2);
      expect(sets[1].winner).toBe('away');
      expect(sets[1].hostPercent).toBe(0);
      expect(sets[1].awayPercent).toBe(8);

      // Set 3: 25:15 -> host won by 10 pts -> (10 / 25) * 100 = 40%
      expect(sets[2].difference).toBe(10);
      expect(sets[2].winner).toBe('host');
      expect(sets[2].hostPercent).toBe(40);
      expect(sets[2].awayPercent).toBe(0);

      expect(sets[0].unitedWon).toBeTrue();
      expect(sets[1].unitedWon).toBeFalse();

      // Set 5 (tie-break): 15:10 -> host won by 5 pts -> 20%
      expect(sets[4].setNumber).toBe(5);
      expect(sets[4].difference).toBe(5);
      expect(sets[4].unitedWon).toBeTrue();
      expect(sets[4].hostPercent).toBe(20);
    });

    it('should return empty array and show fallback message when sets data is not provided or empty', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      const matchWithoutSets: MatchItem = {
        matchId: '99',
        date: '2026-10-01',
        homeTeamName: 'United_Środa_Śląska',
        awayTeamName: 'Rywal_Wrocław',
        score: '3:0',
        finalScore: '3:0',
        isFinished: true,
      };

      const emptySets = app['getMatchSetDetails'](matchWithoutSets);
      expect(emptySets).toEqual([]);

      api.results.set([matchWithoutSets]);
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.result-card');
      expect(card).toBeTruthy();

      // Expand card
      card.click();
      fixture.detectChanges();

      const emptyNotice = fixture.nativeElement.querySelector('.sets-empty');
      expect(emptyNotice).toBeTruthy();
      expect(emptyNotice.textContent.trim()).toBe('Brak informacji na temat statystyk meczowych');
    });

    it('should map sets and format score when points are provided in score field', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      const matchWithSetsInScore: MatchItem = {
        matchId: '26',
        date: '2026-11-22',
        homeTeamName: 'United_Środa_Śląska',
        awayTeamName: 'JKS_SPARTAKUS_Jawor',
        score: "['25:21', '25:16', '19:25', '14:25', '15:8']",
        finalScore: '3:2',
        isFinished: true,
        sets: [],
      };

      const setDetails = app['getMatchSetDetails'](matchWithSetsInScore);
      expect(setDetails.length).toBe(5);
      expect(setDetails[0].hostScore).toBe(25);
      expect(setDetails[0].awayScore).toBe(21);
      expect(setDetails[0].unitedWon).toBeTrue();
      expect(setDetails[2].hostScore).toBe(19);
      expect(setDetails[2].awayScore).toBe(25);
      expect(setDetails[2].unitedWon).toBeFalse();

      expect(app['cleanMatchScore'](matchWithSetsInScore)).toBe('3:2');
      expect(app['matchScoreDisplay'](matchWithSetsInScore)).toBe('3 : 2');
      expect(app['isUnitedWin'](matchWithSetsInScore)).toBeTrue();
    });

    it('should expand and collapse result card on click showing set statistics with colored bars and labels', () => {
      const fixture = TestBed.createComponent(App);
      const api = TestBed.inject(LeagueApiService);

      api.results.set([
        {
          matchId: '55',
          date: '2026-10-17',
          homeTeamName: 'United_Środa_Śląska',
          awayTeamName: 'Wataha_Lubin',
          score: '1:3',
          finalScore: '1:3',
          isFinished: true,
          sets: ['20:25', '25:22', '19:25', '21:25'],
        },
      ]);

      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.result-card');
      expect(card).toBeTruthy();
      expect(card.classList.contains('is-expanded')).toBeFalse();
      expect(fixture.nativeElement.querySelector('.result-sets-details')).toBeFalsy();

      // Click to expand
      card.click();
      fixture.detectChanges();

      expect(card.classList.contains('is-expanded')).toBeTrue();
      const details = fixture.nativeElement.querySelector('.result-sets-details');
      expect(details).toBeTruthy();

      // Check header title label
      const badgeTitle = details.querySelector('.sets-badge-title');
      expect(badgeTitle?.textContent?.trim()).toBe('STATYSTYKI MECZOWE');

      const setRows = details.querySelectorAll('.set-row');
      expect(setRows.length).toBe(4);

      // Check Set 1 (20:25 -> away won by 5 -> awayPercent 20%, United lost -> fill-red)
      const set1Values = setRows[0].querySelector('.set-values-line');
      const set1HostNum = set1Values?.querySelector('.host-num');
      const set1AwayNum = set1Values?.querySelector('.away-num');
      const set1CenterLabel = set1Values?.querySelector('.set-center-label');

      expect(set1HostNum?.textContent?.trim()).toBe('20');
      expect(set1HostNum?.classList.contains('score-lower')).toBeTrue();
      expect(set1AwayNum?.textContent?.trim()).toBe('25');
      expect(set1AwayNum?.classList.contains('score-higher')).toBeTrue();
      expect(set1CenterLabel?.textContent?.trim()).toBe('Set 1');

      const set1AwayFill = setRows[0].querySelector('.bar-half.away-half .bar-fill');
      expect(set1AwayFill.style.width).toBe('20%');
      expect(set1AwayFill.classList.contains('fill-red')).toBeTrue();

      // Check Set 2 (25:22 -> host won by 3 -> hostPercent 12%, United won -> fill-green)
      const set2Values = setRows[1].querySelector('.set-values-line');
      const set2HostNum = set2Values?.querySelector('.host-num');
      const set2AwayNum = set2Values?.querySelector('.away-num');
      const set2CenterLabel = set2Values?.querySelector('.set-center-label');

      expect(set2HostNum?.textContent?.trim()).toBe('25');
      expect(set2HostNum?.classList.contains('score-higher')).toBeTrue();
      expect(set2AwayNum?.textContent?.trim()).toBe('22');
      expect(set2AwayNum?.classList.contains('score-lower')).toBeTrue();
      expect(set2CenterLabel?.textContent?.trim()).toBe('Set 2');

      const set2HostFill = setRows[1].querySelector('.bar-half.host-half .bar-fill');
      expect(set2HostFill.style.width).toBe('12%');
      expect(set2HostFill.classList.contains('fill-green')).toBeTrue();

      // Click to collapse
      card.click();
      fixture.detectChanges();

      expect(card.classList.contains('is-expanded')).toBeFalse();
      expect(fixture.nativeElement.querySelector('.result-sets-details')).toBeFalsy();
    });
  });

  describe('Skład drużyny - Team roster', () => {
    it('should map position labels and badge classes correctly', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app['positionLabel']('SETTER')).toBe('Rozgrywający');
      expect(app['positionLabel']('OUTSIDE')).toBe('Przyjmujący');
      expect(app['positionLabel']('OPPOSITE')).toBe('Atakujący');
      expect(app['positionLabel']('MIDDLE')).toBe('Środkowy');
      expect(app['positionLabel']('LIBERO')).toBe('Libero');
      expect(app['positionLabel']('COACH')).toBe('Trener');

      expect(app['positionBadgeClass']('SETTER')).toBe('badge-setter');
      expect(app['positionBadgeClass']('OUTSIDE')).toBe('badge-outside');
      expect(app['positionBadgeClass']('OPPOSITE')).toBe('badge-opposite');
      expect(app['positionBadgeClass']('MIDDLE')).toBe('badge-middle');
      expect(app['positionBadgeClass']('LIBERO')).toBe('badge-libero');
      expect(app['positionBadgeClass']('COACH')).toBe('badge-coach');
    });

    it('should filter visible roster by position', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      const fakeRoster = [
        {
          id: 'p1',
          firstName: 'Jan',
          lastName: 'Kowalski',
          position: 'SETTER' as const,
          number: 7,
          height: 192,
          attackRange: 330,
          age: 24,
          isCaptain: true,
        },
        {
          id: 'p2',
          firstName: 'Piotr',
          lastName: 'Nowak',
          position: 'OUTSIDE' as const,
          number: 10,
          height: 198,
          attackRange: 345,
          age: 22,
          isCaptain: false,
        },
        {
          id: 'p3',
          firstName: 'Marek',
          lastName: 'Zieliński',
          position: 'COACH' as const,
          number: 0,
          height: 185,
          age: 45,
          isCaptain: false,
        },
      ];

      api.roster.set(fakeRoster);
      expect(app['visibleRoster']().length).toBe(3);

      // Filter SETTER
      app['setRosterFilter']('SETTER');
      expect(app['visibleRoster']().length).toBe(1);
      expect(app['visibleRoster']()[0].lastName).toBe('Kowalski');

      // Filter COACH
      app['setRosterFilter']('COACH');
      expect(app['visibleRoster']().length).toBe(1);
      expect(app['visibleRoster']()[0].lastName).toBe('Zieliński');

      // Filter ALL
      app['setRosterFilter']('all');
      expect(app['visibleRoster']().length).toBe(3);
    });

    it('should sort roster cards ascending by player numbers with coach always at the end', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      api.roster.set([
        {
          id: 'c1',
          firstName: 'Jan',
          lastName: 'Trener',
          position: 'COACH',
          number: 0,
        },
        {
          id: 'p14',
          firstName: 'Adam',
          lastName: 'Czternasty',
          position: 'MIDDLE',
          number: 14,
        },
        {
          id: 'p2',
          firstName: 'Piotr',
          lastName: 'Drugi',
          position: 'OUTSIDE',
          number: 2,
        },
        {
          id: 'p8',
          firstName: 'Kamil',
          lastName: 'Ósmy',
          position: 'SETTER',
          number: 8,
        },
      ]);

      const sorted = app['visibleRoster']();
      expect(sorted.length).toBe(4);
      expect(sorted[0].number).toBe(2);
      expect(sorted[0].lastName).toBe('Drugi');
      expect(sorted[1].number).toBe(8);
      expect(sorted[1].lastName).toBe('Ósmy');
      expect(sorted[2].number).toBe(14);
      expect(sorted[2].lastName).toBe('Czternasty');
      expect(sorted[3].position).toBe('COACH');
      expect(sorted[3].lastName).toBe('Trener');
    });

    it('should render roster cards with details in DOM and respond to filter buttons', () => {
      const fixture = TestBed.createComponent(App);
      const api = TestBed.inject(LeagueApiService);

      api.roster.set([
        {
          id: 'p1',
          firstName: 'Michał',
          lastName: 'Wiśniewski',
          position: 'SETTER',
          number: 5,
          height: 190,
          attackRange: 330,
          age: 26,
          isCaptain: true,
        },
        {
          id: 'p2',
          firstName: 'Tomasz',
          lastName: 'Kowalczyk',
          position: 'MIDDLE',
          number: 12,
          height: 202,
          attackRange: 350,
          age: 23,
          isCaptain: false,
        },
        {
          id: 'p3',
          firstName: 'Marek',
          lastName: 'Kamiński',
          position: 'COACH',
          number: 0,
          height: 188,
          age: 48,
          isCaptain: false,
        },
      ]);

      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('#sklad');
      expect(section).toBeTruthy();

      const cards = section.querySelectorAll('.player-card');
      expect(cards.length).toBe(3);

      // Card 1: Captain, Setter
      expect(cards[0].querySelector('.captain-circle')?.textContent?.trim()).toBe('K');
      expect(cards[0].querySelector('.player-watermark')?.textContent?.trim()).toBe('05');
      expect(cards[0].querySelector('.position-badge')?.textContent?.trim()).toBe('Rozgrywający');
      expect(cards[0].querySelector('.player-first-name')?.textContent?.trim()).toBe('Michał');
      expect(cards[0].querySelector('.player-last-name')?.textContent?.trim()).toBe('Wiśniewski');
      expect(cards[0].querySelector('.player-card-number')?.textContent?.trim()).toBe('#5');

      // Card 2: Player number #12
      expect(cards[1].querySelector('.player-card-number')?.textContent?.trim()).toBe('#12');

      // Card 3: Coach has statistics hidden, TR watermark in gold, and no player-card-number
      expect(cards[2].querySelector('.position-badge')?.textContent?.trim()).toBe('Trener');
      expect(cards[2].querySelector('.player-stats-grid')).toBeNull();
      expect(cards[2].querySelector('.player-watermark')?.textContent?.trim()).toBe('TR');
      expect(cards[2].querySelector('.player-card-number')).toBeNull();

      // Stats values for Card 1
      const statValues = cards[0].querySelectorAll('.stat-col-value');
      expect(statValues[0]?.textContent?.trim()).toBe('190 cm');
      expect(statValues[1]?.textContent?.trim()).toBe('330 cm');
      expect(statValues[2]?.textContent?.trim()).toBe('26 l.');

      // Click MIDDLE filter button in DOM
      const filterButtons = section.querySelectorAll('.filter-pill');
      const middleButton = Array.from(filterButtons).find(
        (b: any) => b.textContent?.trim().includes('Środkow')
      ) as HTMLButtonElement;
      expect(middleButton).toBeTruthy();

      middleButton.click();
      fixture.detectChanges();

      const filteredCards = section.querySelectorAll('.player-card');
      expect(filteredCards.length).toBe(1);
      expect(filteredCards[0].querySelector('.player-last-name')?.textContent?.trim()).toBe('Kowalczyk');
    });

    it('should compute player photo URL correctly', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app['playerPhotoUrl']('bartosz-korta')).toBe('https://d1rm5h55nlqrob.cloudfront.net/roster/bartosz-korta.png');
      expect(app['playerPhotoUrl']('adam-kowalski')).toBe('https://d1rm5h55nlqrob.cloudfront.net/roster/adam-kowalski.png');
      expect(app['playerPhotoUrl']('')).toBe('');
    });

    it('should fallback to silhouette SVG when photo fails to load', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const api = TestBed.inject(LeagueApiService);

      api.roster.set([
        {
          id: 'bartosz-korta',
          firstName: 'Bartosz',
          lastName: 'Korta',
          position: 'OUTSIDE',
          number: 1,
          height: 190,
          attackRange: 335,
          age: 27,
          isCaptain: true,
        },
      ]);

      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('#sklad .player-card');
      expect(card).toBeTruthy();

      // Initially renders img.player-photo
      const img = card.querySelector('img.player-photo') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('https://d1rm5h55nlqrob.cloudfront.net/roster/bartosz-korta.png');
      expect(card.querySelector('.player-silhouette')).toBeNull();

      // Simulate img load error
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      // Now fallback silhouette is rendered, img is gone
      expect(card.querySelector('img.player-photo')).toBeNull();
      const silhouette = card.querySelector('.player-silhouette');
      expect(silhouette).toBeTruthy();
      const svg = silhouette?.querySelector('svg.player-svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 200 240');
    });

    it('should show empty state message when roster is empty', () => {
      const fixture = TestBed.createComponent(App);
      const api = TestBed.inject(LeagueApiService);
      api.loading.set(false);
      api.roster.set([]);

      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('#sklad .roster-empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('Skład drużyny na ten sezon zostanie wkrótce opublikowany');
    });
  });
});

