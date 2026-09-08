package com.united.model


data class TeamStanding(
    val rank: Int,             // Lp.
    val teamName: String,      // Zespół
    val matchesPlayed: Int,    // Mecze
    val points: Int,           // Pkt
    val wins: Int,             // Zw.
    val setsWon: Int,          // Sety +
    val setsLost: Int,         // Sety -
    val pointsWon: Int,        // pkt +
    val pointsLost: Int        // pkt -
) {
    // Helpful computed properties for UI/stats
    val setRatio: Double
        get() = if (setsLost == 0) setsWon.toDouble() else setsWon.toDouble() / setsLost

    val pointRatio: Double
        get() = if (pointsLost == 0) pointsWon.toDouble() else pointsWon.toDouble() / pointsLost
}

data class MatchItem(
    val matchId: String,
    val date: String,
    val homeTeamName: String,
    val awayTeamName: String,
    val score: String,
    val isFinished: Boolean
)

data class LeagueData(
    val standings: List<TeamStanding>,
    val matches: List<MatchItem>
)