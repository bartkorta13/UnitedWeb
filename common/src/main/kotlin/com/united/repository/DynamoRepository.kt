package com.united.repository

import aws.sdk.kotlin.services.dynamodb.DynamoDbClient
import aws.sdk.kotlin.services.dynamodb.model.AttributeValue
import aws.sdk.kotlin.services.dynamodb.model.BatchWriteItemRequest
import aws.sdk.kotlin.services.dynamodb.model.DeleteRequest
import aws.sdk.kotlin.services.dynamodb.model.PutRequest
import aws.sdk.kotlin.services.dynamodb.model.WriteRequest
import aws.sdk.kotlin.services.dynamodb.model.QueryRequest
import com.united.model.MatchItem
import com.united.model.PlayerItem
import com.united.model.PlayerPosition
import com.united.model.ScoreParser
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
        val validStandings = standings.filter { it.rank > 0 && !it.teamName.equals("Zespół", ignoreCase = true) }
        val writeRequests = validStandings.map { standing ->
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
                "pointsLost" to AttributeValue.N(standing.pointsLost.toString()),
                "form" to AttributeValue.L(standing.form.map { AttributeValue.S(it) })
            )
            WriteRequest { putRequest = PutRequest { this.item = item } }
        }.toMutableList()

        executeBatchWrite(writeRequests)
    }

    /**
     * Saves or overwrites all league matches in DynamoDB table 'LeagueData'.
     */
    suspend fun saveMatches(matches: List<MatchItem>) {
        val writeRequests = matches.map { match ->
            val scoreVal = match.finalScore.ifEmpty { match.score }
            val item = mutableMapOf(
                "PK" to AttributeValue.S("MATCHES"),
                // The SK is now perfectly stable using the official match ID
                "SK" to AttributeValue.S("MATCH#${match.matchId}"),
                "date" to AttributeValue.S(match.date),
                "homeTeam" to AttributeValue.S(match.homeTeamName),
                "awayTeam" to AttributeValue.S(match.awayTeamName),
                "score" to AttributeValue.S(scoreVal),
                "finalScore" to AttributeValue.S(scoreVal),
                "isFinished" to AttributeValue.Bool(match.isFinished)
            )
            match.place?.takeIf { it.isNotBlank() }?.let { item["place"] = AttributeValue.S(it) }
            match.hour?.takeIf { it.isNotBlank() }?.let { item["hour"] = AttributeValue.S(it) }
            if (match.sets.isNotEmpty()) {
                item["sets"] = AttributeValue.L(match.sets.map { AttributeValue.S(it) })
            }
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
                    pointsLost = item["pointsLost"]?.asN()?.toInt() ?: 0,
                    form = (item["form"] as? AttributeValue.L)?.value?.mapNotNull { (it as? AttributeValue.S)?.value } ?: emptyList()
                )
            }.filter { it.rank > 0 && !it.teamName.equals("Zespół", ignoreCase = true) }
             .sortedBy { it.rank }
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
                val rawFinalScore = (item["finalScore"] as? AttributeValue.S)?.value?.trim()
                val rawScore = (item["score"] as? AttributeValue.S)?.value?.trim()

                // Extract sets from:
                // 1) item["sets"] if AttributeValue.L
                // 2) item["sets"] if AttributeValue.S
                // 3) item["score"]
                // 4) item["finalScore"]
                val setsFromAttrL = (item["sets"] as? AttributeValue.L)?.value?.mapNotNull { (it as? AttributeValue.S)?.value } ?: emptyList()
                val setsFromAttrS = (item["sets"] as? AttributeValue.S)?.value?.let { ScoreParser.parseSets(it) } ?: emptyList()
                val setsFromScore = ScoreParser.parseSets(rawScore)
                val setsFromFinal = ScoreParser.parseSets(rawFinalScore)

                val sets = when {
                    setsFromAttrL.isNotEmpty() -> setsFromAttrL
                    setsFromAttrS.isNotEmpty() -> setsFromAttrS
                    setsFromScore.isNotEmpty() -> setsFromScore
                    else -> setsFromFinal
                }

                val scoreVal = ScoreParser.resolveMatchScore(rawFinalScore, rawScore, sets)
                val rawIsFinished = (item["isFinished"] as? AttributeValue.Bool)?.value ?: false
                val isFinished = rawIsFinished || (scoreVal.isNotBlank() && scoreVal != "0:0") || sets.isNotEmpty()

                MatchItem(
                    matchId = (item["SK"] as? AttributeValue.S)?.value?.removePrefix("MATCH#") ?: "",
                    date = (item["date"] as? AttributeValue.S)?.value ?: "",
                    homeTeamName = (item["homeTeam"] as? AttributeValue.S)?.value ?: "",
                    awayTeamName = (item["awayTeam"] as? AttributeValue.S)?.value ?: "",
                    score = scoreVal,
                    finalScore = scoreVal,
                    isFinished = isFinished,
                    place = (item["place"] as? AttributeValue.S)?.value,
                    hour = (item["hour"] as? AttributeValue.S)?.value,
                    sets = sets
                )
            }
        }
    }

    /**
     * Saves or overwrites roster members in DynamoDB table 'LeagueData'.
     */
    suspend fun saveRoster(roster: List<PlayerItem>) {
        val writeRequests = roster.map { player ->
            val item = mutableMapOf(
                "PK" to AttributeValue.S("ROSTER"),
                "SK" to AttributeValue.S("PLAYER#${player.id}"),
                "id" to AttributeValue.S(player.id),
                "firstName" to AttributeValue.S(player.firstName),
                "lastName" to AttributeValue.S(player.lastName),
                "position" to AttributeValue.S(player.position.name),
                "number" to AttributeValue.N(player.number.toString()),
                "isCaptain" to AttributeValue.Bool(player.isCaptain)
            )
            player.height?.let { item["height"] = AttributeValue.N(it.toString()) }
            player.attackRange?.let { item["attackRange"] = AttributeValue.N(it.toString()) }
            player.age?.let { item["age"] = AttributeValue.N(it.toString()) }

            WriteRequest { putRequest = PutRequest { this.item = item } }
        }

        executeBatchWrite(writeRequests)
    }

    /**
     * Fetches all roster members from DynamoDB, sorted by position order and jersey number.
     */
    suspend fun getRoster(): List<PlayerItem> {
        DynamoDbClient.fromEnvironment().use { ddb ->
            val request = QueryRequest {
                tableName = this@DynamoRepository.tableName
                keyConditionExpression = "PK = :pk"
                expressionAttributeValues = mapOf(
                    ":pk" to AttributeValue.S("ROSTER")
                )
            }

            val response = ddb.query(request)
            val items = response.items ?: emptyList()

            return items.map { item ->
                val posStr = (item["position"] as? AttributeValue.S)?.value
                val position = PlayerPosition.fromString(posStr)

                PlayerItem(
                    id = (item["id"] as? AttributeValue.S)?.value
                        ?: (item["SK"] as? AttributeValue.S)?.value?.removePrefix("PLAYER#")
                        ?: "",
                    firstName = (item["firstName"] as? AttributeValue.S)?.value ?: "",
                    lastName = (item["lastName"] as? AttributeValue.S)?.value ?: "",
                    position = position,
                    number = item["number"]?.asN()?.toIntOrNull() ?: 0,
                    height = item["height"]?.asN()?.toIntOrNull(),
                    attackRange = item["attackRange"]?.asN()?.toIntOrNull(),
                    age = item["age"]?.asN()?.toIntOrNull(),
                    isCaptain = (item["isCaptain"] as? AttributeValue.Bool)?.value ?: false
                )
            }.sortedWith(
                compareBy<PlayerItem> { it.position.sortOrder }
                    .thenBy { if (it.number == 0) 999 else it.number }
                    .thenBy { it.lastName }
            )
        }
    }
}