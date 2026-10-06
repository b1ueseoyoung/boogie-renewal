package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.Repository.CharacterRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.StyleRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.Characters;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// 장면 흐름: /intro 1회와 /story 5회가 scene, story 행으로 남는지를 DB에서 확인한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SceneFlowTest {

    private static final String BASE = "http://localhost:8000";
    private static final String TIMEOUT_BODY =
            "{\"errorClass\":\"timeout\",\"message\":\"m\",\"retryable\":true,\"resetsAt\":null}";

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
    @Autowired
    private CharacterRepository characterRepository;

    private MockRestServiceServer server;
    private int charId;

    // 매 테스트가 자기 행만으로 시작한다: 창작 관련 행을 비우고 필요한 사용자, 스타일, 캐릭터를 직접 만든다.
    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM scene");
        jdbc.update("DELETE FROM story");
        jdbc.update("DELETE FROM creation");

        User user = userRepository.findByUserId("user").orElseGet(() -> {
            User u = new User();
            u.setUserId("user");
            u.setPassword("local-only");
            u.setUserName("꿈도깨비");
            u.setPhoneNum("00000000000");
            return userRepository.save(u);
        });
        seedStyle("magic", "genre");
        seedStyle("space", "place");
        charId = saveCharacter(user, "A child with short black hair. Wearing a blue T-shirt.");

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

    private int saveCharacter(User user, String charLook) {
        Characters c = new Characters();
        c.setUser(user);
        c.setCharName("주인공-" + UUID.randomUUID());
        c.setUserImg(BASE + "/files/uploads/photo.jpg");
        c.setCharImg(BASE + "/files/character/char.png");
        c.setCharLook(charLook);
        return characterRepository.save(c).getCharId();
    }

    private void expectIntro() {
        server.expect(requestTo(BASE + "/generate/intro/")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.charImgUrl").value(BASE + "/files/character/char.png"))
                .andExpect(jsonPath("$.imgUrl").value(BASE + "/files/uploads/photo.jpg"))
                .andRespond(withSuccess("{\"intro\":\"s0\",\"question\":\"q0\",\"options\":[\"a\",\"b\",\"c\"],"
                        + "\"s3_url\":\"" + BASE + "/files/scene/0.png\",\"illustPrompt\":\"ip0\"}",
                        MediaType.APPLICATION_JSON));
    }

    // page번째 요청은 이전 글 page개(호출마다 1씩 증가)와 직전 질문을 싣고 와야 한다.
    private org.springframework.test.web.client.ResponseActions expectContentRequest(int page) {
        return server.expect(requestTo(BASE + "/generate/content/")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.page").value(page))
                .andExpect(jsonPath("$.story.length()").value(page))
                .andExpect(jsonPath("$.story[0]").value("s0"))
                .andExpect(jsonPath("$.question").value("q" + (page - 1)))
                .andExpect(jsonPath("$.choice").value("c" + page));
    }

    private void expectContent(int page) {
        expectContentRequest(page).andRespond(withSuccess(
                "{\"story\":\"s" + page + "\",\"question\":\"q" + page + "\",\"choices\":[\"a\",\"b\",\"c\"],"
                        + "\"s3_url\":\"" + BASE + "/files/scene/" + page + ".png\",\"illustPrompt\":\"ip" + page + "\"}",
                MediaType.APPLICATION_JSON));
    }

    private void expectEnding() {
        server.expect(requestTo(BASE + "/generate/story/")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.storyId").isNotEmpty())
                .andExpect(jsonPath("$.story.length()").value(5))
                .andExpect(jsonPath("$.illustUrls.length()").value(5))
                .andExpect(jsonPath("$.illustUrls[4]").value(BASE + "/files/scene/4.png"))
                .andExpect(jsonPath("$.question").value("q4"))
                .andExpect(jsonPath("$.choice").value("c5"))
                .andRespond(withSuccess("{\"contentUrl\":\"" + BASE + "/files/storybook/x/content.json\","
                        + "\"title\":\"제목\",\"summary\":\"요약\",\"coverImg\":\"" + BASE + "/files/scene/0.png\","
                        + "\"ending\":{\"story\":\"s5\",\"s3_url\":\"" + BASE + "/files/scene/5.png\",\"illustPrompt\":\"ip5\"}}",
                        MediaType.APPLICATION_JSON));
    }

    private void expectFullFlow() {
        expectIntro();
        for (int page = 1; page <= 4; page++) {
            expectContent(page);
        }
        expectEnding();
    }

    private MockHttpServletResponse call(String path, String json) throws Exception {
        return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json))
                .andReturn().getResponse();
    }

    private MockHttpServletResponse intro() throws Exception {
        return call("/intro", "{\"charId\":" + charId + ",\"genre\":\"magic\",\"place\":\"space\"}");
    }

    private MockHttpServletResponse story(int page) throws Exception {
        return call("/story", "{\"choice\":\"c" + page + "\"}");
    }

    private JsonNode json(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsString(StandardCharsets.UTF_8));
    }

    private List<Integer> pages(int creationId) {
        return jdbc.queryForList("SELECT page FROM scene WHERE creationID = ? ORDER BY page", Integer.class, creationId);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private int runFlow() throws Exception {
        MockHttpServletResponse introResponse = intro();
        assertEquals(200, introResponse.getStatus());
        int creationId = json(introResponse).get("creationId").asInt();
        assertEquals(List.of(0), pages(creationId));

        for (int page = 1; page <= 4; page++) {
            assertEquals(200, story(page).getStatus());
        }
        assertEquals(List.of(0, 1, 2, 3, 4), pages(creationId));

        MockHttpServletResponse ending = story(5);
        assertEquals(201, ending.getStatus());
        assertEquals(BASE + "/files/storybook/x/content.json", json(ending).get("contentUrl").asText());
        assertEquals("제목", json(ending).get("title").asText());
        assertEquals(List.of(0, 1, 2, 3, 4, 5), pages(creationId));
        return creationId;
    }

    @Test
    void fullFlow_storesSixScenesAndOneStory() throws Exception {
        expectFullFlow();

        int creationId = runFlow();

        assertEquals(6, count("scene"));
        assertEquals(1, count("story"));
        Map<String, Object> storyRow = jdbc.queryForMap("SELECT * FROM story WHERE creationID = ?", creationId);
        assertEquals("제목", storyRow.get("title"));
        assertEquals(BASE + "/files/scene/0.png", storyRow.get("coverImg"));
        assertEquals(BASE + "/files/storybook/x/content.json", storyRow.get("content"));
        assertEquals("요약", storyRow.get("summary"));

        Map<String, Object> scene3 = jdbc.queryForMap("SELECT * FROM scene WHERE creationID = ? AND page = 3", creationId);
        assertEquals("c3", scene3.get("choice"));
        assertEquals("s3", scene3.get("story"));
        assertEquals("q3", scene3.get("question"));
        assertEquals("[\"a\",\"b\",\"c\"]", scene3.get("choices"));
        assertEquals(BASE + "/files/scene/3.png", scene3.get("illustUrl"));
        assertEquals("ip3", scene3.get("illustPrompt"));
        assertNotNull(scene3.get("createdAt"));
        assertEquals("s5", jdbc.queryForObject(
                "SELECT story FROM scene WHERE creationID = ? AND page = 5", String.class, creationId));
        server.verify();
    }

    @Test
    void responses_keepTheFieldNamesTheScreensRead() throws Exception {
        expectIntro();
        expectContent(1);

        JsonNode introBody = json(intro());
        assertEquals("s0", introBody.get("story").asText());
        assertEquals("q0", introBody.get("question").asText());
        assertEquals(3, introBody.get("choices").size());
        assertEquals(BASE + "/files/scene/0.png", introBody.get("imgUrl").asText());

        JsonNode storyBody = json(story(1));
        assertEquals("s1", storyBody.get("story").asText());
        assertEquals("q1", storyBody.get("question").asText());
        assertEquals(3, storyBody.get("choices").size());
        assertEquals(BASE + "/files/scene/1.png", storyBody.get("s3_url").asText());
        assertFalse(storyBody.has("illustPrompt"));
        server.verify();
    }

    @Test
    void storyWithoutIntro_is400NoActiveStory() throws Exception {
        MockHttpServletResponse response = story(1);

        assertEquals(400, response.getStatus());
        assertEquals("no_active_story", json(response).get("errorClass").asText());
        assertEquals(0, count("scene"));
        server.verify();
    }

    @Test
    void introForUnapprovedCharacter_is409AndStoresNothing() throws Exception {
        charId = saveCharacter(userRepository.findByUserId("user").orElseThrow(), null);

        MockHttpServletResponse response = intro();

        assertEquals(409, response.getStatus());
        assertEquals("character_not_approved", json(response).get("errorClass").asText());
        assertEquals(0, count("creation"));
        assertEquals(0, count("scene"));
        server.verify();
    }

    @Test
    void twoFlowsInARow_secondStartsAtPage0OnNewCreation() throws Exception {
        expectFullFlow();
        expectFullFlow();

        int first = runFlow();
        int second = runFlow();

        assertNotEquals(first, second);
        assertEquals(12, count("scene"));
        assertEquals(2, count("story"));
        assertEquals(400, story(1).getStatus());
        server.verify();
    }

    @Test
    void timeoutAtPage2_storesNothingAndRetryStoresPage2Once() throws Exception {
        expectIntro();
        expectContent(1);
        expectContentRequest(2).andRespond(withStatus(HttpStatus.GATEWAY_TIMEOUT)
                .contentType(MediaType.APPLICATION_JSON).body(TIMEOUT_BODY));
        expectContent(2);

        int creationId = json(intro()).get("creationId").asInt();
        assertEquals(200, story(1).getStatus());

        MockHttpServletResponse failed = story(2);
        assertEquals(504, failed.getStatus());
        assertEquals(TIMEOUT_BODY, failed.getContentAsString(StandardCharsets.UTF_8));
        assertEquals(List.of(0, 1), pages(creationId));

        assertEquals(200, story(2).getStatus());
        assertEquals(List.of(0, 1, 2), pages(creationId));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM scene WHERE creationID = ? AND page = 2", Integer.class, creationId));
        server.verify();
    }
}
