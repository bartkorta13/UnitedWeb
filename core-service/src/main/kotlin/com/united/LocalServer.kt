package com.united

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import com.united.handler.ApiLambdaHandler
import com.united.handler.ApiRequest
import com.united.model.MatchItem
import com.united.model.NewsItem
import com.united.model.PlayerItem
import com.united.model.PlayerPosition
import com.united.model.TeamStanding
import com.united.repository.DynamoRepository
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

fun main() {
    setupLocalEnvironment()

    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val handler = ApiLambdaHandler()
    val server = HttpServer.create(InetSocketAddress(port), 0)

    server.createContext("/") { exchange: HttpExchange ->
        try {
            // Handle CORS Preflight
            exchange.responseHeaders.add("Access-Control-Allow-Origin", "*")
            exchange.responseHeaders.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            exchange.responseHeaders.add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

            if (exchange.requestMethod.equals("OPTIONS", ignoreCase = true)) {
                exchange.sendResponseHeaders(204, -1)
                exchange.close()
                return@createContext
            }

            val rawUri = exchange.requestURI
            val path = rawUri.path
            val rawQuery = rawUri.rawQuery

            val queryParams = rawQuery?.split("&")?.filter { it.isNotBlank() }?.associate {
                val parts = it.split("=", limit = 2)
                val key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8)
                val value = if (parts.size > 1) URLDecoder.decode(parts[1], StandardCharsets.UTF_8) else ""
                key to value
            }

            val headers = exchange.requestHeaders.entries.associate { (k, v) ->
                k to v.joinToString(", ")
            }

            val body = exchange.requestBody.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }

            val apiRequest = ApiRequest().apply {
                this.rawPath = path
                this.path = path
                this.httpMethod = exchange.requestMethod
                this.queryStringParameters = queryParams
                this.headers = headers
                this.body = body.takeIf { it.isNotBlank() }
            }

            val apiResponse = handler.handleRequest(apiRequest, null)

            apiResponse.headers.forEach { (key, value) ->
                exchange.responseHeaders.set(key, value)
            }
            // Ensure CORS is set even if not present in handler response
            if (!exchange.responseHeaders.containsKey("Access-Control-Allow-Origin")) {
                exchange.responseHeaders.set("Access-Control-Allow-Origin", "*")
            }

            val responseBytes = apiResponse.body.toByteArray(StandardCharsets.UTF_8)
            exchange.sendResponseHeaders(apiResponse.statusCode, responseBytes.size.toLong())
            exchange.responseBody.use { it.write(responseBytes) }
        } catch (e: Exception) {
            val errorJson = """{"error": "${e.message?.replace("\"", "\\\"")}"}"""
            val bytes = errorJson.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.responseHeaders.set("Access-Control-Allow-Origin", "*")
            exchange.sendResponseHeaders(500, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
    }

    println("=========================================================")
    println("🚀 UnitedWeb Local Core API running on http://localhost:$port")
    println("   Endpoints available:")
    println("   - http://localhost:$port/standings")
    println("   - http://localhost:$port/fixtures")
    println("   - http://localhost:$port/fixtures/United_%C5%9Aroda_%C5%9Al%C4%85ska")
    println("   - http://localhost:$port/results")
    println("   - http://localhost:$port/results/United_%C5%9Aroda_%C5%9Al%C4%85ska")
    println("   - http://localhost:$port/roster")
    println("   - http://localhost:$port/news")
    println("   - http://localhost:$port/news/{id}")
    println("   - [ADMIN] GET    http://localhost:$port/admin/news")
    println("   - [ADMIN] POST   http://localhost:$port/admin/news")
    println("   - [ADMIN] PUT    http://localhost:$port/admin/news/{id}")
    println("   - [ADMIN] DELETE http://localhost:$port/admin/news/{id}")
    println("   - [ADMIN] POST   http://localhost:$port/admin/news/upload-url")
    println("=========================================================")

    server.start()
}

class LocalServerMarker

