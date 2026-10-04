package com.pos.app.DTO;

import lombok.Data;

@Data
public class UpdateUserDTO {
    private String firstName;
    private String lastName;
    private String phoneNumber;
    private String roleName;
}
