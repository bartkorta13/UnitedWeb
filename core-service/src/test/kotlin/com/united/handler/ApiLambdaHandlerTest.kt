package com.united.handler

import com.united.model.MatchItem
import com.united.model.TeamStanding
import com.united.repository.DynamoRepository
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ApiLambdaHandlerTest {

    private val mockRepository = mockk<DynamoRepository>()
    private val handler = ApiLambdaHandler(mockRepository)

    @Test
    fun `should return standings on GET standings path`() {
        // Given
        val fakeStandings = listOf(
            TeamStanding(1, "Team Alpha", 10, 25, 8, 24, 5, 700, 500)
        )
        coEvery { mockRepository.getStandings() } returns fakeStandings
        coEvery { mockRepository.getMatches() } returns emptyList()

        val request = ApiRequest().apply {
            rawPath = "/standings"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("Team Alpha"))
    }

    @Test
    fun `should return standings enriched with live form from finished matches ordered by date descending`() {
        val fakeStandings = listOf(
            TeamStanding(1, "Team Alpha", 6, 15, 5, 15, 5, 450, 350),
            TeamStanding(2, "Team Beta", 6, 12, 4, 13, 8, 420, 390)
        )
        val fakeMatches = listOf(
            MatchItem("1", "2026-10-01", "Team Alpha", "Team Beta", "3:1", true, finalScore = "3:1"),
            MatchItem("2", "2026-10-08", "Team Beta", "Team Alpha", "3:2", true, finalScore = "3:2"),
            MatchItem("3", "2026-10-15", "Team Alpha", "Other Team", "3:0", true, finalScore = "3:0"),
            MatchItem("4", "2026-10-22", "Other Team", "Team Alpha", "1:3", true, finalScore = "1:3"),
            MatchItem("5", "2026-10-29", "Team Alpha", "Other Team 2", "0:3", true, finalScore = "0:3"),
            MatchItem("6", "2026-11-05", "Other Team 3", "Team Alpha", "3:2", true, finalScore = "3:2")
        )
        coEvery { mockRepository.getStandings() } returns fakeStandings
        coEvery { mockRepository.getMatches() } returns fakeMatches

        val request = ApiRequest().apply { rawPath = "/standings" }
        val response = handler.handleRequest(request, null)

        assertEquals(200, response.statusCode)
        // Team Alpha in date desc:
        // 2026-11-05: 2:3 -> P
        // 2026-10-29: 0:3 -> P
        // 2026-10-22: 3:1 -> W
        // 2026-10-15: 3:0 -> W
        // 2026-10-08: 2:3 -> P
        assert(response.body.contains(""""form":["P","P","W","W","P"]"""))
    }

    @Test
    fun `should return 404 for unknown path`() {
        // Given
        val request = ApiRequest().apply {
            rawPath = "/unknown-endpoint"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(404, response.statusCode)
        assertEquals("""{"error": "Not Found", "received_path": "/unknown-endpoint"}""", response.body)
    }

    @Test
    fun `should return fixtures with place and hour on GET fixtures path`() {
        // Given
        val fakeMatches = listOf(
            MatchItem(
                matchId = "182",
                date = "2026-10-03",
                homeTeamName = "Team_A",
                awayTeamName = "Team_B",
                score = "",
                isFinished = false,
                place = "Hala Sportowa",
                hour = "18:00"
            )
        )
        coEvery { mockRepository.getMatches() } returns fakeMatches

        val request = ApiRequest().apply {
            rawPath = "/fixtures"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("Hala Sportowa"))
        assert(response.body.contains("18:00"))
        assert(response.body.contains("Team_A"))
    }

    @Test
    fun `should return results with finalScore and sets on GET results path`() {
        // Given
        val fakeMatches = listOf(
            MatchItem(
                matchId = "100",
                date = "2026-03-01 17:00",
                homeTeamName = "Team_A",
                awayTeamName = "Team_B",
                score = "3:2",
                finalScore = "3:2",
                isFinished = true,
                place = "Hala Główna",
                hour = "17:00",
                sets = listOf("25:21", "23:25", "25:16", "25:27", "15:8")
            )
        )
        coEvery { mockRepository.getMatches() } returns fakeMatches

        val request = ApiRequest().apply {
            rawPath = "/results"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains(""""finalScore":"3:2""""))
        assert(response.body.contains("25:21"))
        assert(response.body.contains("Hala Główna"))
    }

    @Test
    fun `should return roster on GET roster path`() {
        // Given
        val fakeRoster = listOf(
            com.united.model.PlayerItem(
                id = "jan-kowalski",
                firstName = "Jan",
                lastName = "Kowalski",
                position = com.united.model.PlayerPosition.SETTER,
                number = 7,
                height = 192,
                attackRange = 330,
                age = 24,
                isCaptain = true
            )
        )
        coEvery { mockRepository.getRoster() } returns fakeRoster

        val request = ApiRequest().apply {
            rawPath = "/roster"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("Kowalski"))
        assert(response.body.contains("SETTER"))
        assert(response.body.contains("192"))
    }
}