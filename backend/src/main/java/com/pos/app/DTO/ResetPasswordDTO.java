package com.pos.app.DTO;

import lombok.Data;

@Data
public class ResetPasswordDTO {
    private String token;
    private String newPassword;
}
