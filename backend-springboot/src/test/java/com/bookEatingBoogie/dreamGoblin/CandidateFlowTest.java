package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.Repository.StyleRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.Style;
import com.bookEatingBoogie.dreamGoblin.model.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// 캐릭터 후보 흐름: 생성, 재생성(3개까지), 승인이 characters와 character_candidate 행으로 남는지 DB에서 확인한다.
// 테스트마다 새 이름의 캐릭터를 만들고 그 charId의 행만 세므로 실행 순서나 다른 테스트의 행에 기대지 않는다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CandidateFlowTest {

    private static final String BASE = "http://localhost:8000";
    private static final String PHOTO = BASE + "/files/uploads/photo.jpg";
    private static final String USER_ID = "candidate_tester";
    private static final String LOOK = "A child with short black hair. Wearing a blue T-shirt.";
    private static final String DECLINED_BODY =
            "{\"errorClass\":\"declined\",\"message\":\"m\",\"retryable\":false,\"resetsAt\":null}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private RestTemplate restTemplate;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StyleRepository styleRepository;

    private MockRestServiceServer server;
    private String name;

    @BeforeEach
    void setUp() {
        if (userRepository.findByUserId(USER_ID).isEmpty()) {
            User u = new User();
            u.setUserId(USER_ID);
            u.setPassword("unused");
            u.setUserName("후보테스트");
            userRepository.save(u);
        }
        seedStyle("magic", "genre");
        seedStyle("space", "place");
        name = "후보-" + UUID.randomUUID();
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    private void seedStyle(String id, String type) {
        if (styleRepository.findByStyle(id).isEmpty()) {
            Style style = new Style();
            style.setStyle(id);
            style.setStyleType(type);
            styleRepository.save(style);
        }
    }

    private static String img(int n) {
        return BASE + "/files/character/c" + n + ".png";
    }

    // n번째 후보 생성: 요청은 사진 주소를 싣고 오고, 응답에는 charLook이 없다.
    private void expectGenerate(int n) {
        server.expect(requestTo(BASE + "/generate/character/")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.imgUrl").value(PHOTO))
                .andRespond(withSuccess("{\"s3_url\":\"" + img(n) + "\"}", MediaType.APPLICATION_JSON));
    }

    private void expectFeatureCard(int n) {
        server.expect(requestTo(BASE + "/generate/feature-card/")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.imgUrl").value(PHOTO))
                .andExpect(jsonPath("$.charImgUrl").value(img(n)))
                .andRespond(withSuccess(objectMapperJson(Map.of("charLook", LOOK)), MediaType.APPLICATION_JSON));
    }

    private String objectMapperJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private MockHttpServletResponse call(String path, String json) throws Exception {
        return mockMvc.perform(post(path).sessionAttr("userId", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andReturn().getResponse();
    }

    private MockHttpServletResponse create() throws Exception {
        return call("/character", objectMapperJson(Map.of("charName", name, "userImg", PHOTO)));
    }

    private MockHttpServletResponse regenerate(int charId) throws Exception {
        return call("/character/" + charId + "/candidates", "");
    }

    private MockHttpServletResponse approve(int charId, int candidateId) throws Exception {
        return call("/character/" + charId + "/approve", "{\"candidateId\":" + candidateId + "}");
    }

    private JsonNode json(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsString(StandardCharsets.UTF_8));
    }

    private int candidateCount(int charId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM character_candidate WHERE charID = ?", Integer.class, charId);
    }

    private int approvedCount(int charId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM character_candidate WHERE charID = ? AND approved = true", Integer.class, charId);
    }

    private Map<String, Object> characterRow(int charId) {
        return jdbc.queryForMap("SELECT * FROM characters WHERE charID = ?", charId);
    }

    @Test
    void create_storesCharacterWithOneCandidateAndNoCharLook() throws Exception {
        expectGenerate(1);

        MockHttpServletResponse response = create();

        assertEquals(200, response.getStatus());
        JsonNode body = json(response);
        int charId = body.get("charId").asInt();
        assertEquals(img(1), body.get("charImg").asText());
        assertTrue(body.get("candidateId").asInt() > 0);
        assertEquals(1, body.get("candidates").size());
        assertEquals(body.get("candidateId").asInt(), body.get("candidates").get(0).get("candidateId").asInt());
        assertEquals(img(1), body.get("candidates").get(0).get("imgUrl").asText());

        assertEquals(1, candidateCount(charId));
        assertEquals(0, approvedCount(charId));
        Map<String, Object> row = characterRow(charId);
        assertEquals(name, row.get("charName"));
        assertEquals(PHOTO, row.get("userImg"));
        assertEquals(img(1), row.get("charImg"));
        assertNull(row.get("charLook"));
        server.verify();
    }

    @Test
    void regenerateTwice_gives3_fourthIs409CandidateLimit() throws Exception {
        expectGenerate(1);
        expectGenerate(2);
        expectGenerate(3);

        int charId = json(create()).get("charId").asInt();
        MockHttpServletResponse second = regenerate(charId);
        assertEquals(200, second.getStatus());
        assertEquals(img(2), json(second).get("imgUrl").asText());
        assertTrue(json(second).get("candidateId").asInt() > 0);
        assertEquals(200, regenerate(charId).getStatus());
        assertEquals(3, candidateCount(charId));

        MockHttpServletResponse fourth = regenerate(charId);
        assertEquals(409, fourth.getStatus());
        assertEquals("candidate_limit", json(fourth).get("errorClass").asText());
        assertEquals(3, candidateCount(charId));

        JsonNode list = json(mockMvc.perform(get("/character/" + charId + "/candidates").sessionAttr("userId", USER_ID)).andReturn().getResponse());
        assertEquals(3, list.size());
        assertEquals(img(1), list.get(0).get("imgUrl").asText());
        assertEquals(img(3), list.get(2).get("imgUrl").asText());
        assertFalse(list.get(0).get("approved").asBoolean());
        // 재생성만으로는 대표 그림과 charLook이 바뀌지 않는다.
        assertEquals(img(1), characterRow(charId).get("charImg"));
        assertNull(characterRow(charId).get("charLook"));
        server.verify();
    }

    @Test
    void approveSecondCandidate_updatesCharacterAndMarksExactlyOneRow() throws Exception {
        expectGenerate(1);
        expectGenerate(2);
        expectFeatureCard(2);

        int charId = json(create()).get("charId").asInt();
        int secondId = json(regenerate(charId)).get("candidateId").asInt();

        MockHttpServletResponse response = approve(charId, secondId);

        assertEquals(200, response.getStatus());
        JsonNode body = json(response);
        assertEquals(charId, body.get("charId").asInt());
        assertEquals(img(2), body.get("charImg").asText());
        assertEquals(LOOK, body.get("charLook").asText());

        Map<String, Object> row = characterRow(charId);
        assertEquals(img(2), row.get("charImg"));
        assertEquals(LOOK, row.get("charLook"));
        assertEquals(1, approvedCount(charId));
        assertEquals(secondId, jdbc.queryForObject(
                "SELECT candidateID FROM character_candidate WHERE charID = ? AND approved = true",
                Integer.class, charId));
        server.verify();
    }

    @Test
    void approveAgain_returnsStoredValuesWithoutCallingFastApi() throws Exception {
        expectGenerate(1);
        expectFeatureCard(1);

        JsonNode created = json(create());
        int charId = created.get("charId").asInt();
        int candidateId = created.get("candidateId").asInt();
        assertEquals(200, approve(charId, candidateId).getStatus());
        server.verify();

        // 기대 요청이 없는 새 대역: 요청이 하나라도 가면 테스트가 실패한다.
        server = MockRestServiceServer.bindTo(restTemplate).build();
        MockHttpServletResponse again = approve(charId, candidateId);

        assertEquals(200, again.getStatus());
        assertEquals(img(1), json(again).get("charImg").asText());
        assertEquals(LOOK, json(again).get("charLook").asText());
        assertEquals(1, approvedCount(charId));
        server.verify();
    }

    @Test
    void approveWithCandidateOfAnotherCharacter_is404AndChangesNothing() throws Exception {
        expectGenerate(1);
        expectGenerate(2);

        int charId = json(create()).get("charId").asInt();
        name = "후보-" + UUID.randomUUID();
        int otherCandidateId = json(create()).get("candidateId").asInt();

        MockHttpServletResponse response = approve(charId, otherCandidateId);

        assertEquals(404, response.getStatus());
        assertEquals(0, approvedCount(charId));
        assertNull(characterRow(charId).get("charLook"));
        server.verify();
    }

    @Test
    void introBeforeApproval_is409CharacterNotApproved() throws Exception {
        expectGenerate(1);

        int charId = json(create()).get("charId").asInt();
        MockHttpServletResponse response =
                call("/intro", "{\"charId\":" + charId + ",\"genre\":\"magic\",\"place\":\"space\"}");

        assertEquals(409, response.getStatus());
        assertEquals("character_not_approved", json(response).get("errorClass").asText());
        server.verify();
    }

    @Test
    void sameNameAgain_is409DuplicateNameWithoutCallingFastApi() throws Exception {
        expectGenerate(1);

        int charId = json(create()).get("charId").asInt();
        MockHttpServletResponse response = create();

        assertEquals(409, response.getStatus());
        assertEquals("duplicate_name", json(response).get("errorClass").asText());
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM characters WHERE charName = ?", Integer.class, name));
        assertEquals(1, candidateCount(charId));
        server.verify();
    }

    @Test
    void declinedOnRegenerate_passesThrough422AndKeepsCount_laterRegenerateWorks() throws Exception {
        expectGenerate(1);
        server.expect(requestTo(BASE + "/generate/character/")).andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                        .contentType(MediaType.APPLICATION_JSON).body(DECLINED_BODY));
        expectGenerate(2);

        int charId = json(create()).get("charId").asInt();

        MockHttpServletResponse failed = regenerate(charId);
        assertEquals(422, failed.getStatus());
        assertEquals(DECLINED_BODY, failed.getContentAsString(StandardCharsets.UTF_8));
        assertEquals(1, candidateCount(charId));

        MockHttpServletResponse retried = regenerate(charId);
        assertEquals(200, retried.getStatus());
        assertEquals(img(2), json(retried).get("imgUrl").asText());
        assertEquals(2, candidateCount(charId));
        server.verify();
    }
}
