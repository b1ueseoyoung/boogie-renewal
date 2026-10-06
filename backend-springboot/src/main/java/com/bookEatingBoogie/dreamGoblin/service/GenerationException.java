package com.bookEatingBoogie.dreamGoblin.service;

import lombok.Getter;

// FastAPI가 돌려준 상태 코드와 본문(C-2)을 화면까지 그대로 넘기기 위한 예외.
@Getter
public class GenerationException extends RuntimeException {

    private final int status;
    private final String body;

    public GenerationException(int status, String body) {
        super("generation failed: " + status);
        this.status = status;
        this.body = body;
    }
}
