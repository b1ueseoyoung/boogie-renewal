package com.bookEatingBoogie.dreamGoblin.DTO;

import lombok.Data;

//fastAPI의 /generate/story/ 응답(결말 장면과 완성본 정보)을 받는 DTO
@Data
public class StoryFinishDTO {
    private String contentUrl;
    private String title;
    private String summary;
    private String coverImg;
    private Ending ending;

    @Data
    public static class Ending {
        private String story;
        private String s3_url;
        private String illustPrompt;
    }
}
