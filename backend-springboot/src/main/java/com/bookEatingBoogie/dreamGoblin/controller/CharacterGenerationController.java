package com.bookEatingBoogie.dreamGoblin.controller;

import com.bookEatingBoogie.dreamGoblin.DTO.ApproveRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.CharacterRequestDTO;
import com.bookEatingBoogie.dreamGoblin.service.CharacterGenerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// 생성 실패(GenerationException)는 잡지 않는다: GenerationExceptionHandler가 상태 코드와 본문을 그대로 응답으로 만든다.
@RestController
@CrossOrigin(origins = "http://localhost:3100")
public class CharacterGenerationController {

    @Autowired
    private CharacterGenerationService characterGenerationService;

    //캐릭터와 첫 후보 생성
    @PostMapping("/character")
    public ResponseEntity<?> requestCharacter(@RequestBody CharacterRequestDTO character) {
        return ResponseEntity.ok(characterGenerationService.generateSaveCharacter(character));
    }

    @GetMapping("/character/{charId}/candidates")
    public ResponseEntity<?> listCandidates(@PathVariable int charId) {
        return ResponseEntity.ok(characterGenerationService.listCandidates(charId));
    }

    //후보 다시 만들기(3개까지)
    @PostMapping("/character/{charId}/candidates")
    public ResponseEntity<?> regenerateCandidate(@PathVariable int charId) {
        return ResponseEntity.ok(characterGenerationService.regenerateCandidate(charId));
    }

    @PostMapping("/character/{charId}/approve")
    public ResponseEntity<?> approveCandidate(@PathVariable int charId, @RequestBody ApproveRequestDTO request) {
        if (request.getCandidateId() == null) { return ResponseEntity.badRequest().build();}
        return ResponseEntity.ok(characterGenerationService.approveCandidate(charId, request.getCandidateId()));
    }
}
