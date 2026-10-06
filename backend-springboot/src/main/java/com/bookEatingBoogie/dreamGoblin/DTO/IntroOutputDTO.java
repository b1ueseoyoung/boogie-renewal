package com.bookEatingBoogie.dreamGoblin.DTO;

import lombok.Data;

import java.util.List;

//fastAPI로부터 생성된 도입부와 삽화 이미지 url을 반환받는 DTO
@Data
public class IntroOutputDTO {
    private String intro;
    private String question;
    private List<String> options;
    private String s3_url;
    private String illustPrompt;
}
