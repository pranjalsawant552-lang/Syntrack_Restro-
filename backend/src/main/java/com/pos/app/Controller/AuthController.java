package com.pos.app.Controller;

import com.pos.app.DTO.ForgotPasswordDTO;
import com.pos.app.DTO.LoginRequestDTO;
import com.pos.app.DTO.ResetPasswordDTO;
import com.pos.app.DTO.SignupRequestDTO;
import com.pos.app.Service.IAuthService;
import com.pos.app.config.ApiVersionConfig;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION+"/auth")
@RequiredArgsConstructor
@CrossOrigin
public class AuthController {

    private final IAuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request, HttpServletResponse response) {
        return authService.loginUser(request, response);
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequestDTO request) {
        return authService.signupUser(request);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return authService.refreshToken(authorization);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordDTO request) {
        return authService.forgotPassword(request);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordDTO request) {
        return authService.resetPassword(request);
    }
}
