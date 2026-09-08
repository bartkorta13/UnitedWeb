package com.united

import com.united.repository.DynamoRepository
import com.united.scraper.LeagueScraper
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    println("1. Scraping data from DZPS...")
    val scraper = LeagueScraper()
    val data = scraper.scrape()

    println("-> Scraped ${data.standings.size} teams and ${data.matches.size} matches.")

    println("\n2. Writing records to Amazon DynamoDB (Table: LeagueData)...")
    val repository = DynamoRepository() // defaults to LeagueData

    repository.saveStandings(data.standings)
    println("-> Standings saved successfully.")

    repository.saveMatches(data.matches)
    println("-> Matches saved successfully.")

    println("\nAll items successfully written/upserted into LeagueData!")
}