private fun setupLocalEnvironment() {
    val endpoint = System.getenv("DYNAMODB_ENDPOINT") ?: System.getProperty("DYNAMODB_ENDPOINT") ?: "http://localhost:8000"
    System.setProperty("DYNAMODB_ENDPOINT", endpoint)

    if (System.getenv("ASSETS_S3_BUCKET") == null && System.getProperty("ASSETS_S3_BUCKET") == null) {
        System.setProperty("ASSETS_S3_BUCKET", "united-league-assets-dev-6d01847220700b9e7a73d2c21b")
    }
    if (System.getenv("ASSETS_CDN_URL") == null && System.getProperty("ASSETS_CDN_URL") == null) {
        System.setProperty("ASSETS_CDN_URL", "https://dxrcawhjt411l.cloudfront.net")
    }

    if (endpoint.contains("localhost:8000") || endpoint.contains("127.0.0.1:8000")) {
        ensureDynamoDbLocalRunning()
    }

    try {
        runBlocking {
            val repository = DynamoRepository()
            repository.ensureTableExists()

            // Seed Roster if empty
            if (repository.getRoster().isEmpty()) {
                println("🌱 [LocalServer] Seeding roster from roster_seed.json...")
                val stream = LocalServerMarker::class.java.classLoader.getResourceAsStream("roster_seed.json")
                if (stream != null) {
                    val players = parseSeedPlayers(stream, jacksonObjectMapper())
                    if (players.isNotEmpty()) {
                        repository.saveRoster(players)
                        println("✅ [LocalServer] Seeded ${players.size} players into local DynamoDB.")
                    }
                }
            }

            // Seed Standings & Matches if empty
            if (repository.getStandings().isEmpty()) {
                println("🌱 [LocalServer] Seeding sample standings and matches...")
                repository.saveStandings(sampleStandings())
                repository.saveMatches(sampleMatches())
                println("✅ [LocalServer] Seeded standings and matches.")
            }

            // Seed News if empty
            if (repository.getNews(includeUnpublished = true).isEmpty()) {
                println("🌱 [LocalServer] Seeding initial sample news article...")
                repository.saveNews(sampleNewsArticle())
                println("✅ [LocalServer] Seeded sample news article.")
            }
        }
    } catch (e: Exception) {
        System.err.println("⚠️  [LocalServer] Note: Could not auto-initialize DynamoDB: ${e.message}")
    }
}

private fun ensureDynamoDbLocalRunning() {
    val isRunning = try {
        Socket("localhost", 8000).use { true }
    } catch (_: Exception) {
        false
    }

    if (!isRunning) {
        // Look for .dynamodb/DynamoDBLocal.jar in workspace root or current dir
        val candidates = listOf(
            File(".dynamodb/DynamoDBLocal.jar"),
            File("../.dynamodb/DynamoDBLocal.jar")
        )
        val localJar = candidates.firstOrNull { it.exists() }

        if (localJar != null) {
            println("⚡ [LocalServer] DynamoDB Local not detected on port 8000. Spawning local instance...")
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
                println("🛑 Stopping DynamoDB Local...")
                process.destroy()
            })

            // Poll until port 8000 is ready (up to 5s)
            for (i in 1..25) {
                Thread.sleep(200)
                try {
                    Socket("localhost", 8000).use {
                        println("✅ [LocalServer] DynamoDB Local is ready on http://localhost:8000")
                        return
                    }
                } catch (_: Exception) {}
            }
        } else {
            println("ℹ️  [LocalServer] DynamoDB Local is not running on port 8000.")
            println("   You can run 'docker compose up -d' or './gradlew :core-service:downloadDynamoDbLocal'")
        }
    } else {
        println("✅ [LocalServer] Connected to existing DynamoDB instance on port 8000.")
    }
}

