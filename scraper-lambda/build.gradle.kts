plugins {
    kotlin("jvm")
    id("com.gradleup.shadow") version "9.6.1"
}

group = "com.united"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    // HTML Scraping
    implementation("org.jsoup:jsoup:1.18.1")

    // AWS SDK for Kotlin (DynamoDB)
    implementation("aws.sdk.kotlin:dynamodb:1.0.60")

    // Coroutines & Logging
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.slf4j:slf4j-simple:2.0.12")

    // AWS Lambda Java Runtime
    implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
    implementation("com.amazonaws:aws-lambda-java-events:3.11.4")
}


kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}

tasks.shadowJar {
    archiveBaseName.set("united-scraper")
    archiveClassifier.set("")
    archiveVersion.set("")
}