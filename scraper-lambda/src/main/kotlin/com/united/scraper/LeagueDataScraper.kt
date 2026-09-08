package com.united.scraper

import com.united.model.LeagueData
import com.united.model.MatchItem
import com.united.model.TeamStanding
import org.jsoup.Jsoup
import org.jsoup.nodes.Document

class LeagueScraper(
    private val standingsUrl: String = "https://system.dzps.pl/index.php?mode=12&type=9",
    private val matchesUrl: String = "https://system.dzps.pl/index.php?mode=4&type=9"
) {

    /**
     * Executes both requests and combines them into one unified domain model.
     */
    fun scrape(): LeagueData {
        val standings = scrapeStandings()
        val matches = scrapeMatches()
        return LeagueData(standings = standings, matches = matches)
    }

    /**
     * Fetches and parses only the standings table from mode=12.
     */
    fun scrapeStandings(): List<TeamStanding> {
        val doc = fetchDocument(standingsUrl)
        val standings = mutableListOf<TeamStanding>()

        val table = doc.select("table").firstOrNull { it.text().contains("Zespół") } ?: return emptyList()
        val rows = table.select("tr").filter { it.select("th").isEmpty() }

        for (row in rows) {
            val cols = row.select("td").map { it.text().trim() }

            if (cols.size >= 9) {
                standings.add(
                    TeamStanding(
                        rank = cols[0].replace(".", "").toIntOrNull() ?: 0,
                        teamName = sanitizeTeamName(cols[1]),
                        matchesPlayed = cols[2].toIntOrNull() ?: 0,
                        points = cols[3].toIntOrNull() ?: 0,
                        wins = cols[4].toIntOrNull() ?: 0,
                        setsWon = cols[5].toIntOrNull() ?: 0,
                        setsLost = cols[6].toIntOrNull() ?: 0,
                        pointsWon = cols[7].toIntOrNull() ?: 0,
                        pointsLost = cols[8].toIntOrNull() ?: 0
                    )
                )
            }
        }
        return standings
    }

    /**
     * Fetches and parses only the fixtures & results from mode=4.
     */
    fun scrapeMatches(): List<MatchItem> {
        val doc = fetchDocument(matchesUrl)
        val matches = mutableListOf<MatchItem>()

        // Target match rows having the date format YYYY-MM-DD
        val matchRows = doc.select("tr").filter { row ->
            row.text().matches(Regex(".*\\d{4}-\\d{2}-\\d{2}.*"))
        }

        for (row in matchRows) {
            val cols = row.select("td").map { it.text().trim() }

            if (cols.size >= 6) {
                // Extract the match number from the end of the text (e.g., "Dolnośląska II Liga-1" -> "1")
                val matchNumberStr = Regex("-(\\d+)$").find(cols[0])?.groupValues?.get(1) ?: ""

                // Omit rows with "0" (which represent "pauzuje" / bye weeks)
                if (matchNumberStr == "0") {
                    continue
                }

                val home = sanitizeTeamName(cols[3])
                val away = sanitizeTeamName(cols[5])

                // Extra safety check just in case
                if (home.contains("pauzuje", ignoreCase = true) || away.contains("pauzuje", ignoreCase = true)) {
                    continue
                }

                val date = cols[1]
                val time = cols[2]
                val rawScore = cols[4].replace("\"", "").trim()

                // Fallback ID if the regex somehow misses
                val matchId = if (matchNumberStr.isNotBlank()) matchNumberStr else "UNKNOWN_${cols[1]}_${home}"

                // Check if final score is registered (e.g., "3:1") vs "-"
                val isFinished = rawScore.matches(Regex("\\d+\\s*:\\s*\\d+"))
                val score = if (isFinished) rawScore.replace(" ", "") else ""

                val fullDateTime = if (time.isNotBlank()) "$date $time" else date

                matches.add(
                    MatchItem(
                        matchId = matchId,
                        date = fullDateTime,
                        homeTeamName = home,
                        awayTeamName = away,
                        score = score,
                        isFinished = isFinished
                    )
                )
            }
        }
        return matches
    }

    private fun fetchDocument(url: String): Document {
        return Jsoup.connect(url)
            .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .timeout(10_000)
            .get()
    }

    /**
     * Removes quote marks (`"`), trims leading/trailing whitespace,
     * and turns any internal whitespace blocks into a single underscore (`_`).
     */
    private fun sanitizeTeamName(rawName: String): String {
        return rawName
            .replace("\"", "")
            .replace("\u00A0", " ")
            .trim()
            .replace(Regex("\\s+"), "_")
    }
}