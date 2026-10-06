package com.bookEatingBoogie.dreamGoblin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Service
public class FastApiClient {

    private static final String UNREACHABLE_BODY =
            "{\"errorClass\":\"error\",\"message\":\"생성 서버에 연결할 수 없어요\",\"retryable\":true,\"resetsAt\":null}";

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public FastApiClient(RestTemplate restTemplate, @Value("${fastapi.baseUrl}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    public <T> T post(String path, Object body, Class<T> type) {
        try {
            return restTemplate.postForObject(baseUrl + path, body, type);
        } catch (HttpStatusCodeException e) {
            throw new GenerationException(e.getStatusCode().value(), e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw new GenerationException(502, UNREACHABLE_BODY);
        }
    }
}
