plugins {
    kotlin("jvm") version "2.4.10"
}

dependencies {
    // AWS SDK for Kotlin (DynamoDB)
    implementation("aws.sdk.kotlin:dynamodb:1.0.60")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")

    // Jackson for serialization if needed
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.16.1")
}