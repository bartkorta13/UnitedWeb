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
    fun `should return 404 for unknown path`() {
        // Given
        val request = ApiRequest().apply {
            rawPath = "/unknown-endpoint"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(404, response.statusCode)
        assertEquals("""{"error": "Not Found"}""", response.body)
    }
}