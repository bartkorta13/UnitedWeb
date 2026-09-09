package com.united.handler

import com.united.model.ScoreParser
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ScoreParserTest {

    @Test
    fun `should parse python-style list of sets from score field`() {
        val score = "['25:21', '25:16', '19:25', '14:25', '15:8']"
        val sets = ScoreParser.parseSets(score)

        assertEquals(listOf("25:21", "25:16", "19:25", "14:25", "15:8"), sets)
    }

    @Test
    fun `should parse parenthesized sets from score field`() {
        val score = "3:2 (25:21, 25:16, 19:25, 14:25, 15:8)"
        val sets = ScoreParser.parseSets(score)

        assertEquals(listOf("25:21", "25:16", "19:25", "14:25", "15:8"), sets)
    }

    @Test
    fun `should parse comma separated sets without brackets`() {
        val score = "25:21, 25:16, 19:25, 14:25, 15:8"
        val sets = ScoreParser.parseSets(score)

        assertEquals(listOf("25:21", "25:16", "19:25", "14:25", "15:8"), sets)
    }

    @Test
    fun `should return empty sets for match-only score`() {
        assertEquals(emptyList<String>(), ScoreParser.parseSets("3:2"))
        assertEquals(emptyList<String>(), ScoreParser.parseSets("3:0"))
        assertEquals(emptyList<String>(), ScoreParser.parseSets("0:0"))
        assertEquals(emptyList<String>(), ScoreParser.parseSets(""))
        assertEquals(emptyList<String>(), ScoreParser.parseSets(null))
    }

    @Test
    fun `should resolve match score from finalScore or sets`() {
        val sets = listOf("25:21", "25:16", "19:25", "14:25", "15:8")

        // When rawFinalScore is 3:2
        assertEquals("3:2", ScoreParser.resolveMatchScore("3:2", "['25:21', ...]", sets))

        // When rawFinalScore is null/empty and score is bracketed sets
        assertEquals("3:2", ScoreParser.resolveMatchScore(null, "['25:21', '25:16', '19:25', '14:25', '15:8']", sets))

        // When rawScore is "3:2 (25:21, ...)"
        assertEquals("3:2", ScoreParser.resolveMatchScore(null, "3:2 (25:21, 25:16, 19:25, 14:25, 15:8)", sets))

        // When match score without sets
        assertEquals("3:0", ScoreParser.resolveMatchScore("3:0", "3:0", emptyList()))
    }

    @Test
    fun `should compute score from sets accurately`() {
        val sets32 = listOf("25:21", "25:16", "19:25", "14:25", "15:8")
        assertEquals("3:2", ScoreParser.computeScoreFromSets(sets32))

        val sets30 = listOf("25:18", "25:20", "25:15")
        assertEquals("3:0", ScoreParser.computeScoreFromSets(sets30))

        val sets13 = listOf("20:25", "25:22", "19:25", "21:25")
        assertEquals("1:3", ScoreParser.computeScoreFromSets(sets13))
    }
}
