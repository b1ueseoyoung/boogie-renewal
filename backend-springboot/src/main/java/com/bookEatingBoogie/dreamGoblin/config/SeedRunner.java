package com.bookEatingBoogie.dreamGoblin.config;

import com.bookEatingBoogie.dreamGoblin.Repository.StyleRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.Style;
import com.bookEatingBoogie.dreamGoblin.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class SeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final UserRepository userRepository;
    private final StyleRepository styleRepository;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final String demoUserId;
    private final String demoPassword;

    public SeedRunner(UserRepository userRepository, StyleRepository styleRepository, JdbcTemplate jdbc,
                      PasswordEncoder passwordEncoder,
                      @Value("${app.demo.user-id:demo}") String demoUserId,
                      @Value("${app.demo.password:}") String demoPassword) {
        this.userRepository = userRepository;
        this.styleRepository = styleRepository;
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.demoUserId = demoUserId;
        this.demoPassword = demoPassword;
    }

    @Override
    public void run(String... args) {
        widenUserColumns();
        seedDemoUser();

        List<String> genres = List.of("life", "magic", "hero", "action", "adventure");
        List<String> places = List.of("space", "kingdom", "mountain", "sea", "school", "home");

        for (String genre : genres) {
            seedStyleIfMissing(genre, "genre");
        }
        for (String place : places) {
            seedStyleIfMissing(place, "place");
        }
    }

    // ddl-auto=update는 이미 있는 열을 바꾸지 않는다. BCrypt 해시(60자)와 전화번호 없는 가입을 받도록 직접 넓힌다.
    private void widenUserColumns() {
        for (String sql : List.of(
                "ALTER TABLE users MODIFY passwd VARCHAR(100) NOT NULL",
                "ALTER TABLE users MODIFY phoneNum VARCHAR(11) NULL")) {
            try {
                jdbc.execute(sql);
            } catch (DataAccessException e) {
                log.warn("users 열 변경 실패 ({}): {}", sql, e.getMessage());
            }
        }
    }

    // 데모 계정: 없으면 만들고, 저장된 비밀번호가 설정값과 BCrypt로 맞지 않으면(옛 평문 포함) 해시로 바꾼다.
    private void seedDemoUser() {
        if (demoPassword.isBlank()) {
            return;
        }
        Optional<User> existing = userRepository.findById(demoUserId);
        if (existing.isEmpty()) {
            User demo = new User();
            demo.setUserId(demoUserId);
            demo.setPassword(passwordEncoder.encode(demoPassword));
            demo.setUserName("데모");
            userRepository.save(demo);
            return;
        }
        String stored = existing.get().getPassword();
        if (stored == null || !passwordEncoder.matches(demoPassword, stored)) {
            // 엔티티를 merge하지 않고 비밀번호 열만 바꿔서 데모 계정의 캐릭터와 책에 손대지 않는다.
            jdbc.update("UPDATE users SET passwd = ? WHERE userID = ?", passwordEncoder.encode(demoPassword), demoUserId);
        }
    }

    private void seedStyleIfMissing(String styleId, String styleType) {
        if (styleRepository.findByStyle(styleId).isEmpty()) {
            Style style = new Style();
            style.setStyle(styleId);
            style.setStyleType(styleType);
            styleRepository.save(style);
        }
    }
}
