package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.DTO.CharacterOutputDTO;
import com.bookEatingBoogie.dreamGoblin.service.FastApiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// 테스트 전용: FastApiClient.post를 부르고 예외를 그대로 내보낸다.
@RestController
public class TestGenerationController {

    @Autowired
    private FastApiClient fastApiClient;

    @PostMapping("/test-only/generate")
    public CharacterOutputDTO generate(@RequestBody Map<String, Object> body) {
        return fastApiClient.post("/generate/character/", body, CharacterOutputDTO.class);
    }
}
