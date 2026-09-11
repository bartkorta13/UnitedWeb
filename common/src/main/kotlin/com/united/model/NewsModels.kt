package com.united.model

data class NewsItem(
    val id: String,
    val title: String,
    val slug: String,
    val mainPhotoUrl: String,
    val excerpt: String,
    val contentHtml: String,
    val galleryPhotos: List<String> = emptyList(),
    val createdAt: String, // ISO-8601 UTC timestamp e.g. "2026-03-11T12:00:00Z"
    val updatedAt: String? = null,
    val published: Boolean = true,
    val isDeleted: Boolean = false,
    val deletedAt: String? = null
)

data class NewsSummary(
    val id: String,
    val title: String,
    val slug: String,
    val mainPhotoUrl: String,
    val excerpt: String,
    val createdAt: String,
    val published: Boolean = true
) {
    companion object {
        fun fromItem(item: NewsItem): NewsSummary = NewsSummary(
            id = item.id,
            title = item.title,
            slug = item.slug,
            mainPhotoUrl = item.mainPhotoUrl,
            excerpt = item.excerpt,
            createdAt = item.createdAt,
            published = item.published
        )
    }
}

data class GenerateUploadUrlRequest(
    val newsId: String,
    val fileName: String,
    val contentType: String,
    val isGallery: Boolean = false
)

data class GenerateUploadUrlResponse(
    val uploadUrl: String,
    val cdnUrl: String,
    val key: String
)

data class CreateNewsRequest(
    val title: String,
    val mainPhotoUrl: String,
    val contentHtml: String = "",
    val excerpt: String? = null,
    val galleryPhotos: List<String> = emptyList(),
    val published: Boolean = true
)

data class UpdateNewsRequest(
    val title: String? = null,
    val mainPhotoUrl: String? = null,
    val contentHtml: String? = null,
    val excerpt: String? = null,
    val galleryPhotos: List<String>? = null,
    val published: Boolean? = null
)

object SlugGenerator {
    fun toSlug(input: String): String {
        val normalized = input.trim().lowercase()
            .replace("ą", "a")
            .replace("ć", "c")
            .replace("ę", "e")
            .replace("ł", "l")
            .replace("ń", "n")
            .replace("ó", "o")
            .replace("ś", "s")
            .replace("ź", "z")
            .replace("ż", "z")
            .replace(Regex("[^a-z0-9\\s-]"), "")
            .replace(Regex("[\\s_]+"), "-")
            .trim('-')
        return normalized.ifEmpty { "aktualnosc" }
    }

    fun extractExcerpt(contentHtml: String, maxLength: Int = 180): String {
        val plainText = contentHtml
            .replace(Regex("<[^>]*>"), " ")
            .replace(Regex("&nbsp;"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        return if (plainText.length <= maxLength) {
            plainText
        } else {
            plainText.take(maxLength).trimEnd() + "..."
        }
    }
}
