package com.pos.app.DTO;

import lombok.Data;

@Data
public class CreateSupplierDTO {
    private String supplierName;
    private String phone;
    private String email;
    private String address;
    private String gstNumber;
}
