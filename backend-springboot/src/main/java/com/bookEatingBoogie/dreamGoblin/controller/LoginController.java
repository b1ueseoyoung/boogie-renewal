package com.bookEatingBoogie.dreamGoblin.controller;

import com.bookEatingBoogie.dreamGoblin.DTO.ErrorDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.LoginRequestDTO;
import com.bookEatingBoogie.dreamGoblin.DTO.SignupRequestDTO;
import com.bookEatingBoogie.dreamGoblin.model.User;
import com.bookEatingBoogie.dreamGoblin.service.LoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;

import java.util.Map;
import java.util.Optional;

// 로그인 계약(계획 todo 13). 로그인 상태는 세션의 userId 하나로 판단한다.
@RestController
@CrossOrigin(origins = "http://localhost:3100", allowCredentials = "true")
public class LoginController {

    private final LoginService loginService;

    public LoginController(LoginService loginService) {
        this.loginService = loginService;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequestDTO body, HttpServletRequest request) {
        String invalid = loginService.invalidSignup(body);
        if (invalid != null) {
            return error(HttpStatus.BAD_REQUEST, ErrorDTO.of("invalid", invalid));
        }
        Optional<User> user = loginService.signup(body);
        if (user.isEmpty()) {
            return error(HttpStatus.CONFLICT, ErrorDTO.of("duplicate_id", "이미 쓰는 아이디예요."));
        }
        startSession(request, user.get());
        return ResponseEntity.status(HttpStatus.CREATED).body(view(user.get()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO body, HttpServletRequest request) {
        Optional<User> user;
        try {
            user = loginService.login(body);
        } catch (LoginService.LockedException e) {
            return error(HttpStatus.TOO_MANY_REQUESTS,
                    ErrorDTO.of("too_many_attempts", "여러 번 틀렸어요. 5분 뒤에 다시 해 주세요."));
        }
        if (user.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, ErrorDTO.of("bad_credentials", "아이디나 비밀번호가 맞지 않아요."));
        }
        startSession(request, user.get());
        return ResponseEntity.ok(view(user.get()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@SessionAttribute(name = "userId", required = false) String userId) {
        Optional<User> user = userId == null ? Optional.empty() : loginService.find(userId);
        if (user.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, ErrorDTO.authRequired());
        }
        return ResponseEntity.ok(view(user.get()));
    }


    // 세션 고정 공격을 막으려 로그인할 때마다 세션 ID를 바꾼다.
    private static void startSession(HttpServletRequest request, User user) {
        HttpSession session = request.getSession();
        request.changeSessionId();
        session.setAttribute("userId", user.getUserId());
    }

    private static Map<String, String> view(User user) {
        return Map.of("userId", user.getUserId(), "userName", user.getUserName());
    }

    private static ResponseEntity<ErrorDTO> error(HttpStatus status, ErrorDTO body) {
        return ResponseEntity.status(status).body(body);
    }
}
