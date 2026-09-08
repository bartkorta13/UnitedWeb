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
    }
}