package com.bookEatingBoogie.dreamGoblin.config;

import com.bookEatingBoogie.dreamGoblin.Repository.StyleRepository;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.Style;
import com.bookEatingBoogie.dreamGoblin.model.User;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SeedRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final StyleRepository styleRepository;

    public SeedRunner(UserRepository userRepository, StyleRepository styleRepository) {
        this.userRepository = userRepository;
        this.styleRepository = styleRepository;
    }

    @Override
    public void run(String... args) {
        if (userRepository.findByUserId("user").isEmpty()) {
            User user = new User();
            user.setUserId("user");
            user.setPassword("local-only");
            user.setUserName("꿈도깨비");
            user.setPhoneNum("00000000000");
            userRepository.save(user);
        }

        List<String> genres = List.of("life", "magic", "hero", "action", "adventure");
        List<String> places = List.of("space", "kingdom", "mountain", "sea", "school", "home");

        for (String genre : genres) {
            seedStyleIfMissing(genre, "genre");
        }
        for (String place : places) {
            seedStyleIfMissing(place, "place");
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
