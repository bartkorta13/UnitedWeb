import java.net.URI
import java.io.File

plugins {
    kotlin("jvm")
    id("com.gradleup.shadow") version "9.6.1"
    application
}

group = "com.united"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation(project(":common"))

    // AWS Lambda core and events
    implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
    implementation("com.amazonaws:aws-lambda-java-events:3.11.4")

    // Kotlin Coroutines & Jackson for JSON serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.16.1")

    // Testing dependencies
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testImplementation("io.mockk:mockk:1.13.10")
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass.set("com.united.LocalServerKt")
}

tasks.test {
    useJUnitPlatform {
        excludeTags("manual")
    }
}

tasks.named<com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar>("shadowJar") {
    archiveBaseName.set("core-service")
    archiveClassifier.set("all")
    archiveVersion.set("") // Removes the version number from the filename
}

tasks.register<Test>("seedRoster") {
    group = "verification"
    description = "Runs SeedRosterTest to seed DynamoDB from test resources"
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("manual")
    }
    filter {
        includeTestsMatching("com.united.seed.SeedRosterTest")
    }
}

tasks.register("downloadDynamoDbLocal") {
    group = "development"
    description = "Downloads AWS DynamoDB Local to .dynamodb/ if not already present"
    doLast {
        val destDir = rootProject.file(".dynamodb")
        val jarFile = file("$destDir/DynamoDBLocal.jar")
        if (jarFile.exists()) {
            println("DynamoDB Local is already installed in ${destDir.path}")
            return@doLast
        }
        destDir.mkdirs()
        println("Downloading DynamoDB Local from AWS Frankfurt...")
        val tarUrl = URI("https://s3.eu-central-1.amazonaws.com/dynamodb-local-frankfurt/dynamodb_local_latest.tar.gz").toURL()
        val tempFile = File.createTempFile("dynamodb_local", ".tar.gz")
        tarUrl.openStream().use { input: java.io.InputStream ->
            tempFile.outputStream().use { output: java.io.OutputStream ->
                input.copyTo(output)
            }
        }
        println("Extracting DynamoDB Local to ${destDir.path}...")
        ProcessBuilder("tar", "-xzf", tempFile.absolutePath, "-C", destDir.absolutePath)
            .inheritIO()
            .start()
            .waitFor()
        tempFile.delete()
        println("DynamoDB Local download and setup complete!")
    }
}

tasks.register<JavaExec>("startDynamoDbLocal") {
    group = "development"
    description = "Runs AWS DynamoDB Local standalone on port 8000"
    dependsOn("downloadDynamoDbLocal")
    val destDir = rootProject.file(".dynamodb")
    classpath = files("$destDir/DynamoDBLocal.jar")
    mainClass.set("com.amazonaws.services.dynamodbv2.local.main.ServerRunner")
    args = listOf("-inMemory", "-port", "8000")
    systemProperty("java.library.path", "$destDir/DynamoDBLocal_lib")
}