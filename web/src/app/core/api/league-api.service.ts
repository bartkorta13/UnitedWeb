import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MatchItem, PlayerItem, TeamStanding } from './league.models';

export const UNITED_TEAM_NAME = environment.unitedTeamName;

@Injectable({ providedIn: 'root' })
export class LeagueApiService {
  private readonly http = inject(HttpClient);

  readonly fixtures = signal<MatchItem[]>([]);
  readonly results = signal<MatchItem[]>([]);
  readonly allResults = signal<MatchItem[]>([]);
  readonly standings = signal<TeamStanding[]>([]);
  readonly roster = signal<PlayerItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(false);

    const apiUrl = environment.apiUrl.replace(/\/+$/, '');
    const encodedTeam = encodeURIComponent(UNITED_TEAM_NAME);

    forkJoin({
      fixtures: this.http.get<MatchItem[]>(`${apiUrl}/fixtures/${encodedTeam}`).pipe(
        catchError((err) => {
          console.error('Error fetching fixtures:', err);
          return of<MatchItem[]>([]);
        })
      ),
      results: this.http.get<MatchItem[]>(`${apiUrl}/results/${encodedTeam}`).pipe(
        catchError((err) => {
          console.error('Error fetching results:', err);
          return of<MatchItem[]>([]);
        })
      ),
      allResults: this.http.get<MatchItem[]>(`${apiUrl}/results`).pipe(
        catchError((err) => {
          console.error('Error fetching all results:', err);
          return of<MatchItem[]>([]);
        })
      ),
      standings: this.http.get<TeamStanding[]>(`${apiUrl}/standings`).pipe(
        catchError((err) => {
          console.error('Error fetching standings:', err);
          return of<TeamStanding[]>([]);
        })
      ),
      roster: this.http.get<PlayerItem[]>(`${apiUrl}/roster`).pipe(
        catchError((err) => {
          console.error('Error fetching roster:', err);
          return of<PlayerItem[]>([]);
        })
      ),
    }).subscribe({
      next: ({ fixtures, results, allResults, standings, roster }) => {
        this.fixtures.set(this.sortFixturesChronological(fixtures));
        this.results.set(this.sortResultsChronological(results));
        this.allResults.set(this.sortResultsChronological(allResults));
        this.standings.set(this.filterAndSortStandings(standings));
        this.roster.set(roster);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('API loading error:', err);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private sortFixturesChronological(matches: MatchItem[]): MatchItem[] {
    return [...matches].sort((first, second) => {
      const time1 = this.parseDate(first.date);
      const time2 = this.parseDate(second.date);
      return time1 - time2; // Upcoming matches ascending (earliest first)
    });
  }

  private sortResultsChronological(matches: MatchItem[]): MatchItem[] {
    return [...matches].sort((first, second) => {
      const time1 = this.parseDate(first.date);
      const time2 = this.parseDate(second.date);
      return time2 - time1; // Finished matches descending (most recent first)
    });
  }

  private filterAndSortStandings(standings: TeamStanding[]): TeamStanding[] {
    return standings
      .filter((item) => item.rank > 0 && item.teamName.toLowerCase() !== 'zespół')
      .sort((a, b) => a.rank - b.rank);
  }

  private parseDate(dateStr: string): number {
    if (!dateStr) return 0;
    const iso = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
    const parsed = new Date(iso).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

