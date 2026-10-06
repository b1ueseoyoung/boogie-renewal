package com.bookEatingBoogie.dreamGoblin.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;

public record LoginRequestDTO(@JsonProperty("userID") String userId, String password) {
}
