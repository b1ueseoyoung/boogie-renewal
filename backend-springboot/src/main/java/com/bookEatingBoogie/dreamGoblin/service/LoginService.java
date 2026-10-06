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
    // 실패 횟수는 첫 실패부터 5분 창 안에서만 센다. 기록이 많아지면 창도 잠금도 끝난 기록만 지운다(살아 있는 횟수는 지우지 않는다).
    // 없는 아이디도 BCrypt를 한 번 계산하므로 시도 속도가 CPU로 묶여, 5분 창 안의 기록 수에도 자연히 상한이 생긴다
    private static final Duration WINDOW = Duration.ofMinutes(5);
    private static final int CLEANUP_AT = 10_000;
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    private record Failures(int count, Instant windowStart, Instant lockedUntil) {
        boolean lockedAt(Instant now) {
            return lockedUntil != null && now.isBefore(lockedUntil);
        }

        boolean expiredAt(Instant now) {
            return !lockedAt(now) && now.isAfter(windowStart.plus(WINDOW));
        }
    }

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;

    // 없는 아이디에 쓸 비교용 해시. 결과는 found.isPresent()로 한 번 더 막으니 어떤 입력과 맞아도 로그인되지 않는다
    private final String dummyHash;

    public LoginService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                        EntityManager entityManager, TransactionTemplate transactionTemplate) {
        this.dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
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

    // 잠금 상태에서 로그인하면 던진다(컨트롤러가 429로 바꾼다)
    public static class LockedException extends RuntimeException {
        public LockedException() {
            super(null, null, false, false);
        }
    }

    public Optional<User> login(LoginRequestDTO request) {
        if (request.userId() == null || request.password() == null || tooLongForBcrypt(request.password())) {
            return Optional.empty();
        }
        reserveAttempt(request.userId());
        Optional<User> found = userRepository.findById(request.userId());
        // 없는 아이디도 같은 시간을 쓰게 해 응답 시간으로 아이디가 있는지 알 수 없게 한다
        String hash = found.map(User::getPassword).orElse(dummyHash);
        boolean ok = passwordEncoder.matches(request.password(), hash) && found.isPresent();
        if (!ok) {
            return Optional.empty();
        }
        failures.remove(request.userId());
        return found;
    }

    // 비밀번호를 확인하기 전에 시도 1회를 원자적으로 센다. 동시에 몇 개를 보내도 5분 창 안에서 5번까지만 확인한다.
    // 다섯 번째 시도가 잠금을 걸고, 그 뒤 요청은 확인 없이 LockedException. 맞힌 요청만 기록을 지운다
    private void reserveAttempt(String userId) {
        Instant now = Instant.now();
        if (failures.size() >= CLEANUP_AT) {
            failures.values().removeIf(f -> f.expiredAt(now));
        }
        boolean[] locked = {false};
        failures.compute(userId, (id, f) -> {
            if (f != null && f.lockedAt(now)) {
                locked[0] = true;
                return f;
            }
            Failures live = (f == null || f.expiredAt(now)) ? new Failures(0, now, null) : f;
            int count = live.count() + 1;
            return new Failures(count, live.windowStart(), count >= MAX_FAILURES ? now.plus(LOCK) : null);
        });
        if (locked[0]) {
            throw new LockedException();
        }
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
