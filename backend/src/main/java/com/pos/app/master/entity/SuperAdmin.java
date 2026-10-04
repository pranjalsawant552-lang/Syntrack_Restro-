package com.pos.app.master.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Platform-level Super Admin. Not tied to any tenant. Lives in the MASTER database.
 */
@Entity
@Table(name = "super_admins", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuperAdmin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private boolean active = true;
    private int tokenVersion = 0;
    private LocalDateTime createdAt = LocalDateTime.now();
}
