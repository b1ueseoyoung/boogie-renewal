package com.bookEatingBoogie.dreamGoblin.controller;

import com.bookEatingBoogie.dreamGoblin.DTO.IntroRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StoryRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StoryReturnDTO;
import com.bookEatingBoogie.dreamGoblin.service.StoryGenerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// 생성 실패(GenerationException)는 잡지 않는다: GenerationExceptionHandler가 상태 코드와 본문을 그대로 응답으로 만든다.
@RestController
@CrossOrigin(origins = "http://localhost:3100")
public class StoryGenerationController {

    @Autowired
    private StoryGenerationService storyGenerationService;

    //도입부 생성 컨트롤러
    @PostMapping("/intro")
    public ResponseEntity<?> requestIntro(@RequestBody IntroRequestDTO request) {
        //동화 도입부, 질문, 선택지, creationId, 삽화 이미지 경로 반환.
        return ResponseEntity.ok(storyGenerationService.generateSaveIntro(request, "user"));
    }

    //중간부 및 엔딩(생성 후 정제) 생성 컨트롤러. 몇 번째 장면인지는 서비스가 DB의 장면 수로 정한다.
    @PostMapping("/story")
    public ResponseEntity<?> requestStory(@RequestBody StoryRequestDTO request) {
        if (request.getChoice() == null) { return ResponseEntity.badRequest().build();}

        Object response = storyGenerationService.generateNext(request.getChoice(), "user");
        //중간부면 200, 결말이면 201.
        HttpStatus status = response instanceof StoryReturnDTO ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(response);
    }
}
