package com.bookEatingBoogie.dreamGoblin.service;

import com.bookEatingBoogie.dreamGoblin.DTO.LoginRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.SignupRequestDTO;
import com.bookEatingBoogie.dreamGoblin.Repository.UserRepository;
import com.bookEatingBoogie.dreamGoblin.model.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class LoginService {

    private static final Pattern USER_ID = Pattern.compile("^[a-z0-9_]{4,20}$");
    // BCrypt는 72바이트까지만 본다. 한글 비밀번호는 64자 안에서도 넘을 수 있다.
    private static final int BCRYPT_MAX_BYTES = 72;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;

    public LoginService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                        EntityManager entityManager, TransactionTemplate transactionTemplate) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.entityManager = entityManager;
        this.transactionTemplate = transactionTemplate;
    }

    //가입 입력이 틀리면 안내 문구, 맞으면 null.
    public String invalidSignup(SignupRequestDTO request) {
        if (!isValidUserId(request.userId())) {
            return "아이디는 영어 소문자, 숫자, _로 4~20자를 써 주세요.";
        }
        String password = request.password();
        if (password == null || password.length() < 8 || password.length() > 64) {
            return "비밀번호는 8~64자로 써 주세요.";
        }
        if (tooLongForBcrypt(password)) {
            return "비밀번호가 너무 길어요. 조금 줄여 주세요.";
        }
        String name = request.userName() == null ? "" : request.userName().trim();
        if (name.isEmpty() || name.codePointCount(0, name.length()) > 20) {
            return "이름은 1~20자로 써 주세요.";
        }
        return null;
    }

    // 가입은 merge(save)가 아니라 insert(persist)로 한다. 같은 아이디로 동시에 가입해도 기존 계정을 덮어쓰지 않고,
    // 늦은 쪽은 중복 키 오류로 끝나 빈 값(409)을 돌려준다.
    public Optional<User> signup(SignupRequestDTO request) {
        if (userRepository.existsById(request.userId())) {
            return Optional.empty();
        }
        User user = new User();
        user.setUserId(request.userId());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setUserName(request.userName().trim());
        try {
            transactionTemplate.executeWithoutResult(status -> {
                entityManager.persist(user);
                entityManager.flush();
            });
        } catch (DataIntegrityViolationException | PersistenceException e) {
            return Optional.empty();
        }
        return Optional.of(user);
    }

    public Optional<User> login(LoginRequestDTO request) {
        if (request.userId() == null || request.password() == null || tooLongForBcrypt(request.password())) {
            return Optional.empty();
        }
        return userRepository.findById(request.userId())
                .filter(user -> passwordEncoder.matches(request.password(), user.getPassword()));
    }

    public Optional<User> find(String userId) {
        return userRepository.findById(userId);
    }

    public boolean isAvailable(String userId) {
        return isValidUserId(userId) && !userRepository.existsById(userId);
    }

    private static boolean isValidUserId(String userId) {
        return userId != null && USER_ID.matcher(userId).matches();
    }

    private static boolean tooLongForBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES;
    }
}
