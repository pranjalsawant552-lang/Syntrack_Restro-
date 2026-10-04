package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String password;

    /**
     * Kept as a plain string for backward compatibility with existing DTOs/frontend
     * (mirrors roleRef.getName()). The authoritative source of truth for permissions
     * is the {@link #roleRef} association below.
     */
    private String role;

    private String phoneNumber;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id")
    private Role roleRef;

    /** Deactivated users cannot log in. Toggled by Tenant Admin / Super Admin. */
    private boolean active = true;

    /**
     * Bumped whenever the password changes or an admin wants to force this user to
     * re-login everywhere (e.g. "log out of all devices"). JWTs embed the version at
     * issue time; a mismatch at request time means the token is stale and is rejected.
     */
    private int tokenVersion = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();
}
