package com.bookEatingBoogie.dreamGoblin.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SignupRequestDTO(@JsonProperty("userID") String userId, String password, String userName) {
}
