package com.bookEatingBoogie.dreamGoblin.service;

import com.bookEatingBoogie.dreamGoblin.DTO.*;
import com.bookEatingBoogie.dreamGoblin.Repository.*;
import com.bookEatingBoogie.dreamGoblin.model.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// ponytail: FastAPI 호출이 트랜잭션 안에 있어 생성 동안 DB 연결 하나를 잡는다. 사용자가 늘면 호출을 트랜잭션 밖으로 뺀다.
@Service
public class StoryGenerationService {

    @Autowired
    private FastApiClient fastApiClient;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private CreationRepository creationRepository;
    @Autowired
    private CharacterRepository characterRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StoryRepository storyRepository;
    @Autowired
    private StyleRepository styleRepository;
    @Autowired
    private SceneRepository sceneRepository;

    //동화 도입부 생성. 성공하면 creation과 scene(page 0)을 저장한다.
    @Transactional
    public IntroReturnDTO generateSaveIntro(IntroRequestDTO storyRequest, String userId) {

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));
        Characters characters = characterRepository.findByCharIdAndUser(storyRequest.getCharId(),user)
                .orElseThrow(() -> failure(404, "not_found", "주인공을 찾을 수 없어요."));
        Style genre = styleRepository.findById(storyRequest.getGenre())
                .orElseThrow(() -> new IllegalArgumentException("해당 장르가 존재하지 않습니다."));
        Style place = styleRepository.findById(storyRequest.getPlace())
                .orElseThrow(() -> new IllegalArgumentException("해당 배경이 존재하지 않습니다."));

        if (characters.getCharLook() == null) {
            throw failure(409, "character_not_approved", "먼저 캐릭터를 골라 주세요.");
        }

        //fast api로 전송할 값 dto에 넣기
        IntroInfoDTO storyInfo = new IntroInfoDTO();
        storyInfo.setCharName(characters.getCharName());
        storyInfo.setGenre(storyRequest.getGenre());
        storyInfo.setPlace(storyRequest.getPlace());
        storyInfo.setImgUrl(characters.getUserImg());
        storyInfo.setCharImgUrl(characters.getCharImg());
        storyInfo.setCharLook(characters.getCharLook());

        //동화 도입부 생성 요청. 실패하면 예외가 나가고 아무 행도 저장하지 않는다.
        IntroOutputDTO response = fastApiClient.post("/generate/intro/", storyInfo, IntroOutputDTO.class);

        Creation creation = new Creation();
        creation.setCharacters(characters);
        creation.setGenre(genre);
        creation.setPlace(place);
        creationRepository.save(creation);

        saveScene(creation, 0, null, response.getIntro(), response.getQuestion(),
                response.getOptions(), response.getS3_url(), response.getIllustPrompt());

        IntroReturnDTO returnDTO = new IntroReturnDTO();
        returnDTO.setCreationId(creation.getCreationId());
        returnDTO.setStory(response.getIntro());
        returnDTO.setQuestion(response.getQuestion());
        returnDTO.setChoices(response.getOptions());
        returnDTO.setImgUrl(response.getS3_url());
        return returnDTO;
    }

    //다음 장면 생성. 저장된 장면 수가 1~4면 중간부(StoryReturnDTO), 5면 결말({"contentUrl","title"})을 돌려준다.
    @Transactional
    public Object generateNext(String choice, String userId) {
        Creation creation = creationRepository.findLatestWithoutStory(userId).orElse(null);
        long page = creation == null ? 0 : sceneRepository.countByCreation(creation);
        if (page < 1 || page > 5) {
            throw failure(400, "no_active_story", "진행 중인 이야기가 없어요. 처음부터 다시 시작해 주세요.");
        }

        List<Scene> scenes = sceneRepository.findByCreationOrderByPageAsc(creation);
        Characters characters = creation.getCharacters();

        Map<String, Object> request = new HashMap<>();
        request.put("charName", characters.getCharName());
        request.put("charLook", characters.getCharLook());
        request.put("imgUrl", characters.getUserImg());
        request.put("charImgUrl", characters.getCharImg());
        request.put("question", scenes.get(scenes.size() - 1).getQuestion());
        request.put("choice", choice);
        request.put("story", scenes.stream().map(Scene::getStory).toList());

        if (page < 5) {
            request.put("page", page);
            StoryReturnDTO response = fastApiClient.post("/generate/content/", request, StoryReturnDTO.class);
            saveScene(creation, (int) page, choice, response.getStory(), response.getQuestion(),
                    response.getChoices(), response.getS3_url(), response.getIllustPrompt());
            return response;
        }

        String storyId = Story.newId();
        request.put("storyId", storyId);
        request.put("illustUrls", scenes.stream().map(Scene::getIllustUrl).toList());
        StoryFinishDTO response = fastApiClient.post("/generate/story/", request, StoryFinishDTO.class);

        StoryFinishDTO.Ending ending = response.getEnding();
        saveScene(creation, 5, choice, ending.getStory(), null, null, ending.getS3_url(), ending.getIllustPrompt());

        Story story = new Story();
        story.setStoryId(storyId);
        story.setCreation(creation);
        story.setContent(response.getContentUrl());
        story.setTitle(response.getTitle());
        story.setSummary(response.getSummary());
        story.setCoverImg(response.getCoverImg());
        storyRepository.save(story);

        return Map.of("contentUrl", response.getContentUrl(), "title", response.getTitle());
    }

    private void saveScene(Creation creation, int page, String choice, String story, String question,
                           List<String> choices, String illustUrl, String illustPrompt) {
        Scene scene = new Scene();
        scene.setCreation(creation);
        scene.setPage(page);
        scene.setChoice(choice);
        scene.setStory(story);
        scene.setQuestion(question);
        scene.setChoices(toJson(choices));
        scene.setIllustUrl(illustUrl);
        scene.setIllustPrompt(illustPrompt);
        sceneRepository.save(scene);
    }

    private String toJson(Object value) {
        try {
            return value == null ? null : objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    //C-2 본문을 가진 예외. GenerationExceptionHandler가 그대로 응답으로 만든다.
    private GenerationException failure(int status, String errorClass, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("errorClass", errorClass);
        body.put("message", message);
        body.put("retryable", false);
        body.put("resetsAt", null);
        return new GenerationException(status, toJson(body));
    }
}
