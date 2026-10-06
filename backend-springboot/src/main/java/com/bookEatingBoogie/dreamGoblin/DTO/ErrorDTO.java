package com.bookEatingBoogie.dreamGoblin.DTO;

// C-2 오류 본문 {"errorClass","message","retryable","resetsAt"}.
public record ErrorDTO(String errorClass, String message, boolean retryable, Long resetsAt) {

    public static ErrorDTO of(String errorClass, String message) {
        return new ErrorDTO(errorClass, message, false, null);
    }

    public static ErrorDTO authRequired() {
        return of("auth_required", "로그인이 필요해요.");
    }
}
