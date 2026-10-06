package com.bookEatingBoogie.dreamGoblin.service;

import com.bookEatingBoogie.dreamGoblin.DTO.CandidateDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.CharacterOutputDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.CharacterRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.CharacterReturnDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.FeatureCardDTO;
import com.bookEatingBoogie.dreamGoblin.Repository.CharacterCandidateRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.CharacterRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.CharacterCandidate;
import com.bookEatingBoogie.dreamGoblin.model.Characters;
import com.bookEatingBoogie.dreamGoblin.model.User;
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
public class CharacterGenerationService {

    private static final int MAX_CANDIDATES = 3;

    @Autowired
    private FastApiClient fastApiClient;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private CharacterRepository characterRepository;
    @Autowired
    private CharacterCandidateRepository candidateRepository;
    @Autowired
    private UserRepository userRepository;

    //캐릭터와 첫 후보를 만든다. charLook은 승인 전까지 null이다.
    @Transactional
    public CharacterReturnDTO generateSaveCharacter(CharacterRequestDTO request, String userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        if (characterRepository.existsByUserAndCharName(user, request.getCharName())) {
            throw failure(409, "duplicate_name", "같은 이름의 주인공이 이미 있어요. 다른 이름을 써 주세요.");
        }

        //생성이 실패하면 예외가 나가고 아무 행도 저장하지 않는다.
        String imgUrl = generateCharacter(request.getUserImg());

        Characters characters = new Characters();
        characters.setUser(user);
        characters.setCharName(request.getCharName());
        characters.setUserImg(request.getUserImg());
        characters.setCharImg(imgUrl);
        characterRepository.save(characters);

        CharacterCandidate candidate = saveCandidate(characters, imgUrl);

        CharacterReturnDTO returnDTO = new CharacterReturnDTO();
        returnDTO.setCharId(characters.getCharId());
        returnDTO.setCharImg(imgUrl);
        returnDTO.setCandidateId(candidate.getCandidateId());
        returnDTO.setCandidates(List.of(new CandidateDTO(candidate.getCandidateId(), imgUrl, null)));
        return returnDTO;
    }

    @Transactional(readOnly = true)
    public List<CandidateDTO> listCandidates(int charId, String userId) {
        return candidateRepository.findByCharactersOrderByCandidateIdAsc(findCharacter(charId, userId)).stream()
                .map(c -> new CandidateDTO(c.getCandidateId(), c.getImgUrl(), c.isApproved()))
                .toList();
    }

    //후보를 하나 더 만든다. 대표 그림(charImg)은 승인 때만 바뀐다.
    @Transactional
    public CandidateDTO regenerateCandidate(int charId, String userId) {
        Characters characters = findCharacter(charId, userId);
        if (candidateRepository.countByCharacters(characters) >= MAX_CANDIDATES) {
            throw failure(409, "candidate_limit", "후보는 세 개까지 만들 수 있어요. 이 중에서 골라 주세요.");
        }
        String imgUrl = generateCharacter(characters.getUserImg());
        CharacterCandidate candidate = saveCandidate(characters, imgUrl);
        return new CandidateDTO(candidate.getCandidateId(), imgUrl, null);
    }

    //후보를 승인한다. 이미 승인된 후보면 FastAPI를 부르지 않고 저장된 값을 돌려준다.
    @Transactional
    public Map<String, Object> approveCandidate(int charId, int candidateId, String userId) {
        Characters characters = findCharacter(charId, userId);
        CharacterCandidate candidate = candidateRepository.findById(candidateId)
                .filter(c -> c.getCharacters().getCharId() == charId)
                .orElseThrow(() -> failure(404, "not_found", "후보를 찾을 수 없어요."));

        if (!candidate.isApproved()) {
            Map<String, String> body = Map.of("imgUrl", characters.getUserImg(), "charImgUrl", candidate.getImgUrl());
            String charLook = fastApiClient.post("/generate/feature-card/", body, FeatureCardDTO.class).getCharLook();

            for (CharacterCandidate c : candidateRepository.findByCharactersOrderByCandidateIdAsc(characters)) {
                c.setApproved(c.getCandidateId() == candidateId);
            }
            characters.setCharImg(candidate.getImgUrl());
            characters.setCharLook(charLook);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("charId", characters.getCharId());
        result.put("charImg", characters.getCharImg());
        result.put("charLook", characters.getCharLook());
        return result;
    }

    //다른 사람의 캐릭터도 없는 캐릭터와 똑같이 404로 답한다.
    private Characters findCharacter(int charId, String userId) {
        return userRepository.findById(userId)
                .flatMap(user -> characterRepository.findByCharIdAndUser(charId, user))
                .orElseThrow(() -> failure(404, "not_found", "주인공을 찾을 수 없어요."));
    }

    private String generateCharacter(String userImg) {
        return fastApiClient.post("/generate/character/", Map.of("imgUrl", userImg), CharacterOutputDTO.class)
                .getS3_url();
    }

    private CharacterCandidate saveCandidate(Characters characters, String imgUrl) {
        CharacterCandidate candidate = new CharacterCandidate();
        candidate.setCharacters(characters);
        candidate.setImgUrl(imgUrl);
        return candidateRepository.save(candidate);
    }

    //C-2 본문을 가진 예외. GenerationExceptionHandler가 그대로 응답으로 만든다.
    private GenerationException failure(int status, String errorClass, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("errorClass", errorClass);
        body.put("message", message);
        body.put("retryable", false);
        body.put("resetsAt", null);
        try {
            return new GenerationException(status, objectMapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
