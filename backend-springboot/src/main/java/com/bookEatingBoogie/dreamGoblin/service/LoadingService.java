package com.bookEatingBoogie.dreamGoblin.service;

import com.bookEatingBoogie.dreamGoblin.DTO.CharacterDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StorageDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.StoryDTO;
import com.bookEatingBoogie.dreamGoblin.Repository.CharacterRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.CreationRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.StoryRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.Characters;
import com.bookEatingBoogie.dreamGoblin.model.Creation;
import com.bookEatingBoogie.dreamGoblin.model.Story;
import com.bookEatingBoogie.dreamGoblin.model.User;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.function.Function;

@Service
public class LoadingService {

    @Autowired
    private StoryRepository storyRepository;
    @Autowired
    private CharacterRepository characterRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CreationRepository creationRepository;

    public StorageDTO loadStorage(String userId) {

        // 1) 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        // 2) 유저별 스토리·캐릭터 조회 & DTO 매핑
        List<StoryDTO> stories = storyRepository.findAllByUserIdWithCharacters(userId)
                .stream()
                .map(StoryDTO::new)
                .toList();

        //List<CreationDTO> creations = creationRepository.findByCreationId(stories.getCreationId());

        List<CharacterDTO> chars = characterRepository.findByUser(user)
                .stream()
                .map(CharacterDTO::new)
                .toList();

        // 3) DTO에 담아서 반환
            return new StorageDTO(stories, chars);
    }

    public List<CharacterDTO> loadCharacters(String userId) {
        // 1) 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        return characterRepository.findByUser(user)
                .stream()
                .map(CharacterDTO::new)
                .toList();
    }

    @Transactional
    public StorageDTO deleteStory(String storyId, String userId) {
        // 없는 책과 남의 책은 같은 404로 답한다(남의 책이 있는지 알려 주지 않는다)
        Story target = storyRepository.findByStoryIdWithAllRelations(storyId)
                .filter(story -> story.getCreation().getCharacters().getUser().getUserId().equals(userId))
                .orElseThrow(() -> new GenerationException(404,
                        "{\"errorClass\":\"not_found\",\"message\":\"책을 찾을 수 없어요.\",\"retryable\":false,\"resetsAt\":null}"));

        // 관계만 끊어줌 (불필요할 경우 생략 가능)
        target.getCreation().setStory(null);

        storyRepository.delete(target);

        return loadStorage(userId);
    }

}
