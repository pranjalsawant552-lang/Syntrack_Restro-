package com.pos.app.DTO;

import lombok.Data;

@Data
public class ForgotPasswordDTO {
    private String email;
    /** Optional, same purpose as in LoginRequestDTO */
    private String companySlug;
}
