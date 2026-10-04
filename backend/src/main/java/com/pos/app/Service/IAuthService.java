package com.pos.app.Service;

import com.pos.app.DTO.ForgotPasswordDTO;
import com.pos.app.DTO.LoginRequestDTO;
import com.pos.app.DTO.ResetPasswordDTO;
import com.pos.app.DTO.SignupRequestDTO;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;

public interface IAuthService {
    ResponseEntity<?> loginUser(LoginRequestDTO request, HttpServletResponse response);

    ResponseEntity<?> signupUser(SignupRequestDTO request);

    ResponseEntity<?> refreshToken(String authorizationHeader);

    ResponseEntity<?> forgotPassword(ForgotPasswordDTO request);

    ResponseEntity<?> resetPassword(ResetPasswordDTO request);
}
