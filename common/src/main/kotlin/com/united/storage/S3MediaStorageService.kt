package com.united.storage

import aws.sdk.kotlin.services.s3.S3Client
import aws.sdk.kotlin.services.s3.model.PutObjectRequest
import aws.sdk.kotlin.services.s3.presigners.presignPutObject
import com.united.model.GenerateUploadUrlRequest
import com.united.model.GenerateUploadUrlResponse
import java.util.UUID
import kotlin.time.Duration.Companion.minutes

class S3MediaStorageService(
    private val bucketName: String = System.getenv("ASSETS_S3_BUCKET") ?: "united-league-assets",
    private val cdnBaseUrl: String = System.getenv("ASSETS_CDN_URL") ?: "https://d1rm5h55nlqrob.cloudfront.net"
) {

    /**
     * Generates an AWS S3 Pre-signed URL allowing the client (browser) to upload
     * a photo directly to S3 via HTTP PUT without passing binary data through Lambda.
     *
     * The photo will be stored in S3 under `assets/news/{newsId}/{folder}/{filename}`
     * and will be served publicly via CloudFront at `{cdnBaseUrl}/news/{newsId}/{folder}/{filename}`.
     */
    suspend fun generatePresignedUploadUrl(request: GenerateUploadUrlRequest): GenerateUploadUrlResponse {
        val sanitizedNewsId = request.newsId.trim().lowercase().replace(Regex("[^a-z0-9_-]"), "-")
        val extension = request.fileName.substringAfterLast('.', "jpg").lowercase().replace(Regex("[^a-z0-9]"), "")
        val uniqueId = UUID.randomUUID().toString().take(8)

        val folder = if (request.isGallery) "gallery" else "main"
        val fileName = if (request.isGallery) "$uniqueId.$extension" else "main-$uniqueId.$extension"
        val s3Key = "assets/news/$sanitizedNewsId/$folder/$fileName"

        val putRequest = PutObjectRequest {
            bucket = bucketName
            key = s3Key
            contentType = request.contentType
        }

        val presignedUrl = S3Client.fromEnvironment().use { s3 ->
            val presigned = s3.presignPutObject(putRequest, 15.minutes)
            presigned.url.toString()
        }

        val cleanCdn = cdnBaseUrl.trimEnd('/')
        val cdnUrl = "$cleanCdn/news/$sanitizedNewsId/$folder/$fileName"

        return GenerateUploadUrlResponse(
            uploadUrl = presignedUrl,
            cdnUrl = cdnUrl,
            key = s3Key
        )
    }
}