private fun parseSeedPlayers(stream: InputStream, mapper: ObjectMapper): List<PlayerItem> {
    val rootNode = mapper.readTree(stream)
    val leagueData = rootNode.get("LeagueData")
    if (leagueData != null && leagueData.isArray) {
        return leagueData.mapNotNull { entry ->
            val item = entry.get("PutRequest")?.get("Item") ?: return@mapNotNull null
            val id = item.get("id")?.get("S")?.asText() ?: return@mapNotNull null
            val firstName = item.get("firstName")?.get("S")?.asText() ?: ""
            val lastName = item.get("lastName")?.get("S")?.asText() ?: ""
            val posStr = item.get("position")?.get("S")?.asText()
            val number = item.get("number")?.get("N")?.asInt() ?: 0
            val height = item.get("height")?.get("N")?.asInt()
            val attackRange = item.get("attackRange")?.get("N")?.asInt()
            val age = item.get("age")?.get("N")?.asInt()
            val isCaptain = item.get("isCaptain")?.get("BOOL")?.asBoolean() ?: false

            PlayerItem(
                id = id,
                firstName = firstName,
                lastName = lastName,
                position = PlayerPosition.fromString(posStr),
                number = number,
                height = height,
                attackRange = attackRange,
                age = age,
                isCaptain = isCaptain
            )
        }
    }
    return emptyList()
}

private fun sampleStandings(): List<TeamStanding> = listOf(
    TeamStanding(1, "KS United Środa Śląska", 10, 26, 9, 28, 8, 850, 710, listOf("W", "W", "W", "W", "P")),
    TeamStanding(2, "Gwardia Wrocław II", 10, 24, 8, 26, 11, 840, 725, listOf("W", "W", "P", "W", "W")),
    TeamStanding(3, "Bielawianka Bester Bielawa", 10, 20, 7, 23, 15, 820, 760, listOf("W", "P", "W", "W", "P")),
    TeamStanding(4, "KPS Chełmiec Wałbrzych II", 10, 16, 5, 19, 18, 800, 790, listOf("P", "W", "P", "W", "W")),
    TeamStanding(5, "UKS Tygrysy Strzelin", 10, 12, 4, 15, 21, 750, 810, listOf("P", "P", "W", "P", "W")),
    TeamStanding(6, "Volley Wrocław II", 10, 10, 3, 13, 24, 730, 840, listOf("P", "P", "P", "W", "P")),
    TeamStanding(7, "SPS Chrobry Głogów II", 10, 7, 2, 10, 26, 700, 850, listOf("P", "P", "P", "P", "W")),
    TeamStanding(8, "MKS Ikar Legnica II", 10, 5, 2, 9, 26, 680, 845, listOf("P", "P", "P", "P", "P"))
)

private fun sampleMatches(): List<MatchItem> = listOf(
    MatchItem("1", "2026-03-01", "KS United Środa Śląska", "Gwardia Wrocław II", "3:1", true, "Hala Sportowa Środa Śląska", "18:00"),
    MatchItem("2", "2026-03-08", "Bielawianka Bester Bielawa", "KS United Środa Śląska", "1:3", true, "Bielawa", "17:00"),
    MatchItem("3", "2026-03-15", "KS United Środa Śląska", "KPS Chełmiec Wałbrzych II", "3:0", true, "Hala Sportowa Środa Śląska", "18:00"),
    MatchItem("4", "2026-03-22", "UKS Tygrysy Strzelin", "KS United Środa Śląska", "", false, "Strzelin", "17:00"),
    MatchItem("5", "2026-03-29", "KS United Środa Śląska", "Volley Wrocław II", "", false, "Hala Sportowa Środa Śląska", "18:00")
)

private fun sampleNewsArticle(): NewsItem = NewsItem(
    id = "1",
    title = "Koniec sezonu plażowego",
    slug = "koniec-sezonu-plazowego",
    mainPhotoUrl = "https://d1rm5h55nlqrob.cloudfront.net/news/koniec-sezonu-plazowego/main/main-45bbda7d.jpg",
    excerpt = "Podsumowujemy udany letni sezon siatkówki plażowej z udziałem zawodników KS United Środa Śląska.",
    contentHtml = "<p>Za nami wspaniałe letnie miesiące pełne emocji na piasku. Nasi siatkarze brali udział w licznych turniejach regionalnych i ogólnopolskich, zdobywając cenne doświadczenie oraz miejsca na podium.</p><p>Teraz pełna koncentracja przenosi się na halę i zbliżające się rozgrywki II Ligi Dolnośląskiej.</p>",
    galleryPhotos = emptyList(),
    createdAt = "2026-09-11T12:00:00Z",
    published = true
)

