plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}
rootProject.name = "UnitedWeb"
include(":common", ":scraper-lambda", ":core-service")