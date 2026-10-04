package com.pos.app.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserResponseDTO {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private String phoneNumber;
    private boolean active;
    private boolean superAdmin;
    private String tenantName;
    private String tenantSlug;
    private List<String> permissions;
}
