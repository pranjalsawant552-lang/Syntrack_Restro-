package com.pos.app.DTO;


import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomerDTO {
    private String customerName;  // mandatory
    private String phone;
    private String email;
    private String address;
}