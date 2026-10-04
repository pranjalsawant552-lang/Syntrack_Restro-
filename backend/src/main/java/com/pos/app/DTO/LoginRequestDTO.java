package com.pos.app.DTO;

import lombok.Data;

@Data
public class LoginRequestDTO {
    private String email;
    private String password;

    /** Optional. Only needed if an email is ambiguous or the user wants to be explicit
     *  about which company to log into (rare — normally auto-resolved by email). */
    private String companySlug;
}
