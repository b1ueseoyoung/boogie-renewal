package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.Repository.CharacterCandidateRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.CharacterRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.CreationRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.StoryRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.config.SeedRunner;
import com.bookEatingBoogie.dreamGoblin.model.CharacterCandidate;
import com.bookEatingBoogie.dreamGoblin.model.Characters;
import com.bookEatingBoogie.dreamGoblin.model.Creation;
import com.bookEatingBoogie.dreamGoblin.model.Story;
import com.bookEatingBoogie.dreamGoblin.model.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// 로그인 계약(계획 todo 13): 가입, 로그인, 로그아웃, 세션 검사, 사용자별 데이터 분리, 데모 계정 시드.
// 테스트마다 새 아이디를 만들어 실행 순서나 다른 테스트의 행에 기대지 않는다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowTest {

    private static final String PASSWORD = "password-123";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private RestTemplate restTemplate;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private SeedRunner seedRunner;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CharacterRepository characterRepository;
    @Autowired
    private CharacterCandidateRepository candidateRepository;
    @Autowired
    private CreationRepository creationRepository;
    @Autowired
    private StoryRepository storyRepository;

    private MockRestServiceServer server;

    @BeforeEach
    void bindServer() {
        // 기대 요청이 없는 대역: FastAPI로 요청이 하나라도 가면 verify에서 실패한다.
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    private static String newId() {
        return "t_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode body(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsString(StandardCharsets.UTF_8));
    }

    private MvcResult perform(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn();
    }

    private MvcResult signup(String userId, String password, String userName) throws Exception {
        return perform(post("/signup").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("userID", userId, "password", password, "userName", userName))));
    }

    private MvcResult login(MockHttpSession session, String userId, String password) throws Exception {
        return perform(post("/login").session(session).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("userID", userId, "password", password))));
    }

    private MockHttpServletResponse me(MockHttpSession session) throws Exception {
        return perform(get("/me").session(session)).getResponse();
    }

    private void assertError(MockHttpServletResponse response, int status, String errorClass) throws Exception {
        assertEquals(status, response.getStatus());
        JsonNode node = body(response);
        assertEquals(errorClass, node.get("errorClass").asText());
        assertFalse(node.get("message").asText().isBlank());
        assertFalse(node.get("retryable").asBoolean());
        assertTrue(node.has("resetsAt") && node.get("resetsAt").isNull());
    }

    private User saveUser(String userId) {
        User u = new User();
        u.setUserId(userId);
        u.setPassword(passwordEncoder.encode(PASSWORD));
        u.setUserName("사용자");
        return userRepository.save(u);
    }

    @Test
    void signup_is201_logsIn_andStoresBcryptHash() throws Exception {
        String id = newId();

        MvcResult result = signup(id, PASSWORD, "  꿈도깨비  ");

        assertEquals(201, result.getResponse().getStatus());
        JsonNode created = body(result.getResponse());
        assertEquals(id, created.get("userId").asText());
        assertEquals("꿈도깨비", created.get("userName").asText());

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        MockHttpServletResponse me = me(session);
        assertEquals(200, me.getStatus());
        assertEquals(id, body(me).get("userId").asText());
        assertEquals("꿈도깨비", body(me).get("userName").asText());

        String stored = jdbc.queryForObject("SELECT passwd FROM users WHERE userID = ?", String.class, id);
        assertTrue(stored.startsWith("$2"));
        assertTrue(passwordEncoder.matches(PASSWORD, stored));
    }

    @Test
    void signupTwice_is409DuplicateId() throws Exception {
        String id = newId();
        assertEquals(201, signup(id, PASSWORD, "처음").getResponse().getStatus());

        MockHttpServletResponse again = signup(id, "other-password", "두번째").getResponse();

        assertError(again, 409, "duplicate_id");
        assertEquals("이미 쓰는 아이디예요.", body(again).get("message").asText());
        assertEquals("처음", jdbc.queryForObject("SELECT userName FROM users WHERE userID = ?", String.class, id));
    }

    @Test
    void signupWithInvalidFields_is400Invalid() throws Exception {
        String id = newId();
        List<MvcResult> results = new ArrayList<>();
        results.add(signup("AB", PASSWORD, "이름"));
        results.add(signup(id + "-x", PASSWORD, "이름"));
        results.add(signup(id, "short", "이름"));
        results.add(signup(id, "x".repeat(65), "이름"));
        results.add(signup(id, PASSWORD, "   "));
        results.add(signup(id, PASSWORD, "가".repeat(21)));

        for (MvcResult r : results) {
            assertError(r.getResponse(), 400, "invalid");
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE userID = ?", Integer.class, id));
    }

    @Test
    void loginWithWrongPasswordOrUnknownId_is401BadCredentials() throws Exception {
        String id = newId();
        saveUser(id);

        MockHttpServletResponse wrong = login(new MockHttpSession(), id, "wrong-password").getResponse();
        assertError(wrong, 401, "bad_credentials");
        assertEquals("아이디나 비밀번호가 맞지 않아요.", body(wrong).get("message").asText());

        assertError(login(new MockHttpSession(), newId(), PASSWORD).getResponse(), 401, "bad_credentials");
    }

    @Test
    void fiveWrongPasswords_lockLoginEvenWithTheRightPassword() throws Exception {
        String id = newId();
        assertEquals(201, signup(id, "password123", "잠금").getResponse().getStatus());
        for (int i = 0; i < 5; i++) {
            assertEquals(401, login(new MockHttpSession(), id, "wrong-password").getResponse().getStatus());
        }
        assertError(login(new MockHttpSession(), id, "password123").getResponse(), 429, "too_many_attempts");
    }

    @Test
    void login_isOk_andRotatesSessionId() throws Exception {
        String id = newId();
        saveUser(id);
        MockHttpSession session = new MockHttpSession();
        String before = session.getId();

        MvcResult result = login(session, id, PASSWORD);

        assertEquals(200, result.getResponse().getStatus());
        assertEquals(id, body(result.getResponse()).get("userId").asText());
        assertEquals("사용자", body(result.getResponse()).get("userName").asText());
        MockHttpSession after = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(after);
        assertNotEquals(before, after.getId());
        assertEquals(200, me(after).getStatus());
    }

    @Test
    void logout_is204_thenMeIs401() throws Exception {
        MockHttpSession session = (MockHttpSession) signup(newId(), PASSWORD, "이름").getRequest().getSession(false);
        assertEquals(200, me(session).getStatus());

        assertEquals(204, perform(post("/logout").session(session)).getResponse().getStatus());

        MockHttpServletResponse me = me(session);
        assertError(me, 401, "auth_required");
        assertEquals("로그인이 필요해요.", body(me).get("message").asText());
    }

    @Test
    void protectedPathWithoutSession_is401AuthRequired_butPreflightPasses() throws Exception {
        MockHttpServletResponse response = perform(get("/mypage/story")).getResponse();
        assertError(response, 401, "auth_required");
        assertEquals("로그인이 필요해요.", body(response).get("message").asText());

        MockHttpServletResponse preflight = perform(options("/mypage/story")
                .header("Origin", "http://localhost:3100")
                .header("Access-Control-Request-Method", "GET")).getResponse();
        assertEquals(200, preflight.getStatus());
        assertEquals("http://localhost:3100", preflight.getHeader("Access-Control-Allow-Origin"));
        assertEquals("true", preflight.getHeader("Access-Control-Allow-Credentials"));
    }

    @Test
    void checkUserId_reportsAvailability() throws Exception {
        String taken = newId();
        saveUser(taken);

        JsonNode free = body(perform(get("/api/users/check").param("userID", newId())).getResponse());
        JsonNode used = body(perform(get("/api/users/check").param("userID", taken)).getResponse());

        assertTrue(free.get("available").asBoolean());
        assertFalse(used.get("available").asBoolean());
    }

    @Test
    void otherUser_cannotSeeOrTouchCandidatesOrStories() throws Exception {
        String a = newId();
        String b = newId();
        User userA = saveUser(a);
        saveUser(b);

        Characters ch = new Characters();
        ch.setUser(userA);
        ch.setCharName("A의 주인공-" + UUID.randomUUID());
        ch.setUserImg("http://localhost:8000/files/uploads/a.jpg");
        ch.setCharImg("http://localhost:8000/files/character/a.png");
        characterRepository.save(ch);
        CharacterCandidate candidate = new CharacterCandidate();
        candidate.setCharacters(ch);
        candidate.setImgUrl("http://localhost:8000/files/character/a.png");
        candidateRepository.save(candidate);

        Creation creation = new Creation();
        creation.setCharacters(ch);
        creationRepository.save(creation);
        Story story = new Story();
        story.setCreation(creation);
        story.setTitle("A의 책");
        story.setContent("http://localhost:8000/files/storybook/a/content.json");
        storyRepository.save(story);

        int charId = ch.getCharId();
        String approveBody = "{\"candidateId\":" + candidate.getCandidateId() + "}";

        assertEquals(404, perform(get("/character/" + charId + "/candidates").sessionAttr("userId", b))
                .getResponse().getStatus());
        assertEquals(404, perform(post("/character/" + charId + "/candidates").sessionAttr("userId", b))
                .getResponse().getStatus());
        assertEquals(404, perform(post("/character/" + charId + "/approve").sessionAttr("userId", b)
                .contentType(MediaType.APPLICATION_JSON).content(approveBody)).getResponse().getStatus());
        assertEquals(404, perform(post("/intro").sessionAttr("userId", b).contentType(MediaType.APPLICATION_JSON)
                .content("{\"charId\":" + charId + ",\"genre\":\"magic\",\"place\":\"space\"}"))
                .getResponse().getStatus());

        MockHttpServletResponse ownList = perform(get("/character/" + charId + "/candidates").sessionAttr("userId", a))
                .getResponse();
        assertEquals(200, ownList.getStatus());
        assertEquals(1, body(ownList).size());
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM character_candidate WHERE charID = ? AND approved = true", Integer.class, charId));

        JsonNode storageB = body(perform(get("/mypage/story").sessionAttr("userId", b)).getResponse());
        assertFalse(storageB.toString().contains(story.getStoryId()));
        assertEquals(0, storageB.get("characters").size());

        JsonNode storageA = body(perform(get("/mypage/story").sessionAttr("userId", a)).getResponse());
        assertEquals(story.getStoryId(), storageA.get("stories").get(0).get("storyId").asText());

        // B가 A의 책을 지우려 하면 404이고 책은 그대로다
        MockHttpServletResponse deleteByB = perform(post("/mypage/story/delete").sessionAttr("userId", b)
                .contentType(MediaType.APPLICATION_JSON).content("{\"storyId\":\"" + story.getStoryId() + "\"}")).getResponse();
        assertError(deleteByB, 404, "not_found");
        assertTrue(storyRepository.findByStoryId(story.getStoryId()).isPresent());
        server.verify();
    }

    @Test
    void demoSeed_upgradesPlaintextPasswordToBcrypt() throws Exception {
        // application-test.properties: app.demo.user-id=demo, app.demo.password=demo-pass-1234
        jdbc.update("INSERT INTO users (userID, passwd, userName) VALUES ('demo', 'demo-pass-1234', '데모') "
                + "ON DUPLICATE KEY UPDATE passwd = 'demo-pass-1234'");

        seedRunner.run();

        String stored = jdbc.queryForObject("SELECT passwd FROM users WHERE userID = 'demo'", String.class);
        assertTrue(stored.startsWith("$2"));
        assertTrue(passwordEncoder.matches("demo-pass-1234", stored));
        assertEquals(200, login(new MockHttpSession(), "demo", "demo-pass-1234").getResponse().getStatus());

        seedRunner.run();
        assertEquals(stored, jdbc.queryForObject("SELECT passwd FROM users WHERE userID = 'demo'", String.class));
    }
}
