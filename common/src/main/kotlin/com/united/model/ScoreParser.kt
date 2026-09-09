package com.united.model

object ScoreParser {

    private val SET_REGEX = Regex("""(\d{1,3})\s*:\s*(\d{1,3})""")
    private val MATCH_SCORE_REGEX = Regex("""^([0-3])\s*:\s*([0-3])$""")

    /**
     * Extracts individual set scores (e.g. ["25:21", "25:16", ...]) from an input string.
     * Supports:
     * - Python-style or JSON-style list: "['25:21', '25:16', '19:25', '14:25', '15:8']"
     * - Parenthesized details: "3:2 (25:21, 25:16, 19:25, 14:25, 15:8)"
     * - Comma / semicolon / space separated: "25:21, 25:16, 19:25, 14:25, 15:8"
     */
    fun parseSets(input: String?): List<String> {
        if (input.isNullOrBlank()) return emptyList()

        val trimmed = input.trim()

        // 1. If it has parentheses like "3:2 (25:21, 25:16, ...)", extract inside parentheses
        val parenMatch = Regex("""\(([^)]+)\)""").find(trimmed)
        if (parenMatch != null) {
            val insideParens = parenMatch.groupValues[1]
            val setMatches = SET_REGEX.findAll(insideParens)
                .map { "${it.groupValues[1]}:${it.groupValues[2]}" }
                .toList()
            if (setMatches.isNotEmpty()) {
                return setMatches
            }
        }

        // 2. Find all "H:A" patterns
        val allMatches = SET_REGEX.findAll(trimmed)
            .map { "${it.groupValues[1]}:${it.groupValues[2]}" }
            .toList()
        if (allMatches.isEmpty()) return emptyList()

        // If there's only 1 match: is it a match score (e.g. "3:2", "3:0") or a set score?
        if (allMatches.size == 1) {
            val single = allMatches[0]
            val parts = single.split(":")
            val h = parts[0].toIntOrNull() ?: 0
            val a = parts[1].toIntOrNull() ?: 0
            // In volleyball, match scores are <= 3 (e.g. 3:1, 3:2, 0:3). Sets require at least 15 or 25 points.
            if (h <= 3 && a <= 3) {
                // It's a match score, not a set score
                return emptyList()
            }
            return listOf(single)
        }

        // If there are multiple matches, check if the first one is the overall match score (e.g. "3:2" followed by sets)
        val firstParts = allMatches[0].split(":")
        val firstH = firstParts[0].toIntOrNull() ?: 0
        val firstA = firstParts[1].toIntOrNull() ?: 0

        if (firstH <= 3 && firstA <= 3 && (firstH == 3 || firstA == 3) && allMatches.size > 2) {
            val remaining = allMatches.drop(1)
            // Verify remaining are plausible set scores (at least one has points > 3)
            if (remaining.any {
                val p = it.split(":")
                (p[0].toIntOrNull() ?: 0) > 3 || (p[1].toIntOrNull() ?: 0) > 3
            }) {
                return remaining
            }
        }

        return allMatches
    }

    /**
     * Resolves the clean match score (e.g. "3:2") from finalScore, score, and sets.
     */
    fun resolveMatchScore(
        rawFinalScore: String?,
        rawScore: String?,
        sets: List<String>
    ): String {
        val cleanFinal = extractCleanScore(rawFinalScore)
        if (cleanFinal != null) return cleanFinal

        val cleanScore = extractCleanScore(rawScore)
        if (cleanScore != null) return cleanScore

        val computedFromSets = computeScoreFromSets(sets)
        if (computedFromSets != null) return computedFromSets

        return rawFinalScore?.takeIf { it.isNotBlank() }
            ?: rawScore?.takeIf { it.isNotBlank() }
            ?: ""
    }

    private fun extractCleanScore(str: String?): String? {
        if (str.isNullOrBlank()) return null
        val trimmed = str.trim()
        val match = MATCH_SCORE_REGEX.find(trimmed)
        if (match != null) {
            return "${match.groupValues[1]}:${match.groupValues[2]}"
        }
        val leadingMatch = Regex("""^([0-3])\s*:\s*([0-3])(?:\s*\(.*)?$""").find(trimmed)
        if (leadingMatch != null) {
            return "${leadingMatch.groupValues[1]}:${leadingMatch.groupValues[2]}"
        }
        return null
    }

    fun computeScoreFromSets(sets: List<String>): String? {
        if (sets.isEmpty()) return null
        var homeWins = 0
        var awayWins = 0
        for (set in sets) {
            val parts = set.split(":")
            if (parts.size == 2) {
                val h = parts[0].trim().toIntOrNull() ?: continue
                val a = parts[1].trim().toIntOrNull() ?: continue
                if (h > a) homeWins++
                else if (a > h) awayWins++
            }
        }
        return if (homeWins > 0 || awayWins > 0) "$homeWins:$awayWins" else null
    }
}
