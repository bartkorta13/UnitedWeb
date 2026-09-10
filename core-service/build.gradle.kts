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