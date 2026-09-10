package com.united.seed

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.united.model.PlayerItem
import com.united.model.PlayerPosition
import com.united.repository.DynamoRepository
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import java.io.InputStream

/**
 * Test utility to seed or update the team roster in DynamoDB from resources.
 * Marked with @Tag("manual") so it does not run in automated CI builds without AWS credentials.
 * Can be run directly from IntelliJ IDEA (click the green Run arrow next to the test)
 * or via Gradle: ./gradlew :core-service:seedRoster
 */
@Tag("manual")
class SeedRosterTest {

    @Test
    fun seedRosterToDynamoDB() = runBlocking {
        val resourceStream: InputStream = javaClass.classLoader.getResourceAsStream("roster_seed.json")
            ?: error("Nie znaleziono pliku 'roster_seed.json' w src/test/resources")

        val mapper = jacksonObjectMapper()
        val players = parsePlayers(resourceStream, mapper)

        assertTrue(players.isNotEmpty(), "Lista zawodników do załadowania nie może być pusta")

        val tableName = System.getenv("DYNAMODB_TABLE") ?: "LeagueData"
        println("Zapisywanie ${players.size} zawodników do tabeli '$tableName' w DynamoDB...")

        val repository = DynamoRepository(tableName = tableName)
        repository.saveRoster(players)

        println("Sukces! Pomyślnie zaktualizowano ${players.size} zawodników w DynamoDB:")
        players.forEach { p ->
            println("  - #${p.number} ${p.firstName} ${p.lastName} (${p.position.displayNamePl})${if (p.isCaptain) " [KAPITAN]" else ""}")
        }
    }

    private fun parsePlayers(stream: InputStream, mapper: com.fasterxml.jackson.databind.ObjectMapper): List<PlayerItem> {
        val rootNode = mapper.readTree(stream)

        // 1. Clean JSON array format: [ { "id": "...", "firstName": "...", ... } ]
        if (rootNode.isArray) {
            return mapper.readValue<List<PlayerItem>>(rootNode.traverse())
        }

        // 2. AWS DynamoDB batch-write JSON format: { "LeagueData": [ { "PutRequest": { "Item": { ... } } } ] }
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
}
