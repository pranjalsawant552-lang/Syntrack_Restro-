package com.pos.app.Entity;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "customers",
        indexes = {
                @Index(name = "idx_customer_name", columnList = "customerName"),
                @Index(name = "idx_customer_phone", columnList = "phone"),
                @Index(name = "idx_customer_email", columnList = "email")
        }
)
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long customerId;

    @Column(nullable = false)
    private String customerName;

    @Column(length = 20)
    private String phone;

    private String email;

    @Column(length = 500)
    private String address;

    @Column(nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}