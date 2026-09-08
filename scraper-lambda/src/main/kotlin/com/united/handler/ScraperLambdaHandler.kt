package com.united.handler

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestHandler
import com.united.scraper.LeagueDataScraper
import com.united.repository.DynamoRepository
import kotlinx.coroutines.runBlocking

class ScraperLambdaHandler : RequestHandler<Map<String, Any>, String> {

    private val scraper = LeagueDataScraper()
    private val dynamoRepository = DynamoRepository()

    override fun handleRequest(input: Map<String, Any>, context: Context): String {
        val logger = context.logger
        logger.log("Starting UnitedWebsite scraper Lambda execution...")

        try {
            // Run your suspending scraping and writing logic
            runBlocking {
                val scrapedData = scraper.scrape()

                // Save standings and matches using your repository's explicit methods
                dynamoRepository.saveStandings(scrapedData.standings)
                dynamoRepository.saveMatches(scrapedData.matches)
            }

            logger.log("Scraping and DynamoDB save completed successfully!")
            return "Successfully scraped and saved standings and matches."

        } catch (e: Exception) {
            logger.log("Error during scraping execution: ${e.message}")
            throw e
        }
    }
}