package com.bookEatingBoogie.dreamGoblin.config;

import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    // 읽기 1200초: 가장 긴 단계인 결말은 글 2건과 그림 1건에 재시도가 붙을 수 있다.
    // simple(HttpURLConnection, HTTP/1.1): 기본 JDK HttpClient의 h2c Upgrade 요청은 uvicorn이 본문을 읽기 전에 답해서 본문이 사라진다.
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .requestFactoryBuilder(ClientHttpRequestFactoryBuilder.simple())
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(1200))
                .build();
    }
}
