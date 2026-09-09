package com.united.scraper

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

class LeagueDataScraperTest {

    @Test
    fun `test scraper fetches and parses data successfully`() = runBlocking {
        val scraper = LeagueDataScraper()

        // Run the scraper against the live target website
        val data = scraper.scrape()

        // Verify the data container isn't null
        assertNotNull(data, "The scraped data object should not be null")

        // Verify lists were initialized and populated
        assertNotNull(data.standings, "Standings list should not be null")
        assertNotNull(data.matches, "Matches list should not be null")

        // Print results to the test console for quick visual verification
        println("--- SCRAPER TEST RESULTS ---")
        println("Teams parsed: ${data.standings.size}")
        println("Matches parsed: ${data.matches.size}")

        // Optional: Assert that we actually found some content
        assertFalse(data.standings.isEmpty(), "Standings should contain at least one team")
        assertFalse(data.standings.any { it.teamName.equals("Zespół", ignoreCase = true) }, "Standings must not contain 'Zespół' header row")

        // Verify matches have place/hour/score information extracted
        val matchWithPlace = data.matches.firstOrNull { !it.place.isNullOrBlank() }
        println("Sample match with place: ${matchWithPlace?.matchId} at place='${matchWithPlace?.place}', hour='${matchWithPlace?.hour}'")
    }

    @Test
    fun `test parseStandings ignores header row and parses only valid teams`() {
        val html = """
            <table>
                <tr>
                    <td>Lp.</td><td>Zespół</td><td>Mecze</td><td>Pkt</td><td>Zw.</td><td>Sety +</td><td>Sety -</td><td>pkt +</td><td>pkt -</td>
                </tr>
                <tr>
                    <td>1.</td><td>Volley Club United Wrocław</td><td>14</td><td>35</td><td>12</td><td>38</td><td>12</td><td>1150</td><td>900</td>
                </tr>
                <tr>
                    <td>2.</td><td>KPS Chełmiec Wałbrzych</td><td>14</td><td>30</td><td>10</td><td>32</td><td>18</td><td>1100</td><td>950</td>
                </tr>
            </table>
        """.trimIndent()

        val doc = org.jsoup.Jsoup.parse(html)
        val scraper = LeagueDataScraper()
        val standings = scraper.parseStandings(doc)

        org.junit.jupiter.api.Assertions.assertEquals(2, standings.size)
        org.junit.jupiter.api.Assertions.assertEquals("Volley_Club_United_Wrocław", standings[0].teamName)
        org.junit.jupiter.api.Assertions.assertEquals(1, standings[0].rank)
        org.junit.jupiter.api.Assertions.assertEquals("KPS_Chełmiec_Wałbrzych", standings[1].teamName)
        org.junit.jupiter.api.Assertions.assertEquals(2, standings[1].rank)
        org.junit.jupiter.api.Assertions.assertTrue(standings.none { it.teamName.contains("Zespół", ignoreCase = true) })
    }

    @Test
    fun `test parseWynik handles completed match with individual sets`() {
        val scraper = LeagueDataScraper()
        val wynik = "3:2 (25:21, 23:25, 25:16, 25:27, 15:8)"

        val result = scraper.parseWynik(wynik)

        org.junit.jupiter.api.Assertions.assertTrue(result.isFinished)
        org.junit.jupiter.api.Assertions.assertEquals("3:2", result.finalScore)
        org.junit.jupiter.api.Assertions.assertEquals("3:2", result.score)
        org.junit.jupiter.api.Assertions.assertEquals(
            listOf("25:21", "23:25", "25:16", "25:27", "15:8"),
            result.sets
        )
    }

    @Test
    fun `test parseWynik handles 3-0 finished match`() {
        val scraper = LeagueDataScraper()
        val wynik = "3:0 (25:18, 25:20, 25:19)"

        val result = scraper.parseWynik(wynik)

        org.junit.jupiter.api.Assertions.assertTrue(result.isFinished)
        org.junit.jupiter.api.Assertions.assertEquals("3:0", result.finalScore)
        org.junit.jupiter.api.Assertions.assertEquals("3:0", result.score)
        org.junit.jupiter.api.Assertions.assertEquals(listOf("25:18", "25:20", "25:19"), result.sets)
    }

