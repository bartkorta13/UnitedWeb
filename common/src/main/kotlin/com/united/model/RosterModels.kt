package com.united.model

enum class PlayerPosition(val displayNamePl: String, val sortOrder: Int) {
    SETTER("Rozgrywający", 1),
    OUTSIDE("Przyjmujący", 2),
    OPPOSITE("Atakujący", 3),
    MIDDLE("Środkowy", 4),
    LIBERO("Libero", 5),
    COACH("Trener", 6);

    companion object {
        fun fromString(value: String?): PlayerPosition {
            if (value.isNullOrBlank()) return OUTSIDE
            return entries.firstOrNull { it.name.equals(value.trim(), ignoreCase = true) }
                ?: when (value.trim().lowercase()) {
                    "rozgrywający", "rozgrywajacy", "setter" -> SETTER
                    "przyjmujący", "przyjmujacy", "outside" -> OUTSIDE
                    "atakujący", "atakujacy", "opposite" -> OPPOSITE
                    "środkowy", "srodkowy", "middle" -> MIDDLE
                    "libero" -> LIBERO
                    "trener", "szkoleniowiec", "coach" -> COACH
                    else -> OUTSIDE
                }
        }
    }
}

data class PlayerItem(
    val id: String,
    val firstName: String,
    val lastName: String,
    val position: PlayerPosition,
    val number: Int,
    val height: Int? = null,        // w cm
    val attackRange: Int? = null,   // w cm
    val age: Int? = null,
    val isCaptain: Boolean = false
) {
    val fullName: String
        get() = "$firstName $lastName"
}
