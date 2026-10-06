package com.bookEatingBoogie.dreamGoblin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// 연결할 수 없는 주소(포트 9)로 실제 연결을 시도한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "fastapi.baseUrl=http://localhost:9")
class FastApiClientUnreachableTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void connectionFailure_becomes502WithErrorBody() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(post("/test-only/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imgUrl\":\"x\"}"))
                .andReturn().getResponse();

        assertEquals(502, response.getStatus());
        assertEquals(
                "{\"errorClass\":\"error\",\"message\":\"생성 서버에 연결할 수 없어요\",\"retryable\":true,\"resetsAt\":null}",
                response.getContentAsString(StandardCharsets.UTF_8));
    }
}
