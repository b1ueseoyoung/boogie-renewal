package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.DTO.CharacterOutputDTO;
import com.bookEatingBoogie.dreamGoblin.service.FastApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FastApiClientTest {

    private static final String URL = "http://localhost:8000/generate/character/";
    private static final String LIMIT_BODY =
            "{\"errorClass\":\"limit\",\"message\":\"m\",\"retryable\":false,\"resetsAt\":1791255029}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private RestTemplate restTemplate;
    @Autowired
    private FastApiClient fastApiClient;

    private MockRestServiceServer server;

    @BeforeEach
    void bindServer() {
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    private MockHttpServletResponse callTestEndpoint() throws Exception {
        return mockMvc.perform(post("/test-only/generate").sessionAttr("userId", "tester")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imgUrl\":\"x\"}"))
                .andReturn().getResponse();
    }

    @Test
    void upstream503_isPassedThroughWithSameStatusAndBody() throws Exception {
        server.expect(requestTo(URL)).andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .contentType(MediaType.APPLICATION_JSON).body(LIMIT_BODY));

        MockHttpServletResponse response = callTestEndpoint();

        assertEquals(503, response.getStatus());
        assertEquals(LIMIT_BODY, response.getContentAsString(StandardCharsets.UTF_8));
        server.verify();
    }

    @Test
    void upstream500WithNonJsonBody_keepsStatusCode() throws Exception {
        server.expect(requestTo(URL))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN).body("Internal Server Error"));

        MockHttpServletResponse response = callTestEndpoint();

        assertEquals(500, response.getStatus());
        assertEquals("Internal Server Error", response.getContentAsString(StandardCharsets.UTF_8));
        server.verify();
    }

    @Test
    void upstream200_isParsedIntoDto() {
        server.expect(requestTo(URL)).andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"s3_url\":\"http://localhost:8000/files/character/a.png\",\"charLook\":\"look\"}",
                        MediaType.APPLICATION_JSON));

        CharacterOutputDTO dto = fastApiClient.post(
                "/generate/character/", Map.of("imgUrl", "x"), CharacterOutputDTO.class);

        assertEquals("http://localhost:8000/files/character/a.png", dto.getS3_url());
        assertEquals("look", dto.getCharLook());
        server.verify();
    }
}
