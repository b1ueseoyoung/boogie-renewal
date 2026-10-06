package com.bookEatingBoogie.dreamGoblin.DTO;

import lombok.Data;

//fastApi로부터 캐릭터 생성 요청 후 반환값을 받는 DTO
@Data
public class CharacterOutputDTO {
    private String s3_url;
    //선택 값: /generate/character/ 응답에는 없다(null). 특징 문장은 승인 때 FeatureCardDTO로 받는다.
    private String charLook;
}
