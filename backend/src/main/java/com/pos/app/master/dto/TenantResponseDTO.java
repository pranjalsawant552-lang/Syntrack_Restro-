package com.pos.app.master.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TenantResponseDTO {
    private Long id;
    private String name;
    private String slug;
    private String contactEmail;
    private String contactPhone;
    private String logoUrl;
    private boolean active;
    private Integer maxUsers;
    private Integer maxProducts;
    private LocalDateTime createdAt;
}
