package com.united.handler

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestHandler
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
                        ApiResponse(body = objectMapper.writeValueAsString(standings))
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

    private fun String.decodeURL(): String {
        return URLDecoder.decode(this, StandardCharsets.UTF_8.toString())
    }
}