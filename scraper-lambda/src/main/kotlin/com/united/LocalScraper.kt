package com.united

import com.united.repository.DynamoRepository
import com.united.scraper.LeagueDataScraper
import kotlinx.coroutines.runBlocking
import java.io.File
import java.net.Socket

fun main() {
    val endpoint = System.getenv("DYNAMODB_ENDPOINT")
        ?: System.getProperty("DYNAMODB_ENDPOINT")
        ?: "http://localhost:8000"
    System.setProperty("DYNAMODB_ENDPOINT", endpoint)

    if (endpoint.contains("localhost:8000") || endpoint.contains("127.0.0.1:8000")) {
        ensureDynamoDbLocalRunning()
    }

    println("🏐 [LocalScraper] Uruchamianie lokalnego scrapera DZPS...")
    println("   Target DynamoDB: $endpoint")

    val scraper = LeagueDataScraper()
    val repository = DynamoRepository()

    runBlocking {
        repository.ensureTableExists()

        println("⏳ [LocalScraper] Pobieranie aktualnych tabel i meczów z oficjalnego serwisu ligi...")
        val data = scraper.scrape()
        println("✅ [LocalScraper] Pobrano pomyślnie:")
        println("   - Drużyny w tabeli ligowej: ${data.standings.size}")
        println("   - Terminarz i wyniki meczów: ${data.matches.size}")

        println("💾 [LocalScraper] Zapisywanie do lokalnej bazy DynamoDB ($endpoint)...")
        repository.saveStandings(data.standings)
        repository.saveMatches(data.matches)
        println("🎉 [LocalScraper] Sukces! Lokalne DynamoDB zostało zaktualizowane świeżymi danymi z DZPS.")
    }
}

private fun ensureDynamoDbLocalRunning() {
    val isRunning = try {
        Socket("localhost", 8000).use { true }
    } catch (_: Exception) {
        false
    }

    if (!isRunning) {
        val candidates = listOf(
            File(".dynamodb/DynamoDBLocal.jar"),
            File("../.dynamodb/DynamoDBLocal.jar")
        )
        val localJar = candidates.firstOrNull { it.exists() }

        if (localJar != null) {
            println("⚡ [LocalScraper] DynamoDB Local nie działa na :8000. Uruchamianie procesu lokalnego...")
            val libDir = File(localJar.parentFile, "DynamoDBLocal_lib")
            val process = ProcessBuilder(
                "java",
                "-Djava.library.path=${libDir.absolutePath}",
                "-jar",
                localJar.absolutePath,
                "-inMemory",
                "-port",
                "8000"
            ).redirectErrorStream(true).start()

            Runtime.getRuntime().addShutdownHook(Thread {
                process.destroy()
            })

            for (i in 1..25) {
                Thread.sleep(200)
                try {
                    Socket("localhost", 8000).use {
                        println("✅ [LocalScraper] DynamoDB Local jest gotowe na http://localhost:8000")
                        return
                    }
                } catch (_: Exception) {}
            }
        } else {
            println("ℹ️  [LocalScraper] DynamoDB Local nie działa na :8000.")
            println("   Uruchom 'docker compose up -d' lub './gradlew :core-service:downloadDynamoDbLocal'")
        }
    }
}
