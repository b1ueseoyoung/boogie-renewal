package com.bookEatingBoogie.dreamGoblin.controller;

import com.bookEatingBoogie.dreamGoblin.DTO.CharacterDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.DeleteDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StorageDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StoryDTO;
import com.bookEatingBoogie.dreamGoblin.service.LoadingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:3100")
@RequestMapping("/mypage")
public class LoadingController {

    @Autowired
    private LoadingService loadingService;

    //보관함 내용 반환
    @GetMapping("/story")
    public StorageDTO loadStorageController() {
        return loadingService.loadStorage("user");
    }
    //캐릭터 보관함 내용 반환
    @GetMapping("/character")
    public List<CharacterDTO> loadCharacter() {
        return loadingService.loadCharacters("user");
    }

    @PostMapping("/story/delete")
    public StorageDTO deleteSelected(@RequestBody DeleteDTO delete) {
        return loadingService.deleteStory(delete.getStoryId(), "user");
    }
}
