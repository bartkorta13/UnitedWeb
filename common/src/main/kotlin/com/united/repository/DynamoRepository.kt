package com.united.repository

import aws.sdk.kotlin.services.dynamodb.DynamoDbClient
import aws.sdk.kotlin.services.dynamodb.model.AttributeValue
import aws.sdk.kotlin.services.dynamodb.model.BatchWriteItemRequest
import aws.sdk.kotlin.services.dynamodb.model.PutRequest
import aws.sdk.kotlin.services.dynamodb.model.WriteRequest
import aws.sdk.kotlin.services.dynamodb.model.QueryRequest
import com.united.model.MatchItem
import com.united.model.TeamStanding
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.milliseconds

class DynamoRepository(
    private val tableName: String = "LeagueData"
) {

    /**
     * Saves or overwrites all team standings in DynamoDB table 'LeagueData'.
     */
    suspend fun saveStandings(standings: List<TeamStanding>) {
        val writeRequests = standings.map { standing ->
            val item = mapOf(
                "PK" to AttributeValue.S("STANDINGS"),
                "SK" to AttributeValue.S("TEAM#${standing.teamName}"),
                "rank" to AttributeValue.N(standing.rank.toString()),
                "teamName" to AttributeValue.S(standing.teamName),
                "matchesPlayed" to AttributeValue.N(standing.matchesPlayed.toString()),
                "points" to AttributeValue.N(standing.points.toString()),
                "wins" to AttributeValue.N(standing.wins.toString()),
                "setsWon" to AttributeValue.N(standing.setsWon.toString()),
                "setsLost" to AttributeValue.N(standing.setsLost.toString()),
                "pointsWon" to AttributeValue.N(standing.pointsWon.toString()),
                "pointsLost" to AttributeValue.N(standing.pointsLost.toString())
            )
            WriteRequest { putRequest = PutRequest { this.item = item } }
        }

        executeBatchWrite(writeRequests)
    }

    /**
     * Saves or overwrites all league matches in DynamoDB table 'LeagueData'.
     */
    suspend fun saveMatches(matches: List<MatchItem>) {
        val writeRequests = matches.map { match ->
            val item = mapOf(
                "PK" to AttributeValue.S("MATCHES"),
                // The SK is now perfectly stable using the official match ID
                "SK" to AttributeValue.S("MATCH#${match.matchId}"),
                "date" to AttributeValue.S(match.date),
                "homeTeam" to AttributeValue.S(match.homeTeamName),
                "awayTeam" to AttributeValue.S(match.awayTeamName),
                "score" to AttributeValue.S(match.score),
                "isFinished" to AttributeValue.Bool(match.isFinished)
            )
            WriteRequest { putRequest = PutRequest { this.item = item } }
        }

        executeBatchWrite(writeRequests)
    }

    /**
     * Chunks items into batches of 25 to respect DynamoDB's BatchWriteItem limits.
     */
    private suspend fun executeBatchWrite(requests: List<WriteRequest>) {
        if (requests.isEmpty()) return

        DynamoDbClient.fromEnvironment().use { ddb ->
            // Chunk into batches of 5 to respect our 5 WCU Free Tier limit
            requests.chunked(5).forEach { chunk ->
                val request = BatchWriteItemRequest {
                    requestItems = mapOf(tableName to chunk)
                }
                ddb.batchWriteItem(request)

                // Pause for 2 seconds before the next batch to let capacity refill
                delay(2000.milliseconds)
            }
        }
    }

    /**
     * Fetches all team standings from DynamoDB.
     */
    suspend fun getStandings(): List<TeamStanding> {
        DynamoDbClient.fromEnvironment().use { ddb ->
            val request = QueryRequest {
                tableName = this@DynamoRepository.tableName
                keyConditionExpression = "PK = :pk"
                expressionAttributeValues = mapOf(
                    ":pk" to AttributeValue.S("STANDINGS")
                )
            }

            val response = ddb.query(request)
            val items = response.items ?: emptyList()

            return items.map { item ->
                TeamStanding(
                    rank = item["rank"]?.asN()?.toInt() ?: 0,
                    teamName = item["teamName"]?.asS() ?: "",
                    matchesPlayed = item["matchesPlayed"]?.asN()?.toInt() ?: 0,
                    points = item["points"]?.asN()?.toInt() ?: 0,
                    wins = item["wins"]?.asN()?.toInt() ?: 0,
                    setsWon = item["setsWon"]?.asN()?.toInt() ?: 0,
                    setsLost = item["setsLost"]?.asN()?.toInt() ?: 0,
                    pointsWon = item["pointsWon"]?.asN()?.toInt() ?: 0,
                    pointsLost = item["pointsLost"]?.asN()?.toInt() ?: 0
                )
            }.sortedBy { it.rank }
        }
    }

    /**
     * Fetches all matches from DynamoDB.
     */
    suspend fun getMatches(): List<MatchItem> {
        DynamoDbClient.fromEnvironment().use { ddb ->
            val request = QueryRequest {
                tableName = this@DynamoRepository.tableName
                keyConditionExpression = "PK = :pk"
                expressionAttributeValues = mapOf(
                    ":pk" to AttributeValue.S("MATCHES")
                )
            }

            val response = ddb.query(request)
            val items = response.items ?: emptyList()

            return items.map { item ->
                MatchItem(
                    matchId = item["SK"]?.asS()?.removePrefix("MATCH#") ?: "",
                    date = item["date"]?.asS() ?: "",
                    homeTeamName = item["homeTeam"]?.asS() ?: "",
                    awayTeamName = item["awayTeam"]?.asS() ?: "",
                    score = item["score"]?.asS() ?: "",
                    isFinished = item["isFinished"]?.asBool() ?: false
                )
            }
        }
    }
}