    @Test
    fun `test parseWynik handles unplayed score 0-0 and empty`() {
        val scraper = LeagueDataScraper()

        val zeroZero = scraper.parseWynik("0:0")
        assertFalse(zeroZero.isFinished)
        org.junit.jupiter.api.Assertions.assertEquals("", zeroZero.finalScore)
        org.junit.jupiter.api.Assertions.assertTrue(zeroZero.sets.isEmpty())

        val dash = scraper.parseWynik("-")
        assertFalse(dash.isFinished)
        org.junit.jupiter.api.Assertions.assertEquals("", dash.finalScore)

        val blank = scraper.parseWynik("")
        assertFalse(blank.isFinished)
        org.junit.jupiter.api.Assertions.assertEquals("", blank.finalScore)
    }

    @Test
    fun `test parseMatchDetail parses finished match HTML correctly`() {
        val html = """
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>Mecz numer <b>Dolnośląska II Liga-1</b></h5></div>
                <div class="col-xs-3"><h5>Rozgrywany dnia: <b>2026-10-03</b></h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>wynik:</h5></div>
                <div class="col-xs-3"><h5><b>3:2 (25:21, 23:25, 25:16, 25:27, 15:8)</b></h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>Mecz rozgrywany w</h5></div>
                <div class="col-xs-8"><h5>SP5 Armii Krajowej 9 Jawor </h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>godzina meczu:</h5></div>
                <div class="col-xs-8"><h5>17:00</h5></div>
            </div>
        """.trimIndent()

        val doc = org.jsoup.Jsoup.parse(html)
        val scraper = LeagueDataScraper()
        val detail = scraper.parseMatchDetail(doc)

        org.junit.jupiter.api.Assertions.assertEquals("SP5 Armii Krajowej 9 Jawor", detail.place)
        org.junit.jupiter.api.Assertions.assertEquals("17:00", detail.hour)
        org.junit.jupiter.api.Assertions.assertEquals("3:2", detail.finalScore)
        org.junit.jupiter.api.Assertions.assertEquals("3:2", detail.score)
        org.junit.jupiter.api.Assertions.assertEquals(
            listOf("25:21", "23:25", "25:16", "25:27", "15:8"),
            detail.sets
        )
        org.junit.jupiter.api.Assertions.assertTrue(detail.isFinished)
    }

    @Test
    fun `test parseMatchDetail parses upcoming match HTML correctly`() {
        val html = """
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>Mecz numer <b>Dolnośląska II Liga-1</b></h5></div>
                <div class="col-xs-3"><h5>Rozgrywany dnia: <b>2026-10-03</b></h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>wynik:</h5></div>
                <div class="col-xs-3"><h5><b>0:0</b></h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>Mecz rozgrywany w</h5></div>
                <div class="col-xs-8"><h5>SP5 Armii Krajowej 9 Jawor </h5></div>
            </div>
            <div class="row">
                <div class="col-xs-2 col-xs-offset-2"><h5>godzina meczu:</h5></div>
                <div class="col-xs-8"><h5>zawiadamia gospodarz</h5></div>
            </div>
        """.trimIndent()

        val doc = org.jsoup.Jsoup.parse(html)
        val scraper = LeagueDataScraper()
        val detail = scraper.parseMatchDetail(doc)

        org.junit.jupiter.api.Assertions.assertEquals("SP5 Armii Krajowej 9 Jawor", detail.place)
        org.junit.jupiter.api.Assertions.assertEquals("zawiadamia gospodarz", detail.hour)
        org.junit.jupiter.api.Assertions.assertEquals("", detail.finalScore)
        org.junit.jupiter.api.Assertions.assertTrue(detail.sets.isEmpty())
        assertFalse(detail.isFinished)
    }
}