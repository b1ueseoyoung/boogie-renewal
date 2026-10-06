package com.bookEatingBoogie.dreamGoblin;

import com.bookEatingBoogie.dreamGoblin.service.FastApiClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

// 실제 소켓으로 받아서 h2c 업그레이드(uvicorn이 본문을 버리는 원인)가 없는지 본다.
@SpringBootTest
@ActiveProfiles("test")
class FastApiClientHttp11Test {

    record Received(String protocol, String upgrade, String body) {}

    private static final CompletableFuture<Received> RECEIVED = new CompletableFuture<>();
    private static final HttpServer SERVER = startServer();

    private static HttpServer startServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/probe", exchange -> {
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                RECEIVED.complete(new Received(exchange.getProtocol(),
                        exchange.getRequestHeaders().getFirst("Upgrade"), body));
                byte[] out = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, out.length);
                exchange.getResponseBody().write(out);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void fastApiUrl(DynamicPropertyRegistry registry) {
        registry.add("fastapi.baseUrl", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort());
    }

    @AfterAll
    static void stopServer() {
        SERVER.stop(0);
    }

    @Autowired
    private FastApiClient fastApiClient;

    @Test
    void postBodyArrivesOverHttp11WithoutUpgrade() throws Exception {
        fastApiClient.post("/probe", Map.of("imgUrl", "http://example.com/x.jpg"), Map.class);

        Received received = RECEIVED.get(10, TimeUnit.SECONDS);
        assertNull(received.upgrade(), "Upgrade header must not be sent");
        assertEquals("HTTP/1.1", received.protocol());
        assertEquals("{\"imgUrl\":\"http://example.com/x.jpg\"}", received.body());
    }
}
