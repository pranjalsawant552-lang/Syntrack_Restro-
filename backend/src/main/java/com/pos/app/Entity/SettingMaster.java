package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "setting_master")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SettingMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long settingId;

    private String companyName;
    private String address;
    private String city;
    private String phoneNumber;
    private String email;
    private String gstNumber;

    /**
     * Branding shown across the whole application (header, browser tab, receipts).
     * Editable anytime by the Tenant Admin (or Super Admin) via /v1/settings/branding.
     */
    private String appName;

    /** URL/path to the uploaded logo file, served statically. */
    private String logoUrl;

    /* ---- QR self-ordering (null = use the default) ---- */
    private Boolean qrOrderingEnabled;      // default true
    private Integer qrHoldMinutes;          // scan -> first order window, default 5
    private Integer qrSessionMinutes;       // dining window once accepted, default 120
    private String qrApprovalMode;          // NONE | FIRST_ORDER (default) | EVERY_ORDER
}
