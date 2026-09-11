package com.united.handler

import com.united.model.GenerateUploadUrlResponse
import com.united.model.MatchItem
import com.united.model.TeamStanding
import com.united.repository.DynamoRepository
import com.united.storage.S3MediaStorageService
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ApiLambdaHandlerTest {

    private val mockRepository = mockk<DynamoRepository>()
    private val mockS3Service = mockk<S3MediaStorageService>()
    private val handler = ApiLambdaHandler(mockRepository, mockS3Service)

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

    @Test
    fun `should return news summaries on GET news path with optional limit`() {
        // Given
        val fakeNews = listOf(
            com.united.model.NewsSummary(
                id = "news-1",
                title = "Wielkie zwycięstwo!",
                slug = "wielkie-zwyciestwo",
                mainPhotoUrl = "https://cdn.example.com/news/news-1/main.jpg",
                excerpt = "Świetny mecz przed własną publicznością.",
                createdAt = "2026-03-10T18:00:00Z",
                published = true
            )
        )
        coEvery { mockRepository.getNews(limit = 3) } returns fakeNews

        val request = ApiRequest().apply {
            rawPath = "/news"
            queryStringParameters = mapOf("limit" to "3")
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("Wielkie zwycięstwo!"))
        assert(response.body.contains("wielkie-zwyciestwo"))
    }

    @Test
    fun `should return full news article on GET news by id`() {
        // Given
        val fakeArticle = com.united.model.NewsItem(
            id = "news-1",
            title = "Wielkie zwycięstwo!",
            slug = "wielkie-zwyciestwo",
            mainPhotoUrl = "https://cdn.example.com/news/news-1/main.jpg",
            excerpt = "Świetny mecz przed własną publicznością.",
            contentHtml = "<p>Pełna relacja z niesamowitego meczu.</p>",
            galleryPhotos = listOf("https://cdn.example.com/news/news-1/photo1.jpg"),
            createdAt = "2026-03-10T18:00:00Z",
            published = true,
            isDeleted = false
        )
        coEvery { mockRepository.getNewsById("news-1") } returns fakeArticle

        val request = ApiRequest().apply {
            rawPath = "/news/news-1"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("<p>Pełna relacja z niesamowitego meczu.</p>"))
        assert(response.body.contains("photo1.jpg"))
    }

    @Test
    fun `should return 404 when news article does not exist or was soft deleted`() {
        // Given
        coEvery { mockRepository.getNewsById("deleted-or-missing") } returns null

        val request = ApiRequest().apply {
            rawPath = "/news/deleted-or-missing"
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(404, response.statusCode)
        assert(response.body.contains("News article not found"))
    }

    @Test
    fun `should return presigned upload url on POST admin news upload-url`() {
        // Given
        val fakeResponse = GenerateUploadUrlResponse(
            uploadUrl = "https://s3.example.com/assets/news/derby/main/photo.jpg?signature=123",
            cdnUrl = "https://cdn.example.com/news/derby/main/photo.jpg",
            key = "assets/news/derby/main/photo.jpg"
        )
        coEvery { mockS3Service.generatePresignedUploadUrl(any()) } returns fakeResponse

        val request = ApiRequest().apply {
            rawPath = "/admin/news/upload-url"
            httpMethod = "POST"
            body = """{"newsId":"derby","fileName":"team.jpg","contentType":"image/jpeg","isGallery":false}"""
        }

        // When
        val response = handler.handleRequest(request, null)

        // Then
        assertEquals(200, response.statusCode)
        assert(response.body.contains("https://s3.example.com"))
        assert(response.body.contains("https://cdn.example.com/news/derby/main/photo.jpg"))
    }

    @Test
    fun `should return 400 when upload-url request is missing required fields`() {
        val request = ApiRequest().apply {
            rawPath = "/admin/news/upload-url"
            httpMethod = "POST"
            body = """{"newsId":"","fileName":"","contentType":""}"""
        }

        val response = handler.handleRequest(request, null)

        assertEquals(400, response.statusCode)
        assert(response.body.contains("required"))
    }

    @Test
    fun `should return 400 when upload-url content-type is not an image`() {
        val request = ApiRequest().apply {
            rawPath = "/admin/news/upload-url"
            httpMethod = "POST"
            body = """{"newsId":"derby","fileName":"file.pdf","contentType":"application/pdf"}"""
        }

        val response = handler.handleRequest(request, null)

        assertEquals(400, response.statusCode)
        assert(response.body.contains("Only image uploads are permitted"))
    }

    @Test
    fun `should return all news on GET admin news`() {
        val fakeNews = listOf(
            com.united.model.NewsSummary("1", "Draft Article", "draft-article", "https://cdn.example.com/main.jpg", "Excerpt", "2026-03-11T10:00:00Z", published = false)
        )
        coEvery { mockRepository.getNews(includeUnpublished = true, includeDeleted = true) } returns fakeNews

        val request = ApiRequest().apply {
            rawPath = "/admin/news"
            httpMethod = "GET"
        }

        val response = handler.handleRequest(request, null)

        assertEquals(200, response.statusCode)
        assert(response.body.contains("Draft Article"))
    }

    @Test
    fun `should create news article on POST admin news`() {
        coEvery { mockRepository.saveNews(any()) } returns Unit

        val request = ApiRequest().apply {
            rawPath = "/admin/news"
            httpMethod = "POST"
            body = """{"title":"Zwycięstwo United!","mainPhotoUrl":"https://cdn.example.com/photo.jpg","contentHtml":"<p>Relacja z meczu</p>"}"""
        }

        val response = handler.handleRequest(request, null)

        assertEquals(201, response.statusCode)
        assert(response.body.contains("Zwycięstwo United!"))
        assert(response.body.contains("zwyciestwo-united"))
    }

    @Test
    fun `should return 400 on POST admin news when title or mainPhotoUrl is missing`() {
        val request = ApiRequest().apply {
            rawPath = "/admin/news"
            httpMethod = "POST"
            body = """{"title":"","mainPhotoUrl":""}"""
        }

        val response = handler.handleRequest(request, null)

        assertEquals(400, response.statusCode)
        assert(response.body.contains("mandatory"))
    }

    @Test
    fun `should update news article on PUT admin news by id`() {
        val existing = com.united.model.NewsItem(
            id = "test-id",
            title = "Stary tytuł",
            slug = "stary-tytul",
            mainPhotoUrl = "https://cdn.example.com/old.jpg",
            excerpt = "Stary excerpt",
            contentHtml = "<p>Stara treść</p>",
            createdAt = "2026-03-10T12:00:00Z"
        )
        coEvery { mockRepository.getNewsById("test-id", includeDeleted = true) } returns existing
        coEvery { mockRepository.saveNews(any()) } returns Unit

        val request = ApiRequest().apply {
            rawPath = "/admin/news/test-id"
            httpMethod = "PUT"
            body = """{"title":"Nowy tytuł","contentHtml":"<p>Nowa treść</p>"}"""
        }

        val response = handler.handleRequest(request, null)

        assertEquals(200, response.statusCode)
        assert(response.body.contains("Nowy tytuł"))
        assert(response.body.contains("nowy-tytul"))
    }

    @Test
    fun `should soft delete news article on DELETE admin news by id`() {
        coEvery { mockRepository.softDeleteNews("test-id") } returns true

        val request = ApiRequest().apply {
            rawPath = "/admin/news/test-id"
            httpMethod = "DELETE"
        }

        val response = handler.handleRequest(request, null)

        assertEquals(200, response.statusCode)
        assert(response.body.contains("soft-deleted successfully"))
    }
}