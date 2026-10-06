package com.bookEatingBoogie.dreamGoblin.DTO;

import lombok.Data;

//동화 도입부 생성을 위해 fastAPI에 보내는 파라미터 DTO
@Data
public class IntroInfoDTO {
    private String charName;
    private String charLook;
    private String genre;
    private String place;
    private String imgUrl;
    private String charImgUrl;
}
