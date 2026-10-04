package com.pos.app.DTO;

import lombok.Data;

@Data
public class CreateUserDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String phoneNumber;
    private String roleName; // must match an existing Role.name for this tenant
}
