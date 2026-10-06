package com.bookEatingBoogie.dreamGoblin.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;

//캐릭터 후보 한 개. approved는 후보 목록 조회에서만 채운다(null이면 응답에서 빠진다).
@Data
@AllArgsConstructor
public class CandidateDTO {
    private int candidateId;
    private String imgUrl;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean approved;
}
