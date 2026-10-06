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
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class LoginService {

    private static final Pattern USER_ID = Pattern.compile("^[a-z0-9_]{4,20}$");
    // BCrypt는 72바이트까지만 본다. 한글 비밀번호는 64자 안에서도 넘을 수 있다.
    private static final int BCRYPT_MAX_BYTES = 72;
    // 아이디마다 연속 5번 틀리면 5분 동안 로그인을 막는다(비밀번호 맞히기와 BCrypt로 CPU 묶기를 막는다)
    // ponytail: 서버 메모리에만 센다. 서버가 여러 대가 되면 DB나 Redis로 옮긴다
    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK = Duration.ofMinutes(5);
    // 다른 아이디로 계속 틀려도 기록이 끝없이 늘지 않게 한다. 넘치면 지금 잠겨 있지 않은 기록부터 지운다
    private static final int MAX_TRACKED = 10_000;
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    private record Failures(int count, Instant lockedUntil) {}

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
            if (isDuplicateKey(e)) {
                return Optional.empty();
            }
            throw e;
        }
        return Optional.of(user);
    }

    public boolean isLocked(String userId) {
        Failures f = userId == null ? null : failures.get(userId);
        return f != null && f.lockedUntil() != null && Instant.now().isBefore(f.lockedUntil());
    }

    public Optional<User> login(LoginRequestDTO request) {
        if (request.userId() == null || request.password() == null || tooLongForBcrypt(request.password())) {
            return Optional.empty();
        }
        Optional<User> user = userRepository.findById(request.userId())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPassword()));
        if (user.isPresent()) {
            failures.remove(request.userId());
        } else {
            if (failures.size() >= MAX_TRACKED) {
                Instant now = Instant.now();
                failures.values().removeIf(f -> f.lockedUntil() == null || now.isAfter(f.lockedUntil()));
            }
            failures.compute(request.userId(), (id, f) -> {
                int count = (f == null || f.lockedUntil() != null ? 0 : f.count()) + 1;
                return new Failures(count, count >= MAX_FAILURES ? Instant.now().plus(LOCK) : null);
            });
        }
        return user;
    }

    public Optional<User> find(String userId) {
        return userRepository.findById(userId);
    }


    private static boolean isValidUserId(String userId) {
        return userId != null && USER_ID.matcher(userId).matches();
    }

    // 중복 키(무결성 제약 위반)만 '이미 쓰는 아이디'로 본다. 다른 저장 실패는 서버 오류로 올린다
    private static boolean isDuplicateKey(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLIntegrityConstraintViolationException
                    || t instanceof org.hibernate.exception.ConstraintViolationException) {
                return true;
            }
        }
        return false;
    }

    private static boolean tooLongForBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES;
    }
}
