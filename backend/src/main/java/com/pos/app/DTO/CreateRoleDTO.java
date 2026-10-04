package com.pos.app.DTO;

import lombok.Data;

import java.util.Set;

@Data
public class CreateRoleDTO {
    private String name;
    private String description;
    private Set<String> permissions;
}
