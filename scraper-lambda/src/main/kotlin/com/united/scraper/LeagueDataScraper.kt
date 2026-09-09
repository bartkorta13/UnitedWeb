package com.united.scraper

import com.united.model.LeagueData
import com.united.model.MatchItem
import com.united.model.TeamStanding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.slf4j.LoggerFactory

data class MatchDetail(
    val place: String? = null,
    val hour: String? = null,
    val finalScore: String = "",
    val sets: List<String> = emptyList(),
    val isFinished: Boolean = false
) {
    val score: String get() = finalScore
}

data class ParsedScore(
    val finalScore: String,
    val sets: List<String>,
    val isFinished: Boolean
) {
    val score: String get() = finalScore
}

class LeagueDataScraper(
    private val standingsUrl: String = "https://system.dzps.pl/index.php?mode=12&type=9",
    private val matchesUrl: String = "https://system.dzps.pl/index.php?mode=4&type=9",
    private val baseUrl: String = "https://system.dzps.pl"
) {
    private val logger = LoggerFactory.getLogger(LeagueDataScraper::class.java)

    /**
     * Executes both requests and combines them into one unified domain model.
     */
    suspend fun scrape(): LeagueData {
        val standings = scrapeStandings()
        val matches = scrapeMatches()
        return LeagueData(standings = standings, matches = matches)
    }

    /**
     * Fetches and parses only the standings table from mode=12.
     */
    fun scrapeStandings(): List<TeamStanding> {
        val doc = fetchDocument(standingsUrl)
        return parseStandings(doc)
    }

    internal fun parseStandings(doc: Document): List<TeamStanding> {
        val standings = mutableListOf<TeamStanding>()

        val table = doc.select("table").firstOrNull { it.text().contains("Zespół") } ?: return emptyList()
        val rows = table.select("tr").filter { it.select("th").isEmpty() }

        for (row in rows) {
            val cols = row.select("td").map { it.text().trim() }

            if (cols.size >= 9) {
                // Must have a valid numeric rank (e.g. 1, 2, 3...) - skips header row like "Lp."
                val rank = cols[0].replace(".", "").trim().toIntOrNull() ?: continue
                if (rank <= 0) continue

                val teamName = sanitizeTeamName(cols[1])
                // Skip header row if team column contains "Zespół" or is blank
                if (teamName.isBlank() || teamName.equals("Zespół", ignoreCase = true) || teamName.equals("Zespol", ignoreCase = true)) {
                    continue
                }

                standings.add(
                    TeamStanding(
                        rank = rank,
                        teamName = teamName,
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
     * Fetches and parses fixtures & results from mode=4,
     * including detailed info (set scores, hour, place) from match detail links.
     */
    suspend fun scrapeMatches(): List<MatchItem> {
        val doc = fetchDocument(matchesUrl)

        // Target match rows having the date format YYYY-MM-DD
        val matchRows = doc.select("tr").filter { row ->
            row.text().matches(Regex(".*\\d{4}-\\d{2}-\\d{2}.*"))
        }

        data class PendingMatch(
            val matchId: String,
            val rawDate: String,
            val rawTime: String,
            val home: String,
            val away: String,
            val rawListScore: String,
            val detailUrl: String?
        )

        val pendingList = mutableListOf<PendingMatch>()

        for (row in matchRows) {
            val cols = row.select("td")
            if (cols.size < 6) continue

            val colTexts = cols.map { it.text().trim() }
            val matchNumberStr = Regex("-(\\d+)$").find(colTexts[0])?.groupValues?.get(1) ?: ""

            // Omit rows with "0" (which represent "pauzuje" / bye weeks)
            if (matchNumberStr == "0") {
                continue
            }

            val home = sanitizeTeamName(colTexts[3])
            val away = sanitizeTeamName(colTexts[5])

            // Extra safety check just in case
            if (home.contains("pauzuje", ignoreCase = true) || away.contains("pauzuje", ignoreCase = true)) {
                continue
            }

            val date = colTexts[1]
            val time = colTexts[2]
            val rawScore = colTexts[4].replace("\"", "").trim()
            val matchId = if (matchNumberStr.isNotBlank()) matchNumberStr else "UNKNOWN_${date}_${home}"

            val href = cols[0].select("a").attr("href").trim()
            val detailUrl = when {
                href.isBlank() -> null
                href.startsWith("http://") || href.startsWith("https://") -> href
                href.startsWith("/") -> "$baseUrl$href"
                else -> "$baseUrl/$href"
            }

            pendingList.add(
                PendingMatch(
                    matchId = matchId,
                    rawDate = date,
                    rawTime = time,
                    home = home,
                    away = away,
                    rawListScore = rawScore,
                    detailUrl = detailUrl
                )
            )
        }

        val semaphore = Semaphore(10)
        return coroutineScope {
            pendingList.map { pending ->
                async(Dispatchers.IO) {
                    val detail = if (pending.detailUrl != null) {
                        try {
                            semaphore.withPermit {
                                val detailDoc = fetchDocument(pending.detailUrl)
                                parseMatchDetail(detailDoc)
                            }
                        } catch (e: Exception) {
                            logger.warn("Could not fetch detail from ${pending.detailUrl}: ${e.message}")
                            null
                        }
                    } else {
                        null
                    }

                    val finalTime = when {
                        pending.rawTime.isNotBlank() -> pending.rawTime
                        detail?.hour != null && detail.hour.matches(Regex("""\d{1,2}:\d{2}""")) -> detail.hour
                        else -> null
                    }
                    val fullDateTime = if (finalTime != null) "${pending.rawDate} $finalTime" else pending.rawDate

                    val listFinished = pending.rawListScore.matches(Regex("""\d+\s*:\s*\d+""")) &&
                            pending.rawListScore.replace(" ", "") != "0:0"

                    val isFinished = detail?.isFinished == true || listFinished
                    val finalScore = when {
                        detail?.isFinished == true -> detail.finalScore
                        listFinished -> pending.rawListScore.replace(" ", "")
                        else -> ""
                    }
                    val sets = if (detail?.isFinished == true) detail.sets else emptyList()

                    MatchItem(
                        matchId = pending.matchId,
                        date = fullDateTime,
                        homeTeamName = pending.home,
                        awayTeamName = pending.away,
                        score = finalScore,
                        finalScore = finalScore,
                        isFinished = isFinished,
                        place = detail?.place,
                        hour = detail?.hour ?: pending.rawTime.takeIf { it.isNotBlank() },
                        sets = sets
                    )
                }
            }.awaitAll()
        }
    }

    internal fun parseMatchDetail(doc: Document): MatchDetail {
        var place: String? = null
        var hour: String? = null
        var rawWynik: String? = null

        for (row in doc.select(".row, tr")) {
            val h5s = row.select("h5").map { it.text().replace("\u00A0", " ").trim() }.filter { it.isNotBlank() }
            if (h5s.isNotEmpty()) {
                val placeIdx = h5s.indexOfFirst { it.contains("Mecz rozgrywany w", ignoreCase = true) }
                if (placeIdx != -1) {
                    if (placeIdx + 1 < h5s.size) {
                        place = h5s[placeIdx + 1]
                    } else {
                        val after = row.text().replace("\u00A0", " ").substringAfter("Mecz rozgrywany w").removePrefix(":").trim()
                        if (after.isNotBlank()) place = after
                    }
                }

                val hourIdx = h5s.indexOfFirst { it.contains("godzina meczu", ignoreCase = true) }
                if (hourIdx != -1) {
                    if (hourIdx + 1 < h5s.size) {
                        hour = h5s[hourIdx + 1]
                    } else {
                        val after = row.text().replace("\u00A0", " ").substringAfter("godzina meczu").removePrefix(":").trim()
                        if (after.isNotBlank()) hour = after
                    }
                }

                val wynikIdx = h5s.indexOfFirst { it.startsWith("wynik", ignoreCase = true) }
                if (wynikIdx != -1) {
                    if (wynikIdx + 1 < h5s.size) {
                        rawWynik = h5s[wynikIdx + 1]
                    } else {
                        val after = row.text().replace("\u00A0", " ").substringAfter("wynik:").trim()
                        if (after.isNotBlank()) rawWynik = after
                    }
                }
            }
        }

        // Fallbacks if not found inside .row h5s
        if (place == null) {
            val el = doc.getElementsContainingOwnText("Mecz rozgrywany w").firstOrNull()
            if (el != null) {
                val text = el.parent()?.text()?.replace("\u00A0", " ") ?: el.text().replace("\u00A0", " ")
                val after = text.substringAfter("Mecz rozgrywany w").removePrefix(":").trim()
                if (after.isNotBlank()) place = after
            }
        }

        if (hour == null) {
            val el = doc.getElementsContainingOwnText("godzina meczu").firstOrNull()
            if (el != null) {
                val text = el.parent()?.text()?.replace("\u00A0", " ") ?: el.text().replace("\u00A0", " ")
                val after = text.substringAfter("godzina meczu").removePrefix(":").trim()
                if (after.isNotBlank()) hour = after
            }
        }

        if (rawWynik == null) {
            val el = doc.getElementsContainingOwnText("wynik:").firstOrNull()
            if (el != null) {
                val text = el.parent()?.text()?.replace("\u00A0", " ") ?: el.text().replace("\u00A0", " ")
                val after = text.substringAfter("wynik:").trim()
                if (after.isNotBlank()) rawWynik = after
            }
        }

        val parsedScore = parseWynik(rawWynik)

        return MatchDetail(
            place = place,
            hour = hour,
            finalScore = parsedScore.finalScore,
            sets = parsedScore.sets,
            isFinished = parsedScore.isFinished
        )
    }

    internal fun parseWynik(rawWynik: String?): ParsedScore {
        if (rawWynik.isNullOrBlank()) {
            return ParsedScore(finalScore = "", sets = emptyList(), isFinished = false)
        }

        val cleaned = rawWynik
            .replace("\u00A0", " ")
            .replace("\"", "")
            .replace(Regex("\\s+"), " ")
            .trim()

        // Pattern matches: setsScore like "3:2" or "3 : 2", and optional set details in parentheses "(...)"
        val regex = Regex("""^(\d+\s*:\s*\d+)(?:\s*\(([^)]+)\))?""")
        val match = regex.find(cleaned) ?: return ParsedScore(finalScore = "", sets = emptyList(), isFinished = false)

        val mainScore = match.groupValues[1].replace(" ", "")
        // 0:0 in volleyball indicates unplayed/scheduled, not a finished match
        if (mainScore == "0:0") {
            return ParsedScore(finalScore = "", sets = emptyList(), isFinished = false)
        }

        val setsRaw = match.groupValues.getOrNull(2)?.trim()
        val sets = if (!setsRaw.isNullOrBlank()) {
            setsRaw.split(",")
                .map { it.trim().replace(" ", "") }
                .filter { it.isNotBlank() }
        } else {
            emptyList()
        }

        return ParsedScore(
            finalScore = mainScore,
            sets = sets,
            isFinished = true
        )
    }

    internal fun fetchDocument(url: String): Document {
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