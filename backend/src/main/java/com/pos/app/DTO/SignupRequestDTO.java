package com.pos.app.DTO;

import lombok.Data;

@Data
public class SignupRequestDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String phoneNumber;

    // optional: if you want to allow role from request, keep it
    // but I recommend NOT allowing role from client
     private String role;
}
