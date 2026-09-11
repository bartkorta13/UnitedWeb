package com.united

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import com.united.handler.ApiLambdaHandler
import com.united.handler.ApiRequest
import java.net.InetSocketAddress
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val handler = ApiLambdaHandler()
    val server = HttpServer.create(InetSocketAddress(port), 0)

    server.createContext("/") { exchange: HttpExchange ->
        try {
            // Handle CORS Preflight
            exchange.responseHeaders.add("Access-Control-Allow-Origin", "*")
            exchange.responseHeaders.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            exchange.responseHeaders.add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

            if (exchange.requestMethod.equals("OPTIONS", ignoreCase = true)) {
                exchange.sendResponseHeaders(204, -1)
                exchange.close()
                return@createContext
            }

            val rawUri = exchange.requestURI
            val path = rawUri.path
            val rawQuery = rawUri.rawQuery

            val queryParams = rawQuery?.split("&")?.filter { it.isNotBlank() }?.associate {
                val parts = it.split("=", limit = 2)
                val key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8)
                val value = if (parts.size > 1) URLDecoder.decode(parts[1], StandardCharsets.UTF_8) else ""
                key to value
            }

            val headers = exchange.requestHeaders.entries.associate { (k, v) ->
                k to v.joinToString(", ")
            }

            val body = exchange.requestBody.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }

            val apiRequest = ApiRequest().apply {
                this.rawPath = path
                this.path = path
                this.httpMethod = exchange.requestMethod
                this.queryStringParameters = queryParams
                this.headers = headers
                this.body = body.takeIf { it.isNotBlank() }
            }

            val apiResponse = handler.handleRequest(apiRequest, null)

            apiResponse.headers.forEach { (key, value) ->
                exchange.responseHeaders.set(key, value)
            }
            // Ensure CORS is set even if not present in handler response
            if (!exchange.responseHeaders.containsKey("Access-Control-Allow-Origin")) {
                exchange.responseHeaders.set("Access-Control-Allow-Origin", "*")
            }

            val responseBytes = apiResponse.body.toByteArray(StandardCharsets.UTF_8)
            exchange.sendResponseHeaders(apiResponse.statusCode, responseBytes.size.toLong())
            exchange.responseBody.use { it.write(responseBytes) }
        } catch (e: Exception) {
            val errorJson = """{"error": "${e.message?.replace("\"", "\\\"")}"}"""
            val bytes = errorJson.toByteArray(StandardCharsets.UTF_8)
            exchange.responseHeaders.set("Content-Type", "application/json")
            exchange.responseHeaders.set("Access-Control-Allow-Origin", "*")
            exchange.sendResponseHeaders(500, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
    }

    println("=========================================================")
    println("🚀 UnitedWeb Local Core API running on http://localhost:$port")
    println("   Endpoints available:")
    println("   - http://localhost:$port/standings")
    println("   - http://localhost:$port/fixtures")
    println("   - http://localhost:$port/fixtures/United_%C5%9Aroda_%C5%9Al%C4%85ska")
    println("   - http://localhost:$port/results")
    println("   - http://localhost:$port/results/United_%C5%9Aroda_%C5%9Al%C4%85ska")
    println("   - http://localhost:$port/roster")
    println("   - http://localhost:$port/news")
    println("   - http://localhost:$port/news/{id}")
    println("   - [ADMIN] GET    http://localhost:$port/admin/news")
    println("   - [ADMIN] POST   http://localhost:$port/admin/news")
    println("   - [ADMIN] PUT    http://localhost:$port/admin/news/{id}")
    println("   - [ADMIN] DELETE http://localhost:$port/admin/news/{id}")
    println("   - [ADMIN] POST   http://localhost:$port/admin/news/upload-url")
    println("=========================================================")

    server.start()
}
