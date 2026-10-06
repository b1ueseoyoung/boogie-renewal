package com.bookEatingBoogie.dreamGoblin.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

//도입부 제외, 나머지 부분(엔딩 제외)에 대하여 프론트에 값을 전달하기 위한 DTO
@Data
public class StoryReturnDTO {
    private String story;
    private String question;
    private List<String> choices;
    private String s3_url;
    // FastAPI 응답에서 읽기만 하고 화면 응답에는 싣지 않는다.
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String illustPrompt;
}
