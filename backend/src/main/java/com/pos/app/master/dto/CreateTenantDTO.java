package com.pos.app.master.dto;

import lombok.Data;

@Data
public class CreateTenantDTO {
    private String companyName;
    private String slug;
    private String contactEmail;
    private String contactPhone;

    // First Tenant Admin user
    private String adminFirstName;
    private String adminLastName;
    private String adminEmail;
    private String adminPassword;
    private String adminPhoneNumber;
}
