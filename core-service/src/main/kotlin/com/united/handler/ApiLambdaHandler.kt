package com.united.handler

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestHandler
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.united.model.MatchItem
import com.united.model.TeamStanding
import com.united.repository.DynamoRepository
import kotlinx.coroutines.runBlocking
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

// API Gateway request mapping structures
class ApiRequest {
    var rawPath: String? = null
    var path: String? = null // Added to support older API Gateway payload formats
    var pathParameters: Map<String, String>? = null
    var queryStringParameters: Map<String, String>? = null
}

class ApiResponse(
    var statusCode: Int = 200,
    var headers: Map<String, String> = mapOf(
        "Content-Type" to "application/json",
        "Access-Control-Allow-Origin" to "*"
    ),
    var body: String = ""
)

class ApiLambdaHandler(
    private val dynamoRepository: DynamoRepository = DynamoRepository()
) : RequestHandler<ApiRequest, ApiResponse> {

    private val objectMapper = jacksonObjectMapper()

    override fun handleRequest(input: ApiRequest, context: Context?): ApiResponse {
        // Fallback checks both V2 (rawPath) and V1 (path) formats
        val actualPath = input.rawPath ?: input.path ?: ""

        // Log the incoming request to AWS CloudWatch for easy debugging
        context?.logger?.log("Received Path: '$actualPath' | Query: ${input.queryStringParameters}")

        // Extract the team name safely
        val rawTeamName = input.queryStringParameters?.get("teamName")
            ?: input.pathParameters?.get("teamName")
            ?: when {
                actualPath.startsWith("/results/") -> actualPath.removePrefix("/results/")
                actualPath.startsWith("/fixtures/") -> actualPath.removePrefix("/fixtures/")
                else -> null
            }

        // Prevent empty strings (like trailing slashes) from becoming invalid team names
        val teamName = rawTeamName?.takeIf { it.isNotBlank() }?.decodeURL()

        return try {
            runBlocking {
                when {
                    // 1. GET /standings (ignores trailing slashes)
                    actualPath.trimEnd('/') == "/standings" -> {
                        val standings = dynamoRepository.getStandings()
                        val finishedMatches = dynamoRepository.getMatches().filter { it.isFinished }
                        val enrichedStandings = enrichStandingsWithForm(standings, finishedMatches)
                        ApiResponse(body = objectMapper.writeValueAsString(enrichedStandings))
                    }

                    // 2. GET /results AND /results/{teamName} AND /results?teamName=X
                    actualPath.startsWith("/results") -> {
                        val matches = dynamoRepository.getMatches().filter { match ->
                            match.isFinished && (
                                    teamName == null ||
                                            match.homeTeamName.equals(teamName, ignoreCase = true) ||
                                            match.awayTeamName.equals(teamName, ignoreCase = true)
                                    )
                        }
                        ApiResponse(body = objectMapper.writeValueAsString(matches))
                    }

                    // 3. GET /fixtures AND /fixtures/{teamName} AND /fixtures?teamName=X
                    actualPath.startsWith("/fixtures") -> {
                        val matches = dynamoRepository.getMatches().filter { match ->
                            !match.isFinished && (
                                    teamName == null ||
                                            match.homeTeamName.equals(teamName, ignoreCase = true) ||
                                            match.awayTeamName.equals(teamName, ignoreCase = true)
                                    )
                        }
                        ApiResponse(body = objectMapper.writeValueAsString(matches))
                    }

                    // 4. GET /roster
                    actualPath.trimEnd('/') == "/roster" -> {
                        val roster = dynamoRepository.getRoster()
                        ApiResponse(body = objectMapper.writeValueAsString(roster))
                    }

                    else -> {
                        // Echoes back the path so you know EXACTLY what AWS sent
                        context?.logger?.log("404 Error: Path '$actualPath' did not match.")
                        ApiResponse(
                            statusCode = 404,
                            body = """{"error": "Not Found", "received_path": "$actualPath"}"""
                        )
                    }
                }
            }
        } catch (e: Exception) {
            context?.logger?.log("Error handling request: ${e.message}")
            ApiResponse(statusCode = 500, body = """{"error": "${e.message}"}""")
        }
    }

    internal fun enrichStandingsWithForm(
        standings: List<TeamStanding>,
        finishedMatches: List<MatchItem>
    ): List<TeamStanding> {
        if (standings.isEmpty()) return emptyList()

        return standings.map { standing ->
            val teamForm = computeTeamForm(standing.teamName, finishedMatches)
            standing.copy(form = teamForm)
        }
    }

    internal fun computeTeamForm(teamName: String, finishedMatches: List<MatchItem>): List<String> {
        val normTarget = normalizeTeam(teamName)

        val teamMatches = finishedMatches.filter { match ->
            normalizeTeam(match.homeTeamName) == normTarget || normalizeTeam(match.awayTeamName) == normTarget
        }

        val sortedMatches = teamMatches.sortedWith(
            compareByDescending<MatchItem> { parseMatchTimestamp(it.date) }
                .thenByDescending { it.matchId.toIntOrNull() ?: 0 }
        )

        return sortedMatches.mapNotNull { match ->
            val scoreVal = match.finalScore.ifEmpty { match.score }
            val parts = scoreVal.split(":")
            if (parts.size == 2) {
                val homeSets = parts[0].trim().toIntOrNull()
                val awaySets = parts[1].trim().toIntOrNull()
                if (homeSets != null && awaySets != null) {
                    val isHome = normalizeTeam(match.homeTeamName) == normTarget
                    val won = if (isHome) homeSets > awaySets else awaySets > homeSets
                    if (won) "W" else "P"
                } else null
            } else null
        }.take(5)
    }

    private fun normalizeTeam(name: String): String {
        return name.lowercase().replace(Regex("[_\\s]+"), " ").trim()
    }

    private fun parseMatchTimestamp(dateStr: String): Long {
        val clean = dateStr.trim().replace(' ', 'T')
        return try {
            when {
                clean.length == 10 -> java.time.LocalDate.parse(clean).atStartOfDay().toEpochSecond(java.time.ZoneOffset.UTC)
                clean.length >= 16 -> java.time.LocalDateTime.parse(clean.substring(0, 16)).toEpochSecond(java.time.ZoneOffset.UTC)
                else -> 0L
            }
        } catch (_: Exception) {
            0L
        }
    }

    private fun String.decodeURL(): String {
        return URLDecoder.decode(this, StandardCharsets.UTF_8.toString())
    }